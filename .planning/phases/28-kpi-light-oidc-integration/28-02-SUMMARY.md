---
phase: 28-kpi-light-oidc-integration
plan: "02"
subsystem: backend-auth-endpoints
tags: [oidc, dex, authlib, pkce, disable_auth, lifespan]
requires: [28-01]
provides:
  - /api/auth/login (303 -> Dex authorize endpoint with PKCE + state)
  - /api/auth/callback (code exchange, upsert_user, session write, 303 -> /)
  - /api/auth/me (200 CurrentUser / 401 Unauthenticated)
  - /api/auth/logout (session pop + cookie delete + 303 -> /)
  - DISABLE_AUTH startup warning + synthetic dev-user upsert
affects:
  - backend/app/main.py (auth_router registered before business routers)
  - backend/app/scheduler.py (lifespan extended with DISABLE_AUTH branch)
  - docker-compose.yml (api: extra_hosts + mkcert CA bundle + SSL_CERT_FILE)
  - certs/rootCA.pem (copied from host mkcert CAROOT for container trust)
tech_stack_added: []
patterns:
  - authlib.oauth.dex.authorize_redirect / authorize_access_token end-to-end
  - _bypass_guard() dependency-less helper returning 503 under DISABLE_AUTH
  - lifespan extension pattern: DISABLE_AUTH branch runs BEFORE scheduler start
  - mkcert rootCA merged into Debian system trust at container start (preserves certifi/public HTTPS trust)
key_files_created:
  - backend/app/routers/auth.py
  - .planning/phases/28-kpi-light-oidc-integration/28-02-SUMMARY.md
  - certs/rootCA.pem
key_files_modified:
  - backend/app/main.py
  - backend/app/scheduler.py
  - docker-compose.yml
decisions:
  - "Used existing app.database.get_async_db_session dependency (not get_session from plan text — real name differs)"
  - "extra_hosts auth.internal/kpi.internal -> host-gateway so api container can reach NPM-served issuer URLs"
  - "Merge mkcert rootCA into system CA bundle at container startup (SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt) — preserves public CA trust for Personio"
metrics:
  duration: 5min
  completed: 2026-04-15
  tasks: 2
  files: 4
requirements: [KPO-02, KPO-03, KPO-04, KPO-05]
---

# Phase 28 Plan 02: Auth Endpoints + DISABLE_AUTH Bypass Summary

Delivered the four `/api/auth/*` endpoints end-to-end against Dex and wired the DISABLE_AUTH dev bypass (startup warning + synthetic dev-user upsert + 503 on auth endpoints). A full authorization-code + PKCE redirect from `/api/auth/login` now lands at Dex's `/dex/auth` with `code_challenge=...&state=...`, and `/api/auth/me` enforces the session-cookie contract (200 with user / 401 without).

## What Shipped

- **Task 1 — Auth router:** `backend/app/routers/auth.py` exposes `/api/auth/{login,callback,me,logout}`. `login` and `callback` are intentionally NOT guarded by `get_current_user` (per D-18 and research open-question 1 — they must remain open). `callback` extracts `{sub,email,name}` from `token['userinfo'] || token['id_token_claims']`, calls `upsert_user`, writes strictly the three-field identity payload into the session (D-01 — no raw tokens), and 303-redirects to `/`. `logout` clears the session key AND calls `resp.delete_cookie("kpi_session")` for belt-and-braces cookie eviction. Registered in `main.py` via `app.include_router(auth_router)` placed before the business routers.
- **Task 2 — DISABLE_AUTH lifespan branch:** Extended the existing `lifespan` in `backend/app/scheduler.py` (did NOT replace) with a DISABLE_AUTH-gated block running BEFORE `app.state.scheduler = scheduler`. Emits the exact warning string and upserts the `dev-user` row via `upsert_user(session, sub="dev-user", email="dev@localhost", name="Dev User")`.

## Verification Results

Standard mode (`DISABLE_AUTH=false`):
- `GET /api/auth/me` without cookie → `401` ✓
- `GET /api/auth/login` → `302` with `Location: https://auth.internal/dex/auth?...&code_challenge=D5T20QPac8TOfOEaFqz0Tl4h2KYMP4MyYgDfyiLU7nM&code_challenge_method=S256&state=...` ✓ and sets `kpi_session` cookie (Secure; HttpOnly; SameSite=Lax) carrying the PKCE code_verifier ✓
- `POST /api/auth/logout` → `303` with `Location: /` and `Set-Cookie: kpi_session=""; Max-Age=0` ✓
- No "DISABLE_AUTH=true" warning in logs ✓

