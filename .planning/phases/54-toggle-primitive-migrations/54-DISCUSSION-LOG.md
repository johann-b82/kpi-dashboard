# Phase 54: Toggle Primitive + Migrations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or
> execution agents. Decisions are captured in CONTEXT.md — this log
> preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 54-toggle-primitive-migrations
**Areas discussed:** Migration scope, Toggle API, ThemeToggle replacement, Animation, Component location, Keyboard semantics, Sales/HR i18n, SegmentedControl deprecation

---

## Migration scope

| Option | Description | Selected |
|--------|-------------|----------|
| NavBar Sales/HR | Replace the existing 2-option SegmentedControl in NavBar with Toggle. Directly listed in TOGGLE-04. | ✓ |
| HrKpiCharts area/bar | 2-option SegmentedControl — binary boolean per TOGGLE-04. | ✓ |
| RevenueChart bar/area | 2-option SegmentedControl (`CHART_TYPES = [bar, area]`) — binary boolean per TOGGLE-04. | ✓ |
| ThemeToggle | Currently a single icon button — replace with 2-option Toggle (sun/moon icons) per TOGGLE-03. | ✓ |

**User's choice:** All four surfaces in scope.
**Notes:** Audit also identified 3+ option surfaces (SensorTimeWindow, DateRangeFilter, EmployeeTable, SignagePage sub-nav) that explicitly stay on `SegmentedControl`.

---

## Toggle API

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror SegmentedControl + icon support | Same `segments`/`value`/`onChange`/`aria-label` shape, optional `icon` per segment. Minimal migration churn. | ✓ |
| New shape: `options` with `{value, label, icon?}` | Fresh API; rename `segments` → `options`. Cleaner but all call sites reshaped. | |
| You decide | Let the planner choose. | |

**User's choice:** Mirror SegmentedControl + icon support.
**Notes:** Keeps migration to a one-line swap at every call site.

---

## ThemeToggle replacement

| Option | Description | Selected |
|--------|-------------|----------|
| Two pill segments: Sun=light, Moon=dark | Indicator slides under active mode. Matches success criterion 3. | ✓ |
| Icon-only pill with text tooltips | Icons visible, text in aria-label/title only. | |
| Keep single-icon click behavior, just restyle | Contradicts TOGGLE-03. | |

**User's choice:** Two pill segments with sun/moon icons.
**Notes:** OS prefers-color-scheme tracking + localStorage logic from the current `ThemeToggle.tsx` must be preserved.

---

## Animation

| Option | Description | Selected |
|--------|-------------|----------|
| CSS transform translateX, ~180ms ease-out | GPU-accelerated, matches existing transition tempo. | ✓ |
| Width/left position transition | Simpler math, less smooth. | |
| You decide | Planner picks. | |

**User's choice:** CSS transform translateX, ~180ms ease-out.
**Notes:** `prefers-reduced-motion: reduce` disables the transition (instant swap).

---

## Component location

| Option | Description | Selected |
|--------|-------------|----------|
| `frontend/src/components/ui/toggle.tsx` | Matches TOGGLE-01 and the lowercase-kebab convention. | ✓ |
| `frontend/src/components/ui/Toggle.tsx` | PascalCase filename — inconsistent with existing primitives. | |

**User's choice:** `frontend/src/components/ui/toggle.tsx`.

---

## Keyboard semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Arrow keys move selection + focus (WAI-ARIA radiogroup default) | Standard pattern; selection changes as focus moves. Enter/Space is idempotent re-activate. | ✓ |
| Arrow keys move focus only; Enter/Space activates | Roving focus; adds a keystroke. | |

**User's choice:** WAI-ARIA radiogroup default.

---

## Sales/HR i18n

| Option | Description | Selected |
|--------|-------------|----------|
| Keep existing keys | `t('nav.sales')` / `t('nav.hr')` unchanged; no new keys needed. | ✓ |
| Introduce new `toggle.*` namespace | Adds DE/EN parity churn outside phase scope. | |

**User's choice:** Keep existing keys.

---

## SegmentedControl deprecation

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as-is — still used for 3+ option cases | Explicit in TOGGLE-04 and Out of Scope. | ✓ |
| Add JSDoc note steering 2-option callers to Toggle | Light guardrail, low cost. | |

**User's choice:** Keep as-is — no deprecation markers.

---

## Claude's Discretion

- Exact Tailwind class composition for pill / indicator / active label
  (tokens only).
- How the indicator's `translateX` offset is computed (measured width
  vs. CSS `:has()` vs. equal-width flex children).
- Whether to add a default `toggle.aria_label` i18n key (callers already
  pass their own).
- Test depth beyond the minimum render + keyboard test for `Toggle`.

## Deferred Ideas

- JSDoc deprecation note on `SegmentedControl`.
- New `toggle.*` i18n namespace.
- Migrating 3+ option SegmentedControl usages (out of scope).
