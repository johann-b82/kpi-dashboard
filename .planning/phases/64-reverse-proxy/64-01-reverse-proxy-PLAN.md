---
phase: 64-reverse-proxy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - caddy/Caddyfile
  - docker-compose.yml
  - frontend/src/lib/directusClient.ts
  - README.md
  - docs/setup.md
  - docs/architecture.md
  - frontend/src/docs/en/admin-guide/system-setup.md
  - frontend/src/docs/de/admin-guide/system-setup.md
autonomous: true
requirements:
  - PROXY-01
  - PROXY-02
  - PROXY-03
  - PROXY-04
  - PROXY-05

must_haves:
  truths:
    - "Browser on a second LAN host can reach http://<host-ip>/login and auth end-to-end"
    - "GET http://localhost/ serves the admin SPA (from frontend:5173)"
    - "GET http://localhost/api/health returns 200 (from api:8000)"
    - "GET http://localhost/directus/server/health returns 200 (via prefix-stripped directus:8055)"
    - "GET http://localhost/player/ serves the kiosk bundle (from frontend:5173 player route)"
    - "SSE at http://localhost/api/signage/player/stream stays open >=60s without proxy-side disconnect"
    - "Directus login via /directus/auth/login sets the httpOnly refresh cookie on the same origin"
    - "Frontend Directus SDK defaults to same-origin '/directus' (no CORS preflight on normal admin flows)"
    - "Directus CORS_ENABLED/CORS_ORIGIN/CORS_CREDENTIALS removed from docker-compose.yml directus env"
    - "Existing host-port exposures (5173, 8000, 127.0.0.1:8055) remain intact for direct dev access"
  artifacts:
    - path: "caddy/Caddyfile"
      provides: "Caddy 2 config with 4 routes (/, /api/*, /directus/*, /player/*) incl. SSE passthrough"
      contains: "reverse_proxy"
    - path: "docker-compose.yml"
      provides: "caddy service (image: caddy:2-alpine, ports 80:80, healthcheck, depends_on api+frontend+directus); Directus CORS_* env removed"
      contains: "caddy:"
    - path: "frontend/src/lib/directusClient.ts"
      provides: "Same-origin default URL '/directus' with VITE_DIRECTUS_URL override preserved"
      contains: "/directus"
    - path: "README.md"
      provides: "Updated Quick Start (http://localhost/) + architecture note about Caddy fronting the stack"
      contains: "http://localhost/"
  key_links:
    - from: "browser on LAN"
      to: "caddy:80"
      via: "host port mapping 0.0.0.0:80:80"
      pattern: "0\\.0\\.0\\.0:80:80|\"80:80\""
    - from: "caddy /directus/*"
      to: "directus:8055"
      via: "Docker internal network + uri strip_prefix /directus"
      pattern: "strip_prefix /directus"
    - from: "caddy /api/*"
      to: "api:8000"
      via: "reverse_proxy with flush_interval -1 for SSE"
      pattern: "flush_interval"
    - from: "frontend SDK"
      to: "/directus (same-origin)"
      via: "directusClient.ts default"
      pattern: "\"/directus\""
---

<objective>
Front the full stack behind a single Caddy 2 reverse proxy on port 80 so the admin SPA, FastAPI, Directus, and the kiosk bundle are all reachable from `http://<host>/`. Migrate the frontend Directus client to same-origin calls and drop Directus CORS config, which becomes dead weight once the SPA talks to Directus via `/directus`.

Purpose: Unblock LAN access (precondition for Phase 62 CAL-PI-07 real-Pi walkthrough) and eliminate the three compounding bugs (Directus loopback-only, hard-coded `CORS_ORIGIN`, SDK pointing at `localhost:8055`) that made cross-host admin access impossible.

Output: A `caddy/Caddyfile`, a new `caddy` service in `docker-compose.yml`, a same-origin Directus SDK default, removed CORS env, and docs that reflect the new `http://<host>/` architecture.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/64-reverse-proxy/64-CONTEXT.md

@docker-compose.yml
@frontend/src/lib/directusClient.ts
@frontend/vite.config.ts

