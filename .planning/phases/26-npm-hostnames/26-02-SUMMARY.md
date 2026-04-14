---
phase: 26-npm-hostnames
plan: 02
subsystem: infra
tags: [nginx-proxy-manager, vite, hmr, tls, wss, proxy-host, docker-compose]

# Dependency graph
requires:
  - phase: 26-01
    provides: NPM container live with mkcert SAN cert mounted read-only, frontend healthcheck gating boot order
provides:
  - frontend/vite.config.ts — allowedHosts whitelist (kpi.internal + localhost) and HMR-over-WSS config (clientPort 443, protocol wss, host kpi.internal)
  - docker-compose.yml — frontend and api direct host-port bindings removed (commented as debug hatches); NPM is sole edge
  - Three live NPM proxy hosts — kpi.internal (→ frontend:5173 http, Websockets ON, /api sub-location → api:8000), wiki.internal + auth.internal (placeholders → api:8000 http, repointed in 27 / 29)
  - NPM internal-wildcard SSL cert — mkcert ./certs/internal.{crt,key} uploaded as Custom cert, Force SSL + HTTP/2 enabled on all three hosts
  - Proven end-to-end flow: https://kpi.internal serves the dashboard with green padlock, HMR reconnects over wss, config survives docker compose restart npm
affects: [26-03-runbook, 27-dex, 29-oidc-kpi, 30-oidc-outline]

# Tech tracking
tech-stack:
  added:
    - Vite HMR-over-WSS pattern (clientPort 443 through HTTPS reverse proxy)
  patterns:
    - Explicit allowedHosts list (never `true`) preserves Vite 5.0.12+ SSRF protection
    - NPM as sole edge — container ports exist only on the docker network, host exposure is commented-out debug hatches
    - Proxy-host /api sub-location pattern — single origin (kpi.internal) serves both static SPA and API, avoiding CORS
    - Host-loopback healthchecks use 127.0.0.1 not localhost when the image uses busybox (avoids IPv6 ::1 resolution against an IPv4-only bind)

key-files:
  created:
    - .planning/phases/26-npm-hostnames/26-02-SUMMARY.md
  modified:
    - frontend/vite.config.ts
    - docker-compose.yml

key-decisions:
  - "Vite HMR pinned to wss://kpi.internal:443 via clientPort+protocol+host — the only combination that makes HMR reconnect through an HTTPS reverse proxy"
  - "allowedHosts retains 'localhost' alongside 'kpi.internal' so the commented debug bind on :5173 still works when an operator uncomments it"
  - "Host port bindings commented (not deleted) — keeps a zero-NPM debug hatch and documents the why inline next to the block"
  - "wiki.internal + auth.internal proxied to api:8000 (http) as placeholders — gives a working TLS padlock plus a reachable 404 instead of NPM-default; clean repoint target for Phase 27 (Dex on auth.internal) and Phase 29 (Outline on wiki.internal)"
  - "Manual NPM UI bootstrap accepted as canonical — no API automation in v1.11 (D-09); exact proxy-host config captured here for the 26-03 runbook"

patterns-established:
  - "HMR-over-HTTPS through reverse proxy: clientPort=443 + protocol='wss' + host=<public-hostname> in vite.config.ts server.hmr block"
  - "Single-origin SPA+API: proxy-host for the SPA with a /api location block proxying to the API service, avoiding CORS entirely"
  - "Loopback healthcheck rule: prefer 127.0.0.1 over localhost in container healthchecks when the base image is alpine/busybox, because busybox wget resolves localhost to ::1 first"

requirements-completed: [INF-01, INF-02]

# Metrics
duration: ~10min
completed: 2026-04-14
---

# Phase 26 Plan 02: kpi.internal End-to-End via NPM Summary

**Vite reconfigured for HMR-over-WSS behind NPM, host port bindings removed so NPM is the sole edge, three proxy hosts live (kpi.internal serving the SPA + /api, wiki.internal and auth.internal placeholders) — https://kpi.internal now loads the dashboard with a green padlock and working hot-reload.**

## Performance

- **Duration:** ~10 min (code) + human verification window
- **Tasks:** 3 (2 autonomous code edits + 1 human-verify checkpoint, approved)
- **Files modified:** 2 (frontend/vite.config.ts, docker-compose.yml)

## Accomplishments

