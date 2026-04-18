---
phase: 23-contrast-audit-fix
plan: 03
type: execute
wave: 2
depends_on: ["23-01", "23-02"]
files_modified:
  - .planning/phases/23-contrast-audit-fix/23-AUDIT.md
autonomous: false
requirements: [DM-09, DM-10]

must_haves:
  truths:
    - "Every route in both modes has been scanned by an automated WCAG AA tool"
    - "All violations (or zero-violation result) are recorded with element selector, FG/BG colors, ratio, required threshold"
    - "AUDIT.md exists in the phase directory and is the canonical source for Plan 04 manual verification"
  artifacts:
    - path: ".planning/phases/23-contrast-audit-fix/23-AUDIT.md"
      provides: "Per-route per-mode contrast audit findings table"
      contains: "| Element | Selector | FG color | BG color | Ratio | Required | Status |"
  key_links:
    - from: "Live dev server (npm run dev)"
      to: ".planning/phases/23-contrast-audit-fix/23-AUDIT.md"
      via: "axe DevTools scan results recorded by human operator"
      pattern: "axe DevTools"
---

<objective>
Run the chosen automated accessibility tool (axe DevTools per RESEARCH.md §2 recommendation) against all 4 routes (`/`, `/hr`, `/upload`, `/settings`) in both light and dark mode (8 passes total) AGAINST THE FIXED BASELINE produced by Plans 01 and 02. Produce `23-AUDIT.md` documenting every violation (or zero-violation result per route/mode).

Purpose: Catch any contrast failures NOT pre-identified in RESEARCH.md (which only flagged the deterministic ones). The audit runs against the fixed baseline so the report is a clean diff showing residual gaps only.

Output: `.planning/phases/23-contrast-audit-fix/23-AUDIT.md` — the canonical findings document feeding Plan 04 (manual WebAIM + fix-residuals).

This plan contains a checkpoint because the audit requires a human operator running axe DevTools in a real browser — there is no headless CLI equivalent that produces the same coverage of dynamic React state per RESEARCH.md §2 rationale.
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
@.planning/phases/23-contrast-audit-fix/23-01-token-and-badge-fixes-PLAN.md
@.planning/phases/23-contrast-audit-fix/23-02-bootstrap-splash-dark-mode-PLAN.md

<interfaces>
<!-- Recipe verbatim from 23-RESEARCH.md §2 — rationale for axe DevTools choice: -->
- Runs in browser against live rendered DOM — catches dynamic React state (badges, charts, modals)
- Inline element highlighting + fix suggestions
- Works on dev server (no Docker rebuild)
- Free tier at axe.deque.com/axe-devtools

