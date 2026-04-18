# Phase 3: Dashboard Frontend — Research

**Researched:** 2026-04-11
**Domain:** React dashboard — TanStack Query, Recharts, shadcn/ui, FastAPI aggregation endpoints
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Top navigation bar with "Dashboard" and "Upload" links. Requires adding a client-side router.
- **D-02:** Dashboard is the landing page (default route `/`). Upload page moves to `/upload`.
- **D-03:** LanguageToggle component moves into the shared top nav bar.
- **D-04:** Data freshness indicator ("Last updated: [timestamp]") displayed in the top nav bar, visible on every page.
- **D-05:** Three summary cards only: Total Revenue, Average Order Value, Total Orders.
- **D-06:** Zero-value orders (total_value = 0) are excluded from all KPI calculations.
- **D-07:** AOV = arithmetic mean of total_value where total_value > 0.
- **D-08:** Revenue time-series chart with user-selectable granularity toggle: daily, weekly, monthly.
- **D-09:** Chart type toggle between line chart and bar chart. Line chart is the default.
- **D-10:** Chart data uses the same zero-value exclusion filter.
- **D-11:** Combined date filter: four preset quick-range buttons plus a custom calendar date picker.
- **D-12:** Preset ranges: "This month," "This quarter," "This year," "All time."
- **D-13:** Default date range on initial load: current calendar year.
- **D-14:** Date filter applies to both summary cards and chart simultaneously.
- **CF-01:** Bilingual UI (DE/EN) with react-i18next — every string ships both `de` and `en` keys.
- **CF-02:** TanStack Query `invalidateQueries` after upload for auto-refresh.
- **CF-03:** shadcn/ui component library, Tailwind v4 CSS-first config.
- **CF-04:** Recharts for charting (already installed at 3.8.1).

### Claude's Discretion

- Router library choice (react-router, wouter, TanStack Router)
- Calendar date picker component (shadcn date picker, react-day-picker, etc.)
- Granularity toggle UI (segmented control, button group, dropdown)
- Chart type toggle UI (icon buttons, segmented control)
- API endpoint design (single endpoint with query params vs multiple endpoints)
- Responsive breakpoint strategy for 1080p+ (INFR-03)
- Quick-range button placement relative to the calendar picker

### Deferred Ideas (OUT OF SCOPE)

- **DASH-06:** Period-over-period deltas on metric cards
- **DASH-07:** Export filtered data as CSV
- **DASH-08:** Per-upload drill-down view
- Additional metric cards (remaining value, customer count)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | Dashboard displays summary metric cards (total revenue, avg order value, total orders) | Backend `/api/kpis` endpoint with SQLAlchemy `func.sum` / `func.count` / `func.avg`; React KpiCard components with shadcn Card |
| DASH-02 | Dashboard displays time-series chart showing revenue over time | Backend `/api/kpis/chart` endpoint with PostgreSQL `date_trunc`; Recharts `LineChart` / `BarChart` with `ResponsiveContainer` |
| DASH-03 | User can filter dashboard by date range | TanStack Query `queryKey` includes `[startDate, endDate]`; custom calendar component via shadcn `calendar` + `popover` + `react-day-picker` |
| DASH-04 | Dashboard shows data freshness indicator with timestamp of most recent upload | Backend `/api/kpis/latest-upload` endpoint; `FreshnessIndicator` component using `useQuery(['latest-upload'])` |
| INFR-03 | Layout is responsive and usable on 1080p+ desktop screens | Tailwind `lg:grid-cols-3`, `max-w-7xl`, `min-h-[400px]` on chart — desktop-only per UI-SPEC |
</phase_requirements>

---

## Summary

Phase 3 is an additive phase — all infrastructure exists. The frontend project is fully scaffolded (Vite, React 19, Tailwind v4, shadcn/ui, TanStack Query, Recharts are all installed). The backend has FastAPI with an async SQLAlchemy 2.0 pattern already in production. The work is: (1) add three FastAPI aggregation endpoints to a new `kpis` router, (2) add a client-side router to `App.tsx`, (3) add the NavBar with routing and freshness indicator, and (4) build the DashboardPage with its three sub-systems (KPI cards, date range filter, revenue chart).

No new npm packages are required at the dependency level — Recharts 3.8.1 is already installed. The `calendar`, `popover`, `tabs`, and `toggle-group` shadcn components must be added via `npx shadcn add`. A router library must be chosen and installed (research recommends wouter at 2.2KB; see below). The `date-fns` package is needed as a utility for date arithmetic (preset range calculations) and is the companion library for `react-day-picker` which ships with the shadcn calendar component.

**Primary recommendation:** Use wouter 3.9.0 for routing (2 routes, no file-based routing needed), separate FastAPI endpoints per concern (`/api/kpis`, `/api/kpis/chart`, `/api/kpis/latest-upload`), and `queryClient.invalidateQueries({ queryKey: ['kpis'] })` in the existing DropZone `onSuccess` handler.

