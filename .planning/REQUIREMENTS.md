# Requirements: v1.19 UI Consistency Pass 2

**Milestone:** v1.19
**Status:** Defining requirements
**Created:** 2026-04-21

**Core Value:** Unify admin UI chrome, controls, and navigation patterns so every route in the KPI Dashboard uses the same components, spacing, and interaction primitives. Pure frontend consistency pass — no backend schema or API changes.

**Locked scope (2026-04-21):**
- Breadcrumb header (content navigation leaves the top bar).
- Per-section titles + descriptions + standardized delete affordance.
- One canonical `Input` / `Select` / `Button` / `Textarea` / `Dropdown` primitive — all `h-8`.
- Sensors page: date-range and "Jetzt messen" move into SubHeader.
- New pill-style animated `Toggle` component (EN/DE, light/dark, all boolean switches).

---

## Active Requirements

### Header refactor (HDR-*)

- [ ] **HDR-01**: The top header shows only global identity — brand/logo, user menu, language toggle, theme toggle. No content tabs, no route-specific actions, no in-header page controls.
- [ ] **HDR-02**: The top header renders a breadcrumb trail (`Home › Section › [Subsection]`) derived from the current route; breadcrumb items are `<a>` links and reflect the active location.
- [ ] **HDR-03**: Breadcrumb items are keyboard-navigable (Tab order, Enter activates) and localized in DE and EN with full key parity.
- [ ] **HDR-04**: All in-header content controls currently living in the top header (Sales/HR segmented toggle, upload button, per-page settings gear) migrate to the SubHeader or their owning page surface.

### Section context (SECTION-*)

- [ ] **SECTION-01**: Every admin page section carries a heading + short description (≤ 2 lines) explaining its purpose, matching the pattern already used in the Playlist editor.
- [ ] **SECTION-02**: All section headings and descriptions are localized in DE (du-tone) and EN with matching i18n key parity (EN count == DE count).
- [ ] **SECTION-03**: A single `<TrashIcon>` / delete-button component under `frontend/src/components/ui/` is the only destructive row action used across Media, Playlists, Devices, Schedules, Tags, Sensors, and Users tables/lists.
- [ ] **SECTION-04**: The shared delete button emits a consistent confirm-dialog pattern (the existing `DeleteDialog` shape) — no ad-hoc `window.confirm` or one-off modal variants remain.

### Consolidated controls (CTRL-*)

- [ ] **CTRL-01**: A single `Input`, `Select`, `Button`, `Textarea`, and `Dropdown` primitive exists under `frontend/src/components/ui/` and is the only supported form-control surface for the app.
- [ ] **CTRL-02**: All raw `<input>`, `<select>`, `<button>`, and `<textarea>` usages across the frontend are migrated to the shared primitives; intentional exceptions (e.g. file pickers wrapping native `<input type="file">`) are explicitly documented in-source.
- [ ] **CTRL-03**: All standard-size form controls use the `h-8` height token; `h-9`, `h-10`, and `h-11` variants are removed from default code paths (allowed only for documented exceptional surfaces).
- [ ] **CTRL-04**: Focus rings, disabled states, and invalid/error states are visually consistent across all primitives and driven by tokens, not per-component color literals.

### Sensors layout (SENSORS-*)

- [ ] **SENSORS-01**: The date-range / time-window selector on `/sensors` moves from the page body into the SubHeader (left or center slot), matching other dashboard routes.
- [ ] **SENSORS-02**: The "Jetzt messen" action moves into the SubHeader right slot and uses the shared `Button` primitive.
- [ ] **SENSORS-03**: The Sensors page body contains only KPI cards, charts, and tables — no header-level controls remain inline in the body.

### Toggle component (TOGGLE-*)

- [ ] **TOGGLE-01**: A new `Toggle` component exists under `frontend/src/components/ui/` — pill container with a white/elevated indicator that slides under the active label, matching the reference screenshot.
- [ ] **TOGGLE-02**: The EN/DE language switch in the top header uses the new `Toggle`.
- [ ] **TOGGLE-03**: The light/dark theme switch uses the new `Toggle` (sun/moon icons as labels).
- [ ] **TOGGLE-04**: Existing 2-option boolean `SegmentedControl` usages (audit Sales/HR toggle, sensor window binary cases, etc.) migrate to the new `Toggle`. Segmented controls with 3+ options remain as `SegmentedControl`.
- [ ] **TOGGLE-05**: The `Toggle` animation respects `prefers-reduced-motion` (instant indicator swap, no slide) and is keyboard-navigable (Arrow keys move focus/selection, Enter/Space activates, `role="radiogroup"` semantics).

### Accessibility & parity (A11Y-*)

- [ ] **A11Y-01**: Full DE/EN i18n key parity (EN count == DE count) for every new or renamed key introduced by v1.19; DE copy uses du-tone.
- [ ] **A11Y-02**: All new and migrated controls expose an accessible name (visible label or `aria-label`) and a visible focus ring in both light and dark modes.
- [ ] **A11Y-03**: Dark-mode sweep across every migrated surface — no hardcoded color literals, no contrast regressions, all tokens resolve in both themes.

---

## Future Requirements (deferred)

None at this time.

---

## Out of Scope

- **Any backend schema or API change** — this is a pure frontend consistency milestone; no Alembic migrations, no FastAPI route changes.
- **Animation library adoption (Framer Motion / Motion One)** — the pill toggle indicator uses CSS transitions / Tailwind keyframes only.
- **Rebuilding `SegmentedControl` for 3+ option cases** — it stays as-is. Only 2-option boolean toggles migrate to the new `Toggle`.

---

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| HDR-01 | | | |
| HDR-02 | | | |
| HDR-03 | | | |
| HDR-04 | | | |
| SECTION-01 | | | |
| SECTION-02 | | | |
| SECTION-03 | | | |
| SECTION-04 | | | |
| CTRL-01 | | | |
| CTRL-02 | | | |
| CTRL-03 | | | |
| CTRL-04 | | | |
| SENSORS-01 | | | |
| SENSORS-02 | | | |
| SENSORS-03 | | | |
| TOGGLE-01 | | | |
| TOGGLE-02 | | | |
| TOGGLE-03 | | | |
| TOGGLE-04 | | | |
| TOGGLE-05 | | | |
| A11Y-01 | | | |
| A11Y-02 | | | |
| A11Y-03 | | | |

**Coverage:**
- Active requirements: 23 total
- Mapped to phases: 0 (roadmapper fills next)

---

*Requirements defined: 2026-04-21 — phase structure pending roadmapper run. Continue phase numbering from 53 (v1.18 last phase) — next phase is 54.*
