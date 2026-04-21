---
phase: 54-toggle-primitive-migrations
plan: 05
subsystem: ui
tags: [react, i18next, toggle-primitive, a11y, navbar]

requires:
  - phase: 54-toggle-primitive-migrations
    provides: "Toggle primitive (2-segment generic Toggle<T> with keyboard nav + reduced-motion) at frontend/src/components/ui/toggle.tsx"
provides:
  - "LanguageToggle migrated to 2-segment Toggle rendering DE + EN with the active language highlighted"
  - "TOGGLE-02 closure: the NavBar EN/DE language switch uses the shared Toggle primitive"
affects: [59-a11y-sweep, future i18n work touching language toggle copy]

tech-stack:
  added: []
  patterns:
    - "D-11 preserve-logic swap-visual: i18n.changeLanguage call kept byte-for-byte identical; only the JSX layer changed"
    - "Hardcoded English aria-label on language toggle (consistent with ThemeToggle + NavBar landmarks)"

key-files:
  created: []
  modified:
    - "frontend/src/components/LanguageToggle.tsx"

key-decisions:
  - "No new i18n keys: DE/EN glyphs are language codes, not translatable copy (matches previous behavior and CONTEXT deferred list)"
  - "aria-label='Language' hardcoded English — consistent with NavBar siblings (aria-label='Navigation'/'Sign out')"
  - "Explicit <Toggle<Language> generic to prevent TS widening of the 2-tuple literal value type"

patterns-established:
  - "D-11 carry-over for text-label Toggles: target-state single-button UIs become current-state-highlighted 2-segment Toggles without touching business logic"

requirements-completed: [TOGGLE-02]

duration: 101s
completed: 2026-04-21
---

# Phase 54 Plan 05: LanguageToggle Migration Summary

**NavBar EN/DE language switch migrated from a single target-language `<button>` to a 2-segment `Toggle` primitive showing both languages with the active one highlighted; i18next persistence byte-for-byte preserved.**

## Performance

- **Duration:** 101s (~1m 41s)
- **Started:** 2026-04-21T20:00:42Z
- **Completed:** 2026-04-21T20:02:23Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Rewrote `frontend/src/components/LanguageToggle.tsx` to render `Toggle<Language>` with `{value:"de", label:"DE"}` / `{value:"en", label:"EN"}` segments.
- Active segment reflects `i18n.language`; inactive segment click / ArrowLeft / ArrowRight / Enter / Space triggers `void i18n.changeLanguage(next)` — the exact persistence path the old single-button version used.
- Zero new i18n keys. Zero changes to NavBar.tsx (still one `<LanguageToggle />` call site). No `dark:` classes, no hex literals.
- Closes TOGGLE-02.

## Task Commits

1. **Task 1: Swap LanguageToggle JSX to 2-segment Toggle (DE/EN); preserve i18next switch logic** — `e55b6a7` (refactor)

## Files Created/Modified
- `frontend/src/components/LanguageToggle.tsx` — swapped raw `<button>` for `Toggle<Language>` primitive; preserved `useTranslation` + `i18n.changeLanguage`; added `Language` type alias for the 2-tuple generic.

## Decisions Made
- Followed plan's D-11 recipe verbatim: only the JSX/visual layer changed; language-switch and persistence untouched.
- Kept aria-label hardcoded English (`"Language"`) consistent with existing NavBar siblings — explicitly not a regression, a direct continuation of the prior component's behavior.
- Did not add any `toggle.*` i18n namespace (deferred per phase CONTEXT).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

`npm run build` exits non-zero because `tsc -b` surfaces pre-existing TypeScript errors in files untouched by this plan (`SalesTable.tsx`, `useSensorDraft.ts`, `lib/defaults.ts`, `signage/pages/SchedulesPage.test.tsx`). Confirmed these errors exist on HEAD with Plan 54-05 edits stashed out — they predate this plan. Logged to `.planning/phases/54-toggle-primitive-migrations/deferred-items.md` for a dedicated cleanup (SCOPE BOUNDARY rule).

Scoped verification on this plan's file passes: `npx tsc --noEmit` is clean in isolation (no type errors introduced by LanguageToggle.tsx), and all acceptance-criteria greps pass:
- imports `Toggle` from `@/components/ui/toggle` ✓
- contains `<Toggle`, `"DE"`, `"EN"`, `i18n.changeLanguage` ✓
- no `<button`, no `dark:`, no hex literal, no `segmented-control` import, no new i18n key read ✓
- `grep -c '<LanguageToggle' NavBar.tsx` = 1 ✓

## User Setup Required

None.

## Next Phase Readiness
- TOGGLE-02 closed; Wave 2 of Phase 54 has consumed the Wave 1 Toggle primitive in five call sites (NavBar Sales/HR tabs, chart-type switches, ThemeToggle, and now LanguageToggle).
- Pre-existing tsc errors should be swept before v1.19 closes (tracked in `deferred-items.md`).

## Self-Check

- File exists: FOUND frontend/src/components/LanguageToggle.tsx
- Commit exists: FOUND e55b6a7
- NavBar still renders `<LanguageToggle />` (1 occurrence): FOUND

## Self-Check: PASSED

---
*Phase: 54-toggle-primitive-migrations*
*Completed: 2026-04-21*
