---
status: partial
phase: 13-sync-service-settings-extension
source: [13-VERIFICATION.md]
started: 2026-04-12T00:00:00Z
updated: 2026-04-12T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. PersonioCard renders correctly on Settings page
expected: Two masked credential inputs with 'Gespeichert' helper text logic, 'Verbindung testen' button, sync interval select (4 options), absence type dropdown (disabled without credentials, hint shown), department dropdown (disabled without credentials, hint shown), skill attribute key text input
result: [pending]

### 2. Live dropdown population from Personio API
expected: After saving valid credentials and reloading, absence type dropdown shows entries from GET /api/settings/personio-options; department dropdown shows unique departments from employee data
result: [pending]

### 3. Connection test button works
expected: Click 'Verbindung testen' with valid credentials -> green 'Verbindung erfolgreich' text appears inline below button
result: [pending]

### 4. Scheduler reschedule on interval change
expected: Change sync interval from '1h' to '6h' and save -> APScheduler job reschedules immediately without container restart
result: [pending]

### 5. End-to-end sync data flow
expected: POST /api/sync with configured credentials returns SyncResult with employee, attendance, and absence counts; personio_sync_meta row updated in DB
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
