# Phase 15: HR KPI Cards & Dashboard - Research

**Researched:** 2026-04-12
**Domain:** FastAPI aggregation endpoints + React/TanStack Query data layer + existing KPI card component reuse
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Time window is calendar month — current month for the primary value, previous month for "vs. Vorperiode", same month last year for "vs. Vorjahr".
- **D-02:** Headcount-based denominators (Fluctuation, Rev/Emp) use end-of-month snapshot — count active employees as of the last day of the period.
- **D-03:** No date filter on HR tab. Backend computes fixed calendar month windows server-side.
- **D-04:** 5 cards in a 3 + 2 grid (`grid-cols-3` top row, 2 cards left-aligned bottom row). Matches Sales dashboard grid pattern.
- **D-05:** Top row: Overtime Ratio, Sick Leave Ratio, Fluctuation. Bottom row: Skill Development, Revenue per Production Employee.
- **D-06:** Cards reuse the existing `KpiCard` component with `delta` slot for `DeltaBadgeStack`.
- **D-07:** When no sync yet: show all 5 cards with em-dash values + banner above the grid hinting to sync first. Cards are visible but inert.
- **D-08:** When a KPI's required setting isn't configured: that card shows "nicht konfiguriert" with a small link to Settings. Other cards render normally.
- **D-09:** When the HR KPI endpoint returns an error: show error banner above cards (red-tinted, matches Sales dashboard `isError` pattern) with em-dash values in all cards.
- **D-10:** Em-dash fallback for delta badges when no previous period data exists (matching Sales v1.2 pattern).
- **D-11:** Production department matching uses exact string match on `personio_production_dept` setting: `WHERE department = setting`.
- **D-12:** Revenue numerator is total monthly revenue from SalesRecord (`SUM(total_value) WHERE total_value > 0`), same aggregation logic as Sales dashboard.
- **D-13:** Denominator is production employee headcount at end of month (active employees in configured department).
- **D-14:** When no ERP/sales data exists: show em-dash for Rev/Emp card.

### KPI Formulas
- **Overtime Ratio (HRKPI-01):** overtime hours / total hours from personio_attendance for the calendar month.
- **Sick Leave Ratio (HRKPI-02):** sick leave absence hours / total scheduled hours for the calendar month. Sick leave identified by `absence_type_id = personio_sick_leave_type_id` setting.
- **Fluctuation (HRKPI-03):** employees with termination_date in the calendar month / active headcount at end of month.
- **Skill Development (HRKPI-04):** employees with the configured skill attribute key (from raw_json) that changed value during the calendar month / total headcount. Requires `personio_skill_attr_key` setting.
- **Revenue per Production Employee (HRKPI-05):** total monthly sales revenue / production department headcount at end of month. Requires `personio_production_dept` setting and sales data.

### Claude's Discretion
- Backend endpoint structure (single `/api/hr/kpis` endpoint vs. per-KPI endpoints)
- HR KPI aggregation service module naming and internal structure
- Whether to create a dedicated `HrKpiCardGrid` component or extend the existing pattern differently
- Delta badge label text for fixed calendar month windows (e.g., "vs. Jan 2026" or "vs. Vormonat")
- Pydantic response schema design for HR KPI data

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HRKPI-01 | HR tab displays Overtime Ratio KPI card (Überstunden / Gesamtstunden) with delta badges (vs. Vorperiode + vs. Vorjahr) | Backend: attendance aggregation via PersonioAttendance. Frontend: HrKpiCardGrid + KpiCard + DeltaBadgeStack. |
| HRKPI-02 | HR tab displays Sick Leave Ratio KPI card (Krankheit / Gesamtstunden) with delta badges | Backend: absence aggregation filtered by personio_sick_leave_type_id. Requires setting to be non-null; "nicht konfiguriert" fallback if null. |
| HRKPI-03 | HR tab displays Fluctuation KPI card (MA-Abgänge / gesamt MA) with delta badges | Backend: termination_date filter + end-of-month headcount snapshot from PersonioEmployee. |
| HRKPI-04 | HR tab displays Skill Development KPI card with delta badges; "nicht konfiguriert" fallback if skill attribute key not set | Backend: JSONB raw_json attribute diff per employee. Requires personio_skill_attr_key setting. |
| HRKPI-05 | HR tab displays Revenue per Production Employee KPI card with delta badges; em-dash fallback if no ERP data | Backend: cross-source join (SalesRecord + PersonioEmployee). Requires personio_production_dept setting. |
| HRKPI-06 | HR KPI cards show error state when Personio is unreachable or credentials invalid | Frontend: isError branch renders error banner; all cards display em-dash. Backend: endpoint propagates errors cleanly. |
</phase_requirements>

