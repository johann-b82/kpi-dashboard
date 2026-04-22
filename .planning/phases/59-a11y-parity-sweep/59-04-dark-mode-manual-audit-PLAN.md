---
phase: 59-a11y-parity-sweep
plan: 4
type: execute
wave: 2
depends_on:
  - 59-01-locale-parity-tooling
  - 59-02-focus-ring-convergence
  - 59-03-ci-guards-color-aria
files_modified:
  - .planning/phases/59-a11y-parity-sweep/59-VERIFICATION.md
autonomous: false
requirements:
  - A11Y-02
  - A11Y-03

must_haves:
  truths:
    - "Every v1.19-touched UI surface has a dark-mode screenshot attached to 59-VERIFICATION.md."
    - "Any surface where focus-ring is not visible in dark mode, or where contrast fails WCAG AA on text, is flagged as a defect with file path + observation (becomes gap-closure input)."
    - "The audit checklist enumerates surfaces by file path from the D-01 scope list; no scope creep into untouched routes."
  artifacts:
    - path: ".planning/phases/59-a11y-parity-sweep/59-VERIFICATION.md"
      provides: "Per-surface audit results with dark-mode screenshots (D-06 evidence artifact)."
      contains: "## Audit Checklist"
  key_links:
    - from: ".planning/phases/59-a11y-parity-sweep/59-VERIFICATION.md"
      to: "frontend/src/**/*.tsx (v1.19 surface list)"
      via: "Checklist entries keyed by file path"
      pattern: "frontend/src/"
---

<objective>
Execute the D-06 manual dark-mode audit across every v1.19-touched UI surface. Attach a dark-mode screenshot per surface to `59-VERIFICATION.md`. Flag any focus-ring-invisible or contrast-regression findings as defects so they feed a gap-closure sweep.

Wave 2 — runs AFTER Plans 01/02/03 land so Toggle focus ring is visible and CI guards have already confirmed no hardcoded literals.

Purpose: Evidence gate for A11Y-02 + A11Y-03 per D-06.
Output: `59-VERIFICATION.md` with completed checklist, screenshots, defect log.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/59-a11y-parity-sweep/59-CONTEXT.md
@.planning/phases/59-a11y-parity-sweep/59-RESEARCH.md

<interfaces>
<!-- D-01 scope list — canonical, from RESEARCH.md §v1.19 Surface Inventory. -->

