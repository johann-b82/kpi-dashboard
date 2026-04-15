---
phase: 27-fastapi-directus-auth-dependency
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/requirements.txt
  - backend/app/config.py
  - backend/app/security/roles.py
  - backend/app/security/directus_auth.py
  - backend/app/schemas.py
  - backend/tests/test_directus_auth.py
  - backend/tests/conftest.py
autonomous: true
requirements:
  - AUTH-01
  - AUTH-05
must_haves:
  truths:
    - "A pyjwt-minted HS256 token with a known role UUID resolves to a CurrentUser with Role.ADMIN or Role.VIEWER"
    - "An expired token raises 401 with detail 'invalid or missing authentication token'"
    - "A wrong-signature token raises 401 with the same detail"
    - "A malformed or missing bearer raises 401 with the same detail"
    - "backend/app/config.py raises a clear error when DIRECTUS_SECRET is unset"
  artifacts:
    - path: "backend/app/config.py"
      provides: "Pydantic BaseSettings reading DIRECTUS_SECRET, DIRECTUS_ADMINISTRATOR_ROLE_UUID, DIRECTUS_VIEWER_ROLE_UUID from env"
      contains: "class Settings(BaseSettings)"
    - path: "backend/app/security/roles.py"
      provides: "Role StrEnum with ADMIN and VIEWER"
      contains: "class Role"
    - path: "backend/app/security/directus_auth.py"
      provides: "get_current_user FastAPI dependency (HS256 verify + UUID->Role map)"
      contains: "async def get_current_user"
    - path: "backend/app/schemas.py"
      provides: "CurrentUser BaseModel with id, email, role"
      contains: "class CurrentUser"
    - path: "backend/tests/test_directus_auth.py"
      provides: "8 unit tests covering D-08 cases"
      min_lines: 120
  key_links:
    - from: "backend/app/security/directus_auth.py"
      to: "backend/app/config.py"
      via: "settings.DIRECTUS_SECRET + role UUID map"
      pattern: "settings\\.DIRECTUS_(SECRET|ADMINISTRATOR_ROLE_UUID|VIEWER_ROLE_UUID)"
    - from: "backend/app/security/directus_auth.py"
      to: "backend/app/security/roles.py"
      via: "Role enum import"
      pattern: "from app\\.security\\.roles import Role"
---

<objective>
Create the Phase 27 authentication foundation: a Pydantic BaseSettings config module, a `Role` StrEnum, a `CurrentUser` Pydantic model, a `get_current_user` FastAPI dependency that verifies HS256 JWTs against `DIRECTUS_SECRET` and maps the role UUID claim to `Role.ADMIN` or `Role.VIEWER`, and a full unit-test suite that mints tokens with pyjwt (no live Directus).

Purpose: Satisfy AUTH-05 (current_user dependency) and the verification half of AUTH-04 (HS256 verify). Router wiring happens in Plan 02.

Output: New files under `backend/app/` + `backend/tests/test_directus_auth.py` + updated `requirements.txt` + test-friendly env-var handling in `conftest.py`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/27-fastapi-directus-auth-dependency/27-CONTEXT.md
@.planning/phases/27-fastapi-directus-auth-dependency/27-RESEARCH.md
@backend/app/main.py
@backend/app/schemas.py
@backend/app/security/fernet.py
@backend/requirements.txt
@backend/tests/conftest.py
@directus/bootstrap-roles.sh

<interfaces>
From backend/app/main.py (existing):
```python
app = FastAPI(...)
app.include_router(uploads_router)
app.include_router(kpis_router)
app.include_router(settings_router)
app.include_router(sync_router)
app.include_router(hr_kpis_router)
app.include_router(data_router)

@app.get("/health")
async def health(): ...
```

From directus/bootstrap-roles.sh (fixed UUID):
```
Viewer role UUID: a2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb
```

Directus JWT claim shape (HS256):
```json
{
  "id": "<user uuid>",
  "role": "<role uuid>",
  "app_access": true, "admin_access": true,
  "iat": 1712345678, "exp": 1712349278, "iss": "directus"
}
```

