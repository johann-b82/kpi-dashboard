# Phase 27: Dex IdP Setup - Research

**Researched:** 2026-04-14
**Domain:** OIDC identity provider (Dex v2.43.0) on Docker Compose behind NPM
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Issuer + Hostname Wiring**
- **D-01:** Issuer URL is `https://auth.internal/dex` (path-prefixed). Verified by `curl https://auth.internal/dex/.well-known/openid-configuration` where `issuer == "https://auth.internal/dex"`.
- **D-02:** `auth.internal` (whole host) → `dex:5556` in NPM. Replaces the Phase 26 placeholder currently pointing `auth.internal` at `api:8000`.
- **D-03:** Dex listens on plain HTTP (`web.http: 0.0.0.0:5556`). NPM terminates TLS with the `internal-wildcard` mkcert cert. No in-container TLS.

**Seeded Users (DEX-04)**
- **D-04:** Two placeholder identities:
  - `admin@acm.local` / username `admin` — admin naming convention
  - `dev@acm.local` / username `dev` — regular user
- **D-05:** Stable UUID in `userID`, generated once (`uuidgen`), never changed.
- **D-06:** Real team emails NOT seeded this phase.

**Token Lifetimes**
- **D-07:** `expiry.idTokens: 1h` (satisfies DEX-05)
- **D-08:** `expiry.refreshTokens.validIfNotUsedFor: 720h` (30 days)
- **D-09:** `expiry.refreshTokens.absoluteLifetime: 2160h` (90 days)
- **D-10:** `expiry.refreshTokens.disableRotation: false`
- **D-11:** `oauth2.skipApprovalScreen: true`
- **D-12:** Grant types: `authorization_code` + `refresh_token`. Response types: `code` only.

**Client-Secret Handling**
- **D-13:** Secrets in `.env` with Dex's native `$VAR` substitution. Keys: `DEX_KPI_SECRET`, `DEX_OUTLINE_SECRET`. Placeholders in `.env.example`; real secrets via `openssl rand -hex 32`, never committed.
- **D-14:** Downstream phases (28, 29) read the SAME env var names.

**User Management Workflow**
- **D-15:** Canonical "add a user":
  1. `docker compose run --rm dex dex hash-password` (interactive)
  2. Edit `./dex/config.yaml`, append under `staticPasswords:` with fresh UUID
  3. `docker compose restart dex`
  4. Verify login
- **D-16:** User removal: delete entry → restart. Refresh tokens invalidate on next use. Immediate revocation = nuke `dex_data` volume.

**Config + Storage Layout**
- **D-17:** `./dex/config.yaml` in repo, bind-mounted read-only at `/etc/dex/config.yaml`.
- **D-18:** `dex_data` named Docker volume holds ONLY `/data/dex.db` (SQLite). Survives `restart` and `down` (not `down -v`).
- **D-19:** No Postgres — SQLite fine for 5–10 users.

**Compose Service Shape**
- **D-20:** Image: `ghcr.io/dexidp/dex:v2.43.0` pinned exactly.
- **D-21:** Healthcheck: `wget -qO- http://localhost:5556/dex/healthz`. Adjust to `127.0.0.1` if the busybox IPv6 issue recurs.
- **D-22:** No host port binding for `5556`. Commented-out `# - "5556:5556"` debug hatch.
- **D-23:** `depends_on` — Dex has no dependency. NPM's `depends_on` extended: `dex: condition: service_healthy`.
- **D-24:** `restart: unless-stopped`.

**Clients Config**
- **D-25:** Two static clients, single redirect URI each:
  - `kpi-light` → `https://kpi.internal/api/auth/callback`
  - `outline` → `https://wiki.internal/auth/oidc.callback` (note the dot)
- **D-26:** `offline_access` scope supported — default Dex already exposes it.

### Claude's Discretion
- Service name: `dex`
- Logger: `level: info`, `format: json`
- gRPC: disabled
- Telemetry endpoint: omitted
- `web.allowedOrigins`: unset
- NPM proxy-host Advanced block: likely needs `proxy_set_header Host $host` + `X-Forwarded-Proto https` — confirm exact headers
- Runbook: extend `docs/setup.md` with "Dex first-login" section

