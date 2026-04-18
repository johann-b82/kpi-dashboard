# Phase 28: KPI Light OIDC Integration - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

KPI Light (FastAPI backend + React frontend) is gated behind Dex login. The Phase 27 Dex instance at `https://auth.internal/dex` is now the single identity source for KPI Light: users authenticate via authorization-code + PKCE, backend routes enforce auth via a FastAPI dependency, frontend gates all pages via a `<ProtectedRoute>` wrapper, and user identity is persisted in a new `app_users` table. A `DISABLE_AUTH=true` escape hatch lets developers run the stack without Dex for pure UI iteration.

**In scope:**
- `authlib` OIDC client registration (KPO-01)
- `/api/auth/login`, `/api/auth/callback`, `/api/auth/me`, `/api/auth/logout` endpoints (KPO-02, KPO-03, KPO-04)
- Session cookie mechanics (httpOnly, SameSite=Lax, Secure, `{sub,email,name}` payload — no raw tokens)
- `app_users` SQLAlchemy model + Alembic migration + upsert-by-sub on callback (KPO-06)
- `Depends(get_current_user)` guard applied to every existing router (KPO-07)
- `DISABLE_AUTH=true` bypass + synthetic user + startup warning (KPO-05)
- `useCurrentUser()` hook + `<ProtectedRoute>` + NavBar user display + logout form (KPO-08, KPO-09)

**Out of scope (deferred):**
- Role-based access control (admin vs viewer) — deferred to v2
- Active Directory / LDAP integration — deferred to v2
- Audit log of login events — not requested
- Multi-factor auth — Dex concern, not KPI Light's
- Per-user data scoping (filtering uploads/KPIs by owner) — not requested; v1 team-shared data model
- Account-deactivation UI / soft-delete for `app_users` — no stakeholder need this milestone

</domain>

<decisions>
## Implementation Decisions

