---
status: passed
phase: 30-bring-up-docs-backup
source: [30-VERIFICATION.md]
started: 2026-04-16
updated: 2026-04-16
---

## Current Test

[complete]

## Tests

### 1. Clean-machine setup.md runthrough
expected: First-time operator reaches a running stack + usable first Admin following docs/setup.md top-to-bottom on a fresh machine with zero undocumented steps (SC-1)
result: passed

### 2. Nightly cron fires at 02:00 Europe/Berlin
expected: A new kpi-YYYY-MM-DD.sql.gz appears in ./backups/ the morning after `docker compose up -d` (scheduled tick; manual trigger already verified)
result: passed

### 3. Second operator Viewer→Admin promote click-path
expected: A teammate promotes a user via Directus UI using only docs/setup.md, no code spelunking (DOCS-02 acceptance)
result: passed

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
