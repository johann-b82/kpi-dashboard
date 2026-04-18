---
phase: 07-i18n-integration-and-polish
plan: 04
subsystem: frontend/i18n
tags: [i18n, navbar, settings, tanstack-query, toast]
requirements: [I18N-01]
dependency-graph:
  requires: ["07-03"]
  provides: ["I18N-01 cross-cut (NavBar writer)"]
  affects: ["frontend/src/components/LanguageToggle.tsx"]
tech-stack:
  added: []
  patterns:
    - "TanStack useMutation with queryClient.getQueryData for full-payload PUT"
    - "Pessimistic runtime state update (i18n.changeLanguage after onSuccess)"
    - "Context-driven disable (useSettingsDraftStatus) instead of route sniffing"
key-files:
  created: []
  modified:
    - frontend/src/components/LanguageToggle.tsx
decisions:
  - "Use err.message (already formatted by updateSettings via formatDetail internally) instead of importing formatDetail — matches existing SettingsPage.handleSave pattern; formatDetail is module-private in lib/api.ts"
  - "useSettings() is called for cache-subscription side-effect only; payload is read from queryClient.getQueryData to keep payload derivation inside mutationFn"
metrics:
  duration: "2min"
  tasks: 1
  files: 1
  completed: 2026-04-11
---

# Phase 7 Plan 4: NavBar LanguageToggle Persistence Summary

Rewrote the NavBar `LanguageToggle` from an ephemeral `i18n.changeLanguage` shim into a persisting, immediate-PUT control that writes the full 8-field settings payload and reflects the Settings page's dirty state via context.

## What Shipped

- **Persisting toggle:** Clicking DE/EN on any non-Settings route fires `PUT /api/settings` with the 8 required fields read from the TanStack cache. On success, the response is written back to `['settings']`, `i18n.changeLanguage(nextLang.toLowerCase())` is called, and `toast.success` fires.
- **Dirty-aware disable:** On `/settings` with `useSettingsDraftStatus().isDirty === true`, the button is `disabled` and carries the i18n `title` `"Save or discard changes first"`. `SettingsPage` already clears dirty on unmount (07-03 D-14), so non-Settings routes re-enable automatically without any `useLocation` sniffing.
- **Single-writer invariant preserved:** Mutation reads current settings from the cache (no `DEFAULT_SETTINGS` fallback); if the cache is empty it throws and the error toast fires rather than clobbering other user-edited fields with baseline colors.
- **Pessimistic update:** The runtime language never flips until the server acknowledges the PUT. On error, the toast carries the backend `detail` (already unwrapped by `updateSettings` via module-private `formatDetail`) and the language stays put.

## Acceptance Criteria

All grep probes pass (useMutation, updateSettings, useSettingsDraftStatus, i18n.changeLanguage, toast.success/error, toggle_disabled_tooltip, getQueryData, aria-disabled present; DEFAULT_SETTINGS and asChild absent). `npx tsc -b && npm run build` both green.

## Deviations from Plan

**None blocking.** Plan text called for `formatDetail(err)` imported from `lib/api.ts`, but `formatDetail` is module-private (not exported). Used `err instanceof Error ? err.message : "Unknown error"` to match the existing pattern in `SettingsPage.handleSave` — this works because `updateSettings()` already calls `formatDetail` internally before throwing, so `err.message` is the pre-formatted detail string. No export change was needed, and this keeps the error surface identical to Phase 6's Save flow.

## Key Decisions

1. **`err.message` over re-importing `formatDetail`** — avoids touching `lib/api.ts` exports and keeps the new toast wiring byte-identical to the Phase 6 `handleSave` pattern (`SettingsPage.tsx:88-90`).
2. **`useSettings()` called for its subscription side-effect** — the hook's return value isn't read (payload comes from `queryClient.getQueryData` inside `mutationFn`), but calling it subscribes the component so the bold/muted DE-vs-EN visual updates whenever any other writer (SettingsPage save, bootstrap cold-start) mutates the cache.
3. **No `useLocation` import** — `SettingsPage` unmount already clears `isDirty`, so context is the single source of truth for the disable state; route sniffing would have been redundant and would have duplicated the condition.

## Self-Check: PASSED

- FOUND: frontend/src/components/LanguageToggle.tsx
- FOUND commit: bfe40a2
