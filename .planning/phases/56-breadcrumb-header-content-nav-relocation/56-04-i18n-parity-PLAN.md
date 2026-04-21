---
phase: 56-breadcrumb-header-content-nav-relocation
plan: 04
type: execute
wave: 3
depends_on: [56-01, 56-02, 56-03]
files_modified:
  - frontend/src/locales/de.json
  - frontend/src/locales/en.json
autonomous: false
requirements: [HDR-03]
must_haves:
  truths:
    - "8 new i18n keys exist in both de.json and en.json: nav.home, breadcrumb.aria_label, breadcrumb.signage.pair, userMenu.triggerLabel, userMenu.docs, userMenu.settings, userMenu.signOut, nav.dashboardToggleLabel"
    - "3 obsolete keys are removed from both locales: nav.back, nav.back_to_sales, nav.back_to_hr"
    - "check-locale-parity.mts exits 0 (PARITY OK)"
    - "Breadcrumb + UserMenu render resolved copy (not key strings) in both DE and EN"
  artifacts:
    - path: "frontend/src/locales/de.json"
      provides: "8 new DE keys + 3 removed obsolete keys"
    - path: "frontend/src/locales/en.json"
      provides: "8 new EN keys + 3 removed obsolete keys"
  key_links:
    - from: "Breadcrumb.tsx t(nav.home)"
      to: "de.json + en.json nav.home"
      via: "i18n key resolution at render time"
      pattern: "\"nav\\.home\""
    - from: "UserMenu.tsx t(userMenu.*)"
      to: "de.json + en.json userMenu.* keys"
      via: "i18n key resolution at render time"
      pattern: "\"userMenu\\."
    - from: "check-locale-parity.mts"
      to: "de.json + en.json"
      via: "Object.keys set comparison must be equal"
      pattern: "check-locale-parity"
---

<objective>
Add the 8 new i18n keys referenced by Breadcrumb, UserMenu, and the
SubHeader Sales/HR Toggle. Remove the 3 obsolete keys orphaned by the
back-button removal. Gate the change with the project parity CI script.
Completes HDR-03 (DE/EN full key parity + localized breadcrumb items).

Purpose: Close the i18n-key-count invariant for Phase 56. Without this
plan, Breadcrumb + UserMenu render the raw key strings ("nav.home" etc.)
instead of resolved copy — a visible UI defect.

Output: Two JSON locale files with 8 added entries + 3 removed entries
each. No source code changes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/56-breadcrumb-header-content-nav-relocation/56-CONTEXT.md
@.planning/phases/56-breadcrumb-header-content-nav-relocation/56-RESEARCH.md
@.planning/phases/56-breadcrumb-header-content-nav-relocation/56-UI-SPEC.md
@.planning/phases/56-breadcrumb-header-content-nav-relocation/56-01-SUMMARY.md
@.planning/phases/56-breadcrumb-header-content-nav-relocation/56-02-SUMMARY.md
@.planning/phases/56-breadcrumb-header-content-nav-relocation/56-03-SUMMARY.md

@frontend/src/locales/de.json
@frontend/src/locales/en.json
@frontend/scripts/check-locale-parity.mts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add 8 new i18n keys + remove 3 obsolete keys in both locales</name>
  <files>frontend/src/locales/de.json, frontend/src/locales/en.json</files>
  <read_first>
    - frontend/src/locales/en.json (confirm flat-dotted key style; find canonical insertion spot near existing nav.* and breadcrumb.* groups if present)
    - frontend/src/locales/de.json (mirror shape)
    - frontend/scripts/check-locale-parity.mts (understand parity gate — it compares Object.keys sets; both files must have identical key sets)
    - .planning/phases/56-breadcrumb-header-content-nav-relocation/56-UI-SPEC.md "Copywriting Contract" table (authoritative key/copy table)
    - .planning/phases/56-breadcrumb-header-content-nav-relocation/56-RESEARCH.md Pitfall 6 + Pitfall 7 (i18n parity + complete key list)
  </read_first>
  <action>
Edit `frontend/src/locales/en.json` and `frontend/src/locales/de.json` to:

**ADD these 8 keys** (flat-dotted, top-level, matching the existing style in both files):

| Key | EN value | DE value |
|-----|----------|----------|
| `nav.home` | `Home` | `Start` |
| `breadcrumb.aria_label` | `Breadcrumb` | `Brotkrumen` |
| `breadcrumb.signage.pair` | `Pair` | `Koppeln` |
| `userMenu.triggerLabel` | `User menu` | `Benutzermenü` |
| `userMenu.docs` | `Documentation` | `Dokumentation` |
| `userMenu.settings` | `Settings` | `Einstellungen` |
| `userMenu.signOut` | `Sign out` | `Abmelden` |
| `nav.dashboardToggleLabel` | `Dashboard` | `Dashboard-Auswahl` |

**REMOVE these 3 keys from BOTH files** (obsolete after D-10 back-button removal):
- `nav.back`
- `nav.back_to_sales`
- `nav.back_to_hr`

Preserve flat-dotted style and the single `translation` namespace structure. Do NOT nest under `nav: {home: ...}` — the i18n config uses `keySeparator: false` so flat dot-strings are the canonical shape (confirm from existing entries like `nav.sales`, `nav.hr`).

After editing:
- Both files have identical `Object.keys` sets (parity script enforces)
- DE values use du-tone where imperative form exists; labels above are nominal so DE copy is neutral/natural

CRITICAL: If any of the 3 obsolete keys are NOT in de.json or en.json at start of task (grep first), skip the removal for those — do not error. Record which keys were actually removed in SUMMARY.

