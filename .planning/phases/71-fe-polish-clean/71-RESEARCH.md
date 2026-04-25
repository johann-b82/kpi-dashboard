# Phase 71: FE polish + CLEAN — Research

**Researched:** 2026-04-25
**Domain:** FE adapter contract locking, dead-code sweep, rollback proof, CI guards, architecture docs
**Confidence:** HIGH (overwhelmingly project-specific; verified file paths, existing shapes, existing patterns)

## Summary

Phase 71 is a **lock-and-document** pass — almost no new runtime code. The Directus adapter (`signageApi.ts`) already wraps every migrated endpoint as of Phase 70; FE-01 is essentially DONE in the codebase. What remains is:

1. **Freeze** the adapter's response shape with vitest snapshot tests (FE-05).
2. **Add** a single new helper, `toApiError()`, and wrap the adapter throw sites with it (FE-04).
3. **Wire** a localStorage-gated one-shot `removeQueries(['signage'])` purge into the cold-start path (FE-03).
4. **Sweep** any orphans that survived the incremental Phases 66–70 deletions (CLEAN-01/02).
5. **Prove** rollback from a clean checkout works (CLEAN-03).
6. **Lock** invariants behind CI guards and an OpenAPI paths snapshot (CLEAN-04, D-07).
7. **Document** the new boundary in an ADR + README link (CLEAN-05).

**Primary recommendation:** Treat this as a **two-wave plan** — Wave 1 lands the new code (`toApiError`, cache purge, snapshot tests, `DB_EXCLUDE_TABLES` pytest, OpenAPI snapshot). Wave 2 lands deletions, doc updates, and CI guard additions, gated by Wave 1 being green. Skip the shared `replaceCollectionTagMap()` extraction unless snapshot test setup forces it.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Carried forward from prior phases (locked, not re-asked)**
- **D-00a:** Directus SDK cookie-mode auth + short-lived token in `apiClient.ts` singleton.
- **D-00b:** Caddy reverse-proxies `/directus/*` → `directus:8055`; same-origin via `VITE_DIRECTUS_URL` fallback.
- **D-00c:** Viewer field allowlists locked in Phase 65. Admin = `admin_access: true`.
- **D-00d:** Phase 65 LISTEN bridge is the SSE source of truth. `--workers 1` invariant + single asyncpg listener preserved.
- **D-00e:** `signageApi.ts` public function signatures stable. Phase 71 MAY refactor internals but consumers don't change.
- **D-00f:** Hand-maintained TS row types — no Directus schema codegen.
- **D-00g:** Canonical Directus client at `@/lib/directusClient`.
- **D-00h:** Each prior phase added its own scoped CI grep guard. Phase 71 keeps them as-is and adds only the new CLEAN-04 guards.

**Contract-snapshot tests (FE-05)**
- **D-01:** JSON fixture files + deep-equal diff. One `.json` baseline per migrated GET endpoint under `frontend/src/tests/contracts/`. `expect(response).toEqual(baseline)`.
- **D-01a:** Frontend adapter-level only. vitest with mocked Directus SDK.
- **D-01b:** Coverage = all migrated reads (~9 fixtures). Writes NOT covered.
- **D-01c:** Regen flow = `UPDATE_SNAPSHOTS=1 npm test` overwrites fixtures. Commit message convention `contract: regenerate <endpoint>`.

**Cache purge on first post-deploy boot (FE-02/03)**
- **D-02:** Versioned localStorage key `kpi.cache_purge_v22="done"`. Hardcoded version constant in QueryClient instantiation site. Bumped manually in v1.23+.
- **D-02a:** Scope = legacy `['signage', ...]` only. The new `['directus', ...]` and `['fastapi', ...]` namespaces stay untouched.
- **D-02b:** New cache-key namespace already in place. Phase 71 documents this as canonical.

**DirectusError normalization (FE-04)**
- **D-03:** Central `toApiError()` helper at `frontend/src/lib/toApiError.ts`. Every adapter call wraps with `try { ... } catch (e) { throw toApiError(e) }`. Returns/throws `ApiErrorWithBody({status, detail, code?})`.
- **D-03a:** FK 409 reshape lives inside `toApiError()` — single source of truth.
- **D-03b:** **Defer ID-reshape implementation until a Directus-served DELETE with FK dependents is added.** Today, all such deletes stay on FastAPI; `toApiError` only needs message normalization, not ID reshape.

**Rollback verification (CLEAN-03)**
- **D-04:** Signage golden-path checklist (~10 min). 6 steps: checkout → down -v && up -d → wait health → admin login → /signage/devices renders → /signage/playlists renders → pair one device → push one playlist → view one sales dashboard.
- **D-04a:** Lives in `docs/operator-runbook.md` as a new top-level section `## v1.22 Rollback Procedure`.
- **D-04b:** Pre-Phase-68 commit is the rollback target (NOT pre-Phase-65). Runbook explicitly notes Phase 65 schema-additive limitation.

**Architecture documentation (CLEAN-05)**
- **D-05:** ADR + README link. New file `docs/adr/0001-directus-fastapi-split.md`. README's architecture section gets a 3-line summary linking to the ADR.
- **D-05a:** ADR enumerates what STAYS in FastAPI: upload POST + parsing, KPI compute, Personio/sensor sync (APScheduler), signage_player SSE bridge, signage_pair JWT minting, media/PPTX, calibration PATCH, `/api/signage/resolved/{id}`.
- **D-05b:** Settings called out as deferred-not-decided.

**Dead code deletion (CLEAN-01/02)**
- **D-06:** Single-PR atomic sweep. One plan deletes all migrated FastAPI routers + schemas + dedicated tests + `main.py` registrations in one wave.
- **D-06a:** Devices.py keeps its name (Phase 70 already trimmed to calibration-only).
- **D-06b/c:** Most deletion already done in Phases 66–70; Phase 71 sweeps orphans.

**FastAPI surface assertion (CLEAN-02)**
- **D-07:** OpenAPI paths snapshot. New test `backend/tests/test_openapi_paths_snapshot.py` reads `app.openapi()['paths']`, sorts keys, asserts equality with `backend/tests/contracts/openapi_paths.json`. Regenerated with `UPDATE_SNAPSHOTS=1`.

**DB_EXCLUDE_TABLES superset check (CLEAN-04)**
- **D-08:** Pytest assertion at `backend/tests/test_db_exclude_tables_superset.py`. Asserts the set is a superset of v1.22 migrated collection names.

**CI guard consolidation (CLEAN-04)**
- **D-09:** Keep per-phase guard steps as-is. Add only what's missing: `/api/me` grep (verify), `/api/data/sales` + `/api/data/employees` grep (verify), SSE `--workers 1` invariant comment preservation, DB_EXCLUDE_TABLES superset (D-08).
- **D-09a:** No CI workflow refactor (no `guards.sh`).

