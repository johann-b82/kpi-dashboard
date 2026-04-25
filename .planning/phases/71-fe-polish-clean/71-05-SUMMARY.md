---
phase: 71-fe-polish-clean
plan: 05
subsystem: backend-cleanup
tags: [orphan-sweep, schemas, tests, openapi, clean-01, clean-02, pitfall-7]
requirements: [CLEAN-01, CLEAN-02]
dependency_graph:
  requires:
    - "71-04 OpenAPI snapshot baseline"
    - "Phases 66-70 incremental route deletions"
  provides:
    - "Final post-v1.22 FastAPI surface (orphans purged)"
    - "schemas/signage.py with zero orphan classes"
  affects:
    - "Future grep audits (no SignageDeviceTag*/Schedule*/SignagePlaylistCreate ghost references)"
tech_stack:
  added: []
  patterns:
    - "Pitfall 7 inheritance guard: parent class kept even when flagged orphan if a subclass survives (SignageDeviceBase)"
    - "Test surgery: delete dead test cases targeting deleted routes; preserve cases targeting surviving routes; replace deleted GET probes with DB-side asserts"
key_files:
  created: []
  modified:
    - backend/app/schemas/signage.py
    - backend/app/schemas/__init__.py
    - backend/tests/test_signage_admin_router.py
  deleted:
    - backend/tests/test_signage_hhmm.py
decisions:
  - "Kept SignageDeviceBase despite RESEARCH.md flagging it as orphan — it is the parent of SignageDeviceRead which the calibration PATCH response_model still uses (Pitfall 7 inheritance guard, documented in docstring)"
  - "OpenAPI baseline regen produced zero diff — Task 1 only removed schemas + tests, no FastAPI routes; surface unchanged from 71-04 lock"
  - "main.py required no edits — Phases 66-70 already removed each deleted router's import + include_router on rollout (verified by inspection + acceptance grep)"
metrics:
  duration: "~6m"
  completed_date: "2026-04-25"
  tasks: 2
  files: 4
---

# Phase 71 Plan 05: Orphan Sweep + Main Cleanup Summary

Catch-all sweep of FastAPI router/schema/test orphans surviving Phases 66-70 deletions. Deleted 8 orphan Pydantic schemas in `app/schemas/signage.py`, removed 5 dead admin-router test cases, and confirmed the post-v1.22 OpenAPI baseline from 71-04 already reflects the final surface (no diff after regen).

## What was built

### Task 1: Orphan schema + test sweep (8402dc7)

**Verified clean (no edits required):**
- `backend/app/main.py` — already imports + registers only the 11 surviving routers (uploads, kpis, settings (+ public), sync, sensors, hr_kpis, hr_overtime, signage_pair, signage_player, signage_admin). No stale `me_router` / `data_router` / `tags` / `schedules` references; Phase 66-70 cleaned each on rollout.
- `backend/app/routers/{me,data}.py` and `backend/app/routers/signage_admin/{tags,schedules}.py` — all 4 confirmed gone via `ls`.
- Pitfall 7 helpers preserved: `_notify_playlist_changed` (playlists.py, 2 refs), `_notify_device_self` (devices.py, 1 ref).

**Schema deletions in `backend/app/schemas/signage.py`** (all confirmed zero callers in surviving code via repo-wide grep):
- `SignagePlaylistCreate` (Phase 69 deleted POST)
- `SignageDeviceUpdate` (Phase 70 deleted PATCH name)
- `SignageDeviceTagBase`, `SignageDeviceTagCreate`, `SignageDeviceTagRead` (Phase 68 migrated tags to Directus)
- `ScheduleBase`, `ScheduleCreate`, `ScheduleUpdate`, `ScheduleRead` (Phase 68 migrated schedules to Directus)

**Schema kept (Pitfall 7 inheritance guard):**
- `SignageDeviceBase` — RESEARCH.md flagged it as orphan, but `SignageDeviceRead(SignageDeviceBase)` inherits from it, and `SignageDeviceRead` is the calibration PATCH response_model (Phase 70 D-00j inlined). Kept with a docstring note explaining the retention.

