# Phase 20: Frontend — Checkbox List UI and i18n - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 20-frontend-checkbox-list-ui-and-i18n
**Areas discussed:** Skill attribute options source, Checkbox list component design, Draft state type migration, Empty state & disabled UX

---

## Skill Attribute Options Source

| Option | Description | Selected |
|--------|-------------|----------|
| Extend personio-options endpoint | Add skill_attributes: string[] to PersonioOptions. Extract from employee raw_json. Small backend change. | ✓ |
| Extract from synced DB data | Query distinct keys from personio_employees.raw_json in DB. Faster but may be stale. | |
| You decide | Claude picks best approach. | |

**User's choice:** Extend personio-options endpoint
**Notes:** None

### Follow-up: Key filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Only keys with values | Filter to keys where at least one employee has non-null, non-empty value. Matches KPI logic. | ✓ |
| All attribute keys | Return every key regardless of value presence. | |
| You decide | Claude picks. | |

**User's choice:** Only keys with values

---

## Checkbox List Component Design

| Option | Description | Selected |
|--------|-------------|----------|
| Bordered scrollable box | max-height bordered container matching input styling, vertical scroll, native checkbox + label rows. ~200px max-height. | ✓ |
| Inline stacked checkboxes | Checkboxes stacked vertically with no container. Simpler, no scroll. | |
| You decide | Claude picks. | |

**User's choice:** Bordered scrollable box

### Follow-up: Checkbox primitive

| Option | Description | Selected |
|--------|-------------|----------|
| shadcn Checkbox | Use existing or add shadcn Checkbox component. Consistent styling, accessible. | ✓ |
| Native HTML checkbox | Simple input type=checkbox with Tailwind. Browser default appearance. | |
| You decide | Claude picks. | |

**User's choice:** shadcn Checkbox

---

## Draft State Type Migration

| Option | Description | Selected |
|--------|-------------|----------|
| JSON.stringify comparison | Compare arrays via JSON.stringify for dirty detection. Simple, correct for sorted primitive arrays. | ✓ |
| Set-based comparison | Convert to Sets and compare membership. Order-independent, more code. | |
| You decide | Claude picks simplest approach. | |

**User's choice:** JSON.stringify comparison

---

## Empty State & Disabled UX

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled container with hint text | Show bordered box with reduced opacity + hint text when disabled. Spinner when loading. "No options" when empty. | ✓ |
| Hide checkbox lists entirely | Don't render until credentials configured. Simpler but user won't know fields exist. | |
| You decide | Claude matches existing pattern. | |

**User's choice:** Disabled container with hint text

---

## Claude's Discretion

- Exact Tailwind styling of scrollable container
- CheckboxList as standalone file or inline
- shadcn Checkbox installation method
- i18n key naming for new labels
- Optional "N selected" summary

## Deferred Ideas

None
