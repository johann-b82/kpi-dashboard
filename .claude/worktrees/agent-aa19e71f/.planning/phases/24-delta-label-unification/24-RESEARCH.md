# Phase 24: Delta Label Unification - Research

**Researched:** 2026-04-14
**Domain:** Frontend i18n refactor — shared delta label namespace, absolute→relative migration
**Confidence:** HIGH

## Summary

Phase 24 replaces the Sales dashboard's dynamic, Intl-formatted delta labels (`vs. April`, `vs. Apr. 2025`, `vs. Q1`) with static, i18n-keyed relative labels that already exist on the HR dashboard (`vs. prev. month` / `vs. Vormonat`, etc.), plus adds a new `prevQuarter` variant. Both `KpiCardGrid.tsx` and `HrKpiCardGrid.tsx` will read from a single `kpi.delta.{prevMonth,prevQuarter,prevYear}` namespace. The `hr.kpi.delta.*` keys are deleted (no compat shim per D-02). `DeltaBadge` and `DeltaBadgeStack` component props are unchanged — they already accept pre-resolved label strings.

The single most important research finding is a **direct contradiction of D-07/D-08**: `frontend/src/lib/periodLabels.ts` has an active consumer outside the delta-badge code path. `RevenueChart.tsx` imports `formatChartSeriesLabel` (line 31, line 95) for chart legend labels — and Phase 24 explicitly scopes chart labels OUT (see `<deferred>` in CONTEXT.md). D-07 "delete the file entirely" is not achievable without breaking the chart. **The planner MUST fall back to the D-08 "strip only" path** and keep `formatChartSeriesLabel` (plus its internal dependencies `getLocalizedMonthName`, `LOCALE_TAG`, `ChartLabelT`, `SupportedLocale`, `ChartSeriesLabels`, and the `subMonths`/`DateRangeValue`/`Preset` imports) in the file.

**Primary recommendation:** 1 plan. Scope is ~6 locale-file key changes, ~7 lines in `KpiCardGrid.tsx`, ~2 lines in `HrKpiCardGrid.tsx`, and a partial strip of `periodLabels.ts` (delete `formatPrevPeriodLabel`, `formatPrevYearLabel`, and the `EM_DASH` constant if it has no other reference — keep everything else). Verification = `check-locale-parity.mts` exits 0 + manual visual on `/` and `/hr` in DE and EN.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**i18n Namespace**
- D-01: New shared namespace `kpi.delta.*` with keys `prevMonth`, `prevQuarter`, `prevYear`. Both `KpiCardGrid.tsx` and `HrKpiCardGrid.tsx` consume it.
- D-02: Migrate off `hr.kpi.delta.prevMonth` / `hr.kpi.delta.prevYear` — move values to `kpi.delta.*` and delete the old `hr.kpi.delta.*` entries from both `locales/en.json` and `locales/de.json`. Breaking key rename, no backwards-compat shim.
- D-03: Key shape camelCase (`prevMonth`, not `prev_month` / `prev.month`).

**Label Copy**
- D-04: EN — `vs. prev. month`, `vs. prev. quarter`, `vs. prev. year`.
- D-05: DE — `vs. Vormonat`, `vs. Vorquartal`, `vs. Vorjahr`.
- D-06: Keep `vs.` prefix in both languages (not `ggü.`).

**periodLabels.ts Fate**
- D-07: Delete `frontend/src/lib/periodLabels.ts` entirely — the file only serves delta-badge labels today.
- D-08: Planner MUST grep-verify zero remaining imports of `periodLabels` / `formatPrevPeriodLabel` / `formatPrevYearLabel` across `frontend/src/` before deleting. If any unexpected consumer surfaces, fallback is "strip only" for that symbol — default is full delete.
- D-09: Remove `LOCALE_TAG` map and any `Intl.DateTimeFormat` helper logic if no other call sites.

**Granularity Mapping**
- D-10: Consumers resolve granularity from existing date-range `preset` state (Sales) and HR sync period (implicit monthly/quarterly/yearly).
- D-11: Mapping — preset `thisMonth` → `kpi.delta.prevMonth`; `thisQuarter` → `kpi.delta.prevQuarter`; `thisYear` → `kpi.delta.prevYear`. HR keeps its two-badge layout (prev-month + prev-year), just reads from new keys.

