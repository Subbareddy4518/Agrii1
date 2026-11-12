"""
Unit tests for Onboarding & OTP Mobile Verification in AgriConnect 2.0.
"""
import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

import models
import schemas
from database import Base
from auth import hash_password
from routers import auth


class TestOnboardingAndAuth(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        cls.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

    def setUp(self):
        self.db = self.TestingSessionLocal()
        # Seed an unverified user
        self.test_user = models.User(
            role=models.RoleEnum.farmer,
            name="Ramesh Test",
            mobile="9876543299",
            hashed_password=hash_password("pass123"),
            location="Guntur",
            is_verified=False,
            trust_score=100
        )
        self.db.add(self.test_user)
        self.db.commit()
        self.db.refresh(self.test_user)

    def tearDown(self):
        self.db.query(models.User).filter(models.User.mobile == "9876543299").delete()
        self.db.commit()
        self.db.close()

    def test_send_otp_success(self):
        req = schemas.SendOtpRequest(mobile="9876543299")
        res = auth.send_otp(req)
        self.assertIn("9876543299", res.message)
        self.assertEqual(res.otp, "1234")
        self.assertFalse(res.is_verified)

    def test_send_otp_invalid_mobile(self):
        req = schemas.SendOtpRequest(mobile="123")
        with self.assertRaises(HTTPException) as ctx:
            auth.send_otp(req)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_verify_otp_invalid_code(self):
        req = schemas.VerifyOtpRequest(mobile="9876543299", otp="9999")
        with self.assertRaises(HTTPException) as ctx:
            auth.verify_otp(req, self.db)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Invalid OTP", ctx.exception.detail)

    def test_verify_otp_success_updates_user(self):
        req = schemas.VerifyOtpRequest(mobile="9876543299", otp="1234")
        res = auth.verify_otp(req, self.db)
        self.assertTrue(res.is_verified)
        self.assertIsNotNone(res.user)
        self.assertTrue(res.user.is_verified)

        # Check DB state persisted
        db_user = self.db.query(models.User).filter(models.User.mobile == "9876543299").first()
        self.assertTrue(db_user.is_verified)

    def test_verify_otp_for_unregistered_mobile(self):
        # When user verifies before completing registration
        req = schemas.VerifyOtpRequest(mobile="9111222333", otp="1234")
        res = auth.verify_otp(req, self.db)
        self.assertTrue(res.is_verified)
        self.assertIsNone(res.user)


if __name__ == "__main__":
    unittest.main()
