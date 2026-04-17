---
phase: quick
plan: 260417-eb8
subsystem: frontend-launcher
tags: [launcher, navigation, routing, ux]
requires:
  - Wouter router + <Link>/<Switch>/<Route>/useLocation API (already present)
  - AuthGate controls post-login redirect target
  - SubHeader per-route visibility guard pattern
provides:
  - "Launcher served at `/` (no /home redirect hop)"
  - "Clickable brand slot (logo + app_name) → /"
  - "Settings gear visible on launcher; docs + upload + segmented-control hidden"
  - "iOS-style launcher tiles: 120x120 icon-only square + external centered label"
affects:
  - "Every post-login flow (AuthGate now redirects authed users from /login → /)"
  - "Every NavBar render (brand is now a wouter Link; settings gear no longer gated by !isLauncher)"
  - "SubHeader null-return guard now triggers on `/` instead of `/home`"
tech_stack_added: []
patterns:
  - "Brand-slot-as-link: wrap logo+wordmark in a single <Link href='/'> so both are one click target; preserve visual classes (text-sm font-medium) — no hover-underline or color shift"
  - "Tile decoupling: clickable 120x120 button/div carries only the icon; the label is a sibling <span> in a flex-col wrapper — hovering the label does not highlight the tile"
key_files_created: []
key_files_modified:
  - frontend/src/App.tsx
  - frontend/src/components/NavBar.tsx
  - frontend/src/components/SubHeader.tsx
  - frontend/src/pages/LauncherPage.tsx
  - frontend/src/auth/AuthGate.tsx
  - frontend/src/pages/LoginPage.tsx
decisions:
  - "Route placement: new Route path='/' sits AFTER /login and /sales in the Switch to prevent wouter from shadowing more-specific routes"
  - "LauncherPage retains isAdmin hook (with `void isAdmin`) so future admin-only tiles can slot in without rewiring — per v1.14 roadmap note"
  - "Coming-soon tile labels inherit opacity-40 (matching the dimmed tile) so the whole group reads as disabled; the tile itself keeps pointer-events-none"
metrics:
  duration_seconds: 93
  tasks_completed: 2
  tasks_total: 3
  completed_date: "2026-04-17"
  note: "Task 3 is a human-verify checkpoint — not a code task."
---

# Quick Task 260417-eb8: Launcher UX Polish (Move to / + Clickable Brand + iOS Tiles) Summary

**One-liner:** Moved the launcher from `/home` to `/` (eliminating the post-login redirect hop), wrapped the NavBar brand slot in a wouter `<Link>`, kept the settings gear visible on the launcher, and restructured each tile into an icon-only rounded square with a centered external label below.

---

## What Changed

### Task 1 — Move launcher route from `/home` to `/` (commit `8158925`)

- **`frontend/src/App.tsx`:** Dropped `Redirect` from the wouter import; `isLauncher` now checks `location === "/"`; removed the `<Route path="/home">` line and replaced the 3-line Redirect-wrapper at `"/"` with a single `<Route path="/" component={LauncherPage} />` placed after `/login` and `/sales`.
- **`frontend/src/auth/AuthGate.tsx`:** `setLocation("/home")` → `setLocation("/")`; JSDoc updated.
- **`frontend/src/components/SubHeader.tsx`:** Null-return guard is now `location === "/"`; comment updated.
- **`frontend/src/pages/LoginPage.tsx`:** JSDoc reference updated to `/`.

`grep -rn "/home" frontend/src` after Task 1 returned only the expected remaining hit in `NavBar.tsx:28` (address Task 2).

### Task 2 — Clickable brand, launcher settings gear, iOS tile layout (commit `76d9a97`)

- **`frontend/src/components/NavBar.tsx`:**
  - `isLauncher` flipped to `/`.
  - Brand slot (the outer `<div className="flex items-center gap-2">` containing the optional logo and `<span>{settings.app_name}</span>`) wrapped in `<Link href="/" className="flex items-center gap-2 cursor-pointer">`. Visual classes unchanged — no hover-underline, no color shift. (`Link` was already imported.)
  - Settings gear moved outside the `!isLauncher` block and now renders unconditionally alongside ThemeToggle / LanguageToggle / sign-out. Only the docs `<Library>` and admin-gated upload icons remain inside the `!isLauncher` gate.
  - Middle-slot `!isLauncher` guard (segmented-control / back-button) left untouched.
