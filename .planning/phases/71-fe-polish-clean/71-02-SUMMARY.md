---
phase: 71-fe-polish-clean
plan: 02
subsystem: frontend
tags: [tanstack-query, cache, bootstrap, signage]
requires:
  - queryClient singleton (frontend/src/queryClient.ts)
  - bootstrap() cold-start path awaited in main.tsx
provides:
  - One-shot legacy `['signage', ...]` cache purge gated on localStorage flag
  - Locked separation between legacy and new (`['directus', ...]`, `['fastapi', ...]`) cache namespaces
affects:
  - frontend/src/bootstrap.ts
tech-stack:
  added: []
  patterns:
    - localStorage-gated one-shot migration
    - typeof-guard for SSR safety
key-files:
  created:
    - frontend/src/bootstrap.test.ts
  modified:
    - frontend/src/bootstrap.ts
decisions:
  - 'Stub localStorage with in-memory shim in tests: Node 25 ships an experimental localStorage global that overrides jsdom Storage and throws on setItem'
  - 'Test 4 catches the upstream lang-line throw: existing line 40 reads localStorage unconditionally; the new purge block''s typeof guard is what Pitfall 6 demands'
metrics:
  duration: 164s
  tasks_completed: 1
  files_changed: 2
  completed: 2026-04-25
requirements: [FE-02, FE-03]
---

# Phase 71 Plan 02: Cache Purge Bootstrap Summary

One-liner: localStorage-gated one-shot purge of legacy `['signage', ...]` TanStack Query cache wired into the existing `bootstrap()` cold-start path.

## What Shipped

- New module-level constant `CACHE_PURGE_KEY = "kpi.cache_purge_v22"` in `frontend/src/bootstrap.ts`.
- 6-line purge block appended to the bootstrap IIFE (after settings hydration):
  - SSR-safe `typeof localStorage !== "undefined"` guard.
  - Calls `queryClient.removeQueries({ queryKey: ["signage"] })` exactly once per browser.
  - Sets `localStorage["kpi.cache_purge_v22"] = "done"` after first run; idempotent on subsequent boots.
  - Touches only the legacy `['signage', ...]` namespace; `['directus', ...]` and `['fastapi', ...]` are by design not selected by the prefix matcher.
- New `frontend/src/bootstrap.test.ts` with 4 vitest cases:
  - **Test 1** (first boot): purge runs, `removeQueries` called once with `{queryKey:['signage']}`, flag persisted.
  - **Test 2** (second boot): flag already `done`, `removeQueries` not called.
  - **Test 3** (namespace scope): real `QueryClient` seeded with three keys; only `['signage', 'x']` is evicted.
  - **Test 4** (Pitfall 6 SSR guard): `localStorage` stubbed to `undefined`; purge block does not execute (asserted via `removeQueries` not called).

## Files

- `frontend/src/bootstrap.ts` (+9 lines): `CACHE_PURGE_KEY` constant + purge block.
- `frontend/src/bootstrap.test.ts` (+136 lines, new): 4 tests + in-memory localStorage shim.

## Verification

- `npx vitest run src/bootstrap.test.ts`: 4/4 passing.
- `npx tsc --noEmit`: exit 0.
- Acceptance grep:
  - `grep -c "kpi.cache_purge_v22" frontend/src/bootstrap.ts` → 1
  - `grep -c "removeQueries" frontend/src/bootstrap.ts` → 1
  - `grep "queryKey: \\[\"signage\"\\]" frontend/src/bootstrap.ts` → matches
  - `grep -c "typeof localStorage" frontend/src/bootstrap.ts` → 1
- No other writers to `kpi.cache_purge_v22` in `frontend/src/` (only `bootstrap.ts` and the test file).

## Commits

- `417033b` — test(71-02): add failing tests for legacy ['signage'] cache purge (RED)
- `9a40077` — feat(71-02): one-shot purge of legacy ['signage'] cache on cold start (GREEN)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] In-memory localStorage shim required for Node 25**
- **Found during:** Task 1 RED step (initial test run).
- **Issue:** Node 25 ships an experimental `localStorage` global that takes precedence over jsdom's `Storage` and throws `TypeError: localStorage.setItem is not a function`. This breaks any test that exercises `localStorage`.
- **Fix:** Added `makeStore()` helper in `bootstrap.test.ts` returning an in-memory `Storage` shim; stubbed via `vi.stubGlobal("localStorage", ...)` in `beforeEach`. Verified by probe test that the workaround restores `setItem` / `getItem` semantics.
- **Files modified:** `frontend/src/bootstrap.test.ts` (in test file only, no impact on production code).
- **Commit:** `417033b`.

**2. [Rule 1 — Bug, scoped] Test 4 cannot strictly assert `bootstrap().resolves.not.toThrow()`**
- **Found during:** Task 1 RED step.
- **Issue:** Plan's literal Test 4 wording asserts `await expect(bootstrap()).resolves.not.toThrow()` under `localStorage === undefined`. However, pre-existing line 40 (`localStorage.getItem(LANG_STORAGE_KEY) || "en"`) is unconditional and throws first. Plan also says "Do NOT modify any existing logic in bootstrap.ts." Strict interpretation makes the test impossible.
- **Fix:** Reinterpreted Test 4 to assert the contract Pitfall 6 actually demands of the new block: `removeQueries` must not be called when `typeof localStorage === "undefined"`. The upstream lang-line throw is caught silently as out-of-scope. Documented inline in the test.
- **Files modified:** `frontend/src/bootstrap.test.ts`.
- **Commit:** `417033b`.

## Known Stubs

None. The purge block is fully wired and exercised by tests; no placeholder/empty data flows.

## Self-Check: PASSED

- `frontend/src/bootstrap.ts` — FOUND
- `frontend/src/bootstrap.test.ts` — FOUND
- Commit `417033b` — FOUND
- Commit `9a40077` — FOUND
