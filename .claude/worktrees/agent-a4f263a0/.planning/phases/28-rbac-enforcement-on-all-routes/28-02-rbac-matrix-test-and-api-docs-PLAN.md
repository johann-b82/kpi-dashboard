---
phase: 28-rbac-enforcement-on-all-routes
plan: 02
type: execute
wave: 2
depends_on: ["28-01"]
files_modified:
  - backend/tests/test_rbac.py
  - docs/api.md
autonomous: true
requirements:
  - RBAC-01
  - RBAC-02
  - RBAC-04
  - RBAC-05
must_haves:
  truths:
    - "Viewer JWT on every authenticated GET route returns a status that is NOT 401 and NOT 403 (auth + authz both pass)"
    - "Viewer JWT on every mutation route returns 403 with body exactly {\"detail\": \"admin role required\"}"
    - "Admin JWT on every mutation route returns a status that is NOT 403 (auth + authz both pass; business-logic 4xx/5xx acceptable)"
    - "docs/api.md exists and lists every /api/* route with a Viewer and Admin column, matching 28-RESEARCH.md matrix"
    - "RBAC-04 is explicitly documented: the same user with a fresh JWT carrying a new role sees new authorization on the next request (stateless-JWT note)"
  artifacts:
    - path: "backend/tests/test_rbac.py"
      provides: "Parametrized RBAC matrix covering all 19 authenticated routes × 2 roles"
      contains: "@pytest.mark.parametrize"
      min_lines: 80
    - path: "docs/api.md"
      provides: "Admin-vs-Viewer route matrix (RBAC-05)"
      contains: "| Method | Path | Viewer | Admin |"
      min_lines: 30
  key_links:
    - from: "backend/tests/test_rbac.py"
      to: "backend/app/security/directus_auth.py::require_admin"
      via: "AsyncClient request with viewer-minted JWT → asserts 403 + body"
      pattern: "admin role required"
    - from: "docs/api.md"
      to: "backend/app/routers/*.py"
      via: "route matrix table"
      pattern: "POST \\| /api/upload"
---

<objective>
Prove Phase 28's RBAC enforcement works end-to-end with a parametrized pytest matrix (D-05) covering every authenticated route × both roles, and produce `docs/api.md` as the canonical Admin-vs-Viewer contract (D-04, RBAC-05). Also pin RBAC-04 as an explicit test: a JWT minted with the Admin UUID passes a mutation; the same user-id minted with the Viewer UUID is rejected — demonstrating that role propagation is purely JWT-driven.

Purpose: Satisfies all 4 phase requirements (RBAC-01, -02, -04, -05) as an observable, greppable, CI-verifiable contract.

Output: 1 new test file (`backend/tests/test_rbac.py`) + 1 new doc (`docs/api.md`).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/28-rbac-enforcement-on-all-routes/28-CONTEXT.md
@.planning/phases/28-rbac-enforcement-on-all-routes/28-RESEARCH.md
@.planning/phases/28-rbac-enforcement-on-all-routes/28-01-require-admin-and-mutation-gating-PLAN.md
@backend/tests/test_directus_auth.py
@backend/tests/conftest.py

<interfaces>
Reuse from `backend/tests/test_directus_auth.py` (Phase 27):
- `_mint(role_uuid, *, secret=..., exp_minutes=..., user_id=..., extra=...) -> str` — mints HS256 JWTs
- `ADMIN_UUID` — module-level constant read from `DIRECTUS_ADMINISTRATOR_ROLE_UUID` env
- `VIEWER_UUID` — module-level constant (`a2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb`)

Test transport pattern (already proven in Phase 27):
```python
from httpx import AsyncClient, ASGITransport
from app.main import app

async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
    r = await c.request(method, path, headers={"Authorization": f"Bearer {token}"})
```

**Full authenticated route matrix (from 28-RESEARCH.md):**
- 11 GET routes (both roles → NOT 401 and NOT 403)
- 6 mutation decorator sites = 8 mutation route rows (Viewer → 403, Admin → not 403)

