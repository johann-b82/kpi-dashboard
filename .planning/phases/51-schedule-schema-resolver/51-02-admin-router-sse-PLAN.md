---
phase: 51-schedule-schema-resolver
plan: 02
type: execute
wave: 2
depends_on:
  - 51-01
files_modified:
  - backend/app/routers/signage_admin/__init__.py
  - backend/app/routers/signage_admin/schedules.py
  - backend/app/routers/signage_admin/playlists.py
  - backend/tests/test_signage_schedule_router.py
  - backend/tests/test_signage_admin_router.py
autonomous: true
requirements:
  - SGN-TIME-04

must_haves:
  truths:
    - "POST /api/signage/schedules creates a schedule, returns 201 with ScheduleRead, fires schedule-changed SSE to every device whose tags overlap the playlist's tags"
    - "PATCH /api/signage/schedules/{id} updates fields (validates start<end on merged state); fires schedule-changed SSE post-commit"
    - "DELETE /api/signage/schedules/{id} captures affected devices pre-commit, deletes, then fires schedule-changed SSE"
    - "GET /api/signage/schedules returns list of all schedules with full ScheduleRead shape"
    - "DELETE /api/signage/playlists/{id} returns 409 with {detail: ..., schedule_ids: [...]} when signage_schedules rows reference the playlist (FK RESTRICT) — same shape as the existing media FK 409"
    - "Schedule routes inherit router-level admin gate from signage_admin/__init__.py — sub-router does NOT add its own require_admin (Phase 43 D-01)"
    - "SSE notify_device fires AFTER db.commit() in every mutation path (no notify-inside-transaction)"
    - "Connected players observe schedule-changed event payload {event: 'schedule-changed', schedule_id: ..., playlist_id: ...} within 2 s of mutation (operator-observed E2E; in-test verified by mocking notify_device)"
  artifacts:
    - path: "backend/app/routers/signage_admin/schedules.py"
      provides: "Schedules CRUD admin router with post-commit SSE fanout"
      contains: "schedule-changed"
      min_lines: 120
    - path: "backend/app/routers/signage_admin/__init__.py"
      provides: "Registers schedules router alongside playlists/media/devices"
      contains: "from . import schedules"
    - path: "backend/app/routers/signage_admin/playlists.py"
      provides: "DELETE handler raises 409 with schedule_ids on FK RESTRICT (Pitfall 4)"
      contains: "schedule_ids"
    - path: "backend/tests/test_signage_schedule_router.py"
      provides: "Router CRUD + SSE fanout assertions + 409 playlist-delete-with-schedule"
      min_lines: 150
  key_links:
    - from: "backend/app/routers/signage_admin/schedules.py"
      to: "backend/app/services/signage_broadcast.py::notify_device"
      via: "for device_id in await devices_affected_by_playlist(db, playlist_id): notify_device(device_id, {...})"
      pattern: "notify_device.*schedule-changed"
    - from: "backend/app/routers/signage_admin/schedules.py"
      to: "backend/app/services/signage_resolver.py::devices_affected_by_playlist"
      via: "affected = await devices_affected_by_playlist(db, schedule.playlist_id)"
      pattern: "devices_affected_by_playlist"
    - from: "backend/app/routers/signage_admin/__init__.py"
      to: "backend/app/routers/signage_admin/schedules.py::router"
      via: "router.include_router(schedules.router)"
      pattern: "include_router\\(schedules\\.router"
    - from: "backend/app/routers/signage_admin/playlists.py::delete_playlist"
      to: "FK RESTRICT IntegrityError handler"
      via: "except IntegrityError: select schedule ids; raise HTTPException(409, {detail, schedule_ids})"
      pattern: "schedule_ids"
---

<objective>
Add the `signage_admin/schedules.py` CRUD router with post-commit SSE fanout (event kind `schedule-changed`, payload mirrors `playlist-changed` per D-02). Register the new sub-router. Patch `playlists.py` DELETE to return 409 with `schedule_ids` when `signage_schedules` rows reference the playlist (FK RESTRICT — RESEARCH §Open Question 2 / Pitfall 4). Cover all paths with router tests including a `notify_device` mock that asserts the SSE payload + recipient set.

