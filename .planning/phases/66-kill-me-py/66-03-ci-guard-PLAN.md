---
phase: 66-kill-me-py
plan: 03
type: execute
wave: 2
depends_on: [66-01]
files_modified:
  - .github/workflows/ci.yml
autonomous: true
requirements: [MIG-AUTH-03]

must_haves:
  truths:
    - "A CI step runs `grep -rn '\"/api/me\"' frontend/src/` and fails the build on any match"
    - "The guard runs before the `Bring up stack` step — fast fail, zero stack time when regressing"
    - "On the post-Phase-66 tree the guard step exits 0 (no matches)"
  artifacts:
    - path: ".github/workflows/ci.yml"
      provides: "CI workflow with /api/me grep guard step"
      contains: "/api/me"
  key_links:
    - from: ".github/workflows/ci.yml"
      to: "frontend/src/"
      via: "grep -rn '\"/api/me\"' frontend/src/"
      pattern: "grep -rn '\"/api/me\"'"
---

<objective>
Add a pre-stack grep step to `.github/workflows/ci.yml` that fails if any `"/api/me"` literal (double-quoted) reappears anywhere under `frontend/src/`. This is Phase 66's regression guard for MIG-AUTH-03.

Purpose: Prevent any future PR from reintroducing `apiClient("/api/me")` call sites once Plans 66-01 / 66-02 land.
Output: One new step in `ci.yml`, runs early (before `Bring up stack`), exits 0 on the post-phase tree.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/66-kill-me-py/66-CONTEXT.md
@.github/workflows/ci.yml

