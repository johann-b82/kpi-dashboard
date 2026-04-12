---
phase: 14-navigation-hr-tab-shell
plan: 02
subsystem: frontend-ui, navigation, i18n
tags: [react, wouter, tanstack-query, recharts, tailwind, i18n, hr, sync]

# Dependency graph
requires:
  - phase: 14-01
    provides: [fetchSyncMeta, triggerSync, SyncMetaResponse, syncKeys, nav.sales/hr locale keys]
provides:
  - NavBar with Sales tab (nav.sales), HR tab (nav.hr), conditional FreshnessIndicator
  - HRPage shell with sync freshness display and manual sync button
  - /hr route wired in App.tsx
affects: [14-navigation-hr-tab-shell phase complete, 15+ KPI cards build on HRPage shell]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional NavBar widget: showUploadFreshness = location === '/' || location === '/upload' guards FreshnessIndicator"
    - "HR sync feedback state machine: useState<'idle'|'success'|'error'> with setTimeout reset"
    - "useMutation onSuccess pattern: invalidate syncKeys.meta() + set success feedback + 3s auto-reset"

key-files:
  created:
    - frontend/src/pages/HRPage.tsx
  modified:
    - frontend/src/components/NavBar.tsx
    - frontend/src/App.tsx

key-decisions:
  - "FreshnessIndicator gated on location === '/' || location === '/upload' — hidden on /hr and /settings"
  - "HRPage sync feedback uses local useState (not TanStack Query mutation state alone) for 3s auto-reset of success/error display"
  - "Human verification approved — all visual and functional checks passed"

requirements-completed: [NAV-01, NAV-02, NAV-03]

# Metrics
duration: ~10min
completed: 2026-04-12
---

# Phase 14 Plan 02: NavBar Updates and HRPage Shell Summary

**Multi-tab navigation with Sales/HR tabs, route-conditional FreshnessIndicator, and HR page shell with Personio sync freshness display and manual sync button.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-12
- **Completed:** 2026-04-12
- **Tasks:** 2 (1 auto + 1 human-verify)
- **Files modified:** 3

## Accomplishments

- NavBar "Dashboard" tab renamed to "Sales" / "Vertrieb" (NAV-01) using `t("nav.sales")` locale key
- HR tab added to NavBar navigating to /hr (NAV-02); FreshnessIndicator hidden on /hr and /settings via `showUploadFreshness` guard (D-10)
- HRPage shell: sync freshness display ("Last sync: [timestamp]" or "Not yet synced" with Settings link), manual "Daten aktualisieren" button with loading spinner / green checkmark / error feedback, placeholder text for future KPI cards (NAV-03, D-07)
- TypeScript compiled cleanly; all strings render in both EN and DE; human verification approved

## Task Commits

1. **Task 1: NavBar updates and HRPage component (NAV-01, NAV-02, NAV-03)** - `fb9f475` (feat)
2. **Task 2: Visual verification** - human-verify checkpoint, approved by user

## Files Created/Modified

- `frontend/src/components/NavBar.tsx` - Added nav.sales (renamed from nav.dashboard), nav.hr link, showUploadFreshness conditional guard for FreshnessIndicator
- `frontend/src/pages/HRPage.tsx` - New page: sync meta useQuery, triggerSync useMutation, timestamp formatting via Intl.DateTimeFormat, sync feedback state machine, placeholder text
- `frontend/src/App.tsx` - Added `import { HRPage }` and `<Route path="/hr" component={HRPage} />`

## Decisions Made

- FreshnessIndicator gated on `location === "/" || location === "/upload"` — the upload freshness indicator is contextually relevant only to the sales/upload flow, not HR sync context
- HRPage sync feedback uses a separate `useState<"idle" | "success" | "error">` alongside mutation state to enable the 3-second auto-reset of success/error banners independent of mutation lifecycle

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 14 complete: NavBar navigation, HR page shell, and sync plumbing all in place
- Next phase can build real KPI card components directly into HRPage (the placeholder `<p>` is the mount point)
- Manual sync button already wired to POST /api/sync — sync data will be available as soon as Personio credentials are configured in Settings

---
*Phase: 14-navigation-hr-tab-shell*
*Completed: 2026-04-12*
