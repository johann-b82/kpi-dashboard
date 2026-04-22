---
phase: 60-hr-date-range-filter
plan: 04
type: execute
wave: 3
depends_on:
  - 01
  - 02
  - 03
files_modified:
  - backend/tests/test_hr_kpi_range.py
autonomous: false
requirements:
  - D-01
  - D-02
  - D-03
  - D-06
  - D-07
  - D-08
  - D-10
  - D-11

must_haves:
  truths:
    - "Backend pytest covers: (a) /api/hr/kpis with a custom 45-day range returns single-window aggregates and prior-45-day delta; (b) /api/hr/kpis/history with a 15-day range returns 15 daily buckets; (c) /api/hr/kpis/history with a 60-day range returns weekly buckets; (d) /api/data/employees with date_from/date_to computes attendance totals over that window only"
    - "Omitting date_from/date_to on all three endpoints reproduces pre-Phase-60 behaviour (fallback path)"
    - "Inverted or half-provided ranges return HTTP 400"
    - "User-confirmed visual parity: /hr with the default thisYear preset looks equivalent to pre-Phase-60 /hr"
    - "User-confirmed: switching /sales <-> /hr preserves preset + range (D-08)"
  artifacts:
    - path: backend/tests/test_hr_kpi_range.py
      provides: "pytest suite for Phase 60 backend contracts"
      contains: "def test_"
  key_links:
    - from: backend/tests/test_hr_kpi_range.py
      to: backend/app/routers/hr_kpis.py
      via: "httpx AsyncClient against ASGI app"
      pattern: "/api/hr/kpis"
    - from: backend/tests/test_hr_kpi_range.py
      to: backend/app/routers/data.py
      via: "httpx AsyncClient"
      pattern: "/api/data/employees"
---

<objective>
Lock in the Phase 60 backend contracts with pytest coverage, then run a human visual-parity check on the default `thisYear` landing and the Sales↔HR state-preservation behaviour. This plan gates the phase: backend must prove the contract; user must confirm the visual outcome before we call Phase 60 done.

