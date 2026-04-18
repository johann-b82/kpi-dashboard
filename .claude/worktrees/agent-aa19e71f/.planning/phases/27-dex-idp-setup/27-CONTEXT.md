# Phase 27: Dex IdP Setup - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy Dex v2.43.0 as a self-contained OIDC issuer at `https://auth.internal/dex`, with two OIDC clients pre-registered (`kpi-light`, `outline`) and two static users seeded. Success = hitting the OIDC discovery endpoint returns a valid JSON document whose `issuer` exactly matches the browser-reachable URL, and a user can complete a login at the Dex login page.

Out of scope:
- Wiring Dex into KPI Light's FastAPI (Phase 28)
- Wiring Dex into Outline (Phase 29)
- RP-initiated logout — Dex lacks it; mitigated by short ID token TTL (DEX-05)
- Admin UI for user management — there isn't one; adding users is an edit-and-restart workflow documented in the runbook
- gRPC API (researched, not enabled — no use case in v1.11)

</domain>

<decisions>
## Implementation Decisions

### Issuer + Hostname Wiring
- **D-01:** Issuer URL is `https://auth.internal/dex` (path-prefixed). Roadmap success criterion 1 is verbatim verified by curling `https://auth.internal/dex/.well-known/openid-configuration` and asserting `issuer == "https://auth.internal/dex"`.
- **D-02:** `auth.internal` (whole host) → `dex:5556` in NPM. Dedicated auth hostname. Any non-Dex request to `auth.internal/*` just gets a Dex 404; that's fine — nothing else lives on this hostname. Replaces the Phase 26 placeholder that currently points `auth.internal` at `api:8000`.
- **D-03:** Dex listens on plain HTTP (`web.http: 0.0.0.0:5556`) inside the container. NPM terminates TLS using the `internal-wildcard` mkcert cert from Phase 26. No in-container TLS.

### Seeded Users (DEX-04)
- **D-04:** Two placeholder identities seeded at creation:
  - `admin@acm.local` / username `admin` — admin role (no Dex role system yet; this is a naming convention for later when apps consume claims)
  - `dev@acm.local` / username `dev` — regular user
- **D-05:** Each user gets a stable UUID in `userID` field — generated once with `uuidgen` or equivalent, hardcoded, never changed (changing breaks existing sessions).
- **D-06:** Real team emails are NOT seeded in this phase. They get added later via the documented bcrypt workflow (D-15) once Phases 28/29 land and login is actually useful.

### Token Lifetimes
- **D-07:** `expiry.idTokens: 1h` — complies with DEX-05 (access token TTL ≤ 1h). Bounds the single-logout gap since Dex has no RP-initiated logout.
- **D-08:** `expiry.refreshTokens.validIfNotUsedFor: 720h` (30 days) — idle timeout. User untouched for 30 days is logged out.
- **D-09:** `expiry.refreshTokens.absoluteLifetime: 2160h` (90 days) — hard cap; quarterly re-login enforced.
- **D-10:** `expiry.refreshTokens.disableRotation: false` — keep rotation on (safer default).
- **D-11:** `oauth2.skipApprovalScreen: true` — internal tool, no consent page.
- **D-12:** Grant types: `authorization_code` + `refresh_token`. Response types: `code` only. No implicit flow.

### Client-Secret Handling
- **D-13:** Client secrets live in `.env` with `$VAR` substitution natively supported by Dex (no gomplate). Keys: `DEX_KPI_SECRET`, `DEX_OUTLINE_SECRET`. Values placeholder-documented in `.env.example`; real secrets generated once (e.g. `openssl rand -hex 32`) and never committed.
- **D-14:** Downstream phases (28 = KPI Light, 29 = Outline) read the SAME env var names from their OWN service env blocks — single source of truth across the stack. The compose file wires it.

### User Management Workflow
- **D-15:** Canonical "add a user" workflow:
  1. `docker compose run --rm dex dex hash-password` — interactive prompt, prints bcrypt hash
  2. Edit `./dex/config.yaml`, append a new entry under `staticPasswords:` with a freshly generated UUID
  3. `docker compose restart dex` (< 2 s startup)
  4. Verify: user can log in at `https://auth.internal/dex/auth?...` (or deferred to whichever app flow exists)
