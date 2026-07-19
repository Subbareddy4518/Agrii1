"""Registration and login endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from auth import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=schemas.Token)
def register(payload: schemas.RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.mobile == payload.mobile).first()
    if existing:
        raise HTTPException(status_code=400, detail="Mobile number already registered")

    if payload.role == models.RoleEnum.industry and not payload.contact_person:
        raise HTTPException(status_code=422, detail="Contact person is required for industry accounts")

    user = models.User(
        role=payload.role,
        name=payload.name,
        contact_person=payload.contact_person,
        mobile=payload.mobile,
        hashed_password=hash_password(payload.password),
        location=payload.location,
        profile_image=payload.profile_image,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    user_out = schemas.UserOut.model_validate(user)
    user_out.posts_count = 0
    return schemas.Token(access_token=token, user=user_out)


@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.mobile == payload.mobile).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid mobile number or password")

    token = create_access_token({"sub": str(user.id)})
    posts_count = len(user.posts)
    user_out = schemas.UserOut.model_validate(user)
    user_out.posts_count = posts_count
    return schemas.Token(access_token=token, user=user_out)
