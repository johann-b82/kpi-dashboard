---
phase: 28
phase_name: rbac-enforcement-on-all-routes
milestone: v1.11-directus
status: ready-for-plan
created: 2026-04-15
---

# Phase 28 Context — RBAC Enforcement on All Routes

**Goal:** Every FastAPI read route is open to both roles; every mutation route requires `role == Role.ADMIN`, returning 403 with `{"detail": "admin role required"}` to Viewer users. Directus role changes take effect on the user's next JWT refresh.

**Requirements:** RBAC-01, RBAC-02, RBAC-04, RBAC-05

## Locked decisions (from prior phases / roadmap)

- **Role enum** — `Role.ADMIN` / `Role.VIEWER` (Phase 27 D-02), imported from `backend/app/security/roles.py`.
- **`current_user` dep** — `get_current_user` already wired as router-level dep on all 6 `/api/*` routers (Phase 27 D-05). Phase 28 builds on this.
- **403 body shape** — Exactly `{"detail": "admin role required"}` (roadmap Success Criterion 2).
- **JWT refresh propagation** — Directus role changes take effect on next token refresh automatically — stateless JWT, no server-side session to invalidate. No code work needed beyond honoring the role claim.

## Phase-28-specific decisions (locked via `/gsd:discuss-phase 28`)

### D-01 — Enforcement: per-route `Depends(require_admin)`

Each mutation endpoint (POST/PUT/DELETE under `/api/*`) individually declares:

```python
from app.security.directus_auth import require_admin

@router.post("/uploads/...", dependencies=[Depends(require_admin)])
async def upload(...):
    ...
```

**Why:** Explicit, greppable, each route declares its own policy. Matches FastAPI idioms and keeps the `Depends(get_current_user)` already at router level (so `current_user` is still resolved for all routes). Rejected:
- Splitting into separate admin/read routers — churns existing file structure.
- HTTP-method middleware — couples policy to verbs; future routes that need exceptions would become awkward.

### D-02 — `require_admin` dep implementation

Add to `backend/app/security/directus_auth.py` (same module as `get_current_user`):

```python
def require_admin(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if current_user.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin role required",
        )
    return current_user
```

Matches Phase 27's 401 pattern (single-line HTTPException raise, constant detail string). The returned `CurrentUser` is available to handlers that want it via `Depends(require_admin)` as a parameter (FastAPI dedupes with the router-level `get_current_user`).

### D-03 — 403 body

Use FastAPI's built-in `HTTPException(403, detail="admin role required")`. Response body will be exactly `{"detail": "admin role required"}` — matches roadmap success criterion and Phase 27's 401 style. No custom exception handler.

### D-04 — Documentation: `docs/api.md` route matrix

Create or update `docs/api.md` with a single markdown table listing every `/api/*` route:

| Method | Path | Viewer | Admin |
|--------|------|--------|-------|
| GET    | /api/kpis | ✓ | ✓ |
| POST   | /api/uploads/personio | — | ✓ |
| …      | … | … | … |

Single source of truth, reviewable in PRs. OpenAPI `/docs` remains auto-generated but is not the canonical matrix.

### D-05 — Test strategy: parametrized matrix test

Extend `backend/tests/test_directus_auth.py` (or new `test_rbac.py`) with a parametrized pytest table:

```python
@pytest.mark.parametrize("method,path,role,expected_status", [
    ("GET",    "/api/kpis",              "viewer", 200),
    ("GET",    "/api/kpis",              "admin",  200),
    ("POST",   "/api/uploads/personio",  "viewer", 403),
    ("POST",   "/api/uploads/personio",  "admin",  200),
    # ... full matrix
])
def test_rbac(method, path, role, expected_status, client, mint_token): ...
```

Tests assert status codes AND, for 403 cases, that body equals `{"detail": "admin role required"}`.

### D-06 — Mutation route inventory (to be confirmed by researcher against live code)

From roadmap, expected mutation routes requiring Admin:
- `POST /api/uploads/*`
- `POST /api/sync/personio`
- `PUT  /api/settings`
- `DELETE /api/data/*`

Read routes (Viewer + Admin) confirmed open:
- `GET /api/kpis`
- `GET /api/hr/kpis`
- `GET /api/data/*`
- `GET /api/settings`

Researcher MUST scout each router file and produce the exhaustive inventory; if any additional write verbs (PATCH, additional POSTs) exist, they default to Admin-only unless explicitly justified.

### Claude's Discretion

- Exact file organization of the `require_admin` dep (same module as `get_current_user`, vs new `authz.py`) — Claude picks simplest.
- Whether the matrix table in `docs/api.md` includes descriptions per route or just method/path/roles.
- Whether route handlers that need to READ the `current_user` object add it as a parameter — on a per-route basis as needed.

## Deferred Ideas

- **Role hierarchy / additional roles** — out of scope; only ADMIN and VIEWER.
- **Per-resource ACLs** — out of scope (e.g., "Viewer A can only see their own uploads").
- **Admin audit log** — potential future phase; not in Phase 28.
- **Refresh token rotation policy** — Directus default honored; no tuning in this phase.

## Scope Guardrail

Phase 28 only enforces RBAC on existing routes. It does NOT:
- Add new routes
- Change frontend behavior (Phase 29+)
- Introduce UI role indicators (deferred)
- Touch Directus roles/permissions definitions (done in Phase 26)
