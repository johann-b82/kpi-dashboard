---
phase: 05-frontend-plumbing-themeprovider-and-navbar
plan: 02
subsystem: frontend-theming-and-routing
tags: [frontend, react, theming, routing, i18n]
one_liner: "ThemeProvider gate injects 6 oklch CSS vars + document.title from useSettings, renders text-free skeleton while loading, falls back to DEFAULT_SETTINGS + toast on error; SettingsPage stub wired into /settings route inside the provider, Toaster kept outside."
requires:
  - frontend/src/hooks/useSettings.ts (Plan 05-01)
  - frontend/src/lib/defaults.ts (Plan 05-01 — DEFAULT_SETTINGS, THEME_TOKEN_MAP)
  - frontend/src/lib/api.ts (Plan 05-01 — Settings type)
  - frontend/src/locales/{en,de}.json (Plan 05-01 — theme.error_toast, settings.page_title_stub, settings.stub_body)
provides:
  - ThemeProvider component (loading gate + CSS var writer + title writer + error fallback)
  - SettingsPage stub (placeholder until Phase 6)
  - /settings route registered in App.tsx Switch
  - App-level ThemeProvider wrap (Toaster kept outside per D-03)
affects:
  - Plan 05-03 (NavBar — "Settings" link can navigate to /settings; brand rendering will live alongside this provider)
  - Phase 6 Settings page (will replace the stub page and mutate ['settings'] cache to re-trigger theme application)
tech-stack:
  added: []
  patterns:
    - "Single-writer theme application via root.style.setProperty iterating THEME_TOKEN_MAP (D-15)"
    - "useRef guard for one-shot error toast"
    - "Provider-wrap outside Switch, Toaster kept outside the gated subtree so toasts survive error state"
key-files:
  created:
    - frontend/src/components/ThemeProvider.tsx
    - frontend/src/pages/SettingsPage.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/tsconfig.app.json
decisions:
  - "Skeleton uses Loader2 + bg-muted only — no translated text, no brand literal, so Phase 5 Success Criterion #1 (no flash of old brand) holds even if i18n resolves late (D-02)"
  - "effective = data ?? (error ? DEFAULT_SETTINGS : undefined) keeps the useEffect dependency stable and ensures Phase 6 queryClient.setQueryData mutations retrigger applyTheme (D-13, D-15)"
  - "Toaster stays OUTSIDE ThemeProvider in App.tsx so the error-fallback toast renders even when ThemeProvider is gated on error (D-03)"
  - "[Rule 3 - Blocker] tsconfig.app.json gained ignoreDeprecations: \"6.0\" so tsc -b accepts the pre-existing baseUrl+paths combo required by the @/* alias; removing baseUrl alone broke module resolution (wouter, date-fns, react-day-picker)"
metrics:
  duration: "~2min"
  completed: "2026-04-11"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
requirements_touched: [BRAND-06]
---

# Phase 5 Plan 02: ThemeProvider and Routing Summary

## One-liner

ThemeProvider gate injects 6 oklch CSS vars + document.title from useSettings, renders text-free skeleton while loading, falls back to DEFAULT_SETTINGS + toast on error; SettingsPage stub wired into /settings route inside the provider, Toaster kept outside.

## Purpose

Delivers Phase 5 Success Criteria #1 (neutral skeleton, no flash of old brand), #3 (document.title mirrors stored app_name), and #4 (/settings route exists and renders a stub). Plan 05-03 will deliver Criterion #2 (NavBar logo/text) in the same wave and owns the human-verify checkpoint.

## What Shipped

### Task 1 — ThemeProvider component (commit ebf4cf4)

**Created `frontend/src/components/ThemeProvider.tsx`:**
- Imports `useSettings` (Plan 01), `DEFAULT_SETTINGS` + `THEME_TOKEN_MAP` (Plan 01), `Settings` type (Plan 01).
- `applyTheme(settings)` — single writer to `document.documentElement.style`. Iterates `THEME_TOKEN_MAP` keys and calls `root.style.setProperty(cssVar, settings[key])` for exactly the 6 tokens (D-11, D-15). Assigns `document.title = settings.app_name`.
- Component reads `{ data, isLoading, error }` from `useSettings`, derives `effective = data ?? (error ? DEFAULT_SETTINGS : undefined)`, and runs `applyTheme` in a `useEffect([effective])` so Phase 6 `queryClient.setQueryData(['settings'], draft)` mutations re-trigger theme application.
- Error toast fires exactly once via a `useRef` guard: `toast.error(t("theme.error_toast"))`.
- Loading branch renders a full-screen `bg-muted` div with `Loader2` spinner, `aria-hidden="true"`, `data-testid="theme-skeleton"`, and NO translated text and NO `children` (D-02). This guarantees no "KPI Light" literal or stale brand leaks during the fetch.
- File contains zero "KPI Light" literals (verified via `grep -c`).

Verification: `npx tsc --noEmit` clean; all 12 grep acceptance criteria pass.

### Task 2 — SettingsPage stub + App wiring (commit 134d3c2)

