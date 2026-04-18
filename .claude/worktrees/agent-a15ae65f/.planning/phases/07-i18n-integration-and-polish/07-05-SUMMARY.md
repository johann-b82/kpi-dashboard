---
phase: 07-i18n-integration-and-polish
plan: 05
subsystem: frontend-i18n
tags: [i18n, de, locales, translation]
requirements: [I18N-01]
dependency_graph:
  requires: ["07-03"]
  provides: ["full DE locale parity for Settings page"]
  affects: ["frontend/src/locales/de.json"]
tech_stack:
  added: []
  patterns: ["flat dot-separated i18n keys (keySeparator:false)"]
key_files:
  created: []
  modified:
    - frontend/src/locales/de.json
decisions:
  - "Plan's estimated 111-key target was approximate; actual en.json contains 109 keys. Parity achieved at 109/109."
  - "settings.preferences.title translated as 'Allgemein' (user preference, not Präferenzen)."
  - "settings.contrast.badge uses German decimal comma: '4,5 : 1' (not '4.5 : 1')."
metrics:
  duration_minutes: 2
  tasks_completed: 1
  files_changed: 1
  completed_date: "2026-04-11"
---

# Phase 07 Plan 05: DE Locale Parity Summary

Brought `frontend/src/locales/de.json` to full key parity with `en.json` (109 keys), translating all Settings page strings with informal "du" tone and preserving D-18 loanwords.

## Tasks

### Task 1: Translate all missing keys to DE with informal 'du' tone — COMPLETE
- **Commit:** 2d67009
- **Files:** `frontend/src/locales/de.json`
- **Result:** 47 missing keys added, 2 pre-existing formal-Sie strings rewritten, parity verified (109 = 109), build passing.

## Deviations from Plan

### Plan Note — key count clarification
The plan targeted "107 + 4 = 111 keys". Actual en.json after plan 07-03 landed contains **109 keys**. The plan explicitly said "Do NOT hardcode the count — derive it from the actual diff", so this is not a deviation but a confirmed derived count.

No auto-fixes (Rules 1-3) were needed. No architectural decisions (Rule 4) triggered.

## Key Translations Applied

**Structural (D-18 loanwords preserved):**
- Dashboard, Upload (noun), KPI, Logo, Settings → Einstellungen
- Primary color → Primärfarbe
- Save → Speichern, Discard → Verwerfen, Reset → Zurücksetzen

**Tone (D-17 informal "du"):**
- "Lade eine Umsatzdatei ... hoch, um deine KPIs zu sehen" (was: "Laden Sie ... Ihre KPIs")
- "Wähle einen größeren Zeitraum ..." (was: "Wählen Sie ...")
- "Prüfe deine Verbindung ..."
- "Du hast ungespeicherte Branding-Änderungen ..."
- "Speichere oder verwirf zuerst deine Änderungen"

**User-specified strings:**
- `settings.preferences.title` = "Allgemein"
- `settings.preferences.language.label` = "Sprache"
- `settings.preferences.language.help` = "Gilt für die gesamte App. Deine Auswahl wird in der Datenbank gespeichert."
- `settings.preferences.toggle_disabled_tooltip` = "Speichere oder verwirf zuerst deine Änderungen"

## Verification

- `python3` set symmetric-difference of en.json vs de.json → empty (109 = 109)
- `grep -E "\b(Sie|Ihre|Ihnen|Ihrem|Ihren)\b" de.json` → no matches
- `cd frontend && npm run build` → success (3705 modules transformed, no errors)
- All 9 acceptance criteria grep checks satisfied

## Success Criteria

- [x] SC3.1: Key set equality between en.json and de.json (109 each)
- [x] SC3.2: Informal "du" tone throughout (no Sie/Ihre/Ihnen remain)
- [x] SC3.3: Loanwords preserved (Dashboard, Upload, KPI, Logo)
- [x] SC3.4: Pre-existing formal-Sie strings rewritten (dashboard.empty.body, dashboard.emptyFiltered.body)

## Self-Check: PASSED

- frontend/src/locales/de.json: FOUND
- Commit 2d67009: FOUND in git log
- Parity check: 109 == 109, empty diff
- No formal-Sie matches
- npm run build: PASSED
