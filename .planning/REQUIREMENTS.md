# Milestone v1.11-directus — Requirements

**Milestone goal:** Add auth + RBAC for up to 150 users (Admin, Viewer) by introducing a single self-hosted Directus container on top of the existing Postgres — keeping the stack lean after abandoning the Dex/oauth2-proxy attempt.

**Source of truth:** `.planning/DIRECTUS-PIVOT.md` (locked decisions, risk register).

---

## Active Requirements

### Infrastructure (INFRA)

- [x] **INFRA-01**: Developer can start the full stack with `docker compose up` — boots `db`, `directus`, `api`, `frontend`, no manual steps between commands.
- [x] **INFRA-02**: The Directus admin UI is reachable at `http://localhost:8055` and the first admin user can sign in with credentials from `.env`.
- [x] **INFRA-03**: Directus connects to the existing `db` Postgres container and creates its own `directus_*` tables without interfering with Alembic-managed `public.*` tables.
- [x] **INFRA-04**: All Directus secrets (admin email/password, JWT secret, key) live in `.env` with clear `.env.example` entries and generation commands.

### Directus Configuration (CFG)

- [x] **CFG-01**: A `snapshot.yml` (or equivalent bootstrap script) defines two roles — `Admin` (full access) and `Viewer` (read-only) — reproducibly on a fresh stack.
- [x] **CFG-02**: Directus's Data Model UI does not expose the app's `public.*` tables (via `DB_EXCLUDE_TABLES` or equivalent) — operators manage users/roles in Directus, Alembic owns KPI schema.
- [x] **CFG-03**: The first Admin user is bootstrapped automatically on initial stack bring-up via env-driven `ADMIN_EMAIL` / `ADMIN_PASSWORD`; subsequent Admins can be created via the Directus UI.

### Authentication (AUTH)

- [x] **AUTH-01**: A seeded user can sign in via email/password at the Directus `POST /auth/login` endpoint and receive a valid JWT (access + refresh tokens).
- [x] **AUTH-02**: User can sign in via the web UI with email/password; invalid credentials show an inline error and do not grant a session.
- [x] **AUTH-03**: Frontend persists the Directus session via `@directus/sdk`, auto-refreshing the access token before expiry.
- [x] **AUTH-04**: FastAPI validates every `/api/*` request's `Authorization: Bearer <jwt>` against the Directus JWT shared secret (HS256) and rejects expired/invalid tokens with 401.
- [x] **AUTH-05**: `current_user` FastAPI dependency resolves `{ id, email, role }` from the verified JWT; available to all protected routes.
- [x] **AUTH-06**: User can sign out; session is cleared and subsequent API calls return 401.

### Role-Based Access Control (RBAC)

- [x] **RBAC-01**: Read endpoints (`GET /api/kpis`, `/api/hr/kpis`, `/api/data/*`, `GET /api/settings`) return data for both `Admin` and `Viewer` roles.
- [x] **RBAC-02**: Mutation endpoints (`POST /api/uploads/*`, `POST /api/sync/personio`, `PUT /api/settings`, any `DELETE /api/data/*`) require `role == 'Admin'`; return 403 for `Viewer` with body `{"detail": "admin role required"}`.
- [x] **RBAC-03**: Frontend hides admin-only UI actions (upload button, sync trigger, settings save, delete controls) when `useAuth().role === 'Viewer'`.
- [x] **RBAC-04**: Admin can promote a Viewer to Admin via the Directus admin UI (role assignment) and the change takes effect on the user's next JWT refresh (≤ token TTL).
- [x] **RBAC-05**: API contract documents the Admin-vs-Viewer matrix; 403 responses carry the machine-readable reason above.

### Bring-up & Operations (DOCS)

- [ ] **DOCS-01**: `docs/setup.md` covers first-time bring-up: clone → copy `.env.example` → generate secrets → `docker compose up -d` → first admin auto-bootstrapped → sign in to Directus admin UI to verify.
- [ ] **DOCS-02**: `docs/setup.md` documents the promote-Viewer-to-Admin flow via the Directus admin UI (click-path with screenshots or described steps).
- [x] **DOCS-03**: A nightly `pg_dump` backup is runnable (cron sidecar or host script); backups land in `./backups/`; `docs/setup.md` includes the restore procedure, exercised at least once.
- [x] **DOCS-04**: `README.md` v1.11-directus version-history entry summarizes the pivot (what was added — Directus, why not Dex/Supabase, what dropping Outline means for users).

---

## Future Requirements (deferred, not in v1.11)

- SSO/OIDC external providers (Google, M365) — Directus supports; enable when HR asks.
- Email verification + password reset via SMTP — Directus supports; enable when SMTP provisioned.
- Exposing Directus REST/GraphQL to the browser — frontend stays on FastAPI only for v1.11.
- Directus flows / webhooks / realtime features.
- Row-Level Security (RLS) policies — add if a feature bypasses FastAPI.
- Audit logging beyond Directus's built-in activity log.
- Export filtered data as CSV (DASH-07) — carried over from v1.0 backlog.
- Duplicate upload detection (UPLD-07) — carried over.
- Per-upload drill-down view (DASH-08) — carried over.

---

## Out of Scope (v1.11)

- **Outline wiki** — dropped entirely in the pivot.
- **Dex + oauth2-proxy + NPM auth_request layer** — abandoned; preserved on `archive/v1.12-phase32-abandoned` for reference only.
- **Supabase** — evaluated, rejected in favor of Directus's simpler single-container footprint.
- **Active Directory / LDAP integration** — not planned.
- **Multi-tenant / multi-app user management** — single app this milestone.
- **Silent cross-app SSO** — moot (only one app).
- **Migrating existing dev data** — fresh DB; ERP re-upload + Personio re-sync acceptable.

---

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| INFRA-01 | Phase 26 | — | Not started |
| INFRA-02 | Phase 26 | — | Not started |
| INFRA-03 | Phase 26 | — | Not started |
| INFRA-04 | Phase 26 | — | Not started |
| CFG-01 | Phase 26 | — | Not started |
| CFG-02 | Phase 26 | — | Not started |
| CFG-03 | Phase 26 | — | Not started |
| AUTH-01 | Phase 27 | — | Not started |
| AUTH-02 | Phase 29 | — | Not started |
| AUTH-03 | Phase 29 | — | Not started |
| AUTH-04 | Phase 27 | — | Not started |
| AUTH-05 | Phase 27 | — | Not started |
| AUTH-06 | Phase 29 | — | Not started |
| RBAC-01 | Phase 28 | — | Not started |
| RBAC-02 | Phase 28 | — | Not started |
| RBAC-03 | Phase 29 | — | Not started |
| RBAC-04 | Phase 28 | — | Not started |
| RBAC-05 | Phase 28 | — | Not started |
| DOCS-01 | Phase 30 | — | Not started |
| DOCS-02 | Phase 30 | — | Not started |
| DOCS-03 | Phase 30 | — | Not started |
| DOCS-04 | Phase 30 | — | Not started |

**Coverage:** 22/22 requirements mapped (100%).

---
*Last updated: 2026-04-15 — Directus Pivot requirements defined, roadmap mapping ready*
