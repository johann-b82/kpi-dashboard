---
phase: 57-section-context-standardized-trashcan
plan: 05
subsystem: signage-admin/media
tags: [section-header, delete-button, media, in-use-dialog]
requires: [57-01, 57-03, 57-04]
provides:
  - "Media admin page rebuilt on Wave A primitives"
  - "MediaInUseDialog (single-mode 409 follow-up)"
affects:
  - frontend/src/signage/pages/MediaPage.tsx
  - frontend/src/signage/components/MediaInUseDialog.tsx
tech_stack:
  added: []
  patterns:
    - "DeleteButton + mutateAsync + try/catch swallow → onError still routes 409 to standalone in-use dialog"
key_files:
  created:
    - frontend/src/signage/components/MediaInUseDialog.tsx
  modified:
    - frontend/src/signage/pages/MediaPage.tsx
  deleted:
    - frontend/src/signage/components/MediaDeleteDialog.tsx (already removed by parallel 57-06)
decisions:
  - "Keep playlistIds (string[]) prop on MediaInUseDialog even though body copy is count-only — preserves the impact-list shape for future enrichment without another API round"
  - "Swallow mutateAsync rejection inside DeleteButton.onConfirm so the confirm dialog closes cleanly; onError owns the 409→MediaInUseDialog handoff and the toast for non-409 errors"
metrics:
  duration: "~6m"
  tasks: 2
  files: 2
  completed: 2026-04-22
requirements: [SECTION-01, SECTION-03, SECTION-04]
---

# Phase 57 Plan 05: Media Migration Summary

Replaced the row Trash glyph + two-mode `MediaDeleteDialog` on `/signage/media`
with the Wave-A `<SectionHeader>` + `<DeleteButton>` primitives, and extracted
the 409 "in use by N playlists" branch into a narrow standalone
`MediaInUseDialog` so the destructive confirm path and the error follow-up are
no longer entangled in a single component (RESEARCH Pitfall 2).

## What Changed

- `MediaPage.tsx` now renders `<SectionHeader title=section.signage.media.title …>`
  at the top of the page wrapper above the upload dropzone.
- Per-row delete trigger replaced with `<DeleteButton itemLabel={media.title} …>`;
  the destructive confirm dialog comes from the shared `<DeleteDialog>` primitive.
- `onConfirm` calls `deleteMutation.mutateAsync(media.id)` inside a try/catch so
  the confirm dialog closes deterministically; `pendingDelete` state captures
  the in-flight `{id, title}` so the mutation's `onError` 409 handler can
  recover the title for the in-use dialog (no API change needed).
- 409 path opens `<MediaInUseDialog>` with the `playlist_ids[]` extracted from
  the response body — copy comes from the existing
  `signage.admin.media.delete_in_use_*` keys (preserved verbatim).
- Removed `Trash2` + `MediaDeleteDialog` imports from `MediaPage.tsx`.
- `MediaDeleteDialog.tsx` was already removed by the parallel 57-06 commit
  (`ac56225`) — no separate deletion commit from this plan.

## Files

- Created: `frontend/src/signage/components/MediaInUseDialog.tsx`
- Modified: `frontend/src/signage/pages/MediaPage.tsx`

## Commits

- `394c1aa` feat(57-05): extract MediaInUseDialog from MediaDeleteDialog in_use branch
- `4d1647c` refactor(57-05): migrate MediaPage to SectionHeader + DeleteButton; retire MediaDeleteDialog wiring

## Verification

- `rg "MediaDeleteDialog" frontend/src/` returns only comment-only references
  (in `MediaInUseDialog.tsx` doc-block and one already-removed sibling) — zero
  live references.
- `rg "SectionHeader|DeleteButton" frontend/src/signage/pages/MediaPage.tsx` →
  4 matches (imports + JSX usages).
- 409 in-use UX preserved: `deleteMutation.onError` extracts
  `playlist_ids[]` from `ApiErrorWithBody` body and opens `MediaInUseDialog`.
- Build: TypeScript errors present in unrelated files only (Phase 54 carry-
  forward TS debt — see `deferred-items.md`); zero errors in 57-05's modified
  files.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Notes

- The plan's verify block included `test ! -f frontend/src/signage/components/MediaDeleteDialog.tsx`.
  The file was already deleted by parallel plan 57-06's collateral cleanup
  (commit `ac56225`) before Task 2 of this plan ran. Effect is identical;
  attribution lives with 57-06.
- `playlistIds: string[]` prop kept on `MediaInUseDialog` even though copy
  uses only `count` — preserves the richer shape from the existing 409 flow
  for future "click to view affected playlists" enrichment without another
  prop change.

## Deferred Issues

Pre-existing TypeScript build errors in 9 unrelated files (SalesTable,
PersonioCard, SnmpWalkCard, select.tsx, useSensorDraft, defaults.ts,
ScheduleEditDialog, SchedulesPage). Logged in
`.planning/phases/57-section-context-standardized-trashcan/deferred-items.md`.
None are in files modified by 57-05.

## Self-Check: PASSED

- frontend/src/signage/components/MediaInUseDialog.tsx — FOUND
- frontend/src/signage/pages/MediaPage.tsx — FOUND (modified)
- frontend/src/signage/components/MediaDeleteDialog.tsx — ABSENT (as required)
- Commit 394c1aa — FOUND
- Commit 4d1647c — FOUND
