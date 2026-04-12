---
phase: 09
phase_name: Frontend — KPI Card Dual Deltas
milestone: v1.2
created: 2026-04-11
---

# Phase 9 — Context and Decisions

## Goal (from ROADMAP.md)

Users see at-a-glance growth signals on every summary card — two compact delta badges (vs. Vorperiode, vs. Vorjahr) render below each value with up/down arrows, semantic colors, locale-correct percentage formatting, and an em-dash fallback (plus tooltip) whenever no baseline exists.

## Requirements in Scope

CARD-01 (dual badges on all 3 cards), CARD-02 (arrow + color), CARD-03 (locale % format), CARD-04 (em-dash null fallback + tooltip), CARD-05 (contextual secondary labels).

## Scouting Findings

- [DateRangeFilter.tsx:27](frontend/src/components/dashboard/DateRangeFilter.tsx#L27) — owns `activePreset` as local state; DashboardPage only receives `{from, to}`, not the preset identity. Must be lifted.
- [dateUtils.ts:13-25](frontend/src/lib/dateUtils.ts#L13-L25) — `thisMonth`/`thisQuarter`/`thisYear` currently resolve to full calendar periods including future dates. Must change for to-date semantics.
- [KpiCardGrid.tsx:12-66](frontend/src/components/dashboard/KpiCardGrid.tsx#L12-L66) — uses `fetchKpiSummary(start, end)` (2 args). Must forward the 4 new `prev_*` params. Query key `kpiKeys.summary(start, end)` must expand to include prev bounds so cache invalidates on filter change.
- [KpiCard.tsx](frontend/src/components/dashboard/KpiCard.tsx) — 26 LOC pure presentational card with no extension slot. Needs a `delta?: ReactNode` slot prop.
- [api.ts:47-73](frontend/src/lib/api.ts#L47-L73) — `KpiSummary` interface + `fetchKpiSummary` still on the pre-v1.2 shape. Must extend with nullable `previous_period` / `previous_year` fields matching the Phase 8 Pydantic schema, and pass the 4 prev_* params through the query string.
- [DashboardPage.tsx:10-27](frontend/src/pages/DashboardPage.tsx#L10-L27) — single React state `range`, defaults to `thisYear`. Will gain `activePreset` state. Both are passed down to children.
- `date-fns` already installed ([dateUtils.ts:1-9](frontend/src/lib/dateUtils.ts#L1-L9)) — will reuse `startOfMonth/Quarter/Year` + `subMonths/subQuarters/subYears` + `addDays/differenceInDays`.
- Existing locale keys live in `frontend/src/locales/en.json` + `de.json`. Phase 11 handles the full locale parity pass — but Phase 9 lands the EN keys it needs at definition time (same pattern Phase 6 used).

## Gray Area Decisions

### A. Preset semantics — **CLAMP END TO TODAY (to-date)** ⭐ user decision

**Decision:** Redefine `getPresetRange` so every calendar preset resolves to a to-date (MTD/QTD/YTD) window:
- `thisMonth` → `[startOfMonth(today), today]`
- `thisQuarter` → `[startOfQuarter(today), today]`
- `thisYear` → `[startOfYear(today), today]`
- `allTime` → `{from: undefined, to: undefined}` (unchanged)

**Why:** Dual delta badges are only meaningful when the current window and the prior window have the **same length**. Comparing 11 days of April (today is Apr 11) against a full 30-day March is misleading. To-date semantics make "vs. März" an exact day-for-day comparison.

**Side benefits:**
- Chart x-axis no longer shows empty future buckets for year view.
- Matches what users mentally expect "Dieses Jahr" to mean (YTD, not all of 2026 including December).

**Impact:** This is a behavior change to a v1.0 utility. Phase 9 plans must:
- Update `getPresetRange` (with updated JSDoc noting the change).
- Update `DashboardPage` to not depend on `endOfYear` semantics.
- No migration needed — the state is not persisted.

---

### B. Active preset state location — **LIFT TO DashboardPage** ⭐ user decision

**Decision:** Move `activePreset` state from inside `DateRangeFilter` up to `DashboardPage`. `DateRangeFilter` becomes a fully controlled component:

```tsx
interface DateRangeFilterProps {
  value: DateRangeValue;
  preset: Preset | null; // null = custom range
  onChange: (value: DateRangeValue, preset: Preset | null) => void;
}
```

`DashboardPage` holds both `range` and `activePreset` in tandem; they update together whenever the user picks a preset or applies a custom range. `KpiCardGrid` and `RevenueChart` receive `preset` as a prop alongside the existing `startDate`/`endDate`.

**Why:** `preset` is the single signal that drives (a) the prev-period bounds math and (b) the contextual secondary label. Keeping it local to `DateRangeFilter` would force every consumer to re-derive it (fragile). Lifting is cheap, explicit, and single-source-of-truth.

**Out of scope for Phase 9:** React context wrapper. Two consumers (KpiCardGrid, RevenueChart) don't justify a provider.

---

### C. Prev-period bounds math — **pure utility keyed on `{preset, range}`** (Claude default)

**Decision:** A new pure-function module `frontend/src/lib/prevBounds.ts` exports:

```ts
export interface PrevBounds {
  prev_period_start?: string; // YYYY-MM-DD
  prev_period_end?: string;
  prev_year_start?: string;
  prev_year_end?: string;
}

export function computePrevBounds(
  preset: Preset | null,
  range: { from?: Date; to?: Date },
): PrevBounds;
```

**Rules (matching Phase 8 CONTEXT decision C/D and the user's earlier clarification):**

| Preset | current | prev_period | prev_year |
|--------|---------|-------------|-----------|
| `thisMonth` | `[Apr 1, Apr 11]` | `[Mar 1, Mar 11]` (prev month, same day offset) | `[Apr 1 2025, Apr 11 2025]` |
| `thisQuarter` | `[Apr 1, Apr 11]` | `[Jan 1, Jan 11]` (prev quarter, same day offset) | `[Apr 1 2025, Apr 11 2025]` |
| `thisYear` | `[Jan 1, Apr 11]` | **`undefined`** (collapses with prev_year — decision D) | `[Jan 1 2025, Apr 11 2025]` |
| `allTime` | `{}` | `undefined` | `undefined` |
| `custom` (null preset) | `[from, to]` | `[from - N days, to - N days]` where `N = differenceInDays(to, from) + 1` | `[subYears(from, 1), subYears(to, 1)]` |

**Day-offset derivation** (for preset paths): use `date-fns` `differenceInDays(today, startOf{Month|Quarter|Year}(today))` to find how many days into the period we are, then apply the same offset to the prior period start.

**Why this lives in a standalone module:**
- Trivially unit-testable (pure function, no React, no network).
- Reusable by both `KpiCardGrid` (summary endpoint) and `RevenueChart` (chart endpoint) in Phase 10.
- Keeps the bounds-computation logic out of components.

**Returns `undefined` not `null`** because `URLSearchParams` works better with optional strings, and passing `undefined` query params makes the fetch layer omit them naturally.

---

### D. Contextual secondary labels — **pure utility, locale-aware via `Intl`** ⭐ user decision

**Decision:** A new pure-function module `frontend/src/lib/periodLabels.ts` exports:

```ts
export function formatPrevPeriodLabel(
  preset: Preset | null,
  prevPeriodStart: Date | null,
  locale: "de" | "en",
): string;

export function formatPrevYearLabel(
  prevYearStart: Date | null,
  locale: "de" | "en",
): string;
```

**Output rules:**

| Preset | `formatPrevPeriodLabel` | `formatPrevYearLabel` |
|--------|-------------------------|------------------------|
| `thisMonth` (DE) | "vs. März" (full month name via `Intl.DateTimeFormat('de-DE', {month: 'long'})`) | "vs. Apr. 2025" |
| `thisMonth` (EN) | "vs. March" | "vs. Apr 2025" |
| `thisQuarter` (DE) | "vs. Q1" (quarter extracted from `prevPeriodStart`) | "vs. Q2 2025" |
| `thisQuarter` (EN) | "vs. Q1" | "vs. Q2 2025" |
| `thisYear` | `"—"` (no prev period for year scope — caller renders em-dash badge) | "vs. 2025" |
| `allTime` | `"—"` | `"—"` |
| `custom` (short, < 7d) | "vs. {N} Tage zuvor" (DE) / "vs. {N} days earlier" (EN) | "vs. {YYYY}" or explicit range |
| `custom` (generic) | "vs. Vorperiode" (DE) / "vs. previous period" (EN) | "vs. {date-range prev year}" |

**Why a utility (not i18next interpolation):**
- Month names and quarter logic are locale-mechanical (Intl), not translation strings.
- Pure function is unit-testable with fixed dates and locales.
- i18next still owns the static strings ("vs.", "Tage zuvor", "Vorperiode") via keys; the utility composes them.

**i18n keys needed (EN side lands in Phase 9, DE parity lands in Phase 11):**

```json
"dashboard.delta.vsShortPeriod": "vs. {{count}} days earlier",
"dashboard.delta.vsShortPeriod_one": "vs. 1 day earlier",
"dashboard.delta.vsCustomPeriod": "vs. previous period",
"dashboard.delta.vsYear": "vs. {{year}}",
"dashboard.delta.noBaseline": "No comparison period available",
"dashboard.delta.noBaselineTooltip": "No comparison period available"
```

---

### E. KpiCard extension — **`delta?: ReactNode` slot prop** ⭐ user decision

**Decision:** Extend `KpiCard` with one new optional prop:

```tsx
interface KpiCardProps {
  label: string;
  value?: string;
  isLoading: boolean;
  delta?: ReactNode; // NEW: rendered below the value
}
```

Delta content is rendered below the `<p className="text-3xl ...">` value line, inside the same Card, with `mt-3` spacing. When `delta` is undefined, the card renders exactly as v1.1 (backwards-compatible).

**Why:** One-line API change. `KpiCard` stays a dumb presentational component. The orchestration (compute delta, pick label, choose color) lives in `KpiCardGrid`, which is the natural owner of data + display.

**New component: `DeltaBadgeStack`** at `frontend/src/components/dashboard/DeltaBadgeStack.tsx`:

```tsx
interface DeltaBadgeStackProps {
  current: number;
  prevPeriod: number | null;
  prevYear: number | null;
  prevPeriodLabel: string;
  prevYearLabel: string;
}
```

Renders two stacked rows (flex column, gap-1). Each row is a `DeltaBadge` + muted secondary label.

**New component: `DeltaBadge`** at `frontend/src/components/dashboard/DeltaBadge.tsx`:
- `▲` + positive green (semantic `text-primary` since we don't have a distinct "success" token — acceptable for v1.2; Phase 10 can split if needed) OR `▼` + `text-destructive`.
- `—` grayscale (`text-muted-foreground`) when the delta is null.
- Hover tooltip on em-dash uses existing shadcn Tooltip component.
- Locale-aware percentage via `Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })`. Handles DE comma decimal separator automatically.

---

### F. `computeDelta` pure function (Claude default)

**Decision:** `frontend/src/lib/delta.ts`:

```ts
export function computeDelta(current: number, prior: number | null): number | null {
  if (prior === null || prior === 0) return null;
  return (current - prior) / prior;
}
```

- `null` input → `null` output.
- Divide-by-zero (prior is legitimately 0, not just null) also returns `null` — no `∞%` badge ever rendered.
- Unit tests: (a) normal positive delta, (b) normal negative delta, (c) null prior, (d) zero prior, (e) zero current / nonzero prior (−100%).

---

## Performance Notes

- Summary endpoint now costs 3 sequential DB round-trips (per Phase 8 decision) — latency is still <200ms for realistic data volumes.
- TanStack Query cache key must include prev bounds so `[preset, range]` filter change invalidates properly:
  ```ts
  queryKey: kpiKeys.summary(startDate, endDate, prevBounds)
  ```
  Phase 9 plan should update `kpiKeys` accordingly.
- No new libraries. `date-fns` already present. `Intl.DateTimeFormat` + `Intl.NumberFormat` built-in.

## i18n

- **EN locale keys lands in Phase 9** (same file-local pattern as Phase 6 used for WCAG contrast badges).
- **DE parity lands in Phase 11** via the dedicated locale pass.
- Do NOT edit `frontend/src/locales/de.json` in Phase 9 — Phase 11 will do the informal "du" pass on the full milestone surface.

## Out of Scope (Phase 9 only)

- **Chart overlay rendering.** The `previous` field on the chart response stays silently ignored (per Phase 8 08-03 already) — Phase 10 wires the visual overlay.
- **Manual comparison-mode toggle.** REQUIREMENTS Out-of-Scope.
- **Sparse-prior bucket fix** from Phase 8 known limitation — that's Phase 10's call if the visual needs it.
- **DE locale parity** — Phase 11.
- **Mobile responsive refinement of the card grid** — the v1.0 `grid-cols-1 lg:grid-cols-3` handles small screens; two extra lines per card don't break it visibly.

## Downstream Agent Contract

**gsd-phase-researcher:** Skip research. Stack is known (React + TanStack Query + date-fns + shadcn Tooltip + Intl). No new libs.

**gsd-planner:** Produce plans matching the roadmap's 3-plan breakdown for Phase 9:

1. **09-01** — Foundation / pure-function layer:
   - Update `getPresetRange` in [dateUtils.ts](frontend/src/lib/dateUtils.ts) to to-date semantics
   - Update `KpiSummary` type + `fetchKpiSummary` signature + `kpiKeys.summary` in [api.ts](frontend/src/lib/api.ts) / [queryKeys.ts](frontend/src/lib/queryKeys.ts)
   - Create `frontend/src/lib/delta.ts` (`computeDelta`)
   - Create `frontend/src/lib/prevBounds.ts` (`computePrevBounds`)
   - Create `frontend/src/lib/periodLabels.ts` (`formatPrevPeriodLabel`, `formatPrevYearLabel`)
   - Unit tests for all 3 new utilities + updated `getPresetRange`
   - No component changes yet.

2. **09-02** — Presentational components:
   - Create `DeltaBadge.tsx` + `DeltaBadgeStack.tsx`
   - Extend `KpiCard.tsx` with `delta?: ReactNode` slot
   - Add 6 EN locale keys for delta strings (see section D above)
   - No dashboard wiring yet — components can be previewed via Storybook-style test rendering if desired, but no Storybook dep is introduced.

3. **09-03** — Dashboard integration + human verification:
   - Lift `activePreset` state from `DateRangeFilter` to `DashboardPage`
   - Make `DateRangeFilter` fully controlled
   - Wire `KpiCardGrid` to (a) fetch with prev bounds, (b) compute contextual labels, (c) render `DeltaBadgeStack` per card via the new slot
   - Human verification checkpoint (D-XX): render real data at 1080p + 1440p, verify all 4 preset behaviors including "Dieses Jahr" em-dash, verify DE/EN percentage formatting (DE comma, EN period).
   - DO NOT touch `RevenueChart` — Phase 10 territory.

**Plans MUST NOT:**
- Add new libraries. Use `Intl.*`, `date-fns`, `@tanstack/react-query`, `shadcn/ui` tooltip already present.
- Edit `frontend/src/locales/de.json` (Phase 11).
- Touch `RevenueChart.tsx` beyond keeping it building.
- Break any v1.0 test. Dashboard tests (if any) must still pass.
- Introduce Storybook or any new testing framework.
