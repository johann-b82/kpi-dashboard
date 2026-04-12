# Phase 17: Navbar & Layout Polish - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Visual refinement of the navbar and introduction of a persistent sub-header row. Deliverables:

- Smaller logo (~32px) in the existing h-16 navbar
- Underline-style active tab indicator (blue underline + bold, no pill/background)
- Upload tab removed from tab navigation; upload accessible via Upload icon in navbar action area
- Horizontal separator line below the tab bar
- Persistent sub-header row below separator: date range preset buttons (left-aligned) on Sales tab, freshness timestamp (right-aligned) on all tabs
- FreshnessIndicator relocated from navbar action area to sub-header
- All new/modified strings in both DE and EN locale files

Out of scope:
- Backend API changes (frontend-only milestone)
- New KPI cards or data features
- Mobile responsive layout
- Custom date range picker changes (existing DateRangeFilter logic stays)

</domain>

<decisions>
## Implementation Decisions

### Logo Sizing
- **D-01:** Logo reduced to ~32px (`max-h-8 max-w-8 object-contain`), down from current 56px (`max-h-14 max-w-14`). Logo must be "visibly smaller" per NAV-01.
- **D-02:** Navbar height stays at `h-16` (64px). Smaller logo gets more vertical breathing room.
- **D-03:** Text fallback (`app_name`) scales down proportionally — smaller font size to match 32px logo visual weight.

### Upload Icon Placement
- **D-04:** Upload tab (`<Link href="/upload">`) removed from the tab row (Sales, HR). Upload is no longer a primary navigation item.
- **D-05:** Upload icon uses lucide-react `Upload` (arrow-up-from-line). Positioned in the navbar action area between the DE/EN LanguageToggle and the Settings gear icon.
- **D-06:** Upload icon navigates to `/upload` page on click (same behavior as removed tab — full upload UI with history).
- **D-07:** Upload icon shows active state when on `/upload` route: `text-primary` when active, `text-foreground` otherwise. Same pattern as the existing gear icon (`settingsLinkClass` in NavBar.tsx).

### Sub-header Layout
- **D-08:** Sub-header is a new persistent row below the navbar separator, visible on ALL tabs (Sales, HR, Upload, Settings).
- **D-09:** Sub-header is fixed/sticky, positioned directly below the navbar. Navbar + sub-header form a combined persistent header block. Content `pt-*` offset must account for both.
- **D-10:** On Sales tab (`/`): date range preset buttons left-aligned + freshness timestamp right-aligned.
- **D-11:** On non-Sales tabs (`/hr`, `/upload`, `/settings`): freshness timestamp right-aligned only, left side empty.
- **D-12:** FreshnessIndicator removed from navbar action area entirely. It lives only in the sub-header row. No duplication.
- **D-13:** DateRangeFilter moves from inside DashboardPage to the sub-header. The preset buttons portion renders in the sub-header; DashboardPage still owns the filter state (range, preset) and passes it to KpiCardGrid and RevenueChart.

### Tab Underline Style
- **D-14:** Active tab style unchanged: `border-b-2 border-primary` + `font-semibold` + `text-primary`. Already matches NAV-02 ("blue underline").
- **D-15:** Inactive tab style unchanged: `text-foreground hover:text-primary`. No background highlight, no pill shape — already satisfies NAV-02.
- **D-16:** No changes to tab typography, spacing, or underline thickness needed. Current implementation already meets the spec.

### Claude's Discretion
- Exact sub-header height and padding (should feel lighter than the navbar — likely `py-2` or similar)
- Whether the separator line is part of the navbar bottom border (existing `border-b border-border`) or a separate element
- How DateRangeFilter state is lifted to the layout level (context provider, URL state, or prop drilling through a layout component)
- Exact icon order validation: LanguageToggle → Upload icon → Settings gear (per NAV-04 "between DE/EN toggle and gear icon")
- Sub-header background color (likely `bg-card` to match navbar, or `bg-background` for subtle differentiation)
- FreshnessIndicator visibility on `/upload` and `/settings` — always show since sub-header is persistent on all tabs
- Whether the `/upload` route remains registered in the wouter Switch (yes — the page still exists, only the tab is removed)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and scope
- `.planning/REQUIREMENTS.md` — NAV-01 through NAV-04, LAY-01, LAY-02, I18N-01 are the 7 requirements for this phase
- `.planning/ROADMAP.md` §Phase 17 — goal statement and 5 success criteria
- `.planning/PROJECT.md` — v1.4 milestone goal, constraints, current state

