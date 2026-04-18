# Phase 28: KPI Light OIDC Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 28-kpi-light-oidc-integration
**Areas discussed:** Session storage & TTL, Logout UX, DISABLE_AUTH synthetic user identity, Frontend auth gating & loading UX

---

## Gray-Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Session storage & TTL | Signed cookie vs server-side; cookie lifetime; sliding vs absolute | ✓ |
| Logout UX (no RP-initiated logout) | Local vs explicit warning vs logged-out page | ✓ |
| DISABLE_AUTH synthetic user identity | What sub/email/name; env-config; upsert behavior | ✓ |
| Frontend auth gating & loading UX | ProtectedRoute scope; loading state; 401 behavior | ✓ |

**User's choice:** All four areas selected.

---

## Session Cookie Implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Starlette SessionMiddleware | itsdangerous-signed JSON cookie; single SESSION_SECRET; zero extra deps | ✓ |
| authlib custom cookie | Hand-crafted itsdangerous serialization; marginal control gain | |
| Server-side session store (DB/Redis) | Opaque session_id cookie; session table; overkill at 5–10 users | |

**User's choice:** Starlette SessionMiddleware (Recommended)
**Notes:** Fits the `{sub, email, name}` payload size with no extra dependencies. → CONTEXT.md D-01.

---

## Session TTL + Sliding Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| 8h absolute, no sliding | Work-day duration; seamless Dex SSO re-auth; no renewal logic | ✓ |
| 30 days absolute, no sliding | Matches Dex idle-refresh feel; monthly re-login | |
| 1h sliding | Short baseline; extends on activity; more moving parts | |
| 24h sliding, capped at 30d | Extend on activity with hard cap; more logic | |

**User's choice:** 8h absolute, no sliding (Recommended)
**Notes:** Dex SSO makes re-login seamless (no password prompt) within its 1h access-token window. → CONTEXT.md D-02.

---

## Logout Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Local logout only, accept Dex SSO gap | Clear our cookie, redirect to /. Re-login within Dex window is silent. | ✓ |
| Local logout + explicit UI warning | Toast/banner after logout explaining Dex-SSO persistence | |
| Local logout + static "logged out" page | Break auto-redirect loop with a deliberate "Sign in" button | |

**User's choice:** Local logout only, accept the gap (Recommended)
**Notes:** Internal tool, single-tenant — acceptable UX. → CONTEXT.md D-08, D-09.

---

## Logout HTTP Response

| Option | Description | Selected |
|--------|-------------|----------|
| 303 redirect to / | Matches KPO-09's POST-form wording; browser follows redirect; simplest | ✓ |
| 200 JSON + frontend window.location | Explicit frontend handling; room for toasts/analytics | |

**User's choice:** 303 redirect (Recommended)
**Notes:** → CONTEXT.md D-08.

---

## DISABLE_AUTH Synthetic User Identity

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded sub=dev-user, email=dev@localhost, name=Dev User | Single fixed identity; predictable in tests/screenshots | ✓ |
| Env-configurable DEV_USER_EMAIL/NAME | Hardcoded defaults + optional overrides | |
| Hardcoded matching Phase 27 seeded admin | Reuse admin@acm.local identity; downside: dev activity looks like real admin | |

**User's choice:** Hardcoded sub=dev-user, email=dev@localhost, name=Dev User (Recommended)
**Notes:** Minimal surface area; prod misconfiguration impossible. → CONTEXT.md D-13.

---

## DISABLE_AUTH app_users Upsert

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, upsert like a real user | Identical code path; last_seen_at works in dev; filter out dev-user by sub | ✓ |
| No, skip DB write in bypass mode | Cleaner production table; adds a conditional to the auth path | |

**User's choice:** Yes, upsert like a real user (Recommended)
**Notes:** → CONTEXT.md D-14 (upsert at app startup, not per-request).

---

## ProtectedRoute Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap whole <Switch> once in App.tsx | All pages gated by default; mirrors backend "all routes require auth" | ✓ |
| Per-route wrapper on each <Route> | More boilerplate; allows future public routes (none planned) | |

**User's choice:** Wrap the whole <Switch> once in App.tsx (Recommended)
**Notes:** → CONTEXT.md D-19.

---

## Initial /api/auth/me Probe UX

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen splash (logo + spinner) | Reuses Phase 22 pre-hydration splash tokens; no white flash | ✓ |
| Blank/white screen until resolved | Minimum code; ~200ms blank on reload; clashes with v1.9 splash discipline | |
| NavBar renders immediately, body spinner | App shell visible; NavBar name-slot jitter on populate | |

**User's choice:** Brief full-screen splash: logo + spinner (Recommended)
**Notes:** Matches splash-flash-free discipline from v1.9. → CONTEXT.md D-20.

---

## 401 Behavior on /api/auth/me

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-redirect to /api/auth/login | Matches KPO-08 literal wording; zero intermediate UI | ✓ |
| Show "Sign in with Dex" button first | Deliberate click; better for external exposure; friction for daily use | |

**User's choice:** Auto-redirect via window.location.href (Recommended)
**Notes:** Internal tool; seamless flow preferred. → CONTEXT.md D-21.

---

## Claude's Discretion

- Error-page markup on callback failures (state mismatch, Dex unreachable)
- 404 vs 503 response for `/api/auth/*` endpoints when `DISABLE_AUTH=true`
- Splash-screen visual specifics (logo size, spinner style) — follow Phase 22 tokens
- Location of `app_users` upsert logic (callback handler, service module, or ORM event)
- Whether `get_current_user` returns a dict or a Pydantic model

## Deferred Ideas

- Role-based access control (RBAC via Dex `groups` scope) — v2
- Account soft-delete / deactivation UI — v2
- Audit log of login events — future scope
- Avatar / profile picture in NavBar — polish phase
- Sliding session renewal — revisit if team complains
- Server-side session store (Redis/DB) — revisit if revocation becomes a requirement
