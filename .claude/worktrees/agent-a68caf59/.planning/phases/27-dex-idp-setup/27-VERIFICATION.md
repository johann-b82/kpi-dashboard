---
phase: 27-dex-idp-setup
verified: 2026-04-14T22:30:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 27: Dex IdP Setup Verification Report

**Phase Goal:** Dex v2.43.0 is deployed, reachable at `https://auth.internal/dex`, and its OIDC discovery endpoint returns an issuer URL that exactly matches the browser-reachable address — verified before any application is wired to it.

**Verified:** 2026-04-14T22:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| #   | Truth                                                                                                                              | Status     | Evidence                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `https://auth.internal/dex/.well-known/openid-configuration` returns valid JSON with `issuer` equal to `https://auth.internal/dex` | ✓ VERIFIED | Live host-shell curl through NPM returned `"issuer": "https://auth.internal/dex"` exactly; `authorization_endpoint` begins with `https://`.    |
| 2   | Both OIDC clients (`kpi-light` and `outline`) registered in `dex/config.yaml` with correct redirect URIs                           | ✓ VERIFIED | `dex/config.yaml` lines 54-65: `id: kpi-light` → `https://kpi.internal/api/auth/callback`; `id: outline` → `https://wiki.internal/auth/oidc.callback` (dot preserved). |
| 3   | At least two static users (one admin, one regular) seeded and can authenticate                                                      | ✓ VERIFIED | `staticPasswords` contains `admin@acm.local` and `dev@acm.local` with real `$2b$10$` bcrypt hashes + stable UUIDs. Live operator browser login produced `code=` + `state=test` redirects for both users (SUMMARY step-7b evidence). |
| 4   | Bcrypt hash generation command for adding new users is documented in the repo                                                       | ✓ VERIFIED | `docs/setup.md` "Add or rotate a Dex user" section documents `python:3.12-alpine + bcrypt` canonical command and flags the removed `dex hash-password` subcommand as dead path. |
| 5   | Dex container has a named volume for SQLite and survives `docker compose restart dex` with sessions intact                          | ✓ VERIFIED | `dex_data` volume exists (`acm-kpi-light_dex_data`); `/data/dex.db` present inside container (98 KB); operator confirmed survival across `docker compose restart dex` (SUMMARY). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                 | Expected                                                              | Status     | Details                                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dex/config.yaml`        | Issuer, storage, web, oauth2, expiry, 2 users, 2 clients              | ✓ VERIFIED | 66 lines; `issuer: https://auth.internal/dex` (line 11); `storage.type: sqlite3` + `/data/dex.db`; `web.http: 0.0.0.0:5556`; `idTokens: "1h"`; `validIfNotUsedFor: "720h"`; `absoluteLifetime: "2160h"`; `disableRotation: false`; `skipApprovalScreen: true`; 2 staticPasswords with real `$2b$10$` hashes + lowercase UUIDs; 2 staticClients referencing `$DEX_KPI_SECRET` / `$DEX_OUTLINE_SECRET` literals. |
| `.env.example`           | `DEX_KPI_SECRET=` and `DEX_OUTLINE_SECRET=` placeholders + openssl instructions | ✓ VERIFIED | Lines 17-26 contain the Dex block, both placeholder lines, and the `openssl rand -hex 32` instruction. Existing Postgres + NPM blocks intact.                  |
| `docker-compose.yml` (dex service) | `ghcr.io/dexidp/dex:v2.43.0`, bind-mount, `dex_data:/data`, healthcheck, npm depends_on | ✓ VERIFIED | Lines 95-122 define the dex service with correct image, healthcheck (`wget 127.0.0.1:5556/dex/healthz`), both volume mounts, `DEX_KPI_SECRET`/`DEX_OUTLINE_SECRET` env. `dex_data:` listed under top-level volumes (line 128). `npm.depends_on.dex.condition: service_healthy` present (lines 92-93). `user: root` documented as deviation from UID 1001 default. |
| `docs/setup.md` (Dex sections) | First-login, add-user, storage, known limitations                        | ✓ VERIFIED | Four new `##` sections appended (lines 271-438). Includes bcrypt command (python:3.12-alpine + bcrypt), `uuidgen`, NPM Advanced block with `X-Forwarded-Proto https`, `docker compose restart dex`, `dex_data` persistence, `end_session_endpoint` limitation, SECRET ROTATION note. |
| `README.md` (Quickstart pointer) | One-line Dex pointer to `docs/setup.md`                                 | ✓ VERIFIED | Line 45: `- **Dex IdP**: identity provider at \`https://auth.internal/dex\`. First-login + add-user workflow → see \`docs/setup.md\` "Dex first-login".` |

