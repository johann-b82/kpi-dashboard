---
phase: 28-rbac-enforcement-on-all-routes
plan: "02"
subsystem: backend-auth
tags: [rbac, testing, docs, fastapi, auth]
dependency_graph:
  requires: [28-01-require-admin-and-mutation-gating]
  provides: [RBAC matrix tests, docs/api.md route contract]
  affects: [backend/tests/test_rbac.py, docs/api.md]
tech_stack:
  added: []
  patterns: [pytest parametrize for matrix test, ASGI test transport via httpx]
key_files:
  created:
    - backend/tests/test_rbac.py
    - docs/api.md
  modified: []
decisions:
  - Import _mint/ADMIN_UUID/VIEWER_UUID from test_directus_auth.py to avoid duplication — single source of truth for JWT minting in tests
  - tests run inside Docker container (exec -T api) — no local venv; system pip too old for pinned versions
metrics:
  duration: ~10min
  completed: "2026-04-15T20:45:57Z"
  tasks: 2
  files: 2
---

# Phase 28 Plan 02: RBAC matrix test and API docs Summary

**One-liner:** parametrized pytest matrix (37 tests, 12 GET routes × 2 roles + 6 mutation deny/allow + RBAC-04 JWT swap) plus `docs/api.md` as the canonical Admin-vs-Viewer route contract.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create backend/tests/test_rbac.py with full parametrized RBAC matrix | 5fa8808 | backend/tests/test_rbac.py |
| 2 | Create docs/api.md with Admin-vs-Viewer route matrix | 20ddfcc | docs/api.md |

## Verification Results

- `python -m pytest tests/test_rbac.py -v` (inside Docker) → 37 passed
- Full suite without test_rbac.py: 78 passed / 29 failed (pre-existing failures in settings/rebuild tests, unrelated to this plan)
- Full suite with test_rbac.py: 115 passed / 29 failed (same pre-existing failures; +37 new passes)
- `wc -l docs/api.md` → 54 lines (≥30 required)
- All verify grep checks passed: route matrix header, all 6 mutation paths, GET count ≥12, both error body strings present

## Coverage Satisfied

- **RBAC-01:** 24 parametrized tests prove all 12 authenticated GET routes allow Viewer + Admin (no 401/403)
- **RBAC-02:** 6 parametrized tests prove all 6 mutation decorators return 403 + `{"detail": "admin role required"}` for Viewer
- **RBAC-04:** `test_rbac_04_same_user_role_swap_via_jwt` — same user_id, viewer JWT → 403, admin JWT → passes; proves role propagation is purely JWT-driven, stateless
- **RBAC-05:** `docs/api.md` — human-readable Admin-vs-Viewer route matrix, 21 rows, both error shapes documented

## Deviations from Plan

**[Rule 3 - Blocking] Tests run inside Docker, not bare-metal**
- **Found during:** Task 1 verification
- **Issue:** No Python virtual env on host; system pip (21.2.4) too old to find pinned package versions (fastapi==0.135.3, alembic==1.18.4)
- **Fix:** Used `docker compose exec -T api python -m pytest` — the API container has all dependencies installed; tests ran cleanly
- **Impact:** None — test results identical to what CI would produce in the container environment

## Known Stubs

None — this plan produces test code and documentation only; no UI-rendered data paths affected.

## Self-Check: PASSED

- `backend/tests/test_rbac.py` — exists, 109 lines, contains `@pytest.mark.parametrize` 3 times, `admin role required` string present, `test_rbac_04_same_user_role_swap_via_jwt` present
- `docs/api.md` — exists, 54 lines, contains `| Method | Path | Viewer | Admin |`, all 6 mutation paths, 15 GET rows, both error body strings
- Commit 5fa8808 — verified
- Commit 20ddfcc — verified
