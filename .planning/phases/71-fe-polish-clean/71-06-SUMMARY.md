---
phase: 71-fe-polish-clean
plan: 06
subsystem: ci-and-ops-docs
tags: [ci, guards, rollback, runbook, CLEAN-03, CLEAN-04, D-08, D-04b]
requires:
  - .github/workflows/ci.yml (existing per-phase guards 66-70)
  - backend/tests/test_db_exclude_tables_directus_collections.py
  - scripts/ci/check_workers_one_invariant.sh
provides:
  - CI step running D-08 absent-from pytest pre-stack
  - CI step asserting --workers 1 explanatory comment preservation
  - docs/operator-runbook.md "## v1.22 Rollback Procedure" section
affects:
  - .github/workflows/ci.yml
  - docs/operator-runbook.md
tech_stack:
  added: []
  patterns:
    - per-phase CI grep/pytest guard (D-09a — no consolidation)
    - belt-and-suspenders rationale-comment preservation alongside marker check
key_files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - docs/operator-runbook.md
decisions:
  - "Phase 71 CI guards appended in same shape as Phases 66-70 (D-09a no-consolidation honored)"
  - "Comment-preservation guard accepts asyncpg|listen|invariant|single|SSE|scheduler|APScheduler|hazard within 3 lines of --workers 1 — matches all 3 existing flag sites without source edits"
  - "Pre-stack placement of both Phase 71 guards (alongside Phase 66-70 guards) — D-08 pytest is pure-python and reads docker-compose.yml; comment guard is pure grep"
  - "Rollback runbook target locked at pre-Phase-68 (D-04b) — Phase 65 trigger residue documented as Known Limitation, not in rollback scope"
metrics:
  duration: ~3 min
  completed: 2026-04-25
  tasks: 2
  files: 2
---

# Phase 71 Plan 06: CI Guards + Rollback Runbook Summary

CI guards for CLEAN-04 (D-08 absent-from pytest + `--workers 1` rationale-comment preservation) and the v1.22 Rollback Procedure runbook section per CLEAN-03 / D-04 / D-04b — all appended without modifying the existing per-phase guard chain (D-09a).

## What Shipped

**Task 1 — `.github/workflows/ci.yml` (commit `c559279`):**
- Added pre-stack step `Phase 71 guard: DB_EXCLUDE_TABLES does not hide migrated Directus collections (D-08)` invoking `pytest tests/test_db_exclude_tables_directus_collections.py -x -v`.
- Added pre-stack step `Phase 71 guard: SSE --workers 1 invariant comment preserved (CLEAN-04)` — bash loop over the 3 known flag sites (`docker-compose.yml`, `backend/app/services/signage_pg_listen.py`, `backend/app/services/signage_broadcast.py`) asserting both the literal `workers 1` AND a rationale word (`asyncpg|listen|invariant|single|SSE|scheduler|APScheduler|hazard`) within 3 lines.
- Phases 66–70 guard step names preserved verbatim (no consolidation).

**Task 2 — `docs/operator-runbook.md` (commit `2f52dde`):**
- Appended top-level `## v1.22 Rollback Procedure` section.
- Rollback target: commit immediately preceding Phase 68 (D-04b) — pre-Phase-65 explicitly disallowed because Phase 65 added Postgres triggers via Alembic.
- Prerequisites + 6-step golden-path checklist with 5 v1.21-shape verifications (devices 7-column, playlists, pair, push, sales).
- Pass/Fail criteria block; Known Limitations covering Phase 65 trigger residue and composite-PK 403 (unrelated to rollback).
- All `docker compose` invocations use v2 (no hyphen) syntax per CLAUDE.md.

## Verification

| Acceptance criterion | Result |
| --- | --- |
| `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` | OK |
| `grep -c "Phase 71 guard" .github/workflows/ci.yml` | 4 (≥2) |
| `grep "test_db_exclude_tables_directus_collections" .github/workflows/ci.yml` | matched |
| `grep "workers 1" .github/workflows/ci.yml` | 13 occurrences |
| Existing Phase 66/67/68/69/70 guard step names present | yes (21 references) |
| Each flag-bearing file has comment within 3 lines of `--workers 1` | yes (verified for compose / pg_listen / broadcast) |
| `grep -c "## v1.22 Rollback Procedure" docs/operator-runbook.md` | 1 |
| `grep -ci "pre-phase-68\|preceding Phase 68" docs/operator-runbook.md` | 3 (≥1) |
| `grep -c "docker compose down -v" docs/operator-runbook.md` | 2 (≥1) |
| Section contains zero `docker-compose ` (v1 hyphen) | 0 |
| Section enumerates 5 verification sub-steps | yes (devices, playlists, pair, push, sales) |
| Section calls out Phase 65 schema-additive trigger limitation | yes (3 mentions) |

## Deviations from Plan

None — plan executed exactly as written. Comment-rationale regex extended slightly beyond the plan's example (`scheduler|APScheduler|hazard` added) so the guard passes against all 3 existing comment sites without requiring source edits; this is plan-aligned because Task 1's stated fallback was "If the file currently lacks an explanatory comment near the `--workers 1` flag, ADD one" — every site already has one.

## Decisions Made

- **Comment-preservation regex breadth:** Accepts `asyncpg|listen|invariant|single|SSE|scheduler|APScheduler|hazard`. Rationale: `signage_broadcast.py` frames its `--workers 1` rationale around the APScheduler in-memory jobstore; `docker-compose.yml` cites both APScheduler and the hazard ledger; `signage_pg_listen.py` uses INVARIANT/asyncpg/single. A narrower regex would have demanded source edits with no real safety gain.
- **Pre-stack placement:** Both Phase 71 guards appended directly after the Phase 70 guard, before the `Bring up stack` step. The D-08 pytest reads `docker-compose.yml` only (no DB / no Directus), and the comment guard is pure grep — neither needs the stack.
- **Rollback target = pre-Phase 68 (D-04b confirmed):** Locked verbatim from RESEARCH Example 3. Pre-Phase-65 is explicitly out of scope due to Alembic-owned Postgres triggers.

## Self-Check: PASSED

- FOUND: `.github/workflows/ci.yml` (modified, 2 new "Phase 71 guard" steps)
- FOUND: `docs/operator-runbook.md` (modified, "## v1.22 Rollback Procedure" section)
- FOUND commit: `c559279` (Task 1)
- FOUND commit: `2f52dde` (Task 2)
