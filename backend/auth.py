"""JWT + password hashing helpers, and the get_current_user dependency."""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import get_db
import models

import os

DEV_SECRET_KEY = "agriconnect-dev-secret-change-in-production"
SECRET_KEY = os.getenv("SECRET_KEY", DEV_SECRET_KEY)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days


def validate_production_secret():
    """
    Ensures that in a production environment (ENVIRONMENT=production or FASTAPI_ENV=production),
    the application fails safely upon startup if SECRET_KEY is not explicitly configured
    or is still set to the insecure development fallback string.
    """
    is_prod = os.getenv("ENVIRONMENT", "").lower() in ("production", "prod") or os.getenv("FASTAPI_ENV", "").lower() in ("production", "prod")
    configured_secret = os.getenv("SECRET_KEY")
    if is_prod and (not configured_secret or configured_secret == DEV_SECRET_KEY):
        raise RuntimeError(
            "FATAL SECURITY CONFIGURATION: SECRET_KEY must be securely configured via environment variable "
            "in production. Insecure development fallback key is rejected."
        )


validate_production_secret()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        token_ver = payload.get("token_version")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception

    # Enforce session invalidation upon credential update
    user_token_ver = getattr(user, "token_version", 1) or 1
    if token_ver is not None and token_ver != user_token_ver:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired due to password update. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    elif token_ver is None and user_token_ver > 1:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired due to password update. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_current_admin(user: models.User = Depends(get_current_user)) -> models.User:
    """
    Admin-only dependency. Re-checks the role against the database on every
    request (via get_current_user -> DB lookup) rather than trusting anything
    the frontend sends, so a non-admin can never reach an admin endpoint by
    forging a client-side role value.
    """
    if user.role != models.RoleEnum.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