---

## Standard Stack

### Core (all already installed unless noted)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| React | 19.2.4 | UI framework | Installed |
| TypeScript | ~6.0.2 | Type safety | Installed |
| Vite | 8.0.4 | Build + dev server | Installed |
| Tailwind CSS | 4.2.2 | Utility styling (CSS-first, no config.js) | Installed |
| shadcn/ui | 4.2.0 | Component primitives | Initialized |
| Recharts | 3.8.1 | SVG charts | Installed |
| @tanstack/react-query | 5.97.0 | Server state / data fetching | Installed |
| react-i18next | 17.0.2 | i18n (DE/EN) | Installed |
| lucide-react | 1.8.0 | Icons | Installed |
| sonner | 2.0.7 | Toast notifications | Installed |
| FastAPI | (existing backend) | REST API | Running |
| SQLAlchemy 2.0 async | (existing) | DB queries | Running |

### New Packages Required

| Library | Version | Purpose | Install |
|---------|---------|---------|---------|
| wouter | 3.9.0 | Lightweight client-side routing (2 routes) | `npm install wouter` |
| date-fns | 4.1.0 | Date arithmetic for preset range calculations | `npm install date-fns` |

Note: `react-day-picker` ships as a transitive dependency of the shadcn `calendar` component — it does not need a direct install.

### shadcn Components to Add

```bash
npx shadcn@latest add tabs toggle-group popover calendar
```

Already installed: `card`, `button`, `badge`, `separator`, `dialog`, `table`.

### Version Verification

All versions above were verified against npm registry on 2026-04-11:
- `npm view wouter version` → 3.9.0
- `npm view react-router version` → 7.14.0 (not recommended — see below)
- `npm view react-day-picker version` → 9.14.0 (ships with shadcn calendar)
- `npm view date-fns version` → 4.1.0

---

## Architecture Patterns

### Recommended Project Structure (additions to existing frontend/src/)

```
frontend/src/
├── pages/
│   ├── UploadPage.tsx          # existing — move LanguageToggle out, add NavBar
│   └── DashboardPage.tsx       # NEW — composes all dashboard sub-components
├── components/
│   ├── NavBar.tsx              # NEW — top nav, routing links, freshness indicator
│   ├── LanguageToggle.tsx      # existing — moved into NavBar
│   ├── dashboard/
│   │   ├── KpiCardGrid.tsx     # NEW — 3-column grid wrapper
│   │   ├── KpiCard.tsx         # NEW — label + value + skeleton state
│   │   ├── RevenueChart.tsx    # NEW — Recharts LineChart/BarChart swap
│   │   ├── DateRangeFilter.tsx # NEW — presets + custom calendar popover
│   │   ├── GranularityToggle.tsx # NEW — daily/weekly/monthly
│   │   ├── ChartTypeToggle.tsx # NEW — line/bar
│   │   └── FreshnessIndicator.tsx # NEW — latest upload timestamp
│   └── ui/                     # existing shadcn components
├── lib/
│   ├── api.ts                  # existing — add kpi fetch functions
│   └── dateUtils.ts            # NEW — preset range helpers (date-fns)
├── locales/
│   ├── de.json                 # existing — add dashboard keys
│   └── en.json                 # existing — add dashboard keys
└── App.tsx                     # update — add wouter Router, Route
```

```
backend/app/
├── routers/
│   ├── uploads.py              # existing
│   └── kpis.py                 # NEW — /api/kpis, /api/kpis/chart, /api/kpis/latest-upload
├── schemas.py                  # existing — add KpiSummary, ChartPoint, LatestUpload response models
└── main.py                     # update — include kpis_router
```

### Pattern 1: FastAPI KPI Router

Three separate endpoints per concern — simpler to reason about, cache independently with different TanStack Query keys, and refetch selectively (e.g., granularity change refetches chart only).

