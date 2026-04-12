---
phase: 17-navbar-layout-polish
plan: 02
subsystem: ui
tags: [react, layout, subheader, date-range, freshness, wouter]

requires:
  - phase: 17-navbar-layout-polish/01
    provides: DateRangeContext, NavBar with upload icon
provides:
  - SubHeader component with route-aware freshness and conditional DateRangeFilter
  - Layout wiring with DateRangeProvider in App.tsx
  - Sync button relocated to PersonioCard in Settings
affects: []

tech-stack:
  added: []
  patterns:
    - "Route-aware sub-header: conditionally renders content based on useLocation()"
    - "Context-driven filter state: SubHeader reads DateRangeContext, DashboardPage consumes it"

key-files:
  created:
    - frontend/src/components/SubHeader.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/pages/HRPage.tsx
    - frontend/src/pages/DashboardPage.tsx
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/components/settings/PersonioCard.tsx

key-decisions:
  - "SubHeader shows HrFreshnessIndicator on /hr, sales FreshnessIndicator on all other routes"
  - "No bottom border on SubHeader — user preference for clean separator"
  - "32px gap between navbar and sub-header (top-24), reduced page top padding to pt-4"
  - "Sync button moved from HRPage to PersonioCard in Settings"

patterns-established:
  - "Route-aware SubHeader: use useLocation() to conditionally render route-specific content"

requirements-completed: [LAY-01, LAY-02, I18N-01]

duration: 15min
completed: 2026-04-12
---

# Plan 02: SubHeader + App.tsx Layout Summary

**SubHeader with route-aware freshness, DateRangeFilter on Sales tab, and sync button relocated to Settings**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 6

## Accomplishments
- SubHeader component positioned below navbar with DateRangeFilter (Sales tab) and FreshnessIndicator (all tabs)
- HR tab shows HR sync freshness instead of upload freshness
- App.tsx wired with DateRangeProvider wrapping NavBar + SubHeader + main
- Sync button moved from HRPage to PersonioCard in Settings per user feedback
- Spacing balanced: 32px navbar→sub-header gap, 16px sub-header→content gap

## Task Commits

1. **Task 1: Create SubHeader and wire App.tsx** - `8325dc7` (feat)
2. **Task 2: Visual verification** - checkpoint, user-approved with fixes:
   - `60c04f0` - Remove bottom border from SubHeader
   - `84abab2` - Show HR sync freshness on HR tab
   - `4160326` - Move sync button to Settings, simplify HR page
   - `e163a85` - Add 32px gap between navbar and sub-header
   - `876b1ce` - Reduce spacing between sub-header and content

## Files Created/Modified
- `frontend/src/components/SubHeader.tsx` - Route-aware sub-header with DateRangeFilter and freshness
- `frontend/src/App.tsx` - DateRangeProvider wrapping, SubHeader placement, pt-36 offset
- `frontend/src/pages/HRPage.tsx` - Simplified to just HrKpiCardGrid
- `frontend/src/pages/DashboardPage.tsx` - Reduced top padding
- `frontend/src/pages/SettingsPage.tsx` - Reduced top padding
- `frontend/src/components/settings/PersonioCard.tsx` - Added sync button

## Decisions Made
- No border/shadow on SubHeader per user preference
- HR freshness shows last sync time, not upload time
- Sync button belongs in Settings, not on HR page
- 32px navbar-to-subheader gap, 16px subheader-to-content gap

## Deviations from Plan
- SubHeader `border-b border-border` removed per user feedback (LAY-01 separator not wanted)
- HrFreshnessIndicator added to SubHeader for route-aware freshness display
- Sync button relocated from HRPage to PersonioCard
- Spacing adjusted from original plan values

## Issues Encountered
None

## Next Phase Readiness
- Phase 17 layout changes complete
- All navbar and sub-header requirements addressed

---
*Phase: 17-navbar-layout-polish*
*Completed: 2026-04-12*
