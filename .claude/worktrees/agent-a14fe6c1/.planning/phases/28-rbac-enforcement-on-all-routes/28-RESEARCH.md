# Phase 28: RBAC Enforcement on All Routes - Research

**Researched:** 2026-04-15
**Domain:** FastAPI dependency injection, role-based access control, pytest parametrize
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Role enum** — `Role.ADMIN` / `Role.VIEWER` (Phase 27 D-02), imported from `backend/app/security/roles.py`.
- **`current_user` dep** — `get_current_user` already wired as router-level dep on all 6 `/api/*` routers (Phase 27 D-05). Phase 28 builds on this.
- **403 body shape** — Exactly `{"detail": "admin role required"}` (roadmap Success Criterion 2).
- **JWT refresh propagation** — Directus role changes take effect on next token refresh automatically — stateless JWT, no server-side session to invalidate. No code work needed beyond honoring the role claim.
- **D-01** — Per-route `Depends(require_admin)` on each mutation endpoint individually.
- **D-02** — `require_admin` dep added to `backend/app/security/directus_auth.py` (same module as `get_current_user`), raises `HTTPException(403, detail="admin role required")`.
- **D-03** — FastAPI's default `HTTPException(403, ...)` body shape — no custom exception handler.
- **D-04** — Create `docs/api.md` with the route matrix table.
- **D-05** — Parametrized pytest matrix in `backend/tests/test_directus_auth.py` (or new `test_rbac.py`); asserts status codes and 403 body.
- **D-06** — Researcher MUST produce exhaustive mutation route inventory confirmed against live code.

### Claude's Discretion

- Exact file organization of the `require_admin` dep (same module as `get_current_user`, vs new `authz.py`) — Claude picks simplest.
- Whether the matrix table in `docs/api.md` includes descriptions per route or just method/path/roles.
- Whether route handlers that need to READ the `current_user` object add it as a parameter — on a per-route basis as needed.

### Deferred Ideas (OUT OF SCOPE)

- Role hierarchy / additional roles — only ADMIN and VIEWER.
- Per-resource ACLs (e.g., "Viewer A can only see their own uploads").
- Admin audit log — potential future phase; not in Phase 28.
- Refresh token rotation policy — Directus default honored; no tuning in this phase.
- Phase 28 does NOT add new routes, change frontend behavior, introduce UI role indicators, or touch Directus roles/permissions definitions.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RBAC-01 | Read endpoints (`GET /api/kpis`, `/api/hr/kpis`, `/api/data/*`, `GET /api/settings`) return data for both Admin and Viewer roles. | Route inventory confirms all GET routes — no `require_admin` needed; existing router-level auth dep is sufficient. |
| RBAC-02 | Mutation endpoints (`POST /api/uploads/*`, `POST /api/sync/personio`, `PUT /api/settings`, any `DELETE /api/data/*`) require `role == 'Admin'`; return 403 for Viewer with body `{"detail": "admin role required"}`. | Full mutation inventory (see below) confirms 8 mutation routes; `require_admin` dep pattern is straightforward. |
| RBAC-04 | Admin can promote a Viewer to Admin via the Directus admin UI and the change takes effect on the user's next JWT refresh (≤ token TTL). | Stateless JWT — no server-side code needed; backend automatically reads new role from next JWT. |
| RBAC-05 | API contract documents the Admin-vs-Viewer matrix; 403 responses carry the machine-readable reason. | `docs/api.md` does not yet exist; must be created. `docs/` directory exists. |
</phase_requirements>

---

## Summary

Phase 28 adds role-gating to mutation routes in an existing FastAPI application that already has JWT authentication wired (Phase 27). The foundation is already in place: `get_current_user` is a router-level dependency on all 6 routers, `Role.ADMIN` / `Role.VIEWER` are defined, and `CurrentUser.role` is resolved on every request.

The work is mechanical: (1) add `require_admin` dep to `directus_auth.py`, (2) decorate each mutation endpoint with `dependencies=[Depends(require_admin)]`, (3) write a parametrized test matrix, and (4) create `docs/api.md`. No new architecture is introduced.