```python
# backend/app/routers/kpis.py
from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.models import SalesRecord, UploadBatch
from app.schemas import ChartPoint, KpiSummary, LatestUploadResponse

router = APIRouter(prefix="/api/kpis")


@router.get("", response_model=KpiSummary)
async def get_kpi_summary(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    db: AsyncSession = Depends(get_async_db_session),
) -> KpiSummary:
    stmt = (
        select(
            func.sum(SalesRecord.total_value).label("total_revenue"),
            func.avg(SalesRecord.total_value).label("avg_order_value"),
            func.count(SalesRecord.id).label("total_orders"),
        )
        .where(SalesRecord.total_value > 0)
    )
    if start_date:
        stmt = stmt.where(SalesRecord.order_date >= start_date)
    if end_date:
        stmt = stmt.where(SalesRecord.order_date <= end_date)

    result = await db.execute(stmt)
    row = result.one()
    return KpiSummary(
        total_revenue=row.total_revenue or Decimal("0"),
        avg_order_value=row.avg_order_value or Decimal("0"),
        total_orders=row.total_orders or 0,
    )


@router.get("/chart", response_model=list[ChartPoint])
async def get_chart_data(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    granularity: Literal["daily", "weekly", "monthly"] = Query("monthly"),
    db: AsyncSession = Depends(get_async_db_session),
) -> list[ChartPoint]:
    trunc_map = {"daily": "day", "weekly": "week", "monthly": "month"}
    trunc = trunc_map[granularity]

    bucket = func.date_trunc(trunc, SalesRecord.order_date).label("bucket")
    stmt = (
        select(bucket, func.sum(SalesRecord.total_value).label("revenue"))
        .where(SalesRecord.total_value > 0)
        .where(SalesRecord.order_date.isnot(None))
        .group_by(bucket)
        .order_by(bucket)
    )
    if start_date:
        stmt = stmt.where(SalesRecord.order_date >= start_date)
    if end_date:
        stmt = stmt.where(SalesRecord.order_date <= end_date)

    result = await db.execute(stmt)
    return [
        ChartPoint(date=str(row.bucket.date()), revenue=row.revenue)
        for row in result.all()
    ]


@router.get("/latest-upload", response_model=LatestUploadResponse)
async def get_latest_upload(
    db: AsyncSession = Depends(get_async_db_session),
) -> LatestUploadResponse:
    result = await db.execute(
        select(func.max(UploadBatch.uploaded_at))
    )
    ts = result.scalar()
    return LatestUploadResponse(uploaded_at=ts)
```

```python
# backend/app/schemas.py — add these models
from datetime import datetime
from decimal import Decimal

class KpiSummary(BaseModel):
    total_revenue: Decimal
    avg_order_value: Decimal
    total_orders: int

class ChartPoint(BaseModel):
    date: str        # ISO date string "2024-01-01" (truncated by granularity)
    revenue: Decimal

class LatestUploadResponse(BaseModel):
    uploaded_at: datetime | None  # None when no uploads exist
```

```python
# backend/app/main.py — add router
from app.routers.kpis import router as kpis_router
app.include_router(kpis_router)
```

### Pattern 2: TanStack Query Key Design

Query keys include date range params so changing the filter triggers automatic refetch. Granularity is only on the chart key — cards are granularity-independent.

```typescript
// Query key factories (in frontend/src/lib/api.ts or a queryKeys.ts file)
export const kpiKeys = {
  all: ['kpis'] as const,
  summary: (start: string, end: string) => ['kpis', 'summary', { start, end }] as const,
  chart: (start: string, end: string, granularity: string) =>
    ['kpis', 'chart', { start, end, granularity }] as const,
  latestUpload: () => ['kpis', 'latest-upload'] as const,
}

// Invalidation after upload (add to DropZone.tsx onSuccess, alongside existing ['uploads'] invalidation)
queryClient.invalidateQueries({ queryKey: kpiKeys.all })
// Prefix 'kpis' matches ['kpis', 'summary', ...], ['kpis', 'chart', ...], ['kpis', 'latest-upload']
```

```typescript
// DashboardPage.tsx — useQuery hooks
const { data: kpis, isLoading: kpisLoading, error: kpisError } = useQuery({
  queryKey: kpiKeys.summary(startDate, endDate),
  queryFn: () => fetchKpiSummary(startDate, endDate),
})

const { data: chartData, isLoading: chartLoading } = useQuery({
  queryKey: kpiKeys.chart(startDate, endDate, granularity),
  queryFn: () => fetchChartData(startDate, endDate, granularity),
})
```

### Pattern 3: Recharts 3 LineChart / BarChart with CSS Variables

```tsx
// RevenueChart.tsx
import {
  ResponsiveContainer, LineChart, BarChart,
  Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'

// CSS variable usage: inline style, NOT hardcoded hex
// Recharts 3.x: use var(--color-success) directly (not hsl(...))
<Line
  type="monotone"
  dataKey="revenue"
  stroke="var(--color-success)"   // #16a34a green — set in index.css @theme
  strokeWidth={2}
  dot={false}
/>

<Bar
  dataKey="revenue"
  fill="var(--color-success)"
/>

// ResponsiveContainer MUST have a height — use className on a wrapper div
<div className="min-h-[400px] w-full">
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
      <XAxis dataKey="date" stroke="var(--color-muted-foreground)" tick={{ fontSize: 12 }} />
      <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 12 }} />
      <Tooltip
        contentStyle={{
          background: 'var(--color-popover)',
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
        }}
      />
      <Line ... />
    </LineChart>
  </ResponsiveContainer>
</div>
```

**Critical Recharts 3 gotcha:** `ResponsiveContainer` measures its parent's dimensions on first render. If the parent has no explicit height, the container collapses to 0px and nothing renders. Always place `ResponsiveContainer` inside a `div` with a set height class (`min-h-[400px]`, `h-[400px]`, or `aspect-video`).

### Pattern 4: wouter Router Setup

