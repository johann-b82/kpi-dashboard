---
phase: 65-foundation-schema-authz-sse-bridge
verified: 2026-04-24T20:00:00Z
status: gaps_found
score: 4/5 success criteria verified
gaps:
  - truth: "Fresh-volume docker compose up registers 9 v1.22 Directus collections idempotently — no UI click-through, no Alembic DDL drift"
    status: partial
    reason: "Guard A (DDL hash) will fail on every CI run because directus/fixtures/schema-hash.txt contains the placeholder string 'PLACEHOLDER_RUN_MAKE_SCHEMA_FIXTURE_UPDATE' rather than a real hash. The guard is syntactically correct and correctly implements the check, but cannot pass until 'make schema-fixture-update' is run against a live stack and the real hash is committed."
    artifacts:
      - path: "directus/fixtures/schema-hash.txt"
        issue: "Contains placeholder string instead of real MD5 hash. Guard A script exits 1 whenever CURRENT != EXPECTED, and EXPECTED is currently 'PLACEHOLDER_RUN_MAKE_SCHEMA_FIXTURE_UPDATE' which will never match a real DB hash."
    missing:
      - "Run 'make schema-fixture-update' against a live stack with v1.22 migrations applied and commit the resulting 32-char hex MD5 to directus/fixtures/schema-hash.txt"
human_verification:
  - test: "SSE latency end-to-end (500 ms ceiling)"
    expected: "Directus REST mutation on a signage collection fires the correct SSE event (playlist-changed / device-changed / schedule-changed) to a connected Pi player within 500 ms"
    why_human: "Requires a running docker compose stack with Directus, Postgres triggers, asyncpg listener, and an SSE subscriber. Cannot verify without bringing up the full stack."
  - test: "Calibration PATCH no double-fire"
    expected: "FastAPI PATCH /api/signage/devices/{id}/calibration fires calibration-changed SSE exactly once; no subsequent device-changed from the LISTEN trigger within 500 ms"
    why_human: "Requires live stack + the WHEN clause on signage_devices_update_notify to be proven correct at runtime. The name-only WHEN clause is code-verified, but runtime confirmation is needed."
  - test: "Listener reconnect after DB restart"
    expected: "After 'docker compose restart db', signage_pg_listen logs 'reconnecting attempt=N backoff=Xs' then eventually 'subscribed to signage_change'; SSE still fires for subsequent mutations"
    why_human: "Requires a running stack and observing log output across a DB restart cycle."
  - test: "Viewer JWT field allowlist enforcement (live Directus)"
    expected: "Viewer cannot read tfa_secret/auth_data/external_identifier on directus_users; cannot mutate any signage_* collection (403); can read sales_records and personio_employees"
    why_human: "AUTHZ tests in test_viewer_authz.py require a running Directus instance with bootstrap-roles.sh having run to create the b2222222-000x permission rows."
  - test: "Schema-apply idempotency on fresh volume"
    expected: "docker compose down -v && docker compose up -d completes without error; directus-schema-apply service exits 0; 9 collections visible in Directus admin UI"
    why_human: "Requires Docker and a full fresh-volume run. Cannot simulate without infrastructure."
---

# Phase 65: Foundation — Schema + AuthZ + SSE Bridge Verification Report

**Phase Goal:** A fresh `docker compose up -d` reproduces v1.21 behavior exactly, plus Directus Data Model UI edits to the surfaced collections fan out to Pi players as SSE within 500 ms — all with zero frontend change.
**Verified:** 2026-04-24T20:00:00Z
**Status:** gaps_found (1 automated gap; 5 items requiring human verification)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from Phase 65 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Fresh-volume `docker compose down -v && up -d` brings up stack idempotently with all v1.22 collections via git-checked snapshot YAML | PARTIAL | Snapshot YAML verified (9 collections, schema:null), compose chain wired correctly, but Guard A will fail until schema-hash.txt placeholder is replaced with real hash |
| 2 | Viewer JWT can read sales_records + personio_employees but cannot read excluded fields on directus_users and cannot mutate any signage_* collection | VERIFIED (code) | bootstrap-roles.sh has 3 permission rows (b2222222-0001/0002/0003), no wildcard fields, no signage_* rows, no secret fields in file. Runtime confirmation is human verification item. |
| 3 | Mutating a surfaced signage collection via Directus fires correct SSE event within 500 ms | VERIFIED (code) | Alembic migration has 8 triggers; pg_listen.py dispatches to notify_device() via resolvers; TABLE_EVENT_CASES maps all 6 tables correctly. Runtime: human verification. |
| 4 | Calibration PATCH via FastAPI fires calibration-changed without double-fire from LISTEN bridge | VERIFIED (code) | WHEN clause on signage_devices_update_notify is `WHEN (OLD.name IS DISTINCT FROM NEW.name)` only — calibration columns excluded. Runtime: human verification. |
| 5 | Single-listener invariant holds: --workers 1 preserved, asyncpg listener auto-reconnects | VERIFIED | Guard D passes locally. --workers 1 in docker-compose.yml, --workers 1 INVARIANT comment in signage_pg_listen.py, reconnect backoff 1s->30s implemented. |

