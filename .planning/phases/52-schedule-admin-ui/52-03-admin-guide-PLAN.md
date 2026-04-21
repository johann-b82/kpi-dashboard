---
phase: 52-schedule-admin-ui
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/docs/en/admin-guide/digital-signage.md
  - frontend/src/docs/de/admin-guide/digital-signage.md
autonomous: true
requirements:
  - SGN-SCHED-UI-03
must_haves:
  truths:
    - "Both EN and DE admin-guide digital-signage.md have a new §Schedules (EN) / §Zeitpläne (DE) section"
    - "DE uses informal du-tone throughout (no Sie/Ihre/Ihr in the new section)"
    - "Worked example quotes the milestone Success Criteria scenario: Mo-Fr 07:00-11:00 Playlist X priority 10; Mo-So 11:00-14:00 Playlist Y priority 5; fallback at 15:00"
    - "Field reference covers: playlist, days, time window, priority, enabled"
    - "Invariants documented: start<end strict, midnight-split rule, FK-RESTRICT caveat"
    - "No screenshots (D-16) - all prose + field tables, matching existing digital-signage.md convention"
    - "i18n parity CI stays green (plan adds no new i18n keys)"
  artifacts:
    - path: "frontend/src/docs/en/admin-guide/digital-signage.md"
      provides: "English Schedules section"
      contains: "Schedules"
    - path: "frontend/src/docs/de/admin-guide/digital-signage.md"
      provides: "German Zeitpläne section with du-tone"
      contains: "Zeitpläne"
  key_links:
    - from: "digital-signage.md (en)"
      to: "SGN-SCHED-UI-03"
      via: "Schedules heading + worked example + field table"
      pattern: "## .*[Ss]chedules"
    - from: "digital-signage.md (de)"
      to: "SGN-SCHED-UI-03"
      via: "Zeitpläne heading with du-tone"
      pattern: "## .*Zeitpläne"
---

<objective>
Close SGN-SCHED-UI-03 by extending the bilingual digital-signage admin guide with a Schedules / Zeitpläne section that teaches operators when to use schedules, how to fill the form, the validation invariants, and walks through the milestone-level worked example.

Purpose: Operators need a self-serve reference that mirrors what the editor form exposes. The worked example also doubles as a sanity-check script for the Phase 51 resolver behavior.

