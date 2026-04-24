# Phase 67: Migrate `data.py` — Sales + Employees split — Research

**Researched:** 2026-04-24
**Domain:** Directus 11 SDK `readItems` migration + FastAPI compute-endpoint split
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Architectural locks carried from earlier phases (not revisited):**
- **D-00a:** Directus SDK cookie-mode auth + short-lived token in `apiClient.ts` singleton (Phase 29/64; reused Phase 66).
- **D-00b:** Caddy reverse-proxies `/directus/*` → `directus:8055`; same-origin default via `VITE_DIRECTUS_URL` fallback (Phase 64 D-05).
- **D-00c:** Viewer field allowlist on `sales_records` + `personio_employees` locked in Phase 65 (AUTHZ-01). Any field read via `readItems` must already be in that allowlist — planner validates.
- **D-00d:** CI grep-guard pattern from Phase 66 (`"/api/me"` in `frontend/src/`) is the template for this phase's additional guards.
- **D-00e:** `--workers 1` invariant remains; SSE bridge (Phase 65) is not relevant to sales/HR (no SSE on these tables).

**Frontend fetch shape:**
- **D-01:** `fetchSalesRecords` and `fetchEmployees` in `frontend/src/lib/api.ts` keep their public signatures. Internals swap from `apiClient(...)` to `directus.request(readItems(...))`. Callers (`SalesTable.tsx`, HR table) are not touched except where D-05 requires the employee merge.
- **D-02:** `SalesRecordRow` and `EmployeeRow` types remain hand-written in `lib/api.ts`. No Directus schema type-generation.
- **D-03:** `EmployeeRow` retains `total_hours`, `overtime_hours`, `overtime_ratio` fields. Populated by frontend merge (D-05), not by Directus fetch.

**Overtime endpoint shape:**
- **D-04:** Response is a flat array: `[{employee_id: int, total_hours: float, overtime_hours: float, overtime_ratio: float | null}, ...]`. Only employees with attendance in the requested window appear. Zero-fill derived on frontend.
- **D-05:** Merge happens on the frontend. `useEmployees` (Directus) and `useEmployeesOvertime` (FastAPI) are two React Query hooks; `useMemo` joins by `employee_id`, zero-fills missing.
- **D-06:** Missing `date_from` or `date_to` → FastAPI returns `422`. No fallback to current month.
- **D-07:** `date_from > date_to` → `422`.
- **D-08:** Compute logic lifted verbatim from `data.py`: `PersonioAttendance × PersonioEmployee` join; `worked = (end_min − start_min − break_minutes) / 60`; skip if `worked ≤ 0`; `daily_quota = weekly_working_hours / 5.0` (fallback `8.0`); `overtime = max(0, worked − daily_quota)`; round to 1 decimal; `overtime_ratio = round(ot / total, 4)` only when `total > 0 and ot > 0` else `null`.
- **D-09:** `_month_bounds` helper no longer imported by the new endpoint. Remains in `hr_kpi_aggregation.py` for other HR KPI code.

**Sales filter translation:**
- **D-10:** Date range → `{ order_date: { _between: [start_date, end_date] } }` when both set. Only `start_date` → `{ order_date: { _gte: start_date } }`. Only `end_date` → `{ order_date: { _lte: end_date } }`.
- **D-11:** `customer` → `{ customer_name: { _icontains: customer } }`.
- **D-12:** `search` → `{ _or: [{ order_number: { _icontains } }, { customer_name: { _icontains } }, { project_name: { _icontains } }] }`. Top-level Directus `search` NOT used.
- **D-13:** Sort server-side: sales → `sort: ['-order_date']`; employees → `sort: ['last_name']`.
- **D-14:** `limit: 500` on both `readItems`. Pagination out of scope.
- **D-15:** Employees filters: `department` → `{ department: { _icontains } }`; `status` → `{ status: { _eq } }`; `search` → `{ _or: [{ first_name: { _icontains } }, { last_name: { _icontains } }, { position: { _icontains } }] }`. `date_from`/`date_to` stop being sent to the Directus call — they only feed the overtime hook.

**data.py fate + file layout:**
- **D-16:** `backend/app/routers/data.py` deleted in full. Not reduced.
- **D-17:** New file `backend/app/routers/hr_overtime.py` owns the overtime endpoint.
- **D-18:** Route path stays verbatim per REQUIREMENTS.md MIG-DATA-03: `GET /api/data/employees/overtime`. Router `prefix="/api/data"`, `tags=["data"]`. File name and route prefix diverge intentionally.
- **D-19:** `backend/app/main.py` removes `data` include, adds `hr_overtime` include.
- **D-20:** Tests: overtime compute assertions (null start/end → skipped, zero hours → skipped, break-minute subtraction, weekly_working_hours fallback to 8h, `overtime_ratio` null when total=0 or ot=0) ported to `backend/tests/test_hr_overtime_endpoint.py`. Add 422 test for missing/inverted dates.
- **D-21:** CI guard extends `.github/workflows/ci.yml` Phase 66 pattern: fail if `"/api/data/sales"` or `"/api/data/employees"` appears under `backend/app/` (but NOT `"/api/data/employees/overtime"`).

