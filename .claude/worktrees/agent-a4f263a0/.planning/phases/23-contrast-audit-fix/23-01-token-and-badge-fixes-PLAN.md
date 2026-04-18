---
phase: 23-contrast-audit-fix
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/index.css
  - frontend/src/components/dashboard/EmployeeTable.tsx
  - frontend/src/components/UploadHistory.tsx
autonomous: true
requirements: [DM-09, DM-10]

must_haves:
  truths:
    - "StatusBadge success variant (white text on green) passes 4.5:1 in both modes"
    - "EmployeeTable active-status badge passes 4.5:1 in both modes"
    - "PersonioCard success text passes 4.5:1 on dark card (auto-fixed by token darkening)"
  artifacts:
    - path: "frontend/src/index.css"
      provides: "Darkened --color-success token"
      contains: "--color-success: #15803d"
    - path: "frontend/src/components/dashboard/EmployeeTable.tsx"
      provides: "Active badge using text-foreground (D-06 per-component override)"
      contains: "text-foreground"
    - path: "frontend/src/components/UploadHistory.tsx"
      provides: "Success StatusBadge consuming new --color-success"
      contains: "bg-[var(--color-success)]"
  key_links:
    - from: "frontend/src/index.css @theme block"
      to: "frontend/src/components/UploadHistory.tsx StatusBadge success"
      via: "var(--color-success) CSS variable"
      pattern: "var\\(--color-success\\)"
    - from: "frontend/src/index.css @theme block"
      to: "frontend/src/components/settings/PersonioCard.tsx success text"
      via: "var(--color-success) CSS variable"
      pattern: "var\\(--color-success\\)"
---

<objective>
Apply the three pre-confirmed contrast fixes identified in 23-RESEARCH.md sections 4 + 9 — exact failures with computed ratios and exact target values.

Purpose: Address the known WCAG AA contrast failures BEFORE the audit pass (Plan 03) runs, so the audit reports against the fixed baseline and only surfaces residuals.

Output: Updated `--color-success` token (token-first per D-05), per-component override on EmployeeTable active badge (D-06 last resort — same-color tinted pattern cannot be fixed via token), and StatusBadge success variant verified against the new token.
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
@frontend/src/index.css
@frontend/src/components/UploadHistory.tsx
@frontend/src/components/dashboard/EmployeeTable.tsx
@frontend/src/components/settings/PersonioCard.tsx

<interfaces>
<!-- Token source-of-truth from frontend/src/index.css @theme block (line 8-15): -->
```css
@theme {
  --color-primary: #2563eb;
  --color-destructive: #dc2626;
  --color-success: #16a34a;     /* current — Tailwind green-600 */
  --color-chart-current: var(--primary);
  --color-chart-prior: var(--muted);
  --color-warning: #facc15;
}
```

<!-- Pre-computed contrast (from 23-RESEARCH.md §4): -->
- StatusBadge success: white text on `#16a34a` = 3.30:1 → FAIL (needs 4.5:1)
- StatusBadge success: white text on `#15803d` (green-700) = 5.02:1 → PASS
- EmployeeTable active: `#16a34a` text on `#16a34a`/20 background = 2.64:1 light, 3.55:1 dark → FAIL both
- PersonioCard success: `#16a34a` on dark card ≈ 3.60:1 → FAIL dark
- PersonioCard success: `#15803d` on dark card ≈ 5.0:1 → PASS

