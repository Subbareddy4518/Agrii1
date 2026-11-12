"""
Unit & Integration Tests for AgriConnect 2.0 Phase 2: Farmer Data Protection
1. Safe Archiving:
   - Farmer DELETE endpoint soft-archives post (status="archived") instead of destroying records.
   - Non-owner delete attempt raises HTTP 403 Forbidden.
   - Admin DELETE endpoint permanently deletes row from database.
   - Post status transition active -> archived -> active (restore) works smoothly with audit history.
2. Search, Feed & AI Isolation:
   - Feed excludes archived posts.
   - Search excludes archived posts.
   - Restoring to active immediately restores visibility in feed and search.
3. Interaction Protection:
   - Liking an archived post is blocked with HTTP 400.
   - Liking restored post succeeds.
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
from routers import posts


class TestPhase2DataProtection(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        cls.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

        db = cls.TestingSessionLocal()

        # Create Farmer 1
        cls.farmer = models.User(
            name="Ramesh Reddy",
            mobile="9876543210",
            hashed_password="hash",
            role=models.RoleEnum.farmer,
            location="Miryalaguda, Nalgonda",
            is_verified=True,
            trust_score=90,
        )
        # Create Farmer 2 (Other user)
        cls.other_farmer = models.User(
            name="Suresh Kumar",
            mobile="9876543211",
            hashed_password="hash",
            role=models.RoleEnum.farmer,
            location="Warangal",
            is_verified=False,
            trust_score=80,
        )
        # Create Industry Buyer
        cls.buyer = models.User(
            name="Deccan Rice Mill",
            mobile="9876543212",
            hashed_password="hash",
            role=models.RoleEnum.industry,
            location="Miryalaguda",
            is_verified=True,
            trust_score=95,
        )
        # Create Admin
        cls.admin = models.User(
            name="System Admin",
            mobile="9876543299",
            hashed_password="hash",
            role=models.RoleEnum.admin,
            location="Hyderabad",
            is_verified=True,
            trust_score=100,
        )
        db.add_all([cls.farmer, cls.other_farmer, cls.buyer, cls.admin])
        db.commit()

        for u in [cls.farmer, cls.other_farmer, cls.buyer, cls.admin]:
            db.refresh(u)
        db.close()

    def setUp(self):
        self.db = self.TestingSessionLocal()
        # Re-attach users
        self.farmer = self.db.query(models.User).filter(models.User.id == self.__class__.farmer.id).first()
        self.other_farmer = self.db.query(models.User).filter(models.User.id == self.__class__.other_farmer.id).first()
        self.buyer = self.db.query(models.User).filter(models.User.id == self.__class__.buyer.id).first()
        self.admin = self.db.query(models.User).filter(models.User.id == self.__class__.admin.id).first()

    def tearDown(self):
        self.db.close()

    def test_01_soft_archive_via_delete_for_farmer(self):
        """Farmer deleting a post must soft-archive it, preserving records and audit trail."""
        post = models.Post(
            user_id=self.farmer.id,
            role=models.RoleEnum.farmer,
            crop_name="Paddy",
            title="Fresh Sona Masoori Paddy",
            quantity="50 Quintals",
            price=2250.0,
            location="Miryalaguda",
            status="active",
        )
        self.db.add(post)
        self.db.commit()
        self.db.refresh(post)

        res = posts.delete_post(post.id, self.db, self.farmer)
        self.assertEqual(res["status"], "archived")
        self.assertEqual(res["detail"], "Post archived safely")

        # Verify post row still exists in database and is archived
        db_post = self.db.query(models.Post).filter(models.Post.id == post.id).first()
        self.assertIsNotNone(db_post)
        self.assertEqual(db_post.status, "archived")

        # Verify audit history
        history = (
            self.db.query(models.PostStatusHistory)
            .filter(models.PostStatusHistory.post_id == post.id)
            .order_by(models.PostStatusHistory.id.desc())
            .first()
        )
        self.assertIsNotNone(history)
        self.assertEqual(history.from_status, "active")
        self.assertEqual(history.to_status, "archived")
        self.assertEqual(history.changed_by_user_id, self.farmer.id)

    def test_02_unauthorized_deletion_rejected(self):
        """A user cannot delete or archive another user's post (HTTP 403)."""
        post = models.Post(
            user_id=self.farmer.id,
            role=models.RoleEnum.farmer,
            crop_name="Cotton",
            title="High Quality Cotton",
            quantity="30 Quintals",
            price=7200.0,
            location="Nalgonda",
            status="active",
        )
        self.db.add(post)
        self.db.commit()
        self.db.refresh(post)

        with self.assertRaises(HTTPException) as ctx:
            posts.delete_post(post.id, self.db, self.other_farmer)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_03_admin_hard_delete_privilege(self):
        """Admins retain permanent deletion privilege for moderation/cleanup."""
        post = models.Post(
            user_id=self.farmer.id,
            role=models.RoleEnum.farmer,
            crop_name="Tomato",
            title="Spam / Invalid Listing",
            quantity="10 Boxes",
            price=500.0,
            location="Miryalaguda",
            status="active",
        )
        self.db.add(post)
        self.db.commit()
        self.db.refresh(post)
        post_id = post.id

        res = posts.delete_post(post_id, self.db, self.admin)
        self.assertEqual(res["status"], "deleted")

        # Verify post is completely removed
        db_post = self.db.query(models.Post).filter(models.Post.id == post_id).first()
        self.assertIsNone(db_post)

    def test_04_restore_archived_post_to_active(self):
        """Farmer can restore an archived post back to active status."""
        post = models.Post(
            user_id=self.farmer.id,
            role=models.RoleEnum.farmer,
            crop_name="Chilli",
            title="Teja Red Chilli",
            quantity="20 Quintals",
            price=18500.0,
            location="Miryalaguda",
            status="archived",
        )
        self.db.add(post)
        self.db.commit()
        self.db.refresh(post)

        payload = schemas.PostStatusUpdate(
            status="active",
            notes="Farmer restored listing for new season"
        )
        res = posts.update_post_status(post.id, payload, db=self.db, user=self.farmer)
        self.assertEqual(res.status, "active")

        # Verify in DB
        db_post = self.db.query(models.Post).filter(models.Post.id == post.id).first()
        self.assertEqual(db_post.status, "active")

        # Verify history
        history = (
            self.db.query(models.PostStatusHistory)
            .filter(models.PostStatusHistory.post_id == post.id)
            .order_by(models.PostStatusHistory.id.desc())
            .first()
        )
        self.assertEqual(history.from_status, "archived")
        self.assertEqual(history.to_status, "active")

    def test_05_search_and_feed_exclude_archived_posts(self):
        """Archived posts are never returned in public marketplace feed or search."""
        post = models.Post(
            user_id=self.farmer.id,
            role=models.RoleEnum.farmer,
            crop_name="Paddy",
            title="Miryalaguda Super Fine Rice",
            quantity="100 Quintals",
            price=2400.0,
            location="Miryalaguda",
            status="active",
        )
        self.db.add(post)
        self.db.commit()
        self.db.refresh(post)

        # 1. Active: visible in feed and search for buyers
        feed_before = posts.get_feed(db=self.db, user=self.buyer)
        feed_ids_before = [p.id for p in feed_before.items]
        self.assertIn(post.id, feed_ids_before)

        search_before = posts.search_posts(crop="Paddy", db=self.db, user=self.buyer)
        self.assertIn(post.id, [p.id for p in search_before.items])

        # 2. Archive post
        posts.delete_post(post.id, self.db, self.farmer)

        feed_after = posts.get_feed(db=self.db, user=self.buyer)
        feed_ids_after = [p.id for p in feed_after.items]
        self.assertNotIn(post.id, feed_ids_after)

        search_after = posts.search_posts(crop="Paddy", db=self.db, user=self.buyer)
        self.assertNotIn(post.id, [p.id for p in search_after.items])

        # 3. Restore to active: reappears
        posts.update_post_status(
            post.id, schemas.PostStatusUpdate(status="active"), db=self.db, user=self.farmer
        )
        feed_restored = posts.get_feed(db=self.db, user=self.buyer)
        self.assertIn(post.id, [p.id for p in feed_restored.items])

    def test_06_archived_post_cannot_be_liked(self):
        """Archived post rejects like actions with HTTP 400."""
        post = models.Post(
            user_id=self.farmer.id,
            role=models.RoleEnum.farmer,
            crop_name="Turmeric",
            title="Salem Turmeric Bulk",
            quantity="15 Quintals",
            price=12000.0,
            location="Miryalaguda",
            status="archived",
        )
        self.db.add(post)
        self.db.commit()
        self.db.refresh(post)

        with self.assertRaises(HTTPException) as ctx:
            posts.like_post(post.id, self.db, self.other_farmer)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Cannot like an archived listing", ctx.exception.detail)

        # Once restored, like succeeds
        posts.update_post_status(
            post.id, schemas.PostStatusUpdate(status="active"), db=self.db, user=self.farmer
        )
        res = posts.like_post(post.id, self.db, self.other_farmer)
        self.assertEqual(res.liked_by_me, True)


if __name__ == "__main__":
    unittest.main()
