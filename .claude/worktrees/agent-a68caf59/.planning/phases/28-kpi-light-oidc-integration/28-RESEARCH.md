# Phase 28: KPI Light OIDC Integration - Research

**Researched:** 2026-04-15
**Domain:** OIDC (authorization-code + PKCE) integration for FastAPI + React via Dex
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Session Cookie Implementation**
- **D-01:** Use Starlette `SessionMiddleware` (`starlette.middleware.sessions.SessionMiddleware`). Single `SESSION_SECRET` env var (64 hex chars, `openssl rand -hex 32`, `.env`-only, gitignored). itsdangerous-signed JSON cookie. Payload limited to `{sub, email, name}` — no raw access/refresh tokens.
- **D-02:** Cookie lifetime **8 hours absolute, no sliding expiration**. Flags: `httpOnly=True, samesite="lax", secure=True, max_age=28800`.
- **D-03:** Cookie name `kpi_session`, `path=/`, no `domain` attribute (host-only, bound to `kpi.internal`).

**OIDC Flow**
- **D-04:** `authlib >= 1.6.0` registered via `server_metadata_url="https://auth.internal/dex/.well-known/openid-configuration"`. PKCE S256 enforced via `client_kwargs={'code_challenge_method': 'S256'}`.
- **D-05:** Scopes: `openid email profile offline_access`. Request `offline_access` but do NOT store refresh token.
- **D-06:** `/api/auth/login` stores `state` + PKCE verifier in session cookie (authlib handles), 303-redirects to Dex.
- **D-07:** `/api/auth/callback` exchanges code, validates ID token (sig/issuer/audience via authlib), extracts `{sub, email, name}`, upserts `app_users`, writes into session, 303-redirects to `/`.

**Logout UX**
- **D-08:** Local logout only (Dex lacks RP-initiated). `/api/auth/logout` clears cookie, returns 303 to `/`. Frontend submits HTML POST form. Dex SSO cookie persists ~1h — accepted.
- **D-09:** No explicit UI warning. Document in `docs/setup.md`.

**app_users Table (KPO-06)**
- **D-10:** `(id SERIAL PK, sub TEXT UNIQUE NOT NULL, email TEXT NOT NULL, name TEXT, created_at TIMESTAMPTZ DEFAULT now(), last_seen_at TIMESTAMPTZ DEFAULT now())`. Model in `backend/app/models.py`. Alembic `--autogenerate`.
- **D-11:** `INSERT ... ON CONFLICT (sub) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, last_seen_at=now()` on every callback.
- **D-12:** `name` nullable; NavBar falls back to email.

**DISABLE_AUTH Bypass (KPO-05)**
- **D-13:** Synthetic user hardcoded: `sub="dev-user"`, `email="dev@localhost"`, `name="Dev User"`. No env-var customization.
- **D-14:** When `DISABLE_AUTH=true`, `get_current_user` returns synthetic user without session/Dex. Synthetic user upserted on app startup (not per-request).
- **D-15:** Lifespan logs `logger.warning("⚠ DISABLE_AUTH=true — authentication is bypassed. DO NOT use in production.")` at boot.
- **D-16:** Auth endpoints return 404 or 503 under `DISABLE_AUTH=true` — Claude's Discretion.

**Backend Route Protection (KPO-07)**
- **D-17:** All six routers (`uploads, kpis, settings, sync, hr_kpis, data`) gain `dependencies=[Depends(get_current_user)]` at APIRouter level.
- **D-18:** Bypassed: `/health`, `/api/auth/*`. `/api/auth/me` returns 401 (does NOT redirect to Dex) — frontend handles redirect.

**Frontend (KPO-08, KPO-09)**
- **D-19:** `<ProtectedRoute>` wraps entire `<Switch>` once in `App.tsx` (around NavBar + SubHeader + `<main>`).
- **D-20:** Full-screen splash during `/api/auth/me` probe; reuse Phase 22 pre-hydration splash tokens. No white flash.
- **D-21:** On 401, `window.location.href = "/api/auth/login"`. No intermediate sign-in screen.
- **D-22:** `useCurrentUser()` hook: `queryKey: ['auth','me']`, `staleTime: Infinity`, `retry: false`.
- **D-23:** NavBar: plain text `user.name ?? user.email` + native `<form method="POST" action="/api/auth/logout">` logout button. No dropdown/avatar.

