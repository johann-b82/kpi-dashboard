---
phase: 57-section-context-standardized-trashcan
plan: 08
type: execute
wave: 2
depends_on: [01, 04]
files_modified:
  - frontend/src/signage/pages/DevicesPage.tsx
autonomous: true
gap_closure: false
requirements: [SECTION-01]

must_haves:
  truths:
    - "DevicesPage renders SectionHeader at top"
    - "Misappropriated <h2>col_name</h2> at :120 is removed (was displaying the 'Name' column label as a heading)"
    - "Revoke action (ShieldOff) remains UNCHANGED — NOT migrated to DeleteButton (Pitfall 4)"
  artifacts:
    - path: "frontend/src/signage/pages/DevicesPage.tsx"
      provides: "SectionHeader added, stray <h2> removed"
      contains: "<SectionHeader"
  key_links:
    - from: "frontend/src/signage/pages/DevicesPage.tsx"
      to: "frontend/src/components/ui/section-header.tsx"
      via: "SectionHeader import replaces misappropriated h2"
      pattern: "@/components/ui/section-header"
---

<objective>
Devices is SectionHeader-only. The Revoke action (ShieldOff icon, 200 OK
network credential revoke) is semantically distinct from destructive row
delete and stays as-is (RESEARCH Pitfall 4). Also remove the existing
misappropriated `<h2>{t("signage.admin.devices.col_name")}</h2>` at
`:120` that is NOT a page heading at all — it's rendering the "Name"
column label as if it were one.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/57-section-context-standardized-trashcan/57-UI-SPEC.md
@.planning/phases/57-section-context-standardized-trashcan/57-RESEARCH.md
@frontend/src/signage/pages/DevicesPage.tsx
@frontend/src/components/ui/section-header.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add SectionHeader + remove misappropriated col_name h2</name>
  <files>frontend/src/signage/pages/DevicesPage.tsx</files>
  <action>
    1. Read DevicesPage.tsx around line 120. Confirm the `<h2 class="text-lg
       font-semibold">{t("signage.admin.devices.col_name")}</h2>` is rendering
       the 'Name' column label as a top-of-section heading (per RESEARCH Q7).

    2. REMOVE that stray `<h2>` block.

    3. Add SectionHeader at top of the page body:
       ```tsx
       <SectionHeader
         title={t("section.signage.devices.title")}
         description={t("section.signage.devices.description")}
         className="mt-8"
       />
       ```

    4. Leave the Revoke button (`<ShieldOff />` at `:210-217`) UNTOUCHED.
       Per RESEARCH Pitfall 4, revoke is not a row delete.

    5. `rg "signage\.admin\.devices\.col_name" frontend/src/signage/pages/DevicesPage.tsx`
       should still show matches if col_name is used as a real column header
       elsewhere in the table — only the misappropriated heading usage goes away.

    Commit: `refactor(57-08): add SectionHeader to DevicesPage; remove stray col_name h2`.
  </action>
  <verify>
    <automated>npm --prefix frontend run build 2>&1 | tail -5 ; rg "SectionHeader" frontend/src/signage/pages/DevicesPage.tsx && rg "ShieldOff" frontend/src/signage/pages/DevicesPage.tsx</automated>
  </verify>
  <done>
    - SectionHeader renders at top of DevicesPage
    - Stray h2 at ~:120 removed
    - Revoke (ShieldOff) button preserved
    - Build green
  </done>
</task>

</tasks>

<success_criteria>
1. SectionHeader present in DevicesPage
2. Stray `<h2>...col_name...</h2>` section-heading usage removed
3. ShieldOff / Revoke action unchanged
4. Build green
</success_criteria>

<output>
After completion, create `.planning/phases/57-section-context-standardized-trashcan/57-08-SUMMARY.md`
</output>
