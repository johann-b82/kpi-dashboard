# Phase 29: Outline Wiki Deployment — Research

**Researched:** 2026-04-15
**Domain:** Outline 0.86.0 self-hosted deployment + OIDC (Dex) integration + local file storage
**Confidence:** HIGH

## Summary

Outline 0.86.0 is deployed as a single container (`outlinewiki/outline:0.86.0`) backed by a dedicated Postgres 17 + Redis 7 pair. It listens on port **3000**, auto-runs DB migrations at container start (no separate migrate service), and ships a built-in `HEALTHCHECK` that probes `GET /_health` — we keep the Dockerfile default and can optionally re-declare it in compose for visibility. Local file storage is a first-class option in 0.86 (`FILE_STORAGE=local`, volume at `/var/lib/outline/data`), which removes MinIO entirely per WIK-03. OIDC is wired via the generic `OIDC_*` variables; split-endpoint strategy (browser `auth.internal` for auth-uri, internal docker DNS `dex:5556` for token/userinfo) is already locked in CONTEXT D-05 and is validated by the Phase 28 api-container pattern. The BSL 1.1 Additional Use Grant is narrower than previously believed — the prohibition is against operating a commercial "Document Service" for third parties, **not** a 50-person cap; internal team use is unambiguously permitted.

The single highest-risk area is Success Criterion #3 (shared SSO): Outline validates the OIDC `iss` claim against `OIDC_AUTH_URI` host, so the browser-facing URI must exactly match the Dex-issued `iss` value (`https://auth.internal/dex`), while the token/userinfo calls happen server-side inside the Docker network. The mkcert rootCA mount + `NODE_EXTRA_CA_CERTS` + `extra_hosts: auth.internal:host-gateway` triad is required even with split endpoints, because Outline performs issuer discovery against `OIDC_AUTH_URI`.

**Primary recommendation:** Follow the CONTEXT D-01..D-05 decisions verbatim; implementation is mechanical. Phase 28's `api` service is a direct template for the Outline service's cert/hosts plumbing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Outline secrets via `.env.example` placeholders**
Add `OUTLINE_SECRET_KEY=` and `OUTLINE_UTILS_SECRET=` to `.env.example` with inline comment `# Generate with: openssl rand -hex 32`. Operator runs the command once during setup and pastes values into `.env`. Matches existing `SESSION_SECRET` / `DEX_KPI_SECRET` pattern from Phases 27-28. No helper script.

**D-02: OIDC claim mapping**
- `OIDC_USERNAME_CLAIM=preferred_username`
- `OIDC_DISPLAY_NAME=name`
- `OIDC_SCOPES="openid profile email offline_access"`
- `sub` remains the stable identifier Outline uses internally.

**D-03: No env-based workspace branding**
Skip `TEAM_LOGO_URL` / initial team name via env. First-login user renames the workspace and uploads a logo through Outline Settings. Branding polish belongs in Phase 31.

**D-04: Manual backup one-liner in `docs/setup.md`**
Extend `docs/setup.md` with a "Backups" subsection covering `pg_dump` against `outline-db` and `docker compose exec outline tar -czf - /var/lib/outline/data > outline-uploads-$(date +%F).tar.gz`. No automation.

**D-05: Split Dex endpoints + mount mkcert CA in Outline container**
- `OIDC_AUTH_URI=https://auth.internal/dex/auth` (browser-reachable)
- `OIDC_TOKEN_URI=http://dex:5556/dex/token` (internal docker DNS)
- `OIDC_USERINFO_URI=http://dex:5556/dex/userinfo` (internal docker DNS)
- Mount `./certs/rootCA.pem:/etc/ssl/certs/mkcert-rootCA.pem:ro`
- Set `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/mkcert-rootCA.pem`
- Add `extra_hosts: "auth.internal:host-gateway"`

### Claude's Discretion

None called out explicitly; the researcher/planner has latitude on:
- Exact volume names (`outline_uploads`, `outline_db_data`, `outline_redis_data` suggested)
- Whether to include Outline's built-in `HEALTHCHECK` override or rely on the Dockerfile default
- Postgres init SQL form (extension is auto-created by Outline; init SQL not required)
- BSL attribution paragraph wording in README (must be accurate to the actual grant — see §License below)

