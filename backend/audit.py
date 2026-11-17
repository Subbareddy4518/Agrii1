"""
Audit logging service for administrator actions.
Maintains accountability and governance across all administrative interventions.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
import models


def record_admin_audit(
    db: Session,
    admin_id: int,
    action: str,
    target_type: str,
    target_id: Optional[str] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> models.AdminAuditLog:
    """
    Persists an immutable audit log entry for administrative activity.
    """
    audit_entry = models.AdminAuditLog(
        admin_id=admin_id,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        details=details,
        ip_address=ip_address,
        created_at=datetime.utcnow(),
    )
    db.add(audit_entry)
    return audit_entry