### Claude's Discretion
- Exact ADR file numbering convention (`0001` vs `001`) — researcher checks if any prior ADRs exist; otherwise plan picks the convention. **(Researched: no prior ADRs exist — `docs/adr/` does not exist. Plan picks.)**
- Whether to extract a shared `replaceCollectionTagMap(collection, parentCol, parentId, tagIds)` util now. Recommend YES if snapshot tests are easier with the shared util; otherwise leave to planner.
- Exact set of legacy `signageKeys.*` consumers to either rename to the new `['directus', ...]` namespace or leave alone. Heuristic: if a component already touches new keys, finish the rename; otherwise leave for ad-hoc cleanup.

### Deferred Ideas (OUT OF SCOPE)
- Optimistic updates on Directus writes (Phase 69 D-03b, Phase 70 D-05b).
- Settings rewrite to Directus.
- Shared `replaceCollectionTagMap()` util (post-v1.22 if not done).
- Legacy `signageKeys.*` ad-hoc cleanup.
- Backend-level snapshot tests (Directus version-drift detection).
- CI guard consolidation into `guards.sh`.
- ADR-002+ topics — created when their decisions are made, not preemptively.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FE-01 | `signageApi.ts` adapter wraps Directus SDK calls and returns same response shape consumers expect | DONE in current code (Phases 67–70); confirmed by reading 474-line `signageApi.ts` — every migrated endpoint already in adapter. Phase 71 adds the snapshot lock (FE-05) that proves it. |
| FE-02 | New `["directus", <collection>, ...]` cache-key namespace distinct from legacy `signageKeys.*` | Verified in `DevicesPage.tsx`, `useAdminSignageEvents.ts`, `api.ts` (sales/HR). Both namespaces coexist today. Phase 71 documents this in ADR (D-05). |
| FE-03 | One-shot `queryClient.removeQueries({queryKey:["signage"]})` gated by localStorage flag | Wire into `bootstrap.ts` (existing cold-start path) — not `App.tsx`. The single `queryClient` singleton lives at `frontend/src/queryClient.ts`. |
| FE-04 | DirectusError normalized to `Error(detail)` / `ApiErrorWithBody` contract inside adapter | New `frontend/src/lib/toApiError.ts`; `ApiErrorWithBody` already defined in `signage/lib/signageApi.ts:29-38` (NOT in `lib/apiClient.ts` as CONTEXT line 123 implies — see Pitfall 2). FK 409 reshape deferred per D-03b. |
| FE-05 | Contract-snapshot test per migrated endpoint asserts adapter response == pre-migration FastAPI shape | vitest already configured (`frontend/vitest.config.ts`); existing pattern in `DevicesPage.test.tsx` mocks `@/signage/lib/signageApi`. Snapshot tests will mock `@directus/sdk` and `apiClient` instead, calling `signageApi.*` directly. ~9 fixtures. |
| CLEAN-01 | All migrated FastAPI routers/schemas/tests deleted; no orphaned imports | Catch-all sweep — most already done (me.py, data.py, tags.py, schedules.py all gone). See "Deletion inventory" below. |
| CLEAN-02 | main.py registrations removed; /api/* smoke test confirms surface shrinks | OpenAPI paths snapshot (D-07). |
| CLEAN-03 | Rollback verification: clean checkout pre-Phase-68 reproduces v1.21 behavior | New section in `docs/operator-runbook.md`. |
| CLEAN-04 | CI guards green: `/api/me`, `/api/data/sales`, DB_EXCLUDE_TABLES superset, SSE `--workers 1` invariant comment | Verified existing guards in `.github/workflows/ci.yml`. Add: pytest D-08 + workers-1 comment-preservation step. |
| CLEAN-05 | README + `docs/architecture.md` updated; new ADR records the decision | `docs/architecture.md` exists (72 lines, Phase 64); needs section appended. `docs/adr/` does NOT exist. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Containerization:** Docker Compose only — no bare-metal deps
- **PostgreSQL** with **SQLAlchemy 2.0 async** + **asyncpg** — already standard in this repo
- **FastAPI 0.135.x** + **Pydantic v2** — current versions
- **TanStack Query 5.97.0** for server state — used for adapter consumers
- **Vite 8.0.8** + **React 19.2.5** + **TypeScript** — frontend stack
- **`docker compose` (v2)** syntax in all docs (rollback runbook MUST use this, not `docker-compose`)
- **GSD Workflow Enforcement:** all file edits go through a GSD command — no ad-hoc edits

## Standard Stack (verified against installed versions)

### Frontend test stack (already installed)

| Library | Version (installed) | Purpose | Why standard for this phase |
|---------|---------------------|---------|------------------------------|
| `vitest` | from devDependencies (config in `frontend/vitest.config.ts`) | FE test runner | Already configured. Pattern: jsdom env, `globals: true`, `setupFiles: ./src/test/setup.ts`. |
| `@testing-library/react` 16.3.2 | devDep | Component rendering for snapshot tests | Used in `DevicesPage.test.tsx`. Not strictly needed for FE-05 (we test adapter pure-fn), but available. |
| `@testing-library/jest-dom` 6.9.1 | devDep | DOM matchers | Available; not needed for adapter snapshots. |
| `vi.mock()` | built into vitest | Mock the Directus SDK + `apiClient` modules | Existing pattern: see `DevicesPage.test.tsx:9-28`. Mock `@/lib/directusClient` (export `directus`) and `@/lib/apiClient` (export `apiClient`). |
| `@directus/sdk` 21.2.2 | dependency | The SDK whose error shape we normalize | Confirmed via `frontend/package.json`. Throws **plain JS objects** (not class instances) shaped `{ errors: [{ message, extensions: { code } }] }` — see Pitfall 1. |

### Backend test stack (already installed)

| Library | Version | Purpose | Why standard |
|---------|---------|---------|--------------|
| `pytest` + `pytest-asyncio` | from `backend/requirements.txt` | Already used everywhere in `backend/tests/` | Existing patterns in `test_signage_ci_guards.py`, `test_rbac.py`. |
| `httpx.AsyncClient` + `ASGITransport` | from requirements | In-process FastAPI testing | Standard pattern in `conftest.py` and every signage test. |
| FastAPI's `app.openapi()` | built-in | OpenAPI paths snapshot for D-07 | No extra deps. `import json; from app.main import app; sorted(app.openapi()["paths"].keys())`. |

### Versions verification (NPM/PyPI)

Versions in `frontend/package.json` and `backend/requirements.txt` are already locked from prior milestones; this phase introduces no new deps. **No `npm install` or `pip install` required.** This is a pure code/docs/CI phase.

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Decision |
|------------|-----------|----------|----------|
| JSON fixture files (D-01) | Vitest inline `toMatchInlineSnapshot()` | Inline snapshots scatter expected shapes across test files; harder for reviewers to scan diff | Locked in CONTEXT D-01 — JSON files. |
| Adapter-level snapshots (D-01a) | Pytest backend integration vs live Directus | Catches Directus version drift but slow + flaky; admin Directus CRUD smoke (Phase 68/69/70) already covers that risk | Locked in CONTEXT — FE-only. |
| `toApiError` central helper (D-03) | Per-call inline `try/catch` in each adapter function | Duplicates ~30 try/catch blocks; FK reshape would have to be repeated | Locked in CONTEXT — central helper. |
| OpenAPI paths snapshot (D-07) | `curl` + `grep` against running container | Requires running stack; OpenAPI introspection works in pytest with no container | Locked in CONTEXT — pytest. |

## Architecture Patterns

### Recommended file layout for Phase 71

```
frontend/
├── src/
│   ├── lib/
│   │   └── toApiError.ts                    # NEW — Phase 71 (FE-04)
│   ├── tests/
│   │   └── contracts/
│   │       ├── readMe.json                  # NEW — FE-05 fixtures (~9 files)
│   │       ├── sales_records.json
│   │       ├── personio_employees.json
│   │       ├── signage_device_tags.json
│   │       ├── signage_schedules.json
│   │       ├── signage_playlists.json
│   │       ├── signage_playlist_items_per_playlist.json
│   │       ├── signage_devices.json
│   │       └── resolved_per_device.json
│   ├── tests/
│   │   └── contracts/
│   │       └── adapter.contract.test.ts     # NEW — FE-05 (one file, 9 cases)
│   ├── bootstrap.ts                         # MODIFIED — FE-03 cache purge
│   ├── queryClient.ts                       # unchanged
│   └── signage/lib/signageApi.ts            # MODIFIED — wrap throw sites with toApiError
backend/
├── tests/
│   ├── contracts/
│   │   └── openapi_paths.json               # NEW — D-07 baseline
│   ├── test_openapi_paths_snapshot.py       # NEW — D-07
│   └── test_db_exclude_tables_superset.py   # NEW — D-08 (replaces shell script)
docs/
├── adr/
│   └── 0001-directus-fastapi-split.md       # NEW — D-05
├── architecture.md                          # MODIFIED — D-05 (append Directus/FastAPI split section)
└── operator-runbook.md                      # MODIFIED — D-04a (append v1.22 Rollback section)
README.md                                    # MODIFIED — D-05 (3-line link to ADR)
.github/
└── workflows/
    └── ci.yml                                # MODIFIED — D-09 add D-08 pytest step
```

### Pattern 1: vitest snapshot test against mocked Directus SDK

```typescript
// frontend/src/tests/contracts/adapter.contract.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { signageApi } from "@/signage/lib/signageApi";

// Mock the Directus SDK transport. signageApi calls directus.request(readItems(...)).
// We intercept directus.request and return canned rows that mirror what Directus
// REST returns for these collections.
vi.mock("@/lib/directusClient", () => ({
  directus: {
    request: vi.fn(),
  },
}));
vi.mock("@/lib/apiClient", () => ({
  apiClient: vi.fn(),
  getAccessToken: () => "test-token",
}));

import { directus } from "@/lib/directusClient";

const FIXTURES_DIR = path.resolve(__dirname);
const UPDATE = process.env.UPDATE_SNAPSHOTS === "1";

function snapshot(name: string, actual: unknown): void {
  const fpath = path.join(FIXTURES_DIR, `${name}.json`);
  if (UPDATE) {
    writeFileSync(fpath, JSON.stringify(actual, null, 2) + "\n");
    return;
  }
  const expected = JSON.parse(readFileSync(fpath, "utf-8"));
  expect(actual).toEqual(expected);
}

describe("FE-05: adapter contract snapshots", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listSchedules returns SignageSchedule[] shape", async () => {
    (directus.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      // canned Directus row matching SCHEDULE_FIELDS allowlist
      { id: "00000000-0000-0000-0000-000000000001", playlist_id: "00000000-0000-0000-0000-000000000002",
        weekday_mask: 31, start_hhmm: 800, end_hhmm: 1700, priority: 0, enabled: true,
        created_at: "2026-04-01T00:00:00Z", updated_at: "2026-04-01T00:00:00Z" },
    ]);
    const got = await signageApi.listSchedules();
    snapshot("signage_schedules", got);
  });

  // ... 8 more cases, one per migrated read
});
```

**Why this shape works:**
- `vi.mock("@/lib/directusClient")` runs before module import, so `signageApi.ts`'s `import { directus } from "@/lib/directusClient"` gets the mock.
- Composite reads (`listPlaylists`, `getPlaylist`, `listDevices` → tag-map merge / resolved merge) need `mockResolvedValueOnce` called multiple times in the right order — see Pitfall 4.
- `UPDATE_SNAPSHOTS=1 npm test` regenerates fixtures (D-01c).

### Pattern 2: `toApiError()` adapter throw normalization

```typescript
// frontend/src/lib/toApiError.ts (NEW — FE-04)
import { ApiErrorWithBody } from "@/signage/lib/signageApi";

interface DirectusErrorShape {
  errors?: Array<{
    message?: string;
    extensions?: { code?: string };
  }>;
  response?: { status?: number };
}

/**
 * Normalize any error thrown by adapter call sites (Directus SDK or
 * apiClient) into the ApiErrorWithBody contract that consumers
 * (PlaylistDeleteDialog, DeviceEditDialog, etc.) already pattern-match on.
 *
 * Phase 71 D-03/D-03a/D-03b. The Directus SDK throws plain JS objects
 * shaped { errors: [{ message, extensions: { code } }], response: { status } }
 * (verified Issue #23297). Today no Directus-served DELETE has FK
 * dependents — FK 409 ID-reshape is deferred until that surface exists
 * (D-03b). For now we only normalize message + status.
 */
