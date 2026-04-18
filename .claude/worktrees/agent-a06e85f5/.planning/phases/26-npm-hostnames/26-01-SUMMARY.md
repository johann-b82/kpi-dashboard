---
phase: 26-npm-hostnames
plan: 01
subsystem: infra
tags: [docker-compose, nginx-proxy-manager, mkcert, tls, healthcheck, https-edge]

# Dependency graph
requires:
  - phase: (none)
    provides: Existing docker-compose.yml with db/migrate/api/frontend services (pre-v1.11 stack)
provides:
  - scripts/generate-certs.sh — mkcert wrapper producing SAN cert for kpi.internal, wiki.internal, auth.internal, *.internal
  - NPM (jc21/nginx-proxy-manager:2.11.3) service in docker-compose.yml with ports 80/443/81
  - Named volumes npm_data + npm_letsencrypt for NPM state persistence
  - Read-only ./certs:/etc/certs:ro bind mount so NPM can read mkcert-generated cert+key
  - frontend service healthcheck (busybox wget spider on :5173) closing the 502 window
  - Healthcheck-gated boot order: db -> migrate -> api -> frontend -> npm, each service_healthy before the next
  - .env.example documentation of NPM first-login credentials (admin@example.com / changeme)
  - certs/ gitignored so private keys never land in the repo
affects: [26-02-proxy-hosts, 26-03-runbook, 27-dex, 28-outline, 29-oidc-kpi, 30-oidc-outline, 31-milestone-close]

# Tech tracking
tech-stack:
  added:
    - jc21/nginx-proxy-manager:2.11.3 (HTTPS edge, admin UI on :81)
    - mkcert (locally-trusted dev CA, invoked via scripts/generate-certs.sh)
  patterns:
    - Pinned image tags only — no :latest
    - Healthcheck probes matched to image toolchain (busybox wget for node:22-alpine, curl for NPM image)
    - depends_on.condition: service_healthy gates every service transition
    - Read-only bind mounts for host-generated secrets (certs/)
    - Named volumes for container-owned state (npm_data, npm_letsencrypt, postgres_data)

key-files:
  created:
    - scripts/generate-certs.sh
    - .planning/phases/26-npm-hostnames/26-01-SUMMARY.md
  modified:
    - docker-compose.yml
    - .gitignore
    - .env.example

key-decisions:
  - Used single SAN cert (kpi.internal + wiki.internal + auth.internal + *.internal) over per-host certs — simpler NPM wiring, one file to track
  - Pinned NPM to 2.11.3 (current stable) — conforms to CLAUDE.md no-:latest rule
  - frontend healthcheck uses busybox wget --spider (not curl) — node:22-alpine does not ship curl
  - NPM healthcheck uses curl (jc21 image ships curl) — probes admin UI on :81
  - depends_on.frontend.condition: service_healthy added as INF-05 guarantee — prevents NPM from fronting a 502 window while Vite compiles on cold boot
  - restart: unless-stopped on NPM so it survives docker daemon restarts on single-VM prod host
  - Left frontend ports: "5173:5173" in place — removal is Plan 26-02's job once Vite HMR config is ready

patterns-established:
  - "Image-toolchain-aware healthchecks: inspect base image before choosing wget vs curl vs nc"
  - "Healthcheck-gated edge pattern: reverse proxy depends_on service_healthy for every upstream it proxies"
  - "Host-generated secrets flow to containers via read-only bind mounts; container state lives in named volumes"

requirements-completed: [INF-01, INF-04, INF-05]

# Metrics
duration: ~15min
completed: 2026-04-14
---

# Phase 26 Plan 01: NPM + TLS Cert Tooling Summary

**Nginx Proxy Manager 2.11.3 wired into docker-compose as the HTTPS edge, fronting api + frontend behind healthcheck-gated boot, with an mkcert SAN cert pipeline for kpi.internal / wiki.internal / auth.internal.**

## Performance

- **Duration:** ~15 min (execution) + human verification window
- **Tasks:** 3 (2 implementation + 1 human-verify checkpoint, approved)
- **Files modified:** 4 (scripts/generate-certs.sh created; docker-compose.yml, .gitignore, .env.example modified)

