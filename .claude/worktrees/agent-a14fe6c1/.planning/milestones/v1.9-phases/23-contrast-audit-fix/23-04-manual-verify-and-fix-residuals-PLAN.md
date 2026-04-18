---
phase: 23-contrast-audit-fix
plan: 04
type: execute
wave: 3
depends_on: ["23-03"]
files_modified:
  - frontend/src/index.css
  - .planning/phases/23-contrast-audit-fix/23-AUDIT.md
autonomous: false
requirements: [DM-09, DM-10]

must_haves:
  truths:
    - "Every delta badge state (positive/negative/zero/null) verified ≥4.5:1 via WebAIM in both modes"
    - "Every status badge variant (success/partial/failed) verified ≥4.5:1 via WebAIM in both modes"
    - "Recharts axis tick text + legend text + tooltip text verified ≥4.5:1 via WebAIM in both modes"
    - "Recharts ReferenceLine label (destructive color) verified ≥4.5:1 via WebAIM in both modes"
    - "All residual violations from AUDIT.md are addressed via token-first fixes (D-05) or last-resort per-component overrides (D-06)"
  artifacts:
    - path: ".planning/phases/23-contrast-audit-fix/23-AUDIT.md"
      provides: "Updated audit doc with WebAIM verification rows + fix annotations per finding"
      contains: "WebAIM"
    - path: "frontend/src/index.css"
      provides: "Any token adjustments needed for residual fixes (may be unchanged if zero residuals)"
  key_links:
    - from: ".planning/phases/23-contrast-audit-fix/23-AUDIT.md (post-Plan-03 findings)"
      to: "Token edits in frontend/src/index.css OR per-component overrides"
      via: "Each finding mapped to a fix per D-05 (token-first) or D-06 (component-last-resort)"
      pattern: "fix:"
---

<objective>
Close all remaining contrast gaps using the AUDIT.md findings from Plan 03 as input. Add manual WebAIM verification for elements axe cannot reliably evaluate: badge color combinations, Recharts SVG text (axis ticks, legend, tooltip, ReferenceLine label), and any chromatic destructive color uses.

Purpose: axe DevTools handles HTML text contrast well but is unreliable for SVG `<text>` inside Recharts and for evaluating exact ratios on chromatic colors. Manual WebAIM pass closes that gap. Then any failing element gets a token-first fix (D-05) or per-component override (D-06).

Output: Updated `23-AUDIT.md` with WebAIM rows for badges + Recharts text, and any required fixes applied to `frontend/src/index.css` (token-first) or component files (last-resort).

This plan contains a checkpoint because manual WebAIM verification requires a human reading colors via DevTools and entering them at https://webaim.org/resources/contrastchecker/.
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
@frontend/src/index.css
@frontend/src/lib/chartDefaults.ts
@frontend/src/components/dashboard/RevenueChart.tsx
@frontend/src/components/dashboard/HrKpiCharts.tsx
@frontend/src/components/dashboard/DeltaBadge.tsx
@frontend/src/components/UploadHistory.tsx
@frontend/src/components/settings/PersonioCard.tsx

<interfaces>
<!-- Targets requiring manual WebAIM verification (per RESEARCH.md §3 and §4): -->

DeltaBadge (DeltaBadge.tsx via deltaFormat.ts):
- positive: text-primary on card → light: 17.91:1 PASS, dark: 14.22:1 PASS (likely OK; verify)
- negative: text-destructive on card → CHROMATIC, must verify in both modes
- zero/null: text-muted-foreground on card → light: 4.73:1 (borderline), dark: 6.91:1 PASS

StatusBadge (UploadHistory.tsx):
- success: white on var(--color-success)=#15803d (post Plan 01) → 5.02:1 PASS (verify)
- partial: text-foreground on var(--color-warning)=#facc15 → 12.92:1 PASS (verify)
- failed: text-destructive-foreground on bg-destructive → CHROMATIC, must verify both modes

