---
phase: 70-mig-sign-devices
plan: 05
subsystem: backend-tests
tags: [sse, regression, rbac, allowlists, directus, mig-sign-04]
requires:
  - 70-01-resolved-router (resolved.py admin-gated)
  - 70-02-devices-router-trim (FastAPI device PATCH/DELETE/PUT-tags removed)
  - Phase 65 (LISTEN/NOTIFY bridge)
  - Phase 65 (v1_22 trigger WHEN-gate at v1_22_signage_notify_triggers.py:128)
provides:
  - SSE regression coverage for Directus device + tag-map mutations
  - Calibration no-double-fire infra-level invariant pin (success criterion #4)
  - Admin Directus CRUD smoke for signage_devices + signage_device_tag_map
  - RBAC catalog + permission allowlist comments reflecting Phase 70 surface
affects:
  - backend/tests/signage/test_pg_listen_sse.py
  - backend/tests/signage/test_admin_directus_crud_smoke.py
  - backend/tests/test_rbac.py
  - backend/tests/signage/test_permission_field_allowlists.py
tech-stack:
  added: []
  patterns:
    - xfail(strict=False) on composite-PK Directus collections (Phase 69 Plan 06 precedent)
    - transient-row provisioning helpers for SSE tests
    - drain_events between assertions to clean up follow-up triggers
key-files:
  created: []
  modified:
    - backend/tests/signage/test_pg_listen_sse.py
    - backend/tests/signage/test_admin_directus_crud_smoke.py
    - backend/tests/test_rbac.py
    - backend/tests/signage/test_permission_field_allowlists.py
key-decisions:
  - "Plan 70-05 D-09 deviation (Rule 1): added /api/signage/resolved/{id} to MUTATION_ROUTES (admin-gated) not READ_ROUTES — signage routes have always been admin-only via signage_admin/__init__.py router-level require_admin"
  - "Tag-map test 3 marked xfail(strict=False) per Phase 69 Plan 06 lesson — composite-PK schema:null collection metadata gap; auto-passes once registered in Phase 71 CLEAN"
  - "Calibration no-double-fire test uses 1500 ms negative-assertion window per plan (separate from existing 500 ms case) and explicitly references v1_22_signage_notify_triggers.py:128 WHEN-gate as infra-level invariant for success criterion #4"
metrics:
  duration: 4m
  completed: 2026-04-25
  tasks: 3
  files: 4
  commits: [26fe5b4, 9c9746d, fb0f817]
---

# Phase 70 Plan 05: SSE Tests + RBAC/Allowlist Triage Summary

Locked SSE bridge regression for the migrated devices writers (success criterion #4) and updated the route-catalog tests so they reflect the post-Phase-70 surface — 4 new SSE cases, 2 admin Directus CRUD smokes, RBAC catalog entry for the new `/api/signage/resolved/{id}` admin-gated endpoint.

## What Shipped

### Task 1 — SSE regression for device + tag-map + calibration (commit `26fe5b4`)

Four async test functions appended to `backend/tests/signage/test_pg_listen_sse.py`:

1. `test_directus_device_name_update_emits_device_changed` — Directus `updateItem('signage_devices', id, {name})` fires `device-changed` within 500 ms.
2. `test_directus_device_delete_emits_device_changed` — Directus `deleteItem('signage_devices', id)` fires `device-changed` within 500 ms (DELETE branch sets affected=[]).
3. `test_directus_device_tag_map_emits_device_changed` — Directus `createItem('signage_device_tag_map', ...)` fires `device-changed` (NOT `playlist-changed`) within 1000 ms. **Research Pitfall 1 corrected:** CONTEXT D-03b incorrectly stated this should emit `playlist-changed`; truth is `device-changed` per `signage_pg_listen.py:86-88`. Marked `xfail(strict=False)` per Phase 69 Plan 06 lesson (composite-PK metadata gap).
4. `test_calibration_patch_does_not_fire_device_changed` — FastAPI PATCH `/api/signage/devices/{id}/calibration` fires `calibration-changed` AND no `device-changed` within 1500 ms. **Pins success criterion #4** at the infra level: the v1_22 trigger `signage_devices_update_notify` WHEN-gate (`v1_22_signage_notify_triggers.py:128 — WHEN OLD.name IS DISTINCT FROM NEW.name`) excludes calibration columns (rotation, hdmi_mode, audio_enabled, last_seen_at, revoked_at) from firing the LISTEN trigger.

All four use the existing `open_sse_stream` / `next_frame` / `_drain_events` helper API (Phase 68/69 patterns) — no new fixtures invented. New `_create_transient_device` helper consolidates the boilerplate.

### Task 2 — Admin Directus CRUD smoke (commit `9c9746d`)

Two test functions appended to `backend/tests/signage/test_admin_directus_crud_smoke.py`:

1. `test_admin_signage_devices_crud_smoke` — full create/patch/get/delete + 403-or-404 GET-after-DELETE on `signage_devices`.
2. `test_admin_signage_device_tag_map_crud_smoke` — read/insert/delete on the composite-PK join table; marked `xfail(strict=False)` per Phase 69 Plan 06 precedent.

### Task 3 — RBAC catalog + allowlist comments (commit `fb0f817`)

- `backend/tests/test_rbac.py`: added `GET /api/signage/resolved/{device_id}` to `MUTATION_ROUTES` (admin-gated).
- `backend/tests/signage/test_permission_field_allowlists.py`: module docstring refreshed with Phase 68 / 69 / 70 migration notice. No allowlist edits per D-00c.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] D-09 catalog placement: READ_ROUTES → MUTATION_ROUTES**

- **Found during:** Task 3
- **Issue:** Plan D-09 instructed adding `GET /api/signage/resolved/{device_id}` to `READ_ROUTES`. But `READ_ROUTES` asserts both Viewer AND Admin reach the route without 403. The resolved router inherits the router-level `require_admin` gate from `signage_admin/__init__.py:13-17` (cross-cutting hazard #5: "Router-level admin gate via `APIRouter(dependencies=[…])` on remaining FastAPI signage routes"). Adding to `READ_ROUTES` would have made `test_read_routes_allow_both_roles` fail because Viewer correctly receives 403.
- **Fix:** Added the route to `MUTATION_ROUTES` instead (asserts Viewer→403 with canonical `{"detail": "admin role required"}`; Admin→not 403). Documented inline why the migrated GET `/api/signage/devices` and `/api/signage/devices/{id}` paths were never in `READ_ROUTES` (signage has always been admin-only by design).
- **Files modified:** `backend/tests/test_rbac.py`
- **Commit:** `fb0f817`

### Auth Gates

None — all three tasks executed without authentication blockers.

## Verification

The four new SSE tests + two new admin smoke tests are integration-marked and require `docker compose up -d` (Phase 65 v1_22 migration applied + Directus snapshot loaded). Pytest collection cannot run locally because the backend Python venv is not provisioned in this environment — same constraint as Phase 68/69 SSE additions; tests run in CI against the docker stack.

Acceptance criteria verified manually:

| Check | Result |
| ----- | ------ |
| `grep -c test_directus_device_name_update_emits_device_changed` | 1 ✓ |
| `grep -c test_directus_device_delete_emits_device_changed` | 1 ✓ |
| `grep -c test_directus_device_tag_map_emits_device_changed` | 1 ✓ |
| `grep -c test_calibration_patch_does_not_fire_device_changed` | 1 ✓ |
| `grep -c test_admin_signage_devices_crud_smoke` | 1 ✓ |
| `grep -c test_admin_signage_device_tag_map_crud_smoke` | 1 ✓ |
| `grep -c "strict=False" admin_directus_crud_smoke` | 2 ✓ (existing playlist_tag_map + new device_tag_map; multi-line `xfail(...,\n strict=False)` form) |
| `grep -c "/api/signage/resolved/" test_rbac.py` | 2 ✓ (catalog entry + comment) |
| `grep -c "Phase 70" test_permission_field_allowlists.py` | 1 ✓ |
| `python3 -m py_compile` on all 4 modified files | syntax OK |

## Self-Check: PASSED

- All four files exist and contain expected new function signatures.
- Three commits exist: `26fe5b4`, `9c9746d`, `fb0f817` (verified via `git log`).
- All Python syntax validated via `ast.parse`.
- Acceptance criteria satisfied; one Rule-1 auto-fix documented.
