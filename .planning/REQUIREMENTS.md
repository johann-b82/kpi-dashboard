# Requirements: KPI Light

**Defined:** 2026-04-13
**Core Value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

## v1.9 Requirements

Requirements for v1.9 Dark Mode & Contrast. Each maps to roadmap phases.

### Dark Mode Theme

- [ ] **DM-01**: App has a dark color scheme with dark backgrounds, light text, and appropriate card/border colors
- [ ] **DM-02**: All shadcn/ui components render correctly in dark mode (cards, buttons, inputs, dialogs, toasts)
- [ ] **DM-03**: Recharts charts (bar, line, overlay) use dark-mode-appropriate colors for axes, grid, tooltips, and legends
- [ ] **DM-04**: Brand accent color (from Settings) stays the same in both light and dark mode

### Toggle & Preference

- [ ] **DM-05**: A Light/Dark segmented control in the navbar (next to DE/EN toggle) switches between modes
- [ ] **DM-06**: App defaults to OS system preference (prefers-color-scheme) on first visit
- [ ] **DM-07**: User's mode choice is persisted in localStorage and overrides system preference on subsequent visits
- [ ] **DM-08**: Full DE/EN i18n parity for dark mode toggle labels

### Contrast

- [ ] **DM-09**: All text/background combinations meet WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text)
- [ ] **DM-10**: Delta badges, status badges, and colored indicators remain legible in both modes

## Future Requirements

- Authentication/login via OIDC identity provider
- Role-based access control (admin vs viewer)
- Active Directory integration
- Export filtered data as CSV
- Duplicate upload detection

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-switching dark mode on schedule | OS preference + manual toggle is sufficient |
| Dark mode for Settings color picker preview | Color picker shows actual brand colors, not themed |
| Per-user dark mode preference in database | localStorage is sufficient for single-browser use |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DM-01 | Phase 21 | Not started |
| DM-02 | Phase 21 | Not started |
| DM-03 | Phase 21 | Not started |
| DM-04 | Phase 21 | Not started |
| DM-05 | Phase 22 | Not started |
| DM-06 | Phase 22 | Not started |
| DM-07 | Phase 22 | Not started |
| DM-08 | Phase 22 | Not started |
| DM-09 | Phase 23 | Not started |
| DM-10 | Phase 23 | Not started |

**Coverage:**
- v1.9 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0

---
*Requirements defined: 2026-04-13*
*Last updated: 2026-04-13*
