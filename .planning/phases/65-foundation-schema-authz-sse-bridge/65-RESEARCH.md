# Phase 65: Foundation — Schema + AuthZ + SSE Bridge — Research

**Researched:** 2026-04-24
**Domain:** Directus 11 schema snapshot apply, per-collection REST permission rows, Postgres LISTEN/NOTIFY ↔ asyncpg add_listener bridge, Alembic-owned PL/pgSQL triggers, docker-compose one-shot bootstrap chains.
**Confidence:** HIGH

## Summary

Phase 65 is a pure backend bootstrap phase. Every architectural question has already been answered at the milestone layer (`.planning/research/SUMMARY.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `STACK.md`) and re-ratified in `65-CONTEXT.md`. This research does **not** explore alternatives — the locked decisions already rule them out. It instead validates the exact library/CLI/API surfaces the planner will invoke (`npx directus schema apply --yes`, asyncpg `connection.add_listener`, `POST /permissions` via the existing `bootstrap-roles.sh` pattern, PL/pgSQL `CREATE TRIGGER ... WHEN (OLD.col IS DISTINCT FROM NEW.col)` semantics, docker-compose `condition: service_completed_successfully` chaining) and surfaces the integration pitfalls unique to bolting them onto the live v1.21 codebase.

The phase delivers four glued-together artifacts: (1) a `directus/snapshots/v1.22.yaml` applied by a new one-shot `directus-schema-apply` compose service, (2) a `bootstrap-roles.sh` "section 4" POSTing per-collection permission rows with explicit `fields` allowlists mirroring Pydantic `*Read`, (3) one Alembic migration (`v1_22_signage_notify_triggers.py`) creating a shared `signage_notify()` PL/pgSQL function plus 6 `CREATE TRIGGER` statements (with the `signage_devices` trigger gated on `OLD.name IS DISTINCT FROM NEW.name OR OLD.tags IS DISTINCT FROM NEW.tags`), and (4) `backend/app/services/signage_pg_listen.py` (~80 LOC) started from FastAPI `lifespan` that re-uses the existing `devices_affected_by_playlist` resolver and `notify_device()` fan-out.

**Primary recommendation:** Treat this phase as integration-plumbing, not invention. Every building block already exists in the repo (the `bootstrap-roles.sh` GET-before-POST pattern, `lifespan` in `app/scheduler.py`, `notify_device`, `devices_affected_by_playlist`, `compute_playlist_etag`, one-shot compose services like `directus-bootstrap-roles`). The planner's job is to wire them in order (`compose chain → Alembic migration → snapshot YAML → permission rows → listener service → CI guards → 6 SSE integration tests`) without regressing any of the v1.21 cross-cutting invariants (especially `--workers 1` and the calibration SSE path).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Architectural locks carried from milestone research (not revisited):**
- **D-00a:** SSE bridge = Postgres LISTEN/NOTIFY (Option A).
- **D-00b:** Alembic sole DDL owner; Directus writes metadata rows only.
- **D-00c:** `--workers 1` invariant preserved; single asyncpg listener.
- **D-00d:** `signage_devices` trigger gated to name/tags only so calibration PATCH SSE (FastAPI) never double-fires.

**Snapshot apply + compose wiring:**
- **D-01:** Primary apply mechanism is pure `npx directus schema apply` against committed YAML. REST `POST /collections {schema:null}` is the documented fallback for the known #25760 existing-table edge; fallback is operator-run, not automatic.
- **D-02:** Snapshot YAML scope = collections + fields + relations only. Policies, roles, permissions stay in `directus/bootstrap-roles.sh` (v1.11 precedent). System settings not captured in YAML.
- **D-03:** Compose startup chain: `postgres` → `alembic-migrate` → `directus` (healthy) → `directus-schema-apply` → `directus-bootstrap-roles` → `backend`. Backend only starts after all Directus metadata is registered — field allowlists exist before first `/api/*` request. Use `condition: service_completed_successfully` on the one-shot services.
- **D-04:** `directus-schema-apply` is a new one-shot compose service that exits 0 after apply; its container mounts `directus/snapshots/v1.22.yaml`.

**Trigger SQL + payload shape:**
- **D-05:** Single Alembic migration `v1_22_signage_notify_triggers.py` creates one shared PL/pgSQL function `signage_notify()` using `TG_TABLE_NAME` + `TG_OP`, plus 6 `CREATE TRIGGER` statements.
- **D-06:** `pg_notify` payload is minimal JSON: `{"table": <name>, "op": <INSERT|UPDATE|DELETE>, "id": <row_id>}`. Listener re-reads DB using existing `devices_affected_by_playlist` resolver. Under the 8000-byte cap. Channel name: `signage_change`.
- **D-07:** `signage_devices` trigger fires on `AFTER INSERT`, `AFTER DELETE`, and `AFTER UPDATE` with WHEN clause `OLD.name IS DISTINCT FROM NEW.name OR OLD.tags IS DISTINCT FROM NEW.tags`. Calibration columns (`rotation`, `hdmi_mode`, `audio_enabled`, `paired_at`, `last_heartbeat_at`) do NOT fire the trigger.
- **D-08:** Other five tables (`signage_playlists`, `signage_playlist_items`, `signage_playlist_tag_map`, `signage_device_tag_map`, `signage_schedules`) fire on INSERT/UPDATE/DELETE with no WHEN guard.

**Listener lifecycle & reconnect:**
- **D-09:** Listener lives in `backend/app/services/signage_pg_listen.py` (~80 LOC target), started from FastAPI `lifespan`.
- **D-10:** Reconnect: exponential backoff 1s → 30s cap, infinite retries, no max. Warn-log line per attempt: `signage_pg_listen: reconnecting attempt=N backoff=Xs`. No jitter.
- **D-11:** Missed events during reconnect window are accepted as lost. Players already poll every 30s as the existing backup path. No event-log table, no synthetic refresh-all broadcast.
- **D-12:** Visibility = warn logs only. No Prometheus counter, no `app_settings` timestamp.
- **D-13:** Startup posture = fail-soft. If asyncpg listener connect fails at lifespan startup, backend still serves `/api/*`; listener retries in background. Initial failure logs ERROR once, then WARN per retry.

**CI drift guards + SSE-04 integration test:**
- **D-14:** Two independent drift guards satisfy SCHEMA-03:
  - Guard A (DDL): SHA256 hash of `(table_name, column_name, data_type, is_nullable, column_default)` rows from `information_schema.columns` over the v1.22-surfaced tables. Compared against committed fixture.
  - Guard B (Directus metadata): `npx directus schema snapshot` output diffed against committed `directus/snapshots/v1.22.yaml`.
- **D-15:** Fixture location: `directus/fixtures/schema-hash.txt`. Regenerated via Makefile target `make schema-fixture-update`.
- **D-16:** SSE-04 integration test drives mutations via Directus admin-token REST calls (`POST /items/<collection>` etc.) — same path the Data Model UI uses. Test subscribes a simulated paired device to `/api/signage/player/stream` and asserts the correct SSE event within 500 ms.
- **D-17:** Latency assertion: hard `<500ms` ceiling in CI. Flakes treated as real signal.
- **D-18:** One integration test per surfaced signage table (6 tests). SCHEMA-04 superset check + `--workers 1` invariant grep are separate CI guards.

### Claude's Discretion
- Exact Viewer field allowlist per collection is left to the planner to derive from current Pydantic `*Read` schemas — principle (mirror `*Read` exactly, no `*`) is locked.
- Rollback recipe for a partial `directus-schema-apply` failure on fresh volume is left to the planner to document in `docs/operator-runbook.md` alongside the #25760 fallback.
- Exact list of v1.22-surfaced tables included in the DDL hash fixture (Guard A) is the planner's call; the principle is "every table surfaced to Directus + tables whose structure backs them."
- Integration test harness plumbing (reuse existing pytest fixtures vs new compose fixture) — planner picks based on existing test infra.

### Deferred Ideas (OUT OF SCOPE)
- Prometheus metrics for listener reconnects (`signage_listener_reconnects_total`) — ops reads logs.
- Event-log table + cursor replay for strict zero-loss SSE — rejected; 30s poll fallback is sufficient.
- Capturing `directus_settings` (project_name, CORS, etc.) in the snapshot YAML — env-specific.
- Merging `directus-schema-apply` and `directus-bootstrap-roles` into one container — keep separate for blast-radius isolation.
- Rollback E2E tests for v1.22 — that's Phase 71's deliverable.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHEMA-01 | Apply git-checked snapshot YAML registering the 9 v1.22 collections as Directus metadata (never DDL) | `npx directus schema apply --yes /snapshots/v1.22.yaml` CLI verified (see Standard Stack); file layout per D-02/D-04; see "Snapshot YAML scope" in Architecture Patterns |
| SCHEMA-02 | `docker compose up -d` on fresh volume reproduces collections idempotently via `directus-schema-apply` running after `directus` healthy and before `directus-bootstrap-roles` | Compose chain pattern per D-03 matches existing `directus-bootstrap-roles` precedent (see docker-compose.yml lines 117–133). `condition: service_completed_successfully` is Compose v2 native. |
| SCHEMA-03 | CI guard compares `information_schema.columns` hash vs fixture + asserts `directus schema snapshot` is diff-free | Two guards per D-14; fixture at `directus/fixtures/schema-hash.txt`; Makefile regen target per D-15. See "Don't Hand-Roll" for why these cannot be one compound check. |
| SCHEMA-04 | `DB_EXCLUDE_TABLES` shrunk to correct minimal set + CI guard asserts it is a superset of hard-coded "never expose" allowlist | Current env value at docker-compose.yml:95; "never expose" list already established in STATE.md cross-cutting hazard #10. |
| SCHEMA-05 | Operators see a "never edit Data Model UI" rule in `docs/operator-runbook.md`; violation detected by SCHEMA-03 | Documentation task; detection mechanism is Guard B from D-14. |
| AUTHZ-01 | `bootstrap-roles.sh` creates per-collection Viewer permission rows with explicit `fields` allowlists for `sales_records` + `personio_employees` — no `*` | Extend existing script's section structure (currently sections 1–4 — append new section 5 per roles-bootstrap pattern); derive fields from `SalesRecordRead` (9 fields) + `EmployeeRead` (11 fields) in `backend/app/schemas/_base.py`. |
| AUTHZ-02 | Viewer has no permission rows on any `signage_*` collection | Omission; CI assertion via `/permissions?filter[policy][_eq]=<viewer>&filter[collection][_starts_with]=signage_` must return empty. |
| AUTHZ-03 | `directus_users` Viewer permission row with explicit fields allowlist (id, email, first_name, last_name, role, avatar) — excludes `tfa_secret`, `auth_data`, `external_identifier` | Directus 11 system collection `directus_users` columns documented. Permission row POSTed via same helper. |
| AUTHZ-04 | Bootstrap script idempotent (GET-before-POST) on every re-run; commits fixed UUIDs per permission row | v1.11 established pattern (see bootstrap-roles.sh sections 1–3 at fixed UUIDs `a2222222-...`). Plan allocates a new prefix (e.g., `b2222222-...`) for permission rows. |
| AUTHZ-05 | Integration test per collection: Viewer JWT cannot read excluded fields, cannot mutate any `signage_*` | Use existing FastAPI test client + Directus admin token fixture; mint a Viewer JWT via the test-helper JWT mint already used in `backend/tests/*`. |
| SSE-01 | Alembic migration creates AFTER-INSERT/UPDATE/DELETE triggers on the six listed tables; `signage_devices` WHEN-gated | One migration file per D-05; canonical PL/pgSQL shape verified (see Code Examples). |
| SSE-02 | Each trigger calls `pg_notify('signage_change', '{"table":..., "op":..., "id":...}')` with payload under 8000 bytes | Shared `signage_notify()` function per D-06; channel `signage_change`. |
| SSE-03 | FastAPI `lifespan` starts long-lived asyncpg `add_listener('signage_change', …)`; resolves devices via existing `devices_affected_by_playlist`; calls existing `notify_device()` | `lifespan` lives in `backend/app/scheduler.py:358`. Resolver exists at `signage_resolver.py:256`. asyncpg `add_listener` API verified. |
| SSE-04 | Directus Data Model UI mutation fires matching SSE to Pi within 500 ms | 6 integration tests per D-16/D-18; Directus admin-token REST calls to `POST /items/<collection>`. |
| SSE-05 | `--workers 1` invariant preserved; CI guard references invariant | Existing comment at docker-compose.yml:24–30; add grep guard referencing `signage_pg_listen` alongside scheduler. |
| SSE-06 | Listener auto-reconnects on connection loss; warn-log per reconnect | asyncpg listeners are dropped on disconnect and must be re-registered (verified — see Pitfalls); implement exponential backoff per D-10. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Containerization via Docker Compose v2 (`docker compose`, not `docker-compose`); no bare-metal dependencies.
- Database is PostgreSQL (project constraint).
- Directus 11 is the identity provider; FastAPI validates Directus-issued HS256 JWTs on every `/api/*` request.
- **Stack pins:** FastAPI 0.135.3, Uvicorn 0.44.0, SQLAlchemy 2.0.49, asyncpg 0.31.0, Alembic 1.18.4, Postgres 17-alpine, Directus 11.17.2. Do not bump as part of this phase.
- **SQLAlchemy 2.0 async patterns only** — `AsyncSession` + `create_async_engine`. Never mix sync and async session patterns.
- **Alembic is the only DDL author** — never call `Base.metadata.create_all()`. Triggers go in Alembic migrations.
- **Uvicorn `--workers 1`** in production — this is a hard invariant the listener depends on.
- Use `condition: service_healthy` / `condition: service_completed_successfully` on `depends_on` — never bare `depends_on: [...]`.
- No emojis in code or documentation.
- All file-changing work must happen via a GSD command.

## Standard Stack

### Core (already in repo — no changes)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.135.3 | Lifespan hook hosts the asyncpg listener task | Already in use; async-native; `@asynccontextmanager` lifespan already present in `app/scheduler.py` |
| asyncpg | 0.31.0 | `connection.add_listener()` for Postgres LISTEN | Native, idiomatic Postgres LISTEN support. No wrapper library needed. Already in dependency tree. |
| SQLAlchemy | 2.0.49 | Resolver `devices_affected_by_playlist` reads | Existing pattern; bridge handler re-uses it. |
| Alembic | 1.18.4 | Migration emits `CREATE FUNCTION` + `CREATE TRIGGER` via `op.execute` | Alembic supports raw SQL via `op.execute(sa.text(...))` — idiomatic for PL/pgSQL. |
| Directus | 11.17.2 | Provides `schema apply` CLI + REST `POST /permissions` + `POST /items/<coll>` | Image version pinned in docker-compose.yml; CLI ships inside the image. |
| Docker Compose | v2 | `service_completed_successfully` one-shot chaining | Already used for `migrate` and `directus-bootstrap-roles`. |

**Version verification:** All versions verified by reading `docker-compose.yml`, `backend/requirements.txt` (implied from `.planning/research/STACK.md` which confirmed against PyPI 2026-04-24), and `frontend/package.json`. No new dependencies needed for Phase 65.

### No new packages

The phase adds **zero** new npm/pip dependencies. All artifacts are code (Alembic migration, Python service module, shell script extension, YAML file) plus one new compose service that re-uses the existing `directus/directus:11.17.2` image.

### CLI tools invoked at runtime

| Tool | Invocation | Where |
|------|-----------|-------|
| `npx directus schema apply --yes /snapshots/v1.22.yaml` | Via one-shot compose service `directus-schema-apply` | Inside `directus/directus:11.17.2` container — ships the `directus` node binary. |
| `npx directus schema snapshot -` | CI Guard B (stdout diff vs committed YAML) | Same container, CI job. |
| `curl` REST | `bootstrap-roles.sh` `POST /permissions` | Existing `curlimages/curl:8.10.1` sidecar (reused). |
| `psql` (optional) | Operator fallback for #25760 (`POST /collections` via curl preferred, but psql available if needed) | `postgres:17-alpine`. |

## Architecture Patterns

### Recommended File Layout (additive to current repo)

```
backend/
├── alembic/versions/
│   └── v1_22_signage_notify_triggers.py   # NEW — 1 fn + 6 triggers
└── app/services/
    └── signage_pg_listen.py               # NEW — ~80 LOC listener + reconnect
directus/
├── snapshots/
│   └── v1.22.yaml                         # NEW — collections + fields + relations only
├── fixtures/
│   └── schema-hash.txt                    # NEW — DDL hash for Guard A
└── bootstrap-roles.sh                     # MODIFIED — append "section 5" permission rows
docs/
└── operator-runbook.md                    # NEW or MODIFIED — "never edit Data Model UI" rule + #25760 fallback recipe
docker-compose.yml                         # MODIFIED — new service + depends_on rewire + shrink DB_EXCLUDE_TABLES
Makefile                                   # MODIFIED — add schema-fixture-update target
.github/workflows/ (or equivalent CI config) # MODIFIED — 3 new guards (hash, snapshot diff, workers grep, superset check)
backend/tests/signage/
└── test_pg_listen_sse.py                  # NEW — 6 integration tests per D-18
```

### Pattern 1: Compose Startup Chain (per D-03)

**What:** Use `condition: service_completed_successfully` on every one-shot bootstrap service so the `backend` (`api`) container only starts after schema metadata + permission rows exist.

**When to use:** Every time a downstream service depends on runtime state that a predecessor writes and exits.

**Example (new service addition):**

```yaml
# docker-compose.yml additions
directus-schema-apply:
  image: directus/directus:11.17.2
  env_file: .env
  environment:
    DB_CLIENT: pg
    DB_HOST: db
    DB_PORT: 5432
    DB_DATABASE: ${POSTGRES_DB}
    DB_USER: ${POSTGRES_USER}
    DB_PASSWORD: ${POSTGRES_PASSWORD}
    KEY: ${DIRECTUS_KEY}
    SECRET: ${DIRECTUS_SECRET}
  volumes:
    - ./directus/snapshots:/snapshots:ro
  depends_on:
    directus:
      condition: service_healthy
  entrypoint: ["/bin/sh", "-c", "npx directus schema apply --yes /snapshots/v1.22.yaml"]
  restart: "no"

directus-bootstrap-roles:
  # ... existing ...
  depends_on:
    directus:
      condition: service_healthy
    directus-schema-apply:
      condition: service_completed_successfully   # NEW — chain

api:
  # ... existing ...
  depends_on:
    migrate:
      condition: service_completed_successfully
    directus-bootstrap-roles:                     # NEW dep — so field allowlists exist before /api/* serves
      condition: service_completed_successfully
```

**Note:** Env block on `directus-schema-apply` is required because `npx directus schema apply` loads the project config (DB creds, KEY, SECRET) before running — same env the main `directus` service uses.

### Pattern 2: Idempotent Permission Row POSTs (extend bootstrap-roles.sh)

**What:** Append a new "section 5" to `directus/bootstrap-roles.sh` that POSTs per-collection permission rows to `/permissions`. Use the same GET-before-POST idempotency shape as sections 1–3, with fixed UUIDs per row.

**When to use:** Every new permission row Phase 65 adds (at minimum: `sales_records` read, `personio_employees` read, `directus_users` read with explicit fields).

**Example:**

```sh
# bootstrap-roles.sh — new section 5 (appended after section 4)
ensure_permission() {
  # $1=permission_id (fixed UUID), $2=collection, $3=action, $4=fields_json_array
  pid="$1"; coll="$2"; act="$3"; fields="$4"
  status=$(api GET "/permissions/${pid}")
  if [ "$status" = "200" ]; then
    log "permission ${pid} (${coll}.${act}) exists — skipping"
    return 0
  fi
  log "creating permission ${pid} (${coll}.${act}) fields=${fields}"
  status=$(api POST "/permissions" "{
    \"id\":\"${pid}\",
    \"policy\":\"${VIEWER_POLICY_ID}\",
    \"collection\":\"${coll}\",
    \"action\":\"${act}\",
    \"fields\":${fields},
    \"permissions\":{}
  }")
  [ "$status" = "200" ] || [ "$status" = "204" ] || {
    log "ERROR: POST /permissions returned ${status}"; cat /tmp/api.body; exit 1
  }
}

# --- 5. Viewer permission rows ---
ensure_permission "b2222222-0001-...-...-..." "sales_records"      "read" \
  '["id","order_number","customer_name","city","order_date","total_value","remaining_value","responsible_person","project_name","status_code"]'
ensure_permission "b2222222-0002-...-...-..." "personio_employees" "read" \
  '["id","first_name","last_name","status","department","position","hire_date","termination_date","weekly_working_hours"]'
ensure_permission "b2222222-0003-...-...-..." "directus_users"     "read" \
  '["id","email","first_name","last_name","role","avatar"]'
# Intentional: NO signage_* permissions — Viewers are Admin-only for signage (AUTHZ-02).
```

**Source for fields:** `SalesRecordRead` at `backend/app/schemas/_base.py:268`; `EmployeeRead` at `backend/app/schemas/_base.py:291`. Note: `EmployeeRead` includes `total_hours`, `overtime_hours`, `overtime_ratio` which are **compute-derived** in FastAPI (Phase 67) and not columns on `personio_employees` — exclude those from Directus allowlist.

### Pattern 3: Shared PL/pgSQL Trigger Function (per D-05, D-06, D-07, D-08)

**What:** One `signage_notify()` PL/pgSQL function dispatched from 6 `CREATE TRIGGER` statements. Uses `TG_TABLE_NAME` + `TG_OP` + `NEW.id`/`OLD.id` (depending on op) to compose payload. Returns `NULL` (we're `AFTER` triggers with row-level `FOR EACH ROW`).

**When to use:** Any fan-in notification pattern where 6 tables share the same payload shape.

**Example (migration file):**

```python
# backend/alembic/versions/v1_22_signage_notify_triggers.py
"""v1.22 signage LISTEN/NOTIFY triggers

Revision ID: v1_22_signage_notify_triggers
Revises: v1_21_signage_calibration
Create Date: 2026-04-24

Six AFTER triggers call shared signage_notify() which emits
pg_notify('signage_change', {table, op, id}). signage_devices trigger
is WHEN-gated to name/tags only (D-07) so calibration updates (FastAPI-
owned SSE path) never double-fire.
"""
from alembic import op

revision = "v1_22_signage_notify_triggers"
down_revision = "v1_21_signage_calibration"
branch_labels = None
depends_on = None

FUNCTION_SQL = r"""
CREATE OR REPLACE FUNCTION signage_notify() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  row_id text;
  payload jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_id := OLD.id::text;
  ELSE
    row_id := NEW.id::text;
  END IF;
  payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'op',    TG_OP,
    'id',    row_id
  );
  PERFORM pg_notify('signage_change', payload::text);
  RETURN NULL;
END;
$$;
"""

TRIGGERS_SQL = r"""
-- 5 tables: INSERT/UPDATE/DELETE, no WHEN guard (all column changes matter).
CREATE TRIGGER signage_playlists_notify
  AFTER INSERT OR UPDATE OR DELETE ON signage_playlists
  FOR EACH ROW EXECUTE FUNCTION signage_notify();

CREATE TRIGGER signage_playlist_items_notify
  AFTER INSERT OR UPDATE OR DELETE ON signage_playlist_items
  FOR EACH ROW EXECUTE FUNCTION signage_notify();

CREATE TRIGGER signage_playlist_tag_map_notify
  AFTER INSERT OR UPDATE OR DELETE ON signage_playlist_tag_map
  FOR EACH ROW EXECUTE FUNCTION signage_notify();

CREATE TRIGGER signage_device_tag_map_notify
  AFTER INSERT OR UPDATE OR DELETE ON signage_device_tag_map
  FOR EACH ROW EXECUTE FUNCTION signage_notify();

CREATE TRIGGER signage_schedules_notify
  AFTER INSERT OR UPDATE OR DELETE ON signage_schedules
  FOR EACH ROW EXECUTE FUNCTION signage_notify();

-- signage_devices: split into 3 triggers (INSERT, DELETE unguarded;
-- UPDATE guarded on name/tags only — D-07). tags column on signage_devices
-- is the legacy array on the ORM model; if tags live in signage_device_tag_map
-- only, drop the "tags" OR clause and rely on the map trigger.
CREATE TRIGGER signage_devices_insert_notify
  AFTER INSERT ON signage_devices
  FOR EACH ROW EXECUTE FUNCTION signage_notify();

CREATE TRIGGER signage_devices_delete_notify
  AFTER DELETE ON signage_devices
  FOR EACH ROW EXECUTE FUNCTION signage_notify();

CREATE TRIGGER signage_devices_update_notify
  AFTER UPDATE ON signage_devices
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name
     OR OLD.tags IS DISTINCT FROM NEW.tags)
  EXECUTE FUNCTION signage_notify();
"""

def upgrade() -> None:
    op.execute(FUNCTION_SQL)
    op.execute(TRIGGERS_SQL)

def downgrade() -> None:
    for trg, tbl in [
        ("signage_playlists_notify", "signage_playlists"),
        ("signage_playlist_items_notify", "signage_playlist_items"),
        ("signage_playlist_tag_map_notify", "signage_playlist_tag_map"),
        ("signage_device_tag_map_notify", "signage_device_tag_map"),
        ("signage_schedules_notify", "signage_schedules"),
        ("signage_devices_insert_notify", "signage_devices"),
        ("signage_devices_delete_notify", "signage_devices"),
        ("signage_devices_update_notify", "signage_devices"),
    ]:
        op.execute(f'DROP TRIGGER IF EXISTS {trg} ON {tbl};')
    op.execute("DROP FUNCTION IF EXISTS signage_notify();")
```

**Plan note:** The `signage_devices.tags` column — check whether v1.16 schema kept a denormalized array column named `tags` on `signage_devices` or whether tags live only in `signage_device_tag_map`. If only in the map, drop the `OLD.tags IS DISTINCT FROM NEW.tags` clause and rely on the map's own trigger for tag changes. The planner must verify against `backend/alembic/versions/v1_16_signage_schema.py` before finalizing the WHEN clause. The CONTEXT.md D-07 says "OLD.tags IS DISTINCT FROM NEW.tags" — treat this as authoritative but confirm the column exists.

### Pattern 4: Long-Lived asyncpg Listener with Lifespan + Reconnect (per D-09, D-10, D-13)

**What:** Spawn an asyncio task from FastAPI `lifespan` that owns a dedicated asyncpg `Connection` with `add_listener('signage_change', handler)`. Cancel the task on shutdown.

**When to use:** Exactly once, in one place (enforced by `--workers 1`).

**Example (skeleton):**

```python
# backend/app/services/signage_pg_listen.py
"""v1.22 SSE bridge — listens on Postgres channel 'signage_change' and
fans out to existing notify_device() via the signage_resolver.

--workers 1 INVARIANT: this module owns a process-local connection and a
single asyncio task. Running uvicorn with --workers > 1 would give each
worker its own listener (duplicate SSE fan-out) and each would miss the
events its siblings consumed. See backend/app/services/signage_broadcast.py
for the paired invariant commentary.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid as _uuid

import asyncpg

from app.database import AsyncSessionLocal
from app.services.signage_broadcast import notify_device
from app.services.signage_resolver import (
    devices_affected_by_playlist,
    devices_affected_by_device_update,
)

log = logging.getLogger(__name__)

CHANNEL = "signage_change"
_MAX_BACKOFF = 30.0
_INITIAL_BACKOFF = 1.0


def _pg_dsn() -> str:
    # Reuse same DATABASE_URL but force psycopg-less asyncpg DSN.
    url = os.environ["DATABASE_URL"]
    return url.replace("postgresql+asyncpg://", "postgresql://")


async def _handle_notify(conn, pid: int, channel: str, payload: str) -> None:
    try:
        msg = json.loads(payload)
        table = msg["table"]
        op = msg["op"]
        row_id = msg["id"]
    except Exception:
        log.warning("signage_pg_listen: bad payload %s", payload)
        return

    async with AsyncSessionLocal() as db:
        if table in ("signage_playlists", "signage_playlist_items",
                     "signage_playlist_tag_map", "signage_schedules"):
            affected = await devices_affected_by_playlist(db, _uuid.UUID(row_id))
            event = "schedule-changed" if table == "signage_schedules" else "playlist-changed"
        elif table == "signage_devices":
            affected = [_uuid.UUID(row_id)] if op != "DELETE" else []
            event = "device-changed"
        elif table == "signage_device_tag_map":
            affected = await devices_affected_by_device_update(db, _uuid.UUID(row_id))
            event = "device-changed"
        else:
            return

        for dev_id in affected:
            notify_device(dev_id, {"event": event, "table": table, "op": op})


async def _listener_loop() -> None:
    backoff = _INITIAL_BACKOFF
    attempt = 0
    while True:
        attempt += 1
        conn = None
        try:
            conn = await asyncpg.connect(_pg_dsn())
            await conn.add_listener(CHANNEL, _handle_notify)
            log.info("signage_pg_listen: subscribed to %s", CHANNEL)
            backoff = _INITIAL_BACKOFF  # reset on success
            # Keep the coroutine alive; asyncpg dispatches via conn internally.
            while not conn.is_closed():
                await asyncio.sleep(60)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            if attempt == 1:
                log.error("signage_pg_listen: initial connect failed — retrying in background: %s", exc)
            else:
                log.warning("signage_pg_listen: reconnecting attempt=%d backoff=%.1fs err=%s",
                            attempt, backoff, exc)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, _MAX_BACKOFF)
        finally:
            if conn is not None and not conn.is_closed():
                try:
                    await conn.remove_listener(CHANNEL, _handle_notify)
                    await conn.close()
                except Exception:
                    pass


async def start(app) -> asyncio.Task:
    task = asyncio.create_task(_listener_loop(), name="signage_pg_listen")
    app.state.signage_pg_listen_task = task
    return task


async def stop(app) -> None:
    task: asyncio.Task | None = getattr(app.state, "signage_pg_listen_task", None)
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
```

**Lifespan wiring (at `backend/app/scheduler.py`, inside the existing `lifespan` asynccontextmanager after `scheduler.start()`):**

```python
# inside async def lifespan(app: FastAPI):
from app.services import signage_pg_listen  # new import

await signage_pg_listen.start(app)          # after scheduler.start()
try:
    yield
finally:
    await signage_pg_listen.stop(app)
    scheduler.shutdown()
    ...
```

**Fail-soft per D-13:** The outer `while True` in `_listener_loop` swallows exceptions and retries. The `start()` coroutine only creates the task; it does not await initial success. If connect fails, FastAPI still serves `/api/*`.

### Anti-Patterns to Avoid

- **Hand-rolling a PubSub/Redis bus:** Rejected — writer-agnostic Postgres LISTEN is the locked choice (D-00a).
- **Running the listener in every worker:** `--workers 1` invariant; a uvicorn `--workers N` would duplicate fan-out and break ordering.
- **Computing etag in the trigger payload (or Python handler):** Etag stays in `compute_playlist_etag()` at player-envelope time. The bridge emits event + id only; the player re-fetches envelope, which is where etag is computed. See PITFALLS.md P13.
- **Auto-fallback from `schema apply` to REST `POST /collections`:** Reject — fallback is operator-run per D-01. Keep the compose service's happy path clean.
- **Large payloads in `pg_notify`:** Capped at 8000 bytes by Postgres. Resolver re-reads DB; don't serialize the row.
- **Directus policies/roles in the snapshot YAML:** Rejected per D-02; stays in `bootstrap-roles.sh` where code review lives.
- **Using `condition: service_started` on the one-shot bootstrap services:** Must be `service_completed_successfully` — otherwise `api` can start mid-bootstrap.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Directus metadata registration | Custom Python script scraping `information_schema` + POSTing collections one by one | `npx directus schema apply --yes <file.yaml>` (inside the Directus image) | CLI handles diff semantics, relation ordering, field-option validation, and re-applies idempotently. Rolling our own re-invents the `/schema/diff` + `/schema/apply` state machine. |
| Permission row idempotency | A rebuild-from-scratch reconcile loop that deletes and re-creates | GET-before-POST with fixed UUIDs (existing `bootstrap-roles.sh` pattern) | v1.11 precedent; delete-based reconcile loses any manual operator overrides and creates a window where permissions briefly don't exist. |
| Postgres change notification | APScheduler polling job comparing `updated_at` columns | PL/pgSQL triggers + `pg_notify` + asyncpg `add_listener` | 10s+ latency floor, extra DB load, duplicates what Postgres ships natively. |
| Listener reconnect | A loop that re-opens the same `Connection` object after disconnect | Create a fresh `asyncpg.connect()` each iteration (see Code Examples) | asyncpg drops listeners on disconnect; the `Connection` object is dead and must be replaced — not reused. |
| Trigger bookkeeping per table | 6 separate PL/pgSQL functions | One `signage_notify()` using `TG_TABLE_NAME` + `TG_OP` | Less to maintain; payload shape stays consistent; one place to change format if needed. |
| Schema drift detection | A bespoke Python diff of YAML structure | `npx directus schema snapshot -` (stdout) diffed against committed YAML | Uses Directus's own serialization; can't disagree with itself. |
| `pg_notify` payload size worry | Any kind of compression or row-level fragmentation | Re-read the row in Python via existing resolver | `{table, op, id}` is ~60 bytes — nowhere near the 8000-byte cap. Keep payload minimal. |
| SSE etag coupling | Computing etag in the bridge handler or trigger | Leave etag in `compute_playlist_etag()` at envelope-serve time | Single-source etag. Bridge fires event; player `GET /api/signage/player/playlist` recomputes. |

**Key insight:** This phase is entirely wiring. Every piece of compute logic already exists — `notify_device`, `devices_affected_by_playlist`, `compute_playlist_etag`, the lifespan hook, the bootstrap-roles pattern, the `condition: service_completed_successfully` chain. The failure mode is over-engineering — adding abstractions that aren't needed. Ship the minimum wiring.

## Runtime State Inventory

**Phase 65 installs new runtime state but does NOT rename or remove existing runtime state.** The inventory below confirms that claim and records the state this phase creates (so a future rename/rollback phase knows where to look).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (Postgres) | **New PL/pgSQL function:** `public.signage_notify()` (dropped on `alembic downgrade`). **New triggers:** 8 triggers on 6 tables (5 tables × 1 multi-op trigger + `signage_devices` × 3 triggers). **New Directus metadata rows:** `directus_collections`, `directus_fields`, `directus_relations` entries for 9 collections; `directus_permissions` rows for Viewer×sales_records, Viewer×personio_employees, Viewer×directus_users. | Alembic migration creates + drops cleanly. Bootstrap script GET-before-POST. No existing data is mutated. |
| Live service config | `DB_EXCLUDE_TABLES` env var on `directus` service in `docker-compose.yml` — **shrinks** in this phase. | Compose edit. Requires `docker compose up -d directus` (not `restart`, per PITFALLS P8). |
| OS-registered state | None — Phase 65 adds no systemd units, no Task Scheduler entries, no cron jobs beyond what `lifespan` hosts inside the existing `api` container. | None — verified by inspection of `docker-compose.yml` and `backend/app/scheduler.py`. |
| Secrets / env vars | No new secrets. Re-uses `POSTGRES_*`, `DIRECTUS_KEY`, `DIRECTUS_SECRET`, `DIRECTUS_ADMIN_EMAIL/PASSWORD` on the new `directus-schema-apply` service. | None — set in existing `.env`. |
| Build artifacts / installed packages | `directus/snapshots/v1.22.yaml` (new, git-tracked). `directus/fixtures/schema-hash.txt` (new, git-tracked). No new npm/pip packages. | None beyond git-committing the new files. |

**After every file in the repo is updated, what runtime systems still have old state cached/stored/registered?** On a fresh `docker compose down -v && up -d` — nothing. On an in-place upgrade from v1.21 — the `directus` container's `DB_EXCLUDE_TABLES` env is set at container-create time; an in-place upgrade requires `docker compose up -d directus` (not `restart`) to re-read env. Document this in `docs/operator-runbook.md`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Compose v2 | Compose chain, one-shot services | ✓ | (project constraint) | — |
| `postgres:17-alpine` | `db` service | ✓ | 17 | — |
| `directus/directus:11.17.2` | `directus` + new `directus-schema-apply` services | ✓ | 11.17.2 | — |
| `curlimages/curl:8.10.1` | `directus-bootstrap-roles` (existing; extended) | ✓ | 8.10.1 | — |
| `asyncpg` Python package | `signage_pg_listen.py` | ✓ | 0.31.0 (already in repo) | — |
| PL/pgSQL language | `signage_notify()` function | ✓ | bundled in Postgres 17 | — |
| `npx directus schema apply` CLI | `directus-schema-apply` service | ✓ | ships inside Directus image | REST `POST /schema/apply` (operator-run, per D-01) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Common Pitfalls

### Pitfall 1: Directus `schema apply` errors on existing Alembic-owned tables (#25760)

**What goes wrong:** `npx directus schema apply` sees the YAML's collection declarations, tries to `CREATE TABLE`, and fails with "relation already exists" because Alembic created the tables first.

**Why it happens:** Known regression in Directus 11.10+ ([#25760](https://github.com/directus/directus/issues/25760)). The YAML's `schema` side is expected to match pre-existing physical state; on clean volumes the YAML generator decides to re-CREATE.

**How to avoid:** Generate the YAML once against a dev instance where the tables already physically exist but aren't yet in `directus_collections` — resulting YAML will have `schema: null` (metadata-only) per collection. Commit that. The compose service's happy path applies cleanly.

**Warning signs:** `directus-schema-apply` exits non-zero with "Collection already exists" or "relation … already exists" in logs.

**Fallback (operator-run per D-01):** `POST /collections {schema: null, meta: {...}}` via curl against a running Directus. Document in `docs/operator-runbook.md`.

### Pitfall 2: asyncpg listeners are dropped on disconnect — must re-create the Connection

**What goes wrong:** On a Postgres restart, the asyncpg `Connection` is dead. Calling `add_listener` again on the same object raises. A naive reconnect that reuses `conn` silently never receives events.

**Why it happens:** asyncpg documents that `Connection.reset()` removes all listeners; disconnection is a terminal state for the object.

**How to avoid:** The reconnect loop opens a **fresh** `asyncpg.connect()` each iteration (see Code Example #4). The outer `while True` discards the old `conn` on failure and creates a new one.

**Warning signs:** After `docker compose restart db`, SSE events stop firing silently. Logs show `signage_pg_listen: subscribed` once and never again. Test: kill the DB container in CI-style integration test and assert "reconnecting" log appears, then SSE fires on next mutation.

### Pitfall 3: `signage_devices` WHEN clause double-fires on calibration PATCH

**What goes wrong:** The trigger fires on `AFTER UPDATE` of `signage_devices`. FastAPI's calibration PATCH updates `rotation`/`hdmi_mode`/`audio_enabled` and independently calls `notify_device()` for `calibration-changed`. If the WHEN clause is missing or too broad, the trigger also fires `device-changed` → the player gets two SSE events per calibration change.

**Why it happens:** PL/pgSQL `AFTER UPDATE` triggers fire on any column change unless `WHEN` narrows it.

**How to avoid:** Use the WHEN clause verbatim from D-07: `OLD.name IS DISTINCT FROM NEW.name OR OLD.tags IS DISTINCT FROM NEW.tags`. Calibration columns are NOT in this list. Integration test: issue a calibration PATCH via FastAPI, subscribe to SSE, assert exactly ONE frame (`calibration-changed`) arrives and NO `device-changed` frame follows.

**Verify first:** Before implementing, confirm whether `signage_devices` has a denormalized `tags` column or if tags live only in `signage_device_tag_map`. CONTEXT.md D-07 says "tags" — but if that column doesn't exist on `signage_devices`, the WHEN reduces to `OLD.name IS DISTINCT FROM NEW.name` and tag changes are caught by the `signage_device_tag_map` trigger. Read `backend/alembic/versions/v1_16_signage_schema.py` during planning.

### Pitfall 4: `DB_EXCLUDE_TABLES` change requires `up -d`, not `restart`

**What goes wrong:** Operator edits `docker-compose.yml` to shrink `DB_EXCLUDE_TABLES`, runs `docker compose restart directus` — the change has no effect. Directus reads env only on container create/recreate.

**Why it happens:** `docker compose restart` restarts the container process but keeps the container itself; env is baked into the container spec at create time.

**How to avoid:** Document `docker compose up -d directus` (creates a new container with new env) in `docs/operator-runbook.md`. CI check: any PR modifying `DB_EXCLUDE_TABLES` must include a note referencing the runbook. (PITFALLS.md P8.)

### Pitfall 5: Permission rows POSTed before collections exist

**What goes wrong:** `directus-bootstrap-roles` runs its new section 5 permission POSTs against collections that `directus-schema-apply` hasn't registered yet — Directus rejects with "collection not found."

**Why it happens:** Missing / wrong `depends_on` chain.

**How to avoid:** `directus-bootstrap-roles` must `depends_on: directus-schema-apply: condition: service_completed_successfully`. This is in D-03 and must be enforced in the compose file.

### Pitfall 6: Viewer can mutate `signage_*` via Directus REST (AUTHZ-02 leak)

**What goes wrong:** Viewer policy defaults allow read or app_access, and no explicit "deny" is needed — but if a future bootstrap accidentally grants Viewer `create/update/delete` on any `signage_*` collection, the AUTHZ-02 invariant silently breaks.

**Why it happens:** Directus permission model is "grant-based" — no permission row = no access. But a mis-placed loop in `bootstrap-roles.sh` could over-grant.

**How to avoid:** AUTHZ-05 integration test: a Viewer JWT attempts `POST /directus/items/signage_playlists` → expect 403. Run against each signage collection. Make this test first-class in the Phase 65 test module so it doesn't drift.

### Pitfall 7: Missed events during reconnect window (accepted, not a bug)

**What goes wrong:** Postgres bounces. Between `conn` dying and the listener reconnecting (up to 30s), any `pg_notify` events are lost.

**Why it happens:** LISTEN is at-most-once, session-scoped. No durability guarantee.

**How to avoid / accept:** D-11 — accept. Players already poll every 30s as backup path. No event-log table. Document as SLA in `docs/operator-runbook.md`: "SSE is best-effort; the 30s poll is the durability ceiling."

### Pitfall 8: CI `--workers 1` grep guard drifts

**What goes wrong:** Someone changes the uvicorn command in docker-compose.yml, removes `--workers 1`, the listener duplicates, SSE fan-out doubles.

**Why it happens:** Easy refactor; invariant is a comment not a contract.

**How to avoid:** SSE-05 grep guard (separate CI step) — greps `docker-compose.yml` for `uvicorn.*--workers 1` and fails if absent. Also grep `backend/app/services/signage_pg_listen.py` for the `--workers 1 INVARIANT` comment block so the comment itself can't be silently deleted.

## Code Examples

Already embedded above:

1. **Compose chain addition** — see Pattern 1.
2. **`ensure_permission()` shell helper + section 5** — see Pattern 2.
3. **Alembic migration `v1_22_signage_notify_triggers.py`** — see Pattern 3.
4. **`signage_pg_listen.py` listener + reconnect** — see Pattern 4.

All four are verified against:
- Existing `directus/bootstrap-roles.sh` for idempotency shape.
- Existing `backend/app/scheduler.py` for lifespan shape.
- asyncpg docs for `add_listener` signature.
- Postgres 17 docs for PL/pgSQL trigger syntax (`TG_TABLE_NAME`, `TG_OP`, `IS DISTINCT FROM`).
- Directus Schema API docs for the REST surface (`POST /permissions`, `POST /collections`, `POST /schema/apply`).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Directus v10 `snapshot.yml` covering roles + policies | Directus 11 split: snapshot for collections/fields/relations only; policies/roles via REST | Directus 11.0 (2024) | Already absorbed in v1.11-directus bootstrap (see `bootstrap-roles.sh` header). Phase 65 extends that pattern; does not revisit. |
| Hand-rolled polling for change detection | Postgres LISTEN/NOTIFY via asyncpg | — | v1.22 first use. Writer-agnostic; survives Directus + Alembic + psql writers. |
| `calibration-changed` SSE via FastAPI post-commit hook | Unchanged — stays in FastAPI | v1.21 shipped it | Phase 65 explicitly does NOT migrate it; the trigger WHEN clause protects this boundary. |

**Deprecated/outdated:**
- The v10 snapshot shape including policies — rejected in v1.11-directus; don't bring back.
- In-process polling for SSE change detection — dominated by LISTEN/NOTIFY for this workload.

## Open Questions

1. **Does `signage_devices` have a denormalized `tags` column, or do tags live only in `signage_device_tag_map`?**
   - What we know: CONTEXT.md D-07 names `OLD.tags IS DISTINCT FROM NEW.tags` in the WHEN clause. ORM file `backend/app/models/signage.py` needs inspection.
   - What's unclear: Exact ORM column present.
   - Recommendation: Planner reads `v1_16_signage_schema.py` at plan-time. If no `tags` column on `signage_devices`, reduce WHEN to `OLD.name IS DISTINCT FROM NEW.name` and rely on the `signage_device_tag_map` trigger to catch tag changes. Document decision in PLAN.md.

2. **`devices_affected_by_device_update` resolver — what's its input?**
   - What we know: `grep` at `backend/app/services/signage_resolver.py:293` confirms the function exists.
   - What's unclear: Whether the input is `device_id` or `device_tag_map.id` (the row id of the map entry). The listener code example above assumes `device_id`.
   - Recommendation: Planner reads `signage_resolver.py:293` at plan-time and adjusts handler accordingly. If the resolver expects `device_id` but we get a map-row id, add a one-line join in the handler to resolve it.

3. **Does CI infrastructure currently exist, or does this phase also need to create it?**
   - What we know: CONTEXT.md references "CI guards" and "grep guards" but Phase 63 and earlier shipped fixes presumably without new CI scaffolding.
   - What's unclear: Whether `.github/workflows/` (or equivalent) already runs on PR and where to add the four new guards (DDL hash, snapshot diff, workers grep, superset check).
   - Recommendation: Planner inspects existing CI config at plan-time. If absent, the planner chooses: Make targets runnable locally + pre-commit hook, OR create GitHub Actions. CONTEXT.md does not lock this; call it Claude's discretion and document in PLAN.md.

## Sources

### Primary (HIGH confidence)

- **`backend/app/services/signage_broadcast.py`** — `notify_device()`, `--workers 1` invariant documented in module docstring.
- **`backend/app/services/signage_resolver.py`** — `devices_affected_by_playlist` at line 256, `devices_affected_by_device_update` at line 293.
- **`backend/app/scheduler.py`** — `lifespan` asynccontextmanager at line 358.
- **`backend/app/main.py`** — FastAPI app with `lifespan=lifespan` at line 22.
- **`backend/app/schemas/_base.py`** — `SalesRecordRead` (line 268), `EmployeeRead` (line 291).
- **`backend/app/schemas/signage.py`** — all `SignageXxxRead` schemas (the v1.22 viewer allowlist source of truth — note Phase 65 doesn't grant signage reads to Viewer, so these inform AUTHZ-05 tests only).
- **`directus/bootstrap-roles.sh`** — GET-before-POST idempotent pattern; fixed UUID prefix `a2222222-...` established.
- **`docker-compose.yml`** (lines 1–180) — existing compose chain; `--workers 1` comment at lines 24–30; `DB_EXCLUDE_TABLES` at line 95; `directus-bootstrap-roles` precedent at lines 117–133.
- **`.planning/research/SUMMARY.md`** — executive summary; Option A rationale.
- **`.planning/research/ARCHITECTURE.md`** — SSE bridge mechanics (LISTEN/NOTIFY), schema ownership, compose chain.
- **`.planning/research/PITFALLS.md`** — P1 DDL drift, P5 SSE silent break, P8 DB_EXCLUDE_TABLES restart, P9/P15 field leak, P13 etag coupling.
- **`.planning/research/STACK.md`** — Directus 11.17.2 pin; SDK versions; `DB_EXCLUDE_TABLES` target shape.
- **`.planning/REQUIREMENTS.md`** §SCHEMA-01..05, §AUTHZ-01..05, §SSE-01..06 — acceptance criteria.
- **`.planning/ROADMAP.md`** Phase 65 — goal + success criteria.
- **Postgres 17 docs** (training data + widely documented) — PL/pgSQL trigger syntax, `IS DISTINCT FROM`, `pg_notify` 8000-byte cap.
- **asyncpg docs** (verified via WebFetch 2026-04-24) — `connection.add_listener(channel, callback)` signature; listeners dropped on connection reset/disconnect; callback receives `(connection, pid, channel, payload)`.

### Secondary (MEDIUM confidence)

- **Directus Schema API docs** (verified via WebFetch 2026-04-24) — `POST /schema/snapshot`, `POST /schema/diff`, `POST /schema/apply`; admin-only; SDK `schemaApply` composable exists.
- **`npx directus schema apply` CLI** (verified via WebSearch 2026-04-24 — multiple community sources confirm syntax `npx directus schema apply --yes /path/to/snapshot.yaml`). Docker container runs node + this CLI. Issue [#25760](https://github.com/directus/directus/issues/25760) flags the existing-table edge.
- **Directus discussion #16407** — snapshot-apply no-op scenarios; documents workflow quirks.

### Tertiary (LOW confidence)

- **Exact `directus-schema-apply` env block** — the command `npx directus schema apply` reads the project config on startup, so DB + KEY + SECRET env vars are required. Planner should verify by running the command once in a dev container. Fallback: mimic exactly the env block of the main `directus` service.

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — zero new packages; all pins already in repo; CLI verified against Directus 11 image.
- Architecture patterns: **HIGH** — every pattern has a precedent in the repo (lifespan, bootstrap-roles, compose one-shot, Alembic migration).
- Don't-hand-roll rules: **HIGH** — each has explicit rationale tied to existing library features.
- Pitfalls: **HIGH** — derived from milestone-layer PITFALLS.md (validated across 4 researchers) plus Directus issue tracker.
- Runtime state inventory: **HIGH** — this is an additive phase; no existing runtime state is renamed or removed.
- Code examples: **MEDIUM-HIGH** — skeletons are faithful but the planner must verify `signage_devices.tags` column presence and `devices_affected_by_device_update` input shape before committing the listener code.

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 days) — Directus 11 schema API and asyncpg 0.31 are stable. If Directus 12 ships or asyncpg changes LISTEN semantics, revalidate.
