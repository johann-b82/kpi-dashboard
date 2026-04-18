---
phase: 05-frontend-plumbing-themeprovider-and-navbar
plan: 01
subsystem: frontend-data-layer
tags: [frontend, typescript, tanstack-query, i18n, defaults]
one_liner: "Typed Settings contract, fetchSettings(), useSettings() TanStack Query hook, frontend defaults mirroring backend, and 4 new DE/EN locale keys — pure module code, zero UI."
requires:
  - frontend/src/lib/api.ts (existing uploadFile/getUploads pattern)
  - backend /api/settings endpoint (Phase 4)
  - backend/app/defaults.py (source of truth to mirror)
provides:
  - Settings TypeScript interface (matches backend SettingsRead)
  - fetchSettings() fetcher
  - DEFAULT_SETTINGS frozen object + THEME_TOKEN_MAP
  - useSettings() TanStack Query hook with queryKey ['settings']
  - Locale keys: nav.settings, theme.error_toast, settings.page_title_stub, settings.stub_body
affects:
  - Plan 05-02 (ThemeProvider consumes useSettings, THEME_TOKEN_MAP, DEFAULT_SETTINGS)
  - Plan 05-03 (NavBar consumes useSettings, locale keys)
  - Phase 6 Settings page (mutations will invalidate ['settings'] key)
tech-stack:
  added: []  # no new deps — uses existing @tanstack/react-query
  patterns:
    - "Interface + fetchX colocation in lib/api.ts"
    - "Thin TanStack Query hook wrapper in hooks/"
    - "Frozen DEFAULT_SETTINGS for error fallback"
key-files:
  created:
    - frontend/src/lib/defaults.ts
    - frontend/src/hooks/useSettings.ts
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
decisions:
  - "Defaults duplicated verbatim from backend/app/defaults.py (D-16 — no build-time cross-language import)"
  - "queryKey is exact literal ['settings'] so Plan 02 ThemeProvider and Phase 6 mutations can reference the same cache key (D-13)"
  - "staleTime + gcTime Infinity: settings fetched once, never auto-refetch (D-13)"
  - "nav.brand key preserved (D-18 — Phase 7 owns its removal)"
metrics:
  duration: "~5min"
  completed: "2026-04-11"
  tasks_completed: 2
  files_created: 2
  files_modified: 3
requirements_touched: [BRAND-03, BRAND-06]  # plumbed, not yet completed
---

# Phase 5 Plan 01: Frontend Plumbing Data Layer Summary

## One-liner

Typed Settings contract, fetchSettings(), useSettings() TanStack Query hook, frontend defaults mirroring backend, and 4 new DE/EN locale keys — pure module code, zero UI.

## Purpose

Establish the single source of truth for reading settings in the frontend before any UI work in Plans 02 and 03. Centralizing the type, fetcher, default palette, and new locale keys here prevents file-ownership conflicts when Wave 2 plans run.

## What Shipped

### Task 1 — Settings type, fetcher, defaults module (commit db387a1)

**Created `frontend/src/lib/defaults.ts`:**
- `DEFAULT_SETTINGS` — frozen `Settings` object with the exact 8 backend values plus `logo_url: null`, `logo_updated_at: null`. Used as error fallback when the settings fetch fails.
- `THEME_TOKEN_MAP` — const record mapping 6 Settings color fields to shadcn CSS variable names (`--primary`, `--accent`, `--background`, `--foreground`, `--muted`, `--destructive`). Consumed by Plan 02's ThemeProvider.

**Extended `frontend/src/lib/api.ts`:**
- `Settings` interface with all 10 fields matching backend `SettingsRead` (6 colors, app_name, default_language as `"DE" | "EN"`, logo_url, logo_updated_at).
- `fetchSettings()` — hits `/api/settings`, throws `Error("Failed to fetch settings")` on non-ok. Matches existing `fetchKpiSummary` / `getUploads` convention.

Verification: `npx tsc --noEmit` passes; 6 oklch literals present; all grep acceptance criteria pass.

### Task 2 — useSettings hook + locale keys (commit e1fb497)

**Created `frontend/src/hooks/useSettings.ts`:**
- `useSettings()` — TanStack Query wrapper with `queryKey: ["settings"]` (literal, per D-13), `queryFn: fetchSettings`, `staleTime: Infinity`, `gcTime: Infinity`, `retry: 1`. Thin wrapper per D-14.

**Extended both locale files with 4 keys each:**

| Key | en.json | de.json |
| --- | --- | --- |
| `nav.settings` | "Settings" | "Einstellungen" |
| `theme.error_toast` | "Could not load settings — showing defaults." | "Einstellungen konnten nicht geladen werden — Standardwerte werden angezeigt." |
| `settings.page_title_stub` | "Settings" | "Einstellungen" |
| `settings.stub_body` | "This page will be available in Phase 6." | "Diese Seite wird in Phase 6 verfügbar." |

Existing keys untouched (including `nav.brand`, per D-18). Both JSON files parse without error.

Verification: `npx tsc --noEmit` passes; node-based locale key validation confirms all 4 keys in both files.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The locale keys `settings.page_title_stub` and `settings.stub_body` are deliberately phrased as stubs — they will be rendered by a placeholder Settings route in Plan 05-03 and replaced by the real Settings page in Phase 6. This is documented intentional scope per the plan.

No other stubs or placeholder data paths introduced.

## Integration Notes for Wave 2

**Plan 05-02 (ThemeProvider)** should:
- Import `useSettings` from `@/hooks/useSettings`
- Import `DEFAULT_SETTINGS` and `THEME_TOKEN_MAP` from `@/lib/defaults`
- Iterate `THEME_TOKEN_MAP` to write CSS variables to `document.documentElement`
- On error state, fall back to `DEFAULT_SETTINGS` and show the `theme.error_toast` string

**Plan 05-03 (NavBar)** should:
- Import `useSettings` for brand/logo rendering
- Use `nav.settings` locale key for the Settings nav link
- Use `settings.page_title_stub` / `settings.stub_body` for the stub route

## Commits

- `db387a1` — feat(05-01): add Settings type, fetcher, and frontend defaults module
- `e1fb497` — feat(05-01): add useSettings hook and Phase 5 locale keys

## Self-Check: PASSED

- FOUND: frontend/src/lib/defaults.ts
- FOUND: frontend/src/hooks/useSettings.ts
- FOUND: frontend/src/lib/api.ts (extended with Settings + fetchSettings)
- FOUND: frontend/src/locales/en.json (4 new keys)
- FOUND: frontend/src/locales/de.json (4 new keys)
- FOUND commit: db387a1
- FOUND commit: e1fb497
- TypeScript compiles clean (`npx tsc --noEmit` exit 0)
- Both locale JSON files parse
