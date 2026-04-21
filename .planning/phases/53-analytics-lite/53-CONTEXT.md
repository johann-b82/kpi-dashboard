# Phase 53: Analytics-lite - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin Devices table gains two per-device analytics columns — "Uptime 24h %" and "Heartbeats missed 24h" — computed server-side from a heartbeat event log. Read-only endpoint behind existing admin gate. 30 s polling + tab-visibility refresh. No SSE/websocket. Revoked devices excluded.

**Not in scope:** per-item playtime tracking, per-device calibration, sparkline/history UI, alerting, multi-window analytics (7d/30d). Those belong in v1.19+.

</domain>

<decisions>
## Implementation Decisions

### Data Source & Metric Definition
- **D-01:** Add a new lightweight heartbeat event log table. **Amends ROADMAP.md's "no new schema" claim for Phase 53** — the claim was incompatible with a meaningful 60-second-window uptime metric as written in SGN-ANA-01. Planner must update ROADMAP.md Phase 53 goal line + REQUIREMENTS.md SGN-ANA-01 to reflect this correction.
- **D-02:** Logging strategy = **row per heartbeat** in `signage_heartbeat_event (device_id FK, ts timestamptz, PK (device_id, ts) or surrogate id + index on (device_id, ts))`. `POST /signage/heartbeat` inserts one row in addition to the existing `last_seen_at` update. Exact column layout and index choice left to planner/researcher.
- **D-03:** Retention = **25 h rolling window, pruned by the existing 60 s heartbeat sweeper** (`backend/app/scheduler.py` `_run_signage_heartbeat_sweeper`). Extend that job with a `DELETE … WHERE ts < now() - interval '25 hours'`. No separate cron.
- **D-04:** `uptime_24h_pct` = count of distinct minute-buckets containing ≥1 heartbeat in the last 24 h, divided by the denominator defined in D-06, × 100. Rounded to 1 decimal (planner can confirm precision).
- **D-05:** `missed_windows_24h` = `denominator − windows_with_heartbeat` (mirror of uptime). Tooltip wording: "X one-minute windows without a heartbeat in the last 24 h".
- **D-06:** Partial-history handling — denominator = `min(1440, minutes_since_first_heartbeat_of_device)`. Frontend tooltip shows "over last Xh" when window <24 h so operators see honest signal from day one instead of misleading 100 %.
- **D-07:** Revoked devices — **excluded server-side** from the analytics endpoint response (match the existing DevicesPage behaviour that filters them out of the UI).

### Endpoint Shape
- **D-08:** New endpoint `GET /api/signage/admin/devices/analytics` returning a list `[{device_id: UUID, uptime_24h_pct: float, missed_windows_24h: int}]`. Separate from `GET /admin/devices` — no changes to existing device CRUD contracts.
- **D-09:** **No server-side cache.** Compute on each call via a single bucketed SQL. Small device count (<100) + 25 h of per-minute rows makes one SQL cheap. Revisit if profiling shows pressure.
- **D-10:** Router lives alongside existing admin routers under `backend/app/routers/signage_admin/` (new `analytics.py` file, mounted through `signage_admin/__init__.py`). Inherits router-level admin dependencies (hard gate carried from v1.16).

### Frontend Data Flow
- **D-11:** New `signageKeys.deviceAnalytics()` TanStack query. `refetchInterval: 30_000` (match existing DevicesPage) + `refetchOnWindowFocus: true` for visibility-change refresh. Independent of `listDevices` refetch; join by `device_id` in the render layer.
- **D-12:** API client method added to `frontend/src/signage/lib/signageApi.ts` → `listDeviceAnalytics()`. apiClient-only (hard gate carried).

### Badge UI
- **D-13:** Thresholds from SGN-ANA-01 success criteria: green ≥ 95 %, yellow 80–95 %, red < 80 %. Reuse existing `Badge` variants (`frontend/src/components/ui/badge.tsx`) — map to semantic variants already in the theme; no new Tailwind colour tokens. No `dark:` variants (hazard 3, hard gate).
- **D-14:** Columns inserted **between the Status chip column and the Last Seen column**. Order: Status → Uptime 24h % → Missed 24h → Last Seen → actions. No custom sorting.
- **D-15:** Tooltip content on hover — plain numeric + window: e.g. "1382 / 1440 one-minute windows had a heartbeat in the last 24 h." DE/EN parity required.
- **D-16:** Partial-history state shown as the same green/yellow/red badge with tooltip noting the shorter window (from D-06). No separate "no data" state unless the device has literally zero heartbeats ever — then show a neutral "—" badge.

