---
phase: 19-backend-array-migration-api-and-kpi-aggregation
verified: 2026-04-12T19:30:00Z
status: passed
score: 11/11 must-haves verified
gaps: []
human_verification: []
---

# Phase 19: Backend — Array Migration, API, and KPI Aggregation — Verification Report

**Phase Goal:** The backend fully supports arrays for all 3 Personio config fields — stored as JSON arrays, exchanged as arrays over the API, and applied as IN-filter queries in HR KPI aggregation
**Verified:** 2026-04-12T19:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Existing single-value config rows are automatically migrated to single-element JSON arrays | ✓ VERIFIED | `v1_6_array_settings_columns.py` upgrade() uses `CASE WHEN x IS NULL THEN NULL ELSE jsonb_build_array(x) END` for all 3 columns |
| 2  | NULL settings values remain NULL (not [null]) after migration | ✓ VERIFIED | Same CASE WHEN pattern preserves NULL explicitly |
| 3  | GET /api/settings returns arrays for all 3 Personio config fields | ✓ VERIFIED | `SettingsRead` declares `list[int] = []` / `list[str] = []`; `_build_read` normalizes DB NULL to `[]` with `or []` |
| 4  | PUT /api/settings accepts arrays for those 3 fields and persists them | ✓ VERIFIED | `SettingsUpdate` declares `list[int] | None` / `list[str] | None`; PUT handler assigns via `if payload.x is not None:` guard |
| 5  | PUT /api/settings with empty array [] clears the field (not ignored) | ✓ VERIFIED | Guard uses `is not None` (not truthiness) — `[]` is non-None so it is written to DB |
| 6  | GET /api/settings/personio-options continues to work unchanged | ✓ VERIFIED | `get_personio_options` at line 86 is unmodified; fetches live from Personio, returns `PersonioOptions` |
| 7  | Sick leave ratio aggregates over multiple absence type IDs using IN filter | ✓ VERIFIED | `_sick_leave_ratio` takes `sick_leave_type_ids: list[int]`; line 166: `PersonioAbsence.absence_type_id.in_(sick_leave_type_ids)` |
| 8  | Revenue per production employee counts headcount across multiple departments using IN filter | ✓ VERIFIED | `_headcount_at_eom` takes `departments: list[str]`; line 83: `PersonioEmployee.department.in_(departments)`; called via `departments=production_depts` at line 296 |
| 9  | Skill development counts employees with ANY of the selected skill attribute keys | ✓ VERIFIED | `_skill_development` takes `skill_attr_keys: list[str]`; lines 269-272: `or_(*(... for key in skill_attr_keys))` OR across all JSONB paths |
| 10 | Each KPI returns is_configured=false when its array field is empty [] or null | ✓ VERIFIED | `compute_hr_kpis` normalizes settings to `[]` via `or []`; truthiness guards `if sick_type_ids:` / `if skill_keys:` / `if prod_depts:` fall to `HrKpiValue(value=None, is_configured=False)` |
| 11 | A single-element array produces a valid KPI value (backward compatible) | ✓ VERIFIED | Truthiness guard passes for a 1-element list; `.in_([x])` and `or_([single_expr])` are valid SQLAlchemy and produce same result as the old equality filter |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/alembic/versions/v1_6_array_settings_columns.py` | Alembic migration converting 3 scalar columns to JSONB arrays | ✓ VERIFIED | Exists; 86 lines; contains `jsonb_build_array` (3x), `CASE WHEN` (3x), correct `down_revision = "d4e5f6a7b8c9"`, and downgrade reverting to Integer/String |
| `backend/app/models.py` | AppSettings model with JSONB columns | ✓ VERIFIED | Lines 151-153: all 3 fields are `Mapped[list | None] = mapped_column(JSONB, nullable=True)`; JSONB imported at line 17 |
| `backend/app/schemas.py` | SettingsUpdate and SettingsRead with list types | ✓ VERIFIED | `SettingsUpdate` lines 139-141: `list[int] | None` / `list[str] | None`; `SettingsRead` lines 161-163: `list[int] = []` / `list[str] = []` |
| `backend/app/routers/settings.py` | Settings router with NULL-to-[] normalization in _build_read | ✓ VERIFIED | Lines 65-67: `row.x or []` for all 3 fields; PUT guard uses `is not None` (lines 191-195) |
| `backend/app/services/hr_kpi_aggregation.py` | HR KPI aggregation with multi-value IN filters | ✓ VERIFIED | All 4 configurable KPI helpers accept list params; `.in_()` at lines 83 and 166; `or_(*(...))` at line 269; truthiness guards at lines 335, 351, 362 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `v1_6_array_settings_columns.py` | `models.py` | Column type must match: both JSONB | ✓ WIRED | Migration upgrades to `JSONB()`; model declares `mapped_column(JSONB, nullable=True)` for all 3 fields |
| `routers/settings.py` | `schemas.py` | `_build_read` normalizes NULL to [] before constructing SettingsRead | ✓ WIRED | `_build_read` explicitly passes `row.x or []` for each field; `SettingsRead` expects `list[int]`/`list[str]` |
| `hr_kpi_aggregation.py` | `models.py` (AppSettings) | `compute_hr_kpis` reads AppSettings JSONB columns as Python lists | ✓ WIRED | Line 325-327: `settings_row.personio_sick_leave_type_id or []` etc.; SQLAlchemy JSONB returns Python list |
| `hr_kpi_aggregation.py` | `models.py` (PersonioAbsence) | `_sick_leave_ratio` uses `absence_type_id.in_()` | ✓ WIRED | Line 166: `PersonioAbsence.absence_type_id.in_(sick_leave_type_ids)` |
| `hr_kpi_aggregation.py` | `models.py` (PersonioEmployee) | `_headcount_at_eom` uses `department.in_()` | ✓ WIRED | Line 83: `PersonioEmployee.department.in_(departments)` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `hr_kpi_aggregation.py` | `sick_type_ids`, `prod_depts`, `skill_keys` | `AppSettings` row from DB query (`sa_select(AppSettings).where(AppSettings.id == 1)`) | Yes — live DB read, not static | ✓ FLOWING |
| `hr_kpi_aggregation.py` | `absences` (sick leave) | `PersonioAbsence` table query with `.in_()` filter | Yes — live DB read | ✓ FLOWING |
| `hr_kpi_aggregation.py` | `headcount` (department) | `PersonioEmployee` table query with `.in_()` filter | Yes — live DB read | ✓ FLOWING |
| `hr_kpi_aggregation.py` | `skilled` (skill dev) | `PersonioEmployee.raw_json` JSONB path query with `or_()` | Yes — live DB read | ✓ FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable entry points available without starting the Docker Compose stack. All KPI logic is inside an async FastAPI service that requires a running PostgreSQL instance.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MIG-01 | 19-01-PLAN.md | DB migration converts 3 columns to JSON arrays, preserving single values | ✓ SATISFIED | `v1_6_array_settings_columns.py` uses `jsonb_build_array` with NULL-safe CASE; downgrade reverts cleanly |
| API-01 | 19-01-PLAN.md | Settings GET/PUT accept and return arrays for all 3 fields | ✓ SATISFIED | `SettingsRead` returns `list[int] = []` / `list[str] = []`; `SettingsUpdate` accepts `list[int] | None` / `list[str] | None`; `_build_read` normalizes NULL |
| API-02 | 19-01-PLAN.md | Personio options endpoint unchanged | ✓ SATISFIED | `get_personio_options` at lines 86-145 is completely unmodified |
| KPI-01 | 19-02-PLAN.md | Sick leave ratio uses IN filter for all selected absence type IDs | ✓ SATISFIED | `PersonioAbsence.absence_type_id.in_(sick_leave_type_ids)` at line 166 |
| KPI-02 | 19-02-PLAN.md | Revenue per production employee uses IN filter for all selected departments | ✓ SATISFIED | `PersonioEmployee.department.in_(departments)` at line 83; called via `departments=production_depts` |
| KPI-03 | 19-02-PLAN.md | Skill development uses IN filter (OR across JSONB paths) for all selected skill keys | ✓ SATISFIED | `or_(*(... for key in skill_attr_keys))` generator at line 269 |
| KPI-04 | 19-02-PLAN.md | Each KPI returns `is_configured=false` when array is empty or null | ✓ SATISFIED | Truthiness guards `if sick_type_ids:` / `if skill_keys:` / `if prod_depts:` fall to `HrKpiValue(value=None, is_configured=False)` |

No orphaned requirements found — all 7 phase 19 requirement IDs appear in plan frontmatter and are covered. UI-01, UI-02, UI-03 are correctly mapped to Phase 20 (not this phase).

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Scanned all 5 modified files. No TODO/FIXME/placeholder comments, no stub return patterns (`return []`, `return {}`, `return null`), no hardcoded empty values passed to rendering. The `list[int] = []` and `list[str] = []` defaults in `SettingsRead` are schema defaults (not stubs) — they are overwritten by `_build_read` using live DB data before being returned.

---

### Human Verification Required

None — all must-haves are verifiable from static code analysis. The migration SQL correctness (CASE WHEN / jsonb_build_array) is straightforward PostgreSQL and does not require running the database to verify intent. The behavioral correctness of `.in_()` and `or_()` with SQLAlchemy is well-established.

---

### Gaps Summary

No gaps. All 11 observable truths are verified by direct code inspection. All 5 artifacts exist at the correct paths, contain substantive implementations (not stubs), and are properly wired to their data sources. All 7 requirement IDs (MIG-01, API-01, API-02, KPI-01, KPI-02, KPI-03, KPI-04) are satisfied by implemented code. The 3 documented commits (8eee345, 9389364, 0b4b092) exist in the git log and match the files changed per the SUMMARYs.

---

_Verified: 2026-04-12T19:30:00Z_
_Verifier: Claude (gsd-verifier)_
