---
phase: 03-dashboard-frontend
plan: 02
subsystem: frontend-shell
tags: [frontend, routing, navigation, i18n, tanstack-query]
requirements: [DASH-04, INFR-03]
dependency-graph:
  requires: [frontend upload shell from Phase 2, /api/kpis/latest-upload endpoint from Plan 03-01]
  provides: [wouter router, NavBar, FreshnessIndicator, DashboardPage stub, kpiKeys factory, KPI fetch helpers]
  affects: [frontend/src/App.tsx, frontend/src/pages/UploadPage.tsx]
tech-stack:
  added:
    - wouter@3.9.0
    - date-fns@4.1.0
  patterns:
    - wouter Switch/Route for client-side routing
    - react-i18next with keySeparator:false to allow dotted JSON keys
    - TanStack Query kpiKeys factory for cache invalidation
key-files:
  created:
    - frontend/src/lib/queryKeys.ts
    - frontend/src/components/NavBar.tsx
    - frontend/src/components/dashboard/FreshnessIndicator.tsx
    - frontend/src/pages/DashboardPage.tsx
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/src/lib/api.ts
    - frontend/src/i18n.ts
    - frontend/src/locales/de.json
    - frontend/src/locales/en.json
    - frontend/src/App.tsx
    - frontend/src/pages/UploadPage.tsx
decisions:
  - Use wouter 3.9.0 (not react-router) per RESEARCH Pattern 4 — smaller bundle, simpler API
  - keySeparator:false in i18n to allow dotted key names like "nav.brand" as flat JSON keys (existing keys contain no dots, so the change is backward-compatible)
  - FreshnessIndicator renders absolute timestamp via Intl.DateTimeFormat (relative formatting deferred)
  - DashboardPage is a stub with data-testid="dashboard-stub"; Plans 03 and 04 fill in cards/chart
metrics:
  duration: ~3min
  completed: 2026-04-11
---

# Phase 3 Plan 02: Router Shell and Navigation Summary

Installed wouter-based routing, a persistent top NavBar (brand, Dashboard/Upload links, FreshnessIndicator, LanguageToggle), a FreshnessIndicator component fetching `/api/kpis/latest-upload`, a DashboardPage stub, a `kpiKeys` query-key factory, and KPI fetch helpers — all without touching the upload flow other than moving LanguageToggle out of UploadPage.

## What Was Built

### Task 1 — Dependencies, API helpers, query key factory
Commit: `d94eed8`

- Installed `wouter@3.9.0` and `date-fns@4.1.0` via `docker compose exec frontend npm install`.
- Extended `frontend/src/lib/api.ts` with three new types (`KpiSummary`, `ChartPoint`, `LatestUploadResponse`) and three new fetch helpers:
  - `fetchKpiSummary(start?, end?)` → `GET /api/kpis?start_date=&end_date=`
  - `fetchChartData(start, end, granularity)` → `GET /api/kpis/chart?granularity=&start_date=&end_date=`
  - `fetchLatestUpload()` → `GET /api/kpis/latest-upload`
- All existing exports (`uploadFile`, `getUploads`, `deleteUpload`, `UploadResponse`, etc.) remain intact.
- Created `frontend/src/lib/queryKeys.ts` with the `kpiKeys` factory:
  ```ts
  export const kpiKeys = {
    all: ["kpis"] as const,
    summary: (start?, end?) => ["kpis", "summary", { start, end }] as const,
    chart: (start, end, granularity) =>
      ["kpis", "chart", { start, end, granularity }] as const,
    latestUpload: () => ["kpis", "latest-upload"] as const,
  };
  ```

### Task 2 — i18n, NavBar, FreshnessIndicator, DashboardPage stub, router wiring
Commit: `4bde0ee`