Purpose: SGN-TIME-04 (mutation → SSE fanout in ≤ 2 s; ETag short-circuit makes no-op cheap).
Output: Operator can CRUD schedules via authenticated admin endpoints; connected players receive `schedule-changed` events; deleting a playlist with active schedules returns a clear 409 instead of a 500.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/51-schedule-schema-resolver/51-CONTEXT.md
@.planning/phases/51-schedule-schema-resolver/51-RESEARCH.md
@.planning/phases/51-schedule-schema-resolver/51-01-schema-resolver-PLAN.md

# Reference patterns — read before editing (the plan is the prompt; do not "explore")
@backend/app/routers/signage_admin/__init__.py
@backend/app/routers/signage_admin/playlists.py
@backend/app/routers/signage_admin/media.py
@backend/app/services/signage_broadcast.py
@backend/app/services/signage_resolver.py
@backend/tests/test_signage_admin_router.py
@backend/tests/test_signage_broadcast.py

<interfaces>
<!-- Existing contracts the schedules router must use as-is (no modification) -->

From backend/app/services/signage_broadcast.py:
```python
def notify_device(device_id: uuid.UUID, payload: dict) -> None:
    """Drops payload into the device's in-process asyncio.Queue. Non-blocking; --workers 1 invariant."""
```

From backend/app/services/signage_resolver.py (Phase 43):
```python
async def devices_affected_by_playlist(
    db: AsyncSession, playlist_id: uuid.UUID
) -> list[uuid.UUID]: ...
```

From backend/app/routers/signage_admin/__init__.py (Phase 43 D-01 — router-level admin gate):
```python
from fastapi import APIRouter, Depends
from app.deps.auth import get_current_user, require_admin

router = APIRouter(
    prefix="/api/signage",
    dependencies=[Depends(get_current_user), Depends(require_admin)],
)
# include_router calls follow — schedules.router will be appended here.
```

From backend/app/routers/signage_admin/playlists.py — post-commit fanout TEMPLATE:
```python
# Existing pattern after a playlist mutation:
await db.commit()
affected = await devices_affected_by_playlist(db, playlist_id)
for did in affected:
    notify_device(did, {"event": "playlist-changed", "playlist_id": str(playlist_id)})
```

NEW event payload shape (this plan, per D-02):
```python
{"event": "schedule-changed", "schedule_id": str(schedule.id), "playlist_id": str(schedule.playlist_id)}
```

