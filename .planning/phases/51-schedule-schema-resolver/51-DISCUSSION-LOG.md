# Phase 51: Schedule Schema + Resolver — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 51-schedule-schema-resolver
**Areas discussed:** Timezone source, SSE fanout scope, Resolver composition, Time representation

---

## Timezone source

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Add `timezone` column to `app_settings` | Alembic migration adds `timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Berlin'` to the existing singleton row. Resolver reads via `get_app_settings()`. Admin UI can surface it later. | ✓ |
| (b) Hardcode `Europe/Berlin` | Resolver uses a module-level constant; file backlog item for the column. | |
| (c) `SIGNAGE_TIMEZONE` env var | Read from env with default. | |

**User's choice:** (a)
**Notes:** Single migration handles both `signage_schedules` creation and the `app_settings.timezone` addition. Env-var sprawl avoided; Phase 52 admin-UI surface is a natural follow-up.

---

## Schedule-mutation SSE fanout scope

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Broad — `devices_affected_by_playlist` | Reuse existing helper; notify every device whose tags overlap the scheduled playlist's tags. Players re-resolve; ETag short-circuits the no-op case. | ✓ |
| (b) Tight — before/after diff | Resolve all devices pre-mutation, apply, resolve post-mutation, notify union. Minimal fanout. | |
| (c) Hybrid — broad on create/update, tight on delete | Mixed strategy. | |

**User's choice:** (a)
**Notes:** In-process asyncio.Queue fanout is cheap; ETag short-circuits make no-op re-resolves effectively free. (b) doubles code paths and introduces race windows between the two resolver passes. A distinct SSE event name `schedule-changed` is added so logs/traces can separate schedule-driven re-resolves from playlist-driven ones.

---

## Resolver composition strategy

| Option | Description | Selected |
|--------|-------------|----------|
| (a) New `resolve_schedule_for_device`, wrap inside `resolve_playlist_for_device` | Schedule lookup is a new function; existing function tries it first, falls back to tag branch. 8+ callsites unchanged. | ✓ |
| (b) Inline schedule lookup into existing resolver | Single function does both. | |
| (c) New orchestrator `resolve_for_device` + rename callers | Explicit dispatch, but forces a mass rename. | |

**User's choice:** (a)
**Notes:** Two small testable functions map cleanly onto SGN-TIME-03's 7 test cases. The Phase 43 D-10 pure-read invariant is preserved in both. `now` injection parameter on `resolve_schedule_for_device` for deterministic tests.

---

## Time representation in Python

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Convert to `datetime.time` at edges only | Resolver uses raw int; schema layer converts to `time` for wire format. | |
| (b) Raw int everywhere | No `datetime.time` anywhere. | |
| (c) Helper module `_hhmm.py`; int canonical, `time` at Pydantic boundary | `hhmm_to_time`, `time_to_hhmm`, `now_hhmm_in_tz` helpers. Single conversion point. | ✓ |

**User's choice:** (c)
**Notes:** Matches the `duration_s ↔ duration_ms` single-conversion-point pattern already established in `signage_resolver.py`. Resolver's time-window comparison stays pure integer (`start_hhmm <= now_hhmm < end_hhmm`) — fast and unambiguous.

---

## Claude's Discretion

- Exact index strategy on `signage_schedules` (composite vs per-column, partial on `WHERE enabled`) — planner decides.
- Whether `resolve_schedule_for_device` uses a single SQL query vs multiple round-trips — planner decides; single `ORDER BY priority DESC, updated_at DESC LIMIT 1` is the natural fit.
- Test file layout — follow existing `tests/services/signage/` convention.
- Whether to backfill `app_settings.timezone` via `op.execute("UPDATE ...")` in the migration or rely on column default.

## Deferred Ideas

- Per-device timezone override (current fleet is single-region — not justified)
- Midnight-spanning single-row schedules (operators can split; CHECK constraint locks this at DB level)
- iCal RRULE / date-specific overrides — reopen when weekday-mask proves too narrow
- Schedule-preview "resolve-as-of-time" admin endpoint — backlog / Phase 52 stretch
- `app_settings.timezone` admin-UI surface — decide during Phase 52 discuss-phase
