"""Pydantic request/response schemas."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator

from models import RoleEnum


# ---------- Auth ----------

class RegisterRequest(BaseModel):
    role: RoleEnum
    name: str                      # Full Name (farmer) or Company Name (industry)
    contact_person: Optional[str] = None
    mobile: str
    password: str
    confirm_password: str
    location: Optional[str] = None
    profile_image: Optional[str] = None

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


class LoginRequest(BaseModel):
    mobile: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


# ---------- User ----------

class UserOut(BaseModel):
    id: int
    role: RoleEnum
    name: str
    contact_person: Optional[str] = None
    mobile: str
    location: Optional[str] = None
    profile_image: Optional[str] = None
    created_at: datetime
    posts_count: int = 0

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    location: Optional[str] = None
    profile_image: Optional[str] = None


# ---------- Posts ----------

class PostCreate(BaseModel):
    title: str
    description: Optional[str] = None
    crop_name: str
    quantity: Optional[str] = None
    price: Optional[float] = None
    location: Optional[str] = None
    image: Optional[str] = None
    target_date: Optional[str] = None


class PostUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    crop_name: Optional[str] = None
    quantity: Optional[str] = None
    price: Optional[float] = None
    location: Optional[str] = None
    image: Optional[str] = None
    target_date: Optional[str] = None


class AuthorOut(BaseModel):
    id: int
    name: str
    mobile: str
    location: Optional[str] = None
    profile_image: Optional[str] = None

    class Config:
        from_attributes = True


class PostOut(BaseModel):
    id: int
    role: RoleEnum
    title: str
    description: Optional[str] = None
    crop_name: str
    quantity: Optional[str] = None
    price: Optional[float] = None
    location: Optional[str] = None
    image: Optional[str] = None
    target_date: Optional[str] = None
    likes_count: int
    liked_by_me: bool = False
    created_at: datetime
    owner: AuthorOut

    class Config:
        from_attributes = True


class PaginatedPosts(BaseModel):
    items: List[PostOut]
    page: int
    page_size: int
    has_more: bool


# ---------- Notifications ----------

class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
