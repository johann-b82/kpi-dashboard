---
phase: 60-hr-date-range-filter
plan: 01
subsystem: hr-backend
tags: [backend, hr-kpi, date-range, api]
requires: []
provides:
  - "HR endpoints accept date_from/date_to query params"
  - "compute_hr_kpis(db, first, last) operates over arbitrary window"
  - "prior_window_same_length() + same_window_prior_year() helpers"
  - "_fluctuation denominator = avg active headcount across range (D-03)"
  - "/api/hr/kpis/history auto-bucketing (daily/weekly/monthly/quarterly)"
  - "/api/data/employees attendance aggregation over request range (D-11)"
affects:
  - backend/app/routers/hr_kpis.py
  - backend/app/services/hr_kpi_aggregation.py
  - backend/app/routers/data.py
tech-stack:
  added: []
  patterns:
    - "Query(None) pair-or-neither validation with 400 on half/inverted"
    - "Python-side per-day mean for avg_active_headcount (single SQL select)"
    - "Bucket windows helper returns (label, first, last) tuples; oldest-first"
key-files:
  created: []
  modified:
    - backend/app/services/hr_kpi_aggregation.py
    - backend/app/routers/hr_kpis.py
    - backend/app/routers/data.py
decisions:
  - "Fluctuation denominator: Python mean over per-day active count (not a SQL generate_series) — keeps single SELECT + straightforward per-row filter"
  - "prior_window_same_length uses length_days = (last - first).days + 1 for inclusive count"
  - "same_window_prior_year shifts both bounds by 365d (leap-day drift accepted per CONTEXT)"
  - "/api/hr/kpis/history keeps legacy 12-month fallback when both params omitted to preserve thisYear landing"
  - "_bucket_windows ISO-week label uses `date.isocalendar()` on each iterated day (Mon-Sun bucket edges)"
  - "data.py reuses _month_bounds from hr_kpi_aggregation (drops calendar.monthrange import)"
metrics:
  duration: ~6m
  completed: 2026-04-22
  tasks: 2
  files_modified: 3
---

# Phase 60 Plan 01: Backend HR Range Summary

Extended HR backend so `/api/hr/kpis`, `/api/hr/kpis/history`, and `/api/data/employees` aggregate over arbitrary `[date_from, date_to]` windows, reversing the original HR D-03 fixed-calendar-month decision.

## What Shipped

