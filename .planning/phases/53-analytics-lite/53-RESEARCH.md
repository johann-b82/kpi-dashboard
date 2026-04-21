# Phase 53: Analytics-lite - Research

**Researched:** 2026-04-21
**Domain:** FastAPI + SQLAlchemy 2.0 async + Postgres 17 bucketed uptime query; TanStack Query polling; shadcn Badge threshold UI
**Confidence:** HIGH

## Summary

Phase 53 adds a new `signage_heartbeat_event` log table (per-heartbeat row), extends the 60 s heartbeat sweeper with a 25 h prune step, exposes a single bucketed-SQL endpoint `GET /api/signage/admin/devices/analytics`, and surfaces two per-device badges ("Uptime 24h %", "Missed 24h") on the existing DevicesPage table. Every pattern this phase needs is already present and proven in the codebase: the `signage_admin/` router package with inherited admin gate, the DeviceStatusChip pattern for threshold-coloured badges using inline Tailwind classes (`bg-green-100 text-green-800` — no `dark:` variants), the 30 s `refetchInterval` convention, and the asyncpg integration-test harness that controls time by inserting explicit `last_seen_at` timestamps.

**Primary recommendation:**
1. **SQL:** `COUNT(DISTINCT date_trunc('minute', ts)) GROUP BY device_id`, computed server-side in a single query joined against active (non-revoked) `signage_devices`. `generate_series` is overkill and slower for this use case.
2. **PK:** composite PK `(device_id, ts)` — no surrogate id. Insert rate is trivial (~1 row/min/device), prune cost benefits from the PK-ordered scan, and the model stays lean.
3. **Precision:** 1 decimal on `uptime_24h_pct` — matches badge-threshold fidelity (80.0 vs 79.9 is visible) and keeps the tooltip's exact numerator/denominator as the source of truth.
4. **Badges:** extend `DeviceStatusChip`'s proven inline-class pattern (green/amber/red) in a new `UptimeBadge` component — no new shadcn variants, no `dark:` classes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Data Source & Metric Definition**
- **D-01:** Add a new lightweight heartbeat event log table. **Amends ROADMAP.md's "no new schema" claim for Phase 53** — the claim was incompatible with a meaningful 60-second-window uptime metric as written in SGN-ANA-01. Planner must update ROADMAP.md Phase 53 goal line + REQUIREMENTS.md SGN-ANA-01 to reflect this correction.
- **D-02:** Logging strategy = **row per heartbeat** in `signage_heartbeat_event (device_id FK, ts timestamptz, PK (device_id, ts) or surrogate id + index on (device_id, ts))`. `POST /signage/heartbeat` inserts one row in addition to the existing `last_seen_at` update. Exact column layout and index choice left to planner/researcher.
- **D-03:** Retention = **25 h rolling window, pruned by the existing 60 s heartbeat sweeper** (`backend/app/scheduler.py` `_run_signage_heartbeat_sweeper`). Extend that job with a `DELETE … WHERE ts < now() - interval '25 hours'`. No separate cron.
- **D-04:** `uptime_24h_pct` = count of distinct minute-buckets containing ≥1 heartbeat in the last 24 h, divided by the denominator defined in D-06, × 100. Rounded to 1 decimal (planner can confirm precision).
- **D-05:** `missed_windows_24h` = `denominator − windows_with_heartbeat` (mirror of uptime). Tooltip wording: "X one-minute windows without a heartbeat in the last 24 h".
- **D-06:** Partial-history handling — denominator = `min(1440, minutes_since_first_heartbeat_of_device)`. Frontend tooltip shows "over last Xh" when window <24 h so operators see honest signal from day one instead of misleading 100 %.
- **D-07:** Revoked devices — **excluded server-side** from the analytics endpoint response.

**Endpoint Shape**
- **D-08:** New endpoint `GET /api/signage/admin/devices/analytics` returning `[{device_id: UUID, uptime_24h_pct: float, missed_windows_24h: int}]`. Separate from `GET /admin/devices`.
- **D-09:** **No server-side cache.** Compute on each call via a single bucketed SQL.
- **D-10:** Router lives alongside existing admin routers under `backend/app/routers/signage_admin/` (new `analytics.py` mounted through `signage_admin/__init__.py`).

**Frontend Data Flow**
- **D-11:** New `signageKeys.deviceAnalytics()` TanStack query. `refetchInterval: 30_000` + `refetchOnWindowFocus: true`.
- **D-12:** API client method added to `frontend/src/signage/lib/signageApi.ts` → `listDeviceAnalytics()`. apiClient-only.

**Badge UI**
- **D-13:** Thresholds: green ≥ 95 %, yellow 80–95 %, red < 80 %. Reuse existing `Badge` variants. No new Tailwind colour tokens. No `dark:` variants.
- **D-14:** Columns inserted between Status and Last Seen: Status → Uptime 24h % → Missed 24h → Last Seen → actions.
- **D-15:** Tooltip: "1382 / 1440 one-minute windows had a heartbeat in the last 24 h." DE/EN parity.
- **D-16:** Partial-history state uses the same green/yellow/red badge with short-window tooltip. Neutral "—" badge only when device has literally zero heartbeats.

**i18n + Docs + CI**
- **D-17:** i18n key namespace `signage.admin.device.analytics.*` in both `en.json` and `de.json` (du tone).
- **D-18:** Admin guide new §Analytics in both `frontend/src/docs/{en,de}/admin-guide/digital-signage.md`.
- **D-19:** Signage invariants CI extended to cover new analytics router + badge component.

**Testing**
- **D-20:** Backend integration tests cover the six scenarios enumerated in CONTEXT.md §D-20.
- **D-21:** Frontend component test on DevicesPage: renders both new columns, badge colour switches on threshold, tooltip localised.

### Claude's Discretion

