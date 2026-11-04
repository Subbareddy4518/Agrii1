"""
Admin dashboard endpoints.

Every route in this router depends on `get_current_admin`, which re-verifies
the caller's role against the database on each request — the frontend's
notion of the user's role is never trusted for authorization.

Reuses the existing User/Post/Notification models and get_db/session setup
rather than introducing a parallel data layer.
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_

import models
import schemas
from database import get_db
from auth import get_current_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


# --------------------------------------------------------------------------
# Stats & Analytics
# --------------------------------------------------------------------------

@router.get("/stats", response_model=schemas.AdminStatsOut)
def get_stats(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    total_users = db.query(models.User).filter(models.User.role != models.RoleEnum.admin).count()
    total_farmers = db.query(models.User).filter(models.User.role == models.RoleEnum.farmer).count()
    total_industries = db.query(models.User).filter(models.User.role == models.RoleEnum.industry).count()
    suspended_users = db.query(models.User).filter(
        models.User.status == "suspended", models.User.role != models.RoleEnum.admin
    ).count()

    total_posts = db.query(models.Post).count()
    active_posts = db.query(models.Post).filter(models.Post.status == "active").count()
    closed_posts = db.query(models.Post).filter(models.Post.status == "closed").count()
    crop_posts = db.query(models.Post).filter(models.Post.role == models.RoleEnum.farmer).count()
    requirement_posts = db.query(models.Post).filter(models.Post.role == models.RoleEnum.industry).count()

    recent_cutoff = datetime.utcnow() - timedelta(days=7)
    recent_notifications = db.query(models.Notification).filter(
        models.Notification.created_at >= recent_cutoff
    ).count()

    return schemas.AdminStatsOut(
        total_users=total_users,
        total_farmers=total_farmers,
        total_industries=total_industries,
        total_posts=total_posts,
        active_posts=active_posts,
        closed_posts=closed_posts,
        crop_posts=crop_posts,
        requirement_posts=requirement_posts,
        recent_notifications=recent_notifications,
        suspended_users=suspended_users,
    )


@router.get("/analytics", response_model=schemas.AdminAnalyticsOut)
def get_analytics(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    total_farmers = db.query(models.User).filter(models.User.role == models.RoleEnum.farmer).count()
    total_industries = db.query(models.User).filter(models.User.role == models.RoleEnum.industry).count()

    farmers_vs_industries = [
        schemas.ChartPoint(label="Farmers", value=total_farmers),
        schemas.ChartPoint(label="Industries", value=total_industries),
    ]

    # Posts created per day, last 14 days.
    since = datetime.utcnow() - timedelta(days=13)
    posts_rows = (
        db.query(
            func.date(models.Post.created_at).label("day"),
            func.count(models.Post.id).label("count"),
        )
        .filter(models.Post.created_at >= since)
        .group_by("day")
        .order_by("day")
        .all()
    )
    posts_by_day = {row.day: row.count for row in posts_rows}
    posts_over_time = []
    for i in range(14):
        day = (since + timedelta(days=i)).date()
        key = day.isoformat()
        posts_over_time.append(schemas.ChartPoint(label=key, value=posts_by_day.get(key, 0)))

    # Top crop distribution.
    crop_rows = (
        db.query(models.Post.crop_name, func.count(models.Post.id).label("count"))
        .group_by(models.Post.crop_name)
        .order_by(func.count(models.Post.id).desc())
        .limit(8)
        .all()
    )
    crop_distribution = [schemas.ChartPoint(label=row.crop_name, value=row.count) for row in crop_rows]

    # User growth (new registrations per day, last 14 days).
    users_rows = (
        db.query(
            func.date(models.User.created_at).label("day"),
            func.count(models.User.id).label("count"),
        )
        .filter(models.User.created_at >= since, models.User.role != models.RoleEnum.admin)
        .group_by("day")
        .order_by("day")
        .all()
    )
    users_by_day = {row.day: row.count for row in users_rows}
    user_growth = []
    for i in range(14):
        day = (since + timedelta(days=i)).date()
        key = day.isoformat()
        user_growth.append(schemas.ChartPoint(label=key, value=users_by_day.get(key, 0)))

    active_count = db.query(models.Post).filter(models.Post.status == "active").count()
    closed_count = db.query(models.Post).filter(models.Post.status == "closed").count()
    active_vs_closed = [
        schemas.ChartPoint(label="Active", value=active_count),
        schemas.ChartPoint(label="Closed", value=closed_count),
    ]

    interested_actions_total = db.query(models.Like).count()
    notifications_total = db.query(models.Notification).count()

    return schemas.AdminAnalyticsOut(
        farmers_vs_industries=farmers_vs_industries,
        posts_over_time=posts_over_time,
        crop_distribution=crop_distribution,
        user_growth=user_growth,
        active_vs_closed=active_vs_closed,
        interested_actions_total=interested_actions_total,
        notifications_total=notifications_total,
    )


# --------------------------------------------------------------------------
# Users (generic + role-filtered farmer/industry views reuse this endpoint)
# --------------------------------------------------------------------------

def _query_users(
    db: Session,
    role: Optional[str],
    status_filter: Optional[str],
    search: Optional[str],
):
    query = db.query(models.User).filter(models.User.role != models.RoleEnum.admin)

    if role:
        query = query.filter(models.User.role == role)
    if status_filter:
        query = query.filter(models.User.status == status_filter)
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(models.User.name.ilike(like), models.User.mobile.ilike(like), models.User.location.ilike(like))
        )
    return query


@router.get("/users", response_model=schemas.PaginatedAdminUsers)
def list_users(
    role: Optional[str] = Query(None, pattern="^(farmer|industry)$"),
    status_filter: Optional[str] = Query(None, alias="status", pattern="^(active|suspended)$"),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    query = _query_users(db, role, status_filter, search).order_by(models.User.created_at.desc())
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for u in rows:
        out = schemas.AdminUserOut.model_validate(u)
        out.posts_count = len(u.posts)
        items.append(out)

    return schemas.PaginatedAdminUsers(
        items=items, page=page, page_size=page_size, total=total,
        has_more=page * page_size < total,
    )


@router.get("/users/{user_id}", response_model=schemas.AdminUserOut)
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    out = schemas.AdminUserOut.model_validate(user)
    out.posts_count = len(user.posts)
    return out


@router.post("/users/{user_id}/status", response_model=schemas.AdminUserOut)
def update_user_status(
    user_id: int,
    payload: schemas.StatusUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    if payload.status not in ("active", "suspended"):
        raise HTTPException(status_code=422, detail="status must be 'active' or 'suspended'")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == models.RoleEnum.admin:
        raise HTTPException(status_code=400, detail="Cannot change status of an admin account")

    user.status = payload.status
    db.commit()
    db.refresh(user)
    out = schemas.AdminUserOut.model_validate(user)
    out.posts_count = len(user.posts)
    return out


# --------------------------------------------------------------------------
# Posts
# --------------------------------------------------------------------------

@router.get("/posts", response_model=schemas.PaginatedAdminPosts)
def list_posts(
    post_type: Optional[str] = Query(None, alias="type", pattern="^(farmer|industry)$"),
    crop: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status", pattern="^(active|closed)$"),
    user_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    query = db.query(models.Post).options(joinedload(models.Post.owner))

    if post_type:
        query = query.filter(models.Post.role == post_type)
    if crop:
        query = query.filter(models.Post.crop_name.ilike(f"%{crop}%"))
    if status_filter:
        query = query.filter(models.Post.status == status_filter)
    if user_id:
        query = query.filter(models.Post.user_id == user_id)
    if search:
        like = f"%{search}%"
        query = query.join(models.User, models.Post.user_id == models.User.id).filter(
            or_(
                models.Post.title.ilike(like),
                models.Post.crop_name.ilike(like),
                models.Post.location.ilike(like),
                models.User.name.ilike(like),
            )
        )

    query = query.order_by(models.Post.created_at.desc())
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()

    items = [schemas.AdminPostOut.model_validate(p) for p in rows]
    return schemas.PaginatedAdminPosts(
        items=items, page=page, page_size=page_size, total=total,
        has_more=page * page_size < total,
    )


@router.get("/posts/{post_id}", response_model=schemas.AdminPostOut)
def get_post_detail(
    post_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    post = db.query(models.Post).options(joinedload(models.Post.owner)).filter(
        models.Post.id == post_id
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return schemas.AdminPostOut.model_validate(post)


@router.post("/posts/{post_id}/status", response_model=schemas.AdminPostOut)
def update_post_status(
    post_id: int,
    payload: schemas.StatusUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    if payload.status not in ("active", "closed"):
        raise HTTPException(status_code=422, detail="status must be 'active' or 'closed'")

    post = db.query(models.Post).options(joinedload(models.Post.owner)).filter(
        models.Post.id == post_id
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    post.status = payload.status
    db.commit()
    db.refresh(post)
    return schemas.AdminPostOut.model_validate(post)


@router.delete("/posts/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()
    return {"detail": "Post deleted"}


# --------------------------------------------------------------------------
# Notifications (admin broadcast + recent activity feed)
# --------------------------------------------------------------------------

@router.get("/notifications/recent")
def recent_notifications(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    rows = (
        db.query(models.Notification)
        .order_by(models.Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    result = []
    for n in rows:
        receiver = db.query(models.User).filter(models.User.id == n.receiver_id).first()
        result.append({
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "created_at": n.created_at,
            "receiver_name": receiver.name if receiver else None,
        })
    return result


@router.post("/notifications/broadcast", response_model=schemas.BroadcastResult)
def broadcast_notification(
    payload: schemas.BroadcastRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    if payload.audience == "all_farmers":
        recipients = db.query(models.User).filter(models.User.role == models.RoleEnum.farmer).all()
    elif payload.audience == "all_industries":
        recipients = db.query(models.User).filter(models.User.role == models.RoleEnum.industry).all()
    elif payload.audience == "selected":
        if not payload.user_ids:
            raise HTTPException(status_code=422, detail="user_ids is required when audience is 'selected'")
        recipients = db.query(models.User).filter(models.User.id.in_(payload.user_ids)).all()
    else:
        raise HTTPException(status_code=422, detail="Invalid audience")

    for r in recipients:
        db.add(models.Notification(
            receiver_id=r.id,
            title=payload.title,
            message=payload.message,
        ))
    db.commit()
    return schemas.BroadcastResult(sent_count=len(recipients))
