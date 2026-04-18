# Phase 23: Contrast Audit & Fix - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify every text and interactive element in the app meets WCAG AA contrast ratios (4.5:1 body / 3:1 large text) in BOTH light and dark mode, then fix any failures. Scope covers all four routes (/, /hr, /upload, /settings) including Recharts charts, delta/status badges, and legacy hardcoded colors surfaced during Phase 22 UAT (bootstrap-splash `#ffffff` etc.).

This is the final phase of the v1.9 milestone — closes the accessibility loop opened by Phases 21 (token infrastructure) and 22 (user-facing toggle).

</domain>

<decisions>
## Implementation Decisions

### Audit Method

- **D-01:** Automated-first + targeted-manual audit.
  - Run an automated tool (axe-core DevTools extension OR Lighthouse accessibility pass) on every route in both light and dark mode.
  - Manually verify any flagged items + ALL delta/status badges + Recharts elements using the WebAIM contrast checker (https://webaim.org/resources/contrastchecker/), since automation often misses color-on-color overlays and chart SVG fills.
- **D-02:** Planner to pick the specific automated tool (axe vs Lighthouse vs built-in Chrome DevTools "Issues" panel) — all three produce similar results for this use case.

### Audit Scope

- **D-03:** Full audit on ALL four routes in BOTH modes:
  - `/` (Sales dashboard — KPI cards, monthly chart, date range, upload status)
  - `/hr` (HR dashboard — 5 KPI cards, sync status, charts)
  - `/upload` (upload form, upload history table)
  - `/settings` (theme colors, branding, Personio config, checkbox lists)
- **D-04:** Include components outside the main content (NavBar, SubHeader, ThemeToggle, LanguageToggle, bootstrap splash) — a failure there affects every route.

### Fix Strategy

- **D-05:** When a failure is found, prefer adjusting the GLOBAL token in `frontend/src/index.css` (in the `:root` or `.dark` block) over per-component overrides. Reasoning: keeps the palette consistent and propagates the fix across every consumer automatically.
- **D-06:** Per-component overrides are a last resort — only when a token fix would break another surface that was already passing.

### Badge Colors (DM-10)

- **D-07:** Delta badges (positive/negative), status badges (sync-success, sync-error, upload-ok, upload-fail) use **identical colors in both modes** — semantic consistency (matches D-09 from Phase 21 for amber warning).
- **D-08:** If an identical color fails 4.5:1 on one mode's background, adjust the SHADE to pass in both modes rather than introducing a dark-mode variant. Two-palette drift is worse than a slight shade tweak.
- **D-09:** Acceptable exception: If a single shade cannot pass both modes, the SAME semantic color may be defined twice (once in `:root`, once in `.dark`) as long as hue stays identical and only lightness differs. This preserves meaning (green=good, red=bad) while restoring contrast.

### Legacy Hardcoded Colors

- **D-10:** Fix legacy hardcoded colors in THIS phase — no further deferral. Specifically:
  - Bootstrap-splash `#ffffff` background (called out in Phase 22 UAT Scenario E) → convert to `bg-background` or keep as a semantic "neutral-light" token with a `.dark` override.
  - Any other `#xxxxxx`, `rgb()`, named-color literals surfaced by grep during the audit → convert to tokens.
- **D-11:** The Phase 21 audit already handled most of these; Phase 23's job is to catch residuals that only become visible once automated tooling runs against the rendered dark-mode surfaces.

### Success Signal

- **D-12:** Phase passes when:
  - Automated tool reports zero contrast violations on all four routes in both modes
  - Manual WebAIM verification confirms delta/status badges + Recharts text elements pass
  - No hardcoded color literals remain in component files (grep-verified)

### Claude's Discretion

- Which automated tool to use (axe-core extension, Lighthouse CLI, Chrome DevTools Issues panel)
- How to structure the audit deliverable (single markdown report vs per-route reports)
- Whether to add a CI check for contrast regressions (out of scope unless trivial)
- How to handle Recharts SVG text elements that tooling can't analyze automatically

### Folded Todos

None — no pending todos matched Phase 23.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Theme infrastructure (from Phase 21)
- `frontend/src/index.css` — `:root` and `.dark` CSS variable blocks, `@custom-variant dark`, `@theme inline` mappings. Token value source of truth.
- `frontend/src/components/ThemeProvider.tsx` — Mode-aware token application (D-01..D-04 from Phase 21).
- `frontend/src/lib/defaults.ts` — `THEME_TOKEN_MAP`, `DEFAULT_SETTINGS`.

### Phase 22 deliverables
- `frontend/src/components/ThemeToggle.tsx` — Icon-button toggle (live in prod).
- `frontend/index.html` — Pre-hydration theme script.

### Phase 21 deferred items (prime suspect list for this audit)
- `.planning/phases/21-dark-mode-theme-infrastructure/deferred-items.md` — Known pre-existing SalesTable.tsx / HrKpiCharts.tsx issues + any other carry-over.

### Requirements
- `.planning/REQUIREMENTS.md` §v1.9 — DM-09 (4.5:1 / 3:1), DM-10 (badges)

### Roadmap
- `.planning/ROADMAP.md` §"Phase 23: Contrast Audit & Fix" — goal, success criteria, dependencies

### External
- WCAG 2.1 AA contrast spec: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
- WebAIM contrast checker: https://webaim.org/resources/contrastchecker/

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Tailwind tokens `bg-*`, `text-*`, `border-*` mapped to CSS variables — adjusting a token value fixes every consumer instantly.
- Phase 21 already migrated most hardcoded colors — audit starts from a mostly-token-clean baseline.

### Established Patterns
- Token-first styling (Phase 21): `bg-background`, `text-foreground`, `bg-card`, `border-border`, etc.
- Recharts components consume tokens via CSS var references per Phase 21 D-07/D-08.
- Semantic color invariance (Phase 21 D-09): brand accent + amber warning identical in both modes — Phase 23 extends the same principle to delta/status badges.

### Integration Points
- `index.css` — primary fix surface; most adjustments happen here.
- Component files — only modified if a token fix isn't feasible (D-06).
- Bootstrap-splash — likely lives in `frontend/src/bootstrap.ts` or `frontend/index.html`; confirm in research.

### Conflicts to Resolve
- Automated tools can't evaluate SVG text inside Recharts reliably — manual WebAIM pass covers this gap (D-01).
- Some status colors (e.g., Personio sync "error" red) may already be identical across modes but fail on the dark card background — D-08 applies.

</code_context>

<specifics>
## Specific Ideas

- User accepted the "Recommended" answers for all three discussed areas — no surprises or overrides.
- The bootstrap-splash flash explicitly called out in Phase 22 UAT Scenario E as deferred → MUST be resolved here; do not carry to milestone close.
- Semantic consistency principle (same color = same meaning across modes) takes priority over per-mode aesthetic tuning.

</specifics>

<deferred>
## Deferred Ideas

- **CI contrast-regression check** — would prevent future regressions but requires test infra setup; Claude's discretion whether trivial enough to include.
- **Dark-mode-tuned brand variants** — rejected again (covered by D-05/D-07 from Phase 21; accent stays bit-identical).
- **High-contrast WCAG AAA mode** — deferred to v2+ if accessibility feedback requests it.

</deferred>

---

*Phase: 23-contrast-audit-fix*
*Context gathered: 2026-04-14*
