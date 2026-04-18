---
phase: 23-contrast-audit-fix
plan: "01"
subsystem: frontend
tags: [contrast, wcag, tokens, badges, dark-mode]
dependency_graph:
  requires: []
  provides: [darkened-success-token, employee-table-badge-fix]
  affects: [UploadHistory.tsx, PersonioCard.tsx, EmployeeTable.tsx]
tech_stack:
  added: []
  patterns: [token-first-fix, per-component-override-last-resort]
key_files:
  created: []
  modified:
    - frontend/src/index.css
    - frontend/src/components/dashboard/EmployeeTable.tsx
decisions:
  - "--color-success darkened to #15803d (green-700) per D-05/D-08: same hue, one shade darker, mode-invariant"
  - "EmployeeTable active badge uses text-foreground instead of text-[var(--color-success)] per D-06: same-color-on-tinted-self cannot pass 4.5:1 at any shade"
  - "StatusBadge success variant in UploadHistory.tsx required no code change: it references var(--color-success) and inherits the token fix automatically"
metrics:
  duration: "40s"
  completed_date: "2026-04-14"
  tasks_completed: 3
  files_modified: 2
requirements: [DM-09, DM-10]
---

# Phase 23 Plan 01: Token and Badge Fixes Summary

**One-liner:** Darkened `--color-success` from green-600 (#16a34a) to green-700 (#15803d) and switched EmployeeTable active badge to `text-foreground` to pass WCAG AA 4.5:1 in both light and dark mode.

## What Was Done

### Task 1: Darken --color-success token (index.css)

- **Before:** `--color-success: #16a34a;` (Tailwind green-600, white-on-color = 3.30:1, FAIL)
- **After:** `--color-success: #15803d;` (Tailwind green-700, white-on-color = 5.02:1, PASS)
- **Commit:** 65d63e6
- **Impact:** Propagated automatically to all consumers of `var(--color-success)` — StatusBadge success variant (UploadHistory.tsx) and PersonioCard success text are fixed without touching those files.

### Task 2: EmployeeTable active badge text (EmployeeTable.tsx)

- **Before:** `bg-[var(--color-success)]/20 text-[var(--color-success)]`
- **After:** `bg-[var(--color-success)]/20 text-foreground`
- **Commit:** df36886
- **Reason (D-06):** The text-on-tinted-version-of-itself pattern is fundamentally low-contrast at any shade. Token darkening alone cannot resolve it. `text-foreground` gives ~17:1 light / ~12:1 dark — both well above 4.5:1.
- **Preserved:** Tinted green background kept for visual cue; inactive arm (`bg-muted text-muted-foreground`) untouched.

### Task 3: StatusBadge success variant verification (UploadHistory.tsx)

- **Code change:** None required.
- **Confirmed:** `bg-[var(--color-success)] text-white` is present, no hardcoded green hex literals (`#16a34a`, `#15803d`) in the file.
- **Result:** Inherits token fix automatically. white-on-#15803d = 5.02:1 (PASS).

## Verification

- `grep -r "#16a34a" frontend/src/` → CLEAN (zero matches)
- `grep -n "color-success" frontend/src/index.css` → exactly `--color-success: #15803d;`
- `grep "bg-\\[var(--color-success)\\]/20 text-foreground" EmployeeTable.tsx` → 1 match
- `grep "text-\\[var(--color-success)\\]" EmployeeTable.tsx` → 0 matches
- `grep -c "bg-\\[var(--color-success)\\] text-white" UploadHistory.tsx` → 1

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- frontend/src/index.css modified: FOUND (commit 65d63e6)
- frontend/src/components/dashboard/EmployeeTable.tsx modified: FOUND (commit df36886)
- No #16a34a literals remain in frontend/src/: CONFIRMED
