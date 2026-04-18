---
phase: 21-dark-mode-theme-infrastructure
plan: "03"
subsystem: frontend-components
tags: [dark-mode, theme-tokens, tailwind, shadcn, color-audit]
dependency_graph:
  requires: [21-01, 21-02]
  provides: [DM-01, DM-02]
  affects: [frontend/src/components/UploadHistory.tsx, frontend/src/components/DropZone.tsx, frontend/src/components/ErrorList.tsx, frontend/src/components/dashboard/EmployeeTable.tsx, frontend/src/components/settings/PersonioCard.tsx]
tech_stack:
  added: []
  patterns: ["CSS variable arbitrary values (bg-[var(--color-success)])", "Tailwind opacity modifiers on arbitrary values (bg-[var(--color-success)]/20)", "Token-based semantic colors replacing hardcoded Tailwind utilities"]
key_files:
  created: []
  modified:
    - frontend/src/components/UploadHistory.tsx
    - frontend/src/components/DropZone.tsx
    - frontend/src/components/ErrorList.tsx
    - frontend/src/components/dashboard/EmployeeTable.tsx
    - frontend/src/components/settings/PersonioCard.tsx
decisions:
  - "SalesTable.tsx build errors are pre-existing (out of scope) — deferred to future plan"
  - "npx tsc --noEmit passes for all modified files; npm run build fails on pre-existing SalesTable.tsx errors only"
metrics:
  duration: "~4 minutes"
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_modified: 5
---

# Phase 21 Plan 03: Non-Chart Consumer Component Token Migration Summary

Token migration of all five non-chart consumer components — replacing hardcoded Tailwind gray/slate/semantic/primary color utilities with CSS variable token references so all surfaces adapt to dark mode.

## What Was Built

All five component files in the plan's scope converted from hardcoded Tailwind color utilities to token-based equivalents. The full-frontend audit (four grep passes) confirmed zero remaining hardcoded colors across the entire `frontend/src` tree (excluding documented exceptions).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Convert UploadHistory, DropZone, ErrorList to token utilities | 80ffc85 | UploadHistory.tsx, DropZone.tsx, ErrorList.tsx |
| 2 | Convert EmployeeTable and PersonioCard + full audit | 22e7ef6 | EmployeeTable.tsx, PersonioCard.tsx |

## Token Substitutions Applied

### UploadHistory.tsx
- StatusBadge success: `bg-green-600 text-white hover:bg-green-600` → `bg-[var(--color-success)] text-white hover:bg-[var(--color-success)]`
- StatusBadge partial: `bg-yellow-400 text-slate-900 hover:bg-yellow-400` → `bg-[var(--color-warning)] text-foreground hover:bg-[var(--color-warning)]`
- StatusBadge failed: `bg-red-600 text-white hover:bg-red-600` → `bg-destructive text-destructive-foreground hover:bg-destructive`
- Column header: `text-slate-500` → `text-muted-foreground`
- Loading skeleton: `bg-slate-200` → `bg-muted`
- Empty state: `text-slate-700` → `text-foreground`, `text-slate-500` → `text-muted-foreground`
- Uploaded at cell: `text-slate-500` → `text-muted-foreground`
- Error count cell: `text-slate-400` / `text-slate-700` → `text-muted-foreground` / `text-foreground`
- Delete button: `hover:text-red-600 hover:bg-red-50` → `hover:text-destructive hover:bg-destructive/10`

### DropZone.tsx
- Idle/pending container: `bg-slate-100 border-slate-300` → `bg-muted border-border`
- Drag-active container: `bg-blue-50 border-solid border-blue-600` → `bg-primary/5 border-solid border-primary`
- Spinner: `text-blue-600` → `text-primary`
- Processing text: `text-slate-500` → `text-muted-foreground`
- Drag-active prompt: `text-blue-600` → `text-primary`
- Idle prompt: `text-slate-600` → `text-muted-foreground`
- "Or" label / accepted formats: `text-slate-400` → `text-muted-foreground`
- Browse button: removed `bg-blue-600 hover:bg-blue-700 text-white` className (shadcn default variant uses `--primary` automatically)
- Invalid file type error: `text-red-600` → `text-destructive`

### ErrorList.tsx
- Container border: `border-red-600` → `border-destructive`
- Error heading: `text-red-600` → `text-destructive`
- Error item text: `text-slate-700` → `text-foreground`

### EmployeeTable.tsx
- Active status badge: `bg-green-100 text-green-800` → `bg-[var(--color-success)]/20 text-[var(--color-success)]`
- Inactive/fallback badge: `bg-gray-100 text-gray-600` → `bg-muted text-muted-foreground`

### PersonioCard.tsx
- Test connection success: `text-green-600 dark:text-green-400` → `text-[var(--color-success)]`
- Sync success icon: `text-green-600` → `text-[var(--color-success)]`

## Full-Frontend Audit Results

All four audit greps from 21-UI-SPEC.md ran across `frontend/src` (excluding index.css) — zero defects found:

1. **Gray scale audit** (`gray|slate|neutral|zinc`): PASS — zero matches
2. **Semantic color audit** (`red|green|blue|yellow|amber`): PASS — zero matches
3. **Hex literal audit**: PASS — zero matches
4. **rgb/hsl/oklch audit**: PASS — zero matches

## Deviations from Plan

### Out-of-Scope Issue (Not Fixed)

**Pre-existing build errors in SalesTable.tsx**
- **Found during:** Task 2 build verification
- **Issue:** `npm run build` fails with TypeScript errors in `frontend/src/components/dashboard/SalesTable.tsx` — present before this plan (confirmed via `git log`)
- **Fix:** Not applied — out of scope per scope boundary rule
- **Impact on this plan:** `npm run build` acceptance criterion cannot be fully met. However, `npx tsc --noEmit` passes for all files. Vite's build uses stricter type checking than tsc standalone.
- **Logged to:** `.planning/phases/21-dark-mode-theme-infrastructure/deferred-items.md`

## Known Stubs

None — all token substitutions are wired to CSS variable tokens defined in `frontend/src/index.css` `@theme` block.

## Self-Check: PASSED

- All 5 modified files exist on disk
- Commit 80ffc85 exists: Task 1 (UploadHistory, DropZone, ErrorList)
- Commit 22e7ef6 exists: Task 2 (EmployeeTable, PersonioCard)
- TypeScript clean: `npx tsc --noEmit` exits 0
- Full-frontend audit: all 4 grep passes show zero defects
