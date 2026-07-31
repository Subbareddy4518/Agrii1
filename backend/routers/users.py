"""Profile endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from auth import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=schemas.UserOut)
def get_me(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    out = schemas.UserOut.model_validate(user)
    out.posts_count = len(user.posts)
    return out


@router.put("/me", response_model=schemas.UserOut)
def update_me(
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    out = schemas.UserOut.model_validate(user)
    out.posts_count = len(user.posts)
    return out
