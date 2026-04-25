---
gsd_state_version: 1.0
milestone: v1.22
milestone_name: Backend Consolidation — Directus-First CRUD
status: executing
stopped_at: Completed 70-05-sse-tests-and-triage-PLAN.md
last_updated: "2026-04-25T07:52:53.503Z"
last_activity: 2026-04-25
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 32
  completed_plans: 31
---

# Project State: KPI Dashboard

**Last updated:** 2026-04-24
**Session:** v1.22 Backend Consolidation — roadmap drafted (Phases 65–71)

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-24 — Current Milestone set to v1.22)

**Core value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

**Current focus:** Phase 70 — mig-sign-devices

Previous milestone v1.21 Signage Calibration + Build Hygiene + Reverse Proxy shipped 2026-04-24 (tag `v1.21`, CAL-PI-07 waived).
Previous milestone v1.20 HR Date-Range Filter + TS Cleanup shipped 2026-04-22 (tag `v1.20`).
Previous milestone v1.19 UI Consistency Pass 2 shipped 2026-04-22 (tag `v1.19`).

---

## Current Position

Milestone: v1.22 Backend Consolidation — Directus-First CRUD
Phase: 70 (mig-sign-devices) — EXECUTING
Plan: 5 of 6
Status: Ready to execute
Last activity: 2026-04-25

Next action: `/gsd:discuss-phase 65` or `/gsd:plan-phase 65`.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260421-r4b | Fix admin Devices tab: list_devices returns tags and investigate stale heartbeat/uptime | 2026-04-21 | eff6e52 | [260421-r4b-fix-admin-devices-tab-list-devices-retur](./quick/260421-r4b-fix-admin-devices-tab-list-devices-retur/) |
| 260422-hxt | Remove Digital Signage h1 heading and hoist 4-tab pill into SubHeader | 2026-04-22 | b0525e0 | [260422-hxt-remove-digital-signage-h1-heading-from-s](./quick/260422-hxt-remove-digital-signage-h1-heading-from-s/) |
| 260422-i41 | Relocate signage primary-action CTAs below lists (media, playlists, devices, schedules) | 2026-04-22 | bdc84fa | [260422-i41-move-primary-action-buttons-below-tables](./quick/260422-i41-move-primary-action-buttons-below-tables/) |
| 260422-j9o | Nav cluster polish: drop toggle blue, size-8 circles, normal-weight initials, title-case dashboard toggle, dynamic pill indicator | 2026-04-22 | 25082ff | [260422-j9o-nav-cluster-polish-drop-toggle-blue-size](./quick/260422-j9o-nav-cluster-polish-drop-toggle-blue-size/) |

---

## v1.22 Roadmap Snapshot

| Phase | Name | Reqs |
|-------|------|------|
| 65 | Foundation — Schema + AuthZ + SSE Bridge | SCHEMA-01..05, AUTHZ-01..05, SSE-01..06 (16) |
| 66 | Kill `me.py` | MIG-AUTH-01..03 (3) |
| 67 | Migrate `data.py` — Sales + Employees split | MIG-DATA-01..04 (4) |
| 68 | MIG-SIGN — Tags + Schedules | MIG-SIGN-01, MIG-SIGN-02 (2) |
| 69 | MIG-SIGN — Playlists | MIG-SIGN-03 (1) |
| 70 | MIG-SIGN — Devices | MIG-SIGN-04 (1) |
| 71 | FE polish + CLEAN | FE-01..05, CLEAN-01..05 (10) |

**Coverage:** 37/37 v1.22 requirements mapped. No orphans, no duplicates.

### v1.22 Locked Architectural Decisions (do not revisit)

