# Phase 22: Dark Mode Toggle & Preference - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can switch between Light and Dark mode via a navbar segmented control. The app defaults to the OS `prefers-color-scheme` on first visit and persists the user's explicit choice in localStorage thereafter. DE/EN i18n parity on toggle labels is required.

Requirements in scope: DM-05, DM-06, DM-07, DM-08.

Out of scope: contrast audit / color-fix work (Phase 23), per-user server-side preference storage (explicitly deferred in REQUIREMENTS.md), dark-mode rendering of components (delivered in Phase 21).

</domain>

<decisions>
## Implementation Decisions

### Toggle visual
- **D-01:** Text-only segmented control with labels "Light" / "Dark" (English) and "Hell" / "Dunkel" (German) — mirrors the DE/EN toggle exactly and enforces DM-08 i18n parity. No sun/moon icons.
- **D-02:** New component `ThemeToggle.tsx` built on the existing `SegmentedControl` primitive. Sits immediately adjacent to `LanguageToggle` in the navbar.
- **D-03:** The currently active segment is always highlighted — never a "neither selected" state. ARIA radiogroup semantics inherited from `SegmentedControl`.

### Flash-of-wrong-theme prevention
- **D-04:** Inline pre-hydration script in `frontend/index.html` applies `.dark` to `<html>` before React mounts. The script reads localStorage first, falls back to `window.matchMedia('(prefers-color-scheme: dark)').matches`. No flash on first paint.
- **D-05:** Script must be synchronous and inline (not an external JS file) so it runs before the CSS paints.

### OS preference reactivity
- **D-06:** When no localStorage value is set, a `matchMedia('(prefers-color-scheme: dark)')` listener updates `.dark` live. App follows the OS if the user changes system theme mid-session.
- **D-07:** As soon as the user clicks the toggle once, localStorage wins permanently and the OS listener stops taking effect (but may remain attached; its updates become no-ops because the stored value gates them).

### Initial selected state (no stored pref)
- **D-08:** The segment matching the current OS preference is shown as selected on first visit. Clicking the already-selected segment still writes to localStorage (locks the choice).
- **D-09:** First click writes to localStorage immediately — one click, one persisted decision.

### localStorage contract
- **D-10:** Key name: `theme`. Values: `"light"` | `"dark"`. Any other value (including missing key) = "no explicit choice, use OS."
- **D-11:** Invalid or corrupted stored values (e.g., manual tampering) fall back to OS preference without throwing.
- **D-12:** Persistence is synchronous (localStorage, same pattern as language — per the v1.6 decision to move language out of the database and into localStorage).

### Integration with ThemeProvider (from Phase 21)
- **D-13:** Toggle writes the `.dark` class on `document.documentElement`. Phase 21's MutationObserver in `ThemeProvider.tsx` picks up the change and re-applies surface vs accent token rules — no changes to `ThemeProvider.tsx` required.

### Claude's Discretion
- Exact hook API (e.g., `useTheme()` vs context provider) — planner decides based on code conventions.
- File placement for the inline script (attribute order, whether to extract to a documented snippet).
- Whether to expose a typed enum/union for `ThemeMode` or use string literals directly.
- Test strategy (unit vs component vs e2e) — follow existing test conventions.

</decisions>

<specifics>
## Specific Ideas

- Toggle should feel visually identical to the existing DE/EN `LanguageToggle` — same size, same spacing, same segmented-control chrome. It's a visual sibling.
- Mirrors Tailwind docs / Vercel / Linear behavior: live OS tracking until the user opts in to an explicit mode.
- FOUT prevention must be bullet-proof — dark-mode users on slow connections are the test case. An inline `<script>` in `<head>` before the React bundle is the industry norm.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 22 inputs
- `.planning/ROADMAP.md` §"Phase 22: Dark Mode Toggle & Preference" — Goal, depends-on, requirements list, success criteria.
- `.planning/REQUIREMENTS.md` — DM-05 through DM-08 acceptance criteria; out-of-scope note that database-backed preference is explicitly deferred.
- `.planning/PROJECT.md` §"Current Milestone: v1.9" — Brand accent stays constant across modes; language persistence moved to localStorage in v1.6 (pattern to mirror).