- Exact SQL shape for the bucketed uptime query (`generate_series` + LEFT JOIN vs `COUNT(DISTINCT date_trunc('minute', ts))`).
- Precision of `uptime_24h_pct` (0 vs 1 decimal) — tooltip exact numbers are source of truth.
- Log-table PK vs surrogate id.
- Server-side cache introduction later if profiling warrants.

### Deferred Ideas (OUT OF SCOPE)

- Rich popover with last-5-hour sparkline (parked for v1.19).
- Streak/outage-count metric ("3 outages today") — parked.
- Multi-window analytics (7d, 30d) — parked for v1.19.
- Per-item playtime tracking — out-of-scope per REQUIREMENTS.md locked defaults.
- Sortable analytics columns — not this phase.
- In-process 30 s TTL cache on analytics endpoint — D-09 says "no cache"; revisit if profiling shows CPU pressure.
- Alerting on threshold breaches — future observability phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SGN-ANA-01 | Devices admin table gains two server-computed badges per row: "Uptime 24h %" (% of 60-s windows with ≥1 heartbeat in last 24 h) and "Heartbeats missed" (count of 60-s windows without heartbeat in last 24 h, excluding revoked windows). Admin-only. Refresh on tab visibility + 30 s polling. | Requires new `signage_heartbeat_event` table (per D-01 amendment to the "no new schema" claim), bucketed SQL endpoint (see **Architecture Patterns § SQL Shape**), new TanStack query with `refetchOnWindowFocus: true` (see **§ Frontend Data Flow**), badge component matching DeviceStatusChip's inline-class pattern (see **§ Badge UI**). All hard gates (admin gate, apiClient-only, no `dark:`, DE/EN parity) carried via existing infrastructure. |

Note: REQUIREMENTS.md line 43 (SGN-ANA-01) and ROADMAP.md line 181, 229 currently state "no new schema" / "computed from existing heartbeat data". The planner MUST amend both to reflect D-01 (new `signage_heartbeat_event` log table is required for a meaningful 60-s-window metric).
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.135.3 | Router `signage_admin/analytics.py` | Matches existing `signage_admin/schedules.py` / `devices.py` pattern |
| SQLAlchemy | 2.0.49 | `SignageHeartbeatEvent` model + async query | Project standard; existing models in `backend/app/models/signage.py` |
| asyncpg | 0.31.0 | Postgres async driver | Already in use via `backend/app/database.py` |
| Alembic | 1.18.4 | Migration for new table | Already used; head is `v1_18_signage_schedules` |
| PostgreSQL | 17-alpine | `date_trunc('minute', ts)` + COUNT DISTINCT | v17 supports every function we need natively |
| Pydantic v2 | ≥2.9.0 | `DeviceAnalyticsRead` response schema | Used throughout `backend/app/schemas/signage.py` |
| TanStack Query | 5.97.0 | `useQuery` with `refetchInterval` + `refetchOnWindowFocus` | Already used by DevicesPage (l.48–52) |
| shadcn Badge | local copy | Threshold colour surface | `frontend/src/components/ui/badge.tsx` — used by DeviceStatusChip |
| react-i18next | existing | DE/EN parity keys | Existing `signage.admin.devices.*` namespace |

### No new dependencies required. All additions land in existing files/packages.

## Architecture Patterns

### Recommended Project Additions

```
backend/
├── alembic/versions/
│   └── v1_18_signage_heartbeat_event.py     # NEW — down_revision = "v1_18_signage_schedules"
├── app/
│   ├── models/signage.py                     # ADD SignageHeartbeatEvent class
│   ├── schemas/signage.py                    # ADD DeviceAnalyticsRead
│   ├── routers/signage_player.py             # EDIT post_heartbeat: + one INSERT
│   ├── routers/signage_admin/
│   │   ├── __init__.py                       # EDIT: include analytics router
│   │   └── analytics.py                      # NEW
│   └── scheduler.py                          # EDIT _run_signage_heartbeat_sweeper: + prune step
└── tests/
    ├── test_signage_heartbeat_sweeper.py     # EDIT: add prune tests
    ├── test_signage_analytics_router.py      # NEW — 6 scenarios from D-20
    └── test_signage_heartbeat_event_insert.py  # NEW — verify heartbeat POST inserts an event row

frontend/
├── src/
│   ├── components/signage/
│   │   └── UptimeBadge.tsx                   # NEW — shares DeviceStatusChip shape
│   ├── signage/
│   │   ├── pages/DevicesPage.tsx             # EDIT: add 2 columns + new useQuery
│   │   └── lib/
│   │       ├── signageApi.ts                 # ADD listDeviceAnalytics
│   │       └── signageTypes.ts               # ADD DeviceAnalytics
│   ├── lib/queryKeys.ts                      # ADD signageKeys.deviceAnalytics()
│   ├── locales/{en,de}.json                  # ADD signage.admin.device.analytics.*
│   └── docs/{en,de}/admin-guide/digital-signage.md  # ADD §Analytics / §Analyse
```

### Pattern 1: Bucketed Uptime SQL (RECOMMENDED)

**Recommendation: `COUNT(DISTINCT date_trunc('minute', ts))`, NOT `generate_series` + LEFT JOIN.**

```sql
-- Source: PostgreSQL 17 official docs; pattern validated against the project's
-- existing raw-SQL patterns in app/services/signage_resolver.py.
--
-- Computes per-device:
--   buckets_with_hb    = distinct one-minute windows that recorded ≥1 heartbeat in 24 h
--   first_hb_age_min   = minutes since the device's oldest retained heartbeat
--                        (drives D-06 partial-history denominator)

WITH window_bounds AS (
    SELECT now() - interval '24 hours' AS cutoff_start,
           now()                         AS cutoff_end
),
per_device AS (
    SELECT
        he.device_id,
        COUNT(DISTINCT date_trunc('minute', he.ts)) AS buckets_with_hb,
        -- minutes since THIS device's oldest heartbeat still in the log
        EXTRACT(EPOCH FROM (now() - MIN(he.ts))) / 60.0 AS first_hb_age_min
    FROM signage_heartbeat_event he, window_bounds wb
    WHERE he.ts >= wb.cutoff_start
      AND he.ts <  wb.cutoff_end
    GROUP BY he.device_id
)
SELECT
    d.id AS device_id,
    -- D-06: denominator = min(1440, minutes since device's first retained heartbeat)
    LEAST(1440, COALESCE(CEIL(p.first_hb_age_min)::int, 0)) AS denominator,
    COALESCE(p.buckets_with_hb, 0) AS buckets_with_hb
FROM signage_devices d
LEFT JOIN per_device p ON p.device_id = d.id
WHERE d.revoked_at IS NULL;     -- D-07: server-side exclusion
```

