# Phase 21: Dark Mode Theme Infrastructure - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire dark color tokens into ThemeProvider and every UI surface so the app renders correctly in dark mode — dark backgrounds, light text, adapted shadcn components and Recharts charts — while keeping the brand accent unchanged.

This phase delivers theme infrastructure only. The actual toggle UI and preference persistence ship in Phase 22; WCAG AA contrast verification ships in Phase 23.

</domain>

<decisions>
## Implementation Decisions

### ThemeProvider Strategy

- **D-01:** ThemeProvider applies brand-set surface colors (`--background`, `--foreground`, `--muted`, `--destructive`) **only in light mode**. In dark mode, these surfaces fall back to the shadcn `.dark` CSS block defaults.
- **D-02:** Brand accent/primary (`--primary`, `--accent`) are applied from Settings **in both modes** — this is the DM-04 requirement: brand accent identical light and dark.
- **D-03:** Implementation: ThemeProvider must detect current mode (by reading the `dark` class on `<html>`) and conditionally skip the `style.setProperty` calls for surface tokens. When dark mode activates/deactivates (via class change in Phase 22), the `.dark` CSS block takes over because inline styles are removed.
- **D-04:** `--destructive` follows the surface pattern — shadcn dark default in dark mode, brand value in light mode.

### Dark Surface Palette

- **D-05:** Use the **existing shadcn `.dark` grayscale defaults** as-is. No brand tinting, no high-contrast/AMOLED variant. The `.dark` block in `frontend/src/index.css:95-127` is already correct.
- **D-06:** Do not add new Settings fields for dark-mode colors. Single brand palette; only light-mode surfaces come from Settings.

### Chart Adaptation (Recharts)

- **D-07:** All Recharts chart elements must reference CSS variables (tokens) so they auto-adapt when the `.dark` class toggles. No JS-side mode detection, no `useTheme()` hook for charts.
- **D-08:** Audit every Recharts component and replace any hardcoded colors (hex, rgb, named) with token references:
  - Axis ticks: `fill: 'var(--muted-foreground)'`
  - Grid/axis lines: `stroke: 'var(--border)'`
  - Tooltip: `contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)' }}`
  - Bars/lines using brand: `var(--primary)`, `var(--chart-current)`
  - Prior-period overlay: `var(--color-warning)` (amber, kept same in both modes)
- **D-09:** Amber warning color (`#facc15`) stays identical in light and dark mode — semantic consistency. Do not add a `.dark` override for `--color-warning`.

### Component Audit Scope

- **D-10:** Full systematic audit of the frontend for hardcoded colors:
  - Hex literals (`#ffffff`, `#000`, `#facc15`, etc.)
  - Named colors (`white`, `black`, `red`, etc.)
  - `rgb()`, `oklch()`, `hsl()` literals outside of `index.css`
  - Tailwind color utilities that don't adapt (`bg-white`, `text-black`, `bg-gray-100`, `border-gray-200`, etc.)
- **D-11:** Replace hardcoded colors with token equivalents:
  - `bg-white` → `bg-background` or `bg-card`
  - `text-black` → `text-foreground`
  - `bg-gray-100` → `bg-muted`
  - `border-gray-200` → `border-border`
  - etc.
- **D-12:** Verify every shadcn/ui primitive in `frontend/src/components/ui/` renders correctly in dark mode (cards, buttons, inputs, dialogs, popover, checkbox, calendar, badge, segmented-control, separator, table).

### Testing Strategy

- **D-13:** Dark mode is activated manually during Phase 21 development by toggling the `.dark` class on `<html>` via browser devtools. The actual toggle UI ships in Phase 22 — no temporary dev toggle in Phase 21.
- **D-14:** ThemeProvider's mode detection logic must work correctly when `.dark` class is added/removed externally (via devtools now, via Phase 22's toggle later).

### Claude's Discretion

- Exact mechanism for ThemeProvider to detect current mode (MutationObserver on `<html>` class, or re-render trigger) — researcher/planner to choose
- How to efficiently grep for hardcoded colors across the frontend (glob strategy, ripgrep patterns)
- Whether to extract the Recharts token defaults into a shared `chartDefaults.ts` helper or inline them per chart