The route audit (D-06) found **8 mutation routes** and **11 read routes**, plus 3 unauthenticated endpoints. Two mutation routes were NOT in the roadmap's initial list: `POST /api/sync/test` and `POST /api/settings/logo`. The researcher classifies both as Admin-only (they mutate state or trigger external API calls). `GET /api/settings/personio-options` is read-only — Viewer-accessible.

**Primary recommendation:** Add `require_admin` to exactly 8 routes; leave all GET routes and the 3 unauthenticated endpoints untouched.

---

## Route Inventory (D-06 — EXHAUSTIVE, from source code)

This is the canonical mutation inventory derived by reading all 6 router files. Router prefixes are taken directly from `APIRouter(prefix=...)` constructor calls.

### Router: `uploads.py` — prefix `/api`

| # | Method | Full Path | Handler | Classification | Requires Admin |
|---|--------|-----------|---------|---------------|----------------|
| 1 | POST | `/api/upload` | `upload_file` | MUTATE — writes UploadBatch + SalesRecord rows | YES |
| 2 | GET | `/api/uploads` | `list_uploads` | READ — SELECT only | NO |
| 3 | DELETE | `/api/uploads/{batch_id}` | `delete_upload` | MUTATE — deletes UploadBatch + cascades | YES |

**Notes:**
- This router uses prefix `/api` (not `/api/uploads`). The upload endpoint is `POST /api/upload` (singular), not `POST /api/uploads`.
- The DELETE path is `/api/uploads/{batch_id}` — matches roadmap "DELETE /api/data/*" category but lives in the uploads router, not data router. There are no DELETE routes in `data.py`.

### Router: `sync.py` — prefix `/api/sync`

| # | Method | Full Path | Handler | Classification | Requires Admin |
|---|--------|-----------|---------|---------------|----------------|
| 4 | POST | `/api/sync` | `run_sync` | MUTATE — triggers full Personio sync, writes HR tables | YES |
| 5 | POST | `/api/sync/test` | `test_sync` | MUTATE — triggers external Personio API call (credential test) | YES |
| 6 | GET | `/api/sync/meta` | `get_sync_meta` | READ — SELECT sync metadata | NO |

**Notes:**
- `POST /api/sync/test` was NOT in the roadmap's D-06 list. It calls Personio's authentication endpoint (external side-effect) and requires valid credentials stored in DB. Classified Admin-only because it exercises external API with stored credentials.
- Roadmap listed `POST /api/sync/personio` — actual path is `POST /api/sync` (no `/personio` suffix). The router prefix is `/api/sync` and the POST handler is `@router.post("")`.

### Router: `settings.py` — prefix `/api/settings`

| # | Method | Full Path | Handler | Classification | Requires Admin |
|---|--------|-----------|---------|---------------|----------------|
| 7 | GET | `/api/settings` | `get_settings` | READ | NO |
| 8 | GET | `/api/settings/personio-options` | `get_personio_options` | READ — calls Personio API read-only; returns options list | NO |
| 9 | PUT | `/api/settings` | `put_settings` | MUTATE — updates colors, app_name, Personio credentials, reschedules scheduler | YES |
| 10 | POST | `/api/settings/logo` | `post_logo` | MUTATE — writes logo_data, logo_mime, logo_updated_at | YES |
| 11 | GET | `/api/settings/logo` | `get_logo` | READ — serves raw logo bytes | NO |

**Notes:**
- `POST /api/settings/logo` was NOT in the roadmap's D-06 list. It is clearly a mutation.
- `GET /api/settings/personio-options` calls the Personio API live but only reads data — it returns a degraded response (not 500) on failure. Classified READ / Viewer-accessible because it has no state-change effect and is needed by the frontend settings panel for dropdown population.

### Router: `kpis.py` — prefix `/api/kpis`

