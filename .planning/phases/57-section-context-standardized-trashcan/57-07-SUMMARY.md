---
phase: 57-section-context-standardized-trashcan
plan: 07
subsystem: signage-admin-ui
tags: [section-header, delete-button, schedules, ui-consistency]
requires:
  - 57-01-section-header-primitive
  - 57-03-delete-button-composite
  - 57-04-i18n-keys-section-and-ui
provides:
  - SchedulesPage migrated to SectionHeader + DeleteButton
affects:
  - frontend/src/signage/pages/SchedulesPage.tsx
tech-stack:
  added: []
  patterns:
    - "Page section primitive: SectionHeader at top of every render branch (loading/error/main)"
    - "Composite DeleteButton owns dialog state — caller drops local deleteTarget useState"
key-files:
  created: []
  modified:
    - frontend/src/signage/pages/SchedulesPage.tsx
  deleted:
    - frontend/src/signage/components/ScheduleDeleteDialog.tsx
decisions:
  - "DeleteButton onConfirm wraps mutateAsync in async () => { await ... } to coerce Promise<null> -> Promise<void> (DeleteButton's onConfirm contract)"
  - "SectionHeader inserted in all three return branches (loading, error, main) so the section context is always visible — not just when data loads"
  - "Existing toast-based 409 / error handling on deleteMutation.onError preserved (no in-use dialog needed for schedules — Plan 51-02 surfaces backend 409s as toast strings only)"
metrics:
  duration: 3m
  tasks: 1
  files: 2
  completed: 2026-04-22
---

# Phase 57 Plan 07: Schedules Migration Summary

Migrated `SchedulesPage` to the Wave-1 admin chrome primitives — `SectionHeader` at the top of every render branch, `DeleteButton` composite replacing the per-row ghost `Trash2` button — and retired the `ScheduleDeleteDialog` component now that `DeleteButton` owns dialog state internally.

## What Changed

- `SchedulesPage.tsx`: imports `SectionHeader` + `DeleteButton`; drops `Trash2` and `ScheduleDeleteDialog` imports; removes `deleteTarget` / `setDeleteTarget` state; emits `<SectionHeader title=section.signage.schedules.title description=...>` in loading/error/main branches; row trashcan is now `<DeleteButton itemLabel={name} onConfirm={async () => { await deleteMutation.mutateAsync(s.id); }} aria-label={t("ui.delete.ariaLabel", { itemLabel: name })} />`.
- `ScheduleDeleteDialog.tsx`: deleted (`rg "ScheduleDeleteDialog" frontend/src/` → 0 matches).

## Verification

- `rg "ScheduleDeleteDialog" frontend/src/` → 0 ✓
- `rg "SectionHeader|DeleteButton" frontend/src/signage/pages/SchedulesPage.tsx` → 5 (>= 2) ✓
- `test ! -f frontend/src/signage/components/ScheduleDeleteDialog.tsx` ✓
- `npm --prefix frontend run build` — `SchedulesPage.tsx` itself produces zero TS errors after the fix. Pre-existing baseline errors remain in unrelated files (parallel plans 57-05/06/08/09 in flight: `MediaDeleteDialog` not yet retired, `select.tsx` generics, `useSensorDraft.ts` syntax) and pre-existing `SchedulesPage.test.tsx` strictness warnings (`afterEach` unused, two `@ts-expect-error` directives) — all out of scope for 57-07.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Coerce mutateAsync return type to Promise<void>**
- **Found during:** Task 1 verification build
- **Issue:** Plan body suggested `onConfirm={() => deleteMutation.mutateAsync(s.id)}` but `mutateAsync` returns `Promise<null>` (delete endpoint returns null), which violates `DeleteButton.onConfirm: () => void | Promise<void>`.
- **Fix:** Wrap in `async () => { await deleteMutation.mutateAsync(s.id); }` so the resolved value is discarded and the inferred type is `Promise<void>`.
- **Files modified:** `frontend/src/signage/pages/SchedulesPage.tsx`
- **Commit:** 6a32048

**2. [Rule 2 - Critical UX] SectionHeader added to loading + error branches, not just main**
- **Found during:** Task 1 implementation
- **Issue:** Plan only specified inserting SectionHeader in the main render. Loading/error states would briefly hide section context, violating SECTION-01 (section context always visible while admin is in this section).
- **Fix:** Inserted SectionHeader in all three early-return branches.
- **Files modified:** `frontend/src/signage/pages/SchedulesPage.tsx`
- **Commit:** 6a32048

## Out-of-Scope Discoveries (Deferred)

- Pre-existing TS errors in unrelated files (`select.tsx`, `useSensorDraft.ts`, `SnmpWalkCard.tsx`, `defaults.ts`, `ScheduleEditDialog.tsx`/`.test.tsx`, `SchedulesPage.test.tsx`).
- Parallel plan 57-05/57-06 file `MediaPage.tsx` references the not-yet-retired `MediaDeleteDialog` module — will be cleaned by plan 57-05 itself.
- Schedules row 409-in-use dialog (Plan 51-02 path): current UX is toast-only on `deleteMutation.onError`, kept as-is per plan body §4 ("if it's just a toast today, keep toast").

## Self-Check: PASSED

- FOUND: frontend/src/signage/pages/SchedulesPage.tsx (modified)
- FOUND: ScheduleDeleteDialog.tsx deleted (verified `test ! -f`)
- FOUND: commit 6a32048 in `git log --oneline`
