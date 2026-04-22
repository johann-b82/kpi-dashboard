# Phase 59: A11y & Parity Sweep - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden every surface touched by milestone v1.19 (phases 54–58) against three quality gates:
- **A11Y-01**: DE/EN i18n key-count parity + du-tone DE copy
- **A11Y-02**: accessible names (label or `aria-label`) + visible focus rings in light and dark mode for new/migrated controls
- **A11Y-03**: dark-mode clean, zero hardcoded color literals (with documented allowlist), no contrast regressions

This is a sweep phase — no new features. Scope is strictly quality gates on already-delivered v1.19 work.

</domain>

<decisions>
## Implementation Decisions

### Scope boundary (D-01)
- **D-01**: "Surfaces touched by v1.19" = the strict file list derived from `git log` across phase 54–58 commits. If a migrated file's direct render parent (e.g., `App.tsx`, `AppShell.tsx`, `SubHeader.tsx`) is not already in that list, it is OUT of scope unless a11y bug is proven. Prevents sweep creep.

### i18n parity enforcement (D-02, D-03)
- **D-02**: Add an **automated parity gate** — a test (vitest) or script invoked by CI/verification that asserts `en.json` key-count == `de.json` key-count and fails the build on drift. This replaces ad-hoc manual `wc -l` checks.
- **D-03**: **du-tone validation is two-layer**: (a) human DE-copy review on new/renamed keys introduced in v1.19, plus (b) a lightweight lint heuristic that flags suspicious formal-German tokens (`Sie`, `Ihnen`, `Ihre`, `Ihr`, capitalized address forms) so regressions surface early.

