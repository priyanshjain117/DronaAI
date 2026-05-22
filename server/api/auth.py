from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Any
from pydantic import BaseModel

from db.session import get_db
from models.user import User
from api.deps import get_current_user
from utils.auth import verify_password, get_password_hash, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter()


class UserCreate(BaseModel):
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserInfo(BaseModel):
    id: int
    email: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserInfo


@router.post("/signup", response_model=Token)
def signup(user_in: UserCreate, db: Session = Depends(get_db)) -> Any:
    # Basic validation
    if not user_in.email or "@" not in user_in.email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if not user_in.password or len(user_in.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    user = db.query(User).filter(User.email == user_in.email.lower().strip()).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists.",
        )
    user = User(
        email=user_in.email.lower().strip(),
        hashed_password=get_password_hash(user_in.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email},
    }


@router.post("/login", response_model=Token)
def login(user_in: UserLogin, db: Session = Depends(get_db)) -> Any:
    user = db.query(User).filter(User.email == user_in.email.lower().strip()).first()
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email},
    }


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Validate token and return current user info."""
    return {"id": current_user.id, "email": current_user.email}