```tsx
// App.tsx — replace UploadPage direct render with router
import { Route, Switch } from 'wouter'
import { DashboardPage } from './pages/DashboardPage'
import { UploadPage } from './pages/UploadPage'
import { NavBar } from './components/NavBar'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NavBar />
      <main className="pt-16">  {/* offset for fixed 64px nav */}
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/upload" component={UploadPage} />
        </Switch>
      </main>
      <Toaster position="top-right" />
    </QueryClientProvider>
  )
}
```

```tsx
// NavBar.tsx — Link usage with active state
import { Link, useLocation } from 'wouter'

function NavBar() {
  const [location] = useLocation()
  return (
    <nav className="fixed top-0 inset-x-0 h-16 bg-card border-b border-border z-50">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center gap-6">
        <span className="text-sm font-semibold">{t('nav.brand')}</span>
        <Link href="/" className={cn('text-sm', location === '/' && 'text-primary font-semibold border-b-2 border-primary')}>
          {t('nav.dashboard')}
        </Link>
        <Link href="/upload" className={cn('text-sm', location === '/upload' && 'text-primary font-semibold border-b-2 border-primary')}>
          {t('nav.upload')}
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <FreshnessIndicator />
          <LanguageToggle />
        </div>
      </div>
    </nav>
  )
}
```

### Pattern 5: Date Range Filter with Preset Ranges

```typescript
// frontend/src/lib/dateUtils.ts — preset range helpers using date-fns
import {
  startOfYear, endOfYear, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, format
} from 'date-fns'

export function getPresetRange(preset: 'thisMonth' | 'thisQuarter' | 'thisYear' | 'allTime') {
  const now = new Date()
  switch (preset) {
    case 'thisMonth':
      return { from: startOfMonth(now), to: endOfMonth(now) }
    case 'thisQuarter':
      return { from: startOfQuarter(now), to: endOfQuarter(now) }
    case 'thisYear':
      return { from: startOfYear(now), to: endOfYear(now) }
    case 'allTime':
      return { from: undefined, to: undefined }
  }
}

export function toApiDate(d: Date | undefined): string | undefined {
  return d ? format(d, 'yyyy-MM-dd') : undefined
}
```

```tsx
// DateRangeFilter.tsx — shadcn Calendar in Popover with mode="range"
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { DateRange } from 'react-day-picker'

const [range, setRange] = useState<DateRange | undefined>()
const [activePreset, setActivePreset] = useState<string>('thisYear')

// Calendar date range:
<Calendar
  mode="range"
  selected={range}
  onSelect={setRange}
  numberOfMonths={2}
/>
```

### Pattern 6: Auto-Refresh After Upload

The `DropZone` component already has an `invalidateQueries` call for `['uploads']`. Phase 3 adds `kpiKeys.all` to the same `onSuccess` handler:

```typescript
// DropZone.tsx — existing onSuccess (line ~40), ADD the kpi invalidation
onSuccess: (data) => {
  // ... existing toast logic ...
  queryClient.invalidateQueries({ queryKey: ['uploads'] })       // existing
  queryClient.invalidateQueries({ queryKey: kpiKeys.all })       // ADD: invalidates all kpi queries
  // ... existing callback logic ...
}
```

This is the simplest approach (option a from focus areas). No polling, no SSE/WebSocket. Because the dashboard queries are `stale` after invalidation, they refetch automatically when the component is mounted or focused. If the user is on `/` (dashboard) when upload completes, the cards and chart update immediately. If they're on `/upload`, the data refetches on next navigation to `/`. Both behaviors are correct for this internal tool.

### Anti-Patterns to Avoid

- **Do not use `queryClient.refetchQueries`** instead of `invalidateQueries` — `invalidateQueries` is the idiomatic v5 pattern; it marks stale and refetches only currently-rendered queries, avoiding unnecessary network calls for unmounted queries.
- **Do not put date range state in TanStack Query** — date range is UI state that drives the `queryKey`; keep it in React `useState`.
- **Do not hardcode hex colors in Recharts** — always use `var(--color-success)` etc. so the color contract stays in `index.css`.
- **Do not render `ResponsiveContainer` without a parent height** — causes silent zero-height chart.
- **Do not call `Base.metadata.create_all()`** for any new index — use an Alembic migration.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date range picker UI | Custom calendar inputs | shadcn `calendar` + `popover` (react-day-picker) | Handles keyboard nav, ARIA, range selection, month navigation |
| Date arithmetic (quarter boundaries, month start/end) | Manual JS Date math | `date-fns` | Edge cases with month-end, quarter boundaries, DST |
| Responsive chart container | CSS width hacks | `ResponsiveContainer` from Recharts | Handles resize observer, debounced re-render |
| Client routing | `window.history.pushState` wrapper | `wouter` | Hash fallback, browser history, Link component |
| Number formatting | `n.toFixed(2)` | `Intl.NumberFormat` | Locale-specific thousands separators, currency symbol placement |
| Relative timestamps | Manual date diff | local formatter using `date-fns` `differenceInHours` / `formatDistanceToNow` | DST edge cases, locale strings |
| SQL date bucket grouping | Python-side date arithmetic | PostgreSQL `date_trunc` | Pushes aggregation to DB, avoids fetching raw rows to Python |

