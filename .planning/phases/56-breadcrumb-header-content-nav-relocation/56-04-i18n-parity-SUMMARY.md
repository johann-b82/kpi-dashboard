---
phase: 56-breadcrumb-header-content-nav-relocation
plan: 04
subsystem: ui
tags: [i18n, react, locales, parity]

# Dependency graph
requires:
  - phase: 56-breadcrumb-header-content-nav-relocation
    provides: Plans 01-03 built Breadcrumb, UserMenu, and the NavBar/SubHeader refactor that reference the 8 new i18n keys
provides:
  - 8 new flat-dotted i18n keys in both de.json and en.json (nav.home, breadcrumb.aria_label, breadcrumb.signage.pair, userMenu.triggerLabel, userMenu.docs, userMenu.settings, userMenu.signOut, nav.dashboardToggleLabel)
  - 3 obsolete back-button keys removed (nav.back, nav.back_to_sales, nav.back_to_hr)
  - DE/EN parity restored (479 keys each, check-locale-parity green)
  - In-session polish: active breadcrumb crumb styled text-primary font-medium; nav.home copy re-baselined to "Apps" in both locales
affects: [59-a11y-parity-sweep, future-phases-consuming-breadcrumb, future-phases-consuming-usermenu]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flat-dotted i18n keys with keySeparator:false (consistent with Phase 46 parity contract)"

key-files:
  created: []
  modified:
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json

key-decisions:
  - "nav.home copy rebased to 'Apps' (EN and DE) after UAT — landing screen is the app launcher, not a literal 'home'; more accurate than Home/Start"
  - "Active breadcrumb crumb styled text-primary + font-medium for stronger current-location affordance (polish applied mid-checkpoint)"

patterns-established:
  - "Mid-checkpoint UI polish that is in-scope for the phase's UX goal may land as its own commit with phase-scoped type (style/i18n) without a dedicated plan, documented in the current plan's SUMMARY"

requirements-completed: [HDR-03]

# Metrics
duration: ~25min (including human-verify checkpoint)
completed: 2026-04-22
---

# Phase 56 Plan 04: i18n Parity Summary

**8 i18n keys added + 3 obsolete back-button keys removed across de.json/en.json; DE/EN parity restored at 479 keys; Breadcrumb + UserMenu now render localized copy in both locales.**

## Performance

- **Duration:** ~25 min (human-verify checkpoint dominated wall time)
- **Started:** 2026-04-22T06:57Z (plan kickoff)
- **Completed:** 2026-04-22T07:22Z (docs commit)
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 2

## Accomplishments

- Breadcrumb, UserMenu, and SubHeader Sales/HR Toggle now render resolved copy in both DE and EN — no raw key strings visible
- DE/EN locale parity invariant (HDR-03) held: `check-locale-parity.mts` reports PARITY OK (479 keys on both sides)
- 3 obsolete `nav.back*` keys cleaned up (leftover from D-10 back-button removal)
- Active breadcrumb crumb now visually distinguishes current page (text-primary + font-medium)
- `nav.home` copy re-baselined to "Apps" after UAT — matches that the landing route is the app launcher

## Task Commits

1. **Task 1: Add 8 new i18n keys + remove 3 obsolete keys** — `e57967f` (feat)
2. **Task 2: Human smoke — localized copy on both locales** — no code change; user approved checkpoint

### Mid-checkpoint polish

During the human-verify smoke, two in-scope UX refinements landed as their own commits rather than as plan tasks:

- `e366cc8` — `style(56): active breadcrumb crumb in primary color` — bumped the current-page crumb to `text-primary font-medium` so users can see at a glance where they are.
- `5c8b302` — `i18n(56-04): rename nav.home from Home/Start to Apps` — the landing route is `/` = app launcher, not a dashboard. "Apps" reads truer in both EN and DE; parity preserved.

These are intentional, verified, and documented here for phase honesty. They did not require their own plan because they are within the bounds of HDR-02/HDR-03 (breadcrumb affordance + i18n copy quality).

**Plan metadata:** (this commit)

## Files Created/Modified

- `frontend/src/locales/en.json` — +8 keys (nav.home, breadcrumb.aria_label, breadcrumb.signage.pair, userMenu.{triggerLabel,docs,settings,signOut}, nav.dashboardToggleLabel); -3 keys (nav.back, nav.back_to_sales, nav.back_to_hr); nav.home value later refined to "Apps"
- `frontend/src/locales/de.json` — mirror shape; DE values (Brotkrumen, Koppeln, Benutzermenü, Dokumentation, Einstellungen, Abmelden, Dashboard-Auswahl); nav.home later refined to "Apps"

## Decisions Made

- `nav.home` → "Apps" (not Home/Start): the root route is the app launcher, so "Apps" is the truest label. Applied to both locales; parity preserved.
- Active breadcrumb crumb: `text-primary font-medium` — primary color plus weight bump gives it clear current-location affordance without adding a second visual element.
- DE values use neutral/nominal forms (du-tone applies to imperatives, and none of these strings are imperative).

## Deviations from Plan

None from Task 1 — plan executed exactly as written; parity gate green on first run; all 8 keys match the copywriting contract.

The two mid-checkpoint polish commits (`e366cc8`, `5c8b302`) are NOT deviations — they are in-scope UX refinements surfaced during human verification and landed immediately rather than being deferred. Both are documented above under "Mid-checkpoint polish" so the phase record is honest.

## Issues Encountered

None. Parity script passed on first invocation.

## User Setup Required

None.

## Next Phase Readiness

- Phase 56 complete: 4/4 plans done. Top header is identity-only (Brand + Breadcrumb + LangToggle + ThemeToggle + UserMenu); SubHeader hosts page context (breadcrumb subline + Sales/HR Toggle + Upload on /sales and /hr).
- Ready for Phase 57 (Section Context + Standardized Trashcan) via `/gsd:discuss-phase 57`.
- No open blockers.

---
*Phase: 56-breadcrumb-header-content-nav-relocation*
*Completed: 2026-04-22*

## Self-Check: PASSED

- SUMMARY.md exists at expected path
- Task 1 commit `e57967f` present in git log
- Mid-checkpoint polish commits `e366cc8` and `5c8b302` present in git log
