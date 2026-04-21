---
phase: 54-toggle-primitive-migrations
plan: 03
type: execute
wave: 2
depends_on: ["54-01"]
files_modified:
  - frontend/src/components/dashboard/HrKpiCharts.tsx
  - frontend/src/components/dashboard/RevenueChart.tsx
autonomous: true
requirements:
  - TOGGLE-04
must_haves:
  truths:
    - "HrKpiCharts area/bar switch renders via Toggle."
    - "RevenueChart bar/area switch renders via Toggle."
    - "Both files no longer import SegmentedControl."
    - "Existing i18n keys `hr.chart.type.area` and `dashboard.chart.type.bar` / `dashboard.chart.type.area` are unchanged."
    - "CHART_TYPES constant in RevenueChart still drives the segments array (no hardcoding)."
  artifacts:
    - path: "frontend/src/components/dashboard/HrKpiCharts.tsx"
      provides: "Chart-type toggle via Toggle primitive"
      contains: "from \"@/components/ui/toggle\""
    - path: "frontend/src/components/dashboard/RevenueChart.tsx"
      provides: "Chart-type toggle via Toggle primitive"
      contains: "from \"@/components/ui/toggle\""
  key_links:
    - from: "frontend/src/components/dashboard/HrKpiCharts.tsx"
      to: "frontend/src/components/ui/toggle.tsx"
      via: "import { Toggle } from '@/components/ui/toggle'"
      pattern: "@/components/ui/toggle"
    - from: "frontend/src/components/dashboard/RevenueChart.tsx"
      to: "frontend/src/components/ui/toggle.tsx"
      via: "import { Toggle } from '@/components/ui/toggle'"
      pattern: "@/components/ui/toggle"
---

<objective>
Migrate both chart-type 2-option switches (HrKpiCharts area/bar and RevenueChart bar/area) from `SegmentedControl` to `Toggle`. Reuses existing i18n keys unchanged. Closes the chart-side of TOGGLE-04 (2-option boolean migrations).

Purpose: Third and fourth production call sites for the `Toggle` primitive. Both are pure presentational swaps.

Output: Updated `HrKpiCharts.tsx` + `RevenueChart.tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/54-toggle-primitive-migrations/54-CONTEXT.md
@frontend/src/components/dashboard/HrKpiCharts.tsx
@frontend/src/components/dashboard/RevenueChart.tsx
@frontend/src/components/ui/segmented-control.tsx
@frontend/src/components/ui/toggle.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate HrKpiCharts area/bar switch to Toggle</name>
  <files>frontend/src/components/dashboard/HrKpiCharts.tsx</files>
  <read_first>
    - frontend/src/components/dashboard/HrKpiCharts.tsx (current state — confirm the only SegmentedControl usage is the `ChartType` block at ~lines 249-257)
    - frontend/src/components/ui/toggle.tsx
    - frontend/src/components/ui/segmented-control.tsx
    - .planning/phases/54-toggle-primitive-migrations/54-CONTEXT.md § D-09
  </read_first>
  <action>
    In `frontend/src/components/dashboard/HrKpiCharts.tsx`:

    1. Replace the import:
       ```ts
       import { SegmentedControl } from "@/components/ui/segmented-control";
       ```
       with:
       ```ts
       import { Toggle } from "@/components/ui/toggle";
       ```

    2. Replace the JSX block (currently lines ~249-257):
       ```tsx
       <SegmentedControl<ChartType>
         segments={[
           { value: "area", label: t("hr.chart.type.area") },
           { value: "bar", label: t("dashboard.chart.type.bar") },
         ]}
         value={chartType}
         onChange={setChartType}
         aria-label="Chart type"
       />
       ```
       with:
       ```tsx
       <Toggle<ChartType>
         segments={[
           { value: "area", label: t("hr.chart.type.area") },
           { value: "bar", label: t("dashboard.chart.type.bar") },
         ] as const}
         value={chartType}
         onChange={setChartType}
         aria-label="Chart type"
       />
       ```

    3. Keep the `ChartType = "area" | "bar"` type alias unchanged.
    4. No i18n key changes (per CONTEXT D-09).
    5. No other behavior changes (MiniChart, query, formatters untouched).
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit && grep -q 'from "@/components/ui/toggle"' src/components/dashboard/HrKpiCharts.tsx && ! grep -q 'from "@/components/ui/segmented-control"' src/components/dashboard/HrKpiCharts.tsx && grep -q '<Toggle' src/components/dashboard/HrKpiCharts.tsx && ! grep -q '<SegmentedControl' src/components/dashboard/HrKpiCharts.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `frontend/src/components/dashboard/HrKpiCharts.tsx` imports `Toggle` from `@/components/ui/toggle`.
    - File does NOT import from `@/components/ui/segmented-control`.
    - File contains `<Toggle<ChartType>` (generic preserved).
    - File does NOT contain `<SegmentedControl`.
    - File still contains literal `t("hr.chart.type.area")` and `t("dashboard.chart.type.bar")`.
    - `cd frontend && npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>HrKpiCharts area/bar switch renders via Toggle, keys unchanged, types compile.</done>
