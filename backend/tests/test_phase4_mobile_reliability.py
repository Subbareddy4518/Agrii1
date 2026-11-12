"""
Unit & Integration Tests for AgriConnect 2.0 Phase 4: Mobile Accessibility & Reliability
1. Image Upload Security & Validation:
   - Allowed formats (JPG, PNG, WEBP, BMP, GIF) succeed.
   - Disallowed formats (.pdf, .exe, .sh, .py, etc.) rejected with HTTP 400.
2. Post Creation & Integrity:
   - Initial status set to 'active', negotiation_status to 'none'.
   - Initial status history record created.
   - Negative price rejected with HTTP 422.
3. Trust Verification Integrity:
   - Verification badges and trust scores strictly match database state.
4. Translation Parity Audit:
   - 100% key parity across English, Telugu, and Hindi common.json.
   - Phase 4 mobile reliability keys verified across all 3 languages.
"""

import unittest
import sys
import os
import json
import io
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException, UploadFile

import models
import schemas
from database import Base
from routers import posts


class TestPhase4MobileReliability(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        cls.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

        db = cls.TestingSessionLocal()

        # Create Farmer
        cls.farmer = models.User(
            name="Suresh Kumar",
            mobile="9876543211",
            hashed_password="hash",
            role=models.RoleEnum.farmer,
            location="Warangal, Telangana",
            is_verified=True,
            trust_score=94,
        )
        # Create Buyer
        cls.buyer = models.User(
            name="Telangana Mills",
            mobile="9123456789",
            hashed_password="hash",
            role=models.RoleEnum.industry,
            location="Warangal, Telangana",
            is_verified=False,
            trust_score=75,
        )
        db.add_all([cls.farmer, cls.buyer])
        db.commit()
        db.refresh(cls.farmer)
        db.refresh(cls.buyer)
        cls.farmer_id = cls.farmer.id
        cls.buyer_id = cls.buyer.id
        db.close()

    def setUp(self):
        self.db = self.TestingSessionLocal()
        self.farmer = self.db.query(models.User).filter_by(id=self.farmer_id).first()
        self.buyer = self.db.query(models.User).filter_by(id=self.buyer_id).first()

    def tearDown(self):
        self.db.close()

    # --------------------------------------------------------------------------
    # 1. Image Upload Security & Validation Tests
    # --------------------------------------------------------------------------
    def test_upload_image_allowed_extensions(self):
        """Allowed image formats (.jpg, .jpeg, .png, .webp, .bmp, .gif) should succeed."""
        allowed_files = [
            ("photo.jpg", b"\xff\xd8\xff\xe0...fake_jpeg_bytes"),
            ("harvest.png", b"\x89PNG\r\n\x1a\n...fake_png_bytes"),
            ("sample.webp", b"RIFF....WEBP..."),
            ("crop.bmp", b"BM...fake_bmp"),
            ("icon.gif", b"GIF89a..."),
        ]

        for filename, data in allowed_files:
            file_obj = io.BytesIO(data)
            upload_file = UploadFile(filename=filename, file=file_obj)
            res = posts.upload_image(file=upload_file, user=self.farmer)
            self.assertIn("url", res)
            self.assertTrue(res["url"].startswith("/uploads/"))

    def test_upload_image_disallowed_extensions_rejected(self):
        """Disallowed formats (.pdf, .exe, .sh, .py, etc.) must raise HTTP 400."""
        invalid_files = [
            ("document.pdf", b"%PDF-1.5"),
            ("malware.exe", b"MZ..."),
            ("script.sh", b"#!/bin/bash"),
            ("exploit.py", b"import os"),
            ("notes.txt", b"plain text"),
            ("archive.zip", b"PK\x03\x04"),
        ]

        for filename, data in invalid_files:
            file_obj = io.BytesIO(data)
            upload_file = UploadFile(filename=filename, file=file_obj)
            with self.assertRaises(HTTPException) as ctx:
                posts.upload_image(file=upload_file, user=self.farmer)
            self.assertEqual(ctx.exception.status_code, 400)
            self.assertIn("Invalid image format", ctx.exception.detail)

    # --------------------------------------------------------------------------
    # 2. Post Creation & Data Integrity Tests
    # --------------------------------------------------------------------------
    def test_create_post_initializes_lifecycle_and_history(self):
        """Creating a post must set status=active, negotiation_status=none, and log history."""
        payload = schemas.PostCreate(
            title="Fresh Cotton Harvest",
            crop_name="Cotton",
            category="Cash Crops",
            variety="Bt Cotton",
            quality_grade="Grade A / Premium",
            quantity="50 Quintal",
            price=7200.0,
            is_negotiable=True,
            location="Warangal, Telangana",
        )

        created = posts.create_post(
            payload=payload,
            background_tasks=None,
            db=self.db,
            user=self.farmer,
        )

        self.assertEqual(created.status, "active")
        self.assertEqual(created.negotiation_status, "none")
        self.assertEqual(created.crop_name, "Cotton")
        self.assertEqual(created.price, 7200.0)

        # Verify history entry
        history = self.db.query(models.PostStatusHistory).filter_by(post_id=created.id).first()
        self.assertIsNotNone(history)
        self.assertEqual(history.to_status, "active")
        self.assertEqual(history.changed_by_user_id, self.farmer.id)

    def test_create_post_negative_price_rejected(self):
        """Negative price must raise HTTP 422."""
        payload = schemas.PostCreate(
            title="Invalid Price Cotton",
            crop_name="Cotton",
            price=-500.0,
        )

        with self.assertRaises(HTTPException) as ctx:
            posts.create_post(
                payload=payload,
                background_tasks=None,
                db=self.db,
                user=self.farmer,
            )
        self.assertEqual(ctx.exception.status_code, 422)

    # --------------------------------------------------------------------------
    # 3. Trust & Verification Badge Accuracy
    # --------------------------------------------------------------------------
    def test_serialization_preserves_genuine_verification_state(self):
        """Verified user shows is_verified=True; unverified shows is_verified=False."""
        farmer_post = models.Post(
            user_id=self.farmer.id,
            role=self.farmer.role,
            title="Paddy Post",
            crop_name="Paddy",
            status="active",
        )
        self.db.add(farmer_post)
        self.db.commit()
        self.db.refresh(farmer_post)

        serialized_farmer = posts.serialize_post(farmer_post, self.farmer.id, set())
        self.assertTrue(serialized_farmer.owner.is_verified)
        self.assertEqual(serialized_farmer.owner.trust_score, self.farmer.trust_score)

        buyer_post = models.Post(
            user_id=self.buyer.id,
            role=self.buyer.role,
            title="Rice Requirement",
            crop_name="Paddy",
            status="active",
        )
        self.db.add(buyer_post)
        self.db.commit()
        self.db.refresh(buyer_post)

        serialized_buyer = posts.serialize_post(buyer_post, self.buyer.id, set())
        self.assertFalse(serialized_buyer.owner.is_verified)
        self.assertEqual(serialized_buyer.owner.trust_score, self.buyer.trust_score)

    # --------------------------------------------------------------------------
    # 4. Trilingual Translation Parity & Phase 4 Key Completeness
    # --------------------------------------------------------------------------
    def test_trilingual_parity_and_phase4_keys(self):
        """All keys in en/common.json must exist in te/common.json and hi/common.json with no missing translations."""
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        en_path = os.path.join(base_dir, "frontend", "src", "locales", "en", "common.json")
        te_path = os.path.join(base_dir, "frontend", "src", "locales", "te", "common.json")
        hi_path = os.path.join(base_dir, "frontend", "src", "locales", "hi", "common.json")

        self.assertTrue(os.path.exists(en_path), f"EN common.json missing at {en_path}")
        self.assertTrue(os.path.exists(te_path), f"TE common.json missing at {te_path}")
        self.assertTrue(os.path.exists(hi_path), f"HI common.json missing at {hi_path}")

        with open(en_path, "r", encoding="utf-8") as f:
            en_dict = json.load(f)
        with open(te_path, "r", encoding="utf-8") as f:
            te_dict = json.load(f)
        with open(hi_path, "r", encoding="utf-8") as f:
            hi_dict = json.load(f)

        def extract_leaf_keys(d, prefix=""):
            keys = set()
            for k, v in d.items():
                full_key = f"{prefix}.{k}" if prefix else k
                if isinstance(v, dict):
                    keys.update(extract_leaf_keys(v, full_key))
                else:
                    keys.add(full_key)
            return keys

        en_keys = extract_leaf_keys(en_dict)
        te_keys = extract_leaf_keys(te_dict)
        hi_keys = extract_leaf_keys(hi_dict)

        missing_in_te = en_keys - te_keys
        missing_in_hi = en_keys - hi_keys

        self.assertEqual(missing_in_te, set(), f"Keys in EN missing in TE: {missing_in_te}")
        self.assertEqual(missing_in_hi, set(), f"Keys in EN missing in HI: {missing_in_hi}")

        # Check required Phase 4 keys specifically
        required_phase4_keys = [
            "common.optimizingImage",
            "common.invalidImageFormat",
            "common.offlineNotice",
            "common.reconnectedNotice",
            "common.offlineError",
            "common.networkTimeout",
            "auth.register.showPassword",
            "auth.register.hidePassword",
        ]

        for key in required_phase4_keys:
            self.assertIn(key, en_keys, f"Phase 4 key {key} missing in EN")
            self.assertIn(key, te_keys, f"Phase 4 key {key} missing in TE")
            self.assertIn(key, hi_keys, f"Phase 4 key {key} missing in HI")


if __name__ == "__main__":
    unittest.main()
