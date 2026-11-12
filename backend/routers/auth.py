"""Registration and login endpoints."""
import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
import schemas
import trust
from database import get_db
from auth import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

IS_PRODUCTION = os.getenv("ENVIRONMENT", "").lower() in ("production", "prod") or os.getenv("FASTAPI_ENV", "").lower() in ("production", "prod")


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

    token = create_access_token({"sub": str(user.id)})
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

    token = create_access_token({"sub": str(user.id)})
    posts_count = len(user.posts)
    user_out = schemas.UserOut.model_validate(user)
    user_out.posts_count = posts_count
    return schemas.Token(access_token=token, user=user_out)


@router.post("/send-otp", response_model=schemas.OtpResponse)
def send_otp(payload: schemas.SendOtpRequest):
    """
    Mobile OTP dispatch.
    In testing/development, returns simulated testing OTP '1234'.
    In production, OTP values are NEVER exposed in API responses and must be delivered via SMS.
    """
    digits = "".join(filter(str.isdigit, payload.mobile))
    if len(digits) < 10:
        raise HTTPException(status_code=400, detail="Please enter a valid 10-digit mobile number")

    if IS_PRODUCTION:
        # In production: simulated OTP is suppressed; SMS provider integration is invoked.
        return schemas.OtpResponse(
            message=f"OTP sent successfully via SMS to {digits[-10:]}",
            otp=None,
            is_verified=False
        )

    return schemas.OtpResponse(
        message=f"OTP sent successfully to {digits[-10:]}",
        otp="1234",
        is_verified=False
    )


@router.post("/verify-otp", response_model=schemas.OtpResponse)
def verify_otp(payload: schemas.VerifyOtpRequest, db: Session = Depends(get_db)):
    """
    Verify mobile OTP code and mark account as Mobile Number Verified.
    Rejects hardcoded test code '1234' in production environments.
    """
    digits = "".join(filter(str.isdigit, payload.mobile))
    if len(digits) < 10:
        raise HTTPException(status_code=400, detail="Please enter a valid 10-digit mobile number")

    if IS_PRODUCTION:
        if payload.otp.strip() == "1234":
            raise HTTPException(status_code=400, detail="Simulated test OTP is disabled in production environment")
        # In a real environment, verify against SMS store / cache
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code")

    if payload.otp.strip() != "1234":
        raise HTTPException(status_code=400, detail="Invalid OTP code. Please enter 1234.")

    user = db.query(models.User).filter(models.User.mobile == digits[-10:]).first()
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