### Claude's Discretion
- Error-page markup on callback failures (state mismatch, Dex unreachable) — minimal, flash-style on `/`.
- 404 vs 503 for auth endpoints under `DISABLE_AUTH=true` (D-16).
- Splash visual specifics (logo size, spinner) — match Phase 22 tokens.
- Upsert location: service function vs callback handler vs SQLAlchemy event hook.
- `get_current_user` read session dict directly vs Pydantic model validation — Pydantic probably cleaner.

### Deferred Ideas (OUT OF SCOPE)
- RBAC (Dex `groups` scope) — v2
- Account soft-delete / deactivation UI
- Audit log of login events (`last_seen_at` is the proxy)
- Avatar / profile picture in NavBar
- Sliding session renewal (rejected in D-02)
- Server-side session store (Redis/DB) — rejected in D-01
- AD/LDAP integration — v2
- Per-user data scoping (v1 is team-shared)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KPO-01 | authlib ≥1.6.0 registers Dex via `server_metadata_url` | §Standard Stack, §Code Examples 1 |
| KPO-02 | `/api/auth/login` + `/api/auth/callback`; httpOnly/SameSite=Lax/Secure cookie with `{sub,email,name}` only | §Code Examples 2-3, §Pitfall 1 (cookie size) |
| KPO-03 | `/api/auth/me` returns `{sub,email,name}` or 401 | §Code Examples 5 |
| KPO-04 | `/api/auth/logout` clears cookie, redirects to `/` | §Code Examples 6 |
| KPO-05 | `DISABLE_AUTH=true` bypass + synthetic user + startup warning | §Code Examples 8 |
| KPO-06 | `app_users` table, upsert on callback | §Code Examples 4 (ON CONFLICT), §Don't Hand-Roll |
| KPO-07 | All 6 routers gated via `Depends(get_current_user)` | §Code Examples 7 |
| KPO-08 | `useCurrentUser()` + `<ProtectedRoute>` redirect on 401 | §Code Examples 9-10 |
| KPO-09 | NavBar user display + POST-form logout | §Code Examples 11 |
| E2E-02 | Human UAT login→refresh→logout cycle | Covered by the endpoint contract + ProtectedRoute |
| E2E-06 | Human UAT `DISABLE_AUTH=true` works without Dex | §Code Examples 8 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Python stack locked: FastAPI 0.135.3, SQLAlchemy 2.0.49 (async), asyncpg 0.31.0, Alembic 1.18.4, Pydantic v2.
- All migrations via Alembic `--autogenerate`; never call `Base.metadata.create_all()`.
- Docker Compose v2 syntax; secrets live in `.env`, never hardcoded.
- Never use `--reload` uvicorn flag in production container.
- GSD workflow mandatory before Edit/Write — this research runs inside `/gsd:research-phase`.
- Frontend stack locked: React 19, Vite, TanStack Query 5, Tailwind v4. Note project uses **`wouter`** for routing (not react-router).

## Summary

Phase 28 wires KPI Light (FastAPI backend + React/Vite frontend) to the Dex OIDC provider deployed in Phase 27 at `https://auth.internal/dex`. Decisions are tightly locked (23 D-items). Research focus is therefore narrow and prescriptive: confirm `authlib` usage patterns with Starlette `SessionMiddleware`, verify the PostgreSQL `ON CONFLICT` upsert pattern with async SQLAlchemy 2.0, and establish the `<ProtectedRoute>` + TanStack Query pattern on top of the existing `wouter`-based router.

All core libraries already resolved on the project requirements file or frontend package.json — only **three new backend deps** are needed: `authlib`, `itsdangerous` (required by Starlette SessionMiddleware), and nothing on the frontend. `httpx` is already pinned (authlib uses it transparently).

**Primary recommendation:** Follow authlib's FastAPI quickstart verbatim for login/callback; use `starlette.middleware.sessions.SessionMiddleware` (simplest working path, zero extra deps beyond itsdangerous); implement upsert via `sqlalchemy.dialects.postgresql.insert(...).on_conflict_do_update(...)`; gate the Switch once with a single `<ProtectedRoute>` wrapper; do NOT introduce react-router — continue with `wouter`.

## Standard Stack

### Core (new additions for Phase 28)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Authlib | >=1.6.0,<2.0 | OIDC client (register via server_metadata_url, PKCE, token exchange, ID-token validation) | Project decision D-04. Authlib is the de-facto OIDC client for FastAPI/Starlette; handles discovery, JWKS refresh, PKCE, state, nonce automatically. Latest version verified on PyPI: **1.6.10**. |
| itsdangerous | >=2.2.0 | Required runtime dep of `starlette.middleware.sessions.SessionMiddleware` (JSON signing) | Hard dependency — SessionMiddleware imports it. Not optional. Latest: **2.2.0**. |

