---
phase: 22-dark-mode-toggle-preference
plan: "02"
subsystem: frontend-theme
tags: [dark-mode, toggle, segmented-control, localStorage, matchMedia]
requires: [22-01-pre-hydration, 21-theme-infrastructure]
provides:
  - theme-toggle-component
  - navbar-theme-toggle-mount
affects:
  - frontend/src/components/ThemeToggle.tsx
  - frontend/src/components/NavBar.tsx
tech-stack:
  added: []
  patterns:
    - matchMedia-listener-with-localStorage-gate
    - classList-mutation-observed-by-themeprovider
    - segmented-control-reuse
key-files:
  created:
    - frontend/src/components/ThemeToggle.tsx
  modified:
    - frontend/src/components/NavBar.tsx
decisions:
  - ThemeToggle manages its own state (no context provider) — single consumer in NavBar
  - matchMedia listener gated by localStorage presence (D-07: localStorage wins permanently after first click)
  - ThemeToggle writes only the .dark class + localStorage; ThemeProvider's MutationObserver (Phase 21) re-applies tokens (D-13)
  - ThemeToggle mounted left of LanguageToggle (theme is a more global preference than language)
metrics:
  duration: 1min
  tasks_completed: 2
  files_modified: 2
  completed_date: 2026-04-14
---

# Phase 22 Plan 02: ThemeToggle Component + NavBar Mount Summary

New `ThemeToggle.tsx` React component renders a Light/Dark SegmentedControl in NavBar. Clicking a segment writes `.dark` to `<html>` and `localStorage.theme`; before any click, `matchMedia` tracks OS preference live.

## What Was Built

### Task 1: ThemeToggle component (`frontend/src/components/ThemeToggle.tsx`)

Component contract:

- **Props:** none (self-contained).
- **State:** `useState<ThemeMode>` lazily initialized from `document.documentElement.classList.contains("dark")`.
- **Render:** `<SegmentedControl<"light"|"dark">>` with i18n labels `theme.toggle.light`/`theme.toggle.dark` and `aria-label={t("theme.toggle.aria_label")}`.
- **onChange side effects:**
  1. Mutates `<html>` class via `classList.add("dark")` / `classList.remove("dark")`.
  2. Writes `localStorage.setItem("theme", next)` synchronously.
  3. Updates local `mode` state.
- **matchMedia listener lifecycle (D-06 → D-07 transition):**
  - On mount, attaches `change` listener to `matchMedia('(prefers-color-scheme: dark)')`.
  - Listener first calls `localStorage.getItem('theme')`. If value is `"light"` or `"dark"`, the listener **returns early** — localStorage wins permanently (D-07).
  - Otherwise it adds/removes `.dark` to follow the OS change and syncs local state.
  - Unmount cleanup calls `removeEventListener('change', onOsChange)`.

**D-13 compliance:** The component does NOT import or call into `ThemeProvider`. It only writes the `.dark` class. Phase 21's existing MutationObserver on `document.documentElement` picks up the change and re-applies surface/accent tokens automatically.

### Task 2: NavBar mount (`frontend/src/components/NavBar.tsx`)

- Added `import { ThemeToggle } from "@/components/ThemeToggle"` next to the `LanguageToggle` import.
- Inserted `<ThemeToggle />` immediately before `<LanguageToggle />` inside the existing `ml-auto flex items-center gap-4` right-side cluster. Resulting order: `[ThemeToggle] [LanguageToggle] [Upload icon] [Settings icon]`.
- No wrapper elements added; no spacing changes (existing `gap-4` suffices).

## Commits

- `1f2986d` feat(22-02): add ThemeToggle component
- `c9a7d2c` feat(22-02): mount ThemeToggle in NavBar adjacent to LanguageToggle

## Verification

- Task 1 automated verify: OK (11/11 structural checks — SegmentedControl usage, useTranslation, matchMedia with exact media string, classList.add/remove `'dark'`, localStorage setItem/getItem `'theme'`, all three i18n keys, cleanup).
- Task 1 hex-color guard: OK (no hardcoded hex in new file).
- Task 2 automated verify: OK (import present, element rendered, adjacency `ThemeToggle` before `LanguageToggle` within `ml-auto` block).
- `cd frontend && npx tsc --noEmit`: exit 0 (no TypeScript errors introduced by this plan).

## Deviations from Plan

None for Tasks 1 and 2 themselves. Plan executed exactly as written.

### Pre-existing Issues (Out of Scope)

`npm run build` still fails due to pre-existing TypeScript errors in `frontend/src/components/dashboard/SalesTable.tsx` and `frontend/src/components/dashboard/HrKpiCharts.tsx`. These were already logged in `.planning/phases/21-dark-mode-theme-infrastructure/deferred-items.md` and are unrelated to Plan 22-02 — `npx tsc --noEmit` passes cleanly on all Plan 22-02 files, and the plan's own behavior (ThemeToggle + NavBar mount) typechecks without error. Per Scope Boundary rule, these are deferred.

## Requirements Satisfied

- **DM-05:** Light/Dark SegmentedControl rendered in NavBar adjacent to `LanguageToggle`.
- **DM-06:** `matchMedia('(prefers-color-scheme: dark)')` `change` listener flips `.dark` live while `localStorage.theme` is unset.
- **DM-07:** `onChange` writes `localStorage.setItem('theme', next)` synchronously; matchMedia listener no-ops once stored.
- **DM-08:** Segments consume `theme.toggle.light` / `theme.toggle.dark`; aria-label uses `theme.toggle.aria_label` — all three keys provided by Plan 01 in both DE and EN.
- **DM-04 invariance (indirect):** ThemeToggle mutates only the `.dark` class; Phase 21's MutationObserver re-runs `applyTheme` which preserves accent invariance automatically.

## ThemeProvider Not Modified (D-13 Confirmation)

`ThemeProvider.tsx` was not touched by this plan. Its MutationObserver on `document.documentElement` picks up the `.dark` class mutation and handles surface vs. accent token re-application unchanged.

## Phase 21 Audit Invariants Held

- `grep "#[0-9a-fA-F]{3,8}" frontend/src/components/ThemeToggle.tsx` returns nothing — no hardcoded hex colors.
- No inline surface styles introduced; SegmentedControl wrapping JSX is tokenless (primitive already uses `bg-primary`, `text-primary-foreground`, etc.).

## Known Stubs

None.

## Self-Check: PASSED

- frontend/src/components/ThemeToggle.tsx: FOUND
- frontend/src/components/NavBar.tsx: FOUND (ThemeToggle import + adjacency verified)
- Commit 1f2986d: FOUND
- Commit c9a7d2c: FOUND
