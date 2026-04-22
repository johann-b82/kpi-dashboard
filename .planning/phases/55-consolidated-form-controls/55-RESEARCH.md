# Phase 55: Consolidated Form Controls - Research

**Researched:** 2026-04-21
**Domain:** React 19 form-control primitives on @base-ui/react + Tailwind v4
**Confidence:** HIGH

## Summary

Phase 55 lands one canonical set of form-control primitives — `Button`,
`Input`, `Select`, `Textarea`, `Dropdown` — under
`frontend/src/components/ui/`, all standard-size at `h-8`, all driven by
Tailwind v4 tokens (`--primary`, `--destructive`, `--input`, `--ring`).
The phase is a Phase-54-shaped migration: one primitive-build wave
followed by parallel migration waves grouped by primitive type.

Repo reconnaissance confirms the migration surface described in
`55-CONTEXT.md`: 11 files contain raw `<button>` JSX, 5 contain raw
`<select>`, 6 contain raw `<input>` (mostly `type="file"` exceptions),
0 contain raw `<textarea>`. The `@base-ui/react@1.3.0` package installed
in the repo ships `select`, `menu`, and `field` subpaths but **no
`textarea` subpath** — the Textarea primitive wraps a plain
`<textarea>` element styled with the same Tailwind fragments that drive
`Input`. Button cleanup (D-04/D-05) is friction-free: **zero call sites
currently use `size="lg"` or `size="icon-lg"`**, so removing those
variants from `buttonVariants` is a pure deletion.