### Deferred Ideas (OUT OF SCOPE)

- Automated backup/restore scripts — defer to dedicated ops phase.
- SMTP-based invitations for Outline — WIK-06 explicitly defers.
- Let's Encrypt / real-domain TLS — Phase 26 deferred to v2.
- Multi-project wiki collections structure — Phase 31 (WMP requirements).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WIK-01 | Outline `outlinewiki/outline:0.86.0` reachable as `https://wiki.internal` via NPM | §Standard Stack (image pinned); §Architecture Patterns (NPM proxy host pattern from Phase 26); port 3000 internal, no host binding |
| WIK-02 | Dedicated `outline-db` Postgres 17 + `outline-redis` container | §Standard Stack (both images); §Architecture Patterns (healthcheck-gated `depends_on`) |
| WIK-03 | `FILE_STORAGE=local` on named volume; MinIO excluded | §Standard Stack `FILE_STORAGE_LOCAL_ROOT_DIR=/var/lib/outline/data`; volume `outline_uploads` |
| WIK-04 | Dex generic OIDC: `OIDC_AUTH_URI` browser-reachable; token/userinfo internal DNS | §OIDC Integration (split-endpoint pattern); D-05 locked |
| WIK-05 | First-time OIDC login JIT-provisions user + default team | §OIDC Integration (Outline JIT default behavior confirmed) |
| WIK-06 | No SMTP configured; `SMTP_*` left unset | §Standard Stack (SMTP vars omitted from env block) |
| WIK-07 | BSL 1.1 compliance noted in README | §License (actual grant wording: not a user-count cap, but prohibition on running a "Document Service") |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Docker Compose v2 (`docker compose`, not `docker-compose`)
- Pinned image tags always; never `latest`
- Postgres: `postgres:17-alpine`
- All secrets in `.env`, never hardcoded in YAML
- `depends_on` uses `condition: service_healthy`
- Healthchecks use `127.0.0.1` (not `localhost`) for busybox-based images to avoid IPv6 resolution issue (Phase 26 commit eab26c7)
- Single `docker-compose.yml` for dev + single-VM prod (no `.dev.yml` split)

## Standard Stack

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| Outline | `outlinewiki/outline:0.86.0` | Wiki application | Pinned per CONTEXT + milestone research; 0.86 is the first major where `FILE_STORAGE=local` is first-class (earlier versions required S3). Migrations auto-run at container start. |
| PostgreSQL | `postgres:17-alpine` | Outline primary datastore | Matches house style from KPI Light `db` service; 17 is current LTS; Outline auto-creates required `uuid-ossp` extension at migration time (no init SQL needed). |
| Redis | `redis:7-alpine` | Job queue + rate limiter + pub/sub | Required by Outline for websocket pub/sub and background jobs; 7-alpine is current LTS and pairs with the `redis-cli ping` healthcheck pattern. |

### Outline env vars (verified against v0.86.0 `.env.sample`)