### Claude's Discretion

- Exact React Query `queryKey` shape for `useEmployeesOvertime` — planner picks; principle: invalidate on date-range change only.
- `staleTime` / cache TTL for the two new hooks — planner picks project default.
- `useQueries` vs two `useQuery` calls — planner picks based on existing patterns.
- Exact wording of the 422 `detail` message.
- Row type property order — cosmetic.
- Grep guard literal quote-style in YAML — match Phase 66 guard style.

### Deferred Ideas (OUT OF SCOPE)

- Directus schema type-generation (`schema.d.ts`).
- Pagination beyond the 500-row cap.
- Full-text `search` param via Directus top-level `search`.
- Moving `hr_overtime.py` and `hr_kpis.py` into a shared `hr/` package.
- Any signage endpoint migration (Phases 68–70).
- Settings, uploads, sensors, media/PPTX, `signage_player`, `signage_pair` — stay in FastAPI.
- HR aggregated KPI endpoints (`hr_kpis.py`) — untouched.
- Changes to Phase 65's Viewer field allowlists — locked.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MIG-DATA-01 | Frontend `/sales` table consumes `sales_records` via Directus SDK (`readItems` + `?filter[order_date]`); old `GET /api/data/sales` removed. | Standard Stack §Directus SDK + Code Example 1 (readItems with filter/sort/limit) + Pitfall 1 (Viewer allowlist) |
| MIG-DATA-02 | Frontend `/hr` employees table row-data comes from Directus `personio_employees`; old row-data portion of `GET /api/data/employees` removed. | Code Example 2 + Pitfall 3 (compute fields NOT in allowlist) |
| MIG-DATA-03 | New FastAPI `GET /api/data/employees/overtime?date_from&date_to` computes total-hours / overtime roll-up per employee; frontend merges Directus rows with compute response. | Code Example 3 (overtime router skeleton) + Architecture Pattern 2 (frontend merge via useMemo) |
| MIG-DATA-04 | `data.py` deleted (or reduced); tests migrated or removed; no orphaned imports. | Removal Checklist §3 + Common Pitfall 5 (orphaned references) |

</phase_requirements>

## Summary

This phase is a near-identical repeat of the Phase 66 `readMe` swap pattern, scaled to two collections with filter/sort translation and one new compute endpoint. The Directus SDK singleton (`frontend/src/lib/directusClient.ts`), the cookie-mode auth flow, and the token injection into `apiClient.ts` are all already wired and proven in Phase 66 for `readMe`. Phase 67 reuses that machinery unchanged; the novelty is (a) `readItems` with filter objects instead of `readMe` with a flat fields array, and (b) a new FastAPI router file that hosts only the overtime compute endpoint.

The existing `data.py` is small (128 lines, two endpoints). The overtime compute (lines 72–125) lifts cleanly into the new `hr_overtime.py` file. The Viewer allowlists in `directus/bootstrap-roles.sh` already include the exact field sets needed — they were pre-wired in Phase 65 for precisely this phase. Backend tests for `data.py` exist only as parametrized entries in `test_rbac.py` and one test in `test_hr_kpi_range.py` (`test_employees_range_scopes_attendance` + the parametrized invalid-range test) — not in a dedicated `test_data_router.py` file. This affects D-20's wording: plans must edit these existing files (remove `/api/data/sales` + `/api/data/employees` from `test_rbac.py` READ_ROUTES; migrate the overtime-compute assertion and the 400→422 status change from `test_hr_kpi_range.py`), not "delete `test_data_router.py`."

