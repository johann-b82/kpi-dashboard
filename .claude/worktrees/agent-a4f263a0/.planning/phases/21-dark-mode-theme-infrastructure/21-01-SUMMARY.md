---
phase: 21-dark-mode-theme-infrastructure
plan: "01"
subsystem: frontend/theme
tags: [dark-mode, ThemeProvider, MutationObserver, CSS-variables, brand-tokens]
dependency_graph:
  requires: []
  provides: [mode-aware-ThemeProvider]
  affects: [all-pages-via-ThemeProvider, dark-mode-toggle-phase-22]
tech_stack:
  added: []
  patterns:
    - MutationObserver for external class change detection
    - Token split: surface tokens (mode-conditional) vs accent tokens (always apply)
key_files:
  created: []
  modified:
    - frontend/src/components/ThemeProvider.tsx
decisions:
  - Surface tokens (--background, --foreground, --muted, --destructive) are removed as inline styles in dark mode so the .dark CSS block wins
  - Accent tokens (--primary, --accent) always applied inline in both modes per DM-04
  - MutationObserver on document.documentElement class attribute chosen over polling for external .dark class detection
metrics:
  duration: 5min
  completed: "2026-04-14"
  tasks: 1
  files: 1
---

# Phase 21 Plan 01: Mode-Aware ThemeProvider Summary

Mode-aware ThemeProvider with MutationObserver that applies accent tokens in both modes and removes surface inline styles in dark mode so the .dark CSS block takes effect.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Make ThemeProvider mode-aware with MutationObserver | 1417a04 | frontend/src/components/ThemeProvider.tsx |

---

## What Was Built

`ThemeProvider.tsx` was extended to split the 6 brand CSS tokens into two groups:

**SURFACE_TOKEN_KEYS** (`color_background`, `color_foreground`, `color_muted`, `color_destructive`): Applied inline only in light mode. In dark mode, `style.removeProperty` is called for each so the `.dark` CSS block in `index.css` wins (CSS specificity: inline > class rule — removing the inline style lets the class rule activate).

**ACCENT_TOKEN_KEYS** (`color_primary`, `color_accent`): Always applied via `style.setProperty` regardless of mode, satisfying DM-04 (brand accent identical in both modes).

A `MutationObserver` watches `document.documentElement` for `class` attribute changes. When `.dark` is added or removed (via devtools in Phase 21, or the Phase 22 toggle), the observer fires and re-runs `applyTheme` with the current effective settings. The observer closure stays fresh because it is created inside the `useEffect` that has `effective` as a dependency — settings updates reconnect the observer with the latest data. Cleanup is via `observer.disconnect()` in the effect teardown.

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Known Stubs

None. The ThemeProvider modification is complete and fully wired — no placeholder data, no TODO paths.

---

## Verification

TypeScript compiled clean (`npx tsc --noEmit` exits 0).

Acceptance criteria confirmed:
- `grep -c "MutationObserver"` → 1 (pass, >= 1)
- `grep -c "SURFACE_TOKEN_KEYS"` → 3 (pass, >= 2)
- `grep -c "ACCENT_TOKEN_KEYS"` → 2 (pass, >= 2)
- `grep -c "classList.contains"` → 1 (pass, >= 1)
- `grep -c "style.removeProperty"` → 1 (pass, >= 1)
- `grep -c "attributeFilter"` → 1 (pass, >= 1)
- Surface token `setProperty` calls are inside the `!isDark` branch only (no unconditional path)

## Self-Check: PASSED
