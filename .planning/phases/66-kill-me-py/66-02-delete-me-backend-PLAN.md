---
phase: 66-kill-me-py
plan: 02
type: execute
wave: 2
depends_on: [66-01]
files_modified:
  - backend/app/routers/me.py
  - backend/app/main.py
  - backend/tests/test_me_endpoint.py
  - frontend/src/auth/FullPageSpinner.tsx
  - frontend/src/lib/apiClient.ts
autonomous: true
requirements: [MIG-AUTH-02]

must_haves:
  truths:
    - "`backend/app/routers/me.py` no longer exists"
    - "`backend/app/main.py` does not import or register `me_router`"
    - "`GET /api/me` against the running FastAPI app returns 404"
    - "`backend/tests/test_me_endpoint.py` no longer exists (or its `/api/me`-specific cases are removed)"
    - "No stale `/api/me` comments remain in FullPageSpinner.tsx or apiClient.ts"
    - "`CurrentUser`, `get_current_user`, `require_admin` are unchanged and still importable"
  artifacts:
    - path: "backend/app/main.py"
      provides: "FastAPI app with me_router removed"
      does_not_contain: "me_router"
    - path: "frontend/src/auth/FullPageSpinner.tsx"
      provides: "Spinner component with updated comment (no /api/me reference)"
  key_links:
    - from: "backend/app/main.py"
      to: "app.routers.me"
      via: "REMOVED — import + include_router lines deleted"
      pattern: "me_router|from app.routers.me"
---

<objective>
Delete the FastAPI `/api/me` surface: remove `backend/app/routers/me.py`, its `main.py` registration, its test file, and scrub lingering docstring/comment references to `/api/me` in the frontend files called out in D-13. Keep `CurrentUser`, `get_current_user`, `require_admin` intact — other routers depend on them.

Purpose: Phase 66 MIG-AUTH-02 — backend surface gone, 404 on `/api/me`.
Output: `backend/app/routers/me.py` deleted; `main.py` has no `me_router` references; `/api/me` returns 404; comment cleanup done.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/66-kill-me-py/66-CONTEXT.md
@backend/app/routers/me.py
@backend/app/main.py
@frontend/src/auth/FullPageSpinner.tsx
@frontend/src/lib/apiClient.ts

<interfaces>
<!-- What this plan LEAVES ALONE - keep imports intact -->
From backend/app/security/directus_auth.py (unchanged):
```python
def get_current_user(...) -> CurrentUser: ...
def require_admin(...) -> CurrentUser: ...
```

From backend/app/schemas.py (unchanged):
```python
class CurrentUser(BaseModel):
    id: str
    email: str
    role: Role  # StrEnum 'admin' | 'viewer'
```

<!-- What this plan DELETES -->
From backend/app/routers/me.py (deleted entirely):
```python
router = APIRouter(prefix="/api", tags=["auth"])
class MeResponse(BaseModel): ...
@router.get("/me", response_model=MeResponse)
async def get_me(user: CurrentUser = Depends(get_current_user)) -> MeResponse: ...
```

