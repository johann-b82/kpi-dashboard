---
phase: 15-hr-kpi-cards-dashboard
verified: 2026-04-12T15:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 15: HR KPI Cards Dashboard — Verification Report

**Phase Goal:** The HR tab displays all 5 KPI cards with delta badges and handles error and edge cases correctly
**Verified:** 2026-04-12T15:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | GET /api/hr/kpis returns a JSON response with all 5 KPI values for the current calendar month | VERIFIED | `hr_kpis.py` registers `@router.get("/kpis", response_model=HrKpiResponse)`, calls `compute_hr_kpis(db)` which computes current month via `_month_bounds(today.year, today.month)` |
| 2  | Each KPI includes previous_period (prev month) and previous_year (same month last year) values | VERIFIED | `HrKpiValue` schema has `previous_period: float | None` and `previous_year: float | None`; `compute_hr_kpis` computes all three windows and populates both fields for all 5 KPIs |
| 3  | KPIs requiring unconfigured settings return is_configured=false and value=null | VERIFIED | `compute_hr_kpis` checks `sick_type_id`, `skill_key`, `prod_dept` against None; missing settings yield `HrKpiValue(value=None, is_configured=False)` for sick_leave_ratio, skill_development, revenue_per_production_employee |
| 4  | When no Personio data exists, all KPI values are null with is_configured=true | VERIFIED | All individual KPI functions return `None` when DB queries return empty result sets; `HrKpiValue` defaults `is_configured=True`, so null value + is_configured=True is the no-data path |
| 5  | Revenue per Production Employee cross-joins SalesRecord and PersonioEmployee data | VERIFIED | `_revenue_per_production_employee` calls `aggregate_kpi_summary(session, first_day, last_day)` for revenue and `_headcount_at_eom(session, last_day, department=production_dept)` for headcount |
| 6  | Endpoint returns 200 even when individual KPIs have no data (null values, not errors) | VERIFIED | Individual KPI functions return `None` (not exceptions); `compute_hr_kpis` builds `HrKpiResponse` with null-valued fields; FastAPI serializes to 200 response |
| 7  | HR tab shows 5 KPI cards in a 3+2 grid layout | VERIFIED | `HrKpiCardGrid.tsx`: top row `grid grid-cols-1 lg:grid-cols-3 gap-8` with 3 cards (Overtime, Sick Leave, Fluctuation); bottom row same grid class with 2 cards (Skill Dev, Revenue/Emp) |
| 8  | Each KPI card displays a formatted value with dual delta badges (vs. Vormonat + vs. Vorjahr) | VERIFIED | `renderCard` renders `DeltaBadgeStack` with `prevPeriodLabel={t("hr.kpi.delta.prevMonth")}` and `prevYearLabel={t("hr.kpi.delta.prevYear")}`; `computeDelta` computes deltas from `previous_period`/`previous_year` |
| 9  | Cards for unconfigured settings show 'nicht konfiguriert' with a link to Settings | VERIFIED | `renderCard` branch on `!kpi.is_configured` renders `{t("hr.kpi.notConfigured")}` text with `<Link href="/settings">` |
| 10 | When no data is synced, a banner appears above the grid and all cards show em-dash values | VERIFIED | `noSyncYet` detection (all 5 KPIs: `value === null && is_configured`) triggers `<div className="rounded-md border border-border bg-muted/40 ...">` banner; cards render `"\u2014"` (em-dash) |
| 11 | When the endpoint errors, an error banner appears above the grid with em-dash values in all cards | VERIFIED | `isError` shows `<div className="rounded-md border border-destructive bg-destructive/10 ...">` banner; `kpiData = isError ? undefined : data` forces all `renderCard` calls to render em-dash |
| 12 | All UI strings are available in both DE and EN locale files | VERIFIED | 14 `hr.kpi.*` keys present in both `en.json` and `de.json` with full key parity |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Lines | Status | Details |
|----------|----------|-------|--------|---------|
| `backend/app/services/hr_kpi_aggregation.py` | All 5 KPI functions + helpers + orchestrator | 383 | VERIFIED | min_lines=120 satisfied; all 8 functions present |
| `backend/app/routers/hr_kpis.py` | GET /api/hr/kpis endpoint | 28 | VERIFIED | `router = APIRouter(prefix="/api/hr")`; `@router.get("/kpis")` |
| `backend/app/schemas.py` | HrKpiValue and HrKpiResponse Pydantic models | — | VERIFIED | `class HrKpiValue` at line 215, `class HrKpiResponse` at line 229 |
| `frontend/src/components/dashboard/HrKpiCardGrid.tsx` | Complete HR KPI card grid | 172 | VERIFIED | min_lines=80 satisfied; all 5 cards, 3 banners, state handling |
| `frontend/src/lib/api.ts` | fetchHrKpis() + TypeScript interfaces | — | VERIFIED | `HrKpiValue`, `HrKpiResponse`, `fetchHrKpis` at lines 337-356 |
| `frontend/src/lib/queryKeys.ts` | hrKpiKeys factory | — | VERIFIED | `export const hrKpiKeys = { all: () => ["hr", "kpis"] as const }` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/app/routers/hr_kpis.py` | `backend/app/services/hr_kpi_aggregation.py` | `compute_hr_kpis(db)` call | WIRED | Line 27: `return await compute_hr_kpis(db)` |
| `backend/app/main.py` | `backend/app/routers/hr_kpis.py` | `app.include_router` | WIRED | Line 9: import; line 18: `app.include_router(hr_kpis_router)` |
| `backend/app/services/hr_kpi_aggregation.py` | `backend/app/models.py` | SQLAlchemy queries | WIRED | Imports `PersonioEmployee`, `PersonioAttendance`, `PersonioAbsence`, `SalesRecord` (via `aggregate_kpi_summary`); all used in DB queries |
| `frontend/src/components/dashboard/HrKpiCardGrid.tsx` | `frontend/src/lib/api.ts` | `fetchHrKpis` import | WIRED | Line 14: `import { fetchHrKpis, type HrKpiValue } from "@/lib/api"` |
| `frontend/src/components/dashboard/HrKpiCardGrid.tsx` | `frontend/src/lib/queryKeys.ts` | `hrKpiKeys` import | WIRED | Line 15: `import { hrKpiKeys } from "@/lib/queryKeys"`; used in `useQuery({ queryKey: hrKpiKeys.all() })` |
| `frontend/src/pages/HRPage.tsx` | `frontend/src/components/dashboard/HrKpiCardGrid.tsx` | `<HrKpiCardGrid />` | WIRED | Line 8: import; line 95: `<HrKpiCardGrid />` replacing placeholder |
| `frontend/src/components/dashboard/HrKpiCardGrid.tsx` | `/api/hr/kpis` | `useQuery` calling `fetchHrKpis` | WIRED | `useQuery({ queryKey: hrKpiKeys.all(), queryFn: fetchHrKpis })` at line 22; `fetchHrKpis` calls `fetch("/api/hr/kpis")` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `HrKpiCardGrid.tsx` | `data` from `useQuery` | `fetchHrKpis()` → `fetch("/api/hr/kpis")` → `compute_hr_kpis` | SQLAlchemy async queries on `PersonioAttendance`, `PersonioAbsence`, `PersonioEmployee`, `SalesRecord` | FLOWING |
| `compute_hr_kpis` | `ot_cur`, `sl_cur`, etc. | `_overtime_ratio`, `_sick_leave_ratio`, `_fluctuation`, `_skill_development`, `_revenue_per_production_employee` | All functions execute `session.execute(stmt)` with `select(...)` DB queries; `None` returned only when result sets are empty | FLOWING |
| `HrKpiCardGrid.tsx` | `kpiData` (error guard) | `isError ? undefined : data` | When API fails, `undefined` propagates to `renderCard` calls producing em-dash; when API succeeds, real `HrKpiResponse` data flows | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| Backend Python files parse correctly | `python3 -c "ast.parse(...)"` on `hr_kpi_aggregation.py`, `hr_kpis.py`, `schemas.py` | All 3: AST OK | PASS |
| TypeScript compiles without errors | `npx tsc --noEmit` | Exit 0, no output | PASS |
| No asyncio.gather in aggregation service | grep for `asyncio.gather` in `hr_kpi_aggregation.py` | No matches (only docstring references) | PASS |
| Absence overlap filter present | grep for `start_date <= last_day` and `end_date >= first_day` | Lines 165-166: both conditions present | PASS |
| Locale key parity | count `hr.kpi.*` keys in `en.json` vs `de.json` | 14 in each | PASS |
| Placeholder removed from HRPage | grep for `hr.placeholder` in `HRPage.tsx` | No matches | PASS |
| hrKpiKeys invalidated on sync success | grep for `hrKpiKeys.all()` in `HRPage.tsx` onSuccess | Line 26: `queryClient.invalidateQueries({ queryKey: hrKpiKeys.all() })` | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| HRKPI-01 | 15-01, 15-02 | Overtime Ratio KPI card with delta badges | SATISFIED | `_overtime_ratio` computes value; `HrKpiValue` carries prev_period + prev_year; `renderCard` shows `DeltaBadgeStack` |
| HRKPI-02 | 15-01, 15-02 | Sick Leave Ratio KPI card with delta badges | SATISFIED | `_sick_leave_ratio` with overlap logic and configurable `sick_leave_type_id`; unconfigured path tested |
| HRKPI-03 | 15-01, 15-02 | Fluctuation KPI card with delta badges | SATISFIED | `_fluctuation` counts leavers / EOM headcount; both delta fields populated |
| HRKPI-04 | 15-01, 15-02 | Skill Development KPI card with "nicht konfiguriert" fallback | SATISFIED | `_skill_development` uses JSONB path query; `skill_key is None` → `is_configured=False`; frontend renders Settings link |
| HRKPI-05 | 15-01, 15-02 | Revenue per Production Employee with em-dash fallback if no ERP data | SATISFIED | `_revenue_per_production_employee` returns None when revenue=0 or headcount=0; frontend shows em-dash |
| HRKPI-06 | 15-02 | HR KPI cards show error state when Personio unreachable | SATISFIED | `isError` in `HrKpiCardGrid.tsx` triggers red destructive banner + all cards render em-dash via `kpiData = isError ? undefined : data` |

**Orphaned requirements check:** HRKPI-07, HRKPI-08, HRKPI-09 appear in REQUIREMENTS.md but are not assigned to Phase 15 in any plan — not orphaned, they are planned for future phases.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| None | — | — | No stubs, placeholders, TODOs, or hardcoded empty returns found in phase artifacts |

---

### Human Verification Required

#### 1. Visual layout of 3+2 grid

**Test:** Navigate to HR tab in browser
**Expected:** Top row shows 3 cards (Overtime, Sick Leave, Fluctuation); bottom row shows 2 cards left-aligned (Skill Dev, Revenue/Emp); cards display em-dash values if no Personio data synced yet
**Why human:** Visual layout cannot be verified programmatically

#### 2. Delta badge rendering with live data

**Test:** After syncing Personio data for at least 2 months, navigate to HR tab
**Expected:** Delta badges appear on each card showing percentage change vs. previous month and vs. same month last year
**Why human:** Requires real Personio data in DB

#### 3. "nicht konfiguriert" link behavior

**Test:** Leave `personio_sick_leave_type_id`, `personio_skill_attr_key`, or `personio_production_dept` unconfigured in Settings; navigate to HR tab
**Expected:** Affected cards show "nicht konfiguriert" (DE) / "not configured" (EN) with an underlined "Einstellungen öffnen" / "Open Settings" link that navigates to /settings
**Why human:** Requires specific settings state and click interaction

#### 4. Error banner on failed API call

**Test:** Stop the backend container, navigate to HR tab
**Expected:** Red destructive-bordered banner appears above the grid; all 5 cards show em-dash values
**Why human:** Requires stopping the backend service

---

### Gaps Summary

No gaps found. All 12 must-have truths are verified. All artifacts exist, are substantive (above minimum line thresholds), are wired to their callers, and carry real data-flow paths to the database. TypeScript compiles clean. All 6 requirement IDs (HRKPI-01 through HRKPI-06) are satisfied.

---

_Verified: 2026-04-12T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
