---
phase: 29-frontend-login-role-aware-ui
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/routers/me.py
  - backend/app/main.py
  - backend/tests/test_me_endpoint.py
  - docker-compose.yml
autonomous: true
requirements: [AUTH-03]
must_haves:
  truths:
    - "Authenticated GET /api/me returns {id, email, role} with role as 'admin' or 'viewer' string"
    - "Unauthenticated GET /api/me returns 401"
    - "Browser at http://localhost:5173 can send credentialed requests to Directus at http://localhost:8055 without CORS block"
  artifacts:
    - path: "backend/app/routers/me.py"
      provides: "GET /api/me route mounted on FastAPI"
      contains: "router.get"
    - path: "backend/tests/test_me_endpoint.py"
      provides: "Unit tests for /api/me (admin, viewer, unauth)"
    - path: "docker-compose.yml"
      provides: "Directus CORS_ENABLED=true, CORS_ORIGIN=http://localhost:5173, CORS_CREDENTIALS=true"
      contains: "CORS_ENABLED"
  key_links:
    - from: "backend/app/main.py"
      to: "backend/app/routers/me.py"
      via: "app.include_router(me_router)"
      pattern: "me_router"
    - from: "docker-compose.yml directus service"
      to: "browser at localhost:5173"
      via: "CORS headers with credentials"
      pattern: "CORS_CREDENTIALS.*true"
---

<objective>
Add backend `/api/me` endpoint and enable Directus CORS for the browser frontend.

Purpose: Phase 29 frontend needs a single source of truth for the current user's role string ('admin'/'viewer'). Directus SDK returns role as UUID; FastAPI already resolves role via `get_current_user` dep — expose it. Also enables cookie-mode auth cross-origin from the Vite dev server to Directus.
Output: New router `me.py`, wired into `main.py`, with unit tests. Updated docker-compose Directus env.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/29-frontend-login-role-aware-ui/29-CONTEXT.md
@.planning/phases/29-frontend-login-role-aware-ui/29-RESEARCH.md
@backend/app/main.py
@backend/app/security/directus_auth.py
@docker-compose.yml

<interfaces>
From backend/app/security/directus_auth.py (existing, Phase 27):
```python
class CurrentUser(BaseModel):
    id: UUID
    email: str
    role: Role  # enum: Role.ADMIN | Role.VIEWER

async def get_current_user(...) -> CurrentUser  # FastAPI dependency
```

Role enum serializes to lowercase string 'admin' / 'viewer' (verify: check enum value casing in directus_auth.py; if uppercase, return `current_user.role.value.lower()`).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add GET /api/me router with unit tests</name>
  <files>backend/app/routers/me.py, backend/tests/test_me_endpoint.py</files>
  <read_first>
    - backend/app/security/directus_auth.py (CurrentUser shape, Role enum, get_current_user signature)
    - backend/tests/test_directus_auth.py (test patterns, _mint helper for JWT minting)
    - backend/app/routers/settings.py (router structure, prefix/tag pattern)
  </read_first>
  <behavior>
    - Test 1: GET /api/me with valid Admin JWT → 200, body {id: <uuid-str>, email: <str>, role: "admin"}
    - Test 2: GET /api/me with valid Viewer JWT → 200, body role: "viewer"
    - Test 3: GET /api/me with no Authorization header → 401
    - Test 4: GET /api/me with expired JWT → 401
  </behavior>
  <action>
    Create `backend/app/routers/me.py`:

    ```python
    from fastapi import APIRouter, Depends
    from pydantic import BaseModel
    from app.security.directus_auth import CurrentUser, get_current_user

    router = APIRouter(prefix="/api", tags=["auth"])

    class MeResponse(BaseModel):
        id: str
        email: str
        role: str  # 'admin' | 'viewer'

    @router.get("/me", response_model=MeResponse)
    async def get_me(user: CurrentUser = Depends(get_current_user)) -> MeResponse:
        # Role enum -> lowercase string. If Role.ADMIN.value == 'Admin', use .lower().
        role_str = user.role.value.lower() if hasattr(user.role, "value") else str(user.role).lower()
        return MeResponse(id=str(user.id), email=user.email, role=role_str)
    ```

    Create `backend/tests/test_me_endpoint.py` reusing `_mint` JWT helper from `test_directus_auth.py` (import it). Use FastAPI TestClient. Follow the established pattern from Phase 28's test_rbac.py.

    Wire router in `backend/app/main.py`:
    - Add `from app.routers.me import router as me_router`
    - Add `app.include_router(me_router)` after other include_router calls.
  </action>
  <acceptance_criteria>
    - `test -f backend/app/routers/me.py` passes
    - `test -f backend/tests/test_me_endpoint.py` passes
    - `grep -c "me_router" backend/app/main.py` >= 2 (import + include)
    - `grep -c 'prefix="/api"' backend/app/routers/me.py` == 1
    - `cd backend && pytest tests/test_me_endpoint.py -x` → all 4 tests pass
    - `cd backend && pytest tests/ -x` → no existing tests regressed
  </acceptance_criteria>
  <verify>
    <automated>cd backend && pytest tests/test_me_endpoint.py -x</automated>
  </verify>
  <done>All 4 /api/me tests pass; full backend test suite still green.</done>