## Accomplishments
- HTTPS edge container (NPM) now part of the compose stack, pinned to 2.11.3
- mkcert wrapper script generates a single SAN cert for all *.internal hostnames into gitignored ./certs/
- Full healthcheck-gated boot chain: db -> migrate -> api -> frontend -> npm, closing the 502 window on first `up --build`
- NPM admin UI accessible on :81 with persistent state via npm_data + npm_letsencrypt named volumes
- Private keys cannot be committed (certs/ in .gitignore)

## Task Commits

1. **Task 1: Cert-generation script + .gitignore** — `5b10f1d` (feat)
2. **Task 2: npm service + frontend healthcheck in compose** — `b2a082b` (feat)
3. **Task 3: Human-verify checkpoint** — approved by operator 2026-04-14 (no code commit; verification-only task)

**Plan metadata:** (this commit — docs plan close)

## Files Created/Modified
- `scripts/generate-certs.sh` — Non-interactive mkcert wrapper; prints install hints if mkcert missing; outputs ./certs/internal.{crt,key}
- `docker-compose.yml` — Added frontend healthcheck (wget spider :5173, 5s/5s/10, 30s start_period); added npm service (image jc21/nginx-proxy-manager:2.11.3, ports 80/443/81, volumes npm_data+npm_letsencrypt, read-only ./certs:/etc/certs:ro, curl healthcheck :81, depends_on api+frontend service_healthy, restart unless-stopped); registered npm_data and npm_letsencrypt at top-level volumes
- `.gitignore` — Added `certs/` exclusion block with comment
- `.env.example` — Added NPM first-login credentials comment block (admin@example.com / changeme)

## Decisions Made

- **SAN cert over wildcard + individuals** — mkcert supports multi-SAN in a single command, NPM references one cert+key pair, simpler inventory
- **NPM 2.11.3 pinned** — matches CLAUDE.md pinned-version house rule; avoids surprise upgrades on `docker compose pull`
- **frontend healthcheck added now (not deferred to 26-02)** — without it, INF-05's gating chain has a hole: NPM would flap against a 502 while Vite compiles on first boot
- **Kept frontend's 5173:5173 port binding** — removing it here would break local dev before Plan 26-02 replaces it with NPM-fronted access via kpi.internal

## Deviations from Plan

None — plan executed exactly as written. Both implementation tasks landed on the first pass; the human-verify checkpoint was approved without rework requests.

## Issues Encountered

None during implementation. Operator noted they were on macOS and considered mkcert alternatives but proceeded with mkcert as specified — no script changes required.

## User Setup Required

Operator-side one-time setup (documented in 26-CONTEXT.md D-02, not a code deliverable):
- Install mkcert (`brew install mkcert nss` on macOS)
- Run `mkcert -install` once to trust the local CA
- Add `127.0.0.1 kpi.internal wiki.internal auth.internal` to `/etc/hosts`
- Run `./scripts/generate-certs.sh` to produce ./certs/internal.{crt,key}

Runbook for these steps is deferred to Plan 26-03.

## Checkpoint Confirmation

- **Task 3 (human-verify):** Approved 2026-04-14 by operator. Verified: full stack boots healthy in correct order, frontend reaches healthy before npm starts, NPM admin UI reachable on :81, volume persistence confirmed across `docker compose restart npm`.

## Open Questions Handed to Plan 26-02

- How to route `kpi.internal` through NPM to the Vite dev server once HMR is reconfigured (Plan 26-02 task)
- Whether NPM proxy-host entries can be provisioned declaratively or must be configured via admin UI (Plan 26-02 will decide; Plan 26-03 will document the chosen approach in the runbook)

## Next Phase Readiness

- NPM is live and healthy — Plan 26-02 can now define proxy hosts for kpi.internal and wiki.internal
- Certs on disk and mounted read-only into NPM — ready for NPM proxy-host SSL configuration
- Healthcheck chain solid — downstream phases (Dex, Outline) can reuse the same depends_on.service_healthy pattern when they add containers

---
*Phase: 26-npm-hostnames*
*Completed: 2026-04-14*

## Self-Check: PASSED

- scripts/generate-certs.sh — FOUND
- docker-compose.yml — FOUND
- .gitignore — FOUND
- .env.example — FOUND
- .planning/phases/26-npm-hostnames/26-01-SUMMARY.md — FOUND
- Commit 5b10f1d — FOUND
- Commit b2a082b — FOUND