| Variable | Value for this deployment | Notes |
|----------|---------------------------|-------|
| `NODE_ENV` | `production` | |
| `URL` | `https://wiki.internal` | Must exactly match the browser-reachable URL (used for OIDC callback construction). No trailing slash. |
| `PORT` | `3000` | Explicitly set to dodge the 0.79.x healthcheck bug (fixed in 0.79.1+, but setting it is defensive). |
| `SECRET_KEY` | `${OUTLINE_SECRET_KEY}` | 32-byte hex (`openssl rand -hex 32`). Rotating invalidates all sessions. |
| `UTILS_SECRET` | `${OUTLINE_UTILS_SECRET}` | Independent 32-byte hex. Used for email tokens, unsubscribe links, avatar URL signing. Must differ from `SECRET_KEY`. |
| `DATABASE_URL` | `postgres://outline:${OUTLINE_DB_PASSWORD}@outline-db:5432/outline` | |
| `PGSSLMODE` | `disable` | Same-docker-network; no TLS between outline and outline-db. |
| `REDIS_URL` | `redis://outline-redis:6379` | No auth; internal docker network. |
| `FILE_STORAGE` | `local` | WIK-03 |
| `FILE_STORAGE_LOCAL_ROOT_DIR` | `/var/lib/outline/data` | Default; matches the Dockerfile `VOLUME` declaration. |
| `FILE_STORAGE_UPLOAD_MAX_SIZE` | `262144000` (250 MiB) | Default. Safe for internal wiki attachment sizes. |
| `DEFAULT_LANGUAGE` | `en_US` | Default; first user can change in-UI. |
| `OIDC_CLIENT_ID` | `outline` | Matches Dex client registered in Phase 27 D-25. |
| `OIDC_CLIENT_SECRET` | `${DEX_OUTLINE_SECRET}` | Reuses Phase 27 secret — single source of truth (D-14). |
| `OIDC_AUTH_URI` | `https://auth.internal/dex/auth` | Browser-reachable (user redirects here). |
| `OIDC_TOKEN_URI` | `http://dex:5556/dex/token` | Internal docker DNS; server-to-server. |
| `OIDC_USERINFO_URI` | `http://dex:5556/dex/userinfo` | Internal docker DNS. |
| `OIDC_USERNAME_CLAIM` | `preferred_username` | D-02 |
| `OIDC_DISPLAY_NAME` | `name` | D-02 |
| `OIDC_SCOPES` | `openid profile email offline_access` | D-02; `offline_access` present in Dex via DEX-06. |
| `NODE_EXTRA_CA_CERTS` | `/etc/ssl/certs/mkcert-rootCA.pem` | D-05; trusts mkcert CA for any HTTPS callout to `auth.internal`. |
| `FORCE_HTTPS` | `true` | Outline generates links using `URL`; setting `FORCE_HTTPS=true` ensures cookies get `Secure` flag even though NPM is the TLS terminator. |

SMTP intentionally omitted (WIK-06). No `TEAM_LOGO_URL` / workspace branding env (D-03).

### Version verification (2026-04-15)

| Package | Declared | Verification |
|---------|----------|--------------|
| `outlinewiki/outline:0.86.0` | CONTEXT specifics + milestone research | Confirmed via GitHub tag `v0.86.0` and Docker Hub layer listing (milestone research doc `.planning/research/v1.11-outline.md`) |
| `postgres:17-alpine` | CLAUDE.md stack | Matches existing `db` service; already in use in repo |
| `redis:7-alpine` | Alpine variant for small image | Redis 7 is current stable LTS |

## Architecture Patterns

### Compose topology

```
outline-db (postgres:17-alpine)  ─┐
outline-redis (redis:7-alpine)   ─┤   condition: service_healthy
                                   └─>  outline (outlinewiki/outline:0.86.0)
                                        └─>  NPM proxy host wiki.internal → outline:3000
```

- `outline` runs migrations on startup (no separate `outline-migrate` service needed — unlike KPI Light's `migrate` pattern). Outline's startup sequence: migrate → start server.
- NPM's `depends_on` is extended with `outline: condition: service_healthy` alongside existing `api`, `frontend`, `dex`.
- Outline's built-in `HEALTHCHECK` (`wget /_health`) runs inside the container; a compose-level healthcheck is redundant but may be re-declared for clarity. Recommendation: use the Dockerfile default (do not override) — the compose-level `depends_on: condition: service_healthy` reads the Dockerfile healthcheck correctly.

### mkcert CA trust pattern (reused from Phase 28 api service)

Outline is a Node.js app — it honours `NODE_EXTRA_CA_CERTS` natively. That is simpler than KPI Light's `update-ca-certificates` shell gymnastics (which was required because Python's `httpx` reads the system bundle, not a single file). No custom entrypoint needed:

```yaml
outline:
  image: outlinewiki/outline:0.86.0
  env_file: .env
  environment:
    NODE_EXTRA_CA_CERTS: /etc/ssl/certs/mkcert-rootCA.pem
    # ... other env
  volumes:
    - ./certs/rootCA.pem:/etc/ssl/certs/mkcert-rootCA.pem:ro
    - outline_uploads:/var/lib/outline/data
  extra_hosts:
    - "auth.internal:host-gateway"
  depends_on:
    outline-db: { condition: service_healthy }
    outline-redis: { condition: service_healthy }
```

### OIDC split-endpoint pattern

