---
phase: 19-backend-array-migration-api-and-kpi-aggregation
plan: "02"
subsystem: backend
tags: [hr-kpi, aggregation, jsonb, in-filter, or-condition, multi-value]
dependency_graph:
  requires: [JSONB-array-settings-schema, array-settings-api-contract]
  provides: [multi-value-hr-kpi-aggregation]
  affects: [backend/app/services/hr_kpi_aggregation.py]
tech_stack:
  added: []
  patterns: [SQLAlchemy-in_()-filter, SQLAlchemy-or_()-JSONB-multi-key, truthiness-based-is_configured]
key_files:
  created: []
  modified:
    - backend/app/services/hr_kpi_aggregation.py
decisions:
  - "or_(*(...)) generator idiom used for JSONB multi-key skill development filter — single WHERE clause scales to N keys without N separate .where() chains"
  - "truthiness guard (if x:) replaces is not None check — empty list [] from NULL normalization correctly produces is_configured=False per D-06"
  - "or [] normalization in compute_hr_kpis at read time — keeps helper functions pure (no None branch needed inside each KPI function)"
metrics:
  duration: 2min
  completed: "2026-04-12"
  tasks_completed: 1
  files_changed: 1
requirements: [KPI-01, KPI-02, KPI-03, KPI-04]
---

# Phase 19 Plan 02: HR KPI Aggregation Multi-Value IN Filters Summary

**One-liner:** Updated all 4 configurable HR KPI helper functions to accept list parameters and filter with SQLAlchemy `.in_()` / `or_()` clauses, with NULL-to-empty-list normalization and truthiness-based `is_configured` guards in `compute_hr_kpis`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update KPI helper function signatures and queries for multi-value filtering | 0b4b092 | backend/app/services/hr_kpi_aggregation.py |

## What Was Built

### `_headcount_at_eom` (lines 65-85)

- Parameter changed: `department: str | None = None` → `departments: list[str] | None = None`
- Filter changed: `== department` → `.in_(departments)` with truthiness guard `if departments:`
- Docstring updated to reflect IN match semantics

### `_sick_leave_ratio` (lines 146-226)

- Parameter changed: `sick_leave_type_id: int` → `sick_leave_type_ids: list[int]`
- Query filter changed: `PersonioAbsence.absence_type_id == sick_leave_type_id` → `PersonioAbsence.absence_type_id.in_(sick_leave_type_ids)`

### `_skill_development` (lines 246-275)

- Parameter changed: `skill_attr_key: str` → `skill_attr_keys: list[str]`
- Single JSONB path filter replaced with `or_(*(... for key in skill_attr_keys))` — matches employees with ANY configured skill attribute key having a non-null value
- Docstring updated to mention multi-key support

### `_revenue_per_production_employee` (lines 275-296)

- Parameter changed: `production_dept: str` → `production_depts: list[str]`
- Call to `_headcount_at_eom` updated: `department=production_dept` → `departments=production_depts`

### `compute_hr_kpis` (lines 304-386)

- Settings destructuring changed from scalar `None` fallback to empty-list normalization:
  - `sick_type_ids: list[int] = (settings_row.personio_sick_leave_type_id or []) if settings_row else []`
  - `prod_depts: list[str] = (settings_row.personio_production_dept or []) if settings_row else []`
  - `skill_keys: list[str] = (settings_row.personio_skill_attr_key or []) if settings_row else []`
- `is_configured` guards changed from `if x is not None:` to `if x:` (truthiness)
- All 3 call sites updated to pass new list variable names

## Verification

```
backend/app/services/hr_kpi_aggregation.py:
  83:  stmt = stmt.where(PersonioEmployee.department.in_(departments))
  166: PersonioAbsence.absence_type_id.in_(sick_leave_type_ids),
  269: or_(*(
  335: if sick_type_ids:
  351: if skill_keys:
  362: if prod_depts:
  
All 15 acceptance criteria: PASS (verified via Python string check)
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all 4 KPI functions are fully wired to their new list parameters. JSONB array values from the database (populated when the frontend sends multi-select values via Plan 19-03/19-04) will flow through correctly.

## Self-Check: PASSED

- backend/app/services/hr_kpi_aggregation.py (departments .in_()): FOUND
- backend/app/services/hr_kpi_aggregation.py (absence_type_id .in_()): FOUND
- backend/app/services/hr_kpi_aggregation.py (or_(*( generator)): FOUND
- backend/app/services/hr_kpi_aggregation.py (if sick_type_ids): FOUND
- backend/app/services/hr_kpi_aggregation.py (if prod_depts): FOUND
- backend/app/services/hr_kpi_aggregation.py (if skill_keys): FOUND
- backend/app/services/hr_kpi_aggregation.py (or [] normalization x3): FOUND
- Commit 0b4b092: FOUND