| # | Method | Full Path | Handler | Classification | Requires Admin |
|---|--------|-----------|---------|---------------|----------------|
| 12 | GET | `/api/kpis` | `get_kpi_summary` | READ | NO |
| 13 | GET | `/api/kpis/chart` | `get_chart_data` | READ | NO |
| 14 | GET | `/api/kpis/latest-upload` | `get_latest_upload` | READ | NO |

### Router: `hr_kpis.py` — prefix `/api/hr`

| # | Method | Full Path | Handler | Classification | Requires Admin |
|---|--------|-----------|---------|---------------|----------------|
| 15 | GET | `/api/hr/kpis` | `get_hr_kpis` | READ | NO |
| 16 | GET | `/api/hr/kpis/history` | `get_hr_kpi_history` | READ | NO |

### Router: `data.py` — prefix `/api/data`

| # | Method | Full Path | Handler | Classification | Requires Admin |
|---|--------|-----------|---------|---------------|----------------|
| 17 | GET | `/api/data/sales` | `list_sales_records` | READ | NO |
| 18 | GET | `/api/data/employees` | `list_employees` | READ | NO |

**Notes:**
- No DELETE, POST, or PUT in `data.py`. The roadmap's "DELETE /api/data/*" maps to `DELETE /api/uploads/{batch_id}` in `uploads.py`.

### Unauthenticated Endpoints (Phase 27 D-04 — NO auth dep)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | Docker healthcheck; no auth per D-04 |
| GET | `/docs` | OpenAPI UI; no auth per D-04 |
| GET | `/openapi.json` | OpenAPI schema; no auth per D-04 |

---

## Consolidated Role Matrix (for docs/api.md and test parametrize)

| Method | Path | Viewer | Admin | Notes |
|--------|------|--------|-------|-------|
| GET | /api/kpis | ✓ | ✓ | |
| GET | /api/kpis/chart | ✓ | ✓ | |
| GET | /api/kpis/latest-upload | ✓ | ✓ | |
| GET | /api/hr/kpis | ✓ | ✓ | |
| GET | /api/hr/kpis/history | ✓ | ✓ | |
| GET | /api/data/sales | ✓ | ✓ | |
| GET | /api/data/employees | ✓ | ✓ | |
| GET | /api/settings | ✓ | ✓ | |
| GET | /api/settings/personio-options | ✓ | ✓ | Live Personio call but read-only |
| GET | /api/settings/logo | ✓ | ✓ | |
| GET | /api/uploads | ✓ | ✓ | |
| GET | /api/sync/meta | ✓ | ✓ | |
| POST | /api/upload | — | ✓ | ERP file upload |
| DELETE | /api/uploads/{batch_id} | — | ✓ | Cascade deletes SalesRecords |
| POST | /api/sync | — | ✓ | Full Personio sync |
| POST | /api/sync/test | — | ✓ | Personio credential test |
| PUT | /api/settings | — | ✓ | Colors, app_name, credentials |
| POST | /api/settings/logo | — | ✓ | Logo upload |
| GET | /health | public | public | No auth |
| GET | /docs | public | public | No auth |
| GET | /openapi.json | public | public | No auth |

**Summary:** 8 mutation routes (Admin-only), 11 authenticated read routes (both roles), 3 public endpoints.

---

## Architecture Patterns

### require_admin Implementation (D-02)

Add directly to `backend/app/security/directus_auth.py` alongside `get_current_user`:

```python
# backend/app/security/directus_auth.py

def require_admin(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if current_user.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin role required",
        )
    return current_user
```

**Why same module:** `require_admin` wraps `get_current_user` directly. Same import path, no new file, least surface area.

### Per-Route Application (D-01)

```python
from app.security.directus_auth import require_admin

@router.post("/upload", response_model=UploadResponse, dependencies=[Depends(require_admin)])
async def upload_file(...):
    ...
```

The router-level `dependencies=[Depends(get_current_user)]` continues to gate all routes on the router. FastAPI deduplicates the `get_current_user` call — `require_admin` calls `Depends(get_current_user)` internally, but FastAPI's dependency cache within a request means `get_current_user` executes exactly once per request regardless.