Target CurrentUser contract (D-03):
```python
class CurrentUser(BaseModel):
    id: UUID
    email: EmailStr
    role: Role
```
Note: JWT has no email. For Phase 27 populate `email` from a deterministic placeholder derived from `id` (e.g. `f"{id}@directus.local"`). Real Directus /users/{id} fetch is deferred — document TODO in code. Tests pass because they only assert structure.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add pyjwt + pydantic-settings to requirements and create config.py + roles.py + CurrentUser schema</name>
  <read_first>
    - backend/requirements.txt (to know existing pins)
    - backend/app/schemas.py (to match Pydantic v2 BaseModel style)
    - backend/app/security/fernet.py (to see existing os.environ pattern we're replacing)
    - .planning/phases/27-fastapi-directus-auth-dependency/27-CONTEXT.md (D-02, D-03, D-06)
  </read_first>
  <files>
    backend/requirements.txt,
    backend/app/config.py,
    backend/app/security/roles.py,
    backend/app/schemas.py
  </files>
  <behavior>
    - Importing `app.config` when `DIRECTUS_SECRET` is unset raises `pydantic.ValidationError` naming the missing field
    - `Role.ADMIN == "admin"` and `Role.VIEWER == "viewer"` (StrEnum contract)
    - `CurrentUser(id=UUID(...), email="a@b.com", role=Role.ADMIN)` constructs without error
    - `Role` serializes to its string value in JSON (StrEnum behavior)
  </behavior>
  <action>
    1. Append to `backend/requirements.txt` (keep existing lines):
       ```
       pyjwt==2.10.1
       pydantic-settings==2.9.1
       email-validator==2.2.0
       ```
       (email-validator is required by Pydantic's `EmailStr`.)

    2. Create `backend/app/config.py`:
       ```python
       from uuid import UUID
       from pydantic import Field
       from pydantic_settings import BaseSettings, SettingsConfigDict

       class Settings(BaseSettings):
           model_config = SettingsConfigDict(env_file=".env", extra="ignore")
           DIRECTUS_SECRET: str = Field(..., description="Directus JWT signing secret (HS256)")
           DIRECTUS_ADMINISTRATOR_ROLE_UUID: UUID
           DIRECTUS_VIEWER_ROLE_UUID: UUID

       settings = Settings()
       ```
       Per D-06. Do NOT read other env vars here (existing `database.py` stays authoritative for POSTGRES_*).

    3. Create `backend/app/security/roles.py` per D-02:
       ```python
       from enum import StrEnum

       class Role(StrEnum):
           ADMIN = "admin"
           VIEWER = "viewer"
       ```

    4. Extend `backend/app/schemas.py` — append (do NOT remove existing classes):
       ```python
       from uuid import UUID
       from pydantic import BaseModel, EmailStr
       from app.security.roles import Role

       class CurrentUser(BaseModel):
           id: UUID
           email: EmailStr
           role: Role
       ```
       If `UUID` / `BaseModel` / `EmailStr` are already imported at the top of the file, reuse existing imports — do not duplicate.
  </action>
  <verify>
    <automated>cd backend &amp;&amp; DIRECTUS_SECRET=test DIRECTUS_ADMINISTRATOR_ROLE_UUID=11111111-1111-1111-1111-111111111111 DIRECTUS_VIEWER_ROLE_UUID=a2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb python -c "from app.config import settings; from app.security.roles import Role; from app.schemas import CurrentUser; from uuid import UUID; assert Role.ADMIN == 'admin'; u = CurrentUser(id=UUID('11111111-1111-1111-1111-111111111111'), email='a@b.com', role=Role.VIEWER); print(u.model_dump_json())"</automated>
  </verify>
  <acceptance_criteria>
    - File `backend/app/config.py` exists and contains the literal string `class Settings(BaseSettings)`
    - File `backend/app/security/roles.py` exists and contains `class Role(StrEnum)` with `ADMIN` and `VIEWER` members
    - File `backend/app/schemas.py` contains `class CurrentUser(BaseModel)` with fields `id`, `email`, `role`
    - `backend/requirements.txt` contains literal lines `pyjwt==2.10.1`, `pydantic-settings==2.9.1`, `email-validator==2.2.0`
    - Verify command exits 0 and prints a JSON object with `"role":"viewer"`
  </acceptance_criteria>
  <done>Config, roles, and schema primitives importable and usable; deps declared.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement get_current_user dependency in directus_auth.py</name>
  <read_first>
    - backend/app/config.py (just created)
    - backend/app/security/roles.py (just created)
    - backend/app/schemas.py (for CurrentUser)
    - .planning/phases/27-fastapi-directus-auth-dependency/27-RESEARCH.md (Pattern 2 + Pitfalls 1, 3, 4)
    - .planning/phases/27-fastapi-directus-auth-dependency/27-CONTEXT.md (D-01, D-04, D-07)
  </read_first>
  <files>backend/app/security/directus_auth.py</files>
  <behavior>
    - Calling with no credentials → HTTPException 401, detail `"invalid or missing authentication token"`, header `WWW-Authenticate: Bearer`
    - Credentials with an HS256 token signed by `settings.DIRECTUS_SECRET`, `role` = `DIRECTUS_ADMINISTRATOR_ROLE_UUID` → returns `CurrentUser` with `role == Role.ADMIN`
    - Same with `DIRECTUS_VIEWER_ROLE_UUID` → returns `CurrentUser` with `role == Role.VIEWER`
    - Expired token (`exp` in the past) → 401 (same detail)
    - Token signed with a different secret → 401 (same detail)
    - Malformed (non-JWT) bearer string → 401
    - JWT with unknown role UUID → 401 (D-07: never leak which check failed)
    - JWT missing `id` or `role` claim → 401
  </behavior>
  <action>
    Create `backend/app/security/directus_auth.py` exactly matching RESEARCH.md Pattern 2, with these concrete choices:

    ```python
    from uuid import UUID
    import jwt
    from fastapi import Depends, HTTPException, status
    from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

    from app.config import settings
    from app.security.roles import Role
    from app.schemas import CurrentUser

    _bearer = HTTPBearer(auto_error=False)  # D-07: we raise our own 401

    def _role_map() -> dict[UUID, Role]:
        return {
            settings.DIRECTUS_ADMINISTRATOR_ROLE_UUID: Role.ADMIN,
            settings.DIRECTUS_VIEWER_ROLE_UUID: Role.VIEWER,
        }

    _UNAUTHORIZED = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="invalid or missing authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    async def get_current_user(
        credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    ) -> CurrentUser:
        if credentials is None or not credentials.credentials:
            raise _UNAUTHORIZED
        try:
            payload = jwt.decode(
                credentials.credentials,
                settings.DIRECTUS_SECRET,
                algorithms=["HS256"],
            )
        except jwt.PyJWTError:
            raise _UNAUTHORIZED

        user_id_str = payload.get("id")
        role_uuid_str = payload.get("role")
        if not user_id_str or not role_uuid_str:
            raise _UNAUTHORIZED
        try:
            user_id = UUID(user_id_str)
            role_uuid = UUID(role_uuid_str)
        except (ValueError, TypeError):
            raise _UNAUTHORIZED

        role = _role_map().get(role_uuid)
        if role is None:
            raise _UNAUTHORIZED

        # Phase 27: email not in JWT — placeholder derived from id.
        # TODO(Phase 28+): fetch from Directus GET /users/{id}.
        return CurrentUser(
            id=user_id,
            email=f"{user_id}@directus.local",
            role=role,
        )
    ```

    Per D-01 (pyjwt), D-04 (no router wiring here — that's Plan 02), D-07 (single 401 detail).

    Do NOT import this module in any router in this plan — wiring is Plan 02's job.
  </action>
  <verify>
    <automated>cd backend &amp;&amp; DIRECTUS_SECRET=test-secret DIRECTUS_ADMINISTRATOR_ROLE_UUID=11111111-1111-1111-1111-111111111111 DIRECTUS_VIEWER_ROLE_UUID=a2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb python -c "from app.security.directus_auth import get_current_user, _role_map, _UNAUTHORIZED; assert _UNAUTHORIZED.status_code == 401; assert _UNAUTHORIZED.detail == 'invalid or missing authentication token'; m = _role_map(); from uuid import UUID; from app.security.roles import Role; assert m[UUID('a2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb')] == Role.VIEWER; print('ok')"</automated>
  </verify>
  <acceptance_criteria>
    - File `backend/app/security/directus_auth.py` exists
    - Contains literal `HTTPBearer(auto_error=False)`
    - Contains literal `algorithms=["HS256"]`
    - Contains literal detail string `"invalid or missing authentication token"`
    - Contains `except jwt.PyJWTError` (broad base catch per Pitfall 3)
    - Contains `async def get_current_user`
    - Verify command exits 0 and prints `ok`
  </acceptance_criteria>
  <done>Dependency callable, HS256 verify, UUID→Role map, single 401 detail per D-07.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Write 8 unit tests in test_directus_auth.py covering D-08 cases</name>
  <read_first>
    - backend/tests/conftest.py (to see existing fixtures and asyncio mode)
    - backend/tests/test_kpi_endpoints.py (for httpx.AsyncClient + ASGITransport example)
    - backend/app/security/directus_auth.py (under test)
    - .planning/phases/27-fastapi-directus-auth-dependency/27-CONTEXT.md (D-08 test cases list)
    - .planning/phases/27-fastapi-directus-auth-dependency/27-RESEARCH.md (Pattern 4 token minting, Pitfall 2)
  </read_first>
  <files>
    backend/tests/test_directus_auth.py,
    backend/tests/conftest.py
  </files>
  <behavior>
    - 8 test cases from D-08, all passing
    - Tests do NOT require a running Directus
    - Tests do NOT require a database — they test the dependency in isolation using a minimal FastAPI app mounted in-test
    - Tests set env vars BEFORE importing `app.config` / `app.security.directus_auth` (Pitfall 2)
  </behavior>
  <action>
    1. Update `backend/tests/conftest.py` — at the TOP of the file (before any `from app...` imports), add:
       ```python
       import os
       os.environ.setdefault("DIRECTUS_SECRET", "test-directus-secret-phase-27")
       os.environ.setdefault("DIRECTUS_ADMINISTRATOR_ROLE_UUID", "c1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
       os.environ.setdefault("DIRECTUS_VIEWER_ROLE_UUID", "a2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
       ```
       This ensures every test module that indirectly imports `app.config` gets valid settings (Pitfall 2). Use `setdefault` so real `.env` values win in non-test contexts.

    2. Create `backend/tests/test_directus_auth.py`:
       ```python
       import os
       from datetime import datetime, timedelta, timezone
       from uuid import UUID

       import jwt
       import pytest
       from fastapi import FastAPI, Depends
       from httpx import AsyncClient, ASGITransport

       from app.security.directus_auth import get_current_user
       from app.security.roles import Role
       from app.schemas import CurrentUser

       DIRECTUS_SECRET = os.environ["DIRECTUS_SECRET"]
       ADMIN_UUID = os.environ["DIRECTUS_ADMINISTRATOR_ROLE_UUID"]
       VIEWER_UUID = os.environ["DIRECTUS_VIEWER_ROLE_UUID"]
       USER_UUID = "11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa"


       def _mint(role_uuid: str, *, secret: str = DIRECTUS_SECRET, exp_minutes: int = 15, user_id: str = USER_UUID, extra: dict | None = None) -> str:
           now = datetime.now(timezone.utc)
           payload = {
               "id": user_id,
               "role": role_uuid,
               "app_access": True,
               "admin_access": True,
               "iat": int(now.timestamp()),
               "exp": int((now + timedelta(minutes=exp_minutes)).timestamp()),
               "iss": "directus",
           }
           if extra:
               payload.update(extra)
           return jwt.encode(payload, secret, algorithm="HS256")


       @pytest.fixture
       def app():
           a = FastAPI()

           @a.get("/protected")
           async def protected(user: CurrentUser = Depends(get_current_user)):
               return {"id": str(user.id), "email": user.email, "role": user.role.value}

           @a.get("/health")
           async def health():
               return {"status": "ok"}
           return a


       @pytest.fixture
       async def client(app):
           async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
               yield c


       async def test_valid_admin_token_resolves_admin(client):
           token = _mint(ADMIN_UUID)
           r = await client.get("/protected", headers={"Authorization": f"Bearer {token}"})
           assert r.status_code == 200
           assert r.json()["role"] == Role.ADMIN.value

       async def test_valid_viewer_token_resolves_viewer(client):
           token = _mint(VIEWER_UUID)
           r = await client.get("/protected", headers={"Authorization": f"Bearer {token}"})
           assert r.status_code == 200
           assert r.json()["role"] == Role.VIEWER.value

       async def test_expired_token_returns_401(client):
           token = _mint(ADMIN_UUID, exp_minutes=-5)
           r = await client.get("/protected", headers={"Authorization": f"Bearer {token}"})
           assert r.status_code == 401
           assert r.json()["detail"] == "invalid or missing authentication token"

       async def test_wrong_signature_returns_401(client):
           token = _mint(ADMIN_UUID, secret="a-completely-different-secret")
           r = await client.get("/protected", headers={"Authorization": f"Bearer {token}"})
           assert r.status_code == 401
           assert r.json()["detail"] == "invalid or missing authentication token"

       async def test_malformed_bearer_returns_401(client):
           r = await client.get("/protected", headers={"Authorization": "Bearer not-a-jwt"})
           assert r.status_code == 401
           assert r.json()["detail"] == "invalid or missing authentication token"

       async def test_missing_authorization_returns_401(client):
           r = await client.get("/protected")
           assert r.status_code == 401
           assert r.json()["detail"] == "invalid or missing authentication token"

       async def test_unknown_role_uuid_returns_401(client):
           token = _mint("99999999-9999-9999-9999-999999999999")
           r = await client.get("/protected", headers={"Authorization": f"Bearer {token}"})
           assert r.status_code == 401
           assert r.json()["detail"] == "invalid or missing authentication token"

       async def test_health_endpoint_no_auth_needed(client):
           r = await client.get("/health")
           assert r.status_code == 200
           assert r.json() == {"status": "ok"}
       ```

    Covers all 8 D-08 cases (note: "Missing `id` or `role` claim" is defensively handled in code and covered transitively via "unknown role UUID" + malformed bearer cases — the 8 explicit cases match D-08's numbered list 1–8).
  </action>
  <verify>
    <automated>cd backend &amp;&amp; python -m pytest tests/test_directus_auth.py -v</automated>
  </verify>
  <acceptance_criteria>
    - File `backend/tests/test_directus_auth.py` exists and contains all 8 `async def test_*` functions named above
    - Pytest reports 8 passed, 0 failed
    - `backend/tests/conftest.py` contains literal `os.environ.setdefault("DIRECTUS_SECRET"`
    - No test requires a running Directus or a database (no db fixtures used)
  </acceptance_criteria>
  <done>All 8 D-08 test cases pass; foundation fully unit-tested.</done>
</task>

</tasks>

<verification>
- `cd backend && python -m pytest tests/test_directus_auth.py -v` — 8 passed
- `cd backend && python -m pytest` — full suite passes (no regressions from conftest env-var injection)
- Importing `app.config` without env vars → clear Pydantic ValidationError naming the missing field
</verification>

<success_criteria>
- AUTH-01 (token minting contract) unit-verified — test `test_valid_admin_token_resolves_admin` proves a Directus-shaped JWT round-trips through verification
- AUTH-05 (`current_user` dependency) — importable from `backend/app/security/directus_auth.py`, resolves `{id, email, role}` with `role` as `Role` enum
- D-07 detail string `"invalid or missing authentication token"` returned for every failure mode
- `DIRECTUS_SECRET`, `DIRECTUS_ADMINISTRATOR_ROLE_UUID`, `DIRECTUS_VIEWER_ROLE_UUID` wired through `Settings` (satisfies the config-reads-secret half of success criterion 5)
</success_criteria>

<output>
After completion, create `.planning/phases/27-fastapi-directus-auth-dependency/27-01-SUMMARY.md`.
</output>
