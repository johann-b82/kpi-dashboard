# Requirements: KPI Light

**Defined:** 2026-04-12
**Core Value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

## v1.3 Requirements

Requirements for HR KPI Dashboard & Personio-Integration milestone. Each maps to roadmap phases.

### Navigation

- [x] **NAV-01**: Existing "Dashboard" tab is renamed to "Sales"
- [x] **NAV-02**: New "HR" tab appears alongside "Sales" in NavBar navigation
- [x] **NAV-03**: HR tab shows last Personio sync timestamp as freshness indicator

### Personio Integration

- [x] **PERS-01**: User can enter Personio API client_id and client_secret in Settings (masked display, write-only — never returned in GET responses)
- [x] **PERS-02**: User can trigger manual Personio data sync via "Daten aktualisieren" button on HR tab with success/error feedback
- [x] **PERS-03**: Personio data syncs automatically at a configurable interval (1h / 6h / 24h / manual-only) set in Settings
- [x] **PERS-04**: Personio raw data (employees, attendances, absences) is fetched and stored in PostgreSQL
- [x] **PERS-05**: Absence types are auto-discovered from Personio API and presented as dropdown in Settings
- [x] **PERS-06**: Departments are auto-discovered from Personio employee data and presented as dropdown in Settings

### HR KPIs

- [x] **HRKPI-01**: HR tab displays Overtime Ratio KPI card (Überstunden / Gesamtstunden) with delta badges (vs. Vorperiode + vs. Vorjahr)
- [x] **HRKPI-02**: HR tab displays Sick Leave Ratio KPI card (Krankheit / Gesamtstunden) with delta badges
- [x] **HRKPI-03**: HR tab displays Fluctuation KPI card (MA-Abgänge / gesamt MA) with delta badges
- [x] **HRKPI-04**: HR tab displays Skill Development KPI card (MA mit neuer Fertigkeit) with delta badges; shows "nicht konfiguriert" fallback if skill attribute key not set
- [x] **HRKPI-05**: HR tab displays Revenue per Production Employee KPI card (Auftrags-Umsatz / Produktions-MA) with delta badges; shows em-dash fallback if no ERP data
- [x] **HRKPI-06**: HR KPI cards show error state when Personio is unreachable or credentials invalid

### Settings Extension

- [x] **SET-01**: Settings page includes configurable sick leave absence type (auto-discovered dropdown)
- [x] **SET-02**: Settings page includes configurable production department name (auto-discovered dropdown)
- [x] **SET-03**: Settings page includes configurable skill custom attribute key for KPI #4
- [x] **SET-04**: Settings page includes auto-sync interval selector (1h / 6h / 24h / manual-only)

### Internationalization

- [x] **I18N-01**: Full DE/EN parity for all v1.3 strings (HR tab, KPI labels, Settings fields, error states, sync feedback)

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Post-v1.3 Validation

- **PERS-07**: Personio sync history log showing last N sync attempts with status
- **HRKPI-07**: Employee count card (total headcount) as contextual 6th KPI

### v2+

- **HRKPI-08**: HR trend chart (historical KPI series over 12 months)
- **HRKPI-09**: Per-employee drill-down view (requires Authentik auth for data protection)
- **PERS-08**: Personio webhook-driven real-time sync (requires public endpoint)
- **PERS-09**: Write-back to Personio (create/update records)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time Personio webhooks | Requires publicly accessible endpoint; internal Docker Compose deployment has no reverse proxy |
| Write-back to Personio | Read-only KPI dashboard; write scopes add data integrity risk |
| Per-employee drill-down | Privacy concern in pre-auth app; individual attendance data visible without access control |
| Absences calendar view | Not a KPI feature; duplicates Personio's built-in UI |
| Full employee directory | Not a KPI feature; duplicates Personio's own interface |
| Historical backdating on first sync | Risk of rate limiting on large initial fetch; em-dash fallback pattern covers no-baseline cases |
| APScheduler persistent job store | Overengineering for interval-based sync; in-memory scheduler with restart recovery is sufficient |
| Time filter on HR tab | User decision — HR tab shows current period only, no preset bar |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | Phase 14 | Complete |
| NAV-02 | Phase 14 | Complete |
| NAV-03 | Phase 14 | Complete |
| PERS-01 | Phase 12 | Complete |
| PERS-02 | Phase 13 | Complete |
| PERS-03 | Phase 13 | Complete |
| PERS-04 | Phase 12, 13 | Complete |
| PERS-05 | Phase 13 | Complete |
| PERS-06 | Phase 13 | Complete |
| HRKPI-01 | Phase 15 | Complete |
| HRKPI-02 | Phase 15 | Complete |
| HRKPI-03 | Phase 15 | Complete |
| HRKPI-04 | Phase 15 | Complete |
| HRKPI-05 | Phase 15 | Complete |
| HRKPI-06 | Phase 15 | Complete |
| SET-01 | Phase 13 | Complete |
| SET-02 | Phase 13 | Complete |
| SET-03 | Phase 13 | Complete |
| SET-04 | Phase 13 | Complete |
| I18N-01 | Phase 16 | Complete |

**Coverage:**
- v1.3 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-04-12*
*Last updated: 2026-04-12 — traceability filled after roadmap creation (Phases 12–16)*
