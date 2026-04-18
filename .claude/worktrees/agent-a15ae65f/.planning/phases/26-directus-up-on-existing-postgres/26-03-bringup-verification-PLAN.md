---
phase: 26-directus-up-on-existing-postgres
plan: 03
type: execute
wave: 3
depends_on:
  - "26-01"
  - "26-02"
files_modified: []
autonomous: false
requirements:
  - INFRA-01
  - INFRA-02
  - INFRA-03
  - CFG-01
  - CFG-02
  - CFG-03

must_haves:
  truths:
    - "A fresh `docker compose up` brings db, migrate, directus, directus-snapshot, api, and frontend to their terminal states with no operator intervention"
    - "Operator can sign in at http://127.0.0.1:8055 with DIRECTUS_ADMIN_EMAIL / DIRECTUS_ADMIN_PASSWORD from .env"
    - "Both `Admin` and `Viewer` roles are visible in Directus admin UI → Settings → Access Control → Roles"
    - "Directus admin UI Data Model view does NOT list any of the 7 Alembic app tables or alembic_version"
    - "Alembic's `public.*` tables and Directus's `directus_*` tables coexist in the same db without collision"
  artifacts:
    - path: ".planning/phases/26-directus-up-on-existing-postgres/26-03-SUMMARY.md"
      provides: "Human-verified bring-up evidence"
  key_links:
    - from: "operator browser"
      to: "http://127.0.0.1:8055"
      via: "loopback port binding from Plan 01"
      pattern: "8055"
    - from: "snapshot.yml roles"
      to: "Directus admin UI → Roles"
      via: "directus-snapshot sidecar applied on boot"
      pattern: "Admin.*Viewer"
---

<objective>
Prove the Phase 26 goal end-to-end on a clean(-ish) stack: one `docker compose up`, operator signs in, sees both roles, confirms app tables are hidden. No code changes here — this plan is pure verification and exists to gate the phase closed.

Purpose: Close INFRA-01 (one-command bring-up), INFRA-02 (admin UI reachable + first Admin signs in), INFRA-03 (Postgres coexistence verified), CFG-01 (both roles present), CFG-02 (exclude list in effect), CFG-03 (env-driven first-Admin worked).

Output: A SUMMARY.md capturing evidence (log excerpts, screenshot paths if taken, or inline descriptions of what the operator saw).

Why this plan is non-autonomous: Success criteria #2 and #4 require visual confirmation of the Directus admin UI — no headless check can substitute for "operator actually signs in and sees the roles page render correctly." Tasks 1–2 automate everything automatable; Task 3 is a tight human-verify checkpoint.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/26-directus-up-on-existing-postgres/26-CONTEXT.md
@.planning/phases/26-directus-up-on-existing-postgres/26-01-compose-service-and-env-PLAN.md
@.planning/phases/26-directus-up-on-existing-postgres/26-02-snapshot-roles-and-apply-PLAN.md
@docker-compose.yml
</context>

<tasks>

<task type="auto">
  <name>Task 1: Clean bring-up from stopped state</name>
  <files></files>
  <action>
Ensure a clean starting state (but do NOT wipe `postgres_data` unless the operator explicitly confirms — dev data may exist). Then bring up the full stack and wait for every service to reach its terminal state.

```bash
# 1. Confirm .env has the required DIRECTUS_* values set (non-empty).
#    Do NOT print the file; just verify required keys are populated.
set -a
. ./.env
set +a
: "${DIRECTUS_KEY:?DIRECTUS_KEY missing in .env}"
: "${DIRECTUS_SECRET:?DIRECTUS_SECRET missing in .env}"
: "${DIRECTUS_ADMIN_EMAIL:?DIRECTUS_ADMIN_EMAIL missing in .env}"
: "${DIRECTUS_ADMIN_PASSWORD:?DIRECTUS_ADMIN_PASSWORD missing in .env}"

# 2. Bring stack down if running (preserve volumes).
docker compose down

# 3. Bring up the full stack in detached mode.
docker compose up -d

# 4. Wait for directus to go healthy (timeout ~2min).
timeout 120 bash -c 'until docker compose ps directus | grep -q "(healthy)"; do sleep 3; done'

# 5. Confirm directus-snapshot ran and exited 0.
docker compose ps directus-snapshot  # should show Exit 0
docker compose logs directus-snapshot | tail -30

# 6. Confirm api is healthy (unchanged from v1.10).
timeout 60 bash -c 'until docker compose ps api | grep -q "(healthy)"; do sleep 3; done'

# 7. Snapshot final state.
docker compose ps
```

If any service fails to go healthy, capture `docker compose logs <service>` output and stop — do NOT proceed to the human checkpoint with a broken stack.

If `.env` is missing `DIRECTUS_*` values (step 1 fails), halt and ask the operator to populate them from `.env.example` with `openssl rand -base64 32` / `openssl rand -base64 24`. Do not auto-generate secrets and write them.
  </action>
  <verify>
    <automated>docker compose ps --format json | grep -E "\"Service\":\"(directus|api|db|frontend)\"" && docker compose ps directus | grep -q "(healthy)" && docker compose ps api | grep -q "(healthy)"</automated>
  </verify>
  <done>
All services report their terminal state: `db` healthy, `migrate` exited 0, `directus` healthy, `directus-snapshot` exited 0, `api` healthy, `frontend` running. `docker compose logs directus-snapshot` shows a successful snapshot apply.
  </done>
</task>

<task type="auto">
  <name>Task 2: Automated DB coexistence check (INFRA-03 / CFG-02)</name>
  <files></files>
  <action>