**Primary recommendation:** Mirror the Phase 66 two-plan structure exactly — (Plan 1) frontend SDK swap + overtime merge hook, (Plan 2) backend router swap + test migration + CI guard. Lift the compute loop from `data.py:89–125` verbatim into `hr_overtime.py` with no behavioral changes.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@directus/sdk` | ^21.2.2 (already installed) | Frontend `readItems` calls against `sales_records` + `personio_employees` | Already singleton in `directusClient.ts`; v21 matches the `authentication("cookie")` + `rest()` chain Phase 64/66 established. No version bump needed. |
| FastAPI | 0.135.3 | New `/api/data/employees/overtime` router | Project constraint (CLAUDE.md). `Query(...)` validation raises 422 natively for missing params — matches D-06 automatically. |
| SQLAlchemy | 2.0.49 (async) | `PersonioAttendance × PersonioEmployee` join in the new router | Compute logic lifted verbatim from `data.py` — no new patterns. |
| `@tanstack/react-query` | 5.97.0 | Two hooks for row-data + overtime; merge via `useMemo` | Already used for `useQuery` in `EmployeeTable.tsx` and `SalesTable.tsx` — no new library. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pytest` + `httpx.AsyncClient` | existing | Overtime endpoint tests + 422 negative tests | Matches `test_hr_kpi_range.py` + `test_rbac.py` style. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `readItems` + hand-written types | Directus SDK schema type-gen (`schema.d.ts`) | Explicitly deferred (CONTEXT Deferred Ideas); adds a build artifact without payoff at this field count. |
| Two separate hooks + `useMemo` merge | `useQueries` composite hook | Both acceptable per D-05; planner picks. `useQueries` reduces re-render churn but each call loses its own `staleTime`. Phase 60 `EmployeeTable.tsx` uses plain `useQuery`, so two-hook style is the closer existing pattern. |
| Frontend merge (D-05) | Backend composite endpoint | Rejected in CONTEXT — re-introduces row-data responsibility server-side and defeats the split. |

**Installation:** No new dependencies. Existing `package.json` already lists `@directus/sdk: ^21.2.2`. Existing `backend/requirements.txt` has FastAPI 0.135.3, SQLAlchemy 2.0.49, asyncpg. Nothing to add.

## Architecture Patterns

### Directory Structure (unchanged + one new file, one deleted)
```
backend/app/routers/
├── data.py              # DELETED in this phase
├── hr_overtime.py       # NEW — owns GET /api/data/employees/overtime
├── hr_kpis.py           # UNCHANGED — neighbor router, pattern reference
└── ...

frontend/src/lib/
├── api.ts               # MODIFIED — internals of fetchSalesRecords/fetchEmployees;
│                        # new fetchEmployeesOvertime + useEmployeesOvertime export
├── directusClient.ts    # UNCHANGED
└── apiClient.ts         # UNCHANGED (remains for overtime endpoint call)

backend/tests/
├── test_hr_overtime_endpoint.py  # NEW — ported overtime assertions + 422 tests
├── test_rbac.py                  # MODIFIED — drop /api/data/sales + /api/data/employees
│                                 # from READ_ROUTES; add /api/data/employees/overtime
└── test_hr_kpi_range.py          # MODIFIED — remove/port test 9 + parametrized
                                  # invalid-range test's /api/data/employees row
```

### Pattern 1: `directus.request(readItems(...))` with filter / sort / limit

Mirrors Phase 66's `directus.request(readMe({fields:[...]}))` but with a collection argument and a filter object:

```typescript
// Source: Phase 66 AuthContext.tsx:111 (readMe pattern) + Directus 11 SDK docs
import { readItems } from "@directus/sdk";
import { directus } from "./directusClient";

export async function fetchSalesRecords(params?: {
  start_date?: string;
  end_date?: string;
  customer?: string;
  search?: string;
}): Promise<SalesRecordRow[]> {
  // Build filter incrementally — Directus AND-merges top-level keys.
  const filter: Record<string, unknown> = {};

  if (params?.start_date && params?.end_date) {
    filter.order_date = { _between: [params.start_date, params.end_date] };
  } else if (params?.start_date) {
    filter.order_date = { _gte: params.start_date };
  } else if (params?.end_date) {
    filter.order_date = { _lte: params.end_date };
  }

  if (params?.customer) {
    filter.customer_name = { _icontains: params.customer };
  }

  if (params?.search) {
    filter._or = [
      { order_number: { _icontains: params.search } },
      { customer_name: { _icontains: params.search } },
      { project_name: { _icontains: params.search } },
    ];
  }

  return directus.request(
    readItems("sales_records", {
      filter,
      sort: ["-order_date"],
      limit: 500,
      fields: [
        "id", "order_number", "customer_name", "city", "order_date",
        "total_value", "remaining_value", "responsible_person",
        "project_name", "status_code",
      ],
    }),
  ) as unknown as Promise<SalesRecordRow[]>;
}
```

**Key points:**
- `fields` list MUST match `SalesRecordRead` Pydantic schema (`backend/app/schemas/_base.py:268`) and the Viewer allowlist in `directus/bootstrap-roles.sh:179` exactly — both currently list 10 fields identically.
- `sort: ['-order_date']` — leading `-` means descending; Directus puts nulls last by default for descending, matching today's `.desc().nullslast()` contract (CONTEXT D-13).
- `limit: 500` hard-coded per D-14.
- Cast-through-unknown typing is the Phase 66 `readMe` convention (`AuthContext.tsx:111` uses the same pattern because Directus SDK returns a partial-typed object until schema-gen is wired).

