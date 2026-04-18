---
phase: 26-npm-hostnames
verified: 2026-04-14T00:00:00Z
status: passed
score: 12/12 must-haves verified
---

# Phase 26: NPM + Hostnames Verification Report

**Phase Goal:** Nginx Proxy Manager runs as a compose service terminating HTTPS for all three hostnames (`kpi.internal`, `wiki.internal`, `auth.internal`) so downstream services have a stable, browser-reachable address before any OIDC wiring begins.

**Verified:** 2026-04-14
**Status:** passed
**Re-verification:** No — initial verification

Note: Phase 26 is pure infrastructure/docs (no runnable behavior to spot-check beyond `docker compose config`). Operator completed human verification during 26-01 and 26-02 checkpoints (stack running locally, all containers healthy, green-padlock browser test, HMR-over-WSS validated, NPM proxy-host persistence across restart confirmed). This verification cross-references those operator-confirmed checkpoints against the codebase artifacts that should persist them.

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria + plan must_haves)

| #   | Truth                                                                                                    | Status     | Evidence                                                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `docker compose up --build` starts full stack in correct healthcheck-gated order, no container crashes   | VERIFIED   | `docker compose config --quiet` parses cleanly. `depends_on` chain: db → migrate → api → frontend → npm all gated on `service_healthy` / `service_completed_successfully`. Operator confirmed live at 26-01. |
| 2   | `https://kpi.internal` serves KPI Light frontend and proxies `/api/*` to FastAPI                         | VERIFIED   | Vite `allowedHosts` + HMR WSS config in place (frontend/vite.config.ts:15-20). NPM proxy-host walkthrough documented in docs/setup.md §4.3. Operator confirmed in 26-02 checkpoint.                          |
| 3   | `https://wiki.internal` and `https://auth.internal` return reachable responses via NPM                   | VERIFIED   | Placeholder proxy-host treatment documented in docs/setup.md §4.3. Operator confirmed green-padlock reachability in 26-02 checkpoint.                                                                         |
| 4   | All three hostnames resolve on developer machine after `/etc/hosts` instructions                         | VERIFIED   | Verbatim line `127.0.0.1 kpi.internal wiki.internal auth.internal` present in docs/setup.md:47 and README.md:15 (character-match).                                                                            |
| 5   | TLS uses self-signed mkcert cert; browser shows secure connection                                        | VERIFIED   | `scripts/generate-certs.sh` produces SAN cert for three hostnames + wildcard. `mkcert -install` guidance in both script error path and docs/setup.md §2.1.                                                    |
| 6   | NPM only starts accepting traffic after api AND frontend are healthy (no 502 window)                     | VERIFIED   | `docker-compose.yml:87-91` — npm `depends_on: { api: service_healthy, frontend: service_healthy }`. Frontend has its own healthcheck (wget spider on :5173) at docker-compose.yml:58-63.                     |
| 7   | NPM admin UI reachable on :81 and /data + /etc/letsencrypt volumes persist across restart                | VERIFIED   | docker-compose.yml:68-74 — port 81 bound, `npm_data` and `npm_letsencrypt` named volumes declared and mounted. Operator confirmed persistence test in 26-01 checkpoint.                                      |
| 8   | `./certs/` is gitignored so private keys never reach the repo                                            | VERIFIED   | `.gitignore` contains `certs/` under a labeled "TLS certificates" section.                                                                                                                                    |
| 9   | Vite HMR reconnects over WSS through NPM (edit file → hot reload without page refresh)                   | VERIFIED   | `frontend/vite.config.ts:16-20` — `hmr: { clientPort: 443, protocol: "wss", host: "kpi.internal" }`. Operator confirmed live HMR in 26-02 checkpoint.                                                         |
| 10  | Developer can follow docs/setup.md to reach working https://kpi.internal green padlock without help      | VERIFIED   | 7-section runbook at docs/setup.md covering prerequisites, one-time setup, per-checkout, NPM bootstrap, verification, troubleshooting, v2 LE migration.                                                       |
| 11  | `/etc/hosts` line documented verbatim in both README.md and docs/setup.md                                | VERIFIED   | Exact match: README.md:15 and docs/setup.md:47 both read `127.0.0.1 kpi.internal wiki.internal auth.internal`.                                                                                                |
| 12  | Future Let's Encrypt DNS-01 migration path mentioned (even if deferred to v2)                            | VERIFIED   | docs/setup.md §7 ("Future (v2 — AUTH2-03): Let's Encrypt Migration Path") — explains `npm_letsencrypt` volume pre-mount and DNS-01 via NPM admin UI.                                                          |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact                   | Expected                                                                                   | Status     | Details                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/generate-certs.sh` | mkcert wrapper for three `*.internal` hostnames                                           | VERIFIED   | 52 lines, executable, passes `bash -n`, invokes `mkcert` with SAN list `kpi.internal wiki.internal auth.internal "*.internal"`.  |
| `docker-compose.yml`       | npm service + frontend healthcheck + depends_on api+frontend healthy                      | VERIFIED   | Contains `jc21/nginx-proxy-manager:2.11.3`, `npm_data`, `npm_letsencrypt`, `./certs:/etc/certs:ro`. Wired + config parses clean. |
| `.gitignore`               | `certs/` excluded from VCS                                                                 | VERIFIED   | `certs/` line present with labeled section header.                                                                                |
| `.env.example`             | NPM first-login credential guidance                                                        | VERIFIED   | Comment block documents admin@example.com / changeme + change-on-first-login requirement.                                        |
| `frontend/vite.config.ts`  | allowedHosts whitelist + HMR clientPort 443/wss/host                                       | VERIFIED   | All three hmr fields present; `allowedHosts: ["kpi.internal", "localhost"]`. Existing `/api` dev proxy preserved.                 |
| `docker-compose.yml` (Plan 02) | frontend + api host port bindings commented out                                        | VERIFIED   | Lines 26-29 (api) and 44-47 (frontend) show commented-out `5173:5173` and `8000:8000` with inline rationale.                     |
| `docs/setup.md`            | 7-section runbook                                                                          | VERIFIED   | 268 lines. All required anchors present: `mkcert -install`, verbatim hosts line, `location /api` block, Websockets Support.      |
| `README.md`                | Quickstart + Hostnames table + link to docs/setup.md                                       | VERIFIED   | Quickstart at §Quickstart with `docker compose up --build`, hostnames table, hosts-file line, two links to docs/setup.md.       |

