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
    quantity = Column(String, nullable=True)
    price = Column(Float, nullable=True)
    location = Column(String, nullable=True, index=True)
    image = Column(String, nullable=True)

    # Farmer -> harvest_date, Industry -> required_before_date. Shared column.
    target_date = Column(String, nullable=True)

    likes_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    owner = relationship("User", back_populates="posts")
    likes = relationship("Like", back_populates="post", cascade="all, delete-orphan")


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