- `https://kpi.internal` serves the KPI Light dashboard with a browser-trusted TLS padlock (mkcert CA)
- `/api/*` through NPM proxies cleanly to the api container — single-origin, no CORS
- Vite HMR reconnects over WSS through NPM — editing `.tsx` files hot-updates the browser without full reload
- Host-side `:5173` and `:8000` no longer exposed — all traffic flows through NPM (dev matches prod edge behavior per D-07)
- `wiki.internal` and `auth.internal` reachable over HTTPS with the same cert, ready to be repointed at Dex (Phase 27) and Outline (Phase 29)
- NPM proxy-host config persists across `docker compose restart npm` (validates 26-01 `npm_data` volume wiring)

## Task Commits

1. **Task 1: Vite HMR-over-WSS + allowedHosts** — `53bba69` (feat)
2. **Task 2: Remove direct host port bindings for frontend + api** — `86d259c` (feat)
3. **Task 3: Human-verify checkpoint (incl. NPM proxy-host manual bootstrap)** — approved by operator 2026-04-14 (no code commit; verification + manual NPM UI config)

**Out-of-band fix during verification:** `eab26c7` (fix) — see Deviations.

**Plan metadata:** (this commit — docs plan close)

## Files Created/Modified

- `frontend/vite.config.ts` — `server.allowedHosts: ["kpi.internal", "localhost"]` + `server.hmr: { clientPort: 443, protocol: "wss", host: "kpi.internal" }`; existing `server.host` and `/api` dev proxy preserved
- `docker-compose.yml` — `frontend` `ports: "5173:5173"` and `api` `ports: "8000:8000"` blocks replaced with commented-out debug hatches plus inline "why" comments; healthchecks and all other services untouched

## NPM Proxy-Host Configuration (as-built — 26-03 runbook source of truth)

**SSL Certificate (Custom upload):**
- Name: `internal-wildcard`
- Certificate file: `./certs/internal.crt`
- Key file: `./certs/internal.key`

**Proxy Host 1 — kpi.internal (flagship):**
- Details tab:
  - Domain Names: `kpi.internal`
  - Scheme: `http`
  - Forward Hostname / IP: `frontend`
  - Forward Port: `5173`
  - Cache Assets: off
  - Block Common Exploits: on (NPM default, kept)
  - **Websockets Support: ON** (critical for Vite HMR — D-05)
- SSL tab:
  - SSL Certificate: `internal-wildcard`
  - Force SSL: ON
  - HTTP/2 Support: ON
  - HSTS: off (internal-only hostnames, mkcert CA)
- Custom locations (one entry):
  - Location: `/api`
  - Scheme: `http`
  - Forward Hostname / IP: `api`
  - Forward Port: `8000`
  - Advanced: `proxy_set_header Host $host;` (ensures api sees the forwarded host header)

**Proxy Host 2 — wiki.internal (placeholder, repointed in Phase 29):**
- Details: Domain `wiki.internal`, scheme `http`, forward `api:8000`, Websockets off
- SSL: `internal-wildcard`, Force SSL ON, HTTP/2 ON

**Proxy Host 3 — auth.internal (placeholder, repointed in Phase 27):**
- Details: Domain `auth.internal`, scheme `http`, forward `api:8000`, Websockets off
- SSL: `internal-wildcard`, Force SSL ON, HTTP/2 ON

Placeholder choice rationale: forwarding to `api:8000` (rather than NPM default/offline) yields a working TLS handshake + a reachable 404 from FastAPI. This confirms DNS + TLS + docker-network routing end-to-end before Phases 27/29 plug in the real upstreams — and it's a one-field edit to swap `api:8000` for `dex:5556` / `outline:3000` later.

## Decisions Made