### Pattern 2: Frontend merge (Directus rows + FastAPI compute)

```typescript
// Source: D-05 + existing EmployeeTable.tsx useQuery pattern
export function useEmployeesWithOvertime(params: {
  search?: string;
  date_from: string;
  date_to: string;
}) {
  const rowsQ = useQuery({
    queryKey: ["directus", "personio_employees", params.search],
    queryFn: () => fetchEmployees({ search: params.search }),  // no date params now
  });

  const otQ = useQuery({
    queryKey: ["employeesOvertime", params.date_from, params.date_to],
    queryFn: () => fetchEmployeesOvertime(params.date_from, params.date_to),
    // Invalidate only on date change; stable across search edits.
  });

  const merged = useMemo(() => {
    if (!rowsQ.data) return undefined;
    const byId = new Map(
      (otQ.data ?? []).map((r) => [r.employee_id, r]),
    );
    return rowsQ.data.map((r) => ({
      ...r,
      total_hours: byId.get(r.id)?.total_hours ?? 0,
      overtime_hours: byId.get(r.id)?.overtime_hours ?? 0,
      overtime_ratio: byId.get(r.id)?.overtime_ratio ?? null,
    }));
  }, [rowsQ.data, otQ.data]);

  return { data: merged, isLoading: rowsQ.isLoading || otQ.isLoading };
}
```

The zero-fill preserves the v1.21 behavior that all employees appear in the table with `0h / 0h / —` when they have no attendance in the window — today's `data.py` achieves this via the `overtime_map.get(emp.id, 0.0)` fallback at line 121.

### Pattern 3: FastAPI overtime-only router skeleton

```python
# Source: lifted verbatim from data.py:89-125, wrapped in new router file.
# Matches hr_kpis.py neighbor router skeleton.
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.security.directus_auth import get_current_user
from app.models import PersonioAttendance, PersonioEmployee

router = APIRouter(
    prefix="/api/data",
    tags=["data"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/employees/overtime")
async def get_employees_overtime(
    date_from: date = Query(...),   # required → FastAPI auto-422 on missing
    date_to: date = Query(...),
    db: AsyncSession = Depends(get_async_db_session),
) -> list[dict]:
    if date_from > date_to:
        raise HTTPException(
            status_code=422,
            detail="date_from must be <= date_to",
        )

    att_stmt = (
        select(
            PersonioAttendance.employee_id,
            PersonioAttendance.start_time,
            PersonioAttendance.end_time,
            PersonioAttendance.break_minutes,
            PersonioEmployee.weekly_working_hours,
        )
        .join(PersonioEmployee, PersonioAttendance.employee_id == PersonioEmployee.id)
        .where(
            PersonioAttendance.date >= date_from,
            PersonioAttendance.date <= date_to,
        )
    )
    att_rows = (await db.execute(att_stmt)).all()

    overtime_map: dict[int, float] = {}
    total_map: dict[int, float] = {}
    for row in att_rows:
        if row.start_time is None or row.end_time is None:
            continue
        start_min = row.start_time.hour * 60 + row.start_time.minute
        end_min = row.end_time.hour * 60 + row.end_time.minute
        worked = (end_min - start_min - (row.break_minutes or 0)) / 60.0
        if worked <= 0:
            continue
        total_map[row.employee_id] = total_map.get(row.employee_id, 0.0) + worked
        daily_quota = (
            float(row.weekly_working_hours) / 5.0
            if row.weekly_working_hours else 8.0
        )
        ot = max(0.0, worked - daily_quota)
        overtime_map[row.employee_id] = overtime_map.get(row.employee_id, 0.0) + ot

    result = []
    for emp_id in total_map:
        total = total_map[emp_id]
        ot = overtime_map.get(emp_id, 0.0)
        result.append({
            "employee_id": emp_id,
            "total_hours": round(total, 1),
            "overtime_hours": round(ot, 1),
            "overtime_ratio": round(ot / total, 4) if total > 0 and ot > 0 else None,
        })
    return result
```

Note: today's `data.py` `raise HTTPException(status_code=400, ...)` for inverted/half-provided dates. CONTEXT D-06/D-07 upgrade this to **422**. `test_hr_kpi_range.py:528-541` currently asserts `status_code == 400` — that assertion changes to `422` when ported (or the test is rewritten in the new file and the old one deleted).

### Anti-Patterns to Avoid

