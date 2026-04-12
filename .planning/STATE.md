---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: HR KPI Dashboard & Personio-Integration
status: completed
stopped_at: Phase 16 context gathered
last_updated: "2026-04-12T15:14:32.204Z"
last_activity: 2026-04-12
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 10
  completed_plans: 10
  percent: 0
---

# Project State: KPI Light

**Last updated:** 2026-04-12
**Session:** v1.3 HR KPI Dashboard & Personio-Integration — roadmap created

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-12 after v1.3 milestone started)

**Core value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

**Current focus:** Phase 16 — i18n-polish

---

## Current Position

Phase: 16
Plan: Not started
**Milestone:** v1.3 HR KPI Dashboard & Personio-Integration
**Status:** Milestone complete
**Last activity:** 2026-04-12

Progress: [░░░░░░░░░░] 0%

---

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.3)
- Average duration: — (no plans yet)
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

---
| Phase 12-hr-schema-personio-client P01 | 6min | 2 tasks | 6 files |
| Phase 12-hr-schema-personio-client P02 | 8min | 1 tasks | 2 files |
| Phase 13-sync-service-settings-extension P01 | 2m 22s | 2 tasks | 5 files |
| Phase 13-sync-service-settings-extension P02 | 2min | 2 tasks | 4 files |
| Phase 13-sync-service-settings-extension P03 | 8m | 2 tasks | 4 files |
| Phase 14-navigation-hr-tab-shell P01 | 5min | 2 tasks | 6 files |
| Phase 14-navigation-hr-tab-shell P02 | 10min | 2 tasks | 3 files |
| Phase 15 P01 | 3min | 2 tasks | 4 files |
| Phase 15 P02 | 3min | 2 tasks | 6 files |

## Accumulated Context

### Decisions

Recent decisions affecting current work:

- **v1.3 constraint:** APScheduler runs in-process via FastAPI lifespan — single Uvicorn worker required (no `--workers > 1`); scheduler state is in-memory only
- **v1.3 constraint:** Personio credentials (client_id, client_secret) are write-only — never returned in GET /api/settings; masked display in Settings UI
- **v1.3 constraint:** Personio v2 endpoints for absences (v1 deprecated July 2026) — must use v2 from the start
- **v1.3 constraint:** No time filter on HR tab — user decision; HR tab shows current period only
- **v1.3 design:** KPI #4 (Skill Development) uses snapshot diffing on custom attribute — highest complexity; "nicht konfiguriert" fallback required
- **v1.3 design:** KPI #5 (Revenue/MA) is a cross-source join (orders DB + Personio employees); em-dash fallback when no ERP data
- **v1.3 design:** Phase ordering: Schema → Sync Service → Nav Shell → KPI Cards → i18n; matches v1.1/v1.2 pattern
- [Phase 12-hr-schema-personio-client]: Fernet BYTEA storage: ciphertext stored as BYTEA on AppSettings singleton, consistent with logo_data precedent
- [Phase 12-hr-schema-personio-client]: personio_client_id/secret are Optional in SettingsUpdate (None = preserve existing encrypted value); SettingsRead exposes personio_has_credentials boolean only
- [Phase 12-hr-schema-personio-client]: DEFAULT_SETTINGS reset comparison uses model_dump(include=_CORE_FIELDS) to exclude Personio Optional fields
- [Phase 12-hr-schema-personio-client]: PersonioClient token cached in-memory (not DB); proactive refresh at <60s buffer (D-12/D-13)
- [Phase 12-hr-schema-personio-client]: pytestmark asyncio removed — asyncio_mode=auto in pytest.ini handles async test detection without explicit marks
- [Phase 13-sync-service-settings-extension]: Adapted _normalize_absence to use actual PersonioAbsence model columns (time_unit + hours) rather than plan template fields (absence_type_name, days_count, status)
- [Phase 13-sync-service-settings-extension]: Sequential fetches in run_sync() (not asyncio.gather) to maintain FK ordering: employees upserted before attendances and absences
- [Phase 13-sync-service-settings-extension]: app.state.scheduler attached in lifespan so PUT /api/settings can reschedule without global import side-effects
- [Phase 13-sync-service-settings-extension]: interval_h == 0 removes APScheduler job (manual-only mode, D-07); replace_existing=True handles both add and reschedule in one call
- [Phase 13-sync-service-settings-extension]: Used native <select> elements with Tailwind styling as shadcn Select fallback — no shadcn Select component exists in this project
- [Phase 13-sync-service-settings-extension]: PersonioCard testPersonioConnection uses local component state, not draft, to avoid marking settings dirty on connection test
- [Phase 14-navigation-hr-tab-shell]: GET /api/sync/meta returns SyncMetaRead() defaults (all null) when no personio_sync_meta row exists — avoids 404 on fresh installs before first sync
- [Phase 14-navigation-hr-tab-shell]: nav.dashboard renamed to nav.sales in both locale files (EN: Sales, DE: Vertrieb) — NAV-01 satisfied in Plan 01 (data layer) before NavBar component update in Plan 02
- [Phase 14-navigation-hr-tab-shell]: FreshnessIndicator gated on location === '/' || location === '/upload' — hidden on /hr and /settings
- [Phase 14-navigation-hr-tab-shell]: HRPage sync feedback uses local useState ('idle'|'success'|'error') with 3s auto-reset, independent of TanStack mutation lifecycle
- [Phase 15]: Sequential awaits for HR KPI computations on shared AsyncSession (no asyncio.gather)
- [Phase 15]: Single /api/hr/kpis endpoint returns all 5 KPIs; revenue/employee reuses aggregate_kpi_summary
- [Phase 15]: Static delta labels for HR KPIs (vs. Vormonat / vs. Vorjahr) since HR tab has no time filter
- [Phase 15]: Intl.NumberFormat for percent (1 decimal) and EUR currency (0 decimals) formatting on HR KPI cards

### Pending Todos

None yet.

### Open Blockers

None.

### Carry-forward Tech Debt (from v1.0/v1.2)

- Phase 2 human-UAT: 5 visual items (drag-drop spinner, toast, inline error list) — non-blocking
- DASH-02 monthly-only: granularity toggle removed by user request; backend still supports daily/weekly/monthly

---

## Session Continuity

**Last session:** 2026-04-12T14:56:39.200Z
**Stopped at:** Phase 16 context gathered
**Resume file:** .planning/phases/16-i18n-polish/16-CONTEXT.md