Python post-processing computes:

```python
denom = max(row.denominator, 1)         # guard against 0 (zero-heartbeats case — handled separately)
pct   = round((row.buckets_with_hb / denom) * 100, 1)  # D-04, 1-decimal (recommended, see §Precision)
missed = denom - row.buckets_with_hb                   # D-05
```

**Why this, not `generate_series`:**

| Dimension | `COUNT(DISTINCT date_trunc)` | `generate_series` + LEFT JOIN |
|-----------|------------------------------|-------------------------------|
| Lines of SQL | ~15 | ~40 (generate 1440 buckets × N devices cross join, then anti-join) |
| Memory | 1440 distinct per device (< 100 KB total for <100 devices) | Materializes 1440 × N rows (~144 k rows for 100 devices) before aggregating |
| Index usage | PK `(device_id, ts)` gives a perfect range scan per device | Same range scan but with a larger intermediate set |
| Timezone pitfall | `date_trunc('minute', ts)` is timezone-independent at the minute level — any `ts` in UTC buckets correctly | Must align `generate_series` start to `date_trunc('minute', now())` or bucket boundaries skew |
| Readability | Linear intent | Easier to reason about *missed* windows but needs more care |

Both would be fast enough at N<100 devices × 1440 rows/device. The tiebreaker is SQL clarity and less memory — `COUNT(DISTINCT)` wins.

**Timezone note:** `ts` is `TIMESTAMPTZ` (stored as UTC in Postgres internally regardless of client TZ). `date_trunc('minute', ts)` truncates to the minute boundary in the session's timezone, but since all minute boundaries align across timezones (1 min is universal), timezone drift is not a concern for this specific metric. Do NOT pass a third argument to `date_trunc` — the 2-arg form is all we need.

**Index strategy:** PK `(device_id, ts)` is the perfect covering index for `WHERE ts >= cutoff AND device_id = …` and for the 25 h prune `WHERE ts < cutoff`. No separate index needed.

### Pattern 2: Log-Table PK — Composite `(device_id, ts)` (RECOMMENDED)

**Recommendation: composite PK `(device_id, ts)`, no surrogate.**

```python
# backend/app/models/signage.py — ADD alongside SignageSchedule (l.330)

class SignageHeartbeatEvent(Base):
    """Per-heartbeat append-only log — Phase 53 SGN-ANA-01.

    One row per successful POST /api/signage/player/heartbeat. Retention is
    25 h, pruned by the existing heartbeat sweeper (app/scheduler.py).

    Composite PK (device_id, ts) — no surrogate id:
      - Insert rate is ~1/minute/device: natural uniqueness means a tight
        race-condition collision (two POSTs within the same microsecond from
        one device) raises a deterministic IntegrityError the heartbeat
        handler can log-and-ignore, preserving at-least-once semantics.
      - Prune is WHERE ts < cutoff — PK-ordered scan, no index lookup.
      - Analytics query scans WHERE ts >= cutoff, GROUP BY device_id — PK
        covers the filter AND the grouping.
      - Model stays lean; no wasted BigInteger column.

    On-conflict semantics for the heartbeat INSERT: use
    `ON CONFLICT (device_id, ts) DO NOTHING` so a retried POST is idempotent.
    """

    __tablename__ = "signage_heartbeat_event"

    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("signage_devices.id", ondelete="CASCADE"),
        primary_key=True,
    )
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        primary_key=True,
        server_default=func.now(),
    )
```

**Why composite PK, not surrogate `BigInteger id`:**

| Concern | Composite `(device_id, ts)` | Surrogate `id` + index `(device_id, ts)` |
|---------|-----------------------------|------------------------------------------|
| Insert rate (~1/min/device, <100 devices, ~100/min total) | Same — Postgres handles both effortlessly at this rate | Same |
| Natural uniqueness enforcement | Free; duplicate POST → `ON CONFLICT DO NOTHING` | Must add a UNIQUE constraint anyway to be safe |
| Disk footprint (24 h × 100 devices = 144 k rows) | 2 columns × ~40 B = ~5.8 MB incl. PK-clustered storage | Adds 8 B BigInteger × 144 k = +1.1 MB + secondary index bloat |
| Prune cost (`DELETE WHERE ts < cutoff`) | Single range scan, no secondary lookup | Two lookups: find matching rows by index, then delete |
| Ergonomics (SQLAlchemy 2.0) | Straightforward — composite PK is idiomatic for join tables | Redundant surrogate column with no user |

Surrogate `id` only makes sense if downstream consumers need to reference individual heartbeat events (pagination, external URLs). Nothing in SGN-ANA-01 does.

### Pattern 3: Heartbeat Handler — Add INSERT Alongside Existing UPDATE

`backend/app/routers/signage_player.py` l.82–107: add one insert statement before/after the existing `update(SignageDevice)...` in `post_heartbeat`:

```python
# Inside post_heartbeat() — AFTER the existing update(SignageDevice)... execute().
# Same transaction as the last_seen_at update; one commit covers both.
from sqlalchemy.dialects.postgresql import insert as pg_insert

stmt = (
    pg_insert(SignageHeartbeatEvent)
    .values(device_id=device.id, ts=now)
    .on_conflict_do_nothing(index_elements=["device_id", "ts"])
)
await db.execute(stmt)
# existing await db.commit() at the end covers both statements.
```

