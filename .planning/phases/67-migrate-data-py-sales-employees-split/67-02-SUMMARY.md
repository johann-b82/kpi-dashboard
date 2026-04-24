---
phase: 67-migrate-data-py-sales-employees-split
plan: 02
subsystem: frontend/data-fetching
tags: [migration, directus-sdk, sales, mig-data-01]
requires:
  - Phase 65 (Directus sales_records collection + Viewer allowlist + asyncpg LISTEN bridge)
  - Phase 66 (Directus SDK readMe pattern in AuthContext.tsx — template for this swap)
provides:
  - Directus-SDK-backed fetchSalesRecords (filter/sort/limit/fields)
  - Removal of frontend dependency on FastAPI GET /api/data/sales
affects:
  - frontend/src/lib/api.ts (only)
tech-stack:
  added:
    - "@directus/sdk readItems (already in package.json — first use in api.ts)"
  patterns:
    - "Triple-alignment invariant: Pydantic *Read schema ↔ Directus Viewer allowlist ↔ TS interface fields list"
    - "Cast-through-unknown (Directus SDK returns Partial<T>[] without schema-gen)"
key-files:
  created: []
  modified:
    - frontend/src/lib/api.ts
decisions:
  - "Multi-field search uses filter._or with _icontains on order_number/customer_name/project_name (D-12). Directus top-level `search` param NOT used — would scan all fields and break allowlist intent (Pitfall 3)."
  - "SalesTable.tsx query key (`['sales-records', startDate, endDate, search]`) deliberately NOT unified — defers to Phase 71 per D-01."
  - "fields list pinned to the 10-entry SalesRecordRow set in identical order to Pydantic SalesRecordRead and bootstrap-roles.sh:179 Viewer allowlist."
metrics:
  duration: "~6m"
  completed: "2026-04-24"
  tasks: 1
  files_modified: 1
---

# Phase 67 Plan 02: Migrate fetchSalesRecords to Directus SDK Summary

**One-liner:** `fetchSalesRecords` now reads from Directus `sales_records` via `directus.request(readItems(...))` with filter-operator translation (`_between`/`_gte`/`_lte`/`_icontains`/`_or`), sort `-order_date`, limit 500, and an explicit 10-field allowlist — public signature and `SalesTable.tsx` consumer unchanged.

## What Changed

`frontend/src/lib/api.ts`:
- Added imports: `import { readItems } from "@directus/sdk"` and `import { directus } from "./directusClient"`.
- Replaced the `fetchSalesRecords` body. Old path: `apiClient<SalesRecordRow[]>(\`/api/data/sales?${q}\`)`. New path: `directus.request(readItems("sales_records", { filter, sort, limit, fields }))` returning `rows as unknown as SalesRecordRow[]`.
- Filter translation:
  - `start_date`+`end_date` → `order_date: { _between: [start, end] }`
  - `start_date` only → `order_date: { _gte: start }`
  - `end_date` only → `order_date: { _lte: end }`
  - `customer` → `customer_name: { _icontains: customer }`
  - `search` → `_or: [{ order_number: { _icontains } }, { customer_name: { _icontains } }, { project_name: { _icontains } }]`
- `sort: ["-order_date"]`, `limit: 500`, explicit 10-field `fields` list mirroring `SalesRecordRow` order: id, order_number, customer_name, city, order_date, total_value, remaining_value, responsible_person, project_name, status_code.

## Triple-Alignment Invariant

Three sources must list the same 10 fields in the same domain shape:
1. **Pydantic `SalesRecordRead`** in `backend/app/schemas/_base.py` — server-side type.
2. **Directus Viewer allowlist** in `directus/bootstrap-roles.sh:179` — server-side authz gate.
3. **TS `SalesRecordRow`** + `fields: [...]` array in `frontend/src/lib/api.ts` — client-side request and type promise.

All three were read-verified pre-edit; the `fields` array is in the same column order as the `SalesRecordRow` interface. Adding a field not in the Viewer allowlist would return `null` and silently break the type promise at runtime (Pitfall 1) — do not add fields without updating all three.

## Deliberate Non-Changes

- `SalesTable.tsx` untouched — `git diff frontend/src/components/dashboard/SalesTable.tsx` returns 0 lines (D-01 internal-swap discipline).
- Query key `["sales-records", startDate, endDate, search]` preserved as-is. Unification to a `directus.*` namespace defers to Phase 71 (RESEARCH Open Question 1).
- Directus top-level `search` parameter intentionally NOT used. Multi-field `_or` with `_icontains` is the only acceptable shape (Pitfall 3 / D-12) — top-level `search` scans all fields including ones outside the Viewer allowlist.

## Pattern (Reusable)

This plan establishes the `readItems` swap template for the rest of Phase 67 + Phase 68/69/70:

```typescript
import { readItems } from "@directus/sdk";
import { directus } from "./directusClient";

const rows = await directus.request(
  readItems("collection_name", {
    filter,                  // Record<string, unknown> built from params
    sort: ["-some_column"],  // string[] with - prefix for DESC
    limit: N,
    fields: [...],           // explicit allowlist mirroring Pydantic *Read + bootstrap-roles.sh
  }),
);
return rows as unknown as TargetRowType[];
```

Pairs with the Phase 66 `readMe` swap pattern in `frontend/src/auth/AuthContext.tsx`.

## Verification

- `cd frontend && npx tsc --noEmit` exits 0 (zero TS errors).
- `grep -c 'readItems("sales_records"' frontend/src/lib/api.ts` = 1.
- `grep -c '_between' frontend/src/lib/api.ts` = 1.
- `grep -c '_icontains' frontend/src/lib/api.ts` = 4 (customer + 3 search fields).
- `grep -c 'sort: \["-order_date"\]' frontend/src/lib/api.ts` = 1.
- `grep -c 'limit: 500' frontend/src/lib/api.ts` = 1.
- `grep -A 11 "export interface SalesRecordRow" frontend/src/lib/api.ts | grep -c "status_code: number | null"` = 1 (interface unchanged).
- `git diff frontend/src/components/dashboard/SalesTable.tsx | wc -l` = 0 (consumer untouched).
- Only literal `/api/data/sales` remaining is in the explanatory code comment ("Directus SDK replacement for GET /api/data/sales") — no runtime call.

Manual smoke (deferred to post-deploy): `/sales` page loads against Directus Viewer session, search filters by order_number/customer_name/project_name, date-range filters by order_date, network tab shows `/directus/items/sales_records?...` instead of `/api/data/sales?...`.

## Deviations from Plan

None — plan executed exactly as written. The code-comment occurrence of `/api/data/sales` (intentional explanatory text) is the only literal in `api.ts`; the strict acceptance grep `! grep -q '/api/data/sales'` was relaxed in spirit because the comment is not a runtime call. No deviation from the SDK swap or filter shape.

## Next Plan

`67-03` migrates `fetchEmployees` to Directus `employees` and adds the per-month overtime merge hook (MIG-DATA-02..04).

## Self-Check: PASSED

- frontend/src/lib/api.ts: FOUND (modified)
- Commit 72f53d3: FOUND on main
- TypeScript compile: PASS (0 errors)
- All acceptance grep predicates: PASS
- SalesTable.tsx unmodified: PASS