<interfaces>
<!-- Existing pre-stack fast-fail step pattern (line 41-42 in ci.yml) -->
```yaml
- name: "Pydantic-vs-shell allowlist parity (pre-stack, <1s)"
  run: cd backend && pytest tests/signage/test_permission_field_allowlists.py -v
```
<!-- The new step should mirror this shape: descriptive name, pre-stack placement, single-line run. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add /api/me grep guard step to ci.yml</name>
  <read_first>
    - .github/workflows/ci.yml (entire file — 160 lines, for exact step placement)
    - .planning/phases/66-kill-me-py/66-CONTEXT.md (D-12 — exact grep command; D-13 — guard exit semantics)
  </read_first>
  <files>.github/workflows/ci.yml</files>
  <behavior>
    - A new step named `"Guard — no /api/me in frontend (MIG-AUTH-03)"` runs under the `ci` job.
    - The step runs BEFORE `Bring up stack` (around line 67) and AFTER `Write test .env` (line 47-61) — so it lives in the pre-stack fast-fail group alongside the existing Pydantic allowlist parity step.
    - The step's shell command is: `if grep -rn '"/api/me"' frontend/src/; then exit 1; else exit 0; fi`.
    - On the post-Phase-66 tree the step exits 0 (greps for `"/api/me"` in `frontend/src/` return no matches).
    - On a regression (someone adds `apiClient("/api/me")` back), the step prints the offending lines and exits 1.
  </behavior>
  <action>
    Edit `.github/workflows/ci.yml`. The file currently has 14 steps; the new step becomes pre-stack fast-fail step #4 (after "Set up Python" / "Install backend Python deps" / "Pydantic-vs-shell allowlist parity" / "Write test .env" and BEFORE "Bring up stack").

    Insert the following block between the "Write test .env" step (ends at line 61 with `EOF` and the closing backtick) and the existing `# -----` separator comment that precedes "Bring up stack" at line 63:

    ```yaml
          # -----------------------------------------------------------------------
          # Phase 66 MIG-AUTH-03: CI guard — fail on any `"/api/me"` reference in
          # frontend/src/. `me.py` was deleted; AuthContext reads identity via
          # directus.request(readMe(...)). D-12 defines the exact literal-string
          # grep. Runs pre-stack so regressions fail in <1s.
          # -----------------------------------------------------------------------
          - name: "Guard — no /api/me in frontend (MIG-AUTH-03)"
            run: |
              if grep -rn '"/api/me"' frontend/src/; then
                echo "ERROR: /api/me reference found in frontend/src/ (Phase 66 MIG-AUTH-03 — use directus.request(readMe(...)) instead)"
                exit 1
              fi
              echo "OK: no /api/me references in frontend/src/"
    ```

    Notes:
    - Preserve YAML indentation: steps are indented 6 spaces (`      - name:`). The `run: |` block is indented 8 spaces, its body 10 spaces, per the existing file's convention (see the existing "Bring up stack" block at line 67-69).
    - The literal inside `grep` is single-quoted-shell wrapping a double-quoted JS literal: `'"/api/me"'`. Do NOT convert to single quotes — the point is to match `"/api/me"` (with the JS double-quotes), not stray mentions in prose.
    - Do NOT add `--include='*.ts' --include='*.tsx'` — the whole `frontend/src/` tree is TS/TSX/CSS; broadening to all files is intentional (catches comments in any source).
    - Do NOT replace the existing "Pydantic-vs-shell allowlist parity" step. Keep both pre-stack guards.
    - Do NOT move any existing step.

    After the edit, the step order in the `ci` job becomes:
    1. Checkout
    2. Set up Python
    3. Install backend Python deps
    4. Pydantic-vs-shell allowlist parity (pre-stack, <1s)
    5. Write test .env
    6. **NEW: Guard — no /api/me in frontend (MIG-AUTH-03)**
    7. Bring up stack
    8. Run migrations
    9. ... (rest unchanged)
  </action>
  <verify>
    <automated>grep -c 'Guard — no /api/me in frontend' .github/workflows/ci.yml && grep -q "grep -rn '\"/api/me\"' frontend/src/" .github/workflows/ci.yml && (if grep -rn '"/api/me"' frontend/src/; then exit 1; else exit 0; fi)</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c 'Guard — no /api/me in frontend (MIG-AUTH-03)' .github/workflows/ci.yml` returns 1.
    - `grep -F "grep -rn '\"/api/me\"' frontend/src/" .github/workflows/ci.yml` returns at least one matching line.
    - `grep -c 'MIG-AUTH-03' .github/workflows/ci.yml` returns >= 1.
    - `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` exits 0 (valid YAML).
    - The new step appears BEFORE the line `run: docker compose up -d --wait` in the file (i.e., it runs pre-stack). Verify with:
      `awk '/Guard — no \/api\/me/{a=NR} /docker compose up -d --wait/{b=NR} END{exit (a && b && a<b) ? 0 : 1}' .github/workflows/ci.yml` exits 0.
    - Running the guard command locally against the post-phase tree exits 0:
      `if grep -rn '"/api/me"' frontend/src/; then exit 1; else exit 0; fi`
    - The existing pre-stack step is untouched: `grep -c 'Pydantic-vs-shell allowlist parity' .github/workflows/ci.yml` still returns 1.
  </acceptance_criteria>
  <done>
    `.github/workflows/ci.yml` contains a pre-stack step named `"Guard — no /api/me in frontend (MIG-AUTH-03)"` that greps `"/api/me"` under `frontend/src/` and fails on any match. YAML is valid, step ordering is correct, and the guard passes against the current post-Phase-66 tree.
  </done>
</task>

</tasks>

<verification>
- `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` exits 0.
- The new grep step runs before `docker compose up -d --wait` in the workflow (awk ordering check above).
- Guard command executed against the current tree (after Plans 66-01 + 66-02) exits 0.
- Inject a synthetic violation locally (e.g., `echo 'const x = "/api/me";' > /tmp/fake.ts && cp /tmp/fake.ts frontend/src/__fake_me.ts && grep -rn '"/api/me"' frontend/src/ && rm frontend/src/__fake_me.ts`) — grep finds it, confirming the pattern would trip on regression. Remove the synthetic file before completion.
</verification>

<success_criteria>
- One new CI step exists, runs pre-stack, uses the exact D-12 grep pattern.
- Workflow YAML is syntactically valid and the step ordering is correct.
- Against the post-Phase-66 tree the step passes (0 matches).
</success_criteria>

<output>
After completion, create `.planning/phases/66-kill-me-py/66-03-SUMMARY.md`.
</output>