**Schema kept (verified callers):**
- `SignagePlaylistRead`, `SignagePlaylistItemRead`, `SignagePlaylistItemCreate`, `SignageMediaCreate/Read`, `SignageDeviceRead`, plus the `*Base` parents and `SignagePairing*` family — all have surviving callers in routers/services.

**Import cleanup:**
- Dropped `from app.services._hhmm import hhmm_to_time` from `schemas/signage.py` (only used by deleted Schedule classes).
- Dropped `field_validator`, `model_validator` from pydantic import (only used by deleted Schedule classes).
- `app.services._hhmm` itself is still used by `signage_resolver.py` — keeps.

**__init__.py re-exports trimmed:** removed 6 names from the `from app.schemas.signage import (...)` block matching the deletions.

**Test orphan handling:**
- `backend/tests/test_signage_hhmm.py` — entire file targeted deleted Schedule schemas (`ScheduleCreate` validation cases) + raw HHMM helpers (which are now exercised end-to-end by Phase 68's Directus validation hook + Plan 02 `test_signage_schedule_check.py`). Removed.
- `backend/tests/test_signage_admin_router.py` — surgery, not deletion:
  - **Removed** 3 admin-gate matrix tests (POST `/api/signage/playlists` x admin/viewer/no-jwt) — POST gone in Phase 69; admin gate now covered router-wide by `test_signage_router_deps.py`.
  - **Removed** `test_put_device_tags_bulk_replaces` (route migrated Phase 70).
  - **Removed** `test_put_playlist_tags_bulk_replaces` (route migrated Phase 69).
  - **Kept** Media DELETE 404/409/204 trio + bulk-replace items test.
  - **Patched** bulk-replace items test: replaced `client.get('/items')` follow-up (route migrated 69-02) with `_count_items` SQL probe.
  - **Pruned** unused helpers: `_insert_device`, `_insert_tag`, `_insert_device_tag_map`, `_device_tag_ids`, `_playlist_tag_ids`. Kept `_count_items`.
  - Updated module docstring to document the post-v1.22 scope.
- `backend/tests/test_signage_router_deps.py` — left as-is; walks routes generically and asserts router-level admin gate + device gate. Still green.
- `backend/tests/signage/test_playlists_router_surface.py` — left as-is; already verifies only-DELETE post-69.

### Task 2: OpenAPI baseline regen — no-op confirmed

Ran `UPDATE_SNAPSHOTS=1 pytest tests/test_openapi_paths_snapshot.py -x` inside the api container. **Zero git diff** on `backend/tests/contracts/openapi_paths.json` — the baseline locked in 71-04 (1299 bytes, 44 paths) already reflects the post-sweep surface because Task 1 only removed schemas + tests, not routes.

Acceptance grep confirmed:
- `/api/me`, `/api/data/sales`, `/api/signage/tags`, `/api/signage/schedules` → 0 matches
- `/api/signage/resolved/{device_id}` → 1 match (Phase 70 NEW)
- `/api/data/employees/overtime` → 1 match (Phase 67 NEW)
- `/api/signage/devices/{device_id}/calibration` → 1 match
- File size 1299 bytes (well under 5 KB Pitfall 5 ceiling)

`pytest tests/test_openapi_paths_snapshot.py` green. No commit for Task 2 (no file changes).

## Commits

| Task | Commit  | Message                                                      |
| ---- | ------- | ------------------------------------------------------------ |
| 1    | 8402dc7 | chore(71-05): sweep orphan signage schemas + dead admin router tests |
| 2    | (none)  | OpenAPI baseline regen produced zero diff — verified-only    |

## Verification

```
$ docker compose exec -T api pytest tests/test_signage_admin_router.py
4 passed in 0.59s

$ docker compose exec -T api pytest tests/test_openapi_paths_snapshot.py -x
1 passed in 0.10s

$ docker compose exec -T api pytest --collect-only --ignore=tests/test_color_validator.py
385 tests collected in 0.08s   (clean — no ImportError from sweep)

$ ls backend/app/routers/{me,data}.py backend/app/routers/signage_admin/{tags,schedules}.py 2>&1
all 4 → "No such file or directory"

$ grep -c "_notify_playlist_changed" backend/app/routers/signage_admin/playlists.py
2
$ grep -c "_notify_device_self" backend/app/routers/signage_admin/devices.py
1

$ grep -c "SignageDeviceTagRead\|ScheduleRead\|SignagePlaylistCreate\|SignageDeviceUpdate" backend/app/schemas/signage.py
0   (all 4 orphan markers gone)

$ grep -c "SignagePlaylistRead\|SignagePlaylistItemRead\|SignageMediaRead\|SignageDeviceRead" backend/app/schemas/signage.py
4   (all kept-flagged classes preserved)
```

## Deviations from Plan

### Deviations

**1. [Rule 1 - Bug] Kept `SignageDeviceBase` despite plan flagging it as orphan**
- **Found during:** Task 1 step 3 schema audit
- **Issue:** Plan listed `SignageDeviceBase` in the expected DELETE set, but `SignageDeviceRead` inherits from it (`class SignageDeviceRead(SignageDeviceBase)`), and `SignageDeviceRead` is on the KEEP list (calibration PATCH response_model). Deleting the parent would break Pydantic class construction.
- **Fix:** Kept the class with an inline docstring explaining the inheritance retention. Acceptance criterion mismatch documented here per plan instruction ("if any KEEP, document why in plan SUMMARY").
- **Files modified:** `backend/app/schemas/signage.py`
- **Commit:** 8402dc7

**2. [Rule 1 - Bug] `test_signage_admin_router.py` GET /items follow-up replaced with SQL probe**
- **Found during:** Task 1 step 4 test orphan audit
- **Issue:** Plan expected pure deletion of dead tests. The bulk-replace items test had a partial-orphan: PUT (kept) + follow-up GET (deleted in 69-02). Pure deletion would either drop the whole test (loses bulk-replace coverage) or leave the dead GET probe (collection error).
- **Fix:** Replaced the GET probe with `_count_items` SQL helper that already existed in the same file. Preserves bulk-replace test intent.
- **Files modified:** `backend/tests/test_signage_admin_router.py`
- **Commit:** 8402dc7

### Pre-existing failures (out of scope)

- `tests/test_color_validator.py` collection error (`_validate_oklch` re-export gap) — confirmed pre-existing via `git stash` test. Not caused by this sweep.
- 17 `test_settings_api.py` / `test_signage_calibration.py` / `test_signage_schema_roundtrip.py` failures — confirmed pre-existing (env / docker stack / unrelated). Not in scope per scope-boundary rule.
- 14 `tests/signage/*` setup ERRORs (Directus auth env not provisioned in single `pytest` invocation outside CI sequence) — pre-existing, deferred.

## Notes for downstream plans

- Phase 71 closure: CLEAN-01 + CLEAN-02 satisfied. Coverage of catch-all sweep complete. CLEAN-03/04/05 already satisfied by 71-04 + 71-06.
- The OpenAPI baseline lock in 71-04 was already the post-sweep surface — useful invariant: future plans that delete routes MUST regen via `UPDATE_SNAPSHOTS=1 pytest tests/test_openapi_paths_snapshot.py` and commit, the snapshot test is the catch.
- `SignageDeviceBase` retention is a known-deliberate residual; if a future phase removes `SignageDeviceRead`'s inheritance pattern (e.g., flattens fields), `SignageDeviceBase` becomes deletable.

## Self-Check

- [x] backend/app/schemas/signage.py modified (8 orphan classes removed)
- [x] backend/app/schemas/__init__.py re-exports trimmed
- [x] backend/tests/test_signage_admin_router.py surgery applied (4 tests pass)
- [x] backend/tests/test_signage_hhmm.py removed from working tree
- [x] backend/app/main.py — verified clean, no edits needed
- [x] Pitfall 7 helpers preserved (`_notify_playlist_changed`, `_notify_device_self`)
- [x] Commit 8402dc7 in `git log`
- [x] OpenAPI baseline test green (no regen needed)
- [x] pytest --collect-only clean (excluding pre-existing `test_color_validator.py`)

## Self-Check: PASSED