### Focus-ring policy (D-04)
- **D-04**: Introduce a **canonical Tailwind focus-ring utility**: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none` (exact tokens/offsets TBD during research — must resolve cleanly in light + dark via the existing `--ring` CSS variable). Apply across all migrated controls as the single shared spec. Shared primitives (Button, Toggle, IconButton-style wrappers) receive it as the default; one-off controls opt in via the same utility.

### Color literal policy (D-05)
- **D-05**: **Strict zero-hex/rgb/named-color policy** in `className` and inline `style` for STATIC surface colors. Data-driven colors computed at runtime (via CSS variables, tokens, or user-chosen values persisted and rendered) are allowed. Allowlist is documented in-phase and starts with:
  - `frontend/src/components/settings/ColorPicker.tsx` — renders user-chosen hex as preview swatch (by design)
  - Any additional exception must be added to the allowlist with a one-line justification.

### Dark-mode audit method (D-06)
- **D-06**: **Two-pronged audit** — (a) automated grep for hardcoded literals + token-resolution check as the hard gate (blocks verification on fail); (b) manual browser pass per migrated surface in dark mode with a screenshot attached to `59-VERIFICATION.md` for each surface. Screenshots are the evidence artifact.

### Pre-existing TS debt carry-forward (D-07)
- **D-07**: **Leave pre-existing TypeScript errors deferred**. They are out of scope for A11Y-01/02/03. They remain tracked in the per-phase `deferred-items.md` files and do not gate phase 59 completion. A dedicated cleanup phase may be planned later — see Deferred Ideas.

### Claude's Discretion
- Exact Tailwind token names for focus ring (e.g., whether to introduce `ring-ring-hc` for higher-contrast variants or rely on existing `--ring`) — research step to decide.
- How to structure the parity-gate test (standalone script vs vitest assertion vs CI step) — planner's call based on existing test infrastructure.
- Plan decomposition: single sweep plan vs three plans (one per A11Y requirement) — planner's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Accessibility & parity — A11Y-01/02/03 authoritative definitions
- `.planning/ROADMAP.md` §Phase 59 — goal + success criteria
- `.planning/PROJECT.md` — tech stack (Tailwind v4, shadcn/ui, i18n convention)

### Prior-phase artifacts (scope inputs)
- `.planning/phases/54-toggle-primitive-migrations/` — Toggle primitive, migrated controls list
- `.planning/phases/55-consolidated-form-controls/` — form control migrations
- `.planning/phases/56-breadcrumb-header-content-nav-relocation/` — NavBar/SubHeader surface
- `.planning/phases/57-section-context-standardized-trashcan/` — trashcan + MediaPage/MediaInUseDialog surfaces
- `.planning/phases/58-sensors-layout-parity/` — SubHeader slot wiring, SensorsPage slim-down

### Deferred debt (carry-forward, out of scope for 59)
- `.planning/phases/56-breadcrumb-header-content-nav-relocation/deferred-items.md`
- `.planning/phases/57-section-context-standardized-trashcan/deferred-items.md`
- `.planning/phases/58-sensors-layout-parity/deferred-items.md`

### Code entry points
- `frontend/src/locales/en.json` + `frontend/src/locales/de.json` — i18n parity source of truth
- `frontend/src/index.css` (or equivalent tokens file) — `--ring`, color tokens, dark-mode overrides
- `frontend/src/components/settings/ColorPicker.tsx` — known color-literal allowlist entry

### No external specs
No external ADRs or specifications referenced — quality gates are fully captured in REQUIREMENTS.md + decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Locale files**: `frontend/src/locales/{en,de}.json` already exist with 517/517 parity as of 58-02; sweep extends to verify this across all v1.19 additions.
- **Tailwind `--ring` token**: project already defines a ring CSS variable (Tailwind v4 + shadcn/ui convention) — canonical focus-ring utility builds on this rather than inventing a new token.
- **Shared primitives**: `Button`, `Toggle` (phase 54), form controls (phase 55), `PollNowButton` (phase 58) — these are the leverage points; fixing them propagates to most migrated surfaces.

### Established Patterns
- **Tailwind-only styling**: no CSS Modules, no styled-components — color-literal grep scope is `className=` and inline `style=` in `.tsx`.
- **shadcn/ui copy-paste**: primitives live in `components/ui/` — canonical focus-ring utility can be baked into these files directly.
- **Baseline**: 12 files use `focus-visible:` / `focus:` utilities; 39 files use `aria-label` — uneven coverage, confirms the sweep is needed.

### Integration Points
- **Automated i18n gate**: likely plugs into `frontend/package.json` scripts (`test` or new `lint:i18n`) so CI catches drift without manual verification steps.
- **Dark-mode audit**: existing preview server (used by `mcp__Claude_Preview__*`) is the natural tool for screenshot evidence.

</code_context>

<specifics>
## Specific Ideas

- Canonical focus-ring utility pattern (locked): `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none` — exact utility string may be refined during research/planning to match project's existing token spelling.
- Color-literal allowlist starts with exactly one entry (`ColorPicker.tsx` user-preview swatch). Any additional exception requires an in-file justification comment.
- du-tone lint heuristic: flag `Sie`, `Ihnen`, `Ihre`, `Ihr` plus sentence-initial capitalized formal-German address forms. Implementation detail (regex vs script vs test) is planner's call.

</specifics>

<deferred>
## Deferred Ideas

- **TypeScript debt cleanup phase**: pre-existing `npm run build` errors tracked in phase 56/57/58 `deferred-items.md`. Candidate for a dedicated phase in a future milestone (v1.20+). Not in A11Y-01/02/03 scope, will not gate phase 59.
- **Higher-contrast focus-ring variant (`ring-ring-hc`)**: mentioned as possible future token if WCAG AAA becomes a requirement. Not required for current A11Y-02 (which targets visible focus ring, not AAA contrast).
- **Broader route-level audit**: scope (D-01) explicitly excludes broader routes; if downstream a11y issues surface on full routes not in the strict file list, queue as a follow-up phase.

</deferred>

---

*Phase: 59-a11y-parity-sweep*
*Context gathered: 2026-04-22*