- **Attempting to read compute-derived fields through Directus.** The Viewer allowlist on `personio_employees` intentionally excludes `total_hours`, `overtime_hours`, `overtime_ratio` (see `bootstrap-roles.sh:181-186` comment) because those fields do not exist as columns on `personio_employees` — they are computed per-request by the overtime endpoint. Requesting them in `readItems` `fields:[...]` will fail (or return `null`).
- **Passing `date_from`/`date_to` into the Directus `fetchEmployees` filter.** Per D-15, those params ONLY drive the overtime hook now. Leaving them as filter arguments would either no-op or cause confusion.
- **Using Directus top-level `search` param.** It scans additional fields and changes match behavior (D-12 explicitly rejects this).
- **Building the overtime endpoint with a Pydantic response model referencing `EmployeeRead`.** The response is a flat dict list (D-04); a dedicated micro-schema (e.g., `OvertimeEntry`) is fine if the planner wants typing, but reusing `EmployeeRead` would drag in the row-data fields and break the split.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Directus filter serialization | Custom URL query-string builder for `?filter[order_date][_between]=...` | `readItems(collection, { filter })` object form | The SDK serializes nested filters correctly, handles array-value operators (`_between`, `_in`, `_or`), URL-encodes reserved characters. Hand-serializing nested brackets is error-prone. |
| Token attachment | Custom Authorization header in `fetch` | `directus.request(...)` | SDK pulls from its internal auth storage (cookie-mode refresh token → short-lived access token) and does silent refresh. Already wired through `apiClient.ts` singleton. |
| 422 on missing query params | Manual `None` check + `raise HTTPException(422, ...)` | FastAPI `Query(...)` required sentinel | FastAPI auto-raises 422 with a clean `{"detail":[{"loc":["query","date_from"],"msg":"field required",...}]}` body. Only the *inverted*-date case (D-07) needs a manual raise. |
| Zero-fill missing employees | Backend always returning an entry per employee | Frontend `byId.get(...) ?? 0` merge | Keeps the endpoint response size proportional to employees-with-attendance (D-04) instead of total headcount; matches the `overtime_map.get(emp.id, 0.0)` behavior of today's code. |

**Key insight:** this phase is entirely a swap + split. Every building block exists in the repo. The only real risk is drift between the three parallel field lists (Pydantic `SalesRecordRead` / Viewer allowlist in `bootstrap-roles.sh` / hand-written `SalesRecordRow` TS type). All three already align today — the plan must keep them aligned and add no new fields.

## Common Pitfalls

### Pitfall 1: Field name drift between TS `Row` type, Pydantic schema, and Viewer allowlist

**What goes wrong:** Frontend requests a field that the Viewer allowlist excludes → Directus silently returns `null` for that field → table shows `—` or crashes on `.toFixed()` etc.

**Why it happens:** Three independent lists of field names live in three files. Today they match exactly:
- `backend/app/schemas/_base.py:268` `SalesRecordRead` — 10 fields.
- `directus/bootstrap-roles.sh:179` Viewer `sales_records` allowlist — same 10 fields.
- `frontend/src/lib/api.ts:355-366` `SalesRecordRow` — same 10 fields.

Same triple alignment holds for employees (9 column-backed fields; the 3 compute fields are ONLY in the TS type and `EmployeeRead`, not in the Viewer allowlist — by design).

**How to avoid:** The `readItems` call explicitly passes `fields: [...]`. The plan must make that list the single source-of-truth mirror of the TS `Row` type (minus compute fields for employees). There IS a CI guard for Pydantic-vs-shell drift (`test_permission_field_allowlists.py`, see `ci.yml` step 3) — note that this guard already carries a Phase 67 reference in its comments (confirmed via grep).

**Warning signs:** Any new field added to a `Row` TS type without a matching `schemas/_base.py` + `bootstrap-roles.sh` update. TypeScript will not catch this — it's a runtime field-allowlist leak.

### Pitfall 2: Status-code change from 400 to 422 for invalid ranges

**What goes wrong:** Existing `test_hr_kpi_range.py:528` asserts `status_code == 400` for three endpoints in parametrize, one of which (`/api/data/employees`) is deleted and another of which (the new `/api/data/employees/overtime`) returns 422 per D-06/D-07.

**Why it happens:** CONTEXT intentionally changes the failure contract from 400 → 422 for the new endpoint. The old endpoint's 400 still applies for `/api/hr/kpis` and `/api/hr/kpis/history` (both untouched in this phase).

**How to avoid:** The ported overtime test file asserts `422` for (a) missing `date_from`, (b) missing `date_to`, (c) inverted range. The old `test_invalid_range_returns_400` parametrized fixture drops the `/api/data/employees` row but keeps the two HR KPI rows unchanged.

### Pitfall 3: `fields:[...]` omission on `readItems` returns all fields by default, bypassing the allowlist intent

