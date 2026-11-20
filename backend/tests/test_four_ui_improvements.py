import unittest
import os
import sys
from datetime import datetime

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi import HTTPException

import models
import schemas
from database import Base
from routers import posts, matching
from auth import hash_password

class TestFourUIImprovements(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        cls.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

    def setUp(self):
        self.db = self.SessionLocal()
        # Clean test tables
        for table in reversed(Base.metadata.sorted_tables):
            self.db.execute(table.delete())
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_01_manual_crop_name_entry_farmer(self):
        """Farmer can enter custom manual crop name (e.g. Dragon Fruit) and it saves cleanly."""
        farmer = models.User(
            role=models.RoleEnum.farmer,
            name="Ramesh Naidu",
            mobile="9848011223",
            hashed_password=hash_password("pass123"),
            location="Guntur, Andhra Pradesh",
            is_verified=True,
            status=models.StatusEnum.active.value,
        )
        self.db.add(farmer)
        self.db.commit()
        self.db.refresh(farmer)

        # Farmer posts manually entered crop
        post_in = schemas.PostCreate(
            title="Fresh Organic Dragon Fruit",
            description="Red flesh variety, freshly harvested from Guntur farm.",
            crop_name="Dragon Fruit",
            category="Fruits",
            variety="Red Flesh",
            quantity="25 Quintal",
            price=12000.0,
            is_negotiable=True,
            location="Guntur, Andhra Pradesh",
        )
        post = posts.create_post(post_in, db=self.db, user=farmer)
        self.assertIsNotNone(post.id)
        self.assertEqual(post.crop_name, "Dragon Fruit")
        self.assertEqual(post.category, "Fruits")
        self.assertEqual(post.quantity, "25 Quintal")
        self.assertEqual(post.status, "active")

        # Verify in farmer's listings
        my_posts = posts.my_posts(db=self.db, user=farmer)
        self.assertEqual(len(my_posts), 1)
        self.assertEqual(my_posts[0].crop_name, "Dragon Fruit")

    def test_02_manual_crop_name_smartmatch_buyer_and_farmer(self):
        """Buyer requirement for manually entered crop matches farmer listing via SmartMatch."""
        farmer = models.User(
            role=models.RoleEnum.farmer,
            name="Sita Devi",
            mobile="9848033445",
            hashed_password=hash_password("pass123"),
            location="Warangal, Telangana",
            is_verified=True,
            status=models.StatusEnum.active.value,
        )
        buyer = models.User(
            role=models.RoleEnum.industry,
            name="Exotic Juices Pvt Ltd",
            mobile="9848099881",
            hashed_password=hash_password("pass123"),
            location="Warangal, Telangana",
            is_verified=True,
            status=models.StatusEnum.active.value,
        )
        self.db.add_all([farmer, buyer])
        self.db.commit()
        self.db.refresh(farmer)
        self.db.refresh(buyer)

        # Farmer listing: Dragon Fruit
        posts.create_post(
            schemas.PostCreate(
                title="Fresh Dragon Fruit Harvest",
                crop_name="Dragon Fruit",
                category="Fruits",
                quantity="50 Quintal",
                price=11500.0,
                location="Warangal, Telangana",
            ),
            db=self.db,
            user=farmer,
        )

        # Buyer requirement: Dragon Fruit
        buyer_post = posts.create_post(
            schemas.PostCreate(
                title="Need 100 Quintals Dragon Fruit",
                crop_name="Dragon Fruit",
                category="Fruits",
                quantity="100 Quintal",
                price=12500.0,
                location="Warangal, Telangana",
            ),
            db=self.db,
            user=buyer,
        )

        # Match check
        matches_res = matching.get_my_matches(db=self.db, user=farmer)
        self.assertGreaterEqual(matches_res.total_matches, 1)
        match_item = matches_res.matches[0]
        self.assertEqual(match_item.post.crop_name, "Dragon Fruit")
        self.assertGreaterEqual(match_item.match_score, 70)

    def test_03_quantity_validation_and_price_guards(self):
        """Quantity and price business logic enforces non-negative constraints."""
        farmer = models.User(
            role=models.RoleEnum.farmer,
            name="Appa Rao",
            mobile="9848055667",
            hashed_password=hash_password("pass123"),
            location="Kurnool, Andhra Pradesh",
            is_verified=True,
            status=models.StatusEnum.active.value,
        )
        self.db.add(farmer)
        self.db.commit()
        self.db.refresh(farmer)

        # Negative price should be rejected with 422
        with self.assertRaises(HTTPException) as ctx:
            posts.create_post(
                schemas.PostCreate(
                    title="Invalid Negative Price Post",
                    crop_name="Cotton",
                    price=-500.0,
                    quantity="10 Quintal",
                ),
                db=self.db,
                user=farmer,
            )
        self.assertEqual(ctx.exception.status_code, 422)

        # Positive price and decimal quantity should succeed
        valid_post = posts.create_post(
            schemas.PostCreate(
                title="Valid Cotton Post",
                crop_name="Cotton",
                price=7250.50,
                quantity="12.5 Quintal",
                location="Kurnool, Andhra Pradesh",
            ),
            db=self.db,
            user=farmer,
        )
        self.assertEqual(valid_post.quantity, "12.5 Quintal")
        self.assertEqual(valid_post.price, 7250.50)

if __name__ == "__main__":
    unittest.main()
