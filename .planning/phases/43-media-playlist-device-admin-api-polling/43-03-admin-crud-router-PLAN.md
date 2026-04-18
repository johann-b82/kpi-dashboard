---
phase: 43-media-playlist-device-admin-api-polling
plan: 03
type: execute
wave: 2
depends_on:
  - 43-02
files_modified:
  - backend/app/routers/signage_admin/__init__.py
  - backend/app/routers/signage_admin/media.py
  - backend/app/routers/signage_admin/playlists.py
  - backend/app/routers/signage_admin/playlist_items.py
  - backend/app/routers/signage_admin/devices.py
  - backend/app/routers/signage_admin/tags.py
  - backend/app/main.py
  - backend/tests/test_signage_admin_router.py
autonomous: true
requirements:
  - SGN-BE-01
must_haves:
  truths:
    - "Admin JWT can CRUD signage media, playlists, playlist_items, devices, tags via /api/signage/*"
    - "Viewer JWT receives 403 on any admin signage route"
    - "No JWT receives 401 on any admin signage route"
    - "DELETE /api/signage/media/{id} returns 409 with playlist_ids when media is referenced by playlist_items"
    - "PUT /api/signage/playlists/{id}/items atomically replaces items in a single transaction"
    - "PUT /api/signage/devices/{id}/tags and /playlists/{id}/tags atomically replace tag assignments"
    - "POST /api/signage/media accepts a Directus-asset UUID registration (D-21 option b)"
  artifacts:
    - path: backend/app/routers/signage_admin/__init__.py
      provides: "Parent APIRouter(prefix=/api/signage, dependencies=[get_current_user, require_admin])"
      contains: "dependencies=[Depends(get_current_user), Depends(require_admin)]"
    - path: backend/app/routers/signage_admin/media.py
      provides: "Media CRUD endpoints with 409-on-RESTRICT-FK on delete"
      contains: "IntegrityError"
    - path: backend/app/routers/signage_admin/playlists.py
      provides: "Playlist CRUD + bulk-replace tags"
      contains: "PUT"
    - path: backend/app/routers/signage_admin/playlist_items.py
      provides: "Bulk-replace items endpoint"
      contains: "items"
    - path: backend/app/routers/signage_admin/devices.py
      provides: "Device admin endpoints incl. bulk-replace tags"
      contains: "tags"
    - path: backend/app/routers/signage_admin/tags.py
      provides: "Tag CRUD"
    - path: backend/app/main.py
      provides: "signage_admin parent router included"
      contains: "signage_admin"
  key_links:
    - from: backend/app/routers/signage_admin/__init__.py
      to: backend/app/security/directus_auth.py
      via: "Depends(get_current_user), Depends(require_admin)"
      pattern: "Depends\\(require_admin\\)"
    - from: backend/app/main.py
      to: backend/app/routers/signage_admin
      via: "include_router(signage_admin_router)"
      pattern: "include_router.*signage_admin"
---

<objective>
Implement the signage admin CRUD router package (SGN-BE-01, D-01/D-16/D-17/D-18/D-19/D-20/D-21) as a per-resource split under `backend/app/routers/signage_admin/`, wired into `main.py`, with tests covering the router-level admin gate, 409-on-FK-restrict media delete, bulk-replace playlist items, and bulk-replace tags.

Purpose: Deliver admin CRUD for all signage resources behind a single router-level `require_admin` gate so SGN-BE-09 dep-audit (Plan 05) finds exactly one `require_admin` call for every admin route.

Output: New `signage_admin/` package (6 files), main.py wiring, one consolidated test file.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md
@.planning/phases/43-media-playlist-device-admin-api-polling/43-RESEARCH.md
@backend/app/routers/sensors.py
@backend/app/routers/signage_pair.py
@backend/app/security/directus_auth.py
@backend/app/models/signage.py
@backend/app/schemas/signage.py
@backend/app/main.py

<interfaces>
From backend/app/security/directus_auth.py:
- `get_current_user`: returns DirectusUser-ish dict/object
- `require_admin`: raises HTTPException(403) for non-admin

Pattern verified in backend/app/routers/sensors.py line 47-51:
```python
router = APIRouter(
    prefix="/api/sensors",
    tags=["sensors"],
    dependencies=[Depends(get_current_user), Depends(require_admin)],
)
```

ORM models (backend/app/models/signage.py):
- SignageMedia — id, kind, uri (or actual url field — inspect), title, created_at
- SignagePlaylist — id, name, priority, enabled, updated_at
- SignagePlaylistItem — id, playlist_id (FK), media_id (FK RESTRICT), position, duration_ms, transition
- SignageDevice — id, name, status, last_seen_at, revoked_at, current_item_id, current_playlist_etag (added Plan 01)
- SignageDeviceTag — id, name
- SignageDeviceTagMap — device_id, tag_id (composite PK)
- SignagePlaylistTagMap — playlist_id, tag_id (composite PK)