---

## Focus Area Answers

### 1. Backend API Shape

Three separate endpoints recommended over a single bundle:

| Endpoint | Method | Query Params | Response | Cache Key Purpose |
|----------|--------|-------------|---------|-------------------|
| `GET /api/kpis` | GET | `start_date`, `end_date` (ISO date, optional) | `KpiSummary` | Cards only — granularity-independent |
| `GET /api/kpis/chart` | GET | `start_date`, `end_date`, `granularity` (daily/weekly/monthly) | `ChartPoint[]` | Chart — needs granularity dimension |
| `GET /api/kpis/latest-upload` | GET | none | `LatestUploadResponse` | Freshness — independent, stable |

Rationale: Separate endpoints allow granularity toggle to refetch chart without refetching cards. If bundled, changing granularity would needlessly recompute the card aggregates. Separate endpoints also give cleaner cache keys and simpler response schemas.

Date format: ISO 8601 `YYYY-MM-DD` strings as query params — `?start_date=2026-01-01&end_date=2026-12-31`. FastAPI automatically parses `date` type annotations from query string.

### 2. SQL Aggregation — Confirmed Schema

From `backend/app/models.py` (confirmed against `d7547428d885` migration):

| Column | Type | Used For |
|--------|------|----------|
| `order_date` | `Date` (nullable) | Date range filter, chart bucketing |
| `total_value` | `Numeric(15,2)` (nullable) | Revenue sum, AOV, filtering out zeros |
| `remaining_value` | `Numeric(15,2)` (nullable) | NOT used in Phase 3 |

KPI SQL logic (zero-value filter D-06/D-07 applied as `WHERE total_value > 0`):

```sql
-- Summary cards
SELECT
  SUM(total_value)   AS total_revenue,
  AVG(total_value)   AS avg_order_value,
  COUNT(id)          AS total_orders
FROM sales_records
WHERE total_value > 0
  AND order_date >= :start_date   -- omitted if "All time"
  AND order_date <= :end_date;

-- Chart data (monthly example)
SELECT
  date_trunc('month', order_date) AS bucket,
  SUM(total_value)                AS revenue
FROM sales_records
WHERE total_value > 0
  AND order_date IS NOT NULL
  AND order_date >= :start_date
  AND order_date <= :end_date
GROUP BY bucket
ORDER BY bucket;
```

**Index recommendation:** Add a B-tree index on `sales_records.order_date` in a Phase 3 Alembic migration. With date range filtering as the primary access pattern, this prevents full table scans as the dataset grows. The migration is a single `CREATE INDEX` statement.

```python
# In new Alembic migration for Phase 3:
op.create_index('ix_sales_records_order_date', 'sales_records', ['order_date'])
```

`total_value > 0` filter does not benefit from an index given it will likely match most rows — no partial index needed.

### 3. React Query v5 Integration

QueryClient configuration: the existing `new QueryClient()` in App.tsx is sufficient. No staleTime customization needed for this internal tool.

**Query key strategy** (verified against TanStack Query v5 docs):

```typescript
// v5 invalidateQueries uses single object param — no multiple overloads
queryClient.invalidateQueries({ queryKey: ['kpis'] })
// Matches: ['kpis', 'summary', {...}], ['kpis', 'chart', {...}], ['kpis', 'latest-upload']
// Does NOT match: ['uploads'] — different first element
```

The v5 API change (from `invalidateQueries(key, filters, options)` to `invalidateQueries({ queryKey, ...filters }, options)`) is already how the existing DropZone calls it — consistent with codebase pattern.

Source: [TanStack Query v5 Query Invalidation docs](https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation)

### 4. Recharts + Tailwind v4

Recharts 3 uses CSS variables directly with `var(--token)` syntax — **not** `hsl(var(--token))`. The existing `index.css` already has `--color-success: #16a34a` and `--color-primary: #2563eb` in `@theme`.

Gotchas:
- `ResponsiveContainer` requires parent with explicit height — wrap in `<div className="min-h-[400px] w-full">`.
- Tooltip `contentStyle` must be plain JS object (inline style) — Tailwind classes do not apply to Recharts internal tooltip DOM.
- Y-axis multiple axes in Recharts 3 render alphabetically by `yAxisId` — not relevant for this single-axis chart.
- Chart stroke/fill: use `stroke="var(--color-success)"` NOT `stroke="#16a34a"`.
- `blendStroke` prop removed in Recharts 3 — not relevant for LineChart/BarChart.

Source: [Recharts 3.0 migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide)

### 5. Auto-Refresh After Upload

**Recommended: option (a) — `queryClient.invalidateQueries` in DropZone `onSuccess`.**

