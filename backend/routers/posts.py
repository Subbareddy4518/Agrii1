"""
Post endpoints: feed, create, update, delete, like, search, and status lifecycle management.

Feed logic is the core of the app - a farmer only ever sees industry
requirement posts, and an industry only ever sees farmer crop posts.
"""
import os
import shutil
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

import models
import schemas
import trust
from database import get_db, SessionLocal
from auth import get_current_user

router = APIRouter(prefix="/api/posts", tags=["posts"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def opposite_role(role: models.RoleEnum) -> models.RoleEnum:
    return models.RoleEnum.industry if role == models.RoleEnum.farmer else models.RoleEnum.farmer


def serialize_post(post: models.Post, current_user_id: int, liked_ids: set) -> schemas.PostOut:
    out = schemas.PostOut.model_validate(post)
    out.liked_by_me = post.id in liked_ids
    if post.owner:
        out.owner.is_verified = bool(getattr(post.owner, "is_verified", False))
        out.owner.trust_score = int(getattr(post.owner, "trust_score", 100))
    return out


# --------------------------------------------------------------------------
# Background Notification Dispatchers (Decoupled, Bounded Fan-out)
# --------------------------------------------------------------------------

def dispatch_post_notifications(post_id: int, user_id: int, is_new: bool = True):
    """
    Asynchronously dispatches notifications to a bounded, relevant audience.
    Never blocks the HTTP request and never loops through all users.
    Prioritizes counterpart users interested in the same crop or geographic region.
    """
    db = SessionLocal()
    try:
        post = db.query(models.Post).filter(models.Post.id == post_id).first()
        author = db.query(models.User).filter(models.User.id == user_id).first()
        if not post or not author or post.status != "active":
            return

        target_role = opposite_role(author.role)
        label = "crop" if author.role == models.RoleEnum.farmer else "requirement"

        # 1. Counterparts who have posts with the same crop
        same_crop_user_ids = {
            p.user_id for p in db.query(models.Post.user_id)
            .filter(models.Post.role == target_role, models.Post.crop_name.ilike(f"%{post.crop_name}%"))
            .limit(10).all()
        }

        # 2. Counterparts in the same district/location
        loc_user_ids = set()
        if post.location:
            loc_token = post.location.split(",")[0].strip()
            if len(loc_token) > 2:
                loc_user_ids = {
                    u.id for u in db.query(models.User.id)
                    .filter(models.User.role == target_role, models.User.location.ilike(f"%{loc_token}%"))
                    .limit(10).all()
                }

        target_user_ids = list(same_crop_user_ids.union(loc_user_ids))

        # 3. Fallback to recent active users up to limit of 10 if few targeted matches found
        if len(target_user_ids) < 5:
            fallback_ids = [
                u.id for u in db.query(models.User.id)
                .filter(models.User.role == target_role)
                .order_by(models.User.created_at.desc())
                .limit(10).all()
                if u.id not in target_user_ids
            ]
            target_user_ids.extend(fallback_ids)

        target_user_ids = target_user_ids[:15]  # Strict ceiling to prevent unbounded fan-out

        for r_id in target_user_ids:
            if r_id != author.id:
                title = f"New {label} posted" if is_new else f"Updated {label}"
                msg = (
                    f"{author.name} posted {post.crop_name} near {post.location or 'you'}."
                    if is_new
                    else f"{author.name} updated their {post.crop_name} post."
                )
                db.add(models.Notification(
                    receiver_id=r_id,
                    title=title,
                    message=msg,
                ))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error in background post notifications: {e}")
    finally:
        db.close()


def dispatch_status_change_notifications(post_id: int, changed_by_user_id: int, new_status: str, old_status: str):
    """
    Dispatches notifications for meaningful lifecycle changes.
    """
    db = SessionLocal()
    try:
        post = db.query(models.Post).filter(models.Post.id == post_id).first()
        changer = db.query(models.User).filter(models.User.id == changed_by_user_id).first()
        if not post or not changer:
            return

        # 1. Admin action on another user's post -> notify post owner
        if post.user_id != changed_by_user_id:
            db.add(models.Notification(
                receiver_id=post.user_id,
                title="Listing Status Updated",
                message=f"Your post '{post.title}' status was updated to '{new_status}' by administration.",
            ))

        # 2. When marked as SOLD -> notify interested users who liked the post
        if new_status == "sold":
            likers = db.query(models.Like).filter(models.Like.post_id == post.id).all()
            for l in likers:
                if l.user_id != post.user_id:
                    db.add(models.Notification(
                        receiver_id=l.user_id,
                        title="Crop Sold Out",
                        message=f"The listing for {post.crop_name} by {changer.name} has been marked as sold.",
                    ))

        # 3. Transitioned from paused/draft to ACTIVE -> notify targeted audience
        elif new_status == "active" and old_status in ("paused", "draft"):
            dispatch_post_notifications(post.id, post.user_id, is_new=False)

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error in status change notifications: {e}")
    finally:
        db.close()


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------

@router.post("/upload-image")
def upload_image(file: UploadFile = File(...), user: models.User = Depends(get_current_user)):
    """Accepts a single image and returns a relative URL to store on a post/profile."""
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(UPLOAD_DIR, filename)
    with open(dest, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"url": f"/uploads/{filename}"}


@router.get("/feed", response_model=schemas.PaginatedPosts)
def get_feed(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    sort: str = Query("latest", pattern="^(latest|price_low|price_high|price_asc|price_desc)$"),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if hasattr(page, "default"):
        page = page.default
    if hasattr(page_size, "default"):
        page_size = page_size.default
    if hasattr(sort, "default"):
        sort = sort.default
    if hasattr(category, "default"):
        category = category.default

    target_role = opposite_role(user.role)
    query = db.query(models.Post).options(joinedload(models.Post.owner)).filter(
        models.Post.role == target_role,
        models.Post.status == "active"
    )

    if category and category.lower() != "all":
        query = query.filter(models.Post.category.ilike(f"%{category}%"))

    if sort in ("price_low", "price_asc"):
        query = query.order_by(models.Post.price.asc().nulls_last())
    elif sort in ("price_high", "price_desc"):
        query = query.order_by(models.Post.price.desc().nulls_last())
    else:
        query = query.order_by(models.Post.created_at.desc())

    total = query.count()
    posts = query.offset((page - 1) * page_size).limit(page_size).all()

    liked_ids = {
        l.post_id for l in db.query(models.Like).filter(models.Like.user_id == user.id).all()
    }

    items = [serialize_post(p, user.id, liked_ids) for p in posts]
    has_more = page * page_size < total
    return schemas.PaginatedPosts(items=items, page=page, page_size=page_size, has_more=has_more)


@router.get("/search", response_model=schemas.PaginatedPosts)
def search_posts(
    q: Optional[str] = Query(None),
    crop: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    sort: str = Query("latest", pattern="^(latest|price_low|price_high|price_asc|price_desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if hasattr(page, "default"):
        page = page.default
    if hasattr(page_size, "default"):
        page_size = page_size.default
    if hasattr(sort, "default"):
        sort = sort.default
    if hasattr(category, "default"):
        category = category.default
    if hasattr(q, "default"):
        q = q.default
    if hasattr(crop, "default"):
        crop = crop.default
    if hasattr(location, "default"):
        location = location.default

    target_role = opposite_role(user.role)
    query = db.query(models.Post).options(joinedload(models.Post.owner)).filter(
        models.Post.role == target_role,
        models.Post.status == "active"
    )

    if q:
        like = f"%{q}%"
        query = query.join(models.User, models.Post.user_id == models.User.id).filter(
            or_(
                models.Post.crop_name.ilike(like),
                models.Post.location.ilike(like),
                models.User.name.ilike(like),
                models.Post.title.ilike(like),
                models.Post.variety.ilike(like),
            )
        )
    if crop:
        query = query.filter(models.Post.crop_name.ilike(f"%{crop}%"))
    if category and category.lower() != "all":
        query = query.filter(models.Post.category.ilike(f"%{category}%"))
    if location:
        query = query.filter(models.Post.location.ilike(f"%{location}%"))

    if sort in ("price_low", "price_asc"):
        query = query.order_by(models.Post.price.asc().nulls_last())
    elif sort in ("price_high", "price_desc"):
        query = query.order_by(models.Post.price.desc().nulls_last())
    else:
        query = query.order_by(models.Post.created_at.desc())

    total = query.count()
    posts = query.offset((page - 1) * page_size).limit(page_size).all()

    liked_ids = {
        l.post_id for l in db.query(models.Like).filter(models.Like.user_id == user.id).all()
    }
    items = [serialize_post(p, user.id, liked_ids) for p in posts]
    has_more = page * page_size < total
    return schemas.PaginatedPosts(items=items, page=page, page_size=page_size, has_more=has_more)


@router.get("/mine", response_model=list[schemas.PostOut])
def my_posts(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    posts = (
        db.query(models.Post)
        .options(joinedload(models.Post.owner), joinedload(models.Post.status_history))
        .filter(models.Post.user_id == user.id)
        .order_by(models.Post.created_at.desc())
        .all()
    )
    liked_ids = {
        l.post_id for l in db.query(models.Like).filter(models.Like.user_id == user.id).all()
    }
    return [serialize_post(p, user.id, liked_ids) for p in posts]


@router.post("", response_model=schemas.PostOut)
def create_post(
    payload: schemas.PostCreate,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if payload.price is not None and payload.price < 0:
        raise HTTPException(status_code=422, detail="Price cannot be negative")

    post = models.Post(
        user_id=user.id,
        role=user.role,
        title=payload.title,
        description=payload.description,
        crop_name=payload.crop_name,
        category=payload.category,
        variety=payload.variety,
        quality_grade=payload.quality_grade,
        quantity=payload.quantity,
        price=payload.price,
        is_negotiable=payload.is_negotiable or False,
        location=payload.location or user.location,
        image=payload.image,
        target_date=payload.target_date,
        status="active",
        negotiation_status="none",
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    # Initial status history record
    history = models.PostStatusHistory(
        post_id=post.id,
        changed_by_user_id=user.id,
        from_status=None,
        to_status="active",
        notes="Listing published",
    )
    db.add(history)

    # Recalculate user trust score with active post
    user.trust_score = trust.calculate_trust_score(user, db)
    db.commit()

    # Enqueue background notification asynchronously (no blocking, bounded fan-out)
    if background_tasks:
        background_tasks.add_task(dispatch_post_notifications, post.id, user.id, True)

    return serialize_post(post, user.id, set())


@router.put("/{post_id}", response_model=schemas.PostOut)
def update_post(
    post_id: int,
    payload: schemas.PostUpdate,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your post")

    if payload.price is not None and payload.price < 0:
        raise HTTPException(status_code=422, detail="Price cannot be negative")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(post, field, value)
    db.commit()
    db.refresh(post)

    # Enqueue background notification asynchronously
    if background_tasks and user.role == models.RoleEnum.farmer and post.status == "active":
        background_tasks.add_task(dispatch_post_notifications, post.id, user.id, False)

    liked_ids = {
        l.post_id for l in db.query(models.Like).filter(models.Like.user_id == user.id).all()
    }
    return serialize_post(post, user.id, liked_ids)


# --------------------------------------------------------------------------
# Controlled Listing Lifecycle & Negotiation State Management
# --------------------------------------------------------------------------

VALID_TRANSITIONS = {
    "draft": {"active", "archived"},
    "active": {"paused", "sold", "archived", "closed"},
    "paused": {"active", "sold", "archived", "closed"},
    "sold": {"active", "archived", "closed"},
    "archived": {"active", "draft"},
    "closed": {"active", "draft"},
}


@router.patch("/{post_id}/status", response_model=schemas.PostOut)
def update_post_status(
    post_id: int,
    payload: schemas.PostStatusUpdate,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    post = db.query(models.Post).options(joinedload(models.Post.owner)).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    is_admin = user.role == models.RoleEnum.admin
    is_owner = post.user_id == user.id

    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to change status of this post")

    current_status = (post.status or "active").lower()
    target_status = payload.status.lower().strip() if payload.status else current_status

    valid_statuses = {"draft", "active", "paused", "sold", "archived", "closed"}
    if target_status not in valid_statuses:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid status '{payload.status}'. Must be one of {sorted(list(valid_statuses))}",
        )

    # Enforce transition rules for non-admin post owners
    if not is_admin and target_status != current_status:
        allowed = VALID_TRANSITIONS.get(current_status, set())
        if target_status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition post from '{current_status}' to '{target_status}'. Allowed transitions: {sorted(list(allowed))}",
            )

    # Quantity and Inventory Validation
    if payload.sold_price is not None:
        if payload.sold_price <= 0:
            raise HTTPException(status_code=422, detail="Sold price must be greater than 0")
        post.sold_price = payload.sold_price

    if payload.sold_quantity is not None:
        sq_clean = payload.sold_quantity.strip()
        if sq_clean.startswith("-"):
            raise HTTPException(status_code=422, detail="Sold quantity cannot be negative")
        post.sold_quantity = sq_clean

    # Negotiation tracking (tracked separately from listing availability)
    if payload.negotiation_status is not None:
        valid_neg_statuses = {"none", "in_negotiation", "offer_pending", "deal_agreed"}
        neg_clean = payload.negotiation_status.lower().strip()
        if neg_clean not in valid_neg_statuses:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid negotiation_status '{payload.negotiation_status}'. Must be one of {sorted(list(valid_neg_statuses))}",
            )
        post.negotiation_status = neg_clean

    if target_status == "sold":
        post.sold_at = datetime.utcnow()
        if post.negotiation_status == "none":
            post.negotiation_status = "deal_agreed"

    # Status change history
    if target_status != current_status:
        history = models.PostStatusHistory(
            post_id=post.id,
            changed_by_user_id=user.id,
            from_status=current_status,
            to_status=target_status,
            notes=payload.notes or ("Status updated by owner" if is_owner else "Status updated by admin"),
        )
        db.add(history)
        post.status = target_status

    db.commit()
    db.refresh(post)

    # Enqueue background notifications if status changed meaningfully
    if background_tasks and target_status != current_status:
        background_tasks.add_task(
            dispatch_status_change_notifications,
            post.id,
            user.id,
            target_status,
            current_status,
        )

    liked_ids = {
        l.post_id for l in db.query(models.Like).filter(models.Like.user_id == user.id).all()
    }
    return serialize_post(post, user.id, liked_ids)


@router.delete("/{post_id}")
def delete_post(
    post_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)
):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your post")
    db.delete(post)
    db.commit()
    return {"detail": "Post deleted"}


@router.post("/{post_id}/like", response_model=schemas.PostOut)
def like_post(
    post_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)
):
    post = db.query(models.Post).options(joinedload(models.Post.owner)).filter(
        models.Post.id == post_id
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing_like = (
        db.query(models.Like)
        .filter(models.Like.post_id == post_id, models.Like.user_id == user.id)
        .first()
    )

    if existing_like:
        db.delete(existing_like)
        post.likes_count = max(0, post.likes_count - 1)
        liked_now = False
    else:
        db.add(models.Like(post_id=post_id, user_id=user.id))
        post.likes_count += 1
        liked_now = True
        if post.user_id != user.id:
            db.add(models.Notification(
                receiver_id=post.user_id,
                title="Someone is interested",
                message=f"{user.name} is interested in your {post.crop_name} post.",
            ))

    db.commit()
    db.refresh(post)

    liked_ids = {post_id} if liked_now else set()
    return serialize_post(post, user.id, liked_ids)
