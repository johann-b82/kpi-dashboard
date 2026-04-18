---
phase: 27-fastapi-directus-auth-dependency
verified: 2026-04-15T00:00:00Z
status: passed
score: 8/8 must-haves verified
---

# Phase 27: FastAPI Directus Auth Dependency Verification Report

**Phase Goal:** FastAPI verifies Directus-issued JWTs (HS256 shared secret), resolves a `current_user` with role, and rejects unauthenticated or expired tokens with 401 — the server-side auth backbone without yet gating on role.
**Verified:** 2026-04-15
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A pyjwt-minted HS256 token with a known role UUID resolves to a CurrentUser with Role.ADMIN or Role.VIEWER | VERIFIED | `test_valid_admin_token_resolves_admin` + `test_valid_viewer_token_resolves_viewer` both pass |
| 2 | An expired token raises 401 with detail "invalid or missing authentication token" | VERIFIED | `test_expired_token_returns_401` passes |
| 3 | A wrong-signature token raises 401 with same detail | VERIFIED | `test_wrong_signature_returns_401` passes |
| 4 | A malformed or missing bearer raises 401 with same detail | VERIFIED | `test_malformed_bearer_returns_401` + `test_missing_authorization_returns_401` pass |
| 5 | backend/app/config.py raises a clear error when DIRECTUS_SECRET is unset | VERIFIED | `Field(...)` with no default causes Pydantic ValidationError on import |
| 6 | Every /api/* route returns 401 without a valid bearer | VERIFIED | `test_real_api_route_requires_bearer` passes; all 6 routers have `dependencies=[Depends(get_current_user)]` |
| 7 | Every /api/* route returns 200 (or non-401) with a valid bearer | VERIFIED | `test_real_api_route_accepts_valid_bearer` passes |
| 8 | /health remains unauthenticated | VERIFIED | `test_real_health_endpoint_no_auth` + `test_health_endpoint_no_auth_needed` pass |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/config.py` | Pydantic BaseSettings with DIRECTUS_SECRET, role UUIDs | VERIFIED | Contains `class Settings(BaseSettings)` with all three fields, Field(...) enforces required |
| `backend/app/security/roles.py` | Role StrEnum with ADMIN and VIEWER | VERIFIED | `class Role(StrEnum)` with ADMIN="admin", VIEWER="viewer" |
| `backend/app/security/directus_auth.py` | get_current_user FastAPI dependency | VERIFIED | `async def get_current_user`, `HTTPBearer(auto_error=False)`, `algorithms=["HS256"]`, `except jwt.PyJWTError`, single 401 detail string |
| `backend/app/schemas.py` | CurrentUser BaseModel with id, email, role | VERIFIED | `class CurrentUser(BaseModel)` with UUID id, EmailStr email, Role role |
| `backend/tests/test_directus_auth.py` | 11 tests (8 unit + 3 e2e), min 120 lines | VERIFIED | 141 lines, 11 tests, all pass |
| `.env.example` | Documents DIRECTUS_SECRET, admin/viewer UUID vars | VERIFIED | Contains DIRECTUS_ADMINISTRATOR_ROLE_UUID and DIRECTUS_VIEWER_ROLE_UUID with generation commands |
| `backend/app/routers/*.py` (6 files) | APIRouter with dependencies=[Depends(get_current_user)] | VERIFIED | All 6 routers: kpis, data, hr_kpis, settings, sync, uploads |
| `backend/requirements.txt` | pyjwt==2.10.1, pydantic-settings==2.9.1, email-validator==2.2.0 | VERIFIED | All three lines present with exact pinned versions |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/app/security/directus_auth.py` | `backend/app/config.py` | `settings.DIRECTUS_SECRET` + role UUID map | VERIFIED | `from app.config import settings`; all three settings fields used in `_role_map()` and `jwt.decode()` |
| `backend/app/security/directus_auth.py` | `backend/app/security/roles.py` | `from app.security.roles import Role` | VERIFIED | Import present, Role.ADMIN/VIEWER used in `_role_map()` return |
| `backend/app/routers/*.py` (6 files) | `backend/app/security/directus_auth.py` | `dependencies=[Depends(get_current_user)]` in APIRouter constructor | VERIFIED | grep confirms pattern in all 6 router files |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces a security dependency/middleware component, not a data-rendering artifact.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 8 unit tests covering all JWT failure modes | `docker compose run --rm api python -m pytest tests/test_directus_auth.py -v` | 11 passed in 0.23s | PASS |
| E2E: /api/kpis returns 401 without bearer | Covered by `test_real_api_route_requires_bearer` | PASSED | PASS |
| E2E: /api/kpis returns non-401 with valid bearer | Covered by `test_real_api_route_accepts_valid_bearer` | PASSED | PASS |
| E2E: /health returns 200 without bearer | Covered by `test_real_health_endpoint_no_auth` | PASSED | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| AUTH-01 | 27-01 | Directus JWT round-trip verification (token minting → resolve) | SATISFIED | `test_valid_admin_token_resolves_admin` mints a Directus-shaped HS256 token and verifies it resolves to CurrentUser with Role.ADMIN |
| AUTH-04 | 27-02 | FastAPI validates every /api/* request; rejects expired/invalid with 401 | SATISFIED | All 6 routers gated; `test_real_api_route_requires_bearer` + 4 failure-mode unit tests prove 401 on invalid tokens |
| AUTH-05 | 27-01 | `current_user` dependency resolves {id, email, role} from verified JWT | SATISFIED | `get_current_user` in `backend/app/security/directus_auth.py` returns `CurrentUser(id, email, role)` with role as Role enum; importable and wired to all routers |

All three requirement IDs from plan frontmatter are satisfied. No orphaned requirements for this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/security/directus_auth.py` | 56-57 | TODO: fetch real email from Directus GET /users/{id} | Info | Email is a deterministic placeholder (`{id}@directus.example.com`). Intentional per plan design; deferred to Phase 28+. Does not affect auth gate functionality. |

No blockers or warnings. The TODO is intentional, documented in the plan, and does not affect goal achievement.

### Human Verification Required

None. All claims are verifiable programmatically, and the test suite ran successfully in the Docker environment.

### Gaps Summary

No gaps. All must-haves from both plans (27-01 and 27-02) are present, substantive, wired, and functionally verified by 11 passing tests.

---

_Verified: 2026-04-15_
_Verifier: Claude (gsd-verifier)_
