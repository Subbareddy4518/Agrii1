import os
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError, DBAPIError
from sqlalchemy.orm import sessionmaker, declarative_base


# ============================================================
# DATABASE CONFIGURATION
# ============================================================

def normalize_database_url(url: str) -> str:
    """
    Ensure the database URL uses the standard dialect prefix required by modern SQLAlchemy.
    Normalizes legacy 'postgres://' (common on Render and Heroku) to 'postgresql://'.
    """
    if url and url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


def get_engine_kwargs(url: str) -> dict:
    """
    Build connection pool resilience and timeout settings appropriate for the database provider.

    - pool_pre_ping=True: Emits a ping (SELECT 1) upon checkout, detecting dropped/stale
      SSL connections and transparently reconnecting before application queries execute.
    - pool_recycle: Proactively recycles connections (default 300s / 5 min) before cloud
      proxies or PostgreSQL server idle timeouts terminate idle sockets.
    - connect_timeout: Fails fast rather than blocking indefinitely if the host is unreachable.
    - keepalives: Keeps idle TCP connections alive across cloud NATs and load balancers.
    """
    kwargs = {
        "pool_pre_ping": True,
        "pool_recycle": int(os.getenv("DB_POOL_RECYCLE", "300")),
    }

    if url.startswith("sqlite"):
        kwargs["connect_args"] = {
            "check_same_thread": False
        }
    else:
        # PostgreSQL / remote provider settings
        kwargs.update({
            "pool_size": int(os.getenv("DB_POOL_SIZE", "5")),
            "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "10")),
            "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT", "30")),
            "connect_args": {
                "connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT", "10")),
                "keepalives": 1,
                "keepalives_idle": 30,
                "keepalives_interval": 10,
                "keepalives_count": 5,
            }
        })

    return kwargs


RAW_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./agriconnect.db"
)
DATABASE_URL = normalize_database_url(RAW_DATABASE_URL)

engine = create_engine(
    DATABASE_URL,
    **get_engine_kwargs(DATABASE_URL)
)


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


Base = declarative_base()


# ============================================================
# DATABASE MIGRATIONS
# ============================================================

