# Directus Pivot — Milestone v1.11-directus

**Status:** LOCKED — ready for phase planning
**Baseline:** v1.10 (UI Consistency Pass). v1.12/Phase 32 (oauth2-proxy + Dex) abandoned; preserved on `archive/v1.12-phase32-abandoned`. Briefly considered Supabase; switched to Directus for fewer moving parts.
**Scale:** up to ~150 users, two roles: **Admin** (full access + data sync/upload) and **Viewer** (read-only dashboards).

## Why Directus over Supabase

| Dimension | Supabase (stripped) | Directus |
|---|---|---|
| Containers added | 5 (postgres + kong + gotrue + postgrest + studio) | **1** (`directus/directus`) |
| Existing `db` service | Retired, data re-migrated | **Kept as-is** — Directus connects to our Postgres |
| Admin UI for users/roles | Studio (SQL-first) | **Purpose-built** user + role + permission admin UI |
| Alembic ↔ auth coexistence | Shared DB with `auth.*` schema; drift risk | Clean — Directus owns `directus_*` tables; Alembic keeps `public` |
| Maturity | Newer; self-hosted is second-class vs. hosted | 7+ years, v11 stable, enterprise-ready |
| Host complexity | Inter-service config (JWT secrets shared between 5 services) | One env-var bag on one container |

## Locked decisions

| # | Decision | Why |
|---|---|---|
| 1 | **Single Directus container** (`directus/directus:11`), reuses the existing `db` Postgres; Directus tables live in `directus_*` prefix in `public` (its default) — Alembic stays on its own tables. | One container; no data migration; Alembic keeps ownership of `public.*` app tables. |
| 2 | **Email/password only** (no magic link in v1.11). | No SMTP infra to own; 150 users covered by password manager. |
| 3 | **Directus owns user + role state**; FastAPI reads user metadata via a read-only join on `directus_users`. | Don't duplicate; Directus's admin UI is the source of truth. |
| 4 | **Two Directus roles**: `Admin` and `Viewer`. JWT carries role name; FastAPI gates on it. | Built-in; no custom SQL; role change is a UI click in Directus admin. |
| 5 | **Fresh DB** — throw away dev data. | ERP re-upload + Personio re-sync in minutes; cleaner than migrating while reshaping auth. |
| 6 | **API-layer authz only** in v1.11; Directus REST/GraphQL NOT exposed to the browser. | FastAPI stays the single entry point; Directus is admin-internal + token issuer only. |

## Role model

Directus roles (configured in admin UI or via `snapshot.yml`):

| Role | Permissions (Directus side) | FastAPI usage |
|---|---|---|
| **Admin** | Full access in Directus admin (manage users, roles, promote) | `role == 'Admin'` → all endpoints |
| **Viewer** | Minimal Directus access (read own user record only) | `role == 'Viewer'` → read endpoints only; mutations → 403 |

### Authz rules (FastAPI-enforced)

| Route | Admin | Viewer |
|---|---|---|
| `GET /api/kpis`, `/api/hr/kpis`, `/api/data/*` | ✅ | ✅ |
| `GET /api/settings` | ✅ | ✅ |
| `PUT /api/settings` | ✅ | ❌ 403 |
| `POST /api/uploads/*` | ✅ | ❌ 403 |
| `POST /api/sync/personio` | ✅ | ❌ 403 |
| `DELETE /api/data/*` | ✅ | ❌ 403 |

## Phase breakdown (5 phases)

| # | Goal | Key deliverables |
|---|---|---|
| **P1 (26) — Directus up, on existing Postgres** | `directus/directus:11` added to compose; reuses `db` Postgres; admin UI at `http://localhost:8055`; first admin user bootstrapped; `Admin` and `Viewer` roles created. | `docker-compose.yml` (+1 service), `.env.example`, `directus/snapshot.yml`, `scripts/bootstrap-directus.sh` |
| **P2 (27) — FastAPI Directus auth dependency** | FastAPI verifies Directus JWT (HS256 shared secret, simplest path); `current_user` dependency resolves `{ id, email, role, full_name, locale }`. | `backend/app/security/directus_auth.py`, `backend/app/config.py`, unit tests |
| **P3 (28) — JWT + RBAC on all routes** | Every `/api/*` requires valid bearer; mutation routes gate on `role == 'Admin'` and return 403 for Viewer with machine-readable body. | All 6 routers updated (`data`, `hr_kpis`, `kpis`, `settings`, `sync`, `uploads`) |
| **P4 (29) — Frontend login + role-aware UI** | `/login` calls Directus `POST /auth/login`; session + refresh via `@directus/sdk`; axios interceptor attaches bearer; Viewer UI hides admin-only actions. | `frontend/src/lib/directus.ts`, `/login` route, `ProtectedRoute`, `useAuth()` hook |
| **P5 (30) — Bring-up + docs + backup** | One `docker compose up`; `docs/setup.md` covers bootstrap, first-Admin, promote-Viewer-to-Admin (via Directus UI), `pg_dump` nightly backup + restore; README v1.11-directus entry. | `docs/setup.md`, `README.md`, `scripts/backup.sh` |

## Out of scope

- SSO / SAML / OIDC external providers — Directus supports, enable in v1.12 if asked.
- Email verification / password reset — Directus supports, enable when SMTP provisioned.
- Exposing Directus REST/GraphQL to browser (stays admin-internal).
- Directus flows / webhooks / realtime — not used.
- Outline wiki (dropped).
- Row-Level Security at DB level.

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Directus tries to manage `public.*` app tables it discovers | Med | Use `DB_EXCLUDE_TABLES` env var to hide app tables from Directus's Data Model UI; document "never touch `public.*` in Directus admin". |
| JWT signing secret rotation breaks FastAPI validation | Low | Single shared secret (`DIRECTUS_SECRET`) in `.env`; document rotation procedure; token TTL 15m keeps drift windows short. |
| Directus admin panel exposed on `:8055` next to user-facing app | Med | Document as operator-only; not linked from the app; bind only to `127.0.0.1` in any future prod deploy. |
| Directus version upgrade breaks compat | Low | Pin `directus/directus:11.x`; test on branch; document upgrade path. |
| Frontend-side role hiding is only UX polish | Low | Server-side 403 in P3 is authoritative; frontend hiding is convenience. |

## Next step

Kick off P1 via `/gsd:plan-phase 26`.
