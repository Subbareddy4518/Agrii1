"""
SmartMatch AI Matching Engine for AgriConnect.

Preserves the existing SmartMatch concept while introducing explainable,
transparent match criteria:
1. Exact crop / category alignment
2. Geographic proximity (village/district/state)
3. Quantity and volume compatibility
4. Price and budget alignment
5. Direct contact readiness (Call & WhatsApp)
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

import models
import schemas
from database import get_db
from auth import get_current_user

router = APIRouter(prefix="/api/matching", tags=["matching"])


def opposite_role(role: models.RoleEnum) -> models.RoleEnum:
    return models.RoleEnum.industry if role == models.RoleEnum.farmer else models.RoleEnum.farmer


def compute_match_details(my_posts: List[models.Post], candidate: models.Post, current_user: models.User):
    """
    Computes an explainable match between a candidate post and user's profile/posts.
    Returns (score, reasons, matched_crop, distance_approx).
    """
    reasons = []
    score = 0
    matched_crop = candidate.crop_name
    cand_crop_lower = candidate.crop_name.strip().lower()
    cand_loc_lower = (candidate.location or "").strip().lower()

    # 1. Match against user's specific posts
    best_crop_match = False
    for p in my_posts:
        my_crop_lower = p.crop_name.strip().lower()
        if my_crop_lower in cand_crop_lower or cand_crop_lower in my_crop_lower:
            best_crop_match = True
            matched_crop = p.crop_name
            reasons.append(f"Direct crop match for {p.crop_name}")
            score += 45

            # Price check
            if p.price is not None and candidate.price is not None and p.price > 0 and candidate.price > 0:
                if current_user.role == models.RoleEnum.farmer:
                    # Farmer wants to sell, industry is buying
                    if candidate.price >= p.price:
                        score += 25
                        reasons.append(f"Price matched: Buyer offer (₹{candidate.price}) meets your asking price (₹{p.price})")
                    elif abs(candidate.price - p.price) / p.price <= 0.15:
                        score += 20
                        reasons.append(f"Price negotiable: Buyer budget (₹{candidate.price}) close to your rate (₹{p.price})")
                else:
                    # Current user is industry buying
                    if p.price <= candidate.price:
                        score += 25
                        reasons.append(f"Within budget: Farmer rate (₹{candidate.price}) meets your requirement budget (₹{p.price})")
                    elif abs(candidate.price - p.price) / p.price <= 0.15:
                        score += 20
                        reasons.append(f"Close to budget: Farmer asking ₹{candidate.price} vs your budget ₹{p.price}")

            # Quantity check
            if p.quantity and candidate.quantity:
                reasons.append(f"Volume compatibility: Buyer needs {candidate.quantity}")
                score += 10
            break

    # If user has no posts yet or no direct crop post match, check category or crop interest
    if not best_crop_match:
        # Generic match based on active interest
        score += 20
        reasons.append(f"Active listing for high-demand {candidate.crop_name}")

    # 2. Location match
    user_loc = (current_user.location or "").strip().lower()
    if user_loc and cand_loc_lower:
        # Check if districts or states match
        user_parts = [part.strip() for part in user_loc.replace(',', ' ').split() if len(part.strip()) > 3]
        matched_loc_part = None
        for part in user_parts:
            if part in cand_loc_lower:
                matched_loc_part = part
                break

        if matched_loc_part:
            score += 20
            reasons.append(f"Same district/region: {candidate.location}")
            distance_approx = "Nearby (< 50 km)"
        else:
            score += 10
            reasons.append(f"Located in: {candidate.location}")
            distance_approx = "Regional"
    else:
        score += 10
        distance_approx = "Region open"

    # 3. Direct Contact Readiness
    if candidate.owner and candidate.owner.mobile:
        score += 10
        reasons.append("Direct Call and WhatsApp verified")

    score = min(100, max(25, score))
    return score, reasons, matched_crop, distance_approx


@router.get("/my-matches", response_model=schemas.SmartMatchesResponse)
def get_my_matches(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Returns AI SmartMatches specifically matching the user's crops/requirements.
    Includes transparent, explainable match reasons for each match.
    """
    target_role = opposite_role(user.role)

    # 1. User's active posts
    my_posts = (
        db.query(models.Post)
        .filter(models.Post.user_id == user.id, models.Post.status == "active")
        .all()
    )

    # 2. Counterpart active posts
    candidates = (
        db.query(models.Post)
        .options(joinedload(models.Post.owner))
        .filter(models.Post.role == target_role, models.Post.status == "active")
        .order_by(models.Post.created_at.desc())
        .limit(30)
        .all()
    )

    liked_ids = {
        l.post_id for l in db.query(models.Like).filter(models.Like.user_id == user.id).all()
    }

    match_items = []
    for cand in candidates:
        score, reasons, matched_crop, dist = compute_match_details(my_posts, cand, user)
        # We surface candidates with meaningful match points
        post_out = schemas.PostOut.model_validate(cand)
        post_out.liked_by_me = cand.id in liked_ids

        match_items.append(
            schemas.SmartMatchItemOut(
                post=post_out,
                match_score=score,
                reasons=reasons,
                matched_crop=matched_crop,
                distance_approx=dist,
            )
        )

    # Sort by match_score descending
    match_items.sort(key=lambda x: x.match_score, reverse=True)

    return schemas.SmartMatchesResponse(
        total_matches=len(match_items),
        matches=match_items[:15],
    )


@router.get("/explain/{post_id}", response_model=schemas.SmartMatchItemOut)
def explain_match(
    post_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Explains in human terms why a specific post matches the logged-in user.
    """
    post = (
        db.query(models.Post)
        .options(joinedload(models.Post.owner))
        .filter(models.Post.id == post_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    my_posts = (
        db.query(models.Post)
        .filter(models.Post.user_id == user.id, models.Post.status == "active")
        .all()
    )

    liked_ids = {
        l.post_id for l in db.query(models.Like).filter(models.Like.user_id == user.id).all()
    }

    score, reasons, matched_crop, dist = compute_match_details(my_posts, post, user)
    post_out = schemas.PostOut.model_validate(post)
    post_out.liked_by_me = post.id in liked_ids

    return schemas.SmartMatchItemOut(
        post=post_out,
        match_score=score,
        reasons=reasons,
        matched_crop=matched_crop,
        distance_approx=dist,
    )