### i18n + Docs + CI Invariants
- **D-17:** i18n key namespace `signage.admin.device.analytics.*`: `uptime24h.label`, `uptime24h.tooltip`, `missed24h.label`, `missed24h.tooltip`, `badge.noData`. Both `frontend/src/locales/en.json` and `de.json` — informal "du" tone in DE. i18n parity CI green (hard gate).
- **D-18:** Admin-guide update — new `§Analytics` section in both `frontend/src/docs/en/admin-guide/digital-signage.md` and `frontend/src/docs/de/admin-guide/digital-signage.md`. Covers badge meaning, thresholds (≥95/80–95/<80), 60 s-window definition, partial-window note for new devices. Matches v1.16 bilingual-doc pattern.
- **D-19:** Signage invariants CI (the Phase 52 SGN-SCHED-UI-04 script) extended to cover the new analytics router + badge component: no `dark:` variants, apiClient-only, no direct DB imports.

### Testing
- **D-20:** Backend integration tests for the analytics endpoint cover:
  1. All-healthy device with 1440 heartbeats → 100 %, 0 missed.
  2. Device with 720 heartbeats evenly distributed → 50 %, 720 missed.
  3. Fresh device, first heartbeat 30 min ago, 30 heartbeats → 100 % over 30-min denominator.
  4. Device with zero heartbeats ever → omitted or `null`/neutral state per D-16.
  5. Revoked device present in DB → not returned.
  6. Two heartbeats within the same minute → count once (distinct-minute logic).
- **D-21:** Frontend component test on DevicesPage: renders both new columns, badge colour switches on threshold crossing, tooltip content localised.

