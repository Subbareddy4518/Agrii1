"""
Reporting & Content Moderation Router for AgriConnect.

Allows users to report suspicious, inaccurate, or spam listings.
Preserves user safety, trust, and accountability.
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

import models
import schemas
from database import get_db
from auth import get_current_user, get_current_admin
from audit import record_admin_audit
from routers.admin import mask_phone_number

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _serialize_report(report: models.Report) -> schemas.ReportOut:
    post = report.post
    owner = post.owner if post else None
    reporter = report.reporter
    return schemas.ReportOut(
        id=report.id,
        post_id=report.post_id,
        reporter_id=report.reporter_id,
        reason=report.reason,
        details=report.details,
        status=report.status,
        resolution_action=report.resolution_action,
        resolution_notes=report.resolution_notes,
        resolved_by_id=report.resolved_by_id,
        resolved_at=report.resolved_at,
        created_at=report.created_at,
        post_title=post.title if post else None,
        post_crop_name=post.crop_name if post else None,
        post_role=post.role.value if post and hasattr(post.role, "value") else (str(post.role) if post else None),
        post_status=post.status if post else None,
        post_price=post.price if post else None,
        post_quantity=post.quantity if post else None,
        post_location=post.location if post else None,
        post_report_count=post.report_count if post else 0,
        post_owner_name=owner.name if owner else None,
        post_owner_mobile=mask_phone_number(owner.mobile) if owner else None,
        reporter_name=reporter.name if reporter else None,
    )


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

    # Auto-quarantine if listing receives 3 or more reports to protect farmers and buyers
    if post.report_count >= 3 and post.status == "active":
        post.status = "paused"
        db.add(models.PostStatusHistory(
            post_id=post.id,
            changed_by_user_id=user.id,
            from_status="active",
            to_status="paused",
            notes="Listing automatically paused pending admin review due to repeated community reports.",
        ))

    # Recalculate post owner's trust score reflecting community moderation reports
    if post.owner:
        import trust
        post.owner.trust_score = trust.calculate_trust_score(post.owner, db)

    db.commit()

    return {
        "status": "success",
        "message": "Thank you for reporting. Our moderation team will review this listing to maintain platform trust.",
    }


@router.get("", response_model=List[schemas.ReportOut])
def list_reports(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    """
    Admin-only: list all user reports with post metadata and filtering.
    """
    query = (
        db.query(models.Report)
        .options(
            joinedload(models.Report.post).joinedload(models.Post.owner),
            joinedload(models.Report.reporter),
        )
        .order_by(models.Report.created_at.desc())
    )

    if status_filter and isinstance(status_filter, str) and status_filter.lower() != "all":
        query = query.filter(models.Report.status == status_filter.lower().strip())

    reports = query.limit(100).all()
    return [_serialize_report(r) for r in reports]


@router.post("/{report_id}/resolve", response_model=schemas.ReportOut)
def resolve_report(
    report_id: int,
    payload: schemas.ReportResolutionRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    """
    Admin-only: resolve or dismiss a community report with moderation decision.
    Allowed actions:
      - dismiss: mark report dismissed; if post was quarantined, restores it to active
      - confirm_quarantine: keep post in paused/quarantined status
      - close_post: close listing due to policy violation
    """
    valid_actions = ("dismiss", "confirm_quarantine", "close_post")
    action = payload.action.lower().strip()
    if action not in valid_actions:
        raise HTTPException(
            status_code=422,
            detail=f"action must be one of {valid_actions}",
        )

    report = (
        db.query(models.Report)
        .options(
            joinedload(models.Report.post).joinedload(models.Post.owner),
            joinedload(models.Report.reporter),
        )
        .filter(models.Report.id == report_id)
        .first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    post = report.post
    now = datetime.utcnow()

    if action == "dismiss":
        report.status = "dismissed"
        report.resolution_action = "dismiss"
        report.resolution_notes = payload.notes
        report.resolved_by_id = admin.id
        report.resolved_at = now

        # Check if there are other pending unresolved reports on this post
        other_pending_reports = 0
        if post:
            other_pending_reports = (
                db.query(models.Report)
                .filter(
                    models.Report.post_id == post.id,
                    models.Report.id != report.id,
                    models.Report.status == "pending"
                )
                .count()
            )

        restored = False
        target_status = None
        # Only restore previous listing status if NO other pending reports exist
        if post and other_pending_reports == 0:
            if post.status == "paused":
                # Check history to find status prior to quarantine
                last_quarantine = (
                    db.query(models.PostStatusHistory)
                    .filter(
                        models.PostStatusHistory.post_id == post.id,
                        models.PostStatusHistory.to_status == "paused"
                    )
                    .order_by(models.PostStatusHistory.created_at.desc())
                    .first()
                )
                target_status = (
                    last_quarantine.from_status
                    if last_quarantine and last_quarantine.from_status in ("active", "draft")
                    else "active"
                )
                post.status = target_status
                post.report_count = max(0, (post.report_count or 1) - 1)
                db.add(models.PostStatusHistory(
                    post_id=post.id,
                    changed_by_user_id=admin.id,
                    from_status="paused",
                    to_status=target_status,
                    notes=f"Listing restored by admin after dismissing all pending reports (report #{report.id}): {payload.notes or 'Report dismissed'}",
                ))
                restored = True
                if post.owner:
                    import trust
                    post.owner.trust_score = trust.calculate_trust_score(post.owner, db)
            else:
                post.report_count = max(0, (post.report_count or 1) - 1)
        elif post and other_pending_reports > 0:
            post.report_count = max(0, (post.report_count or 1) - 1)

        details_msg = (
            f"Dismissed report #{report.id} on post ID {report.post_id}. "
            + (f"Listing restored from 'paused' to '{target_status}'." if restored else
               (f"Listing remains quarantined ('paused') because {other_pending_reports} other pending report(s) exist." if other_pending_reports > 0 else "Listing status unchanged."))
            + (f" Notes: {payload.notes}" if payload.notes else "")
        )

        record_admin_audit(
            db,
            admin_id=admin.id,
            action="resolve_report",
            target_type="report",
            target_id=str(report.id),
            details=details_msg,
        )

    elif action == "confirm_quarantine":
        report.status = "resolved"
        report.resolution_action = "confirm_quarantine"
        report.resolution_notes = payload.notes
        report.resolved_by_id = admin.id
        report.resolved_at = now

        if post and post.status != "paused":
            old_status = post.status
            post.status = "paused"
            db.add(models.PostStatusHistory(
                post_id=post.id,
                changed_by_user_id=admin.id,
                from_status=old_status,
                to_status="paused",
                notes=f"Listing quarantined by admin on report #{report.id}: {payload.notes or 'Violation confirmed'}",
            ))

        record_admin_audit(
            db,
            admin_id=admin.id,
            action="resolve_report",
            target_type="report",
            target_id=str(report.id),
            details=f"Confirmed quarantine for post ID {report.post_id}. Notes: {payload.notes or 'None'}",
        )

    elif action == "close_post":
        report.status = "resolved"
        report.resolution_action = "close_post"
        report.resolution_notes = payload.notes
        report.resolved_by_id = admin.id
        report.resolved_at = now

        if post:
            old_status = post.status
            post.status = "closed"
            db.add(models.PostStatusHistory(
                post_id=post.id,
                changed_by_user_id=admin.id,
                from_status=old_status,
                to_status="closed",
                notes=f"Listing closed by admin on report #{report.id}: {payload.notes or 'Closed for policy violation'}",
            ))
            # Notify post owner
            db.add(models.Notification(
                receiver_id=post.user_id,
                title="Listing Closed by Administration",
                message=f"Your listing '{post.title}' was closed by moderation: {payload.notes or 'Listing violated platform safety guidelines.'}",
            ))

        record_admin_audit(
            db,
            admin_id=admin.id,
            action="resolve_report",
            target_type="report",
            target_id=str(report.id),
            details=f"Closed post ID {report.post_id} on report #{report.id}. Notes: {payload.notes or 'None'}",
        )

    # Recalculate trust score if post owner exists
    if post and post.owner:
        import trust
        post.owner.trust_score = trust.calculate_trust_score(post.owner, db)

    db.commit()
    db.refresh(report)
    return _serialize_report(report)
