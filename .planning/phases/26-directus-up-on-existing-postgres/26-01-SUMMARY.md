---
phase: 26
plan: 01
subsystem: infrastructure
tags: [directus, docker-compose, env, auth-layer, v1.11]
requirements: [INFRA-01, INFRA-03, INFRA-04, CFG-02, CFG-03]
requires: [postgres-17-alpine db service, alembic migrate service]
provides: [directus service at 127.0.0.1:8055, directus_uploads volume, DIRECTUS_* env contract]
affects: [docker-compose.yml, .env.example]
tech_added:
  - directus/directus:11.17.2 (patch-superseded from CONTEXT D-05's 11.9.0)
patterns:
  - loopback-only port binding for operator UIs
  - depends_on service_completed_successfully for migrate→directus ordering
  - DB_EXCLUDE_TABLES to isolate Alembic-owned tables from Directus Data Model UI
key_files_created: []
key_files_modified:
  - docker-compose.yml
  - .env.example
decisions:
  - Pinned 11.17.2 instead of CONTEXT-locked 11.9.0 (current 11.x stable at plan-time; same major.minor policy)
  - Dropped `hr_kpi_targets` from DB_EXCLUDE_TABLES (does not exist in backend/app/models.py; HR targets are columns on app_settings)
  - CORS_ENABLED=false and TELEMETRY=false (frontend never calls Directus in v1.11 per DIRECTUS-PIVOT #6)
metrics:
  duration: ~3min
  completed: 2026-04-15
---

# Phase 26 Plan 01: Compose Service and Env — Summary

Added a single `directus/directus:11.17.2` service to the existing 4-service `docker-compose.yml`, wired into the existing `db` Postgres via `DB_*` env vars, and documented all Directus secrets in `.env.example` with `openssl rand -base64` generation hints.

## What was built

- **docker-compose.yml:** new 5th service `directus` with loopback port (`127.0.0.1:8055:8055`), full DB_* env block reusing `${POSTGRES_*}` vars, `DB_EXCLUDE_TABLES` listing all 7 Alembic-managed tables + `alembic_version`, `ADMIN_EMAIL`/`ADMIN_PASSWORD` bootstrap, `CORS_ENABLED=false`, `TELEMETRY=false`, `/server/health` healthcheck with `start_period: 30s`, `depends_on: db: service_healthy` + `migrate: service_completed_successfully`. New named volume `directus_uploads` mounted at `/directus/uploads`.
- **.env.example:** appended Directus block documenting `DIRECTUS_KEY`, `DIRECTUS_SECRET`, `DIRECTUS_ADMIN_EMAIL`, `DIRECTUS_ADMIN_PASSWORD` with inline `openssl rand -base64` generation commands. `DIRECTUS_ADMIN_PASSWORD` left blank to force operator action before first boot.

## Verification

- `docker compose config` passes (with DIRECTUS_* placeholders injected via env to simulate a filled `.env`).
- Grep confirmed `directus/directus:11.17.2`, `DB_EXCLUDE_TABLES` (8 entries, comma-joined), `127.0.0.1:8055`, `service_completed_successfully` all present.
- `.env.example` contains all 4 DIRECTUS_* keys with `openssl rand` hints.

## Deviations from Plan

### Deliberate deviation from CONTEXT D-05 (version pin)

- **Planned in CONTEXT:** `directus/directus:11.9.0`
- **Executed:** `directus/directus:11.17.2`
- **Reason:** Plan-time verification showed 11.17.2 as the current stable 11.x patch; planner explicitly authorized the supersession in the plan objective and CONTEXT D-05 documents that planners should bump if a newer 11.x patch has shipped.

### Deliberate deviation from CONTEXT D-03 (exclude list)

- **Planned in CONTEXT:** `DB_EXCLUDE_TABLES` includes `hr_kpi_targets`
- **Executed:** `hr_kpi_targets` omitted
- **Reason:** Table does not exist in `backend/app/models.py`; HR KPI targets live as columns on `app_settings`. Including a non-existent table in the exclude list is a no-op but misleading for future readers.

Otherwise plan executed exactly as written. No Rule 1/2/3 auto-fixes.

## Commits

- `b4ce5b7` feat(26-01): add directus service to docker-compose
- `2085b6f` feat(26-01): document Directus secrets in .env.example

## Follow-on

- Plan 02: snapshot roles (Admin/Viewer) and apply via sidecar.
- Plan 03: bring-up verification (`docker compose up -d` → Directus healthy → first-Admin sign-in).

## Self-Check: PASSED

- docker-compose.yml modified: FOUND
- .env.example modified: FOUND
- Commit b4ce5b7: FOUND
- Commit 2085b6f: FOUND
