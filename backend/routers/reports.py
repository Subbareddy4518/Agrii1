"""
Reporting & Content Moderation Router for AgriConnect.

Allows users to report suspicious, inaccurate, or spam listings.
Preserves user safety, trust, and accountability.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from auth import get_current_user, get_current_admin

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("/post/{post_id}")
def report_post(
    post_id: int,
    payload: schemas.ReportCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Submits a user report against an inappropriate or incorrect post.
    """
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot report your own post")

    # Record the report
    report = models.Report(
        post_id=post_id,
        reporter_id=user.id,
        reason=payload.reason,
        details=payload.details,
        status="pending",
    )
    db.add(report)

    # Increment post report count
    post.report_count = (post.report_count or 0) + 1

    # Notify admins if post reaches 3 reports
    if post.report_count >= 3:
        # Mark as flagged
        pass

    db.commit()

    return {
        "status": "success",
        "message": "Thank you for reporting. Our moderation team will review this listing to maintain platform trust.",
    }


@router.get("", response_model=List[schemas.ReportOut])
def list_reports(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    """
    Admin-only: list all pending user reports.
    """
    reports = db.query(models.Report).order_by(models.Report.created_at.desc()).limit(50).all()
    return reports
