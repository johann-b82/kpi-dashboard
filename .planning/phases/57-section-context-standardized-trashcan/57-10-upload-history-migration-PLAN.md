---
phase: 57-section-context-standardized-trashcan
plan: 10
type: execute
wave: 3
depends_on: [03, 04]
files_modified:
  - frontend/src/components/UploadHistory.tsx
  - frontend/src/components/DeleteConfirmDialog.tsx
autonomous: true
gap_closure: false
requirements: [SECTION-03, SECTION-04]

must_haves:
  truths:
    - "UploadHistory row delete uses <DeleteButton> (standardized trashcan is universal per user decision amending D-04)"
    - "Legacy delete_title / delete_body / delete_confirm / delete_cancel keys are preserved via explicit props on DeleteButton (Upload History keeps its custom copy)"
    - "Legacy DeleteConfirmDialog.tsx is deleted — its sole consumer is migrated"
  artifacts:
    - path: "frontend/src/components/UploadHistory.tsx"
      provides: "migrated to DeleteButton with legacy key pass-through"
      contains: "DeleteButton"
  key_links:
    - from: "frontend/src/components/UploadHistory.tsx"
      to: "frontend/src/components/ui/delete-button.tsx"
      via: "DeleteButton with explicit title/cancelLabel/confirmLabel props preserving legacy copy"
      pattern: "@/components/ui/delete-button"
---

<objective>
Migrate UploadHistory row delete to `<DeleteButton>`, preserving its legacy
custom copy by passing `title`/`cancelLabel`/`confirmLabel` props explicitly.
Delete the original `components/DeleteConfirmDialog.tsx` (its sole consumer
after this plan is retired).

This closes the "Trashcan is universal" scope amendment from user decision
(A1 in scope_reconciliation) — DeleteButton is repo-wide for row-level
destructive-delete, not admin-only. SectionHeader stays admin-only.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/57-section-context-standardized-trashcan/57-RESEARCH.md
@frontend/src/components/UploadHistory.tsx
@frontend/src/components/DeleteConfirmDialog.tsx
@frontend/src/components/ui/delete-button.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate UploadHistory row delete to DeleteButton</name>
  <files>frontend/src/components/UploadHistory.tsx</files>
  <action>
    Current shape at `:117-126` (per RESEARCH Q6):
    ```tsx
    <AdminOnly>
      <Button variant="ghost" size="icon"
        onClick={() => setSelectedBatch(batch)}
        aria-label={t("delete_title")}
        className="hover:text-destructive hover:bg-destructive/10">
        <Trash2 className="h-4 w-4" />
      </Button>
    </AdminOnly>
    ```
    + `<DeleteConfirmDialog>` instance at `:133+`.

    Replace with:
    ```tsx
    <AdminOnly>
      <DeleteButton
        itemLabel={batch.filename}
        onConfirm={() => deleteMutation.mutateAsync(batch.id)}
        title={t("delete_title")}
        cancelLabel={t("delete_cancel")}
        confirmLabel={t("delete_confirm")}
        dialogBody={t("delete_body", { filename: batch.filename, count: batch.row_count })}
        aria-label={t("delete_title")}
      />
    </AdminOnly>
    ```

    Remove:
    - `setSelectedBatch` state (DeleteButton owns open state)
    - `<DeleteConfirmDialog>` JSX block
    - `import DeleteConfirmDialog` + unused imports (Trash2, Button if unused)

    Preserve the existing useMutation / toast wiring — only the trigger + dialog
    surface changes.

    Commit: `refactor(57-10): migrate UploadHistory to DeleteButton`.
  </action>
  <verify>
    <automated>rg "DeleteConfirmDialog" frontend/src/components/UploadHistory.tsx ; rg "DeleteButton" frontend/src/components/UploadHistory.tsx</automated>
  </verify>
  <done>
    - `rg "DeleteConfirmDialog" frontend/src/components/UploadHistory.tsx` = 0
    - `rg "DeleteButton" frontend/src/components/UploadHistory.tsx` ≥ 1
    - `setSelectedBatch` state removed
    - Build green
  </done>
</task>

<task type="auto">
  <name>Task 2: Delete legacy DeleteConfirmDialog.tsx</name>
  <files>frontend/src/components/DeleteConfirmDialog.tsx</files>
  <action>
    Now that UploadHistory (the sole consumer) is migrated, delete
    `frontend/src/components/DeleteConfirmDialog.tsx`.

    Verify no remaining consumers:
    `rg "DeleteConfirmDialog" frontend/src/` → 0 matches.

    Commit: `refactor(57-10): delete legacy DeleteConfirmDialog.tsx (consumer migrated)`.
  </action>
  <verify>
    <automated>test ! -f frontend/src/components/DeleteConfirmDialog.tsx && rg "DeleteConfirmDialog" frontend/src/ ; npm --prefix frontend run build 2>&1 | tail -5</automated>
  </verify>
  <done>
    - `frontend/src/components/DeleteConfirmDialog.tsx` does not exist
    - `rg "DeleteConfirmDialog" frontend/src/` = 0
    - Build green
  </done>
</task>

</tasks>

<success_criteria>
1. UploadHistory uses DeleteButton with legacy copy preserved
2. DeleteConfirmDialog.tsx deleted; zero references
3. Build green
</success_criteria>

<output>
After completion, create `.planning/phases/57-section-context-standardized-trashcan/57-10-SUMMARY.md`
</output>
