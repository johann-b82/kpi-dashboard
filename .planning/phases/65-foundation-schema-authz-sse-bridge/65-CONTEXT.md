# Phase 65: Foundation — Schema + AuthZ + SSE Bridge - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend-only bootstrap for milestone v1.22. Three deliverables ship together, all producing zero user-visible change:

1. **Directus snapshot apply** — register v1.22 collections (`signage_devices`, `signage_playlists`, `signage_playlist_items`, `signage_tags`, `signage_playlist_tag_map`, `signage_device_tag_map`, `signage_schedules`, `sales_records`, `personio_employees`) as Directus metadata; Alembic remains sole DDL owner.
2. **Per-collection Viewer permission rows** with explicit `fields` allowlists mirroring Pydantic `*Read`; no signage read/write for Viewer; `directus_users` excludes `tfa_secret`/`auth_data`/`external_identifier`.
3. **Postgres LISTEN/NOTIFY SSE bridge** — Alembic-created triggers fan out to existing `notify_device()` via asyncpg listener so Directus Data Model UI mutations reach Pi players within 500 ms without changing frontend code.

**Not in scope:** Any endpoint migration (Phases 66–71), any frontend change, calibration PATCH behavior (stays unchanged in FastAPI).

</domain>

<decisions>
## Implementation Decisions

### Architectural locks carried from milestone research (not revisited)
- **D-00a:** SSE bridge = Postgres LISTEN/NOTIFY (Option A) — chosen before roadmap.
- **D-00b:** Alembic sole DDL owner; Directus writes metadata rows only.
- **D-00c:** `--workers 1` invariant preserved; single asyncpg listener.
- **D-00d:** `signage_devices` trigger gated to name/tags only so calibration PATCH SSE (FastAPI) never double-fires.

### Snapshot apply + compose wiring
- **D-01:** Primary apply mechanism is pure `npx directus schema apply` against the committed YAML. REST `POST /collections {schema:null}` is the documented fallback for the known #25760 existing-table edge; fallback is operator-run, not automatic.
- **D-02:** Snapshot YAML scope = collections + fields + relations only. Policies, roles, and permissions stay in `directus/bootstrap-roles.sh` (existing v1.11 precedent). System settings not captured in YAML.
- **D-03:** Compose startup chain: `postgres` → `alembic-migrate` → `directus` (healthy) → `directus-schema-apply` → `directus-bootstrap-roles` → `backend`. Backend only starts after all Directus metadata is registered — field allowlists exist before first `/api/*` request. Use `condition: service_completed_successfully` on the one-shot services.
- **D-04:** `directus-schema-apply` is a new one-shot compose service that exits 0 after apply; its container mounts `directus/snapshots/v1.22.yaml`.

### Trigger SQL + payload shape
- **D-05:** Single Alembic migration `v1_22_signage_notify_triggers.py` creates one shared PL/pgSQL function `signage_notify()` using `TG_TABLE_NAME` + `TG_OP`, plus 6 `CREATE TRIGGER` statements. Shared payload/call logic lives in one place.
- **D-06:** `pg_notify` payload is minimal JSON: `{"table": <name>, "op": <INSERT|UPDATE|DELETE>, "id": <row_id>}`. Listener re-reads DB using existing `devices_affected_by_playlist` resolver. Well under the 8000-byte cap. Channel name: `signage_change`.
- **D-07:** `signage_devices` trigger fires on `AFTER INSERT`, `AFTER DELETE`, and `AFTER UPDATE` with WHEN clause `OLD.name IS DISTINCT FROM NEW.name OR OLD.tags IS DISTINCT FROM NEW.tags`. Calibration columns (`rotation`, `hdmi_mode`, `audio_enabled`, `paired_at`, `last_heartbeat_at`) do NOT fire the trigger.
- **D-08:** Other five tables (`signage_playlists`, `signage_playlist_items`, `signage_playlist_tag_map`, `signage_device_tag_map`, `signage_schedules`) fire on INSERT/UPDATE/DELETE with no WHEN guard (all column changes matter).