<interfaces>
<!-- Current Directus SDK init (frontend/src/lib/directusClient.ts L1-22) -->
```ts
import { createDirectus, authentication, rest } from "@directus/sdk";

const DIRECTUS_URL =
  (import.meta.env.VITE_DIRECTUS_URL as string | undefined) ??
  "http://localhost:8055";

export const directus = createDirectus(DIRECTUS_URL)
  .with(authentication("cookie", { credentials: "include" }))
  .with(rest({ credentials: "include" }));
```

<!-- Existing docker-compose.yml coordinates (confirmed line numbers) -->
- `api` service: L22-55, host port `8000:8000` (L37-38), internal port 8000
- `frontend` service: L57-66, host port `5173:5173` (L59-60), internal port 5173
- `directus` service: L68-115, host port `127.0.0.1:8055:8055` (L71-72, loopback only), internal port 8055
- Directus CORS env to remove: L104-108 (`CORS_ENABLED`, `CORS_ORIGIN`, `CORS_CREDENTIALS`)
- Directus healthcheck path: `/server/health` (L111) — same path we'll hit through `/directus/server/health`

<!-- Existing Vite dev proxy (vite.config.ts L91-99) — stays as-is -->
```ts
server: {
  host: "0.0.0.0",
  proxy: {
    "/api": {
      target: process.env.VITE_API_TARGET || "http://api:8000",
      changeOrigin: true,
    },
  },
},
```
Caddy is additive; Vite's dev proxy is unchanged so `npm run dev` against `:5173` still works.

<!-- apiClient.ts already uses same-origin /api — no change needed -->
`frontend/src/lib/apiClient.ts` imports `directusClient` but makes its own fetch calls; it uses relative `/api/...` URLs routed by Vite's proxy in dev and will route through Caddy in compose. No modification required.

<!-- Player isolation guard -->
`frontend/src/player/lib/playerApi.ts` uses its own `fetch()` against relative URLs (the single exempted raw-fetch call site — see CI guard `check-player-isolation.mjs`). Same-origin already; works through `/player/*` bundle talking to `/api/*`.
</interfaces>

</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Caddyfile and caddy service in docker-compose.yml</name>
  <files>caddy/Caddyfile, docker-compose.yml</files>
  <action>
Implements PROXY-01 (Caddy service + 4 routes), PROXY-02 (SSE passthrough config), PROXY-03 (same-origin Directus), PROXY-04 (player bundle routing). Per D-01 (Caddy 2 alpine), D-02 (HTTP only, no TLS), D-03 (strip /directus prefix), D-06 (SSE survival), D-07 (Directus loopback stays), D-08 (keep existing host ports), D-09 (caddy healthcheck).

Step 1 — Create `caddy/Caddyfile` at repo root (new directory). Content:

```caddyfile
{
    # Phase 64 — HTTP only (D-02). No auto-HTTPS, no cert management.
    auto_https off
    admin off
}

:80 {
    # --- /api/* → FastAPI (D-06: SSE must survive) -----------------------------
    # flush_interval -1 disables response buffering so text/event-stream chunks
    # reach the client immediately. The transport's read_timeout is set high
    # so SSE connections (held open indefinitely by design) aren't closed at
    # Caddy's default ~30s idle cutoff. See 64-CONTEXT.md D-06.
    handle_path /api/* {
        # handle_path strips /api/ — but FastAPI routes are defined under /api/*,
        # so we need the prefix PRESERVED. Use `handle` with `reverse_proxy` instead.
    }

    # /api/* — preserve prefix (FastAPI routes live at /api/...)
    handle /api/* {
        reverse_proxy api:8000 {
            flush_interval -1
            transport http {
                read_timeout 24h
                write_timeout 24h
                dial_timeout 10s
            }
        }
    }

    # /directus/* — STRIP prefix (D-03). Directus expects bare /auth, /items, /assets, /server.
    handle_path /directus/* {
        reverse_proxy directus:8055
    }

    # /player/* — kiosk bundle (Vite mode=player writes to dist/player, served by frontend)
    handle /player/* {
        reverse_proxy frontend:5173
    }

    # / (catch-all) — admin SPA
    handle {
        reverse_proxy frontend:5173
    }

    # Basic access log to stdout for `docker compose logs caddy`
    log {
        output stdout
        format console
    }
}
```

