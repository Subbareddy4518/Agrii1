"""
Post endpoints: feed, create, update, delete, like, and search.

Feed logic is the core of the app - a farmer only ever sees industry
requirement posts, and an industry only ever sees farmer crop posts.
"""
import os
import shutil
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

import models
import schemas
from database import get_db
from auth import get_current_user

router = APIRouter(prefix="/api/posts", tags=["posts"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def opposite_role(role: models.RoleEnum) -> models.RoleEnum:
    return models.RoleEnum.industry if role == models.RoleEnum.farmer else models.RoleEnum.farmer


def serialize_post(post: models.Post, current_user_id: int, liked_ids: set) -> schemas.PostOut:
    out = schemas.PostOut.model_validate(post)
    out.liked_by_me = post.id in liked_ids
    return out


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
    sort: str = Query("latest", pattern="^(latest|price_low|price_high)$"),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    target_role = opposite_role(user.role)
    query = db.query(models.Post).options(joinedload(models.Post.owner)).filter(
        models.Post.role == target_role
    )

    if sort == "price_low":
        query = query.order_by(models.Post.price.asc().nulls_last())
    elif sort == "price_high":
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
    location: Optional[str] = Query(None),
    sort: str = Query("latest", pattern="^(latest|price_low|price_high)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    target_role = opposite_role(user.role)
    query = db.query(models.Post).options(joinedload(models.Post.owner)).filter(
        models.Post.role == target_role
    )

    if q:
        like = f"%{q}%"
        query = query.join(models.User, models.Post.user_id == models.User.id).filter(
            or_(
                models.Post.crop_name.ilike(like),
                models.Post.location.ilike(like),
                models.User.name.ilike(like),
                models.Post.title.ilike(like),
            )
        )
    if crop:
        query = query.filter(models.Post.crop_name.ilike(f"%{crop}%"))
    if location:
        query = query.filter(models.Post.location.ilike(f"%{location}%"))

    if sort == "price_low":
        query = query.order_by(models.Post.price.asc().nulls_last())
    elif sort == "price_high":
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
        .options(joinedload(models.Post.owner))
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
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    post = models.Post(
        user_id=user.id,
        role=user.role,
        title=payload.title,
        description=payload.description,
        crop_name=payload.crop_name,
        quantity=payload.quantity,
        price=payload.price,
        location=payload.location or user.location,
        image=payload.image,
        target_date=payload.target_date,
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    # Notify all users of the opposite role that a new post exists.
    target_role = opposite_role(user.role)
    recipients = db.query(models.User).filter(models.User.role == target_role).all()
    label = "crop" if user.role == models.RoleEnum.farmer else "requirement"
    for r in recipients:
        db.add(models.Notification(
            receiver_id=r.id,
            title=f"New {label} posted",
            message=f"{user.name} posted {payload.crop_name} near {post.location or 'you'}.",
        ))
    db.commit()

    return serialize_post(post, user.id, set())


@router.put("/{post_id}", response_model=schemas.PostOut)
def update_post(
    post_id: int,
    payload: schemas.PostUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your post")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(post, field, value)
    db.commit()
    db.refresh(post)

    # Let the crop owner's counterparts know it was updated.
    if user.role == models.RoleEnum.farmer:
        target_role = models.RoleEnum.industry
        recipients = db.query(models.User).filter(models.User.role == target_role).all()
        for r in recipients:
            db.add(models.Notification(
                receiver_id=r.id, title="Farmer updated crop",
                message=f"{user.name} updated their {post.crop_name} post.",
            ))
        db.commit()

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
