# Milestone v1.11-supabase — Requirements

**Milestone goal:** Replace local Postgres + (abandoned Dex/oauth2-proxy) with self-hosted Supabase, consolidating DB + auth + RBAC for up to 150 users across Admin and Viewer roles.

**Source of truth:** `.planning/SUPABASE-PIVOT.md` (locked decisions, risk register).

---

## Active Requirements

### Infrastructure (INFRA)

- [ ] **INFRA-01**: Developer can start the full stack with `docker compose up` — boots Supabase (postgres, kong, gotrue, postgrest, studio) plus api + frontend, no manual steps between commands.
- [ ] **INFRA-02**: Old `db` service is removed from `docker-compose.yml` — Supabase's `postgres` is the only Postgres container running.
- [ ] **INFRA-03**: Developer can reach Supabase Studio at `http://localhost:54323` and see the single Postgres instance's `public` and `auth` schemas.
- [ ] **INFRA-04**: Developer can reach the GoTrue API at `http://localhost:54321/auth/v1/*` (via kong gateway) for login / JWT endpoints.
- [ ] **INFRA-05**: All Supabase service secrets (JWT secret, anon key, service-role key, DB password) live in `.env` with clear `.env.example` entries and generation commands.

### Data Layer (DATA)

- [ ] **DATA-01**: Alembic is re-pointed at Supabase's Postgres via `DATABASE_URL` (`postgresql://postgres:...@supabase-db:5432/postgres`); `alembic upgrade head` runs cleanly against a fresh Supabase stack.
- [ ] **DATA-02**: All existing KPI tables (sales data, HR snapshots, upload history, settings) recreate successfully in Supabase's Postgres `public` schema without schema drift.
- [ ] **DATA-03**: A new `profiles` table references `auth.users(id)` with columns `role` (enum `admin` | `viewer`, default `viewer`), `full_name`, `locale` (default `de`), plus standard timestamps.
- [ ] **DATA-04**: A signup trigger (`handle_new_user`) auto-creates a `profiles` row on every new `auth.users` insert, defaulting `role` to `viewer`.
- [ ] **DATA-05**: FastAPI code paths use the Supabase Postgres for all reads/writes; no residual references to the removed `db` service.

### Authentication (AUTH)

- [ ] **AUTH-01**: User can sign up via email/password (or via Studio-seeded invite) and receives a valid session on first sign-in.
- [ ] **AUTH-02**: User can sign in via the web UI with email/password; invalid credentials show an inline error and do not grant a session.
- [ ] **AUTH-03**: Frontend persists the Supabase session via `@supabase/supabase-js`, auto-refreshing the access token before expiry.
- [ ] **AUTH-04**: FastAPI validates every `/api/*` request's `Authorization: Bearer <jwt>` against GoTrue's JWKS (RS256) and rejects expired/invalid tokens with 401.
- [ ] **AUTH-05**: `current_user` FastAPI dependency resolves `{ id, email, role }` from the verified JWT + `profiles` lookup; available to all protected routes.
- [ ] **AUTH-06**: User can sign out; session is cleared and subsequent API calls return 401.

### Role-Based Access Control (RBAC)

- [ ] **RBAC-01**: Read endpoints (`GET /api/kpis`, `/api/hr/kpis`, `/api/data/*`, `GET /api/settings`) return data for both Admin and Viewer roles.
- [ ] **RBAC-02**: Mutation endpoints (`POST /api/uploads/*`, `POST /api/sync/personio`, `PUT /api/settings`, any `DELETE /api/data/*`) require `role == 'admin'`; return 403 for Viewer.
- [ ] **RBAC-03**: Frontend hides admin-only UI actions (upload button, sync trigger, settings save, delete controls) when `useAuth().role === 'viewer'`.
- [ ] **RBAC-04**: Admin can promote a Viewer to Admin via a single SQL statement and the change takes effect on the next JWT refresh (≤ token TTL).
- [ ] **RBAC-05**: API contract documents the Admin-vs-Viewer matrix; 403 responses carry a machine-readable reason (`{"detail": "admin role required"}`).

### Bring-up & Operations (DOCS)

- [ ] **DOCS-01**: `docs/setup.md` covers first-time bring-up: clone → copy `.env.example` → generate secrets → `docker compose up -d` → bootstrap first admin user via Studio or seed SQL.
- [ ] **DOCS-02**: `docs/setup.md` documents the promote-viewer-to-admin flow.
- [ ] **DOCS-03**: A nightly `pg_dump` backup is runnable (cron sidecar or host script); backups land in `./backups/`; `docs/setup.md` includes the restore procedure.
- [ ] **DOCS-04**: `README.md` v1.11-supabase version-history entry summarizes the pivot (what replaced what, why Dex was dropped, what Outline dropping means).

---

## Future Requirements (deferred, not in v1.11)

- SSO/OIDC external providers (Google, M365) — add when HR asks.
- Email verification + password reset via SMTP — enable when SMTP provisioned.
- Row-Level Security (RLS) policies — add when a feature bypasses FastAPI.
- Audit logging beyond Supabase's built-in auth logs.
- Realtime / Storage / Analytics Supabase services — not used this milestone.
- Export filtered data as CSV (DASH-07) — carried over from v1.0 backlog.
- Duplicate upload detection (UPLD-07) — carried over.
- Per-upload drill-down view (DASH-08) — carried over.

---

## Out of Scope (v1.11)

- **Outline wiki** — dropped entirely in the pivot.
- **Dex + oauth2-proxy + NPM auth_request layer** — abandoned; preserved on `archive/v1.12-phase32-abandoned` for reference only.
- **Active Directory / LDAP integration** — not planned.
- **Multi-tenant / multi-app user management** — single app this milestone.
- **Silent cross-app SSO** — moot (only one app).
- **Migrating existing dev data** — fresh DB; ERP re-upload + Personio re-sync acceptable.

---

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| INFRA-01..05 | TBD | — | Not started |
| DATA-01..05 | TBD | — | Not started |
| AUTH-01..06 | TBD | — | Not started |
| RBAC-01..05 | TBD | — | Not started |
| DOCS-01..04 | TBD | — | Not started |

*Roadmapper will populate Phase and Plan columns.*

---
*Last updated: 2026-04-15 — v1.11-supabase requirements defined*
