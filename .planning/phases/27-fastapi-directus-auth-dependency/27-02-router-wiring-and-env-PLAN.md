---
phase: 27-fastapi-directus-auth-dependency
plan: 02
type: execute
wave: 2
depends_on: ["27-01"]
files_modified:
  - backend/app/routers/data.py
  - backend/app/routers/hr_kpis.py
  - backend/app/routers/kpis.py
  - backend/app/routers/settings.py
  - backend/app/routers/sync.py
  - backend/app/routers/uploads.py
  - .env.example
  - .env
  - backend/tests/test_directus_auth.py
autonomous: true
requirements:
  - AUTH-04
user_setup:
  - service: directus
    why: "Administrator role UUID differs per install and must be captured from the running Directus instance and written to .env"
    env_vars:
      - name: DIRECTUS_ADMINISTRATOR_ROLE_UUID
        source: "curl to running Directus /roles?filter[name][_eq]=Administrator (script below automates it)"
must_haves:
  truths:
    - "Every /api/* route returns 401 without a valid bearer"
    - "Every /api/* route returns 200 with a valid admin or viewer bearer"
    - "/health, /docs, /redoc, /openapi.json remain unauthenticated"
    - "DIRECTUS_ADMINISTRATOR_ROLE_UUID in .env matches the Administrator role UUID in the running Directus"
  artifacts:
    - path: ".env.example"
      provides: "Documents DIRECTUS_SECRET, DIRECTUS_ADMINISTRATOR_ROLE_UUID, DIRECTUS_VIEWER_ROLE_UUID with generation commands"
      contains: "DIRECTUS_ADMINISTRATOR_ROLE_UUID"
    - path: "backend/app/routers/kpis.py"
      provides: "APIRouter with dependencies=[Depends(get_current_user)]"
      contains: "Depends(get_current_user)"
  key_links:
    - from: "backend/app/routers/*.py"
      to: "backend/app/security/directus_auth.py"
      via: "APIRouter constructor dependencies= arg"
      pattern: "dependencies=\\[Depends\\(get_current_user\\)\\]"
---

<objective>
Apply Phase 27's auth dependency to every `/api/*` router via router-level `dependencies=[Depends(get_current_user)]` (D-05), capture the Directus-generated `Administrator` role UUID from the running instance into `.env`/`.env.example`, and add an end-to-end integration test proving an `/api/*` route on the real app returns 401 without a bearer and 200 with a valid one.

Purpose: Satisfies AUTH-04 (every `/api/*` rejects without valid bearer) and success criterion 2.

Output: 6 router files updated, `.env` + `.env.example` updated with Administrator UUID, one new end-to-end test appended to `test_directus_auth.py`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/27-fastapi-directus-auth-dependency/27-CONTEXT.md
@.planning/phases/27-fastapi-directus-auth-dependency/27-RESEARCH.md
@.planning/phases/27-fastapi-directus-auth-dependency/27-01-auth-dependency-foundation-PLAN.md
@backend/app/main.py
@backend/app/routers/kpis.py
@backend/app/routers/data.py
@backend/app/routers/hr_kpis.py
@backend/app/routers/settings.py
@backend/app/routers/sync.py
@backend/app/routers/uploads.py
@.env.example
@directus/bootstrap-roles.sh

<interfaces>
From backend/app/security/directus_auth.py (created in 27-01):
```python
async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser: ...
```

All 6 existing routers follow pattern:
```python
router = APIRouter(prefix="/api/<name>", tags=["<tag>"])
```
Target pattern:
```python
from app.security.directus_auth import get_current_user
from fastapi import Depends

router = APIRouter(
    prefix="/api/<name>",
    tags=["<tag>"],
    dependencies=[Depends(get_current_user)],
)
```

