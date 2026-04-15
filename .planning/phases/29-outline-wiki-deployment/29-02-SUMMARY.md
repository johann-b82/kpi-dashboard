---
phase: 29-outline-wiki-deployment
plan: 02
subsystem: infra
tags: [docker-compose, outline, oidc, dex, mkcert, healthcheck, volumes]

requires:
  - phase: 29-outline-wiki-deployment
    plan: 01
    provides: OUTLINE_SECRET_KEY, OUTLINE_UTILS_SECRET, OUTLINE_DB_PASSWORD placeholders in .env.example
  - phase: 28-kpi-light-oidc-integration
    provides: mkcert rootCA mount + extra_hosts pattern (api service template)
  - phase: 27-dex-idp-setup
    provides: Dex client "outline" with redirect URI https://wiki.internal/auth/oidc.callback; DEX_OUTLINE_SECRET in .env
  - phase: 26-npm-hostnames
    provides: wiki.internal placeholder proxy host + mkcert SAN cert

provides:
  - outline-db service (postgres:17-alpine) with pg_isready healthcheck
  - outline-redis service (redis:7-alpine) with redis-cli ping healthcheck
  - outline service (outlinewiki/outline:0.86.0) wired to Dex via split OIDC endpoints + mkcert CA trust
  - Named volumes outline_db_data, outline_redis_data, outline_uploads (no collision with KPI Light's postgres_data)
  - npm.depends_on extended with outline:service_healthy (closes 502 cold-boot window)

affects: [29-03-docs-runbook, phase-30-navbar-wiki-link, phase-31-seed-docs]

tech-stack:
  added:
    - "outlinewiki/outline:0.86.0 (wiki)"
    - "postgres:17-alpine (outline-db — second instance; KPI Light's db is unchanged)"
    - "redis:7-alpine (outline-redis)"
  patterns:
    - "Node.js containers honour NODE_EXTRA_CA_CERTS natively — no update-ca-certificates shell dance needed (contrast with api service's Python/httpx approach from Phase 28)"
    - "Outline runs DB migrations at container start — no separate outline-migrate service (unlike KPI Light's Alembic migrate pattern)"
    - "OIDC split endpoints: browser-reachable https://auth.internal/dex/auth for auth URI; internal docker DNS http://dex:5556/dex/{token,userinfo} for server-to-server"

key-files:
  created: []
  modified:
    - docker-compose.yml

key-decisions:
  - "Kept the Dockerfile-default HEALTHCHECK on the outline service (v0.86.0 probes http://localhost:3000/_health internally) — no compose-level override; 0.79.0 bug is fixed in 0.86.0 per RESEARCH §Don't Hand-Roll."
  - "Volumes declared in the order: outline-db → outline-redis → outline service blocks (dependencies first), matching the depends_on DAG. Top-level volumes block appends three new entries at the end to keep diff localised."
  - "npm.depends_on extended inline (not relocated) — preserves api/frontend/dex ordering so reviewers see the append-only change."

patterns-established:
  - "Named volumes for Outline data (outline_db_data, outline_redis_data, outline_uploads) use subsystem_purpose naming — distinct from the legacy postgres_data name to avoid the Pitfall 8 collision."
  - "Outline env vars use YAML string form for numeric/boolean values where Outline parses them as strings (PORT: \"3000\", FORCE_HTTPS: \"true\", FILE_STORAGE_UPLOAD_MAX_SIZE: \"262144000\") — prevents the occasional YAML-int-vs-env-str surprise."

requirements-completed: [WIK-01, WIK-02, WIK-03, WIK-04, WIK-06]

metrics:
  duration: 4min
  completed: 2026-04-15
  tasks: 2
  files_modified: 1
---

# Phase 29 Plan 02: Outline Compose Services (OIDC + CA + Volumes) Summary

**Three new compose services land (`outline-db`, `outline-redis`, `outline`) with healthcheck-gated depends_on, split-endpoint OIDC wiring to Dex (browser auth URI over https, token/userinfo over internal docker DNS), mkcert rootCA mounted for Node.js native `NODE_EXTRA_CA_CERTS` trust, and three named volumes distinct from KPI Light's `postgres_data`. NPM now waits on Outline healthy before accepting traffic.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-15T07:03:17Z
- **Completed:** 2026-04-15T07:05Z (approx)
- **Tasks:** 2
- **Files modified:** 1 (docker-compose.yml)

## Accomplishments

- Added `outline-db` (postgres:17-alpine) with `pg_isready -U outline -d outline` healthcheck + `outline_db_data` volume — distinct from KPI Light's `postgres_data`.
- Added `outline-redis` (redis:7-alpine) with `redis-cli ping | grep -q PONG` healthcheck + `outline_redis_data` persistence volume.
- Added `outline` (outlinewiki/outline:0.86.0) service with full env block:
  - **Core:** `NODE_ENV=production`, `PORT=3000`, `URL=https://wiki.internal` (no trailing slash — Pitfall 1), `SECRET_KEY`/`UTILS_SECRET` from independent env vars (Pitfall 2), `DATABASE_URL`, `PGSSLMODE=disable`, `REDIS_URL`, `FORCE_HTTPS=true`, `DEFAULT_LANGUAGE=en_US`.
  - **File storage (WIK-03):** `FILE_STORAGE=local`, `FILE_STORAGE_LOCAL_ROOT_DIR=/var/lib/outline/data`, `FILE_STORAGE_UPLOAD_MAX_SIZE=262144000` (250 MiB), `outline_uploads` named volume.
  - **OIDC (D-02, D-05, WIK-04):** `OIDC_CLIENT_ID=outline`, `OIDC_CLIENT_SECRET=${DEX_OUTLINE_SECRET}` (reuses Phase 27 env var), `OIDC_AUTH_URI=https://auth.internal/dex/auth` (browser), `OIDC_TOKEN_URI=http://dex:5556/dex/token` (internal), `OIDC_USERINFO_URI=http://dex:5556/dex/userinfo` (internal), `OIDC_USERNAME_CLAIM=preferred_username`, `OIDC_DISPLAY_NAME=name`, `OIDC_SCOPES=openid profile email offline_access`.
  - **CA trust (D-05):** `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/mkcert-rootCA.pem` + read-only mount of `./certs/rootCA.pem` + `extra_hosts: auth.internal:host-gateway`.
- `depends_on` gates Outline on `outline-db`, `outline-redis`, and `dex` all being `service_healthy`.
- Extended `npm.depends_on` with `outline: condition: service_healthy` — NPM no longer accepts traffic until Outline is ready (closes the 502 window on cold boot, same pattern as Phase 26 INF-05).
- `docker compose config --quiet` validates cleanly (with .env warnings only for not-yet-substituted secrets — expected since operator generates them before bringing stack up).

## Full Env Var List on outline Service

| Variable | Value | Source / Rationale |
|---|---|---|
| `NODE_ENV` | `production` | |
| `PORT` | `"3000"` | Defensive against 0.79.x healthcheck bug (fixed in 0.79.1+) |
| `URL` | `https://wiki.internal` | Pitfall 1 — no trailing slash; must match Dex-registered redirect URI |
| `SECRET_KEY` | `${OUTLINE_SECRET_KEY}` | Plan 29-01 placeholder; independent of UTILS_SECRET (Pitfall 2) |
| `UTILS_SECRET` | `${OUTLINE_UTILS_SECRET}` | Plan 29-01 placeholder |
| `DATABASE_URL` | `postgres://outline:${OUTLINE_DB_PASSWORD}@outline-db:5432/outline` | |
| `PGSSLMODE` | `disable` | Same docker network — no TLS between outline and outline-db |
| `REDIS_URL` | `redis://outline-redis:6379` | No auth on internal network |
| `FILE_STORAGE` | `local` | WIK-03 |
| `FILE_STORAGE_LOCAL_ROOT_DIR` | `/var/lib/outline/data` | Matches Dockerfile VOLUME declaration |
| `FILE_STORAGE_UPLOAD_MAX_SIZE` | `"262144000"` | 250 MiB default |
| `FORCE_HTTPS` | `"true"` | Ensures Secure cookie flag behind NPM TLS terminator |
| `DEFAULT_LANGUAGE` | `en_US` | First user can change in-UI |
| `OIDC_CLIENT_ID` | `outline` | Phase 27 D-25 |
| `OIDC_CLIENT_SECRET` | `${DEX_OUTLINE_SECRET}` | Reuses Phase 27 env var |
| `OIDC_AUTH_URI` | `https://auth.internal/dex/auth` | D-05 browser leg |
| `OIDC_TOKEN_URI` | `http://dex:5556/dex/token` | D-05 internal DNS |
| `OIDC_USERINFO_URI` | `http://dex:5556/dex/userinfo` | D-05 internal DNS |
| `OIDC_USERNAME_CLAIM` | `preferred_username` | D-02 |
| `OIDC_DISPLAY_NAME` | `name` | D-02 |
| `OIDC_SCOPES` | `openid profile email offline_access` | D-02 |
| `NODE_EXTRA_CA_CERTS` | `/etc/ssl/certs/mkcert-rootCA.pem` | D-05 — Node.js reads this file natively |

`env_file: .env` also loads any other compose env vars (e.g., `DEX_OUTLINE_SECRET`, `OUTLINE_DB_PASSWORD`) for substitution at YAML parse time.

## Requirements Closed

| ID | Closure Evidence |
|---|---|
| **WIK-01** | `outline` service declared at `outlinewiki/outline:0.86.0`, listening on port 3000 internally; NPM proxy host `wiki.internal` wiring is plan 29-03's job (docs/setup.md). |
| **WIK-02** | `outline-db` (postgres:17-alpine) + `outline-redis` (redis:7-alpine) both present with healthchecks and distinct named volumes. |
| **WIK-03** | `FILE_STORAGE=local`, `FILE_STORAGE_LOCAL_ROOT_DIR=/var/lib/outline/data`, named volume `outline_uploads:/var/lib/outline/data` (Pitfall 5 avoided). |
| **WIK-04** | OIDC split endpoints: `OIDC_AUTH_URI` browser-reachable via `auth.internal`; `OIDC_TOKEN_URI` + `OIDC_USERINFO_URI` over internal docker DNS (`dex:5556`). |
| **WIK-06** | No `SMTP_*` env vars anywhere in docker-compose.yml; `grep -E "^\s*SMTP_" docker-compose.yml` returns empty. |

**WIK-05** (first-login JIT user provisioning) and **WIK-07** (BSL compliance) are handled elsewhere — WIK-05 is validated at manual UAT time (Outline's built-in JIT behaviour is not a compose-YAML concern); WIK-07 was closed in plan 29-01.

## Task Commits

1. **Task 1: Add outline-db + outline-redis service blocks with distinct named volumes** — `c684e52` (feat)
2. **Task 2: Add outline service block (OIDC split endpoints + mkcert CA) and extend npm depends_on** — `a041e83` (feat)

**Plan metadata commit:** final docs commit (this SUMMARY + STATE + ROADMAP + REQUIREMENTS) follows below.

## Files Created/Modified

- `docker-compose.yml` — Inserted three new service blocks between `dex:` and top-level `volumes:`; appended three new named volumes; extended `npm.depends_on` with `outline: condition: service_healthy`.

## Decisions Made

- Kept the Dockerfile-default HEALTHCHECK on the `outline` service. v0.86.0 probes `http://localhost:3000/_health` natively; declaring a compose-level override would be redundant (RESEARCH §Don't Hand-Roll).
- No separate `outline-migrate` service — Outline runs DB migrations at container start. Mirrors RESEARCH guidance and avoids the false parallel to KPI Light's explicit Alembic `migrate` service.
- Extended `npm.depends_on` append-only (outline added after dex) rather than reordering entries — keeps the diff reviewable.
- Numeric/boolean env values quoted as strings where Outline parses env as strings (`PORT: "3000"`, `FORCE_HTTPS: "true"`, `FILE_STORAGE_UPLOAD_MAX_SIZE: "262144000"`) — avoids YAML-int-vs-env-str surprises.

## Deviations from Plan

None — plan executed exactly as written. Every env var, volume name, depends_on gate, and extra_hosts entry matches the plan's action specification verbatim.

## Issues Encountered

None. `docker compose config --quiet` passed on first try after both edits. The only noise during validation was the expected "variable is not set" warnings for secrets the operator will populate in `.env` before bringing the stack up (matches Phase 27/28 operator workflow).

## Pitfalls Avoided (per RESEARCH §Common Pitfalls)

- **Pitfall 1** (URL trailing slash): `URL: https://wiki.internal` is exact, no slash.
- **Pitfall 2** (SECRET_KEY == UTILS_SECRET): plan 29-01 established two independent `.env.example` placeholders; compose references each separately.
- **Pitfall 5** (anonymous file storage volume): `outline_uploads` is a named volume declared in top-level `volumes:`.
- **Pitfall 7** (missing extra_hosts under split endpoints): `auth.internal:host-gateway` present on outline despite token/userinfo using internal DNS — covers discovery + `iss` revalidation.
- **Pitfall 8** (volume name collision): `outline_db_data` (not `postgres_data`); `outline_redis_data`, `outline_uploads` also unique.

## User Setup Required

Before bringing the Outline stack up, operator must populate in `.env`:

- `OUTLINE_SECRET_KEY=$(openssl rand -hex 32)`
- `OUTLINE_UTILS_SECRET=$(openssl rand -hex 32)` (must be independent from SECRET_KEY — Pitfall 2)
- `OUTLINE_DB_PASSWORD=<choose a password>`
- `DEX_OUTLINE_SECRET=<already present from Phase 27>`

Plan 29-03 (docs/setup.md runbook) will make this explicit in the user-facing runbook; the `.env.example` entries already document the generation commands.

## Next Plan Readiness

- Plan **29-03** (docs/setup.md runbook + NPM proxy host config for `wiki.internal`) is unblocked. The compose YAML is complete; operator-facing setup instructions are the remaining gap.
- After 29-03, Phase 29 is feature-complete. Manual UAT (WIK-05 first-login JIT + Success Criterion #3 shared SSO) happens at phase gate.
- No blockers carried forward.

## Self-Check: PASSED

- FOUND: `docker compose config --quiet` exits 0 (YAML valid, all env substitutions resolve structurally).
- FOUND: `docker compose config --services` lists all 9 services including `outline`, `outline-db`, `outline-redis`.
- FOUND: `docker compose config` shows 2× `image: postgres:17-alpine` (KPI Light db + outline-db) and 1× `image: redis:7-alpine`.
- FOUND: `docker-compose.yml` contains `URL: https://wiki.internal` (no trailing slash), `OIDC_AUTH_URI: https://auth.internal/dex/auth`, `OIDC_TOKEN_URI: http://dex:5556/dex/token`, `OIDC_USERINFO_URI: http://dex:5556/dex/userinfo`.
- FOUND: `NODE_EXTRA_CA_CERTS: /etc/ssl/certs/mkcert-rootCA.pem` + `./certs/rootCA.pem:/etc/ssl/certs/mkcert-rootCA.pem:ro` mount.
- FOUND: `outline_uploads:/var/lib/outline/data` mount.
- FOUND: `auth.internal:host-gateway` appears twice (api + outline).
- FOUND: `npm.depends_on` now contains `outline: condition: service_healthy` alongside api/frontend/dex.
- FOUND: no `^\s*SMTP_` lines (WIK-06).
- FOUND: no `TEAM_LOGO_URL` (D-03).
- FOUND: no `OIDC_REDIRECT_URI` (derived from URL, per RESEARCH anti-patterns).
- FOUND: no `outlinewiki/outline:latest` (pinned tag only).
- FOUND: commits `c684e52` (Task 1) and `a041e83` (Task 2) both in `git log`.
- FOUND: top-level `volumes:` contains `outline_db_data`, `outline_redis_data`, `outline_uploads`.

---
*Phase: 29-outline-wiki-deployment*
*Completed: 2026-04-15*