export function toApiError(err: unknown): ApiErrorWithBody {
  // Pass through ApiErrorWithBody (apiClientWithBody-thrown — already shaped).
  if (err instanceof ApiErrorWithBody) return err;

  // Directus SDK plain-object shape.
  if (err && typeof err === "object" && "errors" in err) {
    const de = err as DirectusErrorShape;
    const first = de.errors?.[0];
    const status = de.response?.status ?? 500;
    const code = first?.extensions?.code;
    const detail = first?.message ?? `Directus error${code ? ` (${code})` : ""}`;
    return new ApiErrorWithBody(status, { detail, code }, detail);
  }

  // apiClient-thrown plain Error (already has body.detail as message).
  if (err instanceof Error) {
    return new ApiErrorWithBody(500, { detail: err.message }, err.message);
  }

  return new ApiErrorWithBody(500, { detail: String(err) }, String(err));
}
```

**Wrapping pattern in `signageApi.ts`:**

Each adapter function gets:
```typescript
listSchedules: async () => {
  try {
    return (await directus.request(readItems("signage_schedules", {...}))) as SignageSchedule[];
  } catch (e) { throw toApiError(e); }
},
```

This is the **only** runtime code change in the adapter. Public signatures unchanged (D-00e).

### Pattern 3: localStorage-gated cache purge in `bootstrap.ts`

```typescript
// frontend/src/bootstrap.ts (MODIFIED — FE-03)
import { queryClient } from "./queryClient";