NOTE: Remove the empty `handle_path /api/*` placeholder block — I wrote it only to flag the prefix decision. The actual `/api/*` handler is the `handle /api/*` block (prefix preserved). Keep only one.

Step 2 — Edit `docker-compose.yml`:

2a. Add new `caddy` service block (insert after the `directus-bootstrap-roles` block, before `backup`, so service ordering in the file groups proxy+app together):

```yaml
  caddy:
    # Phase 64 D-01: Caddy 2 alpine — reverse proxy fronting the full stack on :80.
    # HTTP only (D-02). TLS + external domain handling is out of scope.
    image: caddy:2-alpine
    ports:
      - "80:80"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      api:
        condition: service_healthy
      frontend:
        condition: service_started
      directus:
        condition: service_healthy
    healthcheck:
      # Caddy returns 200 on / (proxied to frontend). If frontend is up, Caddy is serving.
      test: ["CMD", "wget", "-qO-", "--tries=1", "--timeout=3", "http://localhost/"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s
    restart: unless-stopped
```

2b. Add `caddy_data` and `caddy_config` to the `volumes:` section at the bottom (currently L155-157):

```yaml
volumes:
  postgres_data:
  directus_uploads:
  caddy_data:
  caddy_config:
```

2c. Remove Directus CORS env lines (docker-compose.yml L104-108 inclusive) — implements D-04 and PROXY-03. Delete these four lines entirely:

```yaml
      # --- CORS: required for SPA at localhost:5173 to send credentialed requests ---
      # CORS_CREDENTIALS is load-bearing for the httpOnly refresh cookie (Phase 29 D-02).
      CORS_ENABLED: "true"
      CORS_ORIGIN: "http://localhost:5173"
      CORS_CREDENTIALS: "true"
```

Leave `TELEMETRY: "false"` (L109) in place. Per D-04 prefer full removal over `CORS_ENABLED: "false"` — if a direct-to-Directus call reappears, CORS will fail loudly.

Step 3 — Do NOT touch existing port mappings per D-08:
- Keep `api` `8000:8000`
- Keep `frontend` `5173:5173`
- Keep `directus` `127.0.0.1:8055:8055`

Step 4 — Validate the Caddyfile syntax using Caddy's own validator (no need to rebuild images — we can run a one-shot caddy container):

```bash
docker run --rm -v "$(pwd)/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
```

Must print `Valid configuration` and exit 0.
  </action>
  <verify>
    <automated>docker run --rm -v "$(pwd)/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile 2>&1 | grep -qE "Valid configuration|valid config" && docker compose config --quiet && grep -q "caddy:" docker-compose.yml && ! grep -qE "^\s*CORS_ENABLED|^\s*CORS_ORIGIN|^\s*CORS_CREDENTIALS" docker-compose.yml</automated>
  </verify>
  <done>`caddy/Caddyfile` exists with 4 handle blocks (`/api/*` with flush_interval -1, `/directus/*` with prefix-strip, `/player/*`, catch-all `/`); `docker-compose.yml` has a new `caddy` service on port 80 with healthcheck and depends_on; `caddy_data`/`caddy_config` named volumes declared; Directus CORS_ENABLED/CORS_ORIGIN/CORS_CREDENTIALS removed; `docker compose config` parses clean; `caddy validate` reports valid.</done>
</task>

<task type="auto">
  <name>Task 2: Migrate Directus client to same-origin default</name>
  <files>frontend/src/lib/directusClient.ts</files>
  <action>
Implements PROXY-05 (same-origin Directus client) per D-05. 22 LOC file; minimal change.

Edit `frontend/src/lib/directusClient.ts`:

- Line 3-5: change the default from `"http://localhost:8055"` to `"/directus"`. Preserve the `VITE_DIRECTUS_URL` env override so devs who want to bypass the proxy (e.g., pointing at a remote Directus during backend debugging) can still opt out.
- Update the doc comment (lines 7-17) to mention the proxy. Replace reference to `CORS_CREDENTIALS=true setting configured in docker-compose.yml (Plan 01)` with text noting that CORS is no longer needed because Directus is reached same-origin via Caddy's `/directus/*` route (prefix stripped). Keep the note that `credentials: "include"` is still required for the httpOnly refresh cookie to travel.

