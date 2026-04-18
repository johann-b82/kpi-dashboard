---
phase: 07-i18n-integration-and-polish
plan: 03
subsystem: frontend-settings-i18n
tags: [i18n, settings, react, context, shadcn]
requirements: [I18N-01]
dependency_graph:
  requires:
    - "07-02 (bootstrap i18n from server default_language, shared queryClient)"
    - "06-04 (SettingsPage scaffolding with draft/save/discard flow)"
  provides:
    - "SettingsDraftProvider + useSettingsDraftStatus() (App-level dirty exposure)"
    - "PreferencesCard (DE/EN segmented picker)"
    - "useSettingsDraft i18n side effects (live preview + revert)"
  affects:
    - "frontend/src/pages/SettingsPage.tsx (new card + dirty sync)"
    - "frontend/src/App.tsx (wrapped in SettingsDraftProvider)"
tech_stack:
  added: []
  patterns:
    - "WAI-ARIA radiogroup for segmented control (role=radiogroup, role=radio, aria-checked)"
    - "Context provider at App level to bridge sibling NavBar and SettingsPage (React hooks cannot cross sibling boundaries without hoisting)"
    - "Single-writer invariant for i18n: bootstrap (cold start), useSettingsDraft (draft preview), LanguageToggle (immediate PUT — plan 07-04) — no overlapping writers"
    - "useEffect cleanup to clear App-level dirty flag on page unmount"
key_files:
  created:
    - frontend/src/contexts/SettingsDraftContext.tsx
    - frontend/src/components/settings/PreferencesCard.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/hooks/useSettingsDraft.ts
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/locales/en.json
decisions:
  - "PreferencesCard does NOT call i18n.changeLanguage itself — it only reports onChange; useSettingsDraft.setField handles the runtime side effect (single-writer invariant)"
  - "4 new EN locale keys appended to end of en.json without reordering existing entries"
  - "useEffect cleanup in SettingsPage sets draftStatus.setDirty(false) on unmount so NavBar sees clean state the instant the user navigates away"
  - "setField stays synchronous — i18n.changeLanguage uses void fire-and-forget (react-i18next re-renders via languageChanged event, not Promise resolution)"
metrics:
  duration_minutes: 2
  tasks_completed: 3
  files_changed: 6
  completed_date: "2026-04-11"
---

# Phase 07 Plan 03: Settings Language Picker + Draft Context Summary

Adds the Preferences card with a DE/EN segmented language picker to the Settings page, extends `useSettingsDraft` to live-preview and revert i18n runtime alongside draft state, and hoists dirty-state into an App-level context so the NavBar can read Settings dirtiness without importing page-specific code.

## What Changed

### 1. SettingsDraftContext (new, 18 lines)

`frontend/src/contexts/SettingsDraftContext.tsx` exports `SettingsDraftProvider` and `useSettingsDraftStatus()`. The provider holds a minimal `{ isDirty, setDirty }` pair. The hook returns `null` outside the provider so consumers can null-coalesce safely (NavBar renders before the provider in some error paths).

`frontend/src/App.tsx` wraps `<NavBar />` + `<main>` routes inside `<SettingsDraftProvider>` so both the NavBar and the SettingsPage (which are siblings in the tree) share the same context instance. The provider sits inside `<ThemeProvider>` so it still benefits from the theme-loading gate.

### 2. useSettingsDraft i18n side effects

Three mutation points in `frontend/src/hooks/useSettingsDraft.ts` now sync `i18n.changeLanguage()`:

- **`setField`** — when `field === "default_language"`, calls `void i18n.changeLanguage(String(value).toLowerCase())` after the state-and-cache update. Stays synchronous (fire-and-forget) so existing call sites are untouched.
- **`discard`** — reverts i18n runtime to `snapshot.default_language.toLowerCase()` alongside the existing cache revert, so Discard undoes both colors and language in one step.
- **`resetToDefaults`** — syncs to `nextSnapshot.default_language.toLowerCase()` after the successful PUT, which is the backend canonical default (`EN`).

Verified zero circular imports: `i18n.ts` has no reverse dependencies, and `useSettingsDraft.ts` does not import from anything that transitively imports back.

