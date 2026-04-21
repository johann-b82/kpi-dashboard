# Phase 51: Schedule Schema + Resolver — Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend-only phase: add a new `signage_schedules` table, extend the tag-based playlist resolver with time-window awareness, fire SSE on schedule mutations, and prove it all with unit + integration tests.

Explicitly **out of scope** (deferred to later phases):
- Admin UI for creating/editing schedules — Phase 52 (SGN-SCHED-UI-*)
- Per-device timezone overrides — Phase 51 uses a single app-level timezone
- iCal RRULE, date-specific one-off overrides, holiday calendars — milestone-deferred
- Midnight-spanning time windows — REQUIREMENTS.md locks `start_hhmm < end_hhmm`; operators split a "22:00–02:00" window into two rows

</domain>

<decisions>
## Implementation Decisions

### D-01: Timezone source — add `timezone` column to `app_settings`
Extend the existing `app_settings` singleton row with `timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Berlin'` in the same Alembic migration that creates `signage_schedules`. Resolver reads it via the existing `get_app_settings()` path.

**Why:** The migration is the natural home for a schema field; env-var sprawl is avoided; Phase 52 (or a later phase) can surface it in the admin UI without a second migration. Fallback default matches the current DACH-market deployment target.

**Validation:** Pydantic layer validates the string resolves via `zoneinfo.ZoneInfo(...)`. Resolver treats an unresolvable value as a hard 500 (misconfiguration should not silently fall back to UTC).

### D-02: Schedule-mutation SSE fanout — broad via `devices_affected_by_playlist`
When a schedule is created/updated/deleted, the admin router calls `devices_affected_by_playlist(db, schedule.playlist_id)` and fans out `notify_device(device_id, {"event": "schedule-changed", "schedule_id": ..., "playlist_id": ...})` to each affected device. Players re-resolve; ETag short-circuits make the no-op case cheap.

**Why:** Fanout is in-process asyncio.Queue — effectively free. Players already handle `playlist-changed` re-resolves with ETag short-circuiting. Tight (before/after diff) fanout doubles code paths and introduces race windows between the two resolver passes. If measurement later shows this fanout is actually noisy at scale, we can narrow it in a targeted phase.

**Implication for SSE event type:** Add a new event kind `schedule-changed` (distinct from `playlist-changed`) so the sidecar/player can log/trace schedule-driven re-resolves separately. Payload mirrors `playlist-changed` shape so existing re-resolve handler logic applies unchanged.

### D-03: Resolver composition — new `resolve_schedule_for_device`, wrap inside `resolve_playlist_for_device`
Add `resolve_schedule_for_device(db, device, *, now=None) -> Optional[PlaylistEnvelope]` as a new top-level service function. Modify `resolve_playlist_for_device` to: (1) call `resolve_schedule_for_device` first; (2) if it returns a non-`None` envelope, return it; (3) otherwise fall through to the existing tag-based branch unchanged.

**Why:** Keeps the 8+ existing callsites of `resolve_playlist_for_device` untouched. Two small testable functions map cleanly onto SGN-TIME-03's 7 test cases (the first 6 exercise `resolve_schedule_for_device` directly; the 7th — "empty schedules falls back to tag resolver" — exercises the composition). Phase 43 D-10 pure-read invariant is preserved in both functions.

**Injection point for `now`:** `now: datetime | None = None` parameter, default `datetime.now(zoneinfo.ZoneInfo(app_settings.timezone))`. Tests override `now=` explicitly for determinism.

### D-04: Time representation — int canonical + `signage/_hhmm.py` helpers
Create `backend/app/services/_hhmm.py` (or a small helper module co-located with the resolver) with:
- `hhmm_to_time(i: int) -> datetime.time`
- `time_to_hhmm(t: datetime.time) -> int`
- `now_hhmm_in_tz(tz_name: str) -> tuple[int, int]` → returns `(weekday, hhmm)` where `weekday` is `0=Mon..6=Sun` matching the bit-0-is-Monday mask, and `hhmm` is the packed int.

