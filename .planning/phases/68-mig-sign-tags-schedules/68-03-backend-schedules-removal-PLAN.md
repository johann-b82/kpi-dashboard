---
phase: 68-mig-sign-tags-schedules
plan: 03
type: execute
wave: 2
depends_on: ["68-02"]
files_modified:
  - backend/app/routers/signage_admin/schedules.py
  - backend/app/routers/signage_admin/__init__.py
  - backend/tests/test_signage_schedule_router.py
autonomous: true
requirements: [MIG-SIGN-02]

must_haves:
  truths:
    - "FastAPI no longer serves /api/signage/schedules (any method returns 404)"
    - "_fanout_schedule_changed helper does not exist anywhere in backend/"
    - "Phase 65 LISTEN/NOTIFY bridge handles schedule SSE fan-out"
  artifacts:
    - path: "backend/app/routers/signage_admin/schedules.py"
      provides: "DELETED — file no longer exists"
    - path: "backend/app/routers/signage_admin/__init__.py"
      provides: "Router registration without schedules"
  key_links:
    - from: "backend/app/routers/signage_admin/__init__.py"
      to: "schedules module"
      via: "REMOVED"
      pattern: "schedules"
    - from: "Directus write on signage_schedules"
      to: "Pi player schedule-changed SSE"
      via: "Phase 65 trigger → pg_notify → asyncpg listener → notify_device"
      pattern: "schedule-changed"
---

<objective>
Delete the FastAPI signage schedules router (`schedules.py`) and the `_fanout_schedule_changed` helper. Remove its registration in `signage_admin/__init__.py`. Port or delete the existing `test_signage_schedule_router.py` per D-11 — replaced by Plan 06 SSE regression coverage and Plan 02 CHECK constraint test.

Purpose: MIG-SIGN-02 success criterion 1 — FastAPI schedules router is removed; Directus serves schedule CRUD; the Phase 65 LISTEN bridge already handles SSE fan-out (D-00d, D-06).

Output: Two deleted files, one modified file. SSE fan-out is unchanged (Phase 65 bridge already covers `signage_schedules`).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md
@backend/app/routers/signage_admin/schedules.py
@backend/app/routers/signage_admin/__init__.py
@backend/tests/test_signage_schedule_router.py

<interfaces>
`schedules.py` exports:
- `router` (FastAPI APIRouter)
- `_fanout_schedule_changed(db, schedule_id, playlist_ids)` helper — internal; D-06 says no external callers.
- Constant `SCHEDULE_CHANGED_EVENT = "schedule-changed"` — used only by `_fanout_schedule_changed`.

`__init__.py` line 11: `from . import analytics, devices, media, playlist_items, playlists, schedules, tags`
Line 22: `router.include_router(schedules.router)`

After Plan 01 removes `tags`, the line is `from . import analytics, devices, media, playlist_items, playlists, schedules`. After this plan, it must become `from . import analytics, devices, media, playlist_items, playlists`.

`test_signage_schedule_router.py` (470+ LOC) tests the router HTTP shape AND the SSE fan-out. Per D-11, port the SSE fan-out assertions into Plan 06's `test_pg_listen_sse.py` extension (Plan 06 owns that), and delete this file. CHECK-constraint coverage moves to Plan 02's `test_signage_schedule_check.py`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Confirm no external callers, then delete schedules.py</name>
  <files>
    backend/app/routers/signage_admin/schedules.py (DELETE),
    backend/app/routers/signage_admin/__init__.py
  </files>
  <read_first>
    - backend/app/routers/signage_admin/schedules.py
    - backend/app/routers/signage_admin/__init__.py
    - .planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md (D-06)
  </read_first>
  <action>
    1. Run safety greps:
       - `grep -rn "_fanout_schedule_changed" backend/` — expect ONLY hits in `backend/app/routers/signage_admin/schedules.py` (the definition) and `backend/tests/test_signage_schedule_router.py` (test of internal). If any other file references it, abort and surface to operator.
       - `grep -rn "from app\.routers\.signage_admin\.schedules\|signage_admin\.schedules" backend/` — expect ONLY `__init__.py` import.
       - `grep -rn "SCHEDULE_CHANGED_EVENT" backend/` — expect ONLY hits in schedules.py (and possibly the schedule router test). The Phase-65 listener bridge emits the literal string `"schedule-changed"` (verified in `backend/app/services/signage_pg_listen.py`); no need to keep this constant.
    2. `git rm backend/app/routers/signage_admin/schedules.py`.
    3. Edit `backend/app/routers/signage_admin/__init__.py`:
       - Update import line to drop `schedules`: `from . import analytics, devices, media, playlist_items, playlists`.
       - Delete `router.include_router(schedules.router)`.
    4. Run `python -c "from app.main import app; print(len(app.routes))"` — must exit 0 with no ImportError.
  </action>
  <verify>
    <automated>test -f backend/app/routers/signage_admin/schedules.py && exit 1 || true; cd backend && grep -rnE "_fanout_schedule_changed|signage_admin\.schedules|signage_admin import.*schedules" app/ && exit 1 || true; python -c "from app.main import app"</automated>
  </verify>
  <acceptance_criteria>
    - `test -f backend/app/routers/signage_admin/schedules.py` exits 1.
    - `grep -rn "_fanout_schedule_changed" backend/app/` exits 1 (no matches).
    - `grep -rnE "import.*schedules|schedules\.router" backend/app/routers/signage_admin/__init__.py` exits 1.
    - `python -c "from app.main import app"` exits 0.
    - `python -c "from app.main import app; assert not any('/api/signage/schedules' in str(r.path) for r in app.routes)"` exits 0.
  </acceptance_criteria>
  <done>schedules.py deleted; helper gone; package imports cleanly; FastAPI no longer mounts /api/signage/schedules.</done>
