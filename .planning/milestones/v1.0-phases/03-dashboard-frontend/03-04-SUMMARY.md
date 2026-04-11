---
phase: 03-dashboard-frontend
plan: 04
subsystem: frontend-dashboard
tags: [frontend, react, recharts, tanstack-query, shadcn, i18n, auto-refresh]
requirements: [DASH-02]
dependency-graph:
  requires:
    - "GET /api/kpis/chart from Plan 03-01"
    - "fetchChartData + kpiKeys.chart factory from Plan 03-02"
    - "DashboardPage composition with hoisted date state from Plan 03-03"
  provides:
    - "RevenueChart (Recharts Line/Bar swap) bound to /api/kpis/chart"
    - "GranularityToggle (daily/weekly/monthly) shadcn Tabs"
    - "ChartTypeToggle (line/bar) shadcn Tabs"
    - "shadcn tabs primitive (base-ui wrap)"
    - "Upload -> dashboard auto-refresh flow via kpiKeys.all invalidation"
  affects: []
tech-stack:
  added:
    - "shadcn tabs component (base-ui @base-ui/react/tabs)"
  patterns:
    - "Recharts 3.8.1 CSS-variable theming (stroke/fill = var(--color-success))"
    - "TanStack Query prefix invalidation (kpiKeys.all) in mutation onSuccess"
    - "Controlled Tabs with value + onValueChange callback"
key-files:
  created:
    - frontend/src/components/ui/tabs.tsx
    - frontend/src/components/dashboard/GranularityToggle.tsx
    - frontend/src/components/dashboard/ChartTypeToggle.tsx
    - frontend/src/components/dashboard/RevenueChart.tsx
  modified:
    - frontend/src/pages/DashboardPage.tsx
    - frontend/src/components/DropZone.tsx
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
decisions:
  - "Revenue series color sourced from --color-success (CSS variable), never hardcoded hex, per UI-SPEC Recharts constraint"
  - "Chart type toggle does NOT appear in queryKey; only granularity does -> swap is client-side, never triggers refetch"
  - "Single line added to DropZone onSuccess: queryClient.invalidateQueries({ queryKey: kpiKeys.all }) -- relies on TanStack Query v5 prefix matching"
  - "Default chart state: granularity = monthly, chartType = line (Interaction Contract #1 + D-09)"
metrics:
  duration: ~2min
  tasks: 2
  files: 8
  completed: 2026-04-11
---

# Phase 3 Plan 04: Revenue Chart and Auto-Refresh Summary

Recharts-based revenue time-series chart with daily/weekly/monthly granularity and line/bar chart-type toggles, composed into the existing DashboardPage, plus a single-line upload-invalidation patch that completes the zero-friction upload -> dashboard refresh flow. This is the final plan of Phase 3: Phase 3 ROADMAP success criteria 1-5 are now all reachable by a user on `/`.

## Task Commits

1. **Task 1: shadcn tabs + GranularityToggle + ChartTypeToggle + RevenueChart + chart i18n keys** — `76cde66` (feat)
2. **Task 2: Compose RevenueChart into DashboardPage and invalidate kpiKeys.all in DropZone** — `23535e5` (feat)

## What Was Built

### shadcn Tabs Primitive (Task 1)

Installed via `docker compose exec frontend npx shadcn@latest add tabs --yes`. Creates `frontend/src/components/ui/tabs.tsx` which wraps `@base-ui/react/tabs` (Root/List/Tab/Panel). Exports `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`. Same base-ui wrap pattern as the existing `popover.tsx` and `calendar.tsx` primitives — there is no Radix in this project.

Note: `toggle-group` was explicitly NOT installed. Per RESEARCH Recommended Approach, standardizing on `tabs` for both toggles gives visual consistency and halves the component surface.

### Toggles (Task 1)

- **`GranularityToggle`** (`frontend/src/components/dashboard/GranularityToggle.tsx`) — controlled `<Tabs value onValueChange>` with three `<TabsTrigger>`s: `daily`, `weekly`, `monthly`. Exports `type Granularity = "daily" | "weekly" | "monthly"`.
- **`ChartTypeToggle`** (`frontend/src/components/dashboard/ChartTypeToggle.tsx`) — controlled Tabs with two triggers: `line`, `bar`. Exports `type ChartType = "line" | "bar"`.

Both accept `{ value, onChange }` props and keep state in the parent (DashboardPage) — no internal state.

### RevenueChart (Task 1)

`frontend/src/components/dashboard/RevenueChart.tsx` — single component handling all four states (loading/error/data/empty-via-empty-array). Props: `startDate?`, `endDate?`, `granularity`, `chartType`.

