"""
Unit and integration tests for PostgreSQL/database connection resilience,
pool_pre_ping, pool_recycle, connection parameters, session rollback,
and connection disposal after failures.
"""
import os
import unittest
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import OperationalError, DBAPIError

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import (
    normalize_database_url,
    get_engine_kwargs,
    get_db,
    reset_db_connections,
    engine as app_engine,
)


class TestDatabaseConnectionResilience(unittest.TestCase):
    """
    Test suite for database connection reliability, pool recycling,
    pre-ping validation, and session failure recovery.
    """

    def test_01_normalize_database_url(self):
        """Verify URL normalization from legacy postgres:// to postgresql://."""
        legacy_url = "postgres://user:secret@render-db-host.com:5432/agriconnect"
        normalized = normalize_database_url(legacy_url)
        self.assertTrue(normalized.startswith("postgresql://"))
        self.assertIn("render-db-host.com:5432/agriconnect", normalized)

        # Standard postgresql:// or sqlite:// URLs should remain unchanged
        pg_url = "postgresql://user:secret@host:5432/agriconnect"
        self.assertEqual(normalize_database_url(pg_url), pg_url)

        sqlite_url = "sqlite:///./agriconnect.db"
        self.assertEqual(normalize_database_url(sqlite_url), sqlite_url)

        self.assertIsNone(normalize_database_url(None))

    def test_02_get_engine_kwargs_sqlite(self):
        """Verify engine kwargs for SQLite have pool_pre_ping and check_same_thread."""
        kwargs = get_engine_kwargs("sqlite:///./agriconnect.db")
        self.assertTrue(kwargs.get("pool_pre_ping"))
        self.assertGreater(kwargs.get("pool_recycle", 0), 0)
        self.assertIn("connect_args", kwargs)
        self.assertFalse(kwargs["connect_args"].get("check_same_thread"))
        # SQLite should not have pool_size/max_overflow that breaks SingletonThreadPool
        self.assertNotIn("pool_size", kwargs)
        self.assertNotIn("max_overflow", kwargs)

    def test_03_get_engine_kwargs_postgresql(self):
        """Verify engine kwargs for PostgreSQL include pool_pre_ping, keepalives, and timeouts."""
        kwargs = get_engine_kwargs("postgresql://user:pass@host:5432/db")
        self.assertTrue(kwargs.get("pool_pre_ping"))
        self.assertGreaterEqual(kwargs.get("pool_recycle", 0), 60)
        self.assertGreater(kwargs.get("pool_size", 0), 0)
        self.assertGreater(kwargs.get("max_overflow", 0), 0)
        self.assertGreater(kwargs.get("pool_timeout", 0), 0)

        # Check connect_args
        connect_args = kwargs.get("connect_args", {})
        self.assertIn("connect_timeout", connect_args)
        self.assertGreater(connect_args["connect_timeout"], 0)
        self.assertEqual(connect_args.get("keepalives"), 1)
        self.assertGreater(connect_args.get("keepalives_idle", 0), 0)
        self.assertGreater(connect_args.get("keepalives_interval", 0), 0)
        self.assertGreater(connect_args.get("keepalives_count", 0), 0)

    def test_04_application_engine_has_pre_ping_and_recycle(self):
        """Verify the global application engine has pool_pre_ping and pool_recycle enabled."""
        pool = app_engine.pool
        self.assertTrue(getattr(pool, "_pre_ping", False))
        self.assertGreater(getattr(pool, "_recycle", -1), 0)

    def test_05_get_db_normal_lifecycle(self):
        """Verify get_db dependency yields a healthy session and cleanly closes it."""
        gen = get_db()
        db = next(gen)
        self.assertIsInstance(db, Session)
        # Verify query runs
        result = db.execute(text("SELECT 1")).scalar()
        self.assertEqual(result, 1)

        # Complete generator (simulate FastAPI finishing request)
        try:
            next(gen)
        except StopIteration:
            pass

    def test_06_get_db_session_rollback_on_app_exception(self):
        """Verify get_db rolls back transactions when an unhandled exception occurs."""
        mock_session = MagicMock(spec=Session)
        with patch("database.SessionLocal", return_value=mock_session):
            gen = get_db()
            db = next(gen)

            with self.assertRaises(ValueError):
                gen.throw(ValueError("Route processing failed"))

            mock_session.rollback.assert_called_once()
            mock_session.close.assert_called_once()

    def test_07_get_db_session_invalidation_on_operational_error(self):
        """
        Verify get_db invalidates the session on OperationalError / DBAPIError,
        preventing dead/broken connections from returning to the connection pool.
        """
        mock_session = MagicMock(spec=Session)
        with patch("database.SessionLocal", return_value=mock_session):
            gen = get_db()
            db = next(gen)

            op_err = OperationalError("SELECT 1", {}, Exception("SSL connection has been closed unexpectedly"))
            with self.assertRaises(OperationalError):
                gen.throw(op_err)

            # Both rollback and invalidate should have been called
            mock_session.rollback.assert_called()
            mock_session.invalidate.assert_called_once()
            mock_session.close.assert_called_once()

    def test_08_stale_connection_recovery_with_pre_ping(self):
        """
        Verify that when an existing pooled connection is abruptly closed,
        pool_pre_ping automatically catches the disconnect and reconnects transparently.
        """
        test_engine = create_engine(
            "sqlite://",
            pool_pre_ping=True,
            pool_recycle=300
        )
        TestSession = sessionmaker(bind=test_engine)

        # 1. Warm up connection pool
        sess1 = TestSession()
        res1 = sess1.execute(text("SELECT 42")).scalar()
        self.assertEqual(res1, 42)
        sess1.close()

        # 2. Check out a connection and simulate an unexpected connection termination
        raw_conn = test_engine.pool.connect()
        dbapi_conn = raw_conn.dbapi_connection
        # Abruptly close the underlying database socket/handle
        dbapi_conn.close()
        # Return broken connection fairy to pool
        try:
            raw_conn.close()
        except Exception:
            pass

        # 3. With pool_pre_ping=True, next checkout must detect the dead connection,
        # evict it, establish a new connection, and succeed without crashing.
        sess2 = TestSession()
        res2 = sess2.execute(text("SELECT 99")).scalar()
        self.assertEqual(res2, 99)
        sess2.close()

    def test_09_reset_db_connections_disposes_engine_pool(self):
        """Verify reset_db_connections safely disposes engine pool without breaking future queries."""
        # Run query before disposal
        gen = get_db()
        db = next(gen)
        db.execute(text("SELECT 1"))
        try:
            next(gen)
        except StopIteration:
            pass

        # Reset connections
        reset_db_connections()

        # Run query after disposal - should succeed immediately with fresh connection
        gen2 = get_db()
        db2 = next(gen2)
        val = db2.execute(text("SELECT 100")).scalar()
        self.assertEqual(val, 100)
        try:
            next(gen2)
        except StopIteration:
            pass

    def test_10_registration_workflow_with_session_and_pool_recovery(self):
        """
        Verify that registration workflow recovers safely after connection interruptions
        and session invalidation.
        """
        import tempfile
        from database import Base
        import models
        import schemas
        from routers import auth

        tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        tmp_path = tmp.name
        tmp.close()

        try:
            # Create isolated test engine with pool_pre_ping and tables
            test_engine = create_engine(
                f"sqlite:///{tmp_path}",
                pool_pre_ping=True,
                pool_recycle=300
            )
            Base.metadata.create_all(bind=test_engine)
            TestSession = sessionmaker(bind=test_engine)

            # 1. Successful first registration
            db1 = TestSession()
            req1 = schemas.RegisterRequest(
                name="Ramesh Farmer",
                mobile="9876543210",
                password="secure_password_123",
                confirm_password="secure_password_123",
                role=schemas.RoleEnum.farmer,
                location="Warangal, Telangana"
            )
            resp1 = auth.register(req1, db=db1)
            self.assertIsNotNone(resp1.access_token)
            self.assertEqual(resp1.user.mobile, "9876543210")
            db1.close()

            # 2. Simulate connection interruption on the pool
            raw = test_engine.pool.connect()
            raw.dbapi_connection.close()
            try:
                raw.close()
            except Exception:
                pass

            # 3. Subsequent registration with fresh session - pool_pre_ping transparently recovers
            db2 = TestSession()
            req2 = schemas.RegisterRequest(
                name="Suresh Buyer",
                mobile="9876543211",
                password="secure_password_456",
                confirm_password="secure_password_456",
                role=schemas.RoleEnum.industry,
                contact_person="Suresh",
                location="Hyderabad, Telangana"
            )
            resp2 = auth.register(req2, db=db2)
            self.assertIsNotNone(resp2.access_token)
            self.assertEqual(resp2.user.mobile, "9876543211")
            db2.close()

            # 4. Verify duplicate registration check also succeeds on recovered pool
            db3 = TestSession()
            from fastapi import HTTPException
            with self.assertRaises(HTTPException) as ctx:
                auth.register(req1, db=db3)
            self.assertEqual(ctx.exception.status_code, 400)
            self.assertIn("already registered", ctx.exception.detail)
            db3.close()

            test_engine.dispose()
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass


if __name__ == "__main__":
    unittest.main()
