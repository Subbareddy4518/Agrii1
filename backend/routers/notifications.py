"""Notification endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[schemas.NotificationOut])
def get_notifications(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return (
        db.query(models.Notification)
        .filter(models.Notification.receiver_id == user.id)
        .order_by(models.Notification.created_at.desc())
        .limit(100)
        .all()
    )


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    n = (
        db.query(models.Notification)
        .filter(models.Notification.id == notification_id, models.Notification.receiver_id == user.id)
        .first()
    )
    if n:
        n.is_read = True
        db.commit()
    return {"detail": "ok"}


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    db.query(models.Notification).filter(
        models.Notification.receiver_id == user.id, models.Notification.is_read == False  # noqa: E712
    ).update({"is_read": True})
    db.commit()
    return {"detail": "ok"}
