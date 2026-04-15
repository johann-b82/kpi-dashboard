# Requirements: KPI Light — v1.11 Outline Wiki + Shared Auth (Dex)

**Defined:** 2026-04-14
**Milestone:** v1.11 Outline Wiki + Shared Auth (Dex)
**Core Value:** Deploy an Outline wiki instance alongside KPI Light as reusable multi-project documentation infrastructure, secured by a lightweight Dex OIDC IdP that both apps trust, and seed the wiki with KPI Light's developer + user docs.

---

## v1.11 Requirements

### Infrastructure & Networking (INF)

- [x] **INF-01**: Nginx Proxy Manager (NPM) runs as a docker-compose service and terminates all HTTPS traffic to downstream services (Dex, Outline, KPI Light frontend+API)
- [x] **INF-02**: Three hostnames route to distinct services via NPM: `kpi.internal` → KPI Light frontend (with `/api/*` proxied to the `api` container), `wiki.internal` → Outline, `auth.internal` → Dex
- [x] **INF-03**: `/etc/hosts` entries for `kpi.internal`, `wiki.internal`, `auth.internal` are documented in README for developers and for the single-VM production deployment
- [x] **INF-04**: NPM terminates TLS using a self-signed certificate (development) and supports Let's Encrypt DNS-01 for future real-domain rollout (production hook documented, not activated in v1.11)
- [x] **INF-05**: Docker compose stack brings up all services (`db`, `migrate`, `api`, `frontend`, `npm`, `dex`, `outline`, `outline-db`, `outline-redis`) in the correct healthcheck-gated dependency order with a single `docker compose up --build`

### Dex OIDC Identity Provider (DEX)

- [x] **DEX-01**: Dex (`ghcr.io/dexidp/dex:v2.43.0`) runs as a docker-compose service with SQLite storage on a named volume and is reachable as `https://auth.internal` via NPM
- [x] **DEX-02**: Dex exposes a valid OIDC discovery endpoint at `https://auth.internal/dex/.well-known/openid-configuration`, with `issuer` matching the browser-reachable URL exactly
- [x] **DEX-03**: Dex is configured with two OIDC clients: `kpi-light` (redirect URI `https://kpi.internal/api/auth/callback`) and `outline` (redirect URI `https://wiki.internal/auth/oidc.callback`)
- [x] **DEX-04**: Dex `staticPasswords` block contains at least two seeded users (one admin, one regular); bcrypt hash workflow for adding new users is documented in the repo
- [x] **DEX-05**: Access token TTL ≤ 1 hour (bounds the single-logout gap since Dex lacks RP-initiated logout — documented limitation)
- [x] **DEX-06**: Dex supports `offline_access` scope so refresh tokens work for both clients

### KPI Light OIDC Integration (KPO)

- [x] **KPO-01**: FastAPI backend uses `authlib >= 1.6.0` to register Dex as an OIDC provider via `server_metadata_url`
- [x] **KPO-02**: `/api/auth/login` redirects to Dex; `/api/auth/callback` completes the authorization code + PKCE flow and sets an `httpOnly; SameSite=Lax; Secure` session cookie containing only `{sub, email, name}` (no raw tokens)
- [x] **KPO-03**: `/api/auth/me` returns `{sub, email, name}` for the authenticated user or `401` if unauthenticated
- [x] **KPO-04**: `/api/auth/logout` clears the session cookie and returns a redirect back to `/`
- [x] **KPO-05**: `DISABLE_AUTH=true` env var bypasses OIDC entirely and injects a synthetic dev user — startup emits a warning when this flag is active so it's obvious in production logs
- [x] **KPO-06**: New `app_users` table (SQLAlchemy model + Alembic migration) stores `(id, sub, email, name, created_at, last_seen_at)` upserted on every successful callback keyed by `sub`
- [x] **KPO-07**: All existing API routes (`/api/settings`, `/api/uploads`, `/api/kpis`, `/api/hr/*`, `/api/sync`, `/api/data/*`) require authentication via a FastAPI `Depends(get_current_user)` dependency — or return `401` with a clear response
- [x] **KPO-08**: React frontend has a `useCurrentUser()` TanStack Query hook (`GET /api/auth/me`) and a `<ProtectedRoute>` component that redirects to `/api/auth/login` via `window.location.href` when unauthenticated
- [x] **KPO-09**: NavBar displays the logged-in user's name (or email if name missing) and a logout button; logout submits a `POST` form to `/api/auth/logout`

### Outline Wiki (WIK)

