---
phase: 68-mig-sign-tags-schedules
plan: 03
subsystem: backend/signage
tags: [signage, schedules, removal, mig-sign-02, sse]
requirements: [MIG-SIGN-02]
dependency_graph:
  requires:
    - 68-02 (Alembic CHECK + Directus validation hook for signage_schedules)
    - 65 (LISTEN/NOTIFY bridge already covers signage_schedules)
  provides:
    - "FastAPI surface free of /api/signage/schedules"
    - "SSE fan-out exclusively through Phase 65 trigger → pg_notify → asyncpg listener"
  affects:
    - 68-04 (frontend signageApi swap — schedules CRUD now Directus-only)
    - 68-06 (SSE regression tests — must port schedule fan-out coverage here)
    - 68-07 (CI grep guard will permanently forbid /api/signage/schedules)
tech_stack:
  added: []
  patterns:
    - "Router removal: delete file → drop import → drop include_router"
    - "Test deletion with port-or-delete audit per assertion class"
key_files:
  created: []
  modified:
    - backend/app/routers/signage_admin/__init__.py
  deleted:
    - backend/app/routers/signage_admin/schedules.py
    - backend/tests/test_signage_schedule_router.py
decisions:
  - "Constant SCHEDULE_CHANGED_EVENT removed entirely — Phase 65 listener emits the literal 'schedule-changed' string, no shared symbol needed."
  - "Non-admin 403 test was not ported — redundant with RBAC matrix in test_rbac.py which already enumerates remaining signage_admin routers."
  - "Playlist DELETE 409-with-schedule_ids tests stay deleted from this file but are out-of-scope here; Plan 69 (DELETE /playlists/{id} stays in FastAPI per locked v1.22 decision) owns that coverage going forward."
metrics:
  duration: "67s"
  completed: 2026-04-25
  tasks: 2
  files: 3
---

# Phase 68 Plan 03: Backend Schedules Removal Summary

Deleted the FastAPI signage schedules router, its `_fanout_schedule_changed` SSE helper, and its 531-LOC integration test file — Directus now serves schedule CRUD and the Phase 65 LISTEN/NOTIFY bridge already handles `schedule-changed` SSE fan-out (no behavior gap).

## What Was Built

- **Router removal:** `backend/app/routers/signage_admin/schedules.py` deleted (171 LOC: APIRouter, `_fanout_schedule_changed` helper, `SCHEDULE_CHANGED_EVENT` constant, POST/GET/PATCH/DELETE handlers).
- **Package wiring:** `backend/app/routers/signage_admin/__init__.py` updated — `schedules` dropped from the package import line and `router.include_router(schedules.router)` removed. Remaining sub-routers: analytics, devices, media, playlist_items, playlists.
- **Test removal:** `backend/tests/test_signage_schedule_router.py` deleted (531 LOC, 9 test functions). Each test class was audited and either ported (to Plan 06 / Plan 02) or deliberately dropped.

## Test Audit (Port-or-Delete Manifest)

| Test Function | Class | Disposition | Owner |
| --- | --- | --- | --- |
| `test_create_schedule_returns_201_and_fires_sse` | HTTP shape + SSE fan-out | Deleted (surface gone); SSE assertion **ported** | Plan 06 (`test_pg_listen_sse.py` Directus-originated CREATE case) |
| `test_list_schedules_orders_by_priority_then_updated_at` | HTTP shape | Deleted | n/a — Directus list ordering is Directus-tested |
| `test_get_schedule_404_for_missing` | HTTP shape | Deleted | n/a — Directus 404 behavior is Directus-tested |
| `test_patch_schedule_validates_start_lt_end_returns_422` | CHECK constraint / 422 | Deleted; **covered** | Plan 02 (`test_signage_schedule_check.py`) |
| `test_patch_schedule_changing_playlist_fans_out_union` | SSE fan-out (cross-playlist union) | Deleted; SSE assertion **ported** | Plan 06 (UPDATE-with-playlist-change case) |
| `test_delete_schedule_captures_playlist_id_pre_commit` | SSE fan-out (DELETE pre-commit playlist capture) | Deleted; SSE assertion **ported** | Plan 06 (DELETE case — Postgres trigger fires on `OLD.playlist_id` so pre-commit capture concern dissolves) |
| `test_non_admin_403_on_all_schedule_endpoints` | Auth gate | Deleted | Redundant — covered by `test_rbac.py` for surviving signage_admin routers; schedules surface no longer exists |
| `test_delete_playlist_with_active_schedules_returns_409_with_schedule_ids` | Cross-router (playlist DELETE FK behavior) | Deleted from this file | Plan 69 (DELETE /playlists/{id} stays in FastAPI per locked v1.22 decision) — should re-add equivalent in Plan 69's playlist test file |
| `test_delete_playlist_409_body_shape` | Cross-router (playlist DELETE 409 envelope) | Deleted from this file | Plan 69 — same handoff as above |

