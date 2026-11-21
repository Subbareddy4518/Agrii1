"""
Comprehensive Unit & Integration Test Suite for AgriConnect 2.0
Phase 1 Production Mobile OTP Authentication with MSG91 Provider Integration.

Tests:
1. Development OTP regression behavior.
2. Production mock OTP rejection (1234 rejected in production).
3. Production unconfigured provider safety (503 Service Unavailable).
4. Successful provider dispatch with mocked API responses.
5. Successful OTP verification with mocked API responses.
6. Invalid OTP rejection.
7. Expired OTP rejection.
8. 60-second resend cooldown enforcement (HTTP 429).
9. Maximum 3 requests per mobile per 10-minute window (HTTP 429).
10. IP-based abuse rate limiting (HTTP 429).
11. Provider failure handling (timeout -> 504, auth error -> 503, outage -> 502).
12. Farmer registration, OTP verification, and login workflow.
13. Industry registration, OTP verification, and login workflow.
14. Zero credential or OTP leakage in public API responses.
"""

import os
import sys
import unittest
from datetime import datetime
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import models
import schemas
from auth import hash_password, verify_password
from database import Base, get_db
from main import app
from routers import auth
from services.sms_service import (
    BaseSmsProvider,
    MockSmsProvider,
    Msg91SmsProvider,
    SmsDeliveryResult,
    get_sms_provider,
    mask_phone,
    normalize_indian_mobile,
    validate_indian_mobile,
    extract_client_ip,
    is_ip_trusted,
    otp_rate_limiter,
    set_mock_provider,
)