**What goes wrong:** If the plan calls `readItems("personio_employees", { filter, sort, limit })` without `fields`, Directus returns the Viewer-allowlisted fields (because the Viewer policy applies server-side) but the frontend TS type promises compute fields that will now come back as `undefined`.

**Why it happens:** The Viewer policy is enforced by Directus regardless of what the client asks for, so a missing `fields` param is technically "safe" server-side. But omitting it leaves the intent implicit and makes future field additions harder to audit.

**How to avoid:** Always pass explicit `fields: [...]` with the column-backed list. For `personio_employees`, pass the 9-field list — NOT the `EmployeeRow` 12-field list (that includes compute fields). The merge hook (Pattern 2) hydrates the remaining 3.

### Pitfall 4: TanStack Query cache key collision between old and new fetchEmployees

**What goes wrong:** Existing `hrKpiKeys.employees(date_from, date_to, search)` → `["hr", "employees", { from, to, search }]` (see `queryKeys.ts:39-46`). If the new `useEmployees` (rows) keeps the same key, any cached response from the OLD FastAPI endpoint survives post-deploy and renders stale rows until TTL expires.

**Why it happens:** Browser IndexedDB/memory cache from pre-deploy builds. React Query defaults to in-memory only, so a hard refresh clears it, BUT if Query persistence is in play (not in this repo per my check), it could survive.

**How to avoid:** Change the query key for the new row hook to the `["directus", "personio_employees", ...]` namespace (Pattern 2) — this is the style locked by Phase 71's FE-02 for signage and is a safe pre-echo here. The overtime hook uses a separate `["employeesOvertime", from, to]` key.

### Pitfall 5: Orphaned imports + orphaned test parametrize entries

**What goes wrong:** Deleting `data.py` leaves `from app.routers.data import router as data_router` in `main.py` → backend fails to import on boot. Deleting the two test-parametrize entries in `test_rbac.py` and `test_hr_kpi_range.py` without updating surrounding assertions leaves dead variable references.

**Why it happens:** Three places reference the dying routes:
1. `backend/app/main.py:15` and `:30` — import + register.
2. `backend/tests/test_rbac.py:21-22` — `READ_ROUTES` parametrize.
3. `backend/tests/test_hr_kpi_range.py:498, 525` — direct URL references.
4. `backend/tests/signage/test_permission_field_allowlists.py:37, 143, 160` — comment references only; these describe the allowlist intent and should be updated to say "Phase 67 complete" rather than "Phase 67 (future)".

**How to avoid:** Phase 66 SUMMARY documents exactly this checklist at the `me.py` scale. Follow the same pattern — do a final `grep -rn "data_router\|/api/data/sales\|/api/data/employees\"" backend/` before calling the phase done (and exclude `/api/data/employees/overtime`).

**Warning signs:** A passing `docker compose up -d` that nonetheless `ImportError`s on the api container — confirm via `docker compose logs api`. The Phase 66 CI `docker compose up -d --wait` step catches this before any test runs.

### Pitfall 6: Directus `_between` date inclusivity and timezone

**What goes wrong:** `order_date` is a `date` (not `timestamp`) column. `_between: ['2026-04-01', '2026-04-30']` in Directus 11 is **inclusive on both ends** for date columns, matching today's `>= start_date AND <= end_date` SQL contract. But if anyone passes an ISO 8601 datetime string by accident (e.g., `"2026-04-01T00:00:00Z"`), Directus treats it as a timestamp and inclusivity becomes implementation-dependent.

**How to avoid:** Confirm that `toApiDate()` in `frontend/src/lib/dateUtils.ts` already returns `YYYY-MM-DD` (not ISO datetime) — it does, per `EmployeeTable.tsx:27-28`. Keep using it. Don't stringify `Date` objects directly.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. Directus `sales_records` + `personio_employees` collections are already registered (Phase 65 SCHEMA-01). No data migration; the Postgres tables are unchanged and Alembic remains DDL owner. | None |
| Live service config | None. Viewer field allowlists for `sales_records` (`bootstrap-roles.sh:178-179`) and `personio_employees` (`:185-186`) are already in place and checked into git. | None |
| OS-registered state | None — verified: no Task Scheduler / launchd / systemd / pm2 registrations reference `/api/data/sales` or `/api/data/employees`. These are internal HTTP routes, not OS-exposed services. | None |
| Secrets/env vars | None — `/api/data/sales` and `/api/data/employees` do not appear in any `.env`, `docker-compose.yml`, or `VITE_*` variable. Verified by grep of repo. | None |
| Build artifacts | Frontend `dist/` contains bundled JS referencing the old fetch paths. The next `npm run build` (required anyway for a deploy) regenerates. | Nothing extra — the deploy already rebuilds the frontend bundle. |

