---
phase: 24-delta-label-unification
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/locales/en.json
  - frontend/src/locales/de.json
  - frontend/src/components/dashboard/HrKpiCardGrid.tsx
  - frontend/src/components/dashboard/KpiCardGrid.tsx
  - frontend/src/lib/periodLabels.ts
autonomous: false
requirements: [UC-01, UC-02, UC-03, UC-04, UC-05]

must_haves:
  truths:
    - "Sales `/` dashboard shows `vs. prev. month` / `vs. Vormonat` for `thisMonth` preset, `vs. prev. quarter` / `vs. Vorquartal` for `thisQuarter`, and `vs. prev. year` / `vs. Vorjahr` for `thisYear` — in both DE and EN"
    - "HR `/hr` dashboard shows `vs. prev. month` / `vs. Vormonat` and `vs. prev. year` / `vs. Vorjahr` resolved from the new shared namespace"
    - "Sales `/` dashboard with `allTime` preset (or null/custom range) renders KPI cards with NO delta badge row — not blank, not em-dash, hidden entirely"
    - "`scripts/check-locale-parity.mts` exits with code 0 (DE/EN key sets identical)"
    - "`grep -r 'hr.kpi.delta' frontend/src/` returns zero results — old namespace fully retired"
    - "`grep -r 'formatPrevPeriodLabel\\|formatPrevYearLabel' frontend/src/` returns zero results — delta-badge formatters removed"
    - "`RevenueChart.tsx` still builds and renders — `formatChartSeriesLabel` survives the strip"
    - "Frontend builds clean (`npm --prefix frontend run build`) — no unused imports, no type errors"
  artifacts:
    - path: "frontend/src/locales/en.json"
      provides: "kpi.delta.prevMonth/prevQuarter/prevYear keys; hr.kpi.delta.* removed"
      contains: "kpi.delta.prevQuarter"
    - path: "frontend/src/locales/de.json"
      provides: "kpi.delta.prevMonth/prevQuarter/prevYear keys; hr.kpi.delta.* removed"
      contains: "kpi.delta.prevQuarter"
    - path: "frontend/src/components/dashboard/KpiCardGrid.tsx"
      provides: "Sales consumer reading kpi.delta.* via t() with hide-when-null branch"
    - path: "frontend/src/components/dashboard/HrKpiCardGrid.tsx"
      provides: "HR consumer reading kpi.delta.* via t()"
    - path: "frontend/src/lib/periodLabels.ts"
      provides: "Stripped — keeps formatChartSeriesLabel + getLocalizedMonthName + types only"
  key_links:
    - from: "frontend/src/components/dashboard/KpiCardGrid.tsx"
      to: "frontend/src/locales/{en,de}.json"
      via: "t('kpi.delta.prevMonth' | 'kpi.delta.prevQuarter' | 'kpi.delta.prevYear')"
      pattern: "t\\(\"kpi\\.delta\\."
    - from: "frontend/src/components/dashboard/HrKpiCardGrid.tsx"
      to: "frontend/src/locales/{en,de}.json"
      via: "t('kpi.delta.prevMonth') / t('kpi.delta.prevYear')"
      pattern: "t\\(\"kpi\\.delta\\."
    - from: "frontend/src/components/dashboard/RevenueChart.tsx"
      to: "frontend/src/lib/periodLabels.ts"
      via: "import { formatChartSeriesLabel }"
      pattern: "formatChartSeriesLabel"
---

<objective>
Consolidate Sales and HR KPI delta-badge labels under a single shared `kpi.delta.{prevMonth,prevQuarter,prevYear}` i18n namespace with full DE/EN parity. Retire the absolute-period delta-badge formatters in `periodLabels.ts` (strip-only — `formatChartSeriesLabel` survives because `RevenueChart.tsx` still consumes it). Delete old `hr.kpi.delta.*` keys with no shim. Audit and remove orphaned `dashboard.delta.*` keys.

Purpose: Unify per-domain delta-label logic so both dashboards speak the same i18n vocabulary; add quarter granularity (UC-02); simplify the `lib/periodLabels.ts` surface.

Output: Two component files swapped to new keys; two locale files cleaned and parity-verified; one helper file stripped of dead code. Atomic single-commit migration so i18next never renders a missing-key string mid-sequence.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/24-delta-label-unification/24-CONTEXT.md
@.planning/phases/24-delta-label-unification/24-RESEARCH.md
@.planning/REQUIREMENTS.md

