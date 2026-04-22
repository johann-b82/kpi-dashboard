---
phase: 57-section-context-standardized-trashcan
plan: 07
type: execute
wave: 2
depends_on: [01, 03, 04]
files_modified:
  - frontend/src/signage/pages/SchedulesPage.tsx
  - frontend/src/signage/components/ScheduleDeleteDialog.tsx
autonomous: true
gap_closure: false
requirements: [SECTION-01, SECTION-03, SECTION-04]

must_haves:
  truths:
    - "SchedulesPage renders SectionHeader at top"
    - "Row Trash trigger replaced by DeleteButton"
    - "ScheduleDeleteDialog.tsx deleted"
  artifacts:
    - path: "frontend/src/signage/pages/SchedulesPage.tsx"
      provides: "migrated page with SectionHeader + DeleteButton"
      contains: "<SectionHeader"
  key_links:
    - from: "frontend/src/signage/pages/SchedulesPage.tsx"
      to: "frontend/src/components/ui/delete-button.tsx"
      via: "import DeleteButton"
      pattern: "@/components/ui/delete-button"
---

<objective>
Migrate SchedulesPage: SectionHeader at top, DeleteButton in row, retire
ScheduleDeleteDialog.tsx. Clean migration (no 409-style branch).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/57-section-context-standardized-trashcan/57-UI-SPEC.md
@.planning/phases/57-section-context-standardized-trashcan/57-RESEARCH.md
@frontend/src/signage/pages/SchedulesPage.tsx
@frontend/src/signage/components/ScheduleDeleteDialog.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate SchedulesPage + retire ScheduleDeleteDialog</name>
  <files>frontend/src/signage/pages/SchedulesPage.tsx, frontend/src/signage/components/ScheduleDeleteDialog.tsx</files>
  <action>
    1. Add SectionHeader at top of SchedulesPage body:
       ```tsx
       <SectionHeader
         title={t("section.signage.schedules.title")}
         description={t("section.signage.schedules.description")}
         className="mt-8"
       />
       ```

    2. Replace row Trash trigger at `:315-323`:
       ```tsx
       <DeleteButton
         itemLabel={s.name /* or whatever schedule label field */}
         onConfirm={() => deleteMutation.mutateAsync(s.id)}
         aria-label={t("ui.delete.ariaLabel", { itemLabel: s.name })}
       />
       ```

    3. Remove ScheduleDeleteDialog usage (around `:341+`). Remove its import.
       Remove `deleteTarget` / `setDeleteTarget` state (DeleteButton owns it).

    4. Schedules API may return 409 on playlist FK RESTRICT (see STATE.md Plan
       51-02). Keep existing `onError` toast handler; no in-use dialog needed
       here unless already present — verify current UX. If a 409-in-use dialog
       exists, follow the Media pattern (extract to narrow ScheduleInUseDialog).
       If it's just a toast today, keep toast.

    5. Delete `frontend/src/signage/components/ScheduleDeleteDialog.tsx`.

    6. `rg "ScheduleDeleteDialog" frontend/src/` → 0 matches.

    Commit: `refactor(57-07): migrate SchedulesPage to SectionHeader + DeleteButton; retire ScheduleDeleteDialog`.
  </action>
  <verify>
    <automated>npm --prefix frontend run build 2>&1 | tail -5 ; rg "ScheduleDeleteDialog" frontend/src/ ; test ! -f frontend/src/signage/components/ScheduleDeleteDialog.tsx</automated>
  </verify>
  <done>
    - ScheduleDeleteDialog.tsx deleted
    - `rg "ScheduleDeleteDialog" frontend/src/` → 0
    - SectionHeader + DeleteButton present on SchedulesPage
    - Build green
  </done>
</task>

</tasks>

<success_criteria>
1. `rg "ScheduleDeleteDialog" frontend/src/` = 0
2. `rg "SectionHeader|DeleteButton" frontend/src/signage/pages/SchedulesPage.tsx` ≥ 2
3. Build green
</success_criteria>

<output>
After completion, create `.planning/phases/57-section-context-standardized-trashcan/57-07-SUMMARY.md`
</output>