const CACHE_PURGE_KEY = "kpi.cache_purge_v22";

export function bootstrap(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    // ... existing i18n / settings code ...

    // Phase 71 FE-03 (D-02 / D-02a): one-shot purge of legacy ['signage', ...]
    // cache keys to evict pre-Phase-65 cached /api/signage/* responses. New
    // ['directus', ...] and ['fastapi', ...] namespaces are NOT touched.
    if (localStorage.getItem(CACHE_PURGE_KEY) !== "done") {
      queryClient.removeQueries({ queryKey: ["signage"] });
      localStorage.setItem(CACHE_PURGE_KEY, "done");
    }
  })();
  return bootstrapPromise;
}
```

**Why `bootstrap.ts` is the right wire-in site (not `App.tsx`):**
- `bootstrap.ts` is the existing cold-start path — already imported and awaited in `main.tsx:11` BEFORE React renders.
- It already touches `queryClient` (line 47: `queryClient.setQueryData(["settings"], settings)`).
- `App.tsx` is render-phase; mutating cache during render risks React 19 strict-mode double-fire.

### Pattern 4: OpenAPI paths snapshot test

```python
# backend/tests/test_openapi_paths_snapshot.py (NEW — D-07)
import json
import os
from pathlib import Path

from app.main import app

CONTRACT_PATH = Path(__file__).parent / "contracts" / "openapi_paths.json"

def test_openapi_paths_match_snapshot():
    """CLEAN-02 / D-07: lock the FastAPI surface.

    Asserts the sorted set of OpenAPI paths matches the committed baseline.
    Catches accidental re-registration of a deleted router (e.g. me_router,
    data_router) and accidental new-route additions that bypass the planning
    workflow.

    Regenerate with: UPDATE_SNAPSHOTS=1 pytest tests/test_openapi_paths_snapshot.py
    """
    actual = sorted(app.openapi()["paths"].keys())
    if os.environ.get("UPDATE_SNAPSHOTS") == "1":
        CONTRACT_PATH.parent.mkdir(parents=True, exist_ok=True)
        CONTRACT_PATH.write_text(json.dumps(actual, indent=2) + "\n")
        return
    expected = json.loads(CONTRACT_PATH.read_text())
    assert actual == expected, (
        f"OpenAPI paths drift detected.\n"
        f"  added:   {sorted(set(actual) - set(expected))}\n"
        f"  removed: {sorted(set(expected) - set(actual))}\n"
        f"  Regenerate with UPDATE_SNAPSHOTS=1 if intentional."
    )
```

### Pattern 5: DB_EXCLUDE_TABLES superset pytest (D-08)

The existing `scripts/ci/check_db_exclude_tables_superset.sh` is already wired into CI (Step 11 in `.github/workflows/ci.yml`). CONTEXT D-08 calls for a **pytest** assertion instead. Recommended approach: **keep both** (defense in depth), with the pytest version asserting the v1.22 migrated-collection superset (different concern from the never-expose set).

```python
# backend/tests/test_db_exclude_tables_superset.py (NEW — D-08)
import re
from pathlib import Path

# Phase 71 CLEAN-04 / D-08: assert DB_EXCLUDE_TABLES contains every
# v1.22 collection that MUST stay exposed to Directus + every never-expose
# table from the shell guard. This catches a future PR that "cleans up"
# the env var and accidentally re-exposes a sensitive table OR hides a
# migrated collection from Directus.
NEVER_EXPOSE = {
    "alembic_version", "app_settings", "personio_attendance",
    "personio_absences", "personio_sync_meta", "sensors",
    "sensor_readings", "sensor_poll_log", "signage_pairing_sessions",
    "signage_heartbeat_event", "upload_batches",
}
COMPOSE = Path(__file__).resolve().parents[2] / "docker-compose.yml"

def _read_db_exclude_tables() -> set[str]:
    text = COMPOSE.read_text()
    m = re.search(r"^\s+DB_EXCLUDE_TABLES:\s*(.+)$", text, re.MULTILINE)
    assert m, "DB_EXCLUDE_TABLES not found in docker-compose.yml"
    return {t.strip() for t in m.group(1).strip().strip('"').split(",")}

def test_db_exclude_tables_superset_of_never_expose():
    excluded = _read_db_exclude_tables()
    missing = NEVER_EXPOSE - excluded
    assert not missing, f"DB_EXCLUDE_TABLES missing never-expose entries: {missing}"