**Already present — reuse as-is:**
| Library | Version | Role in Phase 28 |
|---------|---------|------------------|
| FastAPI | 0.135.3 | Unchanged; host new `/api/auth/*` router. |
| SQLAlchemy | 2.0.49 | `AppUser` model + async upsert. |
| asyncpg | 0.31.0 | Drives `ON CONFLICT` upsert via postgresql dialect. |
| Alembic | 1.18.4 | `app_users` migration. |
| Pydantic | v2 (bundled) | `CurrentUser` response schema + optional session payload model. |
| httpx | 0.28.1 | authlib uses it internally for token/JWKS fetches — no direct change needed. |
| @tanstack/react-query | ^5.97.0 | `useCurrentUser()` hook. |
| wouter | ^3.9.0 | Routing — **do NOT swap to react-router**; `<ProtectedRoute>` wraps `<Switch>`. |
| React | 19.2.x | Unchanged. |

### Installation
```
# backend/requirements.txt — append:
Authlib>=1.6.0,<2.0
itsdangerous>=2.2.0
```
No frontend additions.

**Version verification (2026-04-15):** authlib 1.6.10 (latest on PyPI, ✅ ≥ 1.6.0 constraint), itsdangerous 2.2.0 (latest on PyPI). Both HIGH confidence — verified directly against PyPI JSON API.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| authlib | `python-jose` + hand-rolled OAuth flow | Would require implementing state/PKCE/nonce/discovery/JWKS cache manually — D-04 locks authlib; not an option here. |
| Starlette SessionMiddleware | server-side session store (Redis/DB) | Rejected in D-01 (unnecessary for ≤50 users). |
| Starlette SessionMiddleware | `fastapi-users` / `authx` full stacks | Way too heavy; bundle RBAC/user-tables we don't want. D-01 locks SessionMiddleware. |

## Architecture Patterns

### Recommended Backend Layout
```
backend/app/
├── main.py                # register SessionMiddleware + auth_router + guard routers
├── models.py              # + AppUser model
├── schemas.py             # + CurrentUser pydantic model
├── security/
│   ├── auth.py            # NEW: oauth client, get_current_user dep, DISABLE_AUTH bypass
│   └── session.py         # NEW (optional): session helpers / Pydantic typing
├── routers/
│   ├── auth.py            # NEW: /api/auth/{login,callback,me,logout}
│   └── (existing 6)       # + dependencies=[Depends(get_current_user)]
├── services/
│   └── users.py           # NEW: upsert_user(sub, email, name)
└── alembic/versions/      # NEW revision: add_app_users
```

### Recommended Frontend Layout
```
frontend/src/
├── App.tsx                # wrap <Switch/> with <ProtectedRoute>
├── components/
│   ├── ProtectedRoute.tsx # NEW
│   ├── AuthSplash.tsx     # NEW (reuse Phase 22 splash tokens)
│   └── NavBar.tsx         # + user label + <form> logout
├── hooks/
│   └── useCurrentUser.ts  # NEW
└── locales/{de,en}.json   # + auth.* i18n keys (optional)
```

### Pattern 1: authlib OAuth registration (module-level singleton)
**What:** Create a single `OAuth` instance at module import, register Dex once. Reused across requests.
**When:** Backend startup — before routes that need `oauth.dex.authorize_redirect(...)`.
**Source:** https://docs.authlib.org/en/latest/client/fastapi.html

### Pattern 2: Starlette SessionMiddleware registered FIRST
**What:** `app.add_middleware(SessionMiddleware, secret_key=..., https_only=True, same_site="lax", max_age=28800, session_cookie="kpi_session")` registered on the FastAPI app in `main.py`.
**When:** Before any router that reads/writes `request.session`. Middleware order matters — add before CORS or custom auth middleware.

### Pattern 3: `get_current_user` as a FastAPI Dependency
**What:** A `Depends` function that:
1. Short-circuits to synthetic user if `DISABLE_AUTH=true`.
2. Otherwise reads `request.session.get("user")`; if missing, raises `HTTPException(401)`.
3. Returns a Pydantic `CurrentUser`.
Applied router-wide via `APIRouter(..., dependencies=[Depends(get_current_user)])` per D-17. To inject the user object into specific handlers, they re-declare `user: CurrentUser = Depends(get_current_user)` — FastAPI dedupes the dependency call.