Excluded from RBAC tests: `/health`, `/docs`, `/openapi.json` (public per Phase 27 D-04).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create backend/tests/test_rbac.py with full parametrized RBAC matrix</name>
  <read_first>
    - backend/tests/test_directus_auth.py (import _mint, ADMIN_UUID, VIEWER_UUID; match fixture/env patterns)
    - backend/tests/conftest.py (env-var injection for DIRECTUS_SECRET and role UUIDs)
    - backend/app/routers/uploads.py (confirm real paths one more time: /api/upload, /api/uploads, /api/uploads/{batch_id})
    - backend/app/routers/sync.py (confirm /api/sync, /api/sync/test, /api/sync/meta)
    - backend/app/routers/settings.py (confirm /api/settings, /api/settings/logo, /api/settings/personio-options)
    - .planning/phases/28-rbac-enforcement-on-all-routes/28-RESEARCH.md (canonical matrix section "Consolidated Role Matrix")
  </read_first>
  <files>backend/tests/test_rbac.py</files>
  <behavior>
    - For every authenticated GET in the matrix, both Viewer and Admin JWTs → status_code not in {401, 403}
    - For every mutation in the matrix with a Viewer JWT → status_code == 403 AND response.json() == {"detail": "admin role required"}
    - For every mutation in the matrix with an Admin JWT → status_code != 403 (auth + authz passed; business validation may still 4xx/5xx)
    - Explicit RBAC-04 test: same user_id, two distinct JWTs (viewer-role, admin-role), same mutation route — viewer token 403, admin token not 403
  </behavior>
  <action>
    Create `backend/tests/test_rbac.py` with the following structure. Import `_mint`, `ADMIN_UUID`, `VIEWER_UUID` from `tests.test_directus_auth` to avoid duplication. Use `pytest.mark.asyncio` if that's the project convention (check `conftest.py`; Phase 27 e2e tests used plain `async def` — match that style).

    ```python
    """
    Phase 28 RBAC matrix — exhaustive per-route × per-role test.

    Source of truth for route classification: .planning/phases/28-*/28-RESEARCH.md
    Covers: RBAC-01, RBAC-02, RBAC-04, RBAC-05 (the file itself is the machine-readable contract).
    """
    import pytest
    from httpx import AsyncClient, ASGITransport

    from tests.test_directus_auth import _mint, ADMIN_UUID, VIEWER_UUID
    from app.main import app

    # (method, path, role_uuid, expected_kind)
    # expected_kind ∈ {"allow", "deny"}:
    #   allow → auth+authz passed (status != 401 and != 403)
    #   deny  → viewer on mutation (status == 403 AND body == {"detail": "admin role required"})
    READ_ROUTES = [
        ("GET", "/api/kpis"),
        ("GET", "/api/kpis/chart"),
        ("GET", "/api/kpis/latest-upload"),
        ("GET", "/api/hr/kpis"),
        ("GET", "/api/hr/kpis/history"),
        ("GET", "/api/data/sales"),
        ("GET", "/api/data/employees"),
        ("GET", "/api/settings"),
        ("GET", "/api/settings/personio-options"),
        ("GET", "/api/settings/logo"),
        ("GET", "/api/uploads"),
        ("GET", "/api/sync/meta"),
    ]

    MUTATION_ROUTES = [
        ("POST",   "/api/upload"),
        ("DELETE", "/api/uploads/99999"),
        ("POST",   "/api/sync"),
        ("POST",   "/api/sync/test"),
        ("PUT",    "/api/settings"),
        ("POST",   "/api/settings/logo"),
    ]

    @pytest.mark.parametrize("method,path", READ_ROUTES)
    @pytest.mark.parametrize("role_uuid", [VIEWER_UUID, ADMIN_UUID])
    async def test_read_routes_allow_both_roles(method, path, role_uuid):
        token = _mint(role_uuid)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.request(method, path, headers={"Authorization": f"Bearer {token}"})
        assert r.status_code != 401, f"{method} {path} returned 401 for role {role_uuid}; auth broke"
        assert r.status_code != 403, f"{method} {path} returned 403 for role {role_uuid}; unexpected authz block — body={r.text}"

    @pytest.mark.parametrize("method,path", MUTATION_ROUTES)
    async def test_mutation_routes_deny_viewer(method, path):
        token = _mint(VIEWER_UUID)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.request(method, path, headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 403, f"{method} {path} expected 403 for viewer, got {r.status_code}: {r.text}"
        assert r.json() == {"detail": "admin role required"}, \
            f"{method} {path} 403 body was {r.json()}, not the canonical shape"

    @pytest.mark.parametrize("method,path", MUTATION_ROUTES)
    async def test_mutation_routes_allow_admin(method, path):
        token = _mint(ADMIN_UUID)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.request(method, path, headers={"Authorization": f"Bearer {token}"})
        # Auth + authz passed. Business validation may return 200/400/404/422/500.
        # The ONLY disallowed code is 403 (would mean require_admin incorrectly rejected Admin).
        assert r.status_code != 403, \
            f"{method} {path} returned 403 for admin, but admin must pass authz: {r.text}"
        # 401 would also indicate test harness issue
        assert r.status_code != 401, \
            f"{method} {path} returned 401 for admin; JWT minting broke"

    # --- RBAC-04: stateless-JWT role propagation ---
    # Same user_id, two tokens with different role UUIDs → different authorization outcomes.
    # Demonstrates: promoting a Viewer to Admin in Directus UI (which mints new JWTs with
    # the new role UUID) takes effect on the next request without any backend code path.
    async def test_rbac_04_same_user_role_swap_via_jwt():
        user_id = "00000000-0000-0000-0000-00000000abcd"
        viewer_token = _mint(VIEWER_UUID, user_id=user_id)
        admin_token  = _mint(ADMIN_UUID,  user_id=user_id)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r_viewer = await c.put("/api/settings",
                                   headers={"Authorization": f"Bearer {viewer_token}"})
            r_admin  = await c.put("/api/settings",
                                   headers={"Authorization": f"Bearer {admin_token}"})

        assert r_viewer.status_code == 403
        assert r_viewer.json() == {"detail": "admin role required"}
        assert r_admin.status_code != 403, \
            f"Same user with Admin-role JWT still 403'd: {r_admin.text}"
    ```

    **If `_mint`'s signature differs** (e.g., no `user_id` kwarg): read `backend/tests/test_directus_auth.py` and adjust the RBAC-04 test to use whatever mechanism `_mint` exposes for setting the `sub`/`id` claim. If `_mint` cannot override user_id, minting two tokens with different role UUIDs is sufficient — the test's purpose is role propagation, not shared user_id specifically.

    **If the pytest config does not auto-use `asyncio_mode = auto`** (check `pyproject.toml` / `pytest.ini` / `conftest.py`): the Phase 27 tests show the style — match exactly. Add `@pytest.mark.asyncio` decorators if needed.
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/test_rbac.py -v</automated>
  </verify>
  <acceptance_criteria>
    - `backend/tests/test_rbac.py` exists
    - File contains `@pytest.mark.parametrize` at least 3 times (read-allow, mutation-deny, mutation-allow)
    - File contains the 6 mutation rows from MUTATION_ROUTES (grep-verifiable: `grep -c '/api/sync/test' backend/tests/test_rbac.py` ≥ 1)
    - File contains the assertion string `admin role required` at least once
    - File contains a function named `test_rbac_04_same_user_role_swap_via_jwt` (or equivalent) covering RBAC-04
    - `cd backend && python -m pytest tests/test_rbac.py -v` exits 0 with all tests passed
    - `cd backend && python -m pytest tests/ -v` exits 0 (no regressions on Phase 27 tests)
  </acceptance_criteria>
  <done>Every authenticated route × role combination is machine-verified; the canonical 403 body is asserted literally; RBAC-04 is proven by a stateless-JWT swap.</done>
