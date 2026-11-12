"""
SQLAlchemy ORM models for AgriConnect.

Two roles share the same `users` table (role column differentiates them):
- farmer: posts crops for sale
- industry: posts requirements they need fulfilled

Posts are also unified in a single `posts` table, distinguished by the
`role` of the author, which keeps the feed query simple (just filter by
the opposite role of the logged in user).
"""
import enum
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime, ForeignKey, Boolean, Enum
)
from sqlalchemy.orm import relationship

from database import Base


class RoleEnum(str, enum.Enum):
    farmer = "farmer"
    industry = "industry"
    admin = "admin"


class StatusEnum(str, enum.Enum):
    active = "active"
    suspended = "suspended"


class PostStatusEnum(str, enum.Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    sold = "sold"
    archived = "archived"
    closed = "closed"


class NegotiationStatusEnum(str, enum.Enum):
    none = "none"
    in_negotiation = "in_negotiation"
    offer_pending = "offer_pending"
    deal_agreed = "deal_agreed"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(Enum(RoleEnum), nullable=False, index=True)

    # Shared / role-specific fields collapsed into one table for simplicity.
    name = Column(String, nullable=False)          # Full Name or Company Name
    contact_person = Column(String, nullable=True)  # Industry only
    mobile = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    location = Column(String, nullable=True)         # Village/District or Company Location
    profile_image = Column(String, nullable=True)

    # Account status, used by the admin dashboard to suspend/activate users.
    # Stored as a plain string (not Enum) so it can be added to the existing
    # sqlite database with a simple ALTER TABLE (see database.py run_migrations).
    status = Column(String, nullable=False, default=StatusEnum.active.value, server_default=StatusEnum.active.value)
    is_verified = Column(Boolean, nullable=False, default=False, server_default="0")
    trust_score = Column(Integer, nullable=False, default=100, server_default="100")

    created_at = Column(DateTime, default=datetime.utcnow)

    posts = relationship("Post", back_populates="owner", cascade="all, delete-orphan")


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False, index=True)  # author's role

    # Farmer: crop title. Industry: requirement title.
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    crop_name = Column(String, nullable=False, index=True)
    category = Column(String, nullable=True, index=True)        # Cereals, Vegetables, Spices, Cash Crops, Pulses, Fruits
    variety = Column(String, nullable=True)                     # e.g. Sona Masoori, Teja, BT Cotton
    quality_grade = Column(String, nullable=True)               # Grade A, Grade B, Organic
    quantity = Column(String, nullable=True)
    price = Column(Float, nullable=True)
    is_negotiable = Column(Boolean, nullable=False, default=False, server_default="0")
    location = Column(String, nullable=True, index=True)
    image = Column(String, nullable=True)

    # Farmer -> harvest_date, Industry -> required_before_date. Shared column.
    target_date = Column(String, nullable=True)

    likes_count = Column(Integer, default=0)
    report_count = Column(Integer, default=0, server_default="0")

    # Controlled Listing Lifecycle & Negotiation State
    status = Column(String, nullable=False, default=PostStatusEnum.active.value, server_default=PostStatusEnum.active.value, index=True)
    negotiation_status = Column(String, nullable=False, default=NegotiationStatusEnum.none.value, server_default=NegotiationStatusEnum.none.value, index=True)
    sold_price = Column(Float, nullable=True)
    sold_quantity = Column(String, nullable=True)
    sold_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    owner = relationship("User", back_populates="posts")
    likes = relationship("Like", back_populates="post", cascade="all, delete-orphan")
    status_history = relationship("PostStatusHistory", back_populates="post", cascade="all, delete-orphan", order_by="PostStatusHistory.created_at.desc()")


class Like(Base):
    __tablename__ = "likes"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("Post", back_populates="likes")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    reason = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="pending", server_default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("Post")
    reporter = relationship("User")


class PostStatusHistory(Base):
    __tablename__ = "post_status_history"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    changed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    from_status = Column(String, nullable=True)
    to_status = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    post = relationship("Post", back_populates="status_history")
    changed_by = relationship("User")