Locked in D-05. Rationale expanded:
- **Browser leg (auth):** User's browser must resolve `auth.internal` — DNS already set up via `/etc/hosts` (Phase 26 INF-03). The browser trusts mkcert via `mkcert -install`.
- **Server leg (token/userinfo):** Outline's Node process inside Docker resolves `dex:5556` via Docker DNS. This bypasses NPM, so no TLS involved, and the server never has to trust mkcert for these calls.
- **Discovery/issuer fetch:** Outline MAY fetch `https://auth.internal/dex/.well-known/openid-configuration` as part of OIDC client setup depending on its library — if so, it needs the mkcert CA + `auth.internal` DNS. That's why D-05 adds both even though user-facing endpoints are already split.

### Anti-patterns to avoid

- **Using `latest` tag** — Outline's monthly release cadence means a rolling tag can run unannounced DB migrations on next container restart.
- **Exposing port 3000 on host** — NPM is the sole edge (Phase 26 D-07). Keep as commented debug hatch.
- **Binding `outline` to the Phase 28 `migrate` service** — Outline runs its own migrations at container start; there is no Alembic to coordinate with.
- **Setting `URL` with a trailing slash** — breaks callback URL construction.
- **Hardcoding OIDC redirect URI in env** — Outline constructs `${URL}/auth/oidc.callback` automatically from `URL`. Do NOT set a separate `OIDC_REDIRECT_URI`; it doesn't exist.
- **Initializing Postgres with custom init SQL to add `uuid-ossp`** — Outline's migration step creates the extension itself on a privileged-as-owner connection. Unnecessary.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Outline DB migrations | Pre-start Alembic-style migrate service | Outline's built-in startup migration | Runs automatically; `--no-migrate` flag exists if you ever want to gate it, but not needed here. |
| Outline healthcheck | Custom `wget`/`curl` compose healthcheck | Dockerfile's built-in `HEALTHCHECK --interval=1m CMD wget -qO- "http://localhost:3000/_health" \| grep -q "OK"` | Already present in v0.86.0 Dockerfile; the 0.79.0 bug is fixed. Setting `PORT=3000` explicitly is the remaining belt-and-suspenders. |
| OIDC discovery | Manually wiring `OIDC_DISCOVERY_URI` | Explicit `OIDC_AUTH_URI`, `OIDC_TOKEN_URI`, `OIDC_USERINFO_URI` | Outline does NOT support a discovery URL — each URI must be set individually. This is why the split-endpoint pattern works. |
| Postgres extension setup | init-SQL `CREATE EXTENSION uuid-ossp` | Let Outline's migration do it | Outline's migrations create required extensions; init SQL adds a file to manage for no gain. |
| Session store | External Redis session plugin | Redis already required | Outline uses Redis for both jobs and websocket pub/sub; no separate session backend needed. |
| Workspace branding (Phase 29) | `TEAM_LOGO_URL`, env-driven team name | In-UI Settings after first login (D-03) | First-login user can rename the workspace and upload a logo through Outline's built-in Settings. |

**Key insight:** Outline is batteries-included — the temptation to mirror KPI Light's explicit `migrate` service pattern is wrong here. Let Outline manage its own DB lifecycle.

## Runtime State Inventory

Not a rename/refactor phase — greenfield service deployment. No pre-existing Outline state on the target machine. Omitting the formal inventory table.

One migration-adjacent note: the `outline-db` and `outline-redis` volumes are created fresh. Fresh stack = fresh workspace with no users; first login through Dex JIT-provisions the first user, who becomes the workspace admin (WIK-05).

## Common Pitfalls

### Pitfall 1: `URL` mismatch with NPM hostname
**What goes wrong:** `URL=https://wiki.internal/` (trailing slash) or `URL=http://wiki.internal` (wrong scheme). Outline emits malformed callback URLs; OIDC fails with a redirect-URI mismatch at Dex.
**Why it happens:** Copy-paste from examples, or ops intuition to include the trailing slash.
**How to avoid:** Exactly `https://wiki.internal`. Match the redirect URI registered in Dex (Phase 27 D-25): `https://wiki.internal/auth/oidc.callback`.
**Warning signs:** Dex logs `redirect_uri does not match client registration`.

