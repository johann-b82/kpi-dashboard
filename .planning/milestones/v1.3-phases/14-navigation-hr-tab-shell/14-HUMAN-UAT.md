---
status: partial
phase: 14-navigation-hr-tab-shell
source: [14-VERIFICATION.md]
started: 2026-04-12T14:00:00Z
updated: 2026-04-12T14:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. NavBar tab labels
expected: NavBar shows Sales, Upload, HR tabs and settings gear; "Dashboard" label absent
result: [pending]

### 2. Sales tab navigation
expected: Navigates to / and displays sales KPI dashboard; FreshnessIndicator visible in NavBar
result: [pending]

### 3. HR tab navigation and conditional FreshnessIndicator
expected: Navigates to /hr; FreshnessIndicator NOT visible in NavBar; shows sync state; "Daten aktualisieren" button present; placeholder text visible
result: [pending]

### 4. FreshnessIndicator hidden on /settings
expected: FreshnessIndicator is NOT visible in NavBar on /settings
result: [pending]

### 5. Manual sync button
expected: Button shows spinner while syncing, green checkmark on success (reverts after 3s), error on failure; timestamp updates after sync
result: [pending]

### 6. Language toggle
expected: NavBar shows "Vertrieb" and "HR"; HR page shows German translations for all new strings
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
