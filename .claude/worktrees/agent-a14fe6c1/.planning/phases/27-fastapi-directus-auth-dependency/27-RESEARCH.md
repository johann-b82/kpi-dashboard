# Phase 27: FastAPI Directus Auth Dependency - Research

**Researched:** 2026-04-15
**Domain:** FastAPI JWT authentication, PyJWT 2.x, Pydantic v2 BaseSettings
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

1. JWT algorithm: **HS256** with shared `DIRECTUS_SECRET` (already in `.env` from Phase 26).
2. Directus admin role realized as `Administrator` (built-in), viewer as `Viewer` — both with fixed UUIDs in `directus/bootstrap-roles.sh`.
3. No RLS; FastAPI is the single authz entry point.
4. Directus REST not exposed to browser — frontend hits FastAPI only.

**D-01** — JWT library: `pyjwt==2.10.1` (or current latest 2.x). Rejected `python-jose` and `authlib`.

**D-02** — Role matching: internal `Role(StrEnum)` with UUID→Role map in `directus_auth.py` via `settings.DIRECTUS_ADMINISTRATOR_ROLE_UUID` and `settings.DIRECTUS_VIEWER_ROLE_UUID`.

**D-03** — `current_user` return type: `CurrentUser(BaseModel)` with `{id: UUID, email: EmailStr, role: Role}`.

**D-04** — Unauthenticated endpoints: `/health`, `/docs`, `/redoc`, `/openapi.json`. Every `/api/*` route requires a valid bearer.

**D-05** — Dep plumbing: `dependencies=[Depends(current_user)]` at the `APIRouter` constructor for all 6 existing routers.

**D-06** — Directus role UUIDs via env vars: `DIRECTUS_SECRET`, `DIRECTUS_ADMINISTRATOR_ROLE_UUID`, `DIRECTUS_VIEWER_ROLE_UUID` added to `backend/app/config.py` (new file) and `.env`/`.env.example`.

**D-07** — All 401 cases return `{"detail": "invalid or missing authentication token"}` — one message for all failure modes.

**D-08** — Tests in `backend/tests/test_directus_auth.py` using `jwt.encode(...)` to mint test tokens. No live Directus dependency.

### Claude's Discretion

- Email lookup strategy: CONTEXT.md recommends `GET /users/{user_id}` with the user's own bearer, cached per-request via `functools.lru_cache` keyed on `user_id`. No Redis. Planner should make a concrete decision on whether to include or defer this.

### Deferred Ideas (OUT OF SCOPE)

- Role-based 403s (Phase 28)
- Frontend login + bearer attachment (Phase 29)
- Refresh-token flow (Phase 29)
- Sign-out endpoint behavior (Phase 29)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | A seeded user can POST /auth/login directly to Directus with email+password and receive a valid JWT (access + refresh tokens) | Directus 11 `/auth/login` endpoint confirmed; test covered by minting tokens with pyjwt |
| AUTH-04 | FastAPI validates every `/api/*` request's `Authorization: Bearer <jwt>` against the Directus JWT shared secret (HS256) and rejects expired/invalid tokens with 401 | `HTTPBearer` + `jwt.decode()` pattern verified; error types confirmed |
| AUTH-05 | `current_user` FastAPI dependency resolves `{id, email, role}` from the verified JWT; available to all protected routes | Directus JWT claim shape confirmed; UUID→Role mapping pattern verified |
</phase_requirements>

---

## Summary

Phase 27 adds HS256 JWT verification to FastAPI using `pyjwt` 2.x. Directus issues JWT tokens containing the user's `id` (UUID) and `role` (UUID) in the payload — the email is NOT in the JWT and must be fetched separately. FastAPI uses `HTTPBearer` to extract the token, `jwt.decode()` to verify it, and a UUID→`Role` enum map to resolve the application role.

The existing codebase has no `backend/app/config.py` — this file must be created as a new Pydantic `BaseSettings` module reading env vars. All 6 existing `APIRouter` instances are plain `APIRouter(prefix=..., tags=[...])` constructors, making it straightforward to add `dependencies=[Depends(get_current_user)]` in one shot per router.

The `/health` endpoint already exists in `main.py` (added prior to Phase 27) and does not need to be created. Tests use `pytest-asyncio` in `auto` mode with `httpx.AsyncClient` via `ASGITransport` — the new auth tests should follow this established pattern.

