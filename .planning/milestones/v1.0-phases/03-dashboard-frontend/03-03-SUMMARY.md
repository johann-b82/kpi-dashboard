---
phase: 03-dashboard-frontend
plan: 03
subsystem: frontend-dashboard
tags: [frontend, react, shadcn, tanstack-query, i18n, date-range]
requirements: [DASH-01, DASH-03, INFR-03]
dependency-graph:
  requires:
    - "GET /api/kpis from Plan 03-01"
    - "DashboardPage stub + kpiKeys factory + fetchKpiSummary helper from Plan 03-02"
  provides:
    - "KpiCard (label/value/skeleton) component"
    - "KpiCardGrid (3-col at lg, 1-col below) reading /api/kpis"
    - "DateRangeFilter (4 presets + custom popover) emitting {from,to}"
    - "dateUtils.ts: getPresetRange, toApiDate helpers"
    - "Dashboard date-state hoisted in DashboardPage for Plan 04 chart"
  affects: [03-04-dashboard-frontend]
tech-stack:
  added:
    - "shadcn popover component"
    - "shadcn calendar component (react-day-picker 9.14.0 transitive)"
  patterns:
    - "base-ui PopoverTrigger render={<Button />} pattern for styled triggers"
    - "Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }) via i18n.language locale switching"
    - "useState initializer fn to avoid recomputing getPresetRange on every render"
key-files:
  created:
    - frontend/src/components/ui/popover.tsx
    - frontend/src/components/ui/calendar.tsx
    - frontend/src/lib/dateUtils.ts
    - frontend/src/components/dashboard/KpiCard.tsx
    - frontend/src/components/dashboard/KpiCardGrid.tsx
    - frontend/src/components/dashboard/DateRangeFilter.tsx
  modified:
    - frontend/src/pages/DashboardPage.tsx
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
    - frontend/package.json
    - frontend/package-lock.json
decisions:
  - "PopoverTrigger uses base-ui render prop (<Button />) rather than asChild — shadcn in this project wraps base-ui, not Radix"
  - "useState initializer function preserves D-13 default range without recomputing on re-render"
  - "KpiCardGrid wraps grid + exclusion note in a single <div> (not Fragment) so the parent space-y-8 on DashboardPage spaces the group as one block"
metrics:
  duration: ~3min
  tasks: 2
  files: 11
  completed: 2026-04-11
---

# Phase 3 Plan 03: KPI Cards and Date Range Filter Summary

Three dashboard components (`KpiCard`, `KpiCardGrid`, `DateRangeFilter`), a `dateUtils.ts` helper, shadcn `popover` and `calendar` registry components, full Phase 3 i18n coverage, and a composed `DashboardPage` that renders live KPIs with a working filter — half of the dashboard UX, ready for Plan 04 to drop the chart in underneath.

## Task Commits

1. **Task 1: shadcn popover+calendar, dateUtils, KpiCard/KpiCardGrid/DateRangeFilter, i18n keys** — `3c65c98` (feat)
2. **Task 2: Compose DashboardPage with hoisted date state and KpiCardGrid** — `677c9cd` (feat)

## What Was Built

### shadcn Registry Components (Task 1)

Installed via `docker compose exec frontend npx shadcn@latest add popover calendar --yes`:

- `frontend/src/components/ui/popover.tsx` — wraps `@base-ui/react/popover` (Root, Trigger, Positioner, Popup). Same pattern as existing `card.tsx`, `button.tsx` — this project uses base-ui, not Radix.
- `frontend/src/components/ui/calendar.tsx` — wraps `react-day-picker` v9.14.0 with shadcn theming. Supports `mode="range"` and `numberOfMonths` props. Uses `Button` (already styled) for day cells and navigation chevrons.
- `button.tsx` was reported as "skipped — identical"; no diff.

### dateUtils (Task 1)

`frontend/src/lib/dateUtils.ts` exports:

```ts
export type Preset = "thisMonth" | "thisQuarter" | "thisYear" | "allTime";
export function getPresetRange(preset: Preset): { from?: Date; to?: Date };
export function toApiDate(d: Date | undefined): string | undefined; // yyyy-MM-dd
```

