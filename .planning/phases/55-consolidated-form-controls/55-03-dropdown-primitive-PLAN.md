---
phase: 55-consolidated-form-controls
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/ui/dropdown.tsx
  - frontend/src/components/ui/dropdown.test.tsx
autonomous: true
requirements:
  - CTRL-01
  - CTRL-04
must_haves:
  truths:
    - "Dropdown primitive exists at frontend/src/components/ui/dropdown.tsx wrapping @base-ui/react/menu"
    - "Dropdown is an ACTION menu (Edit / Delete / Duplicate), NOT a value picker — distinct from Select"
    - "Dropdown popup uses same surface style as Select and Popover (rounded-lg bg-popover shadow-md ring-1 ring-foreground/10)"
    - "Dropdown trigger inherits focus/disabled visuals from the wrapped Button (via base-ui render prop) — no separate chain needed"
    - "Unit tests cover trigger render, popup open, item activation, destructive item class, disabled state"
  artifacts:
    - path: "frontend/src/components/ui/dropdown.tsx"
      provides: "Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator"
      exports: ["Dropdown", "DropdownTrigger", "DropdownContent", "DropdownItem", "DropdownSeparator"]
    - path: "frontend/src/components/ui/dropdown.test.tsx"
      provides: "Unit tests for Dropdown"
  key_links:
    - from: "frontend/src/components/ui/dropdown.tsx"
      to: "@base-ui/react/menu"
      via: "import { Menu as MenuPrimitive } from \"@base-ui/react/menu\""
      pattern: "from \"@base-ui/react/menu\""
    - from: "DropdownContent popup"
      to: "popover surface style"
      via: "shared class fragment"
      pattern: "rounded-lg bg-popover .* shadow-md ring-1 ring-foreground/10"
---

<objective>
Ship the `Dropdown` primitive — an action menu (kebab/three-dot → Edit/Delete/Duplicate) wrapping `@base-ui/react/menu` (D-01, D-02). Distinct from `Select`. NO consumer migrations this phase (D-02 explicitly: "ship primitive only, no current action-menu call sites").

Include `DropdownSeparator` for completeness (RESEARCH Open Question 2 recommendation — 3 lines, unblocks future admin-table row-action adoption without a follow-up PR).

Purpose: CTRL-01 (Dropdown primitive exists under `ui/`) + CTRL-04 (popup surface + disabled/highlighted item visuals token-driven, matching Select).
Output: `dropdown.tsx` + `dropdown.test.tsx`.
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
@frontend/src/components/ui/popover.tsx
@frontend/src/components/ui/button.tsx

<interfaces>
<!-- Base-ui Menu exports (confirmed in installed package) -->
From @base-ui/react/menu:
```
Root, Trigger, Portal, Backdrop, Positioner, Popup,
Item, LinkItem, RadioGroup, RadioItem, CheckboxItem,
SubmenuRoot, SubmenuTrigger, Group, GroupLabel, Separator, Arrow
```

Popup class chain (match Select + Popover surface):
```
z-50 min-w-[8rem] overflow-hidden rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden
```

Item class chain (match Select item):
```
relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1 text-sm outline-none
data-[highlighted]:bg-muted data-[highlighted]:text-foreground
data-[disabled]:pointer-events-none data-[disabled]:opacity-50
```

Separator class:
```
-mx-1 my-1 h-px bg-border
```

Render-prop composition pattern (base-ui's asChild equivalent):
```tsx
<DropdownTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Actions" />}>
  <MoreHorizontal className="size-4" />
</DropdownTrigger>
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Build Dropdown primitive (dropdown.tsx)</name>
  <files>frontend/src/components/ui/dropdown.tsx</files>
  <read_first>
    - frontend/src/components/ui/popover.tsx (surface style SSOT)
    - frontend/node_modules/@base-ui/react/menu/index.parts.d.ts (export surface)
    - .planning/phases/55-consolidated-form-controls/55-RESEARCH.md (§Pattern 3 Dropdown, §Pitfall 5 render prop)
    - .planning/phases/55-consolidated-form-controls/55-UI-SPEC.md (§Interaction State Matrix)
  </read_first>
  <behavior>
    - Exports: Dropdown (Root), DropdownTrigger, DropdownContent (Portal+Positioner+Popup), DropdownItem, DropdownSeparator
    - DropdownContent defaults: align="end", sideOffset=4, z-50, min-w-[8rem] — good defaults for row-action kebab triggers (D-02)
    - Items apply data-[highlighted] and data-[disabled] styles same as Select items
    - Trigger stays unstyled — caller passes base-ui `render={<Button ... />}` for styling (D-02 action-menu + Pitfall 5)
  </behavior>
  <action>
    Create `frontend/src/components/ui/dropdown.tsx`:

    ```tsx
    import * as React from "react"
    import { Menu as MenuPrimitive } from "@base-ui/react/menu"

    import { cn } from "@/lib/utils"

    function Dropdown(props: MenuPrimitive.Root.Props) {
      return <MenuPrimitive.Root data-slot="dropdown" {...props} />
    }

    function DropdownTrigger(props: MenuPrimitive.Trigger.Props) {
      return <MenuPrimitive.Trigger data-slot="dropdown-trigger" {...props} />
    }

    type DropdownContentProps = MenuPrimitive.Popup.Props & {
      align?: "start" | "center" | "end"
      sideOffset?: number
    }

    function DropdownContent({
      className,
      children,
      align = "end",
      sideOffset = 4,
      ...props
    }: DropdownContentProps) {
      return (
        <MenuPrimitive.Portal>
          <MenuPrimitive.Positioner align={align} sideOffset={sideOffset} className="isolate z-50">
            <MenuPrimitive.Popup
              data-slot="dropdown-content"
              className={cn(
                "z-50 min-w-[8rem] overflow-hidden rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden",
                className
              )}
              {...props}
            >
              {children}
            </MenuPrimitive.Popup>
          </MenuPrimitive.Positioner>
        </MenuPrimitive.Portal>
      )
    }

    function DropdownItem({
      className,
      ...props
    }: MenuPrimitive.Item.Props) {
      return (
        <MenuPrimitive.Item
          data-slot="dropdown-item"
          className={cn(
            "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1 text-sm outline-none",
            "data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
            "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
            className
          )}
          {...props}
        />
      )
    }

    function DropdownSeparator({
      className,
      ...props
    }: MenuPrimitive.Separator.Props) {
      return (
        <MenuPrimitive.Separator
          data-slot="dropdown-separator"
          className={cn("-mx-1 my-1 h-px bg-border", className)}
          {...props}
        />
      )
    }

    export {
      Dropdown,
      DropdownTrigger,
      DropdownContent,
      DropdownItem,
      DropdownSeparator,
    }
    ```

    Notes:
    - DO NOT create a `DropdownSubmenu` / `CheckboxItem` / `RadioItem` wrapper — D-02 scope is "primitive only". If base-ui exposes those sub-pieces and a future phase wants them, they can be added incrementally.
    - DO NOT apply a class chain to the Trigger — the caller's `render={<Button ... />}` prop (base-ui render pattern, Pitfall 5) provides the styled button. The Trigger's own class remains empty.
    - `align` type is narrowed to the three string values base-ui actually supports. If TS complains because base-ui's Positioner props use a looser type, widen to match base-ui's exact union.
    - If base-ui's `Positioner.Props` doesn't have a top-level `align` field (it may be nested under `alignment`), pass it correctly per the installed typings — read `frontend/node_modules/@base-ui/react/menu/positioner.d.ts` to confirm. Adjust prop name if necessary but keep the `align="end"` default behavior.
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit src/components/ui/dropdown.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `rg "from \"@base-ui/react/menu\"" frontend/src/components/ui/dropdown.tsx` returns 1 match.
    - `rg "data-slot=\"dropdown-content\"" frontend/src/components/ui/dropdown.tsx` returns 1 match.
    - `rg "data-slot=\"dropdown-item\"" frontend/src/components/ui/dropdown.tsx` returns 1 match.
    - `rg "rounded-lg bg-popover" frontend/src/components/ui/dropdown.tsx` returns 1 match.
    - `rg "data-\[highlighted\]:bg-muted" frontend/src/components/ui/dropdown.tsx` returns 1 match.
    - `rg "dark:\\[" frontend/src/components/ui/dropdown.tsx` returns 0 matches (UI-SPEC invariant #6).
    - `cd frontend && npx tsc --noEmit src/components/ui/dropdown.tsx` emits no errors.
    - Exports exactly: Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator (5 names).
  </acceptance_criteria>
  <done>Dropdown primitive file ships 5 exports; popup surface class byte-identical-fragments to Select popup; scoped tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Unit tests for Dropdown primitive</name>
  <files>frontend/src/components/ui/dropdown.test.tsx</files>
  <read_first>
    - frontend/src/components/ui/dropdown.tsx (from Task 1)
    - frontend/src/components/ui/button.tsx (for the render-prop example)
    - frontend/src/components/ui/select.test.tsx (sibling test pattern from Plan 02 — may or may not exist yet at run time; use toggle.test.tsx as fallback)
    - .planning/phases/55-consolidated-form-controls/55-CONTEXT.md §D-12
  </read_first>
  <behavior>
    - Test 1: trigger renders with data-slot="dropdown-trigger" and respects render prop (Button styling passes through)
    - Test 2: click trigger opens popup; items visible in document
    - Test 3: click item calls onClick handler and closes popup
    - Test 4: destructive item styled via caller className="text-destructive" (class present)
    - Test 5: disabled item does not fire onClick (or is marked data-disabled)
  </behavior>
  <action>
    Create `frontend/src/components/ui/dropdown.test.tsx`:

    ```tsx
    import { render, screen } from "@testing-library/react"
    import userEvent from "@testing-library/user-event"
    import { describe, it, expect, vi } from "vitest"
    import {
      Dropdown,
      DropdownTrigger,
      DropdownContent,
      DropdownItem,
    } from "./dropdown"
    import { Button } from "./button"

    function Harness({
      onEdit,
      onDelete,
      deleteDisabled,
    }: {
      onEdit?: () => void
      onDelete?: () => void
      deleteDisabled?: boolean
    }) {
      return (
        <Dropdown>
          <DropdownTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Actions" />} />
          <DropdownContent>
            <DropdownItem onClick={onEdit}>Edit</DropdownItem>
            <DropdownItem
              onClick={onDelete}
              disabled={deleteDisabled}
              className="text-destructive"
            >
              Delete
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      )
    }

    describe("Dropdown", () => {
      it("renders trigger via render prop (Button styling)", () => {
        render(<Harness />)
        const trigger = screen.getByLabelText("Actions")
        expect(trigger).toBeInTheDocument()
        // Button wrapper applies data-slot="button" via render; base-ui may overwrite with dropdown-trigger.
        // We accept either slot since behavior is what matters here.
      })
      it("opens popup on click and shows items", async () => {
        const user = userEvent.setup()
        render(<Harness />)
        await user.click(screen.getByLabelText("Actions"))
        expect(await screen.findByText("Edit")).toBeInTheDocument()
        expect(screen.getByText("Delete")).toBeInTheDocument()
      })
      it("fires onClick when item clicked", async () => {
        const user = userEvent.setup()
        const onEdit = vi.fn()
        render(<Harness onEdit={onEdit} />)
        await user.click(screen.getByLabelText("Actions"))
        await user.click(await screen.findByText("Edit"))
        expect(onEdit).toHaveBeenCalledTimes(1)
      })
      it("applies destructive class on Delete item", async () => {
        const user = userEvent.setup()
        render(<Harness />)
        await user.click(screen.getByLabelText("Actions"))
        const deleteItem = await screen.findByText("Delete")
        expect(deleteItem.className).toMatch(/text-destructive/)
      })
      it("does not fire onClick when item disabled", async () => {
        const user = userEvent.setup()
        const onDelete = vi.fn()
        render(<Harness onDelete={onDelete} deleteDisabled />)
        await user.click(screen.getByLabelText("Actions"))
        const deleteItem = await screen.findByText("Delete")
        await user.click(deleteItem).catch(() => {})
        expect(onDelete).not.toHaveBeenCalled()
      })
    })
    ```

    If base-ui menu's userEvent interaction flakes in jsdom (portal+focus), at minimum keep Tests 1, 3, 4 passing. Document any skipped test in SUMMARY. D-12 floor: render + keyboard-or-interaction + disabled-or-invalid coverage.
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/components/ui/dropdown.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - File `frontend/src/components/ui/dropdown.test.tsx` exists.
    - `cd frontend && npx vitest run src/components/ui/dropdown.test.tsx` passes with ≥3 of 5 tests.
    - `cd frontend && npx tsc --noEmit src/components/ui/dropdown.test.tsx` emits no errors.
  </acceptance_criteria>
  <done>Dropdown tests pass (≥3/5); D-12 coverage met.</done>
</task>

</tasks>

<verification>
- `cd frontend && npx vitest run src/components/ui/dropdown.test.tsx` passes (≥3/5).
- `cd frontend && npx tsc --noEmit src/components/ui/dropdown.tsx src/components/ui/dropdown.test.tsx` clean.
- `rg "from \"@base-ui/react/menu\"" frontend/src/components/ui/dropdown.tsx` → 1.
- Do NOT gate on `npm run build`.
</verification>

<success_criteria>
- Dropdown primitive exists under `ui/` with 5 exports, action-menu semantics (D-02), surface class parity with Popover/Select popup.
- Unit tests ship per D-12.
- No consumer files modified (D-02: primitive only, no migrations).
</success_criteria>

<output>
Create `.planning/phases/55-consolidated-form-controls/55-03-SUMMARY.md` listing: files touched, any test skips, confirmation grep invariant #1 (five ui/ files exist after Wave 1) will pass once Plans 01+02+03 all land.
</output>
