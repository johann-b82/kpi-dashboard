# Phase 55: Consolidated Form Controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 55-consolidated-form-controls
**Areas discussed:** Dropdown scope + Select impl, Button variants cleanup, Textarea + invalid-state contract, Migration plan shape

---

## Dropdown scope + Select implementation

### Q1: What is 'Dropdown' distinct from 'Select' in your mental model?

| Option | Description | Selected |
|--------|-------------|----------|
| Menu-of-actions (like DropdownMenu) | Dropdown = action menu (kebab/three-dot → Edit/Delete/Duplicate), distinct from Select. Ships both base-ui Menu (Dropdown) and base-ui Select. | ✓ |
| Same thing as Select | Drop 'Dropdown' from primitive list; treat CTRL-01 as Input/Select/Button/Textarea only. | |
| Rich value picker (combobox/searchable) | Dropdown = a combobox/searchable-select for long lists; Select = short list. | |

**User's choice:** Menu-of-actions (like DropdownMenu)
**Notes:** Locks Dropdown as a separate primitive built on `@base-ui/react/menu`.

### Q2: How should Select be implemented?

| Option | Description | Selected |
|--------|-------------|----------|
| base-ui Select (Recommended) | Use `@base-ui/react/select` — consistent with existing Button/Input, a11y-complete, Tailwind-styled to match Input. | ✓ |
| Styled native <select> | Keep native <select> wrapped with Tailwind — simpler but OS-native popup, harder visual parity. | |
| You decide | Planner picks based on library maturity check. | |

**User's choice:** base-ui Select (Recommended)

### Q3: Dropdown (action menu) — scope for this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Ship primitive only (no migrations) | Build Dropdown on base-ui/menu; no current call sites migrate. Closes CTRL-01's five-primitive roster. | ✓ |
| Ship + migrate NavBar user menu / settings gear | Scope grows; primitive proven by real usage. | |
| Audit first, decide in planning | Researcher scans; planner decides. | |

**User's choice:** Ship primitive only (no migrations)

---

## Button variants cleanup

### Q1: Button `lg` variant (h-9) — what to do?

| Option | Description | Selected |
|--------|-------------|----------|
| Remove lg + icon-lg entirely (Recommended) | Delete lg + icon-lg from buttonVariants; migrate call sites to default/icon. | ✓ |
| Keep lg as documented exception | JSDoc comment, audit lg usages, keep h-9 available. | |
| Remove lg, replace with 'hero' exception slot | Kill lg; introduce narrow `hero` (h-10) only for primary CTAs. | |

**User's choice:** Remove lg + icon-lg entirely (Recommended)

### Q2: `xs` (h-6) and `sm` (h-7) variants — keep?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep xs + sm (Recommended) | CTRL-03 allows non-h-8 for documented exceptional surfaces (dense contexts). Default remains h-8. | ✓ |
| Keep only sm; remove xs | Simplify to default + sm. | |
| Remove both, only h-8 | Strictest read; may hurt dense UI. | |

**User's choice:** Keep xs + sm (Recommended)

---

## Textarea + invalid-state contract

### Q1: Textarea primitive — ship this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Ship minimal Textarea (Recommended) | Build `ui/textarea.tsx` mirroring Input. Closes CTRL-01 cleanly. | ✓ |
| Skip Textarea (no current uses) | Amend CTRL-01 to list only Input/Select/Button/Dropdown. | |

**User's choice:** Ship minimal Textarea (Recommended)

### Q2: Invalid/error state contract on primitives?

| Option | Description | Selected |
|--------|-------------|----------|
| Caller-driven aria-invalid (Recommended) | Current pattern: callers pass aria-invalid; primitive styles via aria-invalid:* tokens. Form-library-agnostic. | ✓ |
| Add `error?: string` prop | Primitives auto-set aria-invalid + render inline error. More ergonomic; harder with react-hook-form. | |
| Caller-driven + add FormField wrapper | Keep caller-driven; add `<FormField label error>`. Separates concerns; new surface. | |

**User's choice:** Caller-driven aria-invalid (Recommended)
**Notes:** FormField wrapper captured as deferred idea.

---

## Migration plan shape

### Q1: How should Wave 2 migrations be grouped?

| Option | Description | Selected |
|--------|-------------|----------|
| By primitive type (Recommended) | Wave 2 parallel: (a) <button>→Button, (b) <select>→Select, (c) <input>→Input, (d) lg cleanup. Matches Phase 54 shape. | ✓ |
| By surface/page | Parallel plans per page/folder (signage/, settings/, dashboard/). Fewer plans, larger each. | |
| Single 'migrate everything' plan | One big plan; no parallelism. | |

**User's choice:** By primitive type (Recommended)

### Q2: File inputs — documented native exceptions?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, native <input type=file> + inline comment (Recommended) | Each file-input call site gets `// CTRL-02 exception: native file picker`. Input primitive skips type=file path. | ✓ |
| Build Input file variant + migrate | Extend Input primitive to handle type=file. More work. | |
| You decide | Planner picks. | |

**User's choice:** Yes, native <input type=file> + inline comment (Recommended)

---

## Claude's Discretion

- Exact Tailwind classes for Select trigger / popup / item styling (must match Input visual for trigger).
- Exact Dropdown popup alignment defaults.
- Whether to extract shared class-fragment constants (FOCUS_RING, INVALID) or keep inlined per-file.
- Textarea min-height in rows vs Tailwind token.
- Whether base-ui ships a Textarea wrapper or plain element is used.

## Deferred Ideas

- `FormField` wrapper for label + inline error message.
- `error?: string` prop on primitives.
- Combobox / searchable Select primitive.
- `hero` / `xl` button size (h-10+).
- Input `type="file"` variant.
