---
phase: 41-signage-schema-models
plan: 03
subsystem: database
tags: [alembic, migration, signage, postgres, schema]
requires:
  - v1_15_sensor (down_revision)
  - backend/app/models/signage.py (column shapes source of truth)
provides:
  - 8 signage_* tables in public schema
  - Partial-unique index uix_signage_pairing_sessions_code_active
  - CHECK constraints ck_signage_media_kind, ck_signage_media_conversion_status, ck_signage_devices_status
  - FK ondelete semantics (CASCADE/RESTRICT/SET NULL) per D-14/D-15/D-16
affects:
  - Alembic head advanced to v1_16_signage
  - Enables Plan 41-04 (Directus exclusion list) and 41-05 (round-trip verification)
tech-stack:
  added: []
  patterns:
    - handwritten migration (no autogenerate — partial-unique indexes not detected reliably)
    - postgresql.UUID(as_uuid=True) + gen_random_uuid() server default (PG17 built-in, no pgcrypto)
    - postgresql.JSONB for structured arrays (slide_paths)
    - CHECK constraints over ENUM types (round-trip clean, no CREATE TYPE/DROP TYPE churn)
    - partial-unique index via postgresql_where=sa.text(...)
    - named FKs (fk_<table>_<col>) and CHECKs (ck_<table>_<col>) for predictable drop order
key-files:
  created:
    - backend/alembic/versions/v1_16_signage_schema.py
  modified: []
decisions:
  - Used `v1_15_sensor` as down_revision (verified via `docker compose run --rm migrate alembic heads` after rebuild)
  - Split into 2 atomic commits: Task 1 adds upgrade() with `raise NotImplementedError` downgrade stub; Task 2 fills downgrade(). Rationale: keep each commit self-consistent and revertible; no broken intermediate state besides Alembic refusing downgrade (acceptable — head would not downgrade between the two commits).
  - No `CREATE EXTENSION pgcrypto` — PG17 ships `gen_random_uuid()` built-in.
  - No Postgres ENUM types — CHECK constraints are simpler to round-trip.
metrics:
  duration: 152s
  tasks: 2
  files: 1
  completed: 2026-04-18
---

# Phase 41 Plan 03: Alembic Migration Summary

Single handwritten Alembic revision `v1_16_signage` creating all 8 signage tables with the partial-unique pairing-code index, CHECK constraints, and FK ondelete semantics mandated by RESEARCH.md and the ORM in `backend/app/models/signage.py`.

## What Was Built

**`backend/alembic/versions/v1_16_signage_schema.py`** — one revision file, revision id `v1_16_signage`, down_revision `v1_15_sensor`.

### upgrade() creates

Tables (in FK-dependency order):

1. `signage_media` — UUID PK, CHECK on `kind` (6 values) and `conversion_status` (4 values + NULL), JSONB `slide_paths`.
2. `signage_playlists` — UUID PK, `priority DEFAULT 0`, `enabled DEFAULT true`.
3. `signage_device_tags` — int autoincrement PK, unique index `uq_signage_device_tags_name` on `name`.
4. `signage_devices` — UUID PK, CHECK on `status` ∈ {online, offline, pending}, `status DEFAULT 'offline'`.
5. `signage_playlist_items` — UUID PK, FK `playlist_id` CASCADE, FK `media_id` **RESTRICT** (SGN-DB-03), named btree indexes on both FKs.
6. `signage_device_tag_map` — composite PK `(device_id, tag_id)`, both FKs CASCADE.
7. `signage_playlist_tag_map` — composite PK `(playlist_id, tag_id)`, both FKs CASCADE.
8. `signage_pairing_sessions` — UUID PK, FK `device_id` SET NULL, partial-unique index `uix_signage_pairing_sessions_code_active` on `code` WHERE `expires_at > now() AND claimed_at IS NULL` (SGN-DB-02).

All tables carry `created_at` / `updated_at` TIMESTAMPTZ NOT NULL with `server_default=now()`.

### downgrade() drops

Reverse dependency order: `uix_signage_pairing_sessions_code_active` → `signage_pairing_sessions` → `signage_playlist_tag_map` → `signage_device_tag_map` → `ix_signage_playlist_items_*` → `signage_playlist_items` → `signage_devices` → `uq_signage_device_tags_name` → `signage_device_tags` → `signage_playlists` → `signage_media`. CHECK and FK constraints drop implicitly with their tables.

### Named constraints

FKs: `fk_signage_playlist_items_playlist_id`, `fk_signage_playlist_items_media_id`, `fk_signage_device_tag_map_device_id`, `fk_signage_device_tag_map_tag_id`, `fk_signage_playlist_tag_map_playlist_id`, `fk_signage_playlist_tag_map_tag_id`, `fk_signage_pairing_sessions_device_id`.

CHECKs: `ck_signage_media_kind`, `ck_signage_media_conversion_status`, `ck_signage_devices_status`.

Composite PKs: `pk_signage_device_tag_map`, `pk_signage_playlist_tag_map`.

## `alembic heads` Proof

```
$ docker compose run --rm migrate alembic heads
v1_16_signage (head)

$ docker compose run --rm migrate alembic history --verbose | grep -A2 v1_16_signage
Rev: v1_16_signage (head)
Parent: v1_15_sensor
Path: /app/alembic/versions/v1_16_signage_schema.py
```

## Commits

| Task | Hash    | Message                                                       |
| ---- | ------- | ------------------------------------------------------------- |
| 1    | 9bc1a1c | feat(41-03): add v1_16_signage upgrade() creating 8 tables    |
| 2    | 7da3b4c | feat(41-03): implement v1_16_signage downgrade() reverse order|

## Deviations from Plan

**None that affect functional outcome.** One process note:

- **[Process] Task 1 committed with stubbed downgrade.** Plan implies upgrade-only file at end of Task 1. To keep each commit self-consistent and individually revertible, Task 1 committed `def downgrade(): raise NotImplementedError(...)`. Task 2 replaced the stub with the real downgrade body. Result after both commits is identical to the plan's intended final state.

## DB Round-Trip

Full DB round-trip (`upgrade → downgrade → upgrade` on fresh DB) is **deferred to Plan 41-05** per the plan's scope. This plan's verification is file-level static checks + `alembic heads` recognition, all of which passed.

## Self-Check: PASSED

**Files created (verified present):**
- `backend/alembic/versions/v1_16_signage_schema.py` — FOUND

**Commits (verified in `git log`):**
- `9bc1a1c` — FOUND
- `7da3b4c` — FOUND

**Alembic recognition:** `v1_16_signage (head)` — confirmed via `docker compose run --rm migrate alembic heads`.

**Static checks:**
- File parses as Python — PASS
- revision id set correctly — PASS
- All 8 `op.create_table` calls — PASS
- All 8 `op.drop_table` calls — PASS
- Partial unique index created + dropped — PASS
- `ondelete="RESTRICT"` on media_id — PASS
- No `pgcrypto` references — PASS
- 2 `PrimaryKeyConstraint` (composite PKs) — PASS
- 5 `gen_random_uuid()` defaults — PASS
