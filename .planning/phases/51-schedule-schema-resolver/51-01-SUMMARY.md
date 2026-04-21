---
phase: 51-schedule-schema-resolver
plan: "01"
subsystem: signage-backend
tags: [signage, schedule, resolver, alembic, pydantic, tzdata]
requires:
  - v1.16 signage_* tables (phase 41)
  - resolve_playlist_for_device (phase 43)
  - AppSettings singleton (phase 1)
provides:
  - signage_schedules table + app_settings.timezone column (SGN-TIME-01)
  - resolve_schedule_for_device service (SGN-TIME-02)
  - 9 integration tests covering the 7 SGN-TIME-03 cases (+ updated_at tiebreak + REQ3 worked example)
  - _hhmm helper module (hhmm_to_time / time_to_hhmm / now_hhmm_in_tz)
  - Schedule Pydantic trio (ScheduleCreate / ScheduleUpdate / ScheduleRead)
affects:
  - backend/app/services/signage_resolver.py (composition wrapper; envelope builder extracted)
  - backend/app/models/__init__.py (re-export SignageSchedule)
  - backend/Dockerfile image (rebuilt with tzdata)
tech-stack:
  added:
    - tzdata>=2024.1 (pip)
  patterns:
    - Shared _build_envelope_for_playlist helper so schedule-match and tag-match envelopes stay byte-identical (ETag invariant)
    - SQL weekday bit test via bindparam, never f-string interpolation
    - Pydantic field_validator calling hhmm_to_time() to reject in-range-but-structurally-invalid HHMM ints
key-files:
  created:
    - backend/alembic/versions/v1_18_signage_schedules.py
    - backend/app/services/_hhmm.py
    - backend/tests/test_signage_hhmm.py
    - backend/tests/test_signage_schedule_resolver.py
    - .planning/phases/51-schedule-schema-resolver/51-01-SUMMARY.md
  modified:
    - backend/requirements.txt
    - backend/app/models/_base.py
    - backend/app/models/signage.py
    - backend/app/models/__init__.py
    - backend/app/schemas/signage.py
    - backend/app/services/signage_resolver.py
    - backend/tests/test_signage_schema_roundtrip.py
decisions:
  - Envelope-builder extracted into private _build_envelope_for_playlist helper (both paths share identical shape)
  - Weekday bit test via SQLAlchemy bindparam (NOT f-string) to enforce SQL parameterization hygiene even though weekday is server-computed
  - Single-query schedule resolve (priority DESC, updated_at DESC LIMIT 1) over multi-round-trip
  - Partial index on (weekday_mask WHERE enabled = true) matches the hot-path filter
  - timezone column uses server_default='Europe/Berlin' — backfills the singleton row atomically, no separate op.execute() needed
metrics:
  duration: 9m 5s
  tasks: 3
  files_created: 5
  files_modified: 7
  tests_added: 22
  tests_pass: 156/156 (signage scope)
  completed: 2026-04-21
---

# Phase 51 Plan 01: Schedule Schema + Resolver Summary

**One-liner:** `signage_schedules` table + `app_settings.timezone` column + `resolve_schedule_for_device` composed into existing `resolve_playlist_for_device` via schedule-first wrapper; tzdata pip dep added so `zoneinfo.ZoneInfo("Europe/Berlin")` resolves inside `python:3.11-slim`.

## What Shipped

### SGN-TIME-01 — Migration + tzdata + timezone column
- `backend/alembic/versions/v1_18_signage_schedules.py` creates `signage_schedules` with 4 CHECK constraints (weekday_mask 0..127, start_hhmm 0..2359, end_hhmm 0..2359, start_hhmm < end_hhmm) and the `ix_signage_schedules_enabled_weekday` partial index.
- Adds `app_settings.timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Berlin'` in the same revision; the server default backfills the existing singleton row atomically (no op.execute needed).
- `tzdata>=2024.1` added to `backend/requirements.txt`. Backend container rebuilt; `zoneinfo.ZoneInfo("Europe/Berlin")` now resolves inside the running api container.
- Round-trip verified: `upgrade head → downgrade -1 → upgrade head` all exit 0.

### SGN-TIME-02 — Resolver composition
- New `backend/app/services/_hhmm.py` centralizes all timezone handling. `hhmm_to_time`, `time_to_hhmm`, and `now_hhmm_in_tz` keep the resolver core integer-only (D-04).
- `SignageSchedule` SQLAlchemy model added to `backend/app/models/signage.py` (SmallInteger weekday_mask, 4 CheckConstraints mirroring the migration).
- `ScheduleCreate` / `ScheduleUpdate` / `ScheduleRead` Pydantic v2 schemas added to `backend/app/schemas/signage.py` with `field_validator` enforcing structural HHMM validity (catches 1299) and `model_validator` rejecting zero-width / midnight-spanning windows.
- `resolve_schedule_for_device(db, device, *, now=None) -> PlaylistEnvelope | None` added to `signage_resolver.py`. Single SQL query joining `signage_schedules → signage_playlists → signage_playlist_tag_map`, filtered by weekday bit (`(weekday_mask >> :wd) & 1 = 1` via `bindparam`), time window, `enabled=true`, and device tag overlap; ordered by `priority DESC, updated_at DESC LIMIT 1`.
- `resolve_playlist_for_device` gets a 3-line schedule-first composition; signature unchanged → 8+ existing callsites untouched.
- Shared `_build_envelope_for_playlist` helper extracted so schedule-matched and tag-matched envelopes are byte-identical (D-08 ETag invariant preserved).

