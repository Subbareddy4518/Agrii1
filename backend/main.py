"""
AgriConnect API entrypoint.

Run with:
    uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import engine, Base
import models  # noqa: F401 - ensures models are registered before create_all
from routers import auth, posts, notifications, users

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AgriConnect API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this to your frontend origin in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router)
app.include_router(posts.router)
app.include_router(notifications.router)
app.include_router(users.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "AgriConnect API"}