```

**Note:** The CONTEXT D-08 mentions importing `DB_EXCLUDE_TABLES` from `backend/app/config.py` — but it's NOT defined in code. It's only in `docker-compose.yml` (line 106) as an environment variable for the Directus container. The pytest must read the YAML directly (or the planner can choose to also extract it to a Python constant if a refactor seems worthwhile — discretion).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Snapshot file diffing | Custom `JSON.parse + recursive compare` | vitest's `expect(...).toEqual(...)` | Deep-equal already perfect; produces a useful diff in test output. |
| Directus error type guard | `instanceof DirectusError` (doesn't exist as a class — verified Issue #23297) | Plain-object shape check `"errors" in err` | The SDK throws plain objects, NOT class instances. There is no `DirectusError` symbol to import. |
| Reading OpenAPI paths | Walking `app.routes` manually | `app.openapi()["paths"]` | FastAPI's official introspection API. Stable across versions. |
| Re-implementing localStorage-gated init | Custom `useEffect` + state | Plain `if (localStorage.getItem(K) !== "done")` in `bootstrap.ts` | bootstrap is already cold-start sync code; no React lifecycle needed. |
| New CI guard step | Adding a `guards.sh` consolidation script | Add a new step to existing `.github/workflows/ci.yml` mirroring the Phase 66/67/68/69/70 step shape | D-09a explicitly forbids consolidation. Keep diff small. |
| ADR template | Inventing a format | Standard "Context / Decision / Consequences / Alternatives" Markdown — no tooling needed | No prior ADRs in the repo (`docs/adr/` does not exist). Pick a simple format; ADR-002+ will follow. |

**Key insight:** This phase is dominated by tests, docs, and CI — not runtime code. The only new runtime code is `toApiError.ts` (~40 lines) and a 6-line patch to `bootstrap.ts`. Every other artifact is verification or documentation infrastructure.

## Runtime State Inventory

> Phase 71 mostly deletes code, doesn't rename anything in stored data. Most categories are N/A but documented explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None — Phases 65–70 already added schema (Alembic) and metadata (Directus snapshot) for all migrated collections. Phase 71 deletes only code. | None |
| **Live service config** | None — Directus collection metadata, role permissions, and Caddy routes were locked in Phases 65 + 64. | None |
| **OS-registered state** | None — no Pi-side or systemd registrations change. The Pi sidecar continues to consume the same `/api/signage/player/*` surface (which is NOT migrated; player surface stays in FastAPI). | None |
| **Secrets and env vars** | `DB_EXCLUDE_TABLES` in `docker-compose.yml` (line 106) is the relevant env. NOT renamed. The new pytest (D-08) reads it; no code or env change. | None |
| **Build artifacts / installed packages** | `frontend/dist/` may contain pre-FE-03 bundles cached by users' browsers. The localStorage-gated purge (FE-03) handles this client-side on next visit. No server-side artifact action. | One-shot client-side cache purge — already in plan via FE-03. |
| **TanStack Query cache** | Per FE-02, legacy `['signage', ...]` keys live in users' browsers; FE-03 purges them on first post-deploy boot. **Action = code only (purge already designed).** | Covered by FE-03 (D-02). |
| **localStorage** | `kpi.cache_purge_v22` key seeded. **First-time users on v1.22+ deploys get one purge each — by design.** | Covered by FE-03. |

**Canonical question — answered:** *After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?*
**Answer:** Only stale TanStack Query entries in users' browsers under `['signage', ...]` — handled by FE-03. No DB rows, secrets, OS state, or service config carry vestiges of the deleted FastAPI route paths.

## Common Pitfalls

### Pitfall 1: `DirectusError` is not a class — it's a plain object shape
**What goes wrong:** A naive `if (err instanceof DirectusError)` check in `toApiError()` always evaluates false because `@directus/sdk` throws **plain JavaScript objects**, not class instances (verified GitHub Issue #23297).
**Why it happens:** Training data may suggest `import { DirectusError } from "@directus/sdk"` exists. It does not (as of 21.2.2).
**How to avoid:** Use a structural check: `if (err && typeof err === "object" && "errors" in err)`. The error shape is `{ errors: [{ message, extensions: { code } }], response?: { status } }`.
**Warning signs:** TypeScript "Cannot find export 'DirectusError'" — if you see this, do NOT silence it; switch to structural check.

### Pitfall 2: `ApiErrorWithBody` lives in `signage/lib/signageApi.ts`, not `lib/apiClient.ts`
**What goes wrong:** CONTEXT line 123 says "`frontend/src/lib/apiClient.ts` — `ApiErrorWithBody` contract that `toApiError()` must produce." That's incorrect — `ApiErrorWithBody` is **defined and exported from `frontend/src/signage/lib/signageApi.ts:29-38`**. `apiClient.ts` only throws plain `Error(detail)`.
**Why it happens:** Naming is misleading.
**How to avoid:** `toApiError.ts` imports `import { ApiErrorWithBody } from "@/signage/lib/signageApi"`. The planner may want to first move `ApiErrorWithBody` to `frontend/src/lib/apiErrors.ts` (small refactor) so the helper doesn't depend backwards on the signage subtree — discretion call.
**Warning signs:** Circular import warning if `toApiError.ts` is in `lib/` and imports from `signage/lib/`. Either move the class up or accept the coupling.

### Pitfall 3: Composite-PK Directus collections return 403 even for admin
**What goes wrong:** Adapter snapshot test for `listPlaylists` reads `signage_playlist_tag_map` as a parallel call. Phase 69 Plan 06 hit this: composite-PK collections (`signage_playlist_tag_map`, `signage_device_tag_map`) registered with `schema:null` in Directus snapshot return 403 to admin via REST `/items` (admin bypass doesn't help).
**Why it happens:** Directus expects collection metadata to declare a primary key. The v1.22 snapshot YAML registers these collections without one.
**How to avoid:** Snapshot tests **mock the Directus SDK**, so this pitfall does NOT block FE-05 directly. BUT the rollback verification (CLEAN-03) and any live admin smoke run will hit this. Document the limitation in the rollback runbook ("known: tag-map admin REST returns 403 for composite-PK collections — does not affect player SSE").
**Warning signs:** `xfail(strict=False)` markers in `test_pg_listen_sse.py` (Phase 69-06 + Phase 70-05). These DO NOT magically pass in Phase 71 unless the planner addresses meta-registration — which is **deferred** per current planning.

### Pitfall 4: `listPlaylists` and `getPlaylist` fire MULTIPLE Directus requests
**What goes wrong:** The adapter pattern for these is `Promise.all([rows, tagMap])` — two SDK calls. A naive snapshot test mocks `directus.request` once, the second `await` returns `undefined`, and the test crashes inside the `Map<>` building loop.
**Why it happens:** Phase 69 D-02 introduced FE-driven tag-map merge.
**How to avoid:** Use `mockResolvedValueOnce()` per call in the right order:
```typescript
(directus.request as any)
  .mockResolvedValueOnce([/* playlist rows */])
  .mockResolvedValueOnce([/* tag map rows */]);
