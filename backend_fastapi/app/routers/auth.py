from typing import Optional

from fastapi import APIRouter, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pydantic import BaseModel
from sqlalchemy import select

from app.config import Settings
from app.deps import CurrentUserDep, DbDep, SettingsDep, create_access_token
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class GoogleAuthBody(BaseModel):
    credential: str


class UserOut(BaseModel):
    id: str
    email: Optional[str]
    displayName: Optional[str]
    photoURL: Optional[str]


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


@router.post("/google", response_model=AuthResponse)
def google_login(body: GoogleAuthBody, db: DbDep, settings: SettingsDep):
    if not settings.google_client_id:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID is not configured on the server.")

    try:
        idinfo = id_token.verify_oauth2_token(
            body.credential,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    google_sub = str(idinfo.get("sub") or "")
    if not google_sub:
        raise HTTPException(status_code=401, detail="Invalid Google credential (missing sub)")

    email = idinfo.get("email")
    display_name = idinfo.get("name")
    picture = idinfo.get("picture")

    user = db.execute(select(User).where(User.google_sub == google_sub)).scalar_one_or_none()
    if user is None:
        user = User(
            google_sub=google_sub,
            email=str(email) if email else None,
            display_name=str(display_name) if display_name else None,
            picture_url=str(picture) if picture else None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        changed = False
        ne = str(email) if email else None
        if ne and user.email != ne:
            user.email = ne
            changed = True
        nd = str(display_name) if display_name else None
        if nd and user.display_name != nd:
            user.display_name = nd
            changed = True
        np = str(picture) if picture else None
        if np and user.picture_url != np:
            user.picture_url = np
            changed = True
        if changed:
            db.commit()

    token = create_access_token(subject=str(user.id), settings=settings)

    return AuthResponse(
        access_token=token,
        user=UserOut(
            id=str(user.id),
            email=user.email,
            displayName=user.display_name,
            photoURL=user.picture_url,
        ),
    )


@router.get("/me", response_model=UserOut)
def me(user: CurrentUserDep):
    return UserOut(
        id=str(user.id),
        email=user.email,
        displayName=user.display_name,
        photoURL=user.picture_url,
    )
