---
phase: 57-section-context-standardized-trashcan
plan: 11
type: execute
wave: 3
depends_on: [05, 06, 07, 08, 09, 10]
files_modified:
  - frontend/scripts/check-phase-57-guards.mts
  - package.json
autonomous: true
gap_closure: false
requirements: [SECTION-03, SECTION-04]

must_haves:
  truths:
    - "CI grep guard script exists and fails loudly on any window.confirm reintroduction"
    - "Guard fails on any import of retired feature-variant dialog names"
    - "Guard fails on any dark: variant in the three new primitives"
    - "Guard is wired into package.json scripts (npm run check-phase-57 or equivalent)"
    - "All acceptance greps from UI-SPEC §Dark Mode Invariant and §window.confirm eradication pass"
  artifacts:
    - path: "frontend/scripts/check-phase-57-guards.mts"
      provides: "CI-runnable script enforcing Phase 57 invariants post-merge"
      contains: "window.confirm"
  key_links:
    - from: "frontend/scripts/check-phase-57-guards.mts"
      to: "frontend/src/**"
      via: "ripgrep scans over frontend/src/ enforcing zero matches for banned patterns"
      pattern: "frontend/src"
---

<objective>
Lock in the four eradication invariants introduced this phase. Ship a CI
grep guard script that makes regressions impossible to merge silently.

Invariants to enforce (each a zero-match grep):
1. `window.confirm` in `frontend/src/` — D-08 eradication.
2. Import of any retired feature-variant dialog — `MediaDeleteDialog`,
   `ScheduleDeleteDialog`, `SensorRemoveDialog`, `SensorAdminHeader`,
   `DeleteConfirmDialog`.
3. `dark:` variants in the three new primitives — UI-SPEC §Dark Mode Invariant.
4. `font-semibold` in the three new primitives — typography harmonization gate.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/57-section-context-standardized-trashcan/57-UI-SPEC.md
@.planning/phases/57-section-context-standardized-trashcan/57-RESEARCH.md
@frontend/scripts/check-locale-parity.mts
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write CI grep guard script</name>
  <files>frontend/scripts/check-phase-57-guards.mts</files>
  <action>
    Create a TypeScript (stripped) Node script mirroring the style of
    `frontend/scripts/check-locale-parity.mts`. Run four ripgrep invocations
    via `child_process.execFileSync('rg', [...])` (or equivalent) and exit
    non-zero on any violation.

    Guard set:
    1. `rg -n 'window\.confirm' frontend/src` → must return nothing (exit 1).
       If matches found, print file:line for each and fail.
    2. `rg -n '(MediaDeleteDialog|ScheduleDeleteDialog|SensorRemoveDialog|SensorAdminHeader|DeleteConfirmDialog)' frontend/src`
       → must return nothing.
    3. `rg -n 'dark:' frontend/src/components/ui/section-header.tsx frontend/src/components/ui/delete-dialog.tsx frontend/src/components/ui/delete-button.tsx`
       → must return nothing.
    4. `rg -n 'font-semibold' frontend/src/components/ui/section-header.tsx frontend/src/components/ui/delete-dialog.tsx frontend/src/components/ui/delete-button.tsx`
       → must return nothing.
    5. Invoke `check-locale-parity.mts` as a child process (or import+call).
       Must exit 0. Belt-and-suspenders for SECTION-02 since multiple Wave 2
       plans touch i18n and we want parity enforced as part of the guard suite.

    Exit code 0 on all-green; 1 on any failure. Print PHASE-57 GUARDS OK on success.

    Handle rg's exit-code-1-on-no-match semantics: rg returns 1 when there
    are NO matches, 0 when matches exist. Our script INVERTS that — 0
    matches = success, ≥1 match = failure. Use try/catch around execFileSync
    with `stdio: 'pipe'`, and inspect stdout/exit code carefully.

    Hint: Node child_process `execFileSync('rg', [...])` throws on non-zero
    exit. So `try { execFileSync(...) } catch { /* no matches = good */ }`
    is the success path for grep guards.

    Commit: `feat(57-11): add CI grep guards script for Phase 57 invariants`.
  </action>
  <verify>
    <automated>node --experimental-strip-types frontend/scripts/check-phase-57-guards.mts</automated>
  </verify>
  <done>
    - Script exists
    - Running it prints "PHASE-57 GUARDS OK" and exits 0
    - If I temporarily add `window.confirm` somewhere, script fails with a clear file:line
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire guard into package.json scripts</name>
  <files>package.json</files>
  <action>
    Check whether project uses root `package.json` or `frontend/package.json`
    for npm scripts (mirror check-locale-parity wiring). Add an npm script
    entry:

    ```json
    "check-phase-57": "node --experimental-strip-types frontend/scripts/check-phase-57-guards.mts"
    ```

    Also, if a combined `check` / `lint` / `ci` script exists, add
    `check-phase-57` into its chain so CI runs it automatically. If there's
    no combined script, a standalone entry is acceptable.

    Run `npm run check-phase-57` (from the correct dir) → prints
    "PHASE-57 GUARDS OK".

    Commit: `chore(57-11): wire check-phase-57 into npm scripts`.
  </action>
  <verify>
    <automated>cd frontend 2>/dev/null; (npm run check-phase-57 || npm --prefix frontend run check-phase-57) 2>&1 | tail -5</automated>
  </verify>
  <done>
    - `npm run check-phase-57` (or `npm --prefix frontend run check-phase-57`) exits 0
    - PHASE-57 GUARDS OK printed
  </done>
</task>

</tasks>

<verification>
- `node --experimental-strip-types frontend/scripts/check-phase-57-guards.mts` exits 0
- All four invariants enforced
- npm script wired
- Final phase-wide grep sanity check:
  - `rg "window\.confirm" frontend/src/` → 0 matches
  - `rg "MediaDeleteDialog|ScheduleDeleteDialog|SensorRemoveDialog|SensorAdminHeader|DeleteConfirmDialog" frontend/src/` → 0 matches
  - `rg "dark:" frontend/src/components/ui/{section-header,delete-dialog,delete-button}.tsx` → 0 matches
</verification>

<success_criteria>
1. Guard script exits 0 with "PHASE-57 GUARDS OK"
2. npm run check-phase-57 wired
3. All four invariants provably zero
4. Parity check (from 57-04) still PARITY OK
</success_criteria>

<output>
After completion, create `.planning/phases/57-section-context-standardized-trashcan/57-11-SUMMARY.md`
</output>
