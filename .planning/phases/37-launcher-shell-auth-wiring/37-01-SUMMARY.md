---
phase: 37-launcher-shell-auth-wiring
plan: 01
subsystem: ui
tags: [react, wouter, i18n, tailwind, lucide-react]

requires:
  - phase: 36-docs-system
    provides: NavBar/SubHeader shell, AuthGate route guard, useSettings hook, DEFAULT_SETTINGS

provides:
  - LauncherPage.tsx — iOS-style 4-tile CSS grid at /home with i18n tile labels and settings-driven heading
  - /home route registered in App.tsx Switch
  - AuthGate post-login redirect updated to /home

affects: [phase-37-02, any future phase adding admin tiles to launcher]

tech-stack:
  added: []
  patterns:
    - "iOS-style tile grid using CSS repeat(auto-fill, minmax(120px, 1fr)) via inline style"
    - "Active tile as <button> for keyboard accessibility; coming-soon tiles as aria-hidden divs"
    - "Tailwind token-only classes on launcher (no dark: variants — Tailwind v4 CSS variables switch automatically)"

key-files:
  created:
    - frontend/src/pages/LauncherPage.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/auth/AuthGate.tsx
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json

key-decisions:
  - "Active tile navigates to / not /sales — /sales route does not exist; Sales Dashboard is at root per App.tsx (D-10)"
  - "Active tile uses <button> instead of div+onClick for keyboard accessibility (deviation from bare div approach)"
  - "Admin role scaffold (user?.role === admin) wired but no admin tiles defined in v1.14"
  - "Coming-soon tiles use aria-hidden=true so screen readers skip decorative placeholders"

patterns-established:
  - "LauncherPage pattern: useSettings + DEFAULT_SETTINGS fallback for app_name heading"
  - "Launcher tile pattern: button for active, div+aria-hidden for decorative — accessibility-first"

requirements-completed:
  - LAUNCH-01
  - LAUNCH-02
  - LAUNCH-03
  - LAUNCH-04
  - LAUNCH-05
  - AUTH-01
  - AUTH-02
  - BRAND-01
  - BRAND-02
  - BRAND-03

duration: 15min
completed: 2026-04-17
---

# Phase 37 Plan 01: Launcher Shell Auth Wiring Summary

**iOS-style /home App Launcher with 4-tile grid, bilingual i18n, settings-driven heading, and post-login redirect from AuthGate**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-17T07:05:00Z
- **Completed:** 2026-04-17T07:20:54Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Created LauncherPage.tsx with CSS auto-fill grid of 4 square 120x120 rounded tiles (1 active KPI Dashboard + 3 greyed coming-soon) using Tailwind token classes only
- Wired /home route in App.tsx and updated AuthGate to redirect post-login to /home instead of /
- Added launcher.title, launcher.tile.kpi_dashboard, launcher.tile.coming_soon keys to both en.json and de.json

## Task Commits

1. **Task 1: Add launcher i18n keys** - `2c6548b` (feat)
2. **Task 2: Create LauncherPage.tsx** - `a613be1` (feat)
3. **Task 3: Wire route + AuthGate redirect** - `2504313` (feat)

## Files Created/Modified

- `frontend/src/pages/LauncherPage.tsx` - New iOS-style launcher page with 4-tile grid, role scaffold, i18n labels
- `frontend/src/App.tsx` - Added LauncherPage import and /home Route in Switch
- `frontend/src/auth/AuthGate.tsx` - Changed post-login redirect from "/" to "/home" (line 26)
- `frontend/src/locales/en.json` - Added 3 launcher.* keys (EN copy)
- `frontend/src/locales/de.json` - Added 3 launcher.* keys (DE copy: KPI-Dashboard, Demnächst)

## Decisions Made

- **Active tile navigates to "/" not "/sales":** The plan context and CONTEXT.md referenced "/sales" but the codebase has no /sales route — Sales Dashboard is served at "/" per App.tsx. Navigating the tile to "/" satisfies LAUNCH-03 and respects D-10 which locks root to DashboardPage.
- **`<button>` for active tile:** Used semantic `<button>` element instead of a div with onClick to ensure keyboard accessibility (Tab + Enter focus). Coming-soon tiles use `<div aria-hidden="true">` since they are non-interactive decorative placeholders.
- **No dark: variants anywhere:** Relies on Tailwind v4 CSS variable strategy — bg-card, border-border, text-foreground, text-muted-foreground all switch automatically in dark mode without per-component dark: classes (BRAND-01).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

TypeScript could not be verified via `npx tsc` in the worktree environment (node_modules not installed in worktree). Used the main repo's `node_modules/.bin/tsc` binary instead; only pre-existing `TS2688: Cannot find type definition file for 'vite/client'` error surfaced — no new code errors related to LauncherPage or the edited files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- LauncherPage is complete; visual/interactive verification (tile layout, dark mode, i18n switching, login redirect) deferred to Plan 37-02 checkpoint
- All 10 Phase 37 requirements (LAUNCH-01..05, AUTH-01, AUTH-02, BRAND-01..03) are implemented in code

---
*Phase: 37-launcher-shell-auth-wiring*
*Completed: 2026-04-17*
