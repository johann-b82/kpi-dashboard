# Phase 21: Dark Mode Theme Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 21-dark-mode-theme-infrastructure
**Areas discussed:** ThemeProvider strategy, Dark surface palette, Chart adaptation, Component audit scope

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| ThemeProvider strategy | Resolve conflict between inline-style brand colors and `.dark` CSS block | ✓ |
| Dark surface palette | Use shadcn defaults, tint toward brand, or high-contrast | ✓ |
| Chart adaptation | How Recharts axes/tooltips/legends adapt to dark mode | ✓ |
| Component audit scope | How wide to sweep for hardcoded colors and non-adapting Tailwind classes | ✓ |

**User's choice:** All four areas selected.

---

## ThemeProvider Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Light-only brand surfaces | Apply brand surface colors only in light mode; shadcn `.dark` defaults take over in dark mode. Brand accent/primary applied in both. | ✓ |
| Dual brand palettes | Add dark-mode color fields to Settings; user picks both palettes | |
| Auto-derive dark surfaces | Auto-generate dark surfaces by inverting/shifting brand colors | |

**User's choice:** Light-only brand surfaces (Recommended).
**Notes:** Keeps ThemeProvider simple. Resolves the inline-style vs CSS specificity conflict by skipping surface tokens in dark mode.

### Follow-up: Destructive color handling

| Option | Description | Selected |
|--------|-------------|----------|
| Shadcn dark default | Destructive follows surface pattern — shadcn default in dark | ✓ |
| Brand destructive in both | Keep Settings destructive value in both modes | |

**User's choice:** Shadcn dark default. Consistent with surface pattern.

---

## Dark Surface Palette

| Option | Description | Selected |
|--------|-------------|----------|
| Pure neutral | Use existing shadcn `.dark` grayscale as-is | ✓ |
| Brand-tinted darks | Shift dark surfaces slightly toward brand hue | |
| High contrast darks | True black background, pure white foreground (AMOLED-friendly) | |

**User's choice:** Pure neutral (Recommended).
**Notes:** Existing `.dark` block in `index.css` is already correct — no new CSS needed.

---

## Chart Adaptation

| Option | Description | Selected |
|--------|-------------|----------|
| Token-based auto-adapt | All chart elements reference CSS variables; no JS mode detection | ✓ |
| Mode-aware render prop | `useTheme()` hook passes different color props per mode | |
| Hybrid — tokens + dark: classes | CSS vars plus Tailwind dark: where tokens can't reach | |

**User's choice:** Token-based auto-adapt (Recommended).

### Follow-up: Prior-period overlay (amber)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep amber in both modes | Semantic meaning stays consistent across modes | ✓ |
| Slightly dimmed in dark | Define `--color-warning` with `.dark` override | |

**User's choice:** Keep amber in both modes.

---

## Component Audit Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full audit, fix hardcoded colors | Systematic sweep for hex/named/rgb/oklch literals and non-adapting Tailwind classes | ✓ |
| Targeted to known problem areas | Only fix known offenders (chart overlay, bg-white/text-black) | |
| Audit + take screenshots | Full audit plus manual visual verification | |

**User's choice:** Full audit, fix hardcoded colors (Recommended).

### Follow-up: Testing strategy for Phase 21 (no toggle UI yet)

| Option | Description | Selected |
|--------|-------------|----------|
| Manual .dark class in devtools | Developer toggles class manually; Phase 22 ships the actual toggle | ✓ |
| Temporary dev toggle / URL flag | `?dark=1` or dev button for exercising end-to-end | |
| Pull toggle forward into Phase 21 | Fold DM-05/06/07 into Phase 21 | |

**User's choice:** Manual .dark class in devtools. Clear separation of concerns with Phase 22.

---

## Claude's Discretion

- Mechanism for ThemeProvider to detect current mode (MutationObserver vs re-render trigger)
- Grep strategy for finding hardcoded colors across the frontend
- Whether to extract Recharts token defaults into a shared helper or inline per chart

## Deferred Ideas

- Dual brand palettes (Settings fields for dark colors) — rejected for this milestone
- High-contrast / AMOLED dark variant — deferred to potential v2
- Brand-tinted dark surfaces — deferred, shadcn neutral is sufficient
- Per-user dark mode preference in DB — already Out of Scope per REQUIREMENTS.md