### Phase 21 outputs (upstream foundation)
- `.planning/phases/21-dark-mode-theme-infrastructure/21-RESEARCH.md` — Dark-mode infrastructure research (Recharts token contract, audit findings).
- `.planning/phases/21-dark-mode-theme-infrastructure/21-01-SUMMARY.md` — ThemeProvider MutationObserver behavior; applied surface vs accent token split.
- `.planning/phases/21-dark-mode-theme-infrastructure/21-VERIFICATION.md` — Confirms DM-01…DM-04 satisfied.
- `frontend/src/components/ThemeProvider.tsx` — Mode-aware provider; reads `.dark` class via MutationObserver. Toggle writes the class, provider reacts.

### Reference patterns in this codebase
- `frontend/src/components/LanguageToggle.tsx` — Exact template to mirror for the new `ThemeToggle`.
- `frontend/src/components/ui/segmented-control.tsx` — Shared primitive with ARIA radiogroup semantics.
- `frontend/src/components/NavBar.tsx` — Where `ThemeToggle` inserts (adjacent to `LanguageToggle`).
- `frontend/src/locales/de.json` and `frontend/src/locales/en.json` — i18n resource files to extend for toggle labels (DM-08).
- `frontend/index.html` — Target file for the pre-hydration script (D-04).

### Constraints carried forward
- Phase 21 `D-04` in `.planning/phases/21-dark-mode-theme-infrastructure/21-CONTEXT.md` (if present) — Brand accent invariance across modes.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SegmentedControl<T>` (`frontend/src/components/ui/segmented-control.tsx`) — Generic ARIA-correct segmented control; direct parent pattern for `ThemeToggle`.
- `LanguageToggle.tsx` — Provides the exact shape (segments array, controlled `value` + `onChange`) to replicate.
- `ThemeProvider.tsx` (Phase 21) — Already listens to `.dark` on `<html>`; toggle interaction surface is a single class mutation.
- `react-i18next` + `useTranslation` — Already wired; adding toggle label keys to `de.json` / `en.json` is the standard extension point.

### Established Patterns
- User preferences that don't need server state go to localStorage (language followed this pattern in v1.6; theme follows it for DM-07).
- Navbar "action" controls are siblings of `LanguageToggle` — adding `ThemeToggle` next to it is the canonical insertion point.
- Zero hardcoded hex values in components (Phase 21 audit) — do not reintroduce any. Any styling for the toggle itself uses the existing token vocabulary.

### Integration Points
- `frontend/index.html` — Inline pre-hydration script goes in `<head>` before Vite's module bundle.
- `frontend/src/components/NavBar.tsx` — Mount point for `<ThemeToggle />`.
- `frontend/src/locales/{de,en}.json` — New i18n keys for "Light"/"Dark" labels and `aria-label`.
- `frontend/src/components/ThemeProvider.tsx` — No modification needed; it already reacts to class changes.

</code_context>

<deferred>
## Deferred Ideas

- Auto-switching dark mode on a schedule (e.g., sundown/sunrise) — explicitly deferred in REQUIREMENTS.md "out of scope."
- Per-user server-side theme preference — explicitly deferred in REQUIREMENTS.md ("localStorage is sufficient for single-browser use").
- Sun/moon iconography for the toggle — rejected in favor of text parity with DE/EN (D-01). Can be revisited if contrast audit in Phase 23 surfaces readability concerns with labels.
- A "system" third segment (Light / Dark / System) — not in scope; DM-05 prescribes a binary Light/Dark control. The system-preference behavior is automatic until first explicit click.

</deferred>

---

*Phase: 22-dark-mode-toggle-preference*
*Context gathered: 2026-04-14*