def run_migrations():
    """
    Apply safe, additive database migrations.

    Handles:

    1. PostgreSQL:
       Adds 'admin' to the existing roleenum if it does not exist.

    2. Users table:
       Adds the 'status' column if it does not exist.

    3. Posts table:
       Adds the 'status' column if it does not exist.

    The migrations are safe to run every time the application starts.
    Existing data and tables are not deleted or recreated.
    """

    from sqlalchemy import text, inspect

    # --------------------------------------------------------
    # Inspect current database
    # --------------------------------------------------------

    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()


    # ========================================================
    # 1. POSTGRESQL ROLE ENUM MIGRATION
    # ========================================================

    if engine.dialect.name == "postgresql":

        with engine.begin() as conn:

            # The existing Render PostgreSQL database contains
            # an enum called 'roleenum'.
            #
            # Older database versions may not contain the
            # 'admin' value even though the current SQLAlchemy
            # model expects it.
            #
            # IF NOT EXISTS makes this safe to run repeatedly.

            conn.execute(
                text(
                    "ALTER TYPE roleenum "
                    "ADD VALUE IF NOT EXISTS 'admin'"
                )
            )


    # ========================================================
    # Re-inspect tables after the enum migration
    # ========================================================

    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()


    # ========================================================
    # 2. USERS MIGRATIONS
    # ========================================================

    if "users" in existing_tables:

        user_columns = {
            column["name"]
            for column in inspector.get_columns("users")
        }

        with engine.begin() as conn:
            if "status" not in user_columns:
                conn.execute(
                    text(
                        "ALTER TABLE users "
                        "ADD COLUMN status VARCHAR "
                        "NOT NULL DEFAULT 'active'"
                    )
                )

            if "is_verified" not in user_columns:
                conn.execute(
                    text(
                        "ALTER TABLE users "
                        "ADD COLUMN is_verified BOOLEAN "
                        "NOT NULL DEFAULT 0"
                    )
                )

            if "trust_score" not in user_columns:
                conn.execute(
                    text(
                        "ALTER TABLE users "
                        "ADD COLUMN trust_score INTEGER "
                        "NOT NULL DEFAULT 100"
                    )
                )

            if "token_version" not in user_columns:
                conn.execute(
                    text(
                        "ALTER TABLE users "
                        "ADD COLUMN token_version INTEGER "
                        "NOT NULL DEFAULT 1"
                    )
                )


    # ========================================================
    # 3. POSTS MIGRATIONS
    # ========================================================

    if "posts" in existing_tables:

        post_columns = {
            column["name"]
            for column in inspector.get_columns("posts")
        }

        with engine.begin() as conn:
            if "status" not in post_columns:
                conn.execute(
                    text(
                        "ALTER TABLE posts "
                        "ADD COLUMN status VARCHAR "
                        "NOT NULL DEFAULT 'active'"
                    )
                )

            if "category" not in post_columns:
                conn.execute(
                    text(
                        "ALTER TABLE posts "
                        "ADD COLUMN category VARCHAR"
                    )
                )

            if "variety" not in post_columns:
                conn.execute(
                    text(
                        "ALTER TABLE posts "
                        "ADD COLUMN variety VARCHAR"
                    )
                )

            if "quality_grade" not in post_columns:
                conn.execute(
                    text(
                        "ALTER TABLE posts "
                        "ADD COLUMN quality_grade VARCHAR"
                    )
                )

            if "is_negotiable" not in post_columns:
                conn.execute(
                    text(
                        "ALTER TABLE posts "
                        "ADD COLUMN is_negotiable BOOLEAN "
                        "NOT NULL DEFAULT 0"
                    )
                )

            if "report_count" not in post_columns:
                conn.execute(
                    text(
                        "ALTER TABLE posts "
                        "ADD COLUMN report_count INTEGER "
                        "NOT NULL DEFAULT 0"
                    )
                )

            if "negotiation_status" not in post_columns:
                conn.execute(
                    text(
                        "ALTER TABLE posts "
                        "ADD COLUMN negotiation_status VARCHAR "
                        "NOT NULL DEFAULT 'none'"
                    )
                )

            if "sold_price" not in post_columns:
                conn.execute(
                    text(
                        "ALTER TABLE posts "
                        "ADD COLUMN sold_price FLOAT"
                    )
                )

            if "sold_quantity" not in post_columns:
                conn.execute(
                    text(
                        "ALTER TABLE posts "
                        "ADD COLUMN sold_quantity VARCHAR"
                    )
                )

            if "sold_at" not in post_columns:
                conn.execute(
                    text(
                        "ALTER TABLE posts "
                        "ADD COLUMN sold_at TIMESTAMP"
                    )
                )

    # ========================================================
    # 4. REPORTS MIGRATIONS
    # ========================================================

    if "reports" in existing_tables:
        report_columns = {
            column["name"]
            for column in inspector.get_columns("reports")
        }

        with engine.begin() as conn:
            if "resolution_action" not in report_columns:
                conn.execute(
                    text(
                        "ALTER TABLE reports "
                        "ADD COLUMN resolution_action VARCHAR"
                    )
                )

            if "resolution_notes" not in report_columns:
                conn.execute(
                    text(
                        "ALTER TABLE reports "
                        "ADD COLUMN resolution_notes TEXT"
                    )
                )

            if "resolved_by_id" not in report_columns:
                conn.execute(
                    text(
                        "ALTER TABLE reports "
                        "ADD COLUMN resolved_by_id INTEGER"
                    )
                )

            if "resolved_at" not in report_columns:
                conn.execute(
                    text(
                        "ALTER TABLE reports "
                        "ADD COLUMN resolved_at TIMESTAMP"
                    )
                )

    # --------------------------------------------------------
    # 5. CREATE NEW TABLES (e.g. post_status_history, admin_audit_logs)
    # --------------------------------------------------------
    Base.metadata.create_all(bind=engine)


# ============================================================
# DATABASE DEPENDENCY
# ============================================================

def get_db():
    """
    Provide a resilient database session for FastAPI routes.
    Ensures automatic rollback on errors, connection invalidation on disconnects,
    and reliable session cleanup.
    """
    db = SessionLocal()
    try:
        yield db
    except (OperationalError, DBAPIError):
        try:
            db.rollback()
        except Exception:
            pass
        # Invalidate session to ensure a disconnected/broken connection is
        # safely evicted from the connection pool.
        try:
            db.invalidate()
        except Exception:
            pass
        raise
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    finally:
        db.close()


def reset_db_connections():
    """
    Safely dispose of all pooled connections in the engine.
    Fresh connections will be established on demand.
    """
    engine.dispose()