- Added `nav.brand`, `nav.dashboard`, `nav.upload`, `nav.lastUpdated`, `nav.lastUpdated.never` to both `en.json` and `de.json`.
- Set `keySeparator: false` in `frontend/src/i18n.ts` so dotted key names are treated as flat keys (existing keys contain no dots, so this is backward-compatible — documented explicitly in the plan output).
- Created `frontend/src/components/NavBar.tsx` — fixed `h-16`, max-w-7xl container, brand + Dashboard/Upload wouter `<Link>`, FreshnessIndicator and LanguageToggle pushed to the right with `ml-auto`. Active route styled with `border-b-2 border-primary`.
- Created `frontend/src/components/dashboard/FreshnessIndicator.tsx` — uses `useQuery` with `kpiKeys.latestUpload()` and `fetchLatestUpload`; shows dash while loading, "Noch keine Daten" / "No data yet" when null, absolute `Intl.DateTimeFormat` timestamp otherwise (locale-aware based on `i18n.language`).
- Created `frontend/src/pages/DashboardPage.tsx` — stub with `data-testid="dashboard-stub"`. Plans 03 and 04 will inject the DateRangeFilter, KpiCardGrid, and RevenueChart.
- Rewrote `frontend/src/App.tsx` to use wouter `Switch` + `Route` with `/` → DashboardPage and `/upload` → UploadPage, wrapped in `<main className="pt-16">` to clear the fixed 64px nav.
- Cleaned `frontend/src/pages/UploadPage.tsx`: removed the `LanguageToggle` import and the `<div className="flex justify-end mb-6">` wrapper (D-03 — LanguageToggle is now solely owned by the NavBar).

## Verification

- `docker compose exec frontend npx tsc --noEmit` — exit 0 (no TypeScript errors).
- `curl -sf http://localhost:5173/` — HTTP 200 (Vite serves index.html).
- All grep acceptance checks for both tasks pass.
- Vite HMR picked up the file changes cleanly.

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | wouter 3.9.0 over react-router-dom | Smaller bundle (~1.5 KB), simpler API, chosen in RESEARCH Pattern 4 |
| 2 | `keySeparator: false` in i18n config | Allows dotted key names from UI-SPEC (`nav.brand`) as valid flat JSON keys; no existing key contains dots so change is backward-compatible |
| 3 | Absolute timestamp only in FreshnessIndicator | UI-SPEC allows absolute as fallback; relative-formatting deferred |
| 4 | DashboardPage rendered as a stub | Plans 03/04 own the cards and chart; this plan only delivers the shell |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `frontend/src/pages/DashboardPage.tsx` — intentional stub with `data-testid="dashboard-stub"`. Plans 03-03 (KPI cards + date filter) and 03-04 (RevenueChart) will wire real data. Plan frontmatter explicitly flags this.

## How i18n keySeparator Change Affects Existing Keys

It doesn't. All pre-existing keys in `en.json` / `de.json` (`page_title`, `dropzone_prompt`, `upload_success_body`, etc.) contain no `.` characters, so disabling the key separator produces identical lookups. The only new behavior is that keys like `nav.brand` are now treated as single flat keys rather than `nav` → `brand` nested paths.

## Files & Commits

| Commit | Task | Files |
|--------|------|-------|
| `d94eed8` | Task 1 | package.json, package-lock.json, lib/api.ts, lib/queryKeys.ts |
| `4bde0ee` | Task 2 | locales/*, i18n.ts, components/NavBar.tsx, components/dashboard/FreshnessIndicator.tsx, pages/DashboardPage.tsx, App.tsx, pages/UploadPage.tsx |

## Self-Check: PASSED

Verified:
- `frontend/src/lib/queryKeys.ts` — FOUND
- `frontend/src/components/NavBar.tsx` — FOUND
- `frontend/src/components/dashboard/FreshnessIndicator.tsx` — FOUND
- `frontend/src/pages/DashboardPage.tsx` — FOUND
- Commit `d94eed8` — FOUND in git log
- Commit `4bde0ee` — FOUND in git log