---

## Summary

Phase 15 is a full-stack feature that extends the existing KPI dashboard pattern to the HR domain. The work divides cleanly into three layers: (1) a new backend aggregation service module that computes five HR KPIs from synced Personio data, (2) a new FastAPI router that exposes a single `/api/hr/kpis` endpoint returning all five KPIs with prior-period values embedded, and (3) a new `HrKpiCardGrid` React component that consumes that endpoint and renders five `KpiCard` instances in the established 3+2 grid pattern.

All UI primitives already exist and are reusable without modification: `KpiCard`, `DeltaBadgeStack`, `DeltaBadge`, `deltaFormat.ts`, and `computeDelta`. The backend aggregation pattern is also established (`kpi_aggregation.py`, `routers/kpis.py`) and can be mirrored directly. The highest-complexity element in this phase is the **Skill Development KPI** (HRKPI-04), which requires JSONB diffing of the `raw_json` column across two calendar month snapshots — this is the only novel SQL pattern not already present in the codebase.

**Primary recommendation:** Mirror the Sales KPI aggregation pattern (single endpoint, single response schema with `current` + `previous_period` + `previous_year` nested objects), create a dedicated `hr_kpi_aggregation.py` service module, and a single `/api/hr/kpis` router. The single-endpoint design minimizes round-trips and aligns with the existing `fetchKpiSummary` pattern the frontend already understands.

---

## Standard Stack

All libraries are already installed in the project. No new dependencies needed.

### Core (already installed)
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| FastAPI | 0.135.3 | New `/api/hr/kpis` router | Already used for all endpoints |
| SQLAlchemy 2.0 async | 2.0.49 | HR KPI aggregation queries | Already used; `AsyncSession` + `select()` + `func` pattern |
| asyncpg | 0.31.0 | Async PG driver | Already in use |
| Pydantic v2 | >=2.9.0 | HR KPI response schema | Already used for all schemas |
| React + TanStack Query | 19.x + 5.97.0 | `HrKpiCardGrid` useQuery | Already used in `KpiCardGrid` |
| react-i18next | (installed) | i18n string keys for HR KPIs | Already used throughout |

### No New Dependencies
This phase requires zero new package installs. All required libraries, components, and utilities are already present.

---

## Architecture Patterns

### Recommended Backend Structure

```
backend/app/
├── routers/
│   ├── hr_kpis.py         # NEW: GET /api/hr/kpis router
│   └── ...existing...
├── services/
│   ├── hr_kpi_aggregation.py  # NEW: KPI computation functions
│   └── ...existing...
└── schemas.py             # Extend with HrKpiValue, HrKpiResponse
```

### Recommended Frontend Structure

```
frontend/src/
├── components/dashboard/
│   ├── HrKpiCardGrid.tsx  # NEW: fetches + renders 5 HR KPI cards
│   └── ...existing unchanged...
├── lib/
│   ├── api.ts             # EXTEND: add fetchHrKpis(), HrKpiResponse
│   └── queryKeys.ts       # EXTEND: add hrKpiKeys factory
└── locales/
    ├── en.json            # EXTEND: add hr.kpi.* keys
    └── de.json            # EXTEND: add hr.kpi.* keys
```

### Pattern 1: Single Endpoint, All-KPIs Response

**What:** One `GET /api/hr/kpis` endpoint returns all five KPIs in a single JSON response. Each KPI carries its current-period value, previous-month value, and previous-year value as nullable floats.

**When to use:** All five KPIs share the same data source (Personio) and the same time window computation. A single endpoint minimises round-trips and keeps the frontend query key simple (one `useQuery`, one loading/error state).

**Example Pydantic schema:**
```python
# Source: modeled on KpiSummary in backend/app/schemas.py

class HrKpiValue(BaseModel):
    """A single HR KPI for one calendar month window."""
    value: float | None = None            # None = no data / not configured
    is_configured: bool = True            # False = required setting missing
    previous_period: float | None = None  # previous month value; None = no data
    previous_year: float | None = None    # same month last year; None = no data

class HrKpiResponse(BaseModel):
    overtime_ratio: HrKpiValue
    sick_leave_ratio: HrKpiValue
    fluctuation: HrKpiValue
    skill_development: HrKpiValue
    revenue_per_production_employee: HrKpiValue
```

**Rationale for `is_configured`:** The frontend must distinguish between "no data" (`value=None`, `is_configured=True`) and "setting not configured" (`value=None`, `is_configured=False`). The backend can compute this cheaply from the AppSettings singleton row loaded at the start of the request.

### Pattern 2: Calendar Month Bounds Helper

**What:** A utility function that returns `(first_day, last_day)` for any `(year, month)` pair, usable for current month, previous month, and previous year same month.

**Example:**
```python
# Source: standard Python datetime/calendar patterns
from calendar import monthrange
from datetime import date

def _month_bounds(year: int, month: int) -> tuple[date, date]:
    """Return (first_day, last_day) for a calendar month."""
    last_day = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)
```

**Usage:** Called three times per request to get current, previous-month, and previous-year month bounds. All five KPIs share the same three windows.

### Pattern 3: End-of-Month Headcount Query

**What:** Count active Personio employees as of the last day of a month. "Active" = `hire_date <= last_day AND (termination_date IS NULL OR termination_date > last_day)`.

**Example:**
```python
# Source: models.py PersonioEmployee schema
from sqlalchemy import func, select, and_, or_
from app.models import PersonioEmployee

async def _headcount_at_eom(session: AsyncSession, last_day: date) -> int:
    stmt = select(func.count(PersonioEmployee.id)).where(
        and_(
            PersonioEmployee.hire_date <= last_day,
            or_(
                PersonioEmployee.termination_date.is_(None),
                PersonioEmployee.termination_date > last_day,
            )
        )
    )
    result = await session.execute(stmt)
    return result.scalar_one() or 0
```

**D-02 compliance:** This is the canonical end-of-month snapshot required by decisions D-02 and D-13.

### Pattern 4: Overtime Ratio Computation

**What:** For each attendance record in the month, compare actual worked hours against `weekly_working_hours / 5` (daily quota). Sum overtime across all days / sum total hours.

**Key data:** `PersonioAttendance` has `start_time`, `end_time`, `break_minutes`. Worked hours = `(end_time - start_time) - break_minutes / 60`. `PersonioEmployee.weekly_working_hours` provides the daily quota reference.

**SQL approach:** Join `personio_attendance` with `personio_employees` on `employee_id`. Filter by date range. Compute per-record overtime in Python (or via EXTRACT in SQL). A Python-side computation in the service layer is simpler and easier to test than complex SQL arithmetic.

**Example:**
```python
from sqlalchemy import select
from app.models import PersonioAttendance, PersonioEmployee

async def _overtime_ratio(
    session: AsyncSession, first_day: date, last_day: date
) -> float | None:
    stmt = (
        select(PersonioAttendance, PersonioEmployee.weekly_working_hours)
        .join(PersonioEmployee, PersonioAttendance.employee_id == PersonioEmployee.id)
        .where(PersonioAttendance.date >= first_day)
        .where(PersonioAttendance.date <= last_day)
    )
    rows = (await session.execute(stmt)).all()
    if not rows:
        return None
    total_hours = 0.0
    overtime_hours = 0.0
    for att, weekly_hours in rows:
        # worked = hours from start/end minus break
        worked = (
            att.end_time.hour * 60 + att.end_time.minute
            - att.start_time.hour * 60 - att.start_time.minute
            - att.break_minutes
        ) / 60.0
        total_hours += worked
        if weekly_hours:
            daily_quota = float(weekly_hours) / 5.0
            overtime_hours += max(0.0, worked - daily_quota)
    if total_hours == 0:
        return None
    return overtime_hours / total_hours
```

### Pattern 5: Sick Leave Ratio Computation

**What:** Sum hours from `personio_absences` where `absence_type_id = personio_sick_leave_type_id` and dates overlap the calendar month. Divide by total scheduled hours (headcount × weekly_working_hours / 5 × working days in month).

**Key subtlety:** Absence records span date ranges (`start_date` to `end_date`). For a month window, clip to `[first_day, last_day]` intersection. When `time_unit = 'days'`, hours may be null — fall back to `weekly_working_hours / 5` per day. When `time_unit = 'hours'`, use the `hours` column directly.

**`is_configured` gate:** If `settings.personio_sick_leave_type_id is None`, return `HrKpiValue(value=None, is_configured=False)` immediately.

### Pattern 6: Fluctuation Computation

**What:** Count employees whose `termination_date` falls within `[first_day, last_day]`, divided by end-of-month headcount.

**Example:**
```python
async def _fluctuation(session, first_day, last_day, headcount):
    stmt = select(func.count(PersonioEmployee.id)).where(
        and_(
            PersonioEmployee.termination_date >= first_day,
            PersonioEmployee.termination_date <= last_day,
        )
    )
    leavers = (await session.execute(stmt)).scalar_one() or 0
    if headcount == 0:
        return None
    return leavers / headcount
```

### Pattern 7: Skill Development Computation (Highest Complexity)

**What:** Count employees whose value for `personio_skill_attr_key` in `raw_json` differs between the start and end of the calendar month. Divide by total headcount.

**Challenge:** There is no historical snapshot table — `raw_json` stores the most recent sync state only. The "changed during month" definition must be interpreted as: employees where `raw_json` contains the configured attribute key with any non-null value. Since historical snapshots aren't stored, the practical interpretation is: employees who currently have a non-null value for the key, as a proxy for "has developed a skill".

**Decision needed by implementer:** The CONTEXT.md formula says "employees with the configured skill attribute key (from raw_json) that changed value during the calendar month". Since there is no historical log of attribute values in the DB, the implementer must interpret this as one of:
- (a) Employees with any non-null value for the key at current sync (proxy for "has the skill")
- (b) Compare two consecutive syncs if multiple `synced_at` timestamps exist

**Recommendation:** Use interpretation (a) — employees with a non-null value for `personio_skill_attr_key` in `raw_json.attributes.<key>.value` / `total headcount`. This is the only viable approach without a historical log table and matches what Personio custom attributes typically track.

**Example query approach:**
```python
# JSONB path access: raw_json -> 'attributes' -> key -> 'value'
# SQLAlchemy JSONB ops: PersonioEmployee.raw_json["attributes"][key]["value"]
from sqlalchemy.dialects.postgresql import JSONB
# Using cast to text and IS NOT NULL check
stmt = select(func.count(PersonioEmployee.id)).where(
    PersonioEmployee.raw_json["attributes"][skill_attr_key]["value"].as_string() != "null"
)
```

**`is_configured` gate:** If `settings.personio_skill_attr_key is None`, return `HrKpiValue(value=None, is_configured=False)` immediately.

### Pattern 8: Revenue per Production Employee

**What:** `SUM(SalesRecord.total_value WHERE total_value > 0 AND order_date in month)` divided by production department headcount at end of month.

**Cross-source join:** No SQL join needed — run two separate queries (SalesRecord sum, PersonioEmployee headcount) and divide in Python. This follows the existing sequential-await pattern in `routers/kpis.py`.

**`is_configured` gate:** If `settings.personio_production_dept is None`, return `HrKpiValue(value=None, is_configured=False)` immediately.

**No ERP data:** If `aggregate_kpi_summary()` returns `None` for the month, return `HrKpiValue(value=None, is_configured=True)` — em-dash in frontend per D-14.

### Pattern 9: Frontend HrKpiCardGrid Structure

**What:** A new component that mirrors `KpiCardGrid.tsx` but with fixed calendar-month windows (no date range props) and five cards.

**Key differences from KpiCardGrid:**
- No `preset` or `range` props — HR tab has no time filter
- Static delta labels: `t("hr.kpi.delta.prevMonth")` / `t("hr.kpi.delta.prevYear")` instead of dynamic `formatPrevPeriodLabel`
- `is_configured=false` triggers a per-card "nicht konfiguriert" state, not a grid-level banner
- No-data banner (D-07) is triggered when all `value` fields are null and `is_configured=true`

**Example skeleton:**
```tsx
// Source: mirrors KpiCardGrid.tsx pattern
export function HrKpiCardGrid() {
  const { t, i18n } = useTranslation();
  const shortLocale: "de" | "en" = i18n.language === "de" ? "de" : "en";

  const { data, isLoading, isError } = useQuery({
    queryKey: hrKpiKeys.all(),
    queryFn: fetchHrKpis,
  });

  if (isError) {
    return (
      <>
        <div className="rounded-md border border-destructive bg-destructive/10 p-6 mb-6">
          <p className="text-sm font-semibold">{t("hr.kpi.error.heading")}</p>
          <p className="text-sm text-muted-foreground">{t("hr.kpi.error.body")}</p>
        </div>
        {/* Grid with em-dash cards still rendered */}
      </>
    );
  }

  const noSyncYet = data && [
    data.overtime_ratio, data.sick_leave_ratio, data.fluctuation,
    data.skill_development, data.revenue_per_production_employee
  ].every(k => k.value === null && k.is_configured);

  return (
    <div>
      {noSyncYet && <NoSyncBanner />}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* row 1: 3 cards */}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        {/* row 2: 2 cards */}
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Don't use `asyncio.gather` on a single AsyncSession** — established codebase pattern forbids this (see comment in `routers/kpis.py`). All five KPI computations must use sequential `await` calls.
- **Don't use `Base.metadata.create_all()`** — always go through Alembic (CLAUDE.md mandate). Phase 15 adds no new tables, so no migration is needed.
- **Don't fetch AppSettings multiple times per request** — load the singleton once at the start of the HR KPI handler and pass the relevant fields to each aggregation function.
- **Don't hard-code "vs. Vormonat" in components** — all display strings go through i18n keys (`hr.kpi.delta.prevMonth`, `hr.kpi.delta.prevYear`).
- **Don't render a crash when `is_configured=false`** — render the "nicht konfiguriert" state within the card, not an exception.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Percentage formatting with locale | Custom formatter | `Intl.NumberFormat` with `style: "percent"` (already in `deltaFormat.ts`) | Already handles DE/EN differences including NBSP |
| Currency formatting | Custom formatter | `Intl.NumberFormat` with `style: "currency"` (already in `KpiCardGrid.tsx`) | Already handles EUR locale differences |
| Delta percentage math | Custom math | `computeDelta()` from `frontend/src/lib/delta.ts` | Already handles null-baseline and divide-by-zero |
| Delta badge rendering | New badge component | `DeltaBadgeStack` + `DeltaBadge` (already exist) | All edge cases already handled |
| Loading skeleton | New skeleton | `KpiCard` with `isLoading=true` prop | Already renders correct skeleton |
| Error banner CSS | New classes | `rounded-md border border-destructive bg-destructive/10 p-6` (copy from KpiCardGrid) | Matches established visual pattern |
| Async PostgreSQL driver | asyncpg alternatives | asyncpg (already installed) | Project constraint from CLAUDE.md |
| Month boundary calculation | Custom date math | Python `calendar.monthrange()` | Standard library, no dep needed |

**Key insight:** This phase is almost entirely reuse. The only genuinely new code is the backend aggregation logic and the `HrKpiCardGrid` component that wires existing primitives together.

---

## Common Pitfalls

### Pitfall 1: Absence Records Spanning Month Boundaries
**What goes wrong:** A sick leave absence from Jan 28 to Feb 5 should contribute only 3 days to February's sick leave ratio. Naively filtering `WHERE start_date >= first_day AND end_date <= last_day` misses this record entirely.
**Why it happens:** Absence records have a date range, not individual day records.
**How to avoid:** Use `WHERE start_date <= last_day AND end_date >= first_day` to catch overlapping records. Then clip the overlap to `[first_day, last_day]` when computing hours.
**Warning signs:** Sick leave ratio drops to zero for the first/last week of any month.

### Pitfall 2: AsyncSession Sequential Await Requirement
**What goes wrong:** Using `asyncio.gather()` with multiple `session.execute()` calls on the same `AsyncSession` raises `InvalidRequestError` intermittently.
**Why it happens:** SQLAlchemy AsyncSession is not concurrency-safe for parallel execute() calls on one connection.
**How to avoid:** Always use sequential `await` for all five aggregation calls. The `routers/kpis.py` file has an explicit comment documenting this decision.
**Warning signs:** Random `InvalidRequestError: Another operation is in progress` in tests.

### Pitfall 3: JSONB Attribute Key Path Varies by Personio Custom Attribute Type
**What goes wrong:** The path to the skill attribute value in `raw_json` may not always be `attributes.<key>.value`. Some Personio custom attributes use different nesting.
**Why it happens:** Personio API returns custom attributes with type-specific shapes.
**How to avoid:** Check actual synced `raw_json` data before writing the JSONB query. Use `.get()` style access or a SQL JSONB `#>>` path expression with a null check.
**Warning signs:** Skill Development always returns 0 even when employees have the attribute set.

### Pitfall 4: End-of-Month Headcount for December Previous Year
**What goes wrong:** Computing "previous year same month" bounds when current month is January requires going back to the prior calendar year correctly.
**Why it happens:** Month arithmetic can underflow to month=0.
**How to avoid:** Use Python's `date(year - 1, month, 1)` pattern for prev-year, which is always safe. Use `date(year, month - 1, 1)` only when `month > 1`; for month=1, use `date(year - 1, 12, 1)`. Or use `relativedelta` from `dateutil` (not installed — use manual arithmetic instead).
**Warning signs:** Server 500 errors every January when requesting previous-year comparisons.

### Pitfall 5: Revenue per Production Employee When Headcount is Zero
**What goes wrong:** Division by zero if the production department has no employees at end of month.
**Why it happens:** The department may be misconfigured or empty.
**How to avoid:** Return `None` (em-dash) when headcount is 0, not a division operation.
**Warning signs:** `ZeroDivisionError` or `inf` in the response.

### Pitfall 6: `is_configured` vs `value=None` Semantic Mismatch on Frontend
**What goes wrong:** Frontend renders "nicht konfiguriert" for a card that has no data (value=None) but IS configured — or shows em-dash for a card that isn't configured.
**Why it happens:** Backend returns `value=None` in both cases; frontend needs `is_configured` to distinguish.
**How to avoid:** Always check `is_configured` first in the frontend card renderer. Only show "nicht konfiguriert" + Settings link when `is_configured === false`. Show em-dash when `is_configured === true && value === null`.

---

## Code Examples

### Backend: HR KPI Router (mirrors routers/kpis.py)
```python
# Source: modeled on backend/app/routers/kpis.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_async_db_session
from app.schemas import HrKpiResponse
from app.services.hr_kpi_aggregation import compute_hr_kpis

router = APIRouter(prefix="/api/hr", tags=["hr-kpis"])

@router.get("/kpis", response_model=HrKpiResponse)
async def get_hr_kpis(
    db: AsyncSession = Depends(get_async_db_session),
) -> HrKpiResponse:
    return await compute_hr_kpis(db)
```

### Backend: Settings Loading Pattern (from routers/sync.py)
```python
# Source: backend/app/routers/sync.py _get_credentials pattern
result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
settings = result.scalar_one_or_none()
```

