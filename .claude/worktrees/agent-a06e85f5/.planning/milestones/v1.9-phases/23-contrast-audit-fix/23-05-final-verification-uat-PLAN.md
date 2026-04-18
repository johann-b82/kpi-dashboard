---
phase: 23-contrast-audit-fix
plan: 05
type: execute
wave: 4
depends_on: ["23-04"]
files_modified:
  - .planning/phases/23-contrast-audit-fix/23-AUDIT.md
autonomous: false
requirements: [DM-09, DM-10]

must_haves:
  truths:
    - "Final automated re-scan reports zero contrast violations on all 4 routes in both modes"
    - "Grep for hardcoded color literals in frontend/src returns the known acceptable exceptions only (color.ts fallback, ColorPicker placeholder, dialog backdrop)"
    - "Bootstrap-splash visually verified: no white flash in dark mode"
    - "Phase passes the D-12 acceptance signal (axe 0 + WebAIM pass + grep clean)"
  artifacts:
    - path: ".planning/phases/23-contrast-audit-fix/23-AUDIT.md"
      provides: "Final 'Phase Pass' signoff section"
      contains: "Phase Pass"
  key_links:
    - from: "All prior plans (23-01..23-04) merged"
      to: ".planning/phases/23-contrast-audit-fix/23-AUDIT.md final signoff"
      via: "Re-run of axe + grep + visual verification"
      pattern: "Phase Pass"
---

<objective>
Final acceptance gate for Phase 23 — re-run automated audit against the fully-fixed baseline, confirm grep cleanliness, and close out the v1.9 milestone's accessibility loop.

Purpose: Verify D-12 acceptance signal — automated tool reports zero violations + WebAIM manual checks pass + no hardcoded color literals remain. Without this final pass, residual regressions could ship undetected.

Output: AUDIT.md updated with `## Phase Pass` section recording the final state; STATE.md unblocked for milestone close.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/23-contrast-audit-fix/23-CONTEXT.md
@.planning/phases/23-contrast-audit-fix/23-RESEARCH.md
@.planning/phases/23-contrast-audit-fix/23-AUDIT.md
@.planning/phases/23-contrast-audit-fix/23-01-token-and-badge-fixes-PLAN.md
@.planning/phases/23-contrast-audit-fix/23-02-bootstrap-splash-dark-mode-PLAN.md
@.planning/phases/23-contrast-audit-fix/23-04-manual-verify-and-fix-residuals-PLAN.md

<interfaces>
<!-- D-12 acceptance signal from CONTEXT.md: -->
- Automated tool reports zero contrast violations on all 4 routes in both modes
- Manual WebAIM verification confirms delta/status badges + Recharts text elements pass
- No hardcoded color literals remain in component files (grep-verified)