<!-- Per-pass procedure (8 passes total): -->
For route in ['/', '/hr', '/upload', '/settings']:
  For mode in ['light', 'dark']:
    1. Open localhost:5173/<route> in Chrome
    2. Click ThemeToggle to set the desired mode
    3. Wait for full render (no loading spinners; data loaded if applicable)
    4. Open axe DevTools extension → "Scan All of My Page"
    5. Record violations: element selector, rule ID, actual ratio, required ratio
    6. Append row to AUDIT.md
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold 23-AUDIT.md with empty per-route per-mode tables</name>
  <files>.planning/phases/23-contrast-audit-fix/23-AUDIT.md</files>
  <read_first>
    - .planning/phases/23-contrast-audit-fix/23-RESEARCH.md §2 (audit deliverable format)
    - .planning/phases/23-contrast-audit-fix/23-CONTEXT.md (D-03 routes, D-04 cross-route components)
  </read_first>
  <action>
    Create `.planning/phases/23-contrast-audit-fix/23-AUDIT.md` with the following exact structure (replace `{date}` with today's date):

    ```markdown
    # Phase 23: Contrast Audit Findings

    **Audited:** {date}
    **Tool:** axe DevTools browser extension (Chrome, free tier)
    **Baseline:** Post Plans 23-01 + 23-02 (token darkened, splash fixed)
    **Scope:** 4 routes × 2 modes = 8 passes, plus cross-route components (NavBar, SubHeader, ThemeToggle, LanguageToggle, bootstrap-splash) recorded inline per route.

    ## Audit Method

    1. Run `cd frontend && npm run dev`
    2. Open Chrome with axe DevTools extension installed
    3. For each row below: navigate, set mode via ThemeToggle, wait for render, click "Scan All of My Page", record each violation as a row in the route table.
    4. Zero violations → write `(no violations)` in the table body.

    ## Findings

    ### Route: `/` (Sales dashboard) — Light mode

    | Element | Selector | FG color | BG color | Ratio | Required | Status |
    |---------|----------|----------|----------|-------|----------|--------|
    |         |          |          |          |       |          |        |

    ### Route: `/` (Sales dashboard) — Dark mode

    | Element | Selector | FG color | BG color | Ratio | Required | Status |
    |---------|----------|----------|----------|-------|----------|--------|
    |         |          |          |          |       |          |        |

    ### Route: `/hr` (HR dashboard) — Light mode

    | Element | Selector | FG color | BG color | Ratio | Required | Status |
    |---------|----------|----------|----------|-------|----------|--------|
    |         |          |          |          |       |          |        |

    ### Route: `/hr` (HR dashboard) — Dark mode

    | Element | Selector | FG color | BG color | Ratio | Required | Status |
    |---------|----------|----------|----------|-------|----------|--------|
    |         |          |          |          |       |          |        |

    ### Route: `/upload` — Light mode

    | Element | Selector | FG color | BG color | Ratio | Required | Status |
    |---------|----------|----------|----------|-------|----------|--------|
    |         |          |          |          |       |          |        |

    ### Route: `/upload` — Dark mode

    | Element | Selector | FG color | BG color | Ratio | Required | Status |
    |---------|----------|----------|----------|-------|----------|--------|
    |         |          |          |          |       |          |        |

    ### Route: `/settings` — Light mode

    | Element | Selector | FG color | BG color | Ratio | Required | Status |
    |---------|----------|----------|----------|-------|----------|--------|
    |         |          |          |          |       |          |        |

    ### Route: `/settings` — Dark mode

    | Element | Selector | FG color | BG color | Ratio | Required | Status |
    |---------|----------|----------|----------|-------|----------|--------|
    |         |          |          |          |       |          |        |

    ## Summary

    | Route | Light violations | Dark violations |
    |-------|-----------------|----------------|
    | `/`        |  |  |
    | `/hr`      |  |  |
    | `/upload`  |  |  |
    | `/settings`|  |  |
    | **Total**  |  |  |

    ## Notes

    - All findings here will be addressed in Plan 23-04 (manual WebAIM verification + residual fixes).
    - Recharts SVG text elements may not be fully covered by axe — Plan 23-04 includes manual WebAIM pass on chart text.
    ```

    Use the Write tool. Do NOT add additional sections — Plan 04 will append diagnosis/fix notes inline.
  </action>
  <verify>
    <automated>test -f .planning/phases/23-contrast-audit-fix/23-AUDIT.md && grep -c "Route:" .planning/phases/23-contrast-audit-fix/23-AUDIT.md</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/23-contrast-audit-fix/23-AUDIT.md` exists
    - `grep -c "^### Route:" .planning/phases/23-contrast-audit-fix/23-AUDIT.md` returns 8 (4 routes × 2 modes)
    - `grep -c "| Element | Selector | FG color | BG color | Ratio | Required | Status |" .planning/phases/23-contrast-audit-fix/23-AUDIT.md` returns 8
    - File contains the `## Summary` table with all 4 route rows
  </acceptance_criteria>
  <done>Empty audit findings file scaffolded with all 8 route×mode tables and summary placeholder.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: Human runs axe DevTools across 4 routes × 2 modes and fills AUDIT.md</name>
  <read_first>
    - .planning/phases/23-contrast-audit-fix/23-AUDIT.md (the scaffolded file from Task 1)
    - .planning/phases/23-contrast-audit-fix/23-RESEARCH.md §2 (full procedure)
  </read_first>
  <what-built>
    Plans 23-01 (token darken + EmployeeTable fix) and 23-02 (splash dark mode) are merged. The dev server can be started and inspected. AUDIT.md scaffold is in place ready to receive findings.
  </what-built>
  <action>
    This step requires a human operator with Chrome and the axe DevTools extension installed because no headless CLI matches axe's coverage of live React state.

    Steps:

    1. **Start dev server (if not already running):**
       ```
       cd frontend && npm run dev
       ```
       Open `http://localhost:5173` in Chrome with axe DevTools extension installed.

    2. **For each of the 8 passes (4 routes × 2 modes):**
       a. Navigate to the route (`/`, `/hr`, `/upload`, `/settings`).
       b. Use the navbar ThemeToggle to set the desired mode (light or dark).
       c. Wait for full render — no spinners, all data loaded. For `/upload`, having at least one prior upload in history makes badges visible. For `/hr`, sync data should be loaded.
       d. Open Chrome DevTools → axe DevTools tab → click "Scan All of My Page".
       e. For each violation reported with rule ID `color-contrast` (or `color-contrast-enhanced`):
          - Note the element selector (axe shows it inline)
          - Note the FG color, BG color, computed ratio, and required ratio (axe shows all four)
          - Append a row to the corresponding `### Route: ... — {mode}` table in `23-AUDIT.md`
       f. If zero color-contrast violations on the route, write a single row: `| (no violations) | — | — | — | — | — | PASS |`

    3. **After all 8 passes complete, fill in the `## Summary` table** with violation counts.

    4. **Special attention items (per RESEARCH.md §7 Known-Risk Shortlist):**
       - `/upload` light + dark: confirm StatusBadge "success" pill is now PASSING (post Plan 01 token fix — should be 5.02:1)
       - `/hr` light + dark: confirm EmployeeTable active badge is PASSING (post Plan 01 EmployeeTable fix)
       - `/` light: check axis tick labels in RevenueChart — research suspected `muted-foreground` on `card` may be borderline (~4.73:1)
       - All routes: confirm bootstrap-splash does NOT flash white in dark mode (visual, refresh page in dark mode)

    5. **If axe finds zero violations across all 8 passes**, that is the success outcome — proceed by typing `approved` and Plan 04 can short-circuit (only manual WebAIM pass for badges/Recharts will then be needed).

    Resume with: type `approved` once AUDIT.md is fully populated (all 8 tables have content — either violation rows or `(no violations)` markers), OR describe issues that prevent completing the audit.
  </action>
  <files>(human-driven; produces .planning/phases/23-contrast-audit-fix/23-AUDIT.md updates)</files>
  <verify>
    <automated>test -f .planning/phases/23-contrast-audit-fix/23-AUDIT.md</automated>
  </verify>
  <resume-signal>Type "approved" once 23-AUDIT.md is fully populated, or describe blockers</resume-signal>
  <acceptance_criteria>
    - `.planning/phases/23-contrast-audit-fix/23-AUDIT.md` has every per-route per-mode table populated (no empty body rows)
    - The `## Summary` table has integer counts (or zeros) for each route in each mode
    - All `color-contrast` violations from axe scans are recorded as rows
    - Bootstrap-splash visually verified to NOT flash white in dark mode (note recorded if applicable)
  </acceptance_criteria>
  <done>AUDIT.md is the canonical findings document; Plan 04 can act on it.</done>
</task>

</tasks>

<verification>
- AUDIT.md exists with 8 populated tables + summary
- All special attention items from "Known-Risk Shortlist" have explicit PASS/FAIL annotations
</verification>

<success_criteria>
- AUDIT.md fully populated with axe scan results from all 4 routes × 2 modes
- Pre-confirmed fixes from Plans 01/02 verified PASSING in their respective routes
- Findings ready for Plan 04 to manually verify (WebAIM) and fix any residuals
</success_criteria>

<output>
After completion, create `.planning/phases/23-contrast-audit-fix/23-03-SUMMARY.md` documenting:
- Total violations found per route per mode
- Whether pre-confirmed fixes (token darken, splash) verified PASSING
- Any unexpected findings beyond RESEARCH.md predictions
</output>