**Null / allTime State**
- D-12: When preset is `allTime` or null (no comparable period), HIDE the delta badge entirely. Do NOT show a placeholder `—` / generic `vs. prev. period` fallback.
- D-13: Implementation — existing `DeltaBadge` / `DeltaBadgeStack` already handle no-data via null/undefined delta; confirm path hides cleanly, or add hide-when-preset-is-null branch at the consumer.

**DE/EN Parity Guard**
- D-14: `scripts/check-locale-parity.mts` must exit 0 after migration.
- D-15: Parity script runs in phase verification (not a new plan).

### Claude's Discretion
- i18n file structure (inline vs separate section under `kpi.*`)
- Whether to consolidate Sales `useTranslation` call site alongside refactor
- Exact DeltaBadge prop shape (if `granularity` / `hidden` prop needed)
- Whether to write a unit test for granularity → label-key mapping (optional)

### Deferred Ideas (OUT OF SCOPE)
- Chart prior-period overlay legend (stays absolute-formatted)
- HR quarterly KPI third badge (the prevQuarter key's existence satisfies UC-02)
- DE formal prefix migration (`ggü.` instead of `vs.`)
- Unit tests for granularity → label-key mapping (discretionary)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UC-01 | Sales KPI card delta badges show relative labels matching HR (`vs. prev. month`/`vs. Vormonat`, `vs. prev. year`/`vs. Vorjahr`) | `KpiCardGrid.tsx` currently calls `formatPrevPeriodLabel` / `formatPrevYearLabel` (absolute). Replace with `t("kpi.delta.prevMonth")` / `t("kpi.delta.prevYear")` branched by preset. |
| UC-02 | Quarter granularity uses `vs. prev. quarter` / `vs. Vorquartal` on both Sales and HR | New i18n key `kpi.delta.prevQuarter` added to both locale files. Sales consumer picks it when preset = `thisQuarter`. HR keeps two-badge layout (key exists but unused by HR consumer — per CONTEXT §Conflicts). |
| UC-03 | All four delta labels live under single shared i18n namespace consumed by both grids | New `kpi.delta.*` namespace; delete `hr.kpi.delta.prevMonth` + `hr.kpi.delta.prevYear`; `noBaselineTooltip` stays under its existing key (`dashboard.delta.noBaselineTooltip` / `hr.kpi.noBaselineTooltip`) — CONTEXT says "four delta labels" meaning month/quarter/year plus null handling, not including the tooltips. |
| UC-04 | `periodLabels.ts` simplified — absolute-period formatters removed if no consumer remains; or retired entirely if all call sites migrate | **Cannot fully retire.** `RevenueChart.tsx` imports `formatChartSeriesLabel` from this file. Strip only the delta-badge helpers (`formatPrevPeriodLabel`, `formatPrevYearLabel`). Keep `formatChartSeriesLabel`, `getLocalizedMonthName`, `LOCALE_TAG`, type exports. |
| UC-05 | Full DE/EN parity — new keys in both locale files, `scripts/check-locale-parity.mts` passes | Existing script at `frontend/scripts/check-locale-parity.mts` — compares key sets of `en.json` vs `de.json`, exits 0 on match, 1 + diff on mismatch. No script changes needed; just ensure every add/delete is mirrored. |
</phase_requirements>

## Canonical Code Inventory (verified)

### Sales call site — `frontend/src/components/dashboard/KpiCardGrid.tsx`

Lines 21–24 import:
```ts
import {
  formatPrevPeriodLabel,
  formatPrevYearLabel,
} from "@/lib/periodLabels";
```

Lines 63–82 resolve labels via:
```ts
const prevPeriodStartDate = prevBounds.prev_period_start
  ? new Date(prevBounds.prev_period_start) : null;
const prevYearStartDate = prevBounds.prev_year_start
  ? new Date(prevBounds.prev_year_start) : null;
const rangeLengthDays = range.from && range.to
  ? differenceInDays(range.to, range.from) + 1 : undefined;
const prevPeriodLabel = formatPrevPeriodLabel(
  preset, prevPeriodStartDate, shortLocale, t, rangeLengthDays,
);
const prevYearLabel = formatPrevYearLabel(prevYearStartDate, shortLocale);
```

The `preset` prop (line 30) is typed `Preset | null`, where `Preset = "thisMonth" | "thisQuarter" | "thisYear" | "allTime"` (verified in `frontend/src/lib/dateUtils.ts` line 8).

Line 84 already resolves `noBaselineTooltip` via `t("dashboard.delta.noBaselineTooltip")` — **reuse, do not rename**.

### HR call site — `frontend/src/components/dashboard/HrKpiCardGrid.tsx`

Lines 102–105:
```ts
prevPeriodLabel={t("hr.kpi.delta.prevMonth")}
prevYearLabel={t("hr.kpi.delta.prevYear")}
locale={shortLocale}
noBaselineTooltip={t("hr.kpi.noBaselineTooltip")}
```

Note: `t("hr.kpi.noBaselineTooltip")` is NOT in scope for rename — it's a tooltip, not a delta label.

### Component contracts (unchanged)

`DeltaBadgeStack` props (`DeltaBadgeStack.tsx` lines 24–31):
```ts
export interface DeltaBadgeStackProps {
  prevPeriodDelta: number | null;
  prevYearDelta: number | null;
  prevPeriodLabel: string;
  prevYearLabel: string;
  locale: DeltaLocale;
  noBaselineTooltip: string;
}
```

Prop shape is already string-typed — no `granularity` or `hidden` prop needed (per CONTEXT's "Claude's Discretion"). Consumers resolve the right string before passing in.

### Locale files — current state

`frontend/src/locales/en.json`:
- Line 46: `"hr.kpi.delta.prevMonth": "vs. prev. month"`
- Line 47: `"hr.kpi.delta.prevYear": "vs. prev. year"`
- Line 54: `"hr.kpi.noBaselineTooltip": "No comparison period available"` (KEEP — not in scope)
- Lines 112–117: `dashboard.delta.*` family — `vsShortPeriod`, `vsShortPeriod_one`, `vsCustomPeriod`, `vsYear`, `noBaseline`, `noBaselineTooltip`

`frontend/src/locales/de.json` mirrors the same keys (lines 46, 47, 54, 112–117). Both files use **flat dot-notation keys** (`"a.b.c": "value"`), not nested JSON objects — verified by grep output.

**Implication for D-03 (camelCase):** `prevMonth` / `prevQuarter` / `prevYear` are fine as the leaf segment in a flat dot-keyed JSON. Do NOT refactor to nested objects — would be out-of-scope and would require adjusting `i18next` init config.

### Unreferenced-after-removal check

After removing the Sales delta-badge-label call (the two `formatPrev*` functions), the following `dashboard.delta.*` keys become orphaned:
- `dashboard.delta.vsShortPeriod` (only used in `formatPrevPeriodLabel`)
- `dashboard.delta.vsShortPeriod_one` (pluralization pair of above)
- `dashboard.delta.vsCustomPeriod` (only used in `formatPrevPeriodLabel`)
- `dashboard.delta.vsYear` — verify; I did not find active consumers
- `dashboard.delta.noBaseline` — verify; may be used in chart legend

**Planner action:** grep each of these five keys AFTER the refactor. Any with zero consumers should be deleted from BOTH locale files (preserves parity). This is in the spirit of UC-04 "simplified" but is additional work beyond what CONTEXT explicitly requires. **Recommended to include** because leaving dead i18n keys violates UC-04's simplification intent.

### Parity script — `frontend/scripts/check-locale-parity.mts`

- Reads both locale JSON files as flat `Record<string, string>`.
- Computes `Set` of keys from each; reports `MISSING_IN_DE` / `MISSING_IN_EN`.
- Exit 0 if both sets identical; exit 1 with diff on mismatch.
- Run command: `node --experimental-strip-types frontend/scripts/check-locale-parity.mts`.
- No changes needed to the script.

## periodLabels.ts Audit (CRITICAL FINDING)

**D-07/D-08 cannot be satisfied as written.** The file has non-delta-badge consumers:

| Symbol in `periodLabels.ts` | Consumer | Status after Phase 24 |
|-----------------------------|----------|-----------------------|
| `formatPrevPeriodLabel` | `KpiCardGrid.tsx` only | DELETE |
| `formatPrevYearLabel` | `KpiCardGrid.tsx` only | DELETE |
| `formatChartSeriesLabel` | `RevenueChart.tsx` line 31, 95 | **KEEP** (chart is out of scope) |
| `getLocalizedMonthName` | Used internally by `formatPrevPeriodLabel` and `formatChartSeriesLabel` | **KEEP** (needed by `formatChartSeriesLabel`) |
| `LOCALE_TAG` const | Used internally by `formatPrevYearLabel` only | **DELETE** (along with `formatPrevYearLabel`) |
| `EM_DASH` const | Used internally by `formatPrevPeriodLabel` and `formatPrevYearLabel` only | DELETE |
| `SupportedLocale` type export | Exported, may have external consumers | grep-verify before removing |
| `ChartLabelT` type alias | Module-private, used by both formatters | KEEP (still needed by `formatChartSeriesLabel`) |
| `ChartSeriesLabels` interface | Exported, used by `formatChartSeriesLabel` | KEEP |
| `subMonths` import from date-fns | Used only by `formatChartSeriesLabel` | KEEP |
| `DateRangeValue` type import | Used only by `formatChartSeriesLabel` | KEEP |
| `Preset` type import | Used by both formatters | KEEP |

**Additional grep needed before finalizing plan:** verify `SupportedLocale` type export has no external consumers. If zero, that export can be unexported but the type itself stays (used internally).

Grep evidence (run on `frontend/src/`):
```
frontend/src/lib/periodLabels.ts:20:const LOCALE_TAG = { de: "de-DE", en: "en-US" } as const;
frontend/src/components/dashboard/deltaFormat.ts:17:const LOCALE_TAG: Record<DeltaLocale, string> = { ... }
frontend/src/components/dashboard/KpiCardGrid.tsx:22-24: formatPrevPeriodLabel, formatPrevYearLabel
frontend/src/components/dashboard/RevenueChart.tsx:31: formatChartSeriesLabel
frontend/src/components/dashboard/DeltaBadgeStack.tsx:11-12: (doc-comment only, not an import)
```

`deltaFormat.ts` defines its OWN `LOCALE_TAG` locally — it does not import the one from `periodLabels.ts`. No conflict.

## Standard Stack

No new dependencies. All existing:

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| react-i18next | existing | `useTranslation()` hook in both call sites | Already wired; phase is pure JSON key additions |
| i18next | existing | Flat dot-keyed JSON parsing | Already configured — verified by locale files using flat `"a.b.c": "value"` shape |
| date-fns | existing | Stays for `differenceInDays` in KpiCardGrid (used for custom-range handling in Sales — but after removal of `formatPrevPeriodLabel`, `rangeLengthDays` becomes dead and can be deleted) | — |

**Installation:** none.

**Version verification:** skipped (no new packages).

## Architecture Patterns

### Recommended mapping function

Place the granularity → i18n-key mapping inline in `KpiCardGrid.tsx` as a small pure function. No new module file — it's 6 lines.

```ts
// Picks the delta-label i18n key for the current preset.
// Returns null when no comparison applies — caller hides the badge.
function prevPeriodLabelKey(preset: Preset | null): string | null {
  if (preset === "thisMonth") return "kpi.delta.prevMonth";
  if (preset === "thisQuarter") return "kpi.delta.prevQuarter";
  if (preset === "thisYear") return "kpi.delta.prevYear";
  // allTime or null (custom range) → no comparable prior period
  return null;
}
```

### Null/allTime hide strategy (D-12, D-13)

Two viable approaches; **recommend #1**:

**Option 1 (recommended) — Consumer-side skip:** In `KpiCardGrid`, when `prevPeriodLabelKey(preset) === null`, pass `delta={undefined}` (not a `<DeltaBadgeStack>`) to `KpiCard`. This matches how `KpiCard` already handles missing delta (renders no badge row). Minimal risk, no component changes.

**Option 2 — Component-side skip:** Add `hidden` prop to `DeltaBadgeStack`. More work, touches shared component, wider blast radius. Not recommended for this scope.

HR call site does NOT need this branch — HR's prev-month and prev-year comparisons are always applicable (monthly/yearly HR KPIs always have a comparable period by definition).

### Prev-year label behavior in Sales

Current behavior: `prevYearLabel` is absolute (`vs. Apr. 2025`) regardless of preset. New behavior: label is relative (`vs. prev. year` / `vs. Vorjahr`).

**When to show prev-year label in Sales:**
- `thisMonth` / `thisQuarter` / `thisYear` → show `kpi.delta.prevYear`
- `allTime` → hide (same as prevPeriod — no comparable year)
- `null` (custom range) → hide

This is a NEW simplification vs. the old behavior (which always rendered a prev-year label, falling back to em-dash for `allTime`). D-12 makes this explicit: hide rather than em-dash.

### Anti-patterns to avoid

- **Do NOT add backwards-compat shim** for `hr.kpi.delta.*` — D-02 is explicit.
- **Do NOT restructure locale JSON to nested objects** — project uses flat dot-keyed shape; a refactor would touch every key and every i18next call. Out of scope.
- **Do NOT delete `periodLabels.ts` fully** — breaks `RevenueChart.tsx`. Strip only.
- **Do NOT rename `hr.kpi.noBaselineTooltip`** — it's a tooltip, not a delta label. Scope creep.
- **Do NOT introduce a `granularity` prop on `DeltaBadge` / `DeltaBadgeStack`** — adds coupling for no benefit. Strings in, rendered out is the correct contract.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Preset → key mapping | Custom lookup registry / class / enum | Plain switch or if-chain inline | 4 preset values, one consumer. Over-abstraction costs more than it saves. |
| Locale file merging | Hand-written diff script | Existing `check-locale-parity.mts` | Already exists, verified working. |
| Null-preset hide logic | New `hidden` prop on shared component | Return `undefined` from consumer for the whole `DeltaBadgeStack` | `KpiCard` already handles undefined delta cleanly. |

**Key insight:** the existing component contract (pre-resolved strings in, rendered as-is out) is the right shape. Fight the temptation to push logic down into `DeltaBadgeStack` just because that's where the `span` is.

## Common Pitfalls

### Pitfall 1: Parity drift on deletion
**What goes wrong:** Delete `hr.kpi.delta.prevMonth` from `en.json` but forget `de.json` (or vice versa). `check-locale-parity.mts` flags it.
**Why it happens:** Two separate JSON files; no automated mirror.
**How to avoid:** After each edit, run the parity script. Treat it as the commit gate for this phase.
**Warning signs:** Script output shows `MISSING_IN_DE: hr.kpi.delta.prevMonth` or similar.

### Pitfall 2: Orphaned i18n keys
**What goes wrong:** `dashboard.delta.vsShortPeriod`, `vsCustomPeriod`, etc. become dead code after `formatPrevPeriodLabel` is deleted, but their keys stay in locale files — silent bitrot.
**Why it happens:** Parity script only checks cross-locale equality, not key-to-consumer mapping.
**How to avoid:** After the refactor, grep each `dashboard.delta.*` key; delete unreferenced ones from BOTH locale files.
**Warning signs:** None automated — requires manual grep audit.

### Pitfall 3: Hidden badge but visible "vs." label row
**What goes wrong:** `DeltaBadgeStack` renders two rows unconditionally — one for prev-period, one for prev-year. If the consumer passes empty strings, the rows still render blank.
**Why it happens:** The component has no "skip this row" branch.
**How to avoid:** When preset = `allTime` / null, pass `undefined` for the WHOLE `delta` prop on `KpiCard` (not `<DeltaBadgeStack prevPeriodLabel="" .../>`). Verified by reading `DeltaBadgeStack.tsx` lines 41–58.
**Warning signs:** In UAT, `allTime` preset shows empty rows under KPI values.

### Pitfall 4: `rangeLengthDays` import left behind
**What goes wrong:** `KpiCardGrid.tsx` imports `differenceInDays` from `date-fns` and computes `rangeLengthDays` ONLY for `formatPrevPeriodLabel`'s custom-range branch. After removing that call, `rangeLengthDays` and `differenceInDays` become unused.
**Why it happens:** Muscle memory — leaving helper setup in place.
**How to avoid:** After removing the formatter calls, delete `differenceInDays` import (line 10) and `rangeLengthDays` computation (lines 70–73).
**Warning signs:** TypeScript `noUnusedLocals` flags it — run `tsc --noEmit` after the edit.

### Pitfall 5: HR "two-badge" layout breaks if keys aren't mirrored
**What goes wrong:** HR's `DeltaBadgeStack` always renders both `prevPeriodLabel` and `prevYearLabel`. If only `prevMonth` is added under new namespace but not `prevYear`, one row goes blank.
**Why it happens:** Partial migration.
**How to avoid:** Add all three keys (`prevMonth`, `prevQuarter`, `prevYear`) atomically in a single commit; delete old `hr.kpi.delta.*` keys in the same commit.
**Warning signs:** HR dashboard shows `vs. Vormonat` but blank second badge.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — pure frontend refactor of display strings | None |
| Live service config | None — no external services involved | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no secret names referenced | None |
| Build artifacts | Vite HMR cache will pick up locale changes automatically. No stale artifacts expected. On fresh Docker build: no action needed — locale JSONs are bundled at build time. | Rebuild frontend image if deployed (standard). |

**Nothing found in any category requires special migration.** This is a string-swap refactor — no runtime state beyond the browser's i18n in-memory resource bundle, which is rebuilt on every page load.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node (for parity script) | `check-locale-parity.mts` | ✓ (assumed — used by prior phases) | — | — |
| react-i18next | Runtime i18n lookup | ✓ (pre-installed) | existing | — |
| TypeScript compiler | Verify no unused imports after strip | ✓ (assumed) | existing | — |

No new external dependencies. No blocking missing items.

## Code Examples

### Sales consumer (`KpiCardGrid.tsx`) — target shape

```ts
// Replaces lines 21-24 import block
// (deletes formatPrevPeriodLabel, formatPrevYearLabel import)

// Replaces lines 63-82 label resolution
function prevPeriodLabelKey(preset: Preset | null): string | null {
  if (preset === "thisMonth") return "kpi.delta.prevMonth";
  if (preset === "thisQuarter") return "kpi.delta.prevQuarter";
  if (preset === "thisYear") return "kpi.delta.prevYear";
  return null; // allTime or custom range — hide badges
}

const labelKey = prevPeriodLabelKey(preset);
const prevPeriodLabel = labelKey ? t(labelKey) : null;
const prevYearLabel = labelKey ? t("kpi.delta.prevYear") : null;
// Note: prev-year label shown whenever any comparison applies.
// Alternative: only show prev-year when labelKey !== "kpi.delta.prevYear"
// (avoids duplicate "vs. prev. year" rows on thisYear preset). See Open Questions.
```

```tsx
// Replaces DeltaBadgeStack rendering at lines 132-142 (and twin blocks)
delta={
  data && prevPeriodLabel && prevYearLabel ? (
    <DeltaBadgeStack
      prevPeriodDelta={revenueDeltas.prevPeriodDelta}
      prevYearDelta={revenueDeltas.prevYearDelta}
      prevPeriodLabel={prevPeriodLabel}
      prevYearLabel={prevYearLabel}
      locale={shortLocale}
      noBaselineTooltip={noBaselineTooltip}
    />
  ) : undefined
}
```

### HR consumer (`HrKpiCardGrid.tsx`) — target shape

Change lines 102–103 only:

```tsx
prevPeriodLabel={t("kpi.delta.prevMonth")}
prevYearLabel={t("kpi.delta.prevYear")}
```

### Locale file diff — `frontend/src/locales/en.json`

```diff
-  "hr.kpi.delta.prevMonth": "vs. prev. month",
-  "hr.kpi.delta.prevYear": "vs. prev. year",
+  "kpi.delta.prevMonth": "vs. prev. month",
+  "kpi.delta.prevQuarter": "vs. prev. quarter",
+  "kpi.delta.prevYear": "vs. prev. year",
```

### Locale file diff — `frontend/src/locales/de.json`

```diff
-  "hr.kpi.delta.prevMonth": "vs. Vormonat",
-  "hr.kpi.delta.prevYear": "vs. Vorjahr",
+  "kpi.delta.prevMonth": "vs. Vormonat",
+  "kpi.delta.prevQuarter": "vs. Vorquartal",
+  "kpi.delta.prevYear": "vs. Vorjahr",
```

### `periodLabels.ts` strip — target shape (abridged)

After strip, file keeps:
- `import { subMonths } from "date-fns";`
- `import type { DateRangeValue } from "../components/dashboard/DateRangeFilter.tsx";`
- `import type { Preset } from "./dateUtils.ts";`
- `export type SupportedLocale = "de" | "en";` (if no external consumer — otherwise remove `export`)
- `type ChartLabelT = ...` (module-private)
- `export function getLocalizedMonthName(...)` (needed by `formatChartSeriesLabel`)
- `export interface ChartSeriesLabels { ... }`
- `export function formatChartSeriesLabel(...)` (chart legend — out of scope, keep)

Deleted:
- `const EM_DASH`
- `const LOCALE_TAG`
- `export function formatPrevPeriodLabel(...)`
- `export function formatPrevYearLabel(...)`

## State of the Art

No "state of the art" shifts relevant — this is an internal refactor, not a framework migration. The i18n pattern (flat dot-keyed JSON + `useTranslation` hook) is established in-project and matches react-i18next v14+ conventions.

## Open Questions

### 1. Does prev-year label row make sense when preset = `thisYear`?

**What we know:** Sales' `DeltaBadgeStack` always renders two rows. When preset = `thisYear`, the "prev-period" IS the prev-year — so showing both `vs. prev. year` and `vs. prev. year` is redundant.

**What's unclear:** CONTEXT doesn't address this explicitly. D-11 mapping table says `thisYear → kpi.delta.prevYear` for the primary label but doesn't say whether the second (prev-year) badge should render at all for `thisYear` preset.

**Recommendation:** Planner asks the user OR makes a defensible choice:
- **Option A (simplest):** Keep both rows even for `thisYear` — accept visual redundancy. Matches current behavior.
- **Option B (cleaner UX):** When preset = `thisYear`, render only the prev-period row (hide the duplicate prev-year row). Requires a second branch at the consumer.

Decide in the planning phase; default to Option A if user is unavailable (preserves current behavior, zero UX regression risk).

### 2. Should orphaned `dashboard.delta.*` keys be deleted?

**What we know:** After removing `formatPrevPeriodLabel`, keys `vsShortPeriod`, `vsShortPeriod_one`, `vsCustomPeriod`, possibly `vsYear` and `noBaseline` become unused.

**What's unclear:** UC-04 says "simplified" without defining scope. CONTEXT doesn't list locale-key cleanup explicitly.

**Recommendation:** Include a grep-and-delete pass as the last step of the single plan. Document which keys were removed in the plan summary. Parity script will catch any asymmetry.

### 3. Is the `SupportedLocale` type export used outside `periodLabels.ts`?

**What we know:** It's exported. Grep didn't show external importers in `frontend/src/`, but I didn't run an exhaustive named-export trace.

**Recommendation:** Planner adds a grep step (`SupportedLocale` across `frontend/src/`) to the plan. If zero external uses, downgrade to internal (remove `export`). If any, keep as-is.

## Plan Decomposition Recommendation

**1 plan.** Rationale:

- Total surface: 2 component files, 2 locale files, 1 periodLabels strip, 1 grep audit for orphan keys. ~20–30 line-edits total.
- Atomicity matters: locale key renames + consumer updates + component imports MUST land together or the app breaks mid-commit.
- Verification is a single automated check (`check-locale-parity.mts`) + one manual UAT (visit `/` and `/hr` in DE and EN).
- Prior velocity (STATE.md): similar refactor plans run 1–4min with 1–3 tasks.

**Plan shape (suggested tasks inside the single plan):**
1. Add `kpi.delta.{prevMonth,prevQuarter,prevYear}` to both locale JSONs; delete `hr.kpi.delta.*` keys from both. Run parity script — must pass.
2. Update `HrKpiCardGrid.tsx` lines 102–103 to new key names. Build + typecheck.
3. Update `KpiCardGrid.tsx`: add `prevPeriodLabelKey` helper, swap formatter calls for `t()` calls, add hide-when-null branch, delete `differenceInDays` / `rangeLengthDays` / unused `prevPeriodStartDate` / `prevYearStartDate` wiring. Build + typecheck.
4. Strip `periodLabels.ts`: delete `formatPrevPeriodLabel`, `formatPrevYearLabel`, `LOCALE_TAG`, `EM_DASH`. Keep `formatChartSeriesLabel`, `getLocalizedMonthName`, types. Build + typecheck.
5. Grep audit: check each orphaned `dashboard.delta.*` key for remaining consumers; delete unused pairs from both locale files. Run parity script — must pass.
6. Manual UAT: visit `/` and `/hr` in DE and EN; confirm three granularities render correctly on Sales (`thisMonth`, `thisQuarter`, `thisYear`), confirm `allTime` hides badges, confirm HR shows `vs. Vormonat` / `vs. Vorjahr` / `vs. prev. month` / `vs. prev. year`.

Splitting this into two plans (locales + consumers) would add coordination overhead without safety benefit — because i18next renders the key name itself when a key is missing, a split commit would visibly break the UI between commits. Keep it atomic.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No unit test framework configured (project has zero `*.test.ts` / `*.spec.ts` under `frontend/src/`; verify in Wave 0) |
| Config file | none — verification is via locale-parity script + manual UAT |
| Quick run command | `node --experimental-strip-types frontend/scripts/check-locale-parity.mts` |
| Full suite command | same (only gate) + `npm --prefix frontend run build` (catches TS errors) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UC-01 | Sales shows `vs. prev. month` / `vs. prev. year` labels | manual-only (visual) | — | — |
| UC-02 | Quarter label `vs. prev. quarter` exists and renders on Sales when `thisQuarter` preset | manual-only (visual) + key-existence grep | `grep '"kpi.delta.prevQuarter"' frontend/src/locales/en.json frontend/src/locales/de.json` | ✅ post-plan |
| UC-03 | Single shared `kpi.delta.*` namespace; no `hr.kpi.delta.*` remaining | grep | `! grep -r 'hr.kpi.delta' frontend/src/` | ✅ existing |
| UC-04 | `periodLabels.ts` simplified — formatPrev* removed | grep | `! grep -q 'formatPrevPeriodLabel\|formatPrevYearLabel' frontend/src/` | ✅ existing |
| UC-05 | DE/EN parity | script | `node --experimental-strip-types frontend/scripts/check-locale-parity.mts` | ✅ existing |

### Sampling Rate
- **Per task commit:** `node --experimental-strip-types frontend/scripts/check-locale-parity.mts`
- **Per wave merge:** parity script + `npm --prefix frontend run build`
- **Phase gate:** all automated checks green + manual UAT on `/` and `/hr` in DE and EN covering `thisMonth` / `thisQuarter` / `thisYear` / `allTime`.

### Wave 0 Gaps
- Confirm no unit test infrastructure exists (if any, skip — nothing to set up). Grep `frontend/src/**/*.test.*` and `frontend/src/**/*.spec.*`.
- No framework install needed — project operates without unit tests for UI code, and CONTEXT §Claude's-Discretion explicitly marks unit tests optional.

*(If gaps found: none expected — project convention is manual UAT + parity script for i18n work.)*

## Project Constraints (from CLAUDE.md)

The project's top-level CLAUDE.md sets framework/version expectations (FastAPI 0.135.3, React 19.2.5, Vite 8.0.8, Tailwind 4.2.2, TypeScript 5.x via Vite template, react-i18next existing). None of these are affected by Phase 24 — it is a pure i18n string + call-site refactor. No new dependencies. No deviations from the locked stack.

CLAUDE.md does NOT include directives specific to i18n key naming, locale file structure, or delta-label conventions. No constraint violations to flag.

GSD Workflow Enforcement clause applies: Phase 24 work must go through `/gsd:execute-phase`. Research-only output (this file) is within the GSD workflow.

## Sources

### Primary (HIGH confidence)

- `/Users/johannbechtold/Documents/acm-kpi-light/frontend/src/components/dashboard/KpiCardGrid.tsx` (lines 1–187) — direct read
- `/Users/johannbechtold/Documents/acm-kpi-light/frontend/src/components/dashboard/HrKpiCardGrid.tsx` (lines 1–175) — direct read
- `/Users/johannbechtold/Documents/acm-kpi-light/frontend/src/components/dashboard/DeltaBadge.tsx` (lines 1–43) — direct read
- `/Users/johannbechtold/Documents/acm-kpi-light/frontend/src/components/dashboard/DeltaBadgeStack.tsx` (lines 1–61) — direct read
- `/Users/johannbechtold/Documents/acm-kpi-light/frontend/src/components/dashboard/RevenueChart.tsx` (lines 1–120) — direct read — sourced D-07 contradiction
- `/Users/johannbechtold/Documents/acm-kpi-light/frontend/src/lib/periodLabels.ts` (lines 1–193) — direct read
- `/Users/johannbechtold/Documents/acm-kpi-light/frontend/src/lib/dateUtils.ts` (lines 1–40) — direct read — Preset type definition
- `/Users/johannbechtold/Documents/acm-kpi-light/frontend/scripts/check-locale-parity.mts` (lines 1–38) — direct read
- `/Users/johannbechtold/Documents/acm-kpi-light/frontend/src/locales/en.json` — grep verified (keys on lines 46, 47, 54, 112–117)
- `/Users/johannbechtold/Documents/acm-kpi-light/frontend/src/locales/de.json` — grep verified (same line numbers)

### Secondary (MEDIUM confidence)

- Grep sweep of `frontend/src/` for `periodLabels|formatPrevPeriodLabel|formatPrevYearLabel|LOCALE_TAG|getLocalizedMonthName|formatChartSeriesLabel` — exhaustive within the searched scope, but does not cover re-exports from barrel files (none observed in this project).

### Tertiary (LOW confidence)

- None — every claim in this document is backed by a direct file read or grep evidence.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps, existing libraries are pre-locked in CLAUDE.md
- Architecture: HIGH — component contract verified by reading `DeltaBadgeStack.tsx` and `KpiCard.tsx` usage
- Pitfalls: HIGH — based on direct code read; known gotchas are structural, not speculative
- periodLabels.ts fate: HIGH — three independent greps agree on the same consumer map
- Null-preset hide behavior: MEDIUM — behavioral choice between Option A (duplicate) and Option B (skip) for `thisYear` preset is unresolved in CONTEXT; flagged as Open Question

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (30 days — this is stable internal refactor research; no library-version drift risk)
