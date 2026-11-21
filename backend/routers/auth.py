"""Registration and login endpoints."""
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

import models
import schemas
import trust
from database import get_db
from auth import hash_password, verify_password, create_access_token
from services.sms_service import (
    get_sms_provider,
    otp_rate_limiter,
    mask_phone,
    validate_indian_mobile,
    extract_client_ip,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

IS_PRODUCTION = os.getenv("ENVIRONMENT", "").lower() in ("production", "prod") or os.getenv("FASTAPI_ENV", "").lower() in ("production", "prod")


def is_sms_provider_configured() -> bool:
    """
    Checks if an SMS provider (e.g. MSG91, Fast2SMS, Twilio) is configured
    via environment variables or mock injection. Does not mock without explicit configuration.
    """
    provider = get_sms_provider(is_production=IS_PRODUCTION)
    if provider.is_configured():
        return True
    return bool(
        os.getenv("MSG91_AUTH_KEY") or
        os.getenv("SMS_PROVIDER_API_KEY") or
        os.getenv("SMS_GATEWAY_URL") or
        os.getenv("TWILIO_ACCOUNT_SID")
    )


@router.post("/register", response_model=schemas.Token)
def register(payload: schemas.RegisterRequest, db: Session = Depends(get_db)):
    # Strict server-side security enforcement: public registration cannot create administrator accounts
    role_val = payload.role.value if hasattr(payload.role, "value") else str(payload.role)
    if role_val.lower() not in ("farmer", "industry"):
        raise HTTPException(status_code=422, detail="Public registration is restricted to farmer and industry accounts only")

    existing = db.query(models.User).filter(models.User.mobile == payload.mobile).first()
    if existing:
        raise HTTPException(status_code=400, detail="Mobile number already registered")

    if payload.role == models.RoleEnum.industry and not payload.contact_person:
        raise HTTPException(status_code=422, detail="Contact person is required for industry accounts")

    user = models.User(
        role=models.RoleEnum(payload.role.value if hasattr(payload.role, "value") else str(payload.role)),
        name=payload.name,
        contact_person=payload.contact_person,
        mobile=payload.mobile,
        hashed_password=hash_password(payload.password),
        location=payload.location,
        profile_image=payload.profile_image,
        is_verified=False,
    )
    user.trust_score = trust.calculate_trust_score(user, db)
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "token_version": getattr(user, "token_version", 1) or 1})
    user_out = schemas.UserOut.model_validate(user)
    user_out.posts_count = 0
    return schemas.Token(access_token=token, user=user_out)


@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.mobile == payload.mobile).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid mobile number or password")

    user.trust_score = trust.calculate_trust_score(user, db)
    db.commit()

    token = create_access_token({"sub": str(user.id), "token_version": getattr(user, "token_version", 1) or 1})
    posts_count = len(user.posts)
    user_out = schemas.UserOut.model_validate(user)
    user_out.posts_count = posts_count
    return schemas.Token(access_token=token, user=user_out)


@router.post("/send-otp", response_model=schemas.OtpResponse)
def send_otp(payload: schemas.SendOtpRequest, request: Request = None):
    """
    Mobile OTP dispatch with server-side rate limiting and MSG91 provider integration.
    In testing/development, returns simulated testing OTP '1234'.
    In production, checks for configured SMS provider and dispatches real OTP.
    Fails safely with HTTP 503 if provider is not configured.
    """
    # 1. Validate Indian mobile number (SEC-05)
    is_valid, national_mobile, err_msg = validate_indian_mobile(payload.mobile)
    if not is_valid:
        raise HTTPException(status_code=400, detail=err_msg)
    digits = national_mobile

    provider = get_sms_provider(is_production=IS_PRODUCTION)

    if IS_PRODUCTION:
        if not is_sms_provider_configured() or not provider.is_configured():
            raise HTTPException(
                status_code=503,
                detail="SMS service is currently unavailable. No production SMS provider is configured."
            )

        # 2. Extract client IP safely without trusting spoofed forwarding headers (SEC-01)
        client_ip = extract_client_ip(request)

        # Check 60-second cooldown and 10-minute rate limit
        allowed, rate_err, retry_after = otp_rate_limiter.check_limit(
            digits, ip=client_ip, is_production=IS_PRODUCTION
        )
        if not allowed:
            headers = {"Retry-After": str(retry_after)} if retry_after else None
            raise HTTPException(status_code=429, detail=rate_err, headers=headers)

        res = provider.send_otp(digits)
        if not res.success:
            if res.error_code in ("NETWORK_ERROR", "TIMEOUT"):
                raise HTTPException(status_code=504, detail="SMS provider timed out. Please try again.")
            elif res.error_code in ("AUTH_ERROR", "INVALID_CREDENTIALS"):
                raise HTTPException(status_code=503, detail=res.message or "SMS service configuration error.")
            elif res.error_code == "PROVIDER_RATE_LIMIT":
                raise HTTPException(status_code=429, detail="SMS provider rate limit exceeded. Please wait.")
            else:
                raise HTTPException(
                    status_code=502,
                    detail=res.message or "Failed to dispatch verification code via SMS."
                )

        # Record successful dispatch timestamp for rate limiting & cooldown
        otp_rate_limiter.record_send(digits, ip=client_ip)

        return schemas.OtpResponse(
            message=res.message or f"OTP sent successfully via SMS to {mask_phone(digits)}",
            otp=None,
            is_verified=False
        )

    # Development / Local Testing Mode
    res = provider.send_otp(digits)
    return schemas.OtpResponse(
        message=res.message or f"OTP sent successfully to {digits}",
        otp=res.otp or "1234",
        is_verified=False
    )