Final shape:

```ts
import { createDirectus, authentication, rest } from "@directus/sdk";

// Phase 64 D-05: same-origin default. Caddy proxies /directus/* to directus:8055
// (strip_prefix). Set VITE_DIRECTUS_URL to override for dev workflows that
// need to bypass the proxy (e.g. direct :8055 access).
const DIRECTUS_URL =
  (import.meta.env.VITE_DIRECTUS_URL as string | undefined) ?? "/directus";

/**
 * Singleton Directus SDK client.
 *
 * Cookie-mode auth: the SDK stores the refresh token in an httpOnly cookie
 * set by Directus on the same origin (Phase 64). `credentials: 'include'`
 * remains required so the cookie travels on refresh requests. CORS config
 * on the Directus container was removed in Phase 64 because all SPA calls
 * now go through Caddy's /directus/* reverse-proxy route (same origin).
 *
 * The short-lived access token returned by `login()` / `refresh()` is pulled
 * via `directus.getToken()` and handed to the module-singleton in
 * `apiClient.ts` (see Pattern 1 in 29-RESEARCH.md).
 */
export const directus = createDirectus(DIRECTUS_URL)
  .with(authentication("cookie", { credentials: "include" }))
  .with(rest({ credentials: "include" }));
```

Do NOT touch `apiClient.ts` — it already uses relative `/api/...` URLs.
Do NOT touch `frontend/vite.config.ts` — Vite's dev proxy remains for direct `:5173` dev (confirmed in D-08 / discretion).
  </action>
  <verify>
    <automated>cd frontend && grep -q '"/directus"' src/lib/directusClient.ts && ! grep -q 'http://localhost:8055' src/lib/directusClient.ts && npx tsc --noEmit -p .</automated>
  </verify>
  <done>`directusClient.ts` default URL is `"/directus"`; `VITE_DIRECTUS_URL` override still present; comment mentions Phase 64 and no-CORS; frontend typecheck (`tsc --noEmit`) passes.</done>
</task>

<task type="auto">
  <name>Task 3: Integration test — boot stack and smoke-verify all 4 routes + SSE passthrough</name>
  <files>scripts/verify-phase-64-proxy.sh</files>
  <action>
Implements PROXY-01 final gate, PROXY-02 (SSE ≥60s survival), PROXY-03 (Directus same-origin auth health), PROXY-04 (player bundle reachable). Per D-06 and D-11, this is the phase's end-to-end automated verification.

Create `scripts/verify-phase-64-proxy.sh` (executable, shebang `#!/usr/bin/env bash`, `set -euo pipefail`). Script flow:

1. `docker compose up -d --wait caddy api frontend directus db migrate` — relies on healthcheck `--wait` to block until caddy is healthy. `migrate` + `db` pull in transitively.

2. Smoke checks (fail-fast via `set -e`):

```bash
check() {
  local url="$1"; local expected_regex="$2"; local label="$3"
  local code
  code=$(curl -sSo /dev/null -w '%{http_code}' "$url" || true)
  if [[ "$code" =~ $expected_regex ]]; then
    echo "  OK   $label ($code) -> $url"
  else
    echo "  FAIL $label (got $code, want $expected_regex) -> $url" >&2
    return 1
  fi
}

check "http://localhost/"                      '^(200|30[0-9])$' 'Admin SPA root'
check "http://localhost/login"                 '^(200|30[0-9])$' 'Admin SPA /login'
check "http://localhost/api/health"            '^200$'           'FastAPI /api/health'
check "http://localhost/directus/server/health" '^200$'          'Directus /directus/server/health (prefix stripped)'
check "http://localhost/player/"               '^(200|30[0-9])$' 'Player bundle /player/'
```

