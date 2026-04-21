# Phase 54: Toggle Primitive + Migrations - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

A new pill `Toggle` primitive exists under `frontend/src/components/ui/`
and replaces every **2-option boolean** switch in the app. The existing
`SegmentedControl` stays for 3+ option cases. No backend, no new animation
library, no rename of existing i18n keys outside what the migration
directly requires.

</domain>

<decisions>
## Implementation Decisions

### Component placement + shape
- **D-01:** New component lives at `frontend/src/components/ui/toggle.tsx`
  (lowercase-kebab, sibling to `segmented-control.tsx`).
- **D-02:** API mirrors `SegmentedControl` for zero-churn migration:
  ```ts
  interface ToggleProps<T extends string> {
    segments: Array<{ value: T; label?: string; icon?: ReactNode }>;
    value: T;
    onChange: (value: T) => void;
    disabled?: boolean;
    "aria-label"?: string;
    title?: string;
    className?: string;
  }
  ```
  Each segment may carry an optional `icon` so the theme toggle can render
  sun/moon glyphs as the label. When `icon` is provided without `label`,
  the visible content is the icon and the accessible name comes from the
  segment's own `aria-label` or an `icon-only` treatment (planner decides
  exact a11y wiring — must satisfy A11Y-02).
- **D-03:** Enforce exactly 2 segments at the type/runtime level (dev-time
  assert or a 2-tuple type) — `Toggle` is the 2-option primitive;
  3+ option callers must use `SegmentedControl`.

### Animation
- **D-04:** Indicator animates via `transform: translateX(...)` with a
  ~180ms ease-out transition. CSS-only (Tailwind v4 utilities / inline
  style for the computed offset). GPU-accelerated; no JS animation
  loop, no Framer Motion.
- **D-05:** `prefers-reduced-motion: reduce` disables the transition
  (indicator swaps instantly). TOGGLE-05 acceptance.

### Keyboard + a11y
- **D-06:** WAI-ARIA radiogroup default: Left/Up → previous, Right/Down
  → next, wrap around the 2 options. **Selection changes as focus
  moves** (standard radiogroup behavior). Enter/Space re-activates the
  focused option (idempotent, mostly for muscle memory).
- **D-07:** `role="radiogroup"` on the container, `role="radio"` +
  `aria-checked` on each segment (same as current SegmentedControl).
  Visible focus ring resolves from tokens in both themes.

### Migrations (in-scope for this phase)
- **D-08:** `NavBar` Sales/HR pill → `Toggle`. Reuse existing
  `t('nav.sales')` / `t('nav.hr')` keys unchanged.
- **D-09:** `HrKpiCharts` area/bar → `Toggle`. Reuse existing
  `t('hr.chart.type.area')` / `t('dashboard.chart.type.bar')` keys.
- **D-10:** `RevenueChart` bar/area (`CHART_TYPES = ['bar', 'area']`) →
  `Toggle`. Reuse existing keys.
- **D-11:** `ThemeToggle` → 2-segment `Toggle` with sun icon (light) /
  moon icon (dark) as segment content. Preserves the current
  `ThemeToggle.tsx` OS-prefers-color-scheme tracking + localStorage
  persistence logic (D-06/D-07 from v1.9). TOGGLE-03 acceptance.

### Out-of-scope (unchanged this phase)
- **D-12:** `SegmentedControl` remains in the codebase and in active
  use for: `SensorTimeWindow` (5 windows), `DateRangeFilter` presets,
  `EmployeeTable` (3 options), `SignagePage` sub-nav (4 tabs). No
  deprecation markers added.

### Claude's Discretion
- Exact Tailwind class composition for the pill container, indicator
  element, and active/inactive label styling (must resolve from tokens
  in both themes — A11Y-03).
- How the indicator's `translateX` offset is computed (inline style
  from measured width vs. `data-active` + CSS `:has()` vs. equal-width
  flex children with `translate-x-full`). Planner picks the cleanest
  implementation that keeps the 2 segments visually balanced.
- Whether to introduce a minimal `toggle.aria_label` default key or
  rely on callers to always pass `aria-label` (callers already do
  today, so no new key is strictly needed).
- Test coverage depth — at minimum, a render test + keyboard
  interaction test for `Toggle`; migrated surfaces get smoke-level
  coverage to confirm they still render with the new primitive.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap + requirements
- `.planning/ROADMAP.md` § Phase 54 — goal, depends-on, success criteria
- `.planning/REQUIREMENTS.md` § TOGGLE-01..05 — acceptance rules for
  this phase; § A11Y-01..03 — cross-milestone a11y guardrails
  (full sweep in Phase 59, but must not regress here)
