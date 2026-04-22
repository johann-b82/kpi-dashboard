---
phase: 60-hr-date-range-filter
plan: 04
subsystem: hr-backend/tests
tags: [tests, pytest, hr-kpi, date-range, regression]
status: task-1-complete-task-2-awaiting-human-verify
requires:
  - Phase 60-01 backend endpoints (compute_hr_kpis(db, first, last), _bucket_windows, data.py date_from/date_to)
  - Phase 60-02 frontend fetchers + bucketing
  - Phase 60-03 SubHeader + HR consumers wiring
provides:
  - "Regression coverage for the Phase 60 backend contracts"
  - "Explicit 45/104 fluctuation avg-headcount expectation (D-03)"
  - "D-05 sick-leave whole-range mirror test guarding against per-month averaging"
  - "D-06 bucketing regression (daily/weekly/monthly-default/quarterly)"
  - "Invalid-range HTTP 400 contract on /api/hr/kpis, /api/hr/kpis/history, /api/data/employees"
affects:
  - backend/tests/test_hr_kpi_range.py
tech-stack:
  added: []
  patterns:
    - "httpx.AsyncClient + LifespanManager via conftest `client` fixture (repo standard)"
    - "Far-future 2099 seed pattern where possible; 2026 plan dates where required for D-03 math"
    - "Minted Directus admin JWT via tests.test_directus_auth._mint for Authorization header"
    - "Test-scoped id space (9_5xx_xxx) to avoid colliding with Personio ids in shared dev DB"
    - "Quarantine pattern: snapshot other PersonioEmployee hire/term, shift them out of range, restore in finally — guarantees D-03 denominator isolation against the shared dev DB"
key-files:
  created:
    - backend/tests/test_hr_kpi_range.py
  modified: []
decisions:
  - "Parametrised test_invalid_range_returns_400 across all 3 endpoints — one test function, 3 test ids, matches plan's enumeration economically"
  - "Quarantine-and-restore rather than DB-wide truncation for D-03 isolation — keeps tests compatible with the always-on shared dev DB used by the repo's other integration tests"
  - "Time-freeze for test_hr_kpis_omitted_params_fallback_is_current_month via monkeypatched date class on app.routers.hr_kpis (not freezegun); zero new dependencies"
  - "Test 13 total (parametrize explodes 1 -> 3) while plan demands 11 named behaviours — AC grep of ≥11 `test_` definitions is satisfied via the 11 named `test_` functions"
metrics:
  duration: ~9m
  completed: 2026-04-22
  tasks: 1 of 2
  files_modified: 1
requirements:
  - D-01
  - D-02
  - D-03
  - D-05
  - D-06
  - D-07
  - D-08    # (deferred to Task 2 human-verify)
  - D-10    # (deferred to Task 2 human-verify)
  - D-11
---

# Phase 60 Plan 04: Tests and ThisYear Parity — Task 1 Complete

## Status

- **Task 1 (backend pytest suite):** Complete — 13/13 tests pass inside `kpi-dashboard-api-1` container.
- **Task 2 (manual thisYear parity + Sales↔HR state preservation):** Awaiting human verification (blocking checkpoint).

Plan 60-04 is therefore NOT complete. Phase 60 remains in progress until the user signs off on Task 2's 6-point verification checklist (see plan `<how-to-verify>` section).

## What Shipped (Task 1)

New file: `backend/tests/test_hr_kpi_range.py` (643 lines, 11 named `test_` functions, 13 collected items with `test_invalid_range_returns_400` parametrised across the 3 endpoints).

### Pytest Counts

```
collected 13 items
tests/test_hr_kpi_range.py::test_hr_kpis_custom_range_single_window                       PASSED
tests/test_hr_kpi_range.py::test_hr_kpis_prior_window_same_length                         PASSED
tests/test_hr_kpi_range.py::test_hr_kpis_fluctuation_avg_headcount_denominator            PASSED
tests/test_hr_kpi_range.py::test_hr_kpis_omitted_params_fallback_is_current_month         PASSED
tests/test_hr_kpi_range.py::test_hr_kpis_history_daily_buckets                            PASSED
tests/test_hr_kpi_range.py::test_hr_kpis_history_weekly_buckets                           PASSED
tests/test_hr_kpi_range.py::test_hr_kpis_history_monthly_buckets_default                  PASSED
tests/test_hr_kpi_range.py::test_hr_kpis_history_quarterly_buckets                        PASSED
tests/test_hr_kpi_range.py::test_employees_range_scopes_attendance                        PASSED
tests/test_hr_kpi_range.py::test_invalid_range_returns_400[/api/hr/kpis]                  PASSED
tests/test_hr_kpi_range.py::test_invalid_range_returns_400[/api/hr/kpis/history]          PASSED
tests/test_hr_kpi_range.py::test_invalid_range_returns_400[/api/data/employees]           PASSED
tests/test_hr_kpi_range.py::test_hr_kpis_sick_leave_whole_range                           PASSED
============================== 13 passed in 1.63s ==============================
```

### Behaviour Coverage (plan `<behavior>` 1..11)