`pg_insert` (`sqlalchemy.dialects.postgresql.insert`) is required for `on_conflict_do_nothing`; the generic `insert` does not have it.

### Pattern 4: Prune Step in Existing Sweeper

`backend/app/scheduler.py` `_run_signage_heartbeat_sweeper` (l.200). Extend by adding one DELETE statement inside the existing try block, BEFORE the commit:

```python
# Inside _run_signage_heartbeat_sweeper, after the existing update(SignageDevice).
# D-03: 25 h rolling window — 1 h buffer beyond the 24 h metric horizon so
# rows near the boundary don't get pruned before the analytics query needs them.
await asyncio.wait_for(
    session.execute(
        delete(SignageHeartbeatEvent).where(
            SignageHeartbeatEvent.ts < func.now() - timedelta(hours=25)
        )
    ),
    timeout=20,
)
# single commit covers both operations.
```

### Pattern 5: Analytics Router

Match `schedules.py` pattern exactly — no `dependencies=` kwarg (parent router supplies admin gate):

```python
# backend/app/routers/signage_admin/analytics.py
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.schemas.signage import DeviceAnalyticsRead

router = APIRouter(prefix="/devices", tags=["signage-admin-analytics"])

# NOTE: Same prefix as devices.py is OK in FastAPI — different endpoint paths.
# If collision risk, use prefix="/devices/analytics" and path="" or
# prefix="/analytics" and path="/devices".  Recommended for clarity:
# prefix="/analytics/devices", endpoint path="".

@router.get("", response_model=list[DeviceAnalyticsRead])
async def list_device_analytics(
    db: AsyncSession = Depends(get_async_db_session),
) -> list[DeviceAnalyticsRead]:
    # one bucketed query — see Pattern 1
    rows = (await db.execute(text(_ANALYTICS_SQL))).mappings().all()
    return [
        DeviceAnalyticsRead(
            device_id=r["device_id"],
            uptime_24h_pct=round((r["buckets_with_hb"] / max(r["denominator"], 1)) * 100, 1)
                            if r["denominator"] > 0 else None,
            missed_windows_24h=max(r["denominator"] - r["buckets_with_hb"], 0)
                            if r["denominator"] > 0 else 0,
            window_minutes=r["denominator"],  # enables D-06 tooltip "over last Xh"
        )
        for r in rows
    ]
```

**Path recommendation:** `GET /api/signage/analytics/devices` (mount under `signage_admin` with `prefix="/analytics/devices"`) — keeps the analytics namespace clean and avoids any path ordering gotchas with the existing `/devices` CRUD router. This matches D-08's intent ("separate from `GET /admin/devices`").

### Pattern 6: Frontend Data Flow — TanStack Query Parity

`frontend/src/signage/pages/DevicesPage.tsx` currently uses:

```tsx
// l.48–52 — existing pattern
const { data: devices = [], isLoading } = useQuery({
  queryKey: signageKeys.devices(),
  queryFn: signageApi.listDevices,
  refetchInterval: 30_000,
});
```

Add a second query alongside it:

```tsx
const { data: analyticsByDevice = {} } = useQuery({
  queryKey: signageKeys.deviceAnalytics(),
  queryFn: async () => {
    const rows = await signageApi.listDeviceAnalytics();
    return Object.fromEntries(rows.map(r => [r.device_id, r]));  // O(1) render-time lookup
  },
  refetchInterval: 30_000,
  refetchOnWindowFocus: true,   // D-11: visibility-change refresh
});
```

**Confirmation of existing patterns:**
- `refetchInterval: 30_000` — used at DevicesPage.tsx:51.
- `refetchOnWindowFocus` — NOT currently used on DevicesPage; TanStack Query default is `true` globally. If a project-level QueryClient default has disabled it, explicitly pass `true` here. Worth confirming during planning by reading `frontend/src/main.tsx` or wherever `QueryClient` is instantiated. Recommendation: always pass it explicitly for clarity.

### Pattern 7: `signageKeys` Factory Extension

`frontend/src/lib/queryKeys.ts` l.60–71 — additive entry:

```typescript
export const signageKeys = {
  all: ["signage"] as const,
  // ... existing entries unchanged ...
  schedules: () => ["signage", "schedules"] as const,
  scheduleItem: (id: string) => ["signage", "schedules", id] as const,
  // Phase 53 SGN-ANA-01
  deviceAnalytics: () => ["signage", "devices", "analytics"] as const,
};
```

### Pattern 8: Badge UI — Threshold Colours via Inline Tailwind

**`frontend/src/components/ui/badge.tsx` inspection (l.7–28):**

The shadcn Badge has these variants: `default` (primary), `secondary`, `destructive`, `outline`, `ghost`, `link`. **None of these map cleanly to green/yellow/red semantic states.** The `destructive` variant is close to red but uses `bg-destructive/10 text-destructive` (Tailwind destructive token — usually red but not guaranteed across themes) AND includes `dark:` classes in the CVA definition (l.16 `dark:bg-destructive/20 dark:focus-visible:ring-destructive/40`).

**Critical nuance:** the invariants script (`frontend/scripts/check-signage-invariants.mjs` l.16–21) only scans:
- `frontend/src/signage/pages`
- `frontend/src/signage/components`
- `frontend/src/signage/player`
- `frontend/src/player`

It does **NOT** scan `frontend/src/components/ui/` — so the existing `dark:` classes inside `badge.tsx` are grandfathered and do not violate the gate. The gate applies to the call sites we add.

**Blessed pattern:** reuse DeviceStatusChip's approach exactly (`frontend/src/signage/components/DeviceStatusChip.tsx` l.37–42):

```tsx
const classMap: Record<Status, string> = {
  online:  "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  offline: "bg-red-100 text-red-800",
  unseen:  "bg-muted text-muted-foreground",
};
return <Badge className={classMap[status]}>{label}</Badge>;
```

