
## Deferred: Pre-existing TypeScript build errors in SalesTable.tsx

**Discovered during:** Phase 21, Plan 03, Task 2
**Scope:** Out of scope — pre-existing before this plan
**File:** frontend/src/components/dashboard/SalesTable.tsx
**Errors:**
- TS2345: 'SalesRecordRow[]' not assignable to 'Record<string, unknown>[]'
- TS2322: Type 'unknown' not assignable to 'Key | null | undefined' (line 110)
- TS2322: Type '{}' not assignable to ReactI18NextChildren (lines 111-113)
- Several more related errors

**Impact:** `npm run build` fails. `npx tsc --noEmit` passes (different behavior due to Vite build config).
**Action needed:** Fix SalesTable.tsx generics in a future plan.
