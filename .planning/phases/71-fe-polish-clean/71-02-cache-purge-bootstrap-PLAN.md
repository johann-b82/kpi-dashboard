---
phase: 71-fe-polish-clean
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/bootstrap.ts
  - frontend/src/bootstrap.test.ts
autonomous: true
requirements: [FE-02, FE-03]

must_haves:
  truths:
    - "On first post-deploy boot, queryClient.removeQueries({queryKey:['signage']}) runs exactly once"
    - "After first run, localStorage key 'kpi.cache_purge_v22' === 'done' and the purge is idempotent (does not run again)"
    - "The new ['directus', ...] and ['fastapi', ...] cache namespaces are NOT touched by the purge"
    - "bootstrap.ts is safe to run in environments where localStorage is undefined (defensive guard)"
  artifacts:
    - path: "frontend/src/bootstrap.ts"
      provides: "Cold-start path with one-shot legacy cache purge"
      contains: "kpi.cache_purge_v22"
    - path: "frontend/src/bootstrap.test.ts"
      provides: "Unit tests covering first-boot purge, second-boot no-op, namespace scope"
  key_links:
    - from: "bootstrap.ts"
      to: "queryClient (frontend/src/queryClient.ts)"
      via: "queryClient.removeQueries({queryKey:['signage']})"
      pattern: "removeQueries\\(\\{ ?queryKey: ?\\[\"signage\"\\]"
    - from: "bootstrap.ts"
      to: "localStorage"
      via: "localStorage.getItem/setItem('kpi.cache_purge_v22')"
      pattern: "kpi\\.cache_purge_v22"
---

<objective>
Wire a localStorage-gated one-shot purge of legacy `['signage', ...]` TanStack Query cache keys into `bootstrap.ts` (the existing cold-start path) so users don't render stale `/api/signage/*` responses cached pre-Phase-65.

Purpose: Lock FE-02 (namespace separation already in place) and FE-03 (one-shot purge gated by localStorage flag).
Output: 6-line patch to `bootstrap.ts` + unit tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/71-fe-polish-clean/71-CONTEXT.md
@.planning/phases/71-fe-polish-clean/71-RESEARCH.md
@frontend/src/bootstrap.ts
@frontend/src/queryClient.ts
@frontend/src/main.tsx

<interfaces>
queryClient is the singleton at frontend/src/queryClient.ts (8 lines). bootstrap.ts (53 lines) is awaited in main.tsx:11 BEFORE React renders. It already calls `queryClient.setQueryData(["settings"], settings)` (line 47) so importing queryClient is established.

Cache key namespaces in flight:
- Legacy (TO PURGE): `['signage', ...]`
- New (KEEP): `['directus', <collection>, ...]`, `['fastapi', <topic>, ...]`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add localStorage-gated cache purge to bootstrap.ts + tests</name>
  <files>frontend/src/bootstrap.ts, frontend/src/bootstrap.test.ts</files>
  <read_first>
    - frontend/src/bootstrap.ts (entire file — current cold-start logic)
    - frontend/src/queryClient.ts (singleton import path)
    - frontend/src/main.tsx (verify bootstrap is awaited before render)
    - .planning/phases/71-fe-polish-clean/71-RESEARCH.md (Pattern 3, Pitfall 6)
  </read_first>
  <behavior>
    - Test 1: First boot — localStorage empty, purge runs (queryClient.removeQueries called with {queryKey:['signage']}), then localStorage.getItem('kpi.cache_purge_v22') === 'done'
    - Test 2: Second boot — localStorage already 'done', queryClient.removeQueries NOT called
    - Test 3: Purge does NOT remove queries with keys ['directus', 'signage_devices'] or ['fastapi', 'resolved'] (verified by seeding cache with both legacy + new keys, asserting only legacy gone)
    - Test 4: If `typeof localStorage === "undefined"`, the purge block is a no-op (no throw)
  </behavior>
  <action>
    In `frontend/src/bootstrap.ts`:

    1. Add (or confirm) import: `import { queryClient } from "./queryClient";`
    2. Add module-level constant: `const CACHE_PURGE_KEY = "kpi.cache_purge_v22";` (above the bootstrap function)
    3. Inside the existing `bootstrap()` async IIFE/function body, AFTER existing i18n/settings code, BEFORE returning, add this block verbatim:

    ```typescript
    // Phase 71 FE-03 (D-02 / D-02a): one-shot purge of legacy ['signage', ...]
    // cache keys to evict pre-Phase-65 cached /api/signage/* responses. New
    // ['directus', ...] and ['fastapi', ...] namespaces are NOT touched.
    if (typeof localStorage !== "undefined" && localStorage.getItem(CACHE_PURGE_KEY) !== "done") {
      queryClient.removeQueries({ queryKey: ["signage"] });
      localStorage.setItem(CACHE_PURGE_KEY, "done");
    }
    ```

    Create `frontend/src/bootstrap.test.ts` with the 4 vitest cases above. Use `vi.mock("./queryClient", () => ({ queryClient: { removeQueries: vi.fn(), setQueryData: vi.fn(), getQueryData: vi.fn() }}))` and reset localStorage in `beforeEach` via `localStorage.clear()`. For Test 3, use a real QueryClient instance (don't mock) and seed two queries via `queryClient.setQueryData(["signage", "x"], 1)` and `queryClient.setQueryData(["directus", "y"], 2)` then assert getQueryData(["directus","y"]) is still defined after purge.

    Reset module state between tests: import bootstrap with `vi.resetModules()` if it caches a `bootstrapPromise` singleton. Use `vi.unstubAllEnvs()` and `vi.unstubAllGlobals()` after each test.

    Do NOT modify any existing logic in bootstrap.ts. Only ADD the purge block.
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/bootstrap.test.ts && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "kpi.cache_purge_v22" frontend/src/bootstrap.ts` returns >= 1
    - `grep -c "removeQueries" frontend/src/bootstrap.ts` returns 1
    - `grep "queryKey: \\[\"signage\"\\]" frontend/src/bootstrap.ts` matches (literal namespace string)
    - `grep -c "typeof localStorage" frontend/src/bootstrap.ts` returns 1 (defensive guard, Pitfall 6)
    - `npx vitest run src/bootstrap.test.ts` shows 4 passing tests
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>bootstrap.ts purges legacy ['signage'] cache once per browser; localStorage flag idempotent; new namespaces untouched; 4 tests green.</done>
</task>

</tasks>

<verification>
- 4 bootstrap unit tests pass
- TypeScript clean
- `grep "kpi.cache_purge_v22" frontend/src/` returns exactly the bootstrap.ts file (no other writers to the key)
</verification>

<success_criteria>
FE-02 (new cache namespace coexists distinct from signageKeys.*) and FE-03 (one-shot localStorage-gated purge) are mechanized in bootstrap.ts.
</success_criteria>

<output>
After completion, create `.planning/phases/71-fe-polish-clean/71-02-SUMMARY.md`.
</output>
