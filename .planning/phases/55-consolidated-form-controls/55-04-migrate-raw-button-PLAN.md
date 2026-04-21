---
phase: 55-consolidated-form-controls
plan: 04
type: execute
wave: 2
depends_on:
  - 01
files_modified:
  - frontend/src/components/NavBar.tsx
  - frontend/src/components/settings/sensors/SnmpWalkCard.tsx
  - frontend/src/signage/components/PlaylistItemList.tsx
  - frontend/src/signage/components/TagPicker.tsx
  - frontend/src/signage/components/MediaPickerDialog.tsx
  - frontend/src/pages/LauncherPage.tsx
  - frontend/src/components/dashboard/EmployeeTable.tsx
  - frontend/src/components/settings/ColorPicker.tsx
autonomous: true
requirements:
  - CTRL-02
must_haves:
  truths:
    - "Every raw <button> usage in the listed consumer files is replaced with <Button> from @/components/ui/button"
    - "Existing props (onClick, disabled, type, aria-label, className) are preserved across migrations"
    - "Visual parity preserved — existing size and variant selection justified in each file"
    - "No raw <button> remains outside frontend/src/components/ui/{button,toggle,segmented-control}.tsx and SalesTable.tsx (deferred)"
  artifacts:
    - path: "frontend/src/components/NavBar.tsx"
      provides: "Top-header buttons migrated to <Button>"
    - path: "frontend/src/signage/components/PlaylistItemList.tsx"
      provides: "Row action buttons migrated"
    - path: "frontend/src/signage/components/TagPicker.tsx"
      provides: "Tag chip buttons migrated"
    - path: "frontend/src/signage/components/MediaPickerDialog.tsx"
      provides: "Dialog action buttons migrated"
    - path: "frontend/src/pages/LauncherPage.tsx"
      provides: "Launcher tile buttons migrated"
    - path: "frontend/src/components/dashboard/EmployeeTable.tsx"
      provides: "Table controls migrated"
    - path: "frontend/src/components/settings/sensors/SnmpWalkCard.tsx"
      provides: "Sensor card buttons migrated"
    - path: "frontend/src/components/settings/ColorPicker.tsx"
      provides: "Color swatch buttons migrated"
  key_links:
    - from: "listed consumer files"
      to: "@/components/ui/button"
      via: "named import"
      pattern: "import \\{ Button \\} from \"@/components/ui/button\""
---

<objective>
Migrate all raw `<button>` JSX in the 8 listed consumer files to the shared `<Button>` primitive (CTRL-02). SalesTable.tsx is DEFERRED — do not edit (pre-existing TS errors per Phase 54 deferred-items; research Open Question 3).

Purpose: Close CTRL-02 for the `<button>` element type. Wave 2(a) of D-09.
Output: 8 files with raw `<button>` replaced by `<Button>`; zero raw `<button>` remaining outside ui/ primitives and SalesTable.tsx.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/55-consolidated-form-controls/55-CONTEXT.md
@.planning/phases/55-consolidated-form-controls/55-RESEARCH.md
@.planning/phases/55-consolidated-form-controls/55-UI-SPEC.md
@frontend/src/components/ui/button.tsx

<interfaces>
Button export + variant/size surface (from button.tsx, post-Plan-01 cleanup):
```ts
<Button
  variant="default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
  size="default" | "xs" | "sm" | "icon" | "icon-xs" | "icon-sm"
  // all standard HTMLButtonElement props pass through
/>
```

