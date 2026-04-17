# FEATURES — v1.15 Sensor Monitor

**Domain:** Admin-only environmental (temperature/humidity) SNMP monitoring app embedded in the existing KPI Dashboard.
**Researched:** 2026-04-17
**Confidence:** HIGH — grounded in the existing `/Users/johannbechtold/Documents/snmp-monitor` MVP and explicit KPI Dashboard UI patterns.

---

## Executive Summary

v1.15 is a **port, not greenfield**. The standalone `snmp-monitor` already ships polling, manual poll, 1h–30d charts, thresholds, and admin CRUD. Scope: re-implement the existing behaviour inside the KPI Dashboard's design language (shadcn cards, Recharts, DE/EN i18n, dark-mode tokens, Directus role gate) and drop duplicated host infrastructure (Jinja templates, SQLite, YAML, separate FastAPI, separate theme).

Biggest UX decision: **sensor admin lives as a new Card (or dedicated sub-page) inside `/settings`** — mirrors the `PersonioCard` precedent. Architecture research recommends a dedicated `/settings/sensors` sub-page instead — roadmap decision.

---

## Table-Stakes Features (MVP — must ship in v1.15)

| ID | Feature | Complexity | Mirror |
|----|---------|------------|--------|
| SEN-01 | `/sensors` route, admin-only tile in App Launcher | LOW | `AdminOnly`, launcher tile pattern |
| SEN-02 | Current-value KPI cards per sensor (temp + humidity) | LOW | `KpiCardGrid` |
| SEN-03 | Time-series chart per metric with sensor-as-series overlay | MED | `RevenueChart`, extend `chartDefaults.ts` with `sensorPalette` |
| SEN-04 | Time-window selector (1h · 6h · 24h · 7d · 30d) as `SegmentedControl` | LOW | v1.5 SegmentedControl |
| SEN-05 | Manual "Jetzt messen" button, invalidates TanStack Query | LOW | `PersonioCard` triggerSync |
| SEN-06 | Freshness indicator ("letzte Messung vor 23 s") | LOW | SubHeader route-aware + per-card footer |
| SEN-07 | Threshold violation badge on card + reference line on chart | LOW-MED | `destructive` token, Recharts `ReferenceLine` |
| SEN-08 | Auto-refresh via TanStack Query `refetchInterval` | LOW | Existing TanStack Query |
| SEN-09 | Admin CRUD: add/edit/remove sensor | MED | `PersonioCard` pattern |
| SEN-10 | Admin config: polling interval (seconds); reschedules APScheduler on save | LOW | Personio sync reschedule |
| SEN-11 | Admin config: global thresholds (temp min/max, humidity min/max) | LOW | 4 nullable inputs in app_settings |
| SEN-12 | SNMP walk + probe admin tools | MED | Collapsible "OID-Finder" section |
| SEN-13 | Error/no-value empty state | LOW | Recharts `connectNulls={false}` |
| SEN-14 | Bilingual DE/EN (~40–60 keys, `sensors.*`, "du" tone) | LOW | Existing namespace pattern |
| SEN-15 | Dark-mode parity via Tailwind tokens + chartDefaults | LOW | Automatic if token-only |
| SEN-16 | Postgres schema via Alembic (`sensors` + `sensor_readings`) | MED | v1.3 HR migration pattern |
| SEN-17 | APScheduler poll integrated with existing scheduler singleton | MED | Personio scheduler precedent |

**MVP scope: 17 features.** Near 1:1 port with low surprise risk.

---

## Differentiators (Nice-to-Have)

| ID | Feature | Complexity | Ship / Defer |
|----|---------|------------|--------------|
| DIFF-01 | Delta badges on cards ("+0.3 °C vs. 1 h", "−2 % vs. 24 h") | LOW-MED | **Ship if fits** — mirrors Sales/HR |
| DIFF-02 | Email notification on threshold breach | MED-HIGH | **Defer** — blocked on SMTP |
| DIFF-03 | Slack/webhook notification | MED | **Defer** to v1.16+ |
| DIFF-04 | Server-side downsampling (>7d → hourly, >30d → daily) | MED | **Ship minimal** |
| DIFF-05 | CSV export | LOW | **Defer** — align with DASH-07 |
| DIFF-07 | Zones/locations grouping | LOW-MED | **Defer** unless ≥5 sensors |
| DIFF-08 | Per-sensor calibration offsets | LOW | Ship if budget allows |
| DIFF-09 | Per-sensor threshold overrides | MED | **Ship** if ≥2 sensors |
| DIFF-10 | "OK seit X" health chip | LOW | **Stretch** — cheap |

