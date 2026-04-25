---
phase: 71-fe-polish-clean
plan: 04
subsystem: backend-tests
tags: [openapi, pytest, ci-guard, directus, db-exclude-tables, clean-02, clean-04]
requirements: [CLEAN-02, CLEAN-04]
dependency_graph:
  requires:
    - "v1.22 surviving FastAPI surface (Phases 65-70 complete)"
    - "docker-compose.yml DB_EXCLUDE_TABLES env var (Phase 65)"
  provides:
    - "OpenAPI surface lock test (catches accidental router re-registration)"
    - "DB_EXCLUDE_TABLES absent-from guard (catches accidental Directus collection hiding)"
  affects:
    - "CI pre-stack pytest step (Phase 71-06 will wire both new tests)"
tech_stack:
  added: []
  patterns:
    - "Snapshot test with UPDATE_SNAPSHOTS=1 regen convention (parity with FE-05)"
    - "Pure-python pre-stack pytest reads repo-root file via parents[2]"
key_files:
  created:
    - backend/tests/test_openapi_paths_snapshot.py
    - backend/tests/contracts/openapi_paths.json
    - backend/tests/test_db_exclude_tables_directus_collections.py
  modified: []
decisions:
  - "OpenAPI baseline locked at 44 paths matching v1.22 surviving surface — no deleted routes leaked through (Phase 71-05 sweep prerequisite confirmed satisfied for tested surface)"
  - "DB_EXCLUDE_TABLES absent-from semantics enforced verbatim per D-08 (NOT a superset check)"
metrics:
  duration: "154s"
  completed_date: "2026-04-25"
  tasks: 2
  files: 3
---

# Phase 71 Plan 04: OpenAPI Snapshot + Pytest Guards Summary

Two backend pytest guards landed: an OpenAPI paths snapshot that locks the FastAPI surface to its v1.22 post-migration shape, and a `DB_EXCLUDE_TABLES` absent-from assertion that prevents accidentally hiding any migrated Directus collection.

## What was built

### Task 1: OpenAPI paths snapshot test (CLEAN-02 / D-07)

- **`backend/tests/test_openapi_paths_snapshot.py`** — sorts `app.openapi()["paths"].keys()` and diffs against a JSON baseline. Diff message lists added/removed paths and points to the regen recipe.
- **`backend/tests/contracts/openapi_paths.json`** — 1.3 KB sorted list of 44 paths covering kpis/settings/sync/sensors/uploads/hr/data overtime/signage admin + analytics + media + pair + player + resolved + calibration + playlists DELETE/items PUT + health + player static.
- Regen: `UPDATE_SNAPSHOTS=1 pytest tests/test_openapi_paths_snapshot.py`.
- Pitfall 5 honored: paths-only projection (NOT full openapi() dict); baseline well under the 5 KB ceiling.

Generated baseline reviewed against RESEARCH.md "Surviving FastAPI surface" — no deleted routes (e.g. `/api/me`, `/api/data/sales`, `/api/data/employees` bare, `/api/signage/tags*`, `/api/signage/schedules*`, POST/PATCH `/api/signage/playlists`, `PATCH /api/signage/devices`) appear. Plan 71-05 sweep is therefore not blocked by leaked re-registrations on this surface.

### Task 2: DB_EXCLUDE_TABLES absent-from pytest (CLEAN-04 / D-08)

- **`backend/tests/test_db_exclude_tables_directus_collections.py`** — regex-parses `docker-compose.yml` line 106 and asserts `MIGRATED_COLLECTIONS.isdisjoint(excluded)` per the user-locked D-08 semantics.
- 9 migrated collections enumerated: `sales_records`, `personio_employees`, `signage_devices`, `signage_playlists`, `signage_playlist_items`, `signage_device_tags`, `signage_playlist_tag_map`, `signage_device_tag_map`, `signage_schedules`.
- Existing complementary `scripts/ci/check_db_exclude_tables_superset.sh` (never-expose superset check) untouched — both guards co-exist by design.

Validated against current `docker-compose.yml`: DB_EXCLUDE_TABLES = `alembic_version,app_settings,personio_attendance,personio_absences,personio_sync_meta,sensors,sensor_readings,sensor_poll_log,signage_pairing_sessions,signage_heartbeat_event,upload_batches` — disjoint from the 9 migrated collections. Test green.

## Commits

| Task | Commit  | Message                                                          |
| ---- | ------- | ---------------------------------------------------------------- |
| 1    | a1b957d | test(71-04): add OpenAPI paths snapshot guard                    |
| 2    | 499d3a6 | test(71-04): add DB_EXCLUDE_TABLES absent-from pytest guard      |

## Verification

```
$ docker compose exec -T api pytest tests/test_openapi_paths_snapshot.py -x -v
tests/test_openapi_paths_snapshot.py::test_openapi_paths_match_snapshot PASSED
1 passed in 0.10s

$ docker compose exec -T api pytest tests/test_db_exclude_tables_directus_collections.py -x -v
tests/test_db_exclude_tables_directus_collections.py::test_migrated_collections_absent_from_db_exclude_tables PASSED
1 passed in 0.04s
```

Baseline JSON size: 1299 bytes (well under 5 KB Pitfall 5 ceiling).

## Deviations from Plan

None — plan executed exactly as written. Both tests use the verbatim patterns specified in the plan and RESEARCH.md.

## Notes for downstream plans

- **Plan 71-05 (orphan sweep + main cleanup):** if the sweep removes any router that's currently in the baseline, regenerate via `UPDATE_SNAPSHOTS=1` and commit the new baseline as part of that plan's deliverable. Conversely, if any deleted-but-still-registered route is removed, the snapshot will fail and force a re-baseline — which is the intended catch.
- **Plan 71-06 (CI guards + rollback runbook):** wire both new pytest files into the pre-stack CI step (mirroring the existing `tests/signage/test_permission_field_allowlists.py` invocation at `.github/workflows/ci.yml:42`). The DB_EXCLUDE_TABLES test runs pure-python in <1s and needs no docker stack; the OpenAPI snapshot needs `pip install -r backend/requirements.txt` (already done in CI step 2).

## Self-Check

- [x] backend/tests/test_openapi_paths_snapshot.py exists
- [x] backend/tests/contracts/openapi_paths.json exists (1299 bytes, valid JSON, 44 entries)
- [x] backend/tests/test_db_exclude_tables_directus_collections.py exists
- [x] Commit a1b957d in `git log`
- [x] Commit 499d3a6 in `git log`
- [x] Both pytests green inside `kpi-dashboard-api-1` container
- [x] Literal `app.openapi()["paths"]` present (Pitfall 5 paths-only)
- [x] Literal `UPDATE_SNAPSHOTS` present (regen convention)
- [x] Literal `MIGRATED_COLLECTIONS.isdisjoint(excluded)` present (D-08 lock)
- [x] No `.issuperset(` in new file
- [x] scripts/ci/check_db_exclude_tables_superset.sh untouched

## Self-Check: PASSED
