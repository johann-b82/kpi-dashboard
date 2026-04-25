---
phase: 71-fe-polish-clean
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/lib/toApiError.ts
  - frontend/src/lib/toApiError.test.ts
  - frontend/src/signage/lib/signageApi.ts
autonomous: true
requirements: [FE-01, FE-04]

must_haves:
  truths:
    - "Every adapter call site in signageApi.ts wraps Directus SDK throws with toApiError()"
    - "toApiError() converts Directus plain-object errors into ApiErrorWithBody instances with normalized {status, detail, code?}"
    - "Existing consumers (PlaylistDeleteDialog, DeviceEditDialog, etc.) receive the same ApiErrorWithBody shape they did when calling FastAPI"
    - "Public adapter signatures (return type Promise<T>) unchanged"
  artifacts:
    - path: "frontend/src/lib/toApiError.ts"
      provides: "Central Directus → ApiErrorWithBody normalization helper"
      exports: ["toApiError"]
    - path: "frontend/src/lib/toApiError.test.ts"
      provides: "Unit tests covering Directus plain-object error, native Error, ApiErrorWithBody pass-through, unknown"
    - path: "frontend/src/signage/lib/signageApi.ts"
      provides: "Adapter functions wrapped with try/catch + toApiError throw"
  key_links:
    - from: "signageApi.ts adapter functions"
      to: "toApiError()"
      via: "try { ... } catch (e) { throw toApiError(e); }"
      pattern: "throw toApiError\\("
    - from: "toApiError.ts"
      to: "ApiErrorWithBody (signageApi.ts:29-38)"
      via: "import { ApiErrorWithBody } from '@/signage/lib/signageApi'"
      pattern: "ApiErrorWithBody"
---

<objective>
Land the central `toApiError()` helper (FE-04) and wrap every Directus SDK call site in `signageApi.ts` so DirectusError plain objects are normalized to the existing `ApiErrorWithBody` contract that consumers pattern-match on.

Purpose: Lock the Directus/FastAPI error contract — consumers of the adapter must not need to know whether the underlying transport is Directus or FastAPI.
Output: New `toApiError.ts` helper + adapter functions wrapped with try/catch + unit tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/71-fe-polish-clean/71-CONTEXT.md
@.planning/phases/71-fe-polish-clean/71-RESEARCH.md
@frontend/src/signage/lib/signageApi.ts
@frontend/src/lib/apiClient.ts
@frontend/src/lib/directusClient.ts

<interfaces>
ApiErrorWithBody is currently defined and exported from frontend/src/signage/lib/signageApi.ts:29-38 (NOT lib/apiClient.ts — see RESEARCH.md Pitfall 2). Shape:

```typescript
export class ApiErrorWithBody extends Error {
  status: number;
  body: { detail?: string; code?: string; [k: string]: unknown };
  constructor(status: number, body: ..., message: string) { ... }
}
```

Directus SDK 21.2.2 throws plain JS objects (NOT class instances — RESEARCH.md Pitfall 1). Shape:
```typescript
{ errors: [{ message: string, extensions: { code: string } }], response?: { status: number } }
```

There is NO `DirectusError` exported class. Do NOT use `instanceof DirectusError`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create toApiError helper + unit tests</name>
  <files>frontend/src/lib/toApiError.ts, frontend/src/lib/toApiError.test.ts</files>
  <read_first>
    - frontend/src/signage/lib/signageApi.ts (lines 1-50 for ApiErrorWithBody definition)
    - frontend/src/lib/apiClient.ts (for the plain Error(detail) shape it throws)
    - frontend/vitest.config.ts (test runner config)
    - .planning/phases/71-fe-polish-clean/71-RESEARCH.md (Pattern 2 + Pitfall 1)
  </read_first>
  <behavior>
    - Test 1: ApiErrorWithBody passed in returns the SAME instance (identity check)
    - Test 2: Directus plain object `{errors:[{message:"X", extensions:{code:"FORBIDDEN"}}], response:{status:403}}` returns ApiErrorWithBody with status=403, body.detail="X", body.code="FORBIDDEN"
    - Test 3: Directus plain object with no response.status defaults to status=500
    - Test 4: Directus plain object with no extensions.code omits code from body but still has detail
    - Test 5: Native `new Error("boom")` returns ApiErrorWithBody with status=500, body.detail="boom"
    - Test 6: Plain string "x" returns ApiErrorWithBody with status=500, body.detail="x"
    - Test 7: Directus errors[0].message missing falls back to "Directus error (CODE)" or "Directus error"
  </behavior>
  <action>
    Create `frontend/src/lib/toApiError.ts` exporting a single function `toApiError(err: unknown): ApiErrorWithBody`. Implementation MUST follow RESEARCH.md Pattern 2 verbatim (do NOT use `instanceof DirectusError` — that class does not exist in @directus/sdk 21.2.2).

    Imports:
    ```typescript
    import { ApiErrorWithBody } from "@/signage/lib/signageApi";
    ```

    Function body MUST handle in this order:
    1. `if (err instanceof ApiErrorWithBody) return err;` — pass-through to avoid double-wrapping
    2. Structural Directus check: `if (err && typeof err === "object" && "errors" in err)` — extract `first = err.errors?.[0]`, status from `err.response?.status ?? 500`, detail from `first?.message ?? ('Directus error' + (code ? ` (${code})` : ''))`, code from `first?.extensions?.code`. Construct `new ApiErrorWithBody(status, { detail, code }, detail)`.
    3. `if (err instanceof Error)` → `new ApiErrorWithBody(500, { detail: err.message }, err.message)`
    4. Fallback → `new ApiErrorWithBody(500, { detail: String(err) }, String(err))`

    Create `frontend/src/lib/toApiError.test.ts` with the 7 vitest cases above (use `describe`/`it`/`expect`). Tests must run via existing `npm test --prefix frontend` config.
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/lib/toApiError.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - File `frontend/src/lib/toApiError.ts` exists with `export function toApiError(`
    - File contains the literal string `"errors" in err` (structural check, not `instanceof DirectusError`)
    - File does NOT contain the string `DirectusError` (no broken import)
    - File `frontend/src/lib/toApiError.test.ts` exists
    - `npx vitest run src/lib/toApiError.test.ts` shows 7 passing tests, 0 failing
    - `grep -c "ApiErrorWithBody" frontend/src/lib/toApiError.ts` returns >= 4
  </acceptance_criteria>
  <done>toApiError helper lives at frontend/src/lib/toApiError.ts; 7 unit tests green; imports ApiErrorWithBody from @/signage/lib/signageApi.</done>
