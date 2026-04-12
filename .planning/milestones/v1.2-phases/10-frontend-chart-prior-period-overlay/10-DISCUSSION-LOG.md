# Phase 10: Frontend — Chart Prior-Period Overlay - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 10-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 10-frontend-chart-prior-period-overlay
**Areas discussed:** Comparison-mode selector, Overlay visual style, Legend + contextual labels

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Comparison-mode selector | Preset→mode rules; short vs year-scale heuristic; custom-range handling | ✓ |
| Overlay visual style | Line dashed vs solid; Bar grouped vs overlapping vs line-only | ✓ |
| Legend + contextual labels | Per-preset strings; label source module | ✓ |
| Tooltip + empty states | Tooltip dual-series behavior; allTime / null-previous handling | |

---

## Comparison-mode selector

### Q1: How should the 4 presets map to comparison modes?

| Option | Description | Selected |
|--------|-------------|----------|
| Month/Quarter→period, Year→year (Recommended) | thisMonth→previous_period, thisQuarter→previous_period, thisYear→previous_year, allTime→none | ✓ |
| Only Year→year, everything else→period | Same effective outcome | |
| Everything→previous_period, no prev-year overlay | Would degrade thisYear to 'none' | |

**User's choice:** Month/Quarter→period, Year→year (Recommended)
**Notes:** Matches Phase 9 §C where thisYear's prev_period collapsed into prev_year.

### Q2: For custom date ranges (preset=null), how should mode be chosen?

| Option | Description | Selected |
|--------|-------------|----------|
| By length: ≤90 days→period, else→year (Recommended) | differenceInDays threshold | |
| Always previous_period for custom | Simpler, but may feel off for long ranges | |
| You decide (Claude's discretion) | Claude picks a default | |

**User's choice:** "no custom date range"
**Notes:** Custom range picker was removed in Phase 9-03 (commits b03bfba, a046a14). `preset` is always one of the 4 presets — no `Preset | null` handling needed anywhere in Phase 10. Selector becomes a deterministic 4-case switch. This was the most impactful clarification of the session — it simplified the selector util, kept types narrow, and ruled out an entire class of dead-code branches.

---

## Overlay visual style

### Q1: In Line mode, how should the prior-period series render?

| Option | Description | Selected |
|--------|-------------|----------|
| Dashed + 40% opacity (Recommended) | strokeDasharray='4 4', opacity 0.4, same color | ✓ |
| Solid 40% opacity, same color | Just fade — risk of hover-state ambiguity | |
| Solid, different muted color | Two distinct tokens — diverges from "ghosted" language | |

**User's choice:** Dashed + 40% opacity (Recommended)
**Notes:** Colorblind/grayscale robust — dash pattern carries series identity beyond hue.

### Q2: In Bar mode, how should the prior series render?

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped bars side-by-side, prior at 40% (Recommended) | Recharts default two-Bar grouping, fillOpacity 0.4 | ✓ |
| Overlapping translucent bars | Same X, prior behind current — hard to read when values are close | |
| Force line-only when overlay active | Auto-switch removes user agency | |

**User's choice:** Grouped bars side-by-side, prior at 40% (Recommended)
**Notes:** Unambiguous, no overlap, keeps the bar/line toggle available in all non-allTime presets.

---

## Legend + contextual labels

### Q1: What contextual labels should the legend show?

| Option | Description | Selected |
|--------|-------------|----------|
| Period-relative per preset (Recommended) | thisMonth→"Umsatz April"/"Umsatz März", thisQuarter→"Umsatz Q2"/"Umsatz Q1", thisYear→"Umsatz 2026"/"Umsatz 2025" | ✓ |
| Fixed 'Aktuell' / 'Vorperiode' | Simpler, loses contextual signal, fails SC2 | |
| Primary current only, tooltip carries prior | Fails SC2 | |

**User's choice:** Period-relative per preset (Recommended)
**Notes:** Matches SC2 examples exactly.

### Q2: Where should the label strings come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend periodLabels.ts with chart-specific helper (Recommended) | Co-locates with existing badge label utils; single source of truth | ✓ |
| New chartLabels.ts module | Cleaner separation but duplicates period-name logic | |
| Inline inside RevenueChart.tsx | Not unit-testable; couples presentation to label logic | |

**User's choice:** Extend periodLabels.ts with chart-specific helper (Recommended)
**Notes:** Single source of truth for month/quarter/year naming.

---

## Claude's Discretion

- Tooltip behavior for dual-series (default Recharts shared tooltip + existing `formatCurrency`)
- Empty-state visual when `previous` is null but mode ≠ 'none' (render only current series, no chart-level banner — cards already signal)
- Whether to add a `<Legend>` element — yes, required by SC2

## Deferred Ideas

- Tooltip + empty-state explicit discussion — deferred; Claude defaults documented in CONTEXT §"Claude's Discretion"
- Manual comparison-mode toggle — v1.3+ per requirements
- Success-color token split — unnecessary for Phase 10
- Sparse-prior bucket visual fix beyond Recharts native gap rendering — rely on Phase 8 null emission + `<Line>`/`<Bar>` defaults
