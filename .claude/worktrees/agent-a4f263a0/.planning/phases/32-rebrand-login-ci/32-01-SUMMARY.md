---
phase: 32-rebrand-login-ci
plan: "01"
subsystem: backend, frontend
tags: [rebrand, public-endpoint, logo]
dependency_graph:
  requires: []
  provides: [GET /api/settings/logo/public, KPI Dashboard branding]
  affects: [backend/app/defaults.py, backend/app/main.py, backend/app/routers/settings.py, frontend/index.html, frontend/src/lib/defaults.ts, frontend/src/locales/en.json, frontend/src/locales/de.json, frontend/src/pages/LoginPage.tsx]
tech_stack:
  added: []
  patterns: [public APIRouter alongside authenticated router]
key_files:
  created: []
  modified:
    - backend/app/defaults.py
    - backend/app/main.py
    - backend/app/routers/settings.py
    - frontend/index.html
    - frontend/src/lib/defaults.ts
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
    - frontend/src/pages/LoginPage.tsx
decisions:
  - public_router pattern: separate APIRouter with no dependencies alongside authenticated router for unauthenticated logo endpoint
metrics:
  duration: 3min
  completed: "2026-04-16"
  tasks: 2
  files: 8
---

# Phase 32 Plan 01: Rebrand KPI Light to KPI Dashboard + Public Logo Endpoint Summary

**One-liner:** Renamed "KPI Light" to "KPI Dashboard" across all 8 UI surfaces and added unauthenticated GET /api/settings/logo/public endpoint.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rename KPI Light to KPI Dashboard | 567f444 | backend/app/defaults.py, backend/app/main.py, frontend/src/lib/defaults.ts, frontend/src/locales/en.json, frontend/src/locales/de.json, frontend/index.html, frontend/src/pages/LoginPage.tsx |
| 2 | Add public logo endpoint | 28aa658 | backend/app/routers/settings.py, backend/app/main.py |

## Deviations from Plan

None — all 8 rename locations updated, public endpoint added as specified.

## Known Stubs

None.

## Self-Check: PASSED

- Zero occurrences of "KPI Light" in any modified files (Alembic migrations intentionally preserved)
- backend/app/routers/settings.py: contains `get_logo_public` and `public_router`
- backend/app/main.py: contains `settings_public_router` import and include
