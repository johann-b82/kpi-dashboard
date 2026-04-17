---
phase: quick
plan: 260417-dzd
subsystem: frontend-shell
tags: [launcher, navigation, v1.14, quick]
requires: [Phase 37 complete]
provides: ["Launcher-only chrome behavior on /home"]
affects: [NavBar, SubHeader, App shell]
tech-stack:
  added: []
  patterns:
    - "Conditional chrome via isLauncher = location === '/home'"
    - "Component-local early-return (SubHeader) for route-specific suppression"
key-files:
  created: []
  modified:
    - frontend/src/components/NavBar.tsx
    - frontend/src/components/SubHeader.tsx
    - frontend/src/App.tsx
decisions:
  - "Centralize chrome-hiding in each component via isLauncher guard, rather than adding route-matching logic in App.tsx — keeps AppShell simple and each component owns its launcher behavior"
  - "Move SubHeader's early-return below useDateRange() to respect React's rules-of-hooks (constant hook order) when navigating between /home and other routes without unmounting"
metrics:
  duration: 75s
  tasks_completed: 2
  files_modified: 3
  completed: 2026-04-17
requirements: [QUICK-260417-dzd]
---

# Quick Task 260417-dzd: Hide Header Elements on /home Launcher Summary

**One-liner:** Conditional chrome suppression on `/home` — NavBar strips to brand + theme/language/sign-out; SubHeader returns null; main padding collapses from `pt-28` to `pt-16`.

## What Was Built

The App Launcher (`/home`) now renders as a clean, standalone surface without dashboard chrome:

1. **NavBar (`frontend/src/components/NavBar.tsx`):**
   - Added `const isLauncher = location === "/home";` after `useLocation()`
   - Wrapped the center-slot ternary (back-button vs SegmentedControl) in `{!isLauncher && (...)}`
   - Wrapped the three right-side Links (docs, upload via AdminOnly, settings) in a single `{!isLauncher && (<>...</>)}` fragment
   - Brand slot, ThemeToggle, LanguageToggle, and sign-out button remain unconditional

2. **SubHeader (`frontend/src/components/SubHeader.tsx`):**
   - Added early `return null` for `/home`
   - Placement is AFTER `useDateRange()` (see Deviations below) to comply with React rules-of-hooks

3. **App.tsx (`frontend/src/App.tsx`):**
   - Added `const isLauncher = location === "/home";` next to `isLogin`
   - Expanded main element className to three-way: `isLogin ? "" : isLauncher ? "pt-16" : "pt-28"`
   - `<NavBar /> <SubHeader />` render block unchanged — components self-manage launcher behavior

## Verification

- `cd frontend && npx tsc --noEmit` → exits 0 (clean)
- Visual verification pending (see instructions below)

### Human Verification Steps (http://localhost:5173/home — HMR, no restart)

1. Open http://localhost:5173/home — log in if prompted
2. NavBar should show: brand (left) + ThemeToggle, LanguageToggle, sign-out button (right). **No** SALES/HR toggle. **No** docs/library icon. **No** upload icon. **No** settings gear.
3. No 48px empty strip under the NavBar — launcher heading should appear immediately under the 64px NavBar
4. Tile grid (KPI Dashboard active tile + 3 coming-soon) sits cleanly without the extra sub-header gap
5. Click the KPI Dashboard tile → navigates to `/`. On `/`, confirm full chrome returns: SALES/HR SegmentedControl, docs/upload/settings icons, SubHeader with date-range filter + freshness indicator at top-16
6. Navigate back to `/home` (browser back or address bar) — stripped-down header returns
7. Visit `/hr`, `/upload`, `/settings`, `/docs` and confirm each shows full NavBar + SubHeader (no regressions)
8. Sign-out from `/home` still works

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SubHeader early-return placement violated React rules-of-hooks**

- **Found during:** Task 2 (SubHeader edit)
- **Issue:** The plan instructed to insert `if (location === "/home") return null;` BEFORE the `useDateRange()` hook call. Since `<SubHeader />` is always mounted (App.tsx renders it whenever `!isLogin`), navigating between `/home` and other routes would cause the component to conditionally skip a hook — React would throw "Rendered fewer hooks than during the previous render" at runtime.
- **Fix:** Moved the `if (location === "/home") return null;` below `useDateRange()`. All hooks run unconditionally; the guard only suppresses the rendered JSX. Added a short comment explaining why.
- **Files modified:** `frontend/src/components/SubHeader.tsx`
- **Commit:** f5e58e1

No other deviations.

## Commits

| Task | Description | Commit | Files |
| ---- | ----------- | ------ | ----- |
| 1 | Hide NavBar center + nav links on /home | d0afee0 | frontend/src/components/NavBar.tsx |
| 2 | SubHeader null on /home, main pads pt-16 | f5e58e1 | frontend/src/components/SubHeader.tsx, frontend/src/App.tsx |

## Success Criteria

- [x] On `/home`: NavBar = brand + ThemeToggle + LanguageToggle + sign-out only; SubHeader not rendered; main at pt-16
- [x] On non-/home, non-login routes: unchanged (SegmentedControl or back button; docs/upload/settings links; SubHeader rendered; main at pt-28)
- [x] On `/login`: unchanged (no NavBar, no SubHeader, no main padding)
- [x] `npx tsc --noEmit` in frontend/ exits 0
- [ ] Human visual verification (see instructions above) — pending, user orchestrating

## Self-Check: PASSED

- FOUND: frontend/src/components/NavBar.tsx (modified)
- FOUND: frontend/src/components/SubHeader.tsx (modified)
- FOUND: frontend/src/App.tsx (modified)
- FOUND: commit d0afee0 (Task 1)
- FOUND: commit f5e58e1 (Task 2)
