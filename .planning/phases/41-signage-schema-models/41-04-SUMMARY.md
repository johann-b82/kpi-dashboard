---
phase: 41-signage-schema-models
plan: 04
subsystem: infra
tags: [docker-compose, directus, volumes, db-exclude]

requires:
  - phase: 41-signage-schema-models
    provides: "Signage table names (from plan 41-01 models)"
provides:
  - "DB_EXCLUDE_TABLES extended with signage_devices, signage_pairing_sessions (SGN-DB-04)"
  - "directus_uploads mounted read-only on api service at /directus/uploads (SGN-INF-02)"
affects: [42-device-auth-pairing, 43-admin-player-api, 44-pptx-conversion]

tech-stack:
  added: []
  patterns:
    - "Directus owns uploads volume rw; consumers mount ro"
    - "Private tables excluded from Directus introspection; relational tables left visible"

key-files:
  created: []
  modified:
    - docker-compose.yml

key-decisions:
  - "D-17: Expose 6 signage relational tables to Directus; hide only devices + pairing_sessions"
  - "D-18: Media storage path — Directus owns uploads volume; api gets read-only bind"

patterns-established:
  - "DB_EXCLUDE_TABLES: comma-separated, no spaces (Directus does not trim)"
  - "directus_uploads:/directus/uploads:ro — read-only consumer of Directus-managed assets"

requirements-completed: [SGN-DB-04, SGN-INF-02]

duration: 2min
completed: 2026-04-18
---

# Phase 41 Plan 04: Docker Compose — Directus Exclusion + Media Mount Summary

**Two surgical docker-compose.yml edits: signage private tables hidden from Directus, and directus_uploads mounted read-only on api service for FastAPI media reads.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-18T15:05:44Z
- **Completed:** 2026-04-18T15:08:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `signage_devices,signage_pairing_sessions` to the existing DB_EXCLUDE_TABLES env on the `directus` service — other 6 signage tables remain visible for relational editing
- Added `directus_uploads:/directus/uploads:ro` to the `api` service volumes, with explanatory comment
- Verified `directus.depends_on.migrate.condition: service_completed_successfully` already present (no change needed)
- `docker compose config` parses cleanly; YAML validates with PyYAML

## Task Commits

1. **Task 1: DB_EXCLUDE_TABLES + api directus_uploads RO mount** — `6a9089c` (feat)

## Before / After

### DB_EXCLUDE_TABLES

**Before:**
```
DB_EXCLUDE_TABLES: upload_batches,sales_records,app_settings,personio_employees,personio_attendance,personio_absences,personio_sync_meta,alembic_version,sensors,sensor_readings,sensor_poll_log
```

**After:**
```
DB_EXCLUDE_TABLES: upload_batches,sales_records,app_settings,personio_employees,personio_attendance,personio_absences,personio_sync_meta,alembic_version,sensors,sensor_readings,sensor_poll_log,signage_devices,signage_pairing_sessions
```

No spaces after commas (Pitfall 6 — Directus does not trim). The 6 relational signage tables (`signage_media`, `signage_playlists`, `signage_playlist_items`, `signage_device_tags`, `signage_device_tag_map`, `signage_playlist_tag_map`) are intentionally visible to Directus per D-17.

### api service volumes

**After:**
```yaml
    volumes:
      - ./backend:/app
      # Directus owns the uploads volume (rw on directus service, ro here).
      # FastAPI reads media files by path resolved from signage_media.uri (Directus asset UUID) — SGN-INF-02.
      - directus_uploads:/directus/uploads:ro
```

### docker compose config status

`docker compose config > /tmp/compose-config-41-04.yaml` → exit 0. PyYAML `yaml.safe_load` → exit 0.

## Files Created/Modified
- `docker-compose.yml` — DB_EXCLUDE_TABLES extended (+2 tables); api volumes gains directus_uploads:ro

## Decisions Made
- Followed plan verbatim — D-17 (hide only devices + pairing_sessions) and D-18 (directus-owned uploads, api ro bind) were already decided in phase context

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SGN-DB-04, SGN-INF-02 closed
- Plan 41-05 (round-trip verification) can now assert Directus Data Model UI shows the 6 relational tables and hides devices + pairing_sessions after `docker compose up`
- Phase 44 (PPTX conversion) can rely on `/directus/uploads` being readable from the api container

## Self-Check: PASSED
- File `docker-compose.yml` modified: FOUND
- Commit `6a9089c`: FOUND in git log
- All acceptance criteria grep checks: PASSED
- `docker compose config`: PASSED

---
*Phase: 41-signage-schema-models*
*Completed: 2026-04-18*