- [x] **WIK-01**: Outline (`outlinewiki/outline:0.86.0`) runs as a docker-compose service, reachable as `https://wiki.internal` via NPM
- [x] **WIK-02**: Dedicated `outline-db` Postgres 17 container and `outline-redis` container back Outline — separate from KPI Light's `db` instance
- [x] **WIK-03**: Outline uses `FILE_STORAGE=local` with attachments stored on a named volume (MinIO deliberately excluded — image discontinued Oct 2025)
- [x] **WIK-04**: Outline authenticates against Dex via generic OIDC provider with `OIDC_AUTH_URI` pointing to the browser-reachable `https://auth.internal` and `OIDC_TOKEN_URI`/`OIDC_USERINFO_URI` pointing to internal docker DNS (`http://dex:5556/dex`)
- [x] **WIK-05**: First-time Outline login via Dex provisions the user automatically (JIT) and creates a default team/workspace
- [x] **WIK-06**: Outline runs without SMTP configured — `SMTP_*` env vars left unset, invitations via external means (out-of-band) for v1.11
- [x] **WIK-07**: License compliance: Outline BSL 1.1 usage is documented as "internal team use per Additional Use Grant" in repo README — confirms compliance for the ≤ 50-person internal use case

### Multi-Project Wiki Structure (WMP)

- [ ] **WMP-01**: At least one Outline collection named "KPI Light" exists and hosts all v1.11 seeded docs
- [ ] **WMP-02**: Collection creation + permission model is documented in `/wiki/admin-runbook.md` inside Outline so future projects can be added by following the pattern
- [ ] **WMP-03**: Collection-per-project naming convention (e.g. "KPI Light", "Project X") is established as the house style for the wiki

### Wiki Nav Integration (NAV)

- [ ] **NAV-01**: KPI Light NavBar gains a new icon (book / library glyph) linking to `https://wiki.internal` in a new tab (`target="_blank"`)
- [ ] **NAV-02**: Wiki icon lives between the existing LanguageToggle and Upload icon in the right-side NavBar cluster (exact position subject to UI-SPEC review)
- [ ] **NAV-03**: Wiki icon has a translated tooltip/aria-label (`nav.wiki` → "Wiki" EN / "Wiki" DE)

### Seeded KPI Light Documentation (DOC)

- [ ] **DOC-01**: Outline "KPI Light" collection contains a **Dev Setup** page covering local prerequisites, `docker compose up --build` flow, `/etc/hosts` entries, `.env` template walkthrough, and the `DISABLE_AUTH=true` local-dev toggle
- [ ] **DOC-02**: **Docker Compose Architecture** page with an ASCII / Mermaid diagram showing all 9 services, their healthcheck-gated dependency order, and volume layout
- [ ] **DOC-03**: **API Reference** page summarizing the FastAPI OpenAPI schema — grouped by tag (settings, uploads, kpis, hr, sync, data, auth) with example requests/responses
- [ ] **DOC-04**: **Personio Sync Runbook** page covering credential test, sync-interval settings, manual refresh button, common sync failure modes + resolutions (credential expiry, rate limits, option set changes)
- [ ] **DOC-05**: **Sales Dashboard User Guide** page covering KPI card reading, delta label interpretation, chart toggle, date-range presets, sales table usage
- [ ] **DOC-06**: **HR Dashboard User Guide** page covering 5 HR KPIs, 12-month trend charts, target reference lines (Sollwerte), employee table filters
- [ ] **DOC-07**: **Settings Walkthrough** page covering Appearance (branding, colors, logo), HR section (Personio + Sollwerte), dark-mode toggle, language toggle
- [ ] **DOC-08**: **Admin Runbook** page covering adding a Dex user (bcrypt workflow + restart), backing up Outline volumes, rotating OIDC client secrets
- [ ] **DOC-09**: All 8 pages are reachable from a Collection landing page with a Table of Contents and cross-links

### End-to-End Acceptance (E2E)

- [ ] **E2E-01**: Human UAT: fresh `docker compose up --build` on a clean VM produces a working stack — all three hostnames resolve, NPM serves HTTPS, Dex login page loads at `https://auth.internal`
- [x] **E2E-02**: Human UAT: logging into KPI Light via Dex persists across refresh, logout clears the session, `/api/auth/me` returns correctly pre/post login
- [ ] **E2E-03**: Human UAT: logging into Outline via Dex creates a new user JIT, user can create a document in the "KPI Light" collection and edit it
- [ ] **E2E-04**: Human UAT: NavBar wiki icon from KPI Light opens Outline; user is already logged in (Dex SSO session shared)
- [ ] **E2E-05**: Human UAT: all 8 seeded docs are legible, cross-linked, and reflect v1.10 state of KPI Light (not stale)
- [x] **E2E-06**: Human UAT: `DISABLE_AUTH=true` local dev flow works without Dex running (synthetic user visible in NavBar)

---

## v2 Requirements

Deferred to future milestones, tracked for planning.

### Enhanced Auth (AUTH2)

