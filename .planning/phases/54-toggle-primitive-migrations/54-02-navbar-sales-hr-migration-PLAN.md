---
phase: 54-toggle-primitive-migrations
plan: 02
type: execute
wave: 2
depends_on: ["54-01"]
files_modified:
  - frontend/src/components/NavBar.tsx
autonomous: true
requirements:
  - TOGGLE-04
must_haves:
  truths:
    - "The Sales/HR switch in the top header renders via the new Toggle primitive."
    - "Clicking/keyboard-activating a segment still calls `navigate('/sales')` or `navigate('/hr')`."
    - "NavBar no longer imports `SegmentedControl` (Sales/HR is the only 2-option usage in NavBar)."
    - "Existing i18n keys `nav.sales` / `nav.hr` are unchanged (no new keys, no key renames)."
  artifacts:
    - path: "frontend/src/components/NavBar.tsx"
      provides: "Sales/HR toggle call site via Toggle primitive"
      contains: "from \"@/components/ui/toggle\""
  key_links:
    - from: "frontend/src/components/NavBar.tsx"
      to: "frontend/src/components/ui/toggle.tsx"
      via: "import { Toggle } from '@/components/ui/toggle'"
      pattern: "@/components/ui/toggle"
---

<objective>
Migrate the NavBar Sales/HR 2-option switch from `SegmentedControl` to the new `Toggle` primitive. Reuses existing `t('nav.sales')` / `t('nav.hr')` keys unchanged. Closes the Sales/HR portion of TOGGLE-04 (per REQUIREMENTS: "existing 2-option boolean `SegmentedControl` usages (audit Sales/HR toggle, sensor window binary cases, etc.) migrate to the new `Toggle`").

Note: TOGGLE-02 (the EN/DE language switch) is closed by Plan 54-05, not this plan. The Sales/HR switch is a dashboard-context navigation control, not a language switch, and belongs under TOGGLE-04's SegmentedControl-usage audit.

Purpose: First production adoption of the `Toggle` primitive for a SegmentedControl migration. Proves the prop-shape parity with SegmentedControl in a real call site.

Output: Updated `frontend/src/components/NavBar.tsx` — single import swap + JSX element swap.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/54-toggle-primitive-migrations/54-CONTEXT.md
@frontend/src/components/NavBar.tsx
@frontend/src/components/ui/segmented-control.tsx
@frontend/src/components/ui/toggle.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Swap Sales/HR SegmentedControl for Toggle in NavBar.tsx</name>
  <files>frontend/src/components/NavBar.tsx</files>
  <read_first>
    - frontend/src/components/NavBar.tsx (current state — confirm the only SegmentedControl usage is the Sales/HR block at lines ~97-107)
    - frontend/src/components/ui/toggle.tsx (API created by Plan 01 — confirm Toggle export and ToggleProps shape)
    - frontend/src/components/ui/segmented-control.tsx (reference API to confirm migration is drop-in)
    - .planning/phases/54-toggle-primitive-migrations/54-CONTEXT.md § D-08
  </read_first>
  <action>
    In `frontend/src/components/NavBar.tsx`:

    1. Replace the import line:
       ```ts
       import { SegmentedControl } from "@/components/ui/segmented-control";
       ```
       with:
       ```ts
       import { Toggle } from "@/components/ui/toggle";
       ```

    2. Replace the Sales/HR JSX block (currently lines ~97-107):
       ```tsx
       <SegmentedControl
         segments={[
           { value: "/sales", label: t("nav.sales") },
           { value: "/hr", label: t("nav.hr") },
         ]}
         value={location === "/hr" ? "/hr" : "/sales"}
         onChange={(path) => navigate(path)}
         aria-label="Navigation"
         className="border-transparent"
       />
       ```
       with:
       ```tsx
       <Toggle
         segments={[
           { value: "/sales", label: t("nav.sales") },
           { value: "/hr", label: t("nav.hr") },
         ] as const}
         value={location === "/hr" ? "/hr" : "/sales"}
         onChange={(path) => navigate(path)}
         aria-label="Navigation"
         className="border-transparent"
       />
       ```

    3. Do NOT add new i18n keys. Do NOT rename existing keys. Per CONTEXT D-08, `nav.sales` / `nav.hr` are reused verbatim.

    4. Do NOT touch any other part of NavBar (brand, back button, upload/settings/docs/signout buttons, LanguageToggle, ThemeToggle). Plan 04 owns ThemeToggle migration; Plan 05 owns LanguageToggle migration.

    5. If TypeScript complains that `"/sales" | "/hr"` cannot be passed to Toggle's `value` prop after the `as const`, supply a generic explicitly: `<Toggle<"/sales" | "/hr"> segments={...} ... />`.
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit && grep -c 'from "@/components/ui/toggle"' src/components/NavBar.tsx | grep -q '^1$' && ! grep -q 'from "@/components/ui/segmented-control"' src/components/NavBar.tsx && grep -q '<Toggle' src/components/NavBar.tsx && ! grep -q '<SegmentedControl' src/components/NavBar.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `frontend/src/components/NavBar.tsx` contains exactly one import line: `import { Toggle } from "@/components/ui/toggle";`.
    - `frontend/src/components/NavBar.tsx` does NOT contain `from "@/components/ui/segmented-control"`.
    - `frontend/src/components/NavBar.tsx` contains exactly one `<Toggle` element.
    - `frontend/src/components/NavBar.tsx` does NOT contain the string `<SegmentedControl`.
    - `frontend/src/components/NavBar.tsx` still contains `t("nav.sales")` and `t("nav.hr")` (keys unchanged).
    - `frontend/src/components/NavBar.tsx` still contains `onChange={(path) => navigate(path)}` (navigation behavior preserved).
    - `cd frontend && npx tsc --noEmit` exits 0.
    - `cd frontend && npm run build` exits 0 (full build succeeds).
  </acceptance_criteria>
  <done>NavBar's Sales/HR switch renders via `<Toggle>` imported from `@/components/ui/toggle`; `SegmentedControl` no longer imported in NavBar; all existing navigation behavior and i18n keys preserved; TypeScript and build pass.</done>
</task>

</tasks>

<verification>
- `cd frontend && npx tsc --noEmit` passes.
- `cd frontend && npm run build` passes.
- Sales/HR pill in NavBar is now a `Toggle` and still routes to `/sales` / `/hr`.
</verification>

<success_criteria>
- Sales/HR portion of TOGGLE-04 closed: the 2-option Sales/HR SegmentedControl usage now renders via `Toggle`.
- NavBar compiles cleanly; no other behavior changes.
</success_criteria>

<output>
After completion, create `.planning/phases/54-toggle-primitive-migrations/54-02-SUMMARY.md`.
</output>
