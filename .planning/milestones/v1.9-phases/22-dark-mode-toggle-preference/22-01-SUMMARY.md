---
phase: 22-dark-mode-toggle-preference
plan: "01"
subsystem: frontend-theme
tags: [dark-mode, i18n, pre-hydration, fout-prevention]
requires: [21-theme-infrastructure]
provides:
  - pre-hydration-theme-script
  - theme-toggle-i18n-keys
affects: [frontend/index.html, frontend/src/locales]
tech-stack:
  added: []
  patterns:
    - synchronous-iife-in-head
    - localStorage-theme-contract
    - matchMedia-os-fallback
key-files:
  created: []
  modified:
    - frontend/index.html
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
decisions:
  - Inline IIFE script in <head> before <style>, before module bundle (D-04/D-05 FOUT prevention)
  - try/catch wrap for localStorage access (handles sandboxed/privacy-mode contexts)
  - var + IIFE (not let/const) for maximum parser compatibility with inline script
  - "Farbschema" chosen as German aria-label (neutral, mirrors prefers-color-scheme naming)
metrics:
  duration: 2min
  tasks_completed: 2
  files_modified: 3
  completed_date: 2026-04-14
---

# Phase 22 Plan 01: Pre-hydration Theme Script & i18n Foundation Summary

Pre-hydration inline script in `index.html` sets `.dark` class synchronously from localStorage/OS before React mounts; adds `theme.toggle.*` i18n keys (DE/EN) for Plan 02's ThemeToggle component.

## What Was Built

### Task 1: Pre-hydration theme script (frontend/index.html)

Inserted synchronous IIFE in `<head>` before `<style>` and module script:

```html
<script>
  (function () {
    try {
      var stored = localStorage.getItem('theme');
      var isDark;
      if (stored === 'dark') {
        isDark = true;
      } else if (stored === 'light') {
        isDark = false;
      } else {
        // No explicit choice OR invalid value (D-10, D-11) — fall back to OS
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      // localStorage access can throw in privacy mode / sandboxed iframes — fail silent, default light
    }
  })();
</script>
```

Script runs before any CSS paints → `.dark` present on `<html>` at first paint when appropriate. Invalid/corrupt stored values silently fall back to OS preference. All four must-have truths (first-visit OS, stored-dark, stored-light, invalid-value) satisfied by this logic.

### Task 2: i18n keys (DE/EN parity per DM-08)

Added three keys per locale, grouped next to existing `theme.error_toast`:

| Key                        | English | German     |
| -------------------------- | ------- | ---------- |
| `theme.toggle.light`       | Light   | Hell       |
| `theme.toggle.dark`        | Dark    | Dunkel     |
| `theme.toggle.aria_label`  | Theme   | Farbschema |

Both JSON files parse cleanly and typecheck passes.

## Commits

- `6d944d2` feat(22-01): add pre-hydration theme script to index.html
- `9dfc9f4` feat(22-01): add theme toggle i18n keys for DE/EN

## Verification

- Automated Task 1 verify: OK (script in head, before module; contains getItem, matchMedia, classList.add dark)
- Automated Task 2 verify: OK (all 3 keys present in both locales with correct values)
- `npx tsc --noEmit` from frontend/: exit 0

## Deviations from Plan

None. Plan executed exactly as written.

### Pre-existing Issues (Out of Scope)

`npm run build` fails due to pre-existing TypeScript errors in `frontend/src/components/dashboard/SalesTable.tsx` (already documented in `.planning/phases/21-dark-mode-theme-infrastructure/deferred-items.md`). Unrelated to Plan 22-01 changes — `npx tsc --noEmit` passes. Logged to existing deferred-items file; deferred to a future plan per Scope Boundary rule.

## Requirements Satisfied

- DM-06 (partial): pre-hydration script reads OS preference via matchMedia (live reactive behavior lands in Plan 02)
- DM-08 (partial): i18n keys exist in both locales; consumed by Plan 02's ThemeToggle

## Known Stubs

None.

## Self-Check: PASSED

- frontend/index.html: FOUND (inline script verified)
- frontend/src/locales/en.json: FOUND (keys verified)
- frontend/src/locales/de.json: FOUND (keys verified)
- Commit 6d944d2: FOUND
- Commit 9dfc9f4: FOUND
