"""
AgriConnect API entrypoint.

Local:
    cd backend
    uvicorn main:app --reload --port 8000

Render:
    uvicorn main:app --host 0.0.0.0 --port $PORT
"""

import os
from dotenv import load_dotenv

# Load local environment configuration from .env (gitignored)
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from database import engine, Base, run_migrations, SessionLocal
import models
from auth import hash_password
from routers import auth, posts, notifications, users, admin, ai_services, matching, reports


# ============================================================
# 1. DATABASE SETUP
# ============================================================

# Create tables that do not already exist.
Base.metadata.create_all(bind=engine)

# Apply additive migrations.
# Currently handles:
#   users.status
#   posts.status
run_migrations()


# ============================================================
# 2. ADMIN ACCOUNT SETUP
# ============================================================

def setup_admin_from_environment():
    """
    Create or update the AgriConnect admin account using
    environment variables.

    Required on Render:
        ADMIN_MOBILE
        ADMIN_PASSWORD

    Optional:
        ADMIN_NAME

    IMPORTANT:
    If ADMIN_PASSWORD is not configured, this function does
    nothing. This prevents accidentally resetting the admin
    password every time the server restarts.
    """

    admin_mobile = os.getenv("ADMIN_MOBILE")
    admin_password = os.getenv("ADMIN_PASSWORD")
    admin_name = os.getenv(
        "ADMIN_NAME",
        "AgriConnect Admin"
    )

    # Do not modify the database if credentials are missing.
    if not admin_mobile or not admin_password:
        print(
            "Admin environment variables not configured. "
            "Skipping admin setup."
        )
        return

    db: Session = SessionLocal()

    try:
        existing_user = (
            db.query(models.User)
            .filter(models.User.mobile == admin_mobile)
            .first()
        )

        # ----------------------------------------------------
        # Existing ADMIN account
        # ----------------------------------------------------
        if existing_user:

            if existing_user.role == models.RoleEnum.admin:

                if admin_name and existing_user.name != admin_name:
                    existing_user.name = admin_name

                # Check if an explicit emergency reset is requested via environment variable
                force_reset = os.getenv("FORCE_ADMIN_PASSWORD_RESET", "").lower() in ("true", "1", "yes")
                if force_reset or not existing_user.hashed_password:
                    existing_user.hashed_password = hash_password(
                        admin_password
                    )
                    print(
                        f"Admin password reset from environment for '{admin_name}'."
                    )
                else:
                    # Preserve password updated via Admin Settings across restarts
                    print(
                        f"Admin account already exists for '{admin_name}'. Preserving existing password across restart."
                    )

                existing_user.status = (
                    models.StatusEnum.active.value
                )

                db.commit()

            else:
                print(
                    "ERROR: Configured ADMIN_MOBILE already belongs to a non-admin account."
                )

        # ----------------------------------------------------
        # Admin does not exist
        # ----------------------------------------------------
        else:

            admin_user = models.User(
                role=models.RoleEnum.admin,
                name=admin_name,
                contact_person=None,
                mobile=admin_mobile,
                hashed_password=hash_password(
                    admin_password
                ),
                location=None,
                profile_image=None,
                status=models.StatusEnum.active.value,
            )

            db.add(admin_user)
            db.commit()

            print(
                f"Admin account created successfully for '{admin_name}'."
            )

    except Exception as error:
        db.rollback()

        print(
            "ERROR while setting up admin account:"
        )
        print(error)

    finally:
        db.close()


# Run admin setup only when the application starts.
setup_admin_from_environment()


# ============================================================
# 3. FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="AgriConnect API",
    version="1.0.0"
)


# ============================================================
# 4. CORS CONFIGURATION
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        # Local development
        "http://localhost:5173",
        "http://127.0.0.1:5173",

        # Vercel deployments
        "https://agrii-git-main-subbu8.vercel.app",
        "https://agrii-woad.vercel.app",
        "https://agrii-33v0ykdl0-subbu8.vercel.app",
        "https://agrii-subbu8.vercel.app",
    ],

    allow_credentials=True,

    allow_methods=[
        "*"
    ],

    allow_headers=[
        "*"
    ],
)


# ============================================================
# 5. STATIC FILES
# ============================================================

# Make sure uploads directory exists.
os.makedirs("uploads", exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads"
)


# ============================================================
# 6. API ROUTERS
# ============================================================

app.include_router(auth.router)
app.include_router(posts.router)
app.include_router(notifications.router)
app.include_router(users.router)
app.include_router(admin.router)
app.include_router(ai_services.router)
app.include_router(matching.router)
app.include_router(reports.router)


# ============================================================
# 7. ROOT ENDPOINT
# ============================================================

@app.get("/")
def root():
    return {
        "message": "AgriConnect Backend is Running 🚀"
    }


# ============================================================
# 8. HEALTH CHECK
# ============================================================

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "AgriConnect API"
    }