The DropZone mutation already invalidates `['uploads']` in its `onSuccess`. Adding `kpiKeys.all` to the same block is 1 line of code. No polling, no SSE. Confirmed pattern in TanStack Query v5 docs.

Polling and SSE/WebSocket are unnecessary complexity for an internal tool where uploads are user-initiated explicit actions.

### 6. Date Range Filter UX

shadcn `calendar` component (confirmed): `npx shadcn@latest add popover calendar`.

Dependencies that ship automatically:
- `react-day-picker` 9.14.0 — installed by shadcn as transitive dep
- Install `date-fns` 4.1.0 separately (calendar uses it for formatting; preset calculations need it directly)

`DateRange` type from `react-day-picker`: `{ from?: Date; to?: Date }`.

Preset button placement: row of 4 buttons above the "Custom…" trigger (left-to-right: "This month" | "This quarter" | "This year" | "All time"), with "Custom…" as the rightmost button that opens the popover. Consistent with UI-SPEC D-11 / D-12.

### 7. Frontend Project State

The frontend directory is fully bootstrapped from Phase 2. No init steps needed. Current state:

- `frontend/src/App.tsx` — `QueryClientProvider` wrapping `<UploadPage>` directly (no router yet)
- `frontend/src/pages/UploadPage.tsx` — complete, includes `LanguageToggle` at page level (moves to NavBar)
- `frontend/src/components/LanguageToggle.tsx` — exists, moves into NavBar
- `frontend/src/lib/api.ts` — existing fetch helpers; needs KPI fetch functions added
- `frontend/src/locales/{de,en}.json` — existing with Phase 2 keys; Phase 3 adds dashboard namespaced keys

Phase 3 additions only — no re-scaffolding needed.

### 8. CORS / Dev Proxy

Already configured in `vite.config.ts`:
```typescript
proxy: {
  '/api': {
    target: 'http://api:8000',
    changeOrigin: true,
  },
}
```

FastAPI does not need CORS headers because the Vite dev server proxies all `/api` requests — the browser never makes a cross-origin request. No change needed for dev. Production static serving (if adopted later) would require FastAPI CORS middleware, but that's out of Phase 3 scope.

### 9. Docker Compose

The `frontend` service already exists in `docker-compose.yml` — no changes needed. The frontend container runs Vite dev server on port 5173, depends on the API service being healthy. Phase 3 adds backend routes only to the `api` service (code in volume-mounted `./backend`). The `migrate` service will need to run the new `order_date` index migration, but that happens automatically via the existing `alembic upgrade head` command on startup.

### 10. Testing Approach

`nyquist_validation: false` in `.planning/config.json` — Validation Architecture section is skipped. No test infrastructure exists in the project (confirmed: no `vitest.config*`, `jest.config*`, or `*.test.*` files). Phase 3 does not need to establish testing — skipped per project config.

---

## Common Pitfalls

### Pitfall 1: ResponsiveContainer Height Collapse

**What goes wrong:** Chart renders but is invisible. No error in console.
**Why it happens:** `ResponsiveContainer` measures its parent's height via ResizeObserver. If the parent has no explicit height, measurement returns 0.
**How to avoid:** Always wrap `ResponsiveContainer` in a `div` with an explicit height class: `<div className="min-h-[400px] w-full">`.
**Warning signs:** Empty chart area, no SVG elements in DevTools DOM.

### Pitfall 2: TanStack Query Prefix Invalidation Scope

**What goes wrong:** Changing granularity triggers card data refetch unnecessarily (or vice versa).
**Why it happens:** Overly broad `queryKey: ['kpis']` in `useQuery` without differentiating dimensions.
**How to avoid:** Use the factory pattern — `kpiKeys.summary(start, end)` and `kpiKeys.chart(start, end, granularity)`. The summary key doesn't include granularity, so the chart re-fetches independently.
**Warning signs:** Network tab shows `/api/kpis` being called when only granularity changed.

### Pitfall 3: Alembic Migration Not Included

**What goes wrong:** The `order_date` index is missing in production; queries are slow as data grows.
**Why it happens:** Developers add indexes by hand (e.g., via psql) and forget to put them in a migration.
**How to avoid:** Phase 3 plan Wave 0 includes a new migration: `op.create_index('ix_sales_records_order_date', 'sales_records', ['order_date'])`. Rebuild the `migrate` Docker image after generating the migration.
**Warning signs:** Slow response on date-filtered queries with large datasets.

### Pitfall 4: i18n Keys Missing in One Locale

**What goes wrong:** Dashboard renders German copy but English toggle shows key strings (e.g., `"dashboard.kpi.totalRevenue.label"` literally).
**Why it happens:** Adding keys to `de.json` but forgetting `en.json` (or vice versa).
**How to avoid:** The UI-SPEC copywriting table lists both DE and EN copy for every key. Add all keys to both files in the same task step.
**Warning signs:** i18next falls back to the key string when a translation is missing.

### Pitfall 5: `date_trunc` on NULL `order_date`

**What goes wrong:** Chart endpoint crashes or returns an error because some `SalesRecord` rows have `order_date = NULL`.
**Why it happens:** `order_date` is nullable per Phase 2 schema. `date_trunc` on NULL returns NULL, which causes GROUP BY issues.
**How to avoid:** Add `.where(SalesRecord.order_date.isnot(None))` to the chart query (included in the code examples above).
**Warning signs:** 500 error from chart endpoint when sample data has rows with missing dates.

### Pitfall 6: Upload Page LanguageToggle Duplication

**What goes wrong:** LanguageToggle appears both in the NavBar and inside `UploadPage`, showing twice.
**Why it happens:** The existing `UploadPage.tsx` renders `<LanguageToggle />` at line ~14. When NavBar is added, it also renders it.
**How to avoid:** Remove the `<LanguageToggle />` and its surrounding `div` from `UploadPage.tsx` when adding NavBar (D-03).
**Warning signs:** Two language toggles visible on the Upload page.

---

## Code Examples

### FastAPI KPI schemas (Pydantic v2)

```python
# Source: existing patterns in backend/app/schemas.py
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel

class KpiSummary(BaseModel):
    total_revenue: Decimal
    avg_order_value: Decimal
    total_orders: int

    model_config = {"from_attributes": True}

class ChartPoint(BaseModel):
    date: str       # "2024-01-01" — ISO date truncated to granularity
    revenue: Decimal

class LatestUploadResponse(BaseModel):
    uploaded_at: datetime | None  # None = no uploads in DB
```

### API fetch helpers for frontend

```typescript
// frontend/src/lib/api.ts — add to existing file
export interface KpiSummary {
  total_revenue: number
  avg_order_value: number
  total_orders: number
}

export interface ChartPoint {
  date: string
  revenue: number
}

export interface LatestUploadResponse {
  uploaded_at: string | null
}

export async function fetchKpiSummary(start?: string, end?: string): Promise<KpiSummary> {
  const params = new URLSearchParams()
  if (start) params.set('start_date', start)
  if (end) params.set('end_date', end)
  const res = await fetch(`/api/kpis?${params}`)
  if (!res.ok) throw new Error('Failed to fetch KPI summary')
  return res.json()
}

export async function fetchChartData(
  start?: string,
  end?: string,
  granularity = 'monthly'
): Promise<ChartPoint[]> {
  const params = new URLSearchParams({ granularity })
  if (start) params.set('start_date', start)
  if (end) params.set('end_date', end)
  const res = await fetch(`/api/kpis/chart?${params}`)
  if (!res.ok) throw new Error('Failed to fetch chart data')
  return res.json()
}

export async function fetchLatestUpload(): Promise<LatestUploadResponse> {
  const res = await fetch('/api/kpis/latest-upload')
  if (!res.ok) throw new Error('Failed to fetch latest upload')
  return res.json()
}
```

### KpiCard skeleton state

```tsx
// KpiCard.tsx
function KpiCard({ label, value, isLoading }: { label: string; value?: string; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="h-4 w-24 bg-muted rounded animate-pulse mb-4" />
        <div className="h-9 w-36 bg-muted rounded animate-pulse" />
      </Card>
    )
  }
  return (
    <Card className="p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold tabular-nums mt-2">{value}</p>
    </Card>
  )
}
```

### Currency formatting (per UI-SPEC)

```typescript
// Usage in KpiCard or DashboardPage
const locale = i18n.language === 'de' ? 'de-DE' : 'en-US'
const formatCurrency = (n: number) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
const formatCount = (n: number) =>
  new Intl.NumberFormat(locale).format(n)
```

---

## Recommended Approach (all open questions resolved)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Router library | **wouter 3.9.0** | 2.2KB, React 19 compatible, 2 routes only — full react-router v7 is overengineered |
| API structure | **3 separate endpoints** (`/api/kpis`, `/api/kpis/chart`, `/api/kpis/latest-upload`) | Allows granularity toggle to refetch chart without recomputing cards |
| Date picker | **shadcn `calendar` + `popover`** (`npx shadcn add`) | Official registry, react-day-picker v9, mode="range" built-in |
| Date arithmetic | **date-fns 4.1.0** | Companion to react-day-picker, quarter/month boundary helpers |
| Granularity toggle UI | **shadcn `tabs`** (add via CLI) | Semantically correct for mutually-exclusive toggle; consistent with chart type toggle |
| Chart type toggle UI | **shadcn `tabs`** | Same rationale; visually consistent with granularity toggle |
| Auto-refresh | **`invalidateQueries` in DropZone `onSuccess`** | 1-line addition to existing pattern; no polling or SSE needed |
| DB index | **Alembic migration with `ix_sales_records_order_date`** | B-tree on `order_date` prevents full-table scan on date-range filters |
| CORS | **No change** | Vite proxy already configured; no CORS headers needed for dev |
| Docker Compose | **No change** | Frontend and API services already exist and running |
| Testing | **None** | `nyquist_validation: false`; no test infrastructure established in project |