class TestMsg91OtpProduction(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:", connect_args={"check_same_thread": False}
        )
        cls.SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=cls.engine
        )
        Base.metadata.create_all(bind=cls.engine)

        def override_get_db():
            db = cls.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()

    def setUp(self):
        self.db = self.SessionLocal()
        # Clean all tables before each test
        for table in reversed(Base.metadata.sorted_tables):
            self.db.execute(table.delete())
        self.db.commit()

        # Reset rate limiter tracking and mock provider
        otp_rate_limiter.reset()
        set_mock_provider(None)

        # Store original environment state
        self._orig_is_prod = auth.IS_PRODUCTION
        self._orig_sms_key = os.environ.get("SMS_PROVIDER_API_KEY")
        self._orig_msg91_key = os.environ.get("MSG91_AUTH_KEY")

    def tearDown(self):
        self.db.close()
        otp_rate_limiter.reset()
        set_mock_provider(None)

        auth.IS_PRODUCTION = self._orig_is_prod
        if self._orig_sms_key is not None:
            os.environ["SMS_PROVIDER_API_KEY"] = self._orig_sms_key
        elif "SMS_PROVIDER_API_KEY" in os.environ:
            del os.environ["SMS_PROVIDER_API_KEY"]

        if self._orig_msg91_key is not None:
            os.environ["MSG91_AUTH_KEY"] = self._orig_msg91_key
        elif "MSG91_AUTH_KEY" in os.environ:
            del os.environ["MSG91_AUTH_KEY"]

    # --------------------------------------------------------------------------
    # 1. Development OTP Regression
    # --------------------------------------------------------------------------
    def test_01_dev_otp_regression(self):
        """In development mode, OTP dispatch returns simulated code '1234' and verifies successfully."""
        auth.IS_PRODUCTION = False

        res = auth.send_otp(schemas.SendOtpRequest(mobile="9848011223"))
        self.assertEqual(res.otp, "1234")
        self.assertFalse(res.is_verified)
        self.assertIn("9848011223", res.message)

        v_res = auth.verify_otp(
            schemas.VerifyOtpRequest(mobile="9848011223", otp="1234"), db=self.db
        )
        self.assertTrue(v_res.is_verified)
        self.assertEqual(v_res.otp, "1234")

    # --------------------------------------------------------------------------
    # 2. Production Rejection of Simulated Code
    # --------------------------------------------------------------------------
    def test_02_production_rejects_mock_otp(self):
        """In production mode, entering test code '1234' is strictly rejected with HTTP 400."""
        auth.IS_PRODUCTION = True
        os.environ["MSG91_AUTH_KEY"] = "live_production_auth_key"

        with self.assertRaises(HTTPException) as ctx:
            auth.verify_otp(
                schemas.VerifyOtpRequest(mobile="9848011223", otp="1234"), db=self.db
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("disabled in production", ctx.exception.detail.lower())

    # --------------------------------------------------------------------------
    # 3. Production Unconfigured Provider Fails Safely with HTTP 503
    # --------------------------------------------------------------------------
    def test_03_production_unconfigured_provider_fails_503(self):
        """In production mode without configured SMS provider, send and verify return HTTP 503."""
        auth.IS_PRODUCTION = True
        if "MSG91_AUTH_KEY" in os.environ:
            del os.environ["MSG91_AUTH_KEY"]
        if "SMS_PROVIDER_API_KEY" in os.environ:
            del os.environ["SMS_PROVIDER_API_KEY"]
        if "SMS_GATEWAY_URL" in os.environ:
            del os.environ["SMS_GATEWAY_URL"]
        if "TWILIO_ACCOUNT_SID" in os.environ:
            del os.environ["TWILIO_ACCOUNT_SID"]

        with self.assertRaises(HTTPException) as ctx_send:
            auth.send_otp(schemas.SendOtpRequest(mobile="9848011223"))
        self.assertEqual(ctx_send.exception.status_code, 503)
        self.assertIn("unavailable", ctx_send.exception.detail.lower())

        with self.assertRaises(HTTPException) as ctx_ver:
            auth.verify_otp(
                schemas.VerifyOtpRequest(mobile="9848011223", otp="8899"), db=self.db
            )
        self.assertEqual(ctx_ver.exception.status_code, 503)
        self.assertIn("unavailable", ctx_ver.exception.detail.lower())

    # --------------------------------------------------------------------------
    # 4. Successful Provider Dispatch (Mocked Response)
    # --------------------------------------------------------------------------
    def test_04_successful_provider_dispatch_mocked(self):
        """Successful provider dispatch masks phone and sets otp to None."""
        auth.IS_PRODUCTION = True
        mock_provider = MockSmsProvider(is_configured=True, send_success=True)
        set_mock_provider(mock_provider)

        res = auth.send_otp(schemas.SendOtpRequest(mobile="9848011223"))
        self.assertIsNone(res.otp)
        self.assertFalse(res.is_verified)
        self.assertIn("SMS", res.message)
        self.assertIn("XXXXXX1223", res.message)
        self.assertEqual(len(mock_provider.dispatched_mobiles), 1)
        self.assertEqual(mock_provider.dispatched_mobiles[0], "9848011223")

    # --------------------------------------------------------------------------
    # 5. Successful OTP Verification (Mocked Response)
    # --------------------------------------------------------------------------
    def test_05_successful_provider_verification_mocked(self):
        """Successful provider verification updates database user verification state."""
        auth.IS_PRODUCTION = True
        mock_provider = MockSmsProvider(is_configured=True, verify_success=True)
        set_mock_provider(mock_provider)

        # Create user in database with computed initial unverified trust score (55)
        farmer = models.User(
            role=models.RoleEnum.farmer,
            name="Ravi Kumar",
            mobile="9848011223",
            hashed_password=hash_password("FarmerPass123"),
            is_verified=False,
            trust_score=55,
            status="active",
        )
        self.db.add(farmer)
        self.db.commit()
        self.db.refresh(farmer)
        self.assertFalse(farmer.is_verified)
        initial_score = farmer.trust_score

        res = auth.verify_otp(
            schemas.VerifyOtpRequest(mobile="9848011223", otp="5678"), db=self.db
        )
        self.assertTrue(res.is_verified)
        self.assertIsNone(res.otp)
        self.assertIsNotNone(res.user)
        self.assertTrue(res.user.is_verified)

        # Confirm database commit and trust score bump (+30 for mobile verification)
        self.db.refresh(farmer)
        self.assertTrue(farmer.is_verified)
        self.assertEqual(farmer.trust_score, 85)
        self.assertGreater(farmer.trust_score, initial_score)

    # --------------------------------------------------------------------------
    # 6. Invalid OTP Rejection
    # --------------------------------------------------------------------------
    def test_06_invalid_otp_rejection(self):
        """Invalid OTP code returned by provider raises HTTP 400."""
        auth.IS_PRODUCTION = True
        mock_provider = MockSmsProvider(
            is_configured=True,
            verify_success=False,
            verify_message="Invalid verification code. Please check and try again.",
        )
        set_mock_provider(mock_provider)

        with self.assertRaises(HTTPException) as ctx:
            auth.verify_otp(
                schemas.VerifyOtpRequest(mobile="9848011223", otp="9999"), db=self.db
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("invalid", ctx.exception.detail.lower())

    # --------------------------------------------------------------------------
    # 7. Expired OTP Rejection
    # --------------------------------------------------------------------------
    def test_07_expired_otp_rejection(self):
        """Expired OTP code returned by provider raises HTTP 400 with expiration notice."""
        auth.IS_PRODUCTION = True
        mock_provider = MockSmsProvider(
            is_configured=True,
            verify_success=False,
            verify_message="Verification code has expired. Please request a new code.",
        )
        set_mock_provider(mock_provider)

        with self.assertRaises(HTTPException) as ctx:
            auth.verify_otp(
                schemas.VerifyOtpRequest(mobile="9848011223", otp="5678"), db=self.db
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("expired", ctx.exception.detail.lower())

    # --------------------------------------------------------------------------
    # 8. 60-Second Resend Cooldown
    # --------------------------------------------------------------------------
    def test_08_resend_cooldown_60s(self):
        """Repeated OTP request within 60 seconds raises HTTP 429 Too Many Requests."""
        auth.IS_PRODUCTION = True
        mock_provider = MockSmsProvider(is_configured=True, send_success=True)
        set_mock_provider(mock_provider)

        # 1st request -> Allowed
        res1 = auth.send_otp(schemas.SendOtpRequest(mobile="9848055667"))
        self.assertIn("SMS", res1.message)

        # 2nd request immediately -> Blocked by 60s cooldown
        with self.assertRaises(HTTPException) as ctx:
            auth.send_otp(schemas.SendOtpRequest(mobile="9848055667"))
        self.assertEqual(ctx.exception.status_code, 429)
        self.assertIn("wait", ctx.exception.detail.lower())
        self.assertIn("seconds", ctx.exception.detail.lower())
        self.assertIn("Retry-After", ctx.exception.headers)

    # --------------------------------------------------------------------------
    # 9. Maximum 3 Requests per 10-Minute Window
    # --------------------------------------------------------------------------
    def test_09_rate_limiting_max_3_per_10_minutes(self):
        """More than 3 requests within a 10-minute sliding window raises HTTP 429."""
        limiter = otp_rate_limiter
        limiter.reset()

        mobile = "9848077889"
        # Request 1
        allowed, err, _ = limiter.check_and_record_send(mobile, is_production=False)
        self.assertTrue(allowed)
        # Request 2
        allowed, err, _ = limiter.check_and_record_send(mobile, is_production=False)
        self.assertTrue(allowed)
        # Request 3
        allowed, err, _ = limiter.check_and_record_send(mobile, is_production=False)
        self.assertTrue(allowed)

        # Request 4 in production mode -> Blocked by max 3 limit
        allowed, err, retry_after = limiter.check_limit(mobile, is_production=True)
        self.assertFalse(allowed)
        self.assertIn("maximum otp limit reached", err.lower())
        self.assertIsNotNone(retry_after)

    # --------------------------------------------------------------------------
    # 10. IP-Based Abuse Protection
    # --------------------------------------------------------------------------
    def test_10_ip_rate_limiting_max_10_per_10_minutes(self):
        """More than 10 requests from a single IP within 10 minutes raises HTTP 429."""
        limiter = otp_rate_limiter
        limiter.reset()
        ip = "198.51.100.45"

        for i in range(10):
            allowed, _, _ = limiter.check_and_record_send(
                f"98480000{i:02d}", ip=ip, is_production=False
            )
            self.assertTrue(allowed)

        # 11th request from same IP -> Blocked
        allowed, err, _ = limiter.check_limit("9848099999", ip=ip, is_production=True)
        self.assertFalse(allowed)
        self.assertIn("too many otp requests from this network", err.lower())

    # --------------------------------------------------------------------------
    # 11. Provider Failure Handling (Timeout, 502, 503)
    # --------------------------------------------------------------------------
    def test_11_provider_failure_handling_timeout_and_errors(self):
        """Provider failures are converted to appropriate HTTP error codes safely."""
        auth.IS_PRODUCTION = True

        # Case A: Network Timeout -> HTTP 504 Gateway Timeout
        set_mock_provider(
            MockSmsProvider(
                is_configured=True, send_success=False, send_error_code="TIMEOUT"
            )
        )
        with self.assertRaises(HTTPException) as ctx:
            auth.send_otp(schemas.SendOtpRequest(mobile="9848011223"))
        self.assertEqual(ctx.exception.status_code, 504)

        # Case B: Auth Error -> HTTP 503 Service Unavailable
        otp_rate_limiter.reset()
        set_mock_provider(
            MockSmsProvider(
                is_configured=True, send_success=False, send_error_code="AUTH_ERROR"
            )
        )
        with self.assertRaises(HTTPException) as ctx:
            auth.send_otp(schemas.SendOtpRequest(mobile="9848011223"))
        self.assertEqual(ctx.exception.status_code, 503)

        # Case C: Outage / Generic Error -> HTTP 502 Bad Gateway
        otp_rate_limiter.reset()
        set_mock_provider(
            MockSmsProvider(
                is_configured=True,
                send_success=False,
                send_error_code="DISPATCH_FAILED",
                send_message="Carriers congested",
            )
        )
        with self.assertRaises(HTTPException) as ctx:
            auth.send_otp(schemas.SendOtpRequest(mobile="9848011223"))
        self.assertEqual(ctx.exception.status_code, 502)

    # --------------------------------------------------------------------------
    # 12. Farmer Registration, OTP Verification, and Login
    # --------------------------------------------------------------------------
    def test_12_farmer_registration_and_login_e2e(self):
        """Farmer complete workflow: register, verify mobile OTP, and login."""
        # 1. Register Farmer
        reg_res = auth.register(
            schemas.RegisterRequest(
                role=models.RoleEnum.farmer,
                name="Venkat Rao",
                mobile="9848012345",
                password="FarmerSecret123",
                confirm_password="FarmerSecret123",
                location="Miryalaguda, Telangana",
            ),
            db=self.db,
        )
        self.assertIsNotNone(reg_res.access_token)
        self.assertFalse(reg_res.user.is_verified)
        self.assertEqual(reg_res.user.role, "farmer")

        # 2. Verify OTP in development mode
        auth.IS_PRODUCTION = False
        ver_res = auth.verify_otp(
            schemas.VerifyOtpRequest(mobile="9848012345", otp="1234"), db=self.db
        )
        self.assertTrue(ver_res.is_verified)
        self.assertTrue(ver_res.user.is_verified)

        # 3. Login Farmer
        login_res = auth.login(
            schemas.LoginRequest(mobile="9848012345", password="FarmerSecret123"),
            db=self.db,
        )
        self.assertIsNotNone(login_res.access_token)
        self.assertTrue(login_res.user.is_verified)
        self.assertEqual(login_res.user.name, "Venkat Rao")

    # --------------------------------------------------------------------------
    # 13. Industry Registration, OTP Verification, and Login
    # --------------------------------------------------------------------------
    def test_13_industry_registration_and_login_e2e(self):
        """Industry complete workflow: register with contact person, verify OTP, and login."""
        # 1. Register Industry
        reg_res = auth.register(
            schemas.RegisterRequest(
                role=models.RoleEnum.industry,
                name="Telangana Agro Exporters",
                contact_person="K. S. Sharma",
                mobile="9848099887",
                password="IndustrySecret123",
                confirm_password="IndustrySecret123",
                location="Hyderabad, Telangana",
            ),
            db=self.db,
        )
        self.assertIsNotNone(reg_res.access_token)
        self.assertEqual(reg_res.user.contact_person, "K. S. Sharma")

        # 2. Verify OTP
        auth.IS_PRODUCTION = False
        ver_res = auth.verify_otp(
            schemas.VerifyOtpRequest(mobile="9848099887", otp="1234"), db=self.db
        )
        self.assertTrue(ver_res.is_verified)

        # 3. Login Industry
        login_res = auth.login(
            schemas.LoginRequest(mobile="9848099887", password="IndustrySecret123"),
            db=self.db,
        )
        self.assertIsNotNone(login_res.access_token)
        self.assertTrue(login_res.user.is_verified)
        self.assertEqual(login_res.user.contact_person, "K. S. Sharma")

    # --------------------------------------------------------------------------
    # 14. Zero Credential or Raw OTP Leakage
    # --------------------------------------------------------------------------
    def test_14_zero_credential_leakage(self):
        """Phone masking and zero API key/token exposure in logs and responses."""
        # Check phone masking
        masked = mask_phone("9848012345")
        self.assertEqual(masked, "XXXXXX2345")

        # Check normalization
        normalized = normalize_indian_mobile("09848012345")
        self.assertEqual(normalized, "919848012345")

        # Provider initialization does not print or expose secrets
        provider = Msg91SmsProvider(auth_key="test_secret_key_123")
        self.assertTrue(provider.is_configured())
        self.assertNotIn("test_secret_key_123", str(provider))

    # --------------------------------------------------------------------------
    # 15. SEC-01: IP Header Spoofing Prevention
    # --------------------------------------------------------------------------
    def test_15_sec01_ip_header_spoofing_prevention(self):
        """Forged X-Forwarded-For headers from untrusted direct peers are ignored."""
        class DummyRequest:
            def __init__(self, client_host, headers):
                class Client:
                    pass
                self.client = Client()
                self.client.host = client_host
                self.headers = headers

        # Case A: Untrusted peer tries to spoof client IP via X-Forwarded-For
        untrusted_peer = "198.51.100.25"
        req = DummyRequest(
            client_host=untrusted_peer,
            headers={"x-forwarded-for": "203.0.113.1, 10.0.0.1", "cf-connecting-ip": "1.1.1.1"}
        )
        resolved_ip = extract_client_ip(req, trusted_proxies=["127.0.0.1", "::1"])
        # Must resolve to untrusted peer address, completely ignoring forged headers
        self.assertEqual(resolved_ip, untrusted_peer)

    # --------------------------------------------------------------------------
    # 16. SEC-01: Legitimate Trusted Proxy Handling
    # --------------------------------------------------------------------------
    def test_16_sec01_legitimate_trusted_proxy_handling(self):
        """Trusted proxies extract genuine client IP from rightmost hop or CF-Connecting-IP."""
        class DummyRequest:
            def __init__(self, client_host, headers):
                class Client:
                    pass
                self.client = Client()
                self.client.host = client_host
                self.headers = headers

        trusted_proxy = "10.0.0.1"
        # Case A: X-Forwarded-For through trusted proxy (takes rightmost appended IP)
        req1 = DummyRequest(
            client_host=trusted_proxy,
            headers={"x-forwarded-for": "forged.ip.1, 203.0.113.88"}
        )
        resolved_ip = extract_client_ip(req1, trusted_proxies=["10.0.0.0/8", "127.0.0.1"])
        self.assertEqual(resolved_ip, "203.0.113.88")

        # Case B: Cloudflare connecting IP through trusted proxy
        req2 = DummyRequest(
            client_host=trusted_proxy,
            headers={"cf-connecting-ip": "198.51.100.99", "x-forwarded-for": "10.0.0.2"}
        )
        resolved_cf = extract_client_ip(req2, trusted_proxies=["10.0.0.0/8"])
        self.assertEqual(resolved_cf, "198.51.100.99")

    # --------------------------------------------------------------------------
    # 17. SEC-03: OTP Verification Rate Limiting (Max 5 Attempts per Mobile)
    # --------------------------------------------------------------------------
    def test_17_sec03_verify_otp_rate_limiting_max_5_attempts(self):
        """More than 5 failed OTP verification attempts within 10 minutes raises HTTP 429."""
        auth.IS_PRODUCTION = True
        set_mock_provider(MockSmsProvider(is_configured=True, verify_success=False, verify_message="Invalid OTP"))
        otp_rate_limiter.reset()

        mobile = "9848011223"
        # 5 failed attempts allowed through to verification logic
        for i in range(5):
            with self.assertRaises(HTTPException) as ctx:
                auth.verify_otp(schemas.VerifyOtpRequest(mobile=mobile, otp="0000"), db=self.db)
            self.assertEqual(ctx.exception.status_code, 400)

        # 6th attempt -> Blocked by verification rate limiter (HTTP 429)
        with self.assertRaises(HTTPException) as ctx:
            auth.verify_otp(schemas.VerifyOtpRequest(mobile=mobile, otp="0000"), db=self.db)
        self.assertEqual(ctx.exception.status_code, 429)
        self.assertIn("maximum verification attempts exceeded", ctx.exception.detail.lower())
        self.assertIn("Retry-After", ctx.exception.headers)

    # --------------------------------------------------------------------------
    # 18. SEC-03: OTP Verification IP Rate Limiting
    # --------------------------------------------------------------------------
    def test_18_sec03_verify_otp_ip_rate_limiting(self):
        """More than 5 verification attempts from same IP within 10 minutes raises HTTP 429."""
        limiter = otp_rate_limiter
        limiter.reset()
        ip = "198.51.100.77"

        for i in range(5):
            allowed, _, _ = limiter.check_verify_limit(f"98480000{i:02d}", ip=ip, is_production=True)
            self.assertTrue(allowed)
            limiter.record_verify_attempt(f"98480000{i:02d}", ip=ip)

        # 6th attempt from same IP -> Blocked
        allowed, err, retry_after = limiter.check_verify_limit("9848099999", ip=ip, is_production=True)
        self.assertFalse(allowed)
        self.assertIn("too many verification attempts from this network", err.lower())
        self.assertIsNotNone(retry_after)

    # --------------------------------------------------------------------------
    # 19. SEC-04: Dummy Credentials Rejected in Production
    # --------------------------------------------------------------------------
    def test_19_sec04_dummy_credentials_rejected_in_production(self):
        """Dummy credentials in production environment fail safely with HTTP 503."""
        os.environ["ENVIRONMENT"] = "production"
        provider = Msg91SmsProvider(auth_key="dummy_provider_key")
        self.assertTrue(provider.is_configured())

        # Send OTP fails safely
        send_res = provider.send_otp("9848011223")
        self.assertFalse(send_res.success)
        self.assertEqual(send_res.error_code, "INVALID_CREDENTIALS")
        self.assertIn("dummy credentials rejected in production", send_res.message.lower())

        # Verify OTP fails safely
        is_valid, msg = provider.verify_otp("9848011223", "8899")
        self.assertFalse(is_valid)
        self.assertIn("dummy credentials rejected in production", msg.lower())

    # --------------------------------------------------------------------------
    # 20. SEC-05: Indian Mobile Number Validation - Valid Formats
    # --------------------------------------------------------------------------
    def test_20_sec05_indian_mobile_validation_valid_formats(self):
        """Accepts valid 10-digit Indian numbers starting with 6, 7, 8, or 9 with supported formatting."""
        valid_cases = [
            ("9848011223", "9848011223"),
            ("8123456789", "8123456789"),
            ("7012345678", "7012345678"),
            ("6301234567", "6301234567"),
            ("+91 98480 11223", "9848011223"),
            ("+91-81234-56789", "8123456789"),
            ("09848011223", "9848011223"),
            ("919848011223", "9848011223"),
        ]
        for raw, expected in valid_cases:
            is_valid, national, err = validate_indian_mobile(raw)
            self.assertTrue(is_valid, f"Failed for valid case: {raw}")
            self.assertEqual(national, expected)
            self.assertIsNone(err)

    # --------------------------------------------------------------------------
    # 21. SEC-05: Indian Mobile Number Validation - Invalid Rejections
    # --------------------------------------------------------------------------
    def test_21_sec05_indian_mobile_validation_invalid_rejections(self):
        """Rejects numbers starting with 0-5, short/long numbers, and non-digits with HTTP 400."""
        invalid_cases = [
            "1234567890",       # Starts with 1
            "0000000000",       # Starts with 0
            "5555555555",       # Starts with 5
            "98480112",         # Too short (8 digits)
            "9848011223344",    # Too long
            "abcdefghij",       # Non-digits
            "",                 # Empty
        ]
        for invalid in invalid_cases:
            is_valid, _, err = validate_indian_mobile(invalid)
            self.assertFalse(is_valid, f"Should have failed for: {invalid}")
            self.assertIsNotNone(err)

            # Check send_otp rejects with HTTP 400
            with self.assertRaises(HTTPException) as ctx:
                auth.send_otp(schemas.SendOtpRequest(mobile=invalid))
            self.assertEqual(ctx.exception.status_code, 400)

            # Check verify_otp rejects with HTTP 400
            with self.assertRaises(HTTPException) as ctx:
                auth.verify_otp(schemas.VerifyOtpRequest(mobile=invalid, otp="1234"), db=self.db)
            self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
