---
phase: 27-fastapi-directus-auth-dependency
plan: "01"
subsystem: backend-auth
tags: [auth, jwt, hs256, fastapi, pydantic-settings, unit-tests]
dependency_graph:
  requires: []
  provides:
    - backend/app/config.py (Settings BaseSettings)
    - backend/app/security/roles.py (Role StrEnum)
    - backend/app/security/directus_auth.py (get_current_user dependency)
    - backend/app/schemas.py (CurrentUser model)
  affects:
    - backend/tests/conftest.py
tech_stack:
  added:
    - pyjwt==2.10.1
    - pydantic-settings==2.9.1
    - email-validator==2.2.0
  patterns:
    - Pydantic BaseSettings for env-var config with validation
    - HTTPBearer(auto_error=False) + single 401 detail (D-07)
    - StrEnum for serialization-safe role enum
key_files:
  created:
    - backend/app/config.py
    - backend/app/security/roles.py
    - backend/app/security/directus_auth.py
    - backend/tests/test_directus_auth.py
  modified:
    - backend/requirements.txt
    - backend/app/schemas.py
    - backend/tests/conftest.py
decisions:
  - placeholder-email-domain: Use {uuid}@directus.example.com instead of @directus.local — pydantic-email-validator rejects .local TLD as reserved
  - oserror-catch: Broadened reset_settings except to include OSError so auth unit tests run without a database
metrics:
  duration: "~6 minutes"
  completed: "2026-04-15"
  tasks_completed: 3
  files_changed: 7
requirements:
  - AUTH-01
  - AUTH-05
---

# Phase 27 Plan 01: Auth Dependency Foundation Summary

**One-liner:** HS256 JWT verification dependency with pyjwt, Pydantic Settings config, Role StrEnum, CurrentUser schema, and 8 D-08 unit tests requiring no live Directus.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add deps + config.py + roles.py + CurrentUser schema | 40db312 | requirements.txt, config.py, roles.py, schemas.py |
| 2 | Implement get_current_user dependency | 5de5e03 | directus_auth.py |
| 3 | Write 8 unit tests for D-08 cases | 1ac2af6 | test_directus_auth.py, conftest.py (+ directus_auth.py fix) |

---

## What Was Built

- **`backend/app/config.py`** — `Settings(BaseSettings)` reading `DIRECTUS_SECRET`, `DIRECTUS_ADMINISTRATOR_ROLE_UUID`, `DIRECTUS_VIEWER_ROLE_UUID` from env/`.env`; raises `pydantic.ValidationError` when any field is missing
- **`backend/app/security/roles.py`** — `Role(StrEnum)` with `ADMIN="admin"` and `VIEWER="viewer"`; serializes to string value in JSON automatically
- **`backend/app/security/directus_auth.py`** — `get_current_user` FastAPI dependency: verifies HS256 JWT against `DIRECTUS_SECRET`, maps role UUID claim to `Role` enum, returns `CurrentUser`; uses `HTTPBearer(auto_error=False)` and emits a single 401 detail string for all failure modes (D-07)
- **`backend/app/schemas.py`** extended with `CurrentUser(BaseModel)` — `id: UUID`, `email: EmailStr`, `role: Role`
- **`backend/tests/test_directus_auth.py`** — 8 async pytest tests covering all D-08 cases (valid admin, valid viewer, expired, wrong signature, malformed bearer, missing auth, unknown role UUID, health no-auth)

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Placeholder email domain `.local` rejected by pydantic-email-validator**
- **Found during:** Task 3 test run
- **Issue:** Plan example suggested `f"{id}@directus.local"` but pydantic's `EmailStr` with email-validator rejects `.local` as a reserved/special-use TLD
- **Fix:** Changed placeholder to `f"{user_id}@directus.example.com"` — `example.com` is an IANA-designated valid test domain
- **Files modified:** `backend/app/security/directus_auth.py`
- **Commit:** 1ac2af6

**2. [Rule 2 - Missing error handling] `reset_settings` autouse fixture crashed with `socket.gaierror` (OSError subclass)**
- **Found during:** Task 3 test run
- **Issue:** The existing `conftest.py` `reset_settings` fixture caught `(SQLAlchemyError, RuntimeError)` but not `OSError`; DNS resolution for `db` host fails in unit-test-only Docker containers
- **Fix:** Broadened exception catch to `(SQLAlchemyError, RuntimeError, OSError)` with explanatory comment
- **Files modified:** `backend/tests/conftest.py`
- **Commit:** 1ac2af6

**3. [Rule 3 - Blocking] Missing POSTGRES_* env vars prevented conftest import**
- **Found during:** Task 3 test run
- **Issue:** `conftest.py` imports `app.main` at module level which chains to `app.database` which reads `POSTGRES_USER` etc. from `os.environ`; absent in unit-test containers
- **Fix:** Added `os.environ.setdefault("POSTGRES_*", ...)` defaults at top of conftest
- **Files modified:** `backend/tests/conftest.py`
- **Commit:** 1ac2af6

---

## Known Stubs

- **`backend/app/security/directus_auth.py:58`** — `email=f"{user_id}@directus.example.com"` is a placeholder. Real email should come from `GET /users/{id}` Directus API call. Marked with `# TODO(Phase 28+)` in code. Intentional — Phase 28 will wire the real user fetch.

---

## Self-Check: PASSED
