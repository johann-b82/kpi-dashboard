# Phase 26: NPM + Hostnames - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Nginx Proxy Manager becomes the single HTTPS entry point for KPI Light, Outline (future Phase 29), and Dex (future Phase 27). All browser traffic flows `https://*.internal → NPM → internal service ports`. Foundation phase for the v1.11 milestone — OIDC in later phases depends on stable, browser-reachable hostnames being live and TLS-terminated.

Out of scope:
- Dex or Outline config (later phases)
- Let's Encrypt / real-domain TLS (v2 — single-VM self-signed suffices now)
- Frontend code changes (no OIDC yet, no wiki icon yet)

</domain>

<decisions>
## Implementation Decisions

### Certificate Strategy
- **D-01:** Use `mkcert` to generate a local CA and a wildcard `*.internal` certificate (or individual certs per hostname, whichever is simpler). A `scripts/generate-certs.sh` script in the repo runs `mkcert` non-interactively so developers can reproduce the cert bundle on a new machine with one command.
- **D-02:** Developers and the production VM run `mkcert -install` once to trust the local CA — browser shows green padlock, no click-through warnings. README documents the one-time install step.
- **D-03:** Certificate files live in `./certs/` (gitignored — private keys). Repo includes a `.gitignore` entry and a README snippet covering regeneration.
- **D-04:** NPM loads the mkcert-generated certs via its "Custom SSL" proxy host configuration.

### Frontend Dev Behavior
- **D-05:** NPM proxies `https://kpi.internal` → `frontend:5173` with WebSocket upgrade configured for Vite HMR (Vite's `server.hmr.clientPort` or equivalent set to 443 so HMR reconnects over the NPM-terminated HTTPS).
- **D-06:** Vite config updated so `allowedHosts` includes `kpi.internal` (otherwise Vite rejects proxy-forwarded requests from an unknown host).
- **D-07:** Dev environment behaves identically to production — same hostnames, same TLS, same NPM routing. `DISABLE_AUTH=true` (from Phase 28) remains the escape hatch for pure UI work without Dex running.
- **D-08:** No `docker-compose.dev.yml` split — single compose file covers dev and single-VM prod. (Future multi-environment concerns deferred to v2.)

### NPM Admin Bootstrap
- **D-09:** Manual one-time NPM admin setup. First `docker compose up` brings NPM up with the default credentials (`admin@example.com` / `changeme`); operator logs into `http://$HOST:81` once, changes password, and creates the three proxy hosts (`kpi.internal`, `wiki.internal`, `auth.internal` — the latter two initially pointing at placeholder services or just NPM's default landing page until Phases 27 and 29 land).
- **D-10:** Setup runbook lives in `docs/setup.md` (or seeded into Outline later via DOC-01/DOC-08). Covers: mkcert install → generate certs → docker compose up → NPM first-login steps → hosts file entries.
- **D-11:** NPM data volume (`npm_data`) persists `/data` so the admin password + proxy-host config survive container restarts. Second volume (`npm_letsencrypt`) reserved for future Let's Encrypt rollout but created now to avoid schema surprise later.

### Claude's Discretion
- **Port exposure on host** — Drop `frontend:5173` and `api:8000` from host binding; route everything through NPM (`:80` / `:443`). Keep `:81` exposed for NPM admin UI. Keep `:8000` and `:5173` bind commented-out in compose so a dev can uncomment for direct debugging when needed.
- **Healthcheck gate** — NPM starts after `api` is healthy (existing pattern preserved). Brief 502 on fresh `compose up` for the window between NPM starting and `frontend` being ready is acceptable. Healthcheck on NPM itself via its `:81` admin endpoint or the routed proxy port.
- **Hosts file entries** — `127.0.0.1 kpi.internal wiki.internal auth.internal` added to `/etc/hosts` on each developer machine + the single-VM production host. README documents the line to add.
- **Compose service naming** — `npm` as the service name (matches convention; short, unambiguous in context).
- **Network isolation** — Keep the default compose network; no custom bridge network. NPM needs to reach `frontend`, `api`, and (later) `dex`, `outline` by service name — default bridge handles this.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing codebase
- `docker-compose.yml` — current 4-service stack (db, migrate, api, frontend); establishes healthcheck + depends_on patterns to preserve
- `frontend/vite.config.ts` — Vite config where `server.hmr.clientPort` and `allowedHosts` need updating
- `.env` and `.env.example` — env-var conventions

### Milestone-level docs
- `.planning/research/v1.11-SUMMARY.md` — research synthesis, architecture diagram, risk list
- `.planning/research/v1.11-dex.md` — Dex needs browser-reachable issuer URL at `https://auth.internal/dex` — Phase 27 depends on Phase 26 delivering this hostname correctly
- `.planning/research/v1.11-outline.md` — Outline needs `OIDC_AUTH_URI` browser-reachable at `https://auth.internal` — same dependency

### External (URLs — downstream agents look up if needed)
- mkcert: https://github.com/FiloSottile/mkcert
- Nginx Proxy Manager: https://nginxproxymanager.com/guide/
- Vite HMR behind reverse proxy: https://vitejs.dev/config/server-options.html#server-hmr

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Docker Compose patterns** — `depends_on: condition: service_healthy` gating, `.env` for secrets, alpine base images, named volumes
- **Healthcheck idioms** — `pg_isready`, `curl -f http://localhost:8000/health` — NPM should follow suit with an HTTP probe on `:81` admin port
- **Vite config** — `frontend/vite.config.ts` likely already has `server.host: true` for Docker; just needs HMR proxy additions

### Established Patterns
- No hardcoded secrets in compose YAML — everything via `.env`
- Healthcheck-gated service startup is the house style — NPM must have one
- Image tags pinned (e.g. `postgres:17-alpine`), not `latest` — NPM should pin to a specific version (recommend `jc21/nginx-proxy-manager:2.x`)

### Integration Points
- `docker-compose.yml` — add `npm` service, update `frontend` port bindings (likely remove `5173:5173` host binding; keep internal `EXPOSE 5173` via Dockerfile or compose)
- `frontend/vite.config.ts` — add `allowedHosts` + HMR clientPort for HTTPS proxy
- Repo root — add `scripts/generate-certs.sh` + `.gitignore` entry for `certs/`
- `README.md` — add setup section: prerequisites (Docker + mkcert), `/etc/hosts` line, first-run NPM admin steps

</code_context>

<specifics>
## Specific Ideas

- "mkcert with green padlock" is the explicit UX target — no browser warning nagging for the year until real Let's Encrypt lands
- NPM is chosen specifically for its admin UI — operator wants to manage proxy hosts visually, not edit YAML
- Certs go in `./certs/` (repo-root, gitignored) — consistent with the pattern of keeping infra config at repo root (docker-compose.yml, .env)
- Single-VM production deployment — not a multi-node swarm; everything simple

</specifics>

<deferred>
## Deferred Ideas

- **Let's Encrypt DNS-01** — activate when a real domain exists (AUTH2-03, v2)
- **Automated NPM bootstrap via API** — skipped for v1.11 (operator chose manual); revisit if rebuild cadence increases
- **Two-compose-file split (dev vs prod)** — not needed now; single-VM use case doesn't justify the complexity
- **Network isolation / custom bridge network** — default compose network suffices for v1.11

</deferred>

---

*Phase: 26-npm-hostnames*
*Context gathered: 2026-04-14*
