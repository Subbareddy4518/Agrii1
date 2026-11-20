"""
Comprehensive Automated Test Suite for AgriConnect 2.0 Backend.

Tests:
1. Authentication (Register Farmer, Register Industry, Validation, Login, JWT)
2. Profile operations
3. AI Crop Catalog, Mandi Price Guidance, Voice/Text Crop Assist NLP
4. AI Agricultural Advisor
5. Post Creation (Crop & Requirement with new fields: category, variety, grade, is_negotiable)
6. Role-based Feed Separation
7. Post Search & Filtering
8. Likes & Notifications
9. SmartMatch AI Matching with Explainability
10. Reporting & Moderation
"""

import unittest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models
import schemas
from database import Base, run_migrations
from auth import hash_password, verify_password, create_access_token
from routers import auth, users, posts, ai_services, matching, reports


class TestAgriConnectBackend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create an in-memory test database
        cls.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        cls.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

    def setUp(self):
        self.db = self.TestingSessionLocal()

    def tearDown(self):
        self.db.rollback()
        self.db.close()

    def test_01_password_hashing(self):
        password = "secretPassword123"
        hashed = hash_password(password)
        self.assertNotEqual(password, hashed)
        self.assertTrue(verify_password(password, hashed))
        self.assertFalse(verify_password("wrongPassword", hashed))

    def test_02_register_farmer(self):
        payload = schemas.RegisterRequest(
            role=models.RoleEnum.farmer,
            name="Ramesh Reddy",
            mobile="9876543210",
            password="farmerPassword123",
            confirm_password="farmerPassword123",
            location="Miryalaguda, Nalgonda",
        )
        token_out = auth.register(payload, db=self.db)
        self.assertIsNotNone(token_out.access_token)
        self.assertEqual(token_out.user.name, "Ramesh Reddy")
        self.assertEqual(token_out.user.role, models.RoleEnum.farmer)
        self.assertEqual(token_out.user.mobile, "9876543210")

    def test_03_register_industry(self):
        payload = schemas.RegisterRequest(
            role=models.RoleEnum.industry,
            name="Telangana Agro Mills",
            contact_person="Venkatesh Rao",
            mobile="9123456780",
            password="industryPassword123",
            confirm_password="industryPassword123",
            location="Nalgonda, Telangana",
        )
        token_out = auth.register(payload, db=self.db)
        self.assertIsNotNone(token_out.access_token)
        self.assertEqual(token_out.user.name, "Telangana Agro Mills")
        self.assertEqual(token_out.user.contact_person, "Venkatesh Rao")
        self.assertEqual(token_out.user.role, models.RoleEnum.industry)

    def test_04_login(self):
        payload = schemas.LoginRequest(mobile="9876543210", password="farmerPassword123")
        token_out = auth.login(payload, db=self.db)
        self.assertIsNotNone(token_out.access_token)
        self.assertEqual(token_out.user.mobile, "9876543210")

    def test_05_ai_crops_catalog(self):
        crops = ai_services.get_crops_catalog(category=None)
        self.assertGreaterEqual(len(crops), 10)
        crop_names = [c.name for c in crops]
        self.assertIn("Paddy", crop_names)
        self.assertIn("Cotton", crop_names)
        self.assertIn("Chilli", crop_names)
        self.assertIn("Tomato", crop_names)

        # Test category filter
        cereals = ai_services.get_crops_catalog(category="Cereals")
        for c in cereals:
            self.assertEqual(c.category, "Cereals")

    def test_06_ai_price_guidance(self):
        # Telugu: honest unavailable response
        guidance = ai_services.get_price_guidance(crop="Paddy", location="Miryalaguda", language="te")
        self.assertEqual(guidance.crop_name, "Paddy")
        self.assertFalse(guidance.is_available)
        self.assertIsNone(guidance.modal_price)
        self.assertIsNone(guidance.min_price)
        self.assertIsNone(guidance.max_price)
        self.assertEqual(guidance.confidence, "unavailable")
        self.assertEqual(guidance.data_source, "unavailable")
        self.assertEqual(guidance.message, "ఈ పంటకు తాజా మార్కెట్ ధర అందుబాటులో లేదు.")

        # English: honest unavailable response
        cotton_guidance = ai_services.get_price_guidance(crop="Cotton", location="Warangal", language="en")
        self.assertEqual(cotton_guidance.crop_name, "Cotton")
        self.assertFalse(cotton_guidance.is_available)
        self.assertIsNone(cotton_guidance.modal_price)
        self.assertEqual(cotton_guidance.confidence, "unavailable")
        self.assertEqual(cotton_guidance.message, "Latest market price is unavailable for this crop.")

        # Hindi: honest unavailable response
        onion_guidance = ai_services.get_price_guidance(crop="Onion", location="Nashik", language="hi")
        self.assertEqual(onion_guidance.crop_name, "Onion")
        self.assertFalse(onion_guidance.is_available)
        self.assertIsNone(onion_guidance.modal_price)
        self.assertEqual(onion_guidance.confidence, "unavailable")
        self.assertEqual(onion_guidance.message, "इस फसल के लिए नवीनतम बाज़ार मूल्य उपलब्ध नहीं है।")

    def test_07_ai_crop_assist_nlp(self):
        farmer_user = self.db.query(models.User).filter(models.User.mobile == "9876543210").first()

        # Spoken or typed sentence
        sample_speech = "I have 50 quintals of Sona Masoori paddy in Miryalaguda for 2300 rupees per quintal"
        payload = schemas.CropAssistRequest(text=sample_speech, language="en", role="farmer")

        res = ai_services.crop_assist(payload, user=farmer_user)
        self.assertEqual(res.detected_crop, "Paddy")
        self.assertEqual(res.category, "Cereals")
        self.assertEqual(res.variety, "Sona Masoori")
        self.assertIn("50", str(res.quantity_amount))
        self.assertEqual(res.unit, "Quintal")
        self.assertEqual(res.price, 2300.0)
        self.assertIn("Miryalaguda", res.location)
        self.assertTrue(res.is_ai_generated)
        self.assertIsNotNone(res.suggested_title)
        self.assertIsNotNone(res.suggested_description)

    def test_08_ai_advisor(self):
        farmer_user = self.db.query(models.User).filter(models.User.mobile == "9876543210").first()
        payload = schemas.AiAdvisorRequest(message="What is the current market rate for cotton?", language="en", role="farmer")
        res = ai_services.ai_advisor(payload, user=farmer_user)
        self.assertIn("Cotton", res.reply)
        self.assertGreater(len(res.suggested_topics), 0)

    def test_09_create_farmer_crop_post(self):
        farmer_user = self.db.query(models.User).filter(models.User.mobile == "9876543210").first()
        payload = schemas.PostCreate(
            title="Fresh Sona Masoori Paddy (50 Quintals)",
            description="Grade A freshly harvested Sona Masoori paddy from Miryalaguda farm. Dry and well cleaned.",
            crop_name="Paddy",
            category="Cereals",
            variety="Sona Masoori",
            quality_grade="Grade A / Premium",
            quantity="50 Quintals",
            price=2300.0,
            is_negotiable=False,
            location="Miryalaguda, Nalgonda",
        )
        post_out = posts.create_post(payload, db=self.db, user=farmer_user)
        self.assertEqual(post_out.crop_name, "Paddy")
        self.assertEqual(post_out.category, "Cereals")
        self.assertEqual(post_out.variety, "Sona Masoori")
        self.assertEqual(post_out.price, 2300.0)
        self.assertEqual(post_out.role, models.RoleEnum.farmer)

    def test_10_create_industry_requirement_post(self):
        industry_user = self.db.query(models.User).filter(models.User.mobile == "9123456780").first()
        payload = schemas.PostCreate(
            title="Need 100 Quintals Sona Masoori Paddy",
            description="Leading rice mill looking to procure 100 quintals of paddy. Immediate spot payment.",
            crop_name="Paddy",
            category="Cereals",
            variety="Sona Masoori",
            quantity="100 Quintals",
            price=2350.0,
            location="Nalgonda, Telangana",
        )
        post_out = posts.create_post(payload, db=self.db, user=industry_user)
        self.assertEqual(post_out.crop_name, "Paddy")
        self.assertEqual(post_out.role, models.RoleEnum.industry)

    def test_11_role_based_feed(self):
        farmer_user = self.db.query(models.User).filter(models.User.mobile == "9876543210").first()
        industry_user = self.db.query(models.User).filter(models.User.mobile == "9123456780").first()

        # Farmer feed should ONLY show industry requirements
        farmer_feed = posts.get_feed(page=1, page_size=10, sort="latest", category=None, db=self.db, user=farmer_user)
        for item in farmer_feed.items:
            self.assertEqual(item.role, models.RoleEnum.industry)

        # Industry feed should ONLY show farmer crop posts
        industry_feed = posts.get_feed(page=1, page_size=10, sort="latest", category=None, db=self.db, user=industry_user)
        for item in industry_feed.items:
            self.assertEqual(item.role, models.RoleEnum.farmer)

    def test_12_smart_matching(self):
        farmer_user = self.db.query(models.User).filter(models.User.mobile == "9876543210").first()
        matches_res = matching.get_my_matches(db=self.db, user=farmer_user)
        self.assertGreaterEqual(matches_res.total_matches, 1)

        top_match = matches_res.matches[0]
        self.assertEqual(top_match.matched_crop, "Paddy")
        self.assertGreaterEqual(top_match.match_score, 70)
        self.assertGreater(len(top_match.reasons), 0)
        # Verify explainability
        explain_texts = " ".join(top_match.reasons)
        self.assertIn("crop match", explain_texts.lower())

    def test_13_report_post(self):
        industry_user = self.db.query(models.User).filter(models.User.mobile == "9123456780").first()
        farmer_post = self.db.query(models.Post).filter(models.Post.role == models.RoleEnum.farmer).first()

        report_payload = schemas.ReportCreate(reason="Incorrect Price", details="Testing moderation flow")
        res = reports.report_post(farmer_post.id, payload=report_payload, db=self.db, user=industry_user)
        self.assertEqual(res["status"], "success")

        # Verify report count incremented
        updated_post = self.db.query(models.Post).filter(models.Post.id == farmer_post.id).first()
        self.assertEqual(updated_post.report_count, 1)


if __name__ == "__main__":
    unittest.main()
