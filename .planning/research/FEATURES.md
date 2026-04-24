# Feature Research — v1.22 Backend Consolidation

**Milestone:** v1.22 Backend Consolidation — Directus-First CRUD
**Researched:** 2026-04-24
**Mode:** Ecosystem / Feasibility (brownfield — existing stack)
**Overall confidence:** MEDIUM-HIGH (Directus capabilities verified via official docs; edge cases inferred from the current FastAPI behavior)

## Domain

The migration target is **~25 pure-CRUD FastAPI endpoints** across `signage_admin/*`, `data.py`, and `me.py`. The endpoints fall into five mechanical patterns:

1. **Plain CRUD over a single table** (`tags`, most of `schedules`, most of `playlists`, `devices` basic fields)
2. **CRUD with custom field validation** (rotation ∈ {0,90,180,270}; `start_hhmm < end_hhmm`)
3. **Bulk O2M replace in a single transaction** (`playlist_items` PUT, playlist/device tag-map PUT)
4. **CRUD with SSE fanout side-effect** (every admin mutation in `signage_admin/*` — `playlist-changed`, `calibration-changed`, `schedule-changed`)
5. **Computed / read-only projections** (`analytics/devices` uptime aggregate; `/data/employees` overtime roll-up; resolved-playlist attachment on device list)

Directus 11 is excellent at #1 and OK at #2. It is **structurally hostile to #5** and makes #4 conditional on Directus Flows that call back into FastAPI — which means the SSE fanout plane stays in FastAPI regardless. #3 has a known footgun (nested-O2M update is NOT a documented-atomic bulk replace — it's a PATCH with create/update/delete arrays that Directus resolves sequentially).

The **critical architectural fact**: `signage_broadcast.py` is an in-process `asyncio.Queue` dict that is pinned to `--workers 1`. Any admin mutation served by Directus (a separate process) cannot reach this dict directly. The only bridge is: *Directus Flow → webhook → FastAPI → `notify_device`*. That webhook cost is paid on every signage admin write.

## Per-Endpoint Verdict Table