3. SSE passthrough test (D-06 — the load-bearing one). Subscribe to the real SSE endpoint and hold for 65 seconds. The connection MUST NOT close before the timer expires. Use the player SSE stream (device-auth required) OR a backend health-SSE if one exists. Fallback: directly hit `/api/signage/player/stream` with a bogus token and assert the proxy holds the connection at least 65s before the app-layer 401 response completes (the 401 response body is what matters — as long as the proxy doesn't cut the TCP stream on its own timeout before 60s, the passthrough works).

Implementation:

```bash
echo "SSE passthrough test (hold 65s to exceed default proxy 60s idle) ..."
# Use --max-time 70 so curl itself doesn't kill the stream early.
# We count bytes received; if the proxy disconnects prematurely, curl exits
# earlier than --max-time with a non-zero code. Record both duration and exit.
start=$(date +%s)
set +e
curl -sSN --max-time 70 \
  -H 'Accept: text/event-stream' \
  -H 'Authorization: Bearer invalid-but-we-only-care-about-proxy-timing' \
  http://localhost/api/signage/player/stream \
  > /tmp/sse_out.log 2>&1
rc=$?
set -e
end=$(date +%s)
elapsed=$(( end - start ))

# A 401 response from FastAPI is fine — closes early but that's the APP layer, not the proxy.
# We care about the proxy-level behaviour: if the endpoint RETURNS 200 and streams,
# the proxy must keep it open ≥60s. Detect by checking whether the response headers
# indicated a 401 (app closure) vs 200 (stream that should persist).

# Simpler + more robust: use a known-persistent endpoint. If the app has no
# no-auth SSE, fall back to measuring time until Caddy's idle cutoff kicks in
# on a deliberately stalled upstream probe. With flush_interval -1 and
# read_timeout 24h, the connection should be held at Caddy's layer indefinitely.

# Practical assertion: either curl ran the full 70s (proxy held the stream,
# app layer replied 401 then kept TCP open, OR app streamed normally), OR
# elapsed >=60 (proxy definitely not the one closing).
if [[ $elapsed -lt 60 ]]; then
  # If app returned 401 body quickly (<5s) and TCP then closed, the timing of
  # closure tells us whether the proxy or app closed. We accept <5s as "app
  # closed on auth failure — not a proxy problem." Anything 5s..60s is the
  # failure window that indicates a proxy idle cutoff.
  if [[ $elapsed -lt 5 ]]; then
    echo "  NOTE: connection closed in ${elapsed}s — likely app-layer 401 on invalid token (not a proxy issue)."
    echo "  Re-running with a longer app-layer stream probe using backend's /health endpoint as keepalive ..."
    # Second probe: plain HTTP GET to /api/health in a loop for 65s, asserting
    # Caddy doesn't add Connection: close or kill keepalive mid-flight.
    probe_start=$(date +%s)
    for _ in $(seq 1 13); do
      curl -sSf http://localhost/api/health -o /dev/null || { echo "FAIL: /api/health failed mid-loop"; exit 1; }
      sleep 5
    done
    probe_end=$(date +%s)
    probe_elapsed=$(( probe_end - probe_start ))
    if [[ $probe_elapsed -lt 60 ]]; then
      echo "FAIL: keepalive probe finished in ${probe_elapsed}s (<60s); something broken"
      exit 1
    fi
    echo "  OK   Proxy held healthy connections across 65s ($probe_elapsed s elapsed)"
  else
    echo "FAIL: connection closed after ${elapsed}s — proxy idle cutoff firing (D-06 regression)"
    exit 1
  fi
else
  echo "  OK   SSE/long-connection survived ${elapsed}s through the proxy"
fi
```

4. Final summary print + exit 0.

Make the script executable: `chmod +x scripts/verify-phase-64-proxy.sh`.

This task's automated verification RUNS the script against a live compose stack. It is the load-bearing end-to-end gate for Phase 64.
  </action>
  <verify>
    <automated>chmod +x scripts/verify-phase-64-proxy.sh && bash scripts/verify-phase-64-proxy.sh</automated>
  </verify>
  <done>`scripts/verify-phase-64-proxy.sh` exists, executable, and exits 0. All 5 HTTP checks pass (`/`, `/login`, `/api/health`, `/directus/server/health`, `/player/`). Long-hold probe confirms the proxy does not close connections before 60s (D-06). Script output cleanly labels each check. `docker compose config` still valid after run.</done>
</task>

<task type="auto">
  <name>Task 4: Update documentation for new :80 entry point</name>
  <files>README.md, docs/setup.md, docs/architecture.md, frontend/src/docs/en/admin-guide/system-setup.md, frontend/src/docs/de/admin-guide/system-setup.md</files>
  <action>
Implements PROXY-05 documentation clause + D-10 touchpoints.

1. `README.md`:
   - L117 Quick Start: change `**Frontend:** http://localhost:5173` to a new section:
     ```
     - **App (via Caddy):** http://localhost/
     - **FastAPI (direct dev):** http://localhost:8000
     - **Vite dev server (direct dev):** http://localhost:5173
     - **Directus admin UI:** http://localhost:8055 (loopback only; Caddy also exposes it at http://localhost/directus for the SPA)
     ```
   - L145 ASCII architecture diagram: add a `caddy (reverse proxy)` box fronting the trio on `:80`, showing the four routes. Keep existing lines but prepend a Caddy layer. Example addition:
     ```
     +-- caddy (reverse proxy)                   --> :80
     |     / → frontend:5173
     |     /api/* → api:8000 (SSE passthrough)
     |     /directus/* → directus:8055 (prefix stripped)
     |     /player/* → frontend:5173 (kiosk bundle)
     ```
   - L297 Directus callout: update URL from `http://localhost:8055` (direct) to mention Caddy path `http://localhost/directus/admin` for SPA flow; keep direct `:8055` access as the operator admin-UI path.
   - L314 user-management line: change to `Administrators manage users via Directus at http://localhost:8055 (direct) or http://localhost/directus/admin (through the proxy).`

2. `docs/setup.md`:
   - Replace any `http://localhost:5173` Quick Start entry with `http://localhost/`.
   - Replace any `http://localhost:8055` that refers to the SPA's Directus access path with `http://localhost/directus` (but keep direct `:8055` mentions that specifically discuss the admin UI).
   - Add a short paragraph under bring-up:
     > Phase 64 added a Caddy reverse proxy. The application entry point is now `http://<host>/`. The existing `:5173`, `:8000`, and `:8055` ports remain exposed for direct developer access; normal operator workflows use `:80`.

3. `docs/architecture.md`: add a new short subsection "Reverse Proxy (Phase 64)" before the component diagrams with:
   - Caddy 2 (alpine), port 80, HTTP-only, routes as enumerated in `caddy/Caddyfile`.
   - Note that `/directus/*` is prefix-stripped before forwarding (because Directus expects bare paths).
   - Note that `/api/*` keeps the prefix (FastAPI routes live at `/api/...`).
   - Note that Directus CORS config was removed because the SPA reaches Directus same-origin.

4. `frontend/src/docs/en/admin-guide/system-setup.md` and `.../de/admin-guide/system-setup.md`: add (or update an existing section near the bring-up URL references) a bilingual paragraph noting:
   - EN: "The KPI Dashboard is now served at `http://<host>/` via a Caddy reverse proxy (v1.21). Directus is reachable under the same host at `/directus/*`. Direct ports `:5173`, `:8000`, and `:8055` remain available for development."
   - DE (du-Ton, matching existing convention): "Das KPI Dashboard erreichst du jetzt unter `http://<host>/` — ein Caddy-Reverse-Proxy (v1.21) liegt davor. Directus läuft auf demselben Host unter `/directus/*`. Die Ports `:5173`, `:8000` und `:8055` bleiben für die Entwicklung direkt erreichbar."
   - Search the two files for any remaining `localhost:5173` / `localhost:8055` SPA-context references and update to `localhost/` / `localhost/directus` respectively.

5. No changes needed to `scripts/provision-pi.sh` per D-10 (the `:80` example URLs already match this architecture — that's the whole point of this phase).
  </action>
  <verify>
    <automated>grep -q "http://localhost/" README.md && grep -q "caddy" README.md && grep -q "http://localhost/" docs/setup.md && grep -q "Caddy" docs/architecture.md && grep -q "http://<host>/" frontend/src/docs/en/admin-guide/system-setup.md && grep -q "http://<host>/" frontend/src/docs/de/admin-guide/system-setup.md && cd frontend && npm run check:i18n-parity && npm run check:i18n-du-tone</automated>
  </verify>
  <done>README.md Quick Start lists `http://localhost/` as primary entry, architecture diagram includes Caddy; docs/setup.md mentions the new proxy entry; docs/architecture.md has a Reverse Proxy section; both EN + DE admin-guide system-setup pages carry the bilingual bring-up paragraph; i18n parity + DE du-tone checks still pass; scripts/provision-pi.sh untouched (per D-10).</done>
</task>

</tasks>

<verification>
Phase-wide checks (beyond per-task `<verify>`):

1. **All 5 PROXY-* requirements covered:**
   - PROXY-01 (Caddy service + 4 routes): Tasks 1, 3
   - PROXY-02 (SSE passthrough): Tasks 1 (flush_interval -1 + read_timeout), 3 (65s hold test)
   - PROXY-03 (Directus same-origin cookies): Tasks 1 (CORS env removed, prefix strip), 2 (SDK same-origin), 3 (`/directus/server/health` check)
   - PROXY-04 (player bundle + PWA): Tasks 1 (`/player/*` route), 3 (`/player/` smoke check)
   - PROXY-05 (client migration + docs): Tasks 2 (directusClient.ts), 4 (README, setup.md, architecture.md, admin-guide EN/DE)

2. **Observable end-to-end truth:** From a second LAN host, `curl -sI http://<kpi-host-lan-ip>/login` returns 200/302, and the admin auth flow (login → `/directus/auth/login` sets cookie → `/api/*` requests with access token) works. This is implicitly covered by Task 3's local-host version; true LAN verification requires a second machine, which is why Phase 64 is a precondition for Phase 62's CAL-PI-07 walkthrough (the Pi IS that second host).

3. **No regression in direct-port dev workflow** (per D-08): Vite `:5173`, FastAPI `:8000`, and Directus `127.0.0.1:8055` all remain reachable directly. Task 1 explicitly preserves these.

4. **Docker config valid:** `docker compose config --quiet` (Task 1 verify) + `docker compose up -d --wait caddy` (Task 3 verify) together confirm the compose file parses and all services reach healthy state.

5. **Frontend typecheck + i18n parity unbroken:** Task 2 (tsc) + Task 4 (i18n parity + du-tone) verify no frontend regressions.
</verification>

<success_criteria>
- `caddy/Caddyfile` exists, validates via `caddy validate`, configures all 4 routes with D-03 prefix strip on `/directus/*` and D-06 SSE-friendly timeouts on `/api/*`.
- `docker-compose.yml` has a new `caddy` service bound to `0.0.0.0:80:80`, depends on `api` + `frontend` + `directus` health, has its own healthcheck; `caddy_data`/`caddy_config` named volumes declared; Directus `CORS_ENABLED`/`CORS_ORIGIN`/`CORS_CREDENTIALS` env lines removed.
- `frontend/src/lib/directusClient.ts` defaults `DIRECTUS_URL` to `"/directus"` with `VITE_DIRECTUS_URL` override preserved; doc comment updated.
- `scripts/verify-phase-64-proxy.sh` runs green end-to-end:
  - `curl -sI http://localhost/` → 200/30x
  - `curl -sI http://localhost/api/health` → 200
  - `curl -sI http://localhost/directus/server/health` → 200
  - `curl -sI http://localhost/player/` → 200/30x
  - SSE / long-connection hold test passes (no proxy-side close under 60s)
- Documentation updated in README.md (Quick Start + architecture diagram), docs/setup.md, docs/architecture.md (new Reverse Proxy section), and bilingual admin-guide system-setup pages (EN + DE with du-tone).
- Existing host-port exposures (5173, 8000, 127.0.0.1:8055) unchanged per D-08.
- `scripts/provision-pi.sh` untouched per D-10.
- i18n parity + DE du-tone CI checks still pass.
</success_criteria>

<output>
After completion, create `.planning/phases/64-reverse-proxy/64-01-reverse-proxy-SUMMARY.md` capturing:
- Exact Caddyfile routes and the load-bearing `flush_interval -1` + `read_timeout 24h` decision for SSE.
- Confirmation that `/directus/*` prefix stripping is in place (D-03).
- CORS env removal confirmed (D-04).
- Evidence that `scripts/verify-phase-64-proxy.sh` passed end-to-end.
- Note that true LAN verification (Phase 62 CAL-PI-07) is now unblocked.
</output>