**Primary recommendation:** Create `backend/app/config.py` (Pydantic BaseSettings), `backend/app/security/directus_auth.py` (HTTPBearer + jwt.decode + role map), add `pyjwt` to `requirements.txt`, wire router-level `dependencies=`, and write 8 unit tests using pyjwt-minted tokens.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pyjwt | 2.10.1+ (2.12.1 on host) | JWT encode/decode, HS256 verify | Locked by D-01; actively maintained; no known security advisories unlike python-jose |
| FastAPI | 0.135.3 | Already present; `HTTPBearer` built-in | Project standard |
| Pydantic v2 | via FastAPI 0.135.3 | `BaseModel` for `CurrentUser`; `BaseSettings` for config | Project standard |
| pydantic-settings | 2.x (via Pydantic ecosystem) | `BaseSettings` class | Pydantic v2 split `BaseSettings` into separate `pydantic-settings` package |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| httpx | 0.28.1 (already in requirements) | Async HTTP for Directus `/users/{id}` email lookup | If email-lookup-per-request is implemented |

### Installation

```bash
# Add to backend/requirements.txt
pyjwt==2.10.1
pydantic-settings==2.9.1   # if not already present — required for BaseSettings in Pydantic v2
```

**Version verification:** PyJWT 2.12.1 is installed on the host. CONTEXT.md specifies `pyjwt==2.10.1` — pin to that version for reproducibility. Check if `pydantic-settings` is already a transitive dependency before adding.

---

## Architecture Patterns

### Recommended Project Structure

```
backend/app/
├── config.py                  # NEW — Pydantic BaseSettings (DIRECTUS_SECRET, role UUIDs)
├── security/
│   ├── __init__.py
│   ├── fernet.py              # existing
│   ├── logo_validation.py     # existing
│   ├── roles.py               # NEW — Role(StrEnum)
│   └── directus_auth.py       # NEW — get_current_user Depends + JWT decode
├── schemas.py                 # EXTEND — add CurrentUser(BaseModel)
├── routers/                   # MODIFY — add dependencies=[Depends(get_current_user)] to each
│   ├── data.py
│   ├── hr_kpis.py
│   ├── kpis.py
│   ├── settings.py
│   ├── sync.py
│   └── uploads.py
backend/tests/
└── test_directus_auth.py      # NEW — 8 test cases
```

### Pattern 1: Pydantic BaseSettings for Config

```python
# backend/app/config.py
from uuid import UUID
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Existing (already read via os.environ in database.py — document here for clarity)
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str

    # Phase 27 additions
    DIRECTUS_SECRET: str = Field(..., description="Directus JWT signing secret (HS256)")
    DIRECTUS_ADMINISTRATOR_ROLE_UUID: UUID
    DIRECTUS_VIEWER_ROLE_UUID: UUID

settings = Settings()
```

**Important:** `pydantic-settings` is a separate package from `pydantic` in v2. Verify it is already installed as a transitive dependency via `pip show pydantic-settings`. If not, add to `requirements.txt`.

### Pattern 2: JWT Verification Dependency

```python
# backend/app/security/directus_auth.py
from uuid import UUID
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import settings
from app.security.roles import Role
from app.schemas import CurrentUser

_bearer = HTTPBearer(auto_error=False)

_ROLE_MAP: dict[UUID, Role] = {}  # populated at import time after settings are loaded

def _get_role_map() -> dict[UUID, Role]:
    return {
        settings.DIRECTUS_ADMINISTRATOR_ROLE_UUID: Role.ADMIN,
        settings.DIRECTUS_VIEWER_ROLE_UUID: Role.VIEWER,
    }

async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    _401 = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="invalid or missing authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise _401
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.DIRECTUS_SECRET,
            algorithms=["HS256"],
        )
    except jwt.PyJWTError:
        raise _401

    user_id_str: str | None = payload.get("id")
    role_uuid_str: str | None = payload.get("role")
    if not user_id_str or not role_uuid_str:
        raise _401

    try:
        role_uuid = UUID(role_uuid_str)
    except ValueError:
        raise _401

    role = _get_role_map().get(role_uuid)
    if role is None:
        raise _401  # unknown role UUID (D-07: don't leak which check failed)

    # Email is NOT in the Directus JWT — populate via lookup or leave as placeholder
    # See "Email Lookup Strategy" section below
    return CurrentUser(id=UUID(user_id_str), email=f"{user_id_str}@directus.internal", role=role)
```

**Key design decisions in this pattern:**
- `HTTPBearer(auto_error=False)` — returns `None` instead of raising 422 when header is absent; lets us return the standardized 401 message (D-07)
- Catch broad `jwt.PyJWTError` base — covers `ExpiredSignatureError`, `InvalidSignatureError`, `DecodeError`, all subclasses
- `_get_role_map()` called inline (not module-level) to avoid import-time `settings` resolution failures during testing

