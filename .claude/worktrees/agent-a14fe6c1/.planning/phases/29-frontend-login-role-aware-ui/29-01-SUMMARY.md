---
phase: 29-frontend-login-role-aware-ui
plan: 01
subsystem: backend-auth
tags: [auth, cors, api, directus]
requires:
  - Phase 27 get_current_user dependency
  - Phase 26 Directus container + role UUIDs
provides:
  - GET /api/me endpoint returning {id, email, role as lowercase string}
  - Directus CORS configured for localhost:5173 with credentials
affects:
  - backend/app/main.py (router registration)
  - docker-compose.yml (directus env)
tech-stack:
  added: []
  patterns:
    - Reused CurrentUser + get_current_user dep from Phase 27
    - StrEnum .value serialization for role string
    - Reused _mint JWT helper from test_directus_auth.py
key-files:
  created:
    - backend/app/routers/me.py
    - backend/tests/test_me_endpoint.py
  modified:
    - backend/app/main.py
    - docker-compose.yml
decisions:
  - Role StrEnum values already lowercase — no further transformation needed, but defensive .lower() retained
  - Tests import _mint from test_directus_auth.py to keep JWT minting DRY (same pattern as Phase 28)
metrics:
  duration_minutes: 5
  tasks: 2
  files: 4
  completed: 2026-04-15
requirements: [AUTH-03]
---

# Phase 29 Plan 01: Backend /api/me + CORS Summary

**One-liner:** Added `GET /api/me` FastAPI route exposing authenticated user as `{id, email, role: 'admin'|'viewer'}` and enabled Directus CORS with credentials for the Vite dev server at `localhost:5173`.

## What Shipped

### Task 1: GET /api/me endpoint (TDD)
- **RED commit** `7735d0a`: Added 4 failing tests covering admin, viewer, no-auth 401, expired-token 401
- **GREEN commit** `af2430a`: Implemented `backend/app/routers/me.py` with `MeResponse` Pydantic model and wired into `main.py`
- Uses existing `get_current_user` dep from Phase 27; serializes `Role` StrEnum to lowercase string
- All 4 new tests + 11 existing auth tests pass (15/15)

### Task 2: Directus CORS
- **commit** `30309a8`: Updated `docker-compose.yml` Directus service env:
  - `CORS_ENABLED: "true"`
  - `CORS_ORIGIN: "http://localhost:5173"`
  - `CORS_CREDENTIALS: "true"` (load-bearing for httpOnly refresh cookie)
- Removed obsolete `CORS_ENABLED: "false"` default
- `docker compose config -q` validates

## Verification

- `docker compose exec -T api pytest tests/test_me_endpoint.py -x` → 4 passed
- `docker compose exec -T api pytest tests/test_directus_auth.py -x` → 11 passed (no regressions)
- `docker compose config -q` → exit 0 (yaml valid)
- All 4 acceptance grep checks on docker-compose.yml pass

## Deviations from Plan

None — plan executed exactly as written.

## Deferred Issues (out of scope)

29 pre-existing test failures in `tests/test_settings_api.py`, `tests/test_hr_kpis.py`, `tests/test_data_api.py`, etc. Verified pre-existing (same failures on HEAD before changes: 33 failures; my changes touch none of these files). These are Phase 27/28 RBAC-era fixtures expecting bearer auth — out of scope for this plan. Tracked in deferred-items.md if not already.

## Commits

| Hash      | Type  | Message                                                       |
| --------- | ----- | ------------------------------------------------------------- |
| `7735d0a` | test  | add failing tests for GET /api/me endpoint                    |
| `af2430a` | feat  | add GET /api/me endpoint exposing role as lowercase string    |
| `30309a8` | chore | enable Directus CORS for SPA at localhost:5173                |

## Self-Check: PASSED

- FOUND: backend/app/routers/me.py
- FOUND: backend/tests/test_me_endpoint.py
- FOUND: commit 7735d0a
- FOUND: commit af2430a
- FOUND: commit 30309a8
- FOUND: me_router import + include in backend/app/main.py
- FOUND: 3x CORS keys in docker-compose.yml; 0x CORS_ENABLED:"false"