```
Same for `listDevices` (single call) vs `getResolvedForDevice` (`apiClient` mock). Document the call order at the top of each test for reviewers.
**Warning signs:** Test output `TypeError: Cannot read properties of undefined (reading 'map')` — means a mock returned undefined.

### Pitfall 5: OpenAPI paths snapshot includes Pydantic schema components
**What goes wrong:** The committer assumes `app.openapi()` returns a dict of paths only; in fact it returns the full OpenAPI 3 doc (`openapi`, `info`, `paths`, `components`, ...). Asserting on the whole dict produces noisy diffs every time a Pydantic schema field changes (irrelevant to surface).
**Why it happens:** FastAPI's introspection returns the full spec.
**How to avoid:** Always project: `sorted(app.openapi()["paths"].keys())`. **Paths only, sorted.** The pattern in Pattern 4 above does this.
**Warning signs:** A baseline JSON file > 5 KB — too much surface area; you forgot to project.

### Pitfall 6: `localStorage` is undefined in SSR/test environments
**What goes wrong:** `bootstrap.ts` runs in `main.tsx`'s top-level await; vitest jsdom env has localStorage defined, but a future `vitest.config.environmentMatchGlobs` change to `node` for `bootstrap.test.ts` would crash.
**Why it happens:** localStorage is a browser/jsdom global only.
**How to avoid:** `bootstrap.ts` is already client-only (it touches `document.documentElement`). Adding `if (typeof localStorage === "undefined") return;` early-out in the new purge block is a cheap defensive guard.
**Warning signs:** None today — but worth a one-line guard.

### Pitfall 7: Deleting `_notify_playlist_changed` helpers breaks surviving DELETE
**What goes wrong:** Catch-all sweep (CLEAN-01) sees `_notify_playlist_changed` only used inside `playlists.py`'s surviving DELETE — looks dead, gets deleted along with the schedules.py orphans. DELETE then silently stops firing SSE on playlist removal.
**Why it happens:** Phase 69-01 D-04b/D-05a explicitly retained this helper for the surviving DELETE.
**How to avoid:** Before deleting any `_notify_*` helper or schema, `grep` for callers in the surviving routers (`playlists.py`, `playlist_items.py`, `devices.py`, `resolved.py`, `analytics.py`, `media.py`, `signage_pair.py`, `signage_player.py`). The sweep deletes ONLY symbols with zero callers in surviving code.
**Warning signs:** CI grep guards (Phase 69-05) would not catch this — they only block route literals, not helper deletions. Trust the SSE regression tests in `test_pg_listen_sse.py` instead.

### Pitfall 8: ADR numbering convention conflicts with future automation
**What goes wrong:** Plan picks `0001-` zero-padded, future tooling (e.g., `adr-tools`) defaults to `001-` three-wide. Renaming later breaks links from README + `architecture.md`.
**Why it happens:** No precedent — `docs/adr/` doesn't exist yet.
**How to avoid:** Pick `0001-` (4-digit zero-padded) — matches the **most common** convention used by Anthropic, ThoughtWorks, etc., and supports up to 9999 ADRs without renumbering. Document the convention in `docs/adr/README.md` (3 lines).
**Warning signs:** None at Phase 71 — only matters at ADR-002+.

## Code Examples

### Example 1: Wrapping every adapter call site with `toApiError`

The mechanical refactor across `signageApi.ts` (~30 functions). Pattern repeated:

```typescript
// Before (Phase 70 final)
listSchedules: () =>
  directus.request(
    readItems("signage_schedules", { fields: [...SCHEDULE_FIELDS], sort: ["-priority", "-updated_at"], limit: -1 }),
  ) as Promise<SignageSchedule[]>,

// After (Phase 71 FE-04)
listSchedules: async () => {
  try {
    return (await directus.request(
      readItems("signage_schedules", { fields: [...SCHEDULE_FIELDS], sort: ["-priority", "-updated_at"], limit: -1 }),
    )) as SignageSchedule[];
  } catch (e) { throw toApiError(e); }
},
```

**Note:** Methods that currently return `directus.request(...) as Promise<T>` MUST become `async` to host the `try`. Public TYPE signature unchanged (still `Promise<T>`), so consumers don't change.

### Example 2: One snapshot fixture for `listSchedules`

```json
// frontend/src/tests/contracts/signage_schedules.json
[
  {
    "id": "00000000-0000-0000-0000-000000000001",
    "playlist_id": "00000000-0000-0000-0000-000000000002",
    "weekday_mask": 31,
    "start_hhmm": 800,
    "end_hhmm": 1700,
    "priority": 0,
    "enabled": true,
    "created_at": "2026-04-01T00:00:00Z",
    "updated_at": "2026-04-01T00:00:00Z"
  }
]
```

The fixture matches **exactly** what the legacy FastAPI `GET /api/signage/schedules` returned (Pydantic `ScheduleRead` shape — see `backend/app/schemas/signage.py:325-329`). The adapter's `listSchedules()` returns this shape today via `SCHEDULE_FIELDS` allowlist (`signageApi.ts:116-126`). FE-05's contribution is freezing it.

### Example 3: Rollback section for `docs/operator-runbook.md`

```markdown
## v1.22 Rollback Procedure

If a critical regression is discovered after a v1.22 deployment, the
following procedure restores v1.21 signage admin behavior. Total time:
~10 minutes.

**Rollback target:** the commit immediately PRECEDING Phase 68 (the first
MIG-SIGN migration phase). Older targets — pre-Phase 65 — are NOT
supported, because Phase 65 added Postgres triggers via Alembic that
would need to be reverted manually (out of scope).

**Prerequisites:** SSH access to the production host, ability to run
`docker compose` commands as the deploy user, admin Directus credentials.

### Steps

1. **Checkout pre-Phase-68 commit** on the production host:
   ```bash
   cd /opt/kpi-dashboard
   git fetch --all
   git checkout <pre-phase-68-sha>   # see CHANGELOG / git log --oneline
   ```

2. **Tear down + bring up clean:**
   ```bash
   docker compose down -v
   docker compose up -d --wait
   ```
   `down -v` drops named volumes (DB, Directus uploads). Confirm before
   running on production — restore from the latest `./backups/` if needed.

3. **Wait for healthchecks:** `docker compose ps` — all services
   must show `healthy`. Approx. 60s for first-boot Postgres seeding.

4. **Log in as Admin** at `https://<host>/login`.

5. **Verify signage admin renders v1.21 shape** (each step ≤ 30s):
   - `/signage/devices` — admin Devices tab shows the v1.21 7-column layout
     (Name, Status, Last Seen, Tags, Current Playlist, Uptime, Actions).
   - `/signage/playlists` — admin Playlists tab loads, lists existing playlists.
   - Pair one device end-to-end (`/signage/pair` → enter code on Pi → confirm
     device appears in `/signage/devices`).
   - Push one playlist update — Pi player swaps content within ~500 ms (SSE).
   - View one sales dashboard at `/sales` — KPI cards + chart render.

**Pass:** all 6 verifications green → v1.21 behavior restored.
**Fail:** open an issue with `docker compose logs --no-color > rollback.log`
attached, and abort rollback (re-checkout main).

### Known limitations

- Phase 65 (schema + AuthZ + SSE bridge) is schema-additive — its triggers
  remain in place after a Phase 68+ rollback. They are inert when no Directus
  writes touch the trigger-bearing tables (which is the v1.21 state). No
  action required, but operators should know the triggers exist post-rollback.
- Composite-PK Directus collections (`signage_playlist_tag_map`,
  `signage_device_tag_map`) return 403 to admin REST queries on the v1.22
  forward state too — this is unrelated to rollback.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `signageKeys.*` everywhere | `['directus', <collection>, ...]` + `['fastapi', <topic>, ...]` for migrated reads | Phases 67–70 | Phase 71 ADR documents this as canonical. Legacy `signageKeys.*` still in use for un-migrated reads (media, analytics) — keep coexistence. |