</task>

<task type="auto">
  <name>Task 2: Delete test_signage_schedule_router.py per D-11</name>
  <files>backend/tests/test_signage_schedule_router.py (DELETE)</files>
  <read_first>
    - backend/tests/test_signage_schedule_router.py (skim to identify which assertions still have value vs which test deleted FastAPI surface)
    - .planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md (D-09, D-11)
    - backend/tests/signage/test_pg_listen_sse.py (target for Plan 06's port)
  </read_first>
  <action>
    1. Audit `backend/tests/test_signage_schedule_router.py`:
       - HTTP-shape tests (POST/PATCH/DELETE/GET on `/api/signage/schedules`) — DELETE; the surface no longer exists.
       - SSE fan-out assertions — Plan 06 ports these to `test_pg_listen_sse.py` as Directus-originated regression cases.
       - CHECK-constraint / 422 tests — covered by Plan 02's `test_signage_schedule_check.py`.
       - Anything else (e.g., a generic schedule-helper unit test) — capture in SUMMARY.md and decide port-or-delete.
    2. `git rm backend/tests/test_signage_schedule_router.py`.
    3. Run full test suite to confirm no other test imports symbols from this file or from `signage_admin.schedules`:
       - `cd backend && pytest tests/ -x -q --collect-only 2>&1 | grep -i "error\|cannot import" || echo OK`
    4. Document the deletion (and what was ported to which plan) in SUMMARY.md so Plan 06 has a clean handoff list.
  </action>
  <verify>
    <automated>test -f backend/tests/test_signage_schedule_router.py && exit 1 || true; cd backend && pytest tests/ --collect-only -q 2>&1 | grep -iE "error|cannot import" && exit 1 || exit 0</automated>
  </verify>
  <acceptance_criteria>
    - `test -f backend/tests/test_signage_schedule_router.py` exits 1.
    - `cd backend && pytest tests/ --collect-only -q` exits 0 (no import errors from removed module).
    - SUMMARY.md lists which assertions from the deleted file were ported to Plan 06 vs Plan 02 vs deleted outright.
  </acceptance_criteria>
  <done>Test file deleted; pytest collection still clean; SUMMARY hands off to Plan 06.</done>
</task>

</tasks>

<verification>
- `grep -rn "/api/signage/schedules" backend/app/` exits 1 (Plan 07's CI guard will enforce this permanently).
- `grep -rn "_fanout_schedule_changed" backend/` exits 1.
- `cd backend && pytest tests/test_rbac.py tests/signage/test_signage_schedule_check.py -x -q` exits 0.
- `python -c "from app.main import app; routes=[r.path for r in app.routes]; assert '/api/signage/schedules' not in '\n'.join(routes)"` exits 0.
</verification>

<success_criteria>
FastAPI schedules surface gone; helper gone; SSE fan-out continues to work via Phase 65 bridge (verified in Plan 06).
</success_criteria>

<output>
After completion, create `.planning/phases/68-mig-sign-tags-schedules/68-03-SUMMARY.md` listing: deleted files, ported-vs-deleted test assertions, handoff list for Plan 06.
</output>
