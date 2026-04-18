---
phase: 28-kpi-light-oidc-integration
verified: 2026-04-15T00:00:00Z
status: human_needed
score: 6/6 must-haves verified
human_verification:
  - test: "Unauthenticated browser visit redirects to Dex and login returns to dashboard with user name in NavBar"
    expected: "Visiting https://kpi.internal while logged out 303-redirects to Dex, completing login lands on / with user's display name visible in NavBar"
    why_human: "End-to-end browser flow against live Dex — requires real OIDC round-trip, cookie storage, and visual confirmation"
  - test: "Session persists across page refresh; logout clears session and returns to unauthenticated state"
    expected: "After login, browser refresh still shows authenticated UI; clicking Logout (POST form) clears kpi_session cookie and triggers re-auth on next visit"
    why_human: "Requires real browser cookie jar behavior + visual confirmation of logged-out state (Dex SSO ~1h persistence noted in runbook)"
  - test: "DISABLE_AUTH=true boots app without Dex, shows synthetic dev user in NavBar, emits startup warning"
    expected: "With DISABLE_AUTH=true: docker compose logs show ⚠ warning; /api/auth/me returns {sub:dev-user,...}; NavBar shows Dev User; /api/auth/login returns 503"
    why_human: "Requires stack restart with env change + log inspection + visual confirmation"
  - test: "All six business routers return 401 without session cookie"
    expected: "curl without cookie to /api/settings, /api/uploads, /api/kpis, /api/hr/*, /api/sync, /api/data/* returns 401 each"
    why_human: "Static code verifies guards are wired (dependencies=[Depends(get_current_user)] on all 6 routers). Actual 401 response requires running backend — trivially verifiable at runtime"
  - test: "app_users row upserted on Dex callback with fresh last_seen_at"
    expected: "After login, SELECT * FROM app_users WHERE sub=... shows email/name/last_seen_at matching IdP claims; second login bumps last_seen_at"
    why_human: "Requires live DB + OIDC flow completion"
---

# Phase 28: KPI Light OIDC Integration — Verification Report

**Phase Goal:** All KPI Light API routes require an authenticated session obtained through Dex, with a working dev bypass toggle and user identity persisted in the database.
**Verified:** 2026-04-15
**Status:** human_needed (all automated checks pass; browser/live-stack UAT outstanding)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Unauth visit → Dex login → dashboard with user name | ✓ VERIFIED (code) / ? UNCERTAIN (live UAT) | `ProtectedRoute.tsx` redirects to `/api/auth/login` on 401; `/api/auth/login` calls `oauth.dex.authorize_redirect` (auth.py:28); callback writes session and 303-redirects to `/` (auth.py:52); NavBar `UserChunk` renders `user.name ?? user.email` (NavBar.tsx:126-146) |
| 2 | Refresh preserves session; logout clears it | ✓ VERIFIED (code) / ? UNCERTAIN (live UAT) | `useCurrentUser` has `staleTime=Infinity` (useCurrentUser.ts:19); SessionMiddleware configured with `max_age=28800, same_site='lax', https_only=True` (main.py:20-27); `POST /api/auth/logout` clears session + deletes cookie (auth.py:61-68); NavBar uses native `<form method="POST" action="/api/auth/logout">` (NavBar.tsx:136) |
| 3 | `/api/auth/me` returns identity for authed user, 401 otherwise | ✓ VERIFIED | `auth.py:55-58` uses `Depends(get_current_user)`; `get_current_user` raises `HTTPException(401)` when session empty (security/auth.py:44-49) |
| 4 | All existing API routes return 401 without session | ✓ VERIFIED | `dependencies=[Depends(get_current_user)]` present on all 6 routers: uploads.py:16, kpis.py:26, settings.py:26, sync.py:25, hr_kpis.py:29, data.py:16 |
| 5 | `DISABLE_AUTH=true` bypass with warning + dev-user | ✓ VERIFIED | `scheduler.py:48-57` emits `⚠ DISABLE_AUTH=true — authentication is bypassed` warning and upserts dev-user at lifespan startup; `_bypass_guard()` returns 503 from login/callback/logout (auth.py:15-21); `get_current_user` short-circuits to `SYNTHETIC_USER` (security/auth.py:44-45) |
| 6 | `app_users` upserted on every successful callback | ✓ VERIFIED | `upsert_user` uses `insert().on_conflict_do_update` on sub unique index, refreshing email/name/last_seen_at (services/users.py:18-28); called from callback (auth.py:49) |

**Score:** 6/6 truths verified at code level; 5 require live-stack human UAT for full confirmation.

