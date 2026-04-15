# Supabase Pivot — Milestone v1.11-supabase

**Status:** LOCKED — ready for phase planning
**Baseline:** v1.10 (UI Consistency Pass). v1.12/Phase 32 (oauth2-proxy + Dex) abandoned; preserved on `archive/v1.12-phase32-abandoned`.
**Scale:** up to ~150 users, two roles: **Admin** (full access + data sync/upload) and **Viewer** (read-only dashboards).

## Locked decisions

| # | Decision | Why |
|---|---|---|
| 1 | **Stripped Supabase stack**: `postgres`, `gotrue`, `postgrest`, `kong`, `studio`. Skip realtime, storage, analytics, imgproxy, vector. | Fewest moving parts for an internal tool; unused services add config surface + startup time. Can add later if needed. |
| 2 | **Email/password only** (no magic link in v1.11). | No SMTP infra to own; password manager covers 150 users. Revisit if users push back. |
| 3 | **`profiles` table** referencing `auth.users(id)` with `role` enum (`admin` \| `viewer`), `full_name`, `locale`. | Don't couple KPI logic to GoTrue's internal `auth.users` schema; makes role changes a simple `UPDATE profiles`. |
| 4 | **Fresh DB** — throw away dev data. | ERP re-upload + Personio re-sync takes minutes; no orphan-row debugging during the pivot. |
| 5 | **API-layer authz only** in this milestone; RLS deferred. | FastAPI is the single entry point; one authz chokepoint is simpler than two. RLS becomes a v1.12 candidate if a direct-to-PostgREST feature emerges. |

## Role model

```sql
-- supabase migration: 001_profiles.sql
create type user_role as enum ('admin', 'viewer');

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       user_role not null default 'viewer',
  full_name  text,
  locale     text not null default 'de',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- auto-create profile on signup (viewer by default; admin promotes manually)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### Authz rules

| Route | Admin | Viewer |
|---|---|---|
| `GET /api/kpis`, `/api/hr/kpis`, `/api/data/*` | ✅ | ✅ |
| `GET /api/settings` | ✅ | ✅ (read-only) |
| `PUT /api/settings` | ✅ | ❌ 403 |
| `POST /api/uploads/*` | ✅ | ❌ 403 |
| `POST /api/sync/personio` | ✅ | ❌ 403 |
| `DELETE /api/data/*` | ✅ | ❌ 403 |

Enforcement: `Depends(require_role("admin"))` decorator in FastAPI for mutation routes.

## Phase breakdown (5 phases)

| # | Goal | Key deliverables |
|---|---|---|
| **P1 — Supabase stack up, single Postgres** | Self-hosted Supabase (5 services) runs via `docker compose up`. **Existing `db` service deleted** — Supabase's Postgres is the only Postgres container. KPI data lives in a `kpi` schema (or `public`) alongside GoTrue's `auth` schema in the same DB. Studio reachable at `http://localhost:54323`. One test admin user seeded. | `docker-compose.yml` (drop `db`, add 5 Supabase services), `.env.example`, `supabase/config.toml`, `supabase/seed.sql` |
| **P2 — Schema + profiles (consolidated)** | Alembic re-pointed at Supabase Postgres (`postgresql://postgres:${PG_PWD}@supabase-db:5432/postgres`). KPI tables live in `public` (or a dedicated `kpi` schema to keep visual separation from `auth.*`). New `profiles` table + signup trigger. Fresh `alembic upgrade head` succeeds against Supabase's Postgres. | `backend/alembic/env.py`, new migration `v1_11_profiles.py`, `.env` `DATABASE_URL` |
| **P3 — FastAPI JWT + RBAC** | Every `/api/*` route validates Supabase JWT via JWKS. `Depends(current_user)` injects `{id, email, role}`. Mutation routes gate on `role == 'admin'`. | `backend/app/security/supabase_auth.py`, `backend/app/security/rbac.py`, all 6 routers updated |
| **P4 — Frontend login + bearer** | Login page with email/password. `@supabase/supabase-js` manages session + refresh. Axios interceptor attaches bearer. Viewer UI hides admin-only actions. | `frontend/src/lib/supabase.ts`, new `/login` route, `ProtectedRoute` wrapper, conditional rendering on `role` |
| **P5 — Bring-up + docs** | One `docker compose up` boots everything. `docs/setup.md` covers: bootstrap, creating the first admin, promoting a viewer to admin, backup/restore. README v1.11-supabase version history entry. | `docs/setup.md`, `README.md`, quick-start script |

## Out of scope

- SSO / SAML / OIDC providers (Google, M365) — add in v1.12 if HR asks.
- Email verification / password reset flows (GoTrue supports; enable if/when SMTP is provisioned).
- Row-Level Security policies.
- Outline wiki (dropped in this pivot).
- Audit logging (defer — Supabase has basic auth logs in Studio).

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Alembic ↔ Supabase schema drift (Supabase mgmt tools assume their own migrations) | Med | Pin Alembic as sole migration tool for `public`/`kpi` schemas; leave `auth` + `storage` schemas to Supabase; never click "Run SQL" in Studio for app schema. |
| Single-Postgres blast radius (one container holds both auth + KPI data) | Med | Supabase's Postgres is production-grade; run `pg_dump` nightly via a cron sidecar or host script to a mounted backup dir. Document restore in setup.md. |
| GoTrue signing-key rotation breaks cached JWKS | Low | Use `python-jose` with `cache=True` + periodic refetch; document JWT expiry = 1h default. |
| Docker network: FastAPI reaching `kong:8000` vs. browser reaching `localhost:54321` mismatch | Med | Use two env vars: `SUPABASE_INTERNAL_URL` (FastAPI→kong) + `SUPABASE_PUBLIC_URL` (frontend→localhost). |
| Viewer sees admin-only UI buttons because role check only server-side | Low | Also hide in frontend via `useAuth().role`; treat server-side as authoritative. |

## Next step

Kick off P1 via `/gsd:new-milestone v1.11-supabase` then `/gsd:plan-phase P1`, OR inline if you prefer (skip the GSD gates, move faster, lose the audit trail). Recommend GSD flow — we just finished reverting because we didn't have one for Phase 32's messy parts.
