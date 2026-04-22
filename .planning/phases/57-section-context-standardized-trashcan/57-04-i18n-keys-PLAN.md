---
phase: 57-section-context-standardized-trashcan
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/locales/en.json
  - frontend/src/locales/de.json
autonomous: true
gap_closure: false
requirements: [SECTION-01, SECTION-02, SECTION-03, SECTION-04]

must_haves:
  truths:
    - "5 primitive keys (ui.delete.*) exist in both en.json and de.json"
    - "14 section keys (section.<area>.{title,description}) exist in both locales"
    - "bodyFallback string contains <1>{{itemLabel}}</1> markers for react-i18next Trans"
    - "Parity checker (check-locale-parity.mts) reports PARITY OK"
    - "DE copy is du-tone (no Sie/Ihr/Ihre)"
  artifacts:
    - path: "frontend/src/locales/en.json"
      provides: "19 new EN keys (5 ui.delete + 14 section)"
      contains: "ui.delete.title"
    - path: "frontend/src/locales/de.json"
      provides: "19 new DE keys matching EN keys 1:1"
      contains: "ui.delete.title"
  key_links:
    - from: "frontend/src/locales/en.json"
      to: "frontend/src/locales/de.json"
      via: "1:1 key parity enforced by check-locale-parity.mts"
      pattern: "ui\\.delete\\.|section\\."
---

<objective>
Add 19 new i18n keys (5 primitive + 14 section) to both locale files, with
DE copy in du-tone and EN-DE parity passing. Copy sourced verbatim from
UI-SPEC §Copywriting. Plan 57-03's DeleteButton <Trans> requires the
bodyFallback string to use `<1>{{itemLabel}}</1>` component-index markers
(NOT markdown `**{{itemLabel}}**`).

Purpose: Unblock Wave B migrations — each section page imports its new
section.<area>.* keys; DeleteButton uses ui.delete.* as defaults.
Output: Two modified locale files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/57-section-context-standardized-trashcan/57-UI-SPEC.md
@.planning/phases/57-section-context-standardized-trashcan/57-RESEARCH.md
@frontend/src/locales/en.json
@frontend/src/locales/de.json
@frontend/scripts/check-locale-parity.mts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add ui.delete.* primitive keys (EN + DE)</name>
  <files>frontend/src/locales/en.json, frontend/src/locales/de.json</files>
  <action>
    Add these 5 flat-dotted keys to BOTH en.json and de.json (maintain existing
    alphabetical or grouped ordering — read surrounding context to match style):

    EN:
    - `ui.delete.title` = "Delete"
    - `ui.delete.cancel` = "Cancel"
    - `ui.delete.confirm` = "Delete"
    - `ui.delete.ariaLabel` = "Delete {{itemLabel}}"
    - `ui.delete.bodyFallback` = "Are you sure you want to delete <1>{{itemLabel}}</1>? This cannot be undone."

    DE (du-tone per D-07):
    - `ui.delete.title` = "Löschen"
    - `ui.delete.cancel` = "Abbrechen"
    - `ui.delete.confirm` = "Löschen"
    - `ui.delete.ariaLabel` = "{{itemLabel}} löschen"
    - `ui.delete.bodyFallback` = "Willst du <1>{{itemLabel}}</1> wirklich löschen? Das lässt sich nicht rückgängig machen."

    CRITICAL: The bodyFallback string uses `<1>…</1>` (component-index markers
    for react-i18next `<Trans components={{ 1: <strong /> }}>`) — NOT markdown
    `**…**`. This supersedes UI-SPEC's markdown-styled copy per RESEARCH
    Pitfall 8.

    Run parity checker:
    `node --experimental-strip-types frontend/scripts/check-locale-parity.mts`
    → MUST print PARITY OK.

    Commit: `feat(57-04): add ui.delete.* primitive i18n keys (EN+DE)`.
  </action>
  <verify>
    <automated>node --experimental-strip-types frontend/scripts/check-locale-parity.mts && rg "ui\.delete\.bodyFallback" frontend/src/locales/ | grep "&lt;1&gt;" || rg '"ui\.delete\.bodyFallback"' frontend/src/locales/ | grep -c "<1>"</automated>
  </verify>
  <done>
    - 5 EN keys present, 5 DE keys present
    - Parity checker passes
    - bodyFallback contains `<1>` literal in both locales
    - DE copy uses "du"/"dich"/"dir" (no Sie/Ihr/Ihre) — verify via `rg "Sie|Ihre|Ihr " frontend/src/locales/de.json | grep "ui\.delete"` returns 0
  </done>