Size guidance (from button.tsx JSDoc after Plan 01):
- `default` (h-8) — standard form-control size; use everywhere by default.
- `xs` / `icon-xs` — dense/inline (table row actions, sub-toolbars).
- `sm` / `icon-sm` — dense/inline.
- `icon` — icon-only of `default`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate raw <button> in components/ + pages/ + dashboard/</name>
  <files>
    frontend/src/components/NavBar.tsx,
    frontend/src/pages/LauncherPage.tsx,
    frontend/src/components/dashboard/EmployeeTable.tsx,
    frontend/src/components/settings/ColorPicker.tsx,
    frontend/src/components/settings/sensors/SnmpWalkCard.tsx
  </files>
  <read_first>
    - frontend/src/components/ui/button.tsx (variant/size surface — after Plan 01 cleanup)
    - frontend/src/components/NavBar.tsx (current raw <button> shape, ~4 usages)
    - frontend/src/pages/LauncherPage.tsx
    - frontend/src/components/dashboard/EmployeeTable.tsx
    - frontend/src/components/settings/ColorPicker.tsx
    - frontend/src/components/settings/sensors/SnmpWalkCard.tsx
    - any existing sibling file already using Button (e.g. signage admin) for variant/size precedent
  </read_first>
  <action>
    For each file in `<files>`:

    1. Add (or merge into existing) import: `import { Button } from "@/components/ui/button"`.

    2. Replace every raw `<button ...>` ... `</button>` with `<Button ...>` ... `</Button>`, applying this mapping:
       - Preserve ALL original props: `onClick`, `disabled`, `type`, `aria-label`, `title`, etc.
       - If the original had a `className` that specified visual styling (colors, borders, padding), TRANSLATE that to an appropriate `variant`/`size` prop combo:
         - Icon-only circular/square buttons with hover bg only → `variant="ghost" size="icon"` (or `icon-sm` for dense row actions)
         - Primary CTAs (filled brand color) → `variant="default" size="default"`
         - Outlined/secondary → `variant="outline" size="default"` or `variant="secondary"`
         - Destructive (red) → `variant="destructive"`
         - Text-only links → `variant="link"`
       - KEEP size-override `className` fragments only for non-standard heights that Button doesn't cover (must be rare). If you find yourself re-adding `h-9`/`h-10`, STOP — that violates CTRL-03; use `size="default"` (h-8) instead.
       - Do NOT add `type="button"` if the original didn't have it, unless the button is inside a `<form>` and would default to `submit` — in that case, add `type="button"` to preserve prior behavior.

    3. After replacement in each file, run:
       `rg "<button[\s>]" <file>` — MUST return 0 matches.

    4. File-specific notes:
       - **NavBar.tsx**: ~4 raw `<button>` usages (header actions). Most are likely icon-only → `variant="ghost" size="icon"` or `size="icon-sm"`.
       - **LauncherPage.tsx**: launcher tile buttons — likely large clickable cards. If they are pure Tailwind-styled surfaces (no Button-like chrome), consider keeping them as `<button>` only if wrapping a card surface where Button's rounded-lg/border clash. Prefer `<Button variant="ghost" className="h-auto p-0 flex-col">` with inner tile content if possible. If the tile must stay visually unchanged and cannot be expressed via Button, leave it as `<button>` and annotate:
         `// CTRL-02 exception: launcher tile — card-surface click target, Button's fixed chrome does not fit the grid-tile visual.`
         Record this exception in the SUMMARY.
       - **EmployeeTable.tsx**: table row-action buttons → `size="icon-sm"` or `size="xs"` with `variant="ghost"`.
       - **ColorPicker.tsx**: each swatch is a `<button>` with `style={{ backgroundColor }}` — a color swatch is NOT a form control in the Button sense. Migrate if trivial, but if swatches need inline background-color and no variant fits, annotate:
         `// CTRL-02 exception: color swatch — caller-provided inline style beyond Button's variant surface.`
         Prefer migration if `<Button variant="ghost" style={{ backgroundColor }}>` renders correctly.
       - **SnmpWalkCard.tsx**: likely a "Walk" action button → `variant="default" size="default"` or `variant="outline" size="sm"` per existing UX.

    5. Do NOT introduce any `h-9`/`h-10`/`h-11` override via `className`. Grep check after:
       `rg 'className="[^"]*\\bh-(9|10|11)\\b' <file>` → 0.

    Any CTRL-02 exceptions MUST use the exact inline-comment style from UI-SPEC §Copywriting Contract (file-input wording is the template). Record the COUNT of exceptions emitted in the SUMMARY.
  </action>
  <verify>
    <automated>cd frontend && for f in src/components/NavBar.tsx src/pages/LauncherPage.tsx src/components/dashboard/EmployeeTable.tsx src/components/settings/ColorPicker.tsx src/components/settings/sensors/SnmpWalkCard.tsx; do npx tsc --noEmit "$f" || exit 1; done</automated>
  </verify>
  <acceptance_criteria>
    - `rg "<button[\s>]" frontend/src/components/NavBar.tsx` → 0 matches.
    - `rg "<button[\s>]" frontend/src/pages/LauncherPage.tsx` → 0 matches (OR every hit is immediately preceded by a `// CTRL-02 exception:` comment on the line above).
    - `rg "<button[\s>]" frontend/src/components/dashboard/EmployeeTable.tsx` → 0 matches.
    - `rg "<button[\s>]" frontend/src/components/settings/ColorPicker.tsx` → 0 matches OR annotated exception.
    - `rg "<button[\s>]" frontend/src/components/settings/sensors/SnmpWalkCard.tsx` → 0 matches.
    - `rg "from \"@/components/ui/button\"" <each file>` returns 1 import line per file that has `<Button>` usage.
    - `rg 'className="[^"]*\\bh-(9|10|11)\\b' <each file>` → 0 matches per file.
    - Scoped `tsc --noEmit` per file: no new errors introduced by this task.
  </acceptance_criteria>
  <done>Five files migrated; any exceptions annotated with exact CTRL-02 exception comment; scoped tsc clean.</done>
