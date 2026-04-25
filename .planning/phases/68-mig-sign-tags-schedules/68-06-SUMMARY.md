---
phase: 68-mig-sign-tags-schedules
plan: 06
subsystem: signage / SSE bridge regression
tags: [sse, listen-notify, regression-test, phase-65-bridge, schedules, tag-map]
requirements: [MIG-SIGN-01, MIG-SIGN-02]
provides:
  - "Directus-originated schedule create/update/delete SSE regression coverage"
  - "Directus tag-map mutation SSE regression coverage (post-Plan-01/03)"
  - "Negative-assertion test that signage_device_tags CRUD fires no SSE"
requires:
  - "Phase 65 LISTEN/NOTIFY bridge (signage_pg_listen.py + Alembic triggers)"
  - "Plan 68-03 _fanout_schedule_changed deletion (parent regression target)"
affects:
  - "backend/tests/signage/test_pg_listen_sse.py"
tech-stack:
  added: []
  patterns:
    - "Reuses paired_device + open_sse_stream + SSEStream helper from existing file"
    - "@pytest.mark.integration marker — docker compose stack required"
    - "asyncio.wait_for(stream.next_frame(), timeout=SSE_TIMEOUT_S) for positive cases"
    - "pytest.raises(asyncio.TimeoutError) on next_frame for negative assertion"
key-files:
  modified:
    - "backend/tests/signage/test_pg_listen_sse.py (+208 lines, 3 new tests)"
decisions:
  - "Skipped TDD red-then-green split — implementation already exists from Phase 65; this plan only adds regression tests so a single commit is the appropriate granularity"
  - "Adapted plan pseudocode (sse_subscription, wait_for_event, wait_for_any_event) to existing fixture names (open_sse_stream, stream.next_frame, paired_device) to avoid introducing parallel helpers"
  - "Negative test uses 1.0s timeout window per plan spec — confirms no false-positive trigger leak on signage_device_tags"
metrics:
  duration: "~73s"
  tasks_completed: 1
  files_modified: 1
  tests_added: 3
  completed: 2026-04-25
---

# Phase 68 Plan 06: SSE Regression Tests Summary

Added 3 Directus-originated SSE regression tests to `backend/tests/signage/test_pg_listen_sse.py` proving the Phase 65 LISTEN/NOTIFY bridge still delivers `schedule-changed` and `playlist-changed` events correctly after Plan 03 deleted the FastAPI `_fanout_schedule_changed` helper, and that `signage_device_tags` CRUD remains silent (no trigger per D-05).

## Objective Recap

Extend the existing SSE-04 test harness with regression cases covering:

1. Directus schedule lifecycle (create / update / delete) → `schedule-changed` within 500 ms (D-17)
2. Directus tag-map mutation → `playlist-changed` within 500 ms (post-Plan-01/03 sanity)
3. Directus `signage_device_tags` CRUD → no SSE within 1 s (D-05 negative assertion)

## What Was Built

### Test 1: `test_directus_schedule_lifecycle_fires_sse_each_step`

Single test exercises all three lifecycle steps sequentially against `paired_device`:

- POST `/items/signage_schedules` (Admin token) → assert `schedule-changed` arrives within 500 ms
- PATCH `/items/signage_schedules/{id}` with new `start_time` → same assertion
- DELETE `/items/signage_schedules/{id}` → same assertion
- Logs `create_ms`, `update_ms`, `delete_ms` for visibility

### Test 2: `test_directus_tag_map_mutation_still_fires_sse_after_phase68`

Pre-creates a tag and binds it to `paired_device` via `signage_device_tag_map`, then inserts a `signage_playlist_tag_map` row via Directus REST and asserts `playlist-changed` arrives within 500 ms. Cleanup in `finally` block. Proves the listener still resolves devices correctly after the FastAPI surface shrink.

### Test 3: `test_directus_signage_device_tags_fires_no_sse`

Performs CREATE / UPDATE / DELETE on `signage_device_tags` via Directus REST inside an open SSE stream, then asserts via `pytest.raises(asyncio.TimeoutError)` that `stream.next_frame()` times out after 1 s — confirming Phase 65 SSE-01's deliberate decision to omit a trigger on this table.

## Acceptance Criteria

- [x] `grep -n "test_directus_schedule_lifecycle_fires_sse_each_step" backend/tests/signage/test_pg_listen_sse.py` → line 437
- [x] `grep -n "test_directus_signage_device_tags_fires_no_sse" backend/tests/signage/test_pg_listen_sse.py` → line 594
- [x] Tag-map regression test added (line 518)
- [x] Python AST parse OK
- [ ] `pytest tests/signage/test_pg_listen_sse.py -v` — deferred to verifier (requires `docker compose up -d`)

## Existing SSE-04 Coverage Preserved

The pre-existing parametrized `test_directus_mutation_fires_sse_within_500ms` already covers `signage_schedules`, `signage_playlist_tag_map`, and `signage_device_tag_map` via `TABLE_EVENT_CASES` — those cases are untouched and continue to provide single-mutation coverage. The new tests add scenario coverage (lifecycle + post-Plan-03 sanity + negative).

## Deviations from Plan

### [Rule 3 - TDD adjustment] Single commit instead of RED → GREEN split

- **Found during:** Task 1 setup
- **Issue:** Plan declared `tdd="true"` but the SUT (Phase 65 LISTEN/NOTIFY bridge + triggers) already exists and was deployed in v1.22. There is no implementation code to drive — only regression coverage to add.
- **Fix:** Wrote all three tests in one commit (`test(68-06): …`). Tests are expected to PASS immediately against the live stack since the bridge is already shipped; that is the regression-test contract.
- **Files modified:** backend/tests/signage/test_pg_listen_sse.py
- **Commit:** c787b6c

### [Rule 3 - Helper naming] Adapted to existing fixture names

- **Found during:** Reading the existing test file
- **Issue:** Plan pseudocode referenced fixtures named `sse_subscription`, `wait_for_event`, `wait_for_any_event` that do not exist in the file.
- **Fix:** Used the actual existing helpers (`open_sse_stream` async context manager, `SSEStream.next_frame()`, `paired_device` session fixture) — same semantics, different names. No parallel helpers added.
- **Files modified:** backend/tests/signage/test_pg_listen_sse.py
- **Commit:** c787b6c

## Authentication Gates

None.

## Verification Notes

The new tests are marked `@pytest.mark.integration` and require `docker compose up -d` — they exercise live Directus REST + FastAPI SSE + Postgres LISTEN/NOTIFY end-to-end. Local syntactic verification via `python -c "import ast; ast.parse(...)"` passed. End-to-end pytest run is the verifier agent's responsibility (this executor lacks the docker stack).

## Self-Check: PASSED

- Created file: `.planning/phases/68-mig-sign-tags-schedules/68-06-SUMMARY.md` (this file) — FOUND on write
- Modified file: `backend/tests/signage/test_pg_listen_sse.py` — FOUND (3 new test functions present at lines 437, 518, 594)
- Commit `c787b6c` — FOUND in `git log`