### Listener lifecycle & reconnect
- **D-09:** Listener lives in `backend/app/services/signage_pg_listen.py` (~80 LOC target), started from FastAPI `lifespan`.
- **D-10:** Reconnect: exponential backoff 1s → 30s cap, infinite retries, no max. Warn-log line per attempt: `signage_pg_listen: reconnecting attempt=N backoff=Xs`. No jitter (single-worker makes it unnecessary).
- **D-11:** Missed events during reconnect window are accepted as lost. Players already poll every 30s as the existing backup path. No event-log table, no synthetic refresh-all broadcast.
- **D-12:** Visibility = warn logs only. No Prometheus counter, no `app_settings` timestamp. Discoverable via `docker compose logs backend`.
- **D-13:** Startup posture = fail-soft. If asyncpg listener connect fails at lifespan startup, backend still serves `/api/*`; listener retries in background. Initial failure logs ERROR once, then WARN per retry.

### CI drift guards + SSE-04 integration test
- **D-14:** Two independent drift guards satisfy SCHEMA-03:
  - Guard A (DDL): SHA256 hash of `(table_name, column_name, data_type, is_nullable, column_default)` rows from `information_schema.columns` over the v1.22-surfaced tables. Compared against committed fixture.
  - Guard B (Directus metadata): `npx directus schema snapshot` output diffed against committed `directus/snapshots/v1.22.yaml`.
- **D-15:** Fixture location: `directus/fixtures/schema-hash.txt`. Regenerated via Makefile target `make schema-fixture-update` that runs against a clean `docker compose up -d` stack and writes the new hash. Developer commits the hash alongside the Alembic migration that changed it.
- **D-16:** SSE-04 integration test drives mutations via Directus admin-token REST calls (`POST /items/<collection>` etc.) — same path the Data Model UI uses. Test subscribes a simulated paired device to `/api/signage/player/stream` and asserts the correct SSE event (`playlist-changed` / `device-changed` / `schedule-changed`) arrives.
- **D-17:** Latency assertion: hard `<500ms` ceiling in CI. If CI runner is slow, the flake is treated as a real signal that the latency budget is tight — aligns test with ROADMAP success criteria #3 and SSE-04 verbatim.
- **D-18:** One integration test per surfaced signage table (6 tests). SCHEMA-04 superset check + `--workers 1` invariant grep are separate CI guards.

