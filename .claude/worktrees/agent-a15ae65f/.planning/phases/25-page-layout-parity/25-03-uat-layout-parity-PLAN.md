---
phase: 25-page-layout-parity
plan: 03
type: execute
wave: 2
depends_on: ["25-01", "25-02"]
files_modified: []
autonomous: false
requirements: [UC-10]
must_haves:
  truths:
    - "Sales dashboard (/) has no visual regressions vs. pre-Phase-25 baseline"
    - "HR dashboard (/hr) has no visual regressions vs. pre-Phase-25 baseline"
    - "/upload container width is visually indistinguishable from / and /hr"
    - "/settings container width is visually indistinguishable from / and /hr"
    - "DropZone and UploadHistory read as side-by-side on wide viewports and stack on narrow"
    - "Delta labels still read correctly in both DE and EN across month, quarter, year granularities"
    - "Sticky ActionBar on /settings still clears the last card (pb-32 working)"
    - "Padding rhythm (pt-4 pb-8) and vertical spacing (space-y-8) feel consistent across all four pages"
  artifacts:
    - path: ".planning/phases/25-page-layout-parity/25-03-uat-layout-parity-SUMMARY.md"
      provides: "Human UAT signoff closing UC-10"
  key_links:
    - from: "human operator"
      to: "all four pages at multiple viewport widths and both locales"
      via: "manual visual inspection"
      pattern: "approved"
---

<objective>
Run human UAT across all four pages (`/`, `/hr`, `/upload`, `/settings`) at wide and narrow viewports, in both DE and EN, to confirm container parity, no dashboard regressions, no broken delta labels (Phase 24 survival), and that `/upload`'s new two-column body reads correctly.

Purpose: UC-10 (human UAT signoff for v1.10 layout parity).
Output: SUMMARY.md recording approval or itemized regression list.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/25-page-layout-parity/25-CONTEXT.md
@.planning/phases/25-page-layout-parity/25-01-upload-container-and-grid-SUMMARY.md
@.planning/phases/25-page-layout-parity/25-02-settings-container-SUMMARY.md
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Human UAT — container parity, dashboard no-regression, delta label survival</name>
  <files>.planning/phases/25-page-layout-parity/25-03-uat-layout-parity-SUMMARY.md</files>
  <read_first>
    - .planning/phases/25-page-layout-parity/25-CONTEXT.md (the locked container tokens)
    - .planning/phases/25-page-layout-parity/25-01-upload-container-and-grid-SUMMARY.md
    - .planning/phases/25-page-layout-parity/25-02-settings-container-SUMMARY.md
  </read_first>
  <action>
CHECKPOINT — human verification. Claude must PAUSE here, present the `<what-built>` summary and the numbered `<how-to-verify>` checklist verbatim to the operator, wait for the operator's response, then write SUMMARY.md with the outcome. No code changes in this task.

**What was built (present to operator):**

Plan 01 swapped `/upload` to `max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8` and restructured the body into a responsive two-column grid (DropZone left, UploadHistory right at `lg+`, stacked below) with ErrorList full-width above and `<Separator className="my-8" />` preserved between.

Plan 02 swapped `/settings` main wrapper to `max-w-7xl mx-auto px-6 pt-4 pb-32 space-y-8` (pb-32 preserved for sticky ActionBar clearance) and the error-state fallback to `max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8`. No inner 5xl cap. Cards expand with wrapper. Individual input `max-w-md` constraints preserved.

Dashboards (`/` and `/hr`) were not touched — they are the reference.

**How to verify (operator walks this checklist):**

Start the app locally and walk through this checklist at **two viewport widths** (wide: ~1440px browser window; narrow: ~768px or DevTools "iPad" preset) and **both locales** (DE and EN — toggle via LanguageToggle in the navbar).

1. **Container parity (UC-06, UC-07):** Visit `/`, `/hr`, `/upload`, `/settings` in sequence on the wide viewport. Visually confirm the outer content column has the same left/right gutter and same max width on all four pages. (If you open DevTools and inspect the outermost content `<div>`, it should have `max-w-7xl` on all four.) Spot-check: on wide viewport the content on every page starts at the same X-pixel from the left edge.