</task>

<task type="auto">
  <name>Task 2: Add 14 section.* keys for 7 admin sections (EN + DE)</name>
  <files>frontend/src/locales/en.json, frontend/src/locales/de.json</files>
  <action>
    Add 14 keys (7 sections × {title, description}) to BOTH locales.
    Copy verbatim from UI-SPEC §Copywriting §New section-level keys.

    EN:
    - `section.signage.media.title` = "Media library"
    - `section.signage.media.description` = "Upload, preview, and delete signage media items. Shared across playlists."
    - `section.signage.playlists.title` = "Playlists"
    - `section.signage.playlists.description` = "Group media into ordered playlists that devices play on a loop."
    - `section.signage.devices.title` = "Devices"
    - `section.signage.devices.description` = "Pair, tag, and monitor every screen connected to your signage network."
    - `section.signage.schedules.title` = "Schedules"
    - `section.signage.schedules.description` = "Pin playlists to time windows and weekdays. Tags fall back when no schedule is active."
    - `section.signage.tags.title` = "Tags"
    - `section.signage.tags.description` = "Tags route playlists to devices. Every device and playlist carries one or more."
    - `section.settings.sensors.title` = "Sensors"
    - `section.settings.sensors.description` = "Track environment sensors — add, rename, or remove them here."
    - `section.settings.users.title` = "Users"
    - `section.settings.users.description` = "Manage admin access to the dashboard. Sign-in happens via the identity provider."

    DE (du-tone):
    - `section.signage.media.title` = "Medienbibliothek"
    - `section.signage.media.description` = "Lade Medien hoch, prüfe die Vorschau und lösche nicht mehr benötigte Inhalte. Playlist-übergreifend."
    - `section.signage.playlists.title` = "Playlists"
    - `section.signage.playlists.description` = "Bündle Medien zu geordneten Playlists, die deine Geräte in Schleife abspielen."
    - `section.signage.devices.title` = "Geräte"
    - `section.signage.devices.description` = "Koppele, tagge und überwache jeden Bildschirm in deinem Signage-Netz."
    - `section.signage.schedules.title` = "Zeitpläne"
    - `section.signage.schedules.description` = "Binde Playlists an Zeitfenster und Wochentage. Ohne aktiven Zeitplan greifen die Tags."
    - `section.signage.tags.title` = "Tags"
    - `section.signage.tags.description` = "Tags verbinden Playlists mit Geräten. Jedes Gerät und jede Playlist trägt mindestens einen."
    - `section.settings.sensors.title` = "Sensoren"
    - `section.settings.sensors.description` = "Überwache Umgebungssensoren — hier kannst du sie hinzufügen, umbenennen oder entfernen."
    - `section.settings.users.title` = "Benutzer"
    - `section.settings.users.description` = "Verwalte den Admin-Zugriff auf das Dashboard. Die Anmeldung läuft über den Identity-Provider."

    Users + Tags keys reserved even though `/settings/users` and `/signage/tags`
    routes don't exist today (per RESEARCH Q4 + UI-SPEC §Copywriting reserve note).

    Run parity check → PARITY OK.

    Commit: `feat(57-04): add 14 section.* i18n keys for admin sections (EN+DE)`.
  </action>
  <verify>
    <automated>node --experimental-strip-types frontend/scripts/check-locale-parity.mts</automated>
  </verify>
  <done>
    - 14 EN + 14 DE section.* keys added
    - Parity checker still passes
    - DE section descriptions use du-tone — verify `rg '"section\.[^"]+":\s*"[^"]*(Sie|Ihre|Ihr )' frontend/src/locales/de.json` returns 0
    - Net new keys this phase: 5 + 14 = 19 in EN, 19 in DE
  </done>
</task>

</tasks>

<verification>
- `node --experimental-strip-types frontend/scripts/check-locale-parity.mts` prints PARITY OK
- `rg '"ui\.delete\.|"section\.' frontend/src/locales/en.json | wc -l` = 19
- `rg '"ui\.delete\.|"section\.' frontend/src/locales/de.json | wc -l` = 19
- No Sie/Ihre in any new DE key
</verification>

<success_criteria>
1. 19 new keys present in each locale
2. Parity check green
3. DE du-tone enforced
4. bodyFallback uses `<1>…</1>` markers
</success_criteria>

<output>
After completion, create `.planning/phases/57-section-context-standardized-trashcan/57-04-SUMMARY.md`
</output>
