---
phase: 55-consolidated-form-controls
plan: 05
subsystem: frontend-ui-migrations
tags: [select, migration, ctrl-02, form-controls]
requires:
  - frontend/src/components/ui/select.tsx
provides: []
affects:
  - frontend/src/signage/components/ScheduleEditDialog.tsx
  - frontend/src/signage/components/PlaylistItemList.tsx
  - frontend/src/components/settings/sensors/SnmpWalkCard.tsx
  - frontend/src/components/settings/PersonioCard.tsx
  - frontend/src/signage/components/ScheduleEditDialog.test.tsx
tech_stack:
  added: []
  patterns:
    - base-ui-select-consumer
    - vi.mock-shim-for-jsdom-select
key_files:
  created: []
  modified:
    - frontend/src/signage/components/ScheduleEditDialog.tsx
    - frontend/src/signage/components/PlaylistItemList.tsx
    - frontend/src/components/settings/sensors/SnmpWalkCard.tsx
    - frontend/src/components/settings/PersonioCard.tsx
    - frontend/src/signage/components/ScheduleEditDialog.test.tsx
decisions:
  - "ScheduleEditDialog placeholder option <option value=\"\"> collapsed into <SelectValue placeholder=...> — base-ui Select cannot emit an empty value, so the initial placeholder_id=\"\" state renders the placeholder text while keeping the existing 'playlist_required' validator behaviour."
  - "ScheduleEditDialog test file uses vi.mock to shim @/components/ui/select into a native <select> — base-ui Select popup cannot be opened in jsdom (same constraint documented in 55-02 SUMMARY). Shim forwards trigger props (id, aria-invalid, onBlur) via ref so existing fireEvent.change/blur semantics are preserved."
metrics:
  duration: 313s
  tasks: 3
  files: 5
  completed: 2026-04-21
requirements:
  - CTRL-02
---

# Phase 55 Plan 05: Migrate Raw <select> to Select Primitive Summary

One-liner: All four consumer files using raw `<select>` now import `Select` + friends from `@/components/ui/select`; `<option>` round-trips to `<SelectItem>` with values + labels preserved; CTRL-02 invariant for `<select>` closed.

## Files Migrated

| File | Raw `<select>` count before | After | Notes |
|------|-----------------------------|-------|-------|
| `frontend/src/signage/components/ScheduleEditDialog.tsx` | 1 | 0 | Playlist picker; empty option collapsed into `placeholder` |
| `frontend/src/signage/components/PlaylistItemList.tsx` | 1 | 0 | Transition fade/cut picker (migration coalesced with parallel 55-04 commit `6ef6847`) |
| `frontend/src/components/settings/sensors/SnmpWalkCard.tsx` | 2 | 0 | Target-sensor + field (`temperature_oid`/`humidity_oid`) pickers |
| `frontend/src/components/settings/PersonioCard.tsx` | 1 | 0 | Sync-interval picker (0/1/6/24h); existing number⇄string coercion retained |

## Value-coercion Introduced

- **PersonioCard**: already coerced `number ⇄ String(value)` before the migration; kept as-is because base-ui Select expects string values and `setField` stores the parsed `0 | 1 | 6 | 24` union.
- **PlaylistItemList**: `v as PlaylistItemTransition` cast on `onValueChange` (was previously `e.target.value as PlaylistItemTransition`).
- **SnmpWalkCard**: `v as WalkField` cast on field picker's `onValueChange` (was previously `e.target.value as WalkField`).

No runtime value-shape changes. All option `value`s remain the same strings as before.

## Behavioral Changes

- **ScheduleEditDialog playlist select**: previously rendered an explicit `<option value="">` placeholder as a real selectable option. After migration, the "empty" state is represented purely by `playlist_id === ""` in component state, and the `SelectValue` displays the placeholder translation. Users can no longer re-select "none" after picking a playlist through the UI (the popup has no empty item). This is an improvement — an explicit "none" selection was never valid (always tripped `playlist_required`).

## UI-SPEC Grep Invariant #3 — Confirmed