**Dep resolution order:** FastAPI resolves all dependencies before the handler runs. Router-level deps run first, then route-level deps. `require_admin` receiving `current_user` from `Depends(get_current_user)` is deduped with the router-level dep — `get_current_user` is only called once. The 403 from `require_admin` will raise before the handler body executes.

### Parametrized Test Matrix (D-05)

Pattern from existing `test_directus_auth.py` — use the same `_mint()` helper and `app` fixture. New test file `test_rbac.py` is cleaner than appending to the growing `test_directus_auth.py`:

```python
# backend/tests/test_rbac.py
import pytest
from httpx import AsyncClient, ASGITransport
from tests.test_directus_auth import _mint, ADMIN_UUID, VIEWER_UUID

from app.main import app

RBAC_MATRIX = [
    # (method, path, role_uuid, expected_status)
    ("GET",    "/api/kpis",                 VIEWER_UUID, 200),
    ("GET",    "/api/kpis",                 ADMIN_UUID,  200),
    ("GET",    "/api/kpis/chart",           VIEWER_UUID, 200),
    ("GET",    "/api/kpis/chart",           ADMIN_UUID,  200),
    ("GET",    "/api/kpis/latest-upload",   VIEWER_UUID, 200),
    ("GET",    "/api/kpis/latest-upload",   ADMIN_UUID,  200),
    ("GET",    "/api/hr/kpis",              VIEWER_UUID, 200),
    ("GET",    "/api/hr/kpis",              ADMIN_UUID,  200),
    ("GET",    "/api/hr/kpis/history",      VIEWER_UUID, 200),
    ("GET",    "/api/hr/kpis/history",      ADMIN_UUID,  200),
    ("GET",    "/api/data/sales",           VIEWER_UUID, 200),
    ("GET",    "/api/data/sales",           ADMIN_UUID,  200),
    ("GET",    "/api/data/employees",       VIEWER_UUID, 200),
    ("GET",    "/api/data/employees",       ADMIN_UUID,  200),
    ("GET",    "/api/settings",             VIEWER_UUID, 200),
    ("GET",    "/api/settings",             ADMIN_UUID,  200),
    ("GET",    "/api/settings/logo",        VIEWER_UUID, 404),  # 404 = no logo set; auth passed
    ("GET",    "/api/settings/logo",        ADMIN_UUID,  404),
    ("GET",    "/api/uploads",              VIEWER_UUID, 200),
    ("GET",    "/api/uploads",              ADMIN_UUID,  200),
    ("GET",    "/api/sync/meta",            VIEWER_UUID, 200),
    ("GET",    "/api/sync/meta",            ADMIN_UUID,  200),
    # Mutations — Viewer gets 403
    ("POST",   "/api/upload",               VIEWER_UUID, 403),
    ("POST",   "/api/upload",               ADMIN_UUID,  422),  # 422 = no file provided
    ("DELETE", "/api/uploads/99999",        VIEWER_UUID, 403),
    ("DELETE", "/api/uploads/99999",        ADMIN_UUID,  404),  # 404 = batch not found
    ("POST",   "/api/sync",                 VIEWER_UUID, 403),
    ("POST",   "/api/sync",                 ADMIN_UUID,  422),  # 422 = no Personio creds
    ("POST",   "/api/sync/test",            VIEWER_UUID, 403),
    ("POST",   "/api/sync/test",            ADMIN_UUID,  422),
    ("PUT",    "/api/settings",             VIEWER_UUID, 403),
    ("PUT",    "/api/settings",             ADMIN_UUID,  422),  # 422 = no body
    ("POST",   "/api/settings/logo",        VIEWER_UUID, 403),
    ("POST",   "/api/settings/logo",        ADMIN_UUID,  422),  # 422 = no file
]
```

