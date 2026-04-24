# Phase 65: Foundation — Schema + AuthZ + SSE Bridge - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 65-foundation-schema-authz-sse-bridge
**Areas discussed:** Snapshot apply + compose wiring, Trigger SQL + payload shape, Listener lifecycle & reconnect, CI drift guards + SSE-04 integration test

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot apply + compose wiring | Directus #25760 handling, service ordering | ✓ |
| Trigger SQL + payload shape | Alembic migration organization, pg_notify JSON shape, WHEN predicates | ✓ |
| Listener lifecycle & reconnect | asyncpg reconnect strategy, gap handling, visibility | ✓ |
| CI drift guards + SSE-04 test | SCHEMA-03 implementation, integration test harness | ✓ |
| Viewer allowlist precision | Exact field sets per collection | (not selected — left to planner) |
| Rollback/failure posture | Partial apply recovery | (not selected — left to planner) |

**Notes:** User picked the top four; Viewer allowlist precision deferred to planner under the "mirror Pydantic `*Read`" principle.

---

## Snapshot apply + compose wiring

### Apply mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Pure `schema apply` + documented fallback | `npx directus schema apply`; REST fallback for #25760 operator-run | ✓ |
| REST `POST /collections {schema:null}` as primary | Bootstrap script registers metadata against existing tables | |
| Hybrid per-collection | schema apply for existing Directus-native; REST for new | |

**User's choice:** Pure `schema apply` + documented fallback.

### Compose ordering

| Option | Description | Selected |
|--------|-------------|----------|
| postgres → alembic-migrate → directus → schema-apply → bootstrap-roles → backend | Strict chain; backend last | ✓ |
| Merge schema-apply + bootstrap-roles into one service | Fewer services | |
| Backend parallel with schema-apply | Faster boot; risk of premature JWT validation | |

**User's choice:** Strict chain; backend last.

### YAML scope

| Option | Description | Selected |
|--------|-------------|----------|
| Metadata only: collections + fields + relations | Matches v1.11 precedent | ✓ |
| Include system settings | project_name, CORS, etc. | |
| Include permissions, drop bootstrap-roles.sh | One SSOT but UUID drift risk | |

**User's choice:** Metadata only.

---

## Trigger SQL + payload shape

### Trigger organization

| Option | Description | Selected |
|--------|-------------|----------|
| Single migration, shared trigger function | One `signage_notify()`, 6 CREATE TRIGGER | ✓ |
| Single migration, per-table functions | More boilerplate, self-contained WHEN clauses | |
| Multiple migrations (one per table) | Better incremental rollback, more files | |

**User's choice:** Single migration, shared function.

### Payload shape

| Option | Description | Selected |
|--------|-------------|----------|
| `{table, op, id}` only | Minimal; listener re-reads DB | ✓ |
| `{table, op, id, row_hash}` | Skip no-op fan-outs | |
| Include denormalized affected_device_ids | Resolver in PL/pgSQL | |

**User's choice:** Minimal `{table, op, id}`.

### `signage_devices` WHEN clause

| Option | Description | Selected |
|--------|-------------|----------|
| `OLD.name IS DISTINCT FROM NEW.name OR OLD.tags IS DISTINCT FROM NEW.tags` | Matches SSE-01 verbatim | ✓ |
| Column-allowlist | Future-proof; requires migration per column add | |
| Column-denylist | New calibration column silently double-fires | |

**User's choice:** `OLD.name IS DISTINCT FROM NEW.name OR OLD.tags IS DISTINCT FROM NEW.tags`.

### Ops covered for signage_devices

| Option | Description | Selected |
|--------|-------------|----------|
| INSERT + UPDATE (WHEN) + DELETE | Matches SSE-01 | ✓ |
| UPDATE-only with WHEN | Inconsistent with other tables | |

**User's choice:** INSERT + UPDATE + DELETE.

---

## Listener lifecycle & reconnect

### Reconnect strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Exponential backoff 1s → 30s cap, infinite | Standard worker-pool pattern | ✓ |
| Fixed 5s retry, infinite | Simpler, noisier | |
| Exponential + jitter (±20%) | Overkill for `--workers 1` | |

**User's choice:** Exponential 1s → 30s cap, no jitter.

### Gap handling

| Option | Description | Selected |
|--------|-------------|----------|
| Accept gap — rely on 30s player poll fallback | Simplest; no event log | ✓ |
| On reconnect, synthetic `refresh-all` broadcast | Closes gap faster, chatty | |
| Event log table + resume cursor | Robust, new table + retention | |

**User's choice:** Accept gap; 30s poll is backup.

### Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Warn log per reconnect attempt | Matches SSE-06 | ✓ |
| Warn log + Prometheus counter | Requires new dependency | |
| Warn log + `app_settings` last-reconnect timestamp | DB write on every reconnect | |

**User's choice:** Warn log only.

### Startup posture

| Option | Description | Selected |
|--------|-------------|----------|
| Backend starts anyway, listener retries in background | Fail-soft | ✓ |
| Fail-fast: refuse to start without listener | Tighter correctness, weaker uptime | |

**User's choice:** Fail-soft.

---

## CI drift guards + SSE-04 integration test

### Drift detection mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Two guards: `information_schema` hash + schema snapshot diff | Independent DDL and metadata coverage | ✓ |
| Snapshot diff only | Misses pure DDL drift | |
| Hash only | Misses Directus metadata edits that don't touch DDL | |

**User's choice:** Two guards.

### Fixture location

| Option | Description | Selected |
|--------|-------------|----------|
| `directus/fixtures/schema-hash.txt` + Makefile target | Committed fixture | ✓ |
| Auto-derive from migrations each CI run | No fixture; slower CI | |

**User's choice:** Committed fixture + Makefile.

### SSE-04 test harness

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-token REST call against Directus | Matches UI path exactly | ✓ |
| Direct SQL INSERT bypassing Directus | Tests bridge, not Directus path | |
| Both: REST + SQL | 2x test count | |

**User's choice:** REST call harness.

### Latency assertion

| Option | Description | Selected |
|--------|-------------|----------|
| Hard <500ms per event in CI | Matches ROADMAP success #3 verbatim | ✓ |
| <2000ms in CI, <500ms manual | Less flaky | |
| No latency assertion | Abandons 500ms SLO | |

**User's choice:** Hard <500ms in CI.

---

## Claude's Discretion

- Exact Viewer field allowlists per collection (planner derives from Pydantic `*Read`).
- Rollback recipe for partial `directus-schema-apply` failure (operator-runbook doc).
- Exact table list in DDL hash fixture.
- Integration test harness plumbing (reuse pytest fixtures vs new compose fixture).

## Deferred Ideas

- Prometheus metrics for listener reconnects.
- Event-log table + cursor replay for zero-loss SSE.
- Capturing `directus_settings` in snapshot YAML.
- Merging `schema-apply` + `bootstrap-roles` into one container.
- Rollback E2E tests (Phase 71 territory).