Also CRITICAL: Before adding `breadcrumb.signage.pair`, check whether `breadcrumb.*` is an existing key group; if yes, add alongside; if no, this introduces the group — fine.
  </action>
  <verify>
    <automated>cd frontend && node --experimental-strip-types scripts/check-locale-parity.mts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c '"nav.home"' frontend/src/locales/en.json` prints `1`
    - `grep -c '"nav.home"' frontend/src/locales/de.json` prints `1`
    - `grep -c '"breadcrumb.aria_label"' frontend/src/locales/en.json` prints `1`
    - `grep -c '"breadcrumb.aria_label"' frontend/src/locales/de.json` prints `1`
    - `grep -c '"breadcrumb.signage.pair"' frontend/src/locales/en.json` prints `1`
    - `grep -c '"breadcrumb.signage.pair"' frontend/src/locales/de.json` prints `1`
    - `grep -c '"userMenu.triggerLabel"' frontend/src/locales/en.json` prints `1`
    - `grep -c '"userMenu.triggerLabel"' frontend/src/locales/de.json` prints `1`
    - `grep -c '"userMenu.docs"' frontend/src/locales/en.json` prints `1`
    - `grep -c '"userMenu.docs"' frontend/src/locales/de.json` prints `1`
    - `grep -c '"userMenu.settings"' frontend/src/locales/en.json` prints `1`
    - `grep -c '"userMenu.settings"' frontend/src/locales/de.json` prints `1`
    - `grep -c '"userMenu.signOut"' frontend/src/locales/en.json` prints `1`
    - `grep -c '"userMenu.signOut"' frontend/src/locales/de.json` prints `1`
    - `grep -c '"nav.dashboardToggleLabel"' frontend/src/locales/en.json` prints `1`
    - `grep -c '"nav.dashboardToggleLabel"' frontend/src/locales/de.json` prints `1`
    - `rg -n '"nav.back"|"nav.back_to_sales"|"nav.back_to_hr"' frontend/src/locales/` returns ZERO matches
    - Exact EN values present: `grep -q '"nav.home": "Home"' frontend/src/locales/en.json`
    - Exact DE values present: `grep -q '"nav.home": "Start"' frontend/src/locales/de.json`
    - Exact EN/DE for breadcrumb.aria_label: `grep -q '"breadcrumb.aria_label": "Breadcrumb"' frontend/src/locales/en.json` AND `grep -q '"breadcrumb.aria_label": "Brotkrumen"' frontend/src/locales/de.json`
    - Exact EN/DE for userMenu.signOut: `grep -q '"userMenu.signOut": "Sign out"' frontend/src/locales/en.json` AND `grep -q '"userMenu.signOut": "Abmelden"' frontend/src/locales/de.json`
    - `cd frontend && node --experimental-strip-types scripts/check-locale-parity.mts` exits 0 and prints `PARITY OK`
    - Both files parse as valid JSON: `cd frontend && node -e "JSON.parse(require('fs').readFileSync('src/locales/en.json','utf8'));JSON.parse(require('fs').readFileSync('src/locales/de.json','utf8'))"` exits 0
  </acceptance_criteria>
  <done>
All 8 keys added with correct EN+DE values; 3 obsolete keys removed; JSON valid; parity script green.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Human smoke — localized copy on both locales</name>
  <files>frontend/src/locales/de.json, frontend/src/locales/en.json</files>
  <what-built>
    - Breadcrumb + UserMenu + Sales/HR Toggle aria-label all resolve to real copy in both DE and EN.
  </what-built>
  <action>Pause execution and present the verification steps below to the user. Wait for "approved" before finalizing the phase. Report any raw key-string sightings as defects, not as acceptable output.</action>
  <how-to-verify>
    1. `cd frontend && npm run dev`.
    2. Switch to EN via the LanguageToggle.
    3. Visit `/sales`: breadcrumb reads `Home › Sales`. Hover the avatar → aria-label shows "User menu". Open the menu — rows read "Documentation", "Settings", "Sign out".
    4. Visit `/signage/pair` — breadcrumb reads `Home › Digital Signage › Pair`.
    5. Switch to DE via the LanguageToggle.
    6. Revisit `/sales`: breadcrumb reads `Start › Umsatz` (or the existing DE nav.sales value). Avatar aria-label = "Benutzermenü". Menu rows: "Dokumentation", "Einstellungen", "Abmelden".
    7. Visit `/signage/pair` — breadcrumb ends with `Koppeln`.
    8. Confirm no raw key strings ever visible (no "nav.home", no "userMenu.docs" literals).
    9. Confirm SubHeader Sales/HR Toggle has an accessible name (aria-label) visible via `inspect → accessibility` panel: EN "Dashboard", DE "Dashboard-Auswahl".
  </how-to-verify>
  <verify>Human-driven smoke per the how-to-verify steps above; resume only after explicit "approved" from user.</verify>
  <done>User confirms all 9 how-to-verify steps pass and types "approved".</done>
  <resume-signal>Type "approved" or list any raw key strings seen / missing translations.</resume-signal>
</task>


</tasks>

<verification>
- `cd frontend && node --experimental-strip-types scripts/check-locale-parity.mts` prints `PARITY OK`
- All 8 new keys present in both locales (see acceptance criteria grep list)
- 0 occurrences of the 3 removed keys across `frontend/src/locales/`
- Human smoke approval
</verification>

<success_criteria>
1. DE and EN locale files have identical `Object.keys` sets (HDR-03 parity invariant)
2. All 8 new keys carry canonical copy per UI-SPEC Copywriting Contract
3. 3 obsolete back-button keys removed from both locales (D-10 cleanup)
4. Breadcrumb and UserMenu render localized text in both languages (HDR-03)
5. check-locale-parity.mts CI gate green
</success_criteria>

<output>
After completion, create `.planning/phases/56-breadcrumb-header-content-nav-relocation/56-04-SUMMARY.md`
</output>