<!-- Acceptable exceptions from RESEARCH.md §5 (these may remain): -->
- frontend/index.html: pre-hydration IIFE color literals (now serve splash CSS variables — INTENDED)
- frontend/src/lib/color.ts lines 26, 30, 32: `#000000` functional fallbacks (not UI colors)
- frontend/src/components/ui/dialog.tsx line 32: `bg-black/10` decorative scrim (shadcn-generated, not text)
- frontend/src/components/settings/ColorPicker.tsx line 75: `#0066FF` placeholder attribute (not rendered as color)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Run grep for hardcoded color literals and verify only the acceptable exceptions remain</name>
  <files>.planning/phases/23-contrast-audit-fix/23-AUDIT.md</files>
  <read_first>
    - .planning/phases/23-contrast-audit-fix/23-RESEARCH.md §5 (Hardcoded Color Grep — baseline acceptable exceptions)
    - .planning/phases/23-contrast-audit-fix/23-AUDIT.md (current state from Plans 03-04)
  </read_first>
  <action>
    Run the following grep commands to inventory all color literals in `frontend/src` and `frontend/index.html`. Use the Bash tool.

    ```bash
    cd /Users/johannbechtold/Documents/acm-kpi-light
    grep -rEn "#[0-9a-fA-F]{3,8}|rgb\\(|hsl\\(|text-white|bg-white|text-black|bg-black" frontend/src --include="*.tsx" --include="*.ts" --include="*.css"
    grep -rEn "#[0-9a-fA-F]{3,8}" frontend/index.html
    ```

    Compare results against the acceptable-exceptions list (from RESEARCH.md §5 and Plan 02 IIFE additions):
    - `frontend/src/lib/color.ts` — `#000000` fallback (lines ~26, 30, 32) — ACCEPTABLE
    - `frontend/src/components/ui/dialog.tsx` — `bg-black/10` decorative scrim — ACCEPTABLE
    - `frontend/src/components/settings/ColorPicker.tsx` — `#0066FF` placeholder attribute — ACCEPTABLE
    - `frontend/src/index.css` — token definitions in `@theme`, `:root`, `.dark` blocks — ACCEPTABLE
    - `frontend/index.html` — IIFE splash hex literals (`#1a1a1a`, `#94a3b8`, `#ffffff`, `#64748b`) and CSS `var(..., fallback)` literals — ACCEPTABLE per Plan 02

    For each grep hit NOT on the acceptable list:
    - Open the file, identify the literal
    - Apply a token-first replacement (`text-foreground`, `bg-card`, `var(--color-*)`, etc.)
    - Re-run the grep until only the acceptable exceptions remain

    Append a `## Final Grep` section to `23-AUDIT.md` listing:
    ```
    ## Final Grep

    Acceptable exceptions:
    | File | Line | Literal | Reason |
    |------|------|---------|--------|
    | frontend/src/lib/color.ts | 26 | #000000 | Functional fallback in color parser |
    ...

    Unexpected literals: NONE (or list any found and fixed)
    ```

    If unexpected literals required a fix, document the file and replacement in the same section.
  </action>
  <verify>
    <automated>grep -rEn "#[0-9a-fA-F]{6}" frontend/src --include="*.tsx" --include="*.ts" | grep -vE "(color\\.ts|ColorPicker\\.tsx)" | wc -l | tr -d ' '</automated>
  </verify>
  <acceptance_criteria>
    - Above grep returns `0` (no unexpected hex literals in `.tsx`/`.ts` outside color.ts and ColorPicker.tsx)
    - `grep -rEn "text-white|bg-white|text-black" frontend/src --include="*.tsx"` returns no NEW additions vs RESEARCH.md §5 baseline (UploadHistory.tsx `text-white` should still be there — it sits on the now-darkened green and passes; this is intentional)
    - AUDIT.md contains the `## Final Grep` section with acceptable-exceptions table and an `Unexpected literals: NONE` (or fixed-list) line
    - `cd frontend && npx tsc --noEmit` produces no NEW errors vs Plan 21 baseline (SalesTable.tsx pre-existing errors remain out of scope)
  </acceptance_criteria>
  <done>Codebase has only the documented-acceptable color literals; AUDIT.md has the Final Grep signoff section.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Final UAT — re-run axe on all routes + visual verification + sign off Phase 23</name>
  <read_first>
    - .planning/phases/23-contrast-audit-fix/23-AUDIT.md (full file — Plans 03/04/Task 1 results)
    - .planning/phases/23-contrast-audit-fix/23-CONTEXT.md D-12 (acceptance signal)
  </read_first>
  <what-built>
    All Phase 23 fixes are in place:
    - Plan 01: `--color-success` darkened to #15803d; EmployeeTable active badge uses `text-foreground`
    - Plan 02: Bootstrap-splash respects theme via IIFE-set CSS variables
    - Plan 03: Automated audit recorded in AUDIT.md
    - Plan 04: WebAIM rows added; residuals fixed
    - Task 1 (this plan): Grep clean except for documented exceptions
  </what-built>
  <action>
    Final acceptance gate. A human operator runs the full audit one more time against the fully-fixed baseline.

    1. **Restart dev server** to ensure all changes are picked up:
       ```
       cd frontend && npm run dev
       ```

    2. **Re-run axe DevTools scan on all 4 routes × 2 modes** (8 passes — same procedure as Plan 03 Task 2):
       - For each route in `/`, `/hr`, `/upload`, `/settings`:
         - For each mode in light, dark:
           - Set theme via ThemeToggle, wait for full render
           - axe DevTools → "Scan All of My Page"
           - Confirm `0 color-contrast violations` reported
       - **Expected outcome:** All 8 passes report zero `color-contrast` violations.

    3. **Visual smoke checks:**
       - **Splash:** Set `localStorage.setItem('theme', 'dark')`, hard-refresh — splash background is dark, NOT a white flash. Then set `localStorage.setItem('theme', 'light')`, hard-refresh — splash is white. Then `localStorage.removeItem('theme')` and reload on a system with dark OS preference — splash follows OS (dark).
       - **Badges:** On `/upload`, observe StatusBadge variants in both modes — all clearly legible. On `/hr`, observe EmployeeTable active rows in both modes — text clearly contrasts the tinted background.
       - **Charts:** On `/`, observe RevenueChart axis labels, legend, tooltip text in both modes — all readable. On `/hr`, observe MiniChart axis text in both modes — readable.
       - **Personio sync:** Trigger a sync from `/settings`. Success message readable in both modes; error message (if reproducible) readable in both modes.

    4. **Append `## Phase Pass` section to AUDIT.md** with the following template:
       ```markdown
       ## Phase Pass

       **Signed off:** {date}
       **Method:** Re-ran axe DevTools across 4 routes × 2 modes + visual smoke + grep verification

       | Acceptance Criterion (D-12) | Status |
       |-----------------------------|--------|
       | axe reports 0 contrast violations across all routes in both modes | PASS |
       | WebAIM manual verification of badges + Recharts text in both modes | PASS |
       | No hardcoded color literals in component files (grep clean except documented exceptions) | PASS |
       | Bootstrap-splash respects theme (no white flash in dark mode) | PASS |

       Phase 23 closes the v1.9 milestone accessibility loop.
       ```

    5. **If any check fails:** describe the failure in the resume signal — Phase 23 returns to Plan 04 for additional fixes (do not type "approved" unless all four criteria PASS).

    Resume signal: type `approved` once all four D-12 criteria PASS and `## Phase Pass` is appended to AUDIT.md, OR describe failures.
  </action>
  <files>(human-driven; produces .planning/phases/23-contrast-audit-fix/23-AUDIT.md updates)</files>
  <verify>
    <automated>test -f .planning/phases/23-contrast-audit-fix/23-AUDIT.md</automated>
  </verify>
  <resume-signal>Type "approved" once all four D-12 criteria PASS, or describe failures</resume-signal>
  <acceptance_criteria>
    - `grep -c "## Phase Pass" .planning/phases/23-contrast-audit-fix/23-AUDIT.md` returns 1
    - All four D-12 acceptance criteria marked PASS in the Phase Pass table
    - All 8 axe scans (4 routes × 2 modes) reported zero `color-contrast` violations (recorded in the section)
  </acceptance_criteria>
  <done>Phase 23 is signed off; v1.9 milestone accessibility loop is closed; ROADMAP can mark Phase 23 complete.</done>
</task>

</tasks>

<verification>
- AUDIT.md contains `## Final Grep` and `## Phase Pass` sections
- Final axe scan reports zero violations on all 4 routes × 2 modes
- Visual smoke checks all pass (splash, badges, charts, sync messages)
- Grep clean except documented exceptions
</verification>

<success_criteria>
- D-12 acceptance signal achieved on all four criteria
- AUDIT.md is the canonical historical record for Phase 23 contrast work
- v1.9 milestone ready to close (DM-09 and DM-10 both verified PASSING)
</success_criteria>

<output>
After completion, create `.planning/phases/23-contrast-audit-fix/23-05-SUMMARY.md` documenting:
- Final axe violation count per route per mode (all should be 0)
- Confirmation grep clean except documented exceptions
- Signoff date and the four D-12 PASS markers
- Note that Phase 23 (and v1.9 milestone) accessibility loop is closed
</output>