Existing media FK RESTRICT 409 pattern (Plan 43-03 — mirror for schedules):
```python
# In media DELETE handler when playlist_items references the media:
# raise HTTPException(409, detail={"detail": "...", "playlist_ids": [...]})
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: signage_admin/schedules.py CRUD router + SSE fanout</name>
  <files>backend/app/routers/signage_admin/schedules.py, backend/app/routers/signage_admin/__init__.py</files>
  <read_first>
    - backend/app/routers/signage_admin/playlists.py (entire file — copy structural pattern: APIRouter, CRUD handlers, post-commit fanout loop, sub-router NO admin gate)
    - backend/app/routers/signage_admin/__init__.py (exact include_router pattern + alphabetic order convention)
    - backend/app/services/signage_broadcast.py (notify_device signature; queue full warn-once)
    - backend/app/services/signage_resolver.py (devices_affected_by_playlist signature)
    - .planning/phases/51-schedule-schema-resolver/51-CONTEXT.md (D-02 payload shape; new event kind 'schedule-changed')
    - .planning/phases/51-schedule-schema-resolver/51-RESEARCH.md (Pattern 4 admin router; Anti-Pattern: do NOT add require_admin to sub-router)
  </read_first>
  <behavior>
    - `APIRouter(prefix="/schedules", tags=["signage-admin-schedules"])` — NO `dependencies=` parameter (parent router supplies admin gate per D-01)
    - `POST /api/signage/schedules` body=ScheduleCreate → 201 ScheduleRead; refetches row with `selectinload` for clean Read shape; fires SSE post-commit
    - `GET /api/signage/schedules` → list[ScheduleRead] of all rows ordered by `priority DESC, updated_at DESC`
    - `GET /api/signage/schedules/{id}` → ScheduleRead, 404 on missing
    - `PATCH /api/signage/schedules/{id}` body=ScheduleUpdate → 200 ScheduleRead. After applying merge, validates `start_hhmm < end_hhmm` on the merged state and returns 422 if violated (DB CHECK is the second line of defense). Captures `old_playlist_id` BEFORE commit; if `playlist_id` changed, fans out to devices affected by BOTH old and new playlists (union)
    - `DELETE /api/signage/schedules/{id}` → 204. Captures `playlist_id` BEFORE commit; deletes; fans out post-commit
    - SSE payload exact shape: `{"event": "schedule-changed", "schedule_id": str(uuid), "playlist_id": str(uuid)}` per D-02. UUIDs serialized as strings (Phase 45 pattern)
    - `notify_device` fanout wrapped in `try/except` (broadcast failure must not undo the DB mutation — Phase 45 Plan 02 invariant)
    - Sub-router registered in `__init__.py` via `from . import schedules` + `router.include_router(schedules.router)` placed alphabetically (after `playlists`, before `tags`)
  </behavior>
  <action>
    1. **Create `backend/app/routers/signage_admin/schedules.py`** mirroring `playlists.py` structure:
    ```python
    """Schedules admin CRUD. Inherits router-level admin gate from parent router (D-01).

    Post-commit SSE fanout via devices_affected_by_playlist + notify_device with event
    'schedule-changed' (D-02). Distinct from 'playlist-changed' so the player/sidecar can
    log/trace schedule-driven re-resolves separately even though handler logic is identical.
    """
    from __future__ import annotations
    import logging
    import uuid
    from fastapi import APIRouter, Depends, HTTPException, status
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.database import get_db
    from app.models.signage import SignageSchedule
    from app.schemas.signage import ScheduleCreate, ScheduleRead, ScheduleUpdate
    from app.services.signage_broadcast import notify_device
    from app.services.signage_resolver import devices_affected_by_playlist

    log = logging.getLogger(__name__)

    # NO `dependencies=` here — parent router supplies admin gate (D-01).
    router = APIRouter(prefix="/schedules", tags=["signage-admin-schedules"])

    SCHEDULE_CHANGED_EVENT = "schedule-changed"

    async def _fanout_schedule_changed(
        db: AsyncSession,
        *,
        schedule_id: uuid.UUID,
        playlist_ids: set[uuid.UUID],
    ) -> None:
        """Post-commit fanout. Failures must NOT propagate (Phase 45 Plan 02 invariant)."""
        try:
            affected: set[uuid.UUID] = set()
            for pid in playlist_ids:
                affected.update(await devices_affected_by_playlist(db, pid))
            for did in affected:
                try:
                    notify_device(did, {
                        "event": SCHEDULE_CHANGED_EVENT,
                        "schedule_id": str(schedule_id),
                        "playlist_id": str(next(iter(playlist_ids))),
                    })
                except Exception:  # broadcast errors never roll back state
                    log.warning("notify_device failed for device %s", did, exc_info=True)
        except Exception:
            log.warning("schedule fanout failed for schedule %s", schedule_id, exc_info=True)

    @router.post("", response_model=ScheduleRead, status_code=status.HTTP_201_CREATED)
    async def create_schedule(body: ScheduleCreate, db: AsyncSession = Depends(get_db)) -> SignageSchedule:
        sched = SignageSchedule(
            playlist_id=body.playlist_id,
            weekday_mask=body.weekday_mask,
            start_hhmm=body.start_hhmm,
            end_hhmm=body.end_hhmm,
            priority=body.priority,
            enabled=body.enabled,
        )
        db.add(sched)
        await db.commit()
        await db.refresh(sched)
        await _fanout_schedule_changed(db, schedule_id=sched.id, playlist_ids={sched.playlist_id})
        return sched

    @router.get("", response_model=list[ScheduleRead])
    async def list_schedules(db: AsyncSession = Depends(get_db)) -> list[SignageSchedule]:
        stmt = select(SignageSchedule).order_by(
            SignageSchedule.priority.desc(), SignageSchedule.updated_at.desc()
        )
        return list((await db.execute(stmt)).scalars().all())

    @router.get("/{schedule_id}", response_model=ScheduleRead)
    async def get_schedule(schedule_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> SignageSchedule:
        sched = await db.get(SignageSchedule, schedule_id)
        if sched is None:
            raise HTTPException(404, "schedule not found")
        return sched

    @router.patch("/{schedule_id}", response_model=ScheduleRead)
    async def update_schedule(
        schedule_id: uuid.UUID, body: ScheduleUpdate, db: AsyncSession = Depends(get_db)
    ) -> SignageSchedule:
        sched = await db.get(SignageSchedule, schedule_id)
        if sched is None:
            raise HTTPException(404, "schedule not found")
        old_playlist_id = sched.playlist_id
        data = body.model_dump(exclude_unset=True)
        for k, v in data.items():
            setattr(sched, k, v)
        # Validate merged state — DB CHECK is the second line of defense
        if sched.start_hhmm >= sched.end_hhmm:
            raise HTTPException(422, "start_hhmm must be less than end_hhmm")
        await db.commit()
        await db.refresh(sched)
        playlist_ids = {old_playlist_id, sched.playlist_id}
        await _fanout_schedule_changed(db, schedule_id=sched.id, playlist_ids=playlist_ids)
        return sched

    @router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_schedule(schedule_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
        sched = await db.get(SignageSchedule, schedule_id)
        if sched is None:
            raise HTTPException(404, "schedule not found")
        playlist_id = sched.playlist_id  # capture pre-commit
        await db.delete(sched)
        await db.commit()
        await _fanout_schedule_changed(db, schedule_id=schedule_id, playlist_ids={playlist_id})
        return None
    ```

    2. **Register in `backend/app/routers/signage_admin/__init__.py`**: add `from . import schedules` to the import block (alphabetical: after `playlists`, before `tags`) and `router.include_router(schedules.router)` in the same alphabetic position. Do NOT add per-route dependencies.

    3. The fanout uses `next(iter(playlist_ids))` for the payload's `playlist_id`. For the union-fanout case (PATCH that changes playlist_id), the executor MUST emit ONE event per affected playlist_id (loop the outer `for pid in playlist_ids:` calling `notify_device` per device per pid) so the player can correlate. Refactor `_fanout_schedule_changed` to send a notify per `(device, playlist_id)` pair when there are multiple playlist_ids. (The above sketch collapses; the implementation must split.)
  </action>
  <verify>
    <automated>cd backend &amp;&amp; python -c "from app.routers.signage_admin.schedules import router; assert router.prefix == '/schedules'" &amp;&amp; python -c "from app.routers.signage_admin import router as r; paths = [route.path for route in r.routes]; assert any('/schedules' in p for p in paths), paths" &amp;&amp; pytest backend/tests/test_signage_admin_router.py -x</automated>
  </verify>
  <done>
    - `grep -c "from . import schedules" backend/app/routers/signage_admin/__init__.py` returns 1
    - `grep -c "include_router(schedules.router)" backend/app/routers/signage_admin/__init__.py` returns 1
    - `grep -c "schedule-changed" backend/app/routers/signage_admin/schedules.py` returns ≥ 1
    - `grep -c "dependencies=" backend/app/routers/signage_admin/schedules.py` returns 0 (sub-router inherits gate per D-01)
    - `grep -cE "@router\\.(post|get|patch|delete)" backend/app/routers/signage_admin/schedules.py` returns 5 (POST, 2x GET, PATCH, DELETE)
    - `grep -c "notify_device" backend/app/routers/signage_admin/schedules.py` returns ≥ 1
    - `pytest backend/tests/test_signage_admin_router.py -x` still passes (no regression)
    - Existing CI dep-audit test (`tests/test_signage_router_deps.py`) still passes (admin gate present at parent)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: playlists.py DELETE — 409 on FK RESTRICT from signage_schedules + router/SSE integration tests</name>
  <files>backend/app/routers/signage_admin/playlists.py, backend/tests/test_signage_schedule_router.py</files>
  <read_first>
    - backend/app/routers/signage_admin/playlists.py (current DELETE handler; existing 409 pattern from Plan 43-03 — playlist_ids returned for media FK)
    - backend/app/routers/signage_admin/media.py (the media DELETE 409 with playlist_ids — exact JSONResponse shape to mirror for schedule_ids)
    - backend/tests/test_signage_admin_router.py (auth fixtures, admin/non-admin clients, AsyncClient pattern with httpx ASGITransport)
    - backend/tests/test_signage_broadcast.py (how to mock notify_device or assert against the in-process queue; monkeypatching strategy)
    - .planning/phases/51-schedule-schema-resolver/51-RESEARCH.md (Pitfall 4 FK RESTRICT 409; Open Question 2)
  </read_first>
  <behavior>
    - **Playlist DELETE 409:** When schedules reference the playlist, `DELETE /api/signage/playlists/{id}` returns 409 with body `{"detail": "playlist has active schedules", "schedule_ids": ["<uuid>", ...]}` instead of bubbling a 500. Mirrors the media→playlist FK 409 pattern.
    - **Schedules CRUD smoke:** POST creates, GET list returns it, GET by id returns it, PATCH updates, DELETE removes. Non-admin user gets 403 on every endpoint (parent admin gate).
    - **PATCH validation:** Merging `{end_hhmm: 700}` onto a row with `start_hhmm=800` returns 422 "start_hhmm must be less than end_hhmm".
    - **SSE fanout assertion:** Mock `notify_device` (monkeypatch on `app.routers.signage_admin.schedules.notify_device`); after POST, assert mock was called once per device whose tags overlap the playlist's tags; payload is exactly `{"event": "schedule-changed", "schedule_id": "<uuid>", "playlist_id": "<uuid>"}`.
    - **PATCH cross-playlist fanout:** After PATCH that changes `playlist_id` from A to B, mock recipient set = `devices_affected_by_playlist(A) ∪ devices_affected_by_playlist(B)`; one notify per (device, playlist_id) pair.
    - **DELETE pre-commit capture:** After DELETE, mock was still called with the (now-orphaned) playlist_id captured before commit.
    - **Notify-after-commit ordering:** Test asserts `notify_device` is called AFTER the row is no longer in DB (DELETE) / has new values (PATCH).
  </behavior>
  <action>
    1. **Patch `backend/app/routers/signage_admin/playlists.py` DELETE handler** — wrap the delete + commit in `try/except IntegrityError`. On catch: re-query `signage_schedules` for rows referencing this playlist, return `JSONResponse(status_code=409, content={"detail": "playlist has active schedules", "schedule_ids": [...]})`. Mirror the existing media 409 shape (the media DELETE returns `{"detail": ..., "playlist_ids": [...]}` — same field-naming convention).
    ```python
    from sqlalchemy.exc import IntegrityError
    from fastapi.responses import JSONResponse
    from app.models.signage import SignageSchedule

    # Inside delete_playlist (sketch — adapt to existing handler shape):
    try:
        await db.delete(playlist)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        sched_ids = (await db.execute(
            select(SignageSchedule.id).where(SignageSchedule.playlist_id == playlist_id)
        )).scalars().all()
        return JSONResponse(
            status_code=409,
            content={
                "detail": "playlist has active schedules",
                "schedule_ids": [str(sid) for sid in sched_ids],
            },
        )
    ```

    2. **Create `backend/tests/test_signage_schedule_router.py`** with the following tests (use the existing `admin_client` / `viewer_client` fixtures from `conftest.py` if present — match `test_signage_admin_router.py` style):

    Required test functions (each `@pytest.mark.asyncio`):
    - `test_create_schedule_returns_201_and_fires_sse(monkeypatch)` — monkeypatch `app.routers.signage_admin.schedules.notify_device`, assert call recorded with correct payload + recipient set
    - `test_list_schedules_orders_by_priority_then_updated_at`
    - `test_get_schedule_404_for_missing`
    - `test_patch_schedule_validates_start_lt_end_returns_422`
    - `test_patch_schedule_changing_playlist_fans_out_union(monkeypatch)` — verifies devices affected by BOTH old + new playlists notified
    - `test_delete_schedule_captures_playlist_id_pre_commit(monkeypatch)` — DELETE then assert notify called with the captured playlist_id even though row is gone
    - `test_non_admin_403_on_all_schedule_endpoints` — uses viewer_client fixture
    - `test_delete_playlist_with_active_schedules_returns_409_with_schedule_ids` — covers the playlists.py patch
    - `test_delete_playlist_409_body_shape` — body is `{"detail": "...", "schedule_ids": ["<uuid>"]}`; schedule_ids is a list of strings

    Use httpx `AsyncClient` with `ASGITransport` (same pattern as `test_signage_admin_router.py`). DO NOT use `httpx.stream` for these tests (Phase 45 Plan 02 lesson: ASGI infinite generators).
  </action>
  <verify>
    <automated>cd backend &amp;&amp; pytest tests/test_signage_schedule_router.py -x -v &amp;&amp; pytest tests/test_signage_admin_router.py -x &amp;&amp; pytest tests/test_signage_router_deps.py -x</automated>
  </verify>
  <done>
    - `grep -c "schedule_ids" backend/app/routers/signage_admin/playlists.py` returns ≥ 2 (response body + select query)
    - `grep -c "IntegrityError" backend/app/routers/signage_admin/playlists.py` returns ≥ 1
    - `grep -cE "def test_(create_schedule_returns_201_and_fires_sse|list_schedules_orders|get_schedule_404|patch_schedule_validates|patch_schedule_changing_playlist|delete_schedule_captures|non_admin_403_on_all_schedule|delete_playlist_with_active_schedules|delete_playlist_409_body_shape)" backend/tests/test_signage_schedule_router.py` returns 9
    - `pytest backend/tests/test_signage_schedule_router.py -x` passes all 9 tests
    - `pytest backend/tests/test_signage_admin_router.py -x` still green (no regression)
    - `pytest backend/tests/test_signage_router_deps.py -x` still green (admin gate preserved)
    - `pytest backend/tests/ -k signage -x` all green
  </done>
</task>

</tasks>

<verification>
- Schedules router registered: `python -c "from app.routers.signage_admin import router; assert any('/schedules' in r.path for r in router.routes)"` exits 0
- Sub-router has no admin gate (D-01): `grep -c "dependencies=\\[Depends" backend/app/routers/signage_admin/schedules.py` returns 0
- Post-commit fanout (no notify-inside-tx): `grep -B5 "notify_device" backend/app/routers/signage_admin/schedules.py` shows `await db.commit()` before each notify path
- Playlist DELETE 409 with schedule_ids: `pytest backend/tests/test_signage_schedule_router.py::test_delete_playlist_with_active_schedules_returns_409_with_schedule_ids -x` passes
- All 9 router/SSE tests pass
- No regression in existing signage tests: `pytest backend/tests/ -k signage -x` green
- CI grep guards still pass: no `import sqlite3`, no `import psycopg2`, no sync `subprocess.run`, no f-string in log args
- `--workers 1` invariant block in `signage_broadcast.py` not modified
</verification>

<success_criteria>
- SGN-TIME-04 ✅: Schedule create/update/delete fire `schedule-changed` SSE post-commit via `devices_affected_by_playlist` (D-02 broad fanout)
- Schedules CRUD usable from admin frontend (Phase 52 will consume)
- Playlist DELETE returns clean 409 with `schedule_ids` instead of 500 when schedules block (RESEARCH Open Question 2 closed)
- Operator-observable: schedule save → connected player re-resolves within 2 s (verified at phase-level operator E2E in /gsd:verify-work)
</success_criteria>

<output>
After completion, create `.planning/phases/51-schedule-schema-resolver/51-02-SUMMARY.md` documenting:
- Final route table (POST/GET/GET/PATCH/DELETE under `/api/signage/schedules`)
- Exact SSE payload shape used (single playlist_id vs per-pair when PATCH changes playlist_id)
- 409 response body shape adopted for `playlists.py` (mirrors media 409 field naming)
- Any RESEARCH.md open questions resolved (Q2 FK 409, Q3 timezone error propagation)
- Carry-forward for Phase 52 admin UI: schedule list payload shape, validation error messages to surface
</output>
