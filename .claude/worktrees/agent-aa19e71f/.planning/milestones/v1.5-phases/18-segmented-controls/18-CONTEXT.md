# Phase 18: Segmented Controls - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace all 4 existing toggle/tab controls (Sales/HR nav tabs, date range presets, Balken/Linie chart toggle, DE/EN language toggle) with a single reusable pill-shaped SegmentedControl component. Frontend-only change — no backend modifications. All existing behavior (routing, persistence, draft flow) preserved; only the visual presentation changes.

</domain>

<decisions>
## Implementation Decisions

### Visual Style
- **D-01:** Active segment styled with `bg-foreground text-background` (dark pill on light container). Uses existing semantic tokens — no hardcoded colors.
- **D-02:** Container styled with `bg-muted rounded-full`. No border — background contrast only. Consistent with v1.4 decision to remove SubHeader border.
- **D-03:** Inactive segments are `transparent text-foreground` (or `text-muted-foreground`) within the muted container.

### Navigation Semantics
- **D-04:** Sales/HR segmented control uses `<button>` elements with `onClick` + wouter `navigate()`. Active state derived from `useLocation()`. URL remains source of truth for routing.
- **D-05:** This replaces the current `<Link>` elements with underline active style in NavBar. Loses `<a>` semantics (no right-click "open in new tab") — accepted trade-off for internal tool.

### Sizing & Density
- **D-06:** Single consistent size across all 4 controls: `h-8 text-sm` with uniform padding per segment. Date range presets will be naturally wider due to longer labels but same height and text size.
- **D-07:** No size variants needed in v1.5. If future controls need different sizes, the component API can be extended then.

### Settings Page Sync
- **D-08:** PreferencesCard DE/EN picker also becomes a SegmentedControl — same reusable component. Draft/save/discard flow unchanged; only the visual changes.
- **D-09:** NavBar LanguageToggle disabled-when-dirty behavior (Phase 7 D-13) preserved exactly as-is. The SegmentedControl component receives a `disabled` prop.

### Claude's Discretion
- Component file location and internal API design (props, generic typing)
- Exact padding/gap values within the constraint of h-8 text-sm
- Transition/hover effects (if any — keep subtle)
- Whether to extract a shared hook or keep integration inline per consumer

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — SEG-01 through SEG-06 definitions

### Prior Phase Decisions
- `.planning/phases/07-i18n-integration-and-polish/07-CONTEXT.md` §D-08 — Settings page DE/EN picker pattern
- `.planning/phases/07-i18n-integration-and-polish/07-CONTEXT.md` §D-12/D-13 — NavBar LanguageToggle persistence + disabled-when-dirty behavior
- `.planning/phases/05-frontend-plumbing-themeprovider-and-navbar/05-CONTEXT.md` §D-04/D-07 — NavBar layout structure

### Existing Components (read before modifying)
- `frontend/src/components/NavBar.tsx` — Sales/HR tab links + LanguageToggle placement
- `frontend/src/components/LanguageToggle.tsx` — DE/EN toggle with PUT persistence + draft-dirty guard
- `frontend/src/components/SubHeader.tsx` — DateRangeFilter mount point
- `frontend/src/components/dashboard/DateRangeFilter.tsx` — 4 preset buttons
- `frontend/src/components/dashboard/RevenueChart.tsx` lines 95-112 — Balken/Linie toggle buttons
- `frontend/src/components/settings/PreferencesCard.tsx` — Settings page DE/EN picker

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shadcn/ui Button` — currently used by all 4 controls; SegmentedControl replaces this usage
- `useLocation()` from wouter — already used in NavBar for active state; reuse for nav segmented control
- `useDateRange()` context — provides preset state for date range control
- `useSettingsDraftStatus()` context — provides isDirty for disabling NavBar language toggle

### Established Patterns
- All toggle/tab controls currently use `variant="default"` (active) vs `"outline"` (inactive) on shadcn Button
- NavBar layout: brand slot left, nav links center-left, action area (`ml-auto`) right with LanguageToggle + upload icon + settings icon
- i18n: all labels go through `t()` — segmented control labels must use translation keys

### Integration Points
- `NavBar.tsx` — Sales/HR links replaced with SegmentedControl; LanguageToggle replaced with SegmentedControl
- `SubHeader.tsx > DateRangeFilter` — preset buttons replaced with SegmentedControl
- `RevenueChart.tsx` — chart type buttons replaced with SegmentedControl
- `PreferencesCard.tsx` — DE/EN picker replaced with SegmentedControl
- `DateRangeContext` — preset value feeds into date range SegmentedControl active state

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-segmented-controls*
*Context gathered: 2026-04-12*