Purpose: Regression-proof the new query params + bucketing rules, and verify the non-negotiable "default landing is visually equivalent" must-have.
Output: One new backend test file, one human-approved visual check.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/60-hr-date-range-filter/60-CONTEXT.md
@CLAUDE.md
@backend/app/routers/hr_kpis.py
@backend/app/routers/data.py
@backend/app/services/hr_kpi_aggregation.py
@backend/tests/conftest.py
@backend/tests/test_kpi_aggregation.py
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Backend pytest for date_from/date_to on HR endpoints + employees</name>
  <files>backend/tests/test_hr_kpi_range.py</files>
  <read_first>
    - backend/tests/conftest.py (fixtures — DB session + test client)
    - backend/tests/test_kpi_aggregation.py (reference pattern for seeding + asserting aggregated KPIs)
    - backend/app/routers/hr_kpis.py (final shape after Plan 01)
    - backend/app/services/hr_kpi_aggregation.py (final shape after Plan 01)
    - backend/app/routers/data.py (final shape after Plan 01)
  </read_first>
  <behavior>
    Tests MUST cover:
    1. `test_hr_kpis_custom_range_single_window`: seed attendances + employees + a leaver in a known 45-day window. `GET /api/hr/kpis?date_from=2026-03-01&date_to=2026-04-14` returns `overtime_ratio.value` equal to the value produced by `_overtime_ratio(db, 2026-03-01, 2026-04-14)` directly (whole-range aggregation, not averaged monthly ratios). D-01.
    2. `test_hr_kpis_prior_window_same_length`: for the same 45-day request, `overtime_ratio.previous_period` equals `_overtime_ratio(db, 2026-01-15, 2026-02-28)` — prior 45 days ending day before `date_from`. D-02.
    3. `test_hr_kpis_fluctuation_avg_headcount_denominator`: seed 3 employees whose active status varies across the range; assert `fluctuation.value == leavers_in_range / avg_active_headcount_across_range` matches the Python-computed reference. D-03.
    4. `test_hr_kpis_omitted_params_fallback_is_current_month`: no params → behaves exactly like legacy `compute_hr_kpis` for the current month window. Use freezegun or monkeypatch `date.today`.
    5. `test_hr_kpis_history_daily_buckets`: 15-day range → response length == 15, each `month` field is `YYYY-MM-DD`.
    6. `test_hr_kpis_history_weekly_buckets`: 60-day range → response length in 9..10 and each `month` matches pattern `^\d{4}-W\d{2}$`.
    7. `test_hr_kpis_history_monthly_buckets_default`: no params → response length == 12, each `month` matches `^\d{4}-\d{2}$` (backward compat + D-07 thisYear parity).
    8. `test_hr_kpis_history_quarterly_buckets`: 1000-day range → `month` matches `^\d{4}-Q[1-4]$`.
    9. `test_employees_range_scopes_attendance`: seed an employee with 8h attendance on 2026-04-10 and 8h on 2026-05-10. `GET /api/data/employees?date_from=2026-04-01&date_to=2026-04-30` returns `total_hours == 8`, `overtime_hours == 0 (or derived)`, and `overtime_ratio` is null when `ot==0` (D-13).
    10. `test_invalid_range_returns_400`: half-provided (`date_from=...` only) and inverted (`date_from > date_to`) both return 400 on all three endpoints.
  </behavior>
  <action>
    1. Write RED tests in `backend/tests/test_hr_kpi_range.py` using the same style as `test_kpi_aggregation.py` — `async def` + `pytest.mark.asyncio` if the project uses it, or the existing httpx AsyncClient fixture. Follow existing `conftest.py` fixtures (`async_session`, `async_client`). Seed PersonioEmployee + PersonioAttendance + PersonioAbsence rows with freeze-time-safe dates (2026 fixtures).
    2. Run `pytest backend/tests/test_hr_kpi_range.py -x` — expect all new tests to fail or pass based on the Plan 01 implementation. If they fail only because of implementation bugs in Plan 01, fix those bugs in Plan 01's files (not here) and re-run.
    3. If Plan 01 is correct, tests go GREEN.
    4. Do NOT touch `test_kpi_aggregation.py` unless it directly imports a now-renamed symbol — in that case update the import. `compute_hr_kpis` signature change (now requires `(db, first, last)`) must be reflected at any existing call site. Search: `grep -rn "compute_hr_kpis" backend/`. Update any test that calls it with a 1-arg form.
  </action>
  <verify>
    <automated>cd backend &amp;&amp; python -m pytest tests/test_hr_kpi_range.py -x 2>&amp;1 | tail -40</automated>
  </verify>
  <done>
    - All 10 tests pass.
    - No existing backend tests regress: `python -m pytest backend/tests/ -x -k "not signage"` exits 0.
  </done>
  <acceptance_criteria>
    - `grep -cE "^async def test_|^def test_" backend/tests/test_hr_kpi_range.py` returns ≥10.
    - `cd backend &amp;&amp; python -m pytest tests/test_hr_kpi_range.py -x` exits 0.
    - `cd backend &amp;&amp; python -m pytest tests/ -x -k "not signage and not sensor and not signage_broadcast"` exits 0.
    - `grep -n "compute_hr_kpis(db)" backend/tests/` returns empty (no stale 1-arg callers).
  </acceptance_criteria>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Manual thisYear parity + Sales↔HR state preservation</name>
  <what-built>
    - SubHeader DateRangeFilter now mounts on /hr with shared state (Plan 03).
    - HR KPI cards, charts, and employee table consume `useDateRange()` and refetch on range change.
    - Backend endpoints accept `date_from`/`date_to`; omitted params still reproduce legacy current-month / 12-month behaviour.
  </what-built>
  <files>(human verification — no file modifications)</files>
  <action>Execute the verification steps in &lt;how-to-verify&gt; below. Do not modify files. Report findings via the resume-signal.</action>
  <verify>
    <automated>MISSING — this is a human-verify checkpoint; see &lt;how-to-verify&gt; for manual steps.</automated>
  </verify>
  <done>User signs off on all 5 verification checkpoints, or enumerates failing cases.</done>
  <how-to-verify>
    Start the app via Docker Compose (`docker compose up --build`), log in, then:

    1. **Default landing parity (D-07, D-10):**
       - Navigate to `/hr`.
       - Confirm the SubHeader DateRangeFilter is visible and shows the `Dieses Jahr` / `This year` preset active.
       - Confirm the 5 KPI cards render with values + delta badges (em-dash where not configured).
       - Confirm the 4 mini-charts render with ~12 monthly buckets and year-boundary markers identical to the pre-Phase-60 look.
       - Confirm the EmployeeTable renders with `Überstunden` / `Alle` / `Aktiv` filter and total_hours/overtime_hours columns populated.
    2. **Range change (D-06, D-11):**
       - Switch preset to `Dieser Monat` / `This month`. Confirm KPI values, charts (≤31 days → daily buckets), and employee totals update.
       - Switch to `Dieses Quartal` / `This quarter`. Confirm weekly-ish bucketing (~13 weekly buckets) on charts.
       - Pick a custom 45-day range via the custom picker. Confirm everything refetches; confirm KPI card delta labels still appear (exact copy deferred).
    3. **Sales↔HR state preservation (D-08):**
       - With a non-default preset active (e.g. `Dieser Monat`), click the Sales/HR toggle to go to `/sales`. Confirm the preset persists and Sales dashboard respects it.
       - Click back to `/hr`. Confirm the preset is still `Dieser Monat` and HR data matches.
    4. **Empty state sanity:**
       - Pick a historical range with zero attendance (e.g. 2024-01-01 → 2024-01-15). Confirm cards show em-dash gracefully; charts don't crash; table shows zero-hour rows without runtime errors.
    5. **Backend contract smoke (optional):**
       - `curl -s 'http://localhost:8000/api/hr/kpis?date_from=2026-04-01&date_to=2026-04-15' -H "Cookie: directus_session_token=..." | jq '.overtime_ratio'`
       - `curl -s 'http://localhost:8000/api/hr/kpis' | jq '.overtime_ratio'` — should match current-month response.

    Expected outcomes:
    - thisYear landing is visually equivalent to pre-Phase-60 `/hr`.
    - Range changes drive all three HR surfaces.
    - Sales↔HR navigation preserves preset + range.
    - No console errors.
  </how-to-verify>
  <resume-signal>Type "approved" when all 5 checks pass, or describe each issue with surface + preset + observed-vs-expected so it can be patched in a follow-up plan.</resume-signal>
</task>

</tasks>

<verification>
Backend: `pytest backend/tests/test_hr_kpi_range.py -x` green + no regressions in non-signage suite.
Frontend: user confirms 5-point manual checklist.
</verification>

<success_criteria>
- Pytest suite covers all 10 behaviours and passes.
- User signs off on thisYear parity and Sales↔HR state sharing.
- Phase 60 must-haves (truths + key_links across all four plans) are all observable in the running app.
</success_criteria>

<output>
After completion, create `.planning/phases/60-hr-date-range-filter/60-04-SUMMARY.md` capturing: pytest counts, any edge cases uncovered by manual QA, any deferred follow-ups (e.g. `formatHrDeltaLabels` copy updates, year-boundary markers for non-monthly granularities).
</output>
