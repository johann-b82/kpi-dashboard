---
phase: 65-foundation-schema-authz-sse-bridge
plan: 01
subsystem: directus-schema
tags: [directus, schema, compose, snapshot, db-exclude]
dependency_graph:
  requires: []
  provides:
    - directus/snapshots/v1.22.yaml
    - directus-schema-apply compose service
    - DB_EXCLUDE_TABLES minimal superset
    - docs/operator-runbook.md schema sections
  affects:
    - docker-compose.yml (depends_on chain)
    - docs/operator-runbook.md (new sections 12-16)
tech_stack:
  added: []
  patterns:
    - Directus schema apply via one-shot compose service
    - service_completed_successfully chaining for bootstrap sequence
    - DB_EXCLUDE_TABLES minimal superset pattern
key_files:
  created:
    - directus/snapshots/v1.22.yaml
    - directus/snapshots/ (directory)
    - directus/fixtures/ (directory)
  modified:
    - docker-compose.yml
    - docs/operator-runbook.md
decisions:
  - "signage_device_tags not signage_tags — table name confirmed from v1_16_signage_schema.py"
  - "signage_devices has NO tags column — WHEN clause reduces to OLD.name IS DISTINCT FROM NEW.name only"
  - "DB_EXCLUDE_TABLES: 11-entry minimal set including signage_heartbeat_event (not signage_devices)"
metrics:
  duration: 298s
  completed: 2026-04-24
  tasks: 3
  files: 4
---

# Phase 65 Plan 01: Bootstrap Directus Schema Apply Chain and v1.22 Snapshot Summary

**One-liner:** Git-tracked v1.22.yaml snapshot with 9 metadata-only collections + compose one-shot apply service + shrunk DB_EXCLUDE_TABLES + operator runbook sections.

## What Was Built

### Task 1: v1.22 Snapshot YAML

Created `directus/snapshots/v1.22.yaml` registering 9 collections as Directus metadata:
- `signage_devices`, `signage_playlists`, `signage_playlist_items`
- `signage_device_tags` (confirmed name from migration — NOT `signage_tags`)
- `signage_playlist_tag_map`, `signage_device_tag_map`, `signage_schedules`
- `sales_records`, `personio_employees`

All 9 collections use `schema: null` (metadata-only, per D-02 and #25760 mitigation). Fields and relations match the Alembic DDL from v1_16..v1_21 migrations. No policies, roles, or permissions captured in the YAML — those stay in `bootstrap-roles.sh`.

### Task 2: Compose Service Chain Rewire

Added `directus-schema-apply` one-shot service to `docker-compose.yml`:
- Uses `directus/directus:11.17.2` image (same as main directus service)
- Mounts `./directus/snapshots:/snapshots:ro`
- Depends on `directus: condition: service_healthy`
- Entrypoint: `npx directus schema apply --yes /snapshots/v1.22.yaml`
- `restart: "no"` (exits after apply)

Rewired depends_on chain per D-03:
- `directus-bootstrap-roles` now depends on `directus-schema-apply: condition: service_completed_successfully`
- `api` now depends on `directus-bootstrap-roles: condition: service_completed_successfully`

Full chain: `db` → `migrate` → `directus (healthy)` → `directus-schema-apply` → `directus-bootstrap-roles` → `api`

Shrunk `DB_EXCLUDE_TABLES` from 13 to 11 entries (minimal superset per SCHEMA-04):
- Removed: `sales_records`, `personio_employees`, `signage_devices`, `signage_pairing_sessions` (was excluded, now not listed separately — actually `signage_pairing_sessions` stays in)
- Added: `signage_heartbeat_event` (append-only analytics log)
- Preserved: `alembic_version`, `app_settings`, `personio_attendance`, `personio_absences`, `personio_sync_meta`, `sensors`, `sensor_readings`, `sensor_poll_log`, `signage_pairing_sessions`, `upload_batches`
- `--workers 1` uvicorn invariant preserved (not touched)

### Task 3: Operator Runbook Sections

Appended 5 new sections to `docs/operator-runbook.md`:

- **Section 12** — "Directus Data Model — DO NOT EDIT IN UI": explains Alembic as sole DDL owner, how CI Guard B detects drift, and the correct schema change workflow
- **Section 13** — "Recovery: #25760 relation already exists": symptoms, cause, operator-run fallback recipe (GET admin token, POST `/collections` with `schema:null` per collection, re-run apply to confirm no-op)
- **Section 14** — "DB_EXCLUDE_TABLES requires up -d not restart": explains why `restart` does not pick up env changes
- **Section 15** — "SSE is best-effort; 30s poll is the durability floor": at-most-once LISTEN/NOTIFY, reconnect window, 30s polling fallback
- **Section 16** — "Rollback recipe — partial schema-apply failure on fresh volume": `docker compose down -v` + restart path, #25760 fallback reference, verification command

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Table is `signage_device_tags` not `signage_tags` | Confirmed from `v1_16_signage_schema.py` — the PLAN's interface spec said "signage_tags (table name is signage_device_tags per v1_16 — verify)" |
| WHEN clause reduced to `OLD.name IS DISTINCT FROM NEW.name` only | `signage_devices` has no `tags` column (confirmed from ORM model and Alembic migrations); tags live only in `signage_device_tag_map`, which has its own trigger |
| `signage_heartbeat_event` added to DB_EXCLUDE_TABLES | Append-only analytics log — not an admin-editable collection; must not appear in Directus Data Model UI |
| `signage_pairing_sessions` kept in DB_EXCLUDE_TABLES | Already excluded pre-v1.22; still not a Directus-managed collection (FastAPI-owned pairing flow) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] signage_devices.tags column does not exist**
- **Found during:** Task 1 (reading v1_16_signage_schema.py and backend/app/models/signage.py)
- **Issue:** PLAN.md and CONTEXT.md D-07 both mention `OLD.tags IS DISTINCT FROM NEW.tags` in the signage_devices trigger WHEN clause. The column does not exist on `signage_devices` — tags live only in `signage_device_tag_map`.
- **Fix:** The snapshot YAML has no `tags` field on `signage_devices` (correct). For the Alembic trigger migration (Plan 65-03), the WHEN clause should be `OLD.name IS DISTINCT FROM NEW.name` only. Documented in decisions section.
- **Impact:** No impact on plan 65-01 artifacts; affects plan 65-03 trigger SQL.

## Commits

| Hash | Description | Files |
|------|-------------|-------|
| 3bf46c6 | feat(65-01): add v1.22 Directus snapshot YAML | directus/snapshots/v1.22.yaml |
| eb62a0c | feat(65-01): add directus-schema-apply service + rewire depends_on + shrink DB_EXCLUDE_TABLES | docker-compose.yml |
| cc616d6 | docs(65-01): add Directus schema runbook sections to operator-runbook.md | docs/operator-runbook.md |

## Known Stubs

None. All artifacts are complete and wired:
- Snapshot YAML contains all 9 collections with real field definitions
- Compose chain is fully wired with correct conditions
- Runbook sections contain real commands and recovery recipes

## Self-Check: PASSED

All files exist on disk and all commits verified in git history.

| Item | Status |
|------|--------|
| directus/snapshots/v1.22.yaml | FOUND |
| docker-compose.yml (modified) | FOUND |
| docs/operator-runbook.md (modified) | FOUND |
| 65-01-SUMMARY.md | FOUND |
| commit 3bf46c6 (snapshot YAML) | FOUND |
| commit eb62a0c (compose service) | FOUND |
| commit cc616d6 (runbook) | FOUND |