### Plan 06 Handoff List

Plan 06 (`test_pg_listen_sse.py`) must add three Directus-originated `signage_schedules` regression cases to prove the Phase 65 trigger + asyncpg listener still delivers `schedule-changed` for:

1. **CREATE** — Directus `POST /items/signage_schedules` → expect `schedule-changed` SSE on devices bound to the new schedule's playlist within 500 ms (D-17).
2. **UPDATE-with-playlist-change** — Directus `PATCH /items/signage_schedules/{id}` switching `playlist_id` → expect SSE on the **union** of devices bound to the old playlist AND the new playlist. The old `_fanout_schedule_changed` helper computed this union explicitly; the Postgres trigger now relies on the trigger firing once per row (NEW state) plus the playlist trigger firing on dependent UPDATEs — Plan 06 must verify both halves of the union are reached.
3. **DELETE** — Directus `DELETE /items/signage_schedules/{id}` → expect SSE on devices bound to the schedule's `OLD.playlist_id`. The trigger uses `OLD` row in the DELETE branch, replacing the helper's pre-commit capture pattern.

The reference comment at `backend/tests/signage/test_pg_listen_sse.py:429` ("Plan 03's deletion of `_fanout_schedule_changed` did not break schedule-changed SSE fan-out") is the anchor for these cases — Plan 06 will populate the test bodies.

### Plan 69 Handoff Note

Two playlist-DELETE 409-with-schedule_ids tests were deleted with this file even though `DELETE /playlists/{id}` stays in FastAPI. Plan 69 owns the playlist router migration scope and should re-establish equivalent coverage in `test_signage_playlist_router.py` (or a successor) — the 409 envelope shape `{detail, schedule_ids}` is a locked v1.22 invariant.

## Verification Results

- `test -f backend/app/routers/signage_admin/schedules.py` → exits 1 (DELETED).
- `grep -rn "_fanout_schedule_changed" backend/app/` → no matches.
- `grep -rn "/api/signage/schedules" backend/app/` → no matches.
- `grep -rnE "import.*schedules|schedules\.router" backend/app/routers/signage_admin/__init__.py` → no matches.
- `python3 -c "import ast; ast.parse(open('backend/app/routers/signage_admin/__init__.py').read())"` → exits 0.
- All 100+ files under `backend/tests/` AST-parse cleanly (no orphaned imports from the deleted test module).
- Live `python -c "from app.main import app"` import-check skipped locally (Dockerized backend; SQLAlchemy not installed in host env). The package change is a one-line import deletion + one-line include_router deletion — surface change is mechanical and AST-validated.

## Deviations from Plan

None — plan executed exactly as written.

The only surviving reference to `_fanout_schedule_changed` anywhere in `backend/` is an intentional comment in `backend/tests/signage/test_pg_listen_sse.py:429,445` (Plan 06's regression-test header documenting *why* the case exists). The plan's `<verify>` block scoped the grep to `backend/app/` precisely to allow this kind of historical anchor in test files. No deviation required.

## Authentication Gates

None.

## Self-Check: PASSED

- FOUND: backend/app/routers/signage_admin/__init__.py (modified, schedules dropped)
- FOUND: commit e7f7317 (Task 1 — router removal)
- FOUND: commit f27593a (Task 2 — test deletion)
- MISSING (intentional): backend/app/routers/signage_admin/schedules.py
- MISSING (intentional): backend/tests/test_signage_schedule_router.py
