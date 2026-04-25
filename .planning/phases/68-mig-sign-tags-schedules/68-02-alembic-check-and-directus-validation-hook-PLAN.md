---
phase: 68-mig-sign-tags-schedules
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/alembic/versions/v1_23_signage_schedule_check.py
  - directus/snapshots/v1.22.yaml
  - directus/fixtures/schema-hash.txt
autonomous: true
requirements: [MIG-SIGN-02]

must_haves:
  truths:
    - "Database rejects schedules where start_hhmm >= end_hhmm with Postgres CHECK violation (sqlstate 23514)"
    - "A Directus Flow on signage_schedules items.create + items.update blocks the row before insert/update and returns a stable error code 'schedule_end_before_start'"
  artifacts:
    - path: "backend/alembic/versions/v1_23_signage_schedule_check.py"
      provides: "Alembic CHECK constraint on signage_schedules"
      contains: "CHECK (start_hhmm < end_hhmm)"
    - path: "directus/snapshots/v1.22.yaml"
      provides: "Flow definition for signage_schedules friendly validation"
      contains: "schedule_end_before_start"
  key_links:
    - from: "Directus Flow"
      to: "Directus client"
      via: "items.create / items.update event with operation that throws { code: 'schedule_end_before_start' }"
      pattern: "schedule_end_before_start"
    - from: "Alembic migration"
      to: "signage_schedules table"
      via: "ALTER TABLE ADD CONSTRAINT"
      pattern: "start_hhmm < end_hhmm"
---

<objective>
Add the database-level CHECK constraint and the Directus validation Flow that together enforce `start_hhmm < end_hhmm` on `signage_schedules` (per D-01). Both layers are required: the CHECK is the source of truth (cannot be bypassed via psql), the Flow is the friendly-error layer that returns a stable error code so frontend can map to an i18n key (per D-02 / D-03).

Purpose: MIG-SIGN-02 success criterion 2 — `start_hhmm < end_hhmm` enforced at DB and surfaced with a friendly error.

Output: One new Alembic migration; one snapshot YAML update declaring the Flow; updated schema-hash fixture.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md
@backend/alembic/versions/v1_22_signage_notify_triggers.py
@backend/alembic/versions/v1_18_signage_schedules.py
@directus/snapshots/v1.22.yaml

<interfaces>
Existing schedules table is created in `v1_18_signage_schedules.py`. Columns: `id UUID`, `playlist_id UUID FK`, `weekday_mask INT`, `start_hhmm INT`, `end_hhmm INT`, `priority INT`, `enabled BOOL`, `created_at`, `updated_at`. No CHECK currently.

Today's `schedules.py:145` raises 422 when `start_hhmm >= end_hhmm` — that lives only in the FastAPI router (deleted in Plan 03). The DB CHECK is the new source of truth.

Existing Directus snapshot (`directus/snapshots/v1.22.yaml`) declares collections + fields + relations only (per Phase 65 D-02). Flows ARE supported in `directus schema apply`; this plan introduces the first Flow definition into the snapshot. If Flows turn out not to be captured by `directus schema snapshot` in the deployed Directus 11 version, fall back to `directus/bootstrap-roles.sh` to POST the Flow via REST.

