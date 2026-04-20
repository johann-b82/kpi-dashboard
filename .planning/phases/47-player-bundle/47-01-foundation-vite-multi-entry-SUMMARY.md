---
phase: 47-player-bundle
plan: 01
subsystem: frontend-build
tags: [vite, pwa, multi-entry, pdfjs, player]
requires:
  - Phase 46-03 PlayerRenderer (consumed unchanged)
  - Phase 42 pairing endpoints (referenced in playerApi contract)
  - Phase 45 /stream endpoint (blocked by OQ4 FAIL — see hand-off)
provides:
  - frontend/player.html — second Vite entry HTML
  - Multi-entry vite.config.ts with PWA plugin for player mode
  - All @/player/lib/* helpers for 47-02..05 to import
  - pdfjs-dist@5.6.205 pinned via package.json overrides
affects:
  - frontend/package.json (+ lockfile)
tech-stack:
  added:
    - vite-plugin-pwa@1.2.0
    - workbox-window@7.4.0
    - react-is@19.2.4 (+ @types/react-is)
  patterns:
    - Vite mode-branching for multi-entry (mode === 'player')
    - manualChunks function form for shared vendor-react
    - package.json overrides for transitive version pin
    - Vite ?url import for pdf.js worker
key-files:
  created:
    - frontend/player.html
    - frontend/src/player/main.tsx
    - frontend/src/player/lib/durationDefaults.ts
    - frontend/src/player/lib/locale.ts
    - frontend/src/player/lib/strings.ts
    - frontend/src/player/lib/mediaUrl.ts
    - frontend/src/player/lib/playerApi.ts
    - frontend/src/player/lib/queryKeys.ts
    - frontend/src/player/lib/pdfWorker.ts
    - .planning/phases/47-player-bundle/47-OQ4-RESOLUTION.md
  modified:
    - frontend/vite.config.ts (full rewrite to mode-branching)
    - frontend/package.json (deps, scripts, overrides)
decisions:
  - OQ1 (i18n): Path B locked — hard-coded EN+DE in strings.ts (Pitfall P9, defends <200KB budget)
  - OQ4 (/stream ?token=): FAIL outcome — backend dep does not read query params; 47-03 owns the backend tweak
  - pdf fallback duration: single-page default (PDF_PER_PAGE_DURATION_S) until pageCount is plumbed through PlayerItem
metrics:
  duration: 6m
  completed: 2026-04-20
---

# Phase 47 Plan 01: Foundation Vite Multi-Entry Summary

Shipped a second Vite entry (`player.html` → `dist/player/index.html`), installed
the PWA toolchain with a pinned pdfjs-dist worker, and laid down all
`frontend/src/player/lib/*` helper modules that downstream plans 47-02..05 will
consume. No React UI components authored (deliberately — those are 47-02..04).
Foundation is green: `npm run build` emits both admin and player bundles with
`sw.js`, `manifest.webmanifest`, and two physical `vendor-react` chunks (one per
outDir, per OQ2 resolution).

## Files Created

| File | Purpose |
| ---- | ------- |
| `frontend/player.html` | Second Vite entry HTML; references `/src/player/main.tsx` and `/player/manifest.webmanifest` |
| `frontend/src/player/main.tsx` | Skeleton bootstrap; imports `./lib/pdfWorker` first; 47-04 replaces bootstrap div with wouter App |
| `frontend/src/player/lib/durationDefaults.ts` | Per-format default `duration_s` constants + `applyDurationDefaults()` (D-6) |
| `frontend/src/player/lib/locale.ts` | `navigator.language` → `'de' \| 'en'` picker, detected once at module load |
| `frontend/src/player/lib/strings.ts` | Path B hard-coded EN+DE for 5 player strings; `t()` + `STRINGS` exports |
| `frontend/src/player/lib/mediaUrl.ts` | `resolveMediaUrl()` + `window.signageSidecarReady` flag declaration (D-1) |
| `frontend/src/player/lib/playerApi.ts` | `playerFetch<T>()` adapter — the one permitted raw `fetch()` in player tree |
| `frontend/src/player/lib/queryKeys.ts` | `playerKeys` factory (`all`, `playlist()`, `pairStatus()`) |
| `frontend/src/player/lib/pdfWorker.ts` | Side-effect module: `GlobalWorkerOptions.workerSrc = workerUrl` via `?url` import |
| `.planning/phases/47-player-bundle/47-OQ4-RESOLUTION.md` | OQ4 investigation outcome (FAIL — 47-03 blocked) |

## Files Modified

| File | Change |
| ---- | ------ |
| `frontend/vite.config.ts` | Full rewrite: `mode === 'player'` branches for `base`, `outDir`, `rollupOptions.input`, `VitePWA` plugin; `manualChunks` extracts `vendor-react`; 5-point invariant comment block |
| `frontend/package.json` | Added deps (vite-plugin-pwa, workbox-window, react-is), `overrides.pdfjs-dist = 5.6.205`, new scripts (`build:admin`, `build:player`, `dev:player`, `check:player-isolation`, `check:player-size`), inline `//*` workaround comments |

## Build Smoke Test Result

PASS (with tsc workaround, per Task 4 "acceptable failure path"):

```
dist/index.html                                   ✓
dist/player/index.html                            ✓  (renamed from player.html post-build)
dist/player/manifest.webmanifest                  ✓
dist/player/sw.js                                 ✓
dist/player/workbox-*.js                          ✓
dist/player/registerSW.js                         ✓
dist/player/assets/vendor-react-*.js              ✓  (59.63 kB gz)
dist/player/assets/index-*.js                     ✓  (121.46 kB gz — before tree-shaking of 47-02..04)
dist/player/assets/pdf.worker.min-*.mjs           ✓  (1.24 MB — worker asset, loaded lazily)
dist/assets/vendor-react-*.js                     ✓  (110.95 kB gz — second physical copy, per OQ2)
```

Player bundle size (gzipped, excluding pdf.worker which is loaded on-demand and
should be excluded from the <200KB budget per RESEARCH §SGN-PLY-01): currently
~181 KB (59.63 + 121.46 + 0.41 + 0.07). Pre-47-02/03/04 code — once App, hooks,
and components are added, the 200KB budget enforcement in 47-05 will need
vigilance. pdf.worker.min at 1.24 MB is NOT counted in the budget (confirmed
against RESEARCH Pitfall P11 — only `dist/player/assets/*.js` excluding the
worker file is summed).

## OQ Resolutions

### OQ1 — Player i18n (Path A vs Path B)

**Decision: Path B locked.** `strings.ts` hard-codes EN+DE for exactly the 5
player strings (`pair.headline`, `pair.hint`, `pair.code_placeholder`,
`offline.label`, `offline.aria_label`) matching UI-SPEC §Copywriting byte-for-byte.
Saves ~25 KB vs i18next. UI-SPEC's `signage.player.*` JSON locale namespace is
intentionally NOT added to admin `en.json`/`de.json`; 47-05 will land a custom
strings-parity test instead of relying on the existing `check-i18n-parity.mjs`.

### OQ4 — `/stream ?token=` query auth

**Outcome: FAIL.** See `47-OQ4-RESOLUTION.md`. `get_current_device`
(`backend/app/security/device_auth.py:37-43`) reads only the `Authorization`
header via `HTTPBearer(auto_error=False)`. `/api/signage/player/stream` uses the
same dep with no query-token fallback. **Plan 47-03 is BLOCKED** on a backend
tweak: add `request.query_params.get("token")` as a fallback when the
`Authorization` header is absent. Target lives inside Plan 47-03 as a
prerequisite task (~6 lines + test); escalate to a new 47-00 plan only if scope
expands.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing `react-is` direct dependency after `npm install` reshuffle**
- **Found during:** Task 4 smoke test (admin `vite build`)
- **Issue:** Rolldown failed to resolve `react-is` from recharts after the
  `overrides.pdfjs-dist` install reshuffled transitive deps. Recharts v3.8.1
  imports `react-is` but relies on it being hoisted; our override + Vite 8
  Rolldown resolver would not traverse the transitive `prop-types > react-is@16`
  path for recharts' ESM imports.
- **Fix:** Added `react-is@19.2.4` and `@types/react-is` to `devDependencies`.
- **Commit:** `27887b6`

**2. [Rule 1 - Bug] `durationDefaults.ts` typed against speculative PlayerItem**
- **Found during:** Task 4 tsc phase
- **Issue:** Plan's code used `kind === "iframe"` (PlayerItem uses `"url"`) and
  accessed `item.pageCount` (not on the type).
- **Fix:** Switched `"iframe"` → `"url"`; replaced `pageCount * PDF_PER_PAGE_DURATION_S`
  with flat `PDF_PER_PAGE_DURATION_S` fallback and a comment noting the future
  multiply-by-pageCount behavior once the type is extended.
- **Commit:** `27887b6`

**3. [Rule 1 - Bug] `playerApi.ts` used TS parameter-properties under `erasableSyntaxOnly`**
- **Found during:** Task 4 tsc phase
- **Issue:** Project tsconfig enables `erasableSyntaxOnly`, disallowing
  `constructor(public status: number, …)` shorthand.
- **Fix:** Replaced with explicit field declarations + constructor assignments.
- **Commit:** `27887b6`

**4. [Rule 3 - Blocking] Vite emits `dist/player/player.html` instead of `index.html`**
- **Found during:** Task 4 smoke test
- **Issue:** Vite names emitted HTML after the input source file (`player.html`),
  which breaks PWA `navigateFallback: '/player/index.html'` and the auto-injected
  SW registration script's expected entrypoint.
- **Fix:** Post-build `node -e "fs.renameSync(...)"` in `build` and
  `build:player` npm scripts. Added a comment in `vite.config.ts` explaining
  the rename (Pitfall P2 linkage).
- **Commit:** `27887b6`

### Pre-existing tsc Failures (Out-of-Scope, Carry-Forward)

Per Task 4's "acceptable failure path" documentation, these pre-existing admin
errors are NOT fixed in this plan:

- `src/components/dashboard/HrKpiCharts.tsx` (4 errors — Recharts tooltip
  formatter/labelFormatter type mismatches)
- `src/components/dashboard/SalesTable.tsx` (8 errors — react-i18next generic
  widening)
- `src/hooks/useSensorDraft.ts` (8 errors — `erasableSyntaxOnly` + duplicate
  property literals)
- `src/lib/defaults.ts` (1 error — Settings shape missing sensor_* fields)

**Carry-forward for Plan 47-04:** when the full player App is built,
`npm run build` will still require the workaround (`npx vite build && npx vite build --mode player && node -e ...`).
Plan 47-05 may clean these up if in scope, or defer again.

## Hand-off Notes

### To Plan 47-02 (Pairing Screen)

Import from `@/player/lib/*`:
- `playerFetch` + `PlayerApiError` from `./lib/playerApi` for `POST /pair/request` and `GET /pair/status` calls
- `playerKeys.pairStatus(sessionId)` from `./lib/queryKeys` for TanStack Query
- `t('pair.headline')`, `t('pair.hint')`, `t('pair.code_placeholder')` from `./lib/strings`
- `playerLang` from `./lib/locale` if locale-aware rendering needed beyond strings

Pairing doesn't need token auth (endpoints are public per Phase 42 dep-audit), so
`playerFetch` calls can pass an empty string token; alternative: write a tiny
`publicFetch()` wrapper or call `fetch` directly inside 47-02 with a second
documented exception. **Recommended:** parameterize `playerFetch` to accept an
optional token and skip the `Authorization` header when absent — one-line
tweak. Flag for 47-02 planner.

### To Plan 47-03 (Playback Shell + SSE + PDF crossfade)

Import from `@/player/lib/*`:
- `playerFetch` + `PlayerApiError` for `GET /playlist` and `POST /heartbeat`
  (note: D-8 says no heartbeat from JS; use only for playlist fetch + 401 handling)
- `playerKeys.playlist()` for the playlist query
- `applyDurationDefaults()` from `./lib/durationDefaults` before handing items
  to `<PlayerRenderer>`
- `resolveMediaUrl()` from `./lib/mediaUrl` (or the hybrid `useSidecarStatus` hook
  that 47-03 will introduce on top of it)

**CRITICAL — OQ4 BLOCKER:** the SSE hook cannot open `new EventSource('/api/signage/player/stream?token=...')`
against the current backend because `get_current_device` ignores query params.
Plan 47-03 MUST include a prerequisite task that edits
`backend/app/security/device_auth.py` to read `request.query_params.get('token')`
as fallback. See `47-OQ4-RESOLUTION.md`.

### To Plan 47-04 (App + Router + PWA + Backend Mount)

Import from `@/player/lib/*`:
- `t(...)` / `STRINGS` / `playerLang` for any additional strings if scope expands
- `resolveMediaUrl` if App needs it (unlikely — stays inside PlayerRenderer wrapper)

**main.tsx replacement:** replace the `PlayerBootstrap` div with wouter `<App />`.
Keep the `import "./lib/pdfWorker";` as the first import (must run before any
PdfPlayer is rendered, per D-11).

### To Plan 47-05 (CI Guards + Bundle Size + UAT)

- `check:player-isolation` and `check:player-size` script names are already
  declared in `package.json`; implementations land in 47-05.
- The `strings.ts` `STRINGS` export is deliberately exposed so 47-05's parity
  test can introspect `Object.keys(STRINGS.en) === Object.keys(STRINGS.de)`.
- Budget envelope today (skeleton): ~181 KB gz for `dist/player/assets/*.js`
  (excluding `pdf.worker.min-*.mjs` per RESEARCH P11). Remaining headroom
  before 200 KB cap: ~19 KB. Tight — 47-05 will need to either (a) raise the
  cap with documented justification, or (b) drop unused react-query surface
  when 47-03 lands, or (c) dynamic-import PdfPlayer to shift its ~40 KB of
  react-pdf chunk out of the initial critical path.

## Known Stubs

- `main.tsx` renders a placeholder bootstrap div — intentional; 47-04 replaces
  with wouter `<App />`. Not a user-facing stub (no end-user sees this without
  47-02..04 landing).

## Self-Check: PASSED

Files verified present on disk:
- FOUND: frontend/player.html
- FOUND: frontend/vite.config.ts (rewritten)
- FOUND: frontend/package.json (modified)
- FOUND: frontend/src/player/main.tsx
- FOUND: frontend/src/player/lib/durationDefaults.ts
- FOUND: frontend/src/player/lib/locale.ts
- FOUND: frontend/src/player/lib/strings.ts
- FOUND: frontend/src/player/lib/mediaUrl.ts
- FOUND: frontend/src/player/lib/playerApi.ts
- FOUND: frontend/src/player/lib/queryKeys.ts
- FOUND: frontend/src/player/lib/pdfWorker.ts
- FOUND: .planning/phases/47-player-bundle/47-OQ4-RESOLUTION.md

Commits verified in git log:
- FOUND: ffb4249 (Task 0 — OQ4 resolution)
- FOUND: a79c1fc (Task 1 — deps + overrides)
- FOUND: 3f9327d (Task 2 — vite config + player.html)
- FOUND: ad66647 (Task 3 — player lib helpers + main.tsx)
- FOUND: 27887b6 (Task 4 fixes — react-is, type fixes, rename)

Build artifacts verified on disk after `npm run build` workaround:
- FOUND: frontend/dist/index.html
- FOUND: frontend/dist/player/index.html
- FOUND: frontend/dist/player/manifest.webmanifest
- FOUND: frontend/dist/player/sw.js
- FOUND: frontend/dist/player/assets/vendor-react-*.js
- FOUND: frontend/dist/assets/vendor-react-*.js