**Key insight on non-403 Admin responses:** For mutation routes, the test should assert that Admin does NOT get 403 (auth passed). The actual success status varies by DB/Personio state — Admin may get 200, 404, or 422. Tests should assert `status != 403` for Admin mutations, not assume 200. For Viewer mutations, assert `status == 403` AND body `== {"detail": "admin role required"}`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 403 JSON body | Custom exception handler or middleware | `HTTPException(403, detail="...")` | FastAPI serializes `detail` to `{"detail": "..."}` natively |
| Dep deduplication | Cache in global var | FastAPI's built-in per-request dep cache | Automatic — same dep instance reused within a request scope |
| Role checking in every handler | if/else in handler bodies | `Depends(require_admin)` in route decorator | Centralized, greppable, can't be accidentally skipped |

---

## Common Pitfalls

### Pitfall 1: Wrong path strings in test matrix
**What goes wrong:** Test uses `/api/uploads` for the upload POST but the actual path is `/api/upload` (singular, no `s`).
**Why it happens:** The `uploads.py` router has prefix `/api` (not `/api/uploads`). The upload endpoint is `@router.post("/upload")` → `/api/upload`. The list endpoint is `@router.get("/uploads")` → `/api/uploads`.
**How to avoid:** Use the route inventory table above. Double-check with `grep -r "@router\." backend/app/routers/`.

### Pitfall 2: Roadmap path discrepancies
**What goes wrong:** Plan says "POST /api/sync/personio" but actual path is "POST /api/sync".
**Why it happens:** The sync router prefix is `/api/sync` and the handler is `@router.post("")`.
**How to avoid:** Use the inventory table — it is derived from the actual source code, not the roadmap descriptions.

### Pitfall 3: Forgetting POST /api/sync/test and POST /api/settings/logo
**What goes wrong:** Only the 4 routes from the roadmap D-06 list are gated; 2 additional mutations are left open to Viewer.
**Why it happens:** The roadmap list was an approximation; the researcher confirmed 8 mutation routes.
**How to avoid:** Gate ALL 8 routes identified in the inventory table.

### Pitfall 4: require_admin in wrong module
**What goes wrong:** `require_admin` is placed in a new `authz.py` file, causing import confusion or circular imports.
**Why it happens:** Over-engineering a simple dep.
**How to avoid:** Add directly to `directus_auth.py` per D-02. It uses `CurrentUser`, `Role`, `HTTPException`, and `Depends(get_current_user)` — all already imported in that file.

### Pitfall 5: Test expects 200 for Admin on mutation routes
**What goes wrong:** Test assertions fail because `POST /api/sync` returns 422 (no Personio creds) even for Admin.
**Why it happens:** Auth passes but business logic validation fires (missing body, no DB creds).
**How to avoid:** For Admin mutation routes, assert `status_code != 403` not `status_code == 200`. Auth enforcement is the only thing Phase 28 adds.

### Pitfall 6: GET /api/settings/logo returns 404 for both roles (no logo set)
**What goes wrong:** Test sees 404 for Viewer and fails thinking auth blocked it.
**Why it happens:** No logo is seeded in the test DB.
**How to avoid:** For logo GET, assert `status_code != 401 and status_code != 403` for authenticated users (any 4xx/5xx from business logic is acceptable).

---

## Existing Test Infrastructure

**File:** `backend/tests/test_directus_auth.py`
**Pattern:** `_mint(role_uuid, *, secret, exp_minutes, user_id, extra)` helper mints JWTs. `app` fixture creates a mini FastAPI with a `/protected` route. Integration tests use `app.main.app` directly with `AsyncClient(transport=ASGITransport(...))`.

**Key reusable pieces for Phase 28:**
- `_mint()` function — import or copy to `test_rbac.py`
- `ADMIN_UUID`, `VIEWER_UUID`, `DIRECTUS_SECRET` env var reads
- `AsyncClient + ASGITransport` pattern for hitting real app routes