### Required Artifacts (across 5 plans)

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `backend/app/config.py` | ✓ VERIFIED | Pydantic Settings with DEX_ISSUER, DEX_CLIENT_ID, DEX_CLIENT_SECRET (via validation_alias=DEX_KPI_SECRET), DEX_REDIRECT_URI, SESSION_SECRET, DISABLE_AUTH |
| `backend/app/security/auth.py` | ✓ VERIFIED | authlib `OAuth()` singleton with Dex `server_metadata_url`, PKCE S256, `SYNTHETIC_USER`, `get_current_user` dep (50 LOC, substantive) |
| `backend/app/services/users.py` | ✓ VERIFIED | Atomic `ON CONFLICT (sub) DO UPDATE` upsert using postgres dialect |
| `backend/alembic/versions/v1_11_app_users.py` | ✓ VERIFIED | Table with id PK, sub NOT NULL + UNIQUE, email NOT NULL, name NULLABLE, created_at/last_seen_at server_default=now() |
| `backend/app/models.py::AppUser` | ✓ VERIFIED | SQLAlchemy model at line 240, columns match migration |
| `backend/app/schemas.py::CurrentUser` | ✓ VERIFIED | Pydantic model at line 273 |
| `backend/app/routers/auth.py` | ✓ VERIFIED | login/callback/me/logout, 69 LOC, includes `_bypass_guard` for DISABLE_AUTH |
| `backend/app/scheduler.py` (lifespan) | ✓ VERIFIED | Warning + dev-user upsert on DISABLE_AUTH=true (lines 48-57) |
| 6 business routers guarded | ✓ VERIFIED | All 6 have `dependencies=[Depends(get_current_user)]` |
| `frontend/src/hooks/useCurrentUser.ts` | ✓ VERIFIED | retry=false, staleTime=Infinity, gcTime=Infinity, 401 throw |
| `frontend/src/components/AuthSplash.tsx` | ✓ VERIFIED | Full-screen splash reusing --splash-bg/--splash-dot tokens |
| `frontend/src/components/ProtectedRoute.tsx` | ✓ VERIFIED | useEffect on isError → `window.location.href = '/api/auth/login'`; renders AuthSplash on pending/error |
| `frontend/src/components/NavBar.tsx` | ✓ VERIFIED | UserChunk renders `user.name ?? user.email`; native POST form to `/api/auth/logout` |
| `frontend/src/App.tsx` | ✓ VERIFIED | `<ProtectedRoute>` wraps NavBar + SubHeader + Switch |
| `docs/setup.md` | ✓ VERIFIED | "Phase 28 — KPI Light login via Dex" section (line 441+), DISABLE_AUTH section (line 488+), six guarded routers listed (line 519+), SSO persistence note documented |

### Key Link Verification

| From | To | Status | Details |
| ---- | -- | ------ | ------- |
| main.py | SessionMiddleware | ✓ WIRED | `app.add_middleware(SessionMiddleware, secret_key=settings.SESSION_SECRET, session_cookie="kpi_session", max_age=60*60*8, same_site="lax", https_only=True)` at main.py:20-27 |
| security/auth.py | Dex discovery | ✓ WIRED | `server_metadata_url=f"{settings.DEX_ISSUER}/.well-known/openid-configuration"` at auth.py:23 |
| routers/auth.py | oauth.dex | ✓ WIRED | `oauth.dex.authorize_redirect` (line 28), `oauth.dex.authorize_access_token` (line 37) |
| routers/auth.py | upsert_user | ✓ WIRED | `await upsert_user(db, sub=sub, email=email, name=name)` at line 49 |
| main.py | auth_router | ✓ WIRED | `app.include_router(auth_router)` at main.py:29 |
| All 6 routers | get_current_user | ✓ WIRED | `dependencies=[Depends(get_current_user)]` on each APIRouter() |
| ProtectedRoute | /api/auth/login | ✓ WIRED | `window.location.href = "/api/auth/login"` on isError |
| NavBar | /api/auth/logout | ✓ WIRED | `<form method="POST" action="/api/auth/logout">` |
| App.tsx | ProtectedRoute | ✓ WIRED | Wraps NavBar + SubHeader + Switch (App.tsx:22-33) |
| docs/setup.md | .env.example | ✓ WIRED | References SESSION_SECRET + DISABLE_AUTH by name |