@frontend/src/locales/en.json
@frontend/src/locales/de.json
@frontend/src/components/dashboard/KpiCardGrid.tsx
@frontend/src/components/dashboard/HrKpiCardGrid.tsx
@frontend/src/components/dashboard/DeltaBadgeStack.tsx
@frontend/src/lib/periodLabels.ts
@frontend/scripts/check-locale-parity.mts

<interfaces>
<!-- Pre-resolved contracts the executor needs. No codebase exploration required. -->

From frontend/src/lib/dateUtils.ts:
```typescript
export type Preset = "thisMonth" | "thisQuarter" | "thisYear" | "allTime";
```

From frontend/src/components/dashboard/DeltaBadgeStack.tsx (UNCHANGED — do NOT modify):
```typescript
export interface DeltaBadgeStackProps {
  prevPeriodDelta: number | null;
  prevYearDelta: number | null;
  prevPeriodLabel: string;
  prevYearLabel: string;
  locale: DeltaLocale;
  noBaselineTooltip: string;
}
```

From frontend/src/components/dashboard/KpiCard.tsx (existing — already handles undefined delta cleanly):
```typescript
// Pass `delta={undefined}` to render KPI value with NO delta row.
// This is the hide-when-null path for allTime preset.
```

Locale file shape (FLAT dot-keyed JSON — do NOT nest):
```json
{
  "kpi.delta.prevMonth": "vs. prev. month",
  "kpi.delta.prevQuarter": "vs. prev. quarter",
  "kpi.delta.prevYear": "vs. prev. year"
}
```

Granularity → key mapping (D-11):
- `thisMonth` → `kpi.delta.prevMonth`
- `thisQuarter` → `kpi.delta.prevQuarter`
- `thisYear` → `kpi.delta.prevYear`
- `allTime` / `null` → no key (hide badges)

periodLabels.ts strip target (per RESEARCH §periodLabels.ts Audit):
- DELETE: `formatPrevPeriodLabel`, `formatPrevYearLabel`, `LOCALE_TAG` const, `EM_DASH` const
- KEEP: `formatChartSeriesLabel`, `getLocalizedMonthName`, `ChartSeriesLabels` interface, `ChartLabelT` type, `SupportedLocale` type, `subMonths` import, `DateRangeValue` import, `Preset` import
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Pre-flight grep verification</name>
  <files>(read-only — no file modifications)</files>
  <action>
Run grep audits to lock in the strip plan and orphan-key list before any edits. Save output mentally; the actual deletions happen in Task 2 and Task 4.

1. Verify periodLabels.ts consumer map (confirms RESEARCH finding that `RevenueChart.tsx` keeps `formatChartSeriesLabel` alive — strip-only, NOT full delete):
   ```bash
   grep -rn "from.*periodLabels\|periodLabels\"" frontend/src/ --include="*.ts" --include="*.tsx"
   ```
   Expected: `RevenueChart.tsx` imports `formatChartSeriesLabel`; `KpiCardGrid.tsx` imports `formatPrevPeriodLabel` + `formatPrevYearLabel`. No other consumers.

2. Check `SupportedLocale` external usage (per RESEARCH Open Question 3):
   ```bash
   grep -rn "SupportedLocale" frontend/src/ --include="*.ts" --include="*.tsx"
   ```
   If only `periodLabels.ts` references it, strip the `export` keyword in Task 4. If anything else imports it, keep export.

3. Audit each `dashboard.delta.*` key for live consumers (orphan candidates per CONTEXT follow-up decision):
   ```bash
   for k in vsShortPeriod vsShortPeriod_one vsCustomPeriod vsYear noBaseline noBaselineTooltip; do
     echo "=== dashboard.delta.$k ==="
     grep -rn "dashboard\.delta\.$k" frontend/src/ --include="*.ts" --include="*.tsx"
   done
   ```
   Build the orphan-deletion list: any key with ZERO consumers after Task 3's `KpiCardGrid.tsx` rewrite gets deleted from BOTH locale files in Task 5. `noBaselineTooltip` is known-live (still used by Sales for the existing tooltip) — keep it.

4. Confirm no unit-test infrastructure exists (RESEARCH Wave 0 gap check):
   ```bash
   find frontend/src -name "*.test.*" -o -name "*.spec.*" 2>/dev/null
   ```
   Expected: empty. Confirms manual UAT + parity script is the only verification path.