DB columns stay `INTEGER` (packed HHMM) per REQUIREMENTS.md; the resolver's time-window check is pure integer: `start_hhmm <= now_hhmm < end_hhmm`. `datetime.time` only appears at the Pydantic boundary (admin schema I/O in Phase 52; Phase 51 has no admin surface).

**Why:** Matches the `duration_s ↔ duration_ms` single-conversion-point pattern already established in `signage_resolver.py`. Integer ops in the hot path are fast and eliminate timezone-confusion bugs inside the resolver core (all timezone handling happens in `now_hhmm_in_tz`, called once per resolve).

### D-05: Weekday mask bit ordering
Bit 0 = Monday, bit 6 = Sunday. Locked by REQUIREMENTS.md SGN-TIME-01. Python-side weekday accessor must be `date.isoweekday() - 1` (since `isoweekday()` returns 1..7 Mon..Sun) or `date.weekday()` (returns 0..6 Mon..Sun — preferred). Matching check is `(weekday_mask >> weekday) & 1`.

### D-06: Alembic migration scope
Single migration file creates `signage_schedules`, adds `timezone` column to `app_settings`, and indexes the hot-path columns (`enabled`, `weekday_mask`, `(start_hhmm, end_hhmm)` — exact index set is a planner-level decision). Round-trip upgrade/downgrade clean (SGN-TIME-01 acceptance).

### D-07: No midnight-spanning windows
Locked by REQUIREMENTS.md CHECK constraint. Documented explicitly in the future admin UI: operators wanting "22:00–02:00" create two rows (22:00–23:59 + 00:00–02:00). Phase 51 adds no special handling — the CHECK constraint enforces it at the DB level.

### Claude's Discretion
- Exact index strategy on `signage_schedules` (composite vs single-column; partial index on `WHERE enabled = true`) — planner decides based on query shape.
- Whether `resolve_schedule_for_device` uses a single SQL query with `LATERAL` / window function or multiple round-trips — planner decides (both are correct; single query is the natural fit for the `priority DESC, updated_at DESC LIMIT 1` pattern).
- Test file organization — follow existing `tests/services/signage/` layout.
- Whether to backfill `app_settings.timezone` in the migration's `op.execute()` step (likely yes — `UPDATE app_settings SET timezone = 'Europe/Berlin' WHERE timezone IS NULL` before adding the NOT NULL constraint), or rely on the column default.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and goals
- `.planning/REQUIREMENTS.md` §"Schedule schema + resolver (SGN-TIME-*)" — SGN-TIME-01/02/03/04 full text (locked schema, resolver algorithm, 7-case test coverage, SSE ≤ 2 s)
- `.planning/REQUIREMENTS.md` §"Success Criteria (milestone-level)" #3–#4 — worked example: Mo–Fr 07:00–11:00 Playlist X priority 10, Mo–So 11:00–14:00 Playlist Y priority 5, fallback at 15:00
- `.planning/REQUIREMENTS.md` §"Hard gates carried forward" — router-level admin gate, `--workers 1`, no sqlite/psycopg, apiClient-only (frontend)
- `.planning/ROADMAP.md` §"Phase 51: Schedule Schema + Resolver" — goal statement + success criteria

### Prior phase contracts this phase extends
- `backend/app/services/signage_resolver.py` — Phase 43 SGN-BE-06 resolver. `resolve_playlist_for_device`, `compute_playlist_etag`, `devices_affected_by_playlist`. D-06/D-07/D-08/D-09/D-10 behaviors must remain intact (empty envelope shape, ordering, etag helper, pure-read).
- `.planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md` — resolver design decisions (D-06–D-10) the new resolver must honor.
- `backend/app/services/signage_broadcast.py` + `.planning/phases/45-sse-broadcast/45-CONTEXT.md` — `notify_device(device_id, event_payload)` contract; in-process asyncio.Queue fanout, post-commit firing from admin routes, `--workers 1` invariant.
- `backend/app/routers/signage_admin/playlists.py` — reference pattern for post-mutation fanout loop (used as the template for `signage_admin/schedules.py`).
- `backend/app/models/_base.py` §`class AppSettings` — singleton row pattern, existing columns; the new `timezone` column lands here.

### Schema + migration conventions
- `backend/alembic/versions/` — existing Alembic migrations for column-addition pattern and singleton-row backfill examples.

