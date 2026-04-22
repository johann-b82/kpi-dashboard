---
phase: 57-section-context-standardized-trashcan
plan: 10
subsystem: frontend
tags: [refactor, ui, trashcan, upload, migration]
requires:
  - 57-03 (DeleteButton primitive)
  - 57-04 (ui.delete.* + section.* i18n keys)
provides:
  - "UploadHistory row delete migrated to <DeleteButton>"
  - "Standardized trashcan now universal across admin row-delete surfaces (Sales upload included)"
affects:
  - frontend/src/components/UploadHistory.tsx
  - frontend/src/components/DeleteConfirmDialog.tsx (deleted)
tech_stack:
  added: []
  patterns:
    - "Legacy i18n keys preserved at consumer level via explicit DeleteButton props (dialogTitle/cancelLabel/confirmLabel/dialogBody)"
    - "mutateAsync wrapped in arrow returning Promise<void> to satisfy DeleteButton onConfirm contract"
key_files:
  created: []
  modified:
    - frontend/src/components/UploadHistory.tsx
  deleted:
    - frontend/src/components/DeleteConfirmDialog.tsx
decisions:
  - "Use DeleteButton prop name `dialogTitle` (not plan-text `title`) — actual primitive API; semantics identical"
  - "Pass legacy delete_title/delete_cancel/delete_confirm/delete_body keys via explicit overrides instead of defaulting to ui.delete.* — preserves Upload History's custom copy ('Upload löschen?', filename+row-count body) per must-have truth #2"
metrics:
  duration_seconds: 62
  tasks: 2
  files: 2
  completed: 2026-04-22
---

# Phase 57 Plan 10: Upload History Migration Summary

Migrated UploadHistory row delete to the standardized `<DeleteButton>` primitive while preserving its custom Upload-History copy via explicit prop overrides, then deleted the now-orphaned `DeleteConfirmDialog.tsx`. This closes the "Trashcan is universal" scope amendment from user decision A1 — DeleteButton is now repo-wide for row-level destructive deletes.

## What Shipped

**Task 1 — Migrate UploadHistory** (commit `97b040e`)
- Replaced ghost `<Button variant="ghost" size="icon">` + `<Trash2>` trigger with `<DeleteButton>`
- Removed `<DeleteConfirmDialog>` JSX block and `setSelectedBatch` state (DeleteButton owns dialog open state internally)
- Pass-through of legacy keys via explicit props:
  - `dialogTitle={t("delete_title")}`
  - `cancelLabel={t("delete_cancel")}`
  - `confirmLabel={t("delete_confirm")}`
  - `dialogBody={t("delete_body", { filename, count: row_count })}`
- `onConfirm={() => deleteMutation.mutateAsync(batch.id)}` — arrow returning Promise to satisfy DeleteButton's `void | Promise<void>` contract
- Dropped unused imports: `Trash2`, `Button`, `useState`, `DeleteConfirmDialog`

**Task 2 — Delete legacy dialog** (commit `b90f2ec`)
- `frontend/src/components/DeleteConfirmDialog.tsx` removed (51 lines)
- `rg "DeleteConfirmDialog" frontend/src/` returns zero matches

## Verification

- `rg "DeleteConfirmDialog" frontend/src/components/UploadHistory.tsx` = 0
- `rg "DeleteButton" frontend/src/components/UploadHistory.tsx` = 2 (import + usage)
- `setSelectedBatch` removed
- `frontend/src/components/DeleteConfirmDialog.tsx` does not exist
- `rg "DeleteConfirmDialog" frontend/src/` = 0
- `tsc --noEmit` reports zero errors in `UploadHistory.tsx`, `delete-button.tsx`, `delete-dialog.tsx` or any file referencing the renamed/removed symbols. (Pre-existing TS errors in `SalesTable`, `PersonioCard`, `SnmpWalkCard`, `useSensorDraft`, `defaults.ts`, signage test files are out of scope — Phase 54 carry-forward debt acknowledged in PROJECT.md.)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed cleanly.

### Plan-text adjustment (no code-impact deviation)

The plan task body uses `title=` as the DeleteButton prop name; the actual primitive API exposes `dialogTitle` (see `frontend/src/components/ui/delete-button.tsx:21`). Used the actual prop name. Functionally identical — the `t("delete_title")` value is unchanged.

## Out-of-scope items (deferred)

Pre-existing TypeScript errors surfaced by `npm run build` in unrelated files were not touched (scope-boundary rule). No new entries logged to `deferred-items.md` because these debts are already tracked in PROJECT.md / STATE.md as Phase 54 carry-forward.

## Self-Check: PASSED

- File `frontend/src/components/UploadHistory.tsx`: FOUND
- File `frontend/src/components/DeleteConfirmDialog.tsx`: CORRECTLY ABSENT
- Commit `97b040e`: FOUND
- Commit `b90f2ec`: FOUND
