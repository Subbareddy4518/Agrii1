"""
Unit & Integration Tests for AgriConnect 2.0 Phase 1 Critical Blockers:
1. Regional crop search across English, Telugu, and Hindi for mandatory crops:
   - Paddy (వరి / धान)
   - Chilli (మిర్చి / मिर्च)
   - Cotton (పత్తి / कपास)
   - Tomato (టమాటా / टमाटर)
   - Potato (బంగాళాదుంప / आलू)
2. Precision verification: Regional crop search does not return unrelated crops.
3. Location search preservation: Searching locations does not falsely trigger crop filters.
4. AI Crop Assist extraction verification for Telugu, Hindi, and English spoken phrases.
"""

import unittest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models
import schemas
from database import Base
from routers import posts, ai_services
from routers.posts import resolve_canonical_crops


class TestPhase1CriticalBlockers(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        cls.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

        db = cls.TestingSessionLocal()

        # Create a farmer and an industry user
        cls.farmer = models.User(
            name="Ramesh Reddy",
            mobile="9876543210",
            hashed_password="hash",
            role=models.RoleEnum.farmer,
            location="Miryalaguda, Nalgonda",
            is_verified=True,
            trust_score=95,
        )
        cls.industry = models.User(
            name="Guntur Agro Foods",
            mobile="9123456780",
            hashed_password="hash",
            role=models.RoleEnum.industry,
            location="Guntur, Andhra Pradesh",
            is_verified=True,
            trust_score=90,
        )
        db.add_all([cls.farmer, cls.industry])
        db.commit()
        db.refresh(cls.farmer)
        db.refresh(cls.industry)

        # Create 5 distinct industry requirement listings for the 5 crops
        posts_data = [
            ("Need 100 Quintals Sona Masoori Paddy", "Paddy", "Cereals", "Sona Masoori", 2400.0, "Miryalaguda"),
            ("Urgent Requirement for Teja Red Chilli", "Chilli", "Spices", "Teja", 18500.0, "Guntur"),
            ("Cotton Requirement Bunny BT Grade A", "Cotton", "Cash Crops", "Bunny BT", 7400.0, "Warangal"),
            ("Fresh Tomato Requirement for Puree", "Tomato", "Vegetables", "Hybrid", 25.0, "Madanapalle"),
            ("Bulk Potato Requirement for Chips", "Potato", "Vegetables", "Kufri", 22.0, "Hyderabad"),
        ]

        for title, crop_name, cat, variety, price, loc in posts_data:
            p = models.Post(
                user_id=cls.industry.id,
                title=title,
                crop_name=crop_name,
                category=cat,
                variety=variety,
                price=price,
                location=loc,
                status="active",
                role=models.RoleEnum.industry,
            )
            db.add(p)
        db.commit()
        db.close()

    def setUp(self):
        self.db = self.TestingSessionLocal()
        self.farmer = self.db.query(models.User).filter(models.User.mobile == "9876543210").first()

    def tearDown(self):
        self.db.rollback()
        self.db.close()

    def test_01_canonical_crops_resolution(self):
        """Test canonical crop resolution across Telugu, Hindi, English, and locations."""
        self.assertEqual(resolve_canonical_crops("వరి"), ["Paddy"])
        self.assertEqual(resolve_canonical_crops("వరి ధాన్యం"), ["Paddy"])
        self.assertEqual(resolve_canonical_crops("ధాన్యం"), ["Paddy"])
        self.assertEqual(resolve_canonical_crops("धान"), ["Paddy"])
        self.assertEqual(resolve_canonical_crops("चावल"), ["Paddy"])
        self.assertEqual(resolve_canonical_crops("మిర్చి"), ["Chilli"])
        self.assertEqual(resolve_canonical_crops("మిరప"), ["Chilli"])
        self.assertEqual(resolve_canonical_crops("मिर्च"), ["Chilli"])
        self.assertEqual(resolve_canonical_crops("लाल मिर्च"), ["Chilli"])
        self.assertEqual(resolve_canonical_crops("పత్తి"), ["Cotton"])
        self.assertEqual(resolve_canonical_crops("कपास"), ["Cotton"])
        self.assertEqual(resolve_canonical_crops("టమాటా"), ["Tomato"])
        self.assertEqual(resolve_canonical_crops("టమాట"), ["Tomato"])
        self.assertEqual(resolve_canonical_crops("टमाटर"), ["Tomato"])
        self.assertEqual(resolve_canonical_crops("బంగాళాదుంప"), ["Potato"])
        self.assertEqual(resolve_canonical_crops("ఆలూ"), ["Potato"])
        self.assertEqual(resolve_canonical_crops("आलू"), ["Potato"])
        self.assertEqual(resolve_canonical_crops("Paddy"), ["Paddy"])
        self.assertEqual(resolve_canonical_crops("Chilli"), ["Chilli"])
        self.assertEqual(resolve_canonical_crops("Cotton"), ["Cotton"])
        self.assertEqual(resolve_canonical_crops("Tomato"), ["Tomato"])
        self.assertEqual(resolve_canonical_crops("Potato"), ["Potato"])
        # Locations should not resolve to crops
        self.assertEqual(resolve_canonical_crops("Guntur"), [])
        self.assertEqual(resolve_canonical_crops("Miryalaguda"), [])
        self.assertEqual(resolve_canonical_crops("Warangal"), [])

    def test_02_search_posts_telugu_paddy(self):
        """Search query 'వరి' must return Paddy listings."""
        res = posts.search_posts(q="వరి", db=self.db, user=self.farmer)
        self.assertTrue(len(res.items) >= 1)
        self.assertTrue(all(item.crop_name == "Paddy" for item in res.items))

    def test_03_search_posts_hindi_paddy(self):
        """Search query 'धान' must return Paddy listings."""
        res = posts.search_posts(q="धान", db=self.db, user=self.farmer)
        self.assertTrue(len(res.items) >= 1)
        self.assertTrue(all(item.crop_name == "Paddy" for item in res.items))

    def test_04_search_posts_telugu_chilli(self):
        """Search query 'మిర్చి' must return Chilli listings."""
        res = posts.search_posts(q="మిర్చి", db=self.db, user=self.farmer)
        self.assertTrue(len(res.items) >= 1)
        self.assertTrue(all(item.crop_name == "Chilli" for item in res.items))

    def test_05_search_posts_hindi_chilli(self):
        """Search query 'मिर्च' must return Chilli listings."""
        res = posts.search_posts(q="मिर्च", db=self.db, user=self.farmer)
        self.assertTrue(len(res.items) >= 1)
        self.assertTrue(all(item.crop_name == "Chilli" for item in res.items))

    def test_06_search_posts_telugu_cotton(self):
        """Search query 'పత్తి' must return Cotton listings."""
        res = posts.search_posts(q="పత్తి", db=self.db, user=self.farmer)
        self.assertTrue(len(res.items) >= 1)
        self.assertTrue(all(item.crop_name == "Cotton" for item in res.items))

    def test_07_search_posts_hindi_cotton(self):
        """Search query 'कपास' must return Cotton listings."""
        res = posts.search_posts(q="कपास", db=self.db, user=self.farmer)
        self.assertTrue(len(res.items) >= 1)
        self.assertTrue(all(item.crop_name == "Cotton" for item in res.items))

    def test_08_search_posts_telugu_tomato(self):
        """Search query 'టమాటా' must return Tomato listings."""
        res = posts.search_posts(q="టమాటా", db=self.db, user=self.farmer)
        self.assertTrue(len(res.items) >= 1)
        self.assertTrue(all(item.crop_name == "Tomato" for item in res.items))

    def test_09_search_posts_hindi_tomato(self):
        """Search query 'टमाटर' must return Tomato listings."""
        res = posts.search_posts(q="टमाटर", db=self.db, user=self.farmer)
        self.assertTrue(len(res.items) >= 1)
        self.assertTrue(all(item.crop_name == "Tomato" for item in res.items))

    def test_10_search_posts_telugu_potato(self):
        """Search query 'బంగాళాదుంప' must return Potato listings."""
        res = posts.search_posts(q="బంగాళాదుంప", db=self.db, user=self.farmer)
        self.assertTrue(len(res.items) >= 1)
        self.assertTrue(all(item.crop_name == "Potato" for item in res.items))

    def test_11_search_posts_hindi_potato(self):
        """Search query 'आलू' must return Potato listings."""
        res = posts.search_posts(q="आलू", db=self.db, user=self.farmer)
        self.assertTrue(len(res.items) >= 1)
        self.assertTrue(all(item.crop_name == "Potato" for item in res.items))

    def test_12_precision_no_cross_contamination(self):
        """Ensure searching 'వరి' does NOT return Chilli, Cotton, Tomato, or Potato."""
        res = posts.search_posts(q="వరి", db=self.db, user=self.farmer)
        crops = {item.crop_name for item in res.items}
        self.assertIn("Paddy", crops)
        self.assertNotIn("Chilli", crops)
        self.assertNotIn("Cotton", crops)
        self.assertNotIn("Tomato", crops)
        self.assertNotIn("Potato", crops)

    def test_13_location_search_preserved(self):
        """Searching location 'Guntur' returns Guntur posts and does not force crop filtering."""
        res = posts.search_posts(q="Guntur", db=self.db, user=self.farmer)
        self.assertTrue(len(res.items) >= 1)
        self.assertTrue(any("Guntur" in (item.location or "") for item in res.items))

    def test_14_crop_assist_multilingual_extraction(self):
        """Test AI crop assist service with Telugu and Hindi phrases."""
        # Telugu phrase
        payload_te = schemas.CropAssistRequest(text="నా దగ్గర 50 క్వింటాళ్ల వరి ఉంది", language="te", role="farmer")
        res_te = ai_services.crop_assist(payload_te, user=self.farmer)
        self.assertEqual(res_te.detected_crop, "Paddy")

        # Hindi phrase
        payload_hi = schemas.CropAssistRequest(text="मेरे पास 100 क्विंटल धान उपलब्ध है", language="hi", role="farmer")
        res_hi = ai_services.crop_assist(payload_hi, user=self.farmer)
        self.assertEqual(res_hi.detected_crop, "Paddy")

        # English phrase
        payload_en = schemas.CropAssistRequest(text="50 quintals Sona Masoori paddy in Miryalaguda", language="en", role="farmer")
        res_en = ai_services.crop_assist(payload_en, user=self.farmer)
        self.assertEqual(res_en.detected_crop, "Paddy")


if __name__ == "__main__":
    unittest.main()