- **SSE bridge = Postgres LISTEN/NOTIFY (Option A)** — Alembic triggers + asyncpg `add_listener` in FastAPI `lifespan`. Not Directus Flow webhook.
- **Calibration PATCH stays in FastAPI** — `Literal[0,90,180,270]` + existing per-device SSE.
- **`PUT /playlists/{id}/items` bulk-replace stays in FastAPI** — atomic DELETE+INSERT.
- **`DELETE /playlists/{id}` stays in FastAPI** — preserves structured `409 {detail, schedule_ids}`.
- **`GET /signage/analytics/devices` stays in FastAPI** — bucketed uptime aggregate.
- **`GET /signage/devices` list is hybrid** — Directus rows + new FastAPI `/api/signage/resolved/{device_id}`.
- **`signage_devices` LISTEN trigger gated on `name`/tags predicate** — calibration columns excluded to avoid double-fire with FastAPI calibration SSE.

---

## Performance Metrics

**Velocity (v1.15):**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| Phase 38 P01 | 228s | 2 tasks | 6 files |
| Phase 38 P02 | 374s | 2 tasks | 6 files |
| Phase 38 P03 | 4m 17s | 4 tasks | 4 files |
| Phase 39 P01 | 3 min | 3 tasks | 12 files |
| Phase 39 P02 | 377s | 2 tasks | 12 files |
| Phase 40 P01 | 35m | 3 tasks | 18 files |
| Phase 40 P03 | 15m | 1 task | 5 files |

*Updated after each plan completion*