| Endpoint | Directus native? | Verdict | Notes |
|----------|------------------|---------|-------|
| `GET /signage/tags` | YES | **MOVE** (table-stakes) | `GET /items/signage_device_tags` with sort=id |
| `POST /signage/tags` | YES | **MOVE** | Unique constraint on `name` → Directus surfaces 400 (shape drift from current 409) |
| `PATCH /signage/tags/{id}` | YES | **MOVE** | Same unique-constraint shape-drift caveat |
| `DELETE /signage/tags/{id}` | Partial | **MOVE with scope decision** | Directus returns a generic 500/400 on FK RESTRICT; current `{"detail":"tag in use"}` 409 is lost unless a Flow reshapes it |
| `GET /signage/schedules` (list/get) | YES | **MOVE** | Sort by `priority DESC, updated_at DESC` via `?sort=-priority,-updated_at` |
| `POST /signage/schedules` | YES + Flow | **MOVE + SSE Flow** | `weekday_mask 0..127` → field validation; `start_hhmm < end_hhmm` → requires **item-level custom validation** (Directus supports filter-rule-based field validation; cross-field check needs either a schema CHECK constraint kept in Alembic or a Flow Filter (Blocking) hook that returns `Throw Error`). **SSE fanout requires Flow → FastAPI webhook.** |
| `PATCH /signage/schedules/{id}` | YES + Flow | **MOVE + SSE Flow** | Must fan out to `{old_playlist_id, new_playlist_id}` — Flow needs access to both. Directus flows do expose the pre-mutation item (trigger payload includes `keys` + `payload`); resolving old playlist_id may require an explicit pre-read operation inside the Flow. **Verify in Phase 1 spike.** |
| `DELETE /signage/schedules/{id}` | YES + Flow | **MOVE + SSE Flow** | Capture `playlist_id` pre-delete via Flow `items.delete` filter (blocking) hook |
| `GET /signage/playlists` (list/get) | YES | **MOVE** | `?fields=*,tag_ids.*` for tag expansion |
| `POST /signage/playlists` | YES + Flow | **MOVE + SSE Flow** | Fan out via `devices_affected_by_playlist` — Flow must call FastAPI `/internal/signage/broadcast` since the resolver lives in FastAPI |
| `PATCH /signage/playlists/{id}` | YES + Flow | **MOVE + SSE Flow** | Same pattern |
| `DELETE /signage/playlists/{id}` | **NO** (clean) | **KEEP-OR-HOOK** | Current behavior: catch `IntegrityError` → return `{"detail":"...","schedule_ids":[...]}` with 409. Directus does not reshape FK RESTRICT errors. Options: (a) relax scope — accept Directus's 500-ish shape; (b) keep this single endpoint in FastAPI; (c) Directus Flow `items.delete` Filter(Blocking) that pre-queries `signage_schedules` and Throws a structured error. **Option (c) is the cleanest Directus-idiomatic path.** |
| `PUT /signage/playlists/{id}/tags` | Partial | **MOVE with model shift** | Directus models M2M through junction collection; replacing the set is an `items.update` on the parent with `{tag_ids: [...new list...]}` — Directus diffs and issues delete+create on the junction. Not a single-statement atomic replace but commits in one transaction. Verify pre-snapshot of affected devices still survives (see SSE fanout below). |
| `GET /signage/playlists/{id}/items` | YES | **MOVE** | `GET /items/signage_playlist_items?filter[playlist_id][_eq]=...&sort=position` |
| `PUT /signage/playlists/{id}/items` (bulk replace) | **RISK** | **MOVE with scope decision** | Directus's "replace all children" is expressed as `PATCH /items/signage_playlists/{id}` body `{ items: { create: [...], update: [...], delete: [...] } }`. Client must compute the diff (or pass full replacement by deleting then recreating in Flow). This is NOT the current FastAPI "DELETE all then INSERT fresh in one txn" — Directus resolves each sub-operation sequentially. It IS committed atomically in one DB transaction. **Behavior equivalent; semantics subtly different.** Frontend diff logic is additional work. |
| `GET /signage/devices` (list) | YES, but | **HYBRID** | Trivial row projection is Directus-native, but current response joins **resolved playlist** (`current_playlist_id`, `current_playlist_name`) which runs the `resolve_playlist_for_device` resolver. Options: (a) stop joining — frontend re-fetches via a dedicated FastAPI `/signage/resolved/{device_id}` endpoint; (b) keep a thin FastAPI `GET /api/signage/devices` that proxies Directus + decorates. **Recommend (a) — Directus returns raw rows; frontend uses TanStack Query to join resolved playlist from a separate compute endpoint.** |
| `GET /signage/devices/{id}` | YES, but | **HYBRID** (same as above) | Same resolver-decorate problem, single-device form |
| `PATCH /signage/devices/{id}` (name) | YES | **MOVE** | Name edit — pure field update |
| `PATCH /signage/devices/{id}/calibration` | YES + Flow | **MOVE + SSE Flow** | `rotation` → Directus field validation `_in: [0,90,180,270]`; `hdmi_mode` → string; `audio_enabled` → bool. **SSE `calibration-changed` must fan out via Flow → FastAPI webhook.** Scope of PATCH changes (partial update) matches Directus default. |
| `DELETE /signage/devices/{id}` | YES | **MOVE** | No FK RESTRICT (heartbeat/log tables are weak FKs or cascading) — confirm per-table |
| `PUT /signage/devices/{id}/tags` | Partial | **MOVE + SSE Flow** | Same M2M-replace model as playlist tags. **SSE: fanout is to the single mutating device** (`_notify_device_self`) — trivial to express in a Flow |
| `GET /signage/analytics/devices` | **NO** | **KEEP IN FASTAPI** | Pure computed aggregate (`date_trunc('minute')`, `COUNT(DISTINCT)`, `EXTRACT(EPOCH FROM now() - MIN(ts))/60`, partial-history denominator, `LEAST(1440, ...)`). Directus `aggregate` supports `count`, `sum`, `avg`, `min`, `max`, `countDistinct` but cannot express the composite `(distinct minute-buckets) / LEAST(1440, age_of_first_hb_min)` ratio. Writing this as a Directus `custom endpoint` extension re-implements what FastAPI already does cleanly. **Do not move.** |
| `GET /api/data/sales` | YES | **MOVE** | Straight filter + sort + limit — Directus items API handles `filter[order_date][_gte]`, `filter[customer_name][_icontains]`, `sort=-order_date`, `limit=500`. `search` param (multi-field OR) → Directus `search=<term>` which searches all string fields; may match too broadly compared to current 3-field whitelist. **Scope decision: accept broader search, or encode as `filter[_or]`.** |
| `GET /api/data/employees` | **NO** | **KEEP IN FASTAPI** (or split) | The employee row projection is Directus-native, but the `date_from`/`date_to` overtime/total-hours roll-up loops `PersonioAttendance` joins and computes `worked = end - start - break`, `daily_quota = weekly_hours/5`, `ot = max(0, worked - quota)`, aggregates per employee. Options: (a) split — Directus serves the raw `personio_employees` collection; FastAPI keeps `/api/data/employees/overtime?date_from=&date_to=` returning the roll-up; frontend merges. (b) keep the combined endpoint in FastAPI. **Recommend (a) — matches the "Directus = shape, FastAPI = compute" principle from PROJECT.md**. Also: 400 validation on `date_from`/`date_to` pairing is trivial to re-express in FastAPI. |
| `GET /api/me` | YES (delete entirely) | **DELETE** | Frontend uses Directus SDK `readMe()` → `/users/me`. Role claim is already present on the Directus user object (`.role.name` or policy). Frontend already has `directusClient.ts` — one call site swap. No replacement endpoint needed. |

