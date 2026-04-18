---
phase: 28-rbac-enforcement-on-all-routes
plan: "01"
subsystem: backend-auth
tags: [rbac, fastapi, auth, security]
dependency_graph:
  requires: [27-02-router-wiring-and-env]
  provides: [require_admin dep, mutation route gating]
  affects: [backend/app/security/directus_auth.py, backend/app/routers/uploads.py, backend/app/routers/sync.py, backend/app/routers/settings.py]
tech_stack:
  added: []
  patterns: [FastAPI Depends chain for RBAC enforcement, per-route dependencies list]
key_files:
  created:
    - backend/tests/test_require_admin.py
  modified:
    - backend/app/security/directus_auth.py
    - backend/app/routers/uploads.py
    - backend/app/routers/sync.py
    - backend/app/routers/settings.py
decisions:
  - require_admin is sync (not async) — FastAPI awaits the dep chain via get_current_user; the checker itself has no I/O
  - Per-route enforcement via dependencies=[] list on decorator — not middleware, not router-level
metrics:
  duration: ~5min
  completed: "2026-04-15T20:22:52Z"
  tasks: 2
  files: 4
---

# Phase 28 Plan 01: require_admin dep and mutation route gating Summary

**One-liner:** sync `require_admin` FastAPI dep (403 on non-admin) wired to 6 mutation route decorators across uploads, sync, and settings routers.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add require_admin dependency to directus_auth.py (TDD) | 9ca35f6 | directus_auth.py, test_require_admin.py |
| 2 | Apply Depends(require_admin) to 6 mutation decorators | 11f5343 | uploads.py, sync.py, settings.py |

## Verification Results

- `grep -rn 'Depends(require_admin)' backend/app/routers/ | wc -l` → 6
- `python -m pytest tests/test_require_admin.py tests/test_directus_auth.py -v` → 13 passed
- `python -c "from app.main import app"` → import ok
- All GET routes in kpis.py, hr_kpis.py, data.py — untouched (confirmed clean)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `backend/app/security/directus_auth.py` — exists, contains `require_admin`
- `backend/tests/test_require_admin.py` — exists, 2 tests pass
- Commit 9ca35f6 — verified in git log
- Commit 11f5343 — verified in git log
