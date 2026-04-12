# Requirements: KPI Light

**Defined:** 2026-04-12
**Core Value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

## v1.4 Requirements

Requirements for v1.4 Navbar & Layout Polish. Each maps to roadmap phases.

### Navbar

- [ ] **NAV-01**: Logo rendered at reduced size in navbar
- [ ] **NAV-02**: Active tab indicated by blue underline; inactive tabs shown as plain text (no background highlight)
- [ ] **NAV-03**: Upload tab removed from tab navigation
- [ ] **NAV-04**: Upload page accessible via upload icon in navbar action area, positioned between DE/EN toggle and gear/settings icon

### Layout

- [ ] **LAY-01**: Horizontal separator line below the tab bar
- [ ] **LAY-02**: Sub-header row below separator with date range preset buttons (left-aligned) and freshness timestamp (right-aligned), horizontally aligned

### i18n

- [ ] **I18N-01**: All new/modified UI elements maintain full DE/EN parity

## Future Requirements

Deferred to later milestones. Tracked but not in current roadmap.

- **AUTH-01**: Authentik integration (OIDC/OAuth2)
- **DASH-07**: Export filtered data as CSV
- **UPLD-07**: Duplicate upload detection
- **DASH-08**: Per-upload drill-down view

## Out of Scope

| Feature | Reason |
|---------|--------|
| Backend API changes | v1.4 is frontend-only; no new endpoints needed |
| New KPI cards or data features | Scope limited to layout/navigation polish |
| Mobile responsive layout | Web-first desktop 1080p+ (consistent with v1.0 decision) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | Phase 17 | Pending |
| NAV-02 | Phase 17 | Pending |
| NAV-03 | Phase 17 | Pending |
| NAV-04 | Phase 17 | Pending |
| LAY-01 | Phase 17 | Pending |
| LAY-02 | Phase 17 | Pending |
| I18N-01 | Phase 17 | Pending |

**Coverage:**
- v1.4 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0

---
*Requirements defined: 2026-04-12*
*Last updated: 2026-04-12 — Phase 17 mapping added*