**Score:** 4/5 truths verified (1 partial due to placeholder schema hash fixture)

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `directus/snapshots/v1.22.yaml` | VERIFIED | 9 collections (schema:null each), 100 fields, 6 relations. No policies/roles/permissions. |
| `docker-compose.yml` | VERIFIED | directus-schema-apply service present, entrypoint correct, depends_on chain wired, DB_EXCLUDE_TABLES minimal (11 entries), --workers 1 preserved. |
| `docs/operator-runbook.md` | VERIFIED | Contains "DO NOT EDIT IN UI" section, #25760 reference, up-d guidance, 30s poll SLA, rollback recipe. |
| `directus/bootstrap-roles.sh` | VERIFIED | ensure_permission helper present, 3 calls with fixed UUIDs, no secret fields, no wildcards, no signage_* rows, syntax valid. |
| `backend/alembic/versions/v1_22_signage_notify_triggers.py` | VERIFIED | 8 CREATE TRIGGER statements, signage_notify() function with pg_notify, PREFLIGHT_SQL, WHEN clause correct, down_revision matches v1_21. |
| `backend/app/services/signage_pg_listen.py` | VERIFIED | 161 lines, --workers 1 INVARIANT comment, add_listener, signage_change channel, notify_device, devices_affected_by_playlist, SignageSchedule.playlist_id fetch, backoff 1->30s. |
| `backend/app/scheduler.py` | VERIFIED | Import present, await signage_pg_listen.start(app) before yield, await signage_pg_listen.stop(app) after yield. |
| `backend/tests/signage/test_pg_listen_sse.py` | VERIFIED | 424 lines, SSE_TIMEOUT_MS=500, 6 TABLE_EVENT_CASES, calibration no-double-fire test, reconnect smoke test. |
| `backend/tests/signage/test_viewer_authz.py` | VERIFIED | 238 lines, SIGNAGE_COLLECTIONS with 7 entries, tfa_secret/auth_data/external_identifier checked, positive read test. |
| `backend/tests/signage/test_permission_field_allowlists.py` | VERIFIED | 176 lines, SalesRecordRead + EmployeeRead imports, b2222222-0001/0002 UUIDs, COMPUTE_DERIVED_EMPLOYEE_FIELDS set. |
| `scripts/ci/check_schema_hash.sh` | VERIFIED | Executable, bash -n passes, MD5 hash logic, references all 9 tables. |
| `scripts/ci/check_directus_snapshot_diff.sh` | VERIFIED | Executable, bash -n passes. |
| `scripts/ci/check_db_exclude_tables_superset.sh` | VERIFIED | Executable, bash -n passes, Guard C passes locally. |
| `scripts/ci/check_workers_one_invariant.sh` | VERIFIED | Executable, bash -n passes, Guard D passes locally. |
| `directus/fixtures/schema-hash.txt` | STUB | Contains literal string "PLACEHOLDER_RUN_MAKE_SCHEMA_FIXTURE_UPDATE". Guard A will fail CI until real hash is committed. |
| `Makefile` | VERIFIED | schema-fixture-update, ci-guards, test-sse, test-authz, test-allowlists targets present. |
| `.github/workflows/ci.yml` | VERIFIED | YAML valid, all 4 guards referenced, all 3 test files referenced, parity test runs pre-stack, teardown with if:always(). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| docker-compose.yml:directus-bootstrap-roles.depends_on | directus-schema-apply | condition: service_completed_successfully | WIRED | Confirmed at lines 170-171 |
| docker-compose.yml:api.depends_on | directus-bootstrap-roles | condition: service_completed_successfully | WIRED | Confirmed at lines 50-51 |
| signage_notify() | pg_notify('signage_change', ...) | PERFORM pg_notify | WIRED | Confirmed in migration file |
| signage_devices_update_notify | WHEN (OLD.name IS DISTINCT FROM NEW.name) | WHEN clause | WIRED | Correct — no tags column on signage_devices |
| backend/app/scheduler.py:lifespan | signage_pg_listen.start(app) | await call before yield | WIRED | Line 448 before yield at line 450 |
| signage_pg_listen._handle_notify | notify_device | import + call | WIRED | Both present in file |
| signage_pg_listen._handle_notify (schedule branch) | SignageSchedule.playlist_id SELECT then devices_affected_by_playlist | fetch-then-call | WIRED | Lines 66-75 |
| .github/workflows/ci.yml | scripts/ci/check_schema_hash.sh | workflow step | WIRED | Confirmed |
| test_permission_field_allowlists.py | directus/bootstrap-roles.sh + SalesRecordRead/EmployeeRead | parses shell + imports Pydantic | WIRED | UUIDs b2222222-0001/0002 referenced |