</task>

<task type="auto">
  <name>Task 2: Migrate RevenueChart bar/area switch to Toggle</name>
  <files>frontend/src/components/dashboard/RevenueChart.tsx</files>
  <read_first>
    - frontend/src/components/dashboard/RevenueChart.tsx (current state — confirm the SegmentedControl usage at ~lines 122-130 and the `CHART_TYPES: ChartType[] = ["bar", "area"]` constant at line 47)
    - frontend/src/components/ui/toggle.tsx
    - .planning/phases/54-toggle-primitive-migrations/54-CONTEXT.md § D-10
  </read_first>
  <action>
    In `frontend/src/components/dashboard/RevenueChart.tsx`:

    1. Replace the import:
       ```ts
       import { SegmentedControl } from "@/components/ui/segmented-control";
       ```
       with:
       ```ts
       import { Toggle } from "@/components/ui/toggle";
       ```

    2. Narrow the `CHART_TYPES` constant to a 2-tuple so Toggle's 2-tuple segment type is satisfied:
       ```ts
       const CHART_TYPES = ["bar", "area"] as const satisfies readonly [ChartType, ChartType];
       ```
       (Current shape is `const CHART_TYPES: ChartType[] = ["bar", "area"];` at line 47.)

    3. Replace the JSX block (currently lines ~122-130):
       ```tsx
       <SegmentedControl
         segments={CHART_TYPES.map((type) => ({
           value: type,
           label: t(`dashboard.chart.type.${type}`),
         }))}
         value={chartType}
         onChange={(type) => setChartType(type)}
         aria-label="Chart type"
       />
       ```
       with:
       ```tsx
       <Toggle<ChartType>
         segments={[
           { value: CHART_TYPES[0], label: t(`dashboard.chart.type.${CHART_TYPES[0]}`) },
           { value: CHART_TYPES[1], label: t(`dashboard.chart.type.${CHART_TYPES[1]}`) },
         ] as const}
         value={chartType}
         onChange={(type) => setChartType(type)}
         aria-label="Chart type"
       />
       ```
       Rationale: Toggle requires a 2-tuple (Plan 01 D-03). `.map()` returns `Array<{...}>` which widens out of the tuple shape; indexing CHART_TYPES[0]/[1] preserves both the 2-tuple discipline and the "constant drives the segments" rule.

    4. Keep the `ChartType = "bar" | "area"` alias and all `chartType === "bar"` branching in the chart body unchanged.
    5. No i18n key changes (per CONTEXT D-10).
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit && grep -q 'from "@/components/ui/toggle"' src/components/dashboard/RevenueChart.tsx && ! grep -q 'from "@/components/ui/segmented-control"' src/components/dashboard/RevenueChart.tsx && grep -q '<Toggle' src/components/dashboard/RevenueChart.tsx && ! grep -q '<SegmentedControl' src/components/dashboard/RevenueChart.tsx && grep -q 'CHART_TYPES' src/components/dashboard/RevenueChart.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `frontend/src/components/dashboard/RevenueChart.tsx` imports `Toggle` from `@/components/ui/toggle`.
    - File does NOT import from `@/components/ui/segmented-control`.
    - File contains `<Toggle<ChartType>`.
    - File does NOT contain `<SegmentedControl`.
    - File still contains `CHART_TYPES` referenced in the Toggle `segments` prop (not hardcoded strings).
    - File still contains `t(\`dashboard.chart.type.${` pattern (existing key reused).
    - `cd frontend && npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>RevenueChart bar/area switch renders via Toggle with CHART_TYPES still driving segments; keys unchanged; types compile.</done>
</task>

</tasks>

<verification>
- `cd frontend && npx tsc --noEmit` exits 0.
- `cd frontend && npm run build` exits 0.
- Neither chart file imports `SegmentedControl` anymore.
- Chart-type toggling still works (selecting the alternate segment updates `chartType` state and re-renders the chart).
</verification>

<success_criteria>
- TOGGLE-04 chart call sites closed (HrKpiCharts + RevenueChart).
- `CHART_TYPES` constant still the single source of truth for the two chart-type values in RevenueChart.
- Zero i18n key changes across both files.
</success_criteria>

<output>
After completion, create `.planning/phases/54-toggle-primitive-migrations/54-03-SUMMARY.md`.
</output>