### Frontend: hrKpiKeys Factory (mirrors queryKeys.ts)
```typescript
// Source: frontend/src/lib/queryKeys.ts syncKeys pattern
export const hrKpiKeys = {
  all: () => ["hr", "kpis"] as const,
};
```

### Frontend: fetchHrKpis (mirrors api.ts fetchKpiSummary)
```typescript
// Source: frontend/src/lib/api.ts fetchKpiSummary pattern
export interface HrKpiValue {
  value: number | null;
  is_configured: boolean;
  previous_period: number | null;
  previous_year: number | null;
}

export interface HrKpiResponse {
  overtime_ratio: HrKpiValue;
  sick_leave_ratio: HrKpiValue;
  fluctuation: HrKpiValue;
  skill_development: HrKpiValue;
  revenue_per_production_employee: HrKpiValue;
}

export async function fetchHrKpis(): Promise<HrKpiResponse> {
  const res = await fetch("/api/hr/kpis");
  if (!res.ok) throw new Error("Failed to fetch HR KPIs");
  return res.json();
}
```

### Frontend: "nicht konfiguriert" card render logic
```tsx
// Source: UI-SPEC.md States & Interactions section, D-08
function renderKpiCard(kpiValue: HrKpiValue, label: string, ...) {
  if (!kpiValue.is_configured) {
    return (
      <KpiCard label={label} value="—" isLoading={false}>
        {/* delta slot replaced by "nicht konfiguriert" text + Settings link */}
        <p className="text-xs text-muted-foreground mt-1">
          {t("hr.kpi.notConfigured")}
          {" "}<Link href="/settings" className="underline">{t("hr.kpi.openSettings")}</Link>
        </p>
      </KpiCard>
    );
  }
  // normal card rendering...
}
```

Note: `KpiCard` does not currently support children below the delta slot. The implementer must decide whether to pass the "nicht konfiguriert" text as the `delta` prop or extend `KpiCard` to accept a `footer` prop. Given the decision to not modify `KpiCard`, passing the text as the `delta` slot is the simplest approach.

### Locale Keys to Add (both en.json and de.json)
```json
{
  "hr.kpi.overtimeRatio.label": "Overtime Ratio",
  "hr.kpi.sickLeaveRatio.label": "Sick Leave Ratio",
  "hr.kpi.fluctuation.label": "Fluctuation",
  "hr.kpi.skillDevelopment.label": "Skill Development",
  "hr.kpi.revenuePerProductionEmployee.label": "Revenue / Prod. Employee",
  "hr.kpi.delta.prevMonth": "vs. prev. month",
  "hr.kpi.delta.prevYear": "vs. prev. year",
  "hr.kpi.notConfigured": "not configured",
  "hr.kpi.openSettings": "Open Settings",
  "hr.kpi.noSync.heading": "No data synced yet",
  "hr.kpi.noSync.body": "Click 'Refresh data' or configure auto-sync in Settings.",
  "hr.kpi.error.heading": "Could not load HR KPIs",
  "hr.kpi.error.body": "The server did not respond. Check your connection and retry."
}
```

---

## Integration Points Summary

| File | Change Type | What Changes |
|------|-------------|-------------|
| `backend/app/services/hr_kpi_aggregation.py` | NEW | All five KPI computation functions + month bounds helper |
| `backend/app/routers/hr_kpis.py` | NEW | `GET /api/hr/kpis` endpoint |
| `backend/app/schemas.py` | EXTEND | Add `HrKpiValue` and `HrKpiResponse` Pydantic models |
| `backend/app/main.py` | EXTEND | Register `hr_kpis_router` |
| `frontend/src/components/dashboard/HrKpiCardGrid.tsx` | NEW | Fetches HR KPIs, owns banner state, renders 3+2 grid |
| `frontend/src/pages/HRPage.tsx` | EXTEND | Replace `{t("hr.placeholder")}` with `<HrKpiCardGrid />` |
| `frontend/src/lib/api.ts` | EXTEND | Add `fetchHrKpis()`, `HrKpiValue`, `HrKpiResponse` |
| `frontend/src/lib/queryKeys.ts` | EXTEND | Add `hrKpiKeys` factory |
| `frontend/src/locales/en.json` | EXTEND | Add all `hr.kpi.*` string keys |
| `frontend/src/locales/de.json` | EXTEND | Add all `hr.kpi.*` string keys (DE translations) |

