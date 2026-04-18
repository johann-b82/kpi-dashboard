---
phase: 07-i18n-integration-and-polish
plan: 02
subsystem: frontend-bootstrap
tags: [i18n, bootstrap, frontend, vite, tanstack-query]
requires:
  - 05-01 (useSettings + fetchSettings already in lib/api.ts)
  - 05-02 (ThemeProvider + queryClient pattern)
provides:
  - "bootstrap.ts — single cold-start writer of initial i18n language and ['settings'] cache seed"
  - "i18nInitPromise — exported init promise for defensive awaits"
  - "index.html splash inside #root — replaced atomically on React's first commit"
affects:
  - frontend/src/main.tsx (top-level await bootstrap before render)
  - frontend/src/i18n.ts (no hardcoded lng)
tech_stack:
  added: []
  patterns:
    - "Top-level await in entry module (Vite 8 transpiles for modern browsers)"
    - "Idempotent bootstrap via module-level Promise guard"
    - "CSS-only splash inside root element — React's first commit replaces atomically"
key_files:
  created:
    - frontend/src/bootstrap.ts
  modified:
    - frontend/src/i18n.ts
    - frontend/src/main.tsx
    - frontend/index.html
decisions:
  - "Splash placed INSIDE #root (not as sibling) so React's first commit atomically replaces it — no manual DOM cleanup"
  - "On fetchSettings error, do NOT seed cache with DEFAULT_SETTINGS — let useSettings() re-fetch so the real error surfaces via existing toast/error-boundary path"
  - "Splash is text-free to avoid mis-localized app-name flash during fetch"
metrics:
  completed: 2026-04-11
  tasks: 3
  files_touched: 4
requirements: [I18N-02]
---

# Phase 07 Plan 02: Async Bootstrap for i18n and Settings Cache — Summary

**One-liner:** Single cold-start bootstrap() awaits i18n init + /api/settings before ReactDOM renders, eliminating the DE→EN language flash and seeding TanStack cache for zero-duplicate-fetch App mount.

## What Shipped

Three atomic commits landing the Phase 7 I18N-02 groundwork:

1. **`frontend/src/i18n.ts`** — removed hardcoded `lng: "de"`; exports `i18nInitPromise` for defensive awaits. i18next now falls back to `fallbackLng: "en"` until bootstrap calls `changeLanguage()`. `keySeparator: false` preserved.

2. **`frontend/src/bootstrap.ts`** (new) — idempotent `async function bootstrap()` guarded by module-level `bootstrapPromise`. Flow: await `i18nInitPromise` → `fetchSettings()` (reused from `lib/api.ts`, D-05) → `i18n.changeLanguage(settings.default_language.toLowerCase())` + `queryClient.setQueryData(["settings"], settings)` (D-06). On error: `console.warn` + fallback `changeLanguage("en")` (D-04), no rethrow, no DEFAULT_SETTINGS seed.

3. **`frontend/src/main.tsx`** — top-level `await bootstrap()` before `ReactDOM.createRoot().render()`. Vite 8 transpiles TLA for modern browsers. `frontend/index.html` — CSS-only splash (`.bootstrap-splash` with pulsing dots) placed INSIDE `#root` so React's first commit atomically replaces it. Splash is text-free to avoid mis-localized app-name flash.

Prerequisite noted during execution: `frontend/src/queryClient.ts` (shared singleton) was already extracted in the parallel Task 2 landing — App.tsx's inline `new QueryClient()` was moved out so bootstrap and App share the same instance (D-06 correctness).

## Commits

- `693477e` refactor(07-02): remove hardcoded lng from i18n.ts and export init promise
- `29f553d` feat(07-02): add async bootstrap() with shared queryClient singleton
- `dd152da` feat(07-02): block first paint on bootstrap() and add CSS splash

## Verification

- `cd frontend && npx tsc -b` — passes
- `cd frontend && npm run build` — passes (Vite transpiles top-level await; 310ms build, 1.05 MB bundle)
- All acceptance criteria for Tasks 1–3 satisfied:
  - `i18nInitPromise` exported, no `lng:` literal in i18n.ts
  - `bootstrap.ts` reuses `fetchSettings`, seeds cache, falls back on error, idempotency guard present
  - `main.tsx` has `await bootstrap()`; `index.html` shows `bootstrap-splash` inside `#root`

## Deviations from Plan

**None.** Plan executed exactly as written. The `queryClient.ts` extraction referenced by D-06 was landed as part of the Task 2 commit (parallel execution) rather than a separate deviation — the plan anticipated this via the `read_first` pointer to `frontend/src/queryClient.ts`.

## Success Criteria

- [x] i18n.ts no longer hardcodes `lng`
- [x] bootstrap.ts is the single cold-start i18n writer, reuses `fetchSettings`, seeds cache, falls back on error
- [x] main.tsx awaits `bootstrap()` before `createRoot().render()`
- [x] index.html shows a pure-CSS splash that React atomically replaces
- [x] `npm run build` succeeds

## Known Stubs

None.

## Self-Check: PASSED

Verified:
- `frontend/src/bootstrap.ts` exists
- `frontend/src/queryClient.ts` exists (shared singleton)
- `i18nInitPromise` present in `i18n.ts`
- `await bootstrap` present in `main.tsx`
- `bootstrap-splash` present in `index.html`
- Commits `693477e`, `29f553d`, `dd152da` found in `git log`
- `npx tsc -b` and `npm run build` both exit 0