PersonioCard (PersonioCard.tsx):
- success: var(--color-success)=#15803d on card → light ~9:1 PASS, dark ~5.0:1 PASS (verify)
- error: text-destructive on card → CHROMATIC, must verify both modes

Recharts text (axis ticks, legend, tooltip text, ReferenceLine label):
- axis tick: --color-muted-foreground on actual rendered background (--card or --muted)
- legend: --color-muted-foreground on --card
- tooltip text: --color-popover-foreground on --color-popover (PASS pre-computed at 19.79:1 light / 17.16:1 dark)
- ReferenceLine label text: var(--color-destructive) on --card

<!-- WebAIM tool: https://webaim.org/resources/contrastchecker/ -->
<!-- Reading colors: Chrome DevTools → Inspect → Computed → fill / color / background-color -->
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Manual WebAIM verification for badges + Recharts text in both modes</name>
  <read_first>
    - .planning/phases/23-contrast-audit-fix/23-AUDIT.md (current state — Plan 03 output)
    - .planning/phases/23-contrast-audit-fix/23-RESEARCH.md §3 (Recharts strategy) + §4 (badge inventory)
  </read_first>
  <what-built>
    Plans 01-03 complete. AUDIT.md contains automated findings. This step adds manual verification rows for SVG/chromatic elements axe cannot reliably evaluate.
  </what-built>
  <action>
    Manual procedure for each item below — only feasible with a human operator (no headless equivalent for sampling DevTools computed colors and entering them at WebAIM):

    1. **Start dev server:** `cd frontend && npm run dev`. Open localhost:5173 in Chrome.

    2. **For each verification target** (list below), in BOTH light and dark mode:
       a. Navigate to the relevant route and ensure the element is rendered.
       b. Inspect the element in Chrome DevTools.
       c. Read the foreground color: from "Computed" panel → `color` (or `fill` for SVG `<text>`).
       d. Read the background color: from the parent container's computed `background-color`. (For SVG text, the background is the chart container's computed background.)
       e. Open https://webaim.org/resources/contrastchecker/ and enter both hex values.
       f. Append a row to AUDIT.md under a new section `### Manual WebAIM Verification — {Light|Dark}` with format:

          `| Element | FG hex | BG hex | Ratio | Required | Status |`

    3. **Verification targets:**

       Per route `/` (Sales) — light and dark:
       - DeltaBadge positive (text-primary)
       - DeltaBadge negative (text-destructive)
       - DeltaBadge zero/null (text-muted-foreground)
       - RevenueChart axis tick label (sample any visible `<text>` element on X or Y axis)
       - RevenueChart legend text
       - RevenueChart tooltip text (hover a bar to render)
       - RevenueChart ReferenceLine label (if visible — appears with prior-period overlay)

       Per route `/hr` — light and dark:
       - HrKpiCharts axis tick (sample one MiniChart `<text>`)
       - DeltaBadge variants (same three as above) on HR KPI cards

       Per route `/upload` — light and dark:
       - StatusBadge success (post Plan 01 fix) — should now PASS at 5.02:1
       - StatusBadge partial (warning yellow with foreground text)
       - StatusBadge failed (destructive)

       Per route `/settings` — light and dark:
       - PersonioCard success message (after a sync — may need to trigger one)
       - PersonioCard error message (if reproducible — otherwise note as "not rendered")

    4. **Combine** with Plan 03 axe findings to produce a unified `## Residuals to Fix` table at the bottom of AUDIT.md listing every element where the WebAIM ratio is below the required threshold (4.5:1 for normal text, 3:1 for large text/UI components per WCAG 2.1 AA).

    5. **If zero residuals across both axe AND WebAIM passes**, note this in the summary and resume by saying `approved — zero residuals`. Task 2 (residual fixes) becomes a no-op.

    Resume signal: type `approved` once WebAIM rows + Residuals table populated, OR `approved — zero residuals` if everything passes. If blocked (e.g., cannot trigger sync to test PersonioCard error state), describe the blocker.
  </action>
  <files>(human-driven; produces .planning/phases/23-contrast-audit-fix/23-AUDIT.md updates)</files>
  <verify>
    <automated>test -f .planning/phases/23-contrast-audit-fix/23-AUDIT.md</automated>
  </verify>
  <resume-signal>Type "approved" once WebAIM verification rows + Residuals table are added to AUDIT.md, or "approved — zero residuals" if no fixes needed</resume-signal>
  <acceptance_criteria>
    - `grep -c "WebAIM" .planning/phases/23-contrast-audit-fix/23-AUDIT.md` returns at least 2 (section headers for light + dark)
    - AUDIT.md contains a section `## Residuals to Fix` (may be empty body if zero residuals)
    - Every checked target above has either a row in the WebAIM section or an explicit "not rendered / N/A" note
  </acceptance_criteria>
  <done>AUDIT.md has WebAIM verification for all SVG/chromatic targets; Residuals table is the input for Task 2.</done>