- **`frontend/src/pages/LauncherPage.tsx`:**
  - Removed the `<h1 className="text-2xl font-medium">{settings.app_name}</h1>` title, the `settings` variable, and the now-unused `useSettings` / `DEFAULT_SETTINGS` imports.
  - Outer wrapper simplified: `space-y-12` dropped (only one child remains). Still `max-w-7xl mx-auto px-8 pt-16 pb-8`.
  - Grid gap bumped from `gap-6` to `gap-8` for breathing room between tile and its external label.
  - Active tile: inner `<button>` is now 120x120 with `flex items-center justify-center` (icon-only); the `<span>` label moved outside the button into the `flex flex-col items-center gap-2` wrapper. Aria-label preserved. The label is `text-xs text-muted-foreground text-center` (dropped `truncate w-full` and `font-medium`).
  - Coming-soon tiles: same split — inner `<div>` keeps `opacity-40 pointer-events-none`; label is a sibling with `opacity-40` so the whole group visually reads as disabled.
  - `isAdmin` hook + `void isAdmin;` retained for future admin tiles (per v1.14 roadmap note).

### Task 3 — Human UAT (pending, not a code task)

Dev server at http://localhost:5173 has HMR; no restart required. Verification steps below.

---

## Verification

- [x] `grep -rn "/home" frontend/src` → zero matches (confirmed after Task 2).
- [x] `cd frontend && npx tsc --noEmit` exits 0 (run after Task 1 and after Task 2, both clean).
- [ ] Human UAT (Task 3 — owned by user, orchestrated at http://localhost:5173):

  1. Navigate to http://localhost:5173/. Expected: launcher renders immediately; the address bar shows `/` (NOT `/home`) — no redirect hop.
  2. Confirm the launcher does NOT show any "ACM OS" / app-name `<h1>` heading at the top of the page content.
  3. Inspect the tiles: each tile is just the icon inside a rounded square, and the text label (e.g. "KPI Dashboard", "Coming soon") sits OUTSIDE/BELOW the square, centered. Hovering the label does not highlight the tile (label is not part of the click target).
  4. Header on `/`: brand (left) | theme toggle, language toggle, settings gear, sign-out (right). Confirm NO SALES/HR segmented control, NO docs (Library) icon, NO upload icon.
  5. Click the brand slot (logo + `{app_name}` text) in the header → should stay on `/` (you're already here). Now navigate to /sales (click the KPI Dashboard tile), then click the brand slot → should navigate back to `/`.
  6. Click the KPI Dashboard tile → navigates to `/sales`. Header on /sales: brand | segmented control (SALES/HR) | theme | language | docs | (upload if admin) | settings | sign-out. All four right-side icons visible.
  7. Switch to /hr via segmented control. Same header icons as /sales.
  8. Navigate to /settings (click gear from /sales). Header: brand | back-to-sales button | theme | language | docs | (upload if admin) | settings | sign-out. Click back-to-sales → returns to /sales.
  9. Navigate to /upload (if admin). Same back-button pattern as /settings.
  10. Hard refresh (Cmd+Shift+R) on `/` — page still renders launcher, no flash of redirect.
  11. Sign out → redirects to /login. Sign in → redirects to `/` (NOT `/home`).

## Success Criteria

- [x] Launcher accessible at `/` with no redirect hop from `/home` (code path eliminated).
- [x] Clickable brand slot → `/` (wouter `<Link>`).
- [x] Settings gear visible on launcher; docs + upload + segmented-control hidden on launcher.
- [x] All four right-side icons visible on /sales, /hr, /settings, /upload, /docs/* (settings always on; docs + upload(if admin) on non-launcher).
- [x] LauncherPage: no h1 title; iOS-style tiles with external labels.
- [x] TypeScript clean.
- [x] Post-login (from /login) redirects to `/`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All previously hardcoded `/home` paths were migrated; no placeholder data introduced.

## Commits

| Task | Commit     | Summary                                                                    |
| ---- | ---------- | -------------------------------------------------------------------------- |
| 1    | `8158925`  | refactor(quick-260417-eb8): move launcher route from /home to /            |
| 2    | `76d9a97`  | feat(quick-260417-eb8): clickable brand, launcher settings gear, iOS tiles |

## Self-Check: PASSED

- FOUND file: frontend/src/App.tsx (modified)
- FOUND file: frontend/src/components/NavBar.tsx (modified)
- FOUND file: frontend/src/components/SubHeader.tsx (modified)
- FOUND file: frontend/src/pages/LauncherPage.tsx (modified)
- FOUND file: frontend/src/auth/AuthGate.tsx (modified)
- FOUND file: frontend/src/pages/LoginPage.tsx (modified)
- FOUND commit: 8158925
- FOUND commit: 76d9a97
- VERIFIED: `grep -rn "/home" frontend/src` → zero matches
- VERIFIED: `cd frontend && npx tsc --noEmit` → exit 0