### Key Link Verification

| From                                   | To                                    | Via                                          | Status | Details                                                                                               |
| -------------------------------------- | ------------------------------------- | -------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| docker-compose.yml npm service         | ./certs/ on host                      | read-only bind mount                         | WIRED  | `./certs:/etc/certs:ro` at docker-compose.yml:78.                                                     |
| docker-compose.yml npm service         | api service                           | depends_on.api.condition: service_healthy    | WIRED  | docker-compose.yml:88-89.                                                                             |
| docker-compose.yml npm service         | frontend service                      | depends_on.frontend.condition: service_healthy | WIRED  | docker-compose.yml:90-91.                                                                             |
| docker-compose.yml frontend service    | Vite dev server :5173                 | wget spider healthcheck                      | WIRED  | docker-compose.yml:58-63.                                                                             |
| frontend/vite.config.ts server.hmr     | browser at https://kpi.internal       | clientPort 443 + wss                         | WIRED  | frontend/vite.config.ts:16-20.                                                                        |
| frontend/vite.config.ts allowedHosts   | NPM forwarded Host header             | `kpi.internal` in array                      | WIRED  | frontend/vite.config.ts:15.                                                                           |
| NPM proxy host kpi.internal            | frontend:5173                         | websocket upgrade (manual NPM config)        | WIRED  | Operator confirmed in 26-02 checkpoint; documented in docs/setup.md §4.3 "Websockets Support: ON".   |
| README.md Quickstart                   | docs/setup.md                         | markdown link                                | WIRED  | Two links in README (Quickstart para + Documentation section).                                        |

