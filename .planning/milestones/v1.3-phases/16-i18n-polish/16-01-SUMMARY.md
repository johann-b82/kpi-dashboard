---
phase: 16-i18n-polish
plan: 01
subsystem: ui
tags: [react, i18n, react-i18next, typescript, locale]

# Dependency graph
requires:
  - phase: 13-sync-service-settings-extension
    provides: PersonioCard.tsx with hardcoded strings that need i18n
  - phase: 15-hr-kpi-cards-dashboard
    provides: completed HR KPI cards, leaving PersonioCard as last un-i18n'd component
provides:
  - 24 settings.personio.* locale keys in en.json and de.json
  - PersonioCard.tsx fully wired with useTranslation and t() calls
  - Dead hr.placeholder key removed from both locale files
  - Full DE/EN parity at 164 keys each
affects: [16-i18n-polish, any future Settings page work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - INTERVAL_OPTIONS inside component body (not module scope) so t() re-evaluates on language change

key-files:
  created: []
  modified:
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
    - frontend/src/components/settings/PersonioCard.tsx

key-decisions:
  - "INTERVAL_OPTIONS declared inside PersonioCard function body so t() re-evaluates on language change — same pattern as all other translatable option lists"
  - "hr.placeholder was a dead key (HRPage now uses HrKpiCardGrid instead) — safe to remove"

patterns-established:
  - "Dynamic option arrays that need i18n must be declared inside the component function body, never at module scope"

requirements-completed: [I18N-01]

# Metrics
duration: 5min
completed: 2026-04-12
---

# Phase 16 Plan 01: i18n Polish — PersonioCard Summary

**24 settings.personio.* EN/DE translation keys added, hr.placeholder dead key removed, PersonioCard.tsx fully wired with useTranslation — all 164 locale keys now in parity**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-12T15:05:45Z
- **Completed:** 2026-04-12T15:10:16Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added 24 `settings.personio.*` keys to en.json and de.json with correct EN values and proper UTF-8 German umlauts (Stündlich, Täglich, Ändern, wählen)
- Removed dead `hr.placeholder` key from both locale files (HRPage uses HrKpiCardGrid, not a placeholder)
- Wired `useTranslation` into PersonioCard.tsx: import added, `const { t } = useTranslation()` as first line, INTERVAL_OPTIONS moved inside component body, all 20+ hardcoded strings replaced with `t()` calls
- Locale parity check script passes: PARITY OK 164 keys in both files

## Task Commits

1. **Task 1: Add 24 settings.personio.* keys to both locale files and remove dead key** - `c01d244` (feat)
2. **Task 2: Wire useTranslation into PersonioCard.tsx** - `3366b7f` (feat)

## Files Created/Modified

- `frontend/src/locales/en.json` - 24 new settings.personio.* keys added, hr.placeholder removed (142 → 164 keys)
- `frontend/src/locales/de.json` - 24 new settings.personio.* keys with proper UTF-8 umlauts added, hr.placeholder removed (142 → 164 keys)
- `frontend/src/components/settings/PersonioCard.tsx` - useTranslation wired in, INTERVAL_OPTIONS moved inside component, all hardcoded strings replaced with t() calls

## Decisions Made

- INTERVAL_OPTIONS moved inside component body (not module scope) so t() hook re-evaluates on language change — this is the correct React i18n pattern
- hr.placeholder confirmed as dead key: the HRPage now renders HrKpiCardGrid (Phase 15) and never used hr.placeholder — safe removal

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Worktree branch was behind main (had diverged at Phase 9). Merged main into worktree branch before executing — fast-forward merge with no conflicts. This is expected worktree initialization behavior.

## Known Stubs

None — all 24 new keys have real values wired to real UI strings. No placeholder text.

## Next Phase Readiness

- Phase 16 Plan 01 complete — PersonioCard is now the last component to be i18n'd
- All visible strings in the app have translations in both EN and DE
- Parity check script confirms 164 keys in both locale files
- v1.3 i18n-polish phase is complete (only 1 plan in Phase 16)

---
*Phase: 16-i18n-polish*
*Completed: 2026-04-12*