</task>

<task type="auto">
  <name>Task 2: Migrate raw <button> in signage/ surface</name>
  <files>
    frontend/src/signage/components/PlaylistItemList.tsx,
    frontend/src/signage/components/TagPicker.tsx,
    frontend/src/signage/components/MediaPickerDialog.tsx
  </files>
  <read_first>
    - frontend/src/components/ui/button.tsx (size/variant surface — post-Plan-01)
    - frontend/src/signage/components/PlaylistItemList.tsx (current usages, likely row actions)
    - frontend/src/signage/components/TagPicker.tsx (tag chips — may need variant="outline" size="xs")
    - frontend/src/signage/components/MediaPickerDialog.tsx
    - a sibling signage file already using Button (`rg -l "from \"@/components/ui/button\"" frontend/src/signage | head -5` to find precedent)
  </read_first>
  <action>
    Apply the exact same migration rules as Task 1 to the three signage files.

    File-specific notes:
    - **PlaylistItemList.tsx**: row actions (reorder/remove). Use `size="icon-xs"` or `size="icon-sm"` with `variant="ghost"`; destructive remove action uses `variant="destructive"` at the same dense size.
    - **TagPicker.tsx**: tag chips likely small pill buttons. Use `size="xs"` with `variant="outline"` or `variant="secondary"` depending on selection state. If tags are already chip-styled via `className` with rounded-full + custom colors, migration to Button may fight existing visuals — prefer minimal disruption: use `variant="ghost" size="xs"` and keep any rounded-full via className override.
    - **MediaPickerDialog.tsx**: dialog confirm/cancel buttons → `variant="default"` (confirm) + `variant="outline"` (cancel) at `size="default"`.

    Same invariants as Task 1:
    - No raw `<button>` remaining (unless annotated CTRL-02 exception).
    - No `h-9`/`h-10`/`h-11` overrides.
    - Scoped `tsc --noEmit` clean.
  </action>
  <verify>
    <automated>cd frontend && for f in src/signage/components/PlaylistItemList.tsx src/signage/components/TagPicker.tsx src/signage/components/MediaPickerDialog.tsx; do npx tsc --noEmit "$f" || exit 1; done</automated>
  </verify>
  <acceptance_criteria>
    - `rg "<button[\s>]" frontend/src/signage/components/PlaylistItemList.tsx` → 0 matches (or annotated exception).
    - `rg "<button[\s>]" frontend/src/signage/components/TagPicker.tsx` → 0 matches (or annotated exception).
    - `rg "<button[\s>]" frontend/src/signage/components/MediaPickerDialog.tsx` → 0 matches (or annotated exception).
    - Each file imports `Button` from `@/components/ui/button`.
    - `rg 'className="[^"]*\\bh-(9|10|11)\\b' <each file>` → 0.
    - Scoped `tsc --noEmit` clean for each.
  </acceptance_criteria>
  <done>Three signage files migrated; scoped tsc clean; exception count (if any) recorded for SUMMARY.</done>
