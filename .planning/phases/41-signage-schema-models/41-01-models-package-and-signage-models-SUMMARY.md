---
phase: 41-signage-schema-models
plan: 01
subsystem: backend/models
tags: [signage, orm, sqlalchemy, schema]
requires:
  - backend/app/database.py (Base)
provides:
  - backend/app/models/ (package)
  - 8 Signage ORM classes registered with Base.metadata
affects:
  - backend/alembic/env.py (import path preserved)
tech_stack:
  added: []
  patterns:
    - "SQLAlchemy 2.0 Mapped[...] + mapped_column style (mirrors _base.py)"
    - "Partial unique index via Index(..., postgresql_where=text(...))"
    - "Composite-PK join tables for many-to-many (device_tag_map, playlist_tag_map)"
    - "CHECK constraints for enum-like status/kind columns"
key_files:
  created:
    - backend/app/models/__init__.py
    - backend/app/models/signage.py
  modified:
    - backend/app/models/_base.py (rename only — landed in 6a9089c out-of-order from plan 41-04)
decisions:
  - "D-06/D-07/D-08/D-12/D-15/D-16 implemented verbatim per PLAN"
  - "HR KPI targets are columns on AppSettings (not separate classes) — no extra legacy imports needed"
  - "models.py→_base.py rename already committed under plan 41-04 (commit 6a9089c); Task 1 added the __init__.py/signage.py on top"
metrics:
  duration: 12m
  completed: 2026-04-18
  tasks: 2
  files_created: 2
  files_modified: 0
requirements_satisfied:
  - SGN-DB-01
---

# Phase 41 Plan 01: Models Package and Signage Models Summary

Converted `backend/app/models.py` into a package and added eight signage ORM classes under `app/models/signage.py`. All eight tables now register with `Base.metadata` so the Alembic migration in plan 41-03 can autogenerate from model diff. All legacy `from app.models import X` import paths are preserved.

## What Was Built

**Package structure** (`backend/app/models/`):
- `__init__.py` — re-exports `Base` + 10 legacy classes (`AppSettings`, `UploadBatch`, `SalesRecord`, `PersonioEmployee`, `PersonioAttendance`, `PersonioAbsence`, `PersonioSyncMeta`, `Sensor`, `SensorReading`, `SensorPollLog`) + 8 signage classes.
- `_base.py` — legacy content (moved verbatim in commit `6a9089c` of plan 41-04).
- `signage.py` — 8 new ORM classes.

**8 Signage ORM classes** (`backend/app/models/signage.py`):

| Class | Table | Key details |
|---|---|---|
| `SignageMedia` | `signage_media` | UUID PK; CHECK on `kind` (6 values) and `conversion_status` (4 values); JSONB `slide_paths`; relationship to playlist_items (no cascade — RESTRICT) |
| `SignagePlaylist` | `signage_playlists` | UUID PK; `priority` DEFAULT 0, `enabled` DEFAULT true; cascade="all, delete-orphan" to items, ordered by position |
| `SignagePlaylistItem` | `signage_playlist_items` | UUID PK; FK `playlist_id` CASCADE; FK `media_id` RESTRICT (D-16); `duration_s` DEFAULT 10 |
| `SignageDevice` | `signage_devices` | UUID PK; CHECK on `status`; `current_item_id` UUID (no FK, device-local cache); status DEFAULT 'offline'; forward columns for Phase 42 (device_token_hash, revoked_at) |
| `SignageDeviceTag` | `signage_device_tags` | Integer PK; named unique index `uq_signage_device_tags_name` on `name` |
| `SignageDeviceTagMap` | `signage_device_tag_map` | Composite PK (device_id, tag_id); both FKs CASCADE |
| `SignagePlaylistTagMap` | `signage_playlist_tag_map` | Composite PK (playlist_id, tag_id); both FKs CASCADE |
| `SignagePairingSession` | `signage_pairing_sessions` | UUID PK; partial-unique index `uix_signage_pairing_sessions_code_active` with `postgresql_where=text("expires_at > now() AND claimed_at IS NULL")` (D-15); FK `device_id` SET NULL |

All 8 tables carry TIMESTAMPTZ NOT NULL `created_at` and `updated_at` columns with `server_default=func.now()` and `onupdate=func.now()` on `updated_at` (D-12).

## Verification Results

```
signage tables: ['signage_device_tag_map', 'signage_device_tags', 'signage_devices',
                 'signage_media', 'signage_pairing_sessions', 'signage_playlist_items',
                 'signage_playlist_tag_map', 'signage_playlists']
legacy still registered: True
partial unique index present: True
postgresql_where set: True
media_id ondelete == RESTRICT: True
alembic current: v1_15_sensor (head) — env.py import still works
```

All plan success criteria met.

## Commits

- `50c9170` feat(41-01): convert models.py to package with signage placeholders
- `46c15a9` feat(41-01): add 8 signage ORM models to signage.py

## Deviations from Plan

**1. [Coordination] models.py→_base.py rename landed out-of-order in plan 41-04**

The prior commit `6a9089c` (plan 41-04) already executed `git mv backend/app/models.py backend/app/models/_base.py` before this plan ran. This is harmless — the rename is identical to what Task 1 specified, and 41-04's other changes (DB_EXCLUDE_TABLES for devices/pairing_sessions, directus_uploads volume mount) are independent. Task 1 of this plan added the `__init__.py` and `signage.py` files on top of the already-renamed `_base.py`.

No behavior change; noting for audit trail.

**2. [Structural] Task 1 created signage.py with stub placeholders rather than creating the file in Task 2**

Task 1's verify block imports `from app.models.signage import SignageMedia`, which requires the module to exist before Task 2 replaces its contents. Task 1 wrote a placeholder module (8 symbols bound to a `_Placeholder` sentinel class) so the package-structure verification could pass; Task 2 then overwrote `signage.py` with the full 8 real ORM classes. This produces two clean commits with honest intermediate state rather than one large combined commit.

## Auth Gates

None.

## Known Stubs

None. All 8 classes are fully defined with columns, constraints, and relationships as specified.

## Deferred Issues

None.

## Self-Check: PASSED

Files verified:
- `/Users/johannbechtold/Documents/kpi-dashboard/backend/app/models/__init__.py` — FOUND
- `/Users/johannbechtold/Documents/kpi-dashboard/backend/app/models/_base.py` — FOUND (from 6a9089c)
- `/Users/johannbechtold/Documents/kpi-dashboard/backend/app/models/signage.py` — FOUND
- `/Users/johannbechtold/Documents/kpi-dashboard/backend/app/models.py` — ABSENT (correct)

Commits verified:
- `50c9170` — FOUND
- `46c15a9` — FOUND
