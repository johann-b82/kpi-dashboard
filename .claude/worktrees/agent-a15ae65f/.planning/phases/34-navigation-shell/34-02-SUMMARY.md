---
phase: 34-navigation-shell
plan: "02"
subsystem: frontend/navigation
tags: [docs, navbar, routing, role-guards, three-column-layout]
dependency_graph:
  requires: ["34-01"]
  provides: ["docs-navigation-flow", "role-gated-docs-routing"]
  affects: ["frontend/src/components/NavBar.tsx", "frontend/src/pages/DocsPage.tsx", "frontend/src/App.tsx"]
tech_stack:
  added: []
  patterns: ["lazy-loading", "role-aware-redirect", "wouter-params"]
key_files:
  created:
    - frontend/src/pages/DocsPage.tsx
  modified:
    - frontend/src/components/NavBar.tsx
    - frontend/src/App.tsx
decisions:
  - "Library icon placed before Upload in NavBar — follows D-04/D-05 ordering"
  - "Back-button condition extended to /docs routes — consistent UX with /settings and /upload"
  - "Both /docs and /docs/:section/:slug routes use Suspense with Loader2 fallback"
metrics:
  duration: "~6min"
  completed: "2026-04-16T12:08:35Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 34 Plan 02: NavBar Wire-up and DocsPage Routing Summary

**One-liner:** Library icon in NavBar navigates to /docs with role-aware redirect and three-column layout in DocsPage.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | NavBar Library icon and App.tsx routing | 5062e94 | NavBar.tsx, App.tsx, package.json |
| 2 | DocsPage refactor with role guards and three-column layout | dbd75e4 | DocsPage.tsx |

## What Was Built

### Task 1: NavBar Library icon and App.tsx routing

- Added `Library` to the lucide-react import in NavBar.tsx
- Added `docsLinkClass` variable for active state on all `/docs/*` routes
- Inserted Library icon Link (`href="/docs"`) before the Upload link in the `ml-auto` div
- Extended back-button condition to include `location.startsWith("/docs")` — shows back arrow instead of segmented control on docs pages
- Added `/docs/:section/:slug` and `/docs` routes in App.tsx using lazy-loaded `DocsPage` with `Suspense`/`Loader2` fallback

### Task 2: DocsPage three-column layout with role guards

- Rewrote DocsPage from scratch with `useParams` to extract `section`/`slug` from URL
- Role-aware redirect: bare `/docs` → admin goes to `/docs/admin-guide/intro`, viewer to `/docs/user-guide/intro`
- Silent redirect: viewer on any `admin-guide/*` URL → `/docs/user-guide/intro` with `{ replace: true }`
- Guard render returns `null` while params missing or unauthorized (prevents sidebar flash)
- Registry fallback chain: `registry[lang][section][slug] ?? registry["en"][section][slug] ?? ""`
- Three-column layout: `DocsSidebar` (left), `<article>` with `MarkdownRenderer` (center), sticky `TableOfContents` (right, hidden on small screens)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing Plan 01 dependency files in worktree**
- **Found during:** Task 1 verification (TypeScript check + Vite build)
- **Issue:** Worktree `agent-a06e85f5` started from an older base commit that predates Plan 01's auth module, docs components, and registry. Also missing `apiClient.ts`, `directusClient.ts`, and updated `package.json` with docs dependencies (react-markdown, rehype-slug, etc.)
- **Fix:** Copied all missing files from the main repo (which contained Plan 01's committed output): auth module, docs components, lib/docs, locales, apiClient, directusClient, package.json + lockfile. Installed dependencies.
- **Files modified:** Multiple new files under `frontend/src/auth/`, `frontend/src/components/docs/`, `frontend/src/lib/docs/`, `frontend/src/lib/`, `frontend/src/locales/`
- **Commit:** 5062e94

## Known Stubs

None in Plan 02 additions. DocsPage renders content from the registry; the registry stubs (intro.md placeholder text) were created in Plan 01 and will be replaced in Phases 35–36 (content authoring phases).

## Verification

- TypeScript: `./node_modules/.bin/tsc --noEmit` — 0 errors
- Vite build: `./node_modules/.bin/vite build` — built in 355ms (chunk size warning only, pre-existing)
- NavBar.tsx contains `Library` import, `href="/docs"`, `docs.nav.docsLabel`, `location.startsWith("/docs")`
- App.tsx contains `/docs/:section/:slug` route
- DocsPage.tsx contains `useParams`, `useRole`, `/docs/admin-guide/intro`, `/docs/user-guide/intro`, `<DocsSidebar`, `registry[lang]`, `replace: true`
- DocsPage.tsx does NOT contain `getting-started`

## Self-Check: PASSED
