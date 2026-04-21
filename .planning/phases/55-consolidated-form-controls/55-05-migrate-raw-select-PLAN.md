---
phase: 55-consolidated-form-controls
plan: 05
type: execute
wave: 2
depends_on:
  - 02
files_modified:
  - frontend/src/components/settings/sensors/SnmpWalkCard.tsx
  - frontend/src/signage/components/ScheduleEditDialog.tsx
  - frontend/src/signage/components/PlaylistItemList.tsx
  - frontend/src/components/settings/PersonioCard.tsx
autonomous: true
requirements:
  - CTRL-02
must_haves:
  truths:
    - "Every raw <select> usage in the 4 listed consumer files is replaced with the Select primitive from Plan 02"
    - "Option values + labels preserved; existing value/onChange semantics maintained via onValueChange"
    - "No raw <select> remains outside frontend/src/components/ui/ and *.test.tsx"
  artifacts:
    - path: "frontend/src/components/settings/sensors/SnmpWalkCard.tsx"
      provides: "Sensor select migrated"
    - path: "frontend/src/signage/components/ScheduleEditDialog.tsx"
      provides: "Schedule dialog selects migrated"
    - path: "frontend/src/signage/components/PlaylistItemList.tsx"
      provides: "Playlist item-type select migrated"
    - path: "frontend/src/components/settings/PersonioCard.tsx"
      provides: "Personio select migrated"
  key_links:
    - from: "listed consumer files"
      to: "@/components/ui/select"
      via: "named import"
      pattern: "import \\{ Select.*? \\} from \"@/components/ui/select\""
---

<objective>
Migrate all raw `<select>` usages in the 4 listed consumer files to the `Select` primitive shipped in Plan 02. Keep existing value/option semantics; switch from `onChange={(e) => …e.target.value…}` to `onValueChange={(v) => …v…}`.

`ScheduleEditDialog.test.tsx` keeps its raw `<select>` fixtures — NOT a migration target (RESEARCH §Migration Audit).

Purpose: Close CTRL-02 for `<select>` element type. Wave 2(b) of D-09.
Output: 4 files migrated; zero raw `<select>` outside `ui/` and `*.test.tsx`.
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

<interfaces>
Select export surface (from `frontend/src/components/ui/select.tsx`, Plan 02):
```ts
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
```

Canonical consumer shape:
```tsx
<Select value={current} onValueChange={setCurrent} disabled={isDisabled}>
  <SelectTrigger id="foo" aria-label="Foo" aria-invalid={hasError || undefined}>
    <SelectValue placeholder="Pick…" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="a">Label A</SelectItem>
    <SelectItem value="b">Label B</SelectItem>
  </SelectContent>
</Select>
```

Native `<select onChange={(e) => setX(e.target.value)}>` maps to `onValueChange={setX}` directly.
Native `<option value="x">Label</option>` maps to `<SelectItem value="x">Label</SelectItem>`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate signage/ raw <select> (ScheduleEditDialog + PlaylistItemList)</name>
  <files>
    frontend/src/signage/components/ScheduleEditDialog.tsx,
    frontend/src/signage/components/PlaylistItemList.tsx
  </files>
  <read_first>
    - frontend/src/components/ui/select.tsx (Plan 02 output — exports surface)
    - frontend/src/signage/components/ScheduleEditDialog.tsx (identify each <select> block)
    - frontend/src/signage/components/PlaylistItemList.tsx (identify each <select> block)
    - .planning/phases/55-consolidated-form-controls/55-RESEARCH.md §Migration Audit (confirms 2 files in signage with raw <select>)
  </read_first>
  <action>
    For each file:

    1. Add import:
       ```tsx
       import {
         Select,
         SelectValue,
         SelectTrigger,
         SelectContent,
         SelectItem,
       } from "@/components/ui/select"
       ```

    2. For each `<select … onChange={(e) => setX(e.target.value)} value={x}> … <option value="v">Label</option> … </select>`:

       Replace with:
       ```tsx
       <Select value={x} onValueChange={setX} disabled={originalDisabled}>
         <SelectTrigger id={originalId} aria-label={originalAriaLabel}>
           <SelectValue placeholder={originalPlaceholder /* or "" */} />
         </SelectTrigger>
         <SelectContent>
           <SelectItem value="v">Label</SelectItem>
           {/* ... preserve all options verbatim */}
         </SelectContent>
       </Select>
       ```

    3. Preserve:
       - `value` / `defaultValue` (base-ui Select supports controlled + uncontrolled).
       - `id`, `aria-label`, `aria-describedby`, `aria-invalid`, `name` — move to `<SelectTrigger>`.
       - `disabled` — pass to `<Select>` (Root).
       - Option `<option disabled>` → `<SelectItem value="…" disabled>` or `<SelectItem value="…" data-disabled>` per base-ui API (read `@base-ui/react/select/item` typings).
       - An empty-placeholder first `<option value="">Pick…</option>` becomes the `placeholder` prop on `<SelectValue>`.

    4. If the existing select uses `onChange` for BOTH value read AND side-effects (e.g. `e.stopPropagation()`), note that `onValueChange` receives only the selected value — any side-effect logic must move into a derived form (or into a separate handler). Document any such refactor in the SUMMARY.

    5. If `SelectItem` values are non-string (numbers, booleans), stringify at the boundary:
       ```tsx
       <Select value={String(x)} onValueChange={(v) => setX(Number(v))}>
         <SelectItem value={String(option)}>...</SelectItem>
       </Select>
       ```
       Base-ui Select values are `any` but React keys + attribute serialization work best as strings.

    6. After each file, grep check:
       `rg "<select[\s>]" <file>` → 0 matches.
  </action>
  <verify>
    <automated>cd frontend && for f in src/signage/components/ScheduleEditDialog.tsx src/signage/components/PlaylistItemList.tsx; do npx tsc --noEmit "$f" || exit 1; done</automated>
  </verify>
  <acceptance_criteria>
    - `rg "<select[\s>]" frontend/src/signage/components/ScheduleEditDialog.tsx` → 0 matches.
    - `rg "<select[\s>]" frontend/src/signage/components/PlaylistItemList.tsx` → 0 matches.
    - Both files import from `@/components/ui/select`.
    - `rg "<option[\s>]" <each file>` → 0 matches (all replaced with `<SelectItem>`).
    - Scoped `tsc --noEmit` clean for both files.
    - Any value-coercion (number/boolean) documented in SUMMARY.
  </acceptance_criteria>
  <done>Signage raw `<select>` migrations complete and type-safe.</done>
</task>

<task type="auto">
  <name>Task 2: Migrate settings/ raw <select> (SnmpWalkCard + PersonioCard)</name>
  <files>
    frontend/src/components/settings/sensors/SnmpWalkCard.tsx,
    frontend/src/components/settings/PersonioCard.tsx
  </files>
  <read_first>
    - frontend/src/components/ui/select.tsx
    - frontend/src/components/settings/sensors/SnmpWalkCard.tsx
    - frontend/src/components/settings/PersonioCard.tsx
  </read_first>
  <action>
    Apply the exact same migration pattern as Task 1 to these 2 settings files.

    File-specific notes:
    - **SnmpWalkCard.tsx**: the `<select>` likely picks OID / community string. Preserve any `required` attribute — map to visible label + `aria-required={true}` on the trigger (base-ui Select doesn't support a native `required` attribute; validation is caller-side).
    - **PersonioCard.tsx**: if the select binds to an array of dynamic options (e.g. departments), make sure the option map still renders inside `<SelectContent>`:
      ```tsx
      <SelectContent>
        {items.map((it) => (
          <SelectItem key={it.id} value={String(it.id)}>{it.name}</SelectItem>
        ))}
      </SelectContent>
      ```
    - An empty placeholder option becomes `<SelectValue placeholder="…" />`.

    Grep check after: `rg "<select[\s>]" <each file>` → 0.
  </action>
  <verify>
    <automated>cd frontend && for f in src/components/settings/sensors/SnmpWalkCard.tsx src/components/settings/PersonioCard.tsx; do npx tsc --noEmit "$f" || exit 1; done</automated>
  </verify>
  <acceptance_criteria>
    - `rg "<select[\s>]" frontend/src/components/settings/sensors/SnmpWalkCard.tsx` → 0 matches.
    - `rg "<select[\s>]" frontend/src/components/settings/PersonioCard.tsx` → 0 matches.
    - Both files import from `@/components/ui/select`.
    - `rg "<option[\s>]" <each file>` → 0 matches.
    - Scoped `tsc --noEmit` clean for both.
  </acceptance_criteria>
  <done>Settings raw `<select>` migrations complete.</done>
</task>

<task type="auto">
  <name>Task 3: Repo-wide grep invariant for raw <select></name>
  <files>frontend/src (verification only)</files>
  <read_first>
    - .planning/phases/55-consolidated-form-controls/55-UI-SPEC.md §Verification Hooks #3
  </read_first>
  <action>
    Verify: `rg "<select[\s>]" frontend/src --glob "!frontend/src/components/ui/**" --glob "!**/*.test.tsx"` returns 0 matches.

    Test-file carve-out: `frontend/src/signage/components/ScheduleEditDialog.test.tsx` may retain raw `<select>` per RESEARCH §Migration Audit (test fixture).

    Record confirmation in SUMMARY.
  </action>
  <verify>
    <automated>cd frontend && test $(rg --count-matches "<select[\s>]" src --glob "!src/components/ui/**" --glob "!**/*.test.tsx" | awk -F: '{s+=$2} END {print s+0}') -eq 0</automated>
  </verify>
  <acceptance_criteria>
    - Invariant grep returns 0 matches (outside `ui/` and `*.test.tsx`).
  </acceptance_criteria>
  <done>CTRL-02 for `<select>` element type fully closed.</done>
</task>

</tasks>

<verification>
- UI-SPEC grep invariant #3 for `<select>` holds.
- Scoped `tsc --noEmit` on each touched file emits no NEW errors.
- Do NOT gate on `npm run build`.
</verification>

<success_criteria>
- 4 consumer files migrated from raw `<select>` to `<Select>` primitive.
- `<option>` → `<SelectItem>` round-trip preserves all values and labels.
- No raw `<select>` outside `ui/` and `*.test.tsx`.
</success_criteria>

<output>
Create `.planning/phases/55-consolidated-form-controls/55-05-SUMMARY.md` capturing: files migrated, any value-coercion (stringification) introduced, any behavioral changes (e.g. removed `onChange` side-effects).
</output>
