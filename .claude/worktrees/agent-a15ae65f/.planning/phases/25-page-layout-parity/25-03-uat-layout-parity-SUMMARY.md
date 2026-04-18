---
phase: 25-page-layout-parity
plan: 03
subsystem: ui
tags: [react, tailwind, uat, settings, navbar, i18n]

# Dependency graph
requires:
  - phase: 25-01-upload-container-and-grid
    provides: /upload two-column grid with max-w-7xl container
  - phase: 25-02-settings-container
    provides: /settings max-w-7xl container with pb-32 ActionBar clearance
provides:
  - UC-10 human UAT signoff for v1.10 layout parity
  - Settings page card consolidation (Appearance + HR wrapper cards)
  - NavBar logo+app-name co-display and contextual back-button with label
affects: [future-settings-plans, future-navbar-plans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "embedded prop pattern: components accept `embedded` to render as subsections inside a parent Card rather than as standalone Cards"
    - "sessionStorage lastDashboard: NavBar tracks last visited dashboard so back button navigates to known location rather than history.back()"

key-files:
  created: []
  modified:
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/components/NavBar.tsx
    - frontend/src/components/settings/PersonioCard.tsx
    - frontend/src/components/settings/HrTargetsCard.tsx
    - frontend/src/components/settings/LogoUpload.tsx
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json

key-decisions:
  - "UAT approved: operator signed off UC-10 — all four pages pass container parity, delta label survival, and no dashboard regressions"
  - "UAT scope additions committed as chore(25-03): Appearance card merges Identity+Colors; HR card merges Personio+Targets; NavBar shows logo+app-name together; back button is contextual with text label; SALES/VERTRIEB uppercased; Sollwerte renamed from HR-KPI Sollwerte"
  - "embedded prop pattern established: PersonioCard and HrTargetsCard both accept embedded=true to render as <section> subsections instead of standalone <Card> components"
  - "Logo grid ratio 1/6 (col-span-1 of 4) for logo preview; dropzone takes col-span-3 (3/4) when logo present, full width when no logo"

patterns-established:
  - "embedded prop pattern: Pass embedded=true to settings sub-cards to suppress outer Card wrapper and render as <section> with h3 heading instead of CardHeader"
  - "sessionStorage for transient nav state: use sessionStorage.setItem('lastDashboard', location) in NavBar useEffect to track last dashboard, with try/catch for sandboxed environments"

requirements-completed: [UC-10]

# Metrics
duration: ~30min
completed: 2026-04-14
---

# Phase 25 Plan 03: UAT Layout Parity Summary

**Human UAT approved UC-10 — all four pages pass container parity, delta label survival (DE/EN, month/quarter/year), and zero dashboard regressions; UAT session also produced Settings card consolidation and NavBar contextual back button**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-14
- **Completed:** 2026-04-14
- **Tasks:** 1
- **Files modified:** 7 (all UAT scope additions)

## Accomplishments

- UC-10 signed off: operator verified all four pages (`/`, `/hr`, `/upload`, `/settings`) at wide and narrow viewports in both DE and EN
- Container parity confirmed: max-w-7xl outer wrapper consistent across all pages
- Delta labels confirmed: EN (`vs. prev. month/quarter/year`) and DE (`vs. Vormonat/Vorquartal/Vorjahr`) correct across month/quarter/year granularities on both Sales and HR dashboards
- Settings page restructured: Identity+Colors merged into one Appearance card; Personio+HrTargets merged into one HR card — reduces visual noise, improves information hierarchy
- NavBar upgraded: logo and app-name now display together (not mutually exclusive); back button shows contextual label ("Back to Sales" / "Back to HR") and navigates to tracked last dashboard
- SALES/VERTRIEB nav label uppercased to match product intent; HR-KPI Sollwerte renamed to Sollwerte

## Task Commits

1. **Task 1: Human UAT checkpoint** — approved by operator (no code changes; human verification task)
2. **UAT scope additions** - `2b833db` (chore: UI polish adjustments from UAT session)

**Plan metadata:** (this commit — docs: complete uat-layout-parity plan)

## Files Created/Modified

- `frontend/src/pages/SettingsPage.tsx` — Merged Identity+Colors into Appearance card; merged Personio+HrTargets into HR card; removed page subtitle; logo field now uses 1/6 grid column (md:col-span-2 of 6 for app-name, md:col-span-4 for logo)
- `frontend/src/components/NavBar.tsx` — Show logo+app-name together in flex row; contextual back label via sessionStorage lastDashboard tracking; back button navigates to tracked dashboard not history.back()
- `frontend/src/components/settings/PersonioCard.tsx` — Add `embedded` prop; credentials restructured as 3-column grid; Data Retrieval subsection header added
- `frontend/src/components/settings/HrTargetsCard.tsx` — Add `embedded` prop; target inputs switch to 4-column grid (sm:grid-cols-2 lg:grid-cols-4)
- `frontend/src/components/settings/LogoUpload.tsx` — Switch to grid-cols-4; logo preview in col-span-1 (1/4 of row); dropzone col-span-3 or col-span-4 when no logo
- `frontend/src/locales/en.json` — Identity→Appearance; HR KPI Targets→Targets; add settings.hr.title, nav.back_to_sales, nav.back_to_hr, settings.personio.data_retrieval; SALES uppercased
- `frontend/src/locales/de.json` — Same key additions in German; VERTRIEB uppercased; Sollwerte renamed

## Decisions Made

- **UAT approved:** Operator verbally approved. All checklist items passed — container parity, upload two-column grid, settings sticky ActionBar clearance, padding rhythm, dashboard no-regression, delta label survival in both locales.
- **Scope additions during UAT are recorded as chore commit, not blocking:** The UI polish requests (card merging, logo ratio, back button, label renames) were executed against frontend files and committed separately from the UAT gate. They do not affect the UC-10 signoff decision.
- **embedded prop over component duplication:** PersonioCard and HrTargetsCard now accept `embedded=true` to suppress their own Card wrapper. Enables card nesting without duplication of the field rendering logic.

## Deviations from Plan

### Scope Additions During UAT Session

The following work was requested by the operator during the UAT session and falls outside the original 25-03 plan scope. All items were completed and committed as `chore(25-03): ui polish adjustments from UAT session` (`2b833db`):

1. **Settings Appearance card** — Identity card (app-name + logo) and Colors card merged into a single "Appearance" card with Colors as an `<h3>` subsection. App-name field uses `md:col-span-2` of a 6-column grid; logo uses `md:col-span-4`.

2. **Logo grid ratio 1/6** — LogoUpload component switched from `flex-shrink-0 / flex-1` to `grid-cols-4` with logo in `col-span-1` (25% of row at `sm+`). Dropzone takes `col-span-3` when logo present, `col-span-4` when absent.

3. **Personio subsections** — PersonioCard restructured: credentials in 3-column grid (Client-ID | Client-Secret | Sync-Interval); "Data Retrieval" `<h3>` subsection added above department/cost-center/skill fields.

4. **HR card wrapper** — SettingsPage wraps PersonioCard + HrTargetsCard inside a single "HR" Card. Both components gained `embedded` prop to render as `<section>` + `<h3>` rather than standalone `<Card>` + `<CardHeader>`.

5. **Back button with text label** — NavBar back button changed from icon-only to icon + contextual text label. NavBar now tracks last visited dashboard (`/` or `/hr`) via `sessionStorage.setItem("lastDashboard", location)` in a `useEffect`. Back button navigates to tracked location and labels itself "Back to Sales" / "Back to HR" (EN) or "Zurück zu Vertrieb" / "Zurück zu HR" (DE).

6. **NavBar logo + app-name** — Brand slot changed from mutually exclusive (logo OR text) to combined (logo AND text always shown together in `flex items-center gap-2`).

7. **SALES/VERTRIEB uppercase** — `nav.sales` key updated to `"SALES"` (EN) and `"VERTRIEB"` (DE) in both locale files.

8. **HR-KPI Sollwerte → Sollwerte** — `settings.targets.title` key changed from `"HR KPI Targets"` / `"HR-KPI Sollwerte"` to `"Targets"` / `"Sollwerte"`. Card-level context is provided by the parent HR card title.

---

**Total deviations:** 0 auto-fix rule deviations (plan task was human-verify checkpoint, no code changes required)
**Scope additions:** 8 UI polish items added during UAT, all committed; none affect UC-10 signoff

## Issues Encountered

None — UAT checkpoint approved cleanly. Scope additions were additive and did not surface regressions.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 25 complete — v1.10 UI Consistency Pass milestone ready to close
- All five UC-06 through UC-10 requirements satisfied
- Settings page card consolidation is a stable pattern; future settings additions should follow the Appearance / HR / (new card) grouping

---
*Phase: 25-page-layout-parity*
*Completed: 2026-04-14*
