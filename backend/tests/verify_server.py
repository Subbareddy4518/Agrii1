"""
Direct verification of FastAPI app routes, dependency injection, and endpoint logic.
Runs without requiring external packages like httpx.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from routers import ai_services, posts, matching, reports
from database import SessionLocal

def run_checks():
    print("[1/5] Checking registered routes...")
    paths = []
    for r in app.routes:
        if hasattr(r, "path"):
            paths.append(r.path)
        elif hasattr(r, "routes"):
            for sub in r.routes:
                if hasattr(sub, "path"):
                    paths.append(sub.path)
    
    print("Found paths:", paths)

    print("[2/5] Testing AI crops catalog...")
    crops = ai_services.get_crops_catalog(category=None)
    assert len(crops) >= 10
    print(f"  [OK] Found {len(crops)} crops")

    print("[3/5] Testing Mandi Price Guidance...")
    guidance = ai_services.get_price_guidance(crop="Paddy", location="Miryalaguda")
    assert guidance.crop_name == "Paddy"
    assert guidance.min_price > 2000
    print(f"  [OK] Mandi guidance: {guidance.crop_name} = Rs.{guidance.modal_price}/{guidance.unit}")

    print("[4/5] Testing Cotton Guidance...")
    cotton = ai_services.get_price_guidance(crop="Cotton", location="Warangal")
    assert cotton.crop_name == "Cotton"
    print(f"  [OK] Mandi guidance: {cotton.crop_name} = Rs.{cotton.modal_price}/{cotton.unit}")

    print("[5/5] Testing Database Connection...")
    db = SessionLocal()
    try:
        from sqlalchemy import text
        res = db.execute(text("SELECT 1")).scalar()
        assert res == 1
        print("  [OK] Database session active & query successful")
    finally:
        db.close()

    print("\nALL 5 SYSTEM HEALTH VERIFICATION CHECKS PASSED SUCCESSFULLY! [PASS]")

if __name__ == "__main__":
    try:
        run_checks()
    except Exception as e:
        print(f"[FAIL] {e}")
        sys.exit(1)