Output: Two markdown files updated with ~60-100 lines of new content each. No screenshots. Parallel structure between EN and DE for i18n reviewability.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/52-schedule-admin-ui/52-CONTEXT.md
@.planning/phases/52-schedule-admin-ui/52-UI-SPEC.md
@frontend/src/docs/en/admin-guide/digital-signage.md
@frontend/src/docs/de/admin-guide/digital-signage.md
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Append Schedules section to EN admin guide</name>
  <files>frontend/src/docs/en/admin-guide/digital-signage.md</files>
  <read_first>
    - frontend/src/docs/en/admin-guide/digital-signage.md (full file - match heading depth, tone, table style)
    - .planning/phases/52-schedule-admin-ui/52-CONTEXT.md section "Admin guide" (D-15, D-16, D-17)
    - .planning/REQUIREMENTS.md Success Criteria #3 (source of worked example)
  </read_first>
  <behavior>
    New section APPENDED after existing content. Uses the same heading depth as existing top-level sections (inspect the file to confirm - likely `##`). Content (D-15):
    1. Overview paragraph - what schedules are, when to use them vs always-on tag playlists.
    2. Field reference table: Playlist, Days, Start time, End time, Priority, Enabled.
    3. Invariants bullet list: start<end strict, midnight-split rule, weekday bit order is internal.
    4. Worked example - numbered walkthrough matching milestone Success Criteria #3 verbatim.
    5. FK-RESTRICT caveat paragraph about playlist deletion.
    6. No screenshots (D-16).
  </behavior>
  <action>
    Inspect heading depth used by existing top-level sections in the file, then append the new section after the current last section. Use the detected heading depth (e.g. `##`). Copy the text below verbatim - do NOT paraphrase the worked example:

    ```markdown
    ## Schedules

    Schedules play specific playlists at specific times and days. Use them when a device should show one playlist during the workday and another in the evening - for example, a menu board that switches from breakfast to lunch. When no schedule matches the current time, the device falls back to the always-on tag-based playlist.

    ### Fields

    | Field | Description | Required | Notes |
    |-------|-------------|----------|-------|
    | Playlist | Which playlist this schedule plays. | Yes | Pick from existing playlists. Create one in the Playlists tab first. |
    | Days | Weekdays on which this schedule is active. | Yes (>=1) | Weekdays, Weekend, and Daily quick-picks overwrite the checkbox row. |
    | Start time | When the schedule activates (inclusive). | Yes | Format HH:MM. |
    | End time | When the schedule deactivates (exclusive). | Yes | Format HH:MM. Must be strictly after start. |
    | Priority | Tie-breaker when two schedules overlap. | No (default 0) | Higher wins. Last-updated wins on a tie. |
    | Enabled | Whether the schedule is active. | No (default on) | Toggle inline in the list without opening the editor. |

    ### Invariants

    - Start time must be strictly before end time. 11:00 to 11:00 is rejected.
    - Midnight-spanning windows (e.g. 22:00 to 02:00) are not supported in a single schedule. Split them into two rows.
    - The weekday bit order (Monday = bit 0 ... Sunday = bit 6) is an implementation detail. The editor shows a plain Mo-Su checkbox row.

    ### Worked example

    1. Create Schedule A: Mon-Fri, 07:00 to 11:00, Playlist X, priority 10, enabled.
    2. Create Schedule B: every day (Mon-Sun), 11:00 to 14:00, Playlist Y, priority 5, enabled.
    3. At 08:30 on a Wednesday the device plays Playlist X - Schedule A matches.
    4. At 12:00 on a Wednesday the device plays Playlist Y - Schedule B matches; A does not because 11:00 is exclusive.
    5. At 15:00 on a Wednesday no schedule matches - the device falls back to the always-on tag-based playlist.

    ### Deleting a playlist referenced by a schedule

    A playlist cannot be deleted while any schedule still references it. The deletion returns an error toast listing the blocking schedules; click "Schedules" in the toast to jump to the Schedules tab with those rows highlighted. Remove or reassign them there, then retry the playlist delete.
    ```

    Append only. Do NOT remove or reorder any existing content. Do NOT add screenshots or image references.
  </action>
  <verify>
    <automated>grep -cE "^## Schedules$" frontend/src/docs/en/admin-guide/digital-signage.md; grep -cE "^### Worked example$" frontend/src/docs/en/admin-guide/digital-signage.md; grep -cE "Playlist X" frontend/src/docs/en/admin-guide/digital-signage.md; grep -c "08:30" frontend/src/docs/en/admin-guide/digital-signage.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -cE "^## Schedules$" frontend/src/docs/en/admin-guide/digital-signage.md` returns >=1 (new top-level section present)
    - `grep -qE "^### Worked example$" frontend/src/docs/en/admin-guide/digital-signage.md` succeeds
    - `grep -qE "^### Fields$" frontend/src/docs/en/admin-guide/digital-signage.md` succeeds
    - `grep -qE "^### Invariants$" frontend/src/docs/en/admin-guide/digital-signage.md` succeeds
    - Worked example contains the three key timestamps: `grep -c "07:00" frontend/src/docs/en/admin-guide/digital-signage.md` >=1, `grep -c "11:00" ... >=2`, `grep -c "15:00" ... >=1`
    - Both playlists named: `grep -q "Playlist X" ...` AND `grep -q "Playlist Y" ...` succeed
    - Field reference table present: `grep -q "| Priority |" frontend/src/docs/en/admin-guide/digital-signage.md` succeeds
    - No image references added: `git diff frontend/src/docs/en/admin-guide/digital-signage.md | grep -E "^\+.*!\[" | wc -l` returns 0
    - New content count: `git diff --numstat frontend/src/docs/en/admin-guide/digital-signage.md` added lines >= 40
  </acceptance_criteria>
  <done>EN admin guide has a complete Schedules section with field table, invariants, worked example, and FK-RESTRICT note. No screenshots.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Append Zeitpläne section to DE admin guide (du-tone)</name>
  <files>frontend/src/docs/de/admin-guide/digital-signage.md</files>
  <read_first>
    - frontend/src/docs/de/admin-guide/digital-signage.md (full file - match heading depth AND du-tone phrasing used in existing sections)
    - frontend/src/docs/en/admin-guide/digital-signage.md (Task 1 output - parallel structure reference)
    - .planning/phases/52-schedule-admin-ui/52-CONTEXT.md section "Admin guide" (D-15, D-17)
  </read_first>
  <behavior>
    Parallel to Task 1 structure (same subsections, same table, same worked-example numbering) but in German with informal "du" tone throughout. No "Sie", no "Ihr/Ihre", no "Ihnen" in the new section.
  </behavior>
  <action>
    Inspect existing heading depth and du-tone phrasing in the DE file, then append the following section after the current last section. Use the detected heading depth (match Task 1's result).

    ```markdown
    ## Zeitpläne

    Zeitpläne spielen bestimmte Playlists zu bestimmten Zeiten und an bestimmten Tagen. Nutze sie, wenn ein Gerät tagsüber eine andere Playlist zeigen soll als abends - zum Beispiel eine Menütafel, die von Frühstück auf Mittag wechselt. Wenn kein Zeitplan zur aktuellen Zeit passt, fällt das Gerät auf die immer aktive Tag-basierte Playlist zurück.

    ### Felder

    | Feld | Beschreibung | Pflicht | Hinweise |
    |------|--------------|---------|----------|
    | Playlist | Welche Playlist dieser Zeitplan abspielt. | Ja | Wähle aus den vorhandenen Playlists. Lege bei Bedarf zuerst eine im Playlists-Tab an. |
    | Tage | An welchen Wochentagen der Zeitplan aktiv ist. | Ja (>=1) | Die Schnellauswahl Wochentags, Wochenende und Täglich überschreibt die Checkboxen. |
    | Startzeit | Wann der Zeitplan aktiviert (einschliesslich). | Ja | Format HH:MM. |
    | Endzeit | Wann der Zeitplan deaktiviert (ausschliesslich). | Ja | Format HH:MM. Muss strikt nach der Startzeit liegen. |
    | Priorität | Entscheidet bei Überschneidungen. | Nein (Standard 0) | Höherer Wert gewinnt. Bei Gleichstand gewinnt der zuletzt aktualisierte. |
    | Aktiv | Ob der Zeitplan in Kraft ist. | Nein (Standard an) | Lässt sich in der Liste direkt umschalten, ohne den Editor zu öffnen. |

    ### Regeln

    - Die Startzeit muss strikt vor der Endzeit liegen. 11:00 bis 11:00 wird abgelehnt.
    - Zeiträume über Mitternacht (z.B. 22:00 bis 02:00) sind in einem einzelnen Zeitplan nicht erlaubt. Teile sie in zwei Einträge auf.
    - Die interne Wochentag-Bitreihenfolge (Montag = Bit 0 ... Sonntag = Bit 6) ist ein Implementierungsdetail. Der Editor zeigt dir immer eine Mo-So-Checkbox-Reihe.

    ### Beispiel

    1. Lege Zeitplan A an: Mo-Fr, 07:00 bis 11:00, Playlist X, Priorität 10, aktiv.
    2. Lege Zeitplan B an: jeden Tag (Mo-So), 11:00 bis 14:00, Playlist Y, Priorität 5, aktiv.
    3. Am Mittwoch um 08:30 spielt das Gerät Playlist X - Zeitplan A passt.
    4. Am Mittwoch um 12:00 spielt das Gerät Playlist Y - Zeitplan B passt; A nicht, weil 11:00 ausschliesslich ist.
    5. Am Mittwoch um 15:00 passt kein Zeitplan - das Gerät fällt auf die immer aktive Tag-basierte Playlist zurück.

    ### Playlist löschen, die in einem Zeitplan verwendet wird

    Eine Playlist kann nicht gelöscht werden, solange ein Zeitplan darauf verweist. Der Löschversuch zeigt dir eine Fehlermeldung mit den blockierenden Zeitplänen; klicke dort auf "Zeitpläne", um direkt zum Zeitplan-Tab zu springen, wo die betroffenen Zeilen hervorgehoben sind. Entferne oder weise sie dort neu zu und versuche dann die Playlist erneut zu löschen.
    ```

    Append only. Do NOT remove or reorder any existing content. Do NOT use "Sie", "Ihre", "Ihr", or "Ihnen" anywhere in the new section (hard gate 1 + D-17).
  </action>
  <verify>
    <automated>grep -cE "^## Zeitpläne$" frontend/src/docs/de/admin-guide/digital-signage.md; grep -cE "^### Beispiel$" frontend/src/docs/de/admin-guide/digital-signage.md; grep -c "Nutze " frontend/src/docs/de/admin-guide/digital-signage.md; awk '/^## Zeitpläne$/,0' frontend/src/docs/de/admin-guide/digital-signage.md | grep -cE "\\bSie\\b|\\bIhre?\\b|\\bIhnen\\b"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -cE "^## Zeitpläne$" frontend/src/docs/de/admin-guide/digital-signage.md` returns >=1
    - `grep -qE "^### Felder$" frontend/src/docs/de/admin-guide/digital-signage.md` succeeds
    - `grep -qE "^### Regeln$" frontend/src/docs/de/admin-guide/digital-signage.md` succeeds
    - `grep -qE "^### Beispiel$" frontend/src/docs/de/admin-guide/digital-signage.md` succeeds
    - Du-tone presence (imperative verbs): `grep -qE "Nutze |Lege |Teile |Entferne |Wähle " frontend/src/docs/de/admin-guide/digital-signage.md` succeeds
    - NO formal-Sie in the NEW section: `awk "/^## Zeitpläne\$/,0" frontend/src/docs/de/admin-guide/digital-signage.md | grep -cE "\\bSie\\b|\\bIhre?\\b|\\bIhnen\\b"` returns 0
    - Worked example uses Playlist X and Playlist Y and 08:30/12:00/15:00: `awk "/^## Zeitpläne\$/,0" frontend/src/docs/de/admin-guide/digital-signage.md | grep -c "Playlist X"` >=1, `... "Playlist Y"` >=1, `... "08:30"` >=1, `... "15:00"` >=1
    - Field table includes Priority row: `grep -q "| Priorität |" frontend/src/docs/de/admin-guide/digital-signage.md` succeeds
    - No image references added: `git diff frontend/src/docs/de/admin-guide/digital-signage.md | grep -E "^\+.*!\[" | wc -l` returns 0
    - New content count: `git diff --numstat frontend/src/docs/de/admin-guide/digital-signage.md` added lines >= 40
  </acceptance_criteria>
  <done>DE admin guide has a complete Zeitpläne section parallel to EN Task 1, written in informal du-tone. No Sie/Ihre/Ihr. No screenshots.</done>
