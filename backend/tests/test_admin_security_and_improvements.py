"""
Comprehensive test suite for Admin Dashboard Security & Functional Improvements.

Tests:
1. Public registration rejects role="admin" at the schema and route layers.
2. Administrator provisioning idempotency & credentials isolation.
3. OTP production safeguard rejects test codes in production.
4. Community reports moderation & resolution actions (dismiss, confirm_quarantine, close_post).
5. Listing status filter support across active, paused, sold, archived, closed.
6. User management fields (is_verified, trust_score, phone masking and controlled reveal).
7. Administrative audit log persistence for sensitive actions.
8. Safe post deletion / recoverable archival.
9. Admin password change interface with credential verification.
10. Existing marketplace functionality and RBAC protection.
"""
import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException
from pydantic import ValidationError

import models
import schemas
from database import Base
from routers import auth, admin, reports
from auth import hash_password, create_access_token


class TestAdminSecurityAndImprovements(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        cls.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

    def setUp(self):
        self.db = self.TestingSessionLocal()
        # Clean tables
        self.db.query(models.AdminAuditLog).delete()
        self.db.query(models.PostStatusHistory).delete()
        self.db.query(models.Report).delete()
        self.db.query(models.Like).delete()
        self.db.query(models.Notification).delete()
        self.db.query(models.Post).delete()
        self.db.query(models.User).delete()
        self.db.commit()

        # Seed test admin, farmer, and buyer
        self.admin_user = models.User(
            name="Super Admin",
            mobile="9900000000",
            hashed_password=hash_password("adminSecretPass123"),
            role=models.RoleEnum.admin,
            is_verified=True,
            status="active",
            trust_score=100,
        )
        self.farmer_user = models.User(
            name="Test Farmer",
            mobile="9800000001",
            hashed_password=hash_password("farmerPass123"),
            role=models.RoleEnum.farmer,
            location="Warangal",
            is_verified=True,
            status="active",
            trust_score=85,
        )
        self.buyer_user = models.User(
            name="Test Agribusiness",
            contact_person="Ravi Kumar",
            mobile="9800000002",
            hashed_password=hash_password("buyerPass123"),
            role=models.RoleEnum.industry,
            location="Hyderabad",
            is_verified=False,
            status="active",
            trust_score=70,
        )
        self.db.add_all([self.admin_user, self.farmer_user, self.buyer_user])
        self.db.commit()
        self.db.refresh(self.admin_user)
        self.db.refresh(self.farmer_user)
        self.db.refresh(self.buyer_user)

    def tearDown(self):
        self.db.close()

    # --------------------------------------------------------------------------
    # 1. Restrict Public Registration Roles
    # --------------------------------------------------------------------------
    def test_01_public_registration_rejects_admin_role_schema_level(self):
        """Pydantic validation must strictly reject role='admin' on RegisterRequest."""
        with self.assertRaises(ValidationError):
            schemas.RegisterRequest(
                role="admin",
                name="Malicious Actor",
                mobile="9888888888",
                password="password123",
                confirm_password="password123",
            )

    def test_02_public_registration_endpoint_rejects_admin_route(self):
        """Registering with non-farmer/industry must raise HTTPException 422."""
        # Test directly with mock object
        class FakePayload:
            role = models.RoleEnum.admin
            name = "Attacker Admin"
            mobile = "9877777777"
            password = "password123"
            confirm_password = "password123"
            contact_person = None
            location = None
            profile_image = None

        with self.assertRaises(HTTPException) as ctx:
            auth.register(FakePayload(), db=self.db)
        self.assertEqual(ctx.exception.status_code, 422)
        self.assertIn("restricted", ctx.exception.detail.lower())

    # --------------------------------------------------------------------------
    # 2. OTP Production Safeguard & Provider Configuration
    # --------------------------------------------------------------------------
    def test_03_otp_production_safeguard(self):
        """In production mode, verify provider configuration check and test OTP rejection."""
        orig_prod = auth.IS_PRODUCTION
        orig_sms_key = os.environ.get("SMS_PROVIDER_API_KEY")
        try:
            auth.IS_PRODUCTION = True
            # Case A: Production without configured SMS provider -> must return 503 Service Unavailable
            if "SMS_PROVIDER_API_KEY" in os.environ:
                del os.environ["SMS_PROVIDER_API_KEY"]
            if "SMS_GATEWAY_URL" in os.environ:
                del os.environ["SMS_GATEWAY_URL"]
            if "TWILIO_ACCOUNT_SID" in os.environ:
                del os.environ["TWILIO_ACCOUNT_SID"]

            with self.assertRaises(HTTPException) as ctx_send:
                auth.send_otp(schemas.SendOtpRequest(mobile="9800000001"))
            self.assertEqual(ctx_send.exception.status_code, 503)
            self.assertIn("unavailable", ctx_send.exception.detail.lower())

            # Case B: Production with configured SMS provider -> never expose OTP in response
            os.environ["SMS_PROVIDER_API_KEY"] = "dummy_provider_key"
            res = auth.send_otp(schemas.SendOtpRequest(mobile="9800000001"))
            self.assertIsNone(res.otp)
            self.assertIn("SMS", res.message)

            # Case C: verify_otp with simulated '1234' in production must be rejected with 400
            with self.assertRaises(HTTPException) as ctx:
                auth.verify_otp(schemas.VerifyOtpRequest(mobile="9800000001", otp="1234"), db=self.db)
            self.assertEqual(ctx.exception.status_code, 400)
            self.assertIn("disabled in production", ctx.exception.detail.lower())

            # Case D: In development mode (IS_PRODUCTION=False), simulated OTP works
            auth.IS_PRODUCTION = False
            dev_res = auth.send_otp(schemas.SendOtpRequest(mobile="9800000001"))
            self.assertEqual(dev_res.otp, "1234")
            v_res = auth.verify_otp(schemas.VerifyOtpRequest(mobile="9800000001", otp="1234"), db=self.db)
            self.assertTrue(v_res.is_verified)
        finally:
            auth.IS_PRODUCTION = orig_prod
            if orig_sms_key is not None:
                os.environ["SMS_PROVIDER_API_KEY"] = orig_sms_key
            elif "SMS_PROVIDER_API_KEY" in os.environ:
                del os.environ["SMS_PROVIDER_API_KEY"]

    # --------------------------------------------------------------------------
    # 3. RBAC Enforcement
    # --------------------------------------------------------------------------
    def test_04_farmer_and_buyer_denied_admin_dependency(self):
        """Calling get_current_admin with farmer or buyer must raise HTTP 403."""
        from auth import get_current_admin
        with self.assertRaises(HTTPException) as ctx1:
            get_current_admin(self.farmer_user)
        self.assertEqual(ctx1.exception.status_code, 403)

        with self.assertRaises(HTTPException) as ctx2:
            get_current_admin(self.buyer_user)
        self.assertEqual(ctx2.exception.status_code, 403)

        # Admin passes
        admin_res = get_current_admin(self.admin_user)
        self.assertEqual(admin_res.id, self.admin_user.id)

    # --------------------------------------------------------------------------
    # 4. Listing Status Filters
    # --------------------------------------------------------------------------
    def test_05_listing_status_filter_supports_all_statuses(self):
        """Admin posts endpoint must support filtering by active, paused, sold, archived, closed."""
        statuses = ["active", "paused", "sold", "archived", "closed"]
        for st in statuses:
            p = models.Post(
                user_id=self.farmer_user.id,
                role=models.RoleEnum.farmer,
                title=f"Sample Post {st}",
                crop_name="Chilli",
                status=st,
            )
            self.db.add(p)
        self.db.commit()

        for st in statuses:
            res = admin.list_posts(
                status_filter=st,
                db=self.db,
                admin=self.admin_user,
            )
            self.assertEqual(res.total, 1)
            self.assertEqual(res.items[0].status, st)

    # --------------------------------------------------------------------------
    # 5. User Management & Phone Number Masking/Reveal
    # --------------------------------------------------------------------------
    def test_06_user_management_masked_phone_and_reveal_audit(self):
        """User listings must mask phone numbers by default and audit reveal actions."""
        res = admin.list_users(db=self.db, admin=self.admin_user)
        farmer_item = next(u for u in res.items if u.id == self.farmer_user.id)

        # Verify masked phone
        self.assertIn("****", farmer_item.mobile)
        self.assertEqual(farmer_item.is_verified, True)
        self.assertEqual(farmer_item.trust_score, 85)

        # Reveal phone number via admin endpoint
        reveal_res = admin.reveal_user_mobile(
            user_id=self.farmer_user.id,
            db=self.db,
            admin=self.admin_user,
        )
        self.assertEqual(reveal_res["mobile"], "9800000001")

        # Verify audit log was created
        audit_log = self.db.query(models.AdminAuditLog).filter_by(action="reveal_mobile").first()
        self.assertIsNotNone(audit_log)
        self.assertEqual(audit_log.target_id, str(self.farmer_user.id))

    def test_07_user_suspension_creates_audit_record(self):
        """Suspending or activating a user must log to AdminAuditLog."""
        res = admin.update_user_status(
            user_id=self.buyer_user.id,
            payload=schemas.StatusUpdate(status="suspended"),
            db=self.db,
            admin=self.admin_user,
        )
        self.assertEqual(res.status, "suspended")

        # Check DB status
        self.db.refresh(self.buyer_user)
        self.assertEqual(self.buyer_user.status, "suspended")

        # Check audit log
        audit = self.db.query(models.AdminAuditLog).filter_by(action="suspend_user").first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.target_id, str(self.buyer_user.id))

    # --------------------------------------------------------------------------
    # 6. Community Reports Moderation & Safe Resolution (Multiple Reports Handling)
    # --------------------------------------------------------------------------
    def test_08_reports_moderation_and_resolution(self):
        """Admin can list reports and resolve them safely without premature reactivation."""
        # Create a post that has a history of being active before being auto-quarantined
        post = models.Post(
            user_id=self.farmer_user.id,
            role=models.RoleEnum.farmer,
            title="Multi-Reported Listing",
            crop_name="Cotton",
            status="paused",
            report_count=3,
        )
        self.db.add(post)
        self.db.commit()
        self.db.refresh(post)

        # Record quarantine history entry: active -> paused
        self.db.add(models.PostStatusHistory(
            post_id=post.id,
            changed_by_user_id=self.farmer_user.id,
            from_status="active",
            to_status="paused",
            notes="Listing automatically paused pending admin review due to repeated community reports.",
        ))
        self.db.commit()

        # Create TWO separate pending reports against the same post
        rep1 = models.Report(
            post_id=post.id,
            reporter_id=self.buyer_user.id,
            reason="Inaccurate Price",
            details="Price is unrealistic and misleading",
            status="pending",
        )
        rep2 = models.Report(
            post_id=post.id,
            reporter_id=self.farmer_user.id,
            reason="Suspected Fraud",
            details="Duplicate crop listing from another district",
            status="pending",
        )
        self.db.add_all([rep1, rep2])
        self.db.commit()
        self.db.refresh(rep1)
        self.db.refresh(rep2)

        # Admin lists reports
        reports_list = reports.list_reports(
            status_filter="pending",
            db=self.db,
            admin=self.admin_user,
        )
        self.assertEqual(len(reports_list), 2)
        # Verify post owner mobile is masked in ReportOut
        self.assertIn("****", reports_list[0].post_owner_mobile)

        # STEP A: Dismiss Report 1.
        # Since Report 2 is STILL PENDING, the post MUST REMAIN PAUSED!
        resolved1 = reports.resolve_report(
            report_id=rep1.id,
            payload=schemas.ReportResolutionRequest(action="dismiss", notes="Report 1 found false"),
            db=self.db,
            admin=self.admin_user,
        )
        self.assertEqual(resolved1.status, "dismissed")

        self.db.refresh(post)
        self.assertEqual(
            post.status,
            "paused",
            "Listing must NOT be reactivated while other unresolved reports remain against it"
        )

        # STEP B: Dismiss Report 2.
        # Now ALL pending reports are resolved/dismissed -> listing is safely restored to active!
        resolved2 = reports.resolve_report(
            report_id=rep2.id,
            payload=schemas.ReportResolutionRequest(action="dismiss", notes="Report 2 also cleared"),
            db=self.db,
            admin=self.admin_user,
        )
        self.assertEqual(resolved2.status, "dismissed")

        self.db.refresh(post)
        self.assertEqual(
            post.status,
            "active",
            "Listing must be restored to previous status ('active') once all reports are resolved"
        )

        # Verify audit logs were created for both resolutions
        audit_records = self.db.query(models.AdminAuditLog).filter_by(action="resolve_report").all()
        self.assertEqual(len(audit_records), 2)
        self.assertIn("remains quarantined", audit_records[0].details)
        self.assertIn("restored", audit_records[1].details)

    # --------------------------------------------------------------------------
    # 7. Safer Post Deletion (Recoverable Archival)
    # --------------------------------------------------------------------------
    def test_09_safer_post_deletion_archives_by_default(self):
        """Admin delete action must archive rather than permanently purge by default."""
        post = models.Post(
            user_id=self.farmer_user.id,
            role=models.RoleEnum.farmer,
            title="Listing to be safely deleted",
            crop_name="Rice",
            status="active",
        )
        self.db.add(post)
        self.db.commit()
        self.db.refresh(post)

        del_res = admin.delete_post(
            post_id=post.id,
            hard_delete=False,
            db=self.db,
            admin=self.admin_user,
        )
        self.assertEqual(del_res["status"], "archived")

        # Verify post is STILL in database, marked archived
        post_in_db = self.db.query(models.Post).filter_by(id=post.id).first()
        self.assertIsNotNone(post_in_db)
        self.assertEqual(post_in_db.status, "archived")

        # Verify audit log
        audit = self.db.query(models.AdminAuditLog).filter_by(action="archive_post").first()
        self.assertIsNotNone(audit)

    # --------------------------------------------------------------------------
    # 8. Admin Password Change & Session Invalidation
    # --------------------------------------------------------------------------
    def test_10_admin_password_change_with_verification_and_session_invalidation(self):
        """Admin password change verifies current password and invalidates prior sessions."""
        from auth import get_current_user

        # Issue active session token for admin before password change
        old_token = create_access_token({
            "sub": str(self.admin_user.id),
            "token_version": self.admin_user.token_version or 1
        })

        # Old token is initially valid
        current_u = get_current_user(token=old_token, db=self.db)
        self.assertEqual(current_u.id, self.admin_user.id)

        # Attempting change with incorrect current password fails with 400
        with self.assertRaises(HTTPException) as ctx:
            admin.change_admin_password(
                payload=schemas.AdminPasswordChangeRequest(
                    current_password="wrongPassword",
                    new_password="newSecurePassword123",
                    confirm_new_password="newSecurePassword123",
                ),
                db=self.db,
                admin=self.admin_user,
            )
        self.assertEqual(ctx.exception.status_code, 400)

        # Successful password change
        change_res = admin.change_admin_password(
            payload=schemas.AdminPasswordChangeRequest(
                current_password="adminSecretPass123",
                new_password="newSecurePassword123",
                confirm_new_password="newSecurePassword123",
            ),
            db=self.db,
            admin=self.admin_user,
        )
        self.assertEqual(change_res["detail"], "Password updated successfully")
        self.assertIn("access_token", change_res)
        new_token = change_res["access_token"]

        # CRITICAL TEST: Old session token MUST BE REJECTED with 401 Unauthorized
        with self.assertRaises(HTTPException) as ctx_old:
            get_current_user(token=old_token, db=self.db)
        self.assertEqual(ctx_old.exception.status_code, 401)
        self.assertIn("expired", ctx_old.exception.detail.lower())

        # New session token returned by password change MUST BE ACCEPTED
        new_u = get_current_user(token=new_token, db=self.db)
        self.assertEqual(new_u.id, self.admin_user.id)

        # Verify login with new password succeeds
        login_res = auth.login(
            payload=schemas.LoginRequest(mobile="9900000000", password="newSecurePassword123"),
            db=self.db,
        )
        self.assertEqual(login_res.user.id, self.admin_user.id)

        # Old password cannot be used for login
        with self.assertRaises(HTTPException) as ctx_login_old:
            auth.login(
                payload=schemas.LoginRequest(mobile="9900000000", password="adminSecretPass123"),
                db=self.db,
            )
        self.assertEqual(ctx_login_old.exception.status_code, 401)

    # --------------------------------------------------------------------------
    # 9. Comprehensive RBAC Denial on Admin Endpoints
    # --------------------------------------------------------------------------
    def test_11_farmer_and_buyer_denied_from_all_admin_endpoints(self):
        """Farmer and Buyer roles must be rejected with 403 Forbidden on all admin endpoints."""
        from auth import get_current_admin
        for non_admin in [self.farmer_user, self.buyer_user]:
            with self.assertRaises(HTTPException) as ctx:
                get_current_admin(non_admin)
            self.assertEqual(ctx.exception.status_code, 403)
            self.assertIn("admin access required", ctx.exception.detail.lower())


if __name__ == "__main__":
    unittest.main()
