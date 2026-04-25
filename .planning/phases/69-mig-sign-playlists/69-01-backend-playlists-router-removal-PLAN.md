---
phase: 69-mig-sign-playlists
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/routers/signage_admin/playlists.py
autonomous: true
requirements: [MIG-SIGN-03]

must_haves:
  truths:
    - "FastAPI POST /api/signage/playlists is gone (returns 404)"
    - "FastAPI GET /api/signage/playlists is gone (returns 404)"
    - "FastAPI GET /api/signage/playlists/{id} is gone (returns 404)"
    - "FastAPI PATCH /api/signage/playlists/{id} is gone (returns 404)"
    - "FastAPI PUT /api/signage/playlists/{id}/tags is gone (returns 404)"
    - "FastAPI DELETE /api/signage/playlists/{id} STILL exists and still returns structured 409 {detail, schedule_ids}"
    - "_notify_playlist_changed helper RETAINED — surviving DELETE still imports + invokes it"
  artifacts:
    - path: "backend/app/routers/signage_admin/playlists.py"
      provides: "Surviving DELETE /{id} endpoint + _notify_playlist_changed helper only"
      contains: "@router.delete"
  key_links:
    - from: "Surviving DELETE /api/signage/playlists/{id}"
      to: "_notify_playlist_changed helper"
      via: "explicit fan-out alongside Phase 65 LISTEN bridge (D-04b, D-05a)"
      pattern: "await _notify_playlist_changed"
---

<objective>
Migrate playlist metadata CRUD + PUT-tags from `backend/app/routers/signage_admin/playlists.py` to Directus by DELETING the FastAPI route handlers. Keep `DELETE /api/signage/playlists/{id}` (preserves structured 409 `{detail, schedule_ids}` shape per D-00 architectural lock) and the `_notify_playlist_changed` helper (D-04b, D-05a — surviving DELETE still needs explicit fan-out).

Purpose: MIG-SIGN-03 backend leg — Directus becomes sole writer for playlist metadata + tag-map. Mirrors Phase 68 Plan 01 (tags removal) and Phase 68 Plan 03 (schedules removal) pattern.

Output: Trimmed `playlists.py` retaining only DELETE handler + helper + minimum imports.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/69-mig-sign-playlists/69-CONTEXT.md
@.planning/phases/68-mig-sign-tags-schedules/68-01-backend-tags-removal-PLAN.md
@.planning/phases/68-mig-sign-tags-schedules/68-03-backend-schedules-removal-PLAN.md
@backend/app/routers/signage_admin/playlists.py
@backend/app/routers/signage_admin/__init__.py

<interfaces>
Current `playlists.py` exports `router = APIRouter(prefix="/playlists", ...)` registered in `signage_admin/__init__.py:20`. Routes (verified by Read):
- `POST /` → DELETE
- `GET /` → DELETE
- `GET /{playlist_id}` → DELETE
- `PATCH /{playlist_id}` → DELETE
- `PUT /{playlist_id}/tags` → DELETE
- `DELETE /{playlist_id}` → KEEP (preserves 409 structured shape consumed by `frontend/src/signage/components/PlaylistDeleteDialog.tsx`)

Helper to KEEP (D-04b, D-05a) at line 39:
```python
async def _notify_playlist_changed(db: AsyncSession, playlist_id) -> None:
    affected = await devices_affected_by_playlist(db, playlist_id)
    for device_id in affected:
        from app.models import SignageDevice as _Dev
        dev = (await db.execute(select(_Dev).where(_Dev.id == device_id))).scalar_one_or_none()
        if dev is None:
            continue
        envelope = await resolve_playlist_for_device(db, dev)
        payload = {"event": "playlist-changed", "playlist_id": str(playlist_id), "etag": compute_playlist_etag(envelope)}
        signage_broadcast.notify_device(device_id, payload)
```

Surviving DELETE handler must continue to:
1. Query `signage_schedules` for FK references → if any, return JSONResponse(status=409, content={"detail": "...", "schedule_ids": [...]}).
2. On clean delete, call `await _notify_playlist_changed(db, playlist_id)` AFTER `await db.commit()` (Pitfall 3).

Models still imported: `SignagePlaylist`, `SignageSchedule` (for 409 shape). `SignagePlaylistTagMap` no longer needed in this file (PUT-tags moved to Directus). Pydantic schemas `SignagePlaylistCreate`, `SignagePlaylistRead` no longer needed.

