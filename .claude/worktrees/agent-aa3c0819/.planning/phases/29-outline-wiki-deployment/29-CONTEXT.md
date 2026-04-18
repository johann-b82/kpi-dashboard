---
phase: 29
name: outline-wiki-deployment
created: 2026-04-15
---

# Phase 29 Context — Outline Wiki Deployment

## Phase Goal

Outline 0.86.0 runs at `https://wiki.internal` with its own Postgres + Redis, using local file storage, and a developer can log in using the same Dex credentials they use for KPI Light.

## Domain Boundary

**In scope:** `outline`, `outline-db`, `outline-redis` compose services; NPM proxy host for `wiki.internal`; OIDC wiring to Dex; local-volume attachment storage; BSL compliance note in README; secrets + runbook extensions.

**Out of scope:** NavBar wiki link (Phase 30); seeding documentation content (Phase 31); SMTP/email invitations (deferred per WIK-06); MinIO (explicitly rejected by WIK-03).

## Carried-Forward Decisions (from prior phases)

- **Edge TLS via NPM + mkcert wildcard cert** (Phase 26 D-01..D-04) — `wiki.internal` proxy host added in NPM admin UI, not compose YAML.
- **Dex issuer locked at `https://auth.internal/dex`** (Phase 27) — `outline` OIDC client already registered with redirect URI `https://wiki.internal/auth/oidc.callback`.
- **mkcert rootCA mount pattern for OIDC containers** (Phase 28 D-19) — containers that call Dex over HTTPS mount `./certs/rootCA.pem` read-only + extend system CA bundle at startup.
- **Secrets via `.env` file only** (Phase 26 house style) — never hardcoded in `docker-compose.yml`.
- **Healthcheck-gated startup** (house style) — `depends_on: condition: service_healthy` for all services.
- **Pinned image tags** (house style) — e.g., `outlinewiki/outline:0.86.0`, `postgres:17-alpine`, `redis:7-alpine`.
- **Single compose file for dev + single-VM prod** (Phase 26 D-08) — no `docker-compose.dev.yml` split.

## Decisions (Phase 29)

### D-01: Outline secrets via `.env.example` placeholders
Add `OUTLINE_SECRET_KEY=` and `OUTLINE_UTILS_SECRET=` to `.env.example` with inline comment `# Generate with: openssl rand -hex 32`. Operator runs the command once during setup and pastes values into `.env`. Matches existing `SESSION_SECRET` / `DEX_KPI_SECRET` pattern from Phases 27-28. No helper script.

**Rationale:** Reproducible, version-controlled documentation of the required vars. Scripts add surface area without solving a real problem for a one-time setup step.

### D-02: OIDC claim mapping
- `OIDC_USERNAME_CLAIM=preferred_username`
- `OIDC_DISPLAY_NAME=name`
- `OIDC_SCOPES="openid profile email offline_access"`
- `sub` remains the stable identifier Outline uses internally.

**Rationale:** Matches Dex default claims. `preferred_username` survives email changes; `name` gives the friendly display string in the Outline UI.

### D-03: No env-based workspace branding
Skip `TEAM_LOGO_URL` / initial team name via env. First-login user renames the workspace and uploads a logo through Outline Settings. Branding polish belongs in Phase 31 (Seed Outline Docs) where it's part of the doc-seeding runbook.

**Rationale:** Phase 29 scope is "deployed + logins work". Adding env-driven branding widens scope without serving the phase goal.

### D-04: Manual backup one-liner in `docs/setup.md`
Extend `docs/setup.md` with a short "Backups" subsection covering:
- `pg_dump` against `outline-db` (matches existing KPI Light DB backup idiom if present)
- `docker compose exec outline tar -czf - /var/lib/outline/data > outline-uploads-$(date +%F).tar.gz`

No automation — operator runs manually. Persistence is already exercised by Success Criterion #5 (attachment survives restart).

**Rationale:** Cheap, keeps the runbook complete for an internal-tool handoff. Automation belongs in a future ops phase.

### D-05: Split Dex endpoints per WIK-04 + mount mkcert CA in Outline container
- `OIDC_AUTH_URI=https://auth.internal/dex/auth` (browser-reachable; user redirects here)
- `OIDC_TOKEN_URI=http://dex:5556/dex/token` (internal docker DNS; token exchange server-to-server)
- `OIDC_USERINFO_URI=http://dex:5556/dex/userinfo` (internal docker DNS)
- Mount `./certs/rootCA.pem:/etc/ssl/certs/mkcert-rootCA.pem:ro` into the `outline` service
- Set `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/mkcert-rootCA.pem` in the Outline environment block
- Add `extra_hosts: "auth.internal:host-gateway"` so the container can resolve the hostname if issuer validation requires an HTTPS callout

**Rationale:** Defensive against Outline version changes that might validate `iss` claim against a fetched issuer URL. ~3 compose lines; matches the pattern established for the `api` container in Phase 28.

## Folded Todos

None — no pending todos matched Phase 29 scope.

## Deferred Ideas

- **Automated backup/restore scripts** — defer to a dedicated ops phase once internal rollout data pressure exists.
- **SMTP-based invitations for Outline** — WIK-06 explicitly defers this; out-of-band invites for v1.11.
- **Let's Encrypt / real-domain TLS** — Phase 26 deferred to v2; Phase 29 continues to rely on mkcert edge.
- **Multi-project wiki collections structure** — Phase 31 (WMP requirements).

## Specifics (user-stated references)

- Image pins: `outlinewiki/outline:0.86.0`, `postgres:17-alpine`, `redis:7-alpine`.
- License compliance target: BSL 1.1 Additional Use Grant, ≤50-person internal use (WIK-07).
- Attachment backend: `FILE_STORAGE=local` on a named volume `outline_uploads` (WIK-03); MinIO explicitly rejected (image discontinued Oct 2025).

## Canonical Refs

- `.planning/ROADMAP.md` — Phase 29 entry with Success Criteria and depends-on chain
- `.planning/REQUIREMENTS.md` — WIK-01..WIK-07
- `.planning/phases/26-npm-hostnames/26-CONTEXT.md` — NPM edge + mkcert + single-compose conventions (D-01..D-11)
- `.planning/phases/27-dex-idp-setup/27-CONTEXT.md` — Dex client registration for `outline`
- `.planning/phases/28-kpi-light-oidc-integration/28-CONTEXT.md` — mkcert CA mount + `extra_hosts` pattern (D-19)
- `.planning/phases/28-kpi-light-oidc-integration/28-02-SUMMARY.md` — concrete `api` service implementation of the CA-mount pattern being reused here
- `docker-compose.yml` — existing service topology to extend (not replace)
- `docs/setup.md` — runbook to extend with Phase 29 section + Backups subsection
- `certs/rootCA.pem` — mkcert root CA to mount into the Outline container
- External: https://docs.getoutline.com/s/hosting/doc/docker-XXXX (Outline self-hosting docs — researcher to cite exact URL)
- External: https://www.getoutline.com/terms — BSL 1.1 + Additional Use Grant (for README compliance note)

## Success Signals for Research + Planning

Downstream agents should produce plans that:
1. Add three compose services (`outline`, `outline-db`, `outline-redis`) with healthchecks and correct `depends_on` ordering
2. Wire OIDC env vars exactly per D-02 and D-05
3. Generate/document the two Outline secrets per D-01
4. Extend `.env.example` and `docs/setup.md` with the full first-run + backup workflow
5. Add a BSL 1.1 compliance paragraph to `README.md` (WIK-07)
6. Verify Success Criterion #3 (shared Dex SSO across KPI Light and Outline) — the highest-risk integration point
