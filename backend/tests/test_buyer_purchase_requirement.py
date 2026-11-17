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

    def test_08_create_requirement_with_custom_crop_and_custom_variety(self):
        """Buyer requirement with custom uncataloged crop, custom variety, and decimal quantity."""
        payload = schemas.PostCreate(
            title="Purchase Requirement: Dragon Fruit (Red Flesh) - 12.5 Quintal",
            crop_name="Dragon Fruit",
            category="Fruits",
            variety="Red Flesh",
            quantity="12.5 Quintal",
            price=15000.0,
            location="Tenali, Guntur District, Andhra Pradesh",
            target_date="Within 15 Days",
            description="Organic certified red dragon fruit required for export packaging.\nQuality/Grade: Grade A / Premium",
        )

        post_out = posts.create_post(payload, db=self.db, user=self.buyer)
        self.assertEqual(post_out.crop_name, "Dragon Fruit")
        self.assertEqual(post_out.variety, "Red Flesh")
        self.assertEqual(post_out.quantity, "12.5 Quintal")
        self.assertEqual(post_out.location, "Tenali, Guntur District, Andhra Pradesh")
        self.assertEqual(post_out.price, 15000.0)

        # Check DB persistence
        db_post = self.db.query(models.Post).filter(models.Post.id == post_out.id).first()
        self.assertIsNotNone(db_post)
        self.assertEqual(db_post.crop_name, "Dragon Fruit")
        self.assertEqual(db_post.variety, "Red Flesh")

    def test_09_create_requirement_with_optional_price_open_negotiation(self):
        """Buyer requirement with price=None (open to negotiation / market rate)."""
        payload = schemas.PostCreate(
            title="Purchase Requirement: Black Rice - 50 Quintal",
            crop_name="Black Rice",
            category="Cereals",
            quantity="50 Quintal",
            price=None,
            is_negotiable=True,
            location="Warangal, Telangana",
            description="Open to negotiation based on prevailing market rates.",
        )

        post_out = posts.create_post(payload, db=self.db, user=self.buyer)
        self.assertEqual(post_out.crop_name, "Black Rice")
        self.assertIsNone(post_out.price)
        self.assertTrue(post_out.is_negotiable)

        # Check DB persistence
        db_post = self.db.query(models.Post).filter(models.Post.id == post_out.id).first()
        self.assertIsNotNone(db_post)
        self.assertIsNone(db_post.price)
        self.assertTrue(db_post.is_negotiable)

    def test_10_smart_match_with_custom_crop_and_optional_price(self):
        """Matching engine correctly matches custom crop and handles optional/negotiable price."""
        # Farmer posts custom crop: Dragon Fruit at Rs 14000
        farmer_post = models.Post(
            user_id=self.farmer.id,
            role=models.RoleEnum.farmer,
            title="Fresh Dragon Fruit Harvest",
            crop_name="Dragon Fruit",
            quantity="15 Quintal",
            price=14000.0,
            location="Guntur",
            status="active",
        )
        # Buyer posts custom crop: Dragon Fruit with price=None (negotiable)
        buyer_req = models.Post(
            user_id=self.buyer.id,
            role=models.RoleEnum.industry,
            title="Purchase Requirement: Dragon Fruit",
            crop_name="Dragon Fruit",
            quantity="12.5 Quintal",
            price=None,
            is_negotiable=True,
            location="Guntur",
            status="active",
        )
        self.db.add_all([farmer_post, buyer_req])
        self.db.commit()

        # Run matches for buyer
        matches_res = matching.get_my_matches(db=self.db, user=self.buyer)
        self.assertGreater(matches_res.total_matches, 0)
        matched = next((m for m in matches_res.matches if m.post.id == farmer_post.id), None)
        self.assertIsNotNone(matched)
        self.assertGreaterEqual(matched.match_score, 50)

    def test_11_smart_match_safe_crop_matching_and_false_positive_prevention(self):
        """SmartMatch safe crop matching accurately matches crops while strictly preventing false positives."""
        # 1. False-positive prevention
        false_positive_pairs = [
            ("apple", "pineapple"),
            ("Apple", "Pineapple"),
            ("apple", "pine apple"),
            ("pea", "peanut"),
            ("corn", "peppercorn"),
            ("melon", "watermelon"),
            ("Melon", "Water Melon"),
            ("fruit", "dragon fruit"),
            ("", "paddy"),
            (None, "tomato"),
        ]
        for c1, c2 in false_positive_pairs:
            is_match = matching.is_safe_crop_match(c1, c2)
            self.assertFalse(
                is_match,
                f"Expected false-positive rejection for '{c1}' vs '{c2}', but got match!"
            )

        # 2. Valid matches: exact normalized
        valid_exact_pairs = [
            ("Paddy", "paddy"),
            ("Dragon Fruit", "dragon fruit"),
            ("  Chilli  ", "chilli"),
        ]
        for c1, c2 in valid_exact_pairs:
            self.assertTrue(matching.is_safe_crop_match(c1, c2), f"Expected exact match for '{c1}' vs '{c2}'")

        # 3. Valid matches: multilingual aliases and synonyms
        multilingual_pairs = [
            ("Paddy", "వరి"),
            ("Chilli", "మిర్చి"),
            ("Cotton", "కపాస్"),
            ("Maize", "Corn"),
            ("Groundnut", "Peanut"),
        ]
        for c1, c2 in multilingual_pairs:
            self.assertTrue(matching.is_safe_crop_match(c1, c2), f"Expected multilingual alias match for '{c1}' vs '{c2}'")

        # 4. Valid matches: whole-token phrases
        token_pairs = [
            ("Dragon Fruit", "Red Dragon Fruit"),
            ("Black Rice", "Organic Black Rice"),
            ("Chilli", "Teja Chilli"),
        ]
        for c1, c2 in token_pairs:
            self.assertTrue(matching.is_safe_crop_match(c1, c2), f"Expected whole-token match for '{c1}' vs '{c2}'")

    def test_12_smart_match_reasons_distinguish_false_positives(self):
        """Candidate post with 'Pineapple' does not get 'Direct crop match' when buyer wants 'Apple'."""
        buyer_req = models.Post(
            user_id=self.buyer.id,
            role=models.RoleEnum.industry,
            title="Purchase Requirement: Apple",
            crop_name="Apple",
            quantity="50 Boxes",
            price=2000.0,
            location="Hyderabad",
            status="active",
        )
        farmer_post = models.Post(
            user_id=self.farmer.id,
            role=models.RoleEnum.farmer,
            title="Fresh Harvest: Pineapple",
            crop_name="Pineapple",
            quantity="50 Boxes",
            price=2000.0,
            location="Hyderabad",
            status="active",
        )
        self.db.add_all([buyer_req, farmer_post])
        self.db.commit()

        score, reasons, matched_crop, _ = matching.compute_match_details([buyer_req], farmer_post, self.buyer)
        reasons_text = " ".join(reasons)
        self.assertNotIn("Direct crop match", reasons_text)
        self.assertNotIn("for Apple", reasons_text)


if __name__ == "__main__":
    unittest.main()
