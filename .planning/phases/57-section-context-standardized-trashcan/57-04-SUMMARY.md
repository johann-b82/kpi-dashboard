---
phase: 57-section-context-standardized-trashcan
plan: 04
subsystem: frontend-i18n
tags: [i18n, locales, du-tone, parity]
requirements: [SECTION-01, SECTION-02, SECTION-03, SECTION-04]
dependency_graph:
  requires:
    - frontend/src/locales/en.json (existing 479-key flat-dotted structure)
    - frontend/src/locales/de.json (existing parity)
    - frontend/scripts/check-locale-parity.mts (parity gate)
  provides:
    - 5 ui.delete.* primitive keys (consumed by Plan 57-03 DeleteButton/DeleteDialog defaults)
    - 14 section.* keys (consumed by Wave B migrations 57-05..57-10 SectionHeader)
  affects:
    - Wave B section-page migrations (unblocks 57-05 media, 57-06 playlists, 57-07 schedules, 57-08 devices, 57-09 sensors, 57-10 upload-history)
tech_stack:
  added: []
  patterns:
    - "Flat-dotted top-level i18n keys (matches Phase 46 parity contract)"
    - "react-i18next <Trans> component-index markers <1>...</1> over markdown **...**"
key_files:
  created: []
  modified:
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
decisions:
  - "bodyFallback uses <1>{{itemLabel}}</1> component-index markers (NOT markdown **) per RESEARCH Pitfall 8 — supersedes UI-SPEC's markdown-styled copy"
  - "tags + users section keys reserved despite no routes existing today (RESEARCH Q4 + UI-SPEC §Copywriting reserve note)"
  - "Insertion point: directly before launcher.title block — keeps primitive ui.* and structural section.* grouped"
metrics:
  duration: "64s"
  tasks: 2
  files: 2
  completed: "2026-04-22T08:34:27Z"
---

# Phase 57 Plan 04: i18n Keys Summary

Added 19 new flat-dotted i18n keys (5 `ui.delete.*` primitives + 14 `section.*` for 7 admin sections) to both en.json and de.json with EN-DE parity at 498 keys and DE copy in du-tone, unblocking Wave B section-page migrations and Plan 57-03 DeleteButton defaults.

## What Was Built

- **5 ui.delete.\* keys (EN+DE)**: title, cancel, confirm, ariaLabel, bodyFallback. The `bodyFallback` value contains the literal substring `<1>{{itemLabel}}</1>` so react-i18next `<Trans components={{ 1: <strong /> }}>` can wrap the item label in bold without HTML injection.
- **14 section.\* keys (EN+DE)** for 7 admin sections: signage.{media, playlists, devices, schedules, tags} and settings.{sensors, users}. Each section gets `.title` + `.description`. Tags + users are reserved for future routes per RESEARCH Q4.
- **DE du-tone**: All 19 new DE strings use du/dich/dir; zero Sie/Ihre/Ihr in section.* or ui.delete.* keys.

## Verification Performed

- `node --experimental-strip-types frontend/scripts/check-locale-parity.mts` → `PARITY OK: 498 keys in both en.json and de.json`
- `rg '"ui\.delete\.|"section\.' en.json` → 19 matches; same for de.json → 19 matches
- bodyFallback `<1>` literal present in both locales
- Zero matches for `"section\.[^"]+":\s*"[^"]*(Sie|Ihre|Ihr )` in de.json

## Commits

| Task | Description | Commit |
| ---- | ----------- | ------ |
| 1 | Add ui.delete.* primitive i18n keys (EN+DE) | dd93345 |
| 2 | Add 14 section.* i18n keys for admin sections (EN+DE) | 393e684 |

## Deviations from Plan

None — plan executed exactly as written. The single pre-existing `Sie` occurrence in `de.json` line 492 (`docs.empty.body`) was noted but is out of scope for this plan (not a section.* or ui.delete.* key) and not introduced by this work.

## Self-Check: PASSED

- Files modified exist and contain expected keys
- Both commits exist in git log:
  - dd93345 — feat(57-04): add ui.delete.* primitive i18n keys (EN+DE)
  - 393e684 — feat(57-04): add 14 section.* i18n keys for admin sections (EN+DE)
- Parity check green at 498 keys
- 19 new keys per locale verified by rg count