Bypass mode (`DISABLE_AUTH=true`):
- Startup log contains `⚠ DISABLE_AUTH=true — authentication is bypassed. DO NOT use in production.` ✓
- `SELECT sub,email,name FROM app_users WHERE sub='dev-user'` → `dev-user | dev@localhost | Dev User` ✓
- `GET /api/auth/login` → `503` ✓
- `GET /api/auth/me` → `200` with `{"sub":"dev-user","email":"dev@localhost","name":"Dev User"}` ✓

## Output Spec Answers

- **404 vs 503 under bypass:** planner picked **503** — implemented as such via `_bypass_guard()` raising `HTTPException(503, "DISABLE_AUTH=true; OIDC endpoints disabled")`. 503 (Service Unavailable) correctly signals "feature intentionally unavailable in this deployment mode" rather than "does not exist."
- **authlib surprises:** `token["userinfo"]` is present for this Dex client (scope includes `openid email profile`), so the `id_token_claims` fallback path was not exercised. Kept the fallback anyway as defensive code in case scopes narrow later.
- **Verified /api/auth/login redirect URL matches Dex kpi-light client registration exactly:** Yes. The emitted `Location` header reads `https://auth.internal/dex/auth?response_type=code&client_id=kpi-light&redirect_uri=https%3A%2F%2Fkpi.internal%2Fapi%2Fauth%2Fcallback&...` — the `client_id=kpi-light` and URL-encoded `redirect_uri=https://kpi.internal/api/auth/callback` match the Phase 27 Dex config entry exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dependency name mismatch**
- **Found during:** Task 1
- **Issue:** Plan referenced `from app.database import get_session`, but Phase 28-01 (and pre-existing code) defines the dependency as `get_async_db_session`.
- **Fix:** Used the real symbol. No new dependency alias added.
- **Files modified:** `backend/app/routers/auth.py`

**2. [Rule 3 - Blocking] api container could not reach `https://auth.internal/dex`**
- **Found during:** Task 1 verification (`GET /api/auth/login` returned 500 with `httpx.ConnectError`)
- **Issue:** Container's `/etc/hosts` inherited from host mapping `auth.internal -> 127.0.0.1`, which points at the container itself (not the host where NPM terminates TLS). OIDC discovery therefore had no target.
- **Fix:** Added `extra_hosts: ["auth.internal:host-gateway", "kpi.internal:host-gateway"]` to the `api` service in `docker-compose.yml` so those hostnames resolve to the Docker host gateway (where NPM listens on :443).
- **Files modified:** `docker-compose.yml`

**3. [Rule 3 - Blocking] SSL CERTIFICATE_VERIFY_FAILED for https://auth.internal in container**
- **Found during:** Task 1 verification (after Fix #2)
- **Issue:** NPM serves the mkcert-signed SAN cert; the mkcert root CA is trusted on the host but not inside the container. `httpx` (via `authlib`) reported `SSL: CERTIFICATE_VERIFY_FAILED` during OIDC discovery.
- **Fix:** Copied `$(mkcert -CAROOT)/rootCA.pem` to `./certs/rootCA.pem` (directory is already gitignored). Mounted it read-only into the api container at `/etc/ssl/certs/mkcert-rootCA.pem`. Changed the api `command` to prepend the mkcert CA to the Debian system bundle (`/etc/ssl/certs/ca-certificates.crt`) and run `update-ca-certificates`, then `exec uvicorn ...`. Set `SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt` so httpx/OpenSSL read the augmented bundle. This preserves the default public-CA trust (essential for Personio sync) while adding mkcert.
- **Files modified:** `docker-compose.yml`, `certs/rootCA.pem` (new, gitignored)

### Intentional no-ops

- `get_current_user` already short-circuits to `SYNTHETIC_USER` under `DISABLE_AUTH=true` (Phase 28-01), so `/api/auth/me` returns 200 with the dev user under bypass without any extra logic in the router.

## Unblocks

- **Plan 28-03** — can now apply `Depends(get_current_user)` at the router level on business routers and rely on `/api/auth/login` as the unauth redirect target
- **Plan 28-04** — frontend can implement Login button → `GET /api/auth/login`, Logout → `POST /api/auth/logout`, and `useMe` hook → `GET /api/auth/me`
- **Plan 28-05** — end-to-end verification checklist has a working backend contract to walk

## Commits

- `75bdd08` feat(28-02): add /api/auth router (login, callback, me, logout)
- `25bd126` feat(28-02): DISABLE_AUTH startup warning + dev-user upsert

## Known Stubs

None. All four endpoints are fully functional against live Dex.

## Self-Check: PASSED

- FOUND: backend/app/routers/auth.py
- FOUND: docker-compose.yml (edits)
- FOUND: backend/app/main.py (edits)
- FOUND: backend/app/scheduler.py (edits)
- FOUND: certs/rootCA.pem (gitignored, mounted into api container)
- FOUND commit: 75bdd08
- FOUND commit: 25bd126
