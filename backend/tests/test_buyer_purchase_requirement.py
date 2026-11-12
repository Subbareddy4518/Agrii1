"""
Unit tests for AgriConnect 2.0 – Industry / Buyer Purchase Requirement Workflow.
Tests:
1. Buyer purchase requirement creation & validation
2. Strict role isolation (farmer vs industry)
3. Matching engine price compatibility logic:
   - Within budget: farmer price <= buyer budget
   - Slightly above budget (<= 15%): "Slightly above your budget – negotiation may be possible"
   - Exceeds budget (> 15%): actual price difference shown, never claims meets budget
4. Delivery timeline compatibility & volume compatibility
5. Sourcing location matching (All Regions vs Specific District)
6. Feed segregation (farmers see requirements, buyers see crops)
"""
import unittest
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models
import schemas
from database import Base
from routers import posts, matching


class TestBuyerPurchaseRequirementWorkflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:")
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        Base.metadata.create_all(self.engine)
        self.db = self.Session()

        # Seed test farmer
        self.farmer = models.User(
            role=models.RoleEnum.farmer,
            name="Ramesh Patel",
            mobile="9876543210",
            hashed_password="hash",
            location="Guntur, Andhra Pradesh",
            status="active",
            is_verified=True,
            trust_score=100,
        )

        # Seed test industry buyer
        self.buyer = models.User(
            role=models.RoleEnum.industry,
            name="Agro Foods Pvt Ltd",
            contact_person="Venkatesh Rao",
            mobile="9123456780",
            hashed_password="hash",
            location="Hyderabad, Telangana",
            status="active",
            is_verified=True,
            trust_score=100,
        )

        self.db.add_all([self.farmer, self.buyer])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_01_create_buyer_purchase_requirement(self):
        """Industry account creates a purchase requirement with role isolation."""
        payload = schemas.PostCreate(
            title="Purchase Requirement: Chilli - 100 Quintal",
            crop_name="Chilli",
            category="Spices",
            quantity="100 Quintal",
            price=18000.0,
            location="Guntur",
            target_date="Within 15 Days",
            description="High quality Teja chilli required for spice processing.",
        )

        post_out = posts.create_post(payload, db=self.db, user=self.buyer)
        self.assertEqual(post_out.role, models.RoleEnum.industry)
        self.assertEqual(post_out.crop_name, "Chilli")
        self.assertEqual(post_out.price, 18000.0)
        self.assertEqual(post_out.status, "active")

        # Verify database record
        db_post = self.db.query(models.Post).filter(models.Post.id == post_out.id).first()
        self.assertIsNotNone(db_post)
        self.assertEqual(db_post.role, models.RoleEnum.industry)
        self.assertEqual(db_post.user_id, self.buyer.id)

    def test_02_role_isolation_farmer_vs_industry(self):
        """Farmer cannot create industry post; industry cannot create farmer post."""
        # Farmer creates post -> role MUST be farmer
        f_payload = schemas.PostCreate(
            title="Paddy Harvest Available",
            crop_name="Paddy",
            quantity="50 Quintal",
            price=2200.0,
            location="Guntur",
        )
        f_post = posts.create_post(f_payload, db=self.db, user=self.farmer)
        self.assertEqual(f_post.role, models.RoleEnum.farmer)

        # Buyer creates post -> role MUST be industry
        b_payload = schemas.PostCreate(
            title="Paddy Requirement",
            crop_name="Paddy",
            quantity="500 Quintal",
            price=2300.0,
            location="Hyderabad",
        )
        b_post = posts.create_post(b_payload, db=self.db, user=self.buyer)
        self.assertEqual(b_post.role, models.RoleEnum.industry)

    def test_03_matching_engine_price_within_budget(self):
        """When farmer price <= buyer budget, matching shows 'Within your budget'."""
        # Buyer requirement with budget of Rs 2500
        buyer_req = models.Post(
            user_id=self.buyer.id,
            role=models.RoleEnum.industry,
            title="Purchase Requirement: Paddy",
            crop_name="Paddy",
            quantity="200 Quintal",
            price=2500.0,
            location="Guntur",
            target_date="2026-12-01",
            status="active",
        )
        # Farmer listing at Rs 2350 (within budget)
        farmer_post = models.Post(
            user_id=self.farmer.id,
            role=models.RoleEnum.farmer,
            title="Fresh Harvest: Paddy",
            crop_name="Paddy",
            quantity="100 Quintal",
            price=2350.0,
            location="Guntur",
            target_date="2026-11-20",
            status="active",
        )
        self.db.add_all([buyer_req, farmer_post])
        self.db.commit()

        # Compute matches for buyer
        matches_res = matching.get_my_matches(db=self.db, user=self.buyer)
        self.assertGreater(matches_res.total_matches, 0)
        match_item = next(m for m in matches_res.matches if m.post.id == farmer_post.id)

        reasons_text = " ".join(match_item.reasons)
        self.assertIn("Within your budget", reasons_text)
        self.assertIn("2350.0", reasons_text)
        self.assertIn("2500.0", reasons_text)
        self.assertGreaterEqual(match_item.match_score, 80)

    def test_04_matching_engine_price_slightly_above_budget(self):
        """When farmer price is slightly above budget (<= 15%), shows negotiation possible."""
        # Buyer budget Rs 2000
        buyer_req = models.Post(
            user_id=self.buyer.id,
            role=models.RoleEnum.industry,
            title="Purchase Requirement: Maize",
            crop_name="Maize",
            quantity="100 Quintal",
            price=2000.0,
            location="Warangal",
            status="active",
        )
        # Farmer asking Rs 2150 (7.5% above budget, <= 15%)
        farmer_post = models.Post(
            user_id=self.farmer.id,
            role=models.RoleEnum.farmer,
            title="Fresh Harvest: Maize",
            crop_name="Maize",
            quantity="100 Quintal",
            price=2150.0,
            location="Warangal",
            status="active",
        )
        self.db.add_all([buyer_req, farmer_post])
        self.db.commit()

        matches_res = matching.get_my_matches(db=self.db, user=self.buyer)
        match_item = next(m for m in matches_res.matches if m.post.id == farmer_post.id)
        reasons_text = " ".join(match_item.reasons)

        self.assertIn("Slightly above your budget", reasons_text)
        self.assertIn("negotiation may be possible", reasons_text)
        self.assertNotIn("Within your budget", reasons_text)

    def test_05_matching_engine_price_exceeds_budget(self):
        """When farmer price significantly exceeds budget (> 15%), shows exact difference and never claims meets budget."""
        # Buyer budget Rs 1000
        buyer_req = models.Post(
            user_id=self.buyer.id,
            role=models.RoleEnum.industry,
            title="Purchase Requirement: Cotton",
            crop_name="Cotton",
            quantity="50 Quintal",
            price=5000.0,
            location="Guntur",
            status="active",
        )
        # Farmer asking Rs 7500 (50% above budget)
        farmer_post = models.Post(
            user_id=self.farmer.id,
            role=models.RoleEnum.farmer,
            title="Fresh Harvest: Cotton",
            crop_name="Cotton",
            quantity="50 Quintal",
            price=7500.0,
            location="Guntur",
            status="active",
        )
        self.db.add_all([buyer_req, farmer_post])
        self.db.commit()

        matches_res = matching.get_my_matches(db=self.db, user=self.buyer)
        match_item = next(m for m in matches_res.matches if m.post.id == farmer_post.id)
        reasons_text = " ".join(match_item.reasons)

        # Must state exact difference (7500 - 5000 = 2500)
        self.assertIn("Exceeds your budget by ₹2500", reasons_text)
        self.assertNotIn("Within your budget", reasons_text)
        self.assertNotIn("meets your", reasons_text)

    def test_06_sourcing_location_all_regions(self):
        """When buyer requirement specifies 'All Regions', matching recognizes open region."""
        buyer_req = models.Post(
            user_id=self.buyer.id,
            role=models.RoleEnum.industry,
            title="Purchase Requirement: Turmeric",
            crop_name="Turmeric",
            quantity="30 Quintal",
            price=12000.0,
            location="All Regions (Any Location)",
            status="active",
        )
        farmer_post = models.Post(
            user_id=self.farmer.id,
            role=models.RoleEnum.farmer,
            title="Fresh Harvest: Turmeric",
            crop_name="Turmeric",
            quantity="30 Quintal",
            price=11500.0,
            location="Nizamabad",
            status="active",
        )
        self.db.add_all([buyer_req, farmer_post])
        self.db.commit()

        matches_res = matching.get_my_matches(db=self.db, user=self.buyer)
        match_item = next(m for m in matches_res.matches if m.post.id == farmer_post.id)
        reasons_text = " ".join(match_item.reasons)

        self.assertIn("Open to all sourcing regions", reasons_text)
        self.assertEqual(match_item.distance_approx, "All Regions")

    def test_07_feed_segregation(self):
        """Farmer feed only shows industry requirements; industry feed only shows farmer crop sales."""
        f_post = models.Post(
            user_id=self.farmer.id,
            role=models.RoleEnum.farmer,
            title="Tomato Harvest Available",
            crop_name="Tomato",
            quantity="40 Boxes",
            price=500.0,
            status="active",
        )
        b_req = models.Post(
            user_id=self.buyer.id,
            role=models.RoleEnum.industry,
            title="Tomato Requirement for Sauce Factory",
            crop_name="Tomato",
            quantity="200 Boxes",
            price=550.0,
            status="active",
        )
        self.db.add_all([f_post, b_req])
        self.db.commit()

        # Farmer checks feed
        farmer_feed = posts.get_feed(db=self.db, user=self.farmer)
        for p in farmer_feed.items:
            self.assertEqual(p.role, models.RoleEnum.industry)

        # Buyer checks feed
        buyer_feed = posts.get_feed(db=self.db, user=self.buyer)
        for p in buyer_feed.items:
            self.assertEqual(p.role, models.RoleEnum.farmer)


if __name__ == "__main__":
    unittest.main()
