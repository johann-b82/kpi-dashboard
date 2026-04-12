# Requirements: KPI Light

**Defined:** 2026-04-12
**Core Value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

## v1.6 Requirements

Requirements for v1.6 Multi-Select HR Criteria. Each maps to roadmap phases.

### Schema & Migration

- [ ] **MIG-01**: Database migration converts `personio_sick_leave_type_id` (int), `personio_production_dept` (str), and `personio_skill_attr_key` (str) to JSON array columns, preserving existing single values as single-element arrays

### Backend API

- [ ] **API-01**: Settings GET/PUT endpoints accept and return arrays for all 3 Personio config fields
- [ ] **API-02**: Personio options endpoint continues to return available absence types, departments, and skill attributes for the checklist UI

### HR KPI Aggregation

- [ ] **KPI-01**: Sick leave ratio considers all selected absence type IDs (IN filter instead of equality)
- [ ] **KPI-02**: Revenue per production employee considers all selected departments (IN filter instead of equality)
- [ ] **KPI-03**: Skill development KPI considers all selected skill attribute keys (IN filter instead of equality)
- [ ] **KPI-04**: Each KPI returns `is_configured=false` only when its corresponding array is empty or null

### Frontend Settings UI

- [ ] **UI-01**: PersonioCard renders checkbox lists instead of `<select>` dropdowns for all 3 fields
- [ ] **UI-02**: Checkbox state persists correctly through save/reload cycle
- [ ] **UI-03**: All checkbox list labels display correctly in both DE and EN

## Future Requirements

None deferred from this milestone.

## Out of Scope

| Feature | Reason |
|---------|--------|
| "Select all" / "Deselect all" buttons | Keep it simple for v1.6; small option lists |
| Search/filter within checkbox list | Option counts are small (typically <20) |
| Reordering selected items | Order doesn't matter for KPI filtering |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MIG-01 | — | Pending |
| API-01 | — | Pending |
| API-02 | — | Pending |
| KPI-01 | — | Pending |
| KPI-02 | — | Pending |
| KPI-03 | — | Pending |
| KPI-04 | — | Pending |
| UI-01 | — | Pending |
| UI-02 | — | Pending |
| UI-03 | — | Pending |

**Coverage:**
- v1.6 requirements: 10 total
- Mapped to phases: 0
- Unmapped: 10

---
*Requirements defined: 2026-04-12*
*Last updated: 2026-04-12*