</task>

<task type="auto">
  <name>Task 2: Wrap every Directus SDK call site in signageApi.ts with toApiError</name>
  <files>frontend/src/signage/lib/signageApi.ts</files>
  <read_first>
    - frontend/src/signage/lib/signageApi.ts (entire file, all 474 lines)
    - frontend/src/lib/toApiError.ts (just created in Task 1)
    - .planning/phases/71-fe-polish-clean/71-RESEARCH.md (Example 1: Wrapping every adapter call site)
  </read_first>
  <action>
    Add import at top of `frontend/src/signage/lib/signageApi.ts`:
    ```typescript
    import { toApiError } from "@/lib/toApiError";
    ```

    For EVERY adapter function in `signageApi.ts` that calls `directus.request(...)` (Directus SDK transport), refactor from:
    ```typescript
    fnName: () => directus.request(readItems(...)) as Promise<X>,
    ```
    to:
    ```typescript
    fnName: async () => {
      try {
        return (await directus.request(readItems(...))) as X;
      } catch (e) { throw toApiError(e); }
    },
    ```

    For functions calling `apiClient(...)` (FastAPI transport — e.g., `getResolvedForDevice`, `revokeDevice`, surviving DELETE/bulk-PUT calls), also wrap:
    ```typescript
    try { return await apiClient(...); } catch (e) { throw toApiError(e); }
    ```
    (toApiError is a pass-through for ApiErrorWithBody already thrown by apiClientWithBody, and normalizes plain Error from apiClient.)

    Public TYPE signatures stay identical (still `Promise<T>`); D-00e (stable signatures) preserved. If a function currently uses arrow shorthand (`() => directus.request(...) as Promise<T>`), convert to `async () => { ... }` body.

    Composite functions (`listPlaylists`, `getPlaylist`, `listDevices` with parallel tag-map merges) — wrap the OUTER awaited expression in one try/catch (not each parallel call separately), so the first thrower normalizes the whole call.

    Do NOT change return data shapes. Do NOT change function names. Do NOT change parameter signatures.
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit && npx vitest run --reporter=basic 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "throw toApiError(" frontend/src/signage/lib/signageApi.ts` returns >= 20 (one per adapter function; current adapter has ~30)
    - `grep -c "import { toApiError }" frontend/src/signage/lib/signageApi.ts` returns 1
    - No TypeScript errors: `cd frontend && npx tsc --noEmit` exits 0
    - All existing vitest tests still pass: `cd frontend && npx vitest run` shows green (no broken consumers)
    - No occurrence of `directus.request(` outside an `await` (ensures every Directus call is awaited inside try)
  </acceptance_criteria>
  <done>Every Directus SDK call in signageApi.ts is awaited inside try/catch and throws toApiError(e); type-check clean; existing tests green.</done>
</task>

</tasks>

<verification>
- toApiError unit tests pass (7/7)
- signageApi.ts type-checks
- Existing vitest suite passes (no consumer regression)
- No `instanceof DirectusError` anywhere in the codebase (Pitfall 1)
</verification>

<success_criteria>
FE-01 (adapter wraps Directus SDK with stable response shape) is verifiable in code; FE-04 (DirectusError normalized to ApiErrorWithBody) holds end-to-end.
</success_criteria>

<output>
After completion, create `.planning/phases/71-fe-polish-clean/71-01-SUMMARY.md`.
</output>