### Pattern 3: Router-Level Auth Wiring

```python
# Example: backend/app/routers/kpis.py (apply to all 6 routers)
from app.security.directus_auth import get_current_user
from fastapi import Depends

router = APIRouter(
    prefix="/api/kpis",
    tags=["kpis"],
    dependencies=[Depends(get_current_user)],   # <-- add this line
)
```

Routes that also need the user value (e.g., for audit logging in Phase 28+) can add `current_user: CurrentUser = Depends(get_current_user)` as a parameter — FastAPI deduplicates the call.

### Pattern 4: Test Token Minting

```python
# backend/tests/test_directus_auth.py
import jwt
from datetime import datetime, timedelta, timezone

DIRECTUS_SECRET = "test-secret-for-phase-27"
VIEWER_ROLE_UUID = "a2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
ADMIN_ROLE_UUID  = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # from .env at plan-time

def make_token(role_uuid: str, secret: str = DIRECTUS_SECRET, exp_delta_minutes: int = 15) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "id": "11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "role": role_uuid,
        "app_access": True,
        "admin_access": True,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=exp_delta_minutes)).timestamp()),
        "iss": "directus",
    }
    return jwt.encode(payload, secret, algorithm="HS256")
```

**Note:** The `email` field in `CurrentUser` presents a testing challenge if email lookup hits real Directus. Planner must decide: (a) mock the lookup, (b) defer email to Phase 28+, or (c) omit email from this phase and add a placeholder. Recommendation: defer email population to Phase 28 where a Directus HTTP client can be properly mocked; for Phase 27, populate `email` as a derived string or omit from `CurrentUser` entirely.

### Anti-Patterns to Avoid

- **`auto_error=True` on `HTTPBearer`:** FastAPI returns a 403 with `"Not authenticated"` on missing header instead of 401 — violates D-07. Always use `auto_error=False`.
- **Module-level `_ROLE_MAP` initialized from `settings`:** `Settings()` is instantiated at import time; if `DIRECTUS_SECRET` is unset in tests, the import fails with a pydantic validation error instead of a useful message.
- **Catching `Exception` instead of `jwt.PyJWTError`:** Too broad; masks real bugs.
- **Per-route `Depends(get_current_user)` instead of router-level:** Risk of accidentally shipping unprotected routes.
- **Using `latest` PyJWT:** Pin to `==2.10.1` (or specific 2.x) for reproducible builds.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bearer token extraction | Custom `Authorization` header parser | `HTTPBearer` from `fastapi.security` | Handles RFC 7235 parsing, scheme validation, and `auto_error` correctly |
| JWT decode + expiry check | Manual `exp` timestamp comparison | `jwt.decode(..., algorithms=["HS256"])` | pyjwt handles `exp`, `iat`, clock skew, and algorithm validation atomically |
| Env var validation with useful errors | `os.environ.get()` with if-not-set checks | Pydantic `BaseSettings` with `Field(...)` | Pydantic raises on import with field name and type — far better DX than runtime KeyError |

**Key insight:** FastAPI's `HTTPBearer` + pyjwt together cover 95% of the auth concern. The only custom code needed is the UUID→Role mapping.

---

## Scouted Assets (Phase 27 baseline)

| Asset | Status | Finding |
|-------|--------|---------|
| `backend/app/main.py` | EXISTS | `/health` endpoint IS present and returns `{"status": "ok"}` — no need to create it. CONTEXT.md risk note was incorrect for current state. |
| `backend/app/config.py` | DOES NOT EXIST | Must be created. Current pattern is `os.environ[...]` in `database.py` and `os.environ.get()` in `fernet.py`. New `config.py` introduces Pydantic BaseSettings. |
| `backend/app/security/` | EXISTS | Contains `fernet.py`, `logo_validation.py`. New `roles.py` and `directus_auth.py` land here. |
| `backend/requirements.txt` | EXISTS | Has FastAPI, uvicorn, httpx, etc. Missing: `pyjwt`. |
| 6 routers | EXISTS | All use simple `APIRouter(prefix=..., tags=[...])` — clean injection point for `dependencies=`. |
| `backend/app/schemas.py` | EXISTS | Pydantic v2 `BaseModel` pattern. `CurrentUser` goes here (or `security/schemas.py`). |
| `backend/tests/` | EXISTS | `pytest-asyncio` with `asyncio_mode = auto`. `conftest.py` provides `client` fixture via `ASGITransport`. Tests for `test_directus_auth.py` should NOT use `client` fixture (no DB needed — pure unit tests). |
| Viewer UUID | CONFIRMED | `a2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb` from `directus/bootstrap-roles.sh` |
| Administrator UUID | UNKNOWN at research time | Must be fetched from running Directus: `GET /roles?filter[name][_eq]=Administrator` with admin token |

