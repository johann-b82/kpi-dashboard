---
phase: 26-directus-up-on-existing-postgres
verified: 2026-04-15T00:00:00Z
status: passed
score: 7/7 must-haves verified
---

# Phase 26: Directus Up on Existing Postgres — Verification Report

**Phase Goal:** A single `directus/directus:11.x` container boots alongside the existing `db`, `api`, and `frontend` via `docker compose up`; the admin UI is reachable at `http://localhost:8055` (locked to 127.0.0.1); the first Admin is auto-bootstrapped from `.env`; and two roles (`Admin`/`Viewer` — realized as `Administrator`/`Viewer` per Plan 03 deviation) are configured reproducibly.

**Verified:** 2026-04-15
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `directus` service declared in compose, pinned 11.17.2, reuses existing `db` | VERIFIED | docker-compose.yml:51-95 — `directus/directus:11.17.2`, `DB_HOST: db`, `depends_on: db: service_healthy` |
| 2 | Directus UI bound to loopback only (127.0.0.1:8055) | VERIFIED | docker-compose.yml:54-55 — `"127.0.0.1:8055:8055"` |
| 3 | Alembic `migrate` completes before Directus starts | VERIFIED | docker-compose.yml:60-62 — `migrate: condition: service_completed_successfully` |
| 4 | First Admin bootstrapped from .env (ADMIN_EMAIL/ADMIN_PASSWORD) | VERIFIED | docker-compose.yml:81-82; human-verified in 26-03-SUMMARY (sign-in works) |
| 5 | Two roles reproducibly configured (Administrator built-in + custom Viewer) | VERIFIED | bootstrap-roles.sh creates Viewer role+policy+access idempotently; human-verified roles page renders Administrator + Viewer |
| 6 | Alembic `public.*` tables hidden from Directus Data Model UI | VERIFIED | docker-compose.yml:78 `DB_EXCLUDE_TABLES` lists all 7 app tables + `alembic_version`; human-verified |
| 7 | Alembic + Directus tables coexist in shared Postgres without collision | VERIFIED | evidence/task2-dbcheck.log shows `public.*` + `directus_*` tables coexisting cleanly |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docker-compose.yml` | `directus` service + `directus-bootstrap-roles` sidecar + `directus_uploads` volume | VERIFIED | Both services present (lines 51-113); `directus_uploads` volume declared line 117 |
| `directus/bootstrap-roles.sh` | Idempotent REST-API script creating Viewer role/policy/access | VERIFIED | 150 lines, GET-before-POST gating, fixed UUIDs, sanity-check for Administrator |
| `directus/README.md` | Documents roles-as-code approach, explains snapshot.yml removal | VERIFIED | 54 lines, explains v11 policy/access model, Administrator vs Admin naming |
| `directus/snapshot.yml` | Should be DELETED (Plan 02 deviation) | VERIFIED | File absent — correctly removed in commit a637cb5 |
| `.env.example` | Directus secret block (KEY/SECRET/ADMIN_EMAIL/ADMIN_PASSWORD) with generation commands | VERIFIED | Lines 5-15 — all four vars documented with `openssl rand` instructions |
| `26-01-SUMMARY.md`, `26-02-SUMMARY.md`, `26-03-SUMMARY.md` | All three plan summaries present | VERIFIED | All three files exist in phase dir |
| `evidence/task1-compose-ps.txt`, `task1-snapshot-logs.txt`, `task2-dbcheck.log` | Evidence from Plan 03 bring-up | VERIFIED | All three present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `directus` service | `db` service | `DB_HOST: db`, `depends_on: db: service_healthy` | WIRED | docker-compose.yml:58-60, 70 |
| `directus` service | `migrate` service | `depends_on: migrate: service_completed_successfully` | WIRED | docker-compose.yml:61-62 |
| `directus-bootstrap-roles` | `directus` | `depends_on: directus: service_healthy` + script mount | WIRED | docker-compose.yml:107-112 |
| `bootstrap-roles.sh` | Directus REST API | `/auth/login`, `/policies`, `/roles`, `/access` | WIRED | Script authenticates and creates Viewer artifacts idempotently |
| `.env.example` vars | `docker-compose.yml` directus env block | Variable names match | WIRED | DIRECTUS_KEY/SECRET/ADMIN_EMAIL/ADMIN_PASSWORD referenced identically |
| operator browser | `http://127.0.0.1:8055` | loopback port binding | WIRED | Human-verified sign-in in 26-03-SUMMARY |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INFRA-01 | 26-01, 26-03 | One-command bring-up of full stack | SATISFIED | evidence/task1-compose-ps.txt; 6 services reach terminal state |
| INFRA-02 | 26-03 | Admin UI reachable at localhost:8055, first admin signs in | SATISFIED | Human-verified in 26-03-SUMMARY; loopback binding in compose |
| INFRA-03 | 26-01, 26-03 | Directus uses shared Postgres, creates `directus_*` tables without collision | SATISFIED | evidence/task2-dbcheck.log shows coexistence |
| INFRA-04 | 26-01 | All secrets in `.env`/`.env.example` with generation commands | SATISFIED | .env.example:5-15 with `openssl rand -base64` guidance |
| CFG-01 | 26-02, 26-03 | Two roles reproducibly configured | SATISFIED | bootstrap-roles.sh (Viewer) + built-in Administrator; human-verified visible in Roles UI |
| CFG-02 | 26-01, 26-03 | App `public.*` tables hidden from Data Model | SATISFIED | DB_EXCLUDE_TABLES in compose; human-verified |
| CFG-03 | 26-01, 26-03 | First Admin bootstrapped via env vars | SATISFIED | ADMIN_EMAIL/ADMIN_PASSWORD in compose; human-verified sign-in |

**Orphaned requirements:** None — all 7 IDs claimed by plans match REQUIREMENTS.md Phase-26 mapping.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | Scan clean: no TODO/FIXME/placeholder markers; `restart: "no"` on sidecar is intentional; no hollow empty returns |

### Data-Flow Trace (Level 4)

N/A — phase produces infrastructure/compose config, not dynamic-data rendering artifacts.

### Behavioral Spot-Checks

SKIPPED — phase is docker-compose infrastructure. Bring-up already validated via Plan 03 evidence (`task1-compose-ps.txt`, `task1-snapshot-logs.txt`, `task2-dbcheck.log`) and operator sign-in. Re-running `docker compose up` in verification would duplicate Plan 03's Task 1.

### Human Verification Required

None — operator already completed human-verify during Plan 03 execution (26-03-SUMMARY.md): confirmed browser sign-in, Administrator + Viewer roles render in Roles UI, and app tables excluded from Data Model view. No additional human checks needed.

### Gaps Summary

No gaps. All 7 must-have truths VERIFIED, all artifacts present and substantive, all key links WIRED, all 7 requirement IDs satisfied. The mid-phase deviation (Plan 02 snapshot.yml → REST bootstrap script) is cleanly resolved: snapshot.yml deleted, bootstrap-roles.sh committed, README documents the switch, and the built-in `Administrator` vs custom `Admin` naming decision is explicitly flagged for Phase 27 to resolve.

Note on role naming: the phase goal statement mentions "`Admin`/`Viewer`" but the realized configuration is `Administrator` (Directus built-in, seeded by ADMIN_EMAIL) + `Viewer` (custom). This is documented in 26-03-SUMMARY deviations and directus/README.md, and is acknowledged in the verification request. Not a gap — a naming realization that Phase 27 must resolve when writing `require_role`.

---

*Verified: 2026-04-15*
*Verifier: Claude (gsd-verifier)*