**Decision:** Create new `backend/tests/test_rbac.py` rather than appending to `test_directus_auth.py`. The existing file tests auth (401 cases); the new file tests RBAC (403 cases). Separation keeps concerns clear and file size manageable.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (existing) |
| Config file | Check for pytest.ini or pyproject.toml — use existing config |
| Quick run command | `pytest backend/tests/test_rbac.py -x` |
| Full suite command | `pytest backend/tests/ -x` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RBAC-01 | GET routes return 200 for both Viewer and Admin | integration | `pytest backend/tests/test_rbac.py -k "GET" -x` | No — Wave 0 |
| RBAC-02 | Mutation routes return 403 for Viewer with correct body | integration | `pytest backend/tests/test_rbac.py -k "403" -x` | No — Wave 0 |
| RBAC-04 | Role change takes effect on next JWT refresh | manual-only | N/A — requires live Directus, role promotion via UI, new JWT issuance | N/A |
| RBAC-05 | `docs/api.md` exists with correct matrix | manual review / file check | `test -f docs/api.md` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `pytest backend/tests/test_rbac.py -x`
- **Per wave merge:** `pytest backend/tests/ -x`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/test_rbac.py` — covers RBAC-01 and RBAC-02 with full parametrized matrix
- [ ] `docs/api.md` — covers RBAC-05 (file must be created)

---

## Environment Availability

Step 2.6: No new external dependencies. Phase 28 is purely code changes (adding a dep function + decorators) plus a test file and a documentation file. All required tools (Python, pytest, FastAPI) are already in place from Phase 27.

---

## Open Questions

1. **GET /api/settings/personio-options — should it be Admin-only?**
   - What we know: It calls the Personio API live (external network call) but makes no state changes. Returns degraded response on failure. It is used by the settings panel to populate dropdowns.
   - What's unclear: Whether a Viewer ever needs to see Personio options (they cannot save settings, but could see what's configured).
   - Recommendation: Classify as READ / Viewer-accessible. Personio options are configuration metadata, not sensitive. Consistent with treating all GETs as open.

2. **Test for RBAC-04 (role promotion)**
   - What we know: Stateless JWT — backend needs no code. The test is "mint a new JWT with Admin UUID; it passes Admin routes."
   - What's unclear: Whether the planner wants an explicit test case for "token with promoted role passes" vs. trusting the parametrized matrix.
   - Recommendation: Add one explicit test: `test_viewer_token_on_mutation_returns_403` and `test_admin_token_on_mutation_returns_not_403`. The matrix covers this implicitly.

---

## Sources

### Primary (HIGH confidence)

- Direct source code read: `backend/app/routers/data.py`, `hr_kpis.py`, `kpis.py`, `settings.py`, `sync.py`, `uploads.py` — route inventory derived from actual `@router.METHOD(path)` decorators
- Direct source code read: `backend/app/security/directus_auth.py` — current implementation, insertion point for `require_admin`
- Direct source code read: `backend/tests/test_directus_auth.py` — existing patterns to match
- Phase 28 CONTEXT.md — locked decisions D-01 through D-06
- Phase 27 CONTEXT.md and 27-02-SUMMARY.md — foundation deps already wired

### Secondary (MEDIUM confidence)

- FastAPI documentation pattern: `dependencies=[Depends(...)]` in route decorators is the standard FastAPI RBAC pattern; widely documented and used in official FastAPI examples.
- FastAPI dep deduplication: within a single request, the same dependency callable is executed once and cached — this is core FastAPI behavior, not a workaround.

---

## Metadata

**Confidence breakdown:**
- Route inventory: HIGH — derived directly from source code, not from roadmap descriptions
- `require_admin` implementation: HIGH — mirrors existing `get_current_user` pattern in same file; FastAPI dep injection is well-understood
- Test strategy: HIGH — extends existing `_mint()` + AsyncClient pattern from Phase 27
- Pitfalls: HIGH — discovered by diffing roadmap claims vs. actual source code

**Research date:** 2026-04-15
**Valid until:** indefinite — derived from source code, not from external APIs or docs
