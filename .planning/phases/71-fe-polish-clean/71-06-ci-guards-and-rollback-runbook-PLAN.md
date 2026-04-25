---
phase: 71-fe-polish-clean
plan: 06
type: execute
wave: 2
depends_on: [71-04]
files_modified:
  - .github/workflows/ci.yml
  - docs/operator-runbook.md
autonomous: true
requirements: [CLEAN-03, CLEAN-04]

must_haves:
  truths:
    - "CI workflow runs the new D-08 absent-from pytest as a dedicated step"
    - "CI workflow includes a step that asserts the SSE `--workers 1` invariant comment is preserved in the relevant file"
    - "docs/operator-runbook.md has a new top-level section `## v1.22 Rollback Procedure` with the 6-step golden-path checklist"
    - "Existing per-phase CI grep guards (Phases 66-70) are NOT modified or consolidated (D-09a)"
  artifacts:
    - path: ".github/workflows/ci.yml"
      provides: "CI pipeline with new D-08 + workers-1 comment guard steps appended"
    - path: "docs/operator-runbook.md"
      provides: "v1.22 Rollback Procedure section per D-04/D-04a/D-04b"
  key_links:
    - from: ".github/workflows/ci.yml new step"
      to: "backend/tests/test_db_exclude_tables_directus_collections.py"
      via: "pytest invocation"
      pattern: "test_db_exclude_tables_directus_collections"
    - from: ".github/workflows/ci.yml new step"
      to: "asyncpg listener file with --workers 1 comment"
      via: "grep guard"
      pattern: "workers 1"
---

<objective>
Land CI guard additions for D-08 + SSE `--workers 1` invariant comment preservation (CLEAN-04), and write the v1.22 Rollback Procedure runbook section (CLEAN-03).

Purpose: Lock CLEAN-04 partial (CI guards) and fully satisfy CLEAN-03 (rollback verification documented).
Output: 2 new CI steps appended to ci.yml + new section appended to operator-runbook.md.

**Critical:** D-09a forbids consolidation of existing per-phase guards into a `guards.sh` script. Append new steps in the same shape as Phases 66-70 steps; do NOT refactor existing ones.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/71-fe-polish-clean/71-CONTEXT.md
@.planning/phases/71-fe-polish-clean/71-RESEARCH.md
@.github/workflows/ci.yml
@docs/operator-runbook.md
@scripts/ci/check_workers_one_invariant.sh

<interfaces>
Existing CI grep guard pattern (Phases 66-70 in `.github/workflows/ci.yml`) — small bash step under `jobs.<job>.steps`. Phase 71 mirrors this shape.

Existing `scripts/ci/check_workers_one_invariant.sh` (RESEARCH.md confirms presence) already greps for the literal `--workers 1` value. Phase 71 adds an additional check: the EXPLANATORY COMMENT must be preserved (not just the literal flag) so a future PR removing the comment but keeping the flag can't strip the invariant rationale.

Rollback runbook content is locked verbatim in RESEARCH.md "Example 3: Rollback section for docs/operator-runbook.md" (lines 552-611).

D-04b: rollback target = pre-Phase-68 commit (NOT pre-Phase-65). Runbook MUST note Phase 65 schema-additive limitation.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Append D-08 pytest + workers-1 comment guard steps to CI workflow</name>
  <files>.github/workflows/ci.yml</files>
  <read_first>
    - .github/workflows/ci.yml (entire — to find the right job + step ordering)
    - scripts/ci/check_workers_one_invariant.sh (existing complementary guard)
    - .planning/phases/71-fe-polish-clean/71-RESEARCH.md (D-09 + D-09a — no consolidation)
  </read_first>
  <action>
    Edit `.github/workflows/ci.yml`. Locate the section containing existing per-phase grep guard steps (Phase 66-70 — search for `name: 'Phase 66 guard'` or similar literal `Phase 7` strings to find the right job).

    Append TWO new steps in the SAME shape as the existing ones (do NOT modify existing steps — D-09a):

    Step A — D-08 pytest invocation (CLEAN-04):
    ```yaml
          - name: 'Phase 71 guard: DB_EXCLUDE_TABLES does not hide migrated Directus collections (D-08)'
            run: |
              cd backend
              pytest tests/test_db_exclude_tables_directus_collections.py -x -v
    ```
    Place this step in the same job that runs other pytest guards (the backend test job — find by looking for existing `pytest` invocations).

    Step B — SSE `--workers 1` invariant COMMENT preservation guard (CLEAN-04):

    First, identify the file that hosts the asyncpg listener with the `--workers 1` rationale comment. Per CONTEXT canonical_refs line 130: `backend/app/listen_bridge.py` (or wherever the asyncpg LISTEN consumer lives). Verify with:
    ```bash
    grep -rln "workers 1" backend/ docker-compose.yml | head -10
    ```
    Likely sites: `backend/Dockerfile` (CMD line), `docker-compose.yml`, the Python listener module.

    Once located, append this CI step (adjust `<file>` to the actual file path discovered):
    ```yaml
          - name: 'Phase 71 guard: SSE --workers 1 invariant comment preserved (CLEAN-04)'
            run: |
              # Asserts both the literal flag AND a rationale comment are present.
              # Existing scripts/ci/check_workers_one_invariant.sh covers the flag;
              # this step adds comment preservation so a future PR can't strip the
              # 'why' without tripping CI.
              if ! grep -E "workers 1" <file_with_flag>; then
                echo "FAIL: --workers 1 flag missing"; exit 1
              fi
              # Look for any explanatory comment within 3 lines of the flag.
              grep -B3 -A3 "workers 1" <file_with_flag> | grep -iE "(asyncpg|listen|invariant|single|SSE)" || {
                echo "FAIL: --workers 1 flag present but explanatory comment missing"
                echo "Add a comment near the --workers 1 flag explaining the asyncpg/SSE invariant."
                exit 1
              }
    ```

    If the file currently lacks an explanatory comment near the `--workers 1` flag, ADD one (e.g., in `backend/Dockerfile` near the CMD or in `docker-compose.yml` near the command directive):
    ```
    # SSE invariant: keep --workers 1. The asyncpg LISTEN bridge holds a
    # single long-lived connection in the FastAPI lifespan; multi-worker
    # would fan out duplicate notifications. See docs/architecture.md.
    ```

    Run `act` or push to a branch to verify the CI YAML parses (or use `yamllint .github/workflows/ci.yml` if available). At minimum, locally check syntax:
    ```bash
    python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
    ```
  </action>
  <verify>
    <automated>python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && grep -c "Phase 71 guard" .github/workflows/ci.yml</automated>
  </verify>
  <acceptance_criteria>
    - `.github/workflows/ci.yml` parses as valid YAML (python yaml.safe_load succeeds)
    - `grep -c "Phase 71 guard" .github/workflows/ci.yml` returns >= 2 (two new steps)
    - `grep "test_db_exclude_tables_directus_collections" .github/workflows/ci.yml` matches (D-08 pytest wired)
    - `grep "workers 1" .github/workflows/ci.yml` matches (workers-1 comment guard wired)
    - Existing Phase 66/67/68/69/70 guard step names are still present in ci.yml (no consolidation per D-09a)
    - The flag-bearing file (Dockerfile, docker-compose.yml, or listener module) contains both the literal `--workers 1` AND an explanatory comment within 3 lines
  </acceptance_criteria>
  <done>2 new CI steps appended; YAML valid; existing per-phase guards untouched; explanatory comment present near --workers 1 flag.</done>
