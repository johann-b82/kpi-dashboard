---
phase: quick-260422-hxt
plan: 01
subsystem: frontend-chrome
tags: [signage, subheader, chrome, ui-consistency]
status: complete
type: quick
completed: 2026-04-22
dependency-graph:
  requires:
    - "SubHeader per-route slotting (Phase 56 P03, Phase 58 P02)"
    - "SegmentedControl primitive (components/ui/segmented-control.tsx)"
  provides:
    - "Signage 4-tab pill hoisted into SubHeader on /signage/* (excl. /signage/pair)"
  affects:
    - "frontend/src/components/SubHeader.tsx"
    - "frontend/src/signage/pages/SignagePage.tsx"
tech-stack:
  added: []
  patterns:
    - "Per-route SubHeader slot gating via wouter location.startsWith() — extends pattern established by Phase 56 P03 (Sales/HR Toggle) and Phase 58 P02 (Sensors)"
key-files:
  created: []
  modified:
    - "frontend/src/components/SubHeader.tsx (+31 lines: import, signageTabs array, signageActive computation, conditional render)"
    - "frontend/src/signage/pages/SignagePage.tsx (-28 lines: removed h1, SegmentedControl block, useLocation, tabs array, unused imports; +3 lines: JSDoc amendment)"
decisions:
  - "Kept signage.admin.page_title locale key — still consumed by breadcrumbs.ts (lines 54, 61, 68, 75, 82, 89) and reused as SubHeader aria-label"
  - "startsWith('/signage/playlists') match keeps pill visible on /signage/playlists/:id editor route while preserving Playlists active-state"
  - "/signage/pair explicitly excluded — pairing screen keeps its standalone layout"
  - "Right-hand SubHeader slot untouched — FreshnessIndicator fall-through preserved for signage routes (out of scope)"
metrics:
  duration: "~15 min"
  tasks: 1
  files: 2
---

# Quick Task 260422-hxt: Remove Digital Signage h1 + Hoist Tabs Pill Summary

**One-liner:** Removed the "Digital Signage" h1 heading from SignagePage and relocated the 4-tab SegmentedControl (Media/Playlists/Devices/Schedules) into SubHeader to match the flatter chrome pattern used by /sales, /hr, and /sensors.

---

## What Shipped

1. **SubHeader.tsx** gained a signage branch:
   - New `signageTabs` const array mapping 4 tab ids → routes → locale keys
   - `signageActive` computation via wouter `location.startsWith()` (catches editor sub-route)
   - `showSignageTabs` gate (all signage admin routes except `/signage/pair`)
   - Conditional `<SegmentedControl>` render in the left-hand slot, next to the Sales/HR Toggle branch
   - `aria-label={t("signage.admin.page_title")}` on the pill

2. **SignagePage.tsx** is now a thin shell:
   - h1 "Digital Signage" removed
   - SegmentedControl block removed
   - `useLocation`, `tabs` array, and unused `SegmentedControl`/`useTranslation` imports dropped
   - JSDoc amended to reflect the 2026-04-22 chrome relocation
   - Outer wrapper container preserved (children rely on its horizontal spacing)
   - `initialTab` prop contract unchanged

3. **Locale files untouched** — `signage.admin.page_title` + `signage.admin.nav.*` keys preserved (consumed by breadcrumbs + as SubHeader segment labels).

## Verification

- `npm run typecheck` — passed
- `npm run check:i18n-parity` — passed
- `npm run check:phase-57` — passed
- `npm run check:phase-59` — passed
- Browser UAT (done by orchestrator, approved):
  - `/signage/media`: h1 removed; 4-tab pill lives in SubHeader strip
  - `/signage/devices`: pill visible, "Geräte" highlighted
  - `/sales`: no pill leakage; existing Toggle + date-range intact

## Deviations from Plan

None — plan executed exactly as written. No architectural changes, no deferred items.

## Commits

- `b0525e0` — refactor(quick): hoist signage tabs to SubHeader and drop h1 (260422-hxt)

## Self-Check: PASSED

- FOUND: frontend/src/components/SubHeader.tsx (modified)
- FOUND: frontend/src/signage/pages/SignagePage.tsx (modified)
- FOUND: commit b0525e0
