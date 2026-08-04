"""
Creates (or updates the password of) the AgriConnect admin account.

Usage (from the backend/ directory, with the venv active):

    python scripts/create_admin.py

Credentials are taken from environment variables so nothing is hard-coded:

    ADMIN_NAME       (optional, default "AgriConnect Admin")
    ADMIN_MOBILE     (optional, default "9999999999")
    ADMIN_PASSWORD   (optional, default: a random secure password is
                      generated and printed ONCE — save it immediately)

Example:

    ADMIN_MOBILE=9000000001 ADMIN_PASSWORD='S3curePass!' python scripts/create_admin.py

If an admin with the given mobile number already exists, this script does
NOT create a duplicate — it just re-hashes and updates that account's
password (handy for rotating the admin password later) and leaves
everything else about the account untouched.
"""
import os
import secrets
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine, Base, run_migrations  # noqa: E402
import models  # noqa: E402
from auth import hash_password  # noqa: E402


def main():
    Base.metadata.create_all(bind=engine)
    run_migrations()

    name = os.getenv("ADMIN_NAME", "AgriConnect Admin")
    mobile = os.getenv("ADMIN_MOBILE", "9999999999")
    password = os.getenv("ADMIN_PASSWORD")

    generated = False
    if not password:
        password = secrets.token_urlsafe(12)
        generated = True

    db = SessionLocal()
    try:
        existing = db.query(models.User).filter(models.User.mobile == mobile).first()

        if existing and existing.role == models.RoleEnum.admin:
            existing.hashed_password = hash_password(password)
            existing.status = models.StatusEnum.active.value
            db.commit()
            print(f"Existing admin account updated. Mobile: {mobile}")
        elif existing:
            print(
                f"A non-admin account already uses mobile {mobile}. "
                "Choose a different ADMIN_MOBILE and re-run this script."
            )
            return
        else:
            admin = models.User(
                role=models.RoleEnum.admin,
                name=name,
                contact_person=None,
                mobile=mobile,
                hashed_password=hash_password(password),
                location=None,
                profile_image=None,
                status=models.StatusEnum.active.value,
            )
            db.add(admin)
            db.commit()
            print(f"Admin account created. Mobile: {mobile}")

        if generated:
            print(f"Generated password (save this now, it will not be shown again): {password}")
        print("Log in at /login with this mobile number and password — you will land on /admin.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