</task>

<task type="auto">
  <name>Task 2: Apply token-first (D-05) or per-component (D-06) fixes for every residual in AUDIT.md</name>
  <files>frontend/src/index.css</files>
  <read_first>
    - .planning/phases/23-contrast-audit-fix/23-AUDIT.md `## Residuals to Fix` section
    - .planning/phases/23-contrast-audit-fix/23-CONTEXT.md D-05 (token-first), D-06 (per-component last resort), D-08/D-09 (mode-invariant shade adjust acceptable)
    - .planning/phases/23-contrast-audit-fix/23-RESEARCH.md §9 (fix patterns)
    - frontend/src/index.css (full file — to identify which token to adjust)
  </read_first>
  <action>
    Read the `## Residuals to Fix` section of `.planning/phases/23-contrast-audit-fix/23-AUDIT.md` produced by Task 1.

    **If the table is empty (zero residuals):** This task is a no-op. Append a single line to AUDIT.md under `## Residuals to Fix`:
    ```
    No residuals — all elements pass WCAG AA in both modes. No fixes applied in Task 2.
    ```
    Then exit successfully.

    **If residuals exist, for each row apply the fix decision tree below (per D-05 → D-06):**

    Decision tree per residual:
    1. **Identify the failing token pair.** From the WebAIM row, identify which CSS variable produces the FG and which produces the BG. Cross-reference RESEARCH.md §1 token inventory.
    2. **Try token-first (D-05):** Can the failure be fixed by adjusting the token value in `:root` (light) or `.dark` (dark) without breaking other surfaces that currently pass?
       - If the failure is in light mode only → adjust the token in `:root` only (e.g., darken `--muted-foreground` from oklch(0.556) toward oklch(0.45) for higher contrast on light backgrounds). Verify the change does not regress other consumers by re-checking AUDIT.md elements that share the token in light mode.
       - If the failure is in dark mode only → adjust the token in `.dark` only.
       - If the failure is in both modes and the color is mode-invariant (e.g., `--color-success`, `--color-warning`, `--color-destructive`) → adjust the shade in the `@theme` block per D-08, keeping hue identical (e.g., move from a Tailwind palette stop to the next darker/lighter one).
    3. **If token-first would break another passing surface (D-06):** apply a per-component override:
       - Open the specific component file
       - Replace the failing class with a non-failing alternative (e.g., `text-foreground` instead of `text-muted-foreground` for borderline cases on muted backgrounds; `text-white` instead of a chromatic foreground on dark backgrounds)
       - Add the file to `files_modified` in this PLAN's frontmatter retroactively (note in SUMMARY.md, do not edit PLAN frontmatter mid-execution)
    4. **For each fix, append a row** to AUDIT.md `## Residuals to Fix` table noting the fix type (TOKEN or COMPONENT), the file edited, before/after value, and re-checked WebAIM ratio.

    **Common fix recipes (apply mechanically when matching):**

    | Failing pattern | Fix recipe |
    |-----------------|-----------|
    | `--muted-foreground` on `--card` light = 4.73:1 borderline → fails in some axe runs | Darken light `--muted-foreground` from `oklch(0.556 0 0)` to `oklch(0.5 0 0)` in `:root` (raises ratio to ~5.6:1). Verify dark side unchanged. |
    | `--muted-foreground` on `--muted` light = 4.34:1 fail | Same as above (darken light `--muted-foreground` in `:root`). |
    | `--destructive` chromatic text fails on `--card` dark | Lighten `.dark --destructive` from `oklch(0.704 0.191 22.216)` toward `oklch(0.78 0.18 22.216)` (per D-09 — same hue 22.216, different lightness). Verify against `--card` dark. |
    | `--destructive` chromatic text fails on `--card` light | Darken `:root --destructive` from `oklch(0.577 0.245 27.325)` toward `oklch(0.5 0.24 27.325)`. |
    | Chart fill `--chart-prior` (=`--muted`) at 1.3:1 against dark `--background` (per RESEARCH.md §10 caveat) | Per RESEARCH.md §10 this is a SC 1.4.11 non-text contrast item for data-encoding. If flagged: define `.dark --chart-prior` as `oklch(0.45 0 0)` (lighter gray) so the prior-period series is distinguishable. Token-first edit in `.dark` block of `index.css`. |
    | `text-white` hardcode in a component file failing on a chromatic background | If chromatic bg can be darkened without regressing elsewhere → token fix in `@theme`. Otherwise per-component switch from `text-white` to `text-foreground` or appropriate token. |

    **Do NOT make speculative edits** — only fix items that appear in the Residuals table. If the table is empty, do nothing.
  </action>
  <verify>
    <automated>grep -E "## Residuals to Fix" .planning/phases/23-contrast-audit-fix/23-AUDIT.md</automated>
  </verify>
  <acceptance_criteria>
    - Either the Residuals table is empty AND AUDIT.md contains the `No residuals — all elements pass...` note, OR every row in the Residuals table has a corresponding fix annotation (TOKEN or COMPONENT, file edited, before/after, re-checked ratio)
    - If `frontend/src/index.css` was edited: `grep -n "oklch\\|#" frontend/src/index.css` shows changes localized to `:root`, `.dark`, or `@theme` blocks (no edits to `@theme inline` mappings)
    - `cd frontend && npx tsc --noEmit` produces no NEW errors
    - No new hardcoded color literals (`#xxxxxx`, `rgb()`) introduced into component files (re-run grep from RESEARCH.md §5)
  </acceptance_criteria>
  <done>Every residual from Task 1 has been addressed via token edit or component override; AUDIT.md documents each fix; no new contrast violations introduced.</done>
</task>

</tasks>

<verification>
- AUDIT.md `## Residuals to Fix` table is either empty (with explicit note) or every row has a documented fix
- `cd frontend && npx tsc --noEmit` produces no NEW errors
- Grep for hardcoded color literals in `frontend/src/` shows no NEW additions vs RESEARCH.md §5 baseline
</verification>

<success_criteria>
- WebAIM rows added to AUDIT.md for all badge + Recharts text targets in both modes
- Every residual identified in either axe (Plan 03) or WebAIM (Task 1) is fixed in Task 2
- Token-first fixes preferred (D-05); per-component overrides only where token would regress (D-06)
- Re-run of axe on any fixed route shows zero violations for the previously-failing element
</success_criteria>

<output>
After completion, create `.planning/phases/23-contrast-audit-fix/23-04-SUMMARY.md` documenting:
- Count of WebAIM rows added (per mode)
- Count of residuals found and fixed (TOKEN vs COMPONENT split)
- Any tokens whose values changed (with before/after)
- Any new files added to files_modified beyond the frontmatter list
</output>