### Deferred Ideas (OUT OF SCOPE)
- Real team-email user seeding (post-v1.11)
- gRPC API for programmatic user management
- Postgres storage for Dex
- Passkey / WebAuthn
- RP-initiated logout (Dex doesn't support it)
- Telemetry / metrics endpoint
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEX-01 | Dex `ghcr.io/dexidp/dex:v2.43.0` runs as compose service with SQLite on named volume, reachable as `https://auth.internal` via NPM | Stack (§1), Compose pattern (§3), NPM routing (§5) |
| DEX-02 | OIDC discovery at `https://auth.internal/dex/.well-known/openid-configuration` with `issuer` matching exactly | Issuer gotcha (§4), path-prefixed issuer pattern (§4.2) |
| DEX-03 | Two OIDC clients: `kpi-light` (`https://kpi.internal/api/auth/callback`), `outline` (`https://wiki.internal/auth/oidc.callback`) | Config skeleton (§2), client block (§2.2) |
| DEX-04 | `staticPasswords` block with 2 seeded users; bcrypt hash workflow documented | Connector config (§2.3), `dex hash-password` subcommand (§6) |
| DEX-05 | Access token TTL ≤ 1h | `expiry.idTokens: 1h` (§2.4) |
| DEX-06 | `offline_access` scope supported | Default Dex exposes it; `scopes_supported` array in discovery (§7) |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Containerization:** Everything in Docker Compose — no bare-metal deps. Dex runs as a compose service.
- **Image pins:** Use exact tags (no `:latest`). `ghcr.io/dexidp/dex:v2.43.0`. Prefer GHCR over Docker Hub (unauthenticated rate limits).
- **Healthcheck gating:** `condition: service_healthy` on `depends_on`. NPM gate extended to include Dex.
- **Secrets in `.env`:** Never hardcoded in `docker-compose.yml` or `config.yaml`. Use `$VAR` substitution.
- **Compose v2 syntax:** `docker compose` (space), not `docker-compose`.
- **GSD workflow:** File edits go through GSD commands. Planner will structure tasks for `/gsd:execute-phase`.

---

## Summary

Dex v2.43.0 is a single-binary Go OIDC provider purpose-built for this scenario: a few apps sharing one issuer with users in a YAML config. All six phase requirements (DEX-01..06) are directly achievable with a single `config.yaml` file, a ~30-line compose service block, two `.env` entries, and an NPM proxy-host edit. No custom code.

The **one critical gotcha** is the issuer URL: the value in `config.yaml` is baked into every ID token's `iss` claim AND is the URL the browser must reach for the OAuth redirect dance. For this phase, the decision is locked (`https://auth.internal/dex`) — so the path prefix must be carried through in three places consistently: (1) the `issuer:` line in `config.yaml`, (2) NPM's proxy-host forward config (forwarding the whole host to `dex:5556`, path intact — Dex serves the `/dex` prefix itself when the issuer has a path), and (3) the healthcheck URL (`/dex/healthz`, not `/healthz`).

**Primary recommendation:** Follow the config skeleton below verbatim, pin `ghcr.io/dexidp/dex:v2.43.0`, pass `X-Forwarded-Proto: https` and preserve `Host` in the NPM Advanced config so Dex sees the original scheme/host when composing discovery responses.

---

## Standard Stack

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| Dex | v2.43.0 | OIDC issuer, static-password connector | Single-binary Go app, ~50 MB image, purpose-built for this scale; v2.43.0 is the latest stable (released 2025-05-19), config format stable since v2.28 |
| SQLite3 | bundled in Dex | Dex storage backend | Built-in — no separate container. Handles 5–10 users trivially. One-write-at-a-time is a non-issue at this scale. |
| bcrypt (cost 10) | via `dex hash-password` subcommand | Password hashing | Dex ships `dex hash-password` — no need for external `htpasswd` or Python `bcrypt`. Cost 10 is the project default; cost 12 adds ~300ms per login with marginal security benefit. |

### Supporting
| Component | Version | Purpose | When to Use |
|-----------|---------|---------|-------------|
| Nginx Proxy Manager | 2.11.3 (existing) | TLS termination, path routing | Already deployed from Phase 26; extend with a new proxy host entry for `auth.internal` |
| mkcert wildcard cert | existing `internal.crt`/`internal.key` | TLS cert for `*.internal` | SAN already includes `auth.internal` (verified in Phase 26 — no cert regen needed) |

### Alternatives Considered (locked out by CONTEXT)
| Instead of | Could Use | Why not here |
|------------|-----------|--------------|
| SQLite storage | Postgres storage | D-19: overkill for 5–10 users |
| gomplate templating | Native `$VAR` substitution | D-13: Dex's built-in env-var substitution is sufficient; gomplate also carries two known CVEs |
| gRPC API | Manual edit-and-restart | Deferred — no use case until user churn > few/month |
| `web.allowedOrigins` | unset | Server-side Authorization Code flow; no SPA makes direct calls to Dex |
| `-alpine` image variant | default | Default image is already Alpine-based |

### Installation

No new project deps. Only the Docker image pull:

```bash
docker pull ghcr.io/dexidp/dex:v2.43.0
```

**Version verification:**
```bash
# GitHub releases API — v2.43.0 confirmed as latest stable
curl -s https://api.github.com/repos/dexidp/dex/releases/latest | grep tag_name
# Expected: "tag_name": "v2.43.0"
```

---

## Architecture Patterns

### File Layout (new this phase)

```
acm-kpi-light/
├── dex/
│   └── config.yaml              # NEW — Dex configuration (git-tracked, secrets via $VAR)
├── docker-compose.yml           # EDITED — add dex service + dex_data volume + npm depends_on
├── .env.example                 # EDITED — append DEX_KPI_SECRET, DEX_OUTLINE_SECRET
├── docs/
│   └── setup.md                 # EDITED — new "Dex first-login" section
└── README.md                    # optional — one-line note about auth provider
```

### Pattern 1: Path-Prefixed Issuer

**What:** Run Dex at a subpath (`/dex`) under a hostname rather than at the root.

**When to use:** When the operator wants `auth.internal` to potentially host other things later (even though today — per D-02 — the whole host goes to Dex). Also matches common multi-tenant layouts.

**How it works:**
- `issuer: https://auth.internal/dex` in `config.yaml`
- Dex serves every route under the `/dex/` prefix automatically (discovery at `/dex/.well-known/...`, auth at `/dex/auth`, JWKS at `/dex/keys`, etc.)
- NPM forwards the entire request (including path) to `dex:5556` — Dex handles the prefix internally

**Source:** Dex config docs — https://dexidp.io/docs/configuration/ — "When the issuer URL contains a path, Dex serves all endpoints under that path."

### Pattern 2: TLS Termination at Reverse Proxy

**What:** Dex listens on plain HTTP inside the container; NPM terminates TLS.

**When to use:** Always, for this deployment shape. Native Dex TLS (`web.https` + `web.tlsCert` + `web.tlsKey`) is unnecessary complexity when NPM already does it.

**Required headers from NPM → Dex:**
```
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto https;
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Real-IP $remote_addr;
```

Without `X-Forwarded-Proto https`, Dex may generate discovery URLs with `http://` scheme, breaking OIDC clients. Without preserving `Host`, Dex may build URLs against the internal service name.

**Source:** Dex docs + community experience from NPM + OIDC setups. Confirmed by Dex config.yaml.dist comments on `web.http` usage.

### Pattern 3: Named Volume for SQLite, Not Bind Mount

**What:** Use `dex_data` named Docker volume for `/data` — not a host bind mount.

**When to use:** Always for SQLite database files. Bind mounts can cause permission / fsync issues on macOS/Windows hosts. Named volumes are managed by Docker and survive `restart`/`down` (not `down -v`).

**Matches:** Project pattern from `postgres_data`, `npm_data`, `npm_letsencrypt`.

### Anti-Patterns to Avoid

- **Issuer = Docker service name:** `issuer: http://dex:5556` — browser cannot resolve it; ID tokens become unusable by downstream apps.
- **Issuer with trailing slash inconsistency:** `https://auth.internal/dex/` (with slash) vs `https://auth.internal/dex` (without). Every OIDC client compares `iss` claim exactly. Pick the no-trailing-slash form (recommended by OIDC spec) and use it identically everywhere.
- **Hardcoding secrets in `config.yaml`:** Git-leaks secret. Use `$DEX_KPI_SECRET` / `$DEX_OUTLINE_SECRET` env-var refs.
- **`create_all`-style workflow for users:** There is no "database init" — users are declared in `config.yaml` and hot-loaded on restart. Don't try to seed users via a script at startup.
- **`web.allowedOrigins: ["*"]`:** Opens CORS unnecessarily. Server-side Authorization Code flow doesn't need CORS at all — omit the key.
- **Running Dex with `--reload`-equivalent:** There is none. Config changes require `docker compose restart dex`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bcrypt hash generation | Python `bcrypt` / `htpasswd` wrapper script | `docker compose run --rm dex dex hash-password` | Dex ships the command; zero extra deps; matches the version of bcrypt Dex uses at verify time |
| User seeding / migration | Startup script that inserts into SQLite | Declarative `staticPasswords:` block in `config.yaml` | Dex reads this block on boot; adding a user is a config edit, not a db migration |
| OIDC discovery document | Write your own `.well-known/openid-configuration` | Dex auto-generates it from `issuer` | Dex handles this entirely; just hit the URL to verify |
| JWKS publishing | Build a JWKS endpoint | Dex serves `{issuer}/keys` automatically | Comes for free; signing-key rotation handled via `expiry.signingKeys` |
| Session / token storage | Manage sessions externally | SQLite on `dex_data` volume | Dex encrypts refresh tokens in SQLite internally |
| "Restart after config change" detection | File watcher | `docker compose restart dex` (< 2 s) | Dex starts instantly; restart is the idiomatic reload |

**Key insight:** This phase is almost entirely declarative config. The moment you feel like writing code, step back — there's probably a built-in.

---

## Runtime State Inventory

Not applicable — this is a greenfield phase (deploying a new service). No existing Dex state to migrate.

**Items to create fresh (not migrate):**
- `dex_data` named volume (empty on first boot; Dex creates `/data/dex.db` on startup)
- Two static user UUIDs (generated once with `uuidgen`, hardcoded in `config.yaml`, never changed)
- Two client secrets (generated once with `openssl rand -hex 32`, stored in `.env`, never committed)

**Phase 26 state that IS modified (one-time, manual, documented in runbook):**
- NPM proxy host for `auth.internal` — forward target changes from `api:8000` (placeholder) to `dex:5556`. Protocol stays `http`. This is a UI edit in NPM admin, persisted in the `npm_data` volume. The planner must make this a documented operator step, not automated (per Phase 26 D-09).

---

## Common Pitfalls

### Pitfall 1: Issuer URL mismatch between config and browser
**What goes wrong:** ID token's `iss` claim doesn't match the URL the OIDC client is configured with, causing token validation to fail in Phases 28/29.
**Why it happens:** Trailing slash inconsistency, `http` vs `https` confusion, or using an internal Docker hostname.
**How to avoid:** Lock to exactly `https://auth.internal/dex` (no trailing slash) in ALL of: `config.yaml` `issuer:`, the verification curl in success criteria, and the `OIDC_ISSUER` env var downstream phases will consume.
**Warning signs:** Discovery returns an `issuer` that doesn't match the requested URL. JWKS requests 404. Downstream clients reject tokens with "iss claim mismatch".

### Pitfall 2: `X-Forwarded-Proto` not set at NPM
**What goes wrong:** Dex generates discovery/authorization URLs with `http://` scheme even though the browser came in via HTTPS. Discovery document's `authorization_endpoint` then redirects the browser to plain HTTP, which breaks (the browser's HSTS / cert expectations don't match).
**Why it happens:** NPM's default proxy host doesn't always forward `X-Forwarded-Proto`. Dex trusts it when building URLs.
**How to avoid:** Set NPM Advanced config (per proxy-host) to include:
```
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto https;
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Real-IP $remote_addr;
```
**Warning signs:** Discovery `issuer` looks correct but `authorization_endpoint` has `http://` in it. Login redirect to `http://auth.internal/dex/auth?...`.

### Pitfall 3: Busybox IPv6 in healthcheck (Phase 26 repeat)
**What goes wrong:** `wget -qO- http://localhost:5556/dex/healthz` resolves `localhost` → `::1` first, which the Dex listener (`0.0.0.0:5556` = IPv4 only) doesn't bind to. Healthcheck fails even though Dex is up.
**Why it happens:** Alpine/busybox `wget` prefers IPv6 when available. Same bug hit Phase 26 frontend (commit eab26c7).
**How to avoid:** Use `127.0.0.1` in the healthcheck URL from the start: `wget -qO- http://127.0.0.1:5556/dex/healthz`. This is explicit in the CONTEXT D-21 guidance.
**Warning signs:** `docker compose ps` shows `dex` as unhealthy. `docker compose exec dex wget -qO- http://127.0.0.1:5556/dex/healthz` works but `http://localhost:...` doesn't.

### Pitfall 4: `userID` changed after first login
**What goes wrong:** Any existing refresh token / session tied to the old `userID` becomes orphaned. Downstream apps that stored `sub` see a user they can't match.
**Why it happens:** Treating `userID` as a throwaway and regenerating it during iteration.
**How to avoid:** Generate once with `uuidgen`, hardcode in `config.yaml`, treat as permanent. Document this in the runbook's "add a user" section — every new user needs a fresh UUID, existing users' UUIDs never change.
**Warning signs:** Users get logged out unexpectedly after a config edit. Phase 28's `app_users` table has duplicate email with different `sub`.

### Pitfall 5: Redirect URI mismatch (off-by-one-character)
**What goes wrong:** Outline expects exactly `/auth/oidc.callback` (note the DOT, not dash, not slash). Any typo = "invalid_redirect_uri" error at login.
**Why it happens:** Muscle memory types `/auth/oidc-callback` or `/auth/oidc/callback`.
**How to avoid:** Copy the exact string from CONTEXT D-25 into `config.yaml`. Verify against Outline's own docs when Phase 29 lands.
**Warning signs:** Dex returns "Invalid redirect URI" on the callback. Browser sees a Dex error page, not the app.

### Pitfall 6: Client secret leaks into git via `config.yaml`
**What goes wrong:** Developer resolves `$DEX_KPI_SECRET` in `config.yaml` while testing locally, forgets, commits. Secret now in git history.
**Why it happens:** Debug convenience — "let me just hardcode it for a second".
**How to avoid:** `config.yaml` contains `$DEX_KPI_SECRET` literally (not resolved). `.env` has the real value and is already gitignored. `.env.example` has placeholder. Enforce by planner adding a pre-commit-style grep to the verification step: `grep -rE 'secret:\s+[a-f0-9]{32,}' dex/config.yaml && echo FAIL`.
**Warning signs:** A commit shows `secret: abc123...` instead of `secret: $DEX_KPI_SECRET` in `dex/config.yaml`.

### Pitfall 7: Dex doesn't expose `end_session_endpoint`
**What goes wrong:** Apps try to do RP-initiated logout (redirect user to `end_session_endpoint` in discovery to log out everywhere). Dex doesn't expose this endpoint — field is absent from discovery.
**Why it happens:** OIDC clients expect it; Dex issue #1697 still open as of research date.
**How to avoid:** This is NOT a Phase 27 problem to solve — it's a known Dex limitation mitigated by the 1h access token TTL (D-07, DEX-05). Downstream phases handle logout per-app. Planner should NOT include any success criterion that requires `end_session_endpoint`.
**Warning signs:** Phase 28/29 plans reference "global logout" — flag during plan-check.

---

## Code Examples

### Full `dex/config.yaml` (authoritative skeleton — copy-paste ready)

```yaml
# ./dex/config.yaml
# Dex v2.43.x — static-password connector, SQLite storage, two OIDC clients
# Source: https://github.com/dexidp/dex/blob/v2.43.0/config.yaml.dist

issuer: https://auth.internal/dex   # D-01: path-prefixed issuer; browser-reachable via NPM

storage:
  type: sqlite3
  config:
    file: /data/dex.db              # Persisted via dex_data volume (D-18)

web:
  http: 0.0.0.0:5556                # D-03: plain HTTP; NPM terminates TLS

logger:
  level: "info"
  format: "json"

oauth2:
  skipApprovalScreen: true          # D-11: internal tool, no consent page
  responseTypes:
    - code                          # D-12: Authorization Code flow only
  grantTypes:
    - authorization_code
    - refresh_token

expiry:
  idTokens: "1h"                    # D-07: satisfies DEX-05 (≤ 1h)
  refreshTokens:
    validIfNotUsedFor: "720h"       # D-08: 30 days idle timeout
    absoluteLifetime: "2160h"       # D-09: 90 days hard cap
    disableRotation: false          # D-10: rotation on

enablePasswordDB: true

staticPasswords:
  - email: "admin@acm.local"
    # Generate: docker compose run --rm dex dex hash-password
    hash: "$2a$10$REPLACE_WITH_ADMIN_BCRYPT_HASH"
    username: "admin"
    userID: "REPLACE_WITH_UUID_GENERATED_BY_uuidgen"   # D-05: stable UUID

  - email: "dev@acm.local"
    hash: "$2a$10$REPLACE_WITH_DEV_BCRYPT_HASH"
    username: "dev"
    userID: "REPLACE_WITH_UUID_GENERATED_BY_uuidgen"

staticClients:
  - id: kpi-light
    secret: $DEX_KPI_SECRET         # D-13: env-var substitution (no quotes)
    name: "KPI Light"
    redirectURIs:
      - https://kpi.internal/api/auth/callback       # D-25

  - id: outline
    secret: $DEX_OUTLINE_SECRET
    name: "Outline Wiki"
    redirectURIs:
      - https://wiki.internal/auth/oidc.callback     # D-25 (note the DOT)
```

### Compose service block (add to `docker-compose.yml`)

```yaml
  dex:
    image: ghcr.io/dexidp/dex:v2.43.0   # D-20
    restart: unless-stopped              # D-24
    command: dex serve /etc/dex/config.yaml
    # No host port binding — NPM is the edge (D-22).
    # Uncomment for direct curl/debug access bypassing NPM.
    # ports:
    #   - "5556:5556"
    volumes:
      - ./dex/config.yaml:/etc/dex/config.yaml:ro   # D-17: read-only bind
      - dex_data:/data                              # D-18: SQLite persistence
    environment:
      DEX_KPI_SECRET: "${DEX_KPI_SECRET}"           # D-13
      DEX_OUTLINE_SECRET: "${DEX_OUTLINE_SECRET}"
    healthcheck:
      # 127.0.0.1 not localhost — busybox IPv6 bug (D-21, Phase 26 eab26c7)
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:5556/dex/healthz || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s
    # D-23: no depends_on (no DB dependency — SQLite is in-container)
```

**And add to the `volumes:` block:**
```yaml
volumes:
  postgres_data:
  npm_data:
  npm_letsencrypt:
  dex_data:        # NEW — D-18
```

**And extend `npm`'s `depends_on`:**
```yaml
  npm:
    # ... existing config ...
    depends_on:
      api:
        condition: service_healthy
      frontend:
        condition: service_healthy
      dex:                              # NEW — D-23
        condition: service_healthy
```

### `.env.example` append

```bash
# --- Dex OIDC (dex service) ---
# Client secrets for the two OIDC clients Dex hosts.
# Generate real values with:
#   openssl rand -hex 32
# Never commit real secrets — only placeholders in this file.
DEX_KPI_SECRET=changeme-kpi-light-client-secret
DEX_OUTLINE_SECRET=changeme-outline-client-secret
```

### Add-a-user workflow (for runbook)

```bash
# 1. Generate a bcrypt hash (interactive — prompts for password)
docker compose run --rm dex dex hash-password
# Outputs: $2a$10$....

# 2. Generate a stable UUID
uuidgen
# Outputs: 12345678-1234-5678-1234-567812345678

# 3. Edit ./dex/config.yaml — append under staticPasswords:
#    - email: "newuser@acm.local"
#      hash: "<paste bcrypt hash from step 1>"
#      username: "newuser"
#      userID: "<paste UUID from step 2>"

# 4. Hot-reload Dex (< 2 seconds)
docker compose restart dex

# 5. Verify Dex came back
docker compose ps dex             # STATUS should be "healthy"
curl -sk https://auth.internal/dex/.well-known/openid-configuration | jq .issuer
# Expected: "https://auth.internal/dex"
```

### Verification curl for success criterion 1

```bash
curl -sk https://auth.internal/dex/.well-known/openid-configuration | jq .
# Expected keys in response:
#   "issuer": "https://auth.internal/dex"
#   "authorization_endpoint": "https://auth.internal/dex/auth"
#   "token_endpoint": "https://auth.internal/dex/token"
#   "jwks_uri": "https://auth.internal/dex/keys"
#   "userinfo_endpoint": "https://auth.internal/dex/userinfo"
#   "response_types_supported": ["code"]
#   "grant_types_supported": ["authorization_code", "refresh_token"]
#   "scopes_supported": [..., "offline_access", ...]   # DEX-06

# Assertion (one-liner):
test "$(curl -sk https://auth.internal/dex/.well-known/openid-configuration | jq -r .issuer)" = "https://auth.internal/dex" && echo OK || echo FAIL
```

### Session-survival check (success criterion 5)

```bash
# Start stack, log in once (manual), observe SQLite content, then:
docker compose restart dex
docker compose exec dex sh -c 'ls -la /data/dex.db'   # file persists
# Browser: refresh Dex login page — existing session valid (refresh token in SQLite still works)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bundling `gomplate` for config templating | Native `$VAR` env-var substitution in Dex itself | Since v2.28+ | No `gomplate` dependency; dodges CVE-2025-68121/CVE-2026-25934 in the bundled gomplate binary (still present in image but never invoked if not used) |
| `expiry.idTokens: 24h` default | `1h` for tools mitigating lack of RP-initiated logout | Project decision | Tighter security posture; matches DEX-05 |
| Docker Hub `dexidp/dex` pulls | GHCR `ghcr.io/dexidp/dex` pulls | Community best-practice | Avoids Docker Hub unauthenticated rate limits |
| Implicit flow / hybrid flow for SPAs | Authorization Code + PKCE (server-side) | Industry consensus (OAuth 2.1) | Simpler config; no `token` response type |

**Deprecated / don't use:**
- `staticPasswords:` with SHA1 hashes (bcrypt only for years; don't ask)
- Native Dex TLS (`web.https`) when a reverse proxy is already present — unnecessary complexity
- `expiry.signingKeys: 24h+` — default `6h` rotation is the sweet spot

---

## Open Questions

1. **Exact NPM Advanced config string for the `auth.internal` proxy host**
   - What we know: Dex needs `Host` and `X-Forwarded-Proto` headers preserved; the default NPM proxy host passes `Host` by default but may not set `X-Forwarded-Proto` explicitly.
   - What's unclear: Whether NPM 2.11.3's default template already injects `X-Forwarded-Proto $scheme` (it does on newer versions; unclear if 2.11.3 does without a custom block).
   - Recommendation: Planner should include an explicit Advanced block with the four headers listed in Pattern 2 — safer than trusting the default. Verification step: hit discovery and check `authorization_endpoint` starts with `https://`.

2. **Does `dex hash-password` work via `docker compose run --rm`?**
   - What we know: The subcommand exists in v2.43.0 and is interactive.
   - What's unclear: Whether `-it` is needed explicitly on `docker compose run`.
   - Recommendation: Planner should try `docker compose run --rm dex dex hash-password` first. If stdin isn't tty-allocated, fall back to `docker compose run --rm -it dex dex hash-password`. Runbook should note the `-it` fallback as a footnote.

3. **UUID generation on Windows (operator portability)**
   - What we know: `uuidgen` exists on macOS and most Linux distros.
   - What's unclear: Windows operators — `[guid]::NewGuid()` in PowerShell is the equivalent, but the runbook should note this.
   - Recommendation: Runbook's "add a user" section gives both commands: `uuidgen` (mac/linux) and `powershell -Command "[guid]::NewGuid()"` (Windows). Non-blocking — the KPI Light team is macOS-primary per prior phases.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Engine | All services | ✓ (existing) | Phase 26 confirmed | — |
| Docker Compose v2 | Service orchestration | ✓ (existing) | Phase 26 confirmed | — |
| mkcert wildcard cert incl. `auth.internal` | TLS for `auth.internal` | ✓ (existing) | `certs/internal.crt` generated in Phase 26; SAN includes `auth.internal` | Regenerate via `scripts/generate-certs.sh` if missing |
| NPM (`jc21/nginx-proxy-manager:2.11.3`) | TLS termination + routing | ✓ (existing) | Phase 26 deployed | — |
| `/etc/hosts` entry for `auth.internal` | Browser resolution | ✓ (existing) | Documented in Phase 26 `docs/setup.md` §2.2 | — |
| `ghcr.io/dexidp/dex:v2.43.0` image | Dex service | ✓ (pullable) | v2.43.0 confirmed on GHCR | Docker Hub `dexidp/dex:v2.43.0` mirror |
| `uuidgen` CLI | Generating stable userIDs | ✓ (macOS/Linux default) | — | PowerShell `[guid]::NewGuid()` on Windows; online UUID generators as last resort |
| `openssl` CLI | Generating client secrets | ✓ (macOS/Linux default) | — | `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `jq` CLI | Verification curl of discovery JSON | Likely ✓ (dev tool) | — | `python3 -c "import json, sys; print(json.load(sys.stdin)['issuer'])"` |

**Missing dependencies with no fallback:** None — every dependency is either already installed from Phase 26 or has a documented fallback.

**Missing dependencies with fallback:** None critical — operator machines for this team are macOS-primary; all fallbacks documented only for completeness.

---

## Sources

### Primary (HIGH confidence)
- [Dex GitHub Releases](https://github.com/dexidp/dex/releases) — v2.43.0 confirmed as latest stable (released 2025-05-19)
- [Dex config.yaml.dist on v2.43.0 tag](https://github.com/dexidp/dex/blob/v2.43.0/config.yaml.dist) — authoritative config reference
- [Dex Official Docs — Getting Started](https://dexidp.io/docs/getting-started/) — issuer URL, web config patterns
- [Dex Official Docs — Tokens / Expiry](https://dexidp.io/docs/configuration/tokens/) — `expiry.*` semantics
- [Dex Official Docs — OAuth2](https://dexidp.io/docs/configuration/oauth2/) — `responseTypes`, `grantTypes`, `skipApprovalScreen`
- [Dex Official Docs — Local (static-password) connector](https://dexidp.io/docs/connectors/local/) — `staticPasswords` shape, `userID` semantics, bcrypt
- `.planning/research/v1.11-dex.md` — the project's own prior research for this milestone (authored 2026-04-14)
- `.planning/phases/26-npm-hostnames/26-CONTEXT.md` and 26-02/26-03 SUMMARYs — Phase 26 as-built

### Secondary (MEDIUM confidence)
- [dexidp/dex config-dev.yaml example](https://github.com/dexidp/dex/blob/master/examples/config-dev.yaml) — realistic multi-client layout
- [vicalloy/outline-docker-compose](https://github.com/vicalloy/outline-docker-compose) — prior art for Dex + Outline in compose
- CONTEXT D-21 note on busybox IPv6 (deriving from Phase 26 commit eab26c7) — project-local empirical finding

### Tertiary (LOW confidence — flagged but not blocking)
- gomplate CVE note (CVE-2025-68121, CVE-2026-25934) — referenced in project's prior research; project mitigates by not invoking gomplate

---

## Metadata

**Confidence breakdown:**
- Standard stack (Dex v2.43.0, SQLite, bcrypt): HIGH — GitHub release tag + official docs verified
- Architecture (config skeleton, compose block, NPM wiring): HIGH — locked by CONTEXT, all patterns match Phase 26 conventions
- Pitfalls: HIGH — issuer mismatch, `X-Forwarded-Proto`, busybox IPv6, redirect-URI typos are all well-documented in either Dex community docs or project's Phase 26 history
- `X-Forwarded-Proto` behavior in NPM 2.11.3 default template: MEDIUM — flagged as Open Question 1; recommendation is to set it explicitly regardless
- `dex hash-password` TTY behavior via `docker compose run --rm`: MEDIUM — flagged as Open Question 2; fallback documented

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (30 days — Dex v2.x config format is very stable; primary risk is a new CVE advisory or a v2.44 release with subtle config changes)
