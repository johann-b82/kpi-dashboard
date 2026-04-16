# Milestone v1.12 — Requirements

**Milestone goal:** Improve chart readability for multi-year data and rebrand from "KPI Light" to "KPI Dashboard" with CI-aligned login.

---

## Active Requirements

### Charts (CHART)

- [x] **CHART-01**: All chart x-axes display year alongside month (e.g., `Nov '25`) on both Sales and HR dashboards
- [x] **CHART-02**: When chart data spans multiple years, a visual year grouping/separator distinguishes year boundaries
- [x] **CHART-03**: Charts show all months in the data range on the x-axis, even months with no data (gap appears as missing point, axis label still present)

### Branding (BRAND)

- [x] **BRAND-01**: App name reads "KPI Dashboard" everywhere it previously read "KPI Light" (navbar, login page, browser tab title, i18n strings, settings default `app_name`)
- [x] **BRAND-02**: Login page shows the uploaded logo (from `/api/settings/logo`) above the title
- [x] **BRAND-03**: Login page card styling matches the app's existing card aesthetic (clean white, subtle border/shadow, blue accent button) — consistent CI with Settings/Dashboard pages

---

## Future Requirements (deferred)

- SSO/OIDC external providers (Google, M365) — Directus supports; enable when HR asks
- Export filtered data as CSV (DASH-07) — carried over from v1.0 backlog
- Duplicate upload detection (UPLD-07) — carried over
- Per-upload drill-down view (DASH-08) — carried over

---

## Out of Scope (v1.12)

- **Package/repo rename** — stays `acm-kpi-light` on disk; cosmetic rebrand only
- **Dark mode login adjustments** — current dark mode tokens apply automatically via Tailwind class strategy
- **New chart types or KPI metrics** — polish only, no new data

---

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| CHART-01 | Phase 31 | 31-01, 31-02 | Complete |
| CHART-02 | Phase 31 | 31-01, 31-02 | Complete |
| CHART-03 | Phase 31 | 31-01, 31-02 | Complete |
| BRAND-01 | Phase 32 | 32-01 | Complete |
| BRAND-02 | Phase 32 | 32-01, 32-02 | Complete |
| BRAND-03 | Phase 32 | 32-02 | Complete |