## Table-Stakes Capabilities (Directus gives for free)

Everything Directus ships out-of-the-box that we currently hand-roll:

- **CRUD list/get/create/update/delete** on every table with configurable pagination, sort, filter, field-projection
- **Role/permission gating** via Admin/Viewer policies (already wired as of v1.11-directus). Replaces the `require_admin` dep on each router
- **Unique constraint enforcement** (tag name) — surfaces as HTTP 400 with a `RecordNotUniqueException` code
- **FK validation** on create/update (e.g., `signage_schedules.playlist_id` → must reference an existing playlist)
- **Field-level validation via filter rules**: `_in: [0, 90, 180, 270]`, `_between`, `_required`, regex, custom error messages per field
- **Automatic OpenAPI / GraphQL schema generation** — replaces hand-written Pydantic schemas for moved collections
- **JWT validation + user context** — FastAPI's `directus_auth.get_current_user` is redundant for Directus-served endpoints
- **Search** across string fields (`?search=foo`) — replaces the hand-rolled 3-column OR `ilike` in `data.py`
- **Date range filters** via filter-rule operators (`_gte`, `_lte`, `_between`) — replaces manual SQL predicate builders
- **M2M relation expansion** (`?fields=*,tag_ids.*`) — replaces the separate `select(SignagePlaylistTagMap.tag_id)` we currently issue per row
- **Ordered O2M loading** — `signage_playlist_items` ordered by `position` via `sort=position` on the deep field

Confidence: **HIGH** for the above — Directus 11 core feature set is stable and documented.

## Differentiators Needing Configuration

Things Directus CAN do but that require non-trivial Directus-side configuration (Data Studio work, Flow authoring, or snapshot.yml edits) to match current FastAPI behavior:

### 1. Cross-field validation (`start_hhmm < end_hhmm`)

Directus field-level validation is single-field via filter-rule operators. Cross-field constraints have two routes:

- **Database CHECK constraint** (already present — Alembic `v1_18_signage_schedules` has `CHECK (start_hhmm < end_hhmm)`). Directus will surface a DB CHECK violation as a generic 500-class error — frontend loses the current structured `422 "start_hhmm must be less than end_hhmm"` shape.
- **Flow Filter(Blocking) hook** on `signage_schedules.items.create` and `.items.update` that throws a structured error. This preserves the error shape but adds a Flow per collection.

**Recommendation:** Keep the Alembic CHECK as defense-in-depth; add a Flow for the structured error shape. ~15 min to author per collection.

### 2. Admin-mutation → SSE fanout (the critical one)

**The most important differentiator in this milestone.** Every `signage_admin/*` write currently triggers `signage_broadcast.notify_device()`, which puts onto an in-process `asyncio.Queue` read by the player's SSE endpoint. Directus cannot touch this dict — it's a different process.

**The bridge pattern:** Directus Flow (Action, non-blocking) on every mutated signage collection calls a new FastAPI internal endpoint:

```
POST /api/internal/signage/broadcast   (shared-secret auth)
{
  "event": "playlist-changed" | "schedule-changed" | "calibration-changed",
  "collection": "signage_playlists",
  "keys": ["<uuid>"],
  "payload": { ... what changed ... }
}
```

FastAPI runs the `resolve_playlist_for_device` / `devices_affected_by_playlist` logic and calls `notify_device(device_id, payload)` exactly as today. Flows available:

- `items.create` → mutation payload has full item
- `items.update` → payload has `keys[]` + `data{}` (deltas only — **does NOT include pre-update values**; for schedule PATCH we need old_playlist_id, so Flow needs a `Read Data` operation before the mutation completes)
- `items.delete` → payload has `keys[]` only; need a `Read Data` step BEFORE the delete commits (Filter(Blocking) hook) to capture `playlist_id` for fanout

Confidence: **MEDIUM-HIGH** — pattern is documented (Directus Flows support HTTP Request operations and custom webhooks). The pre-mutation read for PATCH/DELETE is a known Directus Flow pattern.

**Cost:** one internal webhook endpoint + shared secret + 5-7 Flows to author (one per mutating collection × event). Offset against deleting ~200 LOC of per-endpoint `_notify_*` helpers.

### 3. FK RESTRICT → structured 409 on playlist delete

Current `DELETE /signage/playlists/{id}` returns `{"detail": "playlist has active schedules", "schedule_ids": [...]}`. Directus returns a generic 500/400 on FK violations. A Flow Filter(Blocking) `items.delete` hook on `signage_playlists` can:

1. Query `signage_schedules` WHERE `playlist_id == $trigger.keys[0]`
2. If non-empty, `Throw Error` operation with the structured body

Confidence: **MEDIUM** — the mechanism is documented, exact error-body shape via `Throw Error` may need a spike. Allowed scope decision: accept Directus's default shape and update the frontend to handle a simpler 400 without `schedule_ids` — frontend would re-query schedules to show the user.

### 4. Bulk items replace (PUT `/playlists/{id}/items`)

Directus expresses "replace all children" via:

```
PATCH /items/signage_playlists/{id}
{ "items": {
    "create": [{ media_id, position, duration_s, transition }, ...],
    "update": [],
    "delete": [<existing item ids to remove>]
}}
```

This runs in one DB transaction. Equivalent atomicity to current FastAPI "DELETE all + INSERT all in one commit". But:

- **Client must compute the diff** (or pass `delete: <all-existing-ids>` + `create: <all-new>` to mimic DELETE-all-INSERT-all). The simpler mimic form preserves current semantics.
- Item uniqueness on `(playlist_id, position)` is preserved via either DB unique constraint (check Alembic) or Flow validation.

Confidence: **MEDIUM** — I did not fully verify the "delete all + create all" form is a valid single-PATCH shape in Directus 11. **Phase 1 spike must confirm.**

## Anti-Features / Keep in FastAPI

Do **not** attempt to move these to Directus:

### `analytics.py` — computed uptime aggregate

Bucketed distinct-minute count + partial-history denominator is SQL the Directus `aggregate` API cannot express. Writing a Directus custom endpoint extension duplicates what FastAPI does in 50 LOC. **Keep as-is.**

### `data.py :: employees` — overtime/total-hours roll-up

Per-employee attendance aggregation with daily-quota computation is compute, not CRUD. The employee **row** belongs in Directus; the **overtime roll-up** stays in FastAPI at a new dedicated endpoint (`/api/data/employees/overtime?date_from=&date_to=`). Frontend merges the two via TanStack Query.

### The `resolve_playlist_for_device` decorator on `/signage/devices` list

Schedule-first + tag-based fallback + timezone-aware `(weekday, hhmm)` match is not a query Directus can run. Do not try to inline resolved-playlist fields into the Directus devices collection response. Frontend should fetch raw devices from Directus and separately fetch resolved playlists from a compute endpoint.

### SSE fanout substrate (`signage_broadcast.py`)

The `asyncio.Queue` dict is fundamentally single-process, owned by FastAPI. Directus cannot replace it. The only change is that admin mutations go through Directus → Flow → webhook → FastAPI → `notify_device`, instead of the in-process call graph today. **The queue itself and the `GET /signage/player/stream` endpoint never move.**

### Error-shape guarantees on FK RESTRICT

If operator preference is to preserve exact `{detail, schedule_ids}` shape on playlist delete and `{detail: "tag in use"}` on tag delete, the cleanest path is a Directus Flow Filter(Blocking) hook that pre-queries and Throws structured errors. If that's too much Flow work for one-off error shapes, **accept the scope relaxation** and document it.

## Dependencies Between Moves

```
SSE webhook bridge (new FastAPI /api/internal/signage/broadcast + shared secret)
    ↓ blocks
signage_admin/{devices,playlists,playlist_items,schedules,tags}/* moves

Frontend directus-sdk admin hooks (replaces TanStack Query calls)
    ↓ blocks
/me deletion (frontend must use readMe() before /api/me is removed)

Playlists/items/tags moves ← independent of each other
Schedules move ← depends on playlist move (FK reference target exists in Directus context)
    ↓ but actually: Directus item collections are just tables; FK works regardless of which process serves CRUD
    ↓ so order is cosmetic, not structural

analytics.py stays → frontend /signage/analytics/devices caller unchanged
data.py split:
    - /sales → Directus
    - /employees row → Directus
    - /employees overtime roll-up → new FastAPI endpoint
    - Frontend EmployeeTable merges the two before rendering

docker-compose / reverse proxy (Caddy Phase 64):
    - /directus/* already routes to Directus
    - No changes needed; all Directus SDK calls are same-origin
```

**Suggested milestone ordering (sketched for roadmap):**

1. Spike: Directus Flow → FastAPI webhook round-trip for ONE collection (tags, smallest blast radius). Confirm payload shape, latency, error paths.
2. Build `POST /api/internal/signage/broadcast` with shared secret.
3. Move `tags` + `/me` (lowest risk; validates the full pattern end-to-end).
4. Move `schedules` (cross-field validation + SSE Flow test).
5. Move `playlists` + `playlist_items` (bulk-replace verification).
6. Move `devices` (calibration Flow; drop resolver-decorated fields from list response; add separate resolved-playlist compute endpoint).
7. Move `data.py` sales + split employees.
8. Delete dead FastAPI routers, schemas, tests. Remove table names from `DB_EXCLUDE_TABLES`.

## Scope Decisions Surfacing to Roadmap

These are decisions the roadmap author must consciously make — each one is a scope slider:

1. **FK RESTRICT error shape on `DELETE /playlists/{id}`** — keep structured `{detail, schedule_ids}` via Flow, or accept Directus default? *Recommend: keep via Flow (shipped frontend already consumes `schedule_ids`).*
2. **Tag delete 409 shape** — same question. *Recommend: accept relaxation (single string, no structured data lost).*
3. **`search` param on `/api/data/sales`** — Directus `?search=foo` searches all string fields; current endpoint only 3. *Recommend: accept broader search; document behavior change.*
4. **`start_hhmm < end_hhmm` 422 message** — Flow-authored structured error or rely on DB CHECK generic 500? *Recommend: Flow (operator-facing UX).*
5. **`signage/devices` list response** — drop resolved-playlist fields and split to separate compute endpoint (principled), or keep a thin FastAPI proxy (pragmatic). *Recommend: split — matches project's "shape vs compute" axis.*
6. **Bulk items replace semantics** — verify Directus single-PATCH with `{create: [all-new], delete: [all-old]}` is valid and atomic in Phase 1 spike before committing frontend refactor.

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Directus CRUD core (list/get/create/update/delete + filters + sort + pagination) | HIGH | Stable documented API, already in production via Directus 11 auth layer |
| Directus field-level validation (`_in: [0,90,180,270]`) | HIGH | Standard filter-rule operators |
| Directus Flows: Filter(Blocking) for validation / error-reshaping | MEDIUM-HIGH | Documented pattern; exact `Throw Error` body shape needs spike |
| Directus Flows: Action (non-blocking) webhook to FastAPI | HIGH | First-class operation; Netlify trigger example in docs |
| Directus Flow access to pre-update values on `items.update` | MEDIUM | Docs say payload carries `keys` + `data` (deltas); pre-read may need extra op. Spike in Phase 1. |
| Nested O2M atomic update via PATCH | MEDIUM | Known pattern but exact "delete-all + create-all" single-PATCH shape needs verification |
| Directus admin-role permission mapping to existing Admin/Viewer | HIGH | Already shipped v1.11-directus; this milestone only extends policies to new collections |
| ETag / `If-None-Match` on Directus list responses | LOW-MEDIUM | No evidence of built-in ETag on `/items/*` responses; Directus has a data cache but not response-level ETag. **If frontend relies on 304 revalidation for cached admin lists, that's a capability loss.** Current FastAPI endpoints don't ship ETag either (only the player `/playlist` endpoint does via `compute_playlist_etag`), so likely not an issue in scope. Verify. |

## Sources

- [Directus Flows — Triggers (item create/update/delete events)](https://directus.io/docs/guides/automate/triggers) — HIGH
- [Directus Flows — Operations (HTTP Request, Read Data, Throw Error)](https://directus.io/docs/guides/automate/operations) — HIGH
- [Directus Flows — Filter vs Action (blocking vs async semantics)](https://directus.io/docs/api/flows) — HIGH
- [Directus Filter Rules (`_in`, `_eq`, `_between`, etc.)](https://directus.io/docs/guides/connect/filter-rules) — HIGH
- [Directus Fields / Validation (filter-rule field validators + custom error messages)](https://directus.io/docs/guides/data-model/fields) — HIGH
- [Directus Access Control (role/policy permission model — already wired in v1.11)](https://directus.io/docs/guides/auth/access-control) — HIGH
- [Directus SDK discussion: updating parent + O2M relations in one request (Discussion #16701)](https://github.com/directus/directus/discussions/16701) — MEDIUM
- [Directus Filter(Blocking) Event Hook — payload modification caveats (Issue #24470)](https://github.com/directus/directus/issues/24470) — MEDIUM (known sharp edges)
- [Directus Cache — response caching, not ETag-based revalidation](https://directus.io/docs/configuration/cache) — MEDIUM
- Internal: `backend/app/services/signage_broadcast.py` — `--workers 1` invariant is the hard constraint dictating the Flow→FastAPI bridge pattern
- Internal: `backend/app/services/signage_resolver.py` — schedule-first resolver confirms the "devices list decorator" must stay in FastAPI
- Internal: `.planning/PROJECT.md` — "Directus = shape, FastAPI = compute" principle drives per-endpoint verdicts