<!-- Per D-08/D-09: same hue, different lightness is acceptable. #15803d is same green hue as #16a34a, one shade darker. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Darken --color-success token from green-600 to green-700 (D-05 token-first fix per D-08)</name>
  <files>frontend/src/index.css</files>
  <read_first>
    - frontend/src/index.css (the @theme block at lines 8-15)
    - .planning/phases/23-contrast-audit-fix/23-RESEARCH.md §4 (badge inventory) and §9 Example A (the exact before/after)
    - .planning/phases/23-contrast-audit-fix/23-CONTEXT.md D-08 (shade adjustment justification)
  </read_first>
  <action>
    Edit `frontend/src/index.css` line 11 (inside the `@theme { ... }` block, lines 8-15).

    Before:
    ```css
    --color-success: #16a34a;
    ```

    After:
    ```css
    --color-success: #15803d;
    ```

    Rationale (do not include as a comment unless project style requires it): Tailwind green-700, same green hue as previous green-600, one shade darker. White-on-#15803d = 5.02:1 (PASS 4.5:1). Fixes StatusBadge success variant in UploadHistory.tsx and PersonioCard success text on dark card automatically. Per D-05 (global token edit preferred) and D-08 (shade adjustment of identical hue is acceptable to make a mode-invariant color pass in both modes).

    Do NOT touch any other tokens in this file. Do NOT modify the `:root` or `.dark` blocks. The success color is mode-invariant per D-07/D-08 (same color in both modes).
  </action>
  <verify>
    <automated>grep -n "color-success" frontend/src/index.css | grep -q "#15803d"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "color-success" frontend/src/index.css` shows exactly one match: `--color-success: #15803d;`
    - No occurrences of `#16a34a` remain in `frontend/src/index.css` (`grep -c "#16a34a" frontend/src/index.css` returns 0)
    - The `@theme` block remains structurally intact (still has `--color-primary`, `--color-destructive`, `--color-warning`, `--color-chart-current`, `--color-chart-prior`)
    - File still parses (start dev server or run `cd frontend && npx tsc --noEmit` does not error on CSS imports)
  </acceptance_criteria>
  <done>`--color-success` token equals `#15803d`; no `#16a34a` literals remain in index.css; downstream consumers (`var(--color-success)`) automatically pick up the new value.</done>
</task>

