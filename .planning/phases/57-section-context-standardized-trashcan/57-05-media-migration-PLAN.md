---
phase: 57-section-context-standardized-trashcan
plan: 05
type: execute
wave: 2
depends_on: [01, 03, 04]
files_modified:
  - frontend/src/signage/pages/MediaPage.tsx
  - frontend/src/signage/components/MediaInUseDialog.tsx
  - frontend/src/signage/components/MediaDeleteDialog.tsx
autonomous: true
gap_closure: false
requirements: [SECTION-01, SECTION-03, SECTION-04]

must_haves:
  truths:
    - "MediaPage renders a SectionHeader at the top (title + description)"
    - "Row-level Trash2 + MediaDeleteDialog replaced by <DeleteButton>"
    - "409 in-use branch preserved via extracted MediaInUseDialog (single-mode)"
    - "Legacy MediaDeleteDialog.tsx file deleted"
    - "No window.confirm, no inline ad-hoc dialogs remain in MediaPage"
  artifacts:
    - path: "frontend/src/signage/pages/MediaPage.tsx"
      provides: "SectionHeader at top + DeleteButton + MediaInUseDialog wiring"
      contains: "<SectionHeader"
    - path: "frontend/src/signage/components/MediaInUseDialog.tsx"
      provides: "narrow in-use warning dialog (extracted from MediaDeleteDialog's in_use mode)"
      contains: "export function MediaInUseDialog"
  key_links:
    - from: "frontend/src/signage/pages/MediaPage.tsx"
      to: "frontend/src/components/ui/section-header.tsx"
      via: "import SectionHeader"
      pattern: "@/components/ui/section-header"
    - from: "frontend/src/signage/pages/MediaPage.tsx"
      to: "frontend/src/components/ui/delete-button.tsx"
      via: "import DeleteButton"
      pattern: "@/components/ui/delete-button"
    - from: "frontend/src/signage/pages/MediaPage.tsx"
      to: "frontend/src/signage/components/MediaInUseDialog.tsx"
      via: "opened by onError 409 handler in deleteMutation"
      pattern: "MediaInUseDialog"
---

<objective>
Migrate the Media admin section to Wave A primitives: add `<SectionHeader />`
at top, replace row Trash trigger with `<DeleteButton>`, and extract the 409
"in-use" branch of the old two-mode `MediaDeleteDialog` into a narrow
standalone `MediaInUseDialog` (RESEARCH Pitfall 2). Retire `MediaDeleteDialog.tsx`.

Purpose: Close SECTION-01/03/04 for `/signage/media`.
Output: Modified page + new narrow dialog + deleted legacy variant.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/57-section-context-standardized-trashcan/57-UI-SPEC.md
@.planning/phases/57-section-context-standardized-trashcan/57-RESEARCH.md
@frontend/src/signage/pages/MediaPage.tsx
@frontend/src/signage/components/MediaDeleteDialog.tsx
@frontend/src/components/ui/section-header.tsx
@frontend/src/components/ui/delete-button.tsx

<interfaces>
<!-- Primitives available from Wave A -->
```ts
import { SectionHeader } from "@/components/ui/section-header";
import { DeleteButton } from "@/components/ui/delete-button";
```

<!-- Existing deleteMutation pattern at MediaPage.tsx:69 (per RESEARCH Q2) -->
```tsx
const deleteMutation = useMutation({
  mutationFn: (id: string) => signageApi.deleteMedia(id),
  onSuccess: () => { invalidate + toast + close dialog },
  onError: (err) => { if 409: open in-use dialog with impact list }
});
```

<!-- Today: MediaDeleteDialog has two modes — 'confirm' and 'in_use' -->
<!-- After: DeleteButton owns 'confirm'; MediaInUseDialog owns 'in_use' -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract MediaInUseDialog from MediaDeleteDialog.in_use branch</name>
  <files>frontend/src/signage/components/MediaInUseDialog.tsx</files>
  <action>
    Read `frontend/src/signage/components/MediaDeleteDialog.tsx` to locate the
    `in_use` mode branch — it shows "media is used by N playlists" with an
    impact list + a Close button (single button footer).

    Create `frontend/src/signage/components/MediaInUseDialog.tsx` with a single-
    mode API:

    ```tsx
    interface MediaInUseDialogProps {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      itemLabel: string;          // media name
      playlistIds: string[];      // or the richer impact shape existing dialog already uses
      // accept whatever impact data the existing 409 handler currently passes
    }
    ```

    Reuse `Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription/DialogFooter`
    + existing i18n keys (`signage.admin.media.delete_in_use_title`,
    `.delete_in_use_body`, `.delete_in_use_close`) — do NOT rename them; keep
    legacy signage keys for this narrow variant.

    Use single close Button (variant="outline"). Autofocus on Close.

    Commit: `feat(57-05): extract MediaInUseDialog from MediaDeleteDialog in_use branch`.
  </action>
  <verify>
    <automated>test -f frontend/src/signage/components/MediaInUseDialog.tsx && rg "export function MediaInUseDialog" frontend/src/signage/components/MediaInUseDialog.tsx</automated>
  </verify>
  <done>New dialog file exists with single-mode contract. Legacy keys preserved.</done>
