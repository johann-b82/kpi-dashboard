---
phase: 46-admin-ui
plan: 01-foundation-routing-launcher
subsystem: frontend
tags: [signage, routing, i18n, launcher, foundation]
requires:
  - frontend/src/auth/AdminOnly.tsx
  - frontend/src/lib/queryKeys.ts (sensorKeys pattern)
  - frontend/src/pages/LauncherPage.tsx (existing tile pattern)
  - frontend/src/locales/{en,de}.json
  - frontend/scripts/check-locale-parity.mts
provides:
  - signageKeys query-key factory (lib/queryKeys.ts)
  - /signage, /signage/media, /signage/playlists, /signage/devices routes (admin-gated)
  - SignagePage tab shell with URL-driven active state
  - MediaPage / PlaylistsPage / DevicesPage stub components
  - launcher.tiles.signage + signage.admin.* i18n namespace (100 keys, EN/DE parity)
  - @dnd-kit/{core,sortable,utilities} + react-pdf installed at pinned versions
affects:
  - frontend/src/App.tsx (Switch — 4 new Routes added before /settings)
  - frontend/src/pages/LauncherPage.tsx (third admin tile, coming-soon count 2→1)
tech-stack:
  added:
    - "@dnd-kit/core@6.3.1"
    - "@dnd-kit/sortable@10.0.0"
    - "@dnd-kit/utilities@3.2.2"
    - "react-pdf@10.4.1"
  patterns:
    - "Custom button-group sub-nav (D-04: NOT shadcn <Tabs>) — URL is source of truth, initialTab prop selects render"
    - "Flat-dotted i18n keys at top level of locale JSON (matches existing parity script Object.keys contract)"
key-files:
  created:
    - frontend/src/signage/pages/SignagePage.tsx
    - frontend/src/signage/pages/MediaPage.tsx
    - frontend/src/signage/pages/PlaylistsPage.tsx
    - frontend/src/signage/pages/DevicesPage.tsx
    - frontend/src/signage/components/.gitkeep
    - frontend/src/signage/player/.gitkeep
  modified:
    - frontend/src/App.tsx
    - frontend/src/pages/LauncherPage.tsx
    - frontend/src/lib/queryKeys.ts
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
    - frontend/package.json
    - frontend/package-lock.json
decisions:
  - "Locale keys added as flat-dotted top-level entries (e.g. \"signage.admin.page_title\": \"Digital Signage\") — matches existing pattern (launcher.*, sensors.*) and the parity script's Record<string, string> contract. Although the bottom of each locale file has some nested objects (docs.*), the parity script only checks Object.keys at the top level, so flat is the only safe shape for new keys."
  - "launcher.tiles.signage (plural) is a new sibling key per D-16 and does NOT rename the existing launcher.tile.* (singular) keys."
  - "Coming-soon tile count reduced 2→1 to keep grid total at 4 visible tiles (KPI Dashboard active + Sensors admin + Signage admin + 1 placeholder)."
  - "App.tsx routes use AdminOnly wrapper at the route level (not inside SignagePage) so unauthorized renders are caught before the SignagePage component mounts."
metrics:
  duration: ~5m
  completed_date: 2026-04-19
  tasks: 3
  files_created: 6
  files_modified: 7
---

# Phase 46 Plan 01: Foundation Routing & Launcher Summary

**One-liner:** Phase 46 admin UI foundation — installs `@dnd-kit/*` and `react-pdf`, registers admin-gated `/signage/*` routes wrapped in `<AdminOnly>`, adds the MonitorPlay launcher tile, builds the URL-driven `SignagePage` tab shell with three sub-page stubs, extends `signageKeys`, and seeds 100 bilingual `signage.admin.*` i18n keys.

## What Shipped

### Task 1 — Dependencies, directory tree, query keys (`2cb1767`)
- `npm install @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/utilities@3.2.2 react-pdf@10.4.1` (4 packages, 0 vulnerabilities reported as new)
- Created `frontend/src/signage/{pages,components,player}/` directory tree with `.gitkeep` placeholders
- Extended `lib/queryKeys.ts` with `signageKeys` factory (`media()`, `mediaItem(id)`, `playlists()`, `playlistItem(id)`, `devices()`, `tags()`)
- No `pdfjs-dist` override added — Phase 47 owns that pin (per UI-SPEC + RESEARCH)

### Task 2 — Locale keys (`1de780a`)
- Added 100 new keys to `en.json` and `de.json` (97 `signage.admin.*` + `launcher.tiles.signage` + 2 page-level)
- Parity script result: **`PARITY OK: 407 keys in both en.json and de.json`**
- German uses informal "du" tone verbatim from UI-SPEC (no "Sie" in new keys)
- Code placeholder verified: `signage.admin.pair.code_placeholder` = `XXX-XXX` in both locales