### Claude's Discretion
- Exact Viewer field allowlist per collection is left to the planner to derive from current Pydantic `*Read` schemas — principle (mirror `*Read` exactly, no `*`) is locked.
- Rollback recipe for a partial `directus-schema-apply` failure on fresh volume is left to the planner to document in `docs/operator-runbook.md` alongside the #25760 fallback.
- Exact list of v1.22-surfaced tables included in the DDL hash fixture (Guard A) is the planner's call; the principle is "every table surfaced to Directus + tables whose structure backs them."
- Integration test harness plumbing (reuse existing pytest fixtures vs new compose fixture) — planner picks based on existing test infra.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone v1.22 research (all inform this phase)
- `.planning/research/SUMMARY.md` — executive summary, SSE bridge Option A rationale, phase sequencing, pitfalls ranking.
- `.planning/research/STACK.md` — stack additions (Option-A extras: Alembic trigger migration + `signage_pg_listen.py`).
- `.planning/research/FEATURES.md` — per-endpoint verdicts (context for why Phase 65 must precede 66–71).
- `.planning/research/ARCHITECTURE.md` — SSE bridge mechanics, permission model, snapshot pattern.
- `.planning/research/PITFALLS.md` — P1 Data Model UI DDL drift, P5 SSE fanout silent break, P9/P15 Viewer leak.

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` §SCHEMA-01..05, §AUTHZ-01..05, §SSE-01..06 — acceptance criteria this phase satisfies.
- `.planning/ROADMAP.md` §"Phase 65: Foundation — Schema + AuthZ + SSE Bridge" — goal, success criteria, locked architectural decisions.
- `.planning/PROJECT.md` — project constraints (Dockerized, Postgres, Directus 11 identity).

### Existing code integration points
- `backend/app/services/signage_broadcast.py` — `notify_device()` that the listener will call.
- `backend/app/services/signage_resolver.py` — `devices_affected_by_playlist()` used for fan-out.
- `directus/bootstrap-roles.sh` — v1.11 REST pattern to extend with per-collection permission rows.
- `docker-compose.yml` — compose service graph to extend with `directus-schema-apply`.
- `backend/app/main.py` — FastAPI `lifespan` where listener starts/stops.
- `backend/alembic/versions/*.py` — precedent for DDL migrations; v1.22 trigger migration lives here.

### Directus external refs (Phase 65 only)
- Directus 11 Schema API + snapshot/apply CLI docs.
- Known issue directus/directus#25760 (existing-table edge).
- asyncpg `connection.add_listener` + reconnect pattern.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`notify_device()`** (`backend/app/services/signage_broadcast.py`) — the SSE fan-out primitive. Listener handler must call this unchanged so calibration PATCH and LISTEN bridge share one emission path.
- **`devices_affected_by_playlist()`** resolver (`backend/app/services/signage_resolver.py`) — listener re-reads DB with this to expand `{table, op, id}` → device list.
- **`compute_playlist_etag()`** — single-source etag helper; bridge emits event-id only, etag stays computed on the FastAPI side.
- **`directus/bootstrap-roles.sh`** — existing idempotent GET-before-POST REST pattern from v1.11; extend with a new "section 4" for per-collection permission rows + fixed UUIDs.
- **FastAPI `lifespan`** (`backend/app/main.py`) — async startup/shutdown hook; listener task starts here, cancelled on shutdown.

### Established Patterns
- **Alembic-owned DDL**: every table + constraint change is an Alembic migration. PL/pgSQL triggers follow the same rule — they go in an Alembic migration, not a Directus UI click.
- **`--workers 1`**: uvicorn runs single-worker in production (`docker-compose.yml`); this is a hard invariant the listener depends on for correctness.
- **One-shot compose services** for bootstrap (existing `directus-bootstrap-roles`): use `condition: service_completed_successfully` on dependents. `directus-schema-apply` follows the same shape.
- **Pydantic `*Read` schemas** drive what fields are surfaced; Viewer allowlists mirror them exactly.

### Integration Points
- New Alembic migration file: `backend/alembic/versions/<rev>_v1_22_signage_notify_triggers.py`.
- New service file: `backend/app/services/signage_pg_listen.py`.
- New compose service: `directus-schema-apply` in `docker-compose.yml`.
- New YAML: `directus/snapshots/v1.22.yaml`.
- New section in `directus/bootstrap-roles.sh` for permission rows.
- New CI jobs or steps: DDL hash check, schema-snapshot diff check, `--workers 1` grep, `DB_EXCLUDE_TABLES` superset check.
- New fixture: `directus/fixtures/schema-hash.txt`.
- New Makefile target: `schema-fixture-update`.
- New integration test module: one test per surfaced signage table driving Directus REST → SSE.

</code_context>

<specifics>
## Specific Ideas

- User wants the 500 ms SSE SLA enforced in CI (not just staging) even at the cost of occasional flakes.
- `signage_devices` WHEN clause must be phrased exactly as `OLD.name IS DISTINCT FROM NEW.name OR OLD.tags IS DISTINCT FROM NEW.tags` (matches SSE-01 and keeps future calibration columns safely excluded by default).
- Fallback path for Directus schema apply (#25760) is **documented, operator-run** — not auto-fallback logic in the compose service. Keep the service's "happy path" clean.
- Snapshot YAML scope is intentionally narrow (metadata only) — do NOT import policies/roles/permissions into the YAML; that surface stays owned by `bootstrap-roles.sh`.
- Payload stays minimal (`{table, op, id}`) specifically so the resolver logic stays in Python, not PL/pgSQL.

</specifics>

<deferred>
## Deferred Ideas

- Prometheus metrics for listener reconnects (`signage_listener_reconnects_total`) — out of scope; ops reads logs.
- Event-log table + cursor replay for strict zero-loss SSE — rejected; 30s poll fallback is sufficient.
- Capturing `directus_settings` (project_name, CORS, etc.) in the snapshot YAML — env-specific; stays out.
- Merging `directus-schema-apply` and `directus-bootstrap-roles` into one container — keep separate for blast-radius isolation.
- Rollback E2E tests for v1.22 — that's Phase 71's deliverable (FE polish + CLEAN).

</deferred>

---

*Phase: 65-foundation-schema-authz-sse-bridge*
*Context gathered: 2026-04-24*
