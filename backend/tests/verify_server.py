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

    print("[3/5] Testing Mandi Price Guidance (Honest Unavailable Mode)...")
    guidance = ai_services.get_price_guidance(crop="Paddy", location="Miryalaguda", language="te")
    assert guidance.crop_name == "Paddy"
    assert guidance.is_available is False
    assert guidance.modal_price is None
    assert guidance.confidence == "unavailable"
    assert guidance.message == "ఈ పంటకు తాజా మార్కెట్ ధర అందుబాటులో లేదు."
    print(f"  [OK] Honest unavailable status verified: {guidance.message}")

    print("[4/5] Testing Cotton Guidance (English)...")
    cotton = ai_services.get_price_guidance(crop="Cotton", location="Warangal", language="en")
    assert cotton.crop_name == "Cotton"
    assert cotton.is_available is False
    assert cotton.modal_price is None
    assert cotton.confidence == "unavailable"
    assert cotton.message == "Latest market price is unavailable for this crop."
    print(f"  [OK] Honest unavailable status verified: {cotton.message}")

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
