# Phase 68: MIG-SIGN — Tags + Schedules - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate `signage_tags` and `signage_schedules` CRUD from FastAPI routers (`backend/app/routers/signage_admin/tags.py`, `schedules.py`) to Directus SDK. Add Alembic CHECK + Directus validation hook for `start_hhmm < end_hhmm`. Verify the Phase-65 LISTEN/NOTIFY bridge fires the correct SSE events on Directus-originated writes.

In scope:
- 4 routes in `tags.py` (POST/GET/PATCH/DELETE `/api/signage/tags`)
- All schedules.py routes (POST/GET/GET-by-id/PATCH/DELETE `/api/signage/schedules`)
- Frontend `signageApi.ts` `listTags`/`createTag`/...,`listSchedules`/`createSchedule`/... swap
- Alembic CHECK on `signage_schedules` rows
- Directus validation hook (extension or Flow) for friendly i18n error
- `_fanout_schedule_changed` helper deletion
- SSE regression test per table

Out of scope (deferred to assigned phases):
- `PUT /playlists/{id}/tags` (Phase 69)
- `PUT /devices/{id}/tags` (Phase 70)
- Adapter seam structural refactor (Phase 71 FE-01)
- Contract-snapshot tests (Phase 71 FE-04)

</domain>

<decisions>
## Implementation Decisions

### Architectural locks carried from earlier phases (not revisited)
- **D-00a:** Directus SDK cookie-mode auth + short-lived token in `apiClient.ts` singleton (Phase 29/64; reused Phases 66, 67).
- **D-00b:** Caddy reverse-proxies `/directus/*` → `directus:8055`; same-origin via `VITE_DIRECTUS_URL` fallback (Phase 64 D-05).
- **D-00c:** Viewer field allowlists on signage_* collections locked in Phase 65 (AUTHZ-04). Viewer cannot mutate any `signage_*` collection — Admin role is unrestricted (`admin_access: true`).
- **D-00d:** Phase 65 LISTEN bridge is already wired for `signage_tags` (via `signage_playlist_tag_map` + `signage_device_tag_map` triggers → `playlist-changed` / `device-changed`) and `signage_schedules` (own trigger → `schedule-changed`). No new Alembic trigger work in this phase.
- **D-00e:** `--workers 1` invariant + single asyncpg listener preserved (Phase 65 D-00c).
- **D-00f:** CI grep-guard pattern from Phase 66 (`grep -rn 'pattern' path/ && exit 1 || exit 0`) is the template for any new guards added here.
- **D-00g:** Public function signatures in `frontend/src/signage/lib/signageApi.ts` remain stable; internals swap to Directus SDK (Phase 67 D-01 pattern). Consumer files (`SchedulesPage.tsx`, `ScheduleEditDialog.tsx`, etc.) are not touched except where a friendly validation error needs surfacing.
- **D-00h:** Hand-maintained TS row types (`SignageTag`, `SignageSchedule`) — no Directus schema codegen (Phase 67 D-02).

### Validation UX (`start_hhmm < end_hhmm`)
- **D-01:** Two enforcement layers — both required:
  1. **Alembic CHECK** constraint on `signage_schedules` (`CHECK (start_hhmm < end_hhmm)`) is the database-level source of truth and must be added in this phase.
  2. **Directus validation hook** — implemented as a Directus Flow on `items.create` + `items.update` for `signage_schedules`, returning a 400 with a translated message key. Hook is the friendly-error layer between FE and the raw 23514 Postgres error.
- **D-02:** Frontend pre-validation in `ScheduleEditDialog.tsx` runs the same `start < end` check before submit and surfaces a translated inline error using the existing i18n dictionary (`schedules.validation.endBeforeStart` or equivalent — exact key chosen by planner). Backend remains the source of truth; this is a UX layer to avoid round-trips.
- **D-03:** Translation keys live in the existing `frontend/src/i18n/` DE/EN dictionaries. Planner reuses any existing schedule-validation key if present; otherwise adds one new key per language. Directus hook returns the same key string in its error payload so FE can map cleanly.

