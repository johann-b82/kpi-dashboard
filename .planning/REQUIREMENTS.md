# Requirements: KPI Dashboard v1.13

**Defined:** 2026-04-16
**Core Value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

## v1.13 Requirements

Requirements for in-app documentation milestone. Each maps to roadmap phases.

### Navigation & Infrastructure

- [ ] **NAV-01**: User can access documentation via a book icon in the navbar (left of upload icon)
- [ ] **NAV-02**: User sees a role-filtered sidebar with doc sections (Admins see User + Admin guides, Viewers see User guide only)
- [ ] **NAV-03**: User lands on a role-aware default article when navigating to /docs (Admin→admin intro, Viewer→user intro)
- [ ] **NAV-04**: Docs page is lazy-loaded so it does not impact dashboard bundle size

### Content Rendering

- [ ] **RENDER-01**: User sees Markdown content rendered as styled prose with dark mode support
- [ ] **RENDER-02**: User sees syntax-highlighted code blocks in documentation
- [ ] **RENDER-03**: User sees clickable heading anchor links for deep linking within articles
- [ ] **RENDER-04**: User sees an in-page table of contents generated from article headings

### User Guide

- [ ] **UGUIDE-01**: User can read how to upload data files (CSV/TXT format, drag-drop, error handling)
- [ ] **UGUIDE-02**: User can read how to use the Sales dashboard (KPI cards, charts, date filters, deltas)
- [ ] **UGUIDE-03**: User can read how to use the HR dashboard (KPI cards, Personio sync status, deltas)
- [ ] **UGUIDE-04**: User can read how to use filters, date ranges, and chart controls
- [ ] **UGUIDE-05**: User can read how to switch language and dark mode

### Admin Guide

- [ ] **AGUIDE-01**: Admin can read system setup instructions (Docker Compose, environment variables, first start)
- [ ] **AGUIDE-02**: Admin can read architecture overview (services, data flow, tech stack)
- [ ] **AGUIDE-03**: Admin can read Personio integration setup (credentials, sync config, absence/department mapping)
- [ ] **AGUIDE-04**: Admin can read user management instructions (Directus roles, promoting users)

### Internationalization

- [ ] **I18N-01**: All documentation content exists in both DE and EN, consistent with the app's current language
- [ ] **I18N-02**: All UI chrome (sidebar labels, section titles, nav elements) has DE/EN i18n keys

## Future Requirements

Deferred to later milestones. Tracked but not in current roadmap.

### Search & Discovery

- **SEARCH-01**: User can search documentation content via full-text search
- **SEARCH-02**: User can access contextual doc links from Settings and Upload pages

## Out of Scope

| Feature | Reason |
|---------|--------|
| External wiki / CMS | Git-managed static content is simpler; no new service dependency |
| Full-text search | < 20 articles navigable via sidebar; add on user feedback |
| Contextual `?doc=` deep links from app pages | Polish feature; defer to future milestone |
| PDF export of docs | Internal tool; browser print is sufficient |
| User-editable docs / comments | Static authored content; editing is a developer task |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | Phase 34 | Pending |
| NAV-02 | Phase 34 | Pending |
| NAV-03 | Phase 34 | Pending |
| NAV-04 | Phase 33 | Pending |
| RENDER-01 | Phase 33 | Pending |
| RENDER-02 | Phase 33 | Pending |
| RENDER-03 | Phase 33 | Pending |
| RENDER-04 | Phase 33 | Pending |
| UGUIDE-01 | Phase 35 | Pending |
| UGUIDE-02 | Phase 35 | Pending |
| UGUIDE-03 | Phase 35 | Pending |
| UGUIDE-04 | Phase 35 | Pending |
| UGUIDE-05 | Phase 35 | Pending |
| AGUIDE-01 | Phase 36 | Pending |
| AGUIDE-02 | Phase 36 | Pending |
| AGUIDE-03 | Phase 36 | Pending |
| AGUIDE-04 | Phase 36 | Pending |
| I18N-01 | Phase 36 | Pending |
| I18N-02 | Phase 34 | Pending |

**Coverage:**
- v1.13 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-16*
*Last updated: 2026-04-16 after roadmap creation*
