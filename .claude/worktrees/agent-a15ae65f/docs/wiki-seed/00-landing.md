# KPI Dashboard

Welcome to the **KPI Dashboard** documentation. This collection covers everything an internal developer or operator needs to run, use, and maintain the application.

## Contents

- [[Dev Setup]] — Zero-to-running: prerequisites, clone, `.env`, `docker compose up`.
- [[Docker Compose Architecture]] — The 9-service topology with a Mermaid diagram of healthcheck-gated dependencies.
- [[API Reference]] — Organizing model for the FastAPI backend. Live spec lives at `https://kpi.internal/api/docs`.
- [[Personio Sync Runbook]] — Credentials, sync interval, manual refresh, common failure modes.
- [[Sales Dashboard User Guide]] — KPI cards, delta labels, charts, date-range presets, sales table.
- [[HR Dashboard User Guide]] — 5 HR KPIs, 12-month trends, Sollwerte (targets), employee table filters.
- [[Settings Walkthrough]] — Appearance, HR configuration, dark mode, language toggle.
- [[Admin Runbook]] — Adding Dex users, rotating OIDC secrets, backing up Outline and databases, onboarding new projects.

## External references

- **Canonical operator runbook:** [`docs/setup.md`](https://github.com/johann-b82/kpi-dashboard/blob/main/docs/setup.md) — the repo-side runbook Phase 26–30 wrote into. Treat that as the source of truth for ops steps; this wiki summarizes and cross-links.
- **Live API spec:** `https://kpi.internal/api/docs` — auto-generated Swagger UI.

## Conventions

- UI labels reference the English strings (e.g. "Settings → Appearance → Logo"). German parity is maintained via `react-i18next`.
- No screenshots — the UI evolves faster than screenshot maintenance can keep up.
- "KPI Dashboard" is the product display name. Internal identifiers (Dex client id `kpi-light`, hostname `kpi.internal`, repo directory `acm-kpi-light`) keep the pre-rename names deliberately — renaming them would force a stop-the-world migration without product benefit.