### Tag-map scope
- **D-04:** Phase 68 covers ONLY the 4 routes in `backend/app/routers/signage_admin/tags.py` (`signage_tags` collection CRUD). Tag-map writes (`PUT /playlists/{id}/tags` and `PUT /devices/{id}/tags`) explicitly remain in Phase 69 and Phase 70 respectively.
- **D-05:** SSE expectation for tag CRUD: creating/renaming/deleting a `signage_tags` row by itself does NOT fire SSE (no trigger on `signage_tags` per Phase 65 SSE-01). SSE fires when `signage_playlist_tag_map` or `signage_device_tag_map` rows change — which is Phase 69/70 territory. Phase 68 SSE regression therefore validates: (a) `signage_schedules` Directus mutation → `schedule-changed` SSE within 500ms; (b) tag-map mutation via existing FastAPI routes (still mounted) continues to fire correct SSE — no regression introduced by the tag CRUD swap.

### Schedule fan-out cleanup
- **D-06:** `_fanout_schedule_changed()` helper in `backend/app/routers/signage_admin/schedules.py` is deleted along with the router. Planner runs `grep -rn "_fanout_schedule_changed" backend/` first to confirm no callers outside the router; expected result is zero. The Phase-65 LISTEN bridge handles all fan-out for Directus-originated writes.

### Adapter seam location
- **D-07:** Inline swap in `frontend/src/signage/lib/signageApi.ts` — keep `listTags`, `createTag`, `updateTag`, `deleteTag`, `listSchedules`, `createSchedule`, `updateSchedule`, `deleteSchedule` exported with identical signatures. Internal bodies switch from `apiClient(...)` to `directus.request(readItems/createItem/updateItem/deleteItem(...))`. No new module created in this phase. Phase 71 (FE-01) is the right place for any structural seam refactor.

### Admin role permissions
- **D-08:** Directus Administrator role is `admin_access: true` (unrestricted CRUD on all collections) by default — no `bootstrap-roles.sh` change required. Planner adds a backend integration smoke test asserting that an Admin JWT can POST/PATCH/DELETE on `signage_tags` and `signage_schedules` via Directus. If the smoke fails, a new section 6 in `bootstrap-roles.sh` adds explicit Admin permission rows; the betting line is that it will pass without change.

### Test strategy
- **D-09:** SSE regression tests follow the Phase 65 `tests/signage/test_pg_listen_sse.py` pattern. New (or extended) test cases:
  - Directus mutation on `signage_schedules` → `schedule-changed` event delivered to a connected device within 500ms.
  - Existing FastAPI tag-map writes still produce `playlist-changed` / `device-changed` events (no regression from the tag CRUD swap).
- **D-10:** Add `tests/test_rbac.py` updates to remove `/api/signage/tags*` and `/api/signage/schedules*` from READ_ROUTES once routers are deleted. Pattern matches Phase 67 D-(implicit).
- **D-11:** Existing tag/schedule unit tests under `backend/tests/signage/` that hit the FastAPI tag/schedule routes are either ported to Directus-SDK integration tests or deleted — planner decides per-test based on what each currently asserts.

### CI guards
- **D-12:** Add a CI grep guard modeled on Phase 66/67: blocks `/api/signage/tags` and `/api/signage/schedules` literal reappearance under `backend/app/`. Pattern excludes `/api/signage/tags/playlist` or any future hybrid route in case Phase 69/70 reuses the path prefix — planner refines the regex accordingly.

### Claude's Discretion
- Exact Directus Flow vs Directus extension hook implementation for D-01.2 — both achieve the friendly-error goal; Flow is lower-touch and already an established pattern.
- Exact i18n key naming under D-03 — reuse if a schedules validation key exists, otherwise add one.
- Refactoring opportunities inside `signage_admin/__init__.py` after `tags.py` and `schedules.py` are removed — keep minimal.
- Exact CI guard regex syntax under D-12.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap + requirements
- `.planning/ROADMAP.md` §"Phase 68" — goal + success criteria + Requirements MIG-SIGN-01, MIG-SIGN-02
- `.planning/REQUIREMENTS.md` — full text of MIG-SIGN-01 (Tags) and MIG-SIGN-02 (Schedules)

### Prior CONTEXT.md (carried decisions)
- `.planning/phases/65-foundation-schema-authz-sse-bridge/65-CONTEXT.md` — D-00 architectural locks, D-05 to D-08 trigger behavior, D-00d signage_devices gating
- `.planning/phases/66-kill-me-py/66-CONTEXT.md` — D-12/D-13 CI grep guard pattern
- `.planning/phases/67-migrate-data-py-sales-employees-split/67-CONTEXT.md` — D-01 public-signature-stable migration pattern, D-02 hand-maintained TS row types