Routable surfaces (must each get a dark-mode screenshot):
  1. / (App launcher)              — LauncherPage.tsx
  2. /sales                        — SubHeader Sales/HR Toggle + SalesTable + RevenueChart
  3. /hr                           — HrKpiCharts + EmployeeTable
  4. /sensors                      — SensorsPage (SubHeader date-range + PollNowButton; body)
  5. /settings                     — PersonioCard + ColorPicker + LogoUpload
  6. /settings/sensors             — SensorsSettingsPage (SectionHeader + SensorRowForm + SnmpWalkCard)
  7. /signage                      — SignagePage shell + sub-nav
  8. /signage/media                — MediaPage + MediaInUseDialog + MediaUploadDropZone + MediaRegisterUrlDialog
  9. /signage/playlists            — PlaylistsPage (DeleteButton)
 10. /signage/playlists/:id        — PlaylistEditorPage + PlaylistItemList + MediaPickerDialog + TagPicker
 11. /signage/schedules            — SchedulesPage + ScheduleEditDialog
 12. /signage/devices              — DevicesPage + DeviceEditDialog + UptimeBadge + WeekdayCheckboxRow
 13. Top chrome (always visible)   — NavBar + Breadcrumb + UserMenu + LanguageToggle + ThemeToggle + SubHeader
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold 59-VERIFICATION.md checklist template</name>
  <files>.planning/phases/59-a11y-parity-sweep/59-VERIFICATION.md</files>
  <read_first>
    - .planning/phases/59-a11y-parity-sweep/59-CONTEXT.md §D-06
    - .planning/phases/59-a11y-parity-sweep/59-RESEARCH.md §Methodology (Dark-mode manual audit)
  </read_first>
  <action>
    Create `.planning/phases/59-a11y-parity-sweep/59-VERIFICATION.md` with EXACTLY this content (it becomes the scratchpad the human auditor fills in during Task 2):

    ```markdown
    # Phase 59 Verification — Dark-mode + Focus Audit

    **Audit date:** <YYYY-MM-DD to fill>
    **Auditor:** <user to fill>
    **Tooling:** `npm run check:phase-59` (all gates green at audit start)

    ## Automated Gates (from Plans 01/02/03)
    - [ ] `npm run check:i18n-parity` exits 0 (paste stdout last line below)
    - [ ] `npm run check:i18n-du-tone` exits 0
    - [ ] `npm run check:phase-59-guards` exits 0
    - [ ] `npm test -- --run src/components/ui/toggle.test.tsx` exits 0

    ## Audit Checklist (13 surfaces)

    Legend: [x] = audited and passing, [ ] = pending or defect filed.

    - [ ] `/` (LauncherPage): focus=___, contrast=___, screenshot=___
    - [ ] `/sales` (SubHeader + SalesTable + RevenueChart): focus=___, contrast=___, screenshot=___
    - [ ] `/hr` (HrKpiCharts + EmployeeTable): focus=___, contrast=___, screenshot=___
    - [ ] `/sensors` (SubHeader date-range + PollNowButton + body): focus=___, contrast=___, screenshot=___
    - [ ] `/settings` (PersonioCard + ColorPicker + LogoUpload): focus=___, contrast=___, screenshot=___
    - [ ] `/settings/sensors` (SensorsSettingsPage): focus=___, contrast=___, screenshot=___
    - [ ] `/signage` (SignagePage shell): focus=___, contrast=___, screenshot=___
    - [ ] `/signage/media` (MediaPage + dialogs): focus=___, contrast=___, screenshot=___
    - [ ] `/signage/playlists` (PlaylistsPage): focus=___, contrast=___, screenshot=___
    - [ ] `/signage/playlists/:id` (PlaylistEditorPage + dialogs): focus=___, contrast=___, screenshot=___
    - [ ] `/signage/schedules` (SchedulesPage + dialog): focus=___, contrast=___, screenshot=___
    - [ ] `/signage/devices` (DevicesPage + dialog): focus=___, contrast=___, screenshot=___
    - [ ] Top chrome (NavBar + Breadcrumb + UserMenu + LanguageToggle + ThemeToggle + SubHeader): focus=___, contrast=___, screenshot=___

    ## Defects

    (If none, write "None — all surfaces pass.")

    | # | Surface | Observation | Severity | Follow-up |
    |---|---------|-------------|----------|-----------|
    |   |         |             |          |           |

    ## Out-of-scope observations

    Per D-01 / Pitfall 1: a11y issues on routes NOT in the 13-surface list go here — do NOT expand the audit. Log for future milestone planning.

    ## Resume signal

    Type "approved" to close Phase 59, or list defects for gap-closure planning via `/gsd:plan-phase 59 --gaps`.
    ```
  </action>
  <verify>
    <automated>test -f .planning/phases/59-a11y-parity-sweep/59-VERIFICATION.md && grep -c '\- \[ \]' .planning/phases/59-a11y-parity-sweep/59-VERIFICATION.md</automated>
  </verify>
  <acceptance_criteria>
    - File exists at `.planning/phases/59-a11y-parity-sweep/59-VERIFICATION.md`.
    - `grep -c '\- \[ \]' .planning/phases/59-a11y-parity-sweep/59-VERIFICATION.md` returns `>= 17` (4 automated + 13 surfaces).
    - `grep -c '## Audit Checklist' .planning/phases/59-a11y-parity-sweep/59-VERIFICATION.md` returns `1`.
    - `grep -c '## Defects' .planning/phases/59-a11y-parity-sweep/59-VERIFICATION.md` returns `1`.
    - `grep -c '## Out-of-scope observations' .planning/phases/59-a11y-parity-sweep/59-VERIFICATION.md` returns `1`.
  </acceptance_criteria>
  <done>
    VERIFICATION.md scaffold exists, contains all 13 surface rows + 4 automated-gate rows + defect table + out-of-scope section.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Manual dark-mode + focus audit across 13 v1.19 surfaces</name>
  <files>.planning/phases/59-a11y-parity-sweep/59-VERIFICATION.md</files>
  <read_first>
    - .planning/phases/59-a11y-parity-sweep/59-VERIFICATION.md (scaffold from Task 1)
    - .planning/phases/59-a11y-parity-sweep/59-CONTEXT.md §D-06 (audit method)
    - .planning/phases/59-a11y-parity-sweep/59-RESEARCH.md §Methodology §Common Pitfalls (1)
  </read_first>
  <what-built>
    Plans 59-01/02/03 have landed:
    - `npm run check:phase-59` passes (locale parity + du-tone + color/aria guards).
    - Toggle primitive has a focus-visible ring (Path A convergence).
    - Checkbox + Badge converged to Path A focus-ring.
    - VERIFICATION.md scaffold is on disk (from Task 1) ready to be filled in.
  </what-built>
  <how-to-verify>
    1. Run the four automated gates and tick them off in the `## Automated Gates` section of `59-VERIFICATION.md`:
       - `cd frontend && npm run check:i18n-parity`
       - `cd frontend && npm run check:i18n-du-tone`
       - `cd frontend && npm run check:phase-59-guards`
       - `cd frontend && npm test -- --run src/components/ui/toggle.test.tsx`

    2. Start the dev server: `cd frontend && npm run dev`.

    3. Toggle to dark mode via the header ThemeToggle.

    4. For each of the 13 surfaces in the checklist:
       a. Navigate to the route.
       b. Take a full-viewport dark-mode screenshot. Save under `.planning/phases/59-a11y-parity-sweep/screenshots/<route-slug>.png`.
       c. Tab through every interactive element once. Confirm a focus ring is visible on each. Record `focus=OK` or `focus=DEFECT: <one-liner>`.
       d. Visually check text contrast, dialog surfaces, border visibility in dark mode. Record `contrast=OK` or `contrast=DEFECT: <one-liner>`.
       e. Fill the `screenshot=<path>` slot with the screenshot path.
       f. If both pass, flip the `[ ]` to `[x]`.

    5. Log any DEFECT as a row in the `## Defects` table. Do not fix defects inside this plan — they feed `/gsd:plan-phase 59 --gaps`.

    6. Scope guardrail: If you notice an a11y issue on a route NOT in the 13-surface list (e.g., `/docs`, `/login`), record in `## Out-of-scope observations` and move on. Do NOT expand the audit (Pitfall 1).

    7. When every row is `[x]` OR has an associated defect row, type "approved" to close Phase 59. If defects exist, run `/gsd:plan-phase 59 --gaps` before closing.
  </how-to-verify>
  <action>
    This is a human-verify checkpoint. Claude's automation: run the four `npm` gates and paste outputs into the Automated Gates section. Then hand off to the user for the 13-surface browser pass. Fill in defect rows and flip checkboxes as the user dictates findings.
  </action>
  <verify>
    <automated>grep -c '\- \[x\]' .planning/phases/59-a11y-parity-sweep/59-VERIFICATION.md</automated>
  </verify>
  <done>
    Every surface row in `59-VERIFICATION.md` is either `[x]` or has a row in the `## Defects` table. User types "approved" or lists defects for gap-closure follow-up.
  </done>
  <acceptance_criteria>
    - `grep -c '\- \[x\]' .planning/phases/59-a11y-parity-sweep/59-VERIFICATION.md` returns `>= 17` when fully approved (all 4 gates + all 13 surfaces), OR defect rows explain each missing `[x]`.
    - Every surface row that remains `[ ]` has a matching entry in the `## Defects` table.
    - At least 13 screenshot files referenced in the `screenshot=___` slots actually exist on disk (`ls` each path).
    - User supplies the resume signal: "approved" OR an explicit defect list routed into `/gsd:plan-phase 59 --gaps`.
  </acceptance_criteria>
  <resume-signal>Type "approved" to close Phase 59, or list defects for `/gsd:plan-phase 59 --gaps`.</resume-signal>
</task>

</tasks>

<verification>
- `.planning/phases/59-a11y-parity-sweep/59-VERIFICATION.md` exists and contains the filled-in checklist.
- Every unchecked row has a defect entry.
- At least 13 screenshot files on disk at the paths referenced.
</verification>

<success_criteria>
1. Dark-mode + focus-ring evidence attached for every D-01 in-scope surface.
2. All A11Y-01/02/03 automated gates are green AND user has eyes-on-verified each surface.
3. Any defect produces a clear follow-up path (gap-closure plan or deferred item) — never a silent pass.
</success_criteria>

<output>
After approval, create `.planning/phases/59-a11y-parity-sweep/59-04-SUMMARY.md` using the summary template, linking to the completed VERIFICATION.md.
</output>