From backend/app/main.py (lines to delete):
- Line 16:  `from app.routers.me import router as me_router`
- Line 32:  `app.include_router(me_router)`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Delete me.py router + remove main.py registration + delete tests</name>
  <read_first>
    - backend/app/routers/me.py (verify it's the only file to delete)
    - backend/app/main.py (lines 16 and 32 — exact location of import and include_router)
    - backend/tests/test_me_endpoint.py (confirm it only tests /api/me, not shared fixtures other tests need)
    - .planning/phases/66-kill-me-py/66-CONTEXT.md (D-11 — scope of backend deletion)
  </read_first>
  <files>backend/app/routers/me.py, backend/app/main.py, backend/tests/test_me_endpoint.py</files>
  <behavior>
    - `backend/app/routers/me.py` no longer exists on disk.
    - `backend/app/main.py` does not import `me_router` and does not call `app.include_router(me_router)`.
    - `backend/tests/test_me_endpoint.py` no longer exists.
    - FastAPI app boots: `cd backend && python -c "from app.main import app; assert app"` exits 0.
    - `GET /api/me` on the running app returns 404.
    - `CurrentUser`, `get_current_user`, `require_admin` are untouched (other routers still import them).
  </behavior>
  <action>
    1. **Delete the router file**:
    ```bash
    rm backend/app/routers/me.py
    ```

    2. **Delete the tests file**:
    ```bash
    rm backend/tests/test_me_endpoint.py
    ```
    (D-11 — router-level tests go with the router. If the test file contains any fixture also imported by other tests, move that fixture to `backend/tests/conftest.py` first; for the current file contents this is unlikely — verify with `grep -rn 'from tests.test_me_endpoint' backend/tests/` before deleting.)

    3. **Edit `backend/app/main.py`**:
       - Delete line 16: `from app.routers.me import router as me_router`
       - Delete line 32: `app.include_router(me_router)`
       - Leave line 14 (`from app.routers.data import router as data_router`) and line 17 (`from app.routers.signage_pair import ...`) intact — they straddle the deleted line but are untouched.
       - Do NOT remove any other import or `include_router` call.
       - Do NOT renumber or reorder — just delete those two lines.

    4. **Sanity check with grep**: after edits, `grep -n 'me_router\|from app.routers.me' backend/app/main.py` must return 0 matches.

    Do NOT touch `backend/app/security/directus_auth.py`. Do NOT touch `backend/app/schemas.py`. Do NOT remove `CurrentUser` or `Role` enum. Do NOT delete `DIRECTUS_ADMIN_ROLE_UUID` / `DIRECTUS_VIEWER_ROLE_UUID` env-var handling.
  </action>
  <verify>
    <automated>test ! -f backend/app/routers/me.py && test ! -f backend/tests/test_me_endpoint.py && ! grep -q 'me_router\|from app.routers.me' backend/app/main.py && cd backend && python -c "from app.main import app; assert app" </automated>
  </verify>
  <acceptance_criteria>
    - `test ! -f backend/app/routers/me.py` exits 0.
    - `test ! -f backend/tests/test_me_endpoint.py` exits 0.
    - `grep -c 'me_router' backend/app/main.py` returns 0.
    - `grep -c 'from app.routers.me' backend/app/main.py` returns 0.
    - `grep -c 'from app.routers.data import router as data_router' backend/app/main.py` returns 1 (untouched).
    - `grep -c 'from app.routers.signage_pair' backend/app/main.py` returns 1 (untouched).
    - `grep -c 'from app.security.directus_auth import' backend/app/` under `routers/` still shows `get_current_user` / `require_admin` being imported by other routers (at least 1 match across `backend/app/routers/*.py`).
    - `cd backend && python -c "from app.main import app; assert app"` exits 0 (import-time OK).
    - `cd backend && pytest -x --collect-only` exits 0 (no orphaned test imports).
    - With the stack running, `curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/api/me` returns `404`.
  </acceptance_criteria>
  <done>
    `backend/app/routers/me.py` and its test file are gone; `backend/app/main.py` no longer references `me_router`; `/api/me` returns 404; FastAPI app imports cleanly; `CurrentUser` / `get_current_user` / `require_admin` untouched.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Scrub stale `/api/me` comments in frontend FullPageSpinner + apiClient</name>
  <read_first>
    - frontend/src/auth/FullPageSpinner.tsx (entire file — comment at line 5 references `/api/me`)
    - frontend/src/lib/apiClient.ts (check for any `/api/me` comment; currently none found in code, but re-verify)
    - .planning/phases/66-kill-me-py/66-CONTEXT.md (D-13 — comment cleanup scope)
  </read_first>
  <files>frontend/src/auth/FullPageSpinner.tsx, frontend/src/lib/apiClient.ts</files>
  <behavior>
    - `frontend/src/auth/FullPageSpinner.tsx` docstring no longer contains the string `/api/me`.
    - `frontend/src/lib/apiClient.ts` contains no `/api/me` literal or comment (should already be clean — verify and only edit if a match exists).
    - Component behavior is unchanged; the grep guard in Plan 03 will not fire.
  </behavior>
  <action>
    1. **Edit `frontend/src/auth/FullPageSpinner.tsx`**: locate the docstring comment at line 5 currently reading:

    ```
     * Full-screen loading indicator shown by <AuthGate> while the initial
     * silent-refresh + /api/me hydration is in flight. Styled per
    ```

    Replace `+ /api/me hydration` with `+ readMe hydration`. The replacement text should read:

    ```
     * Full-screen loading indicator shown by <AuthGate> while the initial
     * silent-refresh + readMe hydration is in flight. Styled per
    ```

    Leave the rest of the file untouched (Loader2 import, JSX, className).

    2. **Check `frontend/src/lib/apiClient.ts`** for `/api/me` references:
    ```bash
    grep -n '/api/me' frontend/src/lib/apiClient.ts
    ```
    If any match returns, rewrite the comment to drop the literal `/api/me` token (the file stays in service for other routers — do NOT delete the whole apiClient module). If no match (expected — current grep returns empty), no edit needed on this file.

    3. **Full-tree sweep**: run the Plan 03 guard command locally to confirm cleanliness:
    ```bash
    grep -rn '"/api/me"' frontend/src/
    ```
    This MUST exit with status 1 (no matches). Plan 01 Task 3 removed the code-string matches; Plan 02 Task 2 removes any residual quoted-literal comments.

    Do NOT edit any other files. Do NOT touch `apiClient.ts` actual code (no functional change — other routers still use it). Do NOT remove the double-quoted-literal guard from the grep (Plan 03 uses `'"/api/me"'` with single-quoted shell wrapping a double-quoted literal).
  </action>
  <verify>
    <automated>! grep -rn '"/api/me"' frontend/src/ && ! grep -rn '/api/me' frontend/src/auth/FullPageSpinner.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rn '/api/me' frontend/src/auth/FullPageSpinner.tsx` returns 0 matches.
    - `grep -rn '"/api/me"' frontend/src/` returns 0 matches (the Plan 03 guard literal).
    - `grep -rn '/api/me' frontend/src/` returns 0 matches (broader sweep — comment or otherwise).
    - `frontend/src/auth/FullPageSpinner.tsx` still contains `Loader2` (component logic untouched).
    - `cd frontend && npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>
    No `/api/me` string or comment remains under `frontend/src/`. The Plan 03 CI guard will pass against the post-edit tree. No functional frontend change — only docstring scrub.
  </done>
</task>

</tasks>

<verification>
- `test ! -f backend/app/routers/me.py` passes.
- `grep -c 'me_router\|from app.routers.me' backend/app/main.py` returns 0.
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/api/me` returns `404` against the running stack.
- `grep -rn '/api/me' frontend/src/` returns 0 matches.
- Backend test suite: `cd backend && pytest -x` exits 0 (no orphaned test file, no broken imports).
- Frontend typecheck: `cd frontend && npx tsc --noEmit` exits 0.
</verification>

<success_criteria>
- `backend/app/routers/me.py` deleted; `backend/tests/test_me_endpoint.py` deleted.
- `backend/app/main.py` no longer imports or registers `me_router`.
- `/api/me` returns 404 on the live stack.
- `frontend/src/auth/FullPageSpinner.tsx` comment updated; no `/api/me` mentions anywhere under `frontend/src/`.
- `CurrentUser`, `get_current_user`, `require_admin` unchanged and still imported by other routers.
</success_criteria>

<output>
After completion, create `.planning/phases/66-kill-me-py/66-02-SUMMARY.md`.
</output>
