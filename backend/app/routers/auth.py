from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlmodel import Session, select

from ..config import get_settings
from ..db import get_session
from ..models import User
from ..schemas import Credentials, UserOut
from ..security import CurrentUser, create_access_token, hash_password, login_limiter, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

SessionDep = Annotated[Session, Depends(get_session)]


def _set_session_cookie(response: Response, user_id: int) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.cookie_name,
        value=create_access_token(user_id),
        max_age=settings.access_token_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: Credentials, response: Response, session: SessionDep) -> User:
    username = data.username.lower()
    if session.exec(select(User).where(User.username == username)).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ese nombre de usuario ya existe")
    user = User(username=username, password_hash=hash_password(data.password))
    session.add(user)
    session.commit()
    session.refresh(user)
    assert user.id is not None
    _set_session_cookie(response, user.id)
    return user


@router.post("/login", response_model=UserOut)
def login(data: Credentials, request: Request, response: Response, session: SessionDep) -> User:
    username = data.username.lower()
    key = f"{request.client.host if request.client else 'unknown'}:{username}"
    login_limiter.check(key)
    user = session.exec(select(User).where(User.username == username)).first()
    if not verify_password(data.password, user.password_hash if user else None) or user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario o contraseña incorrectos")
    login_limiter.reset(key)
    assert user.id is not None
    _set_session_cookie(response, user.id)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(settings.cookie_name, path="/", httponly=True, secure=settings.cookie_secure, samesite="lax")


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user
