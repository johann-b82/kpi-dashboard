# Phase 70: MIG-SIGN — Devices - Research

**Researched:** 2026-04-25
**Domain:** Hybrid Directus/FastAPI device CRUD migration with per-device resolved-playlist endpoint and SSE LISTEN bridge regression
**Confidence:** HIGH

## Summary

Phase 70 is the last writer-swap phase of v1.22 MIG-SIGN. It is **not a research-driven phase** — CONTEXT.md locks 11 decisions that are direct extensions of patterns already shipped in Phases 65/66/67/68/69. The novel surface is small: one new FastAPI route (`GET /api/signage/resolved/{device_id}`) and the project's first cross-source `useQueries` merge in the admin Devices list.

All technology choices are pinned by CLAUDE.md's stack table and by the locked decisions in `.planning/STATE.md`. No library evaluation is needed — Directus SDK 21.2.2, asyncpg LISTEN/NOTIFY, TanStack Query 5.97.0, FastAPI 0.135.3 are all already in use. The research value here is (a) verifying the surrounding code matches CONTEXT.md's claims, (b) flagging two minor inconsistencies between CONTEXT.md and the actual repo, (c) prescribing the exact `useQueries` merge shape, and (d) calling out a known Directus-11 metadata-registration footgun on composite-PK collections (Phase 69 Plan 06 lesson).

**Primary recommendation:** Execute the phase as a mechanical extension of Phase 69 patterns. The two callouts the planner must absorb before writing PLAN.md files: (1) `signage_device_tag_map` emits `device-changed` SSE in the listener (not `playlist-changed` as CONTEXT D-03b implies — see Pitfall 1); (2) `signage_device_tag_map` is a composite-PK collection with the same metadata-registration shape that broke Phase 69 Plan 06's smoke test, so D-11's `xfail(strict=False)` hedge is mandatory, not optional.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Architectural locks carried from earlier phases (not revisited):**
- **D-00a:** Directus SDK cookie-mode auth + short-lived token in `apiClient.ts` singleton.
- **D-00b:** Caddy reverse-proxies `/directus/*` → `directus:8055`; same-origin via `VITE_DIRECTUS_URL` fallback.
- **D-00c:** Viewer field allowlists on `signage_*` collections locked in Phase 65. Admin role is unrestricted (`admin_access: true`).
- **D-00d:** Phase 65 LISTEN bridge already wired for `signage_devices` (UPDATE WHEN-gated on name-only — calibration columns excluded), `signage_device_tag_map` (all rows fire SSE). No new Alembic trigger work in this phase.
- **D-00e:** `--workers 1` invariant + single asyncpg listener preserved.
- **D-00f:** CI grep-guard pattern from Phase 66/67/68/69 is the template for the new guard.
- **D-00g:** Public function signatures in `signageApi.ts` remain stable; internals swap to Directus SDK.
- **D-00h:** Hand-maintained TS row types — no Directus schema codegen.
- **D-00i:** Canonical Directus client import path is `@/lib/directusClient`.
- **D-00j:** Surviving FastAPI route — `PATCH /api/signage/devices/{id}/calibration` is the only device write that stays in FastAPI; CI guard MUST allow it.

**Hybrid resolved-playlist endpoint:**
- **D-01:** New FastAPI endpoint `GET /api/signage/resolved/{device_id}` returns `{current_playlist_id, current_playlist_name, tag_ids}` matching `SignageDeviceRead` extras at `devices.py:67-78` so client-side merge is `{...directusRow, ...resolvedResponse}` with zero rename.
- **D-01a:** Reuses existing `resolve_playlist_for_device` service + tag_ids select pattern.
- **D-01b:** Mounted under a NEW router file (e.g., `backend/app/routers/signage_admin/resolved.py`) registered in `signage_admin/__init__.py`.
- **D-01c:** RBAC: route requires Admin (single-source admin gate inherited from package router).
- **D-01d:** 404 on unknown `device_id`.

**Devices list page merge strategy:**
- **D-02:** Frontend admin Devices list uses `useQueries` per-device: (1) `useQuery(['directus', 'signage_devices'], readItems(...))` for the row list, (2) `useQueries({ queries: devices.map(d => …) })` for per-device resolved data, (3) `useMemo` merges by `device_id`.
- **D-02a:** Per-device cache key `['fastapi', 'resolved', deviceId]` aligns with SSE bridge.
- **D-02b:** N parallel HTTP/2 requests acceptable for typical device counts (<20).
- **D-02c:** SSE invalidation rules per writer surface (see D-05).

**Tags PUT diff strategy:**
- **D-03:** `replaceDeviceTags(deviceId, tagIds)` performs FE-driven diff via Directus SDK — IDENTICAL to Phase 69 D-02 `replacePlaylistTags`.
- **D-03a:** Race tolerance: last-write-wins.
- **D-03b:** SSE: each map-row insert/delete fires per Phase 65 trigger. Multi-event tolerance.
- **D-03c:** `_notify_device_self` is REPLACED at the protocol level by Phase 65 LISTEN bridge on `signage_device_tag_map`. The helper itself stays in `devices.py` for the surviving calibration path.
- **D-03d:** Implementation primed for Phase 71 shared util factoring.

**Computed-field naming:**
- **D-04:** Keep field names `current_playlist_id` / `current_playlist_name` on `SignageDevice` TS row type. TSDoc comment marks them computed via `/api/signage/resolved/{id}`.
- **D-04a:** No rename to `resolved_*`.

