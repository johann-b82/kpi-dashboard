---
phase: 25-page-layout-parity
plan: "01"
subsystem: frontend/upload-page
tags: [layout, tailwind, responsive, parity]
dependency_graph:
  requires: []
  provides: [upload-container-parity, upload-two-column-grid]
  affects: [frontend/src/pages/UploadPage.tsx]
tech_stack:
  added: []
  patterns: [dashboard-container-token, responsive-two-column-grid]
key_files:
  created: []
  modified:
    - frontend/src/pages/UploadPage.tsx
decisions:
  - "Pre-existing HrKpiCharts.tsx + SalesTable.tsx build errors confirmed out-of-scope; tsc --noEmit passes cleanly for files in scope"
metrics:
  duration: "1min"
  completed: "2026-04-14"
  tasks_completed: 1
  files_changed: 1
---

# Phase 25 Plan 01: Upload Container and Grid Summary

## One-liner

Swapped UploadPage.tsx outer wrapper to the dashboard container token (`max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8`) and restructured body into a `grid grid-cols-1 lg:grid-cols-2 gap-8` layout with DropZone + UploadHistory side-by-side on `lg` and above.

## What Was Built

**Task 1: Swap outer wrapper to dashboard container and restructure body into two-column grid**

Replaced the `max-w-[800px] mx-auto px-4 py-12` outer wrapper with the canonical dashboard container token. The body was restructured from a stacked list into a responsive two-column grid:

- DropZone sits in the left column, UploadHistory (with its `history_title` heading) in the right column
- ErrorList (conditional) remains a direct child of the wrapper above the `<Separator>` divider — spanning full width
- `<Separator className="my-8" />` preserved between error surface and two-column grid (per CONTEXT.md decision #3)
- Redundant utility classes (`mb-6`, `mb-4`, `mt-4`) removed; spacing handled by `space-y-8` at wrapper level and `space-y-4` inside columns

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 38aa2fa | feat(25-01): swap upload page to dashboard container and two-column body grid |

## Deviations from Plan

### Pre-existing Build Failures (not caused by this plan)

**[Out of Scope] Pre-existing build errors in HrKpiCharts.tsx and SalesTable.tsx**

- **Found during:** Task 1 verification (`npm run build`)
- **Issue:** `HrKpiCharts.tsx` lines 111/112/135/136 and `SalesTable.tsx` lines 31/110-116 have TypeScript type errors that prevent `tsc -b` (full build) from passing
- **Confirmed pre-existing:** Running `npm run build` on the unmodified codebase (before any changes) produces the identical errors — these are not caused by this plan
- **`npx tsc --noEmit` result:** Exit 0 — no errors in modified files
- **Decision:** Per STATE.md: "SalesTable.tsx build errors are pre-existing (out of scope for plan 03) — deferred to future plan". These errors are out of scope for plan 25-01.
- **Deferred to:** Separate future plan; logged in deferred-items

## Known Stubs

None. The UploadPage renders DropZone, ErrorList (conditional), and UploadHistory using their existing implementations — all data wired.

## Self-Check: PASSED

- [x] `frontend/src/pages/UploadPage.tsx` exists and contains the new layout
- [x] Commit 38aa2fa exists in git log
- [x] `max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8` — 1 match in UploadPage.tsx
- [x] `grid grid-cols-1 lg:grid-cols-2 gap-8` — 1 match in UploadPage.tsx
- [x] `max-w-[800px]` — 0 matches in UploadPage.tsx
- [x] `px-4 py-12` — 0 matches in UploadPage.tsx
- [x] `<Separator className="my-8" />` — 1 match (preserved)
- [x] `<ErrorList errors={errors} />` — 1 match (conditional render intact)
- [x] `<UploadHistory />` — 1 match
- [x] `t("page_title")` and `t("history_title")` — 1 match each
- [x] `npx tsc --noEmit` — exit 0