### Code under migration
- `backend/app/routers/signage_admin/tags.py` (87 lines) — current FastAPI tags CRUD
- `backend/app/routers/signage_admin/schedules.py` (170 lines) — current FastAPI schedules CRUD + `_fanout_schedule_changed` helper
- `backend/app/routers/signage_admin/__init__.py` — router registration
- `frontend/src/signage/lib/signageApi.ts` (218 lines) — `listTags`/`createTag`/... + schedule fns at lines 200-218
- `frontend/src/signage/components/ScheduleEditDialog.tsx` — schedule create/edit form (target for D-02 FE pre-validation)
- `frontend/src/signage/pages/SchedulesPage.tsx` — schedules admin surface

### SSE bridge (Phase 65 — already wired, regression test target)
- `backend/app/services/signage_pg_listen.py` — listener
- `backend/tests/signage/test_pg_listen_sse.py` — pattern to extend for D-09
- Alembic migration `v1_22_signage_notify_triggers.py` (path discoverable via `alembic/versions/`)

### Test files affected
- `backend/tests/test_rbac.py` — READ_ROUTES updates per D-10
- `backend/tests/signage/test_permission_field_allowlists.py` — comment refresh
- `backend/tests/signage/` — existing tag/schedule tests for D-11 triage

### Directus surface
- `directus/snapshots/v1.22.yaml` (or whatever the current snapshot path is) — `signage_tags` + `signage_schedules` collection definitions
- `directus/bootstrap-roles.sh` §5 — Viewer permissions (Phase 65 reference; not modified by this phase per D-08)

### CI
- `.github/workflows/ci.yml` — target for new grep guard step per D-12 (model on the Phase 66/67 guards already present in this file)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Directus SDK functions** (`@directus/sdk`): `readItems`, `createItem`, `updateItem`, `deleteItem` — already imported in `frontend/src/lib/api.ts` from Phase 67. Same import path on `signageApi.ts`.
- **`directus` client singleton**: exported from `frontend/src/lib/directus.ts` (or wherever Phase 66 located it) — reuse, do not re-instantiate.
- **`apiClient.ts`** singleton: continues to handle non-migrated signage routes (devices calibration, playlists DELETE, etc.); only the tag/schedule fns swap.
- **`tests/signage/test_pg_listen_sse.py`** test fixtures: connected-device fixture + Directus mutation helper — extend rather than rebuild.
- **Existing i18n dictionaries** under `frontend/src/i18n/`: DE + EN for schedule UI strings.

### Established Patterns
- **Phase 67 D-01 inline swap**: keep public function signature, swap body to `directus.request(...)`. No callers change.
- **Phase 65 SSE-01/02/03**: trigger → `pg_notify('signage_change', ...)` → asyncpg `add_listener` → `notify_device()`. Already running in production.
- **Phase 66/67 CI grep guard**: `grep -rn 'literal' path/ && exit 1 || exit 0` step in `.github/workflows/ci.yml`, runs early.
- **TanStack Query** caching keys remain stable across the swap — invalidation strategy on mutation is unchanged.

### Integration Points
- `signage_admin/__init__.py` router registration → drop tags + schedules includes after migration.
- `frontend/src/signage/pages/SchedulesPage.tsx` — consumes `useSchedules` (presumably wraps `signageApi.listSchedules`); no change required if signatures hold.
- `ScheduleEditDialog.tsx` — only file that gains the pre-validation hook from D-02.

</code_context>

<specifics>
## Specific Ideas

- The Directus validation hook should return its error in a shape FE can map to an i18n key — i.e., a stable error code (e.g., `"schedule_end_before_start"`) in the response, not just a localized message string. This keeps DE/EN translations in the FE dictionary, not the Directus extension.
- The Phase 65 listener bridge is already validated by `test_pg_listen_sse.py`; the regression cases for Phase 68 are additive, not rewrites.
- Tag CRUD itself produces no SSE — that's expected, not a bug. SSE only flows from tag-map (junction) writes, which are Phase 69/70 scope.

</specifics>

<deferred>
## Deferred Ideas

- **`PUT /playlists/{id}/tags` migration** — Phase 69 (MIG-SIGN-03 scope).
- **`PUT /devices/{id}/tags` migration** — Phase 70 (MIG-SIGN-04 scope).
- **Adapter seam structural refactor** (split `signageApi.ts` into per-domain modules) — Phase 71 FE-01.
- **Contract-snapshot tests per migrated endpoint** — Phase 71 FE-04.
- **Rollback E2E checklist update for tags + schedules** — folds into Phase 71 CLEAN-03.

</deferred>

---

*Phase: 68-mig-sign-tags-schedules*
*Context gathered: 2026-04-25*
