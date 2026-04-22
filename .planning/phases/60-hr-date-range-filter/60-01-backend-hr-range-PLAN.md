---
phase: 60-hr-date-range-filter
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/routers/hr_kpis.py
  - backend/app/services/hr_kpi_aggregation.py
  - backend/app/routers/data.py
autonomous: true
requirements:
  - D-01
  - D-02
  - D-03
  - D-04
  - D-05
  - D-11
  - D-13

must_haves:
  truths:
    - "GET /api/hr/kpis?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD returns HrKpiResponse aggregated over [date_from, date_to] as a single window"
    - "Each HR KPI's previous_period field equals the same KPI recomputed over the immediately-preceding window of identical length"
    - "GET /api/hr/kpis/history?date_from=...&date_to=... returns buckets covering the range at the correct granularity (daily ≤31d, weekly ≤91d, monthly ≤24mo, quarterly >24mo)"
    - "GET /api/data/employees?date_from=...&date_to=... returns total_hours/overtime_hours/overtime_ratio computed over the request range (not current calendar month)"
    - "Omitting date_from/date_to preserves today's behaviour (current calendar month for KPI endpoint and employees; 12 monthly buckets for history endpoint) so the default thisYear landing remains visually equivalent"
    - "File header comment in hr_kpis.py no longer claims D-03 fixed-calendar-month semantics"
  artifacts:
    - path: backend/app/routers/hr_kpis.py
      provides: "HR KPI endpoints with date_from/date_to query params + prior-window-same-length delta"
      contains: "date_from"
    - path: backend/app/services/hr_kpi_aggregation.py
      provides: "compute_hr_kpis(db, first, last) operating over arbitrary window + fluctuation helper using avg_active_headcount_across_range"
      contains: "compute_hr_kpis"
    - path: backend/app/routers/data.py
      provides: "/api/data/employees accepting date_from/date_to for attendance aggregation window"
      contains: "date_from"
  key_links:
    - from: backend/app/routers/hr_kpis.py
      to: backend/app/services/hr_kpi_aggregation.py
      via: "compute_hr_kpis(db, first, last)"
      pattern: "compute_hr_kpis\\("
    - from: backend/app/routers/hr_kpis.py
      to: backend/app/services/hr_kpi_aggregation.py
      via: "prior-window-same-length helper"
      pattern: "prior_window|prev_window|shift_window"
---

<objective>
Extend the HR backend so every HR-facing endpoint accepts `date_from`/`date_to` query parameters and aggregates all 5 KPIs, history buckets, and employee attendance totals over that arbitrary window. Add a shared helper that computes the prior window of identical length (for CARD delta), and replace fluctuation's end-of-month headcount denominator with average active headcount across the range (D-03). Update the stale header comment in `hr_kpis.py` that locks the old "no date params" decision.

Purpose: Phase 60 reverses the original HR D-03 ("fixed calendar month, no params"). All downstream frontend integration (Plans 02 + 03) depends on these contracts being in place.
Output: Three modified backend modules exposing the new contract; all helpers still pure-read and single-AsyncSession safe.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/60-hr-date-range-filter/60-CONTEXT.md
@CLAUDE.md
@backend/app/routers/hr_kpis.py
@backend/app/services/hr_kpi_aggregation.py
@backend/app/routers/data.py
@backend/app/schemas/_base.py

<interfaces>
From backend/app/schemas/_base.py (HR types — SCHEMA UNCHANGED this phase):
```python
class HrKpiValue(BaseModel):
    value: float | None = None
    is_configured: bool = True
    previous_period: float | None = None  # <-- now = prior window of same length (D-02)
    previous_year: float | None = None    # <-- preserved for existing consumers; set to same-length-one-year-ago window

class HrKpiResponse(BaseModel):
    overtime_ratio: HrKpiValue
    sick_leave_ratio: HrKpiValue
    fluctuation: HrKpiValue
    skill_development: HrKpiValue
    revenue_per_production_employee: HrKpiValue

class HrKpiHistoryPoint(BaseModel):
    month: str  # now a bucket label — "YYYY-MM-DD" for daily, "YYYY-Www" for weekly, "YYYY-MM" for monthly, "YYYY-Qn" for quarterly
    overtime_ratio: float | None = None
    sick_leave_ratio: float | None = None
    fluctuation: float | None = None
    revenue_per_production_employee: float | None = None
```