---

## Email Lookup Strategy — Decision Required

The Directus JWT does NOT contain `email`. The locked `CurrentUser` schema requires `{id, email, role}`.

**Options (planner must choose one):**

**Option A — Fetch from Directus per request (CONTEXT.md recommendation)**
```python
# GET /users/{user_id} with the user's own bearer token
# Cache with functools.lru_cache(maxsize=256) — effective for 150 users
```
- Pro: Accurate, no schema compromise
- Con: Adds one HTTP round-trip per request; tests must mock the lookup

**Option B — Defer email to Phase 28**
Remove `email` from `CurrentUser` in Phase 27; add it in Phase 28 when HTTP client infrastructure is set up. Phase 27 schema becomes `{id, role}` only.
- Pro: Phase 27 stays self-contained and unit-testable without HTTP mocks
- Con: Phase 28 becomes a breaking schema change for any code that imports `CurrentUser`

**Option C — Email from JWT issuer lookup at login time (future pattern)**
Store email in a short-lived in-process dict keyed on `user_id` during token validation — requires the frontend to call a `GET /users/me` endpoint after login to warm the cache. Overly complex.

**Research recommendation:** Use Option A but add the Directus HTTP call as a separate `async def _fetch_email(user_id: str, bearer: str) -> str` helper with `@lru_cache` — isolates the concern and is straightforward to test with `unittest.mock.AsyncMock`.

---

## Common Pitfalls

### Pitfall 1: `HTTPBearer(auto_error=True)` Returns 403, Not 401

**What goes wrong:** Default `HTTPBearer()` raises `HTTPException(403, "Not authenticated")` on a missing header — different status code than spec requires and different from D-07.
**Why it happens:** FastAPI defaults `auto_error=True` which raises on missing/invalid scheme.
**How to avoid:** Always instantiate `_bearer = HTTPBearer(auto_error=False)` and handle `None` credentials explicitly.

### Pitfall 2: Pydantic BaseSettings Import Fails if Env Var Unset

**What goes wrong:** `from app.config import settings` at module import time triggers `Settings()` constructor; if `DIRECTUS_SECRET` is missing from environment, Pydantic raises `ValidationError` and the entire app fails to import.
**Why it happens:** Pydantic v2 `BaseSettings` validates eagerly on instantiation.
**How to avoid:** In tests that don't test auth, either set env vars in `conftest.py` before import, or use `monkeypatch.setenv` in test fixtures. The `test_directus_auth.py` tests must explicitly set `DIRECTUS_SECRET`, `DIRECTUS_ADMINISTRATOR_ROLE_UUID`, and `DIRECTUS_VIEWER_ROLE_UUID` in the environment before importing `directus_auth`.

### Pitfall 3: Catching Only Specific JWT Exceptions Misses Cases

**What goes wrong:** Catching only `ExpiredSignatureError` passes malformed tokens as if valid.
**Why it happens:** pyjwt has 10+ exception subclasses all under `PyJWTError`.
**How to avoid:** Always catch `jwt.PyJWTError` (the base class) — confirmed via `jwt.PyJWTError.__mro__`.

### Pitfall 4: `UUID` Type Comparison for Role Map

**What goes wrong:** Role UUID from JWT comes as a string (`"aeccfcd7-..."`); dict key is `UUID` object — `str != UUID`, lookup returns `None`.
**Why it happens:** `jwt.decode()` returns raw claim values (strings for string claims).
**How to avoid:** Convert role UUID string to `UUID(role_uuid_str)` before dict lookup. Wrap in `try/except ValueError` to catch malformed UUIDs.

### Pitfall 5: `pydantic-settings` Not in requirements.txt

**What goes wrong:** `from pydantic_settings import BaseSettings` raises `ModuleNotFoundError` in Docker even though it works locally (installed as a transitive dep of something else).
**Why it happens:** Pydantic v2 split `BaseSettings` into a separate package; it may be present locally via another package but not declared.
**How to avoid:** Explicitly add `pydantic-settings` to `backend/requirements.txt`.

### Pitfall 6: Router-Level `dependencies=` Applied After Router Creation

**What goes wrong:** Adding `dependencies=[...]` to an existing router via `router.dependencies.append(...)` is not the correct API; behavior is undefined.
**Why it happens:** Confusion with middleware.
**How to avoid:** Set `dependencies=` in the `APIRouter(...)` constructor. This requires modifying the constructor call in each router file.

---