**Created `frontend/src/pages/SettingsPage.tsx`:**
- Named export (matches `DashboardPage`/`UploadPage` convention).
- Renders `<h1 className="text-2xl font-semibold leading-tight">{t("settings.page_title_stub")}</h1>` and a muted `<p>` with `{t("settings.stub_body")}` inside a `max-w-7xl mx-auto px-6 py-8` container — matches UI-SPEC §Typography exactly.

**Modified `frontend/src/App.tsx`:**
- Added imports for `SettingsPage` and `ThemeProvider`.
- Wrapped `<NavBar />` + `<main>` in `<ThemeProvider>…</ThemeProvider>`.
- Added `<Route path="/settings" component={SettingsPage} />` to the existing Switch (/, /upload preserved).
- `<Toaster position="top-right" />` stays OUTSIDE `</ThemeProvider>`, still inside `QueryClientProvider` per D-03 — verified via AWK check that the Toaster line appears after the closing provider tag.
- Provider nesting: `QueryClientProvider` (outermost) → `ThemeProvider` → NavBar/main/Switch, Toaster → end.

**Modified `frontend/tsconfig.app.json` (Rule 3 blocker fix):**
- Added `"ignoreDeprecations": "6.0"` so `tsc -b` no longer errors on the deprecated `baseUrl` directive (TS5101). Required to satisfy the Task 2 acceptance criterion `npm run build` exits 0.

Verification: `npx tsc --noEmit` clean, `npm run build` exits 0 (vite bundle `index-CBAoeBYE.js` = 979 kB — unrelated chunk-size warning pre-exists). All 11 grep acceptance criteria plus Toaster-outside check pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] tsc -b failed on pre-existing baseUrl deprecation**
- **Found during:** Task 2 verification (`npm run build`)
- **Issue:** `tsconfig.app.json(19,5): error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0.` The repo's TypeScript version now enforces the deprecation. Blocks the Task 2 acceptance criterion `cd frontend && npm run build` exits 0.
- **Fix:** Added `"ignoreDeprecations": "6.0"` to `frontend/tsconfig.app.json`'s compilerOptions. A cleaner "remove baseUrl entirely" approach was attempted first but broke module resolution for `wouter`, `date-fns`, and `react-day-picker` (the `paths` alias requires `baseUrl` in this bundler config), so it was reverted.
- **Files modified:** `frontend/tsconfig.app.json`
- **Commit:** `134d3c2`
- **Scope note:** The deprecation is pre-existing, but the acceptance criterion for this plan explicitly requires `npm run build` to exit 0, so the blocker applies to Plan 05-02's own contract.

**2. [Infrastructure] Ran `npm install` to materialize node_modules**
- **Found during:** Task 2 verification — `tsc -b` reported missing modules (`wouter`, `date-fns`, `react-day-picker`) although `package.json` declared them.
- **Fix:** `cd frontend && npm install` — lockfile was already in sync, 8 packages downloaded into `node_modules`. No `package.json` or `package-lock.json` changes.
- **Files modified:** None (node_modules is gitignored).
- **Note:** Not counted as a deviation because no tracked files changed; recorded here for execution transparency.

## Authentication Gates

None. Plan is pure frontend.

## Known Stubs

`SettingsPage.tsx` is intentionally a stub — its title and body come from the `settings.page_title_stub` / `settings.stub_body` locale keys planted in Plan 05-01, phrased as "available in Phase 6". Plan 05-03 will hyperlink the NavBar "Settings" action to this route; Phase 6 will replace the page body with real controls. This is documented, intentional scope.

No unintended stubs introduced.

## Integration Notes for Plan 05-03

Plan 03 (NavBar logo + Settings link + brand text) runs in the same wave and must not touch `App.tsx` or `ThemeProvider.tsx`. Plan 03 should:

- Import `useSettings()` for brand text and logo URL rendering.
- Use `nav.settings` locale key for the Settings link label (Plan 01).
- Navigate to `/settings` (now live) via wouter's `Link` or `useLocation`.
- Render under `<ThemeProvider>` — the provider already ensures CSS vars and `document.title` are up to date before NavBar paints.
- NavBar is the earliest place the final visible brand should appear. Because ThemeProvider blocks children while `isLoading`, the NavBar can rely on `useSettings().data` being defined at mount time (success path) or `DEFAULT_SETTINGS` via error fallback.

## Commits

- `ebf4cf4` — feat(05-02): add ThemeProvider with loading skeleton and CSS var injection
- `134d3c2` — feat(05-02): add SettingsPage stub and wire ThemeProvider + /settings route

## Self-Check: PASSED

- FOUND: frontend/src/components/ThemeProvider.tsx
- FOUND: frontend/src/pages/SettingsPage.tsx
- FOUND: frontend/src/App.tsx (modified — ThemeProvider wrap + /settings route)
- FOUND: frontend/tsconfig.app.json (modified — ignoreDeprecations)
- FOUND commit: ebf4cf4
- FOUND commit: 134d3c2
- `npx tsc --noEmit` exit 0
- `npm run build` exit 0
- No "KPI Light" literal in ThemeProvider.tsx (grep -c = 0)
- Toaster is outside `</ThemeProvider>` in App.tsx (verified via awk line-order check)