- **clientPort 443, protocol wss, host kpi.internal explicit in hmr block** — omitting any of the three causes the HMR client to guess wrong (default ws://localhost:5173) and websocket handshake fails through NPM. All three required together.
- **allowedHosts as explicit array, not `true`** — retains Vite 5.0.12+ SSRF protection; kept `localhost` in the list so the commented debug bind on :5173 still works for operators who uncomment it.
- **Commented host-port bindings (kept in-file, not deleted)** — preserves a zero-NPM debug hatch plus documents the "why" inline; a dev can uncomment a single line to bypass NPM.
- **Placeholders forward to api:8000, not NPM offline page** — proves end-to-end path (DNS → TLS → docker DNS → container) for all three hostnames now, so Phases 27/29 are swap-one-field operations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Frontend healthcheck failed on first compose up — busybox wget resolving `localhost` to IPv6 `::1`**
- **Found during:** Task 3 verification (first `docker compose up --build -d` of the full 26-02 stack)
- **Issue:** The frontend healthcheck added in 26-01 used `wget --spider http://localhost:5173`. On node:22-alpine, busybox wget resolves `localhost` to `::1` (IPv6) first, but Vite was bound to `0.0.0.0` (IPv4-only), so the probe failed with connection-refused. NPM stayed in `created` state because `depends_on.frontend.condition: service_healthy` never resolved. This was a latent 26-01 bug exposed only once NPM actually gated on the healthcheck in a full 26-02 boot.
- **Fix:** Changed the healthcheck target from `http://localhost:5173` to `http://127.0.0.1:5173` — forces IPv4, matches Vite's bind.
- **Files modified:** docker-compose.yml (frontend.healthcheck.test)
- **Verification:** `docker compose up --build -d` now progresses through `frontend (healthy)` in ~15s; NPM starts immediately after; all three hostnames serve content.
- **Committed in:** `eab26c7` — scoped to 26-01 (the healthcheck originated there) so the fix is co-located with its origin commit.

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in prior-plan artifact surfaced by this plan's integration)
**Impact on plan:** Necessary for correctness. No scope creep — fix was a single-line change to an existing healthcheck. Pattern added to `patterns-established` (loopback healthcheck rule) so future services avoid the same trap.

## Issues Encountered

- IPv6-vs-IPv4 healthcheck mismatch (documented above as a deviation). No other friction during checkpoint: HMR worked on the first proxy-host configuration attempt; `/api` sub-location forwarded correctly on first try; restart-persistence check passed.

## User Setup Required

Manual NPM UI bootstrap performed by operator during Task 3 checkpoint (documented above under "NPM Proxy-Host Configuration"). Plan 26-03 will formalize these steps in the runbook (exact click-paths, field values, screenshots optional).

## Checkpoint Confirmation

- **Task 3 (human-verify):** Approved 2026-04-14 by operator. Verified:
  - SSL cert `internal-wildcard` uploaded and attached to all three proxy hosts
  - `https://kpi.internal` renders the dashboard with green padlock
  - Vite HMR reconnects over WSS — editing `App.tsx` hot-updates without full reload
  - `https://wiki.internal` and `https://auth.internal` both reachable with working TLS (placeholder 404 from api container, as designed)
  - `docker compose restart npm` preserves all proxy-host config (validates `npm_data` volume from 26-01)

## Handoff to Plan 26-03 (Runbook)

The runbook must include:
1. `/etc/hosts` line: `127.0.0.1 kpi.internal wiki.internal auth.internal`
2. mkcert install + trust: `brew install mkcert nss && mkcert -install`
3. Cert generation: `./scripts/generate-certs.sh` (produces `./certs/internal.{crt,key}`)
4. `docker compose up --build -d` boot sequence
5. NPM first login at `http://localhost:81` with `admin@example.com / changeme` — force password change
6. SSL Certificates > Add (Custom) — upload `certs/internal.crt` + `certs/internal.key` as `internal-wildcard`
7. Proxy Hosts > Add (×3) — exact field values from the "NPM Proxy-Host Configuration" section above, including the `/api` custom location for kpi.internal with `proxy_set_header Host $host;`
8. Verification: browse to `https://kpi.internal` (dashboard + green padlock), edit a frontend file to test HMR, `curl -sk https://wiki.internal` and `https://auth.internal` for TLS reachability
9. Debug hatches: how to uncomment `5173:5173` / `8000:8000` in docker-compose.yml for direct-access debugging when NPM is off

## Next Plan Readiness

- kpi.internal end-to-end flow proven — Plan 26-03 has concrete, working steps to document
- Placeholder proxy hosts wiki.internal / auth.internal ready for Phase 27 (Dex on auth.internal, one-field repoint) and Phase 29 (Outline on wiki.internal, one-field repoint)
- Loopback-healthcheck rule codified — future alpine-based services in later phases should use 127.0.0.1 from day one

---
*Phase: 26-npm-hostnames*
*Completed: 2026-04-14*

## Self-Check: PASSED

- frontend/vite.config.ts — FOUND
- docker-compose.yml — FOUND
- .planning/phases/26-npm-hostnames/26-02-SUMMARY.md — FOUND
- Commit 53bba69 — FOUND
- Commit 86d259c — FOUND
- Commit eab26c7 — FOUND
