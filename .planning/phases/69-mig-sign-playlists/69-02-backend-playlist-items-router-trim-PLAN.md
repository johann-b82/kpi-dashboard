---
phase: 69-mig-sign-playlists
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/routers/signage_admin/playlist_items.py
autonomous: true
requirements: [MIG-SIGN-03]

must_haves:
  truths:
    - "FastAPI GET /api/signage/playlists/{id}/items is gone (returns 404)"
    - "FastAPI PUT /api/signage/playlists/{id}/items STILL exists and still performs atomic DELETE+INSERT bulk replace"
    - "_notify_playlist_changed helper RETAINED — surviving bulk PUT still imports + invokes it"
  artifacts:
    - path: "backend/app/routers/signage_admin/playlist_items.py"
      provides: "Surviving bulk PUT /{id}/items + _notify_playlist_changed helper only"
      contains: "@router.put"
  key_links:
    - from: "Surviving PUT /api/signage/playlists/{id}/items"
      to: "_notify_playlist_changed helper"
      via: "explicit fan-out alongside Phase 65 LISTEN bridge (D-04b, D-05a)"
      pattern: "await _notify_playlist_changed"
---

<objective>
Migrate `GET /api/signage/playlists/{id}/items` from FastAPI to Directus by deleting the route handler. Keep the surviving bulk `PUT /api/signage/playlists/{id}/items` (atomic DELETE+INSERT — D-00 architectural lock) and the duplicated `_notify_playlist_changed` helper (D-04b, D-05a — surviving PUT still needs explicit fan-out; consolidation deferred to Phase 71 CLEAN per CONTEXT "Deferred Ideas").

Purpose: MIG-SIGN-03 backend leg — items GET goes through Directus `signage_playlist_items` collection. Mirrors Phase 68 Plan 03 surgical-removal pattern.

Output: Trimmed `playlist_items.py` retaining only bulk PUT handler + helper + minimum imports.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/69-mig-sign-playlists/69-CONTEXT.md
@.planning/phases/68-mig-sign-tags-schedules/68-03-backend-schedules-removal-PLAN.md
@backend/app/routers/signage_admin/playlist_items.py
@backend/app/routers/signage_admin/__init__.py

<interfaces>
Current `playlist_items.py` (verified by Read):
- `router = APIRouter(prefix="/playlists", tags=["signage-admin-playlist-items"])`
- `@router.get("/{playlist_id}/items")` then `async def list_playlist_items(...)` — DELETE
- `@router.put("/{playlist_id}/items")` — KEEP (atomic bulk DELETE+INSERT)
- `_notify_playlist_changed` helper (line 28) — KEEP

Surviving PUT handler must:
1. Validate the playlist exists (or 404).
2. Atomically DELETE FROM signage_playlist_items WHERE playlist_id then INSERT new rows.
3. Commit, then `await _notify_playlist_changed(db, playlist_id)`.
4. Return the freshly inserted list as `list[SignagePlaylistItemRead]`.

Module wiring stays: `signage_admin/__init__.py:21` still imports + includes `playlist_items.router` for the surviving PUT.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Delete GET /{id}/items route; preserve bulk PUT + helper</name>
  <files>backend/app/routers/signage_admin/playlist_items.py</files>
  <read_first>
    - backend/app/routers/signage_admin/playlist_items.py (full file)
    - backend/app/routers/signage_admin/__init__.py
    - .planning/phases/69-mig-sign-playlists/69-CONTEXT.md (D-04, D-04b, D-05a)
    - .planning/phases/68-mig-sign-tags-schedules/68-03-backend-schedules-removal-PLAN.md (precedent)
  </read_first>
  <behavior>
    - GET `/{playlist_id}/items` route handler removed.
    - PUT `/{playlist_id}/items` handler unchanged: validates playlist, atomic delete+insert, post-commit `_notify_playlist_changed`, returns full new item list.
    - `_notify_playlist_changed` helper still defined and invoked by surviving PUT.
  </behavior>
  <action>
    1. Read `backend/app/routers/signage_admin/playlist_items.py` end-to-end.
    2. Delete the `@router.get("/{playlist_id}/items", response_model=list[SignagePlaylistItemRead])` decorator block + the `async def list_playlist_items(...)` function body that follows it.
    3. KEEP `@router.put("/{playlist_id}/items", ...)` and its handler exactly as written.
    4. KEEP `_notify_playlist_changed` helper at line 28.
    5. KEEP `BulkReplaceItemsRequest` Pydantic class (used by surviving PUT body).
    6. Run a final import scan: `SignagePlaylistItemRead` is still used by PUT `response_model` — keep. Most imports are shared by GET and PUT and remain needed.
    7. Update the module docstring to: "Phase 69 MIG-SIGN-03: surviving bulk PUT /{id}/items only (atomic DELETE+INSERT). GET moved to Directus collection `signage_playlist_items`."
    8. Confirm import-time soundness with the verify command below.
  </action>
  <verify>
    <automated>cd backend && python -c "from app.routers.signage_admin import playlist_items; assert hasattr(playlist_items, '_notify_playlist_changed'); routes=playlist_items.router.routes; assert any('PUT' in r.methods and r.path.endswith('/items') for r in routes), 'PUT missing'; bad=[r for r in routes if any(m in r.methods for m in {'GET','POST','PATCH','DELETE'})]; assert not bad, f'unexpected: {bad}'" && pytest tests/signage/ --co -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "^@router\.get\b" backend/app/routers/signage_admin/playlist_items.py` returns 0 matches.
    - `grep -nE "^@router\.put\b" backend/app/routers/signage_admin/playlist_items.py` returns exactly 1 match.
    - `grep -n "_notify_playlist_changed" backend/app/routers/signage_admin/playlist_items.py` returns at least 2 matches (definition + invocation).
    - `grep -n "list_playlist_items" backend/app/routers/signage_admin/playlist_items.py` returns 0 matches.
    - `cd backend && python -c "from app.routers.signage_admin.playlist_items import router, _notify_playlist_changed"` exits 0.
    - `cd backend && pytest tests/signage/ --co -q` exits 0.
  </acceptance_criteria>
  <done>GET /items route deleted; PUT + helper preserved; collection of signage tests still succeeds.</done>
</task>

</tasks>

<verification>
- `grep -cE "^@router\." backend/app/routers/signage_admin/playlist_items.py` returns 1 (only PUT).
- `cd backend && pytest tests/signage/ --co -q` exits 0.
- PUT bulk-replace handler intact; helper retained for explicit fan-out.
</verification>

<success_criteria>
GET /items removed; PUT bulk-replace + helper survive; ready for FE swap (Plan 69-03) to consume Directus for items GET.
</success_criteria>

<output>
After completion, create `.planning/phases/69-mig-sign-playlists/69-02-SUMMARY.md` listing the route removed, helper retention, and any import diff.
</output>
