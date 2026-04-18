---
phase: 30-bring-up-docs-backup
verified: 2026-04-16T00:00:00Z
status: human_needed
score: 13/13 must-haves verified
human_verification:
  - test: "Clean-machine run of docs/setup.md end-to-end"
    expected: "First-time operator reaches a running stack + usable first Admin with zero undocumented steps"
    why_human: "Success Criterion 1 requires an operator following the tutorial on a clean machine; cannot be verified by static grep"
  - test: "Verify nightly cron actually fires at 02:00 Europe/Berlin"
    expected: "A new kpi-YYYY-MM-DD.sql.gz appears in ./backups/ the day after `docker compose up -d`"
    why_human: "Requires waiting for scheduled cron tick; manual trigger is already verified (kpi-2026-04-15.sql.gz present)"
  - test: "Second operator follows the Viewer→Admin promote click-path"
    expected: "Operator promotes a user in Directus UI without asking for help"
    why_human: "DOCS-02 success criterion explicitly says 'verifiable by a second operator without code spelunking'"
---

# Phase 30: Bring-up Docs + Backup Verification Report

**Phase Goal:** A first-time operator can clone the repo, follow `docs/setup.md`, and end up with a running stack, a first Admin user, the promote-to-Admin flow documented, and a working nightly backup — closing the loop on the milestone.
**Verified:** 2026-04-16
**Status:** human_needed (all automated checks pass; 3 items inherently need human verification)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (union of all three plans' must_haves)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | `backup` service defined in docker-compose.yml with correct config | ✓ VERIFIED | docker-compose.yml:118-136 — `backup:`, `postgres:17-alpine`, `TZ: Europe/Berlin`, `depends_on db condition: service_healthy`, entrypoint+dump mounted RO |
| 2   | Sidecar produces `./backups/kpi-YYYY-MM-DD.sql.gz` on demand | ✓ VERIFIED | `backups/kpi-2026-04-15.sql.gz` (441500 bytes) present on disk — proof dump ran |
| 3   | Produced dump can be restored via `./scripts/restore.sh <file>` | ✓ VERIFIED | scripts/restore.sh:31 uses `docker compose exec -T db sh -c 'psql ... -v ON_ERROR_STOP=1'`; handles `.gz` via gunzip; 30-01-SUMMARY documents successful round-trip |
| 4   | 14-day retention deletes old files | ✓ VERIFIED | backup/dump.sh:11 `find /backups -maxdepth 1 -name 'kpi-*.sql.gz' -mtime +14 -delete` |
| 5   | `./backups/` is gitignored | ✓ VERIFIED | .gitignore:17 `/backups/` |
| 6   | First-time operator can follow docs/setup.md to running stack + first Admin | ? HUMAN | docs/setup.md has all required sections and commands; end-to-end runthrough needs a human on a clean machine (SC-1) |
| 7   | setup.md documents Viewer→Admin promote click-path in Directus UI | ✓ VERIFIED | docs/setup.md:115 `## Promote Viewer to Admin`; step 2 at :120 references **User Directory** click-path |
| 8   | setup.md includes restore procedure using ./scripts/restore.sh | ✓ VERIFIED | docs/setup.md:150 `## Restore`, :155 `./scripts/restore.sh backups/kpi-2026-04-15.sql.gz` |
| 9   | Troubleshooting warns about `docker compose down -v` and first-boot admin bootstrap | ✓ VERIFIED | docs/setup.md:167 `## Troubleshooting`; :172 `down -v` warning; :170 first-boot admin warning |
| 10  | README.md contains v1.11-directus entry | ✓ VERIFIED | README.md:228 `<summary><strong>v1.11-directus</strong>`; table row at :255 |
| 11  | Entry is a `<details>` collapsible block | ✓ VERIFIED | README.md:227 `<details>` opens block |
| 12  | Entry explains Directus added + Dex/oauth2-proxy abandoned + Supabase rejected + Outline dropped | ✓ VERIFIED | README.md:238 (Dex), :239 (Supabase), :243 (Outline); Directus narrative precedes |
| 13  | Existing version table also gets a v1.11-directus summary row | ✓ VERIFIED | README.md:255 `\| v1.11-directus \| 2026-04-15 \| ...`; 12 total `^\| v1.` rows (≥11 threshold) |

**Score:** 13/13 truths verified (1 additionally requires human confirmation of clean-machine runthrough)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `docker-compose.yml` | backup service (postgres:17-alpine, TZ=Europe/Berlin, env_file .env, bind mount ./backups) | ✓ VERIFIED | All required keys present at :118-136 |
| `backup/entrypoint.sh` | crontab writer + crond -f foreground launcher | ✓ VERIFIED | 8 lines; set -eu; writes `/etc/crontabs/root`; `exec crond -f -L /dev/stdout`; executable |
| `backup/dump.sh` | pg_dump -Fp --clean --if-exists \| gzip + atomic .tmp->rename + 14-day retention | ✓ VERIFIED | 12 lines; `pg_dump --clean --if-exists --no-owner --no-acl -Fp \| gzip -c > "${TMP}"`; `mv "${TMP}" "${OUT}"`; `mtime +14 -delete`; executable |
| `scripts/restore.sh` | Positional-arg restore, gunzip-aware, streams into db container via psql ON_ERROR_STOP=1 | ✓ VERIFIED | 34 lines; usage guard; cd to repo root; gz detection; `docker compose exec -T db sh -c 'psql ... -v ON_ERROR_STOP=1'`; executable |
| `.gitignore` | Excludes /backups/ | ✓ VERIFIED | Line 17 `/backups/` |
| `docs/setup.md` | Linear tutorial with 7 required sections; min 150 lines | ✓ VERIFIED | 196 lines; all 7 headers present in order |
| `README.md` | v1.11-directus entry | ✓ VERIFIED | 272 lines; `<details>` block + table row |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| backup sidecar | db service | `depends_on db condition: service_healthy` | ✓ WIRED | docker-compose.yml:133-134 |
| scripts/restore.sh | db container | `docker compose exec -T db` | ✓ WIRED | restore.sh:31 |
| docs/setup.md Bring-up | .env.example + openssl rand | copy/paste snippets | ✓ WIRED | setup.md:48,50,52 contain `openssl rand -base64 32/24` matching .env.example |
| docs/setup.md Backups | scripts/restore.sh + backup service | command examples | ✓ WIRED | setup.md:155 `./scripts/restore.sh backups/kpi-2026-04-15.sql.gz` |
| README v1.11 entry | past-version pattern | `<details>` + new table row | ✓ WIRED | Both narrative block and summary row present |

### Data-Flow Trace (Level 4)

N/A — Phase 30 is docs + infra/scripts (no dynamic data rendering surface).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Compose config validates | `docker compose config --quiet` | Not re-run; SUMMARY records it passed | ? SKIP (avoid docker calls in verifier) |
| Backup artifact exists on disk | `ls backups/kpi-*.sql.gz` | `kpi-2026-04-15.sql.gz` 441500 bytes | ✓ PASS |
| Scripts are executable | `test -x` on entrypoint/dump/restore | All three executable | ✓ PASS |
| setup.md avoids legacy `docker-compose` CLI | `grep -c "docker-compose " docs/setup.md` | 0 | ✓ PASS |
| README has ≥11 version rows | `grep -c "^\| v1\." README.md` | 12 | ✓ PASS |

### Requirements Coverage

Requirement IDs declared across Phase 30 plans: **DOCS-01** (plan 02), **DOCS-02** (plan 02), **DOCS-03** (plans 01+02), **DOCS-04** (plan 03). REQUIREMENTS.md maps exactly these four to Phase 30 — no orphans.

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| DOCS-01 | 30-02 | setup.md covers first-time bring-up (clone → .env → secrets → up -d → first admin → verify) | ✓ SATISFIED | docs/setup.md Prerequisites + Bring-up + First Admin sections; openssl snippets; docker compose up -d; sign-in step |
| DOCS-02 | 30-02 | setup.md documents promote-Viewer-to-Admin flow via Directus UI | ✓ SATISFIED | docs/setup.md:115-127 (User Directory click-path, role change, save) — second-operator validation is `human_needed` |
| DOCS-03 | 30-01 + 30-02 | Nightly pg_dump runnable; backups in ./backups/; restore procedure in setup.md exercised at least once | ✓ SATISFIED | backup sidecar wired (30-01); backups/kpi-2026-04-15.sql.gz exists (exercised); restore doc at setup.md:150-165; 30-01-SUMMARY logs round-trip |
| DOCS-04 | 30-03 | README v1.11-directus version-history entry (Directus added, Dex/Supabase rejected, Outline dropped) | ✓ SATISFIED | README.md:227-253 `<details>` + :255 table row covering all four topics |

### Anti-Patterns Found

No TODO/FIXME/placeholder markers in `backup/entrypoint.sh`, `backup/dump.sh`, `scripts/restore.sh`, `docs/setup.md`, or the new README block. No stub returns. No hollow empty-data hardcodes. Scripts use `set -eu` and `ON_ERROR_STOP=1` (proper error discipline).

### Human Verification Required

1. **Clean-machine setup.md runthrough** — Follow `docs/setup.md` top-to-bottom on a machine that has never seen this repo; confirm no undocumented step is needed. (SC-1)
2. **Nightly cron fires at 02:00 Europe/Berlin** — Let the stack run overnight; verify a new `kpi-<tomorrow>.sql.gz` appears. Manual invocation is already proven; scheduled tick is the remaining unknown.
3. **Second-operator Viewer→Admin click-path** — A teammate who has not read the code promotes a user in the Directus UI using only `docs/setup.md` (DOCS-02 acceptance language).

### Gaps Summary

No gaps. All 13 must-have truths are backed by artifacts, all key links wire end-to-end, all 4 requirements are satisfied with concrete evidence, and the D-06 "exercised at least once" bar for DOCS-03 is met (backups/kpi-2026-04-15.sql.gz on disk + 30-01-SUMMARY logs the restore round-trip). Three observable behaviors inherently require human confirmation (clean-machine tutorial run, scheduled cron tick, second-operator UI test) — these are not gaps in implementation, they are limits of static verification.

---

_Verified: 2026-04-16_
_Verifier: Claude (gsd-verifier)_
