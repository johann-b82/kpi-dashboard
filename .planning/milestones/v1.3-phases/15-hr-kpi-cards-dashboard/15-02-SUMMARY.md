---
phase: 15-hr-kpi-cards-dashboard
plan: 02
subsystem: frontend
tags: [react, tanstack-query, i18n, hr-kpis, intl-numberformat]

requires:
  - phase: 15-hr-kpi-cards-dashboard
    plan: 01
    provides: GET /api/hr/kpis endpoint returning HrKpiResponse
  - phase: 14-navigation-hr-tab-shell
    provides: HRPage shell, sync toolbar, KpiCard/DeltaBadgeStack components
provides:
  - HrKpiCardGrid component with 5 HR KPI cards in 3+2 grid
  - fetchHrKpis() API function and HrKpiValue/HrKpiResponse TypeScript types
  - hrKpiKeys query key factory for TanStack Query
  - Full DE/EN locale strings for HR KPI cards (14 keys each)
affects: [hr-dashboard, settings-page-link]

tech-stack:
  added: []
  patterns: [intl-numberformat-percent, intl-numberformat-currency, static-delta-labels]

key-files:
  created:
    - frontend/src/components/dashboard/HrKpiCardGrid.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/lib/queryKeys.ts
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
    - frontend/src/pages/HRPage.tsx

key-decisions:
  - "Static delta labels (vs. Vormonat / vs. Vorjahr) since HR tab has no time filter"
  - "Intl.NumberFormat for percent (1 decimal) and currency (EUR, 0 decimals) formatting"
  - "isError renders error banner + all cards with em-dash values (not blank grid)"
  - "noSyncYet detection: all 5 KPIs have null value AND is_configured=true"

requirements-completed: [HRKPI-01, HRKPI-02, HRKPI-03, HRKPI-04, HRKPI-05, HRKPI-06]

duration: 3min
completed: 2026-04-12
---

# Phase 15 Plan 02: HR KPI Frontend Cards Summary

**5 HR KPI cards in 3+2 grid with dual delta badges, error/no-sync/unconfigured states, and full DE/EN locale parity**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-12T14:39:13Z
- **Completed:** 2026-04-12T14:42:47Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- HrKpiValue/HrKpiResponse TypeScript interfaces and fetchHrKpis() API function in api.ts
- hrKpiKeys query key factory in queryKeys.ts for TanStack Query cache management
- 14 hr.kpi.* locale keys in both en.json and de.json with full parity (matching Copywriting Contract)
- HrKpiCardGrid component: 5 cards in lg:grid-cols-3 layout (3 top + 2 bottom), Intl.NumberFormat for percent and currency, DeltaBadgeStack with static labels
- Three state banners: error (destructive border), no-sync (muted), unconfigured (inline with Settings link)
- HRPage integration: placeholder replaced with HrKpiCardGrid, hrKpiKeys invalidated on sync success

## Task Commits

Each task was committed atomically:

1. **Task 1: API types, fetch function, query keys, locale strings** - `e53dad5` (feat)
2. **Task 2: HrKpiCardGrid component and HRPage integration** - `4dcbe4a` (feat)

## Files Created/Modified
- `frontend/src/components/dashboard/HrKpiCardGrid.tsx` - 5 HR KPI cards with grid layout, delta badges, state handling
- `frontend/src/lib/api.ts` - HrKpiValue, HrKpiResponse interfaces and fetchHrKpis function
- `frontend/src/lib/queryKeys.ts` - hrKpiKeys factory with all() key
- `frontend/src/locales/en.json` - 14 hr.kpi.* English locale keys
- `frontend/src/locales/de.json` - 14 hr.kpi.* German locale keys
- `frontend/src/pages/HRPage.tsx` - Replaced placeholder with HrKpiCardGrid, added hrKpiKeys invalidation

## Decisions Made
- Static delta labels ("vs. Vormonat" / "vs. Vorjahr") — HR tab has no time filter, so labels are fixed strings not derived from date ranges
- Intl.NumberFormat with locale-aware percent (1 decimal) and EUR currency (0 decimals) — matches existing KpiCardGrid pattern
- Error state shows banner above grid + all cards with em-dash values (cards remain visible, not hidden)
- No-sync detection: all 5 KPIs have null value AND is_configured=true (distinguishes from unconfigured cards)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all data paths are wired to the live /api/hr/kpis endpoint.

## Issues Encountered
- Worktree was behind main; fast-forward merge required to get Phase 12-14 changes before editing

## Next Phase Readiness
- HR tab fully functional with 5 KPI cards, delta badges, and all state handling
- TypeScript compiles cleanly (npx tsc --noEmit passes with zero errors)
- Ready for Phase 15 verification

---
*Phase: 15-hr-kpi-cards-dashboard*
*Completed: 2026-04-12*