### Task 3 — Routes, launcher tile, SignagePage shell (`ae27d50`)
- `App.tsx`: 4 new wouter `<Route>` entries inserted before the `/settings/sensors` block, ordered most-specific-first (`playlists`, `devices`, `media`, then redirect-only `/signage` → `/signage/media`). Each route wrapped in `<AdminOnly>`. Comments mark insertion points for plans 46-05 (`/signage/playlists/:id`) and 46-06 (`/signage/pair`).
- `LauncherPage.tsx`: third admin tile using `MonitorPlay` icon, `aria-label={t("launcher.tiles.signage")}`, `setLocation("/signage")`. Coming-soon range reduced from `[0, 1]` to `[0]` to maintain visual tile count.
- `SignagePage.tsx`: URL-driven tab shell with three buttons (Media / Playlists / Devices). Active button uses `bg-primary text-primary-foreground`; inactive uses `bg-transparent text-foreground hover:bg-muted`. Custom button group (D-04: NOT shadcn `<Tabs>`).
- `MediaPage.tsx`, `PlaylistsPage.tsx`, `DevicesPage.tsx`: minimal stubs rendering existing empty-state i18n strings inside a bordered card. Will be replaced wholesale by 46-04/05/06.

## Verification

| Check | Result |
| --- | --- |
| `npm ls @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-pdf` | All 4 at exact pinned versions |
| `grep -c signageKeys src/lib/queryKeys.ts` | 1 |
| `node --experimental-strip-types scripts/check-locale-parity.mts` | `PARITY OK: 407 keys` |
| `grep -c MonitorPlay src/pages/LauncherPage.tsx` | 2 (import + usage) |
| `grep -c 'path="/signage' src/App.tsx` | 4 |
| `grep -c '<Redirect to="/signage/media"' src/App.tsx` | 1 |
| Specificity order | `/signage/media` line 57 BEFORE `/signage` line 60 |
| `grep -rn "dark:" frontend/src/signage` | 0 matches |
| `grep -rn "fetch(" frontend/src/signage/pages` | 0 matches |
| Stub files exist (Media/Playlists/Devices) | All 3 present |
| `grep -c "pdfjs-dist" frontend/package.json` | 0 (not a direct dep — Phase 47 concern) |
| `grep -c "overrides" frontend/package.json` | 0 (no override added) |

## Deviations from Plan

None — plan executed exactly as written.

The pre-existing TypeScript build errors in `HrKpiCharts.tsx`, `SalesTable.tsx`, `useSensorDraft.ts`, and `lib/defaults.ts` are NOT caused by this plan's changes. They predate Phase 46 and are out-of-scope per the executor's scope-boundary rule. Filed below as deferred items for downstream attention.

## Deferred Issues (out of scope)

These pre-existing errors were observed when running `npm run build` but are unrelated to Plan 46-01's work:

- `src/components/dashboard/HrKpiCharts.tsx` — Recharts Tooltip formatter type mismatch (4 errors)
- `src/components/dashboard/SalesTable.tsx` — TanStack Table generic typing (7 errors)
- `src/hooks/useSensorDraft.ts` — `erasableSyntaxOnly` and duplicate-key warnings (8 errors)
- `src/lib/defaults.ts` — `Settings` type missing 5 sensor properties (1 error)

These need a separate cleanup plan; they do not block Phase 46 functional verification.

## Key Decisions

1. **Locale keys are flat-dotted top-level strings, not nested objects.** The plan asserted this and inspection confirms it: existing `launcher.*`, `sensors.*`, `signage.admin.*` siblings live at the top level of the JSON. The parity script reads `Object.keys` only — nesting would silently bypass parity enforcement.
2. **`launcher.tiles.signage` (plural) was added as a new sibling, not a rename of `launcher.tile.*`** — D-16 lock; existing keys untouched.
3. **AdminOnly wraps each Route at the App.tsx level** rather than inside SignagePage. This means viewer roles never instantiate SignagePage at all; cleaner authorization boundary than internal short-circuits.
4. **Custom button-group sub-nav (NOT shadcn `<Tabs>`)** per D-04. Each button calls `setLocation()` so the URL stays the source of truth and deep-linking to `/signage/playlists` works without internal state coordination.

## Self-Check: PASSED

- Files created (6) — all present
- Files modified (7) — all committed
- Commits: `2cb1767`, `1de780a`, `ae27d50` — all in `git log`
- Locale parity: `PARITY OK: 407 keys`
- No `dark:` variants in `frontend/src/signage`
- No direct `fetch()` in `frontend/src/signage/pages`
