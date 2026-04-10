# Requirements: ACM KPI Light

**Defined:** 2026-04-10
**Core Value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### File Upload

- [ ] **UPLD-01**: User can upload files via drag-and-drop zone or browse button
- [ ] **UPLD-02**: System rejects non-supported file types (only CSV, TXT, Excel accepted) with clear error message
- [ ] **UPLD-03**: Upload shows progress indicator during file processing
- [ ] **UPLD-04**: System displays actionable parse error messages identifying the specific row/column that failed validation
- [ ] **UPLD-05**: Uploaded file data is parsed and stored in PostgreSQL with known fixed schema

### Upload Management

- [ ] **MGMT-01**: User can view upload history (filename, timestamp, row count, status)

### Dashboard

- [ ] **DASH-01**: Dashboard displays summary metric cards (total revenue, avg order value, total orders)
- [ ] **DASH-02**: Dashboard displays time-series chart showing revenue over time
- [ ] **DASH-03**: User can filter dashboard by date range
- [ ] **DASH-04**: Dashboard shows data freshness indicator ("Last updated: [timestamp]")

### Infrastructure

- [ ] **INFR-01**: Application runs via Docker Compose (app container + PostgreSQL container)
- [ ] **INFR-02**: Database schema managed via migrations
- [ ] **INFR-03**: Layout is responsive and usable on 1080p+ desktop screens

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Authentication

- **AUTH-01**: Authentik integration via OIDC/OAuth2
- **AUTH-02**: Role-based access (admin vs viewer)
- **AUTH-03**: Active Directory integration via Authentik

### Upload Enhancements

- **UPLD-06**: Upload confirmation with row count summary before committing
- **UPLD-07**: Duplicate upload detection and warning
- **UPLD-08**: Upload deletion / rollback

### Dashboard Enhancements

- **DASH-05**: Chart type toggle (line vs bar)
- **DASH-06**: Period-over-period deltas on metric cards
- **DASH-07**: Export filtered data as CSV
- **DASH-08**: Per-upload drill-down view

### Ingestion

- **INGS-01**: Scheduled ingestion from shared folder

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Dynamic schema detection / column mapping UI | Fixed schema is a deliberate design decision — simplifies parsing |
| Real-time data pipeline / webhooks | Overengineering for file-upload workflow |
| AI/NL query interface | Not appropriate for v1 internal tool |
| 30+ metric cards | Cognitive overload kills dashboard adoption — 3-7 cards max |
| Custom chart builder / drag-and-drop layout | Massive scope; not needed with fixed schema |
| Mobile-optimized layout | Web-first, internal team, desktop only |
| Notifications / email alerts | No auth = no user identity to notify |
| Multi-tenant / per-user dashboards | One internal team, one data set |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UPLD-01 | TBD | Pending |
| UPLD-02 | TBD | Pending |
| UPLD-03 | TBD | Pending |
| UPLD-04 | TBD | Pending |
| UPLD-05 | TBD | Pending |
| MGMT-01 | TBD | Pending |
| DASH-01 | TBD | Pending |
| DASH-02 | TBD | Pending |
| DASH-03 | TBD | Pending |
| DASH-04 | TBD | Pending |
| INFR-01 | TBD | Pending |
| INFR-02 | TBD | Pending |
| INFR-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 0
- Unmapped: 13

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 after initial definition*