### Folded Todos

None — no pending todos matched Phase 21.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Theme infrastructure (existing)
- `frontend/src/index.css` — Full `:root` and `.dark` CSS variable blocks, `@custom-variant dark (&:is(.dark *))` and `@theme inline` token mappings. The `.dark` block (lines 95-127) is the dark palette source of truth.
- `frontend/src/components/ThemeProvider.tsx` — Current provider that applies brand settings via `style.setProperty`. Must be extended for mode-aware behavior.
- `frontend/src/lib/defaults.ts` — `THEME_TOKEN_MAP` and `DEFAULT_SETTINGS` define which Settings fields map to which CSS vars.

### Requirements
- `.planning/REQUIREMENTS.md` §v1.9 — DM-01, DM-02, DM-03, DM-04 (Phase 21 scope)

### Roadmap
- `.planning/ROADMAP.md` §"Phase 21: Dark Mode Theme Infrastructure" — goal, success criteria, dependencies

### Prior pattern references
- `.planning/phases/05-frontend-plumbing-themeprovider-and-navbar/05-CONTEXT.md` — Original ThemeProvider design decisions (Phase 5)

### Stack reference (from CLAUDE.md)
- Tailwind v4 class strategy for dark mode (CSS-first config, no `tailwind.config.js`)
- shadcn/ui components wrap `@base-ui/react` (use `render` prop, not `asChild`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`.dark` CSS block**: Already defined in `index.css` with full shadcn token set — no need to invent dark colors.
- **`@custom-variant dark`**: Already configured so Tailwind `dark:` utilities work out of the box.
- **CSS variable layer**: All shadcn components consume tokens via `@theme inline`, so surface token updates propagate automatically.
- **`THEME_TOKEN_MAP`** in `lib/defaults.ts`: Central map of Settings → CSS var. ThemeProvider should iterate this conditionally based on mode.

### Established Patterns
- **localStorage for per-browser preferences**: Language preference moved to localStorage in v1.6 (Phase 20). Dark mode preference in Phase 22 will mirror this pattern.
- **SegmentedControl**: v1.5 reusable component used for DE/EN toggle. Phase 22 will reuse for Light/Dark toggle — Phase 21 does NOT need to touch.
- **Token-based styling**: Most UI already uses `bg-background`, `text-foreground`, `bg-card`, `border-border` etc. — audit will catch the exceptions.

### Integration Points
- **ThemeProvider** (`components/ThemeProvider.tsx`) — single mount point. Needs mode-aware application logic.
- **index.css** — already has the `.dark` block; no new CSS required unless the audit surfaces a token gap.
- **Recharts components** — live in `components/dashboard/` and `components/hr/` (likely). Audit and convert to token references.

### Conflicts to Resolve
- **Inline-style specificity**: `root.style.setProperty('--background', ...)` beats `.dark { --background: ... }`. ThemeProvider must NOT set surface tokens inline when dark mode is active — otherwise the `.dark` block has no effect.

</code_context>

<specifics>
## Specific Ideas

- Brand accent **must** look identical in both modes — verify by toggling `.dark` and confirming `--primary` and `--accent` are bit-identical.
- Prior-period amber (`#facc15`) stays the same in dark mode — semantic consistency over aesthetic tuning.
- Phase 21 is *infrastructure only*: no toggle UI, no preference persistence, no WCAG audit. Those are Phases 22 and 23.

</specifics>

<deferred>
## Deferred Ideas

- **Dual brand palettes** (Settings fields for dark-mode colors) — rejected this milestone; shadcn defaults are sufficient.
- **High-contrast/AMOLED dark variant** — deferred; may revisit if user feedback in v2 requests it.
- **Brand-tinted dark surfaces** — deferred; adds complexity with uncertain benefit.
- **Per-user dark mode preference in database** — already listed as Out of Scope in REQUIREMENTS.md (localStorage is sufficient).

</deferred>

---

*Phase: 21-dark-mode-theme-infrastructure*
*Context gathered: 2026-04-14*
