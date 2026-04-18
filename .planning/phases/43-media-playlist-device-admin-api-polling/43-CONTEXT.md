# Phase 43: Media + Playlist + Device Admin API (polling) — Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend-only FastAPI surface for signage content + device management, plus the polling loop that makes the player loop functionally complete before SSE lands in Phase 45.

**Deliverables:**
- Admin CRUD for `signage_media`, `signage_playlists`, `signage_playlist_items`, `signage_devices`, `signage_device_tags` (+ join-table wiring)
- Player polling endpoints: `GET /api/signage/player/playlist`, `POST /api/signage/player/heartbeat`
- `backend/app/services/signage_resolver.py` — tag-to-playlist query (`priority DESC, updated_at DESC`, LIMIT 1)
- `backend/app/routers/signage_admin/` package (per-resource split, see D-01) + `backend/app/routers/signage_player.py`
- SGN-BE-09 router dep-audit test with explicit allow-list for pair router public routes
- SGN-BE-10 CI grep guards (no `sqlite3`, no `psycopg2`, no sync `subprocess.run` in signage modules)
- SGN-SCH-01 heartbeat sweeper — separate 1-min APScheduler job flipping devices to `offline` when `last_seen_at < now() - 5 min`

**Out of scope (explicitly deferred):**
- SSE broadcast → Phase 45
- PPTX → image conversion → Phase 44
- Admin Signage UI → Phase 46
- Player kiosk bundle → Phase 47
- Media upload UI (this phase exposes the API; upload endpoint shape is Claude's Discretion within standard conventions)
- Per-device analytics / free-disk / chromium-uptime telemetry — deferred per PROJECT.md

</domain>

<decisions>
## Implementation Decisions

### Router organization
- **D-01:** Admin routes live in a per-resource split package: `backend/app/routers/signage_admin/` with `media.py`, `playlists.py`, `playlist_items.py`, `devices.py`, `tags.py`, and `__init__.py` exposing a parent `APIRouter(prefix="/api/signage", dependencies=[Depends(get_current_user), Depends(require_admin)])` that includes each sub-router. This diverges from the literal SGN-BE-01 wording ("`signage_admin.py`") by splitting for maintainability — a note in REQUIREMENTS traceability will call this out as an accepted refinement. All admin endpoints inherit the admin gate from the parent router, so `require_admin` appears exactly once in code.
- **D-02:** Player routes live in a single `backend/app/routers/signage_player.py` — `GET /playlist`, `POST /heartbeat` (the `/stream` SSE endpoint lands in Phase 45). Router-level dep is `Depends(get_current_device)` so every player route is guarded by construction.
- **D-03:** Main wiring: `backend/app/main.py` includes the signage_admin parent router and the signage_player router alongside the existing `signage_pair` router.

### Dep-audit test (SGN-BE-09)
- **D-04:** `backend/tests/test_signage_router_deps.py` introspects `app.routes` at test time. For every route whose path starts with `/api/signage`:
  - If path is in `PUBLIC_SIGNAGE_ROUTES = {"/api/signage/pair/request", "/api/signage/pair/status"}` → skip (intentional exceptions recorded in Phase 42 plan 02 as "INTENTIONAL EXCEPTION").
  - Else if path starts with `/api/signage/player/` → assert `get_current_device` is in the route's flattened dependency tree.
  - Else → assert `require_admin` is in the route's flattened dependency tree.
- **D-05:** The allow-list is a module-level constant with a comment pointing to Phase 42 plan 02 SUMMARY. Adding a new public signage route in a future phase requires an explicit allow-list entry — no silent leaks.

### Resolver — `/api/signage/player/playlist`
- **D-06:** No-match semantics: return **200 with an empty playlist envelope** — `{playlist_id: null, name: null, items: [], resolved_at: <iso ts>}`. Applies when the device has no tags, or no enabled playlist matches any of the device's tags. Uniform response shape simplifies the Phase 47 kiosk loop (always parse the same shape, render "no content" fallback on empty items).
- **D-07:** Successful match returns the same envelope populated: `{playlist_id: uuid, name: str, items: [{media_id, kind, uri, duration_ms, transition, position}, ...], resolved_at: iso}`. Items are ordered by `signage_playlist_items.position ASC`.
- **D-08:** Tag resolution: given the device's `signage_device_tag_map` entries, find enabled (`enabled=true`) playlists whose `signage_playlist_tag_map` intersects the device tag set, ordered by `priority DESC, updated_at DESC`, LIMIT 1. SGN-BE-06.
- **D-09:** **ETag + If-None-Match caching** to cut polling bandwidth. ETag = SHA256 hash of `(playlist_id, playlist.updated_at, concatenated item (id, updated_at, position))`. Player sends `If-None-Match`; backend returns **304 Not Modified** (empty body) when the hash matches. Response always carries `ETag` and `Cache-Control: no-cache` (must-revalidate). The ~90% of polls where nothing changed return 0 bytes.
- **D-10:** `GET /playlist` does NOT implicitly update `last_seen_at` — that's `/heartbeat`'s job. Separating read from presence keeps the resolver pure and cacheable.

### Heartbeat — `/api/signage/player/heartbeat`
- **D-11:** Payload shape (forward-compatible minimum): `{current_item_id: uuid | null, playlist_etag: str | null}`. Server updates:
  - `signage_devices.last_seen_at = now()`
  - `signage_devices.current_item_id = <payload.current_item_id>` (nullable FK to `signage_media.id`, ON DELETE SET NULL — may need schema touch-up; if Phase 41 didn't land this column, planner adds an additive Alembic migration)
  - `signage_devices.current_playlist_etag = <payload.playlist_etag>` (nullable text)
  - Optional `status` flip from `offline` → `online` on any successful heartbeat (the sweeper handles the reverse; heartbeat is the liveness signal).
- **D-12:** Response is **204 No Content**. Heartbeat is fire-and-forget; nothing useful to return.
- **D-13:** Deferred telemetry fields (`free_disk_mb`, `chromium_uptime_s`, `last_error`) — explicitly out of scope this phase. If added later, the payload Pydantic model gains optional fields so old Pis stay compatible.

### Heartbeat sweeper (SGN-SCH-01)
- **D-14:** Separate APScheduler job `signage_heartbeat_sweeper`, registered in the lifespan handler alongside `signage_pairing_cleanup` (Phase 42) and `sensor_retention_cleanup` (v1.15). `IntervalTrigger(minutes=1)`, `coalesce=True`, `max_instances=1`, `misfire_grace_time=30`, wrapped in `asyncio.wait_for(..., timeout=20)`. Mirrors v1.15 `sensor_poll` pattern — single-process `--workers 1` invariant already enforced and documented.
- **D-15:** Job SQL (idempotent):
  ```sql
  UPDATE signage_devices
  SET status = 'offline', updated_at = now()
  WHERE last_seen_at < now() - interval '5 minutes'
    AND status != 'offline'
    AND revoked_at IS NULL
  ```
  Excluding `revoked_at IS NOT NULL` avoids redundant flips on already-killed devices.

### Admin CRUD semantics
- **D-16:** **Hard delete for media**, leaning on Phase 41 D-16's `ON DELETE RESTRICT` FK from `signage_playlist_items.media_id`. `DELETE /media/{id}` returns:
  - 404 if no such media
  - 409 with `{detail: "media in use by playlists", playlist_ids: [uuid, ...]}` if referenced by any playlist_item (admin must remove from playlists first)
  - 204 on success — same transaction also deletes `/app/media/slides/<uuid>/` (PPTX-derived artifacts, Phase 41 D-02) via a post-commit cleanup hook. If the FS delete fails, log a WARNING but do not roll back (slides are cheap to re-derive; the DB is the source of truth).
- **D-17:** **Bulk-replace for playlist items reordering**: `PUT /api/signage/playlists/{id}/items` with body `{items: [{media_id: uuid, position: int, duration_ms: int, transition: str}, ...]}`. Single transaction: `DELETE FROM signage_playlist_items WHERE playlist_id = :id; INSERT new rows`. Position values come from the request (client controls ordering). Returns 200 with the new item list.
- **D-18:** **Bulk-replace for tag assignment** on both sides:
  - `PUT /api/signage/devices/{id}/tags` body `{tag_ids: [uuid, ...]}` — replaces the device's tag set
  - `PUT /api/signage/playlists/{id}/tags` body `{tag_ids: [uuid, ...]}` — replaces the playlist's tag targeting
  Both execute as `DELETE FROM <map_table> WHERE <parent_id> = :id; INSERT new rows` in one transaction. Idempotent; matches the drag-and-drop UX Phase 46 will need.
- **D-19:** Admin GET endpoints return full lists without pagination for this phase (small-fleet scope, ≤5 devices, media libraries expected <100 items). Pagination can land as an additive change later if needed.
- **D-20:** Response envelope convention: flat JSON, no `{data: ...}` wrapper (matches existing `/api/sensors/*` endpoints). Error responses use FastAPI default `{detail: "..."}` shape.

### Media upload endpoint (Claude's Discretion within limits)
- **D-21:** Upload shape for `POST /api/signage/media`: planner picks between (a) multipart form upload through FastAPI `UploadFile` + store to Directus uploads volume via Directus API, or (b) Directus-asset-UUID-only flow where admin first uploads to Directus (via Directus UI), then registers the UUID via `POST /api/signage/media {kind, title, uri, ...}`. Either is acceptable; decision must land in the PLAN for Phase 46 (admin UI) to consume.

### Claude's Discretion
- Exact Pydantic schema field names beyond what D-06/D-07/D-11 specify (e.g., envelope field casing — snake_case is the existing convention in `backend/app/schemas/`).
- Whether heartbeat sweeper updates `status` column or derives online/offline via a computed column/view — D-14 says persisted column for simplicity, but if Phase 41 didn't add a `status` column, planner adds an additive migration (ENUM `online | offline | paired`).
- Exact SQLAlchemy relationship strategy for nested reads (joined vs selectin vs lazy) on admin list endpoints — pick what's measurably fast at ≤100 items.
- Error code boundaries beyond 401/403/404/409/204 (e.g., 422 for Pydantic validation is automatic).
- Test organization: one big `test_signage_admin_router.py` vs per-resource test files — mirror whatever router layout D-01 lands.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §SGN-BE-01, §SGN-BE-02, §SGN-BE-06, §SGN-BE-09, §SGN-BE-10, §SGN-SCH-01 — the 6 requirements this phase closes (lines 25, 26, 30, 33, 34, 38)
- `.planning/ROADMAP.md` §"Phase 43: Media + Playlist + Device Admin API (polling)" — 5 success criteria are the verification checklist

### Prior phase context (consumed, not modified, by phase 43)
- `.planning/phases/41-signage-schema-models/41-CONTEXT.md` — full schema (D-01..D-17), especially D-16 `ON DELETE RESTRICT` on `signage_playlist_items.media_id` that D-16 of this phase relies on
- `.planning/phases/42-device-auth-pairing-flow/42-CONTEXT.md` — D-15/D-16 player dep landing plan; D-09 in-process rate-limit pattern
- `.planning/phases/42-device-auth-pairing-flow/42-02-signage-pair-router-SUMMARY.md` — documents the INTENTIONAL EXCEPTION allow-list items (`/request`, `/status`) that SGN-BE-09's audit test must honor

### Existing code (patterns to mirror)
- `backend/app/security/directus_auth.py` — `get_current_user`, `require_admin` definitions; router-level dep wiring pattern
- `backend/app/security/device_auth.py` — `get_current_device` (Phase 42 landed)
- `backend/app/routers/sensors.py` — existing admin CRUD style (Pydantic schemas, error shapes, TestClient test idioms)
- `backend/app/routers/signage_pair.py` — most recent router (Phase 42); INTENTIONAL EXCEPTION comment is the anchor for SGN-BE-09 allow-list rationale
- `backend/app/scheduler.py` — APScheduler lifespan registration pattern (v1.15 + Phase 42); D-14 mirrors the `sensor_poll` + `signage_pairing_cleanup` job shape
- `backend/app/models/signage.py` — ORM classes from Phase 41
- `backend/app/schemas/signage.py` — Pydantic classes from Phase 41

### Cross-cutting hazards + pitfalls
- `.planning/research/PITFALLS.md` §13 — partial-unique + atomic UPDATE patterns (already solved in Phase 42; informs dep-audit constant)
- `.planning/research/PITFALLS.md` §15 — Directus file storage path vs URL mismatch (informs D-21 upload shape)
- `.planning/research/PITFALLS.md` §16 — orphan-file risk on media delete (D-16 mitigation)
- `.planning/research/PITFALLS.md` §21 — device-token leak cross-device (mitigated by router-level `get_current_device` dep on signage_player router, D-02)
- `.planning/ROADMAP.md` §"v1.16 Cross-Cutting Hazards" #5 (router dep consistency) → D-01/D-04 enforce; #6 (no sqlite3/psycopg2/subprocess.run) → SGN-BE-10 grep guards

### Architecture
- `.planning/research/ARCHITECTURE.md` §"Polling + SSE hybrid" — Phase 43 ships polling baseline; Phase 45 adds SSE on top
- `.planning/research/STACK.md` — confirms no new backend libs required for this phase (sse-starlette lands in 45; pdf2image in 44)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get_current_user` + `require_admin` (in `backend/app/security/directus_auth.py`): router-level admin gate pattern. D-01 uses this on the signage_admin parent router.
- `get_current_device` (in `backend/app/security/device_auth.py`, Phase 42): router-level gate for signage_player. D-02 consumes.
- APScheduler singleton (`backend/app/scheduler.py`): register heartbeat sweeper alongside existing jobs. D-14 mirrors `sensor_poll` shape.
- ORM models in `backend/app/models/signage.py` (Phase 41) — all 8 tables available with proper timestamps/indexes.
- Pydantic schemas in `backend/app/schemas/signage.py` (Phase 41) — base shapes exist; this phase adds request/response envelopes.

### Established Patterns
- `--workers 1` invariant (documented in `backend/app/scheduler.py` and `docker-compose.yml`): makes in-memory rate-limit (Phase 42 D-09) and singleton APScheduler (D-14) valid.
- Router-level dependencies over per-endpoint (Phase 40 SGN-BE-09 design) — D-01 and D-02 lean on this.
- Additive Alembic migrations when columns emerge in later phases — no rewrites of `v1_16_signage_schema.py`.
- Fail-fast `Settings` with Pydantic BaseSettings — no new env vars required this phase unless the upload path (D-21) introduces one.
- pytest-asyncio + AsyncClient test style (mirror `test_signage_pair_router.py`).

### Integration Points
- `backend/app/main.py` — mount signage_admin parent router + signage_player router + existing signage_pair router.
- Lifespan in `main.py` → calls into `backend/app/scheduler.py` which registers the new heartbeat sweeper job.
- `signage_resolver.py` service is called from `signage_player.py` only; admin routes do not consume the resolver.

</code_context>

<specifics>
## Specific Ideas

- ETag strategy: SHA256 over a deterministic serialization (sorted tuple of `(playlist.id, playlist.updated_at, [(item.id, item.updated_at, item.position) for item in items])`). Stable across equivalent playlists; changes as soon as any position/media/duration changes.
- Media delete orphan-artifacts cleanup: hook runs **after** the DB commit succeeds; uses `pathlib.Path(...).rmtree(missing_ok=True)` pattern in a `try/except` that logs but does not fail the response.
- Heartbeat 204 over 200 — caller doesn't need a body; avoids unused JSON.
- SGN-BE-10 grep guards implemented as pytest test(s) that run `subprocess.check_output(["grep", "-r", "--include=*.py", ...])` — but SGN-BE-10 itself forbids sync `subprocess.run` in signage modules, not in tests. Tests are allowed to use subprocess. Make sure the grep-guard test lives in `backend/tests/` not `backend/app/signage*/`.

</specifics>

<deferred>
## Deferred Ideas

- SSE broadcast of playlist updates → Phase 45
- Per-device telemetry (free disk, Chromium uptime, last error) → not scheduled; PROJECT.md explicitly defers
- Media pagination → additive later if library grows past a few hundred items
- Media preview thumbnails for admin UI → Phase 46 responsibility (can be derived from existing columns)
- Audit log of admin CRUD operations → not scheduled
- Scheduled playlist activation (time-based) → deferred per PROJECT.md "Deferred: Time-based schedules"

</deferred>

---

*Phase: 43-media-playlist-device-admin-api-polling*
*Context gathered: 2026-04-18*