### Data-Flow Trace (Level 4)

N/A — Phase 26 is pure infrastructure/docs. No runtime data variables render dynamic content produced by code authored in this phase. Dynamic behavior (Vite HMR, NPM proxy resolution) was confirmed live by operator during checkpoints.

### Behavioral Spot-Checks

| Behavior                                            | Command                                      | Result                        | Status |
| --------------------------------------------------- | -------------------------------------------- | ----------------------------- | ------ |
| Cert script syntax valid                            | `bash -n scripts/generate-certs.sh`          | exit 0                        | PASS   |
| Cert script executable                              | `test -x scripts/generate-certs.sh`          | executable                    | PASS   |
| docker-compose.yml parses                           | `docker compose config --quiet`              | exit 0                        | PASS   |
| .gitignore excludes certs/                          | grep `^certs/` .gitignore                    | match                         | PASS   |
| docs/setup.md has verbatim hosts line               | grep in docs/setup.md                        | match at line 47              | PASS   |
| README.md has verbatim hosts line                   | grep in README.md                            | match at line 15              | PASS   |
| Live stack healthy (operator-confirmed)             | `docker compose ps` during 26-01/26-02       | all services healthy          | PASS (human) |
| Green-padlock https://kpi.internal + HMR working    | Browser test during 26-02 checkpoint         | confirmed                     | PASS (human) |

### Requirements Coverage

| Requirement | Source Plan     | Description                                                                                         | Status    | Evidence                                                                                                           |
| ----------- | --------------- | --------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------ |
| INF-01      | 26-01, 26-02    | NPM runs as compose service terminating all HTTPS                                                   | SATISFIED | `npm` service (docker-compose.yml:65-91) with ports 80/443/81 and cert bind mount.                                 |
| INF-02      | 26-02           | Three hostnames route distinct services (kpi→frontend+api, wiki→Outline, auth→Dex placeholder)     | SATISFIED | Vite config accepts kpi.internal; NPM proxy-host walkthrough in docs/setup.md §4.3 covers all three hosts + `/api` sub-location. Operator confirmed. |
| INF-03      | 26-03           | `/etc/hosts` entries documented in README                                                           | SATISFIED | Verbatim line in both README.md:15 and docs/setup.md:47.                                                           |
| INF-04      | 26-01, 26-03    | Self-signed TLS + LE DNS-01 future hook documented                                                  | SATISFIED | `scripts/generate-certs.sh` produces mkcert SAN cert; docs/setup.md §7 documents v2 LE migration; `npm_letsencrypt` volume pre-mounted. |
| INF-05      | 26-01           | Healthcheck-gated dependency order for full stack                                                   | SATISFIED | db→migrate→api→frontend→npm chain with `service_healthy` / `service_completed_successfully` conditions throughout. |

No orphaned requirements. All five INF-0x IDs mapped to this phase in REQUIREMENTS.md appear in plan frontmatter and have implementation evidence.

### Anti-Patterns Found

None. No TODO/FIXME/PLACEHOLDER markers in phase-modified files. No stub returns, no hardcoded empty state, no console.log-only handlers. Commented-out port bindings in docker-compose.yml are intentional debug hatches with explanatory inline comments (not dead code).

### Human Verification Required

None outstanding. The operator already completed live-stack verification during 26-01 and 26-02 checkpoints:
- Checkpoint 26-01: Container boot ordering, NPM reachable on :81, npm_data persistence across restart.
- Checkpoint 26-02: Browser load of https://kpi.internal with green padlock, /api/* proxy, HMR-over-WSS, wiki.internal + auth.internal placeholder reachability, NPM proxy-host persistence across restart.

### Gaps Summary

None. Phase 26 goal achieved. All 12 truths verified, all 8 artifacts substantive and wired, all 8 key links connected, all 5 requirements satisfied. Live-stack validations were completed and logged in the per-plan SUMMARYs.

---

_Verified: 2026-04-14_
_Verifier: Claude (gsd-verifier)_