### Frontend (out of scope for Phase 51 — informational only for downstream)
- Phase 52 (`SGN-SCHED-UI-*`) will consume the new admin endpoints; no frontend code lands in Phase 51, but API shape decisions should keep Phase 52 UX ergonomic (e.g., returning full schedule rows with resolved playlist name for list view).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resolve_playlist_for_device(db, device)` — extend by wrapping, not replacing. Keeps 8+ callsites stable.
- `compute_playlist_etag(envelope)` — reuse unchanged for both schedule and tag-resolved envelopes (envelope shape is identical).
- `devices_affected_by_playlist(db, playlist_id)` — reuse as-is for schedule-mutation fanout (D-02).
- `signage_broadcast.notify_device(device_id, payload)` — reuse for `schedule-changed` event.
- `AppSettings` singleton model + `get_app_settings()` — natural home for the new `timezone` column.
- Admin router pattern in `routers/signage_admin/playlists.py` — post-commit notify loop is the template for `routers/signage_admin/schedules.py`.

### Established Patterns
- Resolver is **pure-read** (D-10) — no device-row mutations on resolve.
- Envelope shape is stable across matchers — both schedule-matched and tag-matched envelopes use the same `PlaylistEnvelope` schema, so ETag + player handling is uniform.
- Admin routers follow `APIRouter(prefix=..., dependencies=[admin_only])` — new schedule router inherits this.
- Post-mutation SSE fanout runs **after** DB commit, never inside the transaction.
- Datetime conversion happens at a single point in the module (e.g., `duration_s → duration_ms`); apply same discipline to `hhmm ↔ time`.

### Integration Points
- `backend/app/routers/signage_player.py` — calls `resolve_playlist_for_device`. Zero change needed (wrapping preserves signature).
- `backend/app/routers/signage_admin/__init__.py` — new `schedules.py` router registered alongside `playlists.py`, `media.py`, `playlist_items.py`, `devices.py`.
- `backend/app/models/signage.py` — new `SignageSchedule` model class lands here; mirror the `SignagePlaylist` style.
- `backend/app/schemas/signage.py` — new `ScheduleCreate` / `ScheduleRead` / `ScheduleUpdate` Pydantic models.
- Alembic `env.py` — no change (new model auto-discovered via `Base.metadata`).

</code_context>

<specifics>
## Specific Ideas

- **Worked example as the integration-test north star:** REQUIREMENTS #3 — "Mo–Fr 07:00–11:00 → Playlist X (priority 10), Mo–So 11:00–14:00 → Playlist Y (priority 5); device tagged for both resolves X at 08:30 Wed, Y at 12:00 Wed, tag-fallback at 15:00 Wed." This exact scenario becomes at least one end-to-end integration test.

- **Priority ordering is `priority DESC, updated_at DESC`** — not alphabetical, not created_at. A schedule that was edited more recently beats one at the same priority.

- **Schedule has no tags.** Tag overlap is determined via the **playlist's** tags, same as existing tag-based resolution. A schedule points at a playlist; the playlist carries the tags. This keeps the mental model simple: schedules are "when", playlists are "what + who".

- **SSE event name:** `schedule-changed` (not `playlist-changed`) — lets the player/sidecar log/trace schedule-driven re-resolves separately, even though the handler logic is identical.

</specifics>

<deferred>
## Deferred Ideas

- Per-device timezone override — not needed at current fleet scale; revisit if multi-region deployment appears.
- Midnight-spanning single-row schedules — operators can split into two rows; revisit only if operator feedback shows the split is painful.
- iCal RRULE / date-specific overrides (holidays, one-off events) — reopen when weekday-mask proves too narrow.
- Schedule "preview" (resolve-as-of-time) admin endpoint — useful diagnostic but not required for SGN-TIME-*; file as Phase 52 stretch or backlog.
- Timezone column admin-UI surface — could land in Phase 52 alongside schedule admin, or defer to a later settings polish phase. Decide during Phase 52 discuss-phase.

</deferred>

---

*Phase: 51-schedule-schema-resolver*
*Context gathered: 2026-04-21*