</task>

</tasks>

<verification>
- `git diff frontend/src/docs/en/admin-guide/digital-signage.md frontend/src/docs/de/admin-guide/digital-signage.md` shows two parallel new sections
- `cd frontend && npm run check:i18n-parity` exits 0 (no new i18n keys added; parity unaffected)
- Manual skim: EN and DE sections have identical structure (same subsections in same order, same worked-example step count)
- `awk "/^## Zeitpläne\$/,0" frontend/src/docs/de/admin-guide/digital-signage.md | grep -cE "\\bSie\\b|\\bIhre?\\b|\\bIhnen\\b"` returns 0 (du-tone enforced)
</verification>

<success_criteria>
1. EN `digital-signage.md` has a new `## Schedules` section with Fields table, Invariants bullets, Worked example numbered list, and FK-RESTRICT paragraph.
2. DE `digital-signage.md` has a parallel `## Zeitpläne` section in informal du-tone (no Sie/Ihre/Ihr).
3. Worked example in both languages references the exact milestone scenario (Mo-Fr 07:00-11:00 Playlist X priority 10, Mo-So 11:00-14:00 Playlist Y priority 5, 15:00 fallback).
4. No screenshots added (D-16).
5. i18n parity CI still green.
</success_criteria>

<output>
After completion, create `.planning/phases/52-schedule-admin-ui/52-03-SUMMARY.md` with:
- Lines added per file (EN / DE)
- Heading depth used (matched to existing convention)
- Any phrasing tweaks made to preserve parallel structure
- Confirmation that no Sie/Ihre/Ihr appears in the new DE section
</output>