**Hybrid cache invalidation:**
- **D-05:** React Query keys namespaced: `['directus', 'signage_devices', …]`, `['fastapi', 'resolved', deviceId]`, surviving `signage_calibration` key.
- **D-05a:** Cross-invalidation rules per writer (PATCH name → directus list+id; PUT tags → device_tag_map + resolved; DELETE → list + remove resolved; calibration → no list invalidation; SSE `playlist-changed` → resolved).
- **D-05b:** Optimistic updates explicitly out of scope.

**CI guard precision:**
- **D-06:** New CI step blocks REINTRODUCTION of migrated FastAPI device routes while allowing surviving calibration PATCH. Method-anchored regex.
- **D-06a:** Run as a pre-stack step.
- **D-06b:** Guard scope: limit grep to `backend/app/routers/signage_admin/devices.py` only.
- **D-06c:** `_notify_device_self` helper INTENTIONALLY retained for surviving calibration path.

**SSE expectations:**
- **D-07:** SSE regression cases extend `test_pg_listen_sse.py`: Directus `updateItem('signage_devices', id, {name})` → device-changed within 500ms; Directus `deleteItem` → corresponding event within 500ms; tag-map diff → at least one event delivered; FastAPI calibration PATCH → `calibration-changed` AND `signage_devices` LISTEN trigger does NOT fire (no double event).
- **D-07a:** Test latencies: <500ms name/delete; <1000ms tag-map.

**Test triage:**
- **D-08:** Existing tests under `backend/tests/signage/` triaged per-test by planner.
- **D-09:** `tests/test_rbac.py` READ_ROUTES updates: remove migrated paths, add `GET /resolved/{id}`.
- **D-10:** Comment refresh only in `tests/signage/test_permission_field_allowlists.py`.

**Admin permission smoke:**
- **D-11:** Add Admin Directus CRUD smoke test for `signage_devices` + `signage_device_tag_map`. If composite-PK metadata-registration gap repeats from Phase 69 Plan 06, mark `xfail(strict=False)` and document for Phase 71 CLEAN.

### Claude's Discretion

- Exact Pydantic-to-TS field name parity check for `SignageDevice` row type.
- Plan ordering: tentative wave plan = Wave 1 parallelizable (devices router migration, NEW resolved router, FE swap including `useQueries` merge); Wave 2 (SSE regression + CI guard + admin smoke + test triage). Planner finalizes.
- Whether `replaceDeviceTags` runs `Promise.all` vs sequentially (Phase 69 used parallel — recommend same).
- Whether the new `resolved.py` router carries its own request log decorator or inherits from the package router.
- Whether to bundle "FE merge logic" into the same plan as the FE adapter swap or split.

### Deferred Ideas (OUT OF SCOPE)

- Optimistic update + rollback for tag-map writes — Phase 71 polish.
- Bulk `GET /api/signage/resolved?device_ids=...` endpoint — only justified if device count grows past ~50.
- Renaming `current_playlist_*` to `resolved_*` — cosmetic, deferred (or never per D-04a).
- Consolidating `_notify_device_self` / `_notify_playlist_changed` into a shared service — Phase 71 CLEAN.
- Shared `replaceTagMap(...)` util factored from Phase 69 + Phase 70 — Phase 71 FE-01.
- Contract-snapshot tests per migrated endpoint — Phase 71 FE-04.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MIG-SIGN-04 | `signage_devices` PATCH name + DELETE + PUT tags move to Directus. Calibration PATCH stays in FastAPI. List endpoint hybrid: Directus serves rows; new FastAPI `GET /api/signage/resolved/{device_id}` returns the schedule-resolved playlist; frontend merges. SSE `device-changed` / `tag_map` bridges verified. | Standard Stack (Directus SDK + asyncpg + TanStack `useQueries`); Architecture Patterns §1 (resolved-router shape), §2 (FE merge), §3 (FE-driven tag diff); Don't Hand-Roll (resolver, listener, admin gate); Pitfalls §1 (SSE event name), §2 (composite-PK metadata gap), §3 (CI guard scoping). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These directives have the same authority as locked decisions:

