---
phase: 56-breadcrumb-header-content-nav-relocation
plan: 01
subsystem: frontend-chrome
tags: [breadcrumb, a11y, i18n-ready, wave-1, pure-frontend]
requires:
  - wouter@3.9.0 (Link, useLocation)
  - react-i18next (useTranslation)
  - lucide-react (ChevronRight)
provides:
  - "matchBreadcrumb(pathname) pure matcher"
  - "BREADCRUMB_ROUTES static route→label-key table"
  - "Breadcrumb component (landmark + ordered list + aria-current)"
affects:
  - "Plan 03 NavBar refactor will import Breadcrumb"
  - "Plan 04 i18n parity will add nav.home, breadcrumb.aria_label, breadcrumb.signage.pair"
tech-stack:
  added: []
  patterns:
    - "static route→label-key map with deeper-before-shallower ordering (Pitfall 2)"
    - "dynamic-segment collapse to parent leaf (D-02)"
    - "aria-current='page' on leaf crumb via <span>, not a self-link (D-06)"
key-files:
  created:
    - frontend/src/lib/breadcrumbs.ts
    - frontend/src/lib/breadcrumbs.test.ts
    - frontend/src/components/Breadcrumb.tsx
    - frontend/src/components/Breadcrumb.test.tsx
  modified: []
decisions:
  - "Matcher uses strict segment-count equality — /settings/sensors cannot collide with /settings even if helper changes (Pitfall 2)"
  - "Home crumb prepended at render time (not baked into every map entry) — simpler, enforces D-04 invariantly"
  - "Leaf href preserved in data model but renderer ignores it and uses <span aria-current=page> (D-06)"
metrics:
  duration_s: 130
  completed: "2026-04-21"
  tasks: 2
  files: 4
  tests_added: 34
requirements: [HDR-02, HDR-03]
---

# Phase 56 Plan 01: Breadcrumb Component Summary

Added a static route→label-key map + pure matcher in `lib/breadcrumbs.ts`,
and a `Breadcrumb` component that renders `<nav><ol>` trails for the
current route using wouter `<Link>` + lucide `ChevronRight` + `aria-current="page"` on the leaf — closing HDR-02 (route-derived
breadcrumb) and HDR-03 (keyboard-navigable, i18n-ready) for Wave 1.

## What Was Built

- `frontend/src/lib/breadcrumbs.ts` — `BreadcrumbEntry` type, `BREADCRUMB_ROUTES` ordered readonly array (14 patterns covering every authenticated route in `App.tsx`), `matchBreadcrumb(pathname)` returning `null` for `/`, `/login`, unknown routes, else the matching pattern's trail.
- `frontend/src/lib/breadcrumbs.test.ts` — 20 vitest unit tests covering every documented behavior plus 3 order-invariant tests locking `/settings/sensors` before `/settings`, `/signage/playlists/:id` before `/signage/playlists`, and `/docs/:section/:slug` before `/docs`.
- `frontend/src/components/Breadcrumb.tsx` — ~50-line component wired through `useLocation` + `useTranslation` + `matchBreadcrumb`. Prepends `nav.home` Home crumb, renders ChevronRight separator between crumbs, non-leaf crumbs as wouter `<Link>` with `focus-visible:ring-2 focus-visible:ring-ring`, leaf as `<span aria-current="page">`.
- `frontend/src/components/Breadcrumb.test.tsx` — 14 render + a11y tests using `wouter/memory-location` for route-scoped renders. Asserts structural DOM shape (nav/ol/li counts, tagName, aria-current, href), not resolved copy for keys added in Plan 04 (nav.home, breadcrumb.aria_label).

## Verification Results

- `cd frontend && npx vitest run src/lib/breadcrumbs.test.ts src/components/Breadcrumb.test.tsx` → **34/34 PASS**
- `cd frontend && npx tsc --noEmit -p tsconfig.app.json` grepped for our 4 files → **CLEAN**
- `grep -n "dark:" frontend/src/components/Breadcrumb.tsx frontend/src/lib/breadcrumbs.ts` → **zero matches** (dark-mode invariant, CTRL-04 focus-ring token invariant)
- `rg -n 'export const BREADCRUMB_ROUTES' frontend/src/lib/breadcrumbs.ts` → 1 match
- `rg -n 'export function Breadcrumb' frontend/src/components/Breadcrumb.tsx` → 1 match
- `rg -n 'export function matchBreadcrumb' frontend/src/lib/breadcrumbs.ts` → 1 match

## Deviations from Plan

None — plan executed exactly as written. App.tsx route verification (CRITICAL note in Task 1) confirmed all plan patterns match App.tsx authenticated routes; no add/remove needed.

## Known Stubs

The Breadcrumb component references three i18n keys that do **not yet exist** in `frontend/src/locales/{de,en}.json` — they are scheduled for Plan 04:

- `nav.home` — falls back to rendering the literal string `nav.home`
- `breadcrumb.aria_label` — aria-label on the landmark; falls back to literal
- `breadcrumb.signage.pair` — only hit on `/signage/pair`; falls back to literal

This is **intentional and documented in the plan** (see `<interfaces>` note in PLAN.md). The component tests assert only on DOM structure / href / tagName / aria-current — never on resolved copy for these three keys — so they pass today. Plan 04 will land all three keys in both locales and close the DE/EN parity gate.

No stubs prevent the plan's goal (provide breadcrumb infrastructure for Plan 03 NavBar consumer). The artifact is complete and self-contained.

## Hand-off to Downstream Plans

- **Plan 03 (NavBar refactor):** import `Breadcrumb` from `@/components/Breadcrumb`, render it between brand slot and right-side user-menu slot. Suppress on launcher (`/`) via `!isLauncher` check in AppShell — Breadcrumb also returns `null` internally so double-suppression is safe.
- **Plan 04 (i18n parity):** must add `nav.home`, `breadcrumb.aria_label`, `breadcrumb.signage.pair` to both `en.json` and `de.json`; also remove obsolete `nav.back`, `nav.back_to_sales`, `nav.back_to_hr` keys once Plan 03 lands.

## Self-Check: PASSED

- [x] `frontend/src/lib/breadcrumbs.ts` FOUND
- [x] `frontend/src/lib/breadcrumbs.test.ts` FOUND
- [x] `frontend/src/components/Breadcrumb.tsx` FOUND
- [x] `frontend/src/components/Breadcrumb.test.tsx` FOUND
- [x] Commit `a0022ed` (feat 56-01 breadcrumb route map + matcher) FOUND
- [x] Commit `1f50511` (feat 56-01 Breadcrumb component) FOUND