</task>

<task type="auto">
  <name>Task 3: Repo-wide grep invariant for raw <button></name>
  <files>frontend/src (verification only — no writes)</files>
  <read_first>
    - .planning/phases/55-consolidated-form-controls/55-UI-SPEC.md §Verification Hooks #3
  </read_first>
  <action>
    Verify the final repo state matches CTRL-02 for raw `<button>`. Run:

    ```bash
    rg "<button[\s>]" frontend/src --glob "!frontend/src/components/ui/**"
    ```

    Expected allow-list for remaining hits:
    - `frontend/src/components/dashboard/SalesTable.tsx` — DEFERRED (pre-existing TS errors; Phase 54 deferred-items). This file will be migrated in a future carve-out plan.
    - Any file carrying `// CTRL-02 exception:` annotations from Tasks 1 or 2 (e.g. possibly `LauncherPage.tsx`, `ColorPicker.tsx`).
    - Any `.test.tsx` file (test fixtures).

    For each remaining hit, confirm one of the above applies. If an unexpected file remains, loop back to Task 1 or 2 for that file.

    Record the final allow-list in the plan SUMMARY with the exact file paths + reason.
  </action>
  <verify>
    <automated>cd frontend && test $(rg --count-matches "<button[\s>]" src --glob "!src/components/ui/**" --glob "!src/components/dashboard/SalesTable.tsx" --glob "!**/*.test.tsx" | awk -F: '{s+=$2} END {print s+0}') -eq $(rg --count-matches "CTRL-02 exception" src --glob "!src/components/ui/**" --glob "!src/components/dashboard/SalesTable.tsx" --glob "!**/*.test.tsx" | awk -F: '{s+=$2} END {print s+0}')</automated>
  </verify>
  <acceptance_criteria>
    - Every remaining `<button>` outside `ui/` and outside `SalesTable.tsx` (allowed deferral) and outside `*.test.tsx` is matched by at least one `// CTRL-02 exception` comment in the same file.
    - SalesTable.tsx carve-out documented in SUMMARY.
  </acceptance_criteria>
  <done>CTRL-02 for `<button>` element type closed modulo the SalesTable.tsx deferral.</done>
</task>

</tasks>

<verification>
- UI-SPEC grep invariant #3 (`<button` outside ui/) holds modulo documented exceptions.
- Scoped `tsc --noEmit` on each touched file emits no NEW errors.
- Do NOT gate on `npm run build` (pre-existing unrelated errors per Phase 54 deferred-items).
</verification>

<success_criteria>
- 8 consumer files migrated from raw `<button>` to `<Button>`.
- Any irreducible exceptions annotated in-source + tallied in SUMMARY.
- SalesTable.tsx carve-out documented.
- No new `h-9`/`h-10`/`h-11` overrides introduced.
</success_criteria>

<output>
Create `.planning/phases/55-consolidated-form-controls/55-04-SUMMARY.md` listing: files migrated, variant/size choices per file, exception count + paths, SalesTable.tsx deferral note.
</output>