**Post-deploy cache note:** TanStack Query in-memory cache of the old `["hr","employees",...]` key dies on page reload. No cross-session persistence in this repo (confirmed — no `persistQueryClient` usage anywhere under `frontend/src/`). Pitfall 4 remains the only cache concern and is mitigated by a new query-key namespace.

## Environment Availability

Phase is code + config-only (frontend SDK swap + backend router refactor + CI guard). No new external tools, services, or runtimes required. Phase 65 already established Directus 11 + the snapshot-apply chain; Phase 66 already proved the Directus SDK works end-to-end. Skip.

## Removal Checklist for `data.py`

Concrete list of references the planner must clean up:

1. `backend/app/main.py:15` — `from app.routers.data import router as data_router` → delete.
2. `backend/app/main.py:30` — `app.include_router(data_router)` → delete.
3. `backend/app/routers/data.py` — delete entire file (128 lines).
4. `backend/app/services/hr_kpi_aggregation.py:31` (`_month_bounds`) — LEAVES in place. Per D-09, still used by other HR KPI code. Do NOT delete.
5. `backend/tests/test_rbac.py:21-22` — remove `("GET", "/api/data/sales")` and `("GET", "/api/data/employees")` from `READ_ROUTES`. Add `("GET", "/api/data/employees/overtime")` with a valid `?date_from=&date_to=` query string (or parametrize with required query params).
6. `backend/tests/test_hr_kpi_range.py:457-512` (`test_employees_range_scopes_attendance`) — port to new `test_hr_overtime_endpoint.py` with URL `/api/data/employees/overtime` and assertion on the flat-array response shape (no `row["id"]`; use `row["employee_id"]`).
7. `backend/tests/test_hr_kpi_range.py:495-541` (`test_invalid_range_returns_400`) — remove `/api/data/employees` from the parametrize list; keep the two HR KPI routes with `400`; add a separate test in the new file asserting `422` for the overtime endpoint's three invalid cases.
8. `backend/tests/signage/test_permission_field_allowlists.py:37, 143, 160` — update comment text from "(Phase 67)" / "(Phase 67), not from" to reflect that the overtime endpoint is now live. Functional test unchanged.
9. `frontend/src/lib/api.ts:368-411` — rewrite internals of `fetchSalesRecords` and `fetchEmployees`; add `fetchEmployeesOvertime` + the merge hook (or a `useEmployeesWithOvertime` composite).
10. `frontend/src/components/dashboard/EmployeeTable.tsx:30-33` — swap to the new merge hook; drop the `date_from`/`date_to` from the row fetch call (they feed only the overtime query now).
11. `frontend/src/lib/queryKeys.ts:45-46` — either (a) keep `hrKpiKeys.employees` for backward-compat but stop using it for the row query (add a new `directusKeys.personioEmployees` namespace per Pitfall 4), or (b) update `hrKpiKeys.employees` semantics. Planner picks.
12. `.github/workflows/ci.yml` — add step after Phase 66 `/api/me` guard (line 69): grep-fail on `"/api/data/sales"` or `"/api/data/employees"` in `backend/app/` (but NOT matching `/api/data/employees/overtime`). Pattern: `grep -rn '"/api/data/sales"\|"/api/data/employees[^/]' backend/app/` → exit 1 if found.

## Project Constraints (from CLAUDE.md)

Directives extracted from `./CLAUDE.md` that constrain this phase:

