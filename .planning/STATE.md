---
gsd_state_version: 1.0
milestone: v1.16
milestone_name: Digital Signage
status: executing
stopped_at: Completed 41-05-round-trip-verification-PLAN.md
last_updated: "2026-04-18T15:31:50.129Z"
last_activity: 2026-04-18
progress:
  total_phases: 8
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
  percent: 0
---

# Project State: KPI Dashboard

**Last updated:** 2026-04-18
**Session:** v1.16 Digital Signage — roadmap approved, ready for phase planning

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-18)

**Core value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

**Current focus:** Phase 41 — signage-schema-models

---

## Current Position

Phase: 42
Plan: Not started
Status: Ready to execute
Last activity: 2026-04-18

Progress: [········] 0% (0/8 phases complete)

Next action: `/gsd:plan-phase 41`

---

## Performance Metrics

**Velocity (v1.15):**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| Phase 38 P01 | 228s | 2 tasks | 6 files |
| Phase 38 P02 | 374s | 2 tasks | 6 files |
| Phase 38 P03 | 4m 17s | 4 tasks | 4 files |
| Phase 39 P01 | 3 min | 3 tasks | 12 files |
| Phase 39 P02 | 377s | 2 tasks | 12 files |
| Phase 40 P01 | 35m | 3 tasks | 18 files |
| Phase 40 P03 | 15m | 1 task | 5 files |

*Updated after each plan completion*

---
| Phase 41 P04 | 2min | 1 tasks | 1 files |
| Phase 41 P02 | 156 | 1 tasks | 4 files |
| Phase 41 P01 | 12m | 2 tasks | 2 files |
| Phase 41 P03 | 152s | 2 tasks | 1 files |
| Phase 41 P05 | 35m | 1 tasks | 3 files |

## Accumulated Context

### Decisions

- **v1.16 scope:** 8 phases (41–48), 47 requirements across DB/BE/SCH/ADM/PLY/DIFF/OPS/INF
- **Phase structure:** Schema → Auth/Pair → Admin/Player API (polling) → PPTX → SSE → Admin UI → Player Bundle → Pi/E2E/Docs. Polling ships first, SSE grafts on top (belt-and-braces).
- **Phase 41:** 8-table Alembic migration, partial-unique index on pairing codes, `ON DELETE RESTRICT` on playlist_items.media_id, Directus `DB_EXCLUDE_TABLES` for devices + pairing_sessions, migrate→directus startup ordering via `service_completed_successfully`.
- **Phase 42:** Device auth dep, pair/request/status/claim flow, pairing cleanup in 03:00 UTC cron slot. Token format decision (opaque vs. JWT scoped) deferred to phase planning.
- **Phase 43:** Admin router with `APIRouter(dependencies=[Depends(get_current_user), Depends(require_admin)])`, tag-to-playlist resolver (priority DESC, updated_at DESC, LIMIT 1), polling /playlist + /heartbeat, heartbeat sweeper, CI grep guards + dep-audit test.
- **Phase 44:** PPTX conversion — `asyncio.subprocess_exec` + `asyncio.wait_for(60)` + `Semaphore(1)`, per-conv tempdir, 50MB cap, state machine, startup reset. Worker location (api container vs. dedicated pptx-worker) deferred to phase planning.
- **Phase 45:** SSE via `sse-starlette==3.2.0`, per-device `asyncio.Queue(maxsize=32)`, 15s server pings, admin-mutation notify fanout, explicit `--workers 1` invariant comment block.
- **Phase 46:** `/signage` tabs (Media/Playlists/Devices), `/signage/pair`, launcher tile (MonitorPlay icon), WYSIWYG preview via `react-pdf` admin-side, apiClient-only, no `dark:` variants, DE/EN parity CI.
- **Phase 47:** Separate Vite entry (<200KB gz target), EventSource + 45s watchdog + 30s polling fallback, pdf.js worker via `?url` import pinned to `pdfjs-dist@5.6.205`, format handlers (img/video muted-autoplay-playsinline/pdf-crossfade/iframe sandbox+HEAD preflight/nh3-sanitized HTML srcdoc/PPTX as image sequence). Offline cache architecture (SW vs. Pi sidecar) deferred to phase planning.
- **Phase 48:** Pi provisioning as dedicated `signage` user (NOT root), systemd user service with `After=graphical.target`, Chromium kiosk flag set, bilingual admin guide article + docs-index entries, full E2E walkthrough (fresh Pi → pair → play → net drop → loop → restore).
- [Phase 41]: Plan 41-02: converted schemas.py into package and added 19 Pydantic v2 signage schemas (Base/Create/Read trios + pairing DTOs)
- [Phase 41]: Plan 41-03: handwritten v1_16_signage Alembic revision creating 8 signage tables, partial-unique pairing-code index, RESTRICT FK on playlist_items.media_id; no pgcrypto (PG17 gen_random_uuid builtin); no ENUM types (CHECK constraints for clean round-trip)
- [Phase 41]: Plan 41-05: SGN-DB-02 amended — partial-index predicate on signage_pairing_sessions.code is claimed_at IS NULL only. now() rejected by Postgres (errcode 42P17, non-IMMUTABLE). Expiration invariant now carried by the Phase 42 03:00 UTC pairing-cleanup cron. Round-trip test authored (test_signage_schema_roundtrip.py) catches the regression.

### Cross-cutting hazards (hard gates, see ROADMAP.md)

1. DE/EN i18n parity (CI script)
2. apiClient-only in admin frontend (no direct `fetch()`)
3. No `dark:` Tailwind variants (tokens only)
4. `--workers 1` invariant preserved
5. Router-level admin gate via `APIRouter(dependencies=[…])`
6. No `import sqlite3` / no `import psycopg2`
7. No sync `subprocess.run` in signage services

### Open decisions deferred to phase planning

- **Decision 1 (Phase 44):** PPTX worker location — api container + BackgroundTasks vs. isolated pptx-worker container with `cap_drop`/`read_only`/no DB net. Recommendation: isolated worker (CVE blast-radius).
- **Decision 2 (Phase 41):** Media storage — Directus uploads read-only volume mount vs. backend-owned `/app/media/`. Binds 43+44.
- **Decision 3 (Phase 47):** Player offline cache — `vite-plugin-pwa` SW + Cache API vs. Pi-side sidecar writing to `/var/lib/signage/`. Binds 48.
- **Decision 4 (Phase 42):** Device token format — opaque `secrets.token_urlsafe(32)` sha256-hashed vs. scoped JWT HS256 with rotation-on-heartbeat.

### Pending Todos

- Plan Phase 41 via `/gsd:plan-phase 41`

### Open Blockers

None.

### Carry-forward Tech Debt

- Phase 2 human-UAT: 5 visual items (drag-drop spinner, toast, inline error list) — non-blocking
- DASH-02 monthly-only: granularity toggle removed by user request
- v1.9 D-12 waiver: axe + WebAIM skipped at operator request

---

## Session Continuity

**Last session:** 2026-04-18T15:27:32.739Z
**Stopped at:** Completed 41-05-round-trip-verification-PLAN.md
**Resume file:** None
