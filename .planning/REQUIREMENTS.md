# Requirements: v1.19 UI Consistency Pass 2

**Milestone:** v1.19
**Status:** Roadmapped — 6 phases, 23/23 requirements mapped
**Created:** 2026-04-21
**Roadmapped:** 2026-04-21

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

- [x] **HDR-01**: The top header shows only global identity — brand/logo, user menu, language toggle, theme toggle. No content tabs, no route-specific actions, no in-header page controls.
- [x] **HDR-02**: The top header renders a breadcrumb trail (`Home › Section › [Subsection]`) derived from the current route; breadcrumb items are `<a>` links and reflect the active location.
- [x] **HDR-03**: Breadcrumb items are keyboard-navigable (Tab order, Enter activates) and localized in DE and EN with full key parity.
- [x] **HDR-04**: All in-header content controls currently living in the top header (Sales/HR segmented toggle, upload button, per-page settings gear) migrate to the SubHeader or their owning page surface.

### Section context (SECTION-*)

- [x] **SECTION-01**: Every admin page section carries a heading + short description (≤ 2 lines) explaining its purpose, matching the pattern already used in the Playlist editor.
- [x] **SECTION-02**: All section headings and descriptions are localized in DE (du-tone) and EN with matching i18n key parity (EN count == DE count).
- [x] **SECTION-03**: A single `<TrashIcon>` / delete-button component under `frontend/src/components/ui/` is the only destructive row action used across Media, Playlists, Devices, Schedules, Tags, Sensors, and Users tables/lists.
- [x] **SECTION-04**: The shared delete button emits a consistent confirm-dialog pattern (the existing `DeleteDialog` shape) — no ad-hoc `window.confirm` or one-off modal variants remain.

### Consolidated controls (CTRL-*)

- [x] **CTRL-01**: A single `Input`, `Select`, `Button`, `Textarea`, and `Dropdown` primitive exists under `frontend/src/components/ui/` and is the only supported form-control surface for the app.
- [x] **CTRL-02**: All raw `<input>`, `<select>`, `<button>`, and `<textarea>` usages across the frontend are migrated to the shared primitives; intentional exceptions (e.g. file pickers wrapping native `<input type="file">`) are explicitly documented in-source.
- [x] **CTRL-03**: All standard-size form controls use the `h-8` height token; `h-9`, `h-10`, and `h-11` variants are removed from default code paths (allowed only for documented exceptional surfaces).
- [x] **CTRL-04**: Focus rings, disabled states, and invalid/error states are visually consistent across all primitives and driven by tokens, not per-component color literals.

### Sensors layout (SENSORS-*)

- [x] **SENSORS-01**: The date-range / time-window selector on `/sensors` moves from the page body into the SubHeader (left or center slot), matching other dashboard routes.
- [x] **SENSORS-02**: The "Jetzt messen" action moves into the SubHeader right slot and uses the shared `Button` primitive.
- [x] **SENSORS-03**: The Sensors page body contains only KPI cards, charts, and tables — no header-level controls remain inline in the body.

### Toggle component (TOGGLE-*)

- [x] **TOGGLE-01**: A new `Toggle` component exists under `frontend/src/components/ui/` — pill container with a white/elevated indicator that slides under the active label, matching the reference screenshot.
- [x] **TOGGLE-02**: The EN/DE language switch in the top header uses the new `Toggle`.
- [x] **TOGGLE-03**: The light/dark theme switch uses the new `Toggle` (sun/moon icons as labels).
- [x] **TOGGLE-04**: Existing 2-option boolean `SegmentedControl` usages (audit Sales/HR toggle, sensor window binary cases, etc.) migrate to the new `Toggle`. Segmented controls with 3+ options remain as `SegmentedControl`.
- [x] **TOGGLE-05**: The `Toggle` animation respects `prefers-reduced-motion` (instant indicator swap, no slide) and is keyboard-navigable (Arrow keys move focus/selection, Enter/Space activates, `role="radiogroup"` semantics).

### Accessibility & parity (A11Y-*)

- [x] **A11Y-01**: Full DE/EN i18n key parity (EN count == DE count) for every new or renamed key introduced by v1.19; DE copy uses du-tone.
- [x] **A11Y-02**: All new and migrated controls expose an accessible name (visible label or `aria-label`) and a visible focus ring in both light and dark modes.
- [x] **A11Y-03**: Dark-mode sweep across every migrated surface — no hardcoded color literals, no contrast regressions, all tokens resolve in both themes.

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
| HDR-01 | Phase 56 | TBD | Pending |
| HDR-02 | Phase 56 | TBD | Pending |
| HDR-03 | Phase 56 | TBD | Pending |
| HDR-04 | Phase 56 | TBD | Pending |
| SECTION-01 | Phase 57 | TBD | Pending |
| SECTION-02 | Phase 57 | TBD | Pending |
| SECTION-03 | Phase 57 | TBD | Pending |
| SECTION-04 | Phase 57 | TBD | Pending |
| CTRL-01 | Phase 55 | TBD | Pending |
| CTRL-02 | Phase 55 | TBD | Pending |
| CTRL-03 | Phase 55 | TBD | Pending |
| CTRL-04 | Phase 55 | TBD | Pending |
| SENSORS-01 | Phase 58 | TBD | Pending |
| SENSORS-02 | Phase 58 | TBD | Pending |
| SENSORS-03 | Phase 58 | TBD | Pending |
| TOGGLE-01 | Phase 54 | TBD | Pending |
| TOGGLE-02 | Phase 54 | TBD | Pending |
| TOGGLE-03 | Phase 54 | TBD | Pending |
| TOGGLE-04 | Phase 54 | TBD | Pending |
| TOGGLE-05 | Phase 54 | TBD | Pending |
| A11Y-01 | Phase 59 | TBD | Pending |
| A11Y-02 | Phase 59 | TBD | Pending |
| A11Y-03 | Phase 59 | TBD | Pending |

**Coverage:**
- Active requirements: 23 total
- Mapped to phases: 23 / 23 ✓
- Orphaned: 0

**Phase allocation:**
- Phase 54 — Toggle Primitive + Migrations: 5 (TOGGLE-01..05)
- Phase 55 — Consolidated Form Controls: 4 (CTRL-01..04)
- Phase 56 — Breadcrumb Header + Content-Nav Relocation: 4 (HDR-01..04)
- Phase 57 — Section Context + Standardized Trashcan: 4 (SECTION-01..04)
- Phase 58 — Sensors Layout Parity: 3 (SENSORS-01..03)
- Phase 59 — A11y & Parity Sweep: 3 (A11Y-01..03)

---

*Roadmap drafted 2026-04-21 — 6 phases (54–59), 23/23 requirements mapped, 0 orphans. Next: `/gsd:plan-phase 54`.*
