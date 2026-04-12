---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: HR KPI Dashboard & Personio-Integration
status: executing
stopped_at: Completed 13-01-PLAN.md
last_updated: "2026-04-12T09:28:40.919Z"
last_activity: 2026-04-12
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 5
  completed_plans: 3
  percent: 0
---

# Project State: KPI Light

**Last updated:** 2026-04-12
**Session:** v1.3 HR KPI Dashboard & Personio-Integration — roadmap created

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-12 after v1.3 milestone started)

**Core value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

**Current focus:** Phase 13 — sync-service-settings-extension

---

## Current Position

Phase: 13 (sync-service-settings-extension) — EXECUTING
Plan: 2 of 3
**Milestone:** v1.3 HR KPI Dashboard & Personio-Integration
**Status:** Ready to execute
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

### Pending Todos

None yet.

### Open Blockers

None.

### Carry-forward Tech Debt (from v1.0/v1.2)

- Phase 2 human-UAT: 5 visual items (drag-drop spinner, toast, inline error list) — non-blocking
- DASH-02 monthly-only: granularity toggle removed by user request; backend still supports daily/weekly/monthly

---

## Session Continuity

**Last session:** 2026-04-12T09:28:40.917Z
**Stopped at:** Completed 13-01-PLAN.md
**Resume file:** None
