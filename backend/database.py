import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./agriconnect.db"
)

connect_args = {}

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

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


def run_migrations():
    """
    Lightweight, additive-only migration for columns introduced by the admin
    dashboard (users.status, posts.status).

    Base.metadata.create_all() only creates tables that don't exist yet — it
    never alters an existing table's columns. Since this project ships with a
    pre-populated agriconnect.db, we need to add the new columns by hand the
    first time this runs, without touching any existing rows/tables.

    Safe to call every startup: it checks PRAGMA table_info first and is a
    no-op once the columns are present.
    """
    from sqlalchemy import text, inspect

    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    with engine.begin() as conn:
        if "users" in existing_tables:
            user_columns = {col["name"] for col in inspector.get_columns("users")}
            if "status" not in user_columns:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN status VARCHAR NOT NULL DEFAULT 'active'"
                ))

        if "posts" in existing_tables:
            post_columns = {col["name"] for col in inspector.get_columns("posts")}
            if "status" not in post_columns:
                conn.execute(text(
                    "ALTER TABLE posts ADD COLUMN status VARCHAR NOT NULL DEFAULT 'active'"
                ))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