</task>

<task type="auto">
  <name>Task 2: Enable Directus CORS in docker-compose</name>
  <files>docker-compose.yml</files>
  <read_first>
    - docker-compose.yml (directus service environment block, current CORS_ENABLED: "false" on line ~88)
    - .planning/phases/29-frontend-login-role-aware-ui/29-RESEARCH.md (CORS section, HIGH-confidence requirement)
  </read_first>
  <action>
    In `docker-compose.yml`, locate the `directus:` service `environment:` block (around line 88 where `CORS_ENABLED: "false"` currently sits). Replace with:

    ```yaml
          CORS_ENABLED: "true"
          CORS_ORIGIN: "http://localhost:5173"
          CORS_CREDENTIALS: "true"
          TELEMETRY: "false"
    ```

    Keep the existing comment header `# --- Harden defaults for loopback-only operator UI ---` (or update it to reflect that CORS is now required for the SPA). Do NOT change any other Directus env vars, port bindings, or healthcheck.

    Note: Per D-02 / RESEARCH, `CORS_CREDENTIALS: "true"` is the load-bearing flag for the httpOnly refresh cookie — without it, the browser refuses to attach cookies even with CORS_ENABLED.
  </action>
  <acceptance_criteria>
    - `grep -c 'CORS_ENABLED: "true"' docker-compose.yml` == 1
    - `grep -c 'CORS_ORIGIN: "http://localhost:5173"' docker-compose.yml` == 1
    - `grep -c 'CORS_CREDENTIALS: "true"' docker-compose.yml` == 1
    - `grep -c 'CORS_ENABLED: "false"' docker-compose.yml` == 0
    - `docker compose config -q` exits 0 (yaml validates)
  </acceptance_criteria>
  <verify>
    <automated>docker compose config -q && grep -c 'CORS_CREDENTIALS: "true"' docker-compose.yml</automated>
  </verify>
  <done>Compose file validates; three CORS keys set correctly; old `"false"` value removed.</done>
</task>

</tasks>

<verification>
1. `cd backend && pytest tests/ -x` → all green including new /api/me tests
2. `docker compose config -q` → yaml valid
3. Manual spot-check: `docker compose up -d directus && sleep 10 && curl -i -H "Origin: http://localhost:5173" http://localhost:8055/server/ping` shows `access-control-allow-origin` and `access-control-allow-credentials: true` headers
</verification>

<success_criteria>
- GET /api/me endpoint exists, authed, returns role as lowercase string
- Directus service emits CORS headers permitting credentials from localhost:5173
- No regression in Phase 27/28 backend tests
</success_criteria>

<output>
After completion, create `.planning/phases/29-frontend-login-role-aware-ui/29-01-SUMMARY.md`
</output>