### Claude's Discretion
- Exact SQL shape for the bucketed uptime query (`generate_series` + `LEFT JOIN` vs `COUNT(DISTINCT date_trunc('minute', ts))`). Planner picks the cleanest.
- Precision of `uptime_24h_pct` (0 vs 1 decimal) — planner picks; tooltip exact-numbers are the source of truth.
- Log-table PK vs surrogate id — planner decides based on insert-rate / prune cost.
- Server-side cache introduction later if profiling warrants (D-09 leaves the door open).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` — Phase 53 entry (note: "no new schema" phrase to be amended per D-01)
- `.planning/REQUIREMENTS.md` — SGN-ANA-01 line (to be amended per D-01), Active Requirements "Analytics-lite" section, "Hard gates carried forward from v1.16/v1.17" list, milestone Success Criteria #5
- `.planning/PROJECT.md` — project constraints (Docker, Postgres, Directus-auth, `--workers 1`)

### Existing signage artefacts to extend
- `backend/app/models/signage.py` — add `SignageHeartbeatEvent` model alongside existing `SignageDevice` (l.160), `SignageDeviceTag`, etc.
- `backend/app/routers/signage_player.py` — `POST /heartbeat` (l.82 `post_heartbeat`) — add event insert
- `backend/app/scheduler.py` — `_run_signage_heartbeat_sweeper` (l.200) + `HEARTBEAT_SWEEPER_JOB_ID` (l.48) — add 25h prune step
- `backend/app/routers/signage_admin/__init__.py` — mount new `analytics.py` router
- `backend/app/routers/signage_admin/devices.py` — reference for admin-router patterns (dependencies, response shapes)
- `backend/app/schemas/signage.py` — heartbeat Pydantic shape (l.292) — reference for new analytics schema
- `frontend/src/signage/pages/DevicesPage.tsx` — table that gains two columns
- `frontend/src/signage/components/DeviceStatusChip.tsx` — reference for status-badge pattern
- `frontend/src/signage/lib/signageApi.ts` — apiClient-backed client to extend
- `frontend/src/lib/queryKeys.ts` — `signageKeys` factory to extend
- `frontend/src/components/ui/badge.tsx` — shadcn Badge component with existing variants

### Docs / i18n
- `frontend/src/docs/en/admin-guide/digital-signage.md` — add §Analytics
- `frontend/src/docs/de/admin-guide/digital-signage.md` — add §Analytics (du tone)
- `frontend/src/locales/en.json`, `de.json` — add `signage.admin.device.analytics.*` keys

### Prior phase context (analogous patterns)
- `.planning/phases/52-schedule-admin-ui/52-CONTEXT.md` — most recent admin-tab CONTEXT pattern (reference for CI invariants extension decisions, DE/EN parity handling)
- `.planning/phases/51-schedule-schema-resolver/51-CONTEXT.md` — recent backend schema-addition pattern (migration + sweeper interplay)

### Tests / CI
- `backend/tests/test_signage_heartbeat_sweeper.py` — existing sweeper tests to extend for prune step
- Signage invariants CI script introduced under SGN-SCHED-UI-04 (Phase 52) — location to be confirmed during planning

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Heartbeat sweeper (`backend/app/scheduler.py` l.200, 60 s cadence)** — the natural home for the 25 h prune step; no new scheduled job needed.
- **`Badge` component with semantic variants** — threshold colour mapping without new Tailwind tokens; `dark:` variants forbidden.
- **`signageApi` client + `signageKeys` query factory** — extensible with one new method + one new key; follows apiClient-only invariant.
- **DevicesPage polling at 30 s** — analytics query slots in at the same cadence; `refetchOnWindowFocus` handles the visibility-change requirement without custom listeners.
- **`signage_admin/` router package with admin dependencies** — new `analytics.py` mounts at the same level and inherits the admin gate automatically.

### Established Patterns
- **No `dark:` Tailwind variants** (hazard 3, hard gate) — Badge colour switches must use semantic variants or CSS vars already defined in the theme.
- **apiClient-only on admin frontend** (hard gate) — no bare `fetch`/`axios`.
- **Router-level admin gate via `APIRouter(prefix=…, dependencies=[…])`** — new router inherits.
- **No `import sqlite3` / `import psycopg2`** — use existing async SQLAlchemy session pattern.
- **DE/EN i18n parity CI + informal "du" tone in DE** — hard gate from v1.16.
- **`--workers 1` invariant** — single-process server; in-process caches are viable if we ever revisit D-09.

### Integration Points
- `backend/app/routers/signage_player.py` `post_heartbeat` — one extra insert on the hot path (expected ~1/min/device, negligible).
- `backend/app/scheduler.py` heartbeat sweeper — extend with prune step; single DELETE per tick.
- `backend/app/routers/signage_admin/__init__.py` — new router mount.
- `frontend/src/signage/pages/DevicesPage.tsx` — two new `<TableHead>` + `<TableCell>` columns and one extra `useQuery`.
- `frontend/src/locales/{en,de}.json` — additive keys only.
- Alembic migration for `signage_heartbeat_event` — slot in alongside Phase 51's schedule migration chain (planner confirms head revision).

</code_context>

<specifics>
## Specific Ideas

- "Plain numeric + window" tooltips are deliberately literal ("1382 / 1440 one-minute windows") — they match the SGN-ANA-01 wording exactly so operators and auditors can verify the claim.
- Partial-history denominator (D-06) is important for trust — a Pi provisioned an hour ago should not show 100 % as if it had been alive for 24 h.
- Retention = 25 h (not 24 h) gives the query a clean 1-hour buffer against sweeper timing so edge rows near the boundary aren't prematurely pruned.

</specifics>

<deferred>
## Deferred Ideas

- **Rich popover with last-5-hour sparkline** — lovely UX but needs bucket API extension and a Recharts mini-chart. Parked for v1.19 analytics expansion.
- **Streak/outage-count metric ("3 outages today")** — more actionable than raw missed count. Parked — not what SGN-ANA-01 asks for.
- **Multi-window analytics (7d, 30d)** — requires longer retention or aggregation tables. Parked for v1.19.
- **Per-item playtime tracking** — explicitly out-of-scope per REQUIREMENTS.md locked defaults.
- **Sortable analytics columns in DevicesPage** — no custom sorting this phase; default order unchanged.
- **In-process 30 s TTL cache on the analytics endpoint** — D-09 says "no cache" for now; revisit if profiling shows CPU pressure.
- **Alerting on threshold breaches (red-badge email/webhook)** — belongs in a future observability/alerting phase.

</deferred>

---

*Phase: 53-analytics-lite*
*Context gathered: 2026-04-21*
