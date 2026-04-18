"""OIDC auth endpoints — login, callback, me, logout (KPO-02..KPO-04)."""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_async_db_session
from app.schemas import CurrentUser
from app.security.auth import get_current_user, oauth
from app.services.users import upsert_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _bypass_guard() -> None:
    """Return 503 for login/callback/logout under DISABLE_AUTH=true (D-16)."""
    if settings.DISABLE_AUTH:
        raise HTTPException(
            status_code=503,
            detail="DISABLE_AUTH=true; OIDC endpoints disabled",
        )


@router.get("/login")
async def login(request: Request):
    _bypass_guard()
    # redirect_uri MUST match the Dex kpi-light client registration exactly.
    return await oauth.dex.authorize_redirect(request, settings.DEX_REDIRECT_URI)


@router.get("/callback", name="auth_callback")
async def callback(
    request: Request, db: AsyncSession = Depends(get_async_db_session)
):
    _bypass_guard()
    try:
        token = await oauth.dex.authorize_access_token(request)
    except Exception as exc:
        # D-07 + Claude's Discretion: minimal surface — flash message home.
        raise HTTPException(
            status_code=400, detail=f"OIDC callback failed: {exc}"
        ) from exc
    claims = token.get("userinfo") or token.get("id_token_claims") or {}
    sub = claims.get("sub")
    email = claims.get("email")
    name = claims.get("name")  # nullable per D-12
    if not sub or not email:
        raise HTTPException(status_code=400, detail="Missing sub/email from IdP")
    await upsert_user(db, sub=sub, email=email, name=name)  # D-11
    # Cookie payload strictly {sub,email,name} — D-01 (no raw tokens)
    request.session["user"] = {"sub": sub, "email": email, "name": name}
    return RedirectResponse(url="/", status_code=303)


@router.get("/me", response_model=CurrentUser)
async def me(user: CurrentUser = Depends(get_current_user)):
    # KPO-03 — dependency raises 401 when unauthenticated.
    return user


@router.post("/logout")
async def logout(request: Request):
    _bypass_guard()
    request.session.pop("user", None)
    # Belt + braces: also instruct browser to drop the cookie.
    resp = RedirectResponse(url="/", status_code=303)
    resp.delete_cookie("kpi_session", path="/")
    return resp