</task>

<task type="auto">
  <name>Task 2: Migrate MediaPage — SectionHeader + DeleteButton + MediaInUseDialog</name>
  <files>frontend/src/signage/pages/MediaPage.tsx, frontend/src/signage/components/MediaDeleteDialog.tsx</files>
  <action>
    1. Add SectionHeader at the top of the MediaPage render (inside the page
       wrapper, above the media table/empty-state). Use keys from 57-04:

       ```tsx
       <SectionHeader
         title={t("section.signage.media.title")}
         description={t("section.signage.media.description")}
         className="mt-8"
       />
       ```

    2. Replace the row delete trigger at `:206-215`:
       - Remove the `<Button variant="ghost" size="sm"...><Trash2 /></Button>`
       - Replace with:
         ```tsx
         <DeleteButton
           itemLabel={media.name}
           onConfirm={() => deleteMutation.mutateAsync(media.id)}
           aria-label={t("ui.delete.ariaLabel", { itemLabel: media.name })}
         />
         ```
         (Note: use `mutateAsync` so DeleteButton can await; if 409 is thrown,
          catch inside onError as today — onConfirm still resolves on error
          because mutateAsync rejects; caller wraps in try/catch to swallow
          and let onError toast — OR: keep `mutate()` and let DeleteButton's
          `finally` close the dialog. Choose based on whether the 409 flow
          needs the delete dialog to stay open. Decision: use `mutateAsync`
          + try/catch inside onConfirm so dialog closes cleanly; the 409
          handler in mutation's `onError` opens `MediaInUseDialog` after.)

    3. Remove the existing `MediaDeleteDialog` import and usage at `:227-232`.
       The `deleteTarget` / `deleteMode` local state becomes unnecessary for
       the 'confirm' path (DeleteButton owns it). Keep a `inUseTarget` state
       instead that the 409 `onError` handler sets, which opens `MediaInUseDialog`.

    4. Wire `<MediaInUseDialog>` at the bottom of the page where MediaDeleteDialog
       used to be:
       ```tsx
       <MediaInUseDialog
         open={!!inUseTarget}
         onOpenChange={(o) => !o && setInUseTarget(null)}
         itemLabel={inUseTarget?.name ?? ""}
         playlistIds={inUseTarget?.playlistIds ?? []}
       />
       ```

    5. Delete `frontend/src/signage/components/MediaDeleteDialog.tsx`
       (using `git rm` or manual delete).

    6. Remove unused imports (MediaDeleteDialog, MediaDeleteDialogMode, Trash2
       if no longer referenced after replacement).

    Verify:
    - `rg "MediaDeleteDialog" frontend/src` returns 0 matches
    - `rg "Trash2" frontend/src/signage/pages/MediaPage.tsx` returns 0 matches
      (replaced by DeleteButton which internalizes the icon)
    - `npm --prefix frontend run build` compiles
    - existing MediaPage tests (if any) pass or are updated

    Commit: `refactor(57-05): migrate MediaPage to SectionHeader + DeleteButton; retire MediaDeleteDialog`.
  </action>
  <verify>
    <automated>npm --prefix frontend run build 2>&1 | tail -20 && rg "MediaDeleteDialog" frontend/src/ ; test ! -f frontend/src/signage/components/MediaDeleteDialog.tsx</automated>
  </verify>
  <done>
    - `MediaDeleteDialog.tsx` deleted
    - `rg "MediaDeleteDialog" frontend/src/` → 0 matches
    - SectionHeader renders at top of MediaPage
    - DeleteButton replaces row Trash trigger
    - MediaInUseDialog wired to 409 error path
    - Build green; no TS errors
  </done>
</task>

</tasks>

<verification>
- Build passes
- Zero MediaDeleteDialog references
- MediaPage uses SectionHeader + DeleteButton + MediaInUseDialog
</verification>

<success_criteria>
1. `rg "MediaDeleteDialog" frontend/src/` = 0 matches
2. `rg "SectionHeader|DeleteButton" frontend/src/signage/pages/MediaPage.tsx` ≥ 2 matches
3. 409 in-use UX preserved (verified by reading the mutation's onError handler)
4. `npm --prefix frontend run build` passes
</success_criteria>

<output>
After completion, create `.planning/phases/57-section-context-standardized-trashcan/57-05-SUMMARY.md`
</output>