---

## Environment Availability

All required tools verified against running project from Phase 2:

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Node.js | npm installs, Vite | Yes (via Docker) | Frontend container uses it |
| Docker + Compose v2 | All services | Yes | Three services running from Phase 2 |
| PostgreSQL 17-alpine | Backend DB | Yes | db service running, data persisted |
| FastAPI (uvicorn) | API | Yes | api service running on :8000 |
| Vite 8.0.4 | Frontend dev | Yes | frontend service running on :5173 |
| Recharts 3.8.1 | Charts | Yes — installed | In `package.json` dependencies |
| @tanstack/react-query 5.97.0 | Data fetching | Yes — installed | In `package.json` dependencies |
| shadcn CLI | Component add | Yes — `shadcn` package installed | `npx shadcn@latest add` works |

**Missing but installable:**
- `wouter` 3.9.0 — `npm install wouter` inside frontend container or in `package.json`
- `date-fns` 4.1.0 — `npm install date-fns` (companion to react-day-picker)
- shadcn `tabs`, `toggle-group`, `popover`, `calendar` — `npx shadcn@latest add tabs toggle-group popover calendar`

**No blocking missing dependencies.**

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| React Query v4 (`queryKey` strings) | TanStack Query v5 (array keys only, single-object `invalidateQueries`) | Already on v5 — no migration needed |
| Recharts 2.x (hsl CSS vars, `ref.current.current`) | Recharts 3.x (`var()` direct, simplified ref) | Already on 3.8.1 — use `var(--token)` directly |
| Tailwind v3 (`tailwind.config.js`, PostCSS) | Tailwind v4 (CSS-first `@import tailwindcss` in CSS) | Already on v4 — no config file to touch |
| shadcn v3 style | shadcn `base-nova` preset | Already initialized with `base-nova` per `components.json` |

---

## Open Questions

1. **`date_trunc` on `Date` column vs `DateTime`**
   - `order_date` is `Date` type (not `DateTime`/`TIMESTAMPTZ`). PostgreSQL `date_trunc` accepts a `date` type argument — it casts internally. Confirmed behavior but worth verifying with actual data in the Docker stack during Wave 0.
   - Recommendation: test the chart endpoint manually before implementing the frontend.

2. **`remaining_value` NULL vs zero**
   - D-06 excludes `total_value = 0`. It does not mention `remaining_value`. Since `remaining_value` is not used in Phase 3, no action needed — documented for Phase 4 implementers.

3. **`UploadPage` existing page structure**
   - `UploadPage.tsx` currently has no `NavBar` or padding for a fixed top nav. When NavBar is added (fixed, h-16), the page content needs `pt-16` added. The plan must include updating `UploadPage` layout — this is not in the CONTEXT.md decisions but is an obvious structural requirement.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct reads: `backend/app/models.py`, `backend/app/main.py`, `backend/app/database.py`, `backend/app/routers/uploads.py`, `frontend/package.json`, `frontend/vite.config.ts`, `frontend/src/App.tsx`, `frontend/src/lib/api.ts`, `frontend/src/components/DropZone.tsx` — actual production code
- `backend/alembic/versions/d7547428d885_phase2_full_sales_schema.py` — confirmed exact DB schema
- `frontend/src/index.css` — confirmed `--color-success`, `--color-primary` tokens
- [TanStack Query v5 invalidateQueries docs](https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation) — verified API
- [Recharts 3.0 migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide) — CSS var syntax, breaking changes
- [shadcn/ui Calendar docs](https://ui.shadcn.com/docs/components/radix/calendar) — install command, DateRange type
- npm registry: `npm view wouter version` → 3.9.0, `npm view date-fns version` → 4.1.0

### Secondary (MEDIUM confidence)
- WebSearch + npm registry: wouter 3.9.0 React 19 compatible — last published 4 months ago (from April 2026), confirmed active
- WebSearch: SQLAlchemy `func.date_trunc` + `func.sum` aggregate pattern — verified against SQLAlchemy 2.0 docs

### Tertiary (LOW confidence)
- Recharts `var(--token)` vs `hsl(var(--token))` in v3 — from migration guide + search; not an explicit API doc statement. Confirmed by UI-SPEC which states "use CSS custom properties via inline style".

---

## Metadata

**Confidence breakdown:**
- Backend API patterns: HIGH — based on existing codebase + verified SQLAlchemy docs
- Standard stack (frontend): HIGH — all packages confirmed in package.json with exact versions
- Recharts CSS var pattern: MEDIUM — migration guide implies it; UI-SPEC enforces it; should validate with one test render
- Router choice (wouter): HIGH — npm confirmed 3.9.0, React 19 compatible, 2-route use case well within its scope
- Date range filter (shadcn calendar): HIGH — official shadcn docs confirm `mode="range"` and `DateRange` type

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable ecosystem — 30-day window)
