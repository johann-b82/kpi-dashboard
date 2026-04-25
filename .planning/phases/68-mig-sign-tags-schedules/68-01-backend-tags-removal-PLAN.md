---
phase: 68-mig-sign-tags-schedules
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/routers/signage_admin/tags.py
  - backend/app/routers/signage_admin/__init__.py
  - backend/tests/test_rbac.py
  - backend/tests/signage/test_permission_field_allowlists.py
autonomous: true
requirements: [MIG-SIGN-01]

must_haves:
  truths:
    - "FastAPI no longer serves /api/signage/tags (any method returns 404)"
    - "tags.py is deleted; signage_admin router does not include it"
  artifacts:
    - path: "backend/app/routers/signage_admin/tags.py"
      provides: "DELETED — file no longer exists"
    - path: "backend/app/routers/signage_admin/__init__.py"
      provides: "Router registration without tags"
      contains: "from . import analytics, devices, media, playlist_items, playlists, schedules"
  key_links:
    - from: "backend/app/routers/signage_admin/__init__.py"
      to: "tags module"
      via: "REMOVED — no `from . import tags` and no `router.include_router(tags.router)`"
      pattern: "tags"
---

<objective>
Delete the FastAPI signage tags router (`tags.py`) and its registration in `signage_admin/__init__.py`. Update `test_rbac.py` and refresh comments in `test_permission_field_allowlists.py` so test suites reference the new world (Directus-served `signage_device_tags`).

Purpose: MIG-SIGN-01 — tags CRUD must move to Directus; the FastAPI surface is removed so frontend cannot accidentally route through it. Per D-04 this plan covers ONLY `signage_tags` collection routes; tag-map writes (Phase 69/70) are untouched.

Output: One deleted file, two modified files, one test file with READ_ROUTES verified clean.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md
@backend/app/routers/signage_admin/__init__.py
@backend/app/routers/signage_admin/tags.py

<interfaces>
Current `__init__.py` registration (line 11):
```python
from . import analytics, devices, media, playlist_items, playlists, schedules, tags
```
Line 24:
```python
router.include_router(tags.router)
```

Both lines must be removed.

`backend/tests/test_rbac.py` READ_ROUTES is the matrix used for per-route × per-role testing. No tag routes are currently in READ_ROUTES (verified — only kpis/hr/data/settings/uploads/sync paths). MUTATION_ROUTES likewise has no tag paths. No edits needed there. Plan still validates greps to confirm no `/api/signage/tags` literal lurks elsewhere in `backend/tests/`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete tags.py and remove registration</name>
  <files>
    backend/app/routers/signage_admin/tags.py (DELETE),
    backend/app/routers/signage_admin/__init__.py
  </files>
  <read_first>
    - backend/app/routers/signage_admin/__init__.py
    - backend/app/routers/signage_admin/tags.py
    - .planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md (D-04, D-05)
  </read_first>
  <action>
    1. `git rm backend/app/routers/signage_admin/tags.py`
    2. Edit `backend/app/routers/signage_admin/__init__.py`:
       - Change `from . import analytics, devices, media, playlist_items, playlists, schedules, tags` → `from . import analytics, devices, media, playlist_items, playlists, schedules`
       - Delete the line `router.include_router(tags.router)`
    3. Run `grep -rn "from .* import tags\|tags\.router\|signage_admin\.tags" backend/app/` — must return 0 matches.
    4. Note (D-05): `signage_device_tags` itself has no Postgres LISTEN trigger; only `signage_playlist_tag_map` and `signage_device_tag_map` triggers fire SSE. Removing the FastAPI tags CRUD does NOT change SSE behavior. Frontend tag CRUD will go directly to Directus (Plan 04).
  </action>
  <verify>
    <automated>test -f backend/app/routers/signage_admin/tags.py && exit 1 || true; grep -rn "import tags\|tags\.router" backend/app/routers/signage_admin/ && exit 1 || exit 0</automated>
  </verify>
  <acceptance_criteria>
    - `test -f backend/app/routers/signage_admin/tags.py` exits 1 (file gone).
    - `grep -rn "tags\.router" backend/app/routers/signage_admin/__init__.py` exits 1 (no match).
    - `grep -rnE "^from \. import .*tags" backend/app/routers/signage_admin/__init__.py` exits 1.
    - `python -c "from app.routers.signage_admin import router"` returns exit 0 (no ImportError).
  </acceptance_criteria>
  <done>tags.py deleted; `__init__.py` updated; package still imports.</done>
</task>

<task type="auto">
  <name>Task 2: Refresh signage test references + verify rbac matrix</name>
  <files>backend/tests/signage/test_permission_field_allowlists.py, backend/tests/test_rbac.py</files>
  <read_first>
    - backend/tests/signage/test_permission_field_allowlists.py
    - backend/tests/test_rbac.py
    - .planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md (D-10, D-11)
  </read_first>
  <action>
    1. `grep -n "signage/tags\|signage_tags\|tags\.py" backend/tests/signage/test_permission_field_allowlists.py` — for each comment/docstring referencing the removed FastAPI tags router or `signage_tags` (not `signage_device_tags`), update to clarify the collection is `signage_device_tags` and CRUD is now Directus-served (per D-04/D-08). Do not change assertions.
    2. Open `backend/tests/test_rbac.py` and confirm `READ_ROUTES` and `MUTATION_ROUTES` contain NO `/api/signage/tags*` paths (currently they do not — keep as-is). If any test elsewhere under `backend/tests/` references `/api/signage/tags`, document it for Plan 03's port/delete pass: run `grep -rn "/api/signage/tags" backend/tests/` and capture the file list in this plan's SUMMARY.
    3. Confirm no Python imports of the deleted `app.routers.signage_admin.tags` remain in `backend/tests/`: `grep -rn "signage_admin.tags\|from .*signage_admin import.*tags" backend/tests/` must return 0.
  </action>
  <verify>
    <automated>cd backend && grep -rnE "^from app\.routers\.signage_admin import.*tags|import.*signage_admin\.tags" tests/ && exit 1 || exit 0; pytest tests/test_rbac.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rn "signage_admin\.tags" backend/tests/` exits 1 (no Python import of deleted module).
    - `pytest backend/tests/test_rbac.py -x -q` exits 0 (matrix unchanged still passes).
    - SUMMARY.md lists every file path under `backend/tests/` that contains a literal `/api/signage/tags` for Plan 03 to handle.
  </acceptance_criteria>
  <done>Test files no longer import deleted module; RBAC matrix runs green; tag-route refs catalogued for Plan 03.</done>
</task>

</tasks>

<verification>
- `grep -rn "/api/signage/tags" backend/app/` exits 1 (will be enforced by CI guard in Plan 07).
- `pytest backend/tests/test_rbac.py -x -q` exits 0.
- `python -c "from app.main import app"` exits 0.
</verification>

<success_criteria>
FastAPI no longer registers `/api/signage/tags` routes; package imports clean; existing RBAC matrix passes; refs catalogued.
</success_criteria>

<output>
After completion, create `.planning/phases/68-mig-sign-tags-schedules/68-01-SUMMARY.md` listing: deleted file, modified files, any tag-route references found in `backend/tests/` (input for Plan 03).
</output>
