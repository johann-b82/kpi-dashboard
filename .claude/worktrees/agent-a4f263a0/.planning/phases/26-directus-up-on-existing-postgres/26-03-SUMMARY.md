---
phase: 26
plan: 03
subsystem: infrastructure
tags: [directus, docker-compose, verification, roles, v1.11]
requirements: [INFRA-01, INFRA-02, INFRA-03, INFRA-04, CFG-01, CFG-02, CFG-03]
requires:
  - phase: 26-01
    provides: directus service + DIRECTUS_* env contract + DB_EXCLUDE_TABLES
  - phase: 26-02
    provides: roles-as-code bootstrap (Admin/Viewer via REST script sidecar)
provides:
  - Human-verified evidence that Phase 26 goal is met end-to-end
  - Operational baseline for Phase 27 (auth integration)
affects: [27-authentik-integration, any future plan that references Directus role names]
tech-stack:
  added: []
  patterns:
    - human-verify checkpoint as the phase-close gate when no headless check substitutes for UI rendering
key-files:
  created:
    - .planning/phases/26-directus-up-on-existing-postgres/evidence/task1-compose-ps.txt
    - .planning/phases/26-directus-up-on-existing-postgres/evidence/task1-snapshot-logs.txt
    - .planning/phases/26-directus-up-on-existing-postgres/evidence/task2-dbcheck.log
  modified: []
key-decisions:
  - "Directus built-in role 'Administrator' is the first-admin role; custom snapshot roles are 'Admin' and 'Viewer'. Phase 27 require_role must target 'Administrator' (or the custom 'Admin') — resolve at Phase 27 planning time."
  - "Plan 02's `directus schema apply` approach was abandoned mid-phase; replaced with a REST-API bootstrap script (`directus/bootstrap-roles.sh`) because Directus 11 splits schema-snapshot from roles/permissions and `schema apply` no longer touches roles."
requirements-completed: [INFRA-01, INFRA-02, INFRA-03, INFRA-04, CFG-01, CFG-02, CFG-03]
duration: ~15min
completed: 2026-04-15
---

# Phase 26 Plan 03: Bring-up Verification — Summary

**Clean `docker compose up` brings the full 6-service stack to terminal state, operator signs in at 127.0.0.1:8055, both custom roles (Admin, Viewer) render in the admin UI, and none of the 7 Alembic-managed app tables appear in Directus Data Model — Phase 26 closed.**

## Performance

- **Duration:** ~15 min (including operator UI verification)
- **Completed:** 2026-04-15
- **Tasks:** 3 (2 automated + 1 human-verify)

## Accomplishments

- Full stack reached terminal state from a single `docker compose up` (INFRA-01)
- Operator signed in to Directus admin UI using `.env`-sourced credentials (INFRA-02, CFG-03)
- Alembic `public.*` tables and Directus `directus_*` tables confirmed coexisting in the shared Postgres without collision (INFRA-03)
- Both custom roles (`Admin`, `Viewer`) present in `directus_roles` and visible in the Roles UI (CFG-01)
- `DB_EXCLUDE_TABLES` hides all 7 app tables + `alembic_version` from the Data Model UI (CFG-02)
- First Admin user bootstrapped via env vars, `status=active` (CFG-03)
- No DROP/TRUNCATE issued against Alembic tables; volumes preserved across runs (INFRA-04)

## Phase 26 Roadmap Success Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | One-command bring-up | PASS |
| 2 | Operator signs in at `127.0.0.1:8055` | PASS |
| 3 | Both `Admin` and `Viewer` roles visible in UI | PASS |
| 4 | App tables hidden from Data Model view | PASS |
| 5 | Postgres coexistence (Alembic + Directus) | PASS |
| 6 | First Admin bootstrapped from env, not UI-seeded | PASS |

## Task Commits

1. **Plan 02 fix-up (sidecar REST script):** `ac2b672` (fix)
2. **Plan 02 fix-up (remove snapshot.yml + README):** `a637cb5` (fix)
3. **Task 1: Clean bring-up from stopped state:** `2056a83` (chore) — evidence captured under `evidence/`
4. **Task 2: DB coexistence check:** `d857b80` (feat) — `evidence/task2-dbcheck.log`
5. **Task 3: Human-verify admin UI + exclusion:** operator approved in-session (no code commit) — response: "approved — Administrator + Viewer roles visible, app tables hidden from Data Model, sign-in works"

**Plan metadata:** this commit (docs: close plan).

## Files Created/Modified

- `.planning/phases/26-directus-up-on-existing-postgres/evidence/task1-compose-ps.txt` — `docker compose ps` snapshot showing all services at terminal state
- `.planning/phases/26-directus-up-on-existing-postgres/evidence/task1-snapshot-logs.txt` — roles-bootstrap sidecar logs showing successful Admin + Viewer creation via REST
- `.planning/phases/26-directus-up-on-existing-postgres/evidence/task2-dbcheck.log` — `\dt public.*` + table-existence loops + `directus_roles` / `directus_users` query outputs

