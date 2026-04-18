# Phase 43: Media + Playlist + Device Admin API (polling) — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 43-media-playlist-device-admin-api-polling
**Areas discussed:** Router organization + dep-audit, Resolver edge cases, Heartbeat payload shape, Admin CRUD semantics

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Router organization + dep-audit | Single file vs per-resource; dep-audit allow-list strategy | ✓ |
| Resolver edge cases | No-match response shape; cache headers | ✓ |
| Heartbeat payload shape | Minimum vs telemetry; sweeper cron placement | ✓ |
| Admin CRUD semantics | Delete strategy, reorder API, tag assignment shape | ✓ |

---

## Router organization

### Q1. Signage admin router file layout?

| Option | Description | Selected |
|--------|-------------|----------|
| Single signage_admin.py (Recommended) | Match SGN-BE-01 literally; one APIRouter, ~500-700 LOC, regions by resource | |
| Per-resource split with shared parent | Package with media.py, playlists.py, playlist_items.py, devices.py, tags.py under parent router with admin deps | ✓ |
| Let Claude decide | Planner picks based on final endpoint count | |

**User's choice:** Per-resource split with shared parent
**Notes:** Diverges from literal SGN-BE-01 wording but preserves the router-level admin gate. Recorded in CONTEXT D-01 as an accepted refinement.

### Q2. SGN-BE-09 dep-audit test: how to handle pair router exceptions?

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit allow-list (Recommended) | PUBLIC_SIGNAGE_ROUTES constant with `/pair/request`, `/pair/status`; every other signage route asserts require_admin OR get_current_device | ✓ |
| Prefix convention | Skip `/api/signage/pair/*` entirely; audit only signage_admin + signage_player | |
| Let Claude decide | Planner picks | |

**User's choice:** Explicit allow-list (Recommended)
**Notes:** Any future public signage route requires an explicit allow-list edit — no silent leaks. Aligned with Phase 42 plan 02 SUMMARY note.

---

## Resolver edge cases

### Q1. What does /player/playlist return when no playlist matches the device?

| Option | Description | Selected |
|--------|-------------|----------|
| 200 with empty playlist (Recommended) | `{playlist_id: null, items: [], resolved_at: ts}` — uniform shape for player loop | ✓ |
| 404 with detail | RESTful but player has to special-case status codes | |
| Let Claude decide | Planner picks based on Phase 47 kiosk simplicity | |

**User's choice:** 200 with empty playlist (Recommended)

### Q2. Cache headers on /player/playlist to cut polling bandwidth?

| Option | Description | Selected |
|--------|-------------|----------|
| ETag + If-None-Match (Recommended) | SHA256 over playlist+items updated_at; 304 on no-change; zero-byte response ~90% of polls | ✓ |
| No caching for now | Defer; small fleet absorbs full JSON each 30s | |
| Let Claude decide | Planner picks | |

**User's choice:** ETag + If-None-Match (Recommended)

---

## Heartbeat payload + sweeper

### Q1. Heartbeat payload richness?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimum + playlist version (Recommended) | `{current_item_id, playlist_etag}` — forward-compatible minimum | ✓ |
| Full telemetry now | Add free_disk_mb, chromium_uptime_s, last_error — wider surface, but PROJECT.md defers per-device analytics | |
| Bare minimum only | current_item_id only; no server-side etag tracking | |

**User's choice:** Minimum + playlist version (Recommended)
**Notes:** Deferred telemetry fields explicitly listed in CONTEXT <deferred>.

### Q2. Heartbeat sweeper: separate APScheduler job?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate 1-min IntervalTrigger job (Recommended) | New `signage_heartbeat_sweeper`, coalesce=True, max_instances=1, mirrors v1.15 sensor_poll | ✓ |
| On-read computation | Compute online/offline from last_seen_at at query time — violates SGN-SCH-01 requirement | |

**User's choice:** Separate 1-min IntervalTrigger job (Recommended)
**Notes:** SGN-SCH-01 requirement mandates the sweeper, so alternative was ruled out by the requirement itself.

---

## Admin CRUD semantics

### Q1. Media delete behavior (Pitfall 16 orphan-file concern)?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard delete + FK RESTRICT (Recommended) | 409 if in-use with playlist_ids list; 204 + filesystem slide cleanup on success | ✓ |
| Soft delete (deleted_at) | New column + filter queries; slide cleanup still needed; Phase 41 didn't add deleted_at | |
| Let Claude decide | Planner picks based on SGN-DB-03 constraint | |

**User's choice:** Hard delete + FK RESTRICT (Recommended)
**Notes:** Phase 41 D-16 already set the FK to RESTRICT, so this path was already half-built. FS cleanup via post-commit hook, logs but does not fail response if unlink fails.

### Q2. Playlist items reordering + tag assignment API shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Bulk-replace for both (Recommended) | PUT /playlists/{id}/items with items array; PUT /devices/{id}/tags with tag_ids array — single-transaction replace | ✓ |
| Incremental endpoints | PATCH /items/{id} for position; POST/DELETE /devices/{id}/tags/{tag_id} for tags — chatty | |
| Mixed: bulk reorder, incremental tags | Compromise | |

**User's choice:** Bulk-replace for both (Recommended)
**Notes:** Matches drag-and-drop UX Phase 46 will need; idempotent and atomic.

---

## Claude's Discretion

- Media upload endpoint shape (multipart vs Directus-UUID-only) — planner picks; must land in PLAN for Phase 46 consumer.
- Exact Pydantic schema field names, error code boundaries beyond the listed set, test organization, SQLAlchemy relationship strategies — all within established conventions.

## Deferred Ideas

- SSE broadcast → Phase 45
- Per-device telemetry → not scheduled
- Pagination → additive later
- Audit log of admin CRUD → not scheduled
- Time-based scheduled playlist activation → deferred per PROJECT.md