`directus/fixtures/schema-hash.txt` is the SHA256 hash over `(table_name, column_name, data_type, is_nullable, column_default)` for v1.22-surfaced tables. Adding a CHECK constraint does NOT change `information_schema.columns` — the hash should NOT change. Verify via Guard A in CI; only update fixture if Guard A reports drift after `make schema-fixture-update`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Alembic migration adding CHECK (start_hhmm < end_hhmm)</name>
  <files>backend/alembic/versions/v1_23_signage_schedule_check.py</files>
  <read_first>
    - backend/alembic/versions/v1_22_signage_notify_triggers.py
    - backend/alembic/versions/v1_18_signage_schedules.py
    - .planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md (D-01)
  </read_first>
  <behavior>
    - Test 1 (positive): inserting a row with `start_hhmm=600, end_hhmm=900` succeeds.
    - Test 2 (negative): inserting `start_hhmm=900, end_hhmm=600` raises `IntegrityError` (sqlstate 23514) with constraint name `ck_signage_schedules_start_before_end`.
    - Test 3 (boundary): inserting `start_hhmm=600, end_hhmm=600` raises `IntegrityError` (CHECK uses strict `<`).
    - Test 4 (downgrade): after `alembic downgrade -1`, the constraint is gone — same negative insert succeeds.
  </behavior>
  <action>
    1. Determine current head: `cd backend && alembic heads` — should report `v1_22_signage_notify_triggers` (single head).
    2. Create file `backend/alembic/versions/v1_23_signage_schedule_check.py` with:
       ```python
       """Phase 68 MIG-SIGN-02: CHECK (start_hhmm < end_hhmm) on signage_schedules

       Revision ID: v1_23_signage_schedule_check
       Revises: v1_22_signage_notify_triggers
       Create Date: 2026-04-25
       """
       from alembic import op

       revision = "v1_23_signage_schedule_check"
       down_revision = "v1_22_signage_notify_triggers"
       branch_labels = None
       depends_on = None

       CONSTRAINT_NAME = "ck_signage_schedules_start_before_end"

       def upgrade() -> None:
           op.execute(
               "ALTER TABLE signage_schedules "
               f"ADD CONSTRAINT {CONSTRAINT_NAME} "
               "CHECK (start_hhmm < end_hhmm)"
           )

       def downgrade() -> None:
           op.execute(
               f"ALTER TABLE signage_schedules DROP CONSTRAINT {CONSTRAINT_NAME}"
           )
       ```
    3. Confirm correct revision id chain: `cd backend && alembic history | head -5` — `v1_23_signage_schedule_check (head)` follows `v1_22_signage_notify_triggers`.
    4. Run `cd backend && alembic upgrade head` against test DB. If any pre-existing schedule violates the constraint, the migration fails — abort and surface the offending rows. (Per D-01 the FastAPI 422 has been guarding this, so legacy data should be clean; if not, document in SUMMARY.)
    5. Add a pytest under `backend/tests/signage/test_signage_schedule_check.py` with the four behaviors above (use the existing `db_session` fixture pattern from `backend/tests/conftest.py`). Constraint violation: assert `IntegrityError` and `'ck_signage_schedules_start_before_end' in str(exc.orig)`.
  </action>
  <verify>
    <automated>cd backend && alembic upgrade head && pytest tests/signage/test_signage_schedule_check.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "CHECK \(start_hhmm < end_hhmm\)" backend/alembic/versions/v1_23_signage_schedule_check.py` exits 0.
    - `grep -nE "down_revision = \"v1_22_signage_notify_triggers\"" backend/alembic/versions/v1_23_signage_schedule_check.py` exits 0.
    - `cd backend && alembic upgrade head` exits 0; subsequent `alembic current` shows `v1_23_signage_schedule_check (head)`.
    - `pytest backend/tests/signage/test_signage_schedule_check.py -x -q` exits 0 with all four cases passing.
    - `cd backend && alembic downgrade -1 && alembic upgrade head` exits 0 (round-trip clean).
  </acceptance_criteria>
  <done>CHECK constraint enforced at DB level; round-trip clean; pytest covers strict-less-than + downgrade.</done>
</task>

<task type="auto">
  <name>Task 2: Directus Flow for friendly schedule validation error</name>
  <files>directus/snapshots/v1.22.yaml, directus/bootstrap-roles.sh</files>
  <read_first>
    - directus/snapshots/v1.22.yaml (lines 1-80 to understand top-level structure; lines 572-657 for signage_schedules section)
    - directus/bootstrap-roles.sh
    - .planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md (D-01.2, D-03)
  </read_first>
  <action>
    1. Decide implementation path: prefer Directus Flow (D-01.2 — Flow is "lower-touch and already an established pattern" per Claude's Discretion). Define a Flow that triggers on `items.create` AND `items.update` for `signage_schedules`, with one operation that runs validation in JS:
       ```
       Trigger: Event Hook (filter), scope = items.create + items.update, collection = signage_schedules
       Operation: Run Script (sandbox)
         module.exports = async function({ $trigger }) {
           const payload = $trigger.payload || {};
           const start = payload.start_hhmm;
           const end = payload.end_hhmm;
           // For items.update where only one field is set, fetch the row from $accountability/database
           // — but Directus 11 filter hooks already merge payload+existing on update; defensive guard:
           if (typeof start === 'number' && typeof end === 'number' && start >= end) {
             throw new Error(JSON.stringify({ code: "schedule_end_before_start" }));
           }
         }
       ```
       Stable error code returned in the message body is `schedule_end_before_start` (D-03).
    2. Add the Flow + Operation to `directus/snapshots/v1.22.yaml` under a `flows:` and `operations:` top-level section. Use fixed UUIDs (so the snapshot is idempotent and matches the Phase 65 fixed-UUID pattern). Choose UUIDs:
       - Flow: `68aaaaaa-0000-4000-8000-000000000001`
       - Operation: `68aaaaaa-0000-4000-8000-000000000002`
    3. If `directus schema apply` does NOT propagate Flows in the installed Directus 11 (verify by running `cd directus && npx directus schema apply --help` and inspecting docs / test against running stack), fall back to: append a section 6 to `directus/bootstrap-roles.sh` that idempotently POSTs the Flow + Operation via REST `POST /flows` and `POST /operations` (GET-before-POST per AUTHZ-04 idempotency rule). Use the same fixed UUIDs.
    4. Smoke test (manual or scripted in this task's verify step):
       - `curl -X POST $DIRECTUS/items/signage_schedules -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"playlist_id":"<existing>","weekday_mask":1,"start_hhmm":900,"end_hhmm":600,"priority":0,"enabled":true}'`
       - Expected: HTTP 400 with body containing `schedule_end_before_start`.
  </action>
  <verify>
    <automated>grep -n "schedule_end_before_start" directus/snapshots/v1.22.yaml directus/bootstrap-roles.sh 2>/dev/null && grep -nE "items\.create|items\.update" directus/snapshots/v1.22.yaml | grep -i schedule</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "schedule_end_before_start" directus/snapshots/v1.22.yaml` OR `grep -n "schedule_end_before_start" directus/bootstrap-roles.sh` exits 0 (whichever path was chosen).
    - `grep -nE "(items\.create|items\.update).*signage_schedules|signage_schedules.*items\.(create|update)" directus/snapshots/v1.22.yaml directus/bootstrap-roles.sh` exits 0.
    - With the dev stack up (`docker compose up -d` then re-applied snapshot/bootstrap), POSTing an inverted-range schedule via Directus REST as Admin returns HTTP 400 with `"code":"schedule_end_before_start"` in the response body. (Manual smoke documented in SUMMARY.md.)
    - `directus/fixtures/schema-hash.txt` is unchanged (CHECK constraint does not affect `information_schema.columns`); CI Guard A in Phase 65 still passes.
  </acceptance_criteria>
  <done>Directus Flow deployed (via snapshot or bootstrap REST fallback); inverted-range write rejected with stable error code.</done>
</task>

</tasks>

<verification>
- DB-level: `psql -c "INSERT INTO signage_schedules (id,playlist_id,weekday_mask,start_hhmm,end_hhmm,priority,enabled) VALUES (gen_random_uuid(),'<existing>',1,900,600,0,true)"` returns ERROR sqlstate 23514.
- Directus-level: REST POST with inverted range as Admin returns HTTP 400 + `schedule_end_before_start`.
- `pytest backend/tests/signage/test_signage_schedule_check.py -x -q` exits 0.
</verification>

<success_criteria>
Both enforcement layers exist (DB CHECK + Directus Flow). Stable error code `schedule_end_before_start` flows from Directus to client.
</success_criteria>

<output>
After completion, create `.planning/phases/68-mig-sign-tags-schedules/68-02-SUMMARY.md` capturing:
- Implementation path chosen for the Directus hook (snapshot Flow vs bootstrap REST).
- Sample REST response showing the `schedule_end_before_start` payload (for Plan 05 to map).
- Confirmation that schema-hash.txt is unchanged.
</output>