```
cd frontend && rg --count-matches "<select[\s>]" src \
  --glob '!src/components/ui/**' --glob '!**/*.test.tsx'
```

Result: **0 matches**. CTRL-02 grep invariant for `<select>` holds repo-wide.

Comment-only occurrences in `ScheduleEditDialog.test.tsx` (3) are inside JS comments, not JSX; test-file carve-out per RESEARCH §Migration Audit is respected.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] ScheduleEditDialog.test.tsx broke after component migration**
- **Found during:** Task 1 verification (post-migration `vitest run`).
- **Issue:** Test file drives playlist select via `screen.getByRole("combobox")` / `screen.getByRole("option")` / `fireEvent.change` / `fireEvent.blur`. After the component switched to base-ui `Select`, the trigger is a `<button>`, options live in a portal popup that jsdom cannot open (backdrop blocks pointer — same limitation 55-02 documented as a skipped test).
- **Fix:** Added a `vi.mock("@/components/ui/select", …)` block at the top of the test file that replaces the Select primitive with a native-`<select>` shim. The shim:
  - Renders a native `<select>` with the same `value`/`onValueChange` wiring.
  - Captures `SelectTrigger`'s rest props (including `onBlur`, `id`, `aria-invalid`) via a ref and spreads them onto the underlying `<select>` element, so existing `fireEvent.blur(getSelect())` continues to fire the component's onBlur handler.
  - Renders `<SelectItem>` as native `<option>`.
  This preserves the Phase 55 RESEARCH §Migration Audit carve-out ("ScheduleEditDialog.test.tsx keeps raw `<select>` for test fixtures") — the raw `<select>` now lives in a test-local mock rather than the production component tree.
- **Files modified:** `frontend/src/signage/components/ScheduleEditDialog.test.tsx`.
- **Commit:** `88d1280`.

### Out-of-scope (Not Fixed)

- Pre-existing Playwright E2E test file (`tests/e2e/branding.spec.ts` or similar) reported failure in full `vitest run`. Not related to this migration; the test uses `page.goto("/settings")` which requires a running server. Logged here, not fixed.

## Parallel-execution Coalesce

- Task 1's `PlaylistItemList.tsx` edits overlapped with parallel wave plan `55-04-migrate-raw-button` (commit `6ef6847`). The 55-04 executor already contained my Select migration at its commit time and additionally fixed a parallel-introduced implicit-any on the `onValueChange` handler. No rework needed; verified post-hoc that:
  - `PlaylistItemList.tsx` imports `Select` + friends.
  - `<select>` count = 0 in the file.
  - `tsc --noEmit` clean.

## Consumer Impact

- All four consumer files now reference the Wave 1 Select primitive.
- DE/EN i18n untouched (no new keys).
- Existing validators/mutations unchanged.

## Requirements Addressed

- **CTRL-02:** Raw `<select>` element-type invariant closes. Repo-wide grep confirms 0 raw `<select>` outside `ui/` and `*.test.tsx`.

## Commits

- `88d1280` feat(55-05): migrate signage raw `<select>` to Select primitive
- `6ef6847` (parallel 55-04) — contains the PlaylistItemList Select migration plus drag-handle Button migration
- `2395de5` feat(55-05): migrate settings raw `<select>` to Select primitive

## Self-Check: PASSED

- `frontend/src/signage/components/ScheduleEditDialog.tsx` — migrated (verified `<select>`/`<option>` counts = 0)
- `frontend/src/signage/components/PlaylistItemList.tsx` — migrated (verified via post-hoc read after parallel commit)
- `frontend/src/components/settings/sensors/SnmpWalkCard.tsx` — migrated (verified)
- `frontend/src/components/settings/PersonioCard.tsx` — migrated (verified)
- `frontend/src/signage/components/ScheduleEditDialog.test.tsx` — shim added; 8/8 tests pass
- Commits `88d1280`, `2395de5` — present in `git log`
- UI-SPEC grep invariant #3 — 0 matches
- `tsc --noEmit` — clean for all migrated files
- `vitest run` — 117 passed, 1 skipped (plus 1 pre-existing Playwright E2E failure, out of scope)