Built on `date-fns@4.1.0` (already installed in Plan 02).

### Dashboard Components (Task 1)

- **`KpiCard`** (`frontend/src/components/dashboard/KpiCard.tsx`) — props: `label`, `value?`, `isLoading`. Card with `p-6`, UI-SPEC label (`text-xs font-semibold uppercase tracking-wide text-muted-foreground`) and display value (`text-3xl font-semibold tabular-nums`). Loading state renders two `animate-pulse bg-muted` skeleton blocks.
- **`KpiCardGrid`** (`frontend/src/components/dashboard/KpiCardGrid.tsx`) — props: `startDate?`, `endDate?`. `useQuery({ queryKey: kpiKeys.summary(startDate, endDate), queryFn: () => fetchKpiSummary(startDate, endDate) })`. Formats values via `Intl.NumberFormat(i18n.language === 'de' ? 'de-DE' : 'en-US', {...})`. 3-column grid at `lg:` (`grid-cols-1 lg:grid-cols-3 gap-8`), single column below (INFR-03). Renders exclusion-note disclosure below the grid. Error state: inline destructive-bordered card with retry copy (no toast).
- **`DateRangeFilter`** (`frontend/src/components/dashboard/DateRangeFilter.tsx`) — props: `value`, `onChange`. Renders 4 preset `Button`s whose active state uses `variant="default"` (UI-SPEC accent reservation #3, resolves to `bg-primary`), plus a `Custom…` `PopoverTrigger render={<Button variant="outline" />}` wrapping a shadcn `<Calendar mode="range" numberOfMonths={2}>` with Reset and Apply range controls.

### DashboardPage composition (Task 2)

`frontend/src/pages/DashboardPage.tsx` now:

```tsx
const [range, setRange] = useState<DateRangeValue>(() => {
  const initial = getPresetRange("thisYear");
  return { from: initial.from, to: initial.to };
});
const startDate = toApiDate(range.from);
const endDate = toApiDate(range.to);
```

Layout: `max-w-7xl mx-auto px-6 py-8 space-y-8` with `<DateRangeFilter value={range} onChange={setRange} />` followed by `<KpiCardGrid startDate={startDate} endDate={endDate} />`. Plan 04 adds `<RevenueChart startDate={startDate} endDate={endDate} />` immediately below `KpiCardGrid` without touching the state.

### i18n Coverage

25 new keys added to both `frontend/src/locales/en.json` and `frontend/src/locales/de.json`:

- `dashboard.kpi.{totalRevenue,averageOrderValue,totalOrders}.label`, `dashboard.kpi.exclusionNote`
- `dashboard.filter.{label,thisMonth,thisQuarter,thisYear,allTime,custom,from,to,apply,reset}`
- `dashboard.empty.{heading,body,cta}`, `dashboard.emptyFiltered.{heading,body}`
- `dashboard.error.{heading,body,retry}`

DE copy per UI-SPEC Copywriting Contract tables (Gesamtumsatz, Durchschnittlicher Auftragswert, Aufträge gesamt, Dieses Jahr, Benutzerdefiniert…, etc.).

## Verification

- `docker compose exec frontend npx tsc --noEmit` → exit 0 (clean)
- `curl -sf 'http://localhost:8000/api/kpis?start_date=2026-01-01&end_date=2026-12-31'` → HTTP 200, returns `{total_revenue:"793913.75", avg_order_value:"8536.70...", total_orders:93}`
- `curl -sf http://localhost:5173/` → HTTP 200 (Vite dev server healthy post-HMR)
- Grep acceptance checks:
  - `text-3xl font-semibold tabular-nums` present in `KpiCard.tsx`
  - `grid-cols-1 lg:grid-cols-3 gap-8` present in `KpiCardGrid.tsx`
  - `currency: "EUR"` + `style: "currency"` present
  - `mode="range"` + `numberOfMonths={2}` + `from "react-day-picker"` present in `DateRangeFilter.tsx`
  - `getPresetRange("thisYear")` + `<DateRangeFilter` + `<KpiCardGrid` + `startDate={startDate}` + `endDate={endDate}` + `max-w-7xl mx-auto px-6 py-8` present in `DashboardPage.tsx`
  - `Gesamtumsatz`, `Gesamter Zeitraum` in `de.json`; `Total revenue` in `en.json`

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | `PopoverTrigger render={<Button />}` instead of `asChild` | shadcn in this repo wraps `@base-ui/react/popover`, which uses the `render` prop idiom; Radix-style `asChild` does not exist here. Confirmed by reading `src/components/ui/popover.tsx` and `node_modules/@base-ui/react/popover/trigger/PopoverTrigger.d.ts`. |
| 2 | `useState(() => ...)` initializer for default range | Avoids recomputing `new Date()` + date-fns calls on every render; preserves D-13 exactly. |
| 3 | Wrap grid+exclusion-note in `<div>` instead of Fragment | DashboardPage uses `space-y-8` to separate filter from grid; a Fragment would let space-y collapse across the two sibling groups. One block = correct vertical rhythm. |
| 4 | Error state inline (not toast) | UI-SPEC explicitly: "Shown inline in the card/chart area (not as a toast — toasts are for transient actions like upload, not background fetches)." |

## Deviations from Plan

**[Rule 1 — Bug] PopoverTrigger API difference caught before commit.**

- **Found during:** Task 1 authoring
- **Issue:** The plan specified `<PopoverTrigger asChild>`, which is the Radix idiom. This project uses `@base-ui/react/popover`, which does not support `asChild` — it uses a `render` prop. Writing the Radix pattern would have caused a TypeScript error and a runtime double-render.
- **Fix:** Used `<PopoverTrigger render={<Button type="button" variant="outline" size="sm" />}>` per base-ui docs.
- **Files modified:** `frontend/src/components/dashboard/DateRangeFilter.tsx`
- **Commit:** `3c65c98`

No other deviations. Both tasks executed as specified.

## Interaction Contract Delivered

1. ✅ Initial load: date range = current calendar year (D-13), cards fetch `/api/kpis?start_date=2026-01-01&end_date=2026-12-31`
2. ✅ Clicking a preset: `activePreset` updates → `onChange` bubbles → parent state → `kpiKeys.summary(start,end)` queryKey changes → TanStack Query refetches automatically
3. ✅ Custom popover: opens below trigger, calendar in range mode with 2 months visible, Apply commits and closes, Reset returns to "thisYear" default and closes
4. ✅ Skeleton state: 2 `animate-pulse bg-muted` blocks per card while loading
5. ✅ Error state: inline destructive-bordered card with i18n error heading and body
6. ✅ i18n: every string has both `de` and `en` keys
7. ✅ Responsive: `grid-cols-1 lg:grid-cols-3` — collapses to single column <1024px per INFR-03
8. ✅ No TypeScript errors anywhere in `frontend/src`

## Known Stubs

None. This plan wires real data end-to-end. The only remaining dashboard element is the revenue chart, which is Plan 04's responsibility and is explicitly marked with a placeholder comment in `DashboardPage.tsx`.

## Deferred Items

None.

## Self-Check: PASSED

- Found: `frontend/src/components/ui/popover.tsx`
- Found: `frontend/src/components/ui/calendar.tsx`
- Found: `frontend/src/lib/dateUtils.ts`
- Found: `frontend/src/components/dashboard/KpiCard.tsx`
- Found: `frontend/src/components/dashboard/KpiCardGrid.tsx`
- Found: `frontend/src/components/dashboard/DateRangeFilter.tsx`
- Found: `frontend/src/pages/DashboardPage.tsx` (updated with composed layout)
- Found commit: `3c65c98` (Task 1)
- Found commit: `677c9cd` (Task 2)
- `docker compose exec frontend npx tsc --noEmit` → exit 0
- Backend `/api/kpis` HTTP 200 with date range filters
- Vite dev server HTTP 200

---
*Phase: 03-dashboard-frontend*
*Completed: 2026-04-11*
