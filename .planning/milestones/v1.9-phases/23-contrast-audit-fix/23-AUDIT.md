# Phase 23: Contrast Audit Findings

**Audited:** 2026-04-14
**Tool:** axe DevTools browser extension (Chrome, free tier)
**Baseline:** Post Plans 23-01 + 23-02 (token darkened, splash fixed)
**Scope:** 4 routes × 2 modes = 8 passes, plus cross-route components (NavBar, SubHeader, ThemeToggle, LanguageToggle, bootstrap-splash) recorded inline per route.

## Audit Method

1. Run `cd frontend && npm run dev`
2. Open Chrome with axe DevTools extension installed
3. For each row below: navigate, set mode via ThemeToggle, wait for render, click "Scan All of My Page", record each violation as a row in the route table.
4. Zero violations → write `(no violations)` in the table body.

## Findings

**Status:** Automated axe DevTools pass SKIPPED by operator on 2026-04-14. D-12's automated-tool criterion is therefore deferred to Plan 23-05's final re-run (or explicitly waived there). Manual WebAIM verification in Plan 23-04 and the final grep/re-run in Plan 23-05 become the primary acceptance evidence for DM-09/DM-10 on this run.

| Pass | Route | Mode | Result |
|------|-------|------|--------|
| 1 | `/`         | Light | (skipped) |
| 2 | `/`         | Dark  | (skipped) |
| 3 | `/hr`       | Light | (skipped) |
| 4 | `/hr`       | Dark  | (skipped) |
| 5 | `/upload`   | Light | (skipped) |
| 6 | `/upload`   | Dark  | (skipped) |
| 7 | `/settings` | Light | (skipped) |
| 8 | `/settings` | Dark  | (skipped) |

## Summary

| Route | Light violations | Dark violations |
|-------|-----------------|----------------|
| `/`         | (skipped) | (skipped) |
| `/hr`       | (skipped) | (skipped) |
| `/upload`   | (skipped) | (skipped) |
| `/settings` | (skipped) | (skipped) |
| **Total**   | (skipped) | (skipped) |

## WebAIM Manual Verification

**Status:** SKIPPED by operator on 2026-04-14.

Neither automated (Plan 23-03 axe) nor manual (Plan 23-04 WebAIM) verification was performed. Phase 23's DM-09/DM-10 acceptance now rests entirely on:
1. The deterministic token/component fixes in Plans 23-01 and 23-02 (pre-computed to pass from RESEARCH.md).
2. Grep cleanliness check in Plan 23-05.
3. Operator's trust-based signoff.

This is a documented **D-12 waiver** — phase ships without automated or manual contrast evidence.

## Residuals to Fix

None enumerated — no verification pass was run. Any residual contrast failures discovered post-v1.9 must be fixed in a future phase.

## Notes

- Both automated (Plan 23-03) and manual (Plan 23-04) passes skipped at operator request.
- Plan 23-05 becomes a code-cleanliness + trust gate rather than a contrast-evidence gate.
- Pre-computed ratios from RESEARCH.md §9 remain the strongest evidence that Plan 23-01's fixes land correctly.

## Final Grep

**Run date:** 2026-04-14
**Commands:**
```
grep -rEn "#[0-9a-fA-F]{3,8}|rgb\(|hsl\(|text-white|bg-white|text-black|bg-black" frontend/src --include="*.tsx" --include="*.ts" --include="*.css"
grep -rEn "#[0-9a-fA-F]{3,8}" frontend/index.html
```

**Verification (unexpected hex literals in .tsx/.ts outside color.ts and ColorPicker.tsx):**
```
grep -rEn "#[0-9a-fA-F]{6}" frontend/src --include="*.tsx" --include="*.ts" | grep -vE "(color\.ts|ColorPicker\.tsx)" | wc -l
```
Result: `0`

**Acceptable exceptions:**

| File | Line | Literal | Reason |
|------|------|---------|--------|
| `frontend/src/lib/color.ts` | 26, 30, 32 | `#000000` | Functional fallback in color parser — not a UI color |
| `frontend/src/components/ui/dialog.tsx` | 32 | `bg-black/10` | Decorative scrim (shadcn-generated) — not a text contrast element |
| `frontend/src/components/settings/ColorPicker.tsx` | 75 | `#0066FF` | HTML placeholder attribute on hex input — not rendered as color |
| `frontend/src/index.css` | 9–14 | `#2563eb`, `#dc2626`, `#15803d`, `#facc15` | Token definitions in `@theme` block — the canonical source, not hardcoded UI usage |
| `frontend/src/components/UploadHistory.tsx` | 22 | `text-white` | On darkened success token `#15803d`; white-on-#15803d = 5.02:1 (WCAG AA PASS) — intentional |
| `frontend/index.html` | 26–27 | `#1a1a1a`, `#94a3b8`, `#ffffff`, `#64748b` | IIFE splash literals read by theme script; CSS var fallbacks in style block — intended per Plan 23-02 |

**Unexpected literals:** NONE

All `.tsx` component files outside the documented exceptions use token classes (`text-foreground`, `bg-card`, `var(--color-*)`) exclusively. Codebase is grep-clean.

## Phase Pass

**Signed off:** 2026-04-14
**Method:** Deterministic token fixes (pre-computed ratios RESEARCH.md §4/§9) + grep cleanliness (Plan 23-05 Task 1) + operator waiver (Plans 23-03/04 skipped)

| Acceptance Criterion (D-12) | Status |
|-----------------------------|--------|
| axe reports 0 contrast violations across all routes in both modes | WAIVED — deterministic fix evidence accepted (RESEARCH.md §4/§9 pre-computed ratios) |
| WebAIM manual verification of badges + Recharts text in both modes | WAIVED — Plans 23-03/04 skipped at operator request |
| No hardcoded color literals in component files (grep clean except documented exceptions) | PASS — Plan 23-05 Task 1 verification grep returned 0 |
| Bootstrap-splash respects theme (no white flash in dark mode) | PASS — Plan 23-02 IIFE fix confirmed; CSS variables set before splash style parsed |

Phase 23 closes the v1.9 milestone accessibility loop as a documented D-12 waiver.
