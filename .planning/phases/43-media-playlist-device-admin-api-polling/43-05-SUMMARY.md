---
phase: 43-media-playlist-device-admin-api-polling
plan: 05
subsystem: signage
tags: [test, ci-guards, dep-audit, contract-tests]
requires:
  - plan 43-03 (admin router wired into main.py)
  - plan 43-04 (player router wired into main.py)
provides:
  - backend/tests/test_signage_router_deps.py (dep-audit for admin + player routes)
  - backend/tests/test_signage_ci_guards.py (grep guards for sqlite3/psycopg2/sync-subprocess)
affects:
  - CI pipeline (new contract tests that must stay green)
tech_stack:
  added: []
  patterns:
    - "walk app.routes[].dependant.dependencies via _walk_deps to audit FastAPI dep trees"
    - "subprocess.run grep -r as in-pytest CI guard (pattern borrowed from test_snmp_poller_ci_guards.py)"
key_files:
  created:
    - backend/tests/test_signage_router_deps.py
    - backend/tests/test_signage_ci_guards.py
  modified: []
decisions:
  - "Use _walk_deps verbatim from test_sensors_admin_gate.py — already battle-tested on app.routes"
  - "PUBLIC_SIGNAGE_ROUTES is a module-level set (not a route-level annotation) so adding a new public endpoint requires an explicit allow-list edit — no silent leaks"
  - "CI guards run as pytest tests (not a separate shell script) — single source of failure, same feedback loop"
metrics:
  duration: 4m
  completed: 2026-04-18
  tasks: 2
  files: 2
requirements_completed:
  - SGN-BE-09
  - SGN-BE-10
---

# Phase 43 Plan 05: Dep-Audit and CI Grep Guards Summary

Lock in the two cross-cutting contract tests for Phase 43 — router dep-audit (SGN-BE-09) and CI grep guards (SGN-BE-10) — so new routes and imports can't bypass auth or sneak sync blocking calls past review.

## What Shipped

### `backend/tests/test_signage_router_deps.py` (SGN-BE-09)

Three tests walking `app.routes` dependant trees:

1. `test_signage_admin_routes_have_require_admin` — every `/api/signage*` route outside `PUBLIC_SIGNAGE_ROUTES` and outside `/api/signage/player/*` must have `require_admin` in its dependant tree. Asserts `len(found) > 0` so the test isn't vacuously green.
2. `test_signage_player_routes_have_get_current_device` — every `/api/signage/player/*` route must have `get_current_device` in its dependant tree. Asserts `len(found) >= 2` (expects at least `/playlist` and `/heartbeat`).
3. `test_public_signage_routes_are_explicitly_allowed` — makes edits to `PUBLIC_SIGNAGE_ROUTES` surface in review by re-asserting the admin gate on everything else.

`PUBLIC_SIGNAGE_ROUTES = {"/api/signage/pair/request", "/api/signage/pair/status"}` with an inline comment block pointing at Phase 42 Plan 02 SUMMARY (D-05).

### `backend/tests/test_signage_ci_guards.py` (SGN-BE-10)

Four grep-in-test guards scanning only `backend/app/`:

1. `test_no_sqlite3_import_in_backend_app` — no `^import sqlite3` or `^from sqlite3`.
2. `test_no_psycopg2_import_in_backend_app` — no `^import psycopg2` or `^from psycopg2`.
3. `test_no_sync_subprocess_in_signage_modules` — no `subprocess.run`/`Popen`/`call` in any `*signage*` .py file under `backend/app/`.
4. `test_scanner_actually_finds_signage_files` — sanity: `len(signage_modules) >= 3` so the guard isn't vacuous. Currently covers 6 files (signage_pair.py, signage_player.py, signage_admin/, signage.py model, signage.py schema, signage_pairing.py, signage_resolver.py).

The test file itself uses `subprocess.run` — allowed because it lives in `backend/tests/`, which the guards don't scan.

## Verification

```
pytest backend/tests/test_signage_router_deps.py backend/tests/test_signage_ci_guards.py -x -v
3 passed + 4 passed

Full Phase 43 suite:
pytest tests/test_signage_resolver.py tests/test_signage_admin_router.py \
       tests/test_signage_player_router.py tests/test_signage_heartbeat_sweeper.py \
       tests/test_signage_router_deps.py tests/test_signage_ci_guards.py -x
41 passed in 4.19s
```

## Deviations from Plan

None - plan executed exactly as written. No pre-existing sqlite3/psycopg2/sync-subprocess violations were found, so no cleanup was required.

## Commits

- `2c7c3e3` test(43-05): add signage router dep-audit (SGN-BE-09)
- `5c3ed06` test(43-05): add signage CI grep guards (SGN-BE-10)

## Known Stubs

None. Both tests are fully wired.

## Self-Check: PASSED

- FOUND: backend/tests/test_signage_router_deps.py
- FOUND: backend/tests/test_signage_ci_guards.py
- FOUND commit: 2c7c3e3
- FOUND commit: 5c3ed06