- **FastAPI 0.135.3 / SQLAlchemy 2.0.49 async / asyncpg 0.31.0** — new `hr_overtime.py` router MUST use `AsyncSession` + `create_async_engine` path; MUST NOT introduce sync `Session` or psycopg2 anywhere. (Reinforced by STATE.md hazard #6 "No `import sqlite3` / no `import psycopg2`".)
- **Alembic sole DDL owner** — no `Base.metadata.create_all()`. No migration needed this phase (no schema changes).
- **TanStack Query for server state** — the merge hook MUST use TanStack Query, not Redux or custom `useEffect`.
- **Recharts for charts** — N/A this phase; no charting changes.
- **`docker compose` v2 syntax** — CI additions and any local test commands use `docker compose …` (no hyphen).
- **Uvicorn `--workers 1` invariant** — reinforced by STATE.md hazard #4. No worker-count change this phase.
- **GSD workflow enforcement** — all edits must flow through a GSD plan, which this research feeds.
- **Router-level admin gate via `APIRouter(dependencies=[…])`** — NOT required here. `/api/data/employees/overtime` is a read endpoint for Admin + Viewer (same as today's `/api/data/employees`). Router uses `dependencies=[Depends(get_current_user)]`, identical to `data.py` today.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `apiClient<T>("/api/data/...")` (FastAPI proxying DB rows) | `directus.request(readItems(...))` (Directus SDK, direct DB via policy layer) | Phase 65-67 (v1.22 milestone, 2026-04-24) | FastAPI no longer owns row-data for these two collections. Compute endpoint split out. |
| 400 for invalid date range | 422 for missing/inverted dates on overtime endpoint | Phase 67 (this phase) | Matches FastAPI `Query(...)` idiom. `test_hr_kpi_range.py` assertions adjust. |
| Single `/api/data/employees` returning rows + compute | Two endpoints: Directus rows + `/api/data/employees/overtime` | Phase 67 (this phase) | Frontend merges. |

## Open Questions

1. **Should `SalesTable.tsx` query-key change?**
   - What we know: Today it uses `["sales-records", startDate, endDate, search]` (local ad-hoc key, not via `queryKeys.ts`). Pitfall 4 (cache stale risk) is lower here because the ad-hoc key is already idiosyncratic.
   - What's unclear: Whether the planner should normalize this into a new `directusKeys.salesRecords` namespace (consistency with Phase 71 FE-02) or leave the ad-hoc key alone (minimum-churn principle).
   - Recommendation: **Leave the sales-records key ad-hoc** for this phase. Phase 71 FE-01/FE-02 is the correct place to unify cache namespaces for all migrated endpoints together. Touching `SalesTable.tsx` query key here creates a second migration shape that Phase 71 must then unwind.

2. **Where does the HR page's merge hook live?**
   - What we know: Today `EmployeeTable.tsx:30-33` calls `fetchEmployees` directly via `useQuery`.
   - What's unclear: Whether to (a) make `fetchEmployees` the row-only fetch and add a peer `useEmployeesWithOvertime` hook in `api.ts`, OR (b) keep the merge inside `EmployeeTable.tsx` itself.
   - Recommendation: Export the composite hook from `api.ts` (or a new `frontend/src/hooks/useEmployees.ts`) to keep `EmployeeTable.tsx` nearly unchanged and to give Phase 71's contract-snapshot test (FE-05) a clean hook boundary to snapshot against.

## Sources

### Primary (HIGH confidence)
- `./CLAUDE.md` — project stack constraints (FastAPI 0.135.3, SQLAlchemy 2.0.49 async, `@tanstack/react-query` 5.97.0, Directus 11).
- `backend/app/routers/data.py` (lines 1-128) — exact source-of-truth for current behavior being split.
- `backend/app/main.py:15,30` — router include points to modify.
- `backend/app/schemas/_base.py:268,291` — Pydantic `SalesRecordRead` + `EmployeeRead` definitions (field lists).
- `directus/bootstrap-roles.sh:176-202` — Viewer field allowlists (already mirror the Pydantic schemas field-for-field).
- `backend/tests/test_rbac.py:21-22` + `backend/tests/test_hr_kpi_range.py:461-541` — actual test references to the dying endpoints.
- `frontend/src/lib/api.ts:355-411` — current fetch wrappers.
- `frontend/src/lib/directusClient.ts` (full) — SDK singleton wiring.
- `frontend/src/auth/AuthContext.tsx:111,135` + `frontend/src/auth/useCurrentUserProfile.ts:34` — Phase 66 `readMe` pattern template.
- `frontend/src/components/dashboard/EmployeeTable.tsx` + `SalesTable.tsx` — consumer shapes.
- `.planning/phases/66-kill-me-py/66-02-SUMMARY.md` — Phase 66 deletion checklist precedent.
- `.github/workflows/ci.yml:63-76` — Phase 66 CI guard skeleton to clone.

### Secondary (MEDIUM confidence)
- Directus 11 filter-operator vocabulary (`_between`, `_gte`, `_lte`, `_icontains`, `_or`, `_eq`) — confirmed both in CONTEXT decisions (pre-approved by user) and in the `@directus/sdk` v21 API surface as known at research time. Filter object form is the documented shape.
- TanStack Query v5 two-hook vs `useQueries` tradeoff — project defaults to `useQuery` (observed in `EmployeeTable.tsx:30` and `SalesTable.tsx:27`); no `useQueries` usage anywhere under `frontend/src/` (grep-confirmed indirectly via style precedent).

### Tertiary (LOW confidence)
- None. All critical decisions already locked in CONTEXT; all referenced files verified by direct read.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions pinned in CLAUDE.md; no library additions needed.
- Architecture: HIGH — Pattern 1 is a direct rewrite of `readMe` → `readItems`; Pattern 3 lifts verbatim from `data.py`.
- Pitfalls: HIGH — all six pitfalls derived from direct code inspection (field-list triples, status-code assertion drift, import chain).
- Removal checklist: HIGH — grep-verified against the actual files.

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (Directus 11 + FastAPI + React 19 are all stable LTS; no churn expected in a month).
