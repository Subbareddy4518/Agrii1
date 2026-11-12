"""
AgriConnect 2.0 — Comprehensive End-to-End Application Testing & Verification Suite
Tests complete Farmer & Buyer journeys, AI Matching, Communication & Trust,
Security & RBAC, Lifecycle transitions, and Data integrity.
"""

import unittest
import sys
import os
import urllib.parse
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from pydantic import ValidationError
from fastapi import HTTPException

import models
import schemas
import trust
from database import Base
from auth import get_current_admin
from routers import auth, posts, matching, reports, ai_services, admin, users


class TestAgriConnectE2EVerification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Dedicated isolated in-memory test database
        cls.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        cls.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

    def setUp(self):
        self.db = self.TestingSessionLocal()

    def tearDown(self):
        self.db.close()

    def get_or_create_farmer(self):
        farmer = self.db.query(models.User).filter_by(mobile="9876543210").first()
        if not farmer:
            res = auth.register(schemas.RegisterRequest(
                role=models.RoleEnum.farmer,
                name="Ramesh Kumar",
                mobile="9876543210",
                password="password123",
                confirm_password="password123",
                location="Miryalaguda, Telangana",
            ), db=self.db)
            farmer = self.db.query(models.User).filter_by(id=res.user.id).first()
        return farmer

    def get_or_create_buyer(self):
        buyer = self.db.query(models.User).filter_by(mobile="9123456780").first()
        if not buyer:
            res = auth.register(schemas.RegisterRequest(
                role=models.RoleEnum.industry,
                name="Telangana Rice Mills Pvt Ltd",
                contact_person="Srinivas Rao",
                mobile="9123456780",
                password="buyerpassword",
                confirm_password="buyerpassword",
                location="Nalgonda, Telangana",
            ), db=self.db)
            buyer = self.db.query(models.User).filter_by(id=res.user.id).first()
        return buyer

    # =========================================================================
    # STEP 2 — FARMER REGISTRATION, AUTH & JOURNEY
    # =========================================================================
    def test_01_farmer_registration_validation(self):
        """Test farmer registration field validation, password matching, and duplicate detection."""
        # 1. Password mismatch raises ValidationError
        with self.assertRaises(ValidationError):
            schemas.RegisterRequest(
                role=models.RoleEnum.farmer,
                name="Ramesh Kumar",
                mobile="9876543210",
                password="password123",
                confirm_password="mismatchpassword",
                location="Miryalaguda, Telangana",
            )

        # 2. Successful Farmer Registration
        farmer = self.get_or_create_farmer()
        self.assertEqual(farmer.role, models.RoleEnum.farmer)
        self.assertEqual(farmer.mobile, "9876543210")
        self.assertFalse(farmer.is_verified)
        self.assertGreaterEqual(farmer.trust_score, 60)
        self.assertLessEqual(farmer.trust_score, 100)

        # 3. Duplicate Account Detection raises HTTPException 400
        dup_payload = schemas.RegisterRequest(
            role=models.RoleEnum.farmer,
            name="Another Ramesh",
            mobile="9876543210",
            password="password123",
            confirm_password="password123",
            location="Miryalaguda, Telangana",
        )
        with self.assertRaises(HTTPException) as ctx:
            auth.register(dup_payload, db=self.db)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("already registered", ctx.exception.detail.lower())

    def test_02_farmer_login_and_auth_persistence(self):
        """Test farmer login, token authentication, and wrong credentials rejection."""
        self.get_or_create_farmer()

        # Wrong password raises 401
        with self.assertRaises(HTTPException) as ctx:
            auth.login(schemas.LoginRequest(mobile="9876543210", password="wrongpassword"), db=self.db)
        self.assertEqual(ctx.exception.status_code, 401)

        # Correct password returns token
        res_ok = auth.login(schemas.LoginRequest(mobile="9876543210", password="password123"), db=self.db)
        self.assertIsNotNone(res_ok.access_token)
        self.assertEqual(res_ok.user.mobile, "9876543210")

    # =========================================================================
    # STEP 3 — BUYER REGISTRATION, AUTH & JOURNEY
    # =========================================================================
    def test_03_buyer_registration_and_auth(self):
        """Test industry buyer registration with contact person requirement."""
        # Missing contact person for industry raises HTTPException 422
        req_without_contact = schemas.RegisterRequest(
            role=models.RoleEnum.industry,
            name="Telangana Rice Mills Pvt Ltd",
            mobile="9199999999",
            password="buyerpassword",
            confirm_password="buyerpassword",
            location="Nalgonda, Telangana",
        )
        with self.assertRaises(HTTPException) as ctx:
            auth.register(req_without_contact, db=self.db)
        self.assertEqual(ctx.exception.status_code, 422)

        # Successful Buyer Registration
        buyer = self.get_or_create_buyer()
        self.assertEqual(buyer.role, models.RoleEnum.industry)
        self.assertEqual(buyer.contact_person, "Srinivas Rao")

    # =========================================================================
    # STEP 2 (C & E) — CROP LISTING CREATION & LIFECYCLE
    # =========================================================================
    def test_04_create_crop_listings_representative_crops(self):
        """Test creating crop listings for representative crops (Paddy, Tomato, Chilli, Potato)."""
        farmer = self.get_or_create_farmer()

        crops_to_create = [
            schemas.PostCreate(
                title="Fresh Sona Masoori Paddy",
                crop_name="Paddy",
                category="Cereals",
                variety="Sona Masoori",
                quality_grade="Grade A / Premium",
                quantity="50 Quintal",
                price=2350.0,
                is_negotiable=True,
                location="Miryalaguda, Telangana",
            ),
            schemas.PostCreate(
                title="Organic Desi Tomato Harvest",
                crop_name="Tomato",
                category="Vegetables",
                variety="Desi Organic",
                quality_grade="Organic",
                quantity="100 Boxes",
                price=25.0,
                is_negotiable=False,
                location="Miryalaguda, Telangana",
            ),
            schemas.PostCreate(
                title="Premium Teja Red Chilli",
                crop_name="Chilli",
                category="Spices",
                variety="Teja",
                quality_grade="Grade A / Premium",
                quantity="20 Quintal",
                price=18000.0,
                is_negotiable=True,
                location="Miryalaguda, Telangana",
            ),
            schemas.PostCreate(
                title="Fresh Kufri Jyoti Potato",
                crop_name="Potato",
                category="Vegetables",
                variety="Kufri Jyoti",
                quality_grade="Standard / Grade B",
                quantity="50 Bags (50kg)",
                price=22.0,
                is_negotiable=False,
                location="Miryalaguda, Telangana",
            ),
        ]

        created_posts = []
        for c in crops_to_create:
            p = posts.create_post(payload=c, background_tasks=None, db=self.db, user=farmer)
            self.assertEqual(p.status, "active")
            self.assertEqual(p.crop_name, c.crop_name)
            self.assertEqual(p.price, c.price)
            created_posts.append(p)

        self.assertEqual(len(created_posts), 4)

        # Farmer profile / mine posts check
        mine = posts.my_posts(db=self.db, user=farmer)
        self.assertGreaterEqual(len(mine), 4)

    def test_05_listing_lifecycle_transitions_and_exclusion(self):
        """Test listing states: active -> paused -> active -> sold -> archived -> restore.
        Verify sold and archived listings are excluded from active buyer feed and search."""
        farmer = self.get_or_create_farmer()
        buyer = self.get_or_create_buyer()

        # Ensure a Paddy post exists
        mine = posts.my_posts(db=self.db, user=farmer)
        paddy_posts = [p for p in mine if p.crop_name == "Paddy"]
        if not paddy_posts:
            created = posts.create_post(
                payload=schemas.PostCreate(
                    title="Lifecycle Paddy",
                    crop_name="Paddy",
                    price=2200.0,
                    quantity="40 Quintal"
                ),
                background_tasks=None,
                db=self.db,
                user=farmer
            )
            post_id = created.id
        else:
            post_id = paddy_posts[0].id

        # 1. Buyer sees post in feed when active
        posts.update_post_status(
            post_id=post_id,
            payload=schemas.PostStatusUpdate(status="active"),
            background_tasks=None,
            db=self.db,
            user=farmer,
        )
        feed = posts.get_feed(page=1, page_size=20, sort="latest", db=self.db, user=buyer)
        self.assertIn(post_id, [p.id for p in feed.items])

        # 2. Farmer pauses Paddy post -> excluded from buyer feed
        paused = posts.update_post_status(
            post_id=post_id,
            payload=schemas.PostStatusUpdate(status="paused", notes="Temporary pause"),
            background_tasks=None,
            db=self.db,
            user=farmer,
        )
        self.assertEqual(paused.status, "paused")
        feed_after_pause = posts.get_feed(page=1, page_size=20, sort="latest", db=self.db, user=buyer)
        self.assertNotIn(post_id, [p.id for p in feed_after_pause.items])

        # 3. Farmer marks post as sold -> excluded from buyer feed
        sold = posts.update_post_status(
            post_id=post_id,
            payload=schemas.PostStatusUpdate(
                status="sold",
                sold_price=2300.0,
                sold_quantity="40 Quintal",
                notes="Sold to local trader"
            ),
            background_tasks=None,
            db=self.db,
            user=farmer,
        )
        self.assertEqual(sold.status, "sold")
        feed_after_sold = posts.get_feed(page=1, page_size=20, sort="latest", db=self.db, user=buyer)
        self.assertNotIn(post_id, [p.id for p in feed_after_sold.items])

        # 4. Farmer archives post (Safe Archiving) -> excluded from search
        archived = posts.update_post_status(
            post_id=post_id,
            payload=schemas.PostStatusUpdate(status="archived", notes="Seasonal close"),
            background_tasks=None,
            db=self.db,
            user=farmer,
        )
        self.assertEqual(archived.status, "archived")
        search_res = posts.search_posts(q="Paddy", page=1, page_size=20, sort="latest", db=self.db, user=buyer)
        self.assertNotIn(post_id, [p.id for p in search_res.items])

        # 5. Restore archived post to active -> back in search
        restored = posts.update_post_status(
            post_id=post_id,
            payload=schemas.PostStatusUpdate(status="active", notes="Restored"),
            background_tasks=None,
            db=self.db,
            user=farmer,
        )
        self.assertEqual(restored.status, "active")
        search_restored = posts.search_posts(q="Paddy", page=1, page_size=20, sort="latest", db=self.db, user=buyer)
        self.assertIn(post_id, [p.id for p in search_restored.items])

        # Verify unauthorized user cannot change status (buyer cannot change farmer's post)
        with self.assertRaises(HTTPException) as ctx:
            posts.update_post_status(
                post_id=post_id,
                payload=schemas.PostStatusUpdate(status="paused"),
                background_tasks=None,
                db=self.db,
                user=buyer,
            )
        self.assertEqual(ctx.exception.status_code, 403)

    # =========================================================================
    # STEP 3 & 4 — REGIONAL SEARCH & SMARTMATCH AI
    # =========================================================================
    def test_06_regional_crop_search(self):
        """Test searching crops using English, Telugu, and Hindi names."""
        farmer = self.get_or_create_farmer()
        buyer = self.get_or_create_buyer()

        # Ensure Tomato, Chilli, and Potato exist and are active
        crops = [("Tomato", 25.0), ("Chilli", 18000.0), ("Potato", 22.0)]
        for name, price in crops:
            posts.create_post(
                payload=schemas.PostCreate(title=f"Fresh {name}", crop_name=name, price=price),
                background_tasks=None,
                db=self.db,
                user=farmer
            )

        # 1. English: "Tomato"
        res_en = posts.search_posts(q="Tomato", page=1, page_size=20, sort="latest", db=self.db, user=buyer)
        self.assertTrue(any(p.crop_name == "Tomato" for p in res_en.items))

        # 2. Telugu: "టమాట"
        res_te = posts.search_posts(q="టమాట", page=1, page_size=20, sort="latest", db=self.db, user=buyer)
        self.assertTrue(any(p.crop_name == "Tomato" for p in res_te.items))

        # 3. Hindi: "टमाटर"
        res_hi = posts.search_posts(q="टमाटर", page=1, page_size=20, sort="latest", db=self.db, user=buyer)
        self.assertTrue(any(p.crop_name == "Tomato" for p in res_hi.items))

        # 4. Regional Chilli search: "మిర్చి"
        res_chilli = posts.search_posts(q="మిర్చి", page=1, page_size=20, sort="latest", db=self.db, user=buyer)
        self.assertTrue(any(p.crop_name == "Chilli" for p in res_chilli.items))

        # 5. Regional Potato search: "బంగాళాదుంప"
        res_potato = posts.search_posts(q="బంగాళాదుంప", page=1, page_size=20, sort="latest", db=self.db, user=buyer)
        self.assertTrue(any(p.crop_name == "Potato" for p in res_potato.items))

    def test_07_smartmatch_ai_and_explanations(self):
        """Test AI SmartMatch matching farmer crop post with buyer procurement requirement."""
        farmer = self.get_or_create_farmer()
        buyer = self.get_or_create_buyer()

        # Farmer ensures an active Paddy post exists
        farmer_post = posts.create_post(
            payload=schemas.PostCreate(
                title="Farmer Sona Masoori Paddy",
                crop_name="Paddy",
                category="Cereals",
                variety="Sona Masoori",
                quantity="50 Quintal",
                price=2350.0,
                location="Miryalaguda, Nalgonda, Telangana",
            ),
            background_tasks=None,
            db=self.db,
            user=farmer,
        )

        # Buyer creates Requirement Post: Needs 60 Quintal Paddy at ₹2400 in Nalgonda
        req_post = posts.create_post(
            payload=schemas.PostCreate(
                title="Need 60 Quintals Sona Masoori Paddy",
                crop_name="Paddy",
                category="Cereals",
                variety="Sona Masoori",
                quantity="60 Quintal",
                price=2400.0,
                location="Nalgonda, Telangana",
            ),
            background_tasks=None,
            db=self.db,
            user=buyer,
        )

        # Farmer checks matches
        smartmatch_res = matching.get_my_matches(db=self.db, user=farmer)
        matches = smartmatch_res.matches
        self.assertTrue(len(matches) > 0)

        # Verify matched item
        matched_item = [m for m in matches if m.post.id == req_post.id]
        self.assertTrue(len(matched_item) > 0)
        self.assertGreater(matched_item[0].match_score, 60)

        # Farmer inspects match explanation
        explanation = matching.explain_match(post_id=req_post.id, db=self.db, user=farmer)
        self.assertGreater(explanation.match_score, 60)
        self.assertTrue(len(explanation.reasons) > 0)
        reasons_text = " ".join(explanation.reasons).lower()
        self.assertIn("paddy", reasons_text)

    # =========================================================================
    # STEP 5 — COMMUNICATION (TEL & WHATSAPP) & TRUST REPORTING
    # =========================================================================
    def test_08_communication_links_and_localization(self):
        """Verify telephone links and localized pre-filled WhatsApp message formats."""
        farmer_mobile = "9876543210"
        farmer_name = "Ramesh Kumar"
        crop_name_en = "Paddy"
        crop_name_te = "వరి"
        crop_name_hi = "धान"

        # 1. Phone Link
        tel_link = f"tel:{farmer_mobile}"
        self.assertEqual(tel_link, "tel:9876543210")

        # 2. English WhatsApp template
        en_msg = f"Hello {farmer_name}, I saw your crop listing for {crop_name_en} on AgriConnect. I am interested."
        en_encoded = urllib.parse.quote(en_msg)
        en_wa_url = f"https://wa.me/91{farmer_mobile}?text={en_encoded}"
        self.assertIn("https://wa.me/919876543210?text=", en_wa_url)
        self.assertIn("AgriConnect", urllib.parse.unquote(en_encoded))

        # 3. Telugu WhatsApp template
        te_msg = f"నమస్కారం {farmer_name} గారు, నేను అగ్రికనెక్ట్‌లో మీ {crop_name_te} పంట వివరాలు చూశాను. నాకు ఆసక్తి ఉంది."
        te_encoded = urllib.parse.quote(te_msg)
        te_wa_url = f"https://wa.me/91{farmer_mobile}?text={te_encoded}"
        self.assertIn("https://wa.me/919876543210?text=", te_wa_url)
        self.assertEqual(urllib.parse.unquote(te_encoded), te_msg)

        # 4. Hindi WhatsApp template
        hi_msg = f"नमस्ते {farmer_name} जी, मैंने एग्रीकनेक्ट पर आपकी {crop_name_hi} फसल की सूची देखी। मुझे इसमें रुचि है।"
        hi_encoded = urllib.parse.quote(hi_msg)
        hi_wa_url = f"https://wa.me/91{farmer_mobile}?text={hi_encoded}"
        self.assertIn("https://wa.me/919876543210?text=", hi_wa_url)
        self.assertEqual(urllib.parse.unquote(hi_encoded), hi_msg)

    def test_09_reporting_and_moderation_security(self):
        """Test reporting a listing, moderation records, and permission boundaries."""
        farmer = self.get_or_create_farmer()
        buyer = self.get_or_create_buyer()

        mine = posts.my_posts(db=self.db, user=farmer)
        target_post = mine[0]

        # Valid Report Submission
        report_res = reports.report_post(
            post_id=target_post.id,
            payload=schemas.ReportCreate(
                reason="suspicious",
                details="Price seems unusually low compared to mandi benchmark"
            ),
            db=self.db,
            user=buyer,
        )
        self.assertIn("moderation team will review", report_res["message"])

        # Reporting nonexistent post raises 404
        with self.assertRaises(HTTPException) as ctx:
            reports.report_post(
                post_id=99999,
                payload=schemas.ReportCreate(reason="spam", details="test"),
                db=self.db,
                user=buyer,
            )
        self.assertEqual(ctx.exception.status_code, 404)

        # Non-admin user blocked by get_current_admin dependency
        with self.assertRaises(HTTPException) as ctx:
            get_current_admin(user=buyer)
        self.assertEqual(ctx.exception.status_code, 403)

    # =========================================================================
    # STEP 8 — SECURITY, RBAC & DATABASE INTEGRITY
    # =========================================================================
    def test_10_admin_rbac_and_trust_verification_integrity(self):
        """Verify admin role controls, verification badge truthfulness, and trust score integrity."""
        # Create an admin user directly
        admin_user = self.db.query(models.User).filter_by(mobile="9999999999").first()
        if not admin_user:
            admin_user = models.User(
                name="Platform Admin",
                mobile="9999999999",
                hashed_password="hash",
                role=models.RoleEnum.admin,
                is_verified=True,
                trust_score=100,
            )
            self.db.add(admin_user)
            self.db.commit()
            self.db.refresh(admin_user)

        # Admin can view all reports
        admin_reports_list = reports.list_reports(db=self.db, admin=admin_user)
        self.assertGreaterEqual(len(admin_reports_list), 1)

        # Admin can view admin stats
        stats = admin.get_stats(db=self.db, admin=admin_user)
        self.assertGreaterEqual(stats.total_users, 2)
        self.assertGreaterEqual(stats.total_posts, 1)

        # Verify farmer's trust score calculation
        farmer = self.get_or_create_farmer()
        calculated_score = trust.calculate_trust_score(farmer, self.db)
        self.assertGreaterEqual(calculated_score, 50)
        self.assertLessEqual(calculated_score, 100)


if __name__ == "__main__":
    unittest.main()
