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
    # 2. USERS.STATUS MIGRATION
    # ========================================================

    if "users" in existing_tables:

        user_columns = {
            column["name"]
            for column in inspector.get_columns("users")
        }

        if "status" not in user_columns:

            with engine.begin() as conn:

                conn.execute(
                    text(
                        "ALTER TABLE users "
                        "ADD COLUMN status VARCHAR "
                        "NOT NULL DEFAULT 'active'"
                    )
                )


    # ========================================================
    # 3. POSTS.STATUS MIGRATION
    # ========================================================

    if "posts" in existing_tables:

        post_columns = {
            column["name"]
            for column in inspector.get_columns("posts")
        }

        if "status" not in post_columns:

            with engine.begin() as conn:

                conn.execute(
                    text(
                        "ALTER TABLE posts "
                        "ADD COLUMN status VARCHAR "
                        "NOT NULL DEFAULT 'active'"
                    )
                )


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