**Primary recommendation:** Mirror Phase 54's shape exactly — Wave 1
builds `select.tsx`, `textarea.tsx`, `dropdown.tsx` and strips `lg`/
`icon-lg` from `button.tsx`; Wave 2 runs four parallel migration plans
(one per element type, file-input exceptions inline-annotated).
Verification = scoped `tsc --noEmit` per touched file + `rg` grep
invariants. Do NOT gate on `npm run build` — `tsc -b` fails on
pre-existing unrelated errors documented in Phase 54's deferred-items.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Primitive surface (CTRL-01)**
- **D-01:** Canonical primitives live under `frontend/src/components/ui/`,
  lowercase-kebab, sibling to `toggle.tsx` / `segmented-control.tsx`:
  - `button.tsx` (already exists — cleanup only, see D-04/D-05)
  - `input.tsx` (already exists — unchanged)
  - `select.tsx` (new — `@base-ui/react/select`)
  - `textarea.tsx` (new — mirrors Input's shape + tokens)
  - `dropdown.tsx` (new — `@base-ui/react/menu`, action-menu primitive
    distinct from `Select`)
- **D-02:** `Dropdown` is an **action menu** (kebab / three-dot trigger →
  Edit / Delete / Duplicate items), NOT a form value picker. Ship the
  primitive only this phase — no migrations to it (no current
  action-menu call sites).
- **D-03:** `Select` uses `@base-ui/react/select` (same library family as
  existing `Button`/`Input`). Styled with Tailwind v4 to match `Input`
  (h-8, same border / focus-ring / disabled / invalid tokens). NOT a
  styled native `<select>`.

**Button variants cleanup (CTRL-03)**
- **D-04:** **Remove** `lg: "h-9 …"` and `icon-lg: "size-9"` from
  `buttonVariants`. Audit every call site using `size="lg"` /
  `size="icon-lg"` and migrate to `size="default"` / `size="icon"`.
- **D-05:** **Keep** `xs` (h-6), `sm` (h-7), `icon-xs` (size-6),
  `icon-sm` (size-7). Add JSDoc documenting default = `h-8`, `xs`/`sm`
  reserved for dense/inline surfaces.

**Textarea (CTRL-01)**
- **D-06:** Ship a minimal `ui/textarea.tsx` wrapping
  `@base-ui/react/textarea` (or plain element — planner decides based
  on library check). Mirror Input's class composition: `rounded-lg`,
  `border border-input`, `bg-transparent` / `dark:bg-input/30`,
  token-driven focus / disabled / `aria-invalid` states. Min height ≈
  3 rows, `resize-y`.

**Invalid / error state contract (CTRL-04)**
- **D-07:** **Caller-driven** invalid-state pattern on all primitives:
  - Callers pass `aria-invalid={hasError}`.
  - Primitives style invalid visuals via
    `aria-invalid:border-destructive aria-invalid:ring-3
    aria-invalid:ring-destructive/20` + `dark:` counterparts, driven
    by `--destructive`.
  - NO new `error?: string` prop on primitives this phase.
- **D-08:** Focus, disabled, and invalid visuals must resolve identically
  from tokens across `Button`, `Input`, `Select`, `Textarea`, and
  `Dropdown` trigger. Planner extracts shared class-fragment constants
  if duplication becomes unwieldy; otherwise keep per-file for
  readability. Spot-check: visually diff the four disabled states in
  both themes.

**Migration structure (CTRL-02)**
- **D-09:** Wave shape mirrors Phase 54:
  - **Wave 1 (primitives):** build `select.tsx`, `textarea.tsx`,
    `dropdown.tsx`; clean up `button.tsx`.
  - **Wave 2 (migrations, parallel — grouped by primitive type):**
    (a) raw `<button>` → `Button`
    (b) raw `<select>` → `Select`
    (c) raw `<input>` → `Input` (EXCLUDING file inputs)
    (d) `Button size="lg"` / `"icon-lg"` cleanup (cross-cut after D-04
        lands) — **NOTE: research found ZERO call sites; this sub-wave
        is a no-op and can be collapsed into Wave 1.**
- **D-10:** **File inputs stay native** as CTRL-02 documented
  exceptions. Each call site (`DropZone.tsx`, `LogoUpload.tsx`,
  `MediaUploadDropZone.tsx`, etc.) gets an inline comment:
  ```tsx
  // CTRL-02 exception: native file picker — primitive <Input> does
  // not wrap file-type inputs (browser-native styling retained).
  ```
  `Input` primitive will NOT add a `type="file"` code path this phase.
- **D-11:** Each Wave-2 plan is small (1 primitive type; list concrete
  files modified in frontmatter). Verification grep: no raw
  `<button|select|input|textarea>` opens remain in `frontend/src/`
  except:
  - `ui/` primitives themselves.
  - Annotated file-input exceptions (grep for `CTRL-02 exception`).

**Testing**
- **D-12:** Unit-test the three NEW primitives (`Select`, `Textarea`,
  `Dropdown`) for: render, keyboard interaction, disabled state,
  invalid state styling. Button cleanup: regression-check existing
  Button tests if any; otherwise focused render test for
  `xs`/`sm`/`default` / `icon` variants. Migration plans do NOT
  require per-file tests beyond `tsc --noEmit` + existing test suite
  staying green.

### Claude's Discretion
- Exact Tailwind class composition for `Select`'s trigger + popup + item
  styles (must resolve from tokens; trigger must visually match `Input`).
- Exact `Dropdown` popup positioning defaults (base-ui defaults are
  usually fine; planner may pick `align="end"` for row-action triggers).
- Whether to extract shared class-fragment constants or keep class
  strings per-file.
- `Textarea` default min-height → rows (≈ `min-h-16` / `rows={3}` —
  planner picks).
- Whether base-ui ships a `Textarea` primitive or a plain `<textarea>`
  wrapper is needed. **Research finding: base-ui@1.3.0 has NO
  `textarea` subpath — use plain `<textarea>` element (see
  §Architecture Patterns).**

### Deferred Ideas (OUT OF SCOPE)
- **`FormField` wrapper** — `<FormField label error>` helper. Not this
  phase.
- **`error?: string` prop on primitives** — couples messaging to the
  primitive. Revisit if Phase 59 finds inconsistent error presentation.
- **Combobox / searchable Select** — not needed. Add as separate
  primitive only if a future phase needs long-list/type-ahead.
- **`hero`/`xl` button size (h-10+)** — no current use case.
- **Input `type="file"` variant** — rejected this phase (D-10).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CTRL-01 | Single `Input`/`Select`/`Button`/`Textarea`/`Dropdown` primitive under `frontend/src/components/ui/` | `@base-ui/react@1.3.0` exposes `select`, `menu`, `button`, `input`, `field` subpaths. Existing `button.tsx` + `input.tsx` remain. `select.tsx` wraps `@base-ui/react/select`; `dropdown.tsx` wraps `@base-ui/react/menu`; `textarea.tsx` wraps plain `<textarea>` (no base-ui subpath exists). |
| CTRL-02 | All raw `<input|select|button|textarea>` migrated; file-picker exceptions documented | Repo grep found 11 files with raw `<button>`, 5 with raw `<select>`, 6 with raw `<input>` (3 of which are `type="file"`), 0 with raw `<textarea>`. Concrete file list in §Migration Audit below. |
| CTRL-03 | All standard-size controls at `h-8`; `h-9`/`h-10`/`h-11` removed from default paths | `buttonVariants` has `lg: h-9` + `icon-lg: size-9` to remove (zero call sites). `SalesTable.tsx` + `EmployeeTable.tsx` override `<Input className="pl-9 h-9" />` — strip `h-9` (keep `pl-9` for icon padding). `table.tsx` `<th className="h-10 …">` is not a form control and stays. |
| CTRL-04 | Focus/disabled/invalid visually consistent; token-driven | Current `Button` + `Input` already use the identical class chain: `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40`. New primitives copy this exact fragment. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **React 19.2.x** + **TypeScript** + **Vite 8** + **Tailwind v4** +
  **`@base-ui/react`** (NOT Radix) as the a11y primitive family.
- **No `tailwind.config.js`** — Tailwind v4 is CSS-first config.
- Primitives live under `frontend/src/components/ui/`.
- **GSD Workflow Enforcement:** start work via GSD commands; no direct
  repo edits outside a GSD workflow.

## Standard Stack

### Core (already installed — verified via `frontend/package.json` + `node_modules`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @base-ui/react | 1.3.0 (installed) | a11y primitive family | Same family already driving `Button`, `Input`, `Popover`, `Toggle`'s sister components. Ships `select`, `menu`, `field`, `input`, `button` subpaths — NO `textarea` subpath. |
| class-variance-authority | 0.7.1 | variant management for primitives with size/variant axes | Already used by `Button`. Use for `Select` trigger if variants emerge; skip for `Textarea` / `Dropdown` (no variants). |
| clsx + tailwind-merge (`cn`) | 2.1.1 / 3.5.0 | class composition | Existing `@/lib/utils` helper. |
| tailwindcss | 4.2.2 | utility styling | CSS-first config; tokens defined in CSS (`--primary`, `--destructive`, `--input`, `--ring`, `--radius-lg`, etc.). |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest + @testing-library/react | (already installed) | Unit tests for new primitives | Phase 54 template: `ui/<name>.test.tsx` alongside primitive. `jsdom` env via `vitest.config.ts`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@base-ui/react/select` | Styled native `<select>` | Rejected by D-03 — native cannot style popup consistently across themes / a11y gap. |
| `@base-ui/react/menu` for Dropdown | `@base-ui/react/popover` + buttons inside | Rejected — Menu has proper keyboard semantics (roving-tabindex, Enter/Space/arrow navigation, auto-focus-restoration), Popover is a generic container. |
| `@base-ui/react/field` | Plain wrappers | Considered for D-07 — could wire `Field.Root` + `Field.Error` to get native error-prop contract. **Rejected this phase** per deferred "FormField wrapper" decision; revisit if Phase 59 finds error-messaging inconsistency. |
| `@base-ui/react/textarea` | Plain `<textarea>` | **Not an alternative — doesn't exist.** base-ui 1.3.0 has no `textarea` subpath (confirmed via `ls node_modules/@base-ui/react/`). Plain element is the only option. |

**Installation:** No new packages required. Everything needed ships in
`@base-ui/react@1.3.0` already installed.

**Version verification:** `@base-ui/react@1.3.0` confirmed in
`frontend/package.json` + `node_modules/@base-ui/react/package.json`.
No upgrade required.

## Architecture Patterns

### Recommended Primitive Shape

All five primitives share the same shape:
```
frontend/src/components/ui/
├── button.tsx         # EXISTS — D-04/D-05 cleanup
├── input.tsx          # EXISTS — unchanged
├── select.tsx         # NEW — wraps @base-ui/react/select
├── textarea.tsx       # NEW — wraps plain <textarea>
├── dropdown.tsx       # NEW — wraps @base-ui/react/menu
├── select.test.tsx    # NEW
├── textarea.test.tsx  # NEW
└── dropdown.test.tsx  # NEW
```

### Pattern 1: Shared Tailwind Token Fragments

**The existing `Input` class chain is the SSOT for focus/disabled/invalid:**

```tsx
// From input.tsx — copy these fragments verbatim to new primitives.
// Focus:    focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
// Disabled: disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50
// Invalid:  aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20
//           dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40
// Surface:  border border-input bg-transparent dark:bg-input/30
// Size:     h-8 rounded-lg px-2.5 py-1 text-base md:text-sm
```

Planner may extract these into a single `FORM_CONTROL_BASE` constant in
`frontend/src/components/ui/_shared.ts` if duplication becomes
unwieldy (three near-identical strings in `input.tsx`, `textarea.tsx`,
`select.tsx` trigger). **D-08 allows either choice** — optimise for
readability.

### Pattern 2: Select (action-menu-free value picker)

**Composition (verified via `/Users/johannbechtold/Documents/kpi-dashboard/frontend/node_modules/@base-ui/react/select/index.parts.d.ts`):**

```tsx
// Source: https://base-ui.com/react/components/select (verified 2026-04-21)
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "@/lib/utils"

function Select({ children, ...props }: SelectPrimitive.Root.Props) {
  return <SelectPrimitive.Root data-slot="select" {...props}>{children}</SelectPrimitive.Root>
}

function SelectTrigger({ className, children, ...props }: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        // Match Input's shape so Select + Input look identical inline.
        "flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        "dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        {/* lucide-react ChevronDown */}
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({ className, children, ...props }: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner className="isolate z-50" sideOffset={4}>
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            // Crib from popover.tsx — same token-driven surface.
            "z-50 min-w-(--anchor-width) rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden",
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

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
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

export { Select, SelectTrigger, SelectContent, SelectItem }
// Export also: SelectValue = SelectPrimitive.Value, SelectGroup, SelectGroupLabel, SelectSeparator
```

Base-ui Select primitive exports (confirmed in installed package):
`Root, Label, Trigger, Value, Icon, Portal, Backdrop, Positioner,
Popup, List, Item, ItemIndicator, ItemText, Arrow, ScrollUp/DownArrow,
Group, GroupLabel, Separator`.

### Pattern 3: Dropdown (action menu — kebab/three-dot)

```tsx
// Source: https://base-ui.com/react/components/menu (verified 2026-04-21)
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

function Dropdown({ children, ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown" {...props}>{children}</MenuPrimitive.Root>
}

function DropdownTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  // Usually the caller wraps <Button size="icon" variant="ghost"> around this;
  // render prop passthrough via base-ui's `render` prop, or keep Trigger as-is.
  return <MenuPrimitive.Trigger data-slot="dropdown-trigger" {...props} />
}

function DropdownContent({ className, align = "end", sideOffset = 4, ...props }: ...) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner align={align} sideOffset={sideOffset} className="isolate z-50">
        <MenuPrimitive.Popup
          data-slot="dropdown-content"
          className={cn(
            // Identical surface as Popover + Select popup.
            "z-50 min-w-[8rem] rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden",
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownItem({ className, ...props }: MenuPrimitive.Item.Props) {
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

export { Dropdown, DropdownTrigger, DropdownContent, DropdownItem }
```

`align="end"` default works well for row-action kebab triggers (D-02 /
discretion item).

### Pattern 4: Textarea (plain element — no base-ui subpath)

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

Note: `h-8` is NOT applied to Textarea — it's inherently multi-line.
`min-h-16` ≈ 3 rows at default line-height; caller can override with
`className` or `rows`. Height-token alignment is NOT a success
criterion for Textarea (CTRL-03 is about standard-size controls).

### Pattern 5: Button Cleanup (D-04 / D-05)

Remove from `buttonVariants.size`:
```diff
-lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
-"icon-lg": "size-9",
```

Add JSDoc above `buttonVariants`:
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

### Anti-Patterns to Avoid

- **Styling a native `<select>` element** — CSS cannot reach the popup
  options; a11y + theme parity is impossible. Use `@base-ui/react/select`.
- **Using `Dropdown` (Menu) for form value picking** — wrong a11y
  semantics (menuitem vs option). Use `Select`.
- **Inlining `size="lg"` as an override** — removed this phase; use
  `className="h-*"` (discouraged) or document a new semantic size in
  `buttonVariants`.
- **Adding `type="file"` support to `Input` primitive** — explicitly
  rejected (D-10). Native `<input type="file">` stays native.
- **Passing an `error?: string` prop to primitives** — explicitly
  rejected (D-07). Caller owns error rendering; primitives style
  visuals via `aria-invalid`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Styled select popup | Custom popup + option list + keyboard nav | `@base-ui/react/select` | Roving tabindex, typeahead, portal positioning, viewport flipping — all solved; getting them wrong = a11y regression. |
| Action menu (kebab) | Popover + manual button list | `@base-ui/react/menu` | Menu gives Enter/Space/arrow nav + focus-restoration automatically; Popover doesn't. |
| Focus-ring / invalid-state class strings | Per-component ad-hoc tokens | Copy the existing `Input` class chain verbatim | Token drift is the whole reason CTRL-04 exists. One chain = visual parity by construction. |
| Textarea resize handling | `resize: none` + JS auto-grow | `resize-y` on plain `<textarea>` | Browser-native; auto-grow isn't requested by any current call site. |
| `prefers-reduced-motion` detection | Custom hook in each primitive | Already solved in `toggle.tsx` (`usePrefersReducedMotion`) | Not needed for these primitives — no animation beyond existing base-ui transitions. |

**Key insight:** Every primitive here has an existing wrapper to mirror
(`Button`, `Input`, `Popover`, `Toggle`). Research found *zero* novel
problems — Phase 55 is pattern-application, not primitive engineering.

## Common Pitfalls

### Pitfall 1: Pre-existing TS errors mask regressions
**What goes wrong:** `npm run build` fails on `tsc -b` due to 5
pre-existing files (`SalesTable.tsx`, `useSensorDraft.ts`,
`defaults.ts`, `SchedulesPage.test.tsx`) — documented in Phase 54's
`deferred-items.md`.
**Why it happens:** Accumulated tech debt; not caused by this phase.
**How to avoid:** Verify each migration with **scoped**
`cd frontend && npx tsc --noEmit src/<path>/<file>.tsx` ONLY. Do NOT
gate on `npm run build`.
**Warning signs:** `npm run build` green before Phase 55 starts (it's
not — it's red).

### Pitfall 2: Base-ui Select trigger styling vs. `<button>` default styling
**What goes wrong:** `Select.Trigger` renders a `<button>` under the
hood; forgetting to pass a focus ring or base border = trigger looks
unstyled next to `Input`.
**Why it happens:** `Select.Trigger` is unstyled by design (base-ui
philosophy).
**How to avoid:** Copy the full Input class chain onto the trigger —
verified in §Pattern 2.
**Warning signs:** Focus ring visible on `Input` but missing on
`Select`; invalid state (aria-invalid) shows on Input but not on Select.

### Pitfall 3: `Input className="pl-9 h-9"` call-site overrides
**What goes wrong:** `SalesTable.tsx:68` and `EmployeeTable.tsx:85`
pass `className="pl-9 h-9"` — the `h-9` wins via `tailwind-merge`
and the control ends up at 36px, violating CTRL-03.
**Why it happens:** Search-icon-inside-Input pattern needed left
padding; someone also changed height by habit.
**How to avoid:** In the Wave-2 `<input>` migration plan, also strip
`h-9` from these two files. Keep `pl-9` (it's padding for the Search
icon, unrelated to height).
**Warning signs:** Grep `rg 'h-9' frontend/src --glob '*.tsx'` shows
hits outside `ui/` after Wave-2 completes.

### Pitfall 4: File-input migrations
**What goes wrong:** Migrating `<input type="file">` to `<Input
type="file">` — primitive styling fights browser-native file-picker
chrome.
**Why it happens:** Enthusiastic grep-and-replace sweep.
**How to avoid:** D-10 rule. Annotate each file-input site with
`// CTRL-02 exception:` inline comment. Grep invariant verifies the
exemption list.
**Warning signs:** File upload button loses its "Choose file" native
affordance after migration.

### Pitfall 5: `Menu.Item onClick` vs `Menu.Item render`
**What goes wrong:** Wrapping `Menu.Item` in a `Link` or passing
`onClick` without knowing base-ui's `render` prop convention.
**Why it happens:** base-ui uses a `render` prop (render-as-slot
pattern) rather than `asChild`.
**How to avoid:** For link items, use `Menu.LinkItem` (exported from
`@base-ui/react/menu`). For button items, plain `Menu.Item onClick=`
works. No `asChild` pattern.
**Warning signs:** TS error about missing `render` prop; or clicking
an item doesn't navigate.

### Pitfall 6: `(null!)` in test `useRef` with `--noUncheckedIndexedAccess`
**What goes wrong:** `buttonRefs.current[i]` typed as `HTMLButtonElement
| null | undefined` in strict mode — existing `toggle.tsx` hit this.
**Why it happens:** TS `noUncheckedIndexedAccess` + arrays of nullable
refs.
**How to avoid:** Not really a Phase-55 risk (Select/Menu base-ui own
their own focus management; we don't manage refs manually). Noted in
case the planner adds custom keyboard handling.

## Migration Audit (verified 2026-04-21 via `rg`)

### Raw `<button>` — 11 files (CONTEXT.md estimated ~16 usages)
```
frontend/src/components/NavBar.tsx
frontend/src/components/ui/toggle.tsx                 # ui/ — stays native
frontend/src/components/ui/segmented-control.tsx      # ui/ — stays native
frontend/src/components/settings/sensors/SnmpWalkCard.tsx
frontend/src/signage/components/PlaylistItemList.tsx
frontend/src/signage/components/TagPicker.tsx
frontend/src/signage/components/MediaPickerDialog.tsx
frontend/src/pages/LauncherPage.tsx
frontend/src/components/dashboard/EmployeeTable.tsx
frontend/src/components/dashboard/SalesTable.tsx      # pre-existing TS errors — see Pitfall 1
frontend/src/components/settings/ColorPicker.tsx
```

Note: CONTEXT.md's audit also listed `MediaUploadDropZone.tsx`,
`MediaRegisterUrlDialog.tsx`, `ScheduleEditDialog.tsx`, `LogoUpload.tsx`,
`PersonioCard.tsx`, `DropZone.tsx` — grep does NOT show raw `<button>`
in these (they already use `Button`). Planner should verify each call
site with `rg '<button[\s>]' <file>` before editing.

### Raw `<select>` — 4 files (excluding `.test.tsx`)
```
frontend/src/components/settings/sensors/SnmpWalkCard.tsx
frontend/src/signage/components/ScheduleEditDialog.tsx
frontend/src/signage/components/PlaylistItemList.tsx
frontend/src/components/settings/PersonioCard.tsx
```
`ScheduleEditDialog.test.tsx` keeps raw `<select>` for test
fixtures — not a migration target.

### Raw `<input>` — 6 files
```
frontend/src/signage/components/TagPicker.tsx                    # non-file — MIGRATE
frontend/src/signage/pages/SchedulesPage.tsx                     # verify type — likely MIGRATE
frontend/src/signage/components/MediaUploadDropZone.tsx          # type="file" — CTRL-02 exception
frontend/src/signage/components/MediaRegisterUrlDialog.tsx       # verify type — likely MIGRATE
frontend/src/components/DropZone.tsx                             # type="file" — CTRL-02 exception
frontend/src/components/settings/LogoUpload.tsx                  # type="file" — CTRL-02 exception
```

### Raw `<textarea>` — 0 files
Primitive ships as future-proofing (D-06); no migration targets.

### `Button size="lg"` / `size="icon-lg"` — 0 files
Confirmed: `rg 'size=["\'](lg|icon-lg)["\']' frontend/src` returns no
matches. The D-04/D-05 Wave-2(d) sub-wave is a **no-op** — collapse it
into Wave 1's `button.tsx` cleanup.

### `h-9` overrides on form controls — 2 files
```
frontend/src/components/dashboard/SalesTable.tsx:68   className="pl-9 h-9"  (on <Input>)
frontend/src/components/dashboard/EmployeeTable.tsx:85 className="pl-9 h-9" (on <Input>)
```
Strip `h-9` during Wave-2(c) — keep `pl-9` (icon padding, not height).

## Code Examples

### Using Select in a consumer
```tsx
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

<Label htmlFor="chart-type">Chart</Label>
<Select value={chart} onValueChange={setChart}>
  <SelectTrigger id="chart-type" aria-invalid={hasError}>
    <SelectPrimitive.Value placeholder="Select chart" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="bar">Bar</SelectItem>
    <SelectItem value="area">Area</SelectItem>
  </SelectContent>
</Select>
```

### Using Dropdown as a row-action kebab
```tsx
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from "@/components/ui/dropdown"
import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"

<Dropdown>
  <DropdownTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Actions" />}>
    <MoreHorizontal className="size-4" />
  </DropdownTrigger>
  <DropdownContent>
    <DropdownItem onClick={onEdit}>Edit</DropdownItem>
    <DropdownItem onClick={onDelete} className="text-destructive">Delete</DropdownItem>
  </DropdownContent>
</Dropdown>
```

Note: base-ui's `render` prop replaces Radix's `asChild` — this is how
you compose `Dropdown.Trigger` with `<Button>` for consistent styling.

### Invalid state on any primitive (caller-driven)
```tsx
<Input
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  aria-invalid={!isValidEmail(email) || undefined}
/>
{!isValidEmail(email) && (
  <p className="text-sm text-destructive">{t("errors.invalidEmail")}</p>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Radix UI primitives (`@radix-ui/react-*`) | `@base-ui/react` (Radix team's successor) | 2024-Q3 | Same authors, single-package export map, `render` prop replaces `asChild`. This project adopted `@base-ui/react` directly. |
| `tailwind.config.js` + `@tailwind` directives | Tailwind v4 CSS-first config | 2024-Q4 | Tokens defined in CSS under `:root` + `.dark`; no config file in repo. |
| Separate `Listbox` + `Combobox` primitives | Unified `Select` with optional search | (base-ui native) | For Phase 55, plain `Select` suffices; combobox/autocomplete are separate subpaths if needed later. |

**Deprecated / not used here:**
- `@radix-ui/*` — NOT installed; do not mix with `@base-ui/react`.
- `shadcn/ui` components as-copied-from-shadcn — some examples online
  target Radix; translate to base-ui's `render`-prop pattern manually.

## Open Questions

1. **Should `select.tsx` export `SelectValue` as a renamed re-export of
   `SelectPrimitive.Value`, or require consumers to import it directly?**
   - What we know: existing `popover.tsx` re-exports only the wrappers
     it styles (Trigger, Content, Title, Description); consumers import
     nothing else.
   - What's unclear: `Select.Value` has no styling — pure placeholder
     passthrough. Either pattern works.
   - Recommendation: re-export as `SelectValue` for API symmetry with
     `PopoverTrigger` / `SelectTrigger`. Trivial.

2. **Does `Dropdown` need a `DropdownSeparator` primitive in Phase 55
   even though there are no call sites?**
   - What we know: D-02 says "ship primitive only, no migrations."
   - What's unclear: Separator is a single line (`@base-ui/react/menu`
     re-exports `Separator` from `../separator`). Trivial to include
     for completeness.
   - Recommendation: export `DropdownSeparator` in the primitive so the
     first action-menu consumer (future admin-table row actions)
     doesn't need a follow-up PR. 3 lines of code.

3. **Should the migration for raw `<button>` in `SalesTable.tsx` run
   despite its pre-existing TS errors?**
   - What we know: CONTEXT.md says "read-only; do NOT fix pre-existing
     TS errors here."
   - What's unclear: whether replacing `<button>` with `<Button>` in a
     file with TS errors could compound them.
   - Recommendation: migrate the buttons using `{/* @ts-expect-error
     pre-existing; see deferred-items.md */}` only if necessary;
     otherwise skip `SalesTable.tsx` from the Wave-2(a) sweep and
     document the carve-out in the plan (orphan it for the cleanup
     plan that fixes `SalesRecordRow`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@base-ui/react/select` | `select.tsx` | ✓ | 1.3.0 | — |
| `@base-ui/react/menu` | `dropdown.tsx` | ✓ | 1.3.0 | — |
| `@base-ui/react/textarea` | `textarea.tsx` | ✗ | — | **Use plain `<textarea>`** (no base-ui subpath exists at v1.3.0) |
| `class-variance-authority` | Button / optional Select variants | ✓ | 0.7.1 | — |
| `tailwind-merge` + `clsx` (`cn`) | All primitives | ✓ | 3.5.0 / 2.1.1 | — |
| `vitest` + `@testing-library/react` | Primitive unit tests | ✓ | (configured in `vitest.config.ts` with jsdom env) | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `@base-ui/react/textarea` does
not exist — use plain `<textarea>` (covered in §Pattern 4). This is
not a blocker; D-06 explicitly anticipated it.

## Sources

### Primary (HIGH confidence)
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/node_modules/@base-ui/react/` — directly inspected package exports for `select`, `menu`, `field`, and confirmed no `textarea` subpath.
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/node_modules/@base-ui/react/select/index.parts.d.ts` — full Select export surface.
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/node_modules/@base-ui/react/menu/index.parts.d.ts` — full Menu export surface.
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/components/ui/button.tsx` — canonical variant shape + cleanup targets.
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/components/ui/input.tsx` — canonical class chain (focus/disabled/invalid fragments).
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/components/ui/popover.tsx` — popup surface pattern to reuse.
- `.planning/phases/54-toggle-primitive-migrations/deferred-items.md` — known pre-existing TS errors to ignore.
- `.planning/phases/55-consolidated-form-controls/55-CONTEXT.md` — user decisions D-01..D-12.
- `.planning/REQUIREMENTS.md` §CTRL-01..04 — acceptance criteria.

### Secondary (MEDIUM confidence)
- https://base-ui.com/react/components/select — minimal Select composition example (fetched 2026-04-21).
- https://base-ui.com/react/components/menu — minimal Menu composition example (fetched 2026-04-21).

### Tertiary (LOW confidence)
- None — all findings verified against installed package source or project files.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified in installed `node_modules`.
- Architecture: HIGH — existing `Input` / `Button` / `Popover` give direct templates; base-ui API surface verified from typings.
- Pitfalls: HIGH — migration-audit counts, pre-existing TS errors, and `h-9` overrides all verified via `rg` on the working repo.
- Migration audit: HIGH — exact file lists from `rg` with `<tag[\s>]` pattern.

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable dependencies; re-verify only if `@base-ui/react` major-version bumps)
