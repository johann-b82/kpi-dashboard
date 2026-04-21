---
phase: 55-consolidated-form-controls
plan: 06
subsystem: frontend-ui
tags: [ctrl-02, ctrl-03, input, primitive, migration]
requirements: [CTRL-02, CTRL-03]
dependency_graph:
  requires:
    - "@/components/ui/input (Input primitive, pre-existing)"
  provides:
    - "Every non-file raw <input> replaced by <Input> primitive"
    - "Every file-picker <input> carries CTRL-02 exception annotation"
    - "SalesTable.tsx + EmployeeTable.tsx h-9 overrides stripped"
  affects:
    - frontend/src/signage/components/TagPicker.tsx
    - frontend/src/signage/pages/SchedulesPage.tsx
    - frontend/src/signage/components/MediaRegisterUrlDialog.tsx
    - frontend/src/signage/components/MediaUploadDropZone.tsx
    - frontend/src/components/DropZone.tsx
    - frontend/src/components/settings/LogoUpload.tsx
    - frontend/src/components/dashboard/SalesTable.tsx
    - frontend/src/components/dashboard/EmployeeTable.tsx
tech-stack:
  added: []
  patterns:
    - "Caller-specific className overrides strip Input primitive's text-input styling when hosting checkbox/radio/inner-chip-picker inputs"
key-files:
  created:
    - .planning/phases/55-consolidated-form-controls/55-06-SUMMARY.md
  modified:
    - frontend/src/signage/components/TagPicker.tsx
    - frontend/src/signage/pages/SchedulesPage.tsx
    - frontend/src/signage/components/MediaRegisterUrlDialog.tsx
    - frontend/src/signage/components/MediaUploadDropZone.tsx
    - frontend/src/components/DropZone.tsx
    - frontend/src/components/settings/LogoUpload.tsx
    - frontend/src/components/dashboard/SalesTable.tsx
    - frontend/src/components/dashboard/EmployeeTable.tsx
decisions:
  - "Radio/checkbox raw <input> usages ARE migrated to <Input> primitive (Task 1 'etc.' list + Task 4 strict invariant) with className overrides to reset text-input styling (border/bg/padding/rounded/size→auto) so native radio/checkbox visuals pass through."
  - "File-picker <input {...getInputProps()} />' elements (react-dropzone) get CTRL-02 annotation even though literal 'type=\"file\"' never appears in source — react-dropzone injects it at runtime. Annotation is file-level and grep-verifiable on 'CTRL-02 exception'."
  - "TagPicker's text input override uses h-auto (not fixed px) since it lives inside a bordered combobox container — not a CTRL-03 h-9/h-10/h-11 violation."
metrics:
  duration: 214s
  tasks: 4
  files: 8
  completed: 2026-04-21
---

# Phase 55 Plan 06: Migrate Raw Input and H-9 Strip Summary

Closes CTRL-02 (for `<input>` element type) and CTRL-03 by migrating every non-file raw `<input>` to the `<Input>` primitive, annotating every file-picker `<input>` with the CTRL-02 exception comment, and stripping `h-9` overrides from the two dashboard search inputs.

## Scope Delivered

### Task 1: Non-file raw `<input>` migrations

| File | Change | Commit |
| ---- | ------ | ------ |
| `frontend/src/signage/components/TagPicker.tsx` | Text chip-picker input → `<Input>` with border/padding/height reset (container provides visual shell) | c122cc4 |
| `frontend/src/signage/pages/SchedulesPage.tsx` | `<input type="checkbox" role="switch">` → `<Input type="checkbox">` with text-styling reset | 95d09a4 |
| `frontend/src/signage/components/MediaRegisterUrlDialog.tsx` | Two `<input type="radio">` → `<Input type="radio">` with text-styling reset | 95d09a4 |

All text-like `<input>` call sites (text, checkbox, radio) now route through `<Input>`. Imports merged into existing import blocks.

### Task 2: File-picker CTRL-02 annotations

| File | Change | Commit |
| ---- | ------ | ------ |
| `frontend/src/signage/components/MediaUploadDropZone.tsx` | Annotate `<input {...getInputProps()} />` with CTRL-02 exception comment | 2a597be |
| `frontend/src/components/DropZone.tsx` | Same | 2a597be |
| `frontend/src/components/settings/LogoUpload.tsx` | Same | 2a597be |

The exact comment string `CTRL-02 exception: native file picker — primitive <Input> does not wrap file-type inputs (browser-native styling retained).` is placed as a JSX comment on the line immediately above each file-picker `<input>`.

Note: these files use react-dropzone's `getInputProps()` spread — so `type="file"` is injected at runtime, NOT present as a literal string in source. The CTRL-02 annotation is still applied because the intent of UI-SPEC invariant #4 is to mark native-file-picker sites regardless of whether `type="file"` appears as a string literal.

### Task 3: h-9 strip

| File | Before | After | Commit |
| ---- | ------ | ----- | ------ |
| `frontend/src/components/dashboard/SalesTable.tsx:68` | `className="pl-9 h-9"` | `className="pl-9"` | 8f4a575 |
| `frontend/src/components/dashboard/EmployeeTable.tsx:85` | `className="pl-9 h-9"` | `className="pl-9"` | 8f4a575 |

`pl-9` icon padding preserved on both; search icon positioning intact.

### Task 4: Repo-wide grep invariants

Final grep outputs on `frontend/src` excluding `ui/` and `*.test.tsx`:

| Invariant | Result | Status |
| --------- | ------ | ------ |
| #1 `<input` outside `ui/` and tests | 3 hits: all `<input {...getInputProps()} />` file-pickers (MediaUploadDropZone, DropZone, LogoUpload) | PASS semantically — all three are file pickers with CTRL-02 annotations. |
| #2 `type="file"` source literal | 0 hits | PASS (none present); see deviation note below for literal-vs-semantic mismatch. |
| #3 `h-9` on `.tsx` outside `ui/` | 2 hits: `KpiCard.tsx:17` (skeleton `<div>`), `ColorPicker.tsx:62` (color swatch `<div>`) | PASS — neither hit is on a form-control primitive (per plan Task 4 acceptance: layout divs are acceptable). |
| #4 `size=(lg|icon-lg)` | 0 hits | PASS (Plan 01 cleanup + this phase closure confirmed). |

## Deviations from Plan

### Interpretation: Non-text inputs migrated (Rule 2 — auto-add missing coverage)

- **Found during:** Task 1 enumeration
- **Issue:** Plan Task 1 action listed text-like `type` values ("text, number, email, url, password, search, tel, etc.") explicitly, but Task 4's automated verify enforces "count of `<input` equals count of `type=\"file\"`" — which requires migrating radio/checkbox too.
- **Decision:** Follow Task 4's strict invariant and migrate the `<input type="checkbox" role="switch">` in `SchedulesPage` and the `<input type="radio">` pair in `MediaRegisterUrlDialog`. Apply className overrides to reset the Input primitive's text-input styling (`h-auto w-auto min-w-0 rounded-none border-0 bg-transparent px-0 py-0`) so native radio/checkbox visuals pass through.
- **Files modified:** `frontend/src/signage/pages/SchedulesPage.tsx`, `frontend/src/signage/components/MediaRegisterUrlDialog.tsx`
- **Commit:** 95d09a4

### Literal vs semantic invariant (Task 4 automated verify)

- **Found during:** Task 4 repo-wide invariants
- **Issue:** Plan Task 4's automated verify:
  ```
  test $(rg --count-matches "<input[\s>]" ...) -eq $(rg --count-matches 'type="file"' ...)
  ```
  evaluates to `test 3 -eq 0` which fails numerically. However the underlying semantic invariant ("every remaining `<input>` is a file picker") holds: all 3 remaining `<input>` are `<input {...getInputProps()} />` from react-dropzone — runtime type is `file`.
- **Resolution:** Semantic invariant PASSES. Literal numeric check FAILS due to react-dropzone's runtime `type="file"` injection (no source-level string literal). All 3 remaining `<input>` elements carry the CTRL-02 exception annotation. UI-SPEC grep invariant #4 ("every file with `type=\"file\"` also contains `CTRL-02 exception`") vacuously holds because there are 0 `type="file"` source literals — but the stronger invariant ("every file-picker `<input>` site is annotated") DOES hold.
- **Follow-up:** Phase 55 gap-closure (if any) may want to tighten the UI-SPEC invariant to scan for `react-dropzone`'s `getInputProps` spread as a file-picker proxy OR update the invariant wording to explicitly count runtime-type file pickers via grep on the known spread pattern.

### TagPicker input styling (Rule 1 — fix broken behavior)

- **Found during:** Task 1 TagPicker migration
- **Issue:** TagPicker's input lives inside a `<div>` combobox container that already provides the border, rounded corners, padding, and sizing. Dropping the Input primitive's default `h-8 rounded-lg border border-input bg-transparent px-2.5 py-1` styling on top would break the chip-picker layout (double border, fixed row height conflicts with chip flex-wrap).
- **Fix:** Override primitive classes via className: `flex-1 min-w-[100px] border-0 bg-transparent px-0 py-0 h-auto focus-visible:ring-0 focus-visible:border-0`. This is the "caller-specific positioning" carve-out explicitly permitted by plan Task 1 step 4. `h-auto` is NOT a fixed-pixel override (which would violate CTRL-03) — it defers height to content.
- **Files modified:** `frontend/src/signage/components/TagPicker.tsx`
- **Commit:** c122cc4

### Radio/checkbox className overrides

- **Found during:** Task 1 extension for non-text inputs
- **Issue:** Input primitive hardcodes text-input styling; applying it unmodified to `<input type="checkbox">` / `<input type="radio">` would produce a 32-pixel-tall rounded bordered box with padding — visually indistinguishable from a text field and useless for toggling.
- **Fix:** Pass `className="h-auto w-auto min-w-0 rounded-none border-0 bg-transparent px-0 py-0"` — relies on tailwind-merge (via `cn()`) to strip conflicting classes and lets native radio/checkbox browser styling render.
- **Files modified:** `frontend/src/signage/pages/SchedulesPage.tsx`, `frontend/src/signage/components/MediaRegisterUrlDialog.tsx`
- **Commit:** 95d09a4

### Authentication gates

None.

## Verification

- Scoped `tsc --noEmit` against each touched file: no NEW errors introduced relative to Phase 54 deferred-items.md baseline. Pre-existing errors in `SalesTable.tsx`, `HrKpiCharts.tsx`, `select.tsx`, `useSensorDraft.ts`, `defaults.ts`, `SchedulesPage.test.tsx` unchanged (not in scope for this plan).
- `rg 'className="[^"]*\bh-9\b' frontend/src/components/dashboard/SalesTable.tsx frontend/src/components/dashboard/EmployeeTable.tsx` → 0 matches (plan Task 3 acceptance).
- `rg "pl-9" frontend/src/components/dashboard/SalesTable.tsx frontend/src/components/dashboard/EmployeeTable.tsx` → 2 matches (one per file — icon padding preserved).
- CTRL-02 annotation present on all three file-picker sites.

## Phase 55 Success Criteria Status (this is the final wave-2 plan)

Phase 55 UI-SPEC §Success Criteria:

1. **CTRL-01** (Button/Textarea consolidation) — owned by Plan 55-01; out of scope here.
2. **CTRL-02** (no raw `<input>`/`<select>` outside `ui/`, except annotated file pickers) — **satisfied for `<input>`** by this plan. Select-side closure owned by Plan 55-05.
3. **CTRL-03** (no `h-9`/`h-10`/`h-11` on form controls) — **satisfied** by this plan for the two dashboard search inputs. Remaining `h-9` hits are non-form-control layout divs (KpiCard skeleton, ColorPicker swatch).
4. **CTRL-04** (size tokens cleaned up: no `size="lg"` / `size="icon-lg"`) — **satisfied** (0 matches repo-wide; Plan 55-01 did the cleanup, confirmed here).

Provided Plans 55-01..05 also close out their respective contracts, Phase 55 is ready for verifier handoff.

## Known Stubs

None.

## Deferred Issues

None beyond the Task 4 literal-vs-semantic invariant mismatch documented above, which is a plan-level invariant wording issue, not a code defect.

## Self-Check: PASSED

Files verified present:
- frontend/src/signage/components/TagPicker.tsx: FOUND
- frontend/src/signage/pages/SchedulesPage.tsx: FOUND
- frontend/src/signage/components/MediaRegisterUrlDialog.tsx: FOUND
- frontend/src/signage/components/MediaUploadDropZone.tsx: FOUND
- frontend/src/components/DropZone.tsx: FOUND
- frontend/src/components/settings/LogoUpload.tsx: FOUND
- frontend/src/components/dashboard/SalesTable.tsx: FOUND
- frontend/src/components/dashboard/EmployeeTable.tsx: FOUND

Commits verified in git log:
- c122cc4: FOUND (TagPicker migration)
- 2a597be: FOUND (file-picker annotations)
- 8f4a575: FOUND (h-9 strip)
- 95d09a4: FOUND (checkbox/radio migration)
