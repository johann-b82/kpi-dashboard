---
phase: 23-contrast-audit-fix
plan: "02"
subsystem: frontend
tags: [dark-mode, splash, contrast, wcag, pre-hydration-iife]
dependency_graph:
  requires: []
  provides: [DM-09-partial, splash-dark-mode-fix]
  affects: [frontend/index.html]
tech_stack:
  added: []
  patterns: [pre-hydration-IIFE-CSS-variables]
key_files:
  created: []
  modified:
    - frontend/index.html
decisions:
  - "Extend existing IIFE (not add a new one) to set --splash-bg and --splash-dot on documentElement before the splash <style> is parsed — single source of truth for theme resolution"
  - "Use #1a1a1a / #94a3b8 for dark mode splash (matches --background token and achieves ~7.0:1 contrast); #ffffff / #64748b for light mode (4.76:1, preserved)"
  - "CSS var() fallbacks (#ffffff, #64748b) ensure light-mode rendering even if IIFE fails (JS disabled)"
metrics:
  duration: "2min"
  completed: "2026-04-14"
requirements: [DM-09]
---

# Phase 23 Plan 02: Bootstrap Splash Dark Mode — Summary

**One-liner:** Pre-hydration IIFE extended to set --splash-bg/#1a1a1a and --splash-dot/#94a3b8 CSS variables on documentElement before splash style is parsed, eliminating the white-flash-in-dark-mode bug from Phase 22 UAT Scenario E.

## What Was Built

Closed the Phase 22 UAT Scenario E deferred bug: the bootstrap splash rendered with a hardcoded `#ffffff` white background before React hydrated, causing a visible white flash in dark mode.

### Two surgical changes to `frontend/index.html`

**Change 1 — IIFE extension (lines 21-28, post-edit):**

After the existing `classList.add/remove('dark')` block, inside the try block, BEFORE the catch:
```js
var splashBg = isDark ? '#1a1a1a' : '#ffffff';
var splashDot = isDark ? '#94a3b8' : '#64748b';
document.documentElement.style.setProperty('--splash-bg', splashBg);
document.documentElement.style.setProperty('--splash-dot', splashDot);
```

**Change 2 — Splash `<style>` block update (lines 40-41, post-edit):**

```css
/* Before */
color: #64748b;
background: #ffffff;

/* After */
color: var(--splash-dot, #64748b);
background: var(--splash-bg, #ffffff);
```

### Color rationale

| Mode | Background | Dot | Contrast |
|------|------------|-----|----------|
| Light | `#ffffff` | `#64748b` | 4.76:1 PASS (preserved) |
| Dark | `#1a1a1a` | `#94a3b8` (slate-400) | ~7.0:1 PASS |

- `#1a1a1a` matches `--background` dark token (`oklch(0.145 0 0)` ≈ #1a1a1a from RESEARCH.md §1)
- `#94a3b8` is Tailwind slate-400

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — the CSS variables are fully wired.

## Self-Check: PASSED

- `frontend/index.html` exists and contains `--splash-bg` (2 occurrences), `--splash-dot` (2 occurrences)
- Hardcoded `background: #ffffff` and `color: #64748b;` removed from splash style block
- Commit `8f6b16a` verified in git log
- IIFE existing dark-class logic (`classList.add('dark')`) preserved
