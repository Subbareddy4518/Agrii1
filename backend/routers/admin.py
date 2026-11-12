"""
Admin dashboard endpoints.

Every route in this router depends on `get_current_admin`, which re-verifies
the caller's role against the database on each request — the frontend's
notion of the user's role is never trusted for authorization.

Reuses the existing User/Post/Notification models and get_db/session setup
rather than introducing a parallel data layer.
"""
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_

import models
import schemas
from database import get_db
from auth import get_current_admin, hash_password, verify_password
from audit import record_admin_audit

router = APIRouter(prefix="/api/admin", tags=["admin"])


def mask_phone_number(mobile: Optional[str]) -> str:
    """
    Mask phone numbers by default for administrative privacy protection.
    e.g. 9876543210 -> 98765****0
    """
    if not mobile:
        return ""
    digits = "".join(filter(str.isdigit, str(mobile)))
    if len(digits) >= 10:
        return digits[:5] + "****" + digits[-1:]
    elif len(digits) > 4:
        return digits[:2] + "****" + digits[-1:]
    return "****"


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

    if role and isinstance(role, str):
        query = query.filter(models.User.role == role)
    if status_filter and isinstance(status_filter, str):
        query = query.filter(models.User.status == status_filter)
    if search and isinstance(search, str):
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
    page_val = int(page.default if hasattr(page, "default") else page)
    page_size_val = int(page_size.default if hasattr(page_size, "default") else page_size)

    query = _query_users(db, role, status_filter, search).order_by(models.User.created_at.desc())
    total = query.count()
    rows = query.offset((page_val - 1) * page_size_val).limit(page_size_val).all()

    items = []
    for u in rows:
        out = schemas.AdminUserOut.model_validate(u)
        out.posts_count = len(u.posts)
        out.is_verified = bool(u.is_verified)
        out.trust_score = int(u.trust_score if u.trust_score is not None else 100)
        out.status = u.status or "active"
        out.mobile_masked = mask_phone_number(u.mobile)
        out.mobile = mask_phone_number(u.mobile)
        items.append(out)

    return schemas.PaginatedAdminUsers(
        items=items, page=page_val, page_size=page_size_val, total=total,
        has_more=page_val * page_size_val < total,
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
    out.is_verified = bool(user.is_verified)
    out.trust_score = int(user.trust_score if user.trust_score is not None else 100)
    out.status = user.status or "active"
    out.mobile_masked = mask_phone_number(user.mobile)
    out.mobile = mask_phone_number(user.mobile)
    return out


@router.post("/users/{user_id}/reveal-mobile")
def reveal_user_mobile(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    """
    Controlled mobile unmasking endpoint for authorized administrators.
    Logs every access event into the immutable administrative audit log.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    record_admin_audit(
        db,
        admin_id=admin.id,
        action="reveal_mobile",
        target_type="user",
        target_id=str(user_id),
        details=f"Admin revealed mobile number for user '{user.name}' (ID: {user_id})"
    )
    db.commit()
    return {"user_id": user.id, "mobile": user.mobile}


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

    old_status = user.status
    user.status = payload.status
    action_type = "suspend_user" if payload.status == "suspended" else "activate_user"
    record_admin_audit(
        db,
        admin_id=admin.id,
        action=action_type,
        target_type="user",
        target_id=str(user_id),
        details=f"Account status changed from '{old_status}' to '{payload.status}' for user '{user.name}'"
    )
    db.commit()
    db.refresh(user)
    out = schemas.AdminUserOut.model_validate(user)
    out.posts_count = len(user.posts)
    out.is_verified = bool(user.is_verified)
    out.trust_score = int(user.trust_score if user.trust_score is not None else 100)
    out.status = user.status
    out.mobile_masked = mask_phone_number(user.mobile)
    out.mobile = mask_phone_number(user.mobile)
    return out


# --------------------------------------------------------------------------
# Posts
# --------------------------------------------------------------------------

@router.get("/posts", response_model=schemas.PaginatedAdminPosts)
def list_posts(
    post_type: Optional[str] = Query(None, alias="type", pattern="^(farmer|industry)$"),
    crop: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status", pattern="^(active|paused|sold|archived|closed)$"),
    user_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    query = db.query(models.Post).options(joinedload(models.Post.owner))

    if post_type and isinstance(post_type, str):
        query = query.filter(models.Post.role == post_type)
    if crop and isinstance(crop, str):
        query = query.filter(models.Post.crop_name.ilike(f"%{crop}%"))
    if status_filter and isinstance(status_filter, str):
        query = query.filter(models.Post.status == status_filter)
    if user_id and isinstance(user_id, int):
        query = query.filter(models.Post.user_id == user_id)
    if search and isinstance(search, str):
        like = f"%{search}%"
        query = query.join(models.User, models.Post.user_id == models.User.id).filter(
            or_(
                models.Post.title.ilike(like),
                models.Post.crop_name.ilike(like),
                models.Post.location.ilike(like),
                models.User.name.ilike(like),
            )
        )

    page_val = int(page.default if hasattr(page, "default") else page)
    page_size_val = int(page_size.default if hasattr(page_size, "default") else page_size)

    query = query.order_by(models.Post.created_at.desc())
    total = query.count()
    rows = query.offset((page_val - 1) * page_size_val).limit(page_size_val).all()

    items = [schemas.AdminPostOut.model_validate(p) for p in rows]
    return schemas.PaginatedAdminPosts(
        items=items, page=page_val, page_size=page_size_val, total=total,
        has_more=page_val * page_size_val < total,
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
    valid_statuses = ("active", "paused", "sold", "archived", "closed")
    new_status = payload.status.lower().strip()
    if new_status not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"status must be one of {valid_statuses}")

    post = db.query(models.Post).options(joinedload(models.Post.owner)).filter(
        models.Post.id == post_id
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    old_status = post.status
    if new_status != old_status:
        history = models.PostStatusHistory(
            post_id=post.id,
            changed_by_user_id=admin.id,
            from_status=old_status,
            to_status=new_status,
            notes="Status updated by admin",
        )
        db.add(history)
        post.status = new_status

        record_admin_audit(
            db,
            admin_id=admin.id,
            action="update_post_status",
            target_type="post",
            target_id=str(post_id),
            details=f"Status updated from '{old_status}' to '{new_status}' for post '{post.title}'"
        )

        # Notify post owner of administrative action
        if post.user_id != admin.id:
            db.add(models.Notification(
                receiver_id=post.user_id,
                title="Listing Status Updated",
                message=f"Your listing '{post.title}' status was updated to '{new_status}' by administration.",
            ))

    db.commit()
    db.refresh(post)
    return schemas.AdminPostOut.model_validate(post)


@router.delete("/posts/{post_id}")
def delete_post(
    post_id: int,
    hard_delete: bool = Query(False),
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    """
    Safer post deletion:
    By default, performs a recoverable soft-delete/archival preserving listing history and relations.
    Only permanently purges if hard_delete=True is explicitly specified.
    """
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if not hard_delete:
        old_status = post.status
        post.status = "archived"
        db.add(models.PostStatusHistory(
            post_id=post.id,
            changed_by_user_id=admin.id,
            from_status=old_status,
            to_status="archived",
            notes="Listing safely archived by administrator (recoverable).",
        ))
        record_admin_audit(
            db,
            admin_id=admin.id,
            action="archive_post",
            target_type="post",
            target_id=str(post_id),
            details=f"Safely archived listing '{post.title}' (previous status: '{old_status}')"
        )
        db.commit()
        return {"detail": "Post archived successfully (recoverable)", "status": "archived"}

    # Hard delete (irreversible)
    record_admin_audit(
        db,
        admin_id=admin.id,
        action="delete_post_permanent",
        target_type="post",
        target_id=str(post_id),
        details=f"Permanently purged listing '{post.title}'"
    )
    db.delete(post)
    db.commit()
    return {"detail": "Post deleted permanently"}


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
        db.query(models.Notification, models.User.name.label("receiver_name"))
        .outerjoin(models.User, models.Notification.receiver_id == models.User.id)
        .order_by(models.Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    result = []
    for notif, rx_name in rows:
        result.append({
            "id": notif.id,
            "title": notif.title,
            "message": notif.message,
            "is_read": notif.is_read,
            "created_at": notif.created_at,
            "receiver_name": rx_name,
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

    record_admin_audit(
        db,
        admin_id=admin.id,
        action="broadcast_notification",
        target_type="broadcast",
        target_id=payload.audience,
        details=f"Audience: {payload.audience}, Title: '{payload.title}', Dispatched: {len(recipients)}"
    )

    db.commit()
    return schemas.BroadcastResult(sent_count=len(recipients))


# --------------------------------------------------------------------------
# Administrative Audit Logs & Security Settings
# --------------------------------------------------------------------------

@router.get("/audit-logs", response_model=List[schemas.AdminAuditLogOut])
def list_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    action_filter: Optional[str] = Query(None, alias="action"),
    target_type: Optional[str] = Query(None, alias="target_type"),
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    """
    Admin-only: fetch recent immutable administrative audit records.
    """
    query = (
        db.query(models.AdminAuditLog, models.User.name.label("admin_name"))
        .outerjoin(models.User, models.AdminAuditLog.admin_id == models.User.id)
        .order_by(models.AdminAuditLog.created_at.desc())
    )
    if action_filter:
        query = query.filter(models.AdminAuditLog.action == action_filter.strip())
    if target_type:
        query = query.filter(models.AdminAuditLog.target_type == target_type.strip())

    rows = query.limit(limit).all()
    result = []
    for log, adm_name in rows:
        result.append(schemas.AdminAuditLogOut(
            id=log.id,
            admin_id=log.admin_id,
            admin_name=adm_name or "Administrator",
            action=log.action,
            target_type=log.target_type,
            target_id=log.target_id,
            details=log.details,
            ip_address=log.ip_address,
            created_at=log.created_at,
        ))
    return result


@router.post("/change-password")
def change_admin_password(
    payload: schemas.AdminPasswordChangeRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    """
    Admin-only: update administrator account password with verification.
    """
    if not verify_password(payload.current_password, admin.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    admin.hashed_password = hash_password(payload.new_password)
    record_admin_audit(
        db,
        admin_id=admin.id,
        action="change_password",
        target_type="admin",
        target_id=str(admin.id),
        details="Administrator updated account password successfully"
    )
    db.commit()
    return {"detail": "Password updated successfully"}
