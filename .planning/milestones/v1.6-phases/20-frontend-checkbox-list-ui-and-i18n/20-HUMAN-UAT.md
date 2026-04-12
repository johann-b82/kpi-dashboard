---
status: partial
phase: 20-frontend-checkbox-list-ui-and-i18n
source: [20-VERIFICATION.md]
started: 2026-04-12T22:15:00Z
updated: 2026-04-12T22:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Checkbox List Visual Rendering
expected: Open Settings page, navigate to Personio section — 3 bordered scrollable checkbox list containers visible (sick leave type, production dept, skill attr key). No <select> dropdowns or text inputs for these fields.
result: [pending]

### 2. Multi-Select Interaction and Persistence
expected: With valid Personio credentials, click multiple checkboxes in sick leave type list. Save. Reload page. Same checkboxes still checked. Deselect all, save, reload — empty state shown.
result: [pending]

### 3. Empty and Loading State Localization
expected: Toggle language EN/DE. Loading text switches: "Loading..." / "Wird geladen...". Empty options text switches: "No options available" / "Keine Optionen verfuegbar".
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