No router-level wiring change in `__init__.py` — it still imports `playlists` for the surviving DELETE.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Delete migrated routes from playlists.py; preserve DELETE + helper</name>
  <files>backend/app/routers/signage_admin/playlists.py</files>
  <read_first>
    - backend/app/routers/signage_admin/playlists.py (full file)
    - backend/app/routers/signage_admin/__init__.py
    - .planning/phases/69-mig-sign-playlists/69-CONTEXT.md (D-04, D-04b, D-05a)
    - .planning/phases/68-mig-sign-tags-schedules/68-03-backend-schedules-removal-PLAN.md (precedent: surgical removal with helper retention)
  </read_first>
  <behavior>
    - GET, POST, PATCH, PUT-tags routes removed (no `@router.post(""), @router.get(""), @router.get("/{...}"), @router.patch("/{...}"), @router.put("/{...}/tags")` remain).
    - DELETE `/{playlist_id}` handler unchanged in behavior: returns 409 `{detail, schedule_ids}` if FK-referenced, 204 on clean delete, fires `_notify_playlist_changed` post-commit.
    - `_notify_playlist_changed` helper still defined and imported by the DELETE handler.
    - Module imports trimmed to only what surviving DELETE + helper need.
  </behavior>
  <action>
    1. Read `backend/app/routers/signage_admin/playlists.py` end-to-end to identify exact route boundaries.
    2. Delete the following decorator blocks and their function bodies:
       - `@router.post("")` (create playlist)
       - `@router.get("")` (list playlists)
       - `@router.get("/{playlist_id}")` (get playlist by id)
       - `@router.patch("/{playlist_id}")` (update playlist)
       - `@router.put("/{playlist_id}/tags")` (replace playlist tags)
    3. KEEP `@router.delete("/{playlist_id}")` exactly as written, including the 409 schedule_ids construction and the post-commit `await _notify_playlist_changed(db, playlist_id)` invocation.
    4. KEEP the `_notify_playlist_changed` async helper (line 39 area) verbatim.
    5. KEEP the model classes `SignagePlaylistUpdate` and `TagAssignmentRequest` ONLY if the surviving DELETE references them. If neither is referenced after route removal (likely true — DELETE takes only path arg), remove them. Verify with grep before removing.
    6. Trim imports:
       - Drop `from pydantic import BaseModel, Field` if `SignagePlaylistUpdate` / `TagAssignmentRequest` are gone.
       - Drop `from sqlalchemy import insert` (only PUT-tags used INSERT). Keep `delete, select` (DELETE handler uses them for FK check + cleanup).
       - Drop `from sqlalchemy.exc import IntegrityError` if no longer raised by surviving handler (verify).
       - Drop `from app.models import SignagePlaylistTagMap` (no longer used).
       - Drop `from app.schemas.signage import SignagePlaylistCreate, SignagePlaylistRead` (no longer used; DELETE returns Response, not schema).
       - KEEP imports needed by helper: `compute_playlist_etag`, `devices_affected_by_playlist`, `resolve_playlist_for_device`, `signage_broadcast`, `SignagePlaylist`, `SignageSchedule`, `AsyncSession`, `get_async_db_session`, `select`, `delete`, `APIRouter`, `Depends`, `HTTPException`, `JSONResponse`, `uuid`.
    7. Update the module docstring to reflect post-Phase-69 state: "Phase 69 MIG-SIGN-03: surviving DELETE only. POST/GET/PATCH/PUT-tags moved to Directus collections `signage_playlists` + `signage_playlist_tag_map`. DELETE stays here to preserve structured 409 {detail, schedule_ids} shape consumed by PlaylistDeleteDialog."
    8. Run `cd backend && python -c "from app.routers.signage_admin import router; print(router)"` to confirm import-time soundness.
    9. Run the existing pytest suite: `cd backend && pytest tests/signage/ -v --co -q` (collection only, fast) — no import-time errors.
  </action>
  <verify>
    <automated>cd backend && python -c "from app.routers.signage_admin import playlists; assert hasattr(playlists, '_notify_playlist_changed'); assert any(r.path.endswith('/playlists/{playlist_id}') and 'DELETE' in r.methods for r in playlists.router.routes), 'DELETE missing'; bad=[r for r in playlists.router.routes if any(m in r.methods for m in {'POST','GET','PATCH','PUT'})]; assert not bad, f'unexpected routes: {bad}'"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "^@router\.(post|get|patch)\b" backend/app/routers/signage_admin/playlists.py` returns 0 matches.
    - `grep -nE "^@router\.put\b.*tags" backend/app/routers/signage_admin/playlists.py` returns 0 matches.
    - `grep -nE "^@router\.delete\b" backend/app/routers/signage_admin/playlists.py` returns exactly 1 match.
    - `grep -n "_notify_playlist_changed" backend/app/routers/signage_admin/playlists.py` returns at least 2 matches (definition + invocation in DELETE).
    - `grep -n "schedule_ids" backend/app/routers/signage_admin/playlists.py` returns at least 1 match (409 shape preserved).
    - `cd backend && python -c "from app.routers.signage_admin.playlists import router, _notify_playlist_changed"` exits 0.
    - `cd backend && pytest tests/signage/ --co -q` exits 0.
  </acceptance_criteria>
  <done>Migrated routes deleted; DELETE + helper preserved; imports trimmed; collection of signage tests still succeeds.</done>
</task>

</tasks>

<verification>
- `grep -cE "^@router\." backend/app/routers/signage_admin/playlists.py` returns 1 (only DELETE).
- `cd backend && pytest tests/signage/ --co -q` exits 0.
- DELETE handler intact: `grep -A 5 "@router.delete" backend/app/routers/signage_admin/playlists.py` shows the 409 path is unchanged.
</verification>

<success_criteria>
Five migrated routes removed; DELETE preserves 409 contract; `_notify_playlist_changed` retained for surviving DELETE + future bulk-PUT consumers.
</success_criteria>

<output>
After completion, create `.planning/phases/69-mig-sign-playlists/69-01-SUMMARY.md` listing routes removed, helper retention confirmation, and import diff.
</output>