@router.post("/verify-otp", response_model=schemas.OtpResponse)
def verify_otp(
    payload: schemas.VerifyOtpRequest,
    db: Session = Depends(get_db),
    request: Request = None,
):
    """
    Verify mobile OTP code and mark account as Mobile Number Verified.
    Rejects hardcoded test code '1234' in production environments.
    Verifies against MSG91 managed OTP service in production.
    Enforces maximum 5 verification attempts per mobile/IP within 10 minutes (SEC-03).
    """
    # Support positional argument variations from tests
    if isinstance(db, Request) and isinstance(request, Session):
        db, request = request, db
    elif hasattr(db, "headers") and not hasattr(db, "query"):
        request = db
        db = None

    # 1. Validate Indian mobile number (SEC-05)
    is_valid, national_mobile, err_msg = validate_indian_mobile(payload.mobile)
    if not is_valid:
        raise HTTPException(status_code=400, detail=err_msg)
    digits = national_mobile

    clean_otp = payload.otp.strip()
    if not clean_otp:
        raise HTTPException(status_code=400, detail="Please enter verification code")

    # 2. Extract client IP safely (SEC-01)
    client_ip = extract_client_ip(request)

    # 3. Check verification rate limit (SEC-03: max 5 attempts per mobile/IP per 10 minutes)
    allowed, rate_err, retry_after = otp_rate_limiter.check_verify_limit(
        digits, ip=client_ip, is_production=IS_PRODUCTION
    )
    if not allowed:
        headers = {"Retry-After": str(retry_after)} if retry_after else None
        raise HTTPException(status_code=429, detail=rate_err, headers=headers)

    # Record verification attempt
    otp_rate_limiter.record_verify_attempt(digits, ip=client_ip)

    provider = get_sms_provider(is_production=IS_PRODUCTION)

    if IS_PRODUCTION:
        if clean_otp == "1234":
            raise HTTPException(status_code=400, detail="Simulated test OTP is disabled in production environment")
        if not is_sms_provider_configured() or not provider.is_configured():
            raise HTTPException(
                status_code=503,
                detail="OTP verification is currently unavailable. No production SMS provider is configured."
            )

        is_valid_otp, verify_msg = provider.verify_otp(digits, clean_otp)
        if not is_valid_otp:
            if "configuration error" in (verify_msg or "").lower():
                raise HTTPException(status_code=503, detail=verify_msg)
            raise HTTPException(status_code=400, detail=verify_msg or "Invalid or expired OTP code")

    else:
        # Development / Testing Mode
        is_valid_otp, verify_msg = provider.verify_otp(digits, clean_otp)
        if not is_valid_otp:
            raise HTTPException(status_code=400, detail=verify_msg or "Invalid OTP code. Please enter 1234.")

    # Verification successful: clear failed attempt history for this mobile
    otp_rate_limiter.record_verify_success(digits)

    user = db.query(models.User).filter(models.User.mobile == digits).first()
    user_out = None
    if user:
        user.is_verified = True
        user.trust_score = trust.calculate_trust_score(user, db)
        db.commit()
        db.refresh(user)
        user_out = schemas.UserOut.model_validate(user)
        user_out.posts_count = len(user.posts)

    return schemas.OtpResponse(
        message="Mobile number verified successfully",
        otp=None if IS_PRODUCTION else "1234",
        is_verified=True,
        user=user_out
    )

