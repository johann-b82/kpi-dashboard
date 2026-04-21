---
phase: 55-consolidated-form-controls
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/ui/button.tsx
  - frontend/src/components/ui/textarea.tsx
  - frontend/src/components/ui/textarea.test.tsx
autonomous: true
requirements:
  - CTRL-01
  - CTRL-03
  - CTRL-04
must_haves:
  truths:
    - "Button primitive no longer exposes lg / icon-lg sizes"
    - "Textarea primitive exists at frontend/src/components/ui/textarea.tsx with token-driven focus, disabled, invalid states"
    - "Textarea renders at min-h-16 with resize-y and inherits the same invalid-state class chain as Input"
    - "Unit tests cover Textarea render, disabled state, invalid state class application"
  artifacts:
    - path: "frontend/src/components/ui/button.tsx"
      provides: "Cleaned button variants (no lg, no icon-lg) + size-scale JSDoc"
      contains: "Button size scale (CTRL-03)"
    - path: "frontend/src/components/ui/textarea.tsx"
      provides: "Textarea primitive wrapping plain <textarea>"
      exports: ["Textarea"]
    - path: "frontend/src/components/ui/textarea.test.tsx"
      provides: "Unit tests for Textarea render, disabled, invalid"
  key_links:
    - from: "frontend/src/components/ui/textarea.tsx"
      to: "tailwind tokens"
      via: "shared class chain copied verbatim from input.tsx"
      pattern: "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
---

<objective>
Close out the Button cleanup (D-04/D-05) and ship the Textarea primitive (D-06) in parallel with the Select (Plan 02) and Dropdown (Plan 03) primitive plans. No consumer migrations in this plan — only the `frontend/src/components/ui/` surface.

Purpose: CTRL-01 (Textarea exists) + CTRL-03 (no h-9 variants in default paths) + CTRL-04 (shared invalid/focus/disabled chain) all land in one focused primitive-build plan.
Output: button.tsx with `lg`/`icon-lg` removed + JSDoc size-scale block; textarea.tsx + textarea.test.tsx.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/55-consolidated-form-controls/55-CONTEXT.md
@.planning/phases/55-consolidated-form-controls/55-RESEARCH.md
@.planning/phases/55-consolidated-form-controls/55-UI-SPEC.md
@frontend/src/components/ui/input.tsx
@frontend/src/components/ui/button.tsx

<interfaces>
<!-- SSOT class chains to copy verbatim (from input.tsx) -->

Textarea base surface:
```
flex w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none resize-y min-h-16
```

Focus-visible chain (MUST match Input):
```
focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
```

Disabled chain (MUST match Input):
```
disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50
```

Invalid chain (MUST match Input):
```
aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20
```

Placeholder + dark-mode + responsive type:
```
placeholder:text-muted-foreground md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Clean up button variants (remove lg + icon-lg) and document size scale</name>
  <files>frontend/src/components/ui/button.tsx</files>
  <read_first>
    - frontend/src/components/ui/button.tsx (the file being edited)
    - .planning/phases/55-consolidated-form-controls/55-RESEARCH.md (§Pattern 5 Button Cleanup — D-04/D-05)
    - .planning/phases/55-consolidated-form-controls/55-UI-SPEC.md (§Verification Hooks — grep invariants #2)
  </read_first>
  <action>
    Per D-04 and D-05 (locked decisions): edit `frontend/src/components/ui/button.tsx` to:

    1. Remove exactly these two lines from the `size` variant object inside `buttonVariants`:
       - `lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",`
       - `"icon-lg": "size-9",`
       Keep `default`, `xs`, `sm`, `icon`, `icon-xs`, `icon-sm` verbatim. Do NOT alter variant, defaultVariants, or the `Button` function body.

    2. Add this exact JSDoc block immediately above the `const buttonVariants = cva(` line:
       ```tsx
       /**
        * Button size scale (CTRL-03):
        *
        * - `default` (h-8) — standard form-control size; use everywhere by default.
        * - `xs` (h-6) / `icon-xs` (size-6) — reserved for dense/inline surfaces
        *   (e.g. table row actions, sub-toolbars).
        * - `sm` (h-7) / `icon-sm` (size-7) — reserved for dense/inline surfaces.
        * - `icon` (size-8) — icon-only variant of `default`.
        *
        * `h-9`/`h-10`/`h-11` variants were removed in Phase 55 (v1.19). Do NOT
        * add a `hero`/`xl`/`lg` size without a documented design need.
        */
       ```

    Research confirmed ZERO call sites use `size="lg"` or `size="icon-lg"` — this is a pure deletion. Do NOT grep-and-edit any consumer file in this task (that's Wave 2's concern, and here it's a no-op).
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit --project tsconfig.app.json 2>&1 | grep -E "src/components/ui/button\.tsx"; test $? -ne 0</automated>
  </verify>
  <acceptance_criteria>
    - `rg "lg: \"h-9" frontend/src/components/ui/button.tsx` returns 0 matches.
    - `rg "\"icon-lg\": \"size-9\"" frontend/src/components/ui/button.tsx` returns 0 matches.
    - `rg "Button size scale \(CTRL-03\)" frontend/src/components/ui/button.tsx` returns 1 match.
    - `rg "size=[\"'](lg|icon-lg)[\"']" frontend/src` returns 0 matches (sanity check that deletion is safe).
    - `cd frontend && npx tsc --noEmit src/components/ui/button.tsx` emits no errors for that file.
  </acceptance_criteria>
  <done>Button variants contain exactly: default, xs, sm, icon, icon-xs, icon-sm. JSDoc present. No TS errors introduced.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Ship Textarea primitive + unit tests</name>
  <files>frontend/src/components/ui/textarea.tsx, frontend/src/components/ui/textarea.test.tsx</files>
  <read_first>
    - frontend/src/components/ui/input.tsx (SSOT for class chain — copy verbatim)
    - frontend/src/components/ui/toggle.test.tsx (existing test pattern with jsdom env)
    - .planning/phases/55-consolidated-form-controls/55-RESEARCH.md (§Pattern 4 Textarea)
    - .planning/phases/55-consolidated-form-controls/55-UI-SPEC.md (§Interaction State Matrix)
    - frontend/vitest.config.ts
  </read_first>
  <behavior>
    - Test 1: renders a <textarea> with data-slot="textarea" when no props passed
    - Test 2: default rows=3 when rows not specified; respects explicit rows prop
    - Test 3: disabled prop sets disabled attribute and the element gets disabled:opacity-50 class fragment
    - Test 4: aria-invalid="true" causes aria-invalid:border-destructive class to be present in className
    - Test 5: className prop merges with base classes (tailwind-merge via cn) and caller override wins
  </behavior>
  <action>
    Create `frontend/src/components/ui/textarea.tsx` with this exact shape (per D-06 and RESEARCH §Pattern 4):

    ```tsx
    import * as React from "react"
    import { cn } from "@/lib/utils"

    function Textarea({ className, rows = 3, ...props }: React.ComponentProps<"textarea">) {
      return (
        <textarea
          data-slot="textarea"
          rows={rows}
          className={cn(
            "flex w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none resize-y min-h-16",
            "placeholder:text-muted-foreground",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
            "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
            "md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
            "dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
            className
          )}
          {...props}
        />
      )
    }

    export { Textarea }
    ```

    Key rules (D-06, D-07, D-08):
    - Plain `<textarea>` element — base-ui@1.3.0 has NO `textarea` subpath (RESEARCH §Environment Availability).
    - NO `error?: string` prop (D-07; caller-driven aria-invalid).
    - NO `h-8` (multi-line; CTRL-03 exempt per UI-SPEC §Spacing Scale).
    - Class chain for focus/disabled/invalid MUST match Input's exact strings (D-08 parity).

    Create `frontend/src/components/ui/textarea.test.tsx` with 5 vitest + @testing-library/react tests per the <behavior> block. Follow `toggle.test.tsx` import/setup pattern (jsdom already configured in vitest.config.ts).

    Test sketch:
    ```tsx
    import { render, screen } from "@testing-library/react"
    import { describe, it, expect } from "vitest"
    import { Textarea } from "./textarea"

    describe("Textarea", () => {
      it("renders with data-slot='textarea'", () => {
        render(<Textarea aria-label="notes" />)
        expect(screen.getByLabelText("notes")).toHaveAttribute("data-slot", "textarea")
      })
      it("defaults to rows=3", () => {
        render(<Textarea aria-label="notes" />)
        expect(screen.getByLabelText("notes")).toHaveAttribute("rows", "3")
      })
      it("respects explicit rows prop", () => {
        render(<Textarea aria-label="notes" rows={7} />)
        expect(screen.getByLabelText("notes")).toHaveAttribute("rows", "7")
      })
      it("applies disabled chain when disabled", () => {
        render(<Textarea aria-label="notes" disabled />)
        const el = screen.getByLabelText("notes")
        expect(el).toBeDisabled()
        expect(el.className).toMatch(/disabled:opacity-50/)
      })
      it("applies invalid chain when aria-invalid", () => {
        render(<Textarea aria-label="notes" aria-invalid />)
        expect(screen.getByLabelText("notes").className).toMatch(/aria-invalid:border-destructive/)
      })
      it("merges caller className last (tailwind-merge)", () => {
        render(<Textarea aria-label="notes" className="min-h-32" />)
        expect(screen.getByLabelText("notes").className).toMatch(/min-h-32/)
      })
    })
    ```
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/components/ui/textarea.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - File `frontend/src/components/ui/textarea.tsx` exists and exports `Textarea`.
    - `rg "data-slot=\"textarea\"" frontend/src/components/ui/textarea.tsx` returns 1 match.
    - `rg "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" frontend/src/components/ui/textarea.tsx` returns 1 match.
    - `rg "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20" frontend/src/components/ui/textarea.tsx` returns 1 match.
    - `rg "min-h-16" frontend/src/components/ui/textarea.tsx` returns 1 match.
    - `rg "resize-y" frontend/src/components/ui/textarea.tsx` returns 1 match.
    - `rg "error\?:\s*string" frontend/src/components/ui/textarea.tsx` returns 0 matches (D-07).
    - `cd frontend && npx vitest run src/components/ui/textarea.test.tsx` — all tests pass.
    - `cd frontend && npx tsc --noEmit src/components/ui/textarea.tsx src/components/ui/textarea.test.tsx` emits no errors.
  </acceptance_criteria>
  <done>Textarea primitive ships with 6 passing tests; class chain byte-identical-fragments to Input; no consumer migrations triggered.</done>
</task>

</tasks>

<verification>
- `cd frontend && npx vitest run src/components/ui/textarea.test.tsx` all pass.
- `rg "size=[\"'](lg|icon-lg)[\"']" frontend/src` → 0 matches.
- `rg "lg: \"h-9" frontend/src/components/ui/button.tsx` → 0 matches.
- `ls frontend/src/components/ui/textarea.tsx frontend/src/components/ui/textarea.test.tsx` → both exist.
- Scoped `npx tsc --noEmit` on touched files emits no new errors (do NOT gate on `npm run build` — pre-existing unrelated TS errors per Phase 54 deferred-items).
</verification>

<success_criteria>
- Button variants no longer expose `lg` or `icon-lg`; JSDoc size-scale block present.
- Textarea primitive + unit tests ship; class chain matches Input SSOT for focus/disabled/invalid (D-08 parity).
- No consumer files modified.
- Plan completes within ~40% context (2 small tasks on 3 files).
</success_criteria>

<output>
After completion, create `.planning/phases/55-consolidated-form-controls/55-01-SUMMARY.md` capturing: files touched, any deviations from UI-SPEC class chain (should be none), Textarea test count, confirmation that `rg` grep invariants #1/#2 from UI-SPEC pass.
</output>