Record findings in scratch — they drive Tasks 4 and 5.
  </action>
  <verify>
    <automated>grep -rn "formatChartSeriesLabel" frontend/src/components/dashboard/RevenueChart.tsx</automated>
  </verify>
  <done>Consumer map confirmed: RevenueChart keeps formatChartSeriesLabel; only KpiCardGrid uses formatPrev* functions. Orphan-key candidates list assembled for Task 5. SupportedLocale export status decided.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Migrate locale files — add kpi.delta.* keys, delete hr.kpi.delta.*</name>
  <files>frontend/src/locales/en.json, frontend/src/locales/de.json</files>
  <action>
Per D-01, D-02, D-04, D-05, D-06: add the new shared namespace and remove the old HR-scoped keys atomically.

In `frontend/src/locales/en.json`:
- DELETE line containing `"hr.kpi.delta.prevMonth": "vs. prev. month"`
- DELETE line containing `"hr.kpi.delta.prevYear": "vs. prev. year"`
- ADD (group together near the other `kpi.*` keys, or in a logical block):
  ```json
  "kpi.delta.prevMonth": "vs. prev. month",
  "kpi.delta.prevQuarter": "vs. prev. quarter",
  "kpi.delta.prevYear": "vs. prev. year",
  ```

In `frontend/src/locales/de.json` (mirror exactly — D-14 parity is mandatory):
- DELETE line containing `"hr.kpi.delta.prevMonth": "vs. Vormonat"`
- DELETE line containing `"hr.kpi.delta.prevYear": "vs. Vorjahr"`
- ADD:
  ```json
  "kpi.delta.prevMonth": "vs. Vormonat",
  "kpi.delta.prevQuarter": "vs. Vorquartal",
  "kpi.delta.prevYear": "vs. Vorjahr",
  ```

