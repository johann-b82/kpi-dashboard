---
phase: 27-fastapi-directus-auth-dependency
plan: "02"
subsystem: backend-auth
tags: [auth, jwt, router, fastapi, integration-tests, env]
dependency_graph:
  requires:
    - backend/app/security/directus_auth.py (get_current_user — from 27-01)
  provides:
    - backend/app/routers/*.py (all 6 gated with auth dependency)
    - .env.example (DIRECTUS_ADMINISTRATOR_ROLE_UUID documented)
  affects:
    - All /api/* endpoints — now require Authorization: Bearer <jwt>
tech_stack:
  added: []
  patterns:
    - Router-level dependencies=[Depends(get_current_user)] — single flip-point per router
    - Live UUID fetch via curl+jq from running Directus instance
key_files:
  created:
    - backend/tests/test_directus_auth.py (3 new tests appended)
  modified:
    - backend/app/routers/data.py
    - backend/app/routers/hr_kpis.py
    - backend/app/routers/kpis.py
    - backend/app/routers/settings.py
    - backend/app/routers/sync.py
    - backend/app/routers/uploads.py
    - .env.example
decisions:
  - directus-filter-workaround: Directus v11 /roles?filter[name][_eq]=Administrator returned empty array; used jq select(.name=="Administrator") client-side instead
metrics:
  duration: "~6 minutes"
  completed: "2026-04-15"
  tasks_completed: 3
  files_changed: 8
requirements:
  - AUTH-04
---

# Phase 27 Plan 02: Router Wiring and Env Summary

**One-liner:** Applied `dependencies=[Depends(get_current_user)]` to all 6 `/api/*` routers and captured Administrator role UUID from live Directus into `.env`/`.env.example`, proven end-to-end by 11 passing auth tests.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fetch Administrator UUID + update .env.example | f520777 | .env.example (.env gitignored) |
| 2 | Add auth dependency to all 6 routers | 1b136fc | routers/data.py, hr_kpis.py, kpis.py, settings.py, sync.py, uploads.py |
| 3 | Add 3 end-to-end auth tests | e3b9569 | tests/test_directus_auth.py |

---

## What Was Built

- **All 6 `/api/*` routers** now declare `dependencies=[Depends(get_current_user)]` in their `APIRouter(...)` constructor — a single flip-point per file that automatically gates every current and future route on that router.
- **`.env`** updated with `DIRECTUS_ADMINISTRATOR_ROLE_UUID=aeccfcd7-3dd0-4a0f-9c35-96699a8dd760` and `DIRECTUS_VIEWER_ROLE_UUID=a2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb` (gitignored, not committed).
- **`.env.example`** documents both UUID variables with curl+jq generation instructions for fresh installs.
- **3 integration tests** appended to `test_directus_auth.py`:
  - `test_real_api_route_requires_bearer`: GET `/api/kpis` without bearer → 401
  - `test_real_api_route_accepts_valid_bearer`: GET `/api/kpis` with viewer JWT → not 401
  - `test_real_health_endpoint_no_auth`: GET `/health` → 200 always
- **11/11 tests pass** (8 from 27-01 + 3 new).

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Directus v11 role filter returned empty array**
- **Found during:** Task 1
- **Issue:** `curl "http://localhost:8055/roles?filter[name][_eq]=Administrator"` returned `{"data":[]}` — the query-string filter syntax for Directus v11 did not match
- **Fix:** Fetched all roles and applied `jq '.data[] | select(.name=="Administrator") | .id'` client-side
- **Files modified:** none (shell command only; .env.example curl snippet also updated to use jq select)
- **Commit:** f520777

---

## Known Stubs

None introduced in this plan. The email stub from 27-01 (`{uuid}@directus.example.com`) remains in `directus_auth.py` and is tracked in 27-01 SUMMARY.

---

## Self-Check: PASSED
