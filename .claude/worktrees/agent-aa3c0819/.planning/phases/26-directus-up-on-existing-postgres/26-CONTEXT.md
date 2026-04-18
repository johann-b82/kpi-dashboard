---
phase: 26
phase_name: directus-up-on-existing-postgres
milestone: v1.11-directus
status: ready-for-research-or-plan
created: 2026-04-15
---

# Phase 26 Context — Directus Up, on Existing Postgres

**Goal:** Add a single `directus/directus:11.9.0` container to the existing compose stack, connecting to the existing `db` Postgres without disturbing Alembic's ownership of app tables. First Admin is bootstrapped from `.env`; two roles (Admin, Viewer) are configured reproducibly; admin UI is reachable at `http://127.0.0.1:8055`.

**Requirements:** INFRA-01, INFRA-02, INFRA-03, INFRA-04, CFG-01, CFG-02, CFG-03

## Locked decisions (from DIRECTUS-PIVOT.md)

1. Single Directus container; reuses existing `db` Postgres — no new Postgres instance.
2. Email/password only (no magic link, no SSO this milestone).
3. Directus owns `directus_*` tables; Alembic owns `public.*` app tables — isolation via `DB_EXCLUDE_TABLES`.
4. Two roles: `Admin` (full access), `Viewer` (read-only).
5. FastAPI validates Directus JWT via HS256 shared secret (`DIRECTUS_SECRET`).
6. Directus REST/GraphQL is **operator-only**; frontend talks to FastAPI only for v1.11.

## Phase-26-specific decisions (locked via `/gsd:discuss-phase 26`)

### D-01 — First-Admin bootstrap: environment variables

Use Directus's built-in `ADMIN_EMAIL` + `ADMIN_PASSWORD` env vars. On first boot Directus creates an `admin@` user with the `Administrator` role and sets the password. No extra bootstrap service.

- `.env.example` entries: `DIRECTUS_ADMIN_EMAIL=admin@example.com` (prompt-level default), `DIRECTUS_ADMIN_PASSWORD=` (required; generation command `openssl rand -base64 24`).
- On subsequent boots these vars are ignored (Directus only seeds if the admin doesn't exist).

### D-02 — Role config reproducibility: `directus/snapshot.yml`

Commit a `directus/snapshot.yml` defining the `Admin` and `Viewer` roles + their base permissions. A small init sidecar (or `docker compose run --rm directus`) applies the snapshot on every boot via `npx directus schema apply`.

- `Admin` role: full access to `directus_users`, `directus_roles`; no grant on `public.*` app tables (they're excluded from Directus entirely per D-03).
- `Viewer` role: read-only access to its own `directus_users` record; no access to `public.*`.
- The snapshot is the source of truth; manual role edits in the UI drift from it — setup.md documents this.

### D-03 — Isolating app tables: `DB_EXCLUDE_TABLES`

Set `DB_EXCLUDE_TABLES` to the exact list of Alembic-managed tables so Directus's Data Model UI and auto-introspection ignore them:

```
DB_EXCLUDE_TABLES=upload_batches,sales_records,app_settings,personio_employees,personio_attendance,personio_absences,personio_sync_meta,hr_kpi_targets,alembic_version
```

Planner should verify this list by reading `backend/app/models.py` `__tablename__` entries at plan-time. `alembic_version` is also excluded so Directus doesn't attempt to manage migration state.

Rationale: **moving app tables to a dedicated `app` schema was rejected** because it requires a backend-wide migration (Alembic config, every SQLAlchemy query, search_path tuning) for no functional gain in v1.11.

### D-04 — Port exposure: loopback only

Compose maps `127.0.0.1:8055:8055`, not `0.0.0.0`. The admin panel is for operators; keeping it loopback-only prevents accidental LAN exposure in shared-dev or future home-lab deployments. Document in setup.md.

### D-05 — Version pin: exact `directus/directus:11.9.0`

Pin the exact patch version, matching how `postgres:17-alpine` is pinned in CLAUDE.md. Upgrades are a deliberate branch-level decision. Planner should verify `11.9.0` is the current stable at plan-time (Context7 or Docker Hub tag list); if a newer 11.x patch has shipped, pin that instead and note in the plan.

### D-06 — Healthcheck: Directus's built-in `/server/health`

Use Directus's bundled endpoint. Returns 200 when DB is reachable and internal migrations applied. Compose entry:

```yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8055/server/health", "||", "exit", "1"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

`start_period: 30s` handles the cold-boot migration window (Directus runs its own schema migrations on first boot against the shared Postgres).

## Scouted assets (existing codebase at v1.10 baseline)

- `docker-compose.yml`: 4 services (`db`, `migrate`, `api`, `frontend`). Directus becomes the 5th. `db` service already has a `pg_isready` healthcheck and named volume `postgres_data`.
- `backend/app/models.py`: 8 tables confirmed (see D-03 exclude list).
- No existing `auth` / `security` modules in `backend/app/security/` — fresh slate, only `fernet.py` + `logo_validation.py`.
- `.env`: already carries `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — Directus's `DB_*` vars map directly.
- No frontend auth today; `/login` route does not exist.

## Dependencies

- **Blocks:** Phase 27 (FastAPI consumes `DIRECTUS_SECRET` for JWT verify), Phase 29 (frontend consumes Directus sign-in endpoint).
- **Blocked by:** none (v1.10 baseline is clean; this is the first phase of v1.11-directus).

## Risk notes for planner

- **Directus first-boot latency:** On a cold DB, Directus runs its own schema migration across ~30 `directus_*` tables. Budget ≥30s `start_period`; compose `depends_on: db: service_healthy` must be explicit.
- **Shared `db` contention:** Alembic's `migrate` service and Directus both want to mutate the same Postgres at startup. Keep `migrate` ordered before `directus` via `depends_on: migrate: service_completed_successfully` — avoids lock races on `alembic_version`.
- **Snapshot drift:** If an operator edits roles in the UI without updating `snapshot.yml`, the next `schema apply` will revert their change. Document as intended behavior.
- **Secret rotation:** `DIRECTUS_SECRET` change invalidates every existing JWT. Document rotation as a manual procedure in Phase 30 setup.md, not automated.

## Open questions for research (if `/gsd:research-phase 26` runs)

- Is `directus:11.9.0` the current stable tag? Any breaking 11.x change vs. 11.0?
- Best practice for applying `snapshot.yml` in Docker Compose context — sidecar service, `docker compose run`, or entrypoint wrapper?
- Does `DB_EXCLUDE_TABLES` hide tables from ALL Directus surfaces (Data Model, Collections, Activity Log, Flows) or just the Data Model UI?

If those three answers are already known to the planner from the Directus docs, research can be skipped.