This is the project's established precedent for semantic green/amber/red badges without touching shadcn variants and without `dark:` classes. DeviceStatusChip even documents the reasoning in its comment: *"Status colors are semantic (per UI-SPEC color table) and intentionally invariant across light/dark — meaning > theming."*

**Recommended component:**

```tsx
// frontend/src/signage/components/UptimeBadge.tsx
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";  // if available
import { Badge } from "@/components/ui/badge";

type Tier = "green" | "amber" | "red" | "neutral";

function tier(pct: number | null): Tier {
  if (pct === null) return "neutral";
  if (pct >= 95) return "green";
  if (pct >= 80) return "amber";
  return "red";
}

const CLASS_MAP: Record<Tier, string> = {
  green:   "bg-green-100 text-green-800",
  amber:   "bg-amber-100 text-amber-800",
  red:     "bg-red-100 text-red-800",
  neutral: "bg-muted text-muted-foreground",
};

export function UptimeBadge({
  pct, bucketsWithHb, denominator, windowMinutes,
}: {
  pct: number | null;         // null = no data ever
  bucketsWithHb: number;
  denominator: number;
  windowMinutes: number;      // D-06: may be < 1440 for fresh devices
}) {
  const { t } = useTranslation();
  const label = pct === null ? "—" : `${pct.toFixed(1)}%`;
  const tooltip = pct === null
    ? t("signage.admin.device.analytics.badge.noData")
    : t("signage.admin.device.analytics.uptime24h.tooltip", {
        buckets: bucketsWithHb, denom: denominator, windowH: Math.ceil(windowMinutes / 60),
      });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={CLASS_MAP[tier(pct)]}>{label}</Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
```

Check `frontend/src/components/ui/tooltip.tsx` exists during planning; if it doesn't, use Radix Tooltip directly or fall back to `title={tooltip}` on the Badge span (less polished but keeps the phase minimal).

### Anti-Patterns to Avoid

- **Don't hand-roll a new shadcn Badge variant.** The call-site className-override pattern (DeviceStatusChip) is the established precedent and already audited by the invariants CI. Adding a cva variant requires editing `badge.tsx` (a non-scanned file) and is more invasive.
- **Don't use `generate_series` for the denominator.** Overkill at this data volume and adds complexity.
- **Don't introduce a surrogate PK on `signage_heartbeat_event`.** See Pattern 2.
- **Don't compute analytics on every `GET /admin/devices` call.** The separate endpoint (D-08) keeps the device-CRUD path fast and lets operators turn off analytics polling without breaking the main table.
- **Don't cache on the server.** D-09 is explicit. Small N × 1440 rows is cheap; revisit only if profiling hurts.
- **Don't forget `ondelete="CASCADE"` on the FK.** When a device is deleted, its heartbeat log should go with it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-minute bucket expansion | `generate_series` + LEFT JOIN anti-join | `COUNT(DISTINCT date_trunc('minute', ts))` | Cleaner SQL, less memory, same speed at this scale |
| Time-travel in tests | `freezegun` / `time-machine` | Insert heartbeat rows with explicit `datetime.now(tz=UTC) - timedelta(...)` timestamps via asyncpg | Established pattern in `test_signage_heartbeat_sweeper.py` (l.125–182). No new dep needed |
| Async idempotent UPSERT | Manual SELECT-then-INSERT with row-lock | `sqlalchemy.dialects.postgresql.insert(...).on_conflict_do_nothing(...)` | Atomic; battle-tested; already used in the codebase |
| Tooltip on badge | Custom hover state + portal | shadcn `Tooltip` component (if available) or native `title` attribute | Accessibility + consistency |
| Threshold → colour badge | New Badge cva variant | DeviceStatusChip className-override pattern (`bg-green-100 text-green-800` etc) | Precedent; audited by invariants CI; no `dark:` |

## Runtime State Inventory

Phase 53 is a greenfield-additive backend+frontend phase — not a rename or migration. No live-service reconfiguration, no OS-registered state, no stale build artifacts are involved. The only runtime state concern is:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `signage_heartbeat_event` is a new table. Existing `signage_devices.last_seen_at` column is unchanged. | Standard Alembic upgrade — no data migration |
| Live service config | None. | None |
| OS-registered state | None. APScheduler job `signage_heartbeat_sweeper` already registered (scheduler.py l.413–422); extending its coroutine body requires no job-registration change. | None — re-registration happens on next deploy via lifespan |
| Secrets/env vars | None — new endpoint reuses existing Directus admin-JWT auth. No new secrets. | None |
| Build artifacts | None — no Docker image change, no frontend chunk split impact (new UptimeBadge is ~1 KB). | None |

**Canonical question answered:** After every file in the repo is updated and deployed, the only state that materially changes is (a) the new `signage_heartbeat_event` table is created empty, and (b) the running scheduler starts executing the extended sweeper coroutine on next tick. Both are handled by the standard `alembic upgrade head` + container restart. Zero orphan state.

## Common Pitfalls

### Pitfall 1: Forgetting `ON CONFLICT DO NOTHING` on the heartbeat insert
**What goes wrong:** Two heartbeat POSTs arriving in the same microsecond raise `IntegrityError` on the `(device_id, ts)` PK. The handler rolls back, the client sees a 500, and `last_seen_at` is also not updated — a benign duplicate becomes a visible outage.
**Why it happens:** `ts` defaults to `func.now()` which is evaluated server-side at statement time — but a retry after a client-side timeout can duplicate within the same clock tick under load.
**How to avoid:** Always use `sqlalchemy.dialects.postgresql.insert(...).on_conflict_do_nothing(index_elements=["device_id", "ts"])`.
**Warning signs:** Intermittent 500s on `/player/heartbeat` in logs correlated with high-latency network segments.