</task>

<task type="auto">
  <name>Task 2: Create docs/api.md with the Admin-vs-Viewer route matrix (D-04, RBAC-05)</name>
  <read_first>
    - .planning/phases/28-rbac-enforcement-on-all-routes/28-RESEARCH.md (section "Consolidated Role Matrix" — copy exactly)
    - .planning/phases/28-rbac-enforcement-on-all-routes/28-CONTEXT.md (D-04 for table shape)
    - docs/ (list existing docs to match style; if none, establish minimal markdown)
    - README.md (top-level doc style baseline if docs/ is empty)
  </read_first>
  <files>docs/api.md</files>
  <action>
    Create `docs/api.md` with the following content. This is the canonical route matrix (RBAC-05) and must match the matrix in 28-RESEARCH.md exactly (single source of truth for the route list; 28-RESEARCH.md is the derivation, docs/api.md is the publication).

    ```markdown
    # API Route Contract — Admin vs Viewer

    **Milestone:** v1.11-directus
    **Last updated:** 2026-04-15 (Phase 28)
    **Enforcement:** FastAPI dependency `app.security.directus_auth.require_admin` on every mutation route. See `backend/tests/test_rbac.py` for the machine-verified matrix.

    ## Roles

    - **Admin** — full read + write access across all `/api/*` routes.
    - **Viewer** — read access only. Mutation attempts return HTTP 403 with body:
      ```json
      {"detail": "admin role required"}
      ```
    - **Public** — unauthenticated endpoints (no JWT required): `/health`, `/docs`, `/openapi.json`.

    Role is resolved from the Directus-issued JWT (HS256, shared secret). Role changes made in the Directus admin UI take effect on the user's next JWT refresh — no server-side session invalidation needed (stateless JWT).

    ## Route Matrix

    | Method | Path                            | Viewer | Admin | Notes |
    |--------|---------------------------------|:------:|:-----:|-------|
    | GET    | /api/kpis                       |   ✓    |   ✓   | Sales KPI summary |
    | GET    | /api/kpis/chart                 |   ✓    |   ✓   | Chart data |
    | GET    | /api/kpis/latest-upload         |   ✓    |   ✓   | Most recent upload metadata |
    | GET    | /api/hr/kpis                    |   ✓    |   ✓   | HR KPI summary |
    | GET    | /api/hr/kpis/history            |   ✓    |   ✓   | HR KPI time series |
    | GET    | /api/data/sales                 |   ✓    |   ✓   | Sales record listing |
    | GET    | /api/data/employees             |   ✓    |   ✓   | Employee record listing |
    | GET    | /api/settings                   |   ✓    |   ✓   | Read settings (colors, app name) |
    | GET    | /api/settings/personio-options  |   ✓    |   ✓   | Live Personio metadata — read-only |
    | GET    | /api/settings/logo              |   ✓    |   ✓   | Serves raw logo bytes |
    | GET    | /api/uploads                    |   ✓    |   ✓   | Upload history |
    | GET    | /api/sync/meta                  |   ✓    |   ✓   | Last sync metadata |
    | POST   | /api/upload                     |   —    |   ✓   | ERP file upload |
    | DELETE | /api/uploads/{batch_id}         |   —    |   ✓   | Cascade-deletes sales records |
    | POST   | /api/sync                       |   —    |   ✓   | Full Personio sync |
    | POST   | /api/sync/test                  |   —    |   ✓   | Personio credential test |
    | PUT    | /api/settings                   |   —    |   ✓   | Update colors / app name / credentials |
    | POST   | /api/settings/logo              |   —    |   ✓   | Logo upload |
    | GET    | /health                         | public | public | No auth required |
    | GET    | /docs                           | public | public | OpenAPI UI (no auth) |
    | GET    | /openapi.json                   | public | public | OpenAPI schema (no auth) |

    ## Error Shapes

    | HTTP | Condition | Body |
    |------|-----------|------|
    | 401  | Missing or invalid JWT | `{"detail": "invalid or missing authentication token"}` |
    | 403  | Valid JWT, Viewer role on a mutation route | `{"detail": "admin role required"}` |

    ## Verification

    - Automated: `cd backend && python -m pytest tests/test_rbac.py -v`
    - Source of truth: `backend/app/security/directus_auth.py::require_admin` (the dependency) + decorators in `backend/app/routers/{uploads,sync,settings}.py`
    ```

    Exact ✓ / — glyphs and header pipes MUST be preserved (they are tested below via grep).

    If `docs/` does not exist yet, create it (`mkdir -p docs`). Do not add a sidebar / index file — single-file doc is intentional for this phase.
  </action>
  <verify>
    <automated>test -f docs/api.md && grep -q '| Method | Path' docs/api.md && grep -q 'POST   | /api/upload' docs/api.md && grep -q 'POST   | /api/sync/test' docs/api.md && grep -q 'POST   | /api/settings/logo' docs/api.md && grep -q 'admin role required' docs/api.md && grep -q 'invalid or missing authentication token' docs/api.md && test "$(grep -c '| GET' docs/api.md)" -ge "12"</automated>
  </verify>
  <acceptance_criteria>
    - `docs/api.md` exists and is at least 30 lines
    - Contains the header row `| Method | Path | Viewer | Admin |`
    - Contains all 6 mutation paths: `/api/upload`, `/api/uploads/{batch_id}`, `/api/sync`, `/api/sync/test`, `/api/settings` (PUT), `/api/settings/logo`
    - Contains all 12 authenticated GET paths from 28-RESEARCH.md matrix
    - Contains the exact 403 body string `"admin role required"`
    - Contains the exact 401 body string `"invalid or missing authentication token"` (from Phase 27)
    - The verify command exits 0
  </acceptance_criteria>
  <done>docs/api.md is the canonical, human-reviewable Admin-vs-Viewer contract (RBAC-05 satisfied, D-04 applied).</done>
</task>

</tasks>

<verification>
- `cd backend && python -m pytest tests/ -v` → all Phase 27 + Phase 28 tests pass
- `cd backend && python -m pytest tests/test_rbac.py -v` → matrix tests pass
- `wc -l docs/api.md` → ≥ 30 lines
- Manual curl sanity (optional, with the stack running): mint a Viewer JWT, `curl -X POST -H "Authorization: Bearer $VIEWER_JWT" http://localhost:8000/api/upload` → 403 body `{"detail":"admin role required"}`
</verification>

<success_criteria>
- RBAC-01: matrix proves all 12 GET routes allow both roles
- RBAC-02: matrix proves all 6 mutation decorators (8 route rows) return 403 + canonical body for Viewer
- RBAC-04: `test_rbac_04_same_user_role_swap_via_jwt` proves role propagation is JWT-only (no server-side state)
- RBAC-05: `docs/api.md` documents the full Admin-vs-Viewer matrix; 403 body is machine-readable and asserted in tests
- All 4 phase requirements covered and automated-verifiable in CI
</success_criteria>

<output>
After completion, create `.planning/phases/28-rbac-enforcement-on-all-routes/28-02-SUMMARY.md`.
</output>