### Key Link Verification

| From                               | To                                   | Via                                                | Status | Details                                                                                                             |
| ---------------------------------- | ------------------------------------ | -------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `dex/config.yaml staticClients[].secret` | `.env DEX_KPI_SECRET / DEX_OUTLINE_SECRET` | Dex native `$VAR` substitution at boot         | ✓ WIRED | Both client `secret:` fields reference the literal `$DEX_KPI_SECRET` / `$DEX_OUTLINE_SECRET`; compose env injects real 64-hex values. No resolved secret leaked into git-tracked config (grep confirmed: `! grep -qE 'secret:\s+[a-f0-9]{32,}' dex/config.yaml`). |
| `docker-compose.yml dex service`   | `dex/config.yaml`                    | read-only bind mount `./dex/config.yaml:/etc/dex/config.yaml:ro` | ✓ WIRED | Line 109 in docker-compose.yml. Dex boots healthy, proving config was readable and valid at startup.                |
| `docker-compose.yml dex service`   | `dex_data` named volume              | `dex_data:/data`                                   | ✓ WIRED | Line 110 in compose, volume declared line 128, `/data/dex.db` present inside container.                             |
| `docker-compose.yml npm.depends_on` | `dex healthcheck`                    | `condition: service_healthy`                       | ✓ WIRED | Lines 92-93. Prevents NPM serving 502 while Dex still booting.                                                      |
| Browser at `https://auth.internal/dex` | Dex container at `dex:5556`        | NPM proxy host + `X-Forwarded-Proto https` Advanced block | ✓ WIRED | Live host-shell curl resolves through NPM and returns correct issuer + https authorization_endpoint — proves the X-Forwarded-Proto header is being injected and consumed. |

### Data-Flow Trace (Level 4)

Not applicable for a phase 27-scope configuration/infrastructure phase. Dex is a running service verified end-to-end by the behavioral spot-checks below.

### Behavioral Spot-Checks

| Behavior                                  | Command                                                                                  | Result                                                                | Status  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------- |
| Dex container healthy                     | `docker compose ps`                                                                      | `dex ... Up 10 minutes (healthy)`                                    | ✓ PASS  |
| Internal discovery correct                | `docker compose exec dex wget -qO- http://127.0.0.1:5556/dex/.well-known/openid-configuration` | Returned JSON; `issuer = https://auth.internal/dex`; `scopes_supported` contains `offline_access` | ✓ PASS  |
| External discovery via NPM correct        | `curl -sk https://auth.internal/dex/.well-known/openid-configuration`                    | `issuer = https://auth.internal/dex`; `authorization_endpoint` starts with `https://`; `offline_access` in scopes | ✓ PASS  |
| SQLite volume persistence                 | `docker compose exec dex sh -c 'ls -la /data/dex.db'`                                    | `-rw-r--r-- 1 root root 98304 Apr 14 22:21 /data/dex.db`             | ✓ PASS  |
| Named volume registered                   | `docker volume ls \| grep dex`                                                           | `local acm-kpi-light_dex_data`                                       | ✓ PASS  |
| Browser login issues auth code (both users) | Operator browser flow (documented in 27-02-SUMMARY)                                    | admin@acm.local and dev@acm.local both redirected with `code=...&state=test` | ✓ PASS (operator-confirmed) |
| Restart-survival                          | Operator `docker compose restart dex` + re-check `/data/dex.db`                          | dex.db retained, healthy resumed                                     | ✓ PASS (operator-confirmed) |

### Requirements Coverage

