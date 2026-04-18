---
phase: 19-backend-array-migration-api-and-kpi-aggregation
plan: "01"
subsystem: backend
tags: [migration, api, jsonb, settings, alembic]
dependency_graph:
  requires: []
  provides: [JSONB-array-settings-schema, array-settings-api-contract]
  affects: [backend/app/models.py, backend/app/schemas.py, backend/app/routers/settings.py, backend/alembic/versions]
tech_stack:
  added: []
  patterns: [JSONB-array-columns, NULL-to-empty-list-normalization, Alembic-CASE-WHEN-postgresql_using]
key_files:
  created:
    - backend/alembic/versions/v1_6_array_settings_columns.py
  modified:
    - backend/app/models.py
    - backend/app/schemas.py
    - backend/app/routers/settings.py
decisions:
  - "JSONB chosen over ARRAY type for flexibility — consistent with existing raw_json usage in PersonioEmployee/Attendance/Absence models"
  - "NULL-to-[] normalization in _build_read (not in schema default) — keeps DB NULL semantics separate from API contract"
  - "PUT guard remains 'is not None' not truthiness — empty list [] is a valid 'clear' action distinct from 'no change' (None)"
metrics:
  duration: 3min
  completed: "2026-04-12"
  tasks_completed: 2
  files_changed: 4
requirements: [MIG-01, API-01, API-02]
---

# Phase 19 Plan 01: Array Settings Migration and API Contract Summary

**One-liner:** Alembic JSONB migration with NULL-safe CASE expressions converts 3 Personio config columns from scalar to array, with matching Pydantic schema and router normalization updates.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Alembic migration and update SQLAlchemy model | 8eee345 | backend/alembic/versions/v1_6_array_settings_columns.py, backend/app/models.py |
| 2 | Update Pydantic schemas and settings router for array contract | 9389364 | backend/app/schemas.py, backend/app/routers/settings.py |

## What Was Built

### Alembic Migration (v1_6_array_settings_columns.py)

- `revision = "e5f6a7b8c9d0"`, `down_revision = "d4e5f6a7b8c9"` (chains from v1.3 Personio columns)
- `upgrade()`: Three `op.alter_column` calls using `postgresql_using` with CASE expressions:
  - `CASE WHEN x IS NULL THEN NULL ELSE jsonb_build_array(x) END`
  - Preserves NULL (not [null]), wraps existing scalar values in single-element arrays
- `downgrade()`: Reverts to Integer/String(255) using `->0::int` / `->>0` operators

### SQLAlchemy Model (models.py)

- `personio_sick_leave_type_id: Mapped[list | None] = mapped_column(JSONB, nullable=True)`
- `personio_production_dept: Mapped[list | None] = mapped_column(JSONB, nullable=True)`
- `personio_skill_attr_key: Mapped[list | None] = mapped_column(JSONB, nullable=True)`
- JSONB already imported from `sqlalchemy.dialects.postgresql` — no new import needed

### Pydantic Schemas (schemas.py)

- `SettingsUpdate`: 3 fields changed to `list[int] | None` / `list[str] | None` — `None` = don't change, `[]` = clear, `[v]` = set
- `SettingsRead`: 3 fields changed to `list[int] = []` / `list[str] = []` — always returns lists, never None

### Settings Router (routers/settings.py)

- `_build_read`: 3 fields normalized with `row.x or []` — DB NULL becomes empty list in API response
- PUT handler guard unchanged: `if payload.x is not None:` — correctly distinguishes None (skip) from [] (clear)
- `get_personio_options` endpoint: completely untouched (API-02 non-regression)

## Verification

```
backend/app/models.py JSONB columns:
  151: personio_sick_leave_type_id: Mapped[list | None] = mapped_column(JSONB, nullable=True)
  152: personio_production_dept: Mapped[list | None] = mapped_column(JSONB, nullable=True)
  153: personio_skill_attr_key: Mapped[list | None] = mapped_column(JSONB, nullable=True)

Migration file:
  - 3 CASE WHEN expressions (one per column)
  - 3 jsonb_build_array calls
  - down_revision = "d4e5f6a7b8c9" confirmed

schemas.py:
  - list[int] | None and list[str] | None in SettingsUpdate
  - list[int] = [] and list[str] = [] in SettingsRead

routers/settings.py:
  - "or []" normalization in _build_read for all 3 fields
  - "is not None" guard in PUT handler unchanged
```

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — all changes are complete structural changes with no placeholder values. JSONB arrays will be populated when the frontend (Phase 20) sends multi-select values.

## Self-Check: PASSED

- backend/alembic/versions/v1_6_array_settings_columns.py: FOUND
- backend/app/models.py (JSONB columns): FOUND
- backend/app/schemas.py (list types): FOUND
- backend/app/routers/settings.py (or [] normalization): FOUND
- Commit 8eee345: FOUND
- Commit 9389364: FOUND
