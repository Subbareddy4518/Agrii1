import unittest
import os
import sys
from datetime import datetime

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models
import schemas
import auth
from routers import posts
from models import RoleEnum, Base

class TestFarmerPostRedesign(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        models.Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Farmer with registered location in profile
        self.farmer = models.User(
            name="Ramesh Reddy",
            mobile="9876543210",
            hashed_password=auth.hash_password("pass123"),
            role=RoleEnum.farmer,
            location="Miryalaguda, Telangana",
            is_verified=True,
            trust_score=85,
        )
        self.db.add(self.farmer)

        # Buyer
        self.buyer = models.User(
            name="Sri Venkateswara Mill",
            contact_person="Venkat Rao",
            mobile="9123456780",
            hashed_password=auth.hash_password("pass123"),
            role=RoleEnum.industry,
            location="Suryapet, Telangana",
            is_verified=True,
            trust_score=90,
        )
        self.db.add(self.buyer)
        self.db.commit()
        self.db.refresh(self.farmer)
        self.db.refresh(self.buyer)

    def tearDown(self):
        self.db.close()
        models.Base.metadata.drop_all(bind=self.engine)

    def test_minimal_four_field_crop_posting(self):
        """Farmer posts with ONLY 4 essential details: crop, quantity, expected price, delivery time.
        Profile location is automatically inherited without asking farmer to re-enter it."""
        payload = schemas.PostCreate(
            title="Fresh Harvest Paddy - 50 Quintal",
            crop_name="Paddy",
            quantity="50 Quintal",
            price=2350.0,
            target_date="Today (2026-11-12)",
            location=None, # Farmer not prompted for location!
        )

        created = posts.create_post(payload=payload, db=self.db, user=self.farmer)
        self.assertIsNotNone(created.id)
        self.assertEqual(created.crop_name, "Paddy")
        self.assertEqual(created.quantity, "50 Quintal")
        self.assertEqual(created.price, 2350.0)
        self.assertEqual(created.target_date, "Today (2026-11-12)")
        # Location automatically inherited from farmer's profile
        self.assertEqual(created.location, "Miryalaguda, Telangana")
        self.assertEqual(created.status, "active")

    def test_delivery_date_options(self):
        """Delivery dates (Today, Tomorrow, Custom date) are stored consistently in target_date."""
        options = [
            ("Today", "Today (2026-11-12)"),
            ("Tomorrow", "Tomorrow (2026-11-13) - morning"),
            ("Custom", "2026-11-25 - afternoon"),
        ]

        for crop, dt in options:
            payload = schemas.PostCreate(
                title=f"Fresh {crop}",
                crop_name=crop,
                quantity="100 Quintal",
                price=2200.0,
                target_date=dt,
            )
            created = posts.create_post(payload=payload, db=self.db, user=self.farmer)
            self.assertEqual(created.target_date, dt)

    def test_negative_price_rejected(self):
        """Invalid negative prices must be rejected with HTTP 422."""
        payload = schemas.PostCreate(
            title="Invalid Price Crop",
            crop_name="Cotton",
            quantity="20 Quintal",
            price=-100.0,
            target_date="Tomorrow",
        )
        with self.assertRaises(HTTPException) as ctx:
            posts.create_post(payload=payload, db=self.db, user=self.farmer)
        self.assertEqual(ctx.exception.status_code, 422)

    def test_farmer_post_appears_in_buyer_feed(self):
        """Published crop listing immediately appears in buyer feed with all 4 details."""
        payload = schemas.PostCreate(
            title="Fresh Harvest Chilli - 25 Quintal",
            crop_name="Chilli",
            quantity="25 Quintal",
            price=16500.0,
            target_date="Today (2026-11-12)",
        )
        created = posts.create_post(payload=payload, db=self.db, user=self.farmer)

        feed = posts.get_feed(page=1, page_size=10, sort="latest", db=self.db, user=self.buyer)
        self.assertEqual(len(feed.items), 1)
        item = feed.items[0]
        self.assertEqual(item.id, created.id)
        self.assertEqual(item.crop_name, "Chilli")
        self.assertEqual(item.quantity, "25 Quintal")
        self.assertEqual(item.price, 16500.0)
        self.assertEqual(item.target_date, "Today (2026-11-12)")
        self.assertEqual(item.location, "Miryalaguda, Telangana")

    def test_post_lifecycle_with_redesigned_posts(self):
        """Status transitions on redesigned posts work smoothly."""
        payload = schemas.PostCreate(
            title="Fresh Harvest Tomato - 500 Kg",
            crop_name="Tomato",
            quantity="500 Kg",
            price=25.0,
            target_date="Today",
        )
        created = posts.create_post(payload=payload, db=self.db, user=self.farmer)

        # Pause listing
        paused = posts.update_post_status(
            post_id=created.id,
            payload=schemas.PostStatusUpdate(status="paused"),
            db=self.db,
            user=self.farmer,
        )
        self.assertEqual(paused.status, "paused")

        # Must not appear in buyer feed when paused
        feed = posts.get_feed(page=1, page_size=10, sort="latest", db=self.db, user=self.buyer)
        self.assertEqual(len(feed.items), 0)

if __name__ == "__main__":
    unittest.main()