### Pitfall 2: `SECRET_KEY` == `UTILS_SECRET`
**What goes wrong:** Outline logs a startup warning and proceeds; later, email-token and session-cookie systems share entropy. Not immediately broken but documented as incorrect by Outline.
**How to avoid:** Two independent `openssl rand -hex 32` runs. `.env.example` comment should emphasize "each is independent".

### Pitfall 3: Issuer `iss` claim validation failure
**What goes wrong:** Outline receives an ID token from Dex and validates `iss == https://auth.internal/dex`. If `OIDC_AUTH_URI` host resolves differently (e.g., to a direct docker DNS without the path prefix), token validation fails with "issuer mismatch".
**How to avoid:** Keep `OIDC_AUTH_URI` on `https://auth.internal/dex/...` — matches the exact issuer string Dex emits in `iss`. The token/userinfo URIs can use internal DNS without affecting `iss` validation (token signature is what's checked; issuer claim is compared to discovery).
**Warning signs:** Login redirects to Outline, flashes an error, and comes back to login page. `docker compose logs outline` shows `issuer validation failed`.

### Pitfall 4: Redis memory persistence across restarts
**What goes wrong:** `redis:7-alpine` without a volume mount loses jobs on restart. For Outline's wiki workload this is mostly harmless (background tasks are idempotent), but websocket session state disappears — users see a brief reconnect.
**How to avoid:** Mount `outline_redis_data:/data`. Outline tolerates Redis restarts either way; persistence is a minor UX nicety.

### Pitfall 5: File storage volume not mounted
**What goes wrong:** Attachments upload successfully, survive to disk inside the container, then vanish on `docker compose down` (WIK-03 Success Criterion #5 fails).
**How to avoid:** Declare the named volume explicitly: `outline_uploads:/var/lib/outline/data`. Path `/var/lib/outline/data` matches the Dockerfile's `VOLUME` declaration, so omitting the mount DOES create an anonymous volume — but it would be orphaned on recreate. Named volume is the only safe form.

### Pitfall 6: OIDC logout expectation
**What goes wrong:** Users expect clicking "Log out" in Outline to also log them out of KPI Light (and vice versa). It does not.
**How to avoid:** Inherited from Phase 27/28 limitation — Dex has no RP-initiated logout. Document in `docs/setup.md` Phase 29 section alongside the KPI Light logout note.

### Pitfall 7: `extra_hosts` missing when split endpoints suggest it isn't needed
**What goes wrong:** Operator reads D-05 split-endpoint config and reasons "token/userinfo are internal DNS, so we don't need `auth.internal` inside the container". But Outline's OIDC library may still perform discovery against `OIDC_AUTH_URI` host on startup, or validate `iss` by re-fetching discovery.
**How to avoid:** Keep `extra_hosts: "auth.internal:host-gateway"` as CONTEXT D-05 dictates. It's three lines and eliminates a whole class of intermittent bug.

### Pitfall 8: Postgres version mismatch with existing `db`
**What goes wrong:** Operator reuses `postgres:17-alpine` — good — but accidentally mounts `postgres_data` (the KPI Light volume). Data collision, startup failure.
**How to avoid:** Distinct volume names: `outline_db_data` (not `postgres_data`), `outline_redis_data`, `outline_uploads`.

## Code Examples

Verified patterns from `.env.sample` at v0.86.0 tag and Phase 28 `docker-compose.yml`.

### Outline service block (canonical shape)

```yaml
  outline:
    image: outlinewiki/outline:0.86.0
    restart: unless-stopped
    env_file: .env
    environment:
      NODE_ENV: production
      PORT: 3000
      URL: https://wiki.internal
      SECRET_KEY: ${OUTLINE_SECRET_KEY}
      UTILS_SECRET: ${OUTLINE_UTILS_SECRET}
      DATABASE_URL: postgres://outline:${OUTLINE_DB_PASSWORD}@outline-db:5432/outline
      PGSSLMODE: disable
      REDIS_URL: redis://outline-redis:6379
      FILE_STORAGE: local
      FILE_STORAGE_LOCAL_ROOT_DIR: /var/lib/outline/data
      FILE_STORAGE_UPLOAD_MAX_SIZE: "262144000"
      FORCE_HTTPS: "true"
      DEFAULT_LANGUAGE: en_US
      OIDC_CLIENT_ID: outline
      OIDC_CLIENT_SECRET: ${DEX_OUTLINE_SECRET}
      OIDC_AUTH_URI: https://auth.internal/dex/auth
      OIDC_TOKEN_URI: http://dex:5556/dex/token
      OIDC_USERINFO_URI: http://dex:5556/dex/userinfo
      OIDC_USERNAME_CLAIM: preferred_username
      OIDC_DISPLAY_NAME: name
      OIDC_SCOPES: openid profile email offline_access
      NODE_EXTRA_CA_CERTS: /etc/ssl/certs/mkcert-rootCA.pem
    volumes:
      - ./certs/rootCA.pem:/etc/ssl/certs/mkcert-rootCA.pem:ro
      - outline_uploads:/var/lib/outline/data
    extra_hosts:
      - "auth.internal:host-gateway"
    depends_on:
      outline-db:
        condition: service_healthy
      outline-redis:
        condition: service_healthy
      dex:
        condition: service_healthy
    # Debug hatch (matches Phase 26/27 convention):
    # ports:
    #   - "3000:3000"
    # Dockerfile HEALTHCHECK already probes http://localhost:3000/_health — no override needed.
```

### outline-db block

```yaml
  outline-db:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: outline
      POSTGRES_USER: outline
      POSTGRES_PASSWORD: ${OUTLINE_DB_PASSWORD}
    volumes:
      - outline_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U outline -d outline"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s
```

### outline-redis block

```yaml
  outline-redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - outline_redis_data:/data
    healthcheck:
      test: ["CMD-SHELL", "redis-cli ping | grep -q PONG"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 5s
```

### `.env.example` additions

```env
# ─── Outline (Phase 29) ──────────────────────────────────────────────────
# Generate each with: openssl rand -hex 32 (two independent values!)
OUTLINE_SECRET_KEY=
OUTLINE_UTILS_SECRET=
OUTLINE_DB_PASSWORD=
# DEX_OUTLINE_SECRET — already defined in Phase 27 block above; Outline reuses it.
```

### NPM proxy host (`wiki.internal`) — operator action, documented in `docs/setup.md`

Edit the existing `wiki.internal` placeholder row (created in Phase 26 §4.3):

| Field | Value |
|-------|-------|
| Forward Hostname / IP | `outline` |
| Forward Port | `3000` |
| Scheme | `http` |
| Websockets Support | **ON** (Outline uses websockets for real-time collaboration) |
| Block Common Exploits | ON |
| SSL Certificate | `internal-wildcard` |
| Force SSL | ON |
| HTTP/2 | ON |
| HSTS | off |

Advanced tab (same `X-Forwarded-*` headers as Dex — Outline respects `FORCE_HTTPS` but forwarding-proto is safer for future link generation):

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto https;
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Real-IP $remote_addr;
```

### Manual backup one-liner (D-04) for `docs/setup.md`

```bash
# Outline database dump
docker compose exec outline-db pg_dump -U outline outline \
  > "outline-db-$(date +%F).sql"

# Outline attachments (local file storage volume)
docker compose exec outline tar -czf - /var/lib/outline/data \
  > "outline-uploads-$(date +%F).tar.gz"
```

### BSL 1.1 paragraph for README (WIK-07)

The actual Additional Use Grant (verified from `LICENSE` at v0.86.0 tag) is:

> "You may make use of the Licensed Work, provided that you may not use the Licensed Work for a Document Service."

A "Document Service" = commercial offering where third parties (non-employees/contractors) access the functionality. **There is no 50-person cap in the actual license** — the prior CONTEXT reference to "≤50-person internal use" appears to conflate this grant with another project's terms. Recommended README wording:

```markdown
## License Note — Outline Wiki

This repository deploys Outline (https://github.com/outline/outline), which is
licensed under the Business Source License 1.1 (BSL 1.1). The Additional Use
Grant permits internal use by your own employees and contractors. It does NOT
permit offering a competing "Document Service" — i.e. a commercial product that
grants third parties access to Outline's functionality. Our deployment at
`wiki.internal` is internal-team documentation only and falls squarely under
the Additional Use Grant.

Each Outline release converts to an OSI-approved open-source license four
years after its release date; no end-of-life concern for self-hosters.
```

The planner should flag the prior "≤50-person" CONTEXT reference as a correction: there is no numeric cap, only a restriction on offering a competing service.

## State of the Art

| Old approach | Current approach (0.86) | When changed | Impact |
|--------------|-------------------------|--------------|--------|
| S3/MinIO required for attachments | `FILE_STORAGE=local` supported natively | ~0.80+ | MinIO entirely excluded per WIK-03; single named volume replaces a whole service |
| `HEALTHCHECK` broken without explicit `PORT` | Fixed in 0.79.1 | — | Still set `PORT=3000` defensively |
| Outline had no built-in image lightbox | Shipped in v1.0.0 | Post-0.86 | Not relevant to deployment; noted for upgrade planning |
| BSL Additional Use Grant once referenced a user cap in some documentation | Current LICENSE: Document Service restriction only | — | Correct README wording accordingly |

**Deprecated / outdated:**
- MinIO: image discontinued Oct 2025, repo archived Feb 2026 (per REQUIREMENTS.md §Out of Scope). `FILE_STORAGE=local` is the canonical replacement.
- `hash-password` subcommand: removed from Dex v2.43.0 — not relevant to Outline, but reinforces the "pin + verify upstream defaults haven't shifted" discipline.

## Open Questions

1. **Does Outline 0.86 fetch the OIDC discovery document on startup or lazily on first login?**
   - What we know: the three `OIDC_*_URI` variables are set explicitly; Outline does NOT consume a discovery URL directly.
   - What's unclear: whether the library used internally (likely `openid-client`) still probes `.well-known/openid-configuration` under the hood for JWKS.
   - Recommendation: keep the mkcert CA + `extra_hosts` wired (D-05) — cheap insurance that covers either behavior. Validate during execution by watching `docker compose logs outline` during first login for any HTTPS errors against `auth.internal`.

2. **Does the first-login user auto-receive admin role?**
   - What we know: Outline's JIT provisioning creates the team on first user; that user is the workspace admin by default.
   - What's unclear: whether `preferred_username=admin` vs `preferred_username=dev` influences role assignment (it doesn't — first user wins regardless of claim values).
   - Recommendation: UAT plan should specifically have the Phase 27 `admin@acm.local` user log in first so they own the workspace admin seat.

3. **Does Outline need Postgres `pg_trgm` extension for full-text search?**
   - What we know: Outline migrations create required extensions. `uuid-ossp` is standard.
   - What's unclear: whether newer Outline versions add `pg_trgm` or require it out-of-band on managed Postgres. Self-hosted `postgres:17-alpine` has it available in `contrib`.
   - Recommendation: ignore unless migration fails with a specific extension error. If so, add init SQL. LOW confidence but also LOW risk — trivial to fix reactively.

## Environment Availability

No new external dependencies beyond what's already in the stack. Outline image, Postgres 17, Redis 7 are all pulled from Docker Hub / GHCR at build time.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `outlinewiki/outline:0.86.0` image | WIK-01 | Assumed (public Docker Hub) | 0.86.0 | — |
| `postgres:17-alpine` | WIK-02 | Confirmed (already in repo) | 17 | — |
| `redis:7-alpine` | WIK-02 | Assumed (Docker Hub) | 7 | — |
| `openssl` on operator host | D-01 secret gen | Assumed universal | — | `python3 -c "import secrets; print(secrets.token_hex(32))"` (already documented as alt in Phase 28 setup.md) |
| Existing mkcert rootCA at `./certs/rootCA.pem` | D-05 | Confirmed (Phase 26 artifact) | — | — |
| NPM admin UI reachable | WIK-01 | Confirmed (Phase 26) | — | — |

Nothing blocking. No fallbacks required.

## Validation Architecture

> `.planning/config.json`'s `workflow.nyquist_validation` key not confirmed present — including the section defensively since this is a Docker-Compose / operator-runbook phase where traditional unit testing is mostly not applicable and explicit UAT commands are the validation substrate.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | curl + `docker compose` + human UAT (no pytest/jest applicable to compose-only changes) |
| Config file | None — scripted checks in `docs/setup.md` verification block |
| Quick run command | `docker compose ps outline outline-db outline-redis` (all three "healthy") |
| Full suite command | Full UAT walkthrough per §Phase 29 in `docs/setup.md` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| WIK-01 | Outline reachable at `https://wiki.internal` | smoke | `curl -skf https://wiki.internal/ -o /dev/null && echo OK` | ❌ Wave 0 (docs/setup.md verification block) |
| WIK-02 | outline-db + outline-redis healthy | smoke | `docker compose ps --format json outline-db outline-redis \| jq -r '.Health' \| grep -c healthy \| grep -q 2` | ❌ Wave 0 |
| WIK-03 | Attachment persists across restart | manual-only | Upload via UI → `docker compose restart outline` → verify file still rendered | — (manual UAT per SC #5) |
| WIK-04 | Outline OIDC flow completes | integration | `curl -skIL https://wiki.internal/auth/oidc -o /dev/null -w "%{http_code}\n"` returns 302 to Dex | ❌ Wave 0 |
| WIK-05 | First login JIT-provisions user | manual-only | Open `https://wiki.internal` → Dex login with `admin@acm.local` → dashboard loads | — (manual UAT) |
| WIK-06 | No SMTP vars set | unit-ish | `docker compose exec outline sh -c 'env \| grep -E "^SMTP_"' \| wc -l` returns 0 | ❌ Wave 0 |
| WIK-07 | BSL paragraph in README | lint | `grep -q "Business Source License" README.md` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `docker compose config` (validates YAML) + `docker compose ps` after `up -d` (no unhealthy services)
- **Per wave merge:** full `docker compose up --build` + all curl checks above
- **Phase gate:** manual UAT of WIK-03 (attachment persistence) and WIK-05 (first OIDC login) + Success Criterion #3 (SSO without re-login)

### Wave 0 Gaps
- [ ] `docs/setup.md` Phase 29 verification block — add the curl/docker-compose-ps check sequence above
- [ ] Optional: `scripts/verify-phase-29.sh` — a 10-line script that runs the automated checks. Not required but matches the grep-verification pattern Phases 26/27 set.

*(No framework install needed — this is pure ops/Docker.)*

## Sources

### Primary (HIGH confidence)
- Outline v0.86.0 `.env.sample` — https://github.com/outline/outline/blob/v0.86.0/.env.sample (env var names and defaults verified verbatim)
- Outline v0.86.0 Dockerfile — HEALTHCHECK, CMD, VOLUME, PORT verified at tag `v0.86.0`
- Outline v0.86.0 LICENSE — Additional Use Grant text verified
- Outline official hosting docs — https://docs.getoutline.com/s/hosting/doc/docker-7pfeLP5a8t (migration auto-run at startup, `--no-migrate` flag, `storage-data:/var/lib/outline/data` volume)
- `.planning/research/v1.11-outline.md` — prior milestone research, version pin confirmation, BSL analysis
- `.planning/phases/28-kpi-light-oidc-integration/28-CONTEXT.md` — mkcert CA + `extra_hosts` pattern template
- `docker-compose.yml` (repo) — as-built `api` service showing the CA-mount pattern to mirror
- `docs/setup.md` (repo) — NPM proxy host layout + Dex first-login workflow

### Secondary (MEDIUM confidence)
- GitHub issue outline/outline#7547 — HEALTHCHECK bug history and fix in 0.79.1 (cross-verified against current Dockerfile)
- Community self-hosting guides (mrkaran.dev, bitdoze.com, Medium) — corroborate env var set and compose shape

### Tertiary (LOW confidence)
- `pg_trgm` extension requirement for Outline full-text search — flagged as Open Question 3; treat as reactive-fix if it surfaces

## Metadata

**Confidence breakdown:**
- Standard stack (env vars, versions, images): **HIGH** — verified against v0.86.0 tag source
- Architecture (compose topology, CA mount, split OIDC): **HIGH** — reuses proven Phase 28 pattern + verified env sample
- Pitfalls: **HIGH** — derived from source + 28-02 lessons learned + milestone research
- BSL license wording: **HIGH** — verified against LICENSE at tag (corrects CONTEXT's "≤50-person" reference)
- `pg_trgm` / Postgres extension specifics: **LOW** — not known whether 0.86 migrations add any beyond `uuid-ossp`; mitigated as Open Q3

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (30 days — Outline monthly cadence; pin to 0.86.0 insulates but upstream may deprecate env vars in minor bumps)