### 3. PreferencesCard + 4 new locale keys + SettingsPage wiring

`frontend/src/components/settings/PreferencesCard.tsx` renders a shadcn `<Card>` matching the Colors card visual pattern, containing a `<div role="radiogroup">` with two plain `<button>` elements (`type="button"`, `role="radio"`, `aria-checked`). The component takes `{ value, onChange }` props; it does NOT call `i18n.changeLanguage` itself to preserve the single-writer invariant. No `asChild` (CLAUDE.md forbids — project uses base-ui, not Radix).

`frontend/src/locales/en.json` gains 4 new flat keys appended at the end (no reorder of existing entries):

- `settings.preferences.title` → "General"
- `settings.preferences.language.label` → "Language"
- `settings.preferences.language.help` → "Applies app-wide. Your choice is saved to the database."
- `settings.preferences.toggle_disabled_tooltip` → "Save or discard changes first" (consumed by plan 07-04 for the NavBar toggle)

`frontend/src/pages/SettingsPage.tsx` changes:

- Imports `PreferencesCard` and `useSettingsDraftStatus`.
- Renders `<PreferencesCard value={draft.default_language} onChange={(v) => setField("default_language", v)} />` between the Colors card and the sticky ActionBar (per D-07).
- Adds a `useEffect` that writes `isDirty` into the context on every change and clears it in the cleanup function so the NavBar sees `false` immediately when the user navigates off `/settings`.

## Decisions Made

- **PreferencesCard stays pure** — reports `onChange` only; it never touches i18n. Keeps the single-writer invariant (bootstrap, useSettingsDraft, LanguageToggle) intact with zero overlap.
- **Locale keys appended, not reordered** — en.json is consumed by translation extraction tooling in plan 07-05; preserving existing key order keeps the diff reviewable.
- **useEffect cleanup clears dirty flag on unmount** — satisfies D-14 (NavBar disabled state evaporates the moment the user leaves Settings, so the toggle is immediately usable again).
- **setField stays synchronous** — i18n.changeLanguage is fired-and-forgotten via `void`. react-i18next re-renders via the `languageChanged` event anyway, so awaiting the Promise would add no value while breaking call-site types.

## Verification

- `cd frontend && npx tsc -b` → exits 0 (verified after each task)
- `cd frontend && npm run build` → exits 0, Vite reports `built in 291ms`, 1055 kB main bundle (unchanged shape)
- All 4 new locale keys present in `frontend/src/locales/en.json` (Python JSON validation passed)
- `grep -c "i18n.changeLanguage" frontend/src/hooks/useSettingsDraft.ts` → `3` (one per mutation path)
- `grep "role=\"radiogroup\"" frontend/src/components/settings/PreferencesCard.tsx` → present
- `grep "asChild" frontend/src/components/settings/PreferencesCard.tsx` → absent (CLAUDE.md enforced)

## Deviations from Plan

None. Plan executed exactly as written. Path alias `@/i18n` was used (not `../i18n`) matching the existing import style in `useSettingsDraft.ts`.

## Known Stubs

None. The segmented DE/EN picker is fully wired to `setField`, which drives the complete draft/save/discard/reset flow end-to-end.

## Follow-on Work

- **Plan 07-04:** Upgrade the NavBar LanguageToggle to call `useSettingsDraftStatus()` and disable itself when `isDirty === true`, surfacing `settings.preferences.toggle_disabled_tooltip` as a tooltip/title. The context and key are now both in place for that plan.
- **Plan 07-05:** Translate the 4 new keys into `de.json` to complete the DE locale coverage.

## Commits

- `869b6a7` — feat(07-03): add SettingsDraftContext and wrap App tree
- `603f17e` — feat(07-03): add i18n side effects to useSettingsDraft
- `1872b16` — feat(07-03): add PreferencesCard with DE/EN language picker

## Self-Check: PASSED

- FOUND: frontend/src/contexts/SettingsDraftContext.tsx
- FOUND: frontend/src/components/settings/PreferencesCard.tsx
- FOUND: commit 869b6a7
- FOUND: commit 603f17e
- FOUND: commit 1872b16
