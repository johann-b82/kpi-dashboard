# Phase 53: Analytics-lite - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 53-analytics-lite
**Areas discussed:** Data source / metric definition, Endpoint shape + caching, Badge thresholds & edge cases, i18n + docs + invariants scope

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Data source / metric definition | Resolve signage_heartbeat log contradiction | ✓ |
| Endpoint shape + caching | Separate vs inline; caching strategy | ✓ |
| Badge thresholds & edge cases | Zero-data, revoked, tooltip, columns | ✓ |
| i18n + docs + invariants scope | i18n keys, admin guide, CI gates | ✓ |

---

## Data source / metric definition

### Q1: How should uptime-24h be computed given only `last_seen_at` exists today?

| Option | Description | Selected |
|--------|-------------|----------|
| Add lightweight heartbeat log | New `signage_heartbeat_event` table; 25h retention; true 60s-window uptime | ✓ |
| Redefine from last_seen_at only | Binary / decay from last_seen_at; no schema | |
| Derive from sweeper + last_seen_at | Offline events table | |
| Defer phase — add proper schema in v1.19 | Kick back to roadmap | |

**User's choice:** Add lightweight heartbeat log (Recommended).
**Notes:** Explicitly amends ROADMAP.md Phase 53 "no new schema" claim. Captured as D-01.

### Q2: If we add a log table, how should heartbeats be logged?

| Option | Description | Selected |
|--------|-------------|----------|
| Row per heartbeat + 25h retention | INSERT per heartbeat; sweeper DELETE | ✓ |
| Bucketed minute aggregates | UPSERT by (device_id, minute_bucket) | |
| Not applicable | Skip | |

**User's choice:** Row per heartbeat + 25h retention.

### Q3: How should uptime % be computed from the log?

| Option | Description | Selected |
|--------|-------------|----------|
| Bucket into 60s windows | generate_series + LEFT JOIN | ✓ |
| Distinct-seconds count | COUNT(DISTINCT date_trunc('minute', ts)) / 1440 | |
| You decide | Claude picks during planning | |

**User's choice:** Bucket into 60s windows.

### Q4: 'Heartbeats missed 24h' definition?

| Option | Description | Selected |
|--------|-------------|----------|
| Count of minute-windows with 0 heartbeats | missed = denominator − windows_with_heartbeat | ✓ |
| Count of streaks (offline events) | Contiguous offline periods | |
| Minutes since last_seen_at | Simple offline duration | |

**User's choice:** Count of minute-windows with 0 heartbeats.

### Q5: Revoked devices?

| Option | Description | Selected |
|--------|-------------|----------|
| Hide row | Exclude server-side | ✓ |
| Show with '—' badge | Keep row, show N/A | |
| Show badges up to revoked_at | Compute over pre-revocation window | |

**User's choice:** Hide row.

---

## Endpoint shape + caching

### Q6: Where should analytics data live in the API?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate GET /admin/devices/analytics | Dedicated endpoint; frontend joins by id | ✓ |
| Extend existing GET /admin/devices | Inline fields on each device row | |
| Per-device GET /admin/devices/{id}/analytics | N round-trips | |

**User's choice:** Separate endpoint.

### Q7: Server-side caching?

| Option | Description | Selected |
|--------|-------------|----------|
| No cache — compute on each call | One bucketed SQL per call | ✓ |
| In-process 30s TTL cache | TTL dict / lru_cache | |
| You decide | Planner decides from profiling | |

**User's choice:** No cache.

### Q8: Frontend data-fetching pattern?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate useQuery, 30s poll + visibility refresh | Independent TanStack query | ✓ |
| Piggyback on existing listDevices query | Only viable with extended /devices | |

**User's choice:** Separate useQuery.

---

## Badge thresholds & edge cases

### Q9: Insufficient-history devices?

| Option | Description | Selected |
|--------|-------------|----------|
| Compute over actual window since first heartbeat | denominator = min(1440, minutes_since_first) | ✓ |
| Show 'no data' badge for first 24h | Gray '—' until full history | |
| Treat pre-pairing minutes as missed | Always denominator = 1440 | |

**User's choice:** Actual window since first heartbeat.

### Q10: Tooltip content?

| Option | Description | Selected |
|--------|-------------|----------|
| Plain numeric + window | "1382 / 1440 one-minute windows..." | ✓ |
| Minimal — no tooltip | Badges only | |
| Rich popover with sparkline | Last-5-hour mini-chart | |

**User's choice:** Plain numeric + window.

### Q11: Column placement?

| Option | Description | Selected |
|--------|-------------|----------|
| After Status chip, before Last Seen | Status → Uptime% → Missed → Last Seen | ✓ |
| Append at end of table | Minimal disruption | |
| Replace Last Seen column | Missed subsumes Last Seen | |

**User's choice:** After Status chip, before Last Seen.

---

## i18n + docs + invariants scope

### Q12: Admin-guide documentation scope?

| Option | Description | Selected |
|--------|-------------|----------|
| New §Analytics section in digital-signage.md, DE/EN | Full bilingual section | ✓ |
| Inline sentence only | One line under Devices table | |
| Skip docs — defer to v1.19 | Ship undocumented | |

**User's choice:** New §Analytics section, DE/EN.

### Q13: CI invariants + test coverage?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend signage invariants CI + backend integration tests | Full coverage | ✓ |
| Backend tests only, skip CI extension | Narrower scope | |
| You decide | Planner picks | |

**User's choice:** Extend invariants CI + backend integration tests.

### Q14: i18n key naming convention?

| Option | Description | Selected |
|--------|-------------|----------|
| signage.admin.device.analytics.* | Grouped under existing namespace | ✓ |
| signage.analytics.* top-level | New namespace | |
| You decide | Planner picks | |

**User's choice:** signage.admin.device.analytics.*.

---

## Done check

**Q15:** "Anything else before I write CONTEXT.md?"
**User's choice:** "I'm ready for context."

---

## Claude's Discretion

- SQL shape for the bucketed uptime query (generate_series+LEFT JOIN vs DISTINCT-minute).
- Uptime percentage precision (0 vs 1 decimal).
- Heartbeat-log PK design (surrogate id vs composite).
- Whether to add a server-side cache later if profiling warrants.

## Deferred Ideas

- Rich popover with last-5-hour sparkline.
- Streak/outage-count metric.
- Multi-window analytics (7d/30d).
- Per-item playtime tracking (explicitly out of milestone scope).
- Sortable analytics columns.
- In-process 30s TTL cache.
- Alerting on threshold breaches.