| # | Name                                                      | Plan Ref | Status  |
| - | --------------------------------------------------------- | -------- | ------- |
| 1 | `test_hr_kpis_custom_range_single_window`                 | D-01     | ✓       |
| 2 | `test_hr_kpis_prior_window_same_length`                   | D-02     | ✓       |
| 3 | `test_hr_kpis_fluctuation_avg_headcount_denominator`      | D-03     | ✓       |
| 4 | `test_hr_kpis_omitted_params_fallback_is_current_month`   | legacy   | ✓       |
| 5 | `test_hr_kpis_history_daily_buckets`                      | D-06     | ✓       |
| 6 | `test_hr_kpis_history_weekly_buckets`                     | D-06     | ✓       |
| 7 | `test_hr_kpis_history_monthly_buckets_default`            | D-07     | ✓       |
| 8 | `test_hr_kpis_history_quarterly_buckets`                  | D-06     | ✓       |
| 9 | `test_employees_range_scopes_attendance`                  | D-11/D-13 | ✓      |
| 10| `test_invalid_range_returns_400[…]`                       | contract | ✓ (×3) |
| 11| `test_hr_kpis_sick_leave_whole_range`                     | D-05     | ✓       |

### Explicit D-03 Numeric Expectation

Test 3 seeds exactly the 3-employee / 45-day scenario from the plan:

```
avg_active_headcount = (3·14 + 2·31) / 45 = 104 / 45 ≈ 2.311…
leavers_in_range    = 1 (Employee C, term 2026-03-15)
fluctuation         = 1 / (104/45) = 45/104 ≈ 0.4327
```

Assertion: `body["fluctuation"]["value"] == pytest.approx(45/104, rel=1e-6)`. This would fail if the backend ever reverted to an end-of-month snapshot denominator.

### D-05 Sick-Leave Mirror Seed

Test 11 seeds a single-day March sick-leave absence so that the per-month unweighted average and the day-weighted whole-range ratio diverge; a regression back to month-averaging would break the assertion.

## Acceptance Criteria

| AC                                                                                  | Status |
| ----------------------------------------------------------------------------------- | ------ |
| `grep -cE "^async def test_|^def test_" backend/tests/test_hr_kpi_range.py` ≥ 11    | PASS (11) |
| `grep -n "test_hr_kpis_sick_leave_whole_range"` matches                             | PASS (line 549) |
| `grep -nE "45 ?/ ?104|104 ?/ ?45|approx\(45/104"` matches                           | PASS (lines 8, 239, 241, 332) |
| `python -m pytest tests/test_hr_kpi_range.py -x` exits 0                            | PASS (13/13 in 1.63s) |
| `python -m pytest tests/ -x -k "not signage and not sensor and not signage_broadcast"` exits 0 | DEFERRED (pre-existing auth + schema-package regressions; see Deviations) |
| `grep -n "compute_hr_kpis(db)" backend/tests/` returns empty                        | PASS (no stale 1-arg callers) |

## Deviations from Plan

**[Rule 3 boundary — out-of-scope pre-existing failures]** The broad regression AC (`pytest tests/ -k "not signage and not sensor"`) revealed 24 failures unrelated to Phase 60:

1. `tests/test_color_validator.py` fails at collection: `from app.schemas import _validate_oklch` — `app.schemas` became a package in Phase 41-02 (commit `12a854e`), and `_validate_oklch` is no longer top-level-re-exported. Pre-dates v1.19.
2. 20+ tests return HTTP 401 on endpoints now gated by `Depends(get_current_user)`. These tests do not mint a Directus JWT. Affected files: `test_kpi_chart.py`, `test_settings_api.py`, `test_rebuild_seed.py`, `test_rebuild_assert.py`, `test_rebuild_cleanup.py`. Pre-dates Phase 60.
3. `test_kpi_chart.py` teardown shows the "Event loop is closed" noise flagged in `conftest.py`'s engine-dispose comments — not introduced here.

Per GSD scope boundary, these are NOT auto-fixed in this plan — they are pre-existing and not directly caused by Phase 60 changes. Logged to `.planning/phases/60-hr-date-range-filter/deferred-items.md` for a future test-hygiene pass.

**No Rule 1/2/3/4 auto-fixes needed for the new test file** — plan executed as written.

**No plan-text deviations.** All 11 behaviours from the plan are implemented and pass. The parametrisation of test 10 across 3 endpoints produces 3 collected test ids (13 total rather than 11), which exceeds the plan's AC lower bound of "≥ 11 test definitions".

## Awaiting Human Verification (Task 2)

Per the plan's `<how-to-verify>` checklist, a human must:

1. **Default landing parity (D-07, D-10):** `/hr` with `thisYear` preset visually equivalent to pre-Phase-60.
2. **Range change (D-06, D-11):** `thisMonth` → daily, `thisQuarter` → weekly, custom 45-day → refetch.
3. **Sales↔HR state preservation (D-08):** preset persists on `/sales` ↔ `/hr` toggle.
4. **Empty state sanity:** historical no-attendance range shows em-dash gracefully, no crashes.
5. **Backend contract smoke (optional):** `curl` /api/hr/kpis with + without `date_from`/`date_to`.
6. **Delta badge copy sanity:** custom non-calendar window should not actively claim "vs previous year" — flag as deferred follow-up if it does.

Resume signal: user types `"approved"` or enumerates failing surfaces.

## Commits

- `5a05565` test(60-04): add pytest suite for HR date-range endpoints

## Self-Check: PASSED

- [x] `backend/tests/test_hr_kpi_range.py` FOUND
- [x] commit `5a05565` present in `git log`
- [x] 11 named `test_` functions present; 13 items collected
- [x] D-05 sick-leave mirror test present (line 549)
- [x] Explicit 45/104 numeric expectation present (line 332)
- [x] No stale `compute_hr_kpis(db)` callers in `backend/tests/`
- [x] New pytest suite 13/13 pass inside `kpi-dashboard-api-1`
- [x] Task 2 explicitly documented as awaiting human verification (plan NOT marked complete)
- [x] `deferred-items.md` captures pre-existing auth/schema-package test regressions observed during broad regression sweep
