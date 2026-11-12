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


class SendOtpRequest(BaseModel):
    mobile: str


class VerifyOtpRequest(BaseModel):
    mobile: str
    otp: str


class OtpResponse(BaseModel):
    message: str
    otp: Optional[str] = None
    is_verified: bool = False
    user: Optional["UserOut"] = None


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
    status: str = "active"
    is_verified: bool = False
    trust_score: int = 100
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
    category: Optional[str] = None
    variety: Optional[str] = None
    quality_grade: Optional[str] = None
    quantity: Optional[str] = None
    price: Optional[float] = None
    is_negotiable: bool = False
    location: Optional[str] = None
    image: Optional[str] = None
    target_date: Optional[str] = None


class PostUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    crop_name: Optional[str] = None
    category: Optional[str] = None
    variety: Optional[str] = None
    quality_grade: Optional[str] = None
    quantity: Optional[str] = None
    price: Optional[float] = None
    is_negotiable: Optional[bool] = None
    location: Optional[str] = None
    image: Optional[str] = None
    target_date: Optional[str] = None


class PostStatusHistoryOut(BaseModel):
    id: int
    post_id: int
    changed_by_user_id: int
    from_status: Optional[str] = None
    to_status: str
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PostStatusUpdate(BaseModel):
    status: Optional[str] = None  # draft, active, paused, sold, archived, closed
    negotiation_status: Optional[str] = None  # none, in_negotiation, offer_pending, deal_agreed
    sold_price: Optional[float] = None
    sold_quantity: Optional[str] = None
    notes: Optional[str] = None


class AuthorOut(BaseModel):
    id: int
    name: str
    mobile: str
    location: Optional[str] = None
    profile_image: Optional[str] = None
    is_verified: bool = False
    trust_score: int = 100

    class Config:
        from_attributes = True


class PostOut(BaseModel):
    id: int
    role: RoleEnum
    title: str
    description: Optional[str] = None
    crop_name: str
    category: Optional[str] = None
    variety: Optional[str] = None
    quality_grade: Optional[str] = None
    quantity: Optional[str] = None
    price: Optional[float] = None
    is_negotiable: bool = False
    location: Optional[str] = None
    image: Optional[str] = None
    target_date: Optional[str] = None
    likes_count: int
    report_count: int = 0
    liked_by_me: bool = False
    status: str = "active"
    negotiation_status: str = "none"
    sold_price: Optional[float] = None
    sold_quantity: Optional[str] = None
    sold_at: Optional[datetime] = None
    created_at: datetime
    owner: AuthorOut
    status_history: List[PostStatusHistoryOut] = []

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


# ---------- Admin ----------

class AdminUserOut(BaseModel):
    id: int
    role: RoleEnum
    name: str
    contact_person: Optional[str] = None
    mobile: str
    location: Optional[str] = None
    profile_image: Optional[str] = None
    status: str
    created_at: datetime
    posts_count: int = 0

    class Config:
        from_attributes = True


class PaginatedAdminUsers(BaseModel):
    items: List[AdminUserOut]
    page: int
    page_size: int
    total: int
    has_more: bool


class AdminPostOut(BaseModel):
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
    status: str
    negotiation_status: str = "none"
    sold_price: Optional[float] = None
    sold_quantity: Optional[str] = None
    sold_at: Optional[datetime] = None
    created_at: datetime
    owner: AuthorOut

    class Config:
        from_attributes = True


class PaginatedAdminPosts(BaseModel):
    items: List[AdminPostOut]
    page: int
    page_size: int
    total: int
    has_more: bool


class AdminStatsOut(BaseModel):
    total_users: int
    total_farmers: int
    total_industries: int
    total_posts: int
    active_posts: int
    closed_posts: int
    crop_posts: int
    requirement_posts: int
    recent_notifications: int
    suspended_users: int


class ChartPoint(BaseModel):
    label: str
    value: int


class AdminAnalyticsOut(BaseModel):
    farmers_vs_industries: List[ChartPoint]
    posts_over_time: List[ChartPoint]
    crop_distribution: List[ChartPoint]
    user_growth: List[ChartPoint]
    active_vs_closed: List[ChartPoint]
    interested_actions_total: int
    notifications_total: int


class StatusUpdate(BaseModel):
    status: str  # "active" | "suspended" for users, "active" | "closed" for posts


class BroadcastRequest(BaseModel):
    audience: str  # "all_farmers" | "all_industries" | "selected"
    user_ids: Optional[List[int]] = None
    title: str
    message: str


class BroadcastResult(BaseModel):
    sent_count: int


# ---------- AI, Market Guidance & Matching ----------

class PriceGuidanceOut(BaseModel):
    crop_name: str
    min_price: float
    max_price: float
    modal_price: float
    unit: str
    trend: str = "stable"
    market_name: str = "Regional APMC Mandi"
    confidence: str = "verified_mandi"


class CropItemOut(BaseModel):
    name: str
    category: str
    telugu: str
    hindi: str
    icon: str
    default_unit: str
    min_price: float
    max_price: float
    varieties: List[str] = []


class CropAssistRequest(BaseModel):
    text: str
    language: Optional[str] = "en"
    role: Optional[str] = "farmer"


class CropAssistResponse(BaseModel):
    detected_crop: Optional[str] = None
    category: Optional[str] = None
    variety: Optional[str] = None
    quantity_amount: Optional[str] = None
    unit: Optional[str] = None
    price: Optional[float] = None
    is_negotiable: bool = False
    location: Optional[str] = None
    quality_grade: Optional[str] = None
    suggested_title: Optional[str] = None
    suggested_description: Optional[str] = None
    price_guidance: Optional[PriceGuidanceOut] = None
    confidence_score: float = 0.95
    is_ai_generated: bool = True
    missing_fields: List[str] = []


class SmartMatchItemOut(BaseModel):
    post: PostOut
    match_score: int
    reasons: List[str]
    matched_crop: str
    distance_approx: Optional[str] = None


class SmartMatchesResponse(BaseModel):
    total_matches: int
    matches: List[SmartMatchItemOut]


class AiAdvisorRequest(BaseModel):
    message: str
    language: Optional[str] = "en"
    role: Optional[str] = "farmer"
    crop_context: Optional[str] = None


class AiAdvisorResponse(BaseModel):
    reply: str
    suggested_topics: List[str] = []
    action_prompt: Optional[str] = None


# ---------- Reports ----------

class ReportCreate(BaseModel):
    reason: str
    details: Optional[str] = None


class ReportOut(BaseModel):
    id: int
    post_id: int
    reporter_id: int
    reason: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