Note: gsd-tools `verify key-links` reported several links as unverified due to double-escaped regex patterns in plan frontmatter (e.g. `add_middleware\\(SessionMiddleware`). Manual grep confirms all patterns are present in the target files.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Real Data | Status |
| -------- | ------------- | ------ | --------- | ------ |
| NavBar UserChunk | `user` | `useCurrentUser()` → GET /api/auth/me → `get_current_user` reading request.session | Yes — populated by `request.session['user']` written in callback from Dex id_token claims (auth.py:43-51) or SYNTHETIC_USER when DISABLE_AUTH=true | ✓ FLOWING |
| ProtectedRoute | `user, isPending, isError` | Same as above | Yes | ✓ FLOWING |
| /api/auth/me response | `CurrentUser` | session cookie → Pydantic model | Yes | ✓ FLOWING |
| app_users table | `sub,email,name,last_seen_at` | `upsert_user` called from `/api/auth/callback` on every successful login AND from lifespan when DISABLE_AUTH=true | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

Skipped. Phase delivers auth-gating and identity persistence; runtime verification requires a running docker compose stack with Dex (covered by human UAT items above). No isolated behaviors can be checked without the stack.

### Requirements Coverage

| Req | Plan | Description | Status | Evidence |
| --- | ---- | ----------- | ------ | -------- |
| KPO-01 | 28-01 | authlib registers Dex via `server_metadata_url` | ✓ SATISFIED | security/auth.py:21-30 |
| KPO-02 | 28-02 | /api/auth/login → Dex; callback completes code+PKCE; httpOnly/SameSite=Lax/Secure session cookie with {sub,email,name} only (no raw tokens) | ✓ SATISFIED | auth.py:24-52; SessionMiddleware set https_only=True, same_site=lax; session payload explicitly `{sub,email,name}` only (auth.py:51) |
| KPO-03 | 28-02 | /api/auth/me returns {sub,email,name} or 401 | ✓ SATISFIED | auth.py:55-58 + security/auth.py:44-49 |
| KPO-04 | 28-02 | /api/auth/logout clears session + redirect to / | ✓ SATISFIED | auth.py:61-68 |
| KPO-05 | 28-02 | DISABLE_AUTH=true bypass with startup warning | ✓ SATISFIED | scheduler.py:48-57 + auth.py:15-21 |
| KPO-06 | 28-01 | app_users (SA model + migration) upserted by sub on every callback | ✓ SATISFIED | models.py:240-, v1_11_app_users.py, services/users.py |
| KPO-07 | 28-03 | All existing API routes require Depends(get_current_user) or 401 | ✓ SATISFIED | 6 routers verified with router-level dependency |
| KPO-08 | 28-04 | useCurrentUser TanStack Query hook + ProtectedRoute redirects to /api/auth/login via window.location.href | ✓ SATISFIED | useCurrentUser.ts + ProtectedRoute.tsx:18 |
| KPO-09 | 28-04 | NavBar user name (or email fallback) + POST-form logout | ✓ SATISFIED | NavBar.tsx:126-146 |
| E2E-02 | 28-05 | Human UAT: login→refresh→logout via Dex | ? NEEDS HUMAN | Runbook section present in docs/setup.md:441+ |
| E2E-06 | 28-05 | Human UAT: DISABLE_AUTH=true local dev flow | ? NEEDS HUMAN | Runbook section present in docs/setup.md:488+ |

All 11 plan-declared requirement IDs accounted for. REQUIREMENTS.md already marks all 11 as Complete; no orphans.

### Anti-Patterns Found

No blocker or warning anti-patterns found in phase-touched files. Code is substantive with clear docstrings and decision-log anchors (D-01..D-23). `_bypass_guard` uses 503 intentionally for DISABLE_AUTH (documented).

### Human Verification Required

See frontmatter `human_verification` block. Five live-stack UAT checks needed to close Success Criteria #1, #2, #5, #6 and the 401 runtime behavior for Success Criterion #4. All code wiring is verified; these are end-to-end browser/OIDC/DB flows that cannot be verified without a running stack.

### Gaps Summary

No code-level gaps. All must-haves are implemented, wired, and substantive. Phase 28 delivers the complete auth surface:

- Backend foundation (SessionMiddleware, authlib Dex client, app_users model+migration, upsert service, get_current_user dependency)
- Four /api/auth/* endpoints with DISABLE_AUTH bypass behavior
- All 6 business routers guarded at router level
- Frontend useCurrentUser hook, AuthSplash, ProtectedRoute, NavBar user display + native POST logout form
- docs/setup.md runbook with SESSION_SECRET generation, first-login walkthrough, DISABLE_AUTH flow, SSO persistence note, guarded-router list

Remaining work is human UAT only (E2E-02, E2E-06) which is expected for a phase touching live OIDC.

---

_Verified: 2026-04-15_
_Verifier: Claude (gsd-verifier)_