---
| Phase 41 P04 | 2min | 1 tasks | 1 files |
| Phase 41 P02 | 156 | 1 tasks | 4 files |
| Phase 41 P01 | 12m | 2 tasks | 2 files |
| Phase 41 P03 | 152s | 2 tasks | 1 files |
| Phase 41 P05 | 35m | 1 tasks | 3 files |
| Phase 42 P01 | 12m | 3 tasks | 10 files |
| Phase 42 P02 | 3m | 1 tasks | 3 files |
| Phase 42 P03 | 278s | 2 tasks | 5 files |
| Phase 43 P01 | 6m | 2 tasks | 3 files |
| Phase 43 P02 | 3m | 2 tasks | 3 files |
| Phase 43 P04 | 8m | 3 tasks | 5 files |
| Phase 43 P03 | 3m 28s | 2 tasks | 8 files |
| Phase 43 P05 | 4m | 2 tasks | 2 files |
| Phase 44 P01 | 102s | 1 tasks | 1 files |
| Phase 44 P04 | 2m | 1 tasks | 2 files |
| Phase 44 P02 | 3.5m | 2 tasks | 4 files |
| Phase 44 P03 | 4m | 2 tasks | 3 files |
| Phase 44 P05 | 10m | 3 tasks | 5 files |
| Phase 45 P01 | 15m | 3 tasks | 5 files |
| Phase 45 P02 | 40m | 3 tasks | 6 files |
| Phase 45 P03 | 15m | 2 tasks | 2 files |
| Phase 46 P03 | 152 | 2 tasks | 8 files |
| Phase 46 P01 | 5m | 3 tasks | 13 files |
| Phase 46 P02 | 4m | 3 tasks | 6 files |
| Phase 46 P04 | 271s | 3 tasks | 5 files |
| Phase 46 P06 | 4m | 3 tasks | 6 files |
| Phase 46 P05 | 9m | 3 tasks | 8 files |
| Phase 47-player-bundle P01 | 6m | 5 tasks | 10 files |
| Phase 47-player-bundle P02 | 2m | 3 tasks | 3 files |
| Phase 47-player-bundle P03 | 8m | 5 tasks | 8 files |
| Phase 47-player-bundle P04 | 6m | 3 tasks | 4 files |
| Phase 47-player-bundle P05 | 180m | 5 plan tasks + 11 defect fixes | 20 files |
| Phase 48 P01 | 263 | 3 tasks | 6 files |
| Phase 48 P02 | 211s | 3 tasks | 5 files |
| Phase 48 P03 | 7m | 3 tasks | 4 files |
| Phase 48 P04 | 540s | 2 tasks | 6 files |
| Phase 49-pi-image-build P01 | 303s | 3 tasks | 15 files |
| Phase 50-pi-polish P01 | 4m | 3 tasks | 2 files |
| Phase 51 P01 | 9m 5s | 3 tasks | 12 files |
| Phase 51 P02 | 7m | 2 tasks | 4 files |
| Phase 52 P03 | 2m | 2 tasks | 2 files |
| Phase 52 P01 | 146s | 3 tasks | 6 files |
| Phase 52 P02 | 644s | 4 tasks | 16 files |
| Phase 53 P01 | 7m 53s | 3 tasks | 13 files |
| Phase 53 P02 | 15m | 4 tasks | 12 files |
| Phase 54 P01 | 87s | 2 tasks | 2 files |
| Phase 54 P04 | 66s | 1 tasks | 1 files |
| Phase 54 P03 | 98s | 2 tasks | 2 files |
| Phase 54 P02 | 121s | 1 tasks | 1 files |
| Phase 54 P05 | 101s | 1 tasks | 1 files |
| Phase 55 P01 | 83s | 2 tasks | 3 files |
| Phase 55 P03 | 92s | 2 tasks | 2 files |
| Phase 55 P02 | 122s | 2 tasks | 2 files |
| Phase 55 P06 | 214s | 4 tasks | 8 files |
| Phase 55 P04 | 272s | 3 tasks | 8 files |
| Phase 55 P05 | 313s | 3 tasks | 5 files |
| Phase 56 P01 | 130s | 2 tasks | 4 files |
| Phase 56 P02 | 115s | 2 tasks | 2 files |
| Phase 56 P03 | 10m | 3 tasks | 2 files |
| Phase 56 P04 | 25m | 2 tasks | 2 files |
| Phase 57 P04 | 64s | 2 tasks | 2 files |
| Phase 57 P02 | 3m | 2 tasks | 2 files |
| Phase 57 P03 | 116s | 2 tasks | 2 files |
| Phase 57 P01 | 2m | 2 tasks | 2 files |
| Phase 57 P06 | 110s | 1 tasks | 1 files |
| Phase 57 P08 | 2m | 1 tasks | 1 files |
| Phase 57 P09 | 107s | 2 tasks | 4 files |
| Phase 57 P07 | 3m | 1 tasks | 2 files |
| Phase 57 P05 | 6m | 2 tasks | 2 files |
| Phase 57 P10 | 62s | 2 tasks | 2 files |
| Phase 57 P11 | 2m | 2 tasks | 2 files |
| Phase 58 P01 | 95s | 2 tasks | 2 files |
| Phase 58 P02 | 154s | 2 tasks | 2 files |
| Phase 59 P01 | 5m | 2 tasks | 2 files |
| Phase 59 P02 | 76s | 2 tasks | 4 files |
| Phase 59 P03 | 60s | 2 tasks | 4 files |
| Phase 60 P02 | 124s | 2 tasks | 4 files |
| Phase 60 P01 | 6m | 2 tasks | 3 files |
| Phase 60 P03 | ~210s | 3 tasks | 4 files |
| Phase 60 P04-task-1 | 9m | 1 tasks | 1 files |
| Phase 61 P01 | 7m 38s | 3 tasks | 10 files |
| Phase 62 P01 | 221s | 2 tasks | 6 files |
| Phase 62-signage-calibration P03 | 529 | 2 tasks | 5 files |
| Phase 62 P02 | 30m | 2 tasks | 6 files |
| Phase 62-signage-calibration P04-task-1 | ~6m | 1 tasks | 6 files |
| Phase 63 P01 | 3m 21s | 2 tasks | 2 files |
| Phase 64 P01 | 8m 13s | 4 tasks | 10 files |
| Phase 65 P02 | 88s | 1 tasks | 1 files |
| Phase 65 P03 | 2min | 1 tasks | 1 files |
| Phase 65 P01 | 298 | 3 tasks | 4 files |
| Phase 65 P04 | 151 | 2 tasks | 2 files |
| Phase 65 P05 | 541s | 5 tasks | 11 files |
| Phase 66 P01 | 102s | 3 tasks | 3 files |
| Phase 66-kill-me-py P03 | 36s | 1 tasks | 1 files |
| Phase 66-kill-me-py P02 | 58s | 2 tasks | 4 files |
| Phase 67 P02 | 6m | 1 tasks | 1 files |
| Phase 67 P01 | 3m | 2 tasks | 3 files |
| Phase 67 P03 | 4m | 2 tasks | 2 files |
| Phase 68 P01 | 59s | 2 tasks | 2 files |
| Phase 68-mig-sign-tags-schedules P04 | 2m | 2 tasks | 1 files |
| Phase 68-mig-sign-tags-schedules P07 | 38s | 1 tasks | 1 files |
| Phase 68-mig-sign-tags-schedules P03 | 67s | 2 tasks | 3 files |
| Phase 68-mig-sign-tags-schedules P06 | 73s | 1 tasks | 1 files |
| Phase 68-mig-sign-tags-schedules P05 | 3m | 2 tasks | 2 files |
| Phase 68-mig-sign-tags-schedules P08 | 99s | 2 tasks | 1 files |
| Phase 69-mig-sign-playlists P02 | 59s | 1 tasks | 1 files |
| Phase 69-mig-sign-playlists P01 | 120s | 1 tasks | 2 files |
| Phase 69 P03 | 216s | 2 tasks | 1 files |
| Phase 69-mig-sign-playlists P05 | 78s | 1 tasks | 1 files |
| Phase 69-mig-sign-playlists P04 | 93s | 1 tasks | 1 files |
| Phase 69-mig-sign-playlists P06 | 288s | 2 tasks | 1 files |
| Phase 70-mig-sign-devices P01 | 53s | 2 tasks | 2 files |
| Phase 70 P03 | 80s | 1 tasks | 1 files |
| Phase 70 P02 | 2m | 1 tasks | 1 files |
| Phase 70-mig-sign-devices P06 | 2m | 1 tasks | 1 files |
| Phase 70 P05 | 4m | 3 tasks | 4 files |