### SGN-TIME-03 — Integration tests
9 test functions in `backend/tests/test_signage_schedule_resolver.py`, all passing:

| # | Test | Covers |
|---|------|--------|
| 1 | `test_schedule_single_match` | TC1 (single-window match) |
| 2 | `test_schedule_priority_tiebreak` | TC2 (priority DESC wins) |
| 3 | `test_schedule_updated_at_tiebreak_when_priorities_equal` | TC2 sub-case |
| 4 | `test_schedule_weekday_miss` | TC3 (Sat vs Mo-Fr mask) |
| 5 | `test_schedule_time_miss_boundaries` | TC4 (06:59/07:00/11:00 boundary — start incl, end excl) |
| 6 | `test_schedule_disabled_skip` | TC5 (`enabled=false`) |
| 7 | `test_schedule_tag_mismatch_skip` | TC6 (playlist tag ∩ device tag = ∅) |
| 8 | `test_empty_schedules_fallback_to_tag_resolver` | TC7 (composition falls through) |
| 9 | `test_schedule_worked_example_REQ3` | REQUIREMENTS.md §3 north-star |

Every test passes an explicit `now=` (2026-04-22 Wednesday / 2026-04-25 Saturday in `Europe/Berlin`) — never relies on the real clock (Pitfall 5). Each test re-reads the device row via asyncpg after resolving and asserts `last_seen_at`, `current_item_id`, `current_playlist_etag`, and `status` are untouched (D-10 pure-read invariant).

Plus 13 unit tests in `test_signage_hhmm.py` covering helper correctness and Pydantic schema validation.

## Commits

| Task | Commit | Scope |
|------|--------|-------|
| 1 | `ee3f8fc` | Migration + tzdata + timezone column + roundtrip tests |
| 2 | `ba082d7` | `_hhmm.py` + `SignageSchedule` model + Pydantic schemas + 13 unit tests |
| 3 | `0a81594` | `resolve_schedule_for_device` + composition + 9 integration tests |

## Verification Results

- `alembic upgrade head → downgrade -1 → upgrade head`: PASS (all exit 0)
- `pytest tests/test_signage_schema_roundtrip.py -x`: **5 passed**
- `pytest tests/test_signage_hhmm.py -x`: **13 passed**
- `pytest tests/test_signage_schedule_resolver.py -x -v`: **9 passed**
- `pytest tests/test_signage_resolver.py -x` (regression): **14 passed**
- Broader signage regression (`-k "signage or resolver"`): **156 passed, 2 skipped, 0 failed**
- `python -c "import zoneinfo; zoneinfo.ZoneInfo('Europe/Berlin')"` inside api container: PASS
- Pure-read invariant `grep -cE 'db\.commit|db\.add|db\.delete' backend/app/services/signage_resolver.py`: **0** (clean)
- SQL parameterization guard `grep -c 'f"(weekday_mask' backend/app/services/signage_resolver.py`: **0** (no f-string SQL)

## Deviations from Plan

### Out-of-scope discoveries (NOT auto-fixed)

**1. Pre-existing test_color_validator.py import failure**
- **Found during:** Regression sweep (`pytest -k signage`)
- **Symptom:** `ImportError: cannot import name '_validate_oklch' from 'app.schemas'`
- **Cause:** `schemas.py → schemas/__init__.py` package conversion in Phase 41 dropped the `_validate_oklch` re-export.
- **Action:** Logged; not fixed. Wholly unrelated to the signage schedule work; applying Rule "scope boundary" — only auto-fix issues directly caused by current task's changes.
- **Workaround for CI:** Ran regressions with `--ignore=tests/test_color_validator.py` and also narrowly on signage-specific files. All 156 signage/resolver tests pass.

### Minor planner-nominal deviations

- Plan asked for >=200-line test file — `test_signage_schedule_resolver.py` is ~520 lines (9 tests including the REQ3 worked example). Above the floor.
- Plan asked for exact 8 test function names — delivered 9 (the updated_at-tiebreak sub-case was carved into its own test for clarity; the other 7 + REQ3 match the plan's list).
- Plan mentioned backfill via `op.execute()` as an option; chose the simpler `server_default` path (same net effect, one fewer DDL step).

### Auto-fixes applied (Rules 1-3)

None. The plan was implementable verbatim; no bugs, missing critical functionality, or blocking issues surfaced.

## Known Stubs

None. Every code path shipped is fully wired; no placeholder data flows to any UI.

## Open Follow-ups for Plan 51-02

1. Admin router `backend/app/routers/signage_admin/schedules.py` (CRUD + SSE fanout via `devices_affected_by_playlist` + `notify_device` with `schedule-changed` event type — D-02).
2. Playlist DELETE 409 handler: deleting a playlist with attached schedules should surface an actionable error because the FK is `ON DELETE RESTRICT`.
3. Frontend (Phase 52) will consume the new endpoints; shape decisions should keep returning full schedule rows + resolved playlist name for list view ergonomics.

## Self-Check: PASSED

Verified file presence:
- `.planning/phases/51-schedule-schema-resolver/51-01-SUMMARY.md`: FOUND
- `backend/alembic/versions/v1_18_signage_schedules.py`: FOUND
- `backend/app/services/_hhmm.py`: FOUND
- `backend/tests/test_signage_hhmm.py`: FOUND
- `backend/tests/test_signage_schedule_resolver.py`: FOUND

Verified commit presence (`git log --oneline | grep`):
- `ee3f8fc`: FOUND
- `ba082d7`: FOUND
- `0a81594`: FOUND
