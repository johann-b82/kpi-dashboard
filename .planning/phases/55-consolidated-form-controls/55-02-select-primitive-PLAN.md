---
phase: 55-consolidated-form-controls
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/ui/select.tsx
  - frontend/src/components/ui/select.test.tsx
autonomous: true
requirements:
  - CTRL-01
  - CTRL-04
must_haves:
  truths:
    - "Select primitive exists at frontend/src/components/ui/select.tsx wrapping @base-ui/react/select"
    - "Select trigger renders at h-8 with the Input class chain (focus-visible, disabled, aria-invalid) byte-identical fragments"
    - "Select popup uses the Popover surface style (rounded-lg bg-popover shadow-md ring-1 ring-foreground/10)"
    - "Unit tests cover trigger render, popup open via keyboard, disabled state, aria-invalid styling, item highlight/select"
  artifacts:
    - path: "frontend/src/components/ui/select.tsx"
      provides: "Select, SelectTrigger, SelectContent, SelectItem, SelectValue, SelectGroup, SelectGroupLabel, SelectSeparator"
      exports: ["Select", "SelectTrigger", "SelectContent", "SelectItem", "SelectValue", "SelectGroup", "SelectGroupLabel", "SelectSeparator"]
    - path: "frontend/src/components/ui/select.test.tsx"
      provides: "Unit tests for Select"
  key_links:
    - from: "frontend/src/components/ui/select.tsx"
      to: "@base-ui/react/select"
      via: "import { Select as SelectPrimitive } from \"@base-ui/react/select\""
      pattern: "from \"@base-ui/react/select\""
    - from: "Select trigger"
      to: "shared invalid/focus chain"
      via: "className string copied from input.tsx"
      pattern: "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
---

<objective>
Ship the `Select` primitive — a value-picker wrapper around `@base-ui/react/select` (D-03). Trigger visually matches `Input` so a Select and an Input side-by-side look identical. Popup uses the Popover surface style (D-08 token parity).

Purpose: CTRL-01 (Select primitive exists under `ui/`) + CTRL-04 (focus/disabled/invalid parity with Input via token-driven class chain).
Output: `select.tsx` + `select.test.tsx`. No consumer migrations (Plan 05 owns `<select>` migrations).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/55-consolidated-form-controls/55-CONTEXT.md
@.planning/phases/55-consolidated-form-controls/55-RESEARCH.md
@.planning/phases/55-consolidated-form-controls/55-UI-SPEC.md
@frontend/src/components/ui/input.tsx
@frontend/src/components/ui/popover.tsx

<interfaces>
<!-- Base-ui Select exports (confirmed in installed package) -->
From @base-ui/react/select:
```
Root, Label, Trigger, Value, Icon, Portal, Backdrop, Positioner,
Popup, List, Item, ItemIndicator, ItemText, Arrow,
ScrollUpArrow, ScrollDownArrow, Group, GroupLabel, Separator
```

Trigger class chain (MUST match Input verbatim where possible):
```
flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 py-1 text-base md:text-sm outline-none transition-colors
focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50
aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20
dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40
placeholder:text-muted-foreground
```

Popup class chain (match popover.tsx surface):
```
z-50 min-w-(--anchor-width) rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden
```

Item class chain:
```
relative flex cursor-default select-none items-center rounded-md px-2 py-1 text-sm outline-none
data-[highlighted]:bg-muted data-[highlighted]:text-foreground
data-[disabled]:pointer-events-none data-[disabled]:opacity-50
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Build Select primitive (select.tsx)</name>
  <files>frontend/src/components/ui/select.tsx</files>
  <read_first>
    - frontend/src/components/ui/input.tsx (SSOT for trigger focus/disabled/invalid chain)
    - frontend/src/components/ui/popover.tsx (SSOT for popup surface style)
    - frontend/node_modules/@base-ui/react/select/index.parts.d.ts (export surface)
    - .planning/phases/55-consolidated-form-controls/55-RESEARCH.md (§Pattern 2 Select)
    - .planning/phases/55-consolidated-form-controls/55-UI-SPEC.md (§Interaction State Matrix, §Verification Hooks)
  </read_first>
  <behavior>
    - Exports: Select (Root), SelectTrigger, SelectContent (Popup+Positioner+Portal), SelectItem (with ItemText), SelectValue, SelectGroup, SelectGroupLabel, SelectSeparator
    - Trigger has `data-slot="select-trigger"`, class chain identical to Input for focus/disabled/invalid/dark-mode fragments
    - Trigger renders chevron icon (lucide-react ChevronDown size-4 opacity-50) to the right via <SelectPrimitive.Icon>
    - Content uses Portal > Positioner > Popup > List composition with sideOffset={4} and z-50
    - Items support `data-highlighted` and `data-disabled` styling from base-ui
  </behavior>
  <action>
    Create `frontend/src/components/ui/select.tsx` wrapping `@base-ui/react/select` (D-03). Structure exactly as RESEARCH §Pattern 2, with the following canonical shape:

    ```tsx
    import * as React from "react"
    import { Select as SelectPrimitive } from "@base-ui/react/select"
    import { ChevronDown } from "lucide-react"

    import { cn } from "@/lib/utils"

    function Select(props: SelectPrimitive.Root.Props) {
      return <SelectPrimitive.Root data-slot="select" {...props} />
    }

    function SelectValue(props: SelectPrimitive.Value.Props) {
      return <SelectPrimitive.Value data-slot="select-value" {...props} />
    }

    function SelectTrigger({
      className,
      children,
      ...props
    }: SelectPrimitive.Trigger.Props) {
      return (
        <SelectPrimitive.Trigger
          data-slot="select-trigger"
          className={cn(
            "flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none",
            "placeholder:text-muted-foreground",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
            "md:text-sm dark:bg-input/30",
            "dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
            className
          )}
          {...props}
        >
          {children}
          <SelectPrimitive.Icon className="text-muted-foreground">
            <ChevronDown className="size-4 opacity-50" aria-hidden="true" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
      )
    }

    function SelectContent({
      className,
      children,
      sideOffset = 4,
      ...props
    }: SelectPrimitive.Popup.Props & { sideOffset?: number }) {
      return (
        <SelectPrimitive.Portal>
          <SelectPrimitive.Positioner sideOffset={sideOffset} className="isolate z-50">
            <SelectPrimitive.Popup
              data-slot="select-content"
              className={cn(
                "z-50 min-w-(--anchor-width) overflow-hidden rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden",
                className
              )}
              {...props}
            >
              <SelectPrimitive.List>{children}</SelectPrimitive.List>
            </SelectPrimitive.Popup>
          </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
      )
    }

    function SelectItem({
      className,
      children,
      ...props
    }: SelectPrimitive.Item.Props) {
      return (
        <SelectPrimitive.Item
          data-slot="select-item"
          className={cn(
            "relative flex cursor-default select-none items-center rounded-md px-2 py-1 text-sm outline-none",
            "data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
            "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
            className
          )}
          {...props}
        >
          <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        </SelectPrimitive.Item>
      )
    }

    function SelectGroup(props: SelectPrimitive.Group.Props) {
      return <SelectPrimitive.Group data-slot="select-group" {...props} />
    }

    function SelectGroupLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
      return (
        <SelectPrimitive.GroupLabel
          data-slot="select-group-label"
          className={cn("px-2 py-1 text-xs text-muted-foreground", className)}
          {...props}
        />
      )
    }

    function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
      return (
        <SelectPrimitive.Separator
          data-slot="select-separator"
          className={cn("-mx-1 my-1 h-px bg-border", className)}
          {...props}
        />
      )
    }

    export {
      Select,
      SelectValue,
      SelectTrigger,
      SelectContent,
      SelectItem,
      SelectGroup,
      SelectGroupLabel,
      SelectSeparator,
    }
    ```

    Notes:
    - Do NOT add variant axes via cva this phase — no current call site needs them.
    - Do NOT import Popover or share code with it — copy the popup class string for readability (D-08 allows).
    - Chevron icon uses lucide-react (already a project dep).
    - If base-ui's `SelectPrimitive.Popup.Props` rejects the `sideOffset` addition, move `sideOffset` out of the spread and into the Positioner props directly.
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit src/components/ui/select.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `rg "from \"@base-ui/react/select\"" frontend/src/components/ui/select.tsx` returns 1 match.
    - `rg "data-slot=\"select-trigger\"" frontend/src/components/ui/select.tsx` returns 1 match.
    - `rg "data-slot=\"select-content\"" frontend/src/components/ui/select.tsx` returns 1 match.
    - `rg "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" frontend/src/components/ui/select.tsx` returns 1 match (UI-SPEC invariant #7).
    - `rg "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20" frontend/src/components/ui/select.tsx` returns 1 match (UI-SPEC invariant #8).
    - `rg "\bh-8\b" frontend/src/components/ui/select.tsx` returns ≥1 match on the trigger line.
    - `rg "dark:\\[" frontend/src/components/ui/select.tsx` returns 0 matches (no bracket-literal dark overrides; UI-SPEC invariant #6).
    - `cd frontend && npx tsc --noEmit src/components/ui/select.tsx` emits no errors.
  </acceptance_criteria>
  <done>Select primitive file exports 8 named pieces, trigger class chain matches Input's focus/disabled/invalid fragments, scoped tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Unit tests for Select primitive</name>
  <files>frontend/src/components/ui/select.test.tsx</files>
  <read_first>
    - frontend/src/components/ui/select.tsx (what we're testing — from Task 1)
    - frontend/src/components/ui/toggle.test.tsx (test pattern reference)
    - frontend/vitest.config.ts (jsdom env confirmation)
    - .planning/phases/55-consolidated-form-controls/55-CONTEXT.md §D-12 (test scope)
  </read_first>
  <behavior>
    - Test 1: trigger renders with data-slot="select-trigger" and the provided aria-label
    - Test 2: trigger click opens the popup; items are visible in the document
    - Test 3: disabled prop on Root disables the trigger (disabled attribute present)
    - Test 4: aria-invalid on trigger applies the invalid class chain
    - Test 5: item click (or Enter) selects the value and closes popup; onValueChange called with item value
  </behavior>
  <action>
    Create `frontend/src/components/ui/select.test.tsx` with vitest + @testing-library/react + @testing-library/user-event. Use async userEvent — base-ui Select defers popup mount to Portal, so assertions must wait.

    ```tsx
    import { render, screen } from "@testing-library/react"
    import userEvent from "@testing-library/user-event"
    import { describe, it, expect, vi } from "vitest"
    import {
      Select,
      SelectTrigger,
      SelectValue,
      SelectContent,
      SelectItem,
    } from "./select"

    function Harness({ onValueChange, disabled, invalid }: {
      onValueChange?: (v: string) => void
      disabled?: boolean
      invalid?: boolean
    }) {
      return (
        <Select onValueChange={onValueChange} disabled={disabled}>
          <SelectTrigger aria-label="chart" aria-invalid={invalid || undefined}>
            <SelectValue placeholder="Pick one" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bar">Bar</SelectItem>
            <SelectItem value="area">Area</SelectItem>
          </SelectContent>
        </Select>
      )
    }

    describe("Select", () => {
      it("renders trigger with data-slot='select-trigger'", () => {
        render(<Harness />)
        expect(screen.getByLabelText("chart")).toHaveAttribute("data-slot", "select-trigger")
      })
      it("opens popup on click and shows items", async () => {
        const user = userEvent.setup()
        render(<Harness />)
        await user.click(screen.getByLabelText("chart"))
        expect(await screen.findByText("Bar")).toBeInTheDocument()
        expect(screen.getByText("Area")).toBeInTheDocument()
      })
      it("disables trigger when disabled prop set on Root", () => {
        render(<Harness disabled />)
        expect(screen.getByLabelText("chart")).toBeDisabled()
      })
      it("applies invalid chain when aria-invalid", () => {
        render(<Harness invalid />)
        expect(screen.getByLabelText("chart").className).toMatch(/aria-invalid:border-destructive/)
      })
      it("calls onValueChange when item selected", async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        render(<Harness onValueChange={onChange} />)
        await user.click(screen.getByLabelText("chart"))
        await user.click(await screen.findByText("Area"))
        expect(onChange).toHaveBeenCalledWith("area")
      })
    })
    ```

    If userEvent interaction flakes in jsdom (base-ui Select portal focus mgmt can be finicky), reduce the popup-open test to asserting the trigger's `aria-expanded="true"` after click instead of finding the item. D-12 requires at minimum: render, keyboard-or-click interaction, disabled, invalid — not all five tests are strictly required, but they are highly desirable. Document any skipped test in the plan SUMMARY.
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/components/ui/select.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - File `frontend/src/components/ui/select.test.tsx` exists.
    - `cd frontend && npx vitest run src/components/ui/select.test.tsx` passes with ≥4 of 5 tests (render, disabled, invalid, onValueChange — at minimum). Document any skipped test in SUMMARY.
    - `cd frontend && npx tsc --noEmit src/components/ui/select.test.tsx` emits no errors.
  </acceptance_criteria>
  <done>Select tests pass in vitest; D-12 coverage met (render + keyboard/interaction + disabled + invalid).</done>
</task>

</tasks>

<verification>
- `cd frontend && npx vitest run src/components/ui/select.test.tsx` passes.
- `cd frontend && npx tsc --noEmit src/components/ui/select.tsx src/components/ui/select.test.tsx` clean.
- `rg "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" frontend/src/components/ui/select.tsx` → 1.
- `rg "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20" frontend/src/components/ui/select.tsx` → 1.
- Do NOT gate on `npm run build` (pre-existing unrelated TS errors per Phase 54 deferred-items).
</verification>

<success_criteria>
- Select primitive exists under `ui/` with 8 exported pieces and token-driven class chain parity with Input.
- Unit tests ship per D-12.
- No consumer files modified.
</success_criteria>

<output>
Create `.planning/phases/55-consolidated-form-controls/55-02-SUMMARY.md` listing: files touched, exports surfaced, any test skips, confirmation that grep invariants #7/#8 from UI-SPEC pass for select.tsx.
</output>