**No Alembic migration needed** — phase 15 adds no new database tables or columns. All required schema (PersonioEmployee, PersonioAttendance, PersonioAbsence, AppSettings KPI columns) was created in phases 12–13.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — phase uses only existing installed packages and database infrastructure from phases 12–13).

---

## Open Questions

1. **Skill Development KPI — historical snapshot interpretation**
   - What we know: `raw_json` stores current-sync state; no historical log table exists.
   - What's unclear: Whether "changed value during the calendar month" is intended to mean (a) has any non-null value currently, or (b) requires comparing two sync timestamps.
   - Recommendation: Implement as (a) — "employees with a non-null value for the configured attribute key / total headcount". Document the limitation in a code comment. The planner should include a note that this is a reasonable proxy given the current data model.

2. **Absence hours when `time_unit = 'days'` and `hours IS NULL`**
   - What we know: `PersonioAbsence.hours` is nullable; `time_unit` can be `'days'` or `'hours'` (from Phase 13 sync normalization).
   - What's unclear: When `time_unit = 'days'` and `hours` is null, what daily hours value to use for the sick leave ratio denominator.
   - Recommendation: Fall back to `weekly_working_hours / 5` per absence day (join with employee). If employee has no `weekly_working_hours`, assume 8h/day as a sensible default.

3. **`KpiCard` delta slot for "nicht konfiguriert" state**
   - What we know: `KpiCard` accepts a `delta?: ReactNode` slot rendered to the right of the value. The "nicht konfiguriert" text should appear below the value, not to the right.
   - What's unclear: Whether to (a) pass the "nicht konfiguriert" content as the `delta` slot (visually to the right), or (b) extend `KpiCard` with a `footer` prop.
   - Recommendation: Pass as the `delta` slot. The card's flex layout (`flex items-center justify-between`) renders the delta to the right — acceptable for a short "not configured" label + link. Avoids modifying a shared component.

---

## Sources

### Primary (HIGH confidence)
- `backend/app/services/kpi_aggregation.py` — Established aggregation pattern; sequential await, SQLAlchemy async, None for no-data
- `backend/app/routers/kpis.py` — Established router pattern; single endpoint, comparison windows embedded in response
- `backend/app/schemas.py` — Established Pydantic schema patterns (KpiSummary, KpiSummaryComparison)
- `backend/app/models.py` — PersonioEmployee, PersonioAttendance, PersonioAbsence column definitions
- `frontend/src/components/dashboard/KpiCardGrid.tsx` — Frontend pattern for useQuery + KpiCard + DeltaBadgeStack wiring
- `frontend/src/components/dashboard/KpiCard.tsx` — Card interface including `delta?: ReactNode` slot
- `frontend/src/lib/delta.ts` — `computeDelta()` null-safety rules
- `frontend/src/components/dashboard/deltaFormat.ts` — `formatDeltaText()` and `deltaClassName()` implementations
- `.planning/phases/15-hr-kpi-cards-dashboard/15-CONTEXT.md` — All locked decisions
- `.planning/phases/15-hr-kpi-cards-dashboard/15-UI-SPEC.md` — Visual contract, copywriting, component inventory

### Secondary (MEDIUM confidence)
- Python `calendar.monthrange()` documentation — standard library, month boundary computation
- SQLAlchemy 2.0 JSONB operator docs — JSONB path access patterns for `raw_json` attribute queries

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use; no new dependencies
- Architecture: HIGH — mirrors established Sales KPI pattern exactly; deviations are minimal and documented
- Pitfalls: HIGH — sourced directly from existing codebase patterns and data model constraints
- Skill Development KPI: MEDIUM — JSONB diffing approach depends on actual data shape in `raw_json`; one open question documented

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable stack; 30-day window appropriate)