- `useQuery({ queryKey: kpiKeys.chart(startDate, endDate, granularity), queryFn: () => fetchChartData(startDate, endDate, granularity) })` — granularity is part of the queryKey, so changing it refetches. chartType is NOT in the queryKey, so swapping it is a pure client-side re-render.
- Wrapped in `<div className="min-h-[400px] w-full">` so `ResponsiveContainer height={400}` has a measurable parent (Pitfall 1).
- `stroke="var(--color-success)"` / `fill="var(--color-success)"` for the revenue series — NO hardcoded hex values anywhere in the JSX (UI-SPEC Recharts constraint).
- Axes use `stroke="var(--color-muted-foreground)"`, gridlines use `stroke="var(--color-border)"`.
- Tooltip `contentStyle` is a plain JS object (Tailwind classes don't reach the Recharts tooltip DOM) referencing `var(--color-popover)` and `var(--color-border)`.
- Y-axis + tooltip values format via `Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 })` with locale following `i18n.language` (`de-DE` / `en-US`).
- API returns Decimal as a JSON string; the component coerces to `Number(p.revenue)` before handing rows to Recharts (safe because all monthly/weekly/daily values fit in a JS `number`).
- Loading: chart title + `min-h-[400px] animate-pulse bg-muted` skeleton rectangle.
- Error: inline Card with `dashboard.error.heading` + `dashboard.error.body` (matches KpiCardGrid error pattern — no toast, per UI-SPEC Error State contract).

### i18n (Task 1)

Added 8 new keys to both `en.json` and `de.json`:

- `dashboard.chart.title` — "Revenue over time" / "Umsatzverlauf"
- `dashboard.chart.granularity.{daily,weekly,monthly}` — "Daily/Weekly/Monthly" / "Täglich/Wöchentlich/Monatlich"
- `dashboard.chart.type.{line,bar}` — "Line/Bar" / "Linie/Balken"
- `dashboard.chart.yAxis` / `dashboard.chart.xAxis` — Y/X axis labels (reserved for future axis labels — not rendered in v1 since Recharts axes auto-format)

### DashboardPage composition (Task 2)

`frontend/src/pages/DashboardPage.tsx` now carries three pieces of state:

```tsx
const [range, setRange] = useState<DateRangeValue>(() => {
  const initial = getPresetRange("thisYear");
  return { from: initial.from, to: initial.to };
});
const [granularity, setGranularity] = useState<Granularity>("monthly");
const [chartType, setChartType] = useState<ChartType>("line");
```

Render tree (top-to-bottom):

1. `<DateRangeFilter value={range} onChange={setRange} />`
2. `<KpiCardGrid startDate={startDate} endDate={endDate} />`
3. `<div className="flex flex-wrap items-center justify-end gap-4">` containing `<GranularityToggle />` + `<ChartTypeToggle />` — right-aligned toolbar above the chart card.
4. `<RevenueChart startDate={startDate} endDate={endDate} granularity={granularity} chartType={chartType} />`

All wrapped in `max-w-7xl mx-auto px-6 py-8 space-y-8` from Plan 03 — unchanged.

### DropZone auto-refresh patch (Task 2)

Added one import and one line to `frontend/src/components/DropZone.tsx`:

```tsx
import { kpiKeys } from "@/lib/queryKeys";
// ...
onSuccess: (data) => {
  // ... existing toast logic unchanged ...
  queryClient.invalidateQueries({ queryKey: ["uploads"] });
  queryClient.invalidateQueries({ queryKey: kpiKeys.all });
  // ... existing onUploadSuccess/onUploadError branch unchanged ...
}
```

The `kpiKeys.all` prefix (`["kpis"]`) prefix-matches all three KPI queries in the cache:

- `["kpis", "summary", { start, end }]` — card grid
- `["kpis", "chart", { start, end, granularity }]` — revenue chart
- `["kpis", "latest-upload"]` — freshness indicator

Per TanStack Query v5 prefix semantics (RESEARCH Pattern 2), a single invalidation marks all three stale. When the user next lands on `/` (or if the dashboard is already mounted in a background tab), all three queries refetch automatically. No polling, no SSE, no websocket.

## Verification

### Type-check

`docker compose exec frontend npx tsc --noEmit` — exit 0 (clean, no warnings).

### Live API

```
$ curl -sf 'http://localhost:8000/api/kpis/chart?granularity=monthly&start_date=2026-01-01&end_date=2026-12-31'
[{"date":"2026-01-01","revenue":"168038.06"},
 {"date":"2026-02-01","revenue":"418349.87"},
 {"date":"2026-03-01","revenue":"178069.28"},
 {"date":"2026-04-01","revenue":"88.50"},
 {"date":"2026-10-01","revenue":"850.22"},
 {"date":"2026-11-01","revenue":"6946.27"},
 {"date":"2026-12-01","revenue":"21571.55"}]   HTTP 200
```

7 non-empty monthly buckets from the Phase 2 dataset. The RevenueChart binds directly to this endpoint via `fetchChartData` with the DashboardPage's `startDate`/`endDate`/`granularity` state.

### Vite dev server

`curl -sf http://localhost:5173/` — HTTP 200. HMR picked up the new files cleanly.

### Grep acceptance checks (Task 1 + 2)

All acceptance-criteria grep patterns from both tasks pass:

- `var(--color-success)` appears in RevenueChart.tsx (stroke on line, fill on bar)
- `min-h-[400px]` appears in RevenueChart.tsx (ResponsiveContainer parent)
- `kpiKeys.chart` + `fetchChartData` in RevenueChart.tsx
- NO `#16a34a` or `#2563eb` anywhere in RevenueChart.tsx
- `useState<Granularity>("monthly")` + `useState<ChartType>("line")` in DashboardPage.tsx
- `getPresetRange("thisYear")` still present in DashboardPage.tsx (unchanged from Plan 03)
- `<RevenueChart` + `granularity={granularity}` + `chartType={chartType}` in DashboardPage.tsx
- `import { kpiKeys } from "@/lib/queryKeys"` in DropZone.tsx
- `queryClient.invalidateQueries({ queryKey: kpiKeys.all })` in DropZone.tsx
- Existing `queryClient.invalidateQueries({ queryKey: ["uploads"] })` still present

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Tabs (not ToggleGroup) for both toggles | RESEARCH Recommended Approach — visual consistency and single component install |
| 2 | Recharts colors via `var(--color-success)` inline string, NOT hex | UI-SPEC Recharts constraint; keeps theme authority in `index.css` |
| 3 | chartType excluded from queryKey | Interaction Contract #5 — client-side swap only, no refetch |
| 4 | Error state inline (not toast) | UI-SPEC Error State: toasts are for transient actions, not background fetches |
| 5 | `maximumFractionDigits: 0` on chart Y-axis / tooltip | Revenue range is 6+ digits; decimal cents visually clutter the axis |

## Deviations from Plan

None. Plan executed exactly as written. All upstream caveats (base-ui vs Radix, existing queryKeys/api.ts helpers, wouter not react-router) were already flagged in the `<context>` block from the orchestrator prompt and the plan body — no changes needed beyond what the plan already accounted for.

## Phase 3 Success Criteria Status (post-Plan 04)

From ROADMAP Phase 3 success criteria:

1. **Dashboard renders summary KPI cards** — delivered by Plan 03-03 (`KpiCardGrid`)
2. **Dashboard renders a revenue time-series chart** — delivered by this plan (`RevenueChart`)
3. **Chart and cards respect a date-range filter** — `kpiKeys.summary`/`kpiKeys.chart` both include range; changing `DateRangeFilter` refetches both
4. **Upload -> dashboard auto-refresh** — delivered by the one-line `kpiKeys.all` invalidation in `DropZone.tsx`
5. **Responsive at 1080p+, DE default with EN fallback** — delivered by Plans 03-02 + 03-03 (NavBar, grid, i18n); chart inherits from `max-w-7xl` and ships full DE/EN keys

All five criteria are reachable on `/` with the current git head.

## Known Stubs

None. The full dashboard now renders real data end-to-end.

## Deferred Items

None.

## User Setup Required

None. No environment variables, no external services, no migrations. Docker Compose stack is already running; Vite HMR picked up the changes automatically.

## Self-Check: PASSED

Verified:
- `frontend/src/components/ui/tabs.tsx` — FOUND
- `frontend/src/components/dashboard/GranularityToggle.tsx` — FOUND
- `frontend/src/components/dashboard/ChartTypeToggle.tsx` — FOUND
- `frontend/src/components/dashboard/RevenueChart.tsx` — FOUND
- `frontend/src/pages/DashboardPage.tsx` — FOUND (updated with chart + toggles)
- `frontend/src/components/DropZone.tsx` — FOUND (kpiKeys.all invalidation added)
- Commit `76cde66` — FOUND in git log
- Commit `23535e5` — FOUND in git log
- `docker compose exec frontend npx tsc --noEmit` — exit 0
- `curl -sf http://localhost:8000/api/kpis/chart?granularity=monthly&start_date=2026-01-01&end_date=2026-12-31` — HTTP 200 with 7 buckets
- `curl -sf http://localhost:5173/` — HTTP 200

---
*Phase: 03-dashboard-frontend*
*Completed: 2026-04-11*
