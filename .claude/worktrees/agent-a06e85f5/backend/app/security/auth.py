"""OIDC (Dex) auth primitives for KPI Dashboard (Phase 28).

Exports:
  - `oauth`: authlib Starlette OAuth singleton with Dex client registered
  - `get_current_user`: FastAPI dependency reading session-cookie identity
  - `SYNTHETIC_USER`: dev-bypass identity returned when DISABLE_AUTH=true

No routes are registered here. Plan 28-02 adds /api/auth/{login,callback,logout}
and Plan 28-03 applies `get_current_user` as a router-level dependency.
"""
from authlib.integrations.starlette_client import OAuth
from fastapi import HTTPException, Request

from app.config import settings
from app.schemas import CurrentUser


# Module-level OAuth singleton (D-04). authlib picks up the bundled httpx
# (already in requirements.txt) for OIDC discovery + token exchange.
oauth = OAuth()
oauth.register(
    name="dex",
    server_metadata_url=f"{settings.DEX_ISSUER}/.well-known/openid-configuration",
    client_id=settings.DEX_CLIENT_ID,
    client_secret=settings.DEX_CLIENT_SECRET,
    client_kwargs={
        "scope": "openid email profile offline_access",  # D-05
        "code_challenge_method": "S256",                  # D-04 PKCE
    },
)

# Synthetic identity used when DISABLE_AUTH=true (D-13). Kept stable so
# dev sessions persist across restarts without touching the app_users table.
SYNTHETIC_USER = CurrentUser(sub="dev-user", email="dev@localhost", name="Dev User")


def get_current_user(request: Request) -> CurrentUser:
    """FastAPI dependency enforcing session-cookie auth (KPO-07, D-18).

    - DISABLE_AUTH=true → return SYNTHETIC_USER without touching the session (D-14)
    - session['user'] present → hydrate CurrentUser from session payload
    - otherwise → 401 Unauthenticated
    """
    if settings.DISABLE_AUTH:
        return SYNTHETIC_USER
    raw = request.session.get("user")
    if not raw:
        raise HTTPException(status_code=401, detail="Unauthenticated")
    return CurrentUser(**raw)