Connect to the shared Postgres and confirm both sets of tables live side-by-side, and that Directus is NOT managing the app tables.

```bash
# 1. List all tables in public schema.
docker compose exec -T db psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "\dt public.*" | tee /tmp/26-03-tables.txt

# 2. Confirm Alembic-managed app tables are present.
for t in upload_batches sales_records app_settings personio_employees personio_attendance personio_absences personio_sync_meta alembic_version; do
  docker compose exec -T db psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${t}'" | grep -q 1 || { echo "MISSING app table: ${t}"; exit 1; }
done
echo "All 8 Alembic tables present."

# 3. Confirm Directus system tables are present (a representative subset).
for t in directus_users directus_roles directus_permissions directus_sessions; do
  docker compose exec -T db psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${t}'" | grep -q 1 || { echo "MISSING directus table: ${t}"; exit 1; }
done
echo "Directus system tables present."

# 4. Confirm both roles exist in directus_roles.
docker compose exec -T db psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "SELECT id, name, admin_access FROM directus_roles WHERE name IN ('Admin','Viewer') ORDER BY name;"
# Expected: 2 rows — Admin (admin_access=t), Viewer (admin_access=f)

# 5. Confirm first Admin user was bootstrapped (CFG-03).
docker compose exec -T db psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "SELECT email, status FROM directus_users WHERE email = '${DIRECTUS_ADMIN_EMAIL}';"
# Expected: 1 row, status=active
```

Save the output of steps 1–5 into the scratch file `/tmp/26-03-dbcheck.log` for inclusion in SUMMARY.md.
  </action>
  <verify>
    <automated>docker compose exec -T db psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT COUNT(*) FROM directus_roles WHERE name IN ('Admin','Viewer')" | grep -q "^2$"</automated>
  </verify>
  <done>
All 8 Alembic tables present. Directus system tables present. `directus_roles` contains exactly both named roles (Admin with `admin_access=t`, Viewer with `admin_access=f`). The first Admin user exists in `directus_users` with `status='active'`.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human-verify Directus admin UI + app-table exclusion</name>
  <what-built>
A booted stack with Directus at `http://127.0.0.1:8055` bootstrapped with an Admin user and two custom roles, and `DB_EXCLUDE_TABLES` configured to hide the 7 Alembic-managed app tables from the Directus Data Model view.
  </what-built>
  <how-to-verify>
1. **Sign in (INFRA-02, CFG-03):**
   - Open `http://127.0.0.1:8055` in a browser.
   - Enter `DIRECTUS_ADMIN_EMAIL` and `DIRECTUS_ADMIN_PASSWORD` from your local `.env`.
   - EXPECT: redirect to the Directus admin dashboard (no error banner).

2. **Confirm both roles exist (CFG-01):**
   - Navigate to **Settings → Access Control → Roles** (or the gear icon → Access Control).
   - EXPECT: a list containing at least `Administrator` (the built-in one bound to your first Admin user), `Admin` (from snapshot, icon "verified"), and `Viewer` (from snapshot, icon "visibility").
   - Click each of `Admin` and `Viewer`; confirm `Admin` shows "App Access: Yes, Admin Access: Yes", and `Viewer` shows "App Access: Yes, Admin Access: No".

3. **Confirm app tables are hidden (CFG-02):**
   - Navigate to **Settings → Data Model**.
   - EXPECT: the list shows ONLY `directus_*` system collections. Do NOT see any of: `upload_batches`, `sales_records`, `app_settings`, `personio_employees`, `personio_attendance`, `personio_absences`, `personio_sync_meta`, `alembic_version`.
   - If any app table appears, `DB_EXCLUDE_TABLES` is not being applied — check spelling (no spaces), restart `directus`.

4. **Confirm snapshot drift warning is understood:**
   - Acknowledge: editing roles in this UI will be overwritten on the next `docker compose up` by the `directus-snapshot` sidecar. This is intended. Future role changes go via `directus/snapshot.yml` in a commit.

5. **Record evidence:**
   - Take one screenshot of the Roles page (showing Admin + Viewer rows).
   - Take one screenshot of the Data Model page (showing no app tables).
   - Save to `.planning/phases/26-directus-up-on-existing-postgres/screenshots/` (create dir).
  </how-to-verify>
  <resume-signal>
Type "approved" if all four checks pass, and the two screenshots are captured. Type specific issues otherwise (e.g., "app_settings is visible in Data Model" → regression, fix before approval).
  </resume-signal>
</task>

</tasks>

<verification>
All three tasks complete. `docker compose down` at the end leaves the stack in a clean stopped state with volumes intact.
</verification>

<success_criteria>
- Phase 26 goal achieved: a fresh `docker compose up` produces a signed-in-capable Directus with Admin + Viewer roles and hidden app tables.
- Screenshots captured in `.planning/phases/26-directus-up-on-existing-postgres/screenshots/`.
- SUMMARY.md documents which ROADMAP success criteria (1–6) were observed to pass.
- No code changes remain uncommitted.
</success_criteria>

<output>
After completion, create `.planning/phases/26-directus-up-on-existing-postgres/26-03-SUMMARY.md` including:
- Which of Phase 26's 6 roadmap success criteria passed.
- Paths to the two screenshots.
- `docker compose ps` snapshot showing terminal states.
- Excerpt from `directus-snapshot` logs showing "schema applied" (or equivalent).
- Any deviations from CONTEXT (e.g., version bump from 11.9.0 → 11.17.2, corrected exclude list without hr_kpi_targets).
</output>
