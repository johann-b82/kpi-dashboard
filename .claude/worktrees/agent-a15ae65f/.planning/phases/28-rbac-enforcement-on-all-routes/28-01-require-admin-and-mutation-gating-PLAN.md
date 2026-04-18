---
phase: 28-rbac-enforcement-on-all-routes
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/security/directus_auth.py
  - backend/app/routers/uploads.py
  - backend/app/routers/sync.py
  - backend/app/routers/settings.py
autonomous: true
requirements:
  - RBAC-01
  - RBAC-02
must_haves:
  truths:
    - "require_admin dep exists in backend/app/security/directus_auth.py and raises HTTPException(403, detail='admin role required') when current_user.role != Role.ADMIN"
    - "All 8 mutation routes declare dependencies=[Depends(require_admin)] in their route decorator"
    - "All 11 authenticated read routes remain gated only by the router-level get_current_user (no require_admin)"
    - "App imports cleanly: `python -c 'from app.main import app'` succeeds"
  artifacts:
    - path: "backend/app/security/directus_auth.py"
      provides: "require_admin FastAPI dependency"
      contains: "def require_admin"
    - path: "backend/app/routers/uploads.py"
      provides: "Admin-gated POST /api/upload and DELETE /api/uploads/{batch_id}"
      contains: "Depends(require_admin)"
    - path: "backend/app/routers/sync.py"
      provides: "Admin-gated POST /api/sync and POST /api/sync/test"
      contains: "Depends(require_admin)"
    - path: "backend/app/routers/settings.py"
      provides: "Admin-gated PUT /api/settings and POST /api/settings/logo"
      contains: "Depends(require_admin)"
  key_links:
    - from: "backend/app/routers/{uploads,sync,settings}.py"
      to: "backend/app/security/directus_auth.py::require_admin"
      via: "Depends(require_admin) in @router decorator"
      pattern: "dependencies=\\[Depends\\(require_admin\\)\\]"
---

<objective>
Add the `require_admin` FastAPI dependency to `backend/app/security/directus_auth.py` (D-02) and apply it per-route via `dependencies=[Depends(require_admin)]` (D-01) to all 8 mutation endpoints identified in 28-RESEARCH.md.

Purpose: Satisfies RBAC-02 (mutations require Admin, 403 for Viewer with canonical body) and RBAC-01 by NOT touching any GET route (all 11 reads remain open to both roles via the router-level `get_current_user`).

Output: 1 dep added to directus_auth.py; 3 router files (uploads.py, sync.py, settings.py) updated to gate their 8 mutation handlers.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/28-rbac-enforcement-on-all-routes/28-CONTEXT.md
@.planning/phases/28-rbac-enforcement-on-all-routes/28-RESEARCH.md
@backend/app/security/directus_auth.py
@backend/app/security/roles.py
@backend/app/routers/uploads.py
@backend/app/routers/sync.py
@backend/app/routers/settings.py

<interfaces>
From backend/app/security/directus_auth.py (created in Phase 27):
```python
from app.security.roles import Role
from app.schemas.current_user import CurrentUser  # has .role: Role

async def get_current_user(...) -> CurrentUser: ...
```

Target addition (D-02, mirrors existing pattern in same file):
```python
def require_admin(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if current_user.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin role required",
        )
    return current_user
```

**8 mutation routes to gate (from 28-RESEARCH.md, exhaustive):**

| # | File | Decorator currently | Must become |
|---|------|---------------------|-------------|
| 1 | uploads.py | `@router.post("/upload", response_model=...)` | add `dependencies=[Depends(require_admin)]` |
| 2 | uploads.py | `@router.delete("/uploads/{batch_id}")` | add `dependencies=[Depends(require_admin)]` |
| 3 | sync.py   | `@router.post("")` (→ POST /api/sync) | add `dependencies=[Depends(require_admin)]` |
| 4 | sync.py   | `@router.post("/test")` (→ POST /api/sync/test) | add `dependencies=[Depends(require_admin)]` |
| 5 | settings.py | `@router.put("")` (→ PUT /api/settings) | add `dependencies=[Depends(require_admin)]` |
| 6 | settings.py | `@router.post("/logo")` (→ POST /api/settings/logo) | add `dependencies=[Depends(require_admin)]` |

Note: research lists 8 mutation rows but entries 1+2, 3+4, 5+6 pair to 6 decorators across 3 files. There are exactly 6 decorator sites to modify.