### Pitfall 2: `date_trunc('minute', ts)` without bounding the range first
**What goes wrong:** Without a `WHERE ts >= cutoff` filter, the grouping scans the entire log. At 25 h retention this is ~2.5 M rows (100 devices × 1440 minutes × 25 h worst-case if retention is off). Query time balloons.
**Why it happens:** Easy to write the GROUP BY first and forget to bracket the WHERE.
**How to avoid:** Always put `ts >= now() - interval '24 hours' AND ts < now()` in the CTE/subquery that feeds the aggregate.

### Pitfall 3: Zero-heartbeat devices showing `NaN` or `100 %`
**What goes wrong:** A device that has never sent a heartbeat has `denominator = 0` from D-06's `min(1440, minutes_since_first_heartbeat)`. Division by zero in Python raises, and `0 / 0 * 100` in SQL returns NULL that the frontend then renders as `100 %` or `—`.
**Why it happens:** Partial-history denominator math edge case.
**How to avoid:** Treat `denominator = 0` as a distinct "no data" state server-side — return `uptime_24h_pct: null, missed_windows_24h: 0, window_minutes: 0`. The badge renders the neutral "—" (D-16).

### Pitfall 4: Prune-before-metric race
**What goes wrong:** Sweeper prunes at minute boundary; analytics query fires at the same millisecond; a row at exactly 24:00:00 old gets pruned, lowering the distinct-minute count.
**Why it happens:** The sweeper and analytics queries are independent.
**How to avoid:** D-03's 25 h retention buffer (not 24 h) gives a clean hour of slack. Verify the prune cutoff is `ts < now() - interval '25 hours'`, not `24 hours`.

### Pitfall 5: TanStack Query global `refetchOnWindowFocus` disabled
**What goes wrong:** Some projects disable `refetchOnWindowFocus` globally on the QueryClient to avoid surprise refetches. If this project has done so, D-11's "refresh on tab visibility" silently won't work.
**Why it happens:** `refetchOnWindowFocus` defaults to `true` but is commonly overridden.
**How to avoid:** Always pass `refetchOnWindowFocus: true` explicitly on the analytics `useQuery`. Verify behaviour with a DevicesPage component test that blurs/focuses `window` and asserts a refetch fires.

### Pitfall 6: Heartbeat insert inflates POST /heartbeat latency tail
**What goes wrong:** An extra INSERT doubles the write work per heartbeat. Under Pi network jitter, this can tip some heartbeats over the existing 30 s operator threshold and flip healthy devices to "warning" via DeviceStatusChip.
**Why it happens:** The existing UPDATE on `signage_devices` is now two statements.
**How to avoid:** Both statements are in the same transaction — Postgres groups the commit. Expected total latency delta <5 ms at this scale. Verify with a benchmark if concerned.

### Pitfall 7: Missing DE translation → i18n parity CI fail
**What goes wrong:** DE `de.json` is missing one of the new `signage.admin.device.analytics.*` keys. `check-locale-parity.mts` fails CI.
**Why it happens:** Easy to add keys to EN first and forget DE.
**How to avoid:** Add EN + DE keys in the same commit. Use informal "du" tone in DE (project convention).

## Code Examples

### Alembic Migration

```python
# backend/alembic/versions/v1_18_signage_heartbeat_event.py

"""v1.18 Phase 53 signage_heartbeat_event — SGN-ANA-01.

Creates the per-heartbeat event log consumed by the Analytics-lite endpoint.
Composite PK (device_id, ts) — see 53-RESEARCH.md Pattern 2.

Revision ID: v1_18_signage_heartbeat_event
Revises: v1_18_signage_schedules
Create Date: 2026-04-21
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "v1_18_signage_heartbeat_event"
down_revision: str | None = "v1_18_signage_schedules"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "signage_heartbeat_event",
        sa.Column(
            "device_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(
                "signage_devices.id",
                ondelete="CASCADE",
                name="fk_signage_heartbeat_event_device_id",
            ),
            nullable=False,
        ),
        sa.Column(
            "ts",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint(
            "device_id", "ts", name="pk_signage_heartbeat_event"
        ),
    )
    # No secondary index — composite PK already covers both hot queries:
    #   (a) WHERE ts >= cutoff GROUP BY device_id  (analytics)
    #   (b) WHERE ts <  cutoff                     (sweeper prune)


def downgrade() -> None:
    op.drop_table("signage_heartbeat_event")
```

### Pydantic Schema

```python
# backend/app/schemas/signage.py — ADD after ScheduleRead (around l.289)

class DeviceAnalyticsRead(BaseModel):
    """Phase 53 SGN-ANA-01 — per-device analytics response row."""
    model_config = ConfigDict(from_attributes=True)

    device_id: uuid.UUID
    uptime_24h_pct: float | None  # null when denominator == 0 (no heartbeats ever)
    missed_windows_24h: int
    window_minutes: int           # D-06 partial-history — frontend tooltip shows "over last Xh"
```

### Test Fixture Pattern (from existing `test_signage_heartbeat_sweeper.py`)

```python
# New test file: backend/tests/test_signage_analytics_router.py
# Pattern lifted from test_signage_heartbeat_sweeper.py l.62–83 and
# test_signage_admin_router.py — seed via asyncpg, drive via the `client` fixture.

async def _insert_heartbeat(dsn: str, device_id: uuid.UUID, ts: datetime) -> None:
    conn = await asyncpg.connect(dsn=dsn)
    try:
        await conn.execute(
            "INSERT INTO signage_heartbeat_event (device_id, ts) VALUES ($1, $2) "
            "ON CONFLICT DO NOTHING",
            device_id, ts,
        )
    finally:
        await conn.close()


async def test_analytics_all_healthy_device_returns_100pct():
    dsn = await _require_db()
    device_id = await _insert_device(dsn, status="online", last_seen_at=datetime.now(timezone.utc))
    now = datetime.now(timezone.utc)
    # 1440 heartbeats, one per minute across the last 24 h
    for i in range(1440):
        await _insert_heartbeat(dsn, device_id, now - timedelta(minutes=i))
    # call endpoint via `client` fixture with an admin JWT...
    resp = await client.get("/api/signage/analytics/devices", headers=admin_headers)
    body = resp.json()
    row = next(r for r in body if r["device_id"] == str(device_id))
    assert row["uptime_24h_pct"] == 100.0
    assert row["missed_windows_24h"] == 0
```