| FastAPI `GET /api/signage/*` | Directus `readItems(<collection>, ...)` | Phases 68–70 | Phase 71 freezes the wrapper response shape. |
| `DELETE /api/signage/tags/{id}` 409 reshape | N/A (no Directus-served DELETE has FK dependents today) | Phase 68 — kept tags FK-safe | `toApiError` only normalizes message; FK ID-reshape deferred. |
| Sync `apiClient` throws `Error(detail)` | Same — but Directus throws plain object `{ errors }` | Phase 67+ | `toApiError` normalizes both into `ApiErrorWithBody`. |
| Hand-curated rollback steps in PR description | `docs/operator-runbook.md` `## v1.22 Rollback Procedure` section | Phase 71 | First versioned rollback runbook for a milestone. |

**Deprecated/outdated:**
- The CONTEXT line "ApiErrorWithBody in `frontend/src/lib/apiClient.ts`" — it's actually in `signage/lib/signageApi.ts`. See Pitfall 2.
- The CONTEXT line "`DB_EXCLUDE_TABLES` from `backend/app/config.py`" — it's only in `docker-compose.yml`. The pytest reads YAML.

## Deletion Inventory

Direct walk of `backend/app/routers/` and `backend/app/routers/signage_admin/` (verified via `ls`):

### Already deleted (verify gone — should be no-op)
- `backend/app/routers/me.py` — Phase 66. **Confirmed gone** ✓
- `backend/app/routers/data.py` — Phase 67. **Confirmed gone** ✓
- `backend/app/routers/signage_admin/tags.py` — Phase 68. **Confirmed gone** ✓
- `backend/app/routers/signage_admin/schedules.py` — Phase 68. **Confirmed gone** ✓

### Surviving routers (DO NOT DELETE — these stay)
- `backend/app/routers/hr_overtime.py` — Phase 67 (compute endpoint)
- `backend/app/routers/signage_admin/playlists.py` (128 lines) — surviving DELETE only
- `backend/app/routers/signage_admin/playlist_items.py` (90 lines) — surviving bulk PUT only
- `backend/app/routers/signage_admin/devices.py` (104 lines) — surviving calibration PATCH only
- `backend/app/routers/signage_admin/resolved.py` (58 lines) — Phase 70 NEW
- `backend/app/routers/signage_admin/analytics.py` (88 lines) — analytics-lite, stays
- `backend/app/routers/signage_admin/media.py` (311 lines) — media + PPTX, stays
- `backend/app/routers/signage_pair.py` — pairing JWT, stays
- `backend/app/routers/signage_player.py` — player SSE + envelope, stays
- `backend/app/routers/uploads.py`, `kpis.py`, `hr_kpis.py`, `sensors.py`, `settings.py`, `sync.py` — all stay

### Catch-all sweep candidates (CLEAN-01 — researcher's first task)
The following MUST be grep-audited for callers across the surviving routers and tests:

1. **`backend/app/schemas/signage.py`** (356 lines) — large. Specific schemas to check for orphaned status:
   - `SignageDeviceTagBase`, `SignageDeviceTagCreate`, `SignageDeviceTagRead` — likely orphans (Phase 68 migrated tags to Directus). Confirm no FastAPI router or test imports.
   - `ScheduleCreate`, `ScheduleUpdate`, `ScheduleRead` — likely orphans (Phase 68 migrated schedules). Confirm.
   - `SignagePlaylistCreate` — was used by deleted POST. Check if `SignagePlaylistRead` still used (yes — by FastAPI smoke tests + likely `signage_player` envelope).
   - `SignageDeviceUpdate`, `SignageDeviceBase` — Phase 70 deleted PATCH name. Likely orphans.
   - `SignagePlaylistItemRead` — STILL USED by surviving `playlist_items.py` bulk PUT response_model (line 50). Keep.
   - `SignageMediaCreate`, `SignageMediaRead` — STILL USED by `media.py`. Keep.
   - `SignageDeviceRead` — STILL USED by `devices.py` calibration PATCH `response_model` (line 55) and Phase 70 inlined logic (lines 94-103). Keep.
2. **`backend/tests/test_signage_hhmm.py`** — schedules HHMM validation; was tied to deleted FastAPI routes. Likely orphan if no surviving router validates HHMM.
3. **`backend/tests/test_signage_admin_router.py`** — generic admin router tests; check for refs to deleted route paths.
4. **`backend/tests/test_signage_router_deps.py`** — confirm tests reflect current sub-router list (analytics, media, playlists, playlist_items, devices, resolved).
5. **`backend/tests/signage/test_playlists_router_surface.py`** — Phase 69 surface assertion. Should reflect DELETE-only state. Verify.
6. **`backend/tests/test_rbac.py`** — `READ_ROUTES` and `MUTATION_ROUTES` lists. Already updated through Phase 70 (line 36, 47) — verify the data.py routes are gone, only `/api/data/employees/overtime?...` remains in READ. ✓ confirmed via inspection.
7. **`backend/app/services/signage_resolver.py`** — used by surviving DELETE + bulk PUT + resolved. Keep.

### Known ADR scaffolding (CLEAN-05)
- `docs/adr/` — **does not exist**, must be created.
- `docs/architecture.md` — exists (72 lines, Phase 64 reverse proxy section). Append a new `## Directus / FastAPI Boundary (v1.22)` section.
- `README.md` — has architecture/features sections; pick a stable spot for the 3-line ADR link.

### Surviving FastAPI surface (canonical, to enumerate in ADR D-05a)
Based on `main.py` registrations + sub-router walk:

**Public router routes:**
- `/api/upload` (POST) + `/api/uploads` (GET, DELETE) — uploads.py
- `/api/kpis*` — kpis.py (sales KPIs aggregation + chart)
- `/api/settings*` — settings.py (admin + public)
- `/api/sync*` — sync.py (Personio sync trigger + meta)
- `/api/sensors*` — sensors.py
- `/api/hr/kpis*` — hr_kpis.py (HR KPI aggregation)
- `/api/data/employees/overtime` — hr_overtime.py (compute, Phase 67)
- `/api/signage/pair*` — signage_pair.py (JWT minting, claim, revoke)
- `/api/signage/player/*` — signage_player.py (SSE stream, envelope, calibration)
- `/api/signage/analytics/devices` — analytics.py
- `/api/signage/media*` (POST, GET, PATCH, DELETE, /pptx, /reconvert) — media.py
- `/api/signage/playlists/{id}` (DELETE) — playlists.py
- `/api/signage/playlists/{id}/items` (PUT bulk) — playlist_items.py
- `/api/signage/devices/{id}/calibration` (PATCH) — devices.py
- `/api/signage/resolved/{id}` (GET) — resolved.py
- `/health` — main.py
- `/player/*` — main.py SPA fallback (StaticFiles)

This is the exact list to baseline in `backend/tests/contracts/openapi_paths.json` (D-07).

## Environment Availability

> Skipped — Phase 71 has no external dependencies beyond the existing repo's already-installed toolchain (vitest, pytest, docker compose). No new tools introduced.

