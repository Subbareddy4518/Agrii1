import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


# ============================================================
# DATABASE CONFIGURATION
# ============================================================

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./agriconnect.db"
)


# SQLite needs this option for FastAPI's request handling.
connect_args = {}

if DATABASE_URL.startswith("sqlite"):
    connect_args = {
        "check_same_thread": False
    }


engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args
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

    # --------------------------------------------------------
    # 4. CREATE NEW TABLES (e.g. post_status_history)
    # --------------------------------------------------------
    Base.metadata.create_all(bind=engine)


# ============================================================
# DATABASE DEPENDENCY
# ============================================================

def get_db():
    """
    Provide a database session for FastAPI routes.
    """

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()