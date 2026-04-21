---
phase: 54-toggle-primitive-migrations
plan: 04
subsystem: frontend/theme
tags: [toggle, theme, dark-mode, migration, a11y]
requires:
  - 54-01-toggle-primitive (Toggle primitive with icon-only segment support)
provides:
  - ThemeToggle rendered via Toggle primitive (TOGGLE-03 closed)
affects:
  - frontend/src/components/ThemeToggle.tsx (visual layer only)
tech-stack:
  added: []
  patterns:
    - "Icon-only Toggle segments (segment.icon without segment.label)"
    - "Preserved v1.9 D-06/D-07 theme logic under a new visual shell"
key-files:
  created: []
  modified:
    - frontend/src/components/ThemeToggle.tsx
decisions:
  - "Visual-layer-only migration: applyMode, matchMedia OS listener, and localStorage persistence preserved byte-for-byte"
  - "Icon-only segments (no label) to keep the toggle compact in navbar; accessible name via aria-label on radiogroup"
  - "Reused existing theme.toggle.aria_label i18n key — no new keys added"
metrics:
  duration: 66s
  tasks: 1
  files: 1
  completed: 2026-04-21
---

# Phase 54 Plan 04: ThemeToggle Migration Summary

## One-liner

Migrated ThemeToggle from a single icon `<button>` (with swapping sun/moon) to a 2-segment `Toggle` primitive (light=Sun, dark=Moon), preserving all v1.9 D-06/D-07 behavior (localStorage persistence, `.dark` class toggling, OS `prefers-color-scheme` live-tracking).

## Tasks

### Task 1: Swap ThemeToggle JSX to 2-segment Toggle — commit `cf57c05`

Rewrote `frontend/src/components/ThemeToggle.tsx`:
- Imported `Toggle` from `@/components/ui/toggle`
- Replaced single-button JSX with `<Toggle<ThemeMode>>` containing 2 icon-only segments
- Kept `applyMode`, `useState` initializer, and `useEffect` matchMedia listener byte-for-byte
- Removed the now-unused `handleClick` and `Icon` variable (replaced by Toggle's onChange + segment.icon)
- Reused existing i18n key `theme.toggle.aria_label`

## Verification

- `cd frontend && npx tsc --noEmit` — zero errors in ThemeToggle.tsx (confirmed via `tsc --noEmit | grep ThemeToggle` returning empty)
- Acceptance grep suite PASSED: imports Toggle, contains `<Toggle`, `<Sun`, `<Moon`, preserves `prefers-color-scheme`, `localStorage.setItem("theme"`, `root.classList.add("dark")`, `root.classList.remove("dark")`, `t("theme.toggle.aria_label")`
- Forbidden-patterns check: no `dark:` variants, no hex color literals

## Deviations from Plan

None — plan executed exactly as written.

## Deferred Issues (out of scope — pre-existing)

`npm run build` surfaces 24 TypeScript errors in unrelated files that pre-date this plan (stash-check confirmed they exist on `HEAD` without ThemeToggle.tsx modifications). These are NOT caused by this plan's changes and fall outside scope:

- `src/components/dashboard/SalesTable.tsx` — 8 errors (Record<string, unknown> index signature + unknown→Key/ReactNode mismatches)
- `src/hooks/useSensorDraft.ts` — 8 errors (erasableSyntaxOnly + duplicate object keys)
- `src/lib/defaults.ts` — 1 error (Settings type missing sensor_* fields)
- `src/signage/pages/SchedulesPage.test.tsx` — 3 errors (unused imports / @ts-expect-error)
- Other — 4 errors in unrelated files

Logged to `.planning/phases/54-toggle-primitive-migrations/deferred-items.md` if the phase adopts that log; otherwise re-surfaced here for visibility. Not blocking TOGGLE-03 closure.

## Decisions Made

1. **Icon-only segments, no `label` field** — Toggle's `segment.icon` + absent `segment.label` keeps the navbar control compact; the radiogroup-level `aria-label` carries the accessible name.
2. **i18n key reuse** — `theme.toggle.aria_label` still fits the new control semantically (it identifies the control, not the action); no new keys added.
3. **Preserve logic verbatim** — `applyMode`, `useState`, `useEffect` matchMedia block, and the D-07 localStorage-wins guard are unchanged; only the `return` JSX differs.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/components/ThemeToggle.tsx`
- FOUND commit: `cf57c05`