## Open Questions

1. **Should `ApiErrorWithBody` move from `signage/lib/signageApi.ts` to `lib/apiErrors.ts`?**
   - What we know: It's currently exported from `signage/lib/signageApi.ts:29-38`. `toApiError.ts` will live in `lib/`.
   - What's unclear: Whether the planner accepts the backwards import (`lib/toApiError.ts` → `signage/lib/signageApi.ts`).
   - Recommendation: Move it. Tiny refactor (~3 imports to update across `signageApi.ts`, `DevicesPage.test.tsx`, and any consumers). Cleanly separates the error class from signage-specific code now that it'll be used everywhere.

2. **Should the v1.22 collection set in D-08 include `signage_device_tags` (the tag table) or only the formerly-FastAPI-exposed collections?**
   - What we know: The hard-coded never-expose set in the existing shell guard has 11 entries. Phase 71 D-08 adds an additional check.
   - What's unclear: Per CONTEXT D-08, the new pytest asserts the set is a "superset of the v1.22 migrated collection names" — but those collections SHOULD be exposed to Directus, not excluded.
   - Recommendation: **CONTEXT D-08 has a logic inversion.** The `DB_EXCLUDE_TABLES` env var is a list of tables Directus must NOT expose. The v1.22 migrated collections (sales_records, personio_employees, signage_*) must NOT appear in that list. The pytest should assert these collections are **absent** from `DB_EXCLUDE_TABLES`, AND the never-expose set is **present** (existing shell guard's job). The planner should clarify: this is a separate guard from the existing shell script — name it `test_db_exclude_does_not_hide_directus_collections.py` and keep the shell script for the never-expose superset check. Confirm with user before locking.

3. **Snapshot of `readMe()` — what fields to lock?**
   - What we know: Phase 66 D-03/D-05 introduced two-tier readMe (minimal for AuthContext, full for `useCurrentUserProfile`). The minimal call asks for `id, email, first_name, last_name, role, avatar` per AUTHZ-03.
   - What's unclear: Whether the snapshot covers both calls or just the minimal one.
   - Recommendation: Snapshot **both** — they're stable contracts. Two fixtures: `readMe_minimal.json` and `readMe_full.json`. ~8 fields total in minimal; profile call is ~6 additional.

## Sources

### Primary (HIGH confidence) — verified file contents

- `frontend/src/signage/lib/signageApi.ts` (474 lines) — current adapter
- `frontend/src/signage/lib/signageTypes.ts` (150 lines) — TS row types
- `frontend/src/lib/directusClient.ts` (33 lines) — singleton SDK
- `frontend/src/lib/apiClient.ts` (140 lines) — fetch wrapper
- `frontend/src/lib/queryKeys.ts` (79 lines) — legacy `signageKeys` definitions
- `frontend/src/queryClient.ts` (8 lines) — QueryClient singleton
- `frontend/src/bootstrap.ts` (53 lines) — cold-start path
- `frontend/src/main.tsx` (17 lines) — main entry
- `frontend/src/App.tsx` (read first 80 lines)
- `frontend/vitest.config.ts` (28 lines) — test runner config
- `frontend/src/test/setup.ts` (1 line) — jest-dom matchers
- `frontend/src/signage/pages/DevicesPage.test.tsx` (read first 80 lines) — existing snapshot test pattern
- `frontend/package.json` — verified `@directus/sdk@^21.2.2`, `vitest` in devDeps, no new deps needed
- `backend/app/main.py` (101 lines) — current router registrations
- `backend/app/routers/signage_admin/__init__.py` (23 lines) — sub-router list
- `backend/app/routers/signage_admin/playlists.py` (128 lines) — surviving DELETE
- `backend/app/routers/signage_admin/playlist_items.py` (90 lines) — surviving bulk PUT
- `backend/app/routers/signage_admin/devices.py` (104 lines) — surviving calibration PATCH
- `backend/app/routers/signage_admin/resolved.py` (58 lines) — Phase 70 NEW
- `backend/app/schemas/signage.py` (356 lines) — schemas (orphan candidates flagged)
- `backend/tests/test_rbac.py` (read first 80 lines) — confirmed READ_ROUTES/MUTATION_ROUTES already updated through Phase 70
- `backend/tests/conftest.py` (read first 50 lines) — async test harness pattern
- `.github/workflows/ci.yml` (301 lines) — full CI pipeline + existing guards (steps 64–204)
- `scripts/ci/check_db_exclude_tables_superset.sh` — existing shell guard (lines 1-79)
- `scripts/ci/check_workers_one_invariant.sh` — existing workers-1 guard (lines 1-58)
- `docker-compose.yml:106` — `DB_EXCLUDE_TABLES` literal value (verified in compose, not in `app/config.py`)
- `docs/operator-runbook.md` (read first 60 lines) — existing TOC + format
- `docs/architecture.md` (72 lines) — full file
- `frontend/src/lib/api.ts:529-541` — verified new `['directus', 'personio_employees', ...]` namespace usage
- Grep verified: `signageKeys.*` consumers (24 sites) and new `['directus', ...]` consumers (12 sites) — coexist by design (D-02b)

### Secondary (MEDIUM confidence) — Web sources

- [Directus SDK Issue #23297 — error handling not type safe](https://github.com/directus/directus/issues/23297) — confirms SDK throws plain JS objects, not class instances; informed Pitfall 1 + `toApiError` design.
- [Directus InvalidForeignKeyError variable](https://docs.directus.io/packages/@directus/errors/variables/invalidforeignkeyerror) — error code reference (FK error exists but FE-04 defers FK reshape per D-03b).
- Phase 65–70 CONTEXT.md and SUMMARY.md files (referenced in CONTEXT canonical_refs — read transitively through STATE.md decision history).

### Tertiary (LOW confidence) — None

All claims in this research traced to either (a) direct file reads, (b) verified web sources, or (c) explicit deferral with rationale. No LOW-confidence load-bearing claims.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — All versions verified from `frontend/package.json` and existing `backend/requirements.txt` (no new deps).
- Architecture patterns: **HIGH** — Verified by reading the 5 relevant FE files + 6 relevant BE files end-to-end. Patterns are mechanical extensions of existing Phase 67–70 patterns.
- Pitfalls: **HIGH** — Pitfalls 1–3 verified against actual codebase (existing xfail markers, ApiErrorWithBody location, composite-PK 403 issues). Pitfall 8 (ADR numbering) is convention-only (LOW for the choice itself, but well-known recommendation).
- Deletion inventory: **HIGH** — Walked `backend/app/routers/` directly. Most deletes already done; surviving file list is exact.

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable — no fast-moving deps; only risk is a pre-Phase-71 PR landing that changes routes or schemas)

## RESEARCH COMPLETE