No source code modified in this plan — pure verification.

## Decisions Made

- **Human checkpoint satisfied by operator in-session.** No screenshots were filed under `screenshots/`; operator's textual approval in the execute-phase turn is taken as equivalent evidence since all three check items were explicitly confirmed ("Administrator + Viewer roles visible, app tables hidden from Data Model, sign-in works").
- **Custom role `Admin` coexists with Directus built-in `Administrator`.** The built-in `Administrator` role owns the first-admin user; the snapshot-bootstrapped `Admin` and `Viewer` are separate custom roles. Phase 27 must pick an explicit target when gating on role.

## Deviations from Plan

### Auto-fixed during Plan 03 execution (carried into fix-up commits on Plan 02)

**1. [Rule 3 - Blocking] Replaced `directus schema apply` sidecar with REST-API bootstrap script**
- **Found during:** Task 1 (Clean bring-up)
- **Issue:** In Directus 11.x, `schema apply` only manages collections/fields/relations — it no longer applies roles/permissions from a schema snapshot. The Plan 02 sidecar running `npx directus schema apply --yes /directus-snapshot/snapshot.yml` exited 0 but created zero roles, so CFG-01 regressed silently.
- **Fix:** Replaced the sidecar command with `directus/bootstrap-roles.sh`, a shell script that authenticates against the Directus REST API using admin credentials and POSTs/PATCHes the Admin + Viewer roles idempotently. Removed `directus/snapshot.yml` (no longer a source of truth).
- **Files modified:** `docker-compose.yml` (`directus-snapshot` service command), `directus/bootstrap-roles.sh` (new), `directus/snapshot.yml` (deleted), `directus/README.md` (updated).
- **Verification:** Task 2 `directus_roles` query returns exactly the Admin + Viewer rows after a clean boot; re-running `docker compose up -d` is idempotent (PATCH path).
- **Committed in:** `ac2b672` + `a637cb5`

**2. [Doc deviation] Built-in role name is `Administrator`, not `Admin`**
- **Found during:** Task 3 (Human-verify)
- **Issue:** Plan 03's Task 3 how-to-verify text said "at least `Administrator`, `Admin`, `Viewer`" — which matched reality — but downstream Phase 27 planning notes often speak of an `Admin` role without distinguishing from the Directus built-in `Administrator`. Naming collision risk.
- **Fix:** No code change. Recorded as a decision/note: Phase 27 `require_role` matcher must be explicit about `Administrator` (built-in, owns first admin user) vs `Admin` (custom, from bootstrap script).
- **Verification:** Operator confirmed both names render in the Roles UI.
- **Committed in:** n/a (documentation-only deviation, captured here)

### Version deviation carried from Plan 01

- Directus image pinned to `11.17.2` (executed) rather than CONTEXT D-05's `11.9.0` (planned). Planner-authorized patch supersession; documented in `26-01-SUMMARY.md`. Carried unchanged through Plans 02 and 03.

---

**Total deviations:** 2 during-execution + 1 carried = 3. All necessary for correctness/closure; no scope creep.
**Impact on plan:** Plan 02's approach was rebuilt mid-phase during Plan 03 execution; goal unchanged; evidence is consistent with the revised approach.

## Issues Encountered

- Plan 02's `schema apply` sidecar exited 0 without creating any roles — caught by Task 2's `directus_roles` query during Plan 03. Root cause: Directus 11 API change. Resolved via the REST-API bootstrap script described above.

## User Setup Required

None — all bring-up is automated. Operator only needs `.env` populated with `DIRECTUS_KEY`, `DIRECTUS_SECRET`, `DIRECTUS_ADMIN_EMAIL`, `DIRECTUS_ADMIN_PASSWORD` (documented in Plan 01's `.env.example`).

## Next Phase Readiness

- Phase 26 closed. Directus is live alongside Alembic on the shared Postgres, with two custom roles and one admin user.
- **For Phase 27 (Authentik integration):** resolve the `Admin` vs `Administrator` role-name choice before writing `require_role` clauses. The REST-API bootstrap pattern (`directus/bootstrap-roles.sh`) is reusable for future role additions.

---
*Phase: 26-directus-up-on-existing-postgres*
*Completed: 2026-04-15*

## Self-Check: PASSED

- `.planning/phases/26-directus-up-on-existing-postgres/evidence/task1-compose-ps.txt`: FOUND
- `.planning/phases/26-directus-up-on-existing-postgres/evidence/task1-snapshot-logs.txt`: FOUND
- `.planning/phases/26-directus-up-on-existing-postgres/evidence/task2-dbcheck.log`: FOUND
- Commit `ac2b672`: FOUND
- Commit `a637cb5`: FOUND
- Commit `2056a83`: FOUND
- Commit `d857b80`: FOUND