- **D-16:** User removal: delete entry → restart. Existing refresh tokens become invalid on next use (Dex can't find user). For immediate revocation, deleting the `dex_data` volume is the nuclear option. Documented limitation.

### Config + Storage Layout
- **D-17:** `./dex/config.yaml` in repo (git-tracked except resolved secrets), bind-mounted read-only into the container at `/etc/dex/config.yaml`. Matches Phase 26 pattern (compose.yml in repo, mkcert certs bind-mounted read-only). Edit-and-restart is the house workflow.
- **D-18:** `dex_data` named Docker volume — holds ONLY `/data/dex.db` (SQLite). Survives `docker compose restart dex` and `docker compose down` (not `down -v`). Per roadmap success criterion 5.
- **D-19:** No Postgres backend — SQLite is fine for 5–10 users with infrequent auth ops (research Section 3).

### Compose Service Shape
- **D-20:** Image: `ghcr.io/dexidp/dex:v2.43.0` pinned exactly. Prefer GHCR over Docker Hub (unauthenticated pull rate limits).
- **D-21:** Healthcheck: `wget -qO- http://localhost:5556/dex/healthz` (research-recommended). Adjust to `127.0.0.1` if the same busybox IPv6 issue that bit 26-01 appears — verify during execution.
- **D-22:** No host port binding for `5556`. NPM is the only edge, per Phase 26 D-07. Debug hatch: a commented-out `# - "5556:5556"` in compose with inline rationale, matching the Phase 26 convention for `5173` and `8000`.
- **D-23:** `depends_on` — Dex has no service dependency (no Postgres, no Redis). NPM's `depends_on` list is extended: `dex: condition: service_healthy` added alongside the existing `api` and `frontend` gates, so NPM only starts when all three routable backends are ready.
- **D-24:** `restart: unless-stopped` — matches the NPM service shape.

### Clients Config
- **D-25:** Two static clients, both with exactly one redirect URI (no dev-localhost variant):
  - `kpi-light` → `https://kpi.internal/api/auth/callback` (DEX-03)
  - `outline` → `https://wiki.internal/auth/oidc.callback` (DEX-03; note the dot in `oidc.callback` — Outline's exact expected path)
- **D-26:** `offline_access` scope supported (DEX-06) — required for refresh token issuance. Default Dex config already exposes it; no extra config line needed.

### Claude's Discretion
- **Service name:** `dex` (short, matches convention — `npm`, `api`, `frontend`, `db`)
- **Logger:** `level: info`, `format: json` (research-recommended for container log aggregation; matches the FastAPI uvicorn default)
- **gRPC:** disabled. No use case in v1.11.
- **Telemetry endpoint:** omitted. Can be added post-v1.11 if observability becomes interesting.
- **`web.allowedOrigins`:** unset (not needed — we use Authorization Code flow server-side, not SPA direct calls to Dex).
- **NPM proxy-host Advanced block:** likely needs `proxy_set_header Host $host` + `X-Forwarded-Proto https` so Dex knows the request came over TLS. Researcher will confirm exact headers against Dex docs + NPM defaults.
- **Runbook updates:** `docs/setup.md` (from Phase 26) gets a new "Dex first-login" section covering: add the `auth.internal` → `dex:5556` proxy host in NPM, generate client secrets, hash-password workflow for adding users.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing codebase
- `docker-compose.yml` — current 5-service stack (db, migrate, api, frontend, npm); healthcheck + depends_on idioms to match; Phase 26 note about busybox wget IPv6 (`127.0.0.1` vs `localhost`)
- `scripts/generate-certs.sh` — mkcert SAN cert already includes `auth.internal` — no cert changes needed this phase
- `.env.example` — append `DEX_KPI_SECRET` and `DEX_OUTLINE_SECRET` placeholders
- `docs/setup.md` — extend with Dex-specific runbook section
- `README.md` — Quickstart may need a one-line note about Dex being the auth provider (optional, cosmetic)

### Prior phase artifacts
- `.planning/phases/26-npm-hostnames/26-CONTEXT.md` — locked decisions on mkcert, NPM D-09 (manual admin config), hostnames
- `.planning/phases/26-npm-hostnames/26-02-SUMMARY.md` — as-built NPM proxy-host config to modify for `auth.internal`
- `.planning/phases/26-npm-hostnames/26-03-SUMMARY.md` — setup runbook structure to extend

### Milestone-level research
- `.planning/research/v1.11-dex.md` — **PRIMARY reference.** Config skeleton, issuer gotcha, token lifetimes, user management realities, Authlib hints for Phase 28
- `.planning/research/v1.11-SUMMARY.md` — architecture diagram showing Dex ↔ NPM ↔ apps
- `.planning/research/v1.11-kpi-oidc.md` — Phase 28 preview; confirms `kpi-light` redirect URI contract
- `.planning/research/v1.11-outline.md` — Phase 29 preview; confirms `outline` redirect URI contract (`oidc.callback` with the dot)

### External (URLs — downstream agents look up if needed)
- Dex releases: https://github.com/dexidp/dex/releases
- Dex config.yaml reference: https://github.com/dexidp/dex/blob/master/config.yaml.dist
- Dex tokens config: https://dexidp.io/docs/configuration/tokens/
- Dex OAuth2 config: https://dexidp.io/docs/configuration/oauth2/
- Dex local (static-password) connector: https://dexidp.io/docs/connectors/local/

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Compose healthcheck idiom** — `wget --spider` / `curl -f` patterns established; Dex healthcheck follows suit with `/dex/healthz`
- **`depends_on` service_healthy gating** — Phase 26 set the pattern; NPM already gates on `api` + `frontend`, extending to `dex` is mechanical
- **Read-only bind mount pattern** — Phase 26 does this for `./certs:/etc/certs:ro`; Dex config follows: `./dex/config.yaml:/etc/dex/config.yaml:ro`
- **`.env.example` as self-documenting scaffold** — Phase 26 added NPM bootstrap creds block; Phase 27 appends a Dex secrets block

### Established Patterns
- Image pins with exact versions (`postgres:17-alpine`, `jc21/nginx-proxy-manager:2.11.3`) — Dex follows: `ghcr.io/dexidp/dex:v2.43.0`
- No host port bindings for internal services once NPM is the edge (Phase 26 D-07) — Dex `5556` stays internal, commented-out debug hatch optional
- Secrets in `.env`, never YAML — Dex config uses `$VAR` substitution consistently
- IPv4 `127.0.0.1` in healthchecks to dodge busybox IPv6 resolution (Phase 26 fix in eab26c7) — apply if Dex image uses busybox

### Integration Points
- `docker-compose.yml` — new `dex` service, new `dex_data` volume, new `depends_on` edge in `npm`
- `./dex/config.yaml` — NEW FILE, the core artifact
- `.env.example` — append `DEX_KPI_SECRET=` and `DEX_OUTLINE_SECRET=` placeholder block
- `docs/setup.md` — new section: "Dex first-run" (operator steps: set secrets, NPM proxy-host update, first login verification, add-user workflow)
- NPM admin UI — `auth.internal` proxy host edited (forward target `api:8000` → `dex:5556`, possibly Advanced headers block). Operator action, not code — runbook change.

</code_context>

<specifics>
## Specific Ideas

- "Path-prefixed issuer" (`https://auth.internal/dex`) is the locked URL shape — chosen in the roadmap so other things could theoretically live on `auth.internal` later, but D-02 says we give the whole hostname to Dex anyway. The path prefix stays in the URL for consistency with Outline-style setups elsewhere.
- "Placeholder users now, real users later" — D-06 is intentional friction: keeps personal emails out of git until the stack actually provides value (Phase 28+). Matches the project's MO of not shipping half-features.
- "Runbook, not automation" — Phase 26 established D-09 (manual NPM admin config). Phase 27 continues that: no scripts wrap the NPM proxy-host edit. The 3-person operator team edits NPM once per environment and commits the runbook.
- "Dev can log in as 'dev'" — when Phase 28 lands with DISABLE_AUTH=false, the `dev@acm.local` user is the designated UAT actor.

</specifics>

<deferred>
## Deferred Ideas

- **Real team-email user seeding** — post-v1.11, once Phases 28/29 make login useful. Workflow is documented (D-15) so it's a config edit, not a new phase.
- **gRPC API for programmatic user management** — not needed at 5–10 users with low churn (research Section 3). Add if user churn becomes > few/month.
- **Postgres storage for Dex** — SQLite fine for current scale (research Section 3). Revisit if auth throughput becomes a bottleneck.
- **Passkey / WebAuthn** — Dex doesn't support natively; would require swapping connector. Out of scope for this milestone.
- **RP-initiated logout** — Dex does not support it. DEX-05 (1h access token TTL) is the accepted mitigation.
- **Telemetry / metrics endpoint** — deferred until observability is a felt need.

</deferred>

*Last updated: 2026-04-14 — Phase 27 context captured*