| Requirement | Source Plan(s)       | Description                                                                                            | Status      | Evidence                                                                                                                                                                              |
| ----------- | -------------------- | ------------------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEX-01      | 27-02, 27-03         | Dex runs as a docker-compose service with SQLite on a named volume, reachable as `https://auth.internal` via NPM | ✓ SATISFIED | dex service block in docker-compose.yml with `dex_data:/data`; live external discovery through NPM returned correct issuer; operator runbook documents first-time bring-up.            |
| DEX-02      | 27-01, 27-02         | Valid OIDC discovery at `https://auth.internal/dex/.well-known/openid-configuration`, `issuer` matches browser URL | ✓ SATISFIED | Live curl via NPM returned exact match; discovery JSON contains all expected endpoints with `https://` scheme.                                                                        |
| DEX-03      | 27-01                | Two OIDC clients (`kpi-light` and `outline`) with correct redirect URIs                                | ✓ SATISFIED | `dex/config.yaml` staticClients block lines 54-65 with exact redirect URIs including the intentional dot in `oidc.callback`.                                                           |
| DEX-04      | 27-01, 27-02, 27-03  | ≥ 2 seeded users (one admin + one regular) AND bcrypt workflow documented                               | ✓ SATISFIED | `admin@acm.local` + `dev@acm.local` with real bcrypt hashes; both users successfully authenticated live (operator-confirmed); `docs/setup.md` documents canonical python:3.12-alpine + bcrypt workflow. |
| DEX-05      | 27-01                | Access/ID token TTL ≤ 1 hour                                                                           | ✓ SATISFIED | `dex/config.yaml` line 34: `idTokens: "1h"`.                                                                                                                                          |
| DEX-06      | 27-01, 27-02         | `offline_access` scope supported                                                                       | ✓ SATISFIED | Discovery `scopes_supported` array contains `offline_access` (verified both internally and externally).                                                                               |

**Orphaned requirements:** None. All six DEX requirements declared across the three plans are accounted for in REQUIREMENTS.md and mapped to implementation evidence.

### Anti-Patterns Found

| File                  | Line | Pattern                               | Severity | Impact                                                                                                                                                                               |
| --------------------- | ---- | ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docker-compose.yml`  | 102  | `user: root` on dex service           | ℹ️ Info  | Deliberate deviation documented in comment (lines 99-101) and in `docs/setup.md` (line 291). Dex default UID 1001 cannot write to root-owned `/data` named volume. Acceptable for internal-tool scope; hardened alternative (chown init sidecar) documented for future. Not a blocker. |
| `dex/config.yaml`     | 43-52 | Seeded placeholder passwords present as bcrypt hashes | ℹ️ Info  | Placeholder passwords `ChangeMe!2026-*` are in git planning history. `docs/setup.md` section 6 + SECURITY NOTE at top of `dex/config.yaml` flag this for mandatory rotation before human sharing. Operational-risk item, not a code defect. |

No 🛑 Blocker or ⚠️ Warning anti-patterns found. No `TODO`/`FIXME`/`PLACEHOLDER` markers remaining in config. No `REPLACE_WITH_*` residuals. No 32+ hex-character secrets committed to git-tracked files.

### Human Verification Required

None remaining. All success criteria independently reproducible by re-running the live curl/docker commands shown above. The operator has already completed the browser login for both seeded users and the restart-survival check (documented in 27-02-SUMMARY).

### Gaps Summary

No gaps. All five ROADMAP success criteria satisfied with live evidence. All six DEX requirements are in REQUIREMENTS.md marked Complete with implementation evidence mapped to the three phase plans. Dex is healthy, reachable externally via NPM with correct issuer + https scheme, both seeded users can authenticate, and the `dex_data` volume persists across restarts.

Notable deviations (logged, non-blocking):
- Dex v2.43.0 removed `dex hash-password` subcommand — runbook replaces with `python:3.12-alpine + bcrypt` canonical workflow and explicitly flags the dead path.
- `user: root` on the dex service — documented as an internal-tool-scope concession; hardened alternative noted in comments and setup docs.

Phase 27 goal achieved. Ready for Phase 28 (api OIDC wiring).

---

_Verified: 2026-04-14T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