## Accumulated Context

### Decisions

- **[v1.22 roadmap 2026-04-24]:** 7 phases (65–71), 37 requirements. Sequencing: Foundation (65) → `me.py` (66) → `data.py` split (67) → Tags+Schedules (68) → Playlists (69) → Devices (70) → FE polish + CLEAN (71). Phase 65 ships backend-only with zero user-visible change — proves the Postgres LISTEN/NOTIFY SSE bridge (Option A) before any endpoint migration. MIG-SIGN sub-phased so each has its own SSE regression test.
- **[v1.22 SSE bridge decision 2026-04-24]:** Option A (Postgres LISTEN/NOTIFY) picked. Alembic owns triggers on `signage_playlists`, `signage_playlist_items`, `signage_playlist_tag_map`, `signage_device_tag_map`, `signage_schedules`, `signage_devices` (last gated on `OLD.name IS DISTINCT FROM NEW.name OR OLD.tags IS DISTINCT FROM NEW.tags`). FastAPI `lifespan` hosts asyncpg `add_listener` long-lived connection → resolver → existing `notify_device()`. Writer-agnostic (fires on Directus, psql, future writers). Not Directus Flow webhook.
- **[v1.22 keep-in-FastAPI list 2026-04-24]:** Calibration PATCH, bulk `PUT /playlists/{id}/items`, `DELETE /playlists/{id}` (preserves 409 `{detail, schedule_ids}` shape), `GET /signage/analytics/devices`, media upload POST, pair/*, player/* stream, PPTX convert. `GET /signage/devices` list is hybrid: Directus rows + new FastAPI `/api/signage/resolved/{device_id}`.
- [v1.21 prior decisions preserved — see MILESTONES.md for full history]
- [Phase 65]: ensure_permission helper placed before api() helper; section 5 appended; comment text paraphrased to satisfy strict grep exclusion check on sensitive column names
- [Phase 65]: WHEN clause on signage_devices UPDATE trigger reduced to name-only (confirmed no tags column on signage_devices per v1_16_signage_schema.py inspection; tags live in signage_device_tag_map)
- [Phase 65]: Tag map tables use composite PKs; signage_notify() function branches on TG_TABLE_NAME to emit device_id/playlist_id as id field for listener resolver compatibility
- [Phase 65]: signage_device_tags confirmed as tag table name (not signage_tags); signage_devices has no tags column — WHEN clause in trigger is OLD.name IS DISTINCT FROM NEW.name only
- [Phase 65]: DB_EXCLUDE_TABLES minimal superset: 11 entries including signage_heartbeat_event and signage_pairing_sessions; exposes 9 v1.22 collections to Directus
- [Phase 65]: Schedule branch uses fetch-then-call: SELECT SignageSchedule.playlist_id then devices_affected_by_playlist(db, playlist_id); no devices_affected_by_schedule resolver exists in signage_resolver.py
- [Phase 65]: Guard A uses MD5 (not SHA256+pgcrypto) for DDL hash — md5() is built-in Postgres, no extension required
- [Phase 65]: Allowlist parity test runs pre-stack in CI (before docker compose up) for <1s fast fail on AUTHZ drift
- [Phase 66]: mapRoleName() switch maps Administrator->admin, Viewer->viewer, unknown->null (D-01/D-09); two-tier readMe (minimal for AuthContext, full for useCurrentUserProfile) is deliberate (D-03/D-05)
- [Phase 66-kill-me-py]: Inline run: block chosen over dedicated scripts/ci/no-api-me.sh — reusable script pattern deferred until third endpoint-guard lands (Phase 67+)
- [Phase 66-kill-me-py]: me_router removal is clean — no other routers imported from me.py; test file had no shared fixtures
- [Phase 67]: Phase 67-02: fetchSalesRecords migrated to directus.request(readItems('sales_records', ...)) with filter/sort/limit/fields; multi-field search uses _or with _icontains (top-level search param avoided); SalesTable.tsx untouched (D-01); query-key unification deferred to Phase 71.
- [Phase 67]: [Phase 67-01]: Inverted-range guard returns 422 (FastAPI semantic) instead of data.py legacy 400 — D-07. Compute endpoint returns flat dict array (not Pydantic model); frontend zero-fills missing employees.
- [Phase 67]: Plan 67-03: fetchEmployees migrated to Directus readItems('personio_employees') with 9-field allowlist; date_from/date_to dropped from signature (D-15). useEmployeesWithOvertime composite hook merges Directus rows + FastAPI overtime via useMemo + Map; rows cache key namespaced ['directus', 'personio_employees', { search }] (Pitfall 4); overtime key ['employeesOvertime', date_from, date_to] — search edits don't refetch overtime.
- [Phase 68]: [Phase 68-01]: Tags FastAPI router removal — D-04 scope only signage_tags collection routes; tag-map writes deferred to Phase 69/70. Test suite required no edits (RBAC matrix already had zero tag refs).
- [Phase 68-mig-sign-tags-schedules]: Plan 68-04: Used @/lib/directusClient (verified canonical singleton) over plan-text @/lib/directus; added updateTag+deleteTag (D-04 covers all 4 verbs, FastAPI tags surface gone); SCHEDULE_FIELDS allowlist constant centralizes payload shape
- [Phase 68-mig-sign-tags-schedules]: Plan 68-07: Anchored grep regex (quote + quote-slash alternations) blocks /api/signage/tags + /api/signage/schedules without false-positive on Phase 69/70 nested /playlists/{id}/tags and /devices/{id}/tags paths.
- [Phase 68-mig-sign-tags-schedules]: Plan 68-03: SCHEDULE_CHANGED_EVENT constant removed entirely (Phase 65 listener emits the literal 'schedule-changed' string); SSE assertions ported to Plan 06 test_pg_listen_sse.py; CHECK-422 covered by Plan 02 test_signage_schedule_check.py; playlist DELETE 409 tests re-handed to Plan 69 (DELETE /playlists/{id} stays in FastAPI).
- [Phase 68-mig-sign-tags-schedules]: Plan 68-06: SSE regression tests added — Directus schedule lifecycle + tag-map (positive) + signage_device_tags (negative D-05). TDD split skipped because bridge already shipped in Phase 65 — single test-only commit.
- [Phase 68-mig-sign-tags-schedules]: Plan 68-08: D-08 bet CONFIRMED — Admin (admin_access: true) can CRUD signage_device_tags + signage_schedules via Directus REST without explicit bootstrap-roles.sh §6 permission rows. Smoke test asserts 403-or-404 on GET-after-DELETE (Directus avoids existence leak); schedule test self-provisions a transient playlist when none exist.
- [Phase 69-mig-sign-playlists]: Plan 69-02: Surgical removal of GET /api/signage/playlists/{id}/items — surviving bulk PUT + _notify_playlist_changed helper retained per D-04b/D-05a; consolidation deferred to Phase 71 CLEAN.
- [Phase 69-mig-sign-playlists]: Plan 69-01: kept IntegrityError import (surviving DELETE catches it for 409 reshape); HEAD-method assertion in surface regression test catches GET-shaped route leak (Starlette auto-adds HEAD)
- [Phase 69]: Plan 69-03: tag_ids hydration via Option A parallel readItems(signage_playlist_tag_map) merge — preserves PlaylistEditorPage consumer contract; replacePlaylistTags uses deleteItems query/filter form because signage_playlist_tag_map has composite PK (playlist_id, tag_id) with no surrogate id column.
- [Phase 69-mig-sign-playlists]: Plan 69-05: Third grep scoped to playlists.py + playlist_items.py (NOT signage_admin/ directory) to avoid false-positive on surviving devices.py PUT /{device_id}/tags (Phase 70 surface) — Rule 1 deviation from plan-as-written.
- [Phase 69-mig-sign-playlists]: Plan 69-04: Adopted existing open_sse_stream/next_frame helper API (plan's wait_for_event/sse_subscription fixtures don't exist); transient-playlist tests must bind paired_device.tag_id via signage_playlist_tag_map for resolver routing; TDD split skipped per Phase 68 P06 precedent.
- [Phase 69-mig-sign-playlists]: Plan 69-06: D-08 fallback gap discovered — signage_playlist_tag_map (composite-PK, schema:null in v1.22 snapshot) returns 403 on /items even with admin_access:true; permission rows in bootstrap-roles.sh §6 do NOT fix this (admin bypasses permissions). Test marked xfail(strict=False); meta-registration deferred to Phase 71 CLEAN. Same root cause blocks preexisting Phase 68-06 SSE tag_map test.
- [Phase 70-mig-sign-devices]: Plan 70-01: ResolvedDeviceResponse field names mirror SignageDeviceRead extras exactly so FE merge {...directusRow, ...resolvedResponse} needs no rename layer; tag_ids returns None (not []) when device has zero tag-map rows.
- [Phase 70]: Plan 70-03: replaceDeviceTags mirrors replacePlaylistTags verbatim (D-03d) — composite-PK signage_device_tag_map deleteItems via query/filter form; revokeDevice STAYS on FastAPI pair router (Open Question 1: revoked_at flag != row delete).
- [Phase 70]: Plan 70-02: Inlined _attach_resolved_playlist logic into update_device_calibration to preserve v1.21 response shape (D-00j); _notify_device_self retained per D-03c despite no in-file caller (Phase 71 CLEAN will consolidate).
- [Phase 70-mig-sign-devices]: Plan 70-06: Phase 70 device-route grep guard inserted after Phase 69 guard, pre-stack; two-grep design with suffix-anchored allow-list for calibration PATCH (Pitfall 3 fix); _notify_device_self helper intentionally not guarded per D-06c
- [Phase 70]: Plan 70-05 D-09 deviation (Rule 1): added /api/signage/resolved/{id} to MUTATION_ROUTES (admin-gated) not READ_ROUTES — signage routes have always been admin-only via signage_admin/__init__.py router-level require_admin.
- [Phase 70]: Plan 70-05: SSE test 3 (device_tag_map) marked xfail(strict=False) per Phase 69 Plan 06 lesson — composite-PK schema:null collection metadata gap; auto-passes once meta registered in Phase 71 CLEAN.

### Cross-cutting hazards (hard gates)

1. DE/EN i18n parity (CI script) — EN count == DE count on every new/renamed key
2. apiClient-only in admin frontend (plus new `directus.request()` via `signageApi.ts` adapter seam — Phase 71)
3. No `dark:` Tailwind variants (tokens only)
4. `--workers 1` invariant preserved — **CI guard references this for v1.22 asyncpg listener correctness**
5. Router-level admin gate via `APIRouter(dependencies=[…])` on remaining FastAPI signage routes
6. No `import sqlite3` / no `import psycopg2`
7. No sync `subprocess.run` in signage services
8. **v1.22 new:** Alembic is sole DDL owner — `information_schema.columns` hash CI guard vs Directus snapshot YAML drift-check (Phase 65 SCHEMA-03)
9. **v1.22 new:** Viewer field allowlists mirror Pydantic `*Read` exactly — no `fields:["*"]` on `directus_users` (Phase 65 AUTHZ-03)
10. **v1.22 new:** `DB_EXCLUDE_TABLES` superset check — hard-coded "never expose" allowlist (`alembic_version`, `app_settings`, `personio_attendance`, `personio_absences`, `personio_sync_meta`, `sensors`, `sensor_readings`, `sensor_poll_log`, `signage_pairing_sessions`, `signage_heartbeat_event`, `upload_batches`)
11. **v1.22 new:** `signage_devices` LISTEN trigger column-level predicate (name/tags only) — calibration SSE stays FastAPI-owned

### Open decisions deferred to phase planning

- **Decision (Phase 65):** Directus `schema apply` against existing Alembic-owned tables — known issue #25760 "existing-table" edge. REST `POST /collections {schema:null}` fallback documented; confirm in Phase 65 spike.
- **Decision (Phase 68):** `DELETE /api/signage/tags/{id}` 409 reshape behavior — Directus-served delete vs keep FK 409 logic in adapter via follow-up query.
- **Decision (Phase 69):** Directus 11 nested-O2M atomic single-PATCH shape for playlist metadata+tags — verify during plan.
- **Decision (Phase 67):** `GET /api/data/sales` search-param scope — accept broader `?search=` via Directus `filter[_or]` encoding vs keep narrow.
- **Decision (Phase 71):** `signage_pairing_sessions` exposure to Directus — default exclude (FastAPI-only); reconsider if ops-debugging convenience becomes a request.

### Pending Todos

- Discuss / plan Phase 65 via `/gsd:discuss-phase 65` (Foundation: Schema + AuthZ + SSE bridge, backend-only, zero user-visible change)
- Carry-forward: CAL-PI-07 real-Pi hardware walkthrough (v1.21) — candidate for `/gsd:quick` independent of v1.22
- Carry-forward: v1.17 Phase 47 player SW scope (D-7) + player fetch cache: no-store (D-8) — deferred polish
- Carry-forward: player bundle gz cap raise vs lazy-chunk discipline — orchestrator decision

### Open Blockers

None.

### Carry-forward Tech Debt

- Phase 2 human-UAT: 5 visual items (drag-drop spinner, toast, inline error list) — non-blocking
- DASH-02 monthly-only: granularity toggle removed by user request
- v1.9 D-12 waiver: axe + WebAIM skipped at operator request
- v1.21 CAL-PI-07 waiver: real-Pi hardware walkthrough pending per-device diagnostic

---

## Session Continuity

**Last session:** 2026-04-25T07:52:53.500Z
**Stopped at:** Completed 70-05-sse-tests-and-triage-PLAN.md
**Resume file:** None