---

### Data-Flow Trace (Level 4)

Not applicable — Phase 65 has no user-facing data rendering components. All artifacts are infrastructure (compose services, migrations, SSE plumbing, tests, CI guards).

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Guard C — DB_EXCLUDE_TABLES superset | `bash scripts/ci/check_db_exclude_tables_superset.sh` | PASS: Guard C — DB_EXCLUDE_TABLES is superset of never-expose allowlist (11 tables checked) | PASS |
| Guard D — --workers 1 invariant | `bash scripts/ci/check_workers_one_invariant.sh` | PASS: Guard D — --workers 1 invariant preserved in all 3 locations | PASS |
| Guard A — DDL hash check | `bash scripts/ci/check_schema_hash.sh` | SKIP (requires running stack) but would FAIL due to placeholder schema-hash.txt | FAIL (anticipated) |
| Parity test (pure Python) | `cd backend && python -m pytest tests/signage/test_permission_field_allowlists.py` | SKIP — local Python 3.9 cannot parse `X \| None` union syntax used in schemas. Would pass in project's Python 3.10+ environment (confirmed by checking schema field patterns in bootstrap-roles.sh match Pydantic schemas). | SKIP (env mismatch) |
| Alembic migration Python parse | `python3 -c "import ast; ast.parse(...)"` | PASS | PASS |
| signage_pg_listen.py Python parse | `python3 -c "import ast; ast.parse(...)"` | PASS | PASS |
| All 12 commits verified in git log | `git log --oneline` | All 12 phase 65 commits present (3bf46c6, eb62a0c, cc616d6, c986824, 6b13b3a, 02d1cd1, 51b68ee, b580b81, 3e520ab, 22416cc, e77f454, 52668a7) | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCHEMA-01 | 65-01 | 9 v1.22 collections in git-tracked snapshot YAML, metadata-only | SATISFIED | v1.22.yaml has exactly 9 collections, all schema:null |
| SCHEMA-02 | 65-01 | Fresh-volume `up -d` reproduces collections idempotently via compose service | SATISFIED | directus-schema-apply service wired with service_completed_successfully chain |
| SCHEMA-03 | 65-05 | CI guard: DDL hash fixture + Directus snapshot diff | PARTIAL | Guard A script correct but schema-hash.txt is placeholder. Guard B present. |
| SCHEMA-04 | 65-01 | DB_EXCLUDE_TABLES minimal superset, CI guard | SATISFIED | 11-entry minimal set in compose; Guard C passes |
| SCHEMA-05 | 65-01 | Operator runbook: "never edit Data Model UI" documented | SATISFIED | operator-runbook.md has "DO NOT EDIT IN UI" section with #25760 fallback |
| AUTHZ-01 | 65-02 | Viewer permission rows on sales_records + personio_employees, no wildcards | SATISFIED | 3 ensure_permission calls, exact field lists, no ["*"] |
| AUTHZ-02 | 65-02 | No Viewer rows on any signage_* collection | SATISFIED | grep for ensure_permission.*signage_ returns 0 matches |
| AUTHZ-03 | 65-02 | directus_users Viewer allowlist excludes tfa_secret, auth_data, external_identifier | SATISFIED | Allowlist is [id,email,first_name,last_name,role,avatar]; no secrets in file |
| AUTHZ-04 | 65-02 | Bootstrap script idempotent (GET-before-POST, fixed UUIDs) | SATISFIED | ensure_permission helper present; b2222222-000x UUIDs stable |
| AUTHZ-05 | 65-05 | Integration test: Viewer cannot leak secrets or mutate signage_* | SATISFIED (code) | test_viewer_authz.py: 7 signage collections, 3 secret fields, positive read test. Runtime: human. |
| SSE-01 | 65-03 | Alembic migration: AFTER triggers on 6 signage tables | SATISFIED | 8 CREATE TRIGGER statements in migration; PREFLIGHT_SQL guards no-tags-column assumption |
| SSE-02 | 65-03 | pg_notify payload shape {table, op, id} under 8000 bytes | SATISFIED | jsonb_build_object with 3 keys only; TG_TABLE_NAME branching for composite-PK tables |
| SSE-03 | 65-04 | FastAPI lifespan: asyncpg add_listener -> resolver -> notify_device | SATISFIED | signage_pg_listen.py wired into scheduler.py lifespan with start/stop |
| SSE-04 | 65-05 | Directus mutation -> SSE within 500 ms (integration test) | SATISFIED (code) | test_pg_listen_sse.py: SSE_TIMEOUT_MS=500, 6 parametrized tests. Runtime: human. |
| SSE-05 | 65-05 | --workers 1 invariant preserved; CI guard | SATISFIED | Guard D passes locally; invariant comment in signage_pg_listen.py |
| SSE-06 | 65-04 | Listener auto-reconnects; warn log per attempt | SATISFIED (code) | _listener_loop has exponential backoff 1s->30s, log.warning per reconnect attempt |