From backend/app/services/hr_kpi_aggregation.py (existing helpers all take window tuples):
```python
async def _overtime_ratio(session, first_day: date, last_day: date) -> float | None
async def _sick_leave_ratio(session, first_day, last_day, sick_leave_type_ids) -> float | None
async def _fluctuation(session, first_day, last_day) -> float | None  # REPLACED (D-03)
async def _revenue_per_production_employee(session, first_day, last_day, production_depts) -> float | None
async def _headcount_at_eom(session, last_day, departments=None) -> int  # keep, but no longer used as fluctuation denom
```

Sales mirror convention (backend/app/routers/data.py:20-44 `/api/data/sales`): param names are `start_date` / `end_date` (snake, `date | None = Query(None)`). HR endpoints in this phase follow the more-descriptive `date_from` / `date_to` convention explicitly called out in CONTEXT D-01..D-11; this is the intentional divergence — do NOT rename to start_date/end_date.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add window helpers + rewrite fluctuation to avg-active-headcount</name>
  <files>backend/app/services/hr_kpi_aggregation.py</files>
  <read_first>
    - backend/app/services/hr_kpi_aggregation.py (whole file)
    - backend/app/routers/hr_kpis.py (header comment + existing imports)
    - .planning/phases/60-hr-date-range-filter/60-CONTEXT.md (D-02, D-03 in particular)
  </read_first>
  <behavior>
    - Given any `(first, last)` date tuple, `prior_window_same_length(first, last) -> (prev_first, prev_last)` returns a window of the SAME day-count ending the day before `first` (e.g. (2026-04-01, 2026-04-15) → (2026-03-17, 2026-03-31); 45-day range → prior 45 days).
    - Given any `(first, last)`, `_fluctuation(db, first, last)` returns `leavers_with_termination_date_in_range / avg_active_headcount_across_range` — NOT leavers / EOM headcount. `avg_active_headcount_across_range` = mean over every calendar day d in [first, last] of `count(employees where hire_date <= d AND (termination_date IS NULL OR termination_date > d))`. Returns `None` when avg is 0.
    - Existing `_overtime_ratio`, `_sick_leave_ratio`, `_revenue_per_production_employee`, `_headcount_at_eom`, `_skill_development`, `_month_bounds`, `_prev_month` must keep their current public signatures and current behaviour when called with a month tuple (backward compat so callers outside this file keep working).
  </behavior>
  <action>
    1. In `backend/app/services/hr_kpi_aggregation.py` add a pure helper after `_weekday_count`:
       ```python
       def prior_window_same_length(first_day: date, last_day: date) -> tuple[date, date]:
           """Return the window of identical length ending the day before first_day.

           Used by HR KPI endpoints to produce D-02 deltas (prior window of same length).
           45-day range → prior 45 days. (2026-04-01, 2026-04-15) → (2026-03-17, 2026-03-31).
           """
           length_days = (last_day - first_day).days + 1
           prev_last = first_day - timedelta(days=1)
           prev_first = prev_last - timedelta(days=length_days - 1)
           return prev_first, prev_last
       ```
       And a one-year-shift helper used for the `previous_year` delta field (kept for card compatibility — subtract 365 days; leap day drift is acceptable per CONTEXT discretion):
       ```python
       def same_window_prior_year(first_day: date, last_day: date) -> tuple[date, date]:
           return first_day - timedelta(days=365), last_day - timedelta(days=365)
       ```
    2. Rewrite `_fluctuation` per D-03. Leavers stay as-is (`termination_date BETWEEN first AND last`). Replace the `_headcount_at_eom` call with an in-Python average:
       ```python
       # Build avg active headcount across range: fetch (hire_date, termination_date)
       # for every employee whose contract overlaps [first_day, last_day] (hire_date <= last_day
       # AND (termination_date IS NULL OR termination_date >= first_day)), then for each
       # day d in [first_day, last_day] count rows satisfying hire_date <= d AND
       # (termination_date IS NULL OR termination_date > d). Average over all days.
       ```
       Guard: if `(last_day - first_day).days + 1 <= 0` or average is 0, return `None`. Keep the function async and use the existing `PersonioEmployee` columns only — no new column access.
    3. Update the module docstring (lines 1-8) to state: "HR KPI aggregation service — computes all 5 HR KPIs for arbitrary [first_day, last_day] windows. Fluctuation denominator is average active headcount across the window (D-03 Phase 60; replaces end-of-month snapshot)." Delete the mention of "three calendar month windows" and "current month, previous month, and same month last year".
    4. `compute_hr_kpis` signature change: `async def compute_hr_kpis(db: AsyncSession, first: date, last: date) -> HrKpiResponse`. Inside:
       - `cur_first, cur_last = first, last`
       - `prev_first, prev_last = prior_window_same_length(first, last)`
       - `ya_first, ya_last = same_window_prior_year(first, last)`
       - Existing sequential-await block stays byte-for-byte identical (no asyncio.gather, Pitfall 2).
       - Skill development unchanged — still uses `last` (point-in-time snapshot per CONTEXT out-of-scope note).
    5. Keep `_month_bounds`, `_prev_month` exports intact — `hr_kpis.py` router still needs `_month_bounds` as a fallback for the omitted-params case.
  </action>
  <verify>
    <automated>cd backend &amp;&amp; python -m pytest tests/test_kpi_aggregation.py -x 2>&amp;1 | tail -20; python -c "from datetime import date; from app.services.hr_kpi_aggregation import prior_window_same_length, same_window_prior_year; assert prior_window_same_length(date(2026,4,1), date(2026,4,15)) == (date(2026,3,17), date(2026,3,31)); assert same_window_prior_year(date(2026,4,1), date(2026,4,15)) == (date(2025,4,1), date(2025,4,15)); print('OK')"</automated>
  </verify>
  <done>
    - `prior_window_same_length` and `same_window_prior_year` exist and produce the spec outputs.
    - `compute_hr_kpis` accepts `(db, first, last)`.
    - `_fluctuation` denominator is avg-active-headcount-across-range (grep: `def _fluctuation` shows no call to `_headcount_at_eom`).
    - Module docstring updated — grep `hr_kpi_aggregation.py` does NOT match "three calendar month windows".
    - `grep -n 'compute_hr_kpis' backend/app/services/hr_kpi_aggregation.py` shows new 3-arg signature.
  </done>
  <acceptance_criteria>
    - `grep -n "def prior_window_same_length" backend/app/services/hr_kpi_aggregation.py` returns a match.
    - `grep -n "def same_window_prior_year" backend/app/services/hr_kpi_aggregation.py` returns a match.
    - `grep -nE "async def compute_hr_kpis\\(db: AsyncSession, first: date, last: date\\)" backend/app/services/hr_kpi_aggregation.py` returns a match.
    - `grep -c "_headcount_at_eom" backend/app/services/hr_kpi_aggregation.py` equals exactly 1 (definition site) — i.e. `_fluctuation` no longer calls it.
    - `grep -n "three calendar month windows" backend/app/services/hr_kpi_aggregation.py` returns empty.
    - `python -m pytest backend/tests/test_kpi_aggregation.py -x` passes (existing tests must still work — any that called `compute_hr_kpis(db)` are updated in Plan 04 but for this plan the file currently tests Sales aggregation only; confirm no HR aggregation tests break).
  </acceptance_criteria>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Extend hr_kpis.py + data.py endpoints with date_from/date_to and reverse D-03 header</name>
  <files>backend/app/routers/hr_kpis.py, backend/app/routers/data.py</files>
  <read_first>
    - backend/app/routers/hr_kpis.py (whole file — 81 lines)
    - backend/app/routers/data.py (lines 1-113)
    - backend/app/services/hr_kpi_aggregation.py (as modified by Task 1)
    - .planning/phases/60-hr-date-range-filter/60-CONTEXT.md (D-01, D-06, D-07, D-11)
  </read_first>
  <action>
    1. `backend/app/routers/hr_kpis.py`:
       - Replace the module docstring (lines 1-4) with:
         ```
         """HR KPI endpoints — aggregated over arbitrary [date_from, date_to] windows.

         Phase 60 reverses the original D-03 (fixed calendar month windows only).
         Both /kpis and /kpis/history now accept date_from + date_to query params;
         when both are omitted, endpoints fall back to current-month (/kpis) or
         last-12-months (/kpis/history) for backward compatibility with the
         thisYear landing experience.
         """
         ```
       - Import additionally: `from fastapi import Query`, plus `prior_window_same_length`, `same_window_prior_year` from `app.services.hr_kpi_aggregation`.
       - `GET /kpis` new signature:
         ```python
         @router.get("/kpis", response_model=HrKpiResponse)
         async def get_hr_kpis(
             date_from: date | None = Query(None),
             date_to: date | None = Query(None),
             db: AsyncSession = Depends(get_async_db_session),
         ) -> HrKpiResponse:
             """Return all 5 HR KPIs for [date_from, date_to].

             If both params are omitted, falls back to the current calendar month
             (thisYear-landing parity). If exactly one is provided, raise 400.
             """
             if (date_from is None) != (date_to is None):
                 raise HTTPException(status_code=400, detail="date_from and date_to must be provided together")
             if date_from is None:
                 today = date.today()
                 date_from, date_to = _month_bounds(today.year, today.month)
             if date_from > date_to:
                 raise HTTPException(status_code=400, detail="date_from must be <= date_to")
             return await compute_hr_kpis(db, date_from, date_to)
         ```
         Add `HTTPException` to the fastapi import line.
       - `GET /kpis/history` — new contract per D-06 bucketing:
         ```python
         @router.get("/kpis/history", response_model=list[HrKpiHistoryPoint])
         async def get_hr_kpi_history(
             date_from: date | None = Query(None),
             date_to: date | None = Query(None),
             db: AsyncSession = Depends(get_async_db_session),
         ) -> list[HrKpiHistoryPoint]:
             """Return per-bucket HR KPIs across [date_from, date_to].

             Bucketing (D-06):
               length_days <= 31  -> daily   (label "YYYY-MM-DD")
               length_days <= 91  -> weekly  (label "YYYY-Www", ISO week)
               length_days <= 731 -> monthly (label "YYYY-MM")
               else               -> quarterly (label "YYYY-Qn")

             Omitted params fall back to last-12-months monthly (D-07 thisYear parity).
             """
         ```
         Implement the bucket loop as a helper `_bucket_windows(first, last) -> list[tuple[str, date, date]]` returning `[(label, bucket_first, bucket_last), ...]` where bucket edges are clipped to the range. Use ISO `date.isocalendar()` for weekly (`{iso_year}-W{iso_week:02d}`), month arithmetic for monthly, and quarter math (`Q{(month-1)//3 + 1}`) for quarterly. For each bucket reuse the existing `_overtime_ratio`, `_sick_leave_ratio`, `_fluctuation`, `_revenue_per_production_employee` helpers (all already take `(first, last)`). Return list ordered oldest-first. Skill development is NOT included in history points (schema already excludes it).
       - Keep same error handling as `/kpis` (400 on mismatched/inverted bounds).
    2. `backend/app/routers/data.py` — modify `list_employees` (lines 47-112):
       - Add params `date_from: date | None = Query(None)`, `date_to: date | None = Query(None)` alongside the existing filters. Add the same pair-or-neither + inverted-range 400 validation.
       - Replace the hard-coded `today = date.today(); first_day = ...; last_day = ...` block (lines 71-73) with:
         ```python
         if (date_from is None) != (date_to is None):
             raise HTTPException(status_code=400, detail="date_from and date_to must be provided together")
         if date_from is None:
             today = date.today()
             first_day = date(today.year, today.month, 1)
             last_day = date(today.year, today.month, monthrange(today.year, today.month)[1])
         else:
             if date_from > date_to:
                 raise HTTPException(status_code=400, detail="date_from must be <= date_to")
             first_day, last_day = date_from, date_to
         ```
         Add `HTTPException` to the fastapi import.
       - Leave the rest of the attendance aggregation block (lines 75-111) unchanged — it already uses `first_day`/`last_day`. D-13 (per-employee `overtime_ratio` guard `ot > 0 and total > 0`) is preserved verbatim (current line 111).
       - D-12: roster query (lines 54-65) is NOT filtered by attendance presence — no change needed.
  </action>
  <verify>
    <automated>cd backend &amp;&amp; python -c "from app.routers.hr_kpis import router as r1; from app.routers.data import router as r2; paths = [(route.path, sorted([p.name for p in route.dependant.query_params])) for route in r1.routes if hasattr(route, 'dependant')]; print(paths)"</automated>
  </verify>
  <done>
    - `/api/hr/kpis` and `/api/hr/kpis/history` both expose `date_from` and `date_to` query params.
    - `/api/data/employees` exposes `date_from` and `date_to`.
    - Omitting both params preserves pre-Phase-60 behaviour end-to-end (manual curl check in Plan 04).
    - Module docstring in `hr_kpis.py` no longer claims "no date parameters".
    - Inverted or half-provided ranges return HTTP 400.
  </done>
  <acceptance_criteria>
    - `grep -nE "date_from: date \\| None = Query\\(None\\)" backend/app/routers/hr_kpis.py` returns at least 2 matches (kpis + history).
    - `grep -n "date_from" backend/app/routers/data.py` returns at least 1 match inside `list_employees`.
    - `grep -n "No date parameters\\|D-03\\|fixed calendar month windows" backend/app/routers/hr_kpis.py` returns empty (old D-03 claim removed).
    - `grep -nE "Phase 60 reverses" backend/app/routers/hr_kpis.py` returns a match.
    - `grep -nE "_bucket_windows|bucket_windows" backend/app/routers/hr_kpis.py` returns a match.
    - `python -c "from app.routers import hr_kpis; print('ok')"` imports cleanly.
    - `python -m pytest backend/tests/ -x -k "not signage and not sensor"` passes (no HR tests regress; new ones land in Plan 04).
  </acceptance_criteria>
</task>

</tasks>

<verification>
Run backend import smoke test plus existing non-signage non-sensor test subset. Manual curl (from Plan 04 QA) confirms bucket shapes. No migration needed — schema is unchanged.
</verification>

<success_criteria>
- HR KPI endpoints, history endpoint, and employees endpoint all accept optional `date_from`/`date_to`.
- Backend aggregation helpers unchanged in public surface except `compute_hr_kpis` which now takes `(db, first, last)`; new `prior_window_same_length` helper exists.
- `_fluctuation` uses avg-active-headcount across the range (D-03).
- Header comment on `hr_kpis.py` no longer carries the pre-Phase-60 "fixed calendar month" claim.
- Omitting params reproduces pre-Phase-60 behaviour so `thisYear` default landing is visually equivalent.
</success_criteria>

<output>
After completion, create `.planning/phases/60-hr-date-range-filter/60-01-SUMMARY.md` documenting: new query-param contracts, bucket-label shapes, prior-window helper semantics, and any deviations from CONTEXT discretion (e.g. leap-year shift choice).
</output>