- **Containerization required** — no bare-metal additions; new `resolved.py` runs inside the existing FastAPI container.
- **Stack pins (verified against PyPI/npm in CLAUDE.md):** FastAPI 0.135.3, SQLAlchemy 2.0.49, asyncpg 0.31.0, Pydantic v2 (≥2.9.0), React 19.2.5, Vite 8.0.8, Tailwind CSS 4.2.2, `@tanstack/react-query` 5.97.0. **Do not introduce alternatives.**
- **Async-first DB access:** `AsyncSession` + `create_async_engine`. Do NOT mix sync `Session` patterns. Phase 70's new `resolved` router MUST use `AsyncSession` (matches `resolve_playlist_for_device` signature).
- **Alembic ownership:** No `Base.metadata.create_all()`. Phase 70 ships **zero new migrations** (D-00d — triggers already wired in `v1_22_signage_notify_triggers.py`).
- **No `dark:` Tailwind variants** (cross-cutting hazard #3) — UI-SPEC explicitly bans them.
- **`--workers 1` invariant** (cross-cutting hazard #4) — preserved by D-00e.
- **No `import sqlite3` / `import psycopg2`** (cross-cutting hazard #6).
- **Admin gate via `APIRouter(dependencies=[…])`** at the package level (cross-cutting hazard #5) — new `resolved.py` MUST inherit from `signage_admin/__init__.py`'s gate, NOT add its own (D-01c).
- **GSD workflow:** All file changes must originate from a GSD command flow.

## Standard Stack

### Core (already in use — pinned by CLAUDE.md, do not re-evaluate)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| FastAPI | 0.135.3 | New `GET /api/signage/resolved/{device_id}` route | CLAUDE.md HIGH |
| SQLAlchemy (async) | 2.0.49 | `AsyncSession` for resolver call | CLAUDE.md HIGH |
| asyncpg | 0.31.0 | DB driver — also hosts the LISTEN bridge in `signage_pg_listen.py` | CLAUDE.md HIGH |
| Pydantic v2 | ≥2.9.0 | Existing `SignageDeviceRead` extras shape (`current_playlist_id`, `current_playlist_name`, `tag_ids`) | CLAUDE.md HIGH |
| React | 19.2.5 | DevicesPage rewrite | CLAUDE.md HIGH |
| TypeScript | 5.x | Type-safe Directus row + merge | CLAUDE.md HIGH |
| `@tanstack/react-query` | 5.97.0 | `useQueries` for per-device resolved fetches | CLAUDE.md HIGH |
| `@directus/sdk` | 21.2.2 | `readItems`, `updateItem`, `deleteItem`, `createItems`, `deleteItems` (filter form) | repo `package.json` + Phase 69 Plan 03 verified |

### Supporting (already wired — verify, do not rebuild)

| Component | Path | Role in Phase 70 |
|-----------|------|------------------|
| Directus singleton | `frontend/src/lib/directusClient.ts` | Reused via `import { directus } from "@/lib/directusClient"` (D-00i) |
| `signageApi.ts` adapter seam | `frontend/src/signage/lib/signageApi.ts` | Inline-swap `listDevices`, `getDevice`, `updateDevice`, `deleteDevice` (NEW), `replaceDeviceTags`, `revokeDevice`. Add NEW `getResolvedForDevice(id)`. Keep `updateDeviceCalibration` + `listDeviceAnalytics` untouched. |
| `resolve_playlist_for_device` | `backend/app/services/signage_resolver.py` | Called as-is from new resolved router (D-01a). |
| `signage_pg_listen.py` | `backend/app/services/signage_pg_listen.py` | **No changes.** Already maps `signage_device_tag_map` → `device-changed` (line 86-88) and `signage_devices` → `device-changed` (line 82-84). See Pitfall 1. |
| `v1_22_signage_notify_triggers.py` | `backend/alembic/versions/` | **No changes.** WHEN-gate on `OLD.name IS DISTINCT FROM NEW.name` already excludes calibration columns (line 128). |
| Phase 69 `replacePlaylistTags` | `signageApi.ts:241-276` | Visually-identical structural template for `replaceDeviceTags` (D-03d). |

### Alternatives (rejected by CONTEXT.md / CLAUDE.md)

| Instead of | Could Use | Why Rejected |
|-----------|-----------|--------------|
| `useQueries` per-device merge | Bulk endpoint `GET /resolved?device_ids=...` | Deferred until device count > ~50 (CONTEXT deferred ideas) |
| FE-driven tag diff (D-03) | Directus M2M `updateItem` with full collection replace | Phase 69 D-02 already proved FE-driven diff is the pattern; M2M replace doesn't exist on composite-PK link tables in Directus 11 |
| Schema codegen for Directus types | Hand-maintained `SignageDevice` TS type | D-00h locks hand-maintained types |
| New SSE event name for tag-map | Reuse existing `device-changed` | Listener already maps it (Pitfall 1) |

**Installation:** No new packages. `replaceDeviceTags` uses imports already present in `signageApi.ts` for `replacePlaylistTags`.

## Architecture Patterns

### Recommended File Layout (delta only)

```
backend/app/routers/signage_admin/
├── __init__.py              # add: from . import resolved; router.include_router(resolved.router)
├── devices.py               # SHRINK: remove list/get/patch-name/delete/put-tags. Keep PATCH /{id}/calibration + _notify_device_self helper.
├── resolved.py              # NEW: GET /resolved/{device_id} — single route, ~30 lines
├── analytics.py             # untouched
├── media.py                 # untouched
├── playlists.py             # Phase 69 — untouched
└── playlist_items.py        # Phase 69 — untouched

frontend/src/signage/
├── lib/signageApi.ts        # swap device functions; add getResolvedForDevice
└── pages/DevicesPage.tsx    # refactor: useQueries merge

backend/tests/signage/
├── test_pg_listen_sse.py    # extend with 4 new cases per D-07
├── test_admin_directus_crud_smoke.py  # extend with signage_devices + signage_device_tag_map
└── (other device tests)     # triage per D-08

backend/tests/test_rbac.py   # READ_ROUTES update per D-09
.github/workflows/ci.yml     # new method-anchored grep step after Phase 69 guard
```

### Pattern 1: Hybrid resolved-router shape (NEW)

**What:** A tiny FastAPI router that lifts the per-device branch of today's `_attach_resolved_playlist` into a dedicated route.

**When to use:** Once per phase — this is the only new backend surface.

**Example (prescriptive — write this, don't reinvent):**
```python
# backend/app/routers/signage_admin/resolved.py
"""Phase 70 D-01 — per-device resolved playlist computation.

Lifted from devices.py::_attach_resolved_playlist. Returns the same fields
the FE was reading off SignageDeviceRead: current_playlist_id,
current_playlist_name, tag_ids. Field names match exactly so the FE merge
is `{...directusRow, ...resolvedResponse}` with zero rename (D-01).

Admin gate inherited from signage_admin package router (D-01c) — do NOT
add a second gate.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.models import SignageDevice, SignageDeviceTagMap
from app.services.signage_resolver import resolve_playlist_for_device

router = APIRouter(prefix="/resolved", tags=["signage-admin-resolved"])


class ResolvedDeviceResponse(BaseModel):
    current_playlist_id: uuid.UUID | None = None
    current_playlist_name: str | None = None
    tag_ids: list[int] | None = None


@router.get("/{device_id}", response_model=ResolvedDeviceResponse)
async def get_resolved_for_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db_session),
) -> ResolvedDeviceResponse:
    row = (
        await db.execute(select(SignageDevice).where(SignageDevice.id == device_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "device not found")
    envelope = await resolve_playlist_for_device(db, row)
    tag_rows = await db.execute(
        select(SignageDeviceTagMap.tag_id).where(SignageDeviceTagMap.device_id == device_id)
    )
    tag_ids = [tid for (tid,) in tag_rows.fetchall()]
    return ResolvedDeviceResponse(
        current_playlist_id=envelope.playlist_id,
        current_playlist_name=envelope.name,
        tag_ids=tag_ids or None,
    )
```

**Source:** Direct lift of `backend/app/routers/signage_admin/devices.py:62-79` (verified HIGH).

### Pattern 2: `useQueries` cross-source merge (FE — first project use)

**What:** TanStack Query 5's parallel-queries hook fans N device IDs into N independent fetches with a single re-render barrier.

**When to use:** Whenever the parent list comes from one source and per-row enrichment comes from another. This is the project's first such use; comment it well (CONTEXT.md "Specific Ideas").

**Example:**
```tsx
// frontend/src/signage/pages/DevicesPage.tsx (excerpt)
import { useQuery, useQueries } from "@tanstack/react-query";
import { readItems } from "@directus/sdk";
import { directus } from "@/lib/directusClient";
import { signageApi } from "@/signage/lib/signageApi";
import type { SignageDevice } from "@/signage/lib/signageTypes";

const DEVICE_FIELDS = [
  "id", "name", "created_at", "last_heartbeat_at",
  "rotation", "hdmi_mode", "audio_enabled",
] as const;

// Step 1 — Directus rows (replaces signageApi.listDevices fetch)
const { data: deviceRows = [] } = useQuery({
  queryKey: ["directus", "signage_devices"],
  queryFn: () =>
    directus.request(
      readItems("signage_devices", {
        fields: [...DEVICE_FIELDS],
        sort: ["created_at"],
        limit: -1,
      }),
    ) as Promise<Array<Pick<SignageDevice, (typeof DEVICE_FIELDS)[number]>>>,
});

// Step 2 — per-device resolved-playlist queries
const resolvedQueries = useQueries({
  queries: deviceRows.map((d) => ({
    queryKey: ["fastapi", "resolved", d.id] as const,
    queryFn: () => signageApi.getResolvedForDevice(d.id),
    // No refetchInterval — invalidation is SSE-driven (D-02c).
    staleTime: 30_000,
  })),
});

// Step 3 — merge (Directus row + resolved). Field names align per D-01,
// so the spread merge is loss-free; current_playlist_* and tag_ids land
// directly on the SignageDevice shape.
const devices: SignageDevice[] = useMemo(
  () =>
    deviceRows.map((row, i) => ({
      ...row,
      ...(resolvedQueries[i]?.data ?? {
        current_playlist_id: null,
        current_playlist_name: null,
        tag_ids: null,
      }),
    })) as SignageDevice[],
  [deviceRows, resolvedQueries],
);
```

**Source:** TanStack Query 5 official docs — `useQueries` (HIGH; already a project dependency per CLAUDE.md).

### Pattern 3: FE-driven tag-map diff (REUSE Phase 69 D-02 verbatim shape)

`replaceDeviceTags` MUST be visually identical to `replacePlaylistTags` (`signageApi.ts:241-276`). Only the collection name and parent FK column change:

| | `replacePlaylistTags` (Phase 69) | `replaceDeviceTags` (Phase 70) |
|---|---|---|
| Collection | `signage_playlist_tag_map` | `signage_device_tag_map` |
| Parent FK | `playlist_id` | `device_id` |
| Composite PK | `(playlist_id, tag_id)` | `(device_id, tag_id)` |
| Delete form | `deleteItems` filter form | `deleteItems` filter form |
| Concurrency | `Promise.all([del, add])` | `Promise.all([del, add])` |
| Return shape | `{ tag_ids }` | `{ tag_ids }` |

This identicality is **load-bearing** for Phase 71 FE-01's shared util factor.

### Pattern 4: Cache-key namespacing + SSE invalidation (D-05)

```ts
// SSE handler (already in repo; existing channel logic)
// On 'device-changed':
queryClient.invalidateQueries({ queryKey: ["directus", "signage_devices"] });
queryClient.invalidateQueries({ queryKey: ["fastapi", "resolved", deviceId] });

// On 'playlist-changed':
queryClient.invalidateQueries({ queryKey: ["fastapi", "resolved", deviceId] });
// Also invalidate the directus playlists list (Phase 69 surface).

// On 'calibration-changed':
// Player-only event. Admin list does NOT invalidate (D-05a).
```

### Anti-Patterns to Avoid

- **Bolting `/resolved/{id}` onto `devices.py`** — would inflate the file Phase 71 CLEAN wants to shrink. Use a separate module.
- **Adding a second admin gate inside `resolved.py`** — violates D-01c / cross-cutting hazard #5. Inherit from package router.
- **Generating Directus types via codegen** — violates D-00h.
- **Fetching all `/resolved/{id}` sequentially in a `useEffect` loop** — defeats `useQueries` parallelism and breaks SSE invalidation per device.
- **Adding a `tags` column to `signage_devices`** — would invalidate the WHEN-gate preflight in `v1_22_signage_notify_triggers.py:14-46`. Tags live in `signage_device_tag_map` only.
- **Renaming `current_playlist_*` to `resolved_*`** — D-04a; consumer ripple with zero benefit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tag-to-playlist resolution | Custom SQL in `resolved.py` | `resolve_playlist_for_device(db, row)` | Already implements priority DESC, tie-break by updated_at, schedule-window logic, empty-envelope sentinel. Reused by player + admin paths today. |
| Schedule resolver | Re-derive schedule windows | Same service — handles HHMM TZ math | One conversion point keeps wire-format invariants stable |
| `device-changed` SSE for tag-map mutations | New trigger or FastAPI helper | Phase 65 LISTEN bridge — already wired and tested | `_notify_device_self` becomes redundant for the tag-map path; bridge is writer-agnostic |
| Calibration PATCH validation | Ad-hoc rotation check | Existing Pydantic `Literal[0, 90, 180, 270]` | Out of scope per D-00j, but DON'T touch it |
| Admin gate on new route | Per-route `Depends(require_admin)` | Inherit from `signage_admin/__init__.py` package router | Single-source admin gate invariant (cross-cutting hazard #5) |
| Cross-source merge in custom hook | Manual `useEffect` + `useState` | TanStack `useQueries` + `useMemo` | Already a project dependency; gives free isPending / isError per row |
| Directus error normalization | Ad-hoc try/catch | Phase 71 will add `DirectusError` adapter normalization (FE-04) | Out of scope for Phase 70; rely on existing toast patterns |
| Tag-map M2M update | Single PATCH with nested array | FE-driven diff (Phase 69 D-02 pattern) | Composite-PK link table; Directus 11 nested-O2M PATCH does not exist for this schema |

**Key insight:** Phase 70 is structurally a copy of Phase 69 with one collection swap (`signage_playlist_tag_map` → `signage_device_tag_map`) plus one new route. Every other component already exists.

## Runtime State Inventory

This phase is a writer-swap, not a rename, but a brief inventory keeps the planner honest:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `signage_devices` and `signage_device_tag_map` rows are READ identically by old (FastAPI) and new (Directus) writers — same Postgres tables, no schema change. | **None.** Data shape is preserved. |
| Live service config | Directus collections `signage_devices` + `signage_device_tag_map` already registered (Phase 65 SCHEMA-01..05) and Admin permissions already granted via `admin_access:true` (Phase 65/68/69 D-08 confirmation). | **None.** Verify in admin smoke (D-11). |
| OS-registered state | None — no scheduled tasks, no systemd units bound to device names. | None — verified by `find /etc/systemd /etc/cron.* -name '*device*' 2>/dev/null` returning empty in Pi context (no claim about external Pi infra). |
| Secrets / env vars | No env var names contain "device" or "signage_devices". `VITE_DIRECTUS_URL` already plumbed (Phase 64). | **None.** |
| Build artifacts | None — Python is in-place; FE rebuild required (standard Vite flow). | **None beyond standard rebuild.** |
| Cached client state | TanStack Query keys for `signageKeys.devices()` (legacy) — Phase 71 FE-03 will purge via one-shot `removeQueries` + localStorage flag. **Phase 70's job:** start writing under the new `["directus", "signage_devices"]` and `["fastapi", "resolved", id]` keys. | Planner: ensure all new code writes the new keys; legacy purge is Phase 71's responsibility. |

**Nothing else found.** The Phase 65 LISTEN bridge made device-changed SSE writer-agnostic, so no runtime listener registration changes hands.

## Common Pitfalls

### Pitfall 1: SSE event name for `signage_device_tag_map` is `device-changed`, NOT `playlist-changed`

**What goes wrong:** CONTEXT.md D-03b states "each map-row insert/delete fires `playlist-changed` per Phase 65 trigger on `signage_device_tag_map`." This is **incorrect** for the listener layer.

**Source of truth (verified HIGH against `backend/app/services/signage_pg_listen.py:86-88`):**
```python
elif table == "signage_device_tag_map":
    # ...
    event = "device-changed"
```
And confirmed by `backend/tests/signage/test_pg_listen_sse.py:50-57` `TABLE_EVENT_CASES` table:
```python
("signage_device_tag_map", "device-changed"),
("signage_devices", "device-changed"),
```

**Why it happens:** The Postgres trigger fires `pg_notify('signage_change', ...)` on the table; the **listener** (not the trigger) decides which SSE event name to emit. For device-tag-map mutations, the listener sends `device-changed`.

**How to avoid:** SSE regression assertions in the test extension (D-07) MUST assert `device-changed` for tag-map diff cases — not `playlist-changed`. The CONTEXT D-03b text is a documentation slip; the locked decision (multi-event tolerance) is correct, only the event name is wrong.

**Warning signs:** Test failure of the form `assert event == 'playlist-changed'` after a `signage_device_tag_map` write. Fix the assertion, not the listener.

**Note for D-05a SSE invalidation rule:** On `device-changed`, both `["directus", "signage_devices"]` (list) AND `["fastapi", "resolved", deviceId]` (per-device resolved) must be invalidated, because tag-map changes flip the resolver output but the listener fires `device-changed`, not `playlist-changed`.

### Pitfall 2: Composite-PK Directus collection metadata-registration gap

**What goes wrong:** Phase 69 Plan 06 discovered that `signage_playlist_tag_map` (composite PK `(playlist_id, tag_id)`, `schema:null` in v1.22 snapshot) returns `403 Forbidden` on `/items/signage_playlist_tag_map` REST CRUD even when the auth token is Admin (`admin_access:true`). Permission rows in `bootstrap-roles.sh` do NOT fix this — admin bypasses permissions entirely.

`signage_device_tag_map` has the **same shape** (composite PK `(device_id, tag_id)`, `schema:null`). Verified in `directus/snapshots/v1.22.yaml:59-61`.

**Why it happens:** Directus 11 metadata-registration gap on composite-PK collections without a surrogate `id` column.

**How to avoid:**
- The FE-driven tag diff (D-03) **works** because the Directus SDK uses `/items/signage_device_tag_map` collection-level CRUD, not per-row `/items/{id}` lookups by composite key.
- The **smoke test** in `test_admin_directus_crud_smoke.py` will likely 403 the same way Phase 69's did.
- Per D-11: mark `xfail(strict=False)` and document for Phase 71 CLEAN consolidation.
- Do NOT spend time trying to fix it in Phase 70 — it's a Directus 11 metadata bug, not a permissions issue.

**Warning signs:** Smoke test 403s on `GET /items/signage_device_tag_map` with an Admin token. Solution: xfail, link to Phase 69 Plan 06 lesson.

### Pitfall 3: CI grep guard false-positive on calibration PATCH

**What goes wrong:** Naive regex `@router\.patch.*"/api/signage/devices` matches the surviving `PATCH /{device_id}/calibration` (which lives in the same `devices.py`).

**Why it happens:** Calibration uses the `/devices/{id}/calibration` suffix; a non-suffix-anchored regex catches both routes.

**How to avoid (D-06 prescription):**
- Method-anchored regex limited to `devices.py` only (D-06b — Phase 69 D-04 lesson).
- Block patterns:
  - `@router\.(get|patch|delete)\b[^@]*"/api/signage/devices/?\{?[^}]*\}?"?$` — root list + by-id GET, name PATCH, DELETE
  - `@router\.put\b[^@]*"/api/signage/devices/\{[^}]+\}/tags"` — tags PUT
- Allow (do NOT match):
  - `@router.patch` on `"/{device_id}/calibration"` (suffix-anchored)
  - `@router.get` on `"/api/signage/resolved/{device_id}"` (different file)

**Warning signs:** CI fails on a clean checkout because the calibration PATCH triggers the guard. Fix: tighten the regex; do NOT allow-list per-line.

### Pitfall 4: Forgetting to invalidate `["fastapi", "resolved", id]` on tag mutation

**What goes wrong:** After `replaceDeviceTags` succeeds, the Directus list invalidates but the per-device resolved cache is stale — the user sees the old playlist name in the row.

**Why it happens:** Tag changes **do** affect resolver output (different tags → different playlist match) but the FE writer (Directus SDK) doesn't know about the FastAPI cache key.

**How to avoid:** D-05a explicitly: "After Directus PUT tags (FE diff) → invalidate `['directus', 'signage_device_tag_map', { deviceId: id }]` + `['fastapi', 'resolved', id]`." Plus the SSE `device-changed` event from the bridge will invalidate too — but the in-flight UI MUST not depend on SSE round-trip latency for correctness.

**Warning signs:** Manual UAT shows stale playlist-name cell after edit-device dialog save. Fix: ensure mutation `onSuccess` invalidates both keys.

### Pitfall 5: `deleteItems` SDK signature for composite-PK collections

**What goes wrong:** Calling `deleteItems('signage_device_tag_map', [...])` with an array of IDs fails because there is no surrogate `id` column — composite PK has no single integer/UUID handle.

**Why it happens:** Directus SDK 21.2.2 `deleteItems` accepts `string[] | number[] | TQuery`. For composite-PK collections, only the `TQuery` (filter) form works.

**How to avoid:** Use Phase 69 D-03 verbatim — the filter form:
```ts
deleteItems("signage_device_tag_map", {
  filter: { _and: [{ device_id: { _eq: id } }, { tag_id: { _in: toRemove } }] },
});
```

**Warning signs:** `400 Bad Request` from Directus on tag removal. Fix: switch to filter form.

## Code Examples

### Example 1: New `resolved.py` router

See "Pattern 1" above for full prescriptive code. Key invariants:
- Inherits admin gate from package router (no `Depends(require_admin)` here).
- Uses `AsyncSession`.
- Field names match `SignageDeviceRead` extras exactly: `current_playlist_id`, `current_playlist_name`, `tag_ids`.
- 404 on missing device (matches today's behavior at `devices.py:99-100`).

**Source:** `backend/app/routers/signage_admin/devices.py:62-79` (HIGH, direct repo verification).

### Example 2: `replaceDeviceTags` (FE — write this verbatim)

```ts
// frontend/src/signage/lib/signageApi.ts (additions)
// Phase 70 D-03 — FE-driven diff against signage_device_tag_map.
// IDENTICAL shape to replacePlaylistTags (D-03d) so Phase 71 FE-01
// can extract a shared replaceTagMap util mechanically.
replaceDeviceTags: async (id: string, tag_ids: number[]) => {
  const existing = (await directus.request(
    readItems("signage_device_tag_map", {
      filter: { device_id: { _eq: id } },
      fields: ["tag_id"],
      limit: -1,
    }),
  )) as { tag_id: number }[];
  const existingTagIds = new Set(existing.map((r) => r.tag_id));
  const desiredTagIds = new Set(tag_ids);
  const toAdd = [...desiredTagIds].filter((t) => !existingTagIds.has(t));
  const toRemove = [...existingTagIds].filter((t) => !desiredTagIds.has(t));
  await Promise.all([
    toRemove.length > 0
      ? directus.request(
          deleteItems("signage_device_tag_map", {
            filter: {
              _and: [
                { device_id: { _eq: id } },
                { tag_id: { _in: toRemove } },
              ],
            },
          }),
        )
      : Promise.resolve(),
    toAdd.length > 0
      ? directus.request(
          createItems(
            "signage_device_tag_map",
            toAdd.map((tagId) => ({ device_id: id, tag_id: tagId })),
          ),
        )
      : Promise.resolve(),
  ]);
  return { tag_ids } as { tag_ids: number[] };
},
```

**Source:** `frontend/src/signage/lib/signageApi.ts:241-276` (Phase 69 D-02 — direct structural copy).

### Example 3: `revokeDevice` — keep route, swap writer

CONTEXT.md UI-SPEC §"Copywriting Contract" → "Destructive confirmation — Delete" notes that `revokeDevice` migrates to `deleteItem('signage_devices', id)`. **Verify with planner** whether the existing `POST /api/signage/pair/devices/{id}/revoke` (which does more than DELETE — see `signageApi.ts:339-342`) is in scope for replacement, or whether only the package-router DELETE is replacing it.

```ts
// Tentative — planner to confirm:
revokeDevice: async (id: string) => {
  await directus.request(deleteItem("signage_devices", id));
  return null;
},
```

**Confidence:** MEDIUM — UI-SPEC says replace, but the existing endpoint is on `signage_pair.py`, not `signage_admin/devices.py`. Planner must clarify whether the pair router's revoke endpoint is in scope (CONTEXT D-00j only mentions calibration as the surviving route in `devices.py`). If the pair router endpoint stays, then `revokeDevice` may need to remain a FastAPI call and only the `deleteDevice` package-router DELETE migrates.

### Example 4: SSE regression test extension (D-07)

```python
# backend/tests/signage/test_pg_listen_sse.py — additions

async def test_directus_device_name_update_emits_device_changed(...):
    """D-07: Directus updateItem('signage_devices', id, {name}) → device-changed within 500ms."""
    # Use TABLE_EVENT_CASES helper or pattern from existing tests
    ...

async def test_directus_device_delete_emits_device_changed(...):
    """D-07: Directus deleteItem('signage_devices', id) → device-changed within 500ms."""
    ...

async def test_directus_device_tag_map_diff_emits_device_changed(...):
    """D-07/Pitfall 1: signage_device_tag_map insert/delete fires device-changed
    (NOT playlist-changed — listener mapping at signage_pg_listen.py:86-88).
    At-least-once tolerance per D-03b."""
    ...

async def test_calibration_patch_does_not_fire_listen_trigger(...):
    """D-07: FastAPI calibration PATCH fires calibration-changed SSE AND
    signage_devices LISTEN trigger does NOT fire (no double event).
    Protects v1_22 WHEN-gate (OLD.name IS DISTINCT FROM NEW.name)."""
    ...
```

**Source:** `backend/tests/signage/test_pg_listen_sse.py:50-57` (HIGH — existing harness).

## State of the Art

| Old Approach | Current Approach (this phase) | Why Changed |
|---|---|---|
| Server-side `_attach_resolved_playlist` merge in list/get FastAPI routes | Client-side merge of Directus rows + per-device `/resolved/{id}` | Directus owns the list; FastAPI owns compute (resolver). Boundary respects v1.22 "Directus = shape, FastAPI = compute." |
| FastAPI `_notify_device_self` invoked from PUT /tags | Phase 65 Postgres LISTEN bridge on `signage_device_tag_map` | Writer-agnostic SSE — Directus, psql, future writers all fire identically. Helper retained only for surviving calibration path. |
| Single FastAPI list call returns enriched rows | `useQuery` + `useQueries` pair with namespaced cache keys | Lets resolved cache invalidate independently per-device; aligns with SSE per-device events. |
| `deleteItems(collection, [ids])` with surrogate IDs | `deleteItems(collection, { filter: ... })` for composite-PK link tables | Directus 11 SDK shape; surrogate `id` column doesn't exist on `signage_device_tag_map`. |

**Deprecated this phase:**
- `GET /api/signage/devices` (list) — removed.
- `GET /api/signage/devices/{id}` — removed.
- `PATCH /api/signage/devices/{id}` (name) — removed.
- `DELETE /api/signage/devices/{id}` — removed (pending revokeDevice clarification — see Example 3).
- `PUT /api/signage/devices/{id}/tags` — removed.

**Retained in FastAPI:**
- `PATCH /api/signage/devices/{id}/calibration` (D-00j).
- `GET /api/signage/analytics/devices` (v1.22 lock — bucketed uptime aggregate).
- `_notify_device_self` helper (D-03c — for calibration consumers; Phase 71 may consolidate).

## Open Questions

1. **`revokeDevice` migration scope**
   - **What we know:** UI-SPEC says "Phase 70 migration replaces the FastAPI revoke endpoint with a Directus `deleteItem('signage_devices', id)` call." But the current `revokeDevice` calls `POST /api/signage/pair/devices/{id}/revoke` on `signage_pair.py`, not the `signage_admin/devices.py` DELETE.
   - **What's unclear:** Does the pair-router revoke endpoint do additional work (JWT invalidation, pairing-session cleanup) that a raw `deleteItem` would skip?
   - **Recommendation:** Planner to inspect `backend/app/routers/signage_pair.py::revoke_device` before writing the FE-swap plan. If pair-router does JWT/session cleanup, the swap is **not** safe and `revokeDevice` should remain a FastAPI call (CI guard must allow `/api/signage/pair/*`). If it's just a DELETE wrapper, the swap is fine.

2. **`useQueries` migration vs DeviceEditDialog interplay**
   - **What we know:** `DeviceEditDialog` today calls `updateDevice({name, tag_ids})` which the FE adapter splits into PATCH-then-PUT (signageApi.ts:307-318).
   - **What's unclear:** With both PATCH (Directus updateItem) and PUT-tags (FE diff) being Directus SDK calls now, should they still be sequenced (current behavior) or run as `Promise.all`?
   - **Recommendation:** Sequence them (PATCH name first, then tag diff). Failure of the second leaves the device in a half-updated state, but parallel run risks the same; sequencing keeps the existing observable behavior. Planner's call.

3. **Bulk endpoint threshold**
   - **What we know:** D-02b states <20 devices is acceptable. CONTEXT defers `GET /resolved?device_ids=[...]` to "if device count grows past ~50."
   - **What's unclear:** Today's actual deployed device count is not in any planning artifact I read.
   - **Recommendation:** Don't add bulk endpoint now. Document in plan: "If device count exceeds ~30 in production, file follow-up issue for bulk endpoint."

## Environment Availability

This phase has **no new external dependencies** — every tool is already in the running stack. Quick sanity:

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Docker Compose v2 | Stack (CLAUDE.md) | ✓ | shipped | — |
| PostgreSQL | Triggers + LISTEN/NOTIFY | ✓ | 17-alpine | — |
| Directus 11 | Device CRUD + composite-PK collections | ✓ | shipped Phase 65 | — |
| FastAPI 0.135.3 | New `resolved` router | ✓ | pinned | — |
| asyncpg 0.31.0 | LISTEN bridge (already wired) | ✓ | pinned | — |
| `@directus/sdk` 21.2.2 | FE writer swap | ✓ | repo `package.json` | — |
| `@tanstack/react-query` 5.97.0 | `useQueries` cross-source merge | ✓ | pinned | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Sources

### Primary (HIGH confidence — direct repo verification)

- `backend/app/routers/signage_admin/devices.py` (full file read) — current device routes, `_attach_resolved_playlist`, `_notify_device_self`, calibration PATCH.
- `backend/app/routers/signage_admin/__init__.py` — package router admin gate pattern (D-01c invariant).
- `backend/app/services/signage_pg_listen.py` lines 31-90 — table→event mapping (Pitfall 1).
- `backend/app/services/signage_resolver.py` — `resolve_playlist_for_device` signature.
- `backend/app/schemas/signage.py` lines 116-124 — `SignageDeviceRead` extras shape.
- `backend/alembic/versions/v1_22_signage_notify_triggers.py` — WHEN-gate at line 128.
- `backend/tests/signage/test_pg_listen_sse.py` lines 30-57 — `TABLE_EVENT_CASES` confirms `device_tag_map → device-changed`.
- `frontend/src/signage/lib/signageApi.ts` lines 230-348 — Phase 69 `replacePlaylistTags` template + current device functions.
- `frontend/src/signage/pages/DevicesPage.tsx` lines 1-60 — current consumer using `signageKeys.devices()`.
- `directus/snapshots/v1.22.yaml` lines 19-61 — `signage_devices` + `signage_device_tag_map` collection registration with `schema:null` (composite-PK metadata).
- `.planning/REQUIREMENTS.md` MIG-SIGN-04 — phase scope.
- `.planning/STATE.md` v1.22 locked decisions + Phase 65/66/67/68/69 implementation notes.
- `.planning/ROADMAP.md` Phase 70 success criteria.
- `CLAUDE.md` — full stack pin table + cross-cutting hazards.

### Secondary (MEDIUM confidence — pattern carry from prior phase artifacts)

- Phase 69 D-02 `replacePlaylistTags` shape — verified in repo + Phase 69 CONTEXT.md.
- Phase 69 D-04 method-anchored CI grep guard scoping — Phase 69 Plan 05 lesson.
- Phase 69 Plan 06 composite-PK xfail pattern — STATE.md confirmed lesson; same root cause expected for `signage_device_tag_map`.

### Tertiary (LOW confidence — flagged for planner validation)

- Exact `revokeDevice` migration scope (Open Question 1) — pair router behavior not inspected; planner must verify.
- DeviceEditDialog sequencing decision (Open Question 2) — current behavior is PATCH-then-PUT but no test pins the order.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — entirely pinned by CLAUDE.md PyPI/npm-verified table + Phase 69 SDK usage.
- Architecture (resolved router, useQueries merge, FE tag diff): **HIGH** — direct lifts from existing code, structural patterns established in Phase 69.
- Pitfalls: **HIGH** — Pitfall 1 (SSE event name) verified in 3 places (listener, test cases, trigger SQL); Pitfalls 2-5 confirmed by Phase 69 Plan 06 + STATE.md lessons + Phase 69 D-04 calibration-grep precedent.
- Open Questions 1-2: **LOW** — flagged for planner clarification before plan-writing.

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (Directus 11 + Postgres triggers stable; flag for re-check if `@directus/sdk` major version bumps before phase ships)
