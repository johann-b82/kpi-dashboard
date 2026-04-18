# Phase 24: Delta Label Unification - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Consolidate KPI-card delta-badge labeling across Sales (`/`) and HR (`/hr`) so both dashboards read from a single shared i18n namespace and both support three granularities (month / quarter / year) in full DE/EN parity. Retire the absolute-period formatters in `frontend/src/lib/periodLabels.ts`. **In scope:** the two small strings under each KPI's delta badge. **Out of scope:** chart prior-period legend, SubHeader range text, axis labels, tooltip strings — all keep their current absolute formatting.

</domain>

<decisions>
## Implementation Decisions

### i18n Namespace

- **D-01:** Create a new shared namespace `kpi.delta.*` with three keys — `prevMonth`, `prevQuarter`, `prevYear`. Both `KpiCardGrid.tsx` (Sales) and `HrKpiCardGrid.tsx` (HR) consume this namespace.
- **D-02:** Migrate off `hr.kpi.delta.prevMonth` and `hr.kpi.delta.prevYear` — move their values to the new `kpi.delta.*` namespace and delete the old `hr.kpi.delta.*` entries from both `locales/en.json` and `locales/de.json`. This is a breaking key rename; no backwards-compatibility shim.
- **D-03:** Key shape is camelCase to match existing project convention (`prevMonth` not `prev_month` / `prev.month`).

### Label Copy

- **D-04:** EN values:
  - `kpi.delta.prevMonth` → `vs. prev. month`
  - `kpi.delta.prevQuarter` → `vs. prev. quarter`
  - `kpi.delta.prevYear` → `vs. prev. year`
- **D-05:** DE values:
  - `kpi.delta.prevMonth` → `vs. Vormonat`
  - `kpi.delta.prevQuarter` → `vs. Vorquartal`
  - `kpi.delta.prevYear` → `vs. Vorjahr`
- **D-06:** Keep the `vs.` prefix in both languages. Matches current HR strings and is common in German business UI. Not changing to `ggü.`.

### periodLabels.ts Fate

- **D-07:** Delete `frontend/src/lib/periodLabels.ts` entirely. The file only serves delta-badge labels today; after the migration it has no consumers.
- **D-08:** Planner MUST grep-verify zero remaining imports of `periodLabels` / `formatPrevPeriodLabel` / `formatPrevYearLabel` across `frontend/src/` before deleting. If any unexpected consumer surfaces, deferred to "strip only" fallback for that symbol — but default is full delete.
- **D-09:** Remove the `LOCALE_TAG` map and any `Intl.DateTimeFormat` helper logic that lived there if it had no other call sites.

### Granularity Mapping

- **D-10:** Delta badge consumers resolve granularity from the existing date-range `preset` / granularity state (already used by Sales) and the HR sync period (implicit — monthly / quarterly / yearly KPIs).
- **D-11:** Mapping table (inputs → label key):
  - preset `thisMonth` → `kpi.delta.prevMonth`
  - preset `thisQuarter` → `kpi.delta.prevQuarter`
  - preset `thisYear` → `kpi.delta.prevYear`
  - HR KPIs currently show two badges (prev-month + prev-year) by design — keep that, just read from new keys.

### Null / allTime State

- **D-12:** When the date-range preset is `allTime` or null (no comparable period available), HIDE the delta badge entirely. Do NOT show a placeholder `—` / em-dash / generic `vs. prev. period` fallback. A badge without a comparison reference is noise.
- **D-13:** Implementation: existing `DeltaBadge` / `DeltaBadgeStack` components already handle a "no-data" state via null/undefined delta value — confirm that path hides the badge cleanly, or add the hide-when-preset-is-null branch at the consumer (`KpiCardGrid`, `HrKpiCardGrid`).

### DE/EN Parity Guard

- **D-14:** `scripts/check-locale-parity.mts` must exit 0 after the migration — same set of keys in `en.json` and `de.json`. Both new `kpi.delta.*` keys and the deletion of old `hr.kpi.delta.*` keys must be mirrored in both files.
- **D-15:** The parity script runs in the plan's verification step (not a new plan — part of existing phase verification).

### Claude's Discretion

- How to structure the i18n files (inline vs separate section under `kpi.*`)
- Whether to consolidate the Sales `useTranslation` call site alongside the refactor or keep it minimal
- Exact DeltaBadge prop shape (if any changes needed to accept a `granularity` or `hidden` prop)
- Whether to write a small unit test covering the granularity → label-key mapping (optional; project has no unit test convention yet)

### Folded Todos