- **AUTH2-01**: Automated user-add tooling for Dex (script or tiny admin endpoint, no manual bcrypt + restart)
- **AUTH2-02**: RP-initiated logout — activate when Dex adds `end_session_endpoint` support (GitHub issue #1697)
- **AUTH2-03**: Real-domain TLS via Let's Encrypt DNS-01 on NPM (replace self-signed certs)
- **AUTH2-04**: Postgres-backed Dex storage (migrate from SQLite if concurrent-user pressure emerges)

### Wiki Enhancements (WIK2)

- **WIK2-01**: SMTP integration for Outline — team invitations, notification emails
- **WIK2-02**: S3-compatible attachment storage (Garage or equivalent) if scale requires leaving `FILE_STORAGE=local`
- **WIK2-03**: Outline → git sync for version-controlled docs-as-code workflow
- **WIK2-04**: Second project onboarded to the wiki (validates multi-project pattern in WMP-03)

### Operational Hardening (OPS2)

- **OPS2-01**: Automated backup of `outline-db`, Outline attachments volume, and Dex SQLite
- **OPS2-02**: Health + uptime monitoring for all 9 services (e.g. Uptime Kuma)
- **OPS2-03**: Log aggregation (Loki / Promtail) for auth events across Dex + KPI Light + Outline

---

## Out of Scope (v1.11)

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Authentik | Ruled out by operator based on prior experience |
| Authelia | Ruled out by operator based on prior experience |
| External SSO (Google, Slack, GitHub) | Internal tool; Dex static passwords sufficient |
| MinIO | Official image discontinued Oct 2025, repo archived Feb 2026 — replaced by `FILE_STORAGE=local` |
| RP-initiated cross-app logout | Dex does not support `end_session_endpoint` today; bounded by short token TTL (v2 when upstream lands) |
| Docs-as-code / git-synced Markdown | Author-in-Outline workflow chosen; docs-as-code deferred to v2 |
| SMTP for Outline | Invitations handled out-of-band; v1.11 user count ≤ 10 |
| Mobile-optimized wiki layout | Desktop-first; Outline's responsive mode is adequate |
| Advanced permissions (per-page ACLs) | Collection-level permissions sufficient for v1.11 |
| Public-facing docs (external users) | Internal tool; Outline is behind Dex, not publicly accessible |
| Let's Encrypt production TLS | Single-VM + self-signed for v1.11; activate DNS-01 when real domain exists |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INF-01 | Phase 26 | Complete |
| INF-02 | Phase 26 | Complete |
| INF-03 | Phase 26 | Complete |
| INF-04 | Phase 26 | Complete |
| INF-05 | Phase 26 | Complete |
| DEX-01 | Phase 27 | Complete |
| DEX-02 | Phase 27 | Complete |
| DEX-03 | Phase 27 | Complete |
| DEX-04 | Phase 27 | Complete |
| DEX-05 | Phase 27 | Complete |
| DEX-06 | Phase 27 | Complete |
| KPO-01 | Phase 28 | Complete |
| KPO-02 | Phase 28 | Complete |
| KPO-03 | Phase 28 | Complete |
| KPO-04 | Phase 28 | Complete |
| KPO-05 | Phase 28 | Complete |
| KPO-06 | Phase 28 | Complete |
| KPO-07 | Phase 28 | Complete |
| KPO-08 | Phase 28 | Complete |
| KPO-09 | Phase 28 | Complete |
| WIK-01 | Phase 29 | Complete |
| WIK-02 | Phase 29 | Complete |
| WIK-03 | Phase 29 | Complete |
| WIK-04 | Phase 29 | Complete |
| WIK-05 | Phase 29 | Complete |
| WIK-06 | Phase 29 | Complete |
| WIK-07 | Phase 29 | Complete |
| WMP-01 | Phase 31 | Pending |
| WMP-02 | Phase 31 | Pending |
| WMP-03 | Phase 31 | Pending |
| NAV-01 | Phase 30 | Pending |
| NAV-02 | Phase 30 | Pending |
| NAV-03 | Phase 30 | Pending |
| DOC-01 | Phase 31 | Pending |
| DOC-02 | Phase 31 | Pending |
| DOC-03 | Phase 31 | Pending |
| DOC-04 | Phase 31 | Pending |
| DOC-05 | Phase 31 | Pending |
| DOC-06 | Phase 31 | Pending |
| DOC-07 | Phase 31 | Pending |
| DOC-08 | Phase 31 | Pending |
| DOC-09 | Phase 31 | Pending |
| E2E-01 | Phase 31 | Pending |
| E2E-02 | Phase 28 | Complete |
| E2E-03 | Phase 31 | Pending |
| E2E-04 | Phase 31 | Pending |
| E2E-05 | Phase 31 | Pending |
| E2E-06 | Phase 28 | Complete |

**Coverage:**
- v1.11 requirements: 47 total
- Mapped to phases: 47/47 ✓
- Unmapped: 0

---

*Requirements defined: 2026-04-14*
*Last updated: 2026-04-14 — traceability populated by gsd-roadmapper*