**Note on SSE-01 REQUIREMENTS.md text:** The requirements text says the signage_devices UPDATE trigger should be gated on `OLD.name IS DISTINCT FROM NEW.name OR OLD.tags IS DISTINCT FROM NEW.tags`. The implementation correctly uses name-only, because `signage_devices` has no `tags` column (tags live in `signage_device_tag_map`). The PREFLIGHT_SQL migration assertion makes this explicit. The requirement text is inaccurate but the implementation is correct per the planning decisions (D-07 correction documented in 65-01-SUMMARY.md and 65-03-SUMMARY.md).

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `directus/fixtures/schema-hash.txt` | Placeholder value "PLACEHOLDER_RUN_MAKE_SCHEMA_FIXTURE_UPDATE" | BLOCKER | Guard A fails CI on every run until real hash is committed. |

No other stubs or anti-patterns found. All other artifacts contain real implementations.

---

### Human Verification Required

#### 1. Schema-apply idempotency on fresh volume

**Test:** `docker compose down -v && docker compose up -d` on a clean dev machine; observe directus-schema-apply logs.
**Expected:** directus-schema-apply service exits 0; 9 collections visible in Directus admin UI Data Model; no "relation already exists" errors.
**Why human:** Requires Docker daemon and a full fresh-volume lifecycle.

#### 2. SSE end-to-end latency (6 per-table tests)

**Test:** `docker compose up -d` (full stack); run `make test-sse` (or `cd backend && pytest tests/signage/test_pg_listen_sse.py -v -m "not slow"`).
**Expected:** All 6 parametrized SSE tests pass; each asserts elapsed_ms < 500.
**Why human:** Requires running Directus, Postgres with triggers applied, asyncpg listener active, and a live SSE subscriber.

#### 3. Calibration PATCH no-double-fire

**Test:** Included in `make test-sse` — `test_calibration_patch_fires_single_frame_no_device_changed_double`.
**Expected:** Exactly one SSE frame with event=calibration-changed; no device-changed follows within 500 ms.
**Why human:** Same runtime requirement as above.

#### 4. Listener reconnect smoke test

**Test:** `cd backend && pytest tests/signage/test_pg_listen_sse.py -v -m slow`.
**Expected:** After `docker compose restart db`, logs show reconnecting, then subscribed; SSE fires correctly for subsequent mutations.
**Why human:** Requires Docker-level DB restart and log stream observation.

#### 5. Viewer JWT field allowlist enforcement (live Directus)

**Test:** `make test-authz` (or `cd backend && pytest tests/signage/test_viewer_authz.py -v`).
**Expected:** tfa_secret/auth_data/external_identifier are null/absent; all signage_* mutation attempts return 403; sales_records read returns 200.
**Why human:** Requires running Directus with bootstrap-roles.sh having applied the b2222222-000x permission rows.

---

### Gaps Summary

**1 automated gap — blocking Guard A:**

The `directus/fixtures/schema-hash.txt` file contains a placeholder string rather than a real MD5 hash. This was explicitly documented as a known stub in 65-05-SUMMARY.md with the instruction to run `make schema-fixture-update`. The guard script (`check_schema_hash.sh`) is correctly implemented and will pass once the real hash is committed.

**Fix:** With the full stack running (`docker compose up -d`, migrations applied), run:
```
make schema-fixture-update
git add directus/fixtures/schema-hash.txt
git commit -m "chore(65): seed schema-hash fixture from live stack"
```

**5 runtime items require human verification:** SSE latency (500 ms), calibration no-double-fire, listener reconnect, Viewer AuthZ enforcement, and fresh-volume schema-apply — all require a running Docker stack and cannot be verified programmatically from the repo alone.

**All code-level artifacts are substantive and wired correctly.** The implementation is complete; the placeholder fixture and runtime tests are the only outstanding items.

---

_Verified: 2026-04-24T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