<task type="auto">
  <name>Task 2: Fix EmployeeTable active-status badge text color (D-06 per-component override)</name>
  <files>frontend/src/components/dashboard/EmployeeTable.tsx</files>
  <read_first>
    - frontend/src/components/dashboard/EmployeeTable.tsx (lines 130-140 — the badge ternary)
    - .planning/phases/23-contrast-audit-fix/23-RESEARCH.md §4 part C (EmployeeTable failure analysis) and §9 Example B (fix pattern)
    - .planning/phases/23-contrast-audit-fix/23-CONTEXT.md D-06 (per-component override is last-resort justification)
  </read_first>
  <action>
    Edit `frontend/src/components/dashboard/EmployeeTable.tsx` line 135 (inside the active-status badge className ternary).

    Before (line 134-136):
    ```tsx
    row.status === "active"
      ? "bg-[var(--color-success)]/20 text-[var(--color-success)]"
      : "bg-muted text-muted-foreground"
    ```

    After:
    ```tsx
    row.status === "active"
      ? "bg-[var(--color-success)]/20 text-foreground"
      : "bg-muted text-muted-foreground"
    ```

    Why D-06 override (not a token fix): the pattern `text-[var(--color-success)]` on `bg-[var(--color-success)]/20` is text-on-tinted-version-of-itself — fundamentally low-contrast at any green shade. Token darkening alone cannot fix it. `text-foreground` resolves to near-black in light mode (~17:1 on light tinted green) and near-white in dark mode (~12:1 on dark tinted green) — both PASS. Per D-06, accepted as last-resort per-component override since the token fix breaks no other surface.

    Do NOT change the `inactive` arm (`bg-muted text-muted-foreground` already passes — light: ~6.2:1, dark: 6.91:1). Do NOT modify the `bg-[var(--color-success)]/20` background — the colored-tint visual cue is the design intent.
  </action>
  <verify>
    <automated>grep -n "text-foreground" frontend/src/components/dashboard/EmployeeTable.tsx | grep -q "color-success"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "text-\\[var(--color-success)\\]" frontend/src/components/dashboard/EmployeeTable.tsx` returns 0 matches (the failing pattern is gone)
    - `grep -n "bg-\\[var(--color-success)\\]/20 text-foreground" frontend/src/components/dashboard/EmployeeTable.tsx` returns exactly 1 match
    - The inactive arm `bg-muted text-muted-foreground` is unchanged (`grep -c "bg-muted text-muted-foreground" frontend/src/components/dashboard/EmployeeTable.tsx` returns at least 1)
    - `cd frontend && npx tsc --noEmit` produces no NEW errors (pre-existing SalesTable.tsx errors per Phase 21 deferred-items.md are out of scope)
  </acceptance_criteria>
  <done>EmployeeTable active badge uses `text-foreground` instead of `text-[var(--color-success)]`; tinted green background preserved; both modes pass 4.5:1.</done>
</task>

<task type="auto">
  <name>Task 3: Verify StatusBadge success variant inherits the token fix (no code change expected)</name>
  <files>frontend/src/components/UploadHistory.tsx</files>
  <read_first>
    - frontend/src/components/UploadHistory.tsx (lines 19-26 — the success Badge return)
    - .planning/phases/23-contrast-audit-fix/23-RESEARCH.md §4 part B (StatusBadge analysis)
  </read_first>
  <action>
    Open `frontend/src/components/UploadHistory.tsx` and inspect lines 19-26. The success variant is:
    ```tsx
    <Badge className="bg-[var(--color-success)] text-white hover:bg-[var(--color-success)]">
    ```

    With Task 1's token change (`--color-success` → `#15803d`), this now resolves to white-on-#15803d = 5.02:1 (PASS 4.5:1). NO CODE CHANGE NEEDED for this component — it inherits the fix automatically.

    Verify by reading the file: confirm the className still references `var(--color-success)` (not a hardcoded green hex) and uses `text-white`. If — and only if — the className has drifted from this pattern (e.g., contains a hardcoded `bg-green-XXX`), document it and update to the token reference.

    Do NOT add inline comments. Do NOT touch the `partial` (warning) or `failed` (destructive) variants — they are out of scope for this task (warning was already verified PASS at 12.92:1 per RESEARCH.md §4B; destructive needs WebAIM verification in Plan 04).
  </action>
  <verify>
    <automated>grep -n "bg-\\[var(--color-success)\\] text-white" frontend/src/components/UploadHistory.tsx | wc -l | tr -d ' '</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "bg-\\[var(--color-success)\\] text-white" frontend/src/components/UploadHistory.tsx` returns at least 1
    - No occurrences of literal green hex codes (`#16a34a`, `#15803d`) inside `frontend/src/components/UploadHistory.tsx` (`grep -E "#(16a34a|15803d)" frontend/src/components/UploadHistory.tsx` returns nothing)
    - File compiles: `cd frontend && npx tsc --noEmit` produces no NEW errors related to this file
  </acceptance_criteria>
  <done>StatusBadge success variant references `var(--color-success)` (now resolves to #15803d); no hardcoded green; success variant now passes 4.5:1 white-on-green in both modes.</done>
</task>

</tasks>

<verification>
After all three tasks:

1. `grep -n "#16a34a" frontend/src/` should return zero matches (token darkened, no leftover literals)
2. Open dev server (`cd frontend && npm run dev`), navigate to `/upload`, upload any file, observe success Badge — white text on darker green should be clearly legible
3. Navigate to `/hr`, view EmployeeTable — active row badges show colored-tint background with dark text (light mode) or light text (dark mode) — clearly legible in both modes
4. Navigate to `/settings`, trigger a Personio sync — success message text on card background should be clearly legible in both modes (token fix propagates automatically)
</verification>

<success_criteria>
- `--color-success` is `#15803d` in `frontend/src/index.css` @theme block
- EmployeeTable active badge uses `text-foreground`, not `text-[var(--color-success)]`
- StatusBadge success variant unchanged in code (inherits token fix)
- No `#16a34a` literals remain anywhere in `frontend/src/`
- `cd frontend && npx tsc --noEmit` produces no NEW errors (pre-existing SalesTable.tsx errors out of scope)
</success_criteria>

<output>
After completion, create `.planning/phases/23-contrast-audit-fix/23-01-SUMMARY.md` documenting:
- Token before/after value
- Per-component override applied (EmployeeTable) with D-06 justification
- Confirmation StatusBadge required no code change
</output>
