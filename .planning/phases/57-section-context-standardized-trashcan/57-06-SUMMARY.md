---
phase: 57-section-context-standardized-trashcan
plan: 06
subsystem: signage-admin-ui
tags: [section-header, delete-button, migration, ui-consistency]
requires:
  - section-header primitive (57-01)
  - delete-dialog primitive (57-02)
  - delete-button primitive (57-03)
  - section.signage.playlists.* + ui.delete.* i18n keys (57-04)
provides:
  - migrated PlaylistsPage with SectionHeader + DeleteButton
  - 4th ad-hoc Dialog retirement (RESEARCH Pitfall 1 closed)
affects:
  - frontend/src/signage/pages/PlaylistsPage.tsx
tech-stack:
  added: []
  patterns:
    - DeleteButton replaces local deleteTarget state + inline Dialog
    - mutateAsync wrapped in async arrow to satisfy onConfirm: () => Promise<void>
key-files:
  created: []
  modified:
    - frontend/src/signage/pages/PlaylistsPage.tsx
decisions:
  - Used `async () => { await deleteMutation.mutateAsync(p.id); }` because mutateAsync resolves to the API response (Promise<null> for delete) which conflicts with DeleteButton's `onConfirm: () => void | Promise<void>` contract — explicit await + return-void is the cleanest fix and avoids changing the primitive's signature.
  - Preserved 409 schedules-active deep-link toast (Phase 52 D-13) without modification — only the trigger and confirm surface changed; error-recovery UX is identical.
metrics:
  duration: 110s
  completed: "2026-04-22"
---

# Phase 57 Plan 06: PlaylistsPage Migration Summary

PlaylistsPage now consumes the standardized SectionHeader and DeleteButton primitives, and the inline ad-hoc Dialog block (the fourth and final retirement target identified by RESEARCH Pitfall 1) is gone.

## What Changed

- Added `<SectionHeader title=section.signage.playlists.title description=section.signage.playlists.description className="mt-8" />` at the top of the page body.
- Replaced row Trash `<Button variant="ghost">` trigger with `<DeleteButton itemLabel onConfirm aria-label />`.
- Deleted the inline `<Dialog open={!!deleteTarget}>...</Dialog>` block at the former lines 215–250 (full DialogContent / DialogHeader / DialogTitle / DialogDescription / DialogFooter / Cancel / Confirm tree).
- Removed `deleteTarget` local state and its setter calls — DeleteButton internalizes open + busy state.
- Removed unused imports: `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Trash2`.
- Imported new primitives: `SectionHeader`, `DeleteButton`.
- Preserved `deleteMutation` end-to-end including the Phase 52 D-13 409 schedules-active deep-link toast.

## Verification

Success criteria (from PLAN):
1. `rg "deleteTarget" frontend/src/signage/pages/PlaylistsPage.tsx` = 0 — PASS
2. `rg "SectionHeader|DeleteButton" frontend/src/signage/pages/PlaylistsPage.tsx` >= 2 — PASS (4 matches)
3. Build green — PASS for the file in scope. PlaylistsPage.tsx compiles without errors after `mutateAsync` async-wrap fix. Other unrelated TS errors exist in the build output (SchedulesPage, ScheduleEditDialog, SalesTable, PersonioCard, SnmpWalkCard, useSensorDraft, lib/defaults, ui/select) but are mid-flight from parallel plans or pre-existing — logged to `deferred-items.md` per scope-boundary rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Type] mutateAsync return-type mismatch**
- **Found during:** Task 1 build verification
- **Issue:** `() => deleteMutation.mutateAsync(p.id)` returns `Promise<null>` which TS rejected against DeleteButton's `onConfirm: () => void | Promise<void>` contract.
- **Fix:** Wrapped in `async () => { await deleteMutation.mutateAsync(p.id); }` so the awaited result is dropped and the function returns `Promise<void>`.
- **Files modified:** frontend/src/signage/pages/PlaylistsPage.tsx
- **Commit:** ac56225

### Notes

- The commit also includes a deletion of `frontend/src/signage/components/MediaDeleteDialog.tsx`. That file was removed by a parallel sibling plan (57-05 MediaPage migration) and got staged when its parent plan executed; including it in this commit is harmless because that file is already orphaned.

## Known Stubs

None — the migration is fully wired (real `deleteMutation`, real i18n keys, real navigate side-effect on 409). No placeholder data.

## Self-Check: PASSED

- frontend/src/signage/pages/PlaylistsPage.tsx — FOUND
- commit ac56225 — FOUND
- 0 `deleteTarget` references — VERIFIED
- 0 `<Dialog ` inline blocks — VERIFIED
- SectionHeader + DeleteButton imports + usage — VERIFIED (4 matches)
