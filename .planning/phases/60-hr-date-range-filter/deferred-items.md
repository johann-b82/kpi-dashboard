# Phase 60 — Deferred Items

Pre-existing test-suite breakage observed during Plan 60-04 Task 1 regression
sweep. None caused by Phase 60; all are out-of-scope per GSD scope-boundary
rule (not DIRECTLY caused by the current plan's changes). Logged for future
triage.

## Pre-existing backend test failures (in shared dev DB suite)

1. **`tests/test_color_validator.py` — ImportError on collection.**
   `from app.schemas import _validate_oklch` fails because `app.schemas` was
   converted from a module to a package in Phase 41-02 (commit `12a854e`) and
   the private helper is no longer top-level-reexported. Test file has not
   been updated since Phase 04-03.

2. **Auth-unaware tests return 401.** Multiple tests call endpoints now gated
   by `Depends(get_current_user)` but do not mint a Directus JWT in the
   request. Affected files observed:
   - `tests/test_kpi_chart.py::test_chart_no_comparison_returns_previous_null`
   - `tests/test_settings_api.py` (multiple: logo GET/POST 304/etag paths)
   - `tests/test_rebuild_seed.py` (`test_seed_all_fields`, `test_seed_logo`)
   - `tests/test_rebuild_assert.py` (`test_all_fields_survive_rebuild`,
     `test_logo_bytes_survive_rebuild`)
   - `tests/test_rebuild_cleanup.py::test_reset_to_defaults`

   These pre-date v1.19 / Phase 60 — likely introduced when the Directus auth
   gate was broadened or when `app_settings` routes gained the gate.

3. **`tests/test_kpi_chart.py` event-loop-closed teardown noise** reproduces
   in isolation — shared async engine pool crossing loops, flagged in
   `tests/conftest.py` with engine.dispose() mitigation but not fully
   neutralised for this module.

**New Plan 60-04 suite (`tests/test_hr_kpi_range.py`) is clean:** 13/13 pass
(11 named behaviours + 2 parametrisations). These deferred items do not
block Phase 60 completion.
