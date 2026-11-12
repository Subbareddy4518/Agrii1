"""
Trust and verification engine for AgriConnect 2.0.

Calculates genuine, explainable trust scores from backend verification state,
profile completeness, platform activity, and community moderation reports.
"""

from typing import Optional
from sqlalchemy.orm import Session
import models


def calculate_trust_score(user: models.User, db: Optional[Session] = None) -> int:
    """
    Computes an authentic trust score (0 - 100) based on:
    - Account standing (suspended = 0)
    - Identity verification (is_verified = +30)
    - Profile completeness (location, profile image, contact person = up to +20)
    - Active marketplace presence (active posts = up to +10)
    - Community moderation penalty (-15 per valid report)
    """
    if not user:
        return 0

    if getattr(user, "status", "active") == "suspended":
        return 0

    score = 50  # Base trust score for registered mobile user

    # 1. Identity Verification (+30)
    if getattr(user, "is_verified", False):
        score += 30

    # 2. Profile Completeness (up to +20)
    if user.location and len(user.location.strip()) > 2:
        score += 10
    if user.profile_image:
        score += 5
    if user.role == models.RoleEnum.industry and user.contact_person:
        score += 5
    elif user.role == models.RoleEnum.farmer:
        score += 5  # Confirmed farmer mobile contact

    # 3. Active Marketplace Presence (up to +10)
    post_count = 0
    if hasattr(user, "posts") and user.posts is not None:
        try:
            post_count = len(user.posts)
        except Exception:
            post_count = 0
    elif db is not None:
        try:
            post_count = db.query(models.Post).filter(models.Post.user_id == user.id).count()
        except Exception:
            post_count = 0

    if post_count > 0:
        score += min(10, post_count * 2)

    # 4. Community Moderation Penalties (-15 per report)
    total_reports = 0
    if db is not None:
        try:
            db_reports = (
                db.query(models.Report)
                .join(models.Post, models.Report.post_id == models.Post.id)
                .filter(models.Post.user_id == user.id)
                .count()
            )
            post_reports = sum((p.report_count or 0) for p in user.posts) if hasattr(user, "posts") and user.posts else 0
            total_reports = max(db_reports, post_reports)
        except Exception:
            total_reports = 0
    elif hasattr(user, "posts") and user.posts:
        try:
            total_reports = sum((p.report_count or 0) for p in user.posts)
        except Exception:
            total_reports = 0

    score -= (total_reports * 15)

    return max(0, min(100, score))