Viewer UUID (fixed, from directus/bootstrap-roles.sh): `a2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb`
Administrator UUID: unknown until fetched from running Directus (D-06).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fetch Administrator role UUID from running Directus and write to .env + .env.example</name>
  <read_first>
    - .env.example (to know existing format and to match style)
    - directus/bootstrap-roles.sh (Viewer UUID reference and admin bootstrap credentials)
    - .planning/phases/27-fastapi-directus-auth-dependency/27-CONTEXT.md (D-06 exact steps)
    - docker-compose.yml (confirm Directus is reachable at http://localhost:8055)
  </read_first>
  <files>.env.example, .env</files>
  <action>
    1. Ensure Directus is running: `docker compose up -d directus db` (idempotent — no-op if already up). Wait for health: loop up to 60s on `curl -sf http://localhost:8055/server/health`.

    2. Read admin email/password from existing `.env` (already set during Phase 26). Do NOT hardcode them; use `grep` + shell var extraction, e.g.:
       ```bash
       ADMIN_EMAIL=$(grep -E '^DIRECTUS_ADMIN_EMAIL=' .env | cut -d= -f2-)
       ADMIN_PASSWORD=$(grep -E '^DIRECTUS_ADMIN_PASSWORD=' .env | cut -d= -f2-)
       ```

    3. Log in and fetch UUID:
       ```bash
       TOKEN=$(curl -sf -X POST http://localhost:8055/auth/login \
         -H "Content-Type: application/json" \
         -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
         | jq -r '.data.access_token')
       ADMIN_UUID=$(curl -sf "http://localhost:8055/roles?filter[name][_eq]=Administrator" \
         -H "Authorization: Bearer $TOKEN" \
         | jq -r '.data[0].id')
       echo "$ADMIN_UUID"
       ```
       Validate: `[[ "$ADMIN_UUID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]` — fail loudly if not.

    4. Append/update `.env` (idempotent — replace if keys already exist):
       ```
       DIRECTUS_ADMINISTRATOR_ROLE_UUID=<fetched UUID>
       DIRECTUS_VIEWER_ROLE_UUID=a2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb
       ```
       Note: `DIRECTUS_SECRET` already exists in `.env` from Phase 26 — do not overwrite.

    5. Update `.env.example` — add/update these three lines with generation instructions as comments:
       ```
       # Directus JWT HS256 shared secret (already set in Phase 26). Must match Directus container's SECRET.
       DIRECTUS_SECRET=replace-with-output-of-openssl-rand-hex-32

       # Directus role UUIDs (fetch after first Directus boot).
       # Administrator UUID is generated by Directus on first boot. Fetch via:
       #   docker compose up -d directus
       #   TOKEN=$(curl -sf -X POST http://localhost:8055/auth/login -H "Content-Type: application/json" \
       #     -d '{"email":"$DIRECTUS_ADMIN_EMAIL","password":"$DIRECTUS_ADMIN_PASSWORD"}' | jq -r '.data.access_token')
       #   curl -sf "http://localhost:8055/roles?filter[name][_eq]=Administrator" -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id'
       DIRECTUS_ADMINISTRATOR_ROLE_UUID=00000000-0000-0000-0000-000000000000

       # Viewer UUID is fixed in directus/bootstrap-roles.sh.
       DIRECTUS_VIEWER_ROLE_UUID=a2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb
       ```
       Keep existing unrelated `.env.example` content intact.
  </action>
  <verify>
    <automated>grep -E '^DIRECTUS_ADMINISTRATOR_ROLE_UUID=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' .env &amp;&amp; grep -E '^DIRECTUS_VIEWER_ROLE_UUID=a2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb$' .env &amp;&amp; grep -E 'DIRECTUS_ADMINISTRATOR_ROLE_UUID' .env.example &amp;&amp; grep -E 'DIRECTUS_VIEWER_ROLE_UUID=a2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb' .env.example</automated>
  </verify>
  <acceptance_criteria>
    - `.env` contains a `DIRECTUS_ADMINISTRATOR_ROLE_UUID=` line with a valid UUID (matches regex `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
    - `.env` contains `DIRECTUS_VIEWER_ROLE_UUID=a2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb`
    - `.env.example` contains both variable names with documented generation commands (curl + jq snippet)
    - The verify command exits 0
  </acceptance_criteria>
  <done>Administrator UUID captured from live Directus; both env files aligned; executors in later phases know how to re-derive on a fresh install.</done>
</task>

<task type="auto">
  <name>Task 2: Add dependencies=[Depends(get_current_user)] to all 6 routers</name>
  <read_first>
    - backend/app/routers/kpis.py
    - backend/app/routers/data.py
    - backend/app/routers/hr_kpis.py
    - backend/app/routers/settings.py
    - backend/app/routers/sync.py
    - backend/app/routers/uploads.py
    - backend/app/security/directus_auth.py (for import path)
    - .planning/phases/27-fastapi-directus-auth-dependency/27-CONTEXT.md (D-05 rationale)
  </read_first>
  <files>
    backend/app/routers/data.py,
    backend/app/routers/hr_kpis.py,
    backend/app/routers/kpis.py,
    backend/app/routers/settings.py,
    backend/app/routers/sync.py,
    backend/app/routers/uploads.py
  </files>
  <action>
    For EACH of the 6 router files:

    1. Add import near the other `fastapi` imports (if `Depends` already imported, reuse):
       ```python
       from fastapi import Depends  # add if not present
       from app.security.directus_auth import get_current_user
       ```

    2. Modify the `APIRouter(...)` constructor call to include `dependencies=[Depends(get_current_user)]`:
       Before: `router = APIRouter(prefix="/api/kpis", tags=["kpis"])`
       After:
       ```python
       router = APIRouter(
           prefix="/api/kpis",
           tags=["kpis"],
           dependencies=[Depends(get_current_user)],
       )
       ```

    Do NOT modify individual route handlers. Do NOT touch `main.py` — `/health` stays auth-free because it's declared on `app` directly, not on any router (D-04). Do NOT touch `/docs`, `/redoc`, `/openapi.json` — FastAPI registers those on the app, not any router.

    Per D-05: router-level is the single flip-point; accidental-omission-proof for future endpoints.
  </action>
  <verify>
    <automated>cd backend &amp;&amp; grep -l 'dependencies=\[Depends(get_current_user)\]' app/routers/data.py app/routers/hr_kpis.py app/routers/kpis.py app/routers/settings.py app/routers/sync.py app/routers/uploads.py | wc -l | grep -q '^6$' &amp;&amp; python -c "from app.main import app; print('import ok')"</automated>
  </verify>
  <acceptance_criteria>
    - All 6 files under `backend/app/routers/` contain literal string `dependencies=[Depends(get_current_user)]`
    - All 6 files contain literal `from app.security.directus_auth import get_current_user`
    - `python -c "from app.main import app"` succeeds (env vars from `.env` loaded — verify with `DIRECTUS_SECRET=... DIRECTUS_ADMINISTRATOR_ROLE_UUID=... DIRECTUS_VIEWER_ROLE_UUID=... python -c ...` if needed)
    - Existing test suite still passes: `cd backend && python -m pytest` exits 0 (conftest from 27-01 injects env vars)
  </acceptance_criteria>
  <done>Every /api/* router gates on get_current_user; /health, /docs, /redoc, /openapi.json remain open.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add end-to-end test proving real /api/* returns 401 without bearer and 200 with valid bearer</name>
  <read_first>
    - backend/tests/test_directus_auth.py (to append — don't duplicate fixtures)
    - backend/tests/conftest.py (for existing client/db fixtures and env-var injection)
    - backend/app/main.py (pick a real GET /api/* endpoint to hit — prefer one with minimal DB coupling)
    - backend/app/routers/kpis.py (likely candidate for the e2e route)
  </read_first>
  <files>backend/tests/test_directus_auth.py</files>
  <behavior>
    - GET to a real `/api/*` route without `Authorization` header → 401 with D-07 detail
    - GET to the same route with a valid viewer bearer → not 401 (200 or 5xx-due-to-db-but-not-401; 401 is the only disallowed code)
    - GET to `/health` with no bearer → 200
  </behavior>
  <action>
    Append to `backend/tests/test_directus_auth.py` (reuses `_mint`, `VIEWER_UUID`, `DIRECTUS_SECRET` from Task 3 of Plan 27-01):

    ```python
    # --- End-to-end against real app (Plan 27-02) ---
    from httpx import AsyncClient, ASGITransport

    async def test_real_api_route_requires_bearer():
        from app.main import app
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/api/kpis")
            assert r.status_code == 401
            assert r.json()["detail"] == "invalid or missing authentication token"

    async def test_real_api_route_accepts_valid_bearer():
        from app.main import app
        token = _mint(VIEWER_UUID)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/api/kpis", headers={"Authorization": f"Bearer {token}"})
            # Must not be 401 — auth passed. May be 200, 404, 422, or 5xx depending on DB state;
            # the only failure we're asserting against is auth rejection.
            assert r.status_code != 401, f"Expected auth to pass, got 401: {r.json()}"

    async def test_real_health_endpoint_no_auth():
        from app.main import app
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/health")
            assert r.status_code == 200
    ```

    If `/api/kpis` happens to 500 due to empty DB, the test still proves auth gate worked (status != 401). Choose a different `/api/*` path if `/api/kpis` is not registered with a plain GET at the router root — inspect `backend/app/routers/kpis.py` for the actual GET path and adjust the URL accordingly (e.g. `/api/kpis/summary`).
  </action>
  <verify>
    <automated>cd backend &amp;&amp; python -m pytest tests/test_directus_auth.py -v</automated>
  </verify>
  <acceptance_criteria>
    - `backend/tests/test_directus_auth.py` contains `async def test_real_api_route_requires_bearer`
    - `backend/tests/test_directus_auth.py` contains `async def test_real_api_route_accepts_valid_bearer`
    - `backend/tests/test_directus_auth.py` contains `async def test_real_health_endpoint_no_auth`
    - `pytest tests/test_directus_auth.py` exits 0 with all tests passing (11 total: 8 from 27-01 + 3 from 27-02)
  </acceptance_criteria>
  <done>Router-level gating proven end-to-end: unauth /api/* → 401, auth /api/* → not 401, /health always open.</done>
</task>

</tasks>

<verification>
- Manual curl check (optional): `curl -i http://localhost:8000/api/kpis` → 401 with body `{"detail":"invalid or missing authentication token"}`
- `cd backend && python -m pytest tests/test_directus_auth.py -v` → 11 passed
- `cd backend && python -m pytest` → full suite green (no regressions in existing endpoint tests — they use the conftest env-var injection from 27-01)
- `grep -c 'dependencies=\[Depends(get_current_user)\]' backend/app/routers/*.py` → 6
</verification>

<success_criteria>
- AUTH-04: every `/api/*` request without a valid `Authorization: Bearer <jwt>` returns 401 — proven by `test_real_api_route_requires_bearer`
- Success criterion 2: `/api/*` returns 401 without bearer; 401 also for expired/malformed (from 27-01 tests)
- Success criterion 4 (complete): all 8 unit cases + 3 integration cases green
- Success criterion 5 (complete): `backend/app/config.py` reads `DIRECTUS_SECRET` with clear error if unset (from 27-01) AND `.env` now has Administrator UUID populated from live Directus
- D-04 exemptions intact: `/health`, `/docs`, `/redoc`, `/openapi.json` unauthenticated
</success_criteria>

<output>
After completion, create `.planning/phases/27-fastapi-directus-auth-dependency/27-02-SUMMARY.md`.
</output>