## Directus JWT Claim Shape (Verified from CONTEXT.md + Directus 11 docs)

```json
{
  "id": "2ff1a528-...",        // directus_users.id (UUID string)
  "role": "aeccfcd7-...",      // directus_roles.id (UUID string) — NOT the role name
  "app_access": true,
  "admin_access": true,
  "iat": 1712345678,
  "exp": 1712349278,
  "iss": "directus"
}
```

**Critical:** `role` is a UUID, not `"Administrator"` or `"Viewer"`. The UUID→Role mapping is mandatory.
**Note:** `app_access` and `admin_access` are booleans in the claim but Phase 27 does NOT gate on them — only the `role` UUID maps to `Role.ADMIN`/`Role.VIEWER`. Phase 28 may revisit.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pyjwt | JWT decode | Partial (host only) | 2.12.1 (host) | Must add to requirements.txt for Docker |
| pydantic-settings | BaseSettings | Unknown in Docker | — | Must verify and add to requirements.txt |
| Python 3.x | All | ✓ | 3.9 (host) | — |
| Directus (running) | Administrator UUID lookup | ✓ (Phase 26 complete) | 11.17.2 | — |

**Missing dependencies with no fallback:**
- `pyjwt` must be added to `backend/requirements.txt` (not installed in Docker image currently)

**Missing dependencies with fallback:**
- `pydantic-settings` — verify it exists as transitive dep; add explicitly if not

---

## Open Questions

1. **Is `pydantic-settings` already a transitive dependency in the Docker image?**
   - What we know: It may be pulled in by FastAPI or another package
   - What's unclear: Not visible in `requirements.txt`; Docker build may not have it
   - Recommendation: Add `pydantic-settings` to `requirements.txt` explicitly regardless

2. **What is the Administrator role UUID in the running Directus instance?**
   - What we know: It is generated by Directus on first boot and stored in `directus_roles`
   - What's unclear: The exact UUID — differs per install
   - Recommendation: Executor runs `curl -s http://localhost:8055/auth/login -d '{"email":"...","password":"..."}' | jq .data.access_token` then `curl -s -H "Authorization: Bearer <token>" http://localhost:8055/roles?filter[name][_eq]=Administrator | jq .data[0].id` and writes UUID to `.env`

3. **Does `CurrentUser` include `email` in Phase 27 or Phase 28?**
   - What we know: JWT has no email; Directus `/users/{id}` has it; CONTEXT.md recommends a per-request fetch
   - What's unclear: Whether the added HTTP complexity belongs in this phase
   - Recommendation: Include email in `CurrentUser` schema (locked by D-03) but implement the fetch as a simple `httpx.AsyncClient` call — httpx is already in `requirements.txt`

---

## Project Constraints (from CLAUDE.md)

- Must run via Docker Compose — no bare-metal dependencies
- Use `docker compose` (v2, no hyphen)
- PostgreSQL 17-alpine
- FastAPI 0.135.3, Pydantic v2, SQLAlchemy 2.0 async
- Never hardcode credentials — all secrets in `.env`
- Do NOT use `--reload` in Docker production container
- Always use `AsyncSession` with `create_async_engine` (no sync engine in FastAPI handlers)
- Alembic owns schema migrations; never call `Base.metadata.create_all()` directly
- All API routers currently follow `APIRouter(prefix="/api/...")` pattern

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `backend/app/main.py`, `backend/app/routers/kpis.py`, `backend/app/security/fernet.py`, `backend/requirements.txt`, `directus/bootstrap-roles.sh`
- `python3 -c "import jwt; ..."` — verified pyjwt 2.x API, exception hierarchy, encode/decode behavior
- `backend/pytest.ini` — confirmed `asyncio_mode = auto`
- `backend/tests/conftest.py` — confirmed httpx ASGITransport pattern

### Secondary (MEDIUM confidence)
- CONTEXT.md `27-CONTEXT.md` — Directus JWT claim shape from Directus 11 docs (cited in context)
- FastAPI `HTTPBearer(auto_error=False)` behavior — standard FastAPI security module behavior

### Tertiary (LOW confidence)
- Email lookup per-request performance characteristics — based on reasoning about 150-user scale

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pyjwt API verified by direct execution; FastAPI HTTPBearer confirmed
- Architecture: HIGH — all existing code scouted; patterns derived from existing codebase conventions
- Pitfalls: HIGH — auto_error pitfall and UUID type pitfall verified by API inspection; pydantic-settings split is documented behavior

**Research date:** 2026-04-15
**Valid until:** 2026-07-15 (stable libraries — pyjwt, FastAPI, Pydantic v2 are not fast-moving)
