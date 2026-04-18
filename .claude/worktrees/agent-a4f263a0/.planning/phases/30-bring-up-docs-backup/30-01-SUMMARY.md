---
phase: 30-bring-up-docs-backup
plan: "01"
subsystem: infrastructure
tags: [backup, docker-compose, postgres, sidecar, restore]
requires:
  - docker-compose.yml db service (postgres:17-alpine, healthcheck)
  - .env with POSTGRES_USER/PASSWORD/DB
provides:
  - Nightly pg_dump backup sidecar (02:00 Europe/Berlin)
  - On-demand dump via `docker compose exec backup /usr/local/bin/dump.sh`
  - Restore via `./scripts/restore.sh <file>` (handles .sql and .sql.gz)
  - 14-day retention of /backups/kpi-*.sql.gz
affects:
  - docker-compose.yml (new backup service)
  - .gitignore (excludes /backups/)
tech-stack:
  added:
    - postgres:17-alpine (reused image) running BusyBox crond
  patterns:
    - "docker compose sidecar with depends_on.condition: service_healthy"
    - "atomic write via .tmp -> rename"
    - "pg_dump -Fp | gzip honoring literal .sql.gz extension"
key-files:
  created:
    - backup/entrypoint.sh
    - backup/dump.sh
    - scripts/restore.sh
    - .planning/phases/30-bring-up-docs-backup/30-01-SUMMARY.md
  modified:
    - docker-compose.yml
    - .gitignore
decisions:
  - Plain-format dump piped through gzip (not -Fc) to honor .sql.gz extension and enable pg_restore-free recovery
  - Sidecar TZ pinned to Europe/Berlin so cron's 02:00 is local, not UTC
  - restore.sh uses a 5s confirmation sleep rather than a prompt to stay pipeable/scriptable
metrics:
  duration: ~9min
  completed: 2026-04-15
---

# Phase 30 Plan 01: Backup Sidecar and Restore Summary

Dockerized nightly `pg_dump` sidecar and companion restore script that satisfy DOCS-03 — produces `./backups/kpi-YYYY-MM-DD.sql.gz` on schedule (or on demand), with a 14-day retention window and a one-command restore path verified end-to-end.

## What Was Built

- **`backup/entrypoint.sh`** — installs a single crontab entry (`0 2 * * * /usr/local/bin/dump.sh`) and execs BusyBox `crond -f` in the foreground so the sidecar stays alive under Docker.
- **`backup/dump.sh`** — `pg_dump --clean --if-exists --no-owner --no-acl -Fp | gzip -c` into `/backups/kpi-<date>.sql.gz.tmp`, atomic `mv`, then `find ... -mtime +14 -delete` for retention.
- **`docker-compose.yml` `backup` service** — `postgres:17-alpine`, `TZ=Europe/Berlin`, env_file `.env`, reads `PGHOST/PGUSER/PGPASSWORD/PGDATABASE`, mounts `./backups`, `./backup/entrypoint.sh`, and `./backup/dump.sh` read-only, `depends_on: db: condition: service_healthy`, `restart: unless-stopped`.
- **`scripts/restore.sh`** — positional-arg CLI, detects `.gz` vs plain, streams through `docker compose exec -T db psql -v ON_ERROR_STOP=1`. 5-second abort window.
- **`.gitignore`** — `/backups/` excluded.

## Execution Evidence (D-06)

1. `docker compose up -d backup` → `kpi-backup` container Up with log:
   ```
   [backup] crontab installed; starting crond (TZ=Europe/Berlin)
   crond: crond (busybox 1.37.0) started, log level 8
   ```
2. `docker compose exec backup /usr/local/bin/dump.sh` →
   ```
   [backup] starting dump -> /backups/kpi-2026-04-15.sql.gz
   [backup] wrote /backups/kpi-2026-04-15.sql.gz
   ```
3. `ls -la backups/` → `kpi-2026-04-15.sql.gz` **441,500 bytes** (432 KiB)
4. `./scripts/restore.sh backups/kpi-2026-04-15.sql.gz` → many `DROP TABLE / CREATE TABLE / COPY / ALTER TABLE` lines then `[restore] done`, **exit status 0**.
5. `docker compose exec -T db psql ... -c "\dt public.*"` → all app tables (`alembic_version`, `app_settings`, `app_users`, `sales_records`, `upload_batches`, etc.) present plus the Directus tables. DB fully responsive post-restore.

## Tasks Completed

| Task | Name | Commit | Files |
| --- | --- | --- | --- |
| 1 | Create backup sidecar scripts | `25787fa` | `backup/entrypoint.sh`, `backup/dump.sh` |
| 2 | Wire backup service + gitignore | `791417d` | `docker-compose.yml`, `.gitignore` |
| 3 | Create restore script + exercise cycle | `d325d68` | `scripts/restore.sh` |

## Acceptance Criteria

- [x] Backup sidecar service defined and healthy on `docker compose up -d`
- [x] On-demand dump produces `backups/kpi-YYYY-MM-DD.sql.gz` (verified: 2026-04-15, 441,500 bytes)
- [x] Restore script runs end-to-end against real dump (exit 0)
- [x] 14-day retention in place (`find -mtime +14 -delete`)
- [x] `/backups/` gitignored
- [x] `docker compose config --quiet` passes

## Deviations from Plan

None — plan executed exactly as written. No RESEARCH pitfalls triggered (no FK violations on round-trip; no permission issues on bind-mounted `./backups/` on macOS host).

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: `backup/entrypoint.sh` (executable)
- FOUND: `backup/dump.sh` (executable)
- FOUND: `scripts/restore.sh` (executable)
- FOUND: commit `25787fa` — sidecar scripts
- FOUND: commit `791417d` — compose wiring + gitignore
- FOUND: commit `d325d68` — restore script
- FOUND: `backups/kpi-2026-04-15.sql.gz` (441,500 bytes)
- FOUND: docker-compose.yml `backup:` service with `TZ: Europe/Berlin`, `postgres:17-alpine`, `depends_on db service_healthy`
- FOUND: `.gitignore` contains `/backups/`