D-21 chosen: option (b) — Directus-asset-UUID registration. `POST /api/signage/media` accepts JSON `{kind, title, directus_file_id, uri}`. No multipart in this phase.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Build signage_admin router package (parent + 5 sub-routers) and wire main.py</name>
  <files>backend/app/routers/signage_admin/__init__.py, backend/app/routers/signage_admin/media.py, backend/app/routers/signage_admin/playlists.py, backend/app/routers/signage_admin/playlist_items.py, backend/app/routers/signage_admin/devices.py, backend/app/routers/signage_admin/tags.py, backend/app/main.py</files>
  <read_first>
    - backend/app/routers/sensors.py (admin CRUD style, 201/204 codes, router-level deps)
    - backend/app/routers/signage_pair.py (AsyncSession + commit/rollback patterns, current project idioms)
    - backend/app/security/directus_auth.py (exact signatures of get_current_user, require_admin)
    - backend/app/models/signage.py (confirm actual attribute names, especially SignageMedia's URL/URI field)
    - backend/app/schemas/signage.py (existing Create/Read schemas; extend only as needed)
    - backend/app/main.py (current include_router order)
    - .planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md §decisions D-01, D-16, D-17, D-18, D-19, D-20, D-21
  </read_first>
  <action>
    Create package directory `backend/app/routers/signage_admin/` with the following files.

    **`__init__.py`** (parent router — single admin gate, D-01):
    ```python
    """Phase 43 SGN-BE-01: admin CRUD router package.

    Per CONTEXT D-01: one router-level admin gate. `require_admin` MUST appear
    exactly once here. Sub-routers MUST NOT add their own `require_admin` or
    `get_current_user` dependencies.
    """
    from fastapi import APIRouter, Depends

    from app.security.directus_auth import get_current_user, require_admin

    from . import devices, media, playlist_items, playlists, tags

    router = APIRouter(
        prefix="/api/signage",
        tags=["signage-admin"],
        dependencies=[Depends(get_current_user), Depends(require_admin)],
    )
    router.include_router(media.router)
    router.include_router(playlists.router)
    router.include_router(playlist_items.router)
    router.include_router(devices.router)
    router.include_router(tags.router)
    ```

    **`media.py`** (D-16 — hard delete with 409 on RESTRICT):
    - `POST /media` — body `MediaCreate` (fields per existing schemas/signage.py Create schema + `directus_file_id` if not present) → 201 returns MediaRead. Store directus_file_id as-is. D-21 option (b).
    - `GET /media` — list, `response_model=list[MediaRead]`. No pagination (D-19).
    - `GET /media/{media_id}` — 200 / 404.
    - `PATCH /media/{media_id}` — partial update (title, kind, tags optional) → 200 / 404.
    - `DELETE /media/{media_id}` — status_code=204. Must:
      1. SELECT → 404 if missing.
      2. `await db.execute(delete(SignageMedia).where(id==media_id))` inside try/except IntegrityError.
      3. On IntegrityError: rollback, SELECT `SignagePlaylistItem.playlist_id` where media_id == target, return `JSONResponse(status_code=409, content={"detail": "media in use by playlists", "playlist_ids": [<str uuids>]})` — Pitfall 6 in RESEARCH mandates JSONResponse over HTTPException to avoid nested-detail shape.
      4. On success: commit, then post-commit try/except `shutil.rmtree("/app/media/slides/<media_id>", ignore_errors=True)` with WARNING log (never roll back response).

    Router declaration: `router = APIRouter(prefix="/media", tags=["signage-admin-media"])` — empty or short prefix only, parent prepends `/api/signage` (Pitfall 4).

    **`playlists.py`** (D-18 tags bulk-replace):
    - `POST /playlists` — 201, body PlaylistCreate (name, priority, enabled).
    - `GET /playlists` — list.
    - `GET /playlists/{id}` — 200 / 404.
    - `PATCH /playlists/{id}` — partial update (name/priority/enabled).
    - `DELETE /playlists/{id}` — 204.
    - `PUT /playlists/{id}/tags` — body `{tag_ids: [uuid,...]}`. Single transaction: `delete(SignagePlaylistTagMap).where(playlist_id==id)` then bulk-insert new map rows, single `await db.commit()` at end (Pitfall 3). 200 returns `{tag_ids: [...]}`.

    Router: `APIRouter(prefix="/playlists", tags=["signage-admin-playlists"])`.

    **`playlist_items.py`** (D-17 bulk-replace):
    - `GET /playlists/{id}/items` — list items ordered by position ASC.
    - `PUT /playlists/{id}/items` — body `{items: [{media_id, position, duration_ms, transition}, ...]}`. Single transaction: `delete(SignagePlaylistItem).where(playlist_id==id)` then bulk-insert new rows (let DB assign UUIDs or generate in Python; match existing convention in signage.py models). Single commit. Returns 200 with the new ordered item list.

    Router: `APIRouter(prefix="/playlists", tags=["signage-admin-playlist-items"])` — NOTE prefix reuses `/playlists` because endpoint path is `/playlists/{id}/items`. Keep in a separate module per D-01 resource split.

    **`devices.py`** (D-18 device tags bulk-replace):
    - `GET /devices` — list devices.
    - `GET /devices/{id}` — 200 / 404.
    - `PATCH /devices/{id}` — partial update (name).
    - `DELETE /devices/{id}` — 204.
    - `PUT /devices/{id}/tags` — body `{tag_ids: [uuid,...]}`. Same single-transaction pattern as playlists tags.

    NOTE: Device creation is done via the pairing flow (Phase 42), NOT via POST /devices. Do NOT add `POST /devices` here. Revoke-device is already on signage_pair router (Phase 42 Plan 03); do NOT duplicate.

    Router: `APIRouter(prefix="/devices", tags=["signage-admin-devices"])`.

    **`tags.py`** (SignageDeviceTag CRUD):
    - `POST /tags` — 201, body `{name}`.
    - `GET /tags` — list.
    - `PATCH /tags/{id}` — rename.
    - `DELETE /tags/{id}` — 204 (tag map rows should cascade or be handled per Phase 41 FK semantics; if FK restrict, return 409 with same shape as media delete).

    Router: `APIRouter(prefix="/tags", tags=["signage-admin-tags"])`.

    **`backend/app/main.py`** — add wiring:

    Add import near line 13 (alongside `signage_pair_router`):
    ```python
    from app.routers.signage_admin import router as signage_admin_router
    ```

    Add include_router call after `app.include_router(signage_pair_router)` at line 27:
    ```python
    app.include_router(signage_admin_router)
    ```

    All endpoints return flat JSON (D-20). All errors use FastAPI `HTTPException(status, detail="string")` EXCEPT the media-409 which uses JSONResponse (Pitfall 6).

    All mutation endpoints MUST commit inside a single transaction. NO `require_admin` at the per-endpoint level in sub-routers — the parent router owns it.

    **Forbidden:** `subprocess.run`, `subprocess.Popen`, `subprocess.call`, `import sqlite3`, `import psycopg2` in any file under `signage_admin/`. (SGN-BE-10, to be enforced by Plan 05 tests.)
  </action>
  <verify>
    <automated>cd backend && python -c "from app.routers.signage_admin import router; paths = sorted({r.path for r in router.routes}); print(paths); assert any(p.startswith('/api/signage/media') for p in paths), 'media routes missing'; assert any('/items' in p for p in paths), 'items bulk-replace missing'"</automated>
  </verify>
  <acceptance_criteria>
    - Directory backend/app/routers/signage_admin/ exists with __init__.py, media.py, playlists.py, playlist_items.py, devices.py, tags.py
    - grep -n "dependencies=\[Depends(get_current_user), Depends(require_admin)\]" backend/app/routers/signage_admin/__init__.py returns exactly 1 line
    - grep -rn "require_admin" backend/app/routers/signage_admin/ returns ONLY the line in __init__.py (exactly 1 file)
    - grep -rn "subprocess\\.\\(run\\|Popen\\|call\\)\\|import sqlite3\\|import psycopg2" backend/app/routers/signage_admin/ returns 0 matches
    - grep -n "signage_admin_router" backend/app/main.py returns ≥ 2 lines (import + include_router)
    - grep -n "IntegrityError" backend/app/routers/signage_admin/media.py returns ≥ 1 line
    - grep -n "JSONResponse" backend/app/routers/signage_admin/media.py returns ≥ 1 line (for the 409 shape, Pitfall 6)
    - `python -c "from app.routers.signage_admin import router"` exits 0
    - `python -c "from app.main import app; print([r.path for r in app.routes if r.path.startswith('/api/signage')])"` shows all new admin paths
  </acceptance_criteria>
  <done>Package compiles, main.py wires parent router, one-and-only-one require_admin on parent, paths registered under /api/signage.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Router tests — admin gate, media-409, bulk-replace items, bulk-replace tags</name>
  <files>backend/tests/test_signage_admin_router.py</files>
  <read_first>
    - backend/tests/test_sensors_admin_gate.py (admin-gate test style, 401 vs 403 matrix)
    - backend/tests/test_signage_pair_router.py (async client + seed patterns with signage models)
    - backend/tests/conftest.py (client fixture, admin/viewer JWT helpers)
    - backend/app/routers/signage_admin/__init__.py (just created)
    - backend/app/routers/signage_admin/media.py
  </read_first>
  <behavior>
    Required test functions in backend/tests/test_signage_admin_router.py:
    1. test_admin_can_create_playlist — admin JWT → POST /api/signage/playlists → 201
    2. test_viewer_cannot_create_playlist — viewer JWT → POST → 403 with detail containing "admin" (case-insensitive)
    3. test_no_jwt_cannot_create_playlist — no Authorization header → POST → 401
    4. test_delete_media_404_when_not_found — admin DELETE /media/<random-uuid> → 404
    5. test_delete_media_409_when_referenced — seed media + playlist_item using it → admin DELETE /media/{id} → 409; response JSON has `detail == "media in use by playlists"` and `playlist_ids` is a non-empty list of UUID strings
    6. test_delete_media_204_when_unreferenced — seed media, no items → admin DELETE /media/{id} → 204, media row gone
    7. test_put_playlist_items_bulk_replaces_atomically — seed playlist with 3 items at positions 1/2/3 → admin PUT /playlists/{id}/items with different 2-item body → 200; follow-up GET /playlists/{id}/items shows exactly the 2 new items in body-specified order
    8. test_put_device_tags_bulk_replaces — seed device with tags [A, B] → admin PUT /devices/{id}/tags `{tag_ids: [C]}` → 200; follow-up device tags == [C]
    9. test_put_playlist_tags_bulk_replaces — mirror of 8 for playlists
  </behavior>
  <action>
    Create `backend/tests/test_signage_admin_router.py` using the existing async client + JWT fixtures from `backend/tests/conftest.py`.

    Mirror style from `backend/tests/test_signage_pair_router.py` for DB seeding (ORM instances + `await session.commit()`) and `backend/tests/test_sensors_admin_gate.py` for admin/viewer/no-JWT gate matrix.

    If the repo's conftest does not provide `admin_client` / `viewer_client` fixtures by those exact names, use whatever naming the sensors gate tests use (inspect first). Do NOT invent new fixtures — reuse what Phase 42 tests already rely on.

    For test 5 (409 shape), assert:
    ```python
    assert resp.status_code == 409
    body = resp.json()
    assert body["detail"] == "media in use by playlists"
    assert isinstance(body["playlist_ids"], list)
    assert len(body["playlist_ids"]) >= 1
    ```

    For test 7 (bulk-replace items), seed 3 items then PUT a 2-item body and assert:
    - Subsequent GET returns exactly 2 items
    - Positions match the request body
    - A committed DB query `SELECT COUNT(*) FROM signage_playlist_items WHERE playlist_id = :id` returns 2 (confirms DELETE half of the transaction actually ran)

    TDD: write tests first, confirm red, then Task 1 routes make them green. If Task 1 is implemented first (these plans run together in the same execute session), run tests after implementation; still include the tests file.
  </action>
  <verify>
    <automated>cd backend && pytest tests/test_signage_admin_router.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - File backend/tests/test_signage_admin_router.py exists with ≥ 9 test functions
    - `pytest backend/tests/test_signage_admin_router.py -x` exits 0 with all 9+ tests passing
    - grep -q "assert resp.status_code == 409" backend/tests/test_signage_admin_router.py
    - grep -q "playlist_ids" backend/tests/test_signage_admin_router.py
    - Existing tests still pass: `pytest backend/tests/test_signage_pair_router.py backend/tests/test_sensors_admin_gate.py -x`
  </acceptance_criteria>
  <done>9+ router tests cover gate matrix, media 404/409/204, bulk-replace semantics for items + device-tags + playlist-tags.</done>
</task>

</tasks>

<verification>
- Package importable: `from app.routers.signage_admin import router`
- Registered on app: `GET /api/signage/playlists`, `POST /api/signage/playlists`, `DELETE /api/signage/media/{id}`, etc. all appear in `app.routes`
- Admin gate test passes: `pytest backend/tests/test_signage_admin_router.py -x`
- No regression: `pytest backend/tests/ -x --ignore=backend/tests/test_signage_resolver.py` (exclude Plan 02 test which runs in parallel)
- SGN-BE-10 smell check (formal test lands in Plan 05): `grep -rn "subprocess.run\|import sqlite3\|import psycopg2" backend/app/routers/signage_admin/` returns 0
</verification>

<success_criteria>
1. Admin JWT can CRUD all 5 resources; viewer → 403; no JWT → 401. (Success criterion 1 of phase.)
2. Media DELETE returns 409 with `{detail, playlist_ids}` when referenced, 204 when not, 404 when missing (D-16).
3. Bulk-replace semantics for playlist items and tag assignments are atomic (D-17/D-18).
4. `require_admin` appears exactly once in the signage_admin package — on the parent router (D-01).
5. Router-level-only admin gate (cross-cutting hazard #5 honored).
</success_criteria>

<output>
After completion, create `.planning/phases/43-media-playlist-device-admin-api-polling/43-03-SUMMARY.md`
</output>
