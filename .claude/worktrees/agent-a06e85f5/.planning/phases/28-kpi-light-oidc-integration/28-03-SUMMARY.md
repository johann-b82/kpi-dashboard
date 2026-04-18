---
phase: 28-kpi-light-oidc-integration
plan: "03"
subsystem: backend-router-guards
tags: [oidc, fastapi, auth, router-guards]
requires: [28-01]
provides:
  - router-level auth gate on /api/uploads
  - router-level auth gate on /api/kpis
  - router-level auth gate on /api/settings
  - router-level auth gate on /api/sync
  - router-level auth gate on /api/hr
  - router-level auth gate on /api/data
affects:
  - backend/app/routers/uploads.py
  - backend/app/routers/kpis.py
  - backend/app/routers/settings.py
  - backend/app/routers/sync.py
  - backend/app/routers/hr_kpis.py
  - backend/app/routers/data.py
tech_stack_added: []
patterns:
  - APIRouter(dependencies=[Depends(get_current_user)]) applied once per router at construction time
key_files_created: []
key_files_modified:
  - backend/app/routers/uploads.py
  - backend/app/routers/kpis.py
  - backend/app/routers/settings.py
  - backend/app/routers/sync.py
  - backend/app/routers/hr_kpis.py
  - backend/app/routers/data.py
decisions:
  - Router-level dependency (not per-endpoint) — single source of truth, minimal diff, hard to accidentally bypass
  - Did not touch backend/app/main.py (/health stays on app, not a router) — intentional per D-18
  - Did not touch backend/app/routers/auth.py — /api/auth/* must stay publicly reachable
metrics:
  duration: 3min
  completed: 2026-04-15
  tasks: 1
  files: 6
---

# Phase 28 Plan 03: Router Guards Summary

Added `dependencies=[Depends(get_current_user)]` to every existing business `APIRouter` so all `/api/{uploads,kpis,settings,sync,hr,data}/*` routes return 401 without a `kpi_session` cookie. Zero logic changes — six files, three lines each (import + two-line router kwarg). `/health` and `/api/auth/*` stay publicly reachable. With `DISABLE_AUTH=true`, the synthetic user injected by `get_current_user` (Plan 01) bypasses the gate and routes return 200.

## What Shipped

All six business routers now carry a router-level auth dependency. Each file received the same minimal delta: import `get_current_user` from `app.security.auth` and extend the `router = APIRouter(...)` constructor with `dependencies=[Depends(get_current_user)]`. `Depends` was already imported in every file from the existing per-endpoint `Depends(get_async_db_session)` pattern, so no import expansion was needed.

### Router prefix reference (for Plan 05 docs)

| File | Prefix | Tags |
|------|--------|------|
| `uploads.py` | `/api` | — (uploads live at `/api/upload`, `/api/uploads`) |
| `kpis.py` | `/api/kpis` | `["kpis"]` |
| `settings.py` | `/api/settings` | — |
| `sync.py` | `/api/sync` | — |
| `hr_kpis.py` | `/api/hr` | `["hr-kpis"]` |
| `data.py` | `/api/data` | `["data"]` |

Note: `uploads.py` uses the bare `/api` prefix (endpoints declare their own `/upload` or `/uploads` subpath). The router-level auth guard still catches every route defined on it.

## Verification Results

- `grep -l "dependencies=\[Depends(get_current_user)\]" backend/app/routers/{uploads,kpis,settings,sync,hr_kpis,data}.py | wc -l` → `6`
- `grep -q "from app.security.auth import get_current_user"` in each of the six routers → all pass
- Python AST parse of all six files → ok (no syntax errors)
- `docker compose up -d api` → container healthy, no import errors
- Unauthenticated curls (default `DISABLE_AUTH=false`):
  - `GET /api/settings` → **401**
  - `GET /api/uploads` → **401**
  - `GET /api/kpis` → **401**
  - `POST /api/sync` → **401** (GET returns 405 — method-not-allowed dispatched before deps; POST which is the real method returns 401)
  - `POST /api/upload` → **401**
  - `GET /api/data/sales` → **401**
  - `GET /api/hr/kpis` → **401**
  - `GET /health` → **200** (unchanged)
  - `GET /api/auth/me` → **401** (as expected — /me itself validates session from Plan 02)
  - `GET /api/auth/login` → 500 in local test, but unrelated to this plan (SESSION_SECRET blank + Dex cert trust — pre-existing env concern; `/api/auth/login` is NOT 401, which is the acceptance criterion)
- `DISABLE_AUTH=true` flip + api restart → `GET /api/settings` inside the container returns **200** (synthetic user passes the gate)

## Output Spec Answers

- **Router prefix table** — see above under "Router prefix reference".
- **Did any router need a new Depends import?** No. All six already imported `Depends` for their existing per-endpoint DB-session dependency. Only `get_current_user` had to be added.
- **Did any existing per-endpoint dependency get touched?** No — Plan 03 strictly appends the router-level dependency alongside existing per-endpoint ones, no removals.

## Deviations from Plan

None — plan executed exactly as written. One clarification worth noting: `/api/sync` with a bare `GET` returns 405 rather than 401 because FastAPI dispatches method-not-allowed before router dependencies run. The real `POST /api/sync` endpoint (which is the only method the router defines) correctly returns 401. This matches the plan's intent ("all business routes return 401 when called without a session") — any route FastAPI *will* dispatch a handler for now runs through the auth gate first.

## Unblocks

- **Plan 28-04** (frontend login bootstrap / DISABLE_AUTH dev bypass) — can now prove both halves of the gate from the browser
- **Plan 28-05** (end-to-end verification) — all six router prefixes guarded, ready for full login → session cookie → access flow walkthrough

## Commits

- `b0c155f` feat(28-03): guard six business routers with get_current_user

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: backend/app/routers/uploads.py (dependencies present)
- FOUND: backend/app/routers/kpis.py (dependencies present)
- FOUND: backend/app/routers/settings.py (dependencies present)
- FOUND: backend/app/routers/sync.py (dependencies present)
- FOUND: backend/app/routers/hr_kpis.py (dependencies present)
- FOUND: backend/app/routers/data.py (dependencies present)
- FOUND commit: b0c155f
