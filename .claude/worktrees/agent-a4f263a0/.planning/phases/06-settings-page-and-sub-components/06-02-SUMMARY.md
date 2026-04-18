---
phase: 06-settings-page-and-sub-components
plan: "02"
subsystem: ui
tags: [react, hooks, tanstack-query, oklch, hex, state-machine, unsaved-guard, typescript]

requires:
  - phase: 06-settings-page-and-sub-components
    plan: "01"
    provides: color.ts (hexToOklch/oklchToHex), api.ts (updateSettings, SettingsUpdatePayload), defaults.ts (DEFAULT_SETTINGS)

provides:
  - useSettingsDraft hook: draft+snapshot state machine, setField with live-preview cache writes, save/discard/resetToDefaults
  - DraftFields interface: 8-field editable type with hex color storage
  - UseSettingsDraftReturn interface: full return shape for plan 04 SettingsPage
  - useUnsavedGuard hook: beforeunload + capture-click + popstate listener installer

affects:
  - 06-03-sub-components (imports DraftFields for prop types)
  - 06-04-settings-page (consumes both hooks directly)

tech-stack:
  added: []
  patterns:
    - "Draft+snapshot pattern: snapshot set once on first data load; only save/resetToDefaults rotate it"
    - "Live preview via queryClient.setQueryData(['settings'], ...) — ThemeProvider owns the DOM write"
    - "Hex-in-draft, oklch-on-wire: DraftFields stores hex; PUT payload converts via hexToOklch"
    - "Capture-phase click intercept for wouter nav guard (wouter 3.9.0 has no useBlocker)"
    - "popstate sentinel '__back__' pattern: push state back, fire dialog, caller handles confirm"

key-files:
  created:
    - frontend/src/hooks/useSettingsDraft.ts
    - frontend/src/hooks/useUnsavedGuard.ts
  modified: []

key-decisions:
  - "Removed COLOR_KEYS and ColorKey type from useSettingsDraft.ts — unused by hook logic and caused tsc TS6133/TS6196 errors under strict noUnusedLocals"

metrics:
  duration: 2min
  completed: 2026-04-11
  tasks: 2
  files: 2
---

# Phase 06 Plan 02: State-Management Hooks Summary

**useSettingsDraft and useUnsavedGuard implemented: draft+snapshot hex/oklch state machine with live-preview cache writes and three-listener unsaved-changes guard**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-11T16:21:18Z
- **Completed:** 2026-04-11T16:23:21Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- `useSettingsDraft` created: holds a hex-in-draft snapshot machine; `setField` synchronously writes oklch to the `["settings"]` TanStack Query cache so ThemeProvider's `applyTheme` fires instantly (live preview); `save()` converts hex→oklch via `draftToPutPayload`, calls `updateSettings`, rotates snapshot to response on success; failed save preserves draft (D-10/UX-02); `discard()` restores draft+cache from snapshot; `resetToDefaults()` PUTs DEFAULT_SETTINGS verbatim (D-12)
- `useUnsavedGuard` created: installs three listeners (`beforeunload`, document capture-click, `popstate`) only while `isDirty === true`; removes all on cleanup; scope-guards against intra-/settings interactions via `href === "/settings"` check; uses `"__back__"` sentinel for popstate
- Both files typecheck clean (`tsc -b` passes)
- Build (`npm --prefix frontend run build`) passes clean

## Task Commits

1. **Task 1: Create useSettingsDraft.ts** — `7da79c5`
2. **Task 2: Create useUnsavedGuard.ts** — `0a80be8`

## Export Signatures (for downstream plan executors)

### frontend/src/hooks/useSettingsDraft.ts

```typescript
export interface DraftFields {
  color_primary: string;      // hex "#rrggbb" in draft
  color_accent: string;
  color_background: string;
  color_foreground: string;
  color_muted: string;
  color_destructive: string;
  app_name: string;
  default_language: "DE" | "EN";
}

export interface UseSettingsDraftReturn {
  isLoading: boolean;
  isError: boolean;
  draft: DraftFields | null;       // null while initial data loads
  snapshot: DraftFields | null;    // null while initial data loads
  isDirty: boolean;
  isSaving: boolean;
  setField: <K extends keyof DraftFields>(field: K, value: DraftFields[K]) => void;
  save: () => Promise<void>;       // re-throws on API error — caller catches for toast
  discard: () => void;
  resetToDefaults: () => Promise<void>;
}

export function useSettingsDraft(): UseSettingsDraftReturn;
```

**Key behaviors:**
- Draft stores hex colors (for HexColorPicker); PUT payload converts to oklch via `hexToOklch`
- `setField` does a best-effort cache write: silently skips if hex→oklch throws (mid-type partial hex), but stores the partial value in draft for input continuity
- `save()` does NOT catch errors — caller wraps in `try/catch` and fires `toast.error`; draft is NOT reverted on failure (UX-02)
- Snapshot is only rotated by `save()` (to response body) and `resetToDefaults()` (to response body); NOT by background refetches of the query

### frontend/src/hooks/useUnsavedGuard.ts

```typescript
export function useUnsavedGuard(
  isDirty: boolean,
  onShowDialog: (to: string) => void,
): void;
```

**Caller contract:**
- Provide stable `onShowDialog` via `useCallback` — effect deps include it; unstable reference causes reinstall on every render
- Hook never stores "pending navigation" internally — the caller tracks pending destination in its own state when `onShowDialog` fires
- Sentinel `"__back__"`: fired when `popstate` detected the user went back/forward. The hook pushes `/settings` back onto history before firing. On "confirm leave" the caller should call `window.history.go(-2)` (once for the hook's push, once for the actual back navigation) and then discard the draft
- On "cancel leave": no action needed — history is already on `/settings` and the dialog simply closes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused COLOR_KEYS and ColorKey declarations**
- **Found during:** Task 1 (first build attempt)
- **Issue:** `COLOR_KEYS` constant and `ColorKey` type from the plan's code snippet were not used anywhere in the hook logic. TypeScript `noUnusedLocals` emitted TS6133 and TS6196 errors.
- **Fix:** Removed both declarations. The hook iterates individual field names inline (in the helper functions) rather than from the constant — no behavior change.
- **Files modified:** `frontend/src/hooks/useSettingsDraft.ts`
- **Commit:** `7da79c5`

## Known Stubs

None — this plan creates pure hooks with no UI rendering.

---
*Phase: 06-settings-page-and-sub-components*
*Completed: 2026-04-11*