No `freezegun` needed — the pattern is "insert historical rows with explicit timestamps, call the endpoint in real time, assert on the computed result." Matches the existing codebase convention.

### Invariants CI Script — No Changes Needed

`frontend/scripts/check-signage-invariants.mjs` (l.16–21) automatically covers any new file dropped into its scan roots:

```js
const ROOTS = [
  "frontend/src/signage/pages",
  "frontend/src/signage/components",   // <- UptimeBadge.tsx lands here
  "frontend/src/signage/player",
  "frontend/src/player",
];
```

No glob list to update. Drop `UptimeBadge.tsx` into `frontend/src/signage/components/`, drop any new page files into `frontend/src/signage/pages/`, and the script scans them automatically. Backend router is not scanned (and doesn't need to be — the gate is frontend-specific).

**To extend coverage to a new root,** edit the `ROOTS` array in this file. Adding a new file extension means updating the regex at l.44 (`/\.(ts|tsx|js|jsx|mjs|cjs)$/`). Neither is needed for Phase 53.

The `.github/workflows/` invocation of the script: check CI config — likely called via `npm run check:signage` (confirmed in ROADMAP.md l.221 and CONTEXT §SGN-SCHED-UI-04). No new CI wiring needed.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No analytics beyond `last_seen_at` | Per-heartbeat log + bucketed SQL for uptime | v1.18 Phase 53 (this phase) | Operators get honest uptime signal; storage cost ~6 MB for 100 devices × 25 h |
| "No new schema for Phase 53" (original ROADMAP claim) | One new append-only table `signage_heartbeat_event` | 2026-04-21 CONTEXT D-01 | ROADMAP + REQUIREMENTS text must be amended in the planning phase |
| Surrogate BigInteger PKs on log tables | Composite natural PK `(device_id, ts)` for append-only heartbeat log | This research | Smaller footprint, perfect covering index, no wasted column |

**Deprecated/outdated:** N/A — all chosen patterns are current.

## Open Questions

1. **Does the QueryClient globally disable `refetchOnWindowFocus`?**
   - What we know: DevicesPage.tsx doesn't currently pass `refetchOnWindowFocus`. TanStack Query default is `true` but global overrides are common.
   - What's unclear: whether `frontend/src/main.tsx` or a shared provider has disabled it.
   - Recommendation: the planner should grep for `refetchOnWindowFocus` during planning. Either way, pass `true` explicitly on the new analytics query for clarity and defence-in-depth.

2. **Is there an existing `Tooltip` component in `components/ui/`?**
   - What we know: shadcn typically ships one, but this repo's usage was not audited.
   - Recommendation: planner verifies via `ls frontend/src/components/ui/tooltip.tsx`. If missing, either add the shadcn Tooltip primitive in a Wave 0 task OR fall back to native `title=` attribute for v1 (less polished but keeps phase scope tight).

3. **Path of the new analytics endpoint: `/analytics/devices` vs `/devices/analytics`.**
   - Recommendation: `prefix="/analytics/devices"`, endpoint path `""`. Keeps the analytics feature discoverable as a namespace and avoids any "routes with shared prefix" confusion.

## Environment Availability

Phase 53 requires no new runtime tools or services beyond what's already in the project. All dependencies (Postgres 17, FastAPI, SQLAlchemy, asyncpg, react-i18next, TanStack Query, shadcn Badge) are installed and running in the existing containers.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Postgres 17 with `date_trunc`, `generate_series` (not used), `ON CONFLICT` | bucketed SQL + idempotent insert | ✓ | postgres:17-alpine | — |
| SQLAlchemy 2.0 async | ORM + `pg_insert` on-conflict helper | ✓ | 2.0.49 | — |
| APScheduler (running in lifespan) | extend existing `_run_signage_heartbeat_sweeper` | ✓ | existing | — |
| shadcn Badge + Tooltip | UptimeBadge render | ✓ Badge / ? Tooltip | local-copy | native `title=` on span |
| `npm run check:signage` (check-signage-invariants.mjs) | CI gate for `dark:` / apiClient rules | ✓ | in repo | — |
| `check-locale-parity.mts` | i18n DE/EN parity CI | ✓ | in repo | — |

**No missing dependencies.**

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (backend); Vitest + Testing Library (frontend) |
| Config file | `backend/pyproject.toml` or `backend/pytest.ini` (existing); `frontend/vitest.config.ts` (existing) |
| Quick run command | `cd backend && pytest tests/test_signage_analytics_router.py -x` |
| Full suite command | `cd backend && pytest -x && cd ../frontend && npm test -- --run && npm run check:signage && npm run check:locale-parity` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SGN-ANA-01 | Heartbeat POST inserts a `signage_heartbeat_event` row | integration | `pytest backend/tests/test_signage_heartbeat_event_insert.py -x` | ❌ Wave 0 |
| SGN-ANA-01 | Sweeper prunes events older than 25 h | integration | `pytest backend/tests/test_signage_heartbeat_sweeper.py::test_sweeper_prunes_old_heartbeat_events -x` | ❌ Wave 0 (extend existing file) |
| SGN-ANA-01 (D-20.1) | All-healthy device — 1440 heartbeats → 100 %, 0 missed | integration | `pytest backend/tests/test_signage_analytics_router.py::test_all_healthy -x` | ❌ Wave 0 |
| SGN-ANA-01 (D-20.2) | 720 heartbeats evenly distributed → 50 %, 720 missed | integration | `pytest backend/tests/test_signage_analytics_router.py::test_half_uptime -x` | ❌ Wave 0 |
| SGN-ANA-01 (D-20.3) | Fresh device, 30 heartbeats in 30 min → 100 %, denominator 30 | integration | `pytest backend/tests/test_signage_analytics_router.py::test_partial_history -x` | ❌ Wave 0 |
| SGN-ANA-01 (D-20.4) | Device with zero heartbeats ever → neutral state | integration | `pytest backend/tests/test_signage_analytics_router.py::test_no_heartbeats -x` | ❌ Wave 0 |
| SGN-ANA-01 (D-20.5) | Revoked device not returned | integration | `pytest backend/tests/test_signage_analytics_router.py::test_revoked_excluded -x` | ❌ Wave 0 |
| SGN-ANA-01 (D-20.6) | Two heartbeats in same minute → count once | integration | `pytest backend/tests/test_signage_analytics_router.py::test_distinct_minute -x` | ❌ Wave 0 |
| SGN-ANA-01 (D-21) | DevicesPage renders both new columns; badge colour switches on threshold | component | `cd frontend && npm test -- DevicesPage.test.tsx --run` | ❌ Wave 0 (extend existing if present, else create) |
| SGN-ANA-01 (D-21) | Tooltip content localised DE/EN | component | `cd frontend && npm test -- UptimeBadge.test.tsx --run` | ❌ Wave 0 |
| SGN-ANA-01 (D-19) | Invariants CI scans new files; no `dark:` / no raw `fetch` | static | `cd frontend && npm run check:signage` | ✅ existing (auto-covers) |
| SGN-ANA-01 (D-17) | i18n parity EN/DE for new keys | static | `cd frontend && npx tsx scripts/check-locale-parity.mts` | ✅ existing (auto-covers) |

### Sampling Rate
- **Per task commit:** `cd backend && pytest tests/test_signage_analytics_router.py -x` (backend) OR `cd frontend && npm test -- --run <relevant-file>` (frontend)
- **Per wave merge:** full backend + full frontend vitest + `check:signage` + `check:locale-parity`
- **Phase gate:** Full suite green + `alembic upgrade head && alembic downgrade -1 && alembic upgrade head` round-trip clean before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_signage_analytics_router.py` — covers SGN-ANA-01 D-20.1–6 (6 scenarios)
- [ ] `backend/tests/test_signage_heartbeat_event_insert.py` — covers the heartbeat POST → event row insert
- [ ] Extend `backend/tests/test_signage_heartbeat_sweeper.py` with a prune test (one new `test_sweeper_prunes_old_heartbeat_events` function)
- [ ] `frontend/src/signage/components/UptimeBadge.test.tsx` — green/amber/red/neutral tier switching + tooltip content
- [ ] Extend DevicesPage test (if it exists) with an analytics-columns assertion, or create `frontend/src/signage/pages/DevicesPage.test.tsx`

No new test framework install needed.

## Sources

### Primary (HIGH confidence)
- `/Users/johannbechtold/Documents/kpi-dashboard/CLAUDE.md` — project stack, Postgres 17, FastAPI 0.135.3, SQLAlchemy 2.0.49, asyncpg 0.31.0
- `/Users/johannbechtold/Documents/kpi-dashboard/.planning/phases/53-analytics-lite/53-CONTEXT.md` — all 21 locked decisions
- `/Users/johannbechtold/Documents/kpi-dashboard/backend/app/scheduler.py` l.200–233 — existing `_run_signage_heartbeat_sweeper` pattern
- `/Users/johannbechtold/Documents/kpi-dashboard/backend/app/routers/signage_player.py` l.82–107 — heartbeat handler extension point
- `/Users/johannbechtold/Documents/kpi-dashboard/backend/app/models/signage.py` l.330–389 — SignageSchedule as model template; l.160–201 — SignageDevice fields
- `/Users/johannbechtold/Documents/kpi-dashboard/backend/app/routers/signage_admin/__init__.py` — admin gate inheritance pattern
- `/Users/johannbechtold/Documents/kpi-dashboard/backend/app/routers/signage_admin/schedules.py` — router pattern to clone for analytics.py
- `/Users/johannbechtold/Documents/kpi-dashboard/backend/alembic/versions/v1_18_signage_schedules.py` — migration head (`down_revision` for the new migration)
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/signage/pages/DevicesPage.tsx` l.48–52 — TanStack Query pattern
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/signage/components/DeviceStatusChip.tsx` l.37–52 — semantic-colour Badge pattern (no `dark:`)
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/components/ui/badge.tsx` — shadcn Badge variants (note: contains `dark:` internally but file is not scanned by invariants CI)
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/lib/queryKeys.ts` l.60–71 — `signageKeys` factory
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/scripts/check-signage-invariants.mjs` — SGN-SCHED-UI-04 script; auto-covers new files in its ROOTS
- `/Users/johannbechtold/Documents/kpi-dashboard/backend/tests/test_signage_heartbeat_sweeper.py` — time-control test pattern (explicit timestamps, no freezegun)
- `/Users/johannbechtold/Documents/kpi-dashboard/backend/tests/conftest.py` l.28–41 — `client` fixture with LifespanManager
- `/Users/johannbechtold/Documents/kpi-dashboard/backend/tests/test_signage_admin_router.py` l.1–120 — admin-router integration test pattern

### Secondary (MEDIUM confidence)
- PostgreSQL 17 `date_trunc` behaviour on `TIMESTAMPTZ` — standard semantics documented across many Postgres resources; 2-arg form is timezone-aware via session setting but minute boundaries are TZ-invariant.
- SQLAlchemy 2.0 `postgresql.insert().on_conflict_do_nothing` — stable API since 1.4; widely used.

### Tertiary (LOW confidence)
- None — all patterns in this research are grounded in the existing codebase.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages already installed and audited in CLAUDE.md with verified versions.
- Architecture: HIGH — every pattern (router mount, sweeper extend, TanStack refetch, Badge className override) is a direct clone of an existing, working example.
- Pitfalls: HIGH — derived from inspecting the actual code paths this phase touches.

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable domain — patterns unlikely to shift; re-verify migration head if other phases land in between)