- `.planning/REQUIREMENTS.md` § Out of Scope — no backend changes,
  no animation library, `SegmentedControl` for 3+ options stays

### Existing code to replicate / reuse
- `frontend/src/components/ui/segmented-control.tsx` — current 2/3+
  option pill. API shape to mirror; a11y pattern (radiogroup/radio,
  aria-checked) to carry forward.
- `frontend/src/components/ThemeToggle.tsx` — OS prefers-color-scheme
  tracking + localStorage override logic (v1.9 D-06/D-07) must survive
  the migration; only the visual layer changes.
- `frontend/src/components/NavBar.tsx` — Sales/HR migration call site,
  and hosts the theme toggle + language switcher.
- `frontend/src/components/dashboard/HrKpiCharts.tsx` — area/bar
  migration call site.
- `frontend/src/components/dashboard/RevenueChart.tsx` — bar/area
  migration call site (`CHART_TYPES` constant).

### Prior-phase context (patterns to continue)
- v1.9 dark-mode contract — zero hardcoded color literals; all
  color/surface values resolve from `:root` / `.dark` CSS variables.
- v1.10 delta-badge / layout unification — pill shapes use
  `rounded-full` on `bg-background` with `border-primary`; active
  segment uses `bg-primary text-primary-foreground`. Toggle's indicator
  should match this token palette.

No external web specs required — WAI-ARIA radiogroup pattern is
standard and already implemented in `segmented-control.tsx`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `segmented-control.tsx` — near-identical API, radiogroup a11y, pill
  styling tokens. `Toggle` is essentially a 2-option variant with an
  animated indicator and optional icon content.
- `ThemeToggle.tsx` — keep the OS/localStorage logic; swap the JSX from
  a single `<button>` to a 2-segment `<Toggle>` bound to `mode`.
- Existing `t(...)` i18n keys for NavBar (`nav.sales`, `nav.hr`),
  RevenueChart (`dashboard.chart.type.*`), and HrKpiCharts
  (`hr.chart.type.*`, `dashboard.chart.type.*`) are already in place —
  no new keys needed for these migrations (A11Y-01 parity stays trivial).

### Established Patterns
- Pill shape: `inline-flex items-center bg-background border
  border-primary rounded-full p-1` (from `segmented-control.tsx`).
- Active/inactive segment styling: `bg-primary text-primary-foreground
  ... rounded-full px-3 h-6 transition-colors` vs. `transparent
  text-muted-foreground ... hover:text-foreground transition-colors`.
- Radiogroup semantics: `role="radiogroup"` + `role="radio"` +
  `aria-checked={isActive}` on clickable `<button type="button">`.
- Theme wiring: toggle `.dark` class on `documentElement` + persist to
  `localStorage.theme`; live-track `prefers-color-scheme` until the
  user explicitly toggles.

### Integration Points
- `NavBar.tsx` currently imports both `SegmentedControl` (Sales/HR) and
  `ThemeToggle`. Post-phase it imports `Toggle` for Sales/HR and a
  restyled `ThemeToggle` that internally renders `Toggle`.
- Chart call sites (`HrKpiCharts`, `RevenueChart`) swap
  `<SegmentedControl …>` for `<Toggle …>` with identical prop values.
- No router, data, or API touch points — this is a pure presentational
  swap.

</code_context>

<specifics>
## Specific Ideas

- Reference screenshot alluded to in TOGGLE-01 (pill container with a
  white/elevated indicator sliding under the active label). Visual
  target: the sliding-indicator pill pattern seen on iOS / modern
  marketing sites.
- Theme toggle uses icons as labels (sun/moon), not text — explicit in
  TOGGLE-03.

</specifics>

<deferred>
## Deferred Ideas

- JSDoc deprecation note on `SegmentedControl` steering 2-option
  callers to `Toggle` — evaluated, deferred. The type/runtime
  2-segment constraint on `Toggle` (D-03) plus the explicit
  "SegmentedControl for 3+ options" rule already guide callers; adding
  JSDoc is cosmetic.
- Any new `toggle.*` i18n namespace — evaluated, deferred. Existing
  keys cover every migrated call site.
- Migrating `SensorTimeWindow` / `DateRangeFilter` / `EmployeeTable` /
  `SignagePage` sub-nav — explicitly out of scope (3+ options).

</deferred>

---

*Phase: 54-toggle-primitive-migrations*
*Context gathered: 2026-04-21*