### Session Cookie Implementation
- **D-01:** Use **Starlette `SessionMiddleware`** (`starlette.middleware.sessions.SessionMiddleware`) for the signed session cookie. Single `SESSION_SECRET` env var (64 hex chars, generated via `openssl rand -hex 32`, `.env`-only, gitignored). itsdangerous-signed JSON cookie. No extra deps beyond what FastAPI already pulls in. Payload limited to `{sub, email, name}` per KPO-02 — no raw access/refresh tokens ever hit the cookie.
- **D-02:** Cookie lifetime: **8 hours absolute, no sliding expiration**. Work-day duration. User logs in once per morning; silent re-auth via Dex SSO on expiry (no password re-prompt within Dex's 1h access-token + 30d refresh window). Predictable expiry, no per-request renewal logic. Cookie flags: `httpOnly=True, samesite="lax", secure=True, max_age=28800`.
- **D-03:** Cookie name: `kpi_session` (explicit, not default). `path=/` (shared across all routes). No `domain` attribute set — host-only cookie bound to `kpi.internal`.

### OIDC Flow
- **D-04:** `authlib >= 1.6.0` client registered via `server_metadata_url="https://auth.internal/dex/.well-known/openid-configuration"` (KPO-01). Authlib auto-discovers endpoints + JWKS; no hand-wired URLs. PKCE (`code_challenge_method=S256`) enforced by authlib when `client_kwargs={'code_challenge_method': 'S256'}` is set at registration.
- **D-05:** Scopes requested: `openid email profile offline_access` (matches Phase 27 D-26). We request `offline_access` for forward-compatibility with any future refresh-rotation change, but do NOT store the refresh token (per D-01 payload limit).
- **D-06:** `/api/auth/login` stores `state` + PKCE verifier in the session cookie (authlib does this automatically via its OAuth client integration), then 303-redirects to Dex authorization URL.
- **D-07:** `/api/auth/callback` exchanges the authorization code for tokens, validates the ID token signature + issuer + audience via authlib, extracts `{sub, email, name}` from the verified claims, upserts the `app_users` row (see D-11), writes `{sub, email, name}` into the session, and 303-redirects to `/`.

### Logout UX
- **D-08:** **Local logout only.** Dex v2.43.0 has no RP-initiated logout endpoint (prior Phase 27 CONTEXT D-07). `/api/auth/logout` clears the `kpi_session` cookie and returns a **303 redirect to `/`**. Frontend submits a plain HTML POST form to this endpoint (KPO-09 literal wording). The browser follows the redirect; the Dex SSO cookie on `auth.internal` persists for up to ~1h, meaning a re-click of "Log in" within that window silently re-auths without a password prompt. **This gap is accepted** — internal tool, single-tenant, acceptable UX.
- **D-09:** No explicit UI warning about the Dex-SSO persistence — keep it quiet; document in `docs/setup.md` as a known limitation alongside the Phase 27 runbook.

### app_users Table (KPO-06)
- **D-10:** Table shape: `(id SERIAL PK, sub TEXT UNIQUE NOT NULL, email TEXT NOT NULL, name TEXT, created_at TIMESTAMPTZ DEFAULT now(), last_seen_at TIMESTAMPTZ DEFAULT now())`. SQLAlchemy model in `backend/app/models.py` alongside existing ORM models; Alembic migration auto-generated via `alembic revision --autogenerate -m "add app_users"`.
- **D-11:** Upsert pattern on every successful callback: `INSERT ... ON CONFLICT (sub) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, last_seen_at=now()`. Email and name re-sync on every login so a user rename in Dex propagates without manual DB touch.
- **D-12:** `name` field nullable; if Dex returns no `name` claim (email-only user), `name` is null and the NavBar falls back to email per KPO-09.

### DISABLE_AUTH Bypass (KPO-05)
- **D-13:** Synthetic user identity is **hardcoded**: `sub="dev-user"`, `email="dev@localhost"`, `name="Dev User"`. No env-var customization (keeps surface area minimal; prod misconfiguration impossible).
- **D-14:** When `DISABLE_AUTH=true`, `get_current_user` dependency short-circuits and returns the synthetic user **without consulting the session cookie or Dex**. The synthetic user **is** upserted into `app_users` on app startup (not per-request) so the ORM code path stays identical across modes and `last_seen_at` behavior is observable in dev.
- **D-15:** Startup warning: FastAPI `lifespan` hook logs `logger.warning("⚠ DISABLE_AUTH=true — authentication is bypassed. DO NOT use in production.")` once at boot. Visible in `docker compose logs api`.
- **D-16:** `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout` endpoints still exist in bypass mode but return `404` or `503` to make accidental production mis-config obvious. Planner picks between 404 (pretend the routes don't exist) and 503 (explicit "unavailable") — Claude's Discretion.

### Backend Route Protection (KPO-07)
- **D-17:** All existing routers (`uploads`, `kpis`, `settings`, `sync`, `hr_kpis`, `data`) gain `dependencies=[Depends(get_current_user)]` at the APIRouter level — single line per router, no per-endpoint edits.
- **D-18:** Auth-bypassed endpoints: `/health` (liveness probe — must work pre-login), `/api/auth/*` (login/callback/me/logout). `/api/auth/me` returns `401` unauthenticated rather than bouncing to Dex — the frontend uses this 401 to trigger the redirect (KPO-08).

### Frontend Architecture (KPO-08, KPO-09)
- **D-19:** `<ProtectedRoute>` wraps the **entire `<Switch>`** once in `App.tsx` (around NavBar + SubHeader + `<main>`). Every page is gated by default. Matches "internal tool, all routes protected" intent.
- **D-20:** During the initial `/api/auth/me` probe (TanStack Query loading), show a **full-screen splash**: centered brand logo + spinner, same CSS-variable tokens as the Phase 22 pre-hydration splash. No white flash, no partial UI. Resolves in ~50–200ms on warm cache.
- **D-21:** On 401 from `/api/auth/me`, ProtectedRoute calls `window.location.href = "/api/auth/login"` (matches KPO-08 literal wording) — no intermediate "Sign in" screen.
- **D-22:** `useCurrentUser()` TanStack Query hook: `queryKey: ['auth','me']`, `queryFn: fetch('/api/auth/me')`, `staleTime: Infinity` (user identity doesn't change within a session), `retry: false` (401 is a success signal for "unauthenticated", not a transient error).
- **D-23:** NavBar user display: plain text `user.name ?? user.email` + a logout button that submits a native `<form method="POST" action="/api/auth/logout">`. No dropdown menu, no avatar image in this phase (deferred to a polish phase).

### Claude's Discretion
- Exact error-page markup on callback failures (e.g., state mismatch, Dex unreachable) — planner picks; keep it minimal and surface the error server-side via a flash-style message on `/`.
- Whether `/api/auth/login`/`/callback`/`/logout` return 404 or 503 under `DISABLE_AUTH=true` (D-16) — planner picks.
- Splash-screen visual details (logo size, spinner style) — follow existing Phase 22 splash tokens; planner picks specifics.
- Whether the `app_users` upsert happens in a service function, directly in the callback handler, or via a SQLAlchemy event hook — planner picks based on existing backend conventions.
- Whether `get_current_user` reads the session dict directly or validates via a Pydantic model — planner picks; Pydantic is probably cleaner.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase artifacts
- `.planning/phases/27-dex-idp-setup/27-CONTEXT.md` — Full Dex decisions (issuer, client registration, scopes, secrets, token lifetimes) — D-01..D-26 locked
- `.planning/phases/27-dex-idp-setup/27-02-SUMMARY.md` — Real secrets/hashes substitution workflow; `user: root` deviation; NPM proxy repoint
- `.planning/phases/27-dex-idp-setup/27-03-SUMMARY.md` — docs/setup.md Dex runbook extension
- `.planning/phases/26-npm-hostnames/26-CONTEXT.md` — NPM edge terminates TLS at `kpi.internal`; D-07 reserves `DISABLE_AUTH=true` for dev
- `.planning/phases/26-npm-hostnames/26-03-SUMMARY.md` — docs/setup.md Phase 26 onboarding baseline
- `docs/setup.md` — Operator runbook to be extended for Phase 28 (session secret generation, first-login walkthrough)

### Project-level
- `.planning/PROJECT.md` — v1.11 milestone scope, stack constraints, decision log
- `.planning/REQUIREMENTS.md` — KPO-01..KPO-09 + E2E-02 + E2E-06 acceptance criteria (all Phase 28 requirements verbatim)
- `.planning/ROADMAP.md` §Phase 28 — Goal + 6 success criteria (verbatim verification targets)

### Milestone-level research
- `.planning/research/v1.11-dex.md` — Dex OIDC integration notes (if present; check during planning)

### Existing codebase (planner must read)
- `backend/app/main.py` — FastAPI app wiring (routers currently unguarded — target for D-17 middleware edit)
- `backend/app/database.py` — async engine + session factory
- `backend/app/models.py` — existing ORM models; `AppUser` model goes here
- `backend/app/security/` — existing security helpers (fernet, logo validation); new `auth.py` module lives here
- `backend/alembic/` — migration directory; new revision for `app_users`
- `backend/app/routers/*.py` — 6 routers needing `dependencies=[Depends(get_current_user)]`
- `frontend/src/App.tsx` — current `<Switch>` layout; ProtectedRoute wraps here
- `frontend/src/components/NavBar.tsx` — target for user-name + logout additions
- `frontend/src/hooks/` — home for `useCurrentUser.ts`
- `frontend/src/queryClient.ts` — TanStack Query config (check for global `retry`/`staleTime` that might conflict with D-22)

### External (URLs — agents look up if needed)
- `authlib` FastAPI OAuth docs — https://docs.authlib.org/en/latest/client/fastapi.html
- Starlette `SessionMiddleware` — https://www.starlette.io/middleware/#sessionmiddleware
- Dex OIDC discovery JSON already verified live: `https://auth.internal/dex/.well-known/openid-configuration`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **FastAPI app skeleton** (`backend/app/main.py`): Lifespan hook already present (for APScheduler) — easy spot to add SessionMiddleware registration and the `DISABLE_AUTH` startup warning (D-15).
- **APRouter pattern** (`backend/app/routers/*.py`): Uniform router objects with `prefix` — D-17's `dependencies=[Depends(get_current_user)]` is a one-line edit per router.
- **Alembic migrations** (`backend/alembic/`): Established `alembic revision --autogenerate` workflow from prior phases — `app_users` migration follows the same pattern.
- **TanStack Query client** (`frontend/src/queryClient.ts`): Existing QueryClient can host the `useCurrentUser` query directly.
- **Pre-hydration splash pattern** (from Phase 22/23 — `frontend/index.html` IIFE + CSS-variable tokens): Reuse the same splash visual for the `<ProtectedRoute>` loading state (D-20). No new design system work.
- **Phase 27 `.env` secret pattern**: `DEX_KPI_SECRET` already lives in `.env`; add `SESSION_SECRET` alongside it using the same generation convention.

### Established Patterns
- **Async SQLAlchemy 2.0 + asyncpg**: `app_users` model follows the same async session pattern as existing models (`async def upsert_user(...)` in a service module).
- **Pydantic v2 for schemas**: `CurrentUser` response model in `backend/app/schemas.py` follows existing schema conventions.
- **Bilingual (DE/EN) i18n**: NavBar text additions (user name tooltip, logout button label) need i18n keys added to both `frontend/src/locales/de.json` and `en.json`.
- **Dark mode (Phase 21) + layout container (Phase 25)**: `<ProtectedRoute>` splash must respect dark/light tokens; page content inherits the existing `max-w-7xl` container.
- **Settings logout flow**: No prior logout precedent — this is the first session-clearing action in the app.

### Integration Points
- **Compose `api` service env**: Add `DEX_ISSUER`, `DEX_CLIENT_ID`, `DEX_CLIENT_SECRET`, `DEX_REDIRECT_URI`, `SESSION_SECRET`, `DISABLE_AUTH` env vars (referenced by `backend/app/config.py` or equivalent Pydantic BaseSettings).
- **NPM proxy-host `kpi.internal`** (Phase 26): Already forwards `/api/*` to the api container; no NPM edit required. Cookie-flag `Secure` works because NPM terminates TLS.
- **Existing `lifespan` hook** (`backend/app/scheduler.py`): This is where the `DISABLE_AUTH` startup warning + dev-user upsert (D-14/D-15) runs.
- **`.env.example`** (Phase 27 extension): Append `SESSION_SECRET`, `DISABLE_AUTH`, and callback URI documentation.

</code_context>

<specifics>
## Specific Ideas

- **Splash-flash discipline** (user preference from v1.9): Full-screen splash during `/api/auth/me` probe uses the same CSS-variable tokens as the pre-hydration splash so there is no color flash between the HTML splash and the React splash.
- **"Internal tool" framing**: Every auth UX trade-off leaned toward the seamless-internal-use experience (no consent screen, no explicit logout warning, no "Sign in" intermediate screen). Recurring theme — future auth phases should assume the same.
- **Quiet Dex SSO gap**: User accepted that clicking "Log out" then "Log in" within ~1h silently re-signs without a password prompt. This is a known, documented gap, not a bug.

</specifics>

<deferred>
## Deferred Ideas

- **Role-based access control (RBAC)** — Dex `groups` scope is available; v2 can split admin/viewer routes. Not scoped for v1.11.
- **Account soft-delete / deactivation UI** — No team request. Removing a user from `dex/config.yaml` + deleting the `app_users` row is the operator path today.
- **Audit log of login events** — `app_users.last_seen_at` is the proxy metric; a dedicated events table is future scope.
- **Avatar / profile picture in NavBar** — Explicitly deferred to a polish phase; D-23 keeps the v1 NavBar text-only.
- **Sliding session renewal** — Considered and rejected in D-02; revisit if team complains about mid-session logouts.
- **Server-side session store (Redis/DB)** — Considered and rejected in D-01 for scale reasons; revisit if revocation becomes a requirement.

</deferred>

---

*Phase: 28-kpi-light-oidc-integration*
*Context gathered: 2026-04-14*
