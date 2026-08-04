"""
AgriConnect API entrypoint.

Run with:
    uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import engine, Base, run_migrations
import models
from routers import auth, posts, notifications, users, admin

# Create database tables
Base.metadata.create_all(bind=engine)

# Additive-only migration for columns introduced by the admin dashboard
# (users.status, posts.status). Never drops or recreates anything.
run_migrations()

app = FastAPI(
    title="AgriConnect API",
    version="1.0.0"
)

# -----------------------------
# CORS Configuration
# -----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://agrii-git-main-subbu8.vercel.app",
        "https://agrii-woad.vercel.app",
        "https://agrii-33v0ykdl0-subbu8.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Static Files
# -----------------------------
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# -----------------------------
# API Routers
# -----------------------------
app.include_router(auth.router)
app.include_router(posts.router)
app.include_router(notifications.router)
app.include_router(users.router)
app.include_router(admin.router)

# -----------------------------
# Root Endpoint
# -----------------------------
@app.get("/")
def root():
    return {
        "message": "AgriConnect Backend is Running 🚀"
    }

# -----------------------------
# Health Check
# -----------------------------
@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "AgriConnect API"
    }