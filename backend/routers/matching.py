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

import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

import models
import schemas
from database import get_db
from auth import get_current_user
from .posts import resolve_canonical_crops

router = APIRouter(prefix="/api/matching", tags=["matching"])


# Stopwords / generic agricultural descriptors that should not match across distinct crops
GENERIC_CROP_WORDS = {"fruit", "crop", "grain", "vegetable", "pulse", "spice", "plant", "leaf", "seeds", "seed"}

# Explicit distinct crop pairs known to produce false-positive sub-token or substring collisions
FALSE_POSITIVE_PAIRS = {
    frozenset(["apple", "pineapple"]),
    frozenset(["apple", "pine apple"]),
    frozenset(["apple", "custard apple"]),
    frozenset(["pea", "peanut"]),
    frozenset(["corn", "peppercorn"]),
    frozenset(["corn", "popcorn"]),
    frozenset(["melon", "watermelon"]),
    frozenset(["melon", "water melon"]),
    frozenset(["melon", "muskmelon"]),
    frozenset(["melon", "musk melon"]),
}


def is_safe_crop_match(crop_a: Optional[str], crop_b: Optional[str]) -> bool:
    """
    Safely matches two crop names:
    1. Normalizes case, internal whitespace, and surrounding punctuation.
    2. Prioritizes exact normalized crop-name matches.
    3. Resolves multilingual aliases & synonyms via canonical catalog resolution.
    4. Supports whole-token phrase matching while strictly preventing false positives
       (e.g., apple vs pineapple, pea vs peanut, corn vs peppercorn, melon vs watermelon).
    """
    if not crop_a or not crop_b:
        return False

    norm_a = " ".join(crop_a.strip().lower().split())
    norm_b = " ".join(crop_b.strip().lower().split())
    if not norm_a or not norm_b:
        return False

    # 1. Exact normalized match
    if norm_a == norm_b:
        return True

    # 2. Block explicit false-positive collisions
    if frozenset([norm_a, norm_b]) in FALSE_POSITIVE_PAIRS:
        return False

    norm_a_nospace = norm_a.replace(" ", "")
    norm_b_nospace = norm_b.replace(" ", "")
    if any(frozenset([x.replace(" ", "") for x in pair]) == frozenset([norm_a_nospace, norm_b_nospace]) for pair in FALSE_POSITIVE_PAIRS):
        return False

    # 3. Canonical catalog resolution (preserves multilingual Telugu/Hindi/regional aliases)
    canonical_a = resolve_canonical_crops(norm_a)
    canonical_b = resolve_canonical_crops(norm_b)
    if canonical_a and canonical_b and (set(canonical_a) & set(canonical_b)):
        return True

    # 4. Whole-token word-boundary phrase matching
    shorter, longer = (norm_a, norm_b) if len(norm_a) <= len(norm_b) else (norm_b, norm_a)
    if shorter in GENERIC_CROP_WORDS or len(shorter) < 3:
        return False

    # Check whole-token boundary (prevents 'apple' matching inside 'pineapple', 'pea' inside 'peanut', etc.)
    if bool(re.search(rf"\b{re.escape(shorter)}\b", longer)):
        return True

    return False


def opposite_role(role: models.RoleEnum) -> models.RoleEnum:
    return models.RoleEnum.industry if role == models.RoleEnum.farmer else models.RoleEnum.farmer


def compute_match_details(my_posts: List[models.Post], candidate: models.Post, current_user: models.User):
    """
    Computes an explainable match between a candidate post and user's profile/posts.
    Returns (score, reasons, matched_crop, distance_approx).
    """
    reasons = []
    score = 0
    matched_crop = candidate.crop_name or ""
    cand_loc_lower = (candidate.location or "").strip().lower()

    # 1. Match against user's specific posts
    best_crop_match = False
    for p in my_posts:
        if is_safe_crop_match(p.crop_name, candidate.crop_name):
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
                        diff = round(p.price - candidate.price, 2)
                        diff_str = f"{int(diff)}" if diff.is_integer() else f"{diff:.1f}"
                        reasons.append(f"Buyer offer is ₹{diff_str} below your asking price (₹{p.price})")
                        score += 5
                else:
                    # Current user is industry buying (p.price = buyer budget ceiling), candidate is farmer selling (candidate.price = farmer rate)
                    if candidate.price <= p.price:
                        score += 25
                        reasons.append(f"Within your budget: Farmer rate (₹{candidate.price}) is within your budget (₹{p.price})")
                    elif (candidate.price - p.price) / p.price <= 0.15:
                        score += 15
                        reasons.append(f"Slightly above your budget – negotiation may be possible: Farmer asking ₹{candidate.price} vs your budget ₹{p.price}")
                    else:
                        diff = round(candidate.price - p.price, 2)
                        diff_str = f"{int(diff)}" if diff.is_integer() else f"{diff:.1f}"
                        reasons.append(f"Exceeds your budget by ₹{diff_str}: Farmer asking ₹{candidate.price} vs your budget ₹{p.price}")
                        score += 5

            # Quantity check
            if p.quantity and candidate.quantity:
                if current_user.role == models.RoleEnum.industry:
                    reasons.append(f"Volume compatibility: Farmer has {candidate.quantity} available")
                else:
                    reasons.append(f"Volume compatibility: Buyer needs {candidate.quantity}")
                score += 10

            # Delivery timeline check
            if candidate.target_date:
                if current_user.role == models.RoleEnum.industry:
                    reasons.append(f"Delivery timeline: Available {candidate.target_date}")
                else:
                    reasons.append(f"Delivery requirement: Needed by {candidate.target_date}")
                score += 5
            break

    # If user has no posts yet or no direct crop post match, check category or crop interest
    if not best_crop_match:
        # Generic match based on active interest
        score += 20
        reasons.append(f"Active listing for high-demand {candidate.crop_name}")

    # 2. Location match
    buyer_sourcing_loc = None
    if current_user.role == models.RoleEnum.industry and my_posts:
        for p in my_posts:
            if p.location:
                buyer_sourcing_loc = p.location.strip().lower()
                break

    user_loc = (buyer_sourcing_loc or current_user.location or "").strip().lower()
    if user_loc and ("all" in user_loc or "any" in user_loc or "అన్ని" in user_loc or "सभी" in user_loc):
        score += 15
        reasons.append("Open to all sourcing regions")
        distance_approx = "All Regions"
    elif user_loc and cand_loc_lower:
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
