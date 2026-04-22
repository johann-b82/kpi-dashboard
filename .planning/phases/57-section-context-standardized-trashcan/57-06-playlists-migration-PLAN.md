---
phase: 57-section-context-standardized-trashcan
plan: 06
type: execute
wave: 2
depends_on: [01, 03, 04]
files_modified:
  - frontend/src/signage/pages/PlaylistsPage.tsx
autonomous: true
gap_closure: false
requirements: [SECTION-01, SECTION-03, SECTION-04]

must_haves:
  truths:
    - "PlaylistsPage renders a SectionHeader at top"
    - "Row Trash trigger replaced by <DeleteButton>"
    - "Inline Dialog at PlaylistsPage.tsx:215-250 is DELETED (RESEARCH Pitfall 1)"
    - "deleteTarget local state removed (primitive owns it)"
  artifacts:
    - path: "frontend/src/signage/pages/PlaylistsPage.tsx"
      provides: "migrated page using SectionHeader + DeleteButton, no inline Dialog"
      contains: "<SectionHeader"
  key_links:
    - from: "frontend/src/signage/pages/PlaylistsPage.tsx"
      to: "frontend/src/components/ui/delete-button.tsx"
      via: "import DeleteButton replaces inline Dialog + setDeleteTarget"
      pattern: "@/components/ui/delete-button"
---

<objective>
Migrate PlaylistsPage: add SectionHeader, replace row Trash trigger with
DeleteButton, and DELETE the inline `<Dialog>` block at `:215-250`
(fourth retirement per RESEARCH Pitfall 1 — missed by CONTEXT.md).

Purpose: SECTION-01/03/04 for `/signage/playlists`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/57-section-context-standardized-trashcan/57-UI-SPEC.md
@.planning/phases/57-section-context-standardized-trashcan/57-RESEARCH.md
@frontend/src/signage/pages/PlaylistsPage.tsx
@frontend/src/components/ui/section-header.tsx
@frontend/src/components/ui/delete-button.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate PlaylistsPage — SectionHeader + DeleteButton + delete inline Dialog</name>
  <files>frontend/src/signage/pages/PlaylistsPage.tsx</files>
  <action>
    1. Add SectionHeader at top of page body:
       ```tsx
       <SectionHeader
         title={t("section.signage.playlists.title")}
         description={t("section.signage.playlists.description")}
         className="mt-8"
       />
       ```

    2. Replace row Trash trigger at `:196-204`:
       - Remove `<Button variant="ghost" size="sm" onClick={() => setDeleteTarget(p)}><Trash2 /></Button>`
       - Insert:
         ```tsx
         <DeleteButton
           itemLabel={p.name}
           onConfirm={() => deleteMutation.mutateAsync(p.id)}
           aria-label={t("ui.delete.ariaLabel", { itemLabel: p.name })}
         />
         ```

    3. DELETE the inline `<Dialog open={!!deleteTarget} ...>...</Dialog>` block
       at `:215-250` entirely. This is the ad-hoc variant RESEARCH identified.
       Remove the surrounding JSX including DialogContent/Header/Title/Description/Footer.

    4. Remove `deleteTarget` state (`const [deleteTarget, setDeleteTarget] = useState(...)`)
       and associated setters — DeleteButton internalizes open state.

    5. Remove unused imports: `Dialog, DialogContent, DialogHeader, DialogTitle,
       DialogDescription, DialogFooter, Trash2` if no longer used. Keep them
       only if still referenced elsewhere (e.g., other dialogs in the page).

    6. Ensure `deleteMutation` from React Query is preserved (only the trigger
       and confirm surface change).

    Verify:
    - `rg "setDeleteTarget|deleteTarget" frontend/src/signage/pages/PlaylistsPage.tsx` → 0 matches
    - `rg "<Dialog " frontend/src/signage/pages/PlaylistsPage.tsx` → 0 matches
      (the only Dialog usage was the inline block)
    - `npm --prefix frontend run build` compiles

    Commit: `refactor(57-06): migrate PlaylistsPage to SectionHeader + DeleteButton; remove inline Dialog`.
  </action>
  <verify>
    <automated>npm --prefix frontend run build 2>&1 | tail -5 ; rg "deleteTarget" frontend/src/signage/pages/PlaylistsPage.tsx</automated>
  </verify>
  <done>
    - SectionHeader at top
    - DeleteButton replaces row Trash
    - Inline Dialog block at :215-250 deleted
    - deleteTarget state removed
    - Build green
  </done>
</task>

</tasks>

<verification>
- Build passes; no remaining `<Dialog>` inline blocks for delete
- SectionHeader visible at top of /signage/playlists
</verification>

<success_criteria>
1. `rg "deleteTarget" frontend/src/signage/pages/PlaylistsPage.tsx` = 0
2. `rg "SectionHeader|DeleteButton" frontend/src/signage/pages/PlaylistsPage.tsx` ≥ 2
3. Build green
</success_criteria>

<output>
After completion, create `.planning/phases/57-section-context-standardized-trashcan/57-06-SUMMARY.md`
</output>