**Recommended v1.15 shortlist:** DIFF-01, DIFF-04, DIFF-10.

---

## Anti-Features (Out of Scope)

| Anti-Feature | Reason |
|--------------|--------|
| High-frequency streaming (<10s polls, WebSocket push) | 60s cadence suffices; no WS infra |
| Grafana/Prometheus-level platform | Internal tool, not observability stack |
| Third-party cloud sensor integrations | SNMP is the shared protocol |
| Native mobile app | Explicit PROJECT.md anti-feature |
| SNMPv3 auth/priv | v2c sufficient on internal network |
| SNMP traps (UDP 162 listener) | Polling proven sufficient |
| User-uploaded sensor icons / per-sensor theming | Zero operational value |
| Historical SQLite import | <weeks of data; re-poll from fresh |
| Retention policy UI | 2.6M rows/year negligible |
| Per-sensor access control (viewer-level) | Admin-only app |

---

## UI Language — Mirror Existing Patterns

### Page shell (mirror DashboardPage / HRPage)

```tsx
<div className="max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8">
  <SensorStatusCards />
  <SensorTimeSeriesChart />  {/* two charts: temperature + humidity */}
  <SensorTable />
</div>
```

### KPI card (SEN-02 + DIFF-01)

- Title: sensor name
- Primary value: current temperature (e.g. `22.4 °C`)
- Delta badges: `vs. 1h`, `vs. 24h` (or `vs. 24h`, `vs. 7d`) via `DeltaBadgeStack`
- Secondary row: humidity value + deltas
- Threshold badge: `destructive` token when out-of-range
- Freshness footer: muted "vor 23 s"

### Chart (SEN-03)

- Recharts `LineChart`, one `Line` per sensor
- Extend `chartDefaults.ts` with `sensorPalette` (multi-series distinctness)
- Each sensor has same color across temp and humidity charts
- DE date format (`dd.MM.yyyy HH:mm`)
- Two charts stacked (°C, %)
- Threshold min/max via `<ReferenceLine>` dashed

### Time-window selector (SEN-04)

- `SegmentedControl` segments: `1h · 6h · 24h · 7d · 30d`
- Local state or `SensorTimeWindowContext` — **do NOT** reuse `DateRangeContext`

### Freshness (SEN-06)

1. Per-card footer — per-sensor freshness
2. SubHeader route-aware — aggregate "polling healthy"

### i18n (SEN-14)

New `sensors.*` namespace (~40–60 keys, DE "du" tone):
- `sensors.title`, `sensors.kpi.temperature`, `.humidity`, `.freshness` (`{{seconds}}`)
- `sensors.threshold.outOfRange`, `.tempMin`, `.tempMax`, etc.
- `sensors.window.{1h,6h,24h,7d,30d}`
- `sensors.poll.{now,refreshing,lastPoll}`
- `sensors.admin.*` (title, add/remove sensor, fields, walk, probe, poll_interval, thresholds)

---

## Feature Dependency Graph

```
SEN-16 (schema) → SEN-17 (polling) → SEN-09 (admin CRUD) → SEN-02/03 (dashboard)
SEN-12 (walk/probe) → SEN-09
SEN-17 → SEN-05 + SEN-08
SEN-11 (global thresholds) → SEN-07
DIFF-01 needs SEN-02 + SEN-08
DIFF-04 needs SEN-16 + SEN-03
DIFF-10 needs SEN-08
```

**Critical path:** SEN-16 → SEN-17 → SEN-09 → SEN-02/03.

---

## Gaps Roadmapper Should Flag

- **Sensor count at ship time** — affects KPI card layout (one per sensor scales to ~8 before grouping).
- **Downsampling cutoffs** — >7d → hourly? >30d → daily? Brief phase-level research.
- **Admin UX location** — card in `/settings` vs. dedicated sub-page `/settings/sensors`. Architecture research recommends sub-page.
- **APScheduler job-id namespacing** — `sensors_poll` to avoid `personio_sync` collision.
- **Docker container SNMP network access** — UDP 161 outbound to 192.9.201.x. Verify in Phase 1.

---

## Confidence Assessment

| Area | Level |
|------|-------|
| Table-stakes scope | HIGH |
| UI mirroring | HIGH |
| Admin UX precedent | HIGH |
| Differentiator shortlist | MEDIUM |
| Anti-features | HIGH |
| Dependency graph | HIGH |