### Prior phase decisions
- `.planning/phases/05-frontend-plumbing-themeprovider-and-navbar/05-CONTEXT.md` — Phase 5 NavBar decisions (D-04 through D-09) define the current navbar architecture this phase modifies

### Existing frontend code (to modify)
- `frontend/src/components/NavBar.tsx` — Primary modification target: logo sizing, tab removal, upload icon addition, FreshnessIndicator removal
- `frontend/src/components/dashboard/FreshnessIndicator.tsx` — Moves from navbar to sub-header; component itself likely unchanged
- `frontend/src/components/dashboard/DateRangeFilter.tsx` — Preset buttons portion moves to sub-header; may need to split presets from custom range picker
- `frontend/src/pages/DashboardPage.tsx` — DateRangeFilter currently rendered here; filter state ownership may need restructuring
- `frontend/src/App.tsx` — Layout structure (ThemeProvider → NavBar → main); sub-header integrates here or in a new layout component

### i18n locale files
- `frontend/src/locales/en.json` — EN translations; check for any new strings (upload tooltip, sub-header labels)
- `frontend/src/locales/de.json` — DE translations; must maintain full parity

### Stack rules
- `CLAUDE.md` §Technology Stack — React 19, Tailwind v4, shadcn/ui wraps @base-ui/react, wouter routing, lucide-react icons

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **NavBar component** (`frontend/src/components/NavBar.tsx`): Fixed h-16 navbar with logo/text slot, tab links, right-side action area (FreshnessIndicator + LanguageToggle + Settings gear). Primary modification target.
- **FreshnessIndicator** (`frontend/src/components/dashboard/FreshnessIndicator.tsx`): Self-contained component querying `fetchLatestUpload()` via TanStack Query. Renders locale-aware timestamp. Can be relocated without internal changes.
- **DateRangeFilter** (`frontend/src/components/dashboard/DateRangeFilter.tsx`): Renders preset buttons (thisMonth, thisQuarter, thisYear, allTime) + custom range picker. May need to split preset buttons into sub-header while keeping custom picker logic.
- **lucide-react icons**: Already installed and used (`Settings` icon in NavBar). `Upload` icon available from same package.
- **settingsLinkClass pattern**: NavBar already has active-state styling for gear icon (`text-primary` when on /settings) — reuse for upload icon.

### Established Patterns
- **Tailwind v4 with CSS vars**: Colors via `--color-*` aliases, runtime theming via ThemeProvider
- **wouter routing**: `useLocation()` for active state detection in NavBar
- **TanStack Query**: FreshnessIndicator uses `useQuery` for data fetching; no changes needed
- **i18n flat keys**: `keySeparator: false`, dotted keys stay literal (e.g., `nav.upload`)

### Integration Points
- **Sub-header insertion**: New component between NavBar and `<main>` in layout. Must be inside ThemeProvider but after NavBar. Fixed positioning below navbar's h-16.
- **DateRangeFilter state lifting**: Currently local to DashboardPage (`useState` for range/preset). Needs to be accessible from sub-header (layout level) while still driving DashboardPage's KpiCardGrid and RevenueChart.
- **Content offset**: Current `pt-16` on main content accounts for h-16 navbar. Must increase to account for navbar + sub-header combined height.
- **FreshnessIndicator route gating removal**: Currently gated on `location === '/' || location === '/upload'` in NavBar. In sub-header, it shows on all tabs — remove the gating logic.

</code_context>

<specifics>
## Specific Ideas

- Upload icon tooltip should use existing `t("nav.upload")` locale key — no new key needed for the tooltip text
- The sub-header is architecturally similar to a "toolbar" pattern — a fixed bar below the primary nav that contextually shows controls
- DateRangeFilter currently uses shadcn Button components for presets; these should carry over to the sub-header without style changes
- FreshnessIndicator's current `text-xs text-muted-foreground` styling works well for the sub-header right-aligned position

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-navbar-layout-polish*
*Context gathered: 2026-04-12*
