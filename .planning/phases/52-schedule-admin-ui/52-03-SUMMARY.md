---
phase: 52-schedule-admin-ui
plan: 03
subsystem: docs/admin-guide
tags: [docs, i18n, signage, schedules]
requires: []
provides:
  - EN/DE admin-guide Schedules / Zeitpläne sections
  - Operator-facing reference for SGN-SCHED-UI-03
affects:
  - frontend/src/docs/en/admin-guide/digital-signage.md
  - frontend/src/docs/de/admin-guide/digital-signage.md
tech-stack:
  added: []
  patterns:
    - "Appended bilingual admin-guide sections with parallel structure (EN/DE)"
    - "du-tone enforced in DE via imperative verbs (Nutze, Lege, Teile, Wähle, Entferne, Klicke)"
key-files:
  created:
    - .planning/phases/52-schedule-admin-ui/52-03-SUMMARY.md
  modified:
    - frontend/src/docs/en/admin-guide/digital-signage.md
    - frontend/src/docs/de/admin-guide/digital-signage.md
decisions:
  - "Appended new sections AFTER `## Related Articles` / `## Verwandte Artikel` per plan's literal `append after the current last section` directive (rather than inserting before Related Articles)."
  - "Used `##` top-level heading depth matching all existing sections in both files."
metrics:
  duration: ~2m
  completed: 2026-04-21
requirements: [SGN-SCHED-UI-03]
---

# Phase 52 Plan 03: Admin Guide Schedules Section Summary

Bilingual admin-guide extension closing SGN-SCHED-UI-03 by adding operator-facing reference docs for the Schedules editor — field table, invariants, milestone worked example, and FK-RESTRICT caveat in both EN and DE (du-tone).

## What Shipped

- **EN** `digital-signage.md`: new `## Schedules` top-level section with sub-sections `### Fields`, `### Invariants`, `### Worked example`, `### Deleting a playlist referenced by a schedule`.
- **DE** `digital-signage.md`: parallel `## Zeitpläne` section with `### Felder`, `### Regeln`, `### Beispiel`, `### Playlist löschen, die in einem Zeitplan verwendet wird`, all in informal du-tone.
- Worked example in both languages uses the exact milestone Success Criteria scenario (Mo-Fr 07:00-11:00 Playlist X priority 10; Mo-So 11:00-14:00 Playlist Y priority 5; fallback at 15:00).

## Lines Added Per File

| File | Added lines | Heading depth |
|------|-------------|---------------|
| `frontend/src/docs/en/admin-guide/digital-signage.md` | +33 | `##` (top-level) |
| `frontend/src/docs/de/admin-guide/digital-signage.md` | +33 | `##` (top-level) |

Matches existing convention in both files. No screenshots added (D-16).

## Phrasing Tweaks for Parallel Structure

None. Content pasted verbatim from the plan block for both EN and DE. Structure is one-to-one parallel: same 4 subsections, same 5 worked-example steps, same field-table rows.

## Du-tone Confirmation (DE)

`awk '/^## Zeitpläne$/,0' frontend/src/docs/de/admin-guide/digital-signage.md | grep -cE "\bSie\b|\bIhre?\b|\bIhnen\b"` returns **0**. No formal-Sie in the new section.

Imperative verbs used: *Nutze*, *Wähle*, *Lege*, *Teile*, *Entferne*, *klicke*.

## Acceptance Criteria Status

### Task 1 (EN)

- `grep -cE "^## Schedules$" ...` = 1 — PASS
- `grep -qE "^### Worked example$" ...` — PASS
- `grep -qE "^### Fields$" ...` — PASS
- `grep -qE "^### Invariants$" ...` — PASS
- `grep -c "07:00"`, `11:00` (x2+), `15:00` — PASS
- `Playlist X` / `Playlist Y` both present — PASS
- `| Priority |` table row — PASS
- No image references added — PASS
- **Added lines >= 40:** DEVIATION — actual added-line count is **33** per git numstat. The acceptance criterion is stricter than the prose block the plan supplied verbatim (with the explicit instruction "Copy the text below verbatim - do NOT paraphrase"). No paraphrase was possible without violating the verbatim directive, so content was inserted as-is. Content covers all structural criteria (4 subsections + table + 5-step example + caveat).

### Task 2 (DE)

- `grep -cE "^## Zeitpläne$" ...` = 1 — PASS
- `### Felder` / `### Regeln` / `### Beispiel` — PASS
- Imperative verbs grep — PASS
- Sie/Ihre/Ihr/Ihnen count in new section = 0 — PASS
- Playlist X / Playlist Y / 08:30 / 15:00 — PASS
- `| Priorität |` — PASS
- No image references — PASS
- **Added lines >= 40:** Same deviation as Task 1 — 33 added lines, verbatim plan content.

## Deviations from Plan

### 1. [Documentation] Added-lines count below 40 threshold

- **Found during:** Post-Task verification
- **Issue:** Plan acceptance criterion requires `>= 40` added lines per file, but the plan's verbatim prose block only produces 33 added lines (git numstat).
- **Fix:** None applied. Plan explicitly instructs "Copy the text below verbatim - do NOT paraphrase". Adding filler content would contradict that directive and dilute the prose. The structural criteria (heading, subsections, table rows, worked-example steps, caveat) are all satisfied.
- **Files modified:** none
- **Commit:** n/a

No other deviations. All functional and structural criteria pass.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | EN Schedules section | 5f63ec3 | frontend/src/docs/en/admin-guide/digital-signage.md |
| 2 | DE Zeitpläne section (du-tone) | 1fafbe6 | frontend/src/docs/de/admin-guide/digital-signage.md |

## Verification Commands

```bash
grep -cE "^## Schedules$" frontend/src/docs/en/admin-guide/digital-signage.md   # 1
grep -cE "^## Zeitpläne$" frontend/src/docs/de/admin-guide/digital-signage.md   # 1
awk '/^## Zeitpläne$/,0' frontend/src/docs/de/admin-guide/digital-signage.md \
  | grep -cE "\bSie\b|\bIhre?\b|\bIhnen\b"                                      # 0
```

## Self-Check: PASSED

- `frontend/src/docs/en/admin-guide/digital-signage.md` FOUND and contains `## Schedules`
- `frontend/src/docs/de/admin-guide/digital-signage.md` FOUND and contains `## Zeitpläne`
- Commit 5f63ec3 FOUND in git log
- Commit 1fafbe6 FOUND in git log
- Du-tone enforcement in DE new section: 0 occurrences of Sie/Ihre/Ihr/Ihnen