DO NOT touch `hr.kpi.noBaselineTooltip` — out of scope (it's a tooltip, not a delta label).
DO NOT restructure to nested objects — project uses flat dot-keyed JSON; `i18next` init expects this shape.
DO NOT add backwards-compat shim for `hr.kpi.delta.*` — D-02 forbids it.

After edits, run the parity script. It MUST exit 0. If it reports `MISSING_IN_DE` or `MISSING_IN_EN`, you missed a mirrored edit.
  </action>
  <verify>
    <automated>node --experimental-strip-types frontend/scripts/check-locale-parity.mts</automated>
  </verify>
  <done>Both locale files contain the three new `kpi.delta.*` keys with locked copy (D-04/D-05); both files no longer contain any `hr.kpi.delta.*` key; parity script exits 0.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Update HR consumer to new keys</name>
  <files>frontend/src/components/dashboard/HrKpiCardGrid.tsx</files>
  <action>
Per D-01, D-11: swap two `t()` calls in `HrKpiCardGrid.tsx` (lines 102–103 per RESEARCH).

Find:
```tsx
prevPeriodLabel={t("hr.kpi.delta.prevMonth")}
prevYearLabel={t("hr.kpi.delta.prevYear")}
```

Replace with:
```tsx
prevPeriodLabel={t("kpi.delta.prevMonth")}
prevYearLabel={t("kpi.delta.prevYear")}
```

DO NOT touch `t("hr.kpi.noBaselineTooltip")` on the line below — out of scope.
DO NOT add a third badge for `prevQuarter` — RESEARCH §Conflicts and CONTEXT both say HR keeps its two-badge layout. The `prevQuarter` key's existence in locale files satisfies UC-02; HR's consumer does not need to use it.
HR call site does NOT need a hide-when-null branch — HR's monthly/yearly comparisons are always applicable by design (per RESEARCH §Null/allTime hide strategy).
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; npx tsc --noEmit 2>&amp;1 | grep -E "HrKpiCardGrid" || echo "OK: no HrKpiCardGrid type errors"</automated>
  </verify>
  <done>HrKpiCardGrid.tsx reads `kpi.delta.prevMonth` and `kpi.delta.prevYear` via `t()`; no references to `hr.kpi.delta.*` remain in the file; TypeScript clean for this file.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Rewrite Sales consumer + strip periodLabels.ts</name>
  <files>frontend/src/components/dashboard/KpiCardGrid.tsx, frontend/src/lib/periodLabels.ts</files>
  <action>
This task bundles the Sales consumer rewrite with the periodLabels.ts strip because they are tightly coupled — removing the formatter functions while their last consumer still imports them would break the build mid-task.

**Part A: Rewrite `frontend/src/components/dashboard/KpiCardGrid.tsx`**

Per D-10, D-11, D-12, D-13 and RESEARCH §Code Examples / §Recommended mapping function:

1. DELETE the import block (currently lines 21–24):
   ```ts
   import {
     formatPrevPeriodLabel,
     formatPrevYearLabel,
   } from "@/lib/periodLabels";
   ```

2. DELETE the `differenceInDays` import from `date-fns` (Pitfall 4 — becomes unused after rewrite):
   ```ts
   // Remove `differenceInDays` from the date-fns import line; keep other date-fns imports if any
   ```

3. REPLACE the label-resolution block (currently lines ~63–82 — the `prevPeriodStartDate`, `prevYearStartDate`, `rangeLengthDays`, `formatPrevPeriodLabel(...)`, `formatPrevYearLabel(...)` block) with:
   ```ts
   // Per Phase 24 D-11: granularity → relative i18n key.
   // Returns null for allTime / custom range — caller hides the badges (D-12).
   function prevPeriodLabelKey(preset: Preset | null): string | null {
     if (preset === "thisMonth") return "kpi.delta.prevMonth";
     if (preset === "thisQuarter") return "kpi.delta.prevQuarter";
     if (preset === "thisYear") return "kpi.delta.prevYear";
     return null;
   }

   const labelKey = prevPeriodLabelKey(preset);
   const prevPeriodLabel = labelKey ? t(labelKey) : null;
   // Per follow-up decision: keep duplicate "vs. prev. year" row on thisYear preset
   // (preserves current two-badge behavior — no conditional collapse).
   const prevYearLabel = labelKey ? t("kpi.delta.prevYear") : null;
   ```

   This deletes:
   - `prevPeriodStartDate` computation
   - `prevYearStartDate` computation
   - `rangeLengthDays` computation
   - any reference to `prevBounds.prev_period_start` / `prevBounds.prev_year_start` IF those fields are used nowhere else in the file (grep within the file before deleting; they may feed something else — leave that alone if so)

4. UPDATE every `<DeltaBadgeStack ...>` rendering site (RESEARCH notes lines ~132-142 plus twin blocks for the other KPI cards) to wrap in the hide-when-null branch — pass `delta={undefined}` to `KpiCard` when labels are null:
   ```tsx
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
   Apply this pattern to ALL KPI card instances in the file (revenue, orders, AOV, etc. — whichever exist). The conditional `data && prevPeriodLabel && prevYearLabel` ensures `allTime` / null preset renders no badge row at all (per D-12 — no em-dash, no placeholder, just hidden).

5. KEEP the existing `noBaselineTooltip = t("dashboard.delta.noBaselineTooltip")` resolution (line 84 in current file) — it's still needed by the rendered `DeltaBadgeStack` and is NOT being renamed.

**Part B: Strip `frontend/src/lib/periodLabels.ts`**

Per D-08 fallback (strip-only, since RESEARCH found `formatChartSeriesLabel` is consumed by `RevenueChart.tsx`):

DELETE these symbols:
- `const EM_DASH = ...`
- `const LOCALE_TAG = { de: "de-DE", en: "en-US" } as const;`
- `export function formatPrevPeriodLabel(...)` (entire function body)
- `export function formatPrevYearLabel(...)` (entire function body)

KEEP these symbols (verified consumed by `RevenueChart.tsx` or internally needed):
- `import { subMonths } from "date-fns";`
- `import type { DateRangeValue } from "../components/dashboard/DateRangeFilter.tsx";` (or whatever the actual import path reads — preserve as-is)
- `import type { Preset } from "./dateUtils.ts";` (or actual path)
- `export type SupportedLocale = "de" | "en";` — if Task 1 grep showed zero external consumers, downgrade to non-exported `type SupportedLocale`. Otherwise keep `export`.
- `type ChartLabelT = ...` (module-private, used by `formatChartSeriesLabel`)
- `export function getLocalizedMonthName(...)` (used by `formatChartSeriesLabel`)
- `export interface ChartSeriesLabels { ... }`
- `export function formatChartSeriesLabel(...)` — DO NOT TOUCH; chart legend out of scope per CONTEXT §domain "deferred".

After both parts, run the build. TypeScript `noUnusedLocals` (or just compiler warnings) will catch any dangling import or computation you missed.

DO NOT delete `periodLabels.ts` entirely — would break `RevenueChart.tsx`. This contradicts D-07 but is the explicit fallback per D-08 (strip-only when external consumers exist).
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; npm run build 2>&amp;1 | tail -40</automated>
  </verify>
  <done>
- KpiCardGrid.tsx imports no `periodLabels` symbols; uses `prevPeriodLabelKey()` helper; renders `delta={undefined}` for `allTime`/null preset.
- periodLabels.ts contains `formatChartSeriesLabel` + `getLocalizedMonthName` + types + `ChartSeriesLabels` interface; contains zero references to `formatPrevPeriodLabel`, `formatPrevYearLabel`, `EM_DASH`, `LOCALE_TAG`.
- `npm run build` succeeds with no type errors and no unused-import warnings.
- `grep -rn "formatPrevPeriodLabel\|formatPrevYearLabel" frontend/src/` returns zero hits.
- `grep -rn "formatChartSeriesLabel" frontend/src/` still hits both `RevenueChart.tsx` and `periodLabels.ts` (proves chart legend untouched).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 5: Orphan-key audit and cleanup</name>
  <files>frontend/src/locales/en.json, frontend/src/locales/de.json</files>
  <action>
Per CONTEXT follow-up decision and RESEARCH §Open Question 2: after the Sales consumer rewrite, several `dashboard.delta.*` keys may be orphaned. Delete unreferenced ones from BOTH locale files to fulfill UC-04's "simplified" intent.

1. Re-run the orphan audit (same loop as Task 1, post-rewrite state):
   ```bash
   for k in vsShortPeriod vsShortPeriod_one vsCustomPeriod vsYear noBaseline; do
     echo "=== dashboard.delta.$k ==="
     grep -rn "dashboard\.delta\.$k\|\"$k\"" frontend/src/ --include="*.ts" --include="*.tsx" --include="*.json"
   done
   ```
   For each key, the only acceptable hits are inside `en.json` / `de.json` themselves (the key declaration). Any hit in `.ts` / `.tsx` means a live consumer — KEEP that key.

2. For every key with ZERO consumers in `.ts` / `.tsx` files, DELETE its line from BOTH `en.json` and `de.json` (mirror exactly — D-14).

3. Explicitly DO NOT delete `dashboard.delta.noBaselineTooltip` — it's still consumed by `KpiCardGrid.tsx` (the `noBaselineTooltip` resolution preserved in Task 4). Verify with one targeted grep.

4. Run the parity script after deletions. MUST exit 0.

If unsure about a key, leave it (false positives just mean a tiny amount of dead JSON; false negatives — deleting a live key — break the UI). When in doubt, grep the value-string itself, not just the key, in case some component reads it differently.
  </action>
  <verify>
    <automated>node --experimental-strip-types frontend/scripts/check-locale-parity.mts &amp;&amp; grep -c "dashboard.delta.noBaselineTooltip" frontend/src/locales/en.json frontend/src/locales/de.json</automated>
  </verify>
  <done>Orphan `dashboard.delta.*` keys with zero `.ts`/`.tsx` consumers removed from both locale files; live keys (including `noBaselineTooltip`) preserved; parity script exits 0; full frontend build still succeeds.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 6: Manual UAT — all granularities, both languages, both dashboards</name>
  <files>(no file modifications — UAT only)</files>
  <action>
Manually verify the full migration end-to-end across both dashboards, both languages, all four preset states, plus a chart-legend regression check. Follow the 11-step script in &lt;how-to-verify&gt; below.
  </action>
  <verify>
    <automated>node --experimental-strip-types frontend/scripts/check-locale-parity.mts</automated>
  </verify>
  <done>All 11 manual UAT checks pass; user types "approved".</done>
  <what-built>
Phase 24 delta-label unification:
- New shared `kpi.delta.{prevMonth,prevQuarter,prevYear}` namespace
- Sales `/` reads relative labels per preset; HR `/hr` reads from same namespace
- `allTime` / custom-range hides delta badges entirely (no em-dash, no placeholder)
- Old `hr.kpi.delta.*` keys deleted; orphan `dashboard.delta.*` keys cleaned up
- `periodLabels.ts` stripped of delta-badge formatters; chart legend untouched
  </what-built>
  <how-to-verify>
1. Start the dev stack: `docker compose up -d` (or whatever the project's standard run command is).

2. Open the Sales dashboard `http://localhost:5173/` (or actual port).

3. **EN, Sales, `thisMonth` preset:**
   - Set language toggle to EN, date-range preset to "This month".
   - VERIFY: each KPI card shows two delta-badge rows: top reads `vs. prev. month`, bottom reads `vs. prev. year`.

4. **EN, Sales, `thisQuarter` preset:**
   - Switch preset to "This quarter".
   - VERIFY: top row reads `vs. prev. quarter`, bottom reads `vs. prev. year`.

5. **EN, Sales, `thisYear` preset:**
   - Switch preset to "This year".
   - VERIFY: top row reads `vs. prev. year`, bottom row ALSO reads `vs. prev. year` (duplicate is intentional per follow-up decision — preserves current two-badge layout).

6. **EN, Sales, `allTime` preset:**
   - Switch preset to "All time".
   - VERIFY: KPI cards show value but NO delta-badge row — the entire badge area is hidden, not blank, not em-dash.

7. **DE, Sales, all four presets:** repeat steps 3–6 with language toggle on DE. Expected German strings:
   - `vs. Vormonat`, `vs. Vorquartal`, `vs. Vorjahr` — each in the correct row per preset.
   - `allTime` still hides badges.

8. **EN, HR, default state:** open `http://localhost:5173/hr`. VERIFY: HR KPI cards show `vs. prev. month` (top) and `vs. prev. year` (bottom).

9. **DE, HR:** toggle to DE. VERIFY: `vs. Vormonat` (top) and `vs. Vorjahr` (bottom).

10. **Chart legend regression check:** on Sales `/`, scroll to the RevenueChart. VERIFY: prior-period overlay legend still renders (e.g., `Apr 2025` or whatever absolute month label it used before — it should NOT have changed). If chart legend looks broken or empty, `formatChartSeriesLabel` was accidentally damaged in Task 4.

11. **Browser console:** open DevTools console on both `/` and `/hr`. VERIFY: no `i18next::translator: missingKey` warnings for any `kpi.delta.*` or `hr.kpi.delta.*` lookup.
  </how-to-verify>
  <resume-signal>Type "approved" if all 11 checks pass. Otherwise describe which check failed (which preset, which language, which dashboard, what was wrong).</resume-signal>
</task>

</tasks>

<verification>
**Automated gates (must all pass before UAT):**
- `node --experimental-strip-types frontend/scripts/check-locale-parity.mts` exits 0 (UC-05)
- `cd frontend && npm run build` succeeds with zero type errors and zero unused-import warnings (UC-04 simplification proven by clean build)
- `grep -r "hr.kpi.delta" frontend/src/` returns zero results (UC-03)
- `grep -r "formatPrevPeriodLabel\|formatPrevYearLabel" frontend/src/` returns zero results (UC-04)
- `grep "kpi.delta.prevQuarter" frontend/src/locales/en.json frontend/src/locales/de.json` returns one hit per file (UC-02)
- `grep "formatChartSeriesLabel" frontend/src/components/dashboard/RevenueChart.tsx` still returns at least one hit (regression guard for chart)

**Manual gates (Task 6 UAT):**
- All three Sales presets render correct relative labels in EN and DE (UC-01, UC-02)
- `allTime` preset hides badges entirely (D-12 implementation)
- HR dashboard reads from new namespace in both languages (UC-01, UC-03)
- RevenueChart legend unchanged (out-of-scope guard per CONTEXT §domain)
</verification>

<success_criteria>
1. Both Sales and HR dashboards consume `kpi.delta.{prevMonth,prevQuarter,prevYear}` exclusively; zero `hr.kpi.delta.*` references remain anywhere in `frontend/src/`.
2. Quarter granularity renders correctly on Sales when preset = `thisQuarter` (`vs. prev. quarter` / `vs. Vorquartal`); the key exists in both locale files even though HR doesn't currently consume it.
3. `allTime` and custom-range presets on Sales render KPI cards with no delta badge row at all (per D-12 — hidden, not em-dash).
4. `frontend/src/lib/periodLabels.ts` no longer contains `formatPrevPeriodLabel`, `formatPrevYearLabel`, `LOCALE_TAG`, or `EM_DASH`. It DOES still contain `formatChartSeriesLabel` and its dependencies (chart legend untouched per scope).
5. `scripts/check-locale-parity.mts` exits 0 (UC-05).
6. Frontend builds clean (`npm run build`) — no TS errors, no dangling imports.
7. UAT confirms visual correctness across `/` and `/hr` in DE and EN for all four preset states.
</success_criteria>

<output>
After completion, create `.planning/phases/24-delta-label-unification/24-01-delta-label-unification-SUMMARY.md` documenting:
- Final list of orphaned `dashboard.delta.*` keys deleted (Task 5 outcome)
- Whether `SupportedLocale` export was retained or downgraded (Task 1 finding)
- Any UAT findings or surprises
- Confirmation that `RevenueChart.tsx` legend behavior is unchanged
</output>
