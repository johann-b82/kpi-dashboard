---
phase: 40-admin-settings-docs-hardening
plan: 03
subsystem: docs
tags: [docs, admin-guide, bilingual, sensor, runbook, i18n]
requires:
  - v1.13 docs pipeline (registry-based Markdown + rehype) — unchanged
provides:
  - bilingual admin-guide article at /docs/admin-guide/sensor-monitor (EN + DE)
  - host-mode + macvlan fallback runbook embedded in Troubleshooting
  - docs.nav.adminSensorMonitor title key in both locales
affects:
  - frontend/src/lib/docs/registry.ts (sidebar order + registry table)
  - frontend admin-guide sidebar (new entry between personio and user-management)
tech-stack:
  added: []
  patterns:
    - registry-driven Markdown docs (unchanged from v1.13)
    - bilingual parity via structural translation ("du" tone for DE)
key-files:
  created:
    - frontend/src/docs/en/admin-guide/sensor-monitor.md
    - frontend/src/docs/de/admin-guide/sensor-monitor.md
  modified:
    - frontend/src/lib/docs/registry.ts
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
decisions:
  - Placed sidebar entry between personio and user-management (integrations cluster)
  - Kept "Sensor Monitor" untranslated in DE (product name, matches v1.13 convention for proper nouns)
  - Host-mode fallback sits inside Troubleshooting section, linked from Prerequisites via #host-mode-fallback anchor
  - Preferred order explicitly documented: default bridge → macvlan → host-mode
metrics:
  duration_minutes: ~15
  completed_date: 2026-04-17
  tasks_completed: 1
  files_changed: 5
requirements:
  - SEN-OPS-02
  - SEN-OPS-03
  - SEN-OPS-04
---

# Phase 40 Plan 03: Bilingual Sensor Monitor Admin Guide + Host-Mode Runbook Summary

**One-liner:** Bilingual admin-guide article for the Sensor Monitor wired into the v1.13 docs registry, with an embedded host-mode / macvlan fallback runbook for operators whose Docker bridge cannot reach the sensor subnet.

## What Shipped

- **EN article** — `frontend/src/docs/en/admin-guide/sensor-monitor.md`, 181 lines, 8 `##` sections: Overview, Prerequisites, Onboarding a Sensor (with four sub-steps), Thresholds, Polling Interval, Troubleshooting (with host-mode fallback + polling/scheduler sub-sections), Security, Related Articles.
- **DE article** — `frontend/src/docs/de/admin-guide/sensor-monitor.md`, 181 lines, structural parity (8 `##` sections), "du" tone throughout. Same anchor `#host-mode-fallback` for cross-linking.
- **Registry wiring** — `frontend/src/lib/docs/registry.ts`: two new raw-Markdown imports, one new sidebar entry (`slug: "sensor-monitor"` at position 5, between `personio` and `user-management`), two new registry table assignments (one per locale).
- **Locale keys** — `docs.nav.adminSensorMonitor` in both `en.json` and `de.json`.

## Host-Mode Fallback Runbook (SEN-OPS-04)

Embedded in Troubleshooting, reachable via `[Troubleshooting → Host-mode fallback](#host-mode-fallback)` link from the Prerequisites smoke-test step. Structure:

1. **Option A — `network_mode: host`** (simpler, more invasive): YAML snippet + explicit trade-offs (breaks Docker DNS → must change `DATABASE_URL` to `localhost:5432`; `ports:` becomes invalid; exposes API on host interface).
2. **Option B — `macvlan`** (less invasive, more config): YAML snippet showing `driver_opts.parent: eth0`, ipam subnet/gateway/ip_range, `api` service attached to both `default` and `sensor_lan`.
3. **Preferred order** documented explicitly: default bridge → macvlan → host-mode (last resort).

## Content Coverage (SEN-OPS-02)

- Prerequisites: `docker compose exec api snmpget ...` smoke test, admin role requirement, SNMPv2c note (v3 not supported).
- Onboarding workflow: walk → add row → probe → save, with a field-reference table.
- Thresholds: global min/max for temp + humidity; known-limitation callout about blank-input semantics.
- Polling interval: 5–86400 s bounds, live reschedule, cadence recommendations table.
- Troubleshooting: offline sensors, host-mode fallback, empty-readings log check, scheduler reschedule recovery.
- Security: never-`public` warning, community-encrypted-at-rest warning, operational guidance (rotate on admin departure, restrict SNMP to Docker host source IP).

## Independence & Pipeline Reuse

- **Independent of 40-01 / 40-02:** docs-only plan; can ship before or after the admin-settings code plans without any merge conflict or runtime coupling.
- **v1.13 pipeline reused verbatim:** no changes to `MarkdownRenderer`, rehype config, or docs routing. Registry is the only integration surface.

## Deviations from Plan

None — plan executed exactly as written. Field reference table and cadence table were added as formatting enhancements consistent with the "Markdown tables" style used in `personio.md` (plan explicitly called out tables as acceptable).

## Verification Evidence

- `cd frontend && npx tsc --noEmit` — clean (no output).
- `wc -l` → both files 181 lines (≥150 requirement met).
- `grep -c '^## '` → 8 H2 headings in both EN and DE (structural parity).
- `grep 'sensor-monitor\|SensorMonitor' registry.ts` → 5 matches (2 imports + sidebar entry + 2 registry lines).
- `grep 'host-mode-fallback'`, `'network_mode: host'`, `'macvlan'`, `'public'` — present in both EN and DE articles.

## Commits

- `0262efe` docs(40-03): add bilingual sensor monitor admin guide

## Self-Check: PASSED

- FOUND: frontend/src/docs/en/admin-guide/sensor-monitor.md
- FOUND: frontend/src/docs/de/admin-guide/sensor-monitor.md
- FOUND: registry.ts sensor-monitor imports + sidebar + registry entries
- FOUND: docs.nav.adminSensorMonitor in en.json + de.json
- FOUND: commit 0262efe