### Pattern 4: Postgres async upsert via dialect-specific `insert`
**What:** Use `sqlalchemy.dialects.postgresql.insert(AppUser)` → `.on_conflict_do_update(index_elements=['sub'], set_={...})`. This is the canonical SQLAlchemy 2.0 pattern for Postgres UPSERT. Must use postgres dialect `insert`, NOT generic `sqlalchemy.insert`.

### Pattern 5: ProtectedRoute wraps Switch once
**What:** `<ProtectedRoute>` calls `useCurrentUser()` — while `isPending` render splash, on 401 set `window.location.href = "/api/auth/login"`, on success render children. Wrap once in `App.tsx`.
**Why one wrapper, not per-route:** D-19 locks this. Every page is gated by default; matches intent "internal tool, all routes protected." Easier audit.

### Pattern 6: Native HTML POST form for logout
**What:** `<form method="POST" action="/api/auth/logout"><button type="submit">…</button></form>`. Browser follows the 303 redirect natively. No JS fetch, no CSRF concerns on this specific mutation because the only thing logout does is clear the cookie (failure mode = still logged in).
**Why not a fetch?** KPO-09 literal wording; matches D-23 "submits a plain HTML POST form."

### Anti-Patterns to Avoid
- **Storing access/refresh tokens in the session cookie.** D-01 forbids. Cookie payload is only `{sub, email, name}`. Authlib auto-stores the intermediate `state` + PKCE verifier in the session during the login redirect — those are transient and get consumed by the callback.
- **Calling `Base.metadata.create_all()` for `app_users`.** CLAUDE.md forbids. Use Alembic.
- **Adding `dependencies=[Depends(get_current_user)]` on the `auth` router itself.** Would break /login and /callback. Auth router is the one explicit exception (along with `/health`).
- **Mixing sync `Session` with the async engine** (CLAUDE.md warning). Upsert code must run in the async session.
- **Relying on Dex to support RP-initiated logout.** Confirmed unavailable in v2.43.0 (Phase 27 D-07; Dex issue #1697). Local cookie clear only.
- **Swapping `wouter` for `react-router`.** Not in scope; frontend already uses `wouter` — `<ProtectedRoute>` is a plain wrapper component, router-agnostic.
- **Registering SessionMiddleware AFTER the auth router imports.** SessionMiddleware must be in the app stack before any request tries to read `request.session`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OIDC discovery + JWKS caching + key rotation | Manual fetch of `.well-known/...`, JWKS loop | `authlib` `register(server_metadata_url=...)` | Authlib caches discovery, fetches/refreshes JWKS on kid misses, validates iss/aud/nbf/exp/alg all at once. |
| PKCE code challenge/verifier pairing | Generate + store verifier manually | `client_kwargs={'code_challenge_method': 'S256'}` | Authlib generates the verifier, stores it in session, uses it on callback — you write zero lines. |
| `state` + `nonce` generation + verification | Custom CSRF-style state token | Authlib's `authorize_redirect` + `authorize_access_token` | Both are generated, stored in session, and verified automatically. |
| Signed session cookie | `itsdangerous.URLSafeSerializer` manually | `starlette.middleware.sessions.SessionMiddleware` | Handles serialization, max_age, cookie flags in one line. |
| Postgres UPSERT | `SELECT ... then INSERT or UPDATE` (race condition) | `insert(...).on_conflict_do_update(...)` | Atomic at the DB level; no interleaving race between check and write. |
| Password hashing | Any in-app hashing | Dex handles passwords (Phase 27) | KPI Light never sees a password. |
| ID-token signature verification | `python-jose` + manual JWKS | authlib does it during `authorize_access_token` | Verifies sig + iss + aud + exp in one call. |

**Key insight:** Every OIDC edge case (state replay, nonce binding, JWKS rotation, PKCE, discovery TTL) has a known-correct implementation in authlib. Do not reinvent.

## Runtime State Inventory

This is a **greenfield feature** (no renames/migrations), but there is one state consideration worth flagging:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `app_users` is a NEW table; no existing identity storage to migrate. | Alembic forward migration only. |
| Live service config | Dex clients already registered in Phase 27 (`kpi-light` client id + redirect URI `https://kpi.internal/api/auth/callback`). Phase 28 reads them via env. | None — inherited from Phase 27. |
| OS-registered state | None. | None. |
| Secrets/env vars | NEW env vars required in `api` service + `.env` + `.env.example`: `DEX_ISSUER=https://auth.internal/dex`, `DEX_CLIENT_ID=kpi-light`, `DEX_CLIENT_SECRET=${DEX_KPI_SECRET}` (reuse Phase 27 secret), `DEX_REDIRECT_URI=https://kpi.internal/api/auth/callback`, `SESSION_SECRET=<new; openssl rand -hex 32>`, `DISABLE_AUTH=false`. | Add to `backend/app/config.py` (Pydantic BaseSettings) + `.env.example`. |
| Build artifacts | None. | None. |

**Cookie domain:** no existing `kpi_session` cookie deployed, so no legacy invalidation concern on upgrade.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Dex at `https://auth.internal/dex` | Runtime OIDC | ✓ (Phase 27 deployed) | v2.43.0 | `DISABLE_AUTH=true` bypass |
| PostgreSQL (`db` service) | `app_users` table | ✓ | 17-alpine | — |
| Alembic migration tooling | `app_users` migration | ✓ (existing `migrate` service) | 1.18.4 | — |
| `openssl rand -hex 32` | `SESSION_SECRET` generation | ✓ (standard on macOS/Linux dev shells) | — | `python -c "import secrets;print(secrets.token_hex(32))"` |
| NPM (`kpi.internal` TLS edge) | `Secure` cookie flag + callback URL | ✓ (Phase 26) | 2.11.3 | — |

No blocking missing dependencies.

## Common Pitfalls

### Pitfall 1: Session cookie too large / silently dropped
**What goes wrong:** If anything beyond `{sub, email, name}` leaks in, cookie can exceed 4 KB browser cap.
**Why it happens:** Developer stashes the id_token or userinfo response in session "just in case."
**How to avoid:** Extract only the three fields in the callback; never call `request.session["token"] = token`. Enforce via Pydantic `SessionUser(sub: str, email: EmailStr, name: str | None)` written back into session.
**Warning signs:** Mysterious 400 Bad Request on next request; `Set-Cookie` header truncated; "Your connection is not private" due to oversized cookie in some proxies.

### Pitfall 2: Secure cookie blocked on localhost without TLS
**What goes wrong:** `secure=True` cookie is rejected by browsers over plain HTTP.
**Why it happens:** Dev runs `http://localhost:5173` or `http://localhost:8000` directly instead of `https://kpi.internal` through NPM.
**How to avoid:** Phase 26 made NPM the single edge; dev and prod both use `https://kpi.internal`. Also exactly why `DISABLE_AUTH=true` exists for the pure-frontend iteration case. Do NOT downgrade to `secure=False` in dev — diverges from prod.

### Pitfall 3: `SameSite=Lax` blocks callback POST (not applicable here, but adjacent)
**What goes wrong:** Dex's callback is a GET redirect (authorization-code flow), so Lax permits it. But if someone later adds a form_post response mode, Lax would block the session cookie.
**How to avoid:** Do NOT change Dex `response_mode` from the default (`query`). Authlib default matches.

### Pitfall 4: Middleware registration order
**What goes wrong:** SessionMiddleware added after a middleware that reads `request.session` → 500 error.
**How to avoid:** Register SessionMiddleware early in `main.py`, before any other middleware. FastAPI middleware stack is LIFO — `add_middleware` calls execute outer-to-inner for the last added, so in practice: add SessionMiddleware last if you want it to run outermost (wrapping all requests). This is authlib's own convention — follow it.

### Pitfall 5: `issuer` mismatch between discovery and token
**What goes wrong:** `DEX_ISSUER` env value must exactly match the `iss` claim in id_tokens (`https://auth.internal/dex`). A trailing slash, a missing `/dex` path, or `http` vs `https` causes authlib to reject every token.
**How to avoid:** Use the exact value verified in Phase 27 D-01: `https://auth.internal/dex`. No trailing slash.

### Pitfall 6: Alembic offline migration context missing enums/defaults
**What goes wrong:** `app_users.created_at DEFAULT now()` generated by Alembic autogenerate sometimes drops `server_default=func.now()` into a Python default instead of a server default.
**How to avoid:** Review the generated migration — both `created_at` and `last_seen_at` need `server_default=sa.func.now()`. Same for `sub` UNIQUE constraint.

### Pitfall 7: Upsert in a different session than the calling transaction
**What goes wrong:** Calling a free-standing `upsert_user()` that opens its own session inside the callback handler races with the outer request session.
**How to avoid:** Pass the `AsyncSession` from the FastAPI dependency into `upsert_user`. One session per request.

### Pitfall 8: DISABLE_AUTH bypass leaks to production
**What goes wrong:** Engineer sets `DISABLE_AUTH=true` in `.env` locally, commits `.env` by accident, or copies a dev `.env` to prod.
**How to avoid:** D-15 warning log + D-16 making auth endpoints visibly broken (404/503) under bypass is the mitigation. Additionally: `.env` is gitignored (confirmed convention from Phase 27). Recommend also printing the warning at both `INFO` level AND stderr so it's visible in `docker compose logs api | head`.

### Pitfall 9: Wouter Switch + ProtectedRoute interleaving
**What goes wrong:** If `<ProtectedRoute>` is placed INSIDE `<Switch>` as a wrapping route, wouter's route matching gets confused — `<Switch>` expects `<Route>` children directly.
**How to avoid:** Place `<ProtectedRoute>` OUTSIDE `<Switch>` (matches D-19). Structure: `<ProtectedRoute><NavBar/><SubHeader/><main><Switch>...</Switch></main></ProtectedRoute>`.

### Pitfall 10: TanStack Query retry on 401 loops forever
**What goes wrong:** Default `retry: 3` would retry `/api/auth/me` three times on 401, delaying the redirect by hundreds of ms.
**How to avoid:** D-22 explicitly sets `retry: false` + `staleTime: Infinity`. Also check `frontend/src/queryClient.ts` for a global `retry` default that might conflict — override per-query if so.

### Pitfall 11: Authlib requires httpx, NOT requests
**What goes wrong:** Some authlib tutorials pin old `authlib[requests]` extra; the FastAPI starlette integration uses httpx.
**How to avoid:** Already have `httpx==0.28.1`. Just `pip install authlib` — httpx client is picked up automatically via `AuthlibFastapiClient` / `OAuth().register(...)`.

## Code Examples

All patterns verified against authlib FastAPI docs, SQLAlchemy 2.0 async docs, and Starlette sessions docs.

### 1. authlib Dex client registration
```python
# backend/app/security/auth.py
# Source: https://docs.authlib.org/en/latest/client/fastapi.html
from authlib.integrations.starlette_client import OAuth
from app.config import settings  # Pydantic BaseSettings

oauth = OAuth()
oauth.register(
    name="dex",
    server_metadata_url=f"{settings.DEX_ISSUER}/.well-known/openid-configuration",
    client_id=settings.DEX_CLIENT_ID,
    client_secret=settings.DEX_CLIENT_SECRET,
    client_kwargs={
        "scope": "openid email profile offline_access",
        "code_challenge_method": "S256",  # PKCE (D-04)
    },
)
```

### 2. SessionMiddleware registration
```python
# backend/app/main.py
from starlette.middleware.sessions import SessionMiddleware
from app.config import settings

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET,        # D-01
    session_cookie="kpi_session",              # D-03
    max_age=60 * 60 * 8,                       # D-02: 8h absolute
    same_site="lax",                           # D-02
    https_only=True,                           # D-02 secure flag
)
```

### 3. /api/auth/login + /api/auth/callback
```python
# backend/app/routers/auth.py
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.security.auth import oauth
from app.database import get_session
from app.services.users import upsert_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.get("/login")
async def login(request: Request):
    redirect_uri = request.url_for("auth_callback")  # https://kpi.internal/api/auth/callback
    return await oauth.dex.authorize_redirect(request, str(redirect_uri))

@router.get("/callback", name="auth_callback")
async def callback(request: Request, db: AsyncSession = Depends(get_session)):
    try:
        token = await oauth.dex.authorize_access_token(request)
    except Exception as exc:
        raise HTTPException(400, f"OIDC callback failed: {exc}") from exc
    claims = token.get("userinfo") or token["id_token"]  # authlib parses id_token when nonce matches
    user_data = {
        "sub": claims["sub"],
        "email": claims["email"],
        "name": claims.get("name"),  # nullable per D-12
    }
    await upsert_user(db, **user_data)   # D-11
    request.session["user"] = user_data  # only {sub, email, name} — D-01
    return RedirectResponse(url="/", status_code=303)  # D-07
```

### 4. Postgres async upsert
```python
# backend/app/services/users.py
# Source: https://docs.sqlalchemy.org/en/20/dialects/postgresql.html#insert-on-conflict-upsert
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import func
from app.models import AppUser
from sqlalchemy.ext.asyncio import AsyncSession

async def upsert_user(db: AsyncSession, sub: str, email: str, name: str | None) -> None:
    stmt = insert(AppUser).values(sub=sub, email=email, name=name)
    stmt = stmt.on_conflict_do_update(
        index_elements=["sub"],
        set_={
            "email": stmt.excluded.email,
            "name": stmt.excluded.name,
            "last_seen_at": func.now(),
        },
    )
    await db.execute(stmt)
    await db.commit()
```

### 5. get_current_user + /api/auth/me
```python
# backend/app/security/auth.py
from fastapi import Request, HTTPException, Depends
from app.schemas import CurrentUser
from app.config import settings

SYNTHETIC_USER = CurrentUser(sub="dev-user", email="dev@localhost", name="Dev User")  # D-13

def get_current_user(request: Request) -> CurrentUser:
    if settings.DISABLE_AUTH:
        return SYNTHETIC_USER                    # D-14
    raw = request.session.get("user")
    if not raw:
        raise HTTPException(401, "Unauthenticated")  # D-18
    return CurrentUser(**raw)

# in routers/auth.py:
@router.get("/me", response_model=CurrentUser)
async def me(user: CurrentUser = Depends(get_current_user)):
    return user  # KPO-03
```

### 6. /api/auth/logout
```python
# backend/app/routers/auth.py
@router.post("/logout")
async def logout(request: Request):
    request.session.pop("user", None)
    return RedirectResponse(url="/", status_code=303)  # D-08
```

### 7. Router-wide dependency (D-17)
```python
# backend/app/routers/uploads.py (and the 5 others)
from app.security.auth import get_current_user
router = APIRouter(
    prefix="/api/uploads",
    tags=["uploads"],
    dependencies=[Depends(get_current_user)],   # KPO-07
)
# all existing routes now return 401 without a session
```

### 8. DISABLE_AUTH lifespan hook
```python
# backend/app/scheduler.py (existing lifespan)
import logging
from contextlib import asynccontextmanager
from app.config import settings
from app.services.users import upsert_user
from app.database import async_session_maker

logger = logging.getLogger("app")

@asynccontextmanager
async def lifespan(app):
    if settings.DISABLE_AUTH:
        logger.warning("⚠ DISABLE_AUTH=true — authentication is bypassed. DO NOT use in production.")  # D-15
        async with async_session_maker() as db:
            await upsert_user(db, sub="dev-user", email="dev@localhost", name="Dev User")  # D-14
    # ... existing APScheduler startup ...
    yield
    # ... existing teardown ...
```

### 9. useCurrentUser hook
```ts
// frontend/src/hooks/useCurrentUser.ts
import { useQuery } from "@tanstack/react-query";

export type CurrentUser = { sub: string; email: string; name: string | null };

export function useCurrentUser() {
  return useQuery<CurrentUser>({
    queryKey: ["auth", "me"],                         // D-22
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) throw new Error("unauthenticated");
      if (!res.ok) throw new Error(`auth/me failed: ${res.status}`);
      return res.json();
    },
    retry: false,                                     // D-22
    staleTime: Infinity,                              // D-22
    gcTime: Infinity,
  });
}
```

### 10. ProtectedRoute component
```tsx
// frontend/src/components/ProtectedRoute.tsx
import { useEffect } from "react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { AuthSplash } from "./AuthSplash";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: user, isPending, isError } = useCurrentUser();

  useEffect(() => {
    if (isError) window.location.href = "/api/auth/login";  // D-21
  }, [isError]);

  if (isPending || isError || !user) return <AuthSplash />;  // D-20
  return <>{children}</>;
}
```

### 11. NavBar user display + logout form
```tsx
// frontend/src/components/NavBar.tsx (additions)
import { useCurrentUser } from "../hooks/useCurrentUser";

function UserChunk() {
  const { data: user } = useCurrentUser();
  if (!user) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{user.name ?? user.email}</span>   {/* D-23, KPO-09 */}
      <form method="POST" action="/api/auth/logout">
        <button type="submit" className="...">
          {t("auth.logout")}
        </button>
      </form>
    </div>
  );
}
```

### 12. Alembic `app_users` migration (autogenerated; verify defaults)
```python
# backend/alembic/versions/XXXX_add_app_users.py
import sqlalchemy as sa
from alembic import op

def upgrade():
    op.create_table(
        "app_users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("sub", sa.Text, nullable=False, unique=True),   # D-10
        sa.Column("email", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=True),                # D-12
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_seen_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )

def downgrade():
    op.drop_table("app_users")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `python-jose` + manual OIDC wiring | `authlib` integrations | Authlib 1.x (stable years) | Single-library OIDC; project already decided D-04. |
| Flask session / client-side tokens in JS | Starlette SessionMiddleware (server-signed, httpOnly) | Starlette 0.x | Prevents XSS token theft; JS cannot read `httpOnly`. |
| OAuth2 implicit flow | Authorization Code + PKCE (S256) | RFC 7636 + OAuth 2.1 draft (~2020+) | PKCE is mandatory for public clients and best practice for confidential clients; authlib handles it. |
| `create_all()` migrations | Alembic `--autogenerate` | SQLAlchemy 1.4+ | Project-locked via CLAUDE.md. |

**Deprecated/outdated:**
- RP-initiated logout spec via `end_session_endpoint` is defined in OIDC but Dex v2.43.0 does not implement it (tracked upstream; v2 item).
- Dex `hash-password` subcommand was **removed in v2.43.0** (noted in Phase 27) — bcrypt via `python:3.12-alpine` is the canonical path. **Not Phase 28's problem** but affects user-add runbook if extended here.

## Open Questions

1. **Should the auth router be registered in `main.py` WITH or WITHOUT a router-level dependency?**
   - What we know: D-18 says auth endpoints are bypassed from `get_current_user`, but `/api/auth/me` itself uses `Depends(get_current_user)` to get the 401-or-user behavior.
   - What's unclear: Whether to register `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout` with NO dependency, and put the dependency only on `/me` (cleanest) OR put the dependency at router level and override per-endpoint.
   - Recommendation: **No dependency at auth router level; add `Depends(get_current_user)` only on `/me`.** Simpler mental model and matches D-18 intent.

2. **404 vs 503 on auth endpoints when `DISABLE_AUTH=true` (D-16)?**
   - What we know: Both would work as a signal.
   - Recommendation: **503 Service Unavailable with a JSON body `{"detail": "DISABLE_AUTH=true; OIDC endpoints disabled"}`.** Explicit "unavailable" is more honest and debuggable than pretending routes don't exist. Still returns a visible error if someone hits them.

3. **Where does the session `user` dict go in the Pydantic world?**
   - Recommendation: A small `SessionUser(BaseModel)` in `schemas.py` for write-time validation, then serialize via `.model_dump()` into the session dict. `CurrentUser` is the response model for `/me`. They can be the same class.

4. **Should `/health` be truly auth-free?**
   - Yes — D-18 confirms. It's on the app root, outside any router, so it's already free of the router-level dependency. Leave as-is.

5. **Does the Phase 27 `DEX_KPI_SECRET` need to be re-read under a new name?**
   - Phase 27 D-14 says "downstream phases read the SAME env var names." Recommendation: In KPI Light config, read `DEX_KPI_SECRET` as the value for the Dex client secret. Map it via Pydantic BaseSettings alias if desired, but keep one name across the stack.

## Validation Architecture

*Skipped — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`.*

## Sources

### Primary (HIGH confidence)
- Authlib FastAPI / Starlette client docs — https://docs.authlib.org/en/latest/client/fastapi.html
- Starlette SessionMiddleware — https://www.starlette.io/middleware/#sessionmiddleware
- SQLAlchemy 2.0 Postgres ON CONFLICT — https://docs.sqlalchemy.org/en/20/dialects/postgresql.html#insert-on-conflict-upsert
- SQLAlchemy 2.0 Async I/O — https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
- PyPI authlib 1.6.10 — verified live 2026-04-15
- PyPI itsdangerous 2.2.0 — verified live 2026-04-15
- TanStack Query v5 — https://tanstack.com/query/v5/docs
- FastAPI dependencies + routers — https://fastapi.tiangolo.com/tutorial/dependencies/
- Phase 27 CONTEXT.md — in-repo, decisions D-01..D-26 on Dex setup
- Phase 28 CONTEXT.md — in-repo, decisions D-01..D-23 on KPI Light integration
- `backend/requirements.txt` — actual installed versions

### Secondary (MEDIUM confidence)
- Wouter + React 19 interaction: inferred from the existing `App.tsx` usage; `<Switch>` expects `<Route>` children — known limitation.

### Tertiary (LOW confidence)
- None — all assertions backed by a primary source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against PyPI/npm and project files.
- Architecture: HIGH — 23 locked decisions leave very little to infer.
- Pitfalls: HIGH — each pitfall is a known authlib/Starlette/Postgres gotcha with a canonical mitigation.
- Code examples: HIGH — verified against official docs; adjusted to existing project conventions (`app.database.get_session`, `wouter` router).

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (30 days — authlib + SQLAlchemy 2.0 are stable APIs; Dex is pinned at v2.43.0)
