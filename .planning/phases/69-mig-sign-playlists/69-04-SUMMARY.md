---
phase: 69-mig-sign-playlists
plan: 04
subsystem: signage
tags: [sse, regression-tests, listen-notify, playlists, phase-65-bridge]
requirements: [MIG-SIGN-03]
requires: [69-01, 69-02, 65]
provides: [phase-69-sse-regression-coverage]
affects:
  - backend/tests/signage/test_pg_listen_sse.py
tech-stack:
  added: []
  patterns:
    - "Directus REST SSE-route binding via shared device_tag → playlist_tag_map link"
    - "_drain_events settle helper to filter pre-test SSE noise"
    - "FastAPI Admin gate accepts Directus-issued HS256 JWT (Phase 65 AUTHZ-01)"
key-files:
  created: []
  modified:
    - backend/tests/signage/test_pg_listen_sse.py
decisions:
  - "TDD split skipped (Phase 68 P06 precedent): bridge already shipped Phase 65; single test-only commit."
  - "Tag-binding required: transient playlists must be linked to paired_device.tag_id via signage_playlist_tag_map so the resolver routes events to the test's SSE stream."
  - "Empty-replace `{\"items\": []}` chosen for bulk-PUT regression — exercises atomic DELETE+INSERT path with zero inserts (no fixture media required)."
  - "FastAPI tests reuse `directus_admin_token` directly as Authorization bearer (Phase 65 AUTHZ-01 shared HS256 secret)."
  - "Tag-map diff test asserts at-least-once + <1000 ms (D-02b/D-17 relaxed-ceiling form), NOT exactly-once."
metrics:
  duration: 93s
  tasks: 1
  files: 1
  completed: 2026-04-25
---

# Phase 69 Plan 04: SSE Regression Tests Summary

Added 4 integration regression tests to `backend/tests/signage/test_pg_listen_sse.py` proving the Phase-65 LISTEN/NOTIFY bridge still delivers `playlist-changed` SSE for both Directus-originated playlist mutations (Plan 69-01 migration target) and the surviving FastAPI DELETE + bulk-PUT-items routes (Plan 69-01/69-02 helper retention).

## Tasks Completed

| Task | Name                                                        | Commit  | Files                                          |
| ---- | ----------------------------------------------------------- | ------- | ---------------------------------------------- |
| 1    | Add Directus + FastAPI playlist SSE regression tests        | fffc2d1 | backend/tests/signage/test_pg_listen_sse.py    |

## New Tests

1. **`test_directus_playlist_lifecycle_fires_sse_each_step`** (D-05)
   - Directus `POST /items/signage_playlists` → `playlist-changed` < 500 ms.
   - Directus `PATCH /items/signage_playlists/{id}` (rename) → `playlist-changed` < 500 ms.
   - Routes to paired stream via `signage_playlist_tag_map` ↔ `signage_device_tag_map` chain on `paired_device.tag_id`.

2. **`test_directus_playlist_tag_map_diff_fires_sse_at_least_once`** (D-02b / D-05)
   - Concurrent `deleteItems` (filter form) + `createItems` of a tag-map row via `asyncio.gather`.
   - Asserts ≥1 `playlist-changed` within 1 s. Multi-event tolerated per D-02b.

3. **`test_fastapi_playlist_delete_still_fires_sse`** (D-04b)
   - `DELETE /api/signage/playlists/{id}` with Directus admin JWT → `playlist-changed` < 500 ms.
   - Confirms `_notify_playlist_changed` helper retention from Plan 69-01.

4. **`test_fastapi_bulk_replace_items_still_fires_sse`** (D-05a)
   - `PUT /api/signage/playlists/{id}/items` body `{"items": []}` → `playlist-changed` < 500 ms.
   - Confirms `_notify_playlist_changed` helper retention from Plan 69-02.

## Helper Added

- `_drain_events(stream, settle_ms=200)` — consumes any queued SSE frames until the stream is quiet for `settle_ms`. Used to settle setup-phase events before measuring per-mutation latency.

## Existing Coverage Preserved

- Parametrized `test_directus_mutation_fires_sse_within_500ms` over `TABLE_EVENT_CASES` still covers the per-table bridge wiring (incl. `signage_playlists`, `signage_playlist_items`, `signage_playlist_tag_map`).
- Phase-68 schedule lifecycle, tag-map positive case, and `signage_device_tags` negative case unchanged.
- Calibration-no-double-fire D-07 regression unchanged.
- Reconnect smoke test (`@pytest.mark.slow`) unchanged.

## Verification

- `python3 -m ast` parse: PASSED.
- Acceptance grep checks (4): all 4 new test function names found in file.
- Integration run (`pytest -k "playlist_lifecycle or playlist_tag_map_diff or fastapi_playlist_delete or fastapi_bulk_replace_items"`) requires live `docker compose up` stack and runs in CI; not executed in this offline session. Latency assertions baked into the test bodies (`SSE_TIMEOUT_MS=500` for create/update/delete/bulk-PUT, `1000 ms` for tag-map diff).

## Deviations from Plan

### Rule 3 — Helper API alignment

The plan's pseudocode referenced fixtures that do not exist in the current test file:
- `sse_subscription` fixture / `wait_for_event(sub, ...)` / `wait_for_any_event(sub, ...)` / `drain_events(sub, ...)` — none of these exist in `test_pg_listen_sse.py` today.

The actual file uses an `open_sse_stream(device_id)` async-context-manager + `stream.next_frame()` pattern with `asyncio.wait_for(...)` for timeouts. New tests adopt the existing API exactly (the plan instructs: "Adapt to whatever helper API the existing test file uses; do not invent a different API"). Added `_drain_events(stream, settle_ms)` as a small local helper mirroring the plan's intent.

### Rule 2 — Tag-binding for SSE routing

For the 3 tests that create transient playlists (lifecycle + FastAPI DELETE + FastAPI bulk-PUT), the new playlist must be linked to `paired_device.tag_id` via `signage_playlist_tag_map`, otherwise the resolver finds zero affected devices and the SSE stream silently times out. This is critical for correctness (test would always fail) and is sourced directly from the existing `test_directus_tag_map_mutation_still_fires_sse_after_phase68` precedent in the same file.

### TDD split skipped

Per Phase 68 Plan 06 precedent (recorded in STATE.md decisions): "TDD split skipped because bridge already shipped in Phase 65 — single test-only commit." Same logic applies here — Phase 65 LISTEN/NOTIFY bridge and the surviving FastAPI helpers are already in place; these tests are pure regression coverage, not behavior-driving TDD. Single test-only commit `fffc2d1`.

## Self-Check: PASSED

- `backend/tests/signage/test_pg_listen_sse.py`: FOUND (modified, 422 insertions)
- Commit `fffc2d1`: FOUND in git log
- All 4 new test names: FOUND via grep
- Python AST parse: OK
