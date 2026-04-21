---
phase: 55-consolidated-form-controls
plan: 06
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/signage/components/TagPicker.tsx
  - frontend/src/signage/pages/SchedulesPage.tsx
  - frontend/src/signage/components/MediaRegisterUrlDialog.tsx
  - frontend/src/signage/components/MediaUploadDropZone.tsx
  - frontend/src/components/DropZone.tsx
  - frontend/src/components/settings/LogoUpload.tsx
  - frontend/src/components/dashboard/SalesTable.tsx
  - frontend/src/components/dashboard/EmployeeTable.tsx
autonomous: true
requirements:
  - CTRL-02
  - CTRL-03
must_haves:
  truths:
    - "Every non-file raw <input> usage is migrated to the Input primitive"
    - "Every remaining file input carries an inline CTRL-02 exception annotation (file pickers stay native per D-10)"
    - "SalesTable.tsx and EmployeeTable.tsx <Input className='pl-9 h-9'> strip the h-9 override and keep pl-9 (icon padding)"
    - "No raw <input> outside frontend/src/components/ui/ and annotated file-picker exceptions"
  artifacts:
    - path: "frontend/src/signage/components/TagPicker.tsx"
      provides: "Text input migrated to <Input>"
    - path: "frontend/src/signage/pages/SchedulesPage.tsx"
      provides: "Non-file input migrated (if present)"
    - path: "frontend/src/signage/components/MediaRegisterUrlDialog.tsx"
      provides: "URL input migrated"
    - path: "frontend/src/signage/components/MediaUploadDropZone.tsx"
      provides: "File input annotated with CTRL-02 exception"
    - path: "frontend/src/components/DropZone.tsx"
      provides: "File input annotated"
    - path: "frontend/src/components/settings/LogoUpload.tsx"
      provides: "File input annotated"
    - path: "frontend/src/components/dashboard/SalesTable.tsx"
      provides: "h-9 override stripped from <Input className=\"pl-9 h-9\">"
    - path: "frontend/src/components/dashboard/EmployeeTable.tsx"
      provides: "h-9 override stripped from <Input className=\"pl-9 h-9\">"
  key_links:
    - from: "non-file consumer inputs"
      to: "@/components/ui/input"
      via: "named import"
      pattern: "import \\{ Input \\} from \"@/components/ui/input\""
    - from: "file-input call sites"
      to: "CTRL-02 exception annotations"
      via: "inline comment on the line above <input type=\"file\">"
      pattern: "CTRL-02 exception: native file picker"
---

<objective>
Close CTRL-02 for the `<input>` element type and CTRL-03 by:
- Migrating every non-file raw `<input>` to the `<Input>` primitive.
- Annotating every `<input type="file">` with the CTRL-02 exception comment (D-10 — native file pickers stay native).
- Stripping `h-9` from the two `<Input className="pl-9 h-9">` call sites identified in RESEARCH §Pitfall 3.

This plan does NOT depend on Plan 02 or 03 (only on `Input` primitive which already exists). It CAN run in parallel with Plans 04 + 05.

Note on SalesTable.tsx: per RESEARCH Open Question 3, the file has pre-existing TS errors (Phase 54 deferred-items). Scope for this plan is ONLY the `className="pl-9 h-9"` strip. Do NOT touch any other TS issue in the file. Scoped `tsc --noEmit` may still show the pre-existing errors — compare against baseline (Phase 54 deferred-items.md) to confirm no NEW errors introduced.

Purpose: CTRL-02 (`<input>` migrations) + CTRL-03 (no `h-9` overrides on form controls).
Output: 8 files touched; invariants #3, #4, #9 from UI-SPEC §Verification Hooks satisfied.
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
@.planning/phases/54-toggle-primitive-migrations/deferred-items.md
@frontend/src/components/ui/input.tsx

<interfaces>
Input export (existing; unchanged this phase):
```tsx
import { Input } from "@/components/ui/input"
// Props: standard HTMLInputElement props; NO type="file" support (D-10).
```

CTRL-02 exception annotation — EXACT string (grep-verifiable; UI-SPEC §Copywriting Contract):
```tsx
// CTRL-02 exception: native file picker — primitive <Input> does not wrap file-type inputs (browser-native styling retained).
<input type="file" … />
```

h-9 strip pattern (SalesTable.tsx:68, EmployeeTable.tsx:85):
```tsx
// Before:
<Input className="pl-9 h-9" ... />
// After:
<Input className="pl-9" ... />
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate non-file raw <input> usages</name>
  <files>
    frontend/src/signage/components/TagPicker.tsx,
    frontend/src/signage/pages/SchedulesPage.tsx,
    frontend/src/signage/components/MediaRegisterUrlDialog.tsx
  </files>
  <read_first>
    - frontend/src/components/ui/input.tsx (existing primitive surface)
    - frontend/src/signage/components/TagPicker.tsx (confirm `<input>` is type="text" or similar — NOT file)
    - frontend/src/signage/pages/SchedulesPage.tsx (scan for any `<input>` — may be zero after verification)
    - frontend/src/signage/components/MediaRegisterUrlDialog.tsx
    - .planning/phases/55-consolidated-form-controls/55-RESEARCH.md §Migration Audit
  </read_first>
  <action>
    For each file:

    1. First, enumerate `<input>` usages in the file: `rg -n "<input" <file>`. For each:
       - If `type="file"` → SKIP in this task (Task 2 handles).
       - If `type` is text, number, email, url, password, search, tel, etc. (or no type attribute) → MIGRATE.

    2. For non-file inputs, add import (merge into existing imports):
       ```tsx
       import { Input } from "@/components/ui/input"
       ```

    3. Replace `<input ... />` with `<Input ... />`. Preserve ALL props: `value`, `defaultValue`, `onChange`, `onKeyDown`, `onBlur`, `placeholder`, `disabled`, `required`, `id`, `name`, `aria-*`, `type`, `min`, `max`, `step`, `pattern`, `autoComplete`, `className`, `ref` (Input forwards refs via base-ui).

    4. If the original had an explicit `className` with visual styling (colors, padding, borders beyond what Input provides), review whether it's:
       - Caller-specific positioning (e.g. `pl-9` for inline search icon) — KEEP.
       - Re-implementing Input's built-in focus/disabled/invalid — STRIP (Input primitive already provides these).
       - Height overrides (`h-9`/`h-10`/`h-11`) — STRIP (violates CTRL-03).

    5. If a file (e.g. `SchedulesPage.tsx`) ends up having 0 non-file `<input>` after enumeration, record that in SUMMARY and move on — this file is still in `files_modified` because the grep audit may have listed it defensively per CONTEXT. No change ≠ failure.

    6. Grep check per file after edits: `rg "<input[\s>]" <file>` matches only file-picker inputs (if any), which Task 2 will annotate.
  </action>
  <verify>
    <automated>cd frontend && for f in src/signage/components/TagPicker.tsx src/signage/pages/SchedulesPage.tsx src/signage/components/MediaRegisterUrlDialog.tsx; do npx tsc --noEmit "$f" || exit 1; done</automated>
  </verify>
  <acceptance_criteria>
    - After this task, in each file: every remaining `<input>` is `type="file"` (Task 2 will annotate).
    - `rg "<input" <each file> | rg -v 'type="file"'` returns 0 matches per file (or only matches lines that are import statements / other false-positives — verify visually).
    - Each file that had any non-file `<input>` now imports `Input` from `@/components/ui/input`.
    - No `h-9`/`h-10`/`h-11` in className on the migrated inputs.
    - Scoped `tsc --noEmit` clean for each file.
  </acceptance_criteria>
  <done>Non-file `<input>` migrations complete; file-picker inputs (if any in these files) remain pending Task 2 annotation.</done>
</task>

<task type="auto">
  <name>Task 2: Annotate every file-picker <input type="file"> with CTRL-02 exception</name>
  <files>
    frontend/src/signage/components/MediaUploadDropZone.tsx,
    frontend/src/components/DropZone.tsx,
    frontend/src/components/settings/LogoUpload.tsx,
    frontend/src/signage/components/MediaRegisterUrlDialog.tsx,
    frontend/src/signage/components/TagPicker.tsx,
    frontend/src/signage/pages/SchedulesPage.tsx
  </files>
  <read_first>
    - .planning/phases/55-consolidated-form-controls/55-UI-SPEC.md §Copywriting Contract (exact comment string)
    - .planning/phases/55-consolidated-form-controls/55-CONTEXT.md §D-10
    - each file in <files>
  </read_first>
  <action>
    For EACH file in `<files>`, run `rg -n "<input[^>]*type=\"file\"" <file>` to find every file-picker input.

    For each `<input type="file" … />` that is NOT already annotated on the immediately preceding line, insert this EXACT comment on the line directly above the `<input type="file"` opening tag:

    ```tsx
    {/* CTRL-02 exception: native file picker — primitive <Input> does not wrap file-type inputs (browser-native styling retained). */}
    <input type="file" ... />
    ```

    If the file uses JS-comment context (outside JSX, inside attribute-spread builder, etc.), use:
    ```tsx
    // CTRL-02 exception: native file picker — primitive <Input> does not wrap file-type inputs (browser-native styling retained).
    ```

    Notes:
    - The `{/* … */}` JSX-comment form is preferred because these file-pickers live inside JSX trees.
    - The exact substring `CTRL-02 exception: native file picker` MUST be present on the line immediately above the `<input type="file"` line (the grep invariant is file-level, but human readers expect line-adjacency).
    - If a file has NO `<input type="file">`, skip it silently. The file is in `files_modified` defensively — no change = OK; record in SUMMARY.
    - DO NOT migrate `<input type="file">` to `<Input>` under any circumstances (D-10).

    After annotating, grep invariant #4 from UI-SPEC:
    `rg "type=\"file\"" <each file>` AND `rg "CTRL-02 exception" <each file>` BOTH match in every file that has a file input.
  </action>
  <verify>
    <automated>cd frontend && for f in src/signage/components/MediaUploadDropZone.tsx src/components/DropZone.tsx src/components/settings/LogoUpload.tsx src/signage/components/MediaRegisterUrlDialog.tsx src/signage/components/TagPicker.tsx src/signage/pages/SchedulesPage.tsx; do if rg -q 'type="file"' "$f"; then rg -q 'CTRL-02 exception' "$f" || { echo "MISSING annotation in $f"; exit 1; }; fi; done</automated>
  </verify>
  <acceptance_criteria>
    - For every file in `<files>` that contains `type="file"`, the same file also contains at least one `CTRL-02 exception: native file picker` comment.
    - No `<input type="file">` migrated to `<Input type="file">`.
    - Scoped `tsc --noEmit` clean for each file.
  </acceptance_criteria>
  <done>Every file-picker input is annotated; UI-SPEC grep invariant #4 holds.</done>
</task>

<task type="auto">
  <name>Task 3: Strip h-9 from SalesTable + EmployeeTable <Input> usages</name>
  <files>
    frontend/src/components/dashboard/SalesTable.tsx,
    frontend/src/components/dashboard/EmployeeTable.tsx
  </files>
  <read_first>
    - frontend/src/components/dashboard/SalesTable.tsx (line 68 area)
    - frontend/src/components/dashboard/EmployeeTable.tsx (line 85 area)
    - .planning/phases/55-consolidated-form-controls/55-RESEARCH.md §Pitfall 3 (h-9 override removal)
    - .planning/phases/55-consolidated-form-controls/55-UI-SPEC.md §Verification Hooks #9
    - .planning/phases/54-toggle-primitive-migrations/deferred-items.md (SalesTable pre-existing errors — do NOT touch)
  </read_first>
  <action>
    For each of the two files, locate `<Input className="pl-9 h-9" … />` (or equivalent with extra classes like `className="pl-9 h-9 w-full"`).

    Edit each occurrence to REMOVE only the ` h-9` token from the className string, keeping every other class verbatim. Examples:
    - `className="pl-9 h-9"` → `className="pl-9"`
    - `className="pl-9 h-9 w-full"` → `className="pl-9 w-full"`
    - `className="h-9 pl-9"` → `className="pl-9"`

    Rules:
    - DO NOT change any other prop (value, onChange, placeholder, etc.).
    - DO NOT attempt to fix any pre-existing TS errors in SalesTable.tsx (out of scope — Phase 54 deferred-items.md).
    - DO NOT rewrite `<Input>` to `<input>` or remove the primitive import.
    - If the file contains multiple `<Input>` call sites, only strip `h-9` where it appears; leave others untouched.

    Grep check after:
    `rg 'className="[^"]*\bh-9\b' <each file>` → 0 matches.
  </action>
  <verify>
    <automated>cd frontend && test $(rg --count-matches 'className="[^"]*\bh-9\b' src/components/dashboard/SalesTable.tsx src/components/dashboard/EmployeeTable.tsx 2>/dev/null | awk -F: '{s+=$2} END {print s+0}') -eq 0</automated>
  </verify>
  <acceptance_criteria>
    - `rg 'className="[^"]*\bh-9\b' frontend/src/components/dashboard/SalesTable.tsx` → 0 matches.
    - `rg 'className="[^"]*\bh-9\b' frontend/src/components/dashboard/EmployeeTable.tsx` → 0 matches.
    - `rg "pl-9" frontend/src/components/dashboard/SalesTable.tsx frontend/src/components/dashboard/EmployeeTable.tsx` each still returns ≥1 match (icon padding preserved).
    - Scoped `tsc --noEmit` does not show NEW errors vs. Phase 54 deferred-items.md baseline.
  </acceptance_criteria>
  <done>Both dashboard tables no longer pin form-control height to 36px; `pl-9` icon padding preserved.</done>
</task>

<task type="auto">
  <name>Task 4: Repo-wide grep invariants for <input> + h-9</name>
  <files>frontend/src (verification only)</files>
  <read_first>
    - .planning/phases/55-consolidated-form-controls/55-UI-SPEC.md §Verification Hooks #3, #4, #9
  </read_first>
  <action>
    Run these final repo-wide invariants and record results in SUMMARY:

    1. `rg "<input[\s>]" frontend/src --glob "!frontend/src/components/ui/**"` — every hit must either be `type="file"` AND in a file with `CTRL-02 exception`, OR in a `*.test.tsx` file.

    2. `rg "type=\"file\"" frontend/src` — every hit must be in a file where `rg "CTRL-02 exception" <same file>` also matches.

    3. `rg 'className="[^"]*\bh-9\b' frontend/src --glob "*.tsx" --glob "!frontend/src/components/ui/**"` — every remaining hit must NOT be on a form-control primitive (Input/Select/Textarea/Button). Acceptable remaining hits: `table.tsx` `<th className="h-10 …">` (out of scope — not a form control), arbitrary layout divs, etc.

    4. `rg "size=[\"'](lg|icon-lg)[\"']" frontend/src` — must be 0 matches (confirms Plan 01 cleanup + this phase's closure).

    If any invariant fails, flag it in SUMMARY and open a follow-up note for the next plan (or gap-closure).
  </action>
  <verify>
    <automated>cd frontend && test $(rg --count-matches "<input[\s>]" src --glob "!src/components/ui/**" --glob "!**/*.test.tsx" | awk -F: '{s+=$2} END {print s+0}') -eq $(rg --count-matches 'type="file"' src --glob "!src/components/ui/**" --glob "!**/*.test.tsx" | awk -F: '{s+=$2} END {print s+0}')</automated>
  </verify>
  <acceptance_criteria>
    - Count of `<input` outside `ui/` and `*.test.tsx` equals count of `type="file"` in same scope (i.e. every remaining `<input>` is a file picker).
    - Every file with a `type="file"` occurrence also contains `CTRL-02 exception`.
    - `rg 'className="[^"]*\bh-9\b' frontend/src --glob "!frontend/src/components/ui/**" --glob "*.tsx"` returns 0 matches on lines that touch a form-control primitive (Input/Button/Select/Textarea). If there are hits on `<th>` or `<div>` etc. that's fine — CTRL-03 targets form controls.
    - `rg "size=[\"'](lg|icon-lg)[\"']" frontend/src` → 0 matches.
  </acceptance_criteria>
  <done>Final invariants satisfied; any residual issues documented as follow-ups.</done>
</task>

</tasks>

<verification>
- UI-SPEC grep invariants #3, #4, #9, #2 all hold per Task 4 outputs.
- Scoped `tsc --noEmit` on each touched file emits no NEW errors relative to Phase 54 deferred-items.md baseline.
- Do NOT gate on `npm run build`.
</verification>

<success_criteria>
- Every non-file `<input>` migrated to `<Input>`.
- Every `<input type="file">` annotated with CTRL-02 exception comment.
- SalesTable.tsx + EmployeeTable.tsx no longer impose `h-9` on their search `<Input>`s.
- Phase 55 grep invariants #1..#9 all hold (or documented exceptions).
</success_criteria>

<output>
Create `.planning/phases/55-consolidated-form-controls/55-06-SUMMARY.md` capturing: files migrated, files annotated, files with 0 changes (defensive listings), exact h-9 strip lines, final grep invariant outputs (all 9 from UI-SPEC). This is the final Wave 2 plan — its SUMMARY should explicitly state whether Phase 55's 4 success criteria are met.
</output>