**Routes that MUST NOT be modified** (must stay open to Viewer):
- All `@router.get(...)` decorators in all 6 router files
- Router-level `APIRouter(dependencies=[Depends(get_current_user)])` — untouched
- `/health`, `/docs`, `/redoc`, `/openapi.json` — untouched
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add require_admin dependency to directus_auth.py</name>
  <read_first>
    - backend/app/security/directus_auth.py (insertion point; match existing import + HTTPException style)
    - backend/app/security/roles.py (confirm Role.ADMIN spelling)
    - backend/tests/test_directus_auth.py (_mint helper + ADMIN_UUID/VIEWER_UUID constants to reuse)
    - .planning/phases/28-rbac-enforcement-on-all-routes/28-CONTEXT.md (D-02 exact signature)
  </read_first>
  <files>backend/app/security/directus_auth.py</files>
  <behavior>
    - require_admin called with a CurrentUser whose role == Role.ADMIN → returns the CurrentUser unchanged
    - require_admin called with a CurrentUser whose role == Role.VIEWER → raises HTTPException with status_code == 403 and detail == "admin role required"
    - require_admin is importable: `from app.security.directus_auth import require_admin`
  </behavior>
  <action>
    1. Open `backend/app/security/directus_auth.py`. Confirm these imports are present (add if missing): `from fastapi import Depends, HTTPException, status` and `from app.security.roles import Role` and the `CurrentUser` schema import already used by `get_current_user`.

    2. Append this function at module scope, AFTER the existing `get_current_user` definition (D-02, verbatim):
       ```python
       def require_admin(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
           if current_user.role != Role.ADMIN:
               raise HTTPException(
                   status_code=status.HTTP_403_FORBIDDEN,
                   detail="admin role required",
               )
           return current_user
       ```
       Do NOT make it `async` — `get_current_user` is async and FastAPI will await the dep chain correctly; `require_admin` itself is a plain sync checker. (Matches minimal-branch pattern from 28-CONTEXT.md D-02.)

    3. Add a dedicated unit-test file `backend/tests/test_require_admin.py` with two direct-call tests (no HTTP client; call the function with a synthesized CurrentUser):
       ```python
       import pytest
       from fastapi import HTTPException
       from app.security.directus_auth import require_admin
       from app.security.roles import Role
       from app.schemas.current_user import CurrentUser  # adjust import if path differs — match what directus_auth.py uses

       def _user(role: Role) -> CurrentUser:
           return CurrentUser(id="00000000-0000-0000-0000-000000000001", email="t@example.com", role=role)

       def test_require_admin_allows_admin():
           u = _user(Role.ADMIN)
           assert require_admin(current_user=u) is u

       def test_require_admin_rejects_viewer():
           u = _user(Role.VIEWER)
           with pytest.raises(HTTPException) as excinfo:
               require_admin(current_user=u)
           assert excinfo.value.status_code == 403
           assert excinfo.value.detail == "admin role required"
       ```
       If the exact `CurrentUser` constructor differs (read the schema file first), adjust kwargs — the intent is "build both a VIEWER and ADMIN instance and call require_admin directly".
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/test_require_admin.py -v</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E '^def require_admin\(' backend/app/security/directus_auth.py` returns one match
    - `grep -E 'detail="admin role required"' backend/app/security/directus_auth.py` returns one match
    - `grep -E 'status\.HTTP_403_FORBIDDEN' backend/app/security/directus_auth.py` returns at least one match
    - `cd backend && python -c "from app.security.directus_auth import require_admin; print(require_admin)"` exits 0
    - `cd backend && python -m pytest tests/test_require_admin.py -v` exits 0 with 2 passed
  </acceptance_criteria>
  <done>require_admin dep exists, unit-tested in isolation, importable from the canonical location (D-02).</done>
</task>

<task type="auto">
  <name>Task 2: Apply Depends(require_admin) to all 8 mutation routes across 3 routers</name>
  <read_first>
    - backend/app/routers/uploads.py (current decorators for POST /upload and DELETE /uploads/{batch_id})
    - backend/app/routers/sync.py (current decorators for POST "" and POST /test)
    - backend/app/routers/settings.py (current decorators for PUT "" and POST /logo)
    - backend/app/security/directus_auth.py (confirm require_admin signature after Task 1)
    - .planning/phases/28-rbac-enforcement-on-all-routes/28-RESEARCH.md (route inventory — the canonical list of 8)
  </read_first>
  <files>
    backend/app/routers/uploads.py,
    backend/app/routers/sync.py,
    backend/app/routers/settings.py
  </files>
  <action>
    For each of the 3 files below, add the import and modify the listed decorators. Use the MINIMUM diff — keep response_model, status_code, tags, summary, and every other existing kwarg untouched. Insert `dependencies=[Depends(require_admin)]` as a new kwarg in each decorator. If `Depends` is not yet imported in the file, add it to the existing `from fastapi import ...` line.

    **Import in all 3 files** (add if not present):
    ```python
    from fastapi import Depends  # ensure this is in the fastapi import line
    from app.security.directus_auth import require_admin
    ```

    **File 1: backend/app/routers/uploads.py** — modify exactly 2 decorators:
    - `@router.post("/upload", ...)`  →  add `dependencies=[Depends(require_admin)]`
    - `@router.delete("/uploads/{batch_id}", ...)`  →  add `dependencies=[Depends(require_admin)]`
    - Do NOT touch `@router.get("/uploads", ...)` — it must stay open to Viewer.

    **File 2: backend/app/routers/sync.py** — modify exactly 2 decorators:
    - `@router.post("")` (the one that registers POST /api/sync)  →  add `dependencies=[Depends(require_admin)]`
    - `@router.post("/test")`  →  add `dependencies=[Depends(require_admin)]`
    - Do NOT touch `@router.get("/meta", ...)` — it must stay open to Viewer.

    **File 3: backend/app/routers/settings.py** — modify exactly 2 decorators:
    - `@router.put("")` (the one that registers PUT /api/settings)  →  add `dependencies=[Depends(require_admin)]`
    - `@router.post("/logo")`  →  add `dependencies=[Depends(require_admin)]`
    - Do NOT touch any `@router.get(...)` — `GET /api/settings`, `GET /api/settings/personio-options`, and `GET /api/settings/logo` must all stay open to Viewer (per 28-RESEARCH.md matrix).

    **Files NOT to modify:** `backend/app/routers/kpis.py`, `backend/app/routers/hr_kpis.py`, `backend/app/routers/data.py` — those contain only GET routes.

    Do NOT add `Depends(require_admin)` at the router level — per D-01 it is per-route. The router-level `Depends(get_current_user)` from Phase 27 stays as-is.

    Example minimal diff for a POST decorator:
    ```python
    # Before
    @router.post("/upload", response_model=UploadResponse)
    async def upload_file(...):

    # After
    @router.post(
        "/upload",
        response_model=UploadResponse,
        dependencies=[Depends(require_admin)],
    )
    async def upload_file(...):
    ```
  </action>
  <verify>
    <automated>cd backend && python -c "from app.main import app; print('import ok')" && test "$(grep -c 'Depends(require_admin)' app/routers/uploads.py)" = "2" && test "$(grep -c 'Depends(require_admin)' app/routers/sync.py)" = "2" && test "$(grep -c 'Depends(require_admin)' app/routers/settings.py)" = "2" && ! grep -q 'require_admin' app/routers/kpis.py && ! grep -q 'require_admin' app/routers/hr_kpis.py && ! grep -q 'require_admin' app/routers/data.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c 'Depends(require_admin)' backend/app/routers/uploads.py` == 2
    - `grep -c 'Depends(require_admin)' backend/app/routers/sync.py` == 2
    - `grep -c 'Depends(require_admin)' backend/app/routers/settings.py` == 2
    - `grep 'from app.security.directus_auth import require_admin' backend/app/routers/uploads.py backend/app/routers/sync.py backend/app/routers/settings.py` returns 3 lines
    - Read-only router files are unchanged: `grep -L require_admin backend/app/routers/kpis.py backend/app/routers/hr_kpis.py backend/app/routers/data.py` lists all three
    - `cd backend && python -c "from app.main import app"` exits 0
    - `cd backend && python -m pytest tests/test_directus_auth.py tests/test_require_admin.py -v` exits 0 (no regression on Phase 27 auth tests)
  </acceptance_criteria>
  <done>All 8 mutation routes identified in 28-RESEARCH.md are gated by require_admin per D-01; all read routes remain untouched; app imports and Phase 27 auth tests still pass.</done>
</task>

</tasks>

<verification>
- `cd backend && python -m pytest tests/test_require_admin.py tests/test_directus_auth.py -v` → all pass
- `cd backend && python -c "from app.main import app"` → exits 0
- `grep -rn "Depends(require_admin)" backend/app/routers/ | wc -l` → 6 (2 per file × 3 files)
- Spot-curl with a Viewer token against `POST /api/upload` → 403 with body `{"detail":"admin role required"}` (full test matrix comes in Plan 28-02)
</verification>

<success_criteria>
- RBAC-01 (partial): all GET routes untouched — reads remain open to both roles (verified by full matrix in Plan 28-02)
- RBAC-02 (mechanism in place): all 8 mutation routes declare `dependencies=[Depends(require_admin)]`; the 403 body shape is guaranteed by the single HTTPException in Task 1 (D-03)
- D-01: per-route enforcement (not middleware, not router-level)
- D-02: require_admin lives alongside get_current_user in directus_auth.py
- No regression on Phase 27 tests
</success_criteria>

<output>
After completion, create `.planning/phases/28-rbac-enforcement-on-all-routes/28-01-SUMMARY.md`.
</output>