</task>

<task type="auto">
  <name>Task 2: Append v1.22 Rollback Procedure section to operator-runbook.md</name>
  <files>docs/operator-runbook.md</files>
  <read_first>
    - docs/operator-runbook.md (entire — to find appropriate insertion point + match formatting style)
    - .planning/phases/71-fe-polish-clean/71-RESEARCH.md (Example 3: Rollback section verbatim — lines 552-611)
  </read_first>
  <action>
    Append a new top-level section `## v1.22 Rollback Procedure` to the END of `docs/operator-runbook.md` (or before any "Appendix" / "Reference" section if those exist — match existing structure).

    Use the EXACT content from RESEARCH.md "Example 3" (lines 552-611). Key required elements:

    1. **Rollback target statement:** "the commit immediately PRECEDING Phase 68" (per D-04b — NOT pre-Phase-65)
    2. **Phase 65 limitation note:** "Older targets — pre-Phase 65 — are NOT supported, because Phase 65 added Postgres triggers via Alembic that would need to be reverted manually (out of scope)."
    3. **Prerequisites** subsection (SSH, docker compose, admin Directus credentials)
    4. **6-step golden-path checklist** (per D-04):
       - Step 1: Checkout pre-Phase-68 commit (`git checkout <pre-phase-68-sha>`)
       - Step 2: `docker compose down -v && docker compose up -d --wait` (use `docker compose` v2 syntax per CLAUDE.md)
       - Step 3: Wait for healthchecks (`docker compose ps`)
       - Step 4: Log in as Admin
       - Step 5: Verify signage admin renders v1.21 shape (5 sub-checks: /signage/devices 7-column, /signage/playlists, pair one device, push one playlist, view sales dashboard)
    5. **Pass/Fail criteria:** "all 6 verifications green → v1.21 behavior restored. Fail → open issue + abort"
    6. **Known limitations** subsection (Phase 65 trigger residue + composite-PK 403)

    Use `docker compose` (v2, no hyphen) syntax throughout — CLAUDE.md project constraint.

    Verify the section is rendered: `grep -A1 "## v1.22 Rollback Procedure" docs/operator-runbook.md` should show the heading immediately followed by content.
  </action>
  <verify>
    <automated>grep -c "## v1.22 Rollback Procedure" docs/operator-runbook.md && grep -c "pre-phase-68" docs/operator-runbook.md && grep -c "docker compose down -v" docs/operator-runbook.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "## v1.22 Rollback Procedure" docs/operator-runbook.md` returns 1
    - `grep -ci "pre-phase-68\|preceding Phase 68" docs/operator-runbook.md` returns >= 1 (D-04b target)
    - `grep -c "docker compose down -v" docs/operator-runbook.md` returns >= 1 (v2 syntax, no hyphen)
    - `grep -c "docker-compose " docs/operator-runbook.md` returns 0 in the new section (no v1 hyphen syntax — verify via `grep -A60 "## v1.22 Rollback" docs/operator-runbook.md | grep "docker-compose "` returns nothing)
    - Section contains literal "Phase 65" with the "schema-additive" / "triggers" limitation note
    - Section enumerates all 5 verification sub-steps in step 5 (devices, playlists, pair, push, sales)
  </acceptance_criteria>
  <done>v1.22 Rollback Procedure section present in operator-runbook.md with 6-step checklist, D-04b commit target, Phase 65 limitation, docker compose v2 syntax.</done>
</task>

</tasks>

<verification>
- ci.yml parses as valid YAML
- 2 new "Phase 71 guard" steps present
- operator-runbook.md has the new rollback section with correct target commit + limitations
</verification>

<success_criteria>
CLEAN-03 (rollback verification documented) and CLEAN-04 (CI guards: D-08 pytest + workers-1 comment preservation) both mechanized.
</success_criteria>

<output>
After completion, create `.planning/phases/71-fe-polish-clean/71-06-SUMMARY.md`.
</output>