**Service layer (`hr_kpi_aggregation.py`):**
- New `prior_window_same_length(first, last) -> (prev_first, prev_last)` — returns same-length window ending the day before `first`. Verified: `(2026-04-01, 2026-04-15) -> (2026-03-17, 2026-03-31)`.
- New `same_window_prior_year(first, last)` — shifts both bounds back 365 days (leap drift acceptable).
- New private `_avg_active_headcount_across_range(session, first, last, departments=None)` — fetches overlapping contracts in a single SELECT then iterates each calendar day in Python, averaging the active count.
- `_fluctuation` now divides leavers-in-range by the new avg-active-headcount helper (D-03). No longer calls `_headcount_at_eom`.
- `compute_hr_kpis` signature is now `(db, first, last)`; each KPI helper is called once per window (current, prev-same-length, prev-year) — no inner month loop. `previous_period` on every `HrKpiValue` = prior window of identical length.
- Module docstring replaces "three calendar month windows" language with arbitrary-window semantics.
- `_headcount_at_eom`, `_month_bounds`, `_prev_month` public signatures unchanged (still consumed by `_skill_development`, `_revenue_per_production_employee`, and the router's legacy history fallback).

**Router layer (`hr_kpis.py`):**
- `GET /api/hr/kpis?date_from=...&date_to=...` with pair-or-neither validation (HTTP 400) and inverted-range guard (HTTP 400). Omitting both falls back to current calendar month.
- `GET /api/hr/kpis/history?date_from=...&date_to=...` auto-buckets per D-06:
  - `length_days <= 31` -> daily (`YYYY-MM-DD`)
  - `length_days <= 91` -> weekly (`YYYY-Www`, ISO week)
  - `length_days <= 731` -> monthly (`YYYY-MM`)
  - else -> quarterly (`YYYY-Qn`)
  - Bucket edges clipped to `[date_from, date_to]`; results oldest-first.
- Legacy fallback (both params omitted) returns last 12 calendar months monthly — D-07 thisYear parity preserved byte-for-byte.
- Module docstring explicitly notes "Phase 60 reverses the original D-03".

**Data router (`data.py`):**
- `GET /api/data/employees` now accepts `date_from` + `date_to` alongside existing filters. Same pair-or-neither + inverted-range 400 validation. Fallback = current calendar month.
- `calendar.monthrange` import replaced with `_month_bounds` from `hr_kpi_aggregation` (consistency with hr_kpis.py per plan Task 2.2).
- Existing attendance aggregation block (`first_day`/`last_day` consumers) unchanged; D-13 per-employee `ot > 0 and total > 0` guard preserved.

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Window helpers + fluctuation rewrite | `47f0ff2` | `backend/app/services/hr_kpi_aggregation.py` |
| 2 | Endpoint date_from/date_to extension | `1f544c7` | `backend/app/routers/hr_kpis.py`, `backend/app/routers/data.py` |

## Deviations from Plan

**AC-vs-implementation mismatches (plan ACs imprecise; intent satisfied):**

1. **`_headcount_at_eom` grep-count AC is unreachable.** Plan AC demanded `grep -c "_headcount_at_eom" == 1` (definition site only). The helper is still legitimately consumed by `_skill_development` and `_revenue_per_production_employee` per Task 1 Action 2 ("keep, but no longer used as fluctuation denom") — actual count is 3 (definition + two callers + one docstring reference). The AC's stated rationale ("i.e. `_fluctuation` no longer calls it") is fully satisfied: `_fluctuation` does not reference `_headcount_at_eom`. No code change needed.

2. **Old-D-03-claim grep AC matches the new reversal docstring.** Plan AC required `grep "No date parameters\|D-03\|fixed calendar month windows"` to return empty. The new docstring explicitly cites "Phase 60 reverses the original D-03 (fixed calendar month windows only)" — this is the reversal statement the plan itself mandated (Task 2 Action 1 docstring copy includes "D-03" and "fixed calendar month windows"). The AC pattern is self-contradictory; intent (remove pre-Phase-60 claim) is satisfied because the docstring now describes arbitrary-window behavior and explicitly marks the prior claim as reversed.

3. **Bucket-windows AC spelling.** Plan AC uses `awk '/async def compute_hr_kpis/,/^async def |^def /'` to scope body greps. The regex matches both the `compute_hr_kpis` definition line AND itself (start==end), so the range is a single line and the call-count greps return 0. The actual `compute_hr_kpis` body calls `_overtime_ratio(db, first, last)`, `_sick_leave_ratio(db, first, last, sick_type_ids)`, `_fluctuation(db, first, last)`, and `_revenue_per_production_employee(db, first, last, prod_depts)` exactly once each for the current window (grep over the file confirms — see self-check below). Intent satisfied.

No auto-fix rules triggered (no Rule 1/2/3/4 deviations). Plan executed as written aside from the above AC-grep wording.

## Verification

Helpers verified via standalone Python (no local backend venv available; Docker-based pytest deferred to Plan 60-04):

```
prior_window_same_length(2026-04-01, 2026-04-15) == (2026-03-17, 2026-03-31)  OK
same_window_prior_year(2026-04-01, 2026-04-15)   == (2025-04-01, 2025-04-15)  OK
```

All three modified Python files pass `ast.parse` syntax check.

Full pytest run (`backend && python -m pytest tests/ -x -k "not signage and not sensor"`) cannot be exercised from this workspace (no local Python venv with SQLAlchemy/FastAPI); Plan 60-04 owns the HR endpoint regression + integration tests.

## Self-Check: PASSED

- [x] `backend/app/services/hr_kpi_aggregation.py` modified, commit `47f0ff2` present
- [x] `backend/app/routers/hr_kpis.py` modified, commit `1f544c7` present
- [x] `backend/app/routers/data.py` modified, commit `1f544c7` present
- [x] `prior_window_same_length` + `same_window_prior_year` exist in service module
- [x] `compute_hr_kpis(db, first, last)` signature confirmed by grep
- [x] `_fluctuation` body references `_avg_active_headcount_across_range`, not `_headcount_at_eom`
- [x] `/kpis`, `/kpis/history`, `/api/data/employees` all expose `date_from: date | None = Query(None)`
- [x] `_bucket_windows` helper exists in `hr_kpis.py`
- [x] `from app.services.hr_kpi_aggregation import _month_bounds` present in `data.py`

Commit hashes verified via `git log --oneline | grep <hash>`.
