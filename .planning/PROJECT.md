# ACM KPI Light

## What This Is

A Dockerized web application for uploading sales/revenue data files (CSV, TXT, Excel) into a PostgreSQL database and visualizing KPIs on an interactive dashboard. Built for internal team use, designed to plug into a centralized identity provider (Authentik) in a future milestone.

## Core Value

Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

## Requirements

### Validated

- [x] Application runs fully Dockerized (app + Postgres via docker-compose) — Validated in Phase 1: Infrastructure and Schema

### Active

- [ ] User can upload CSV, TXT, or Excel files containing sales/revenue data
- [ ] Uploaded file data is parsed and stored in a PostgreSQL database
- [ ] File schema is consistent (known columns) — no dynamic schema detection needed
- [ ] Dashboard displays summary cards (total revenue, avg order value, key metrics)
- [ ] Dashboard displays charts showing KPI trends over time (line/bar charts)
- [x] Application runs fully Dockerized (app + Postgres via docker-compose) → Validated
- [ ] Upload history is visible (what was uploaded, when)

### Out of Scope

- Authentication/login — deferred to v2, will use Authentik (OIDC/OAuth2)
- Role-based access control — deferred to v2 (admin vs viewer roles)
- Scheduled ingestion from shared folder — deferred to v2
- Active Directory integration — deferred to v2 (via Authentik LDAP/AD connector)
- Multi-tenant / multi-app user management — deferred to v2+
- Automated data pipelines or ETL beyond file upload — future scope
- Mobile-specific UI — web-first

## Context

- **Deployment:** Docker Compose stack (app container + Postgres container)
- **Data format:** Consistent file schema — same columns every upload (sales/revenue metrics)
- **File types:** CSV, TXT (delimited), Excel (.xlsx/.xls)
- **Users:** Internal team, small group, no external access in v1
- **Future architecture:** Authentik as centralized identity provider shared across multiple apps. This KPI app is the first in a planned suite — auth is designed as a separate service from the start.
- **Future ingestion:** Shared folder watcher for automated file pickup (v2)

## Constraints

- **Containerization**: Must run via Docker Compose — no bare-metal dependencies
- **Database**: PostgreSQL — chosen for reliability and ecosystem
- **Identity (future)**: Authentik — self-hosted, Docker-native, supports OIDC/OAuth2/LDAP/AD
- **File schema**: Fixed/known columns — simplifies parsing, no schema inference needed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Authentik for identity (v2) | Self-hosted, Docker-native, supports AD/LDAP/OIDC, reusable across apps | — Pending |
| Auth deferred to v2 | v1 focus is core data pipeline + dashboard; internal-only use doesn't need auth yet | — Pending |
| Fixed file schema | Simplifies parsing significantly; user confirmed columns are consistent | — Pending |
| Docker Compose deployment | Entire stack containerized for portability and reproducibility | ✓ Phase 1 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-10 after Phase 1 completion*