2. **Upload body layout (UC-08):** On `/upload` at wide viewport: DropZone is left, UploadHistory is right, with an `8`-unit gap. The `history_title` heading sits above the UploadHistory column (not above the Separator). Resize to narrow: they stack vertically — DropZone first, UploadHistory below. Upload a valid file: entry appears in the UploadHistory column on the right; DropZone remains in place. Upload an invalid file (or stub one): ErrorList appears full-width above the `<Separator />`, NOT inside either column.

3. **Separator preserved on /upload (CONTEXT decision #3):** The horizontal divider line is still visible between the error surface (top) and the two-column body (bottom).

4. **Settings sticky ActionBar + inputs (UC-07 + CONTEXT decision #2):** On `/settings`: scroll to the bottom — ActionBar sticks to the viewport bottom and the last card (HrTargetsCard) does NOT get overlapped. Scroll up — nothing is clipped. The app-name input and Personio URL input still render with a sensible readable width (not stretched to 7xl). All cards (Identity, Colors, Personio, HrTargets) render at the new wider container — no inner 5xl cap anywhere.

5. **Padding rhythm consistency (UC-09):** Top padding above the first h1 / KpiCardGrid feels equal on `/`, `/hr`, `/upload`, `/settings`. Vertical rhythm between sibling blocks reads consistent (not visibly tighter/looser) across pages.

6. **Dashboard no-regression (UC-10):** `/` and `/hr` look identical to before — KpiCardGrid, RevenueChart, SalesTable, HrKpiCardGrid, HrKpiCharts, EmployeeTable all render as before.

7. **Delta label survival across Phase 24 → Phase 25 (UC-10):** Switch between granularities (month, quarter, year) on Sales KPI cards and HR KPI cards. EN: badges read `vs. prev. month` / `vs. prev. quarter` / `vs. prev. year`. DE: badges read `vs. Vormonat` / `vs. Vorquartal` / `vs. Vorjahr`. Confirm both Sales and HR dashboards show the same wording shape.

8. **Both locales:** Repeat the relevant container checks (`/upload`, `/settings`) in both DE and EN — no layout-shift or label-cropping surprises in either.

If any step fails, write up the specific page + viewport + locale + observed vs. expected, and reply with that list instead of `approved`.

**Resume signal:** Operator replies `approved` to signoff UC-10, or lists regressions in the form `[page] [viewport] [locale]: [observed] (expected: [expected])`.

After operator responds, write `.planning/phases/25-page-layout-parity/25-03-uat-layout-parity-SUMMARY.md` recording: operator response verbatim, viewports tested, locales tested, any regressions and their disposition (fix via `--gaps`, defer, or waive).
  </action>
  <acceptance_criteria>
    - Operator responds `approved` — or lists specific regressions with page + viewport + locale
    - If regressions found: each regression recorded in SUMMARY with a mitigation decision (fix now via `--gaps` plan, defer, waive)
    - SUMMARY.md file exists at `.planning/phases/25-page-layout-parity/25-03-uat-layout-parity-SUMMARY.md` with operator response, viewports tested, locales tested
  </acceptance_criteria>
  <verify>
    <automated>test -f .planning/phases/25-page-layout-parity/25-03-uat-layout-parity-SUMMARY.md</automated>
  </verify>
  <done>
Operator signed off UC-10 (or all regressions triaged) and SUMMARY.md written.
  </done>
</task>

</tasks>

<verification>
Operator-driven. The `<automated>` check only confirms SUMMARY was written; the actual acceptance decision is in the operator's `approved` response captured inside that SUMMARY.
</verification>

<success_criteria>
UC-10 signed off — operator responds `approved` (or all listed regressions are triaged and a follow-up `--gaps` plan or waiver is recorded in SUMMARY).
</success_criteria>

<output>
After completion, `.planning/phases/25-page-layout-parity/25-03-uat-layout-parity-SUMMARY.md` records: operator response verbatim, viewports tested, locales tested, any regressions and their disposition.
</output>
