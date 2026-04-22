---
phase: 56-breadcrumb-header-content-nav-relocation
plan: 03
subsystem: ui
tags: [react, wouter, header, navbar, subheader, breadcrumb, usermenu, toggle]

# Dependency graph
requires:
  - phase: 56-breadcrumb-header-content-nav-relocation
    provides: "Breadcrumb component (Plan 01) + UserMenu component (Plan 02)"
  - phase: 54-toggle-primitive
    provides: "Toggle primitive used for Sales/HR switch in SubHeader"
provides:
  - "Identity-only NavBar — brand + Breadcrumb + ThemeToggle + LanguageToggle + UserMenu"
  - "SubHeader hosting Sales/HR Toggle (left) and AdminOnly-gated Upload link (right) on /sales and /hr"
  - "lastDashboard sessionStorage removed repo-wide (Pitfall 5 invariant)"
affects: [56-04-i18n-parity, 57-section-context, 58-sensors-layout-parity, 59-a11y-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic chrome swap — NavBar strip + SubHeader extension land together so header is coherent at every commit"
    - "Per-route SubHeader slot conditional via isDashboard flag (location === '/sales' || '/hr')"
    - "AdminOnly wrapper preserved around Upload link (D-08)"

key-files:
  created: []
  modified:
    - "frontend/src/components/NavBar.tsx"
    - "frontend/src/components/SubHeader.tsx"

key-decisions:
  - "NavBar reduced from 157 lines to ~30 — dramatic simplification per RESEARCH Pattern 4"
  - "lastDashboard sessionStorage removed entirely (D-10) — UserMenu Documentation link flows via wouter without cross-dashboard persistence"
  - "Sales/HR Toggle placed alongside existing DateRangeFilter in SubHeader left slot (gap-3 side-by-side, planner discretion per CONTEXT)"
  - "Upload link in SubHeader right slot, still wrapped in AdminOnly (D-08 admin-gate preserved)"
  - "Chrome contract unchanged — NavBar h-16 top-0 z-50, SubHeader h-12 top-16 z-40, total pt-28 still correct"

patterns-established:
  - "Top header = identity only (brand, breadcrumb, theme, language, user menu)"
  - "SubHeader = per-route content controls (dashboard toggle, upload, date range, freshness indicators)"

requirements-completed: [HDR-01, HDR-04]

# Metrics
duration: ~10 min
completed: 2026-04-22
---

# Phase 56 Plan 03: NavBar + SubHeader Refactor Summary

**Atomic chrome swap — NavBar stripped to identity-only top header; SubHeader now hosts Sales/HR Toggle and AdminOnly Upload link on /sales and /hr; lastDashboard sessionStorage eliminated.**

## Performance

- **Duration:** ~10 min (split across two executor sessions, bridged by human-verify checkpoint)
- **Started:** 2026-04-21T21:34Z (approx)
- **Completed:** 2026-04-22 (after user approval of Task 3 checkpoint)
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 2

## Accomplishments

- NavBar.tsx reduced from 157 lines to ~30 lines — only brand + Breadcrumb + ThemeToggle + LanguageToggle + UserMenu remain
- All route-specific controls removed from top header: back-to-dashboard button, Sales/HR Toggle, Upload/Docs/Settings/Sign-out icons, lastDashboard effects
- SubHeader.tsx extended to render Sales/HR Toggle (left slot) and AdminOnly-gated Upload link (right slot) on `/sales` and `/hr`
- lastDashboard sessionStorage references removed repo-wide (Pitfall 5 invariant holds)
- Chrome contract preserved: h-16 top-0 z-50 on NavBar, h-12 top-16 z-40 on SubHeader, total pt-28 unchanged
- No `dark:` Tailwind variants introduced; token-driven dark mode preserved

## Task Commits

1. **Task 1: Refactor NavBar.tsx to identity-only top header** — `b1b9612` (refactor)
2. **Task 2: Extend SubHeader.tsx to host Sales/HR Toggle + Upload** — `6c5e003` (feat)
3. **Task 3: Human smoke verify — visual header chrome** — user-approved after 8-step visual verification on http://localhost:5173 (Docker frontend)

## Files Created/Modified

- `frontend/src/components/NavBar.tsx` — Stripped to brand + Breadcrumb + right-cluster (ThemeToggle, LanguageToggle, UserMenu); launcher route (`/`) suppresses Breadcrumb
- `frontend/src/components/SubHeader.tsx` — Added per-route `isDashboard` branch hosting Toggle (Sales/HR) and AdminOnly Upload link on `/sales` and `/hr`; existing DateRangeFilter and freshness indicators preserved

## Decisions Made

- **Toggle placement in SubHeader left slot:** Side-by-side with DateRangeFilter using `flex items-center gap-3` (planner discretion per CONTEXT).
- **Upload link stays admin-gated:** `<AdminOnly>` wrapper preserved around the Upload `<Link>` per D-08; visibility behavior unchanged for viewer roles.
- **lastDashboard removal is final:** No fallback path; UserMenu's Documentation/Settings links navigate via wouter and rely on the breadcrumb/route for context (D-10, Pitfall 5).
- **Chrome contract untouched:** h-16/top-0/z-50 (NavBar) + h-12/top-16/z-40 (SubHeader) = 112px total, matching AppShell's pt-28.

## Deviations from Plan

None — plan executed exactly as written. Both Task 1 and Task 2 passed their acceptance greps on the first attempt; Task 3 checkpoint approved by the user.

## Issues Encountered

- **CORS mismatch during checkpoint verification (non-code):** The dev server launched for the checkpoint ran on port 5174, which is not in Directus's allowed origins list (only 5173 is). The user verified against the Docker frontend at http://localhost:5173 instead (same source via volume mount) and the checkpoint passed. No code change required — 5173 remains the canonical verification target for this project.

## User Setup Required

None — no external service configuration needed.

## Next Phase Readiness

- Plan 56-04 (i18n parity) is unblocked: it can now add the 8 new keys (`nav.dashboardToggleLabel`, UserMenu copy, breadcrumb labels) and remove the 3 obsolete keys (`nav.back`, `back_to_sales`, `back_to_hr`) that this plan dereferenced.
- Phase 58 (Sensors Layout Parity) can now follow the SubHeader pattern established here: per-route conditional in left/right slots, no top-header controls.
- Phase 59 (A11y & Parity Sweep) will audit focus rings and accessible names on both NavBar and SubHeader surfaces.

## Self-Check: PASSED

- `frontend/src/components/NavBar.tsx` — FOUND
- `frontend/src/components/SubHeader.tsx` — FOUND
- Commit `b1b9612` — FOUND
- Commit `6c5e003` — FOUND

---
*Phase: 56-breadcrumb-header-content-nav-relocation*
*Plan: 03-navbar-subheader-refactor*
*Completed: 2026-04-22*
