---
phase: 54-toggle-primitive-migrations
plan: 02
subsystem: ui
tags: [react, toggle, navbar, migration, sales-hr, segmented-control-retirement]

requires:
  - phase: 54-toggle-primitive-migrations (54-01)
    provides: Toggle primitive at frontend/src/components/ui/toggle.tsx
provides:
  - First production adoption of Toggle for a 2-option SegmentedControl migration
  - NavBar Sales/HR switch rendered via Toggle
affects: [55, 56, 59]

tech-stack:
  added: []
  patterns:
    - "`segments={[...] as const}` at call sites to satisfy Toggle's readonly 2-tuple type"

key-files:
  created: []
  modified:
    - frontend/src/components/NavBar.tsx

key-decisions:
  - "Drop-in migration: identical prop shape between SegmentedControl and Toggle in the 2-option case; only import + element name change (+ `as const` for tuple inference)."
  - "i18n keys `nav.sales` / `nav.hr` reused verbatim — no new or renamed keys (CONTEXT D-08)."

requirements:
  - id: TOGGLE-04
    status: partially-complete
    note: "Sales/HR portion of TOGGLE-04 closed. Remaining SegmentedControl audit (e.g. sensor window binary cases) covered by other 54-series plans / sweep."

metrics:
  duration: 121s
  tasks_completed: 1
  files_touched: 1
  completed_date: 2026-04-21
---

# Phase 54 Plan 02: NavBar Sales/HR Migration Summary

Migrated the NavBar Sales/HR 2-option switch from `SegmentedControl` to the new `Toggle` primitive. First production adoption of the Toggle primitive established by Plan 54-01, proving drop-in prop-shape parity with SegmentedControl in a real call site.

## What Shipped

- `frontend/src/components/NavBar.tsx` — import swap (`SegmentedControl` → `Toggle`) and JSX element swap (`<SegmentedControl>` → `<Toggle>`); added `as const` on the segments literal so TypeScript can infer Toggle's required readonly 2-tuple.
- `navigate()` behavior, `aria-label="Navigation"`, `className="border-transparent"`, and the `location === "/hr" ? "/hr" : "/sales"` value selector are all preserved unchanged.
- i18n keys `nav.sales` / `nav.hr` unchanged (CONTEXT D-08).
- No other NavBar internals touched (brand, back button, upload/settings/docs/signout buttons, LanguageToggle, ThemeToggle — all intact for their respective plans).

## Tasks

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Swap Sales/HR SegmentedControl for Toggle in NavBar.tsx | `10957f5` | frontend/src/components/NavBar.tsx |

## Acceptance Criteria

- [x] `frontend/src/components/NavBar.tsx` contains exactly one `import { Toggle } from "@/components/ui/toggle";`.
- [x] `frontend/src/components/NavBar.tsx` does NOT contain `from "@/components/ui/segmented-control"`.
- [x] `frontend/src/components/NavBar.tsx` contains exactly one `<Toggle` element.
- [x] `frontend/src/components/NavBar.tsx` does NOT contain the string `<SegmentedControl`.
- [x] `frontend/src/components/NavBar.tsx` still contains `t("nav.sales")` and `t("nav.hr")`.
- [x] `frontend/src/components/NavBar.tsx` still contains `onChange={(path) => navigate(path)}`.
- [x] `cd frontend && npx tsc --noEmit` exits 0 against this plan's changes in isolation (verified after stashing parallel-executor edits on 54-03/04/05).
- [ ] `cd frontend && npm run build` exits 0 — **pre-existing tsc -b errors in unrelated files blocked this**. Reproduced at clean HEAD without any of this plan's edits. Tracked in `.planning/phases/54-toggle-primitive-migrations/deferred-items.md` (shared log with Plan 54-05). Not caused by this plan.

## Deviations from Plan

None. Plan executed exactly as written (the `as const` addition was explicitly called out in the plan's action block).

### Out-of-scope findings (logged to deferred-items.md by Plan 54-05)

The pre-existing `tsc -b` errors in `SalesTable.tsx`, `useSensorDraft.ts`, `defaults.ts`, and `SchedulesPage.test.tsx` block `npm run build` in the working tree. Confirmed out of scope for this plan — reproduced on HEAD with this plan's edits stashed. Already documented by Plan 54-05's run. Not re-logged to avoid duplication.

## Self-Check: PASSED

- FOUND: `frontend/src/components/NavBar.tsx` (modified)
- FOUND: commit `10957f5` (`refactor(54-02): migrate NavBar Sales/HR switch to Toggle primitive`)
- FOUND: import `{ Toggle } from "@/components/ui/toggle"` in NavBar.tsx
- FOUND: `<Toggle` element in NavBar.tsx
- CONFIRMED: no `<SegmentedControl` in NavBar.tsx
- CONFIRMED: no `@/components/ui/segmented-control` import in NavBar.tsx
- CONFIRMED: `t("nav.sales")` and `t("nav.hr")` still present
- CONFIRMED: `onChange={(path) => navigate(path)}` still present
