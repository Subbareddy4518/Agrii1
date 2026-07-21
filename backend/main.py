
"""
AgriConnect API entrypoint.

Run with:
    uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import engine, Base
import models  # noqa: F401
from routers import auth, posts, notifications, users

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AgriConnect API",
    version="1.0.0"
)

# -----------------------------
# CORS Configuration
# -----------------------------
origins = [
    "http://localhost:5173",                   # Local Vite frontend
    "http://127.0.0.1:5173",
    "https://agrii-33v0ykdl0-subbu8.vercel.app",  # Your deployed frontend
    "https://agrii-woad.vercel.app",              # Previous deployment (optional)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Static Files
# -----------------------------
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# -----------------------------
# Routers
# -----------------------------
app.include_router(auth.router)
app.include_router(posts.router)
app.include_router(notifications.router)
app.include_router(users.router)

# -----------------------------
# Health Check
# -----------------------------
@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "AgriConnect API"
    }


# -----------------------------
# Root Endpoint
# -----------------------------
@app.get("/")
def root():
    return {
        "message": "AgriConnect Backend is Running 🚀"
    }