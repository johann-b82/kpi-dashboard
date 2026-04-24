# Phase 64: Reverse Proxy — Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Source:** Same-day LAN-access diagnostic on v1.21 Phase 62 walkthrough. Three compounding bugs (Directus loopback-only bind, `CORS_ORIGIN` locked to localhost, frontend SDK hardcoded to `http://localhost:8055`) made cross-host admin access impossible. Rather than patch individually, add a proper same-origin reverse proxy (option B from the diagnostic).

## Goal

Everything reachable from `http://<host>:80`. Admin SPA at `/`, FastAPI at `/api`, Directus at `/directus`, kiosk bundle at `/player/`. No CORS. Admin browser + Pi kiosk + Pi sidecar all talk to one hostname and port.

Precondition for Phase 62's CAL-PI-07 real-Pi walkthrough (Pi needs the admin URL reachable on LAN).

## Locked decisions

### D-01: Caddy 2 (alpine image)

Choice justification: tiny config (~20 lines), auto-compression, HTTP/2 by default, one binary. Traefik is overkill for a single-host internal tool; nginx requires more boilerplate. Caddy ships as `caddy:2-alpine` on Docker Hub — pin a minor.

### D-02: Port 80 HTTP only, no TLS this phase

Verified free on dev host (`lsof -i :80` returned empty). No cert management. TLS is a separate concern for external exposure; out of scope.

### D-03: Four routes, exact paths

```
/                → frontend:5173  (admin SPA + /login + /signage/pair + launcher)
/api/*           → api:8000       (FastAPI: device JWT admin + player + sidecar endpoints)
/directus/*      → directus:8055  (strip prefix — Directus expects bare /auth, /items, /assets, /server)
/player/*        → frontend:5173/player/  (Vite dev serves this as a separate entry; prod build writes to dist/player/)
```

**`/directus/*` prefix stripping is load-bearing.** Directus doesn't know it's behind a subpath — so Caddy must `uri strip_prefix /directus` on the proxy match.

### D-04: Directus CORS becomes noise, not a bug

With same-origin calls, Directus no longer needs `CORS_ORIGIN` to allow the SPA. Change to `CORS_ENABLED: "false"` or remove the whole block. Safer default = drop the CORS block entirely; if any direct-to-Directus call ever reappears, CORS will fail loudly rather than silently allowing an arbitrary origin.

### D-05: Frontend Directus client migrates to same-origin

`frontend/src/lib/directusClient.ts` line 3-5:

```ts
const DIRECTUS_URL = (import.meta.env.VITE_DIRECTUS_URL as string | undefined) ?? "http://localhost:8055";
```

Default changes to `/directus`. `VITE_DIRECTUS_URL` env var still overrides (so devs who want to hit Directus directly can do so). Update comment to mention the proxy.

### D-06: SSE must survive the proxy

`text/event-stream` connections are held open indefinitely by design. Default proxy timeouts (Caddy, nginx, etc.) will close them after ~60 s. Caddy needs:

- `flush_interval -1` on the `/api/*` handler (so chunks aren't buffered)
- Long transport `read_timeout` (or none) on the `/api/*` upstream
- No HTTP/1.1 `Connection: close` injected

SSE integration tests on player (`useSseWithPollingFallback.ts`) + sidecar (Phase 62-03 `_calibration_sse_loop`) depend on this.

### D-07: Directus can stay loopback-bound

Caddy reaches Directus over the internal Docker network (service name `directus:8055`). The host-side `127.0.0.1:8055:8055` port binding is no longer required for normal operation; can be removed or kept for direct Directus admin-UI access at `http://127.0.0.1:8055`. **Recommend keeping** for operator convenience (Directus admin UI is useful directly for user management).

### D-08: Frontend + API stay on their current ports

Docker-internal: `frontend:5173`, `api:8000`. Host-exposed ports `5173:5173` and `8000:8000` stay so direct dev access still works (Vite HMR benefits from this). Caddy is additive, not a replacement.

### D-09: Update `docker-compose.yml` healthchecks

Add a healthcheck for the new `caddy` service. Nothing else changes — existing `api`, `frontend`, `directus` healthchecks are untouched.

### D-10: Documentation touchpoints

- `README.md` — architecture section gains the proxy and updates the "Quick Start" example URL from `http://localhost:5173` to `http://localhost/`
- `docs/setup.md` (if it exists) — operator bring-up tweaked
- `scripts/provision-pi.sh` — the `:80` example URLs already match; confirm no change needed
- Operator-runbook entry in `frontend/src/docs/en/admin-guide/` + `de/admin-guide/` — one-paragraph note that the KPI Dashboard now lives on `:80`

### D-11: One plan, one wave, autonomous

~5 tasks. No human-verify. Verified end-to-end by hitting `http://localhost/login` and confirming admin auth + API calls + Directus calls + player bundle load all work through the proxy.

## Claude's discretion

- Whether to also drop the frontend `5173` and api `8000` host-port exposures after Caddy lands. **Guidance:** keep them for now; they don't hurt and they're useful for direct debugging. Hardening is out of scope.
- Exact Caddyfile formatting — Caddy accepts both a one-liner block and multi-line. Either is fine; pick readability.
- Whether to add a trailing-slash redirect for `/player` → `/player/` (tiny QoL thing).
- Whether to also update `VITE_API_TARGET` in `vite.config.ts` — probably not; the Vite dev server's proxy is independent of Caddy.

## Canonical refs

- `docker-compose.yml` — Caddy service gets inserted near `frontend:` / `api:`; Directus port binding decision lives here
- `frontend/src/lib/directusClient.ts` — D-05 change site
- `frontend/vite.config.ts:93-96` — existing Vite `/api` proxy (kept for direct-dev workflow)
- `scripts/provision-pi.sh:64,179-189` — the `:80` example URLs that finally work
- `pi-sidecar/sidecar.py:43` — sidecar reads `SIGNAGE_API_BASE` from env; provision-pi passes this; no sidecar change needed

## Non-goals (explicit)

- No TLS / HTTPS / cert-manager
- No external domain name routing
- No `vite-plugin-pwa` service-worker scope changes (the bundle precaches `/player/*` hashed assets, which still live at the same path through Caddy)
- No rate-limiting, auth at the proxy layer, or WAF rules
- No removal of existing host-port exposures (5173, 8000) — keeping for dev ergonomics

## Requirements traceability

| Req ID | Plan |
|---|---|
| PROXY-01 Caddy service + 4 routes | 64-01 |
| PROXY-02 SSE passthrough | 64-01 |
| PROXY-03 Directus same-origin cookies | 64-01 |
| PROXY-04 Player bundle + PWA | 64-01 |
| PROXY-05 Directus client URL migration + docs | 64-01 |

## Dependencies

- **Upstream:** none (Phase 62 + 63 are independent)
- **Downstream:** unblocks CAL-PI-07 human-verify walkthrough on the Pi