None — no pending todos matched Phase 24.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Delta label consumers
- `frontend/src/components/dashboard/KpiCardGrid.tsx` (lines 75–82) — Sales wiring, calls `formatPrevPeriodLabel()` / `formatPrevYearLabel()`
- `frontend/src/components/dashboard/HrKpiCardGrid.tsx` (lines 102–103) — HR wiring, calls `t("hr.kpi.delta.prevMonth")` / `t("hr.kpi.delta.prevYear")`
- `frontend/src/components/dashboard/DeltaBadge.tsx` — Single-badge renderer
- `frontend/src/components/dashboard/DeltaBadgeStack.tsx` — Stacked month+year layout

### Label formatters to retire
- `frontend/src/lib/periodLabels.ts` — `formatPrevPeriodLabel`, `formatPrevYearLabel`, `LOCALE_TAG` map

### i18n sources
- `frontend/src/locales/en.json` — add `kpi.delta.*`, delete `hr.kpi.delta.*`
- `frontend/src/locales/de.json` — add `kpi.delta.*`, delete `hr.kpi.delta.*`
- `scripts/check-locale-parity.mts` — parity guard (no changes needed, just must pass after)

### Requirements
- `.planning/REQUIREMENTS.md` §v1.10 — UC-01 through UC-05

### Roadmap
- `.planning/ROADMAP.md` §"Phase 24: Delta Label Unification" — goal, success criteria, dependencies

### Prior convention references
- `.planning/milestones/v1.9-phases/21-dark-mode-theme-infrastructure/21-CONTEXT.md` — semantic invariance pattern (kept here conceptually: one label, two languages, no per-domain variants)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `react-i18next` + `useTranslation()` hook already in use across the app — new keys are just JSON additions, no infrastructure work
- `DeltaBadge` + `DeltaBadgeStack` already render the label as a separate text element — swapping the input string is a one-liner per call site
- Parity script already catches missing/extra keys — new keys get guarded for free

### Established Patterns
- i18n keys in camelCase under nested objects (`hr.kpi.delta.prevMonth`, `kpi.cards.revenue.title`) — new `kpi.delta.*` follows this pattern
- Consumers use `t("...")` at the call site, not formatter functions — matches D-03 direction
- DE "vs." prefix convention established in v1.3 HR strings — D-06 preserves it

### Integration Points
- `KpiCardGrid.tsx` (Sales) — replace two formatter calls with `t()` calls; add granularity → key mapping
- `HrKpiCardGrid.tsx` (HR) — update key names from `hr.kpi.delta.*` to `kpi.delta.*`; add optional prevQuarter consumer if HR eventually shows quarterly (not required by UC-02 — HR today only shows prev-month + prev-year)
- `locales/{en,de}.json` — add 3 new keys, delete 2 old HR keys

### Conflicts to Resolve
- The HR dashboard currently only displays prev-month + prev-year badges. UC-02 requires the QUARTER key to exist, but does HR need to USE it? Phase 24 scope: the key MUST EXIST; whether HR's consumer adds a third badge is Claude's discretion (defer to planner — likely no, keep HR's two-badge layout as-is).
- `DeltaBadgeStack` receives two string props (`prevPeriodLabel`, `prevYearLabel`); Sales currently passes absolute strings; migration needs to preserve the prop interface.

</code_context>

<specifics>
## Specific Ideas

- User accepted all 5 "Recommended" answers — no surprises, fully aligned with standard project conventions.
- The net diff should be small: ~6 key changes in each locale file, ~5 lines changed in KpiCardGrid.tsx, ~2 lines in HrKpiCardGrid.tsx, one file deleted (`periodLabels.ts`), zero new dependencies.
- This phase is effectively a **low-risk refactor + new feature** (the new prevQuarter key); plan structure should reflect that — likely 1–2 plans total.

</specifics>

<deferred>
## Deferred Ideas

- **Chart prior-period overlay legend** — could also read from `kpi.delta.prevYear` for consistency, but carries risk (chart tooltips showing "vs. Vormonat" for specific April data point would be confusing). User explicitly scoped this OUT of Phase 24.
- **HR quarterly KPI support** — adding a third delta badge to HR KPIs using the new `prevQuarter` key. Not needed today; the key's mere existence satisfies UC-02.
- **DE formal prefix migration** (`ggü.` instead of `vs.`) — rejected by D-06; revisit only if user feedback flags `vs.` as awkward.
- **Unit tests for granularity → label-key mapping** — listed under "Claude's discretion"; ship only if planner judges it trivially valuable.

</deferred>

---

*Phase: 24-delta-label-unification*
*Context gathered: 2026-04-14*
