# Phase 16: i18n & Polish - Research

**Researched:** 2026-04-12
**Domain:** react-i18next string extraction, flat-key JSON locale pattern
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Key namespace is `settings.personio.*` — mirrors existing `settings.identity.*`, `settings.colors.*` pattern
- **D-02:** English translations for sync interval dropdown are literal: "Manual only" / "Hourly" / "Every 6 hours" / "Daily"
- **D-03:** Fix German umlauts in locale keys — use proper UTF-8 German ("Stündlich", "Ändern", "wählen") instead of the current ASCII-safe simplified spellings ("Stuendlich", "Aendern", "waehlen")
- **D-04:** PersonioCard.tsx gets `useTranslation()` hook — all ~20 hardcoded strings replaced with `t()` calls
- **D-05:** Automated key-diff script compares keys in en.json vs de.json and reports mismatches. Reuse or extend the locale parity check script from v1.2 if it exists
- **D-06:** Parity check runs as part of plan verification step
- **D-07:** Strictly i18n only — no visual tweaks, no CSS changes, no refactoring. Extract strings, add translations, verify parity
- **D-08:** Dead keys (e.g. `hr.placeholder` which Phase 15 replaced with live cards) may be cleaned up as part of the parity audit

### Claude's Discretion
- Exact key suffixes within the `settings.personio.*` namespace (e.g. `.label`, `.placeholder`, `.help`)
- Whether to split the parity check into its own task or inline it with the extraction task

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| I18N-01 | Full DE/EN parity for all v1.3 strings (HR tab, KPI labels, Settings fields, error states, sync feedback) | All v1.3 HR/KPI strings are already translated (Phases 14-15). The sole remaining gap is PersonioCard.tsx (~20 hardcoded German strings). Adding `settings.personio.*` keys to both locale files and wiring `useTranslation()` into PersonioCard closes I18N-01. |
</phase_requirements>

## Summary

Phase 16 is a tightly bounded i18n extraction task. The project already uses react-i18next with a flat-key JSON locale pattern established across all Settings components. The only component missing i18n is `PersonioCard.tsx`, which contains roughly 18 user-visible strings hard-coded in German (plus ASCII-safe approximations for umlauts). All other v1.3 HR/KPI strings were fully translated in Phases 14 and 15.

The parity check script (`frontend/scripts/check-locale-parity.mts`) already exists and runs cleanly (exits 0 with 141 keys in both locales). The plan has two deliverables: (1) add `settings.personio.*` keys to both `en.json` and `de.json`, (2) replace every hardcoded string in `PersonioCard.tsx` with `t()` calls and add the `useTranslation` hook. The `INTERVAL_OPTIONS` array moves inside the component body so labels are re-evaluated on render when language changes. One dead key (`hr.placeholder`) should be cleaned from both files as part of the audit.

**Primary recommendation:** One plan, two tasks — locale file edits first, then PersonioCard wire-up. Run the parity script as the verification step.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-i18next | already installed | `useTranslation()` hook, `t()` function | Project standard; used by every other i18n'd component |
| i18next | already installed | Underlying i18n engine | Bundled with react-i18next |

No new packages required. This phase adds zero new dependencies.

## Architecture Patterns

### Recommended Project Structure
No structural changes. Files modified:
```
frontend/src/
├── locales/
│   ├── en.json          # add ~18 settings.personio.* keys
│   └── de.json          # add ~18 settings.personio.* keys
└── components/settings/
    └── PersonioCard.tsx  # add useTranslation, replace ~18 hardcoded strings
```

### Pattern 1: Flat-Key JSON with dot-separated namespaces
**What:** All locale keys are flat strings with dot-separated segments: `{domain}.{section}.{field}.{type}`
**When to use:** Every visible string in the app. No nested JSON objects — strictly flat.
**Example (from existing settings keys):**
```json
"settings.identity.app_name.label": "App name",
"settings.identity.app_name.placeholder": "KPI Light",
"settings.identity.app_name.help": "Shown in the top navigation and browser tab."
```

### Pattern 2: `useTranslation()` hook in functional components
**What:** Import hook at top of component, call `t("key")` at each string site.
**When to use:** Every component with visible strings.
**Example (from HrKpiCardGrid.tsx):**
```tsx
import { useTranslation } from "react-i18next";

export function HrKpiCardGrid() {
  const { t } = useTranslation();
  // ...
  <p>{t("hr.kpi.error.heading")}</p>
}
```

### Pattern 3: Dynamic strings in arrays — move inside component
**What:** Arrays containing translated strings must be declared inside the component body so they re-evaluate when the language changes. Declaring them at module scope freezes them at initial render.
**When to use:** Any const array of `{ value, label }` objects where label is a translated string.
**Before (broken — frozen at module scope):**
```tsx
const INTERVAL_OPTIONS = [
  { value: 0, label: "Nur manuell" },
];
```
**After (correct — re-evaluates on language change):**
```tsx
export function PersonioCard(...) {
  const { t } = useTranslation();
  const INTERVAL_OPTIONS = [
    { value: 0, label: t("settings.personio.sync_interval.manual") },
    { value: 1, label: t("settings.personio.sync_interval.hourly") },
    { value: 6, label: t("settings.personio.sync_interval.every6h") },
    { value: 24, label: t("settings.personio.sync_interval.daily") },
  ];
```

### Pattern 4: Conditional strings via `t()` not inline ternaries
**What:** Replace inline German ternary expressions with `t()` calls.
**Before (broken):**
```tsx
{testing ? "Teste..." : "Verbindung testen"}
```
**After (correct):**
```tsx
{testing ? t("settings.personio.test_connection.testing") : t("settings.personio.test_connection.button")}
```

### Anti-Patterns to Avoid
- **Module-scope translated arrays:** `const INTERVAL_OPTIONS = [{ label: "Stündlich" }]` at file top-level — frozen on first render, won't update on language switch
- **Hardcoded fallback strings in JS expressions:** `err.message ?? "Verbindung fehlgeschlagen"` — the fallback should also use `t()`
- **ASCII-safe umlaut substitutes in JSON values:** "Stuendlich", "Aendern", "waehlen" — de.json must use proper UTF-8 (ä, ö, ü, ß)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Key parity checking | Custom diffing code | `frontend/scripts/check-locale-parity.mts` (already exists) | Script already works, exits 0/1, prints mismatches |
| Language switching | Custom state management | react-i18next's built-in language switcher | Already wired in the project |

## Complete String Inventory: PersonioCard.tsx

Every hardcoded user-visible string and its proposed key:

| Line | Current Hardcoded Value | Proposed Key | EN Value | DE Value |
|------|------------------------|--------------|----------|----------|
| 18 | `"Nur manuell"` | `settings.personio.sync_interval.manual` | Manual only | Nur manuell |
| 19 | `"Stuendlich"` | `settings.personio.sync_interval.hourly` | Hourly | Stündlich |
| 20 | `"Alle 6 Stunden"` | `settings.personio.sync_interval.every6h` | Every 6 hours | Alle 6 Stunden |
| 21 | `"Taeglich"` | `settings.personio.sync_interval.daily` | Daily | Täglich |
| 58 | `"Connection test failed"` | `settings.personio.test_connection.error_fallback` | Connection test failed | Verbindungstest fehlgeschlagen |
| 66 | `"Personio-Zugangsdaten konfigurieren"` | `settings.personio.credentials.configure_hint` | Configure Personio credentials | Personio-Zugangsdaten konfigurieren |
| 72 | `"Personio"` (CardTitle) | `settings.personio.title` | Personio | Personio |
| 79 | `"Client-ID"` (Label) | `settings.personio.client_id.label` | Client ID | Client-ID |
| 87 | `"Client-ID eingeben"` (placeholder) | `settings.personio.client_id.placeholder` | Enter Client ID | Client-ID eingeben |
| 91 | `"Gespeichert - zum Aendern neuen Wert eingeben"` | `settings.personio.client_id.saved_hint` | Saved — enter a new value to change | Gespeichert – zum Ändern neuen Wert eingeben |
| 99 | `"Client-Secret"` (Label) | `settings.personio.client_secret.label` | Client Secret | Client-Secret |
| 107 | `"Client-Secret eingeben"` (placeholder) | `settings.personio.client_secret.placeholder` | Enter Client Secret | Client-Secret eingeben |
| 111 | `"Gespeichert - zum Aendern neuen Wert eingeben"` (same) | `settings.personio.client_secret.saved_hint` | Saved — enter a new value to change | Gespeichert – zum Ändern neuen Wert eingeben |
| 124 | `"Teste..."` | `settings.personio.test_connection.testing` | Testing… | Teste… |
| 124 | `"Verbindung testen"` | `settings.personio.test_connection.button` | Test connection | Verbindung testen |
| 135 | `"Verbindung erfolgreich"` | `settings.personio.test_connection.success` | Connection successful | Verbindung erfolgreich |
| 136 | `"Verbindung fehlgeschlagen"` | `settings.personio.test_connection.failure` | Connection failed | Verbindung fehlgeschlagen |
| 144 | `"Sync-Intervall"` (Label) | `settings.personio.sync_interval.label` | Sync interval | Sync-Intervall |
| 168 | `"Krankheitstyp"` (Label) | `settings.personio.sick_leave_type.label` | Sick leave type | Krankheitstyp |
| 179 | `"Abwesenheitstyp waehlen"` (placeholder option) | `settings.personio.sick_leave_type.placeholder` | Select absence type | Abwesenheitstyp wählen |
| 196 | `"Produktions-Abteilung"` (Label) | `settings.personio.production_dept.label` | Production department | Produktions-Abteilung |
| 207 | `"Abteilung waehlen"` (placeholder option) | `settings.personio.production_dept.placeholder` | Select department | Abteilung wählen |
| 224 | `"Skill Custom Attribute Key"` (Label) | `settings.personio.skill_attr_key.label` | Skill custom attribute key | Skill-Attribut-Schlüssel |
| 232 | `"z.B. dynamic_12345"` (placeholder) | `settings.personio.skill_attr_key.placeholder` | e.g. dynamic_12345 | z.B. dynamic_12345 |

**Total new keys per locale file: 24**
(client_id.saved_hint and client_secret.saved_hint share the same translation text — both are included as separate keys to keep the flat pattern consistent and allow future independent variation)

## Dead Key to Remove

| Key | Current Value | Reason |
|-----|--------------|--------|
| `hr.placeholder` | EN: "KPI cards coming soon" / DE: "KPI-Karten folgen in Kuerze" | Phase 15 replaced this placeholder with live KPI cards. Key is no longer referenced. Remove from both locale files. |

**Note on DE value:** `"hr.placeholder"` in de.json uses ASCII-safe "Kuerze" — a further sign it is legacy dead code. Removing it is cleaner than fixing it.

**Net key count after phase:** 141 - 1 (dead) + 24 (new) = 164 keys in each locale file.

## Common Pitfalls

### Pitfall 1: INTERVAL_OPTIONS at module scope
**What goes wrong:** `const INTERVAL_OPTIONS` at module scope captures the `t()` function (or hardcoded strings) at module load time. Language switches do not trigger a re-render of the array, so dropdown labels stay in the initial language.
**Why it happens:** JavaScript module-level constants are evaluated once.
**How to avoid:** Declare `INTERVAL_OPTIONS` inside the component function body, after the `useTranslation()` call.
**Warning signs:** Dropdown labels don't change when NavBar language toggle is clicked.

### Pitfall 2: ASCII-safe umlauts surviving into de.json
**What goes wrong:** Copy-paste from the current component code (`waehlen`, `Aendern`, `Stuendlich`, `Taeglich`) produces invalid German in the locale file.
**Why it happens:** The component was originally written with ASCII-safe approximations.
**How to avoid:** Use D-03 canonical spellings explicitly: `wählen`, `Ändern`, `Stündlich`, `Täglich`. All three of these are in the locked decisions.
**Warning signs:** Parity check passes but German text looks wrong in the UI.

### Pitfall 3: Missing `saved_hint` on both credential fields
**What goes wrong:** Only one of `client_id.saved_hint` / `client_secret.saved_hint` gets a key because the JSX looks identical in both fields. The second one stays hardcoded.
**Why it happens:** Scan-and-replace misses the second occurrence if the developer stops after the first match.
**How to avoid:** Verify both lines 91 and 111 in PersonioCard.tsx are replaced.

### Pitfall 4: `noCredentialsHint` inline string on line 66
**What goes wrong:** The ternary `!hasCredentials ? "Personio-Zugangsdaten konfigurieren" : null` on line 66 is a JS expression, not JSX — easy to miss in a visual scan of JSX strings.
**Why it happens:** It looks like logic, not UI text.
**How to avoid:** Replace with `!hasCredentials ? t("settings.personio.credentials.configure_hint") : null`.

### Pitfall 5: Forgetting `"Connection test failed"` English fallback on line 58
**What goes wrong:** Line 58 is inside a `catch` block: `err.message : "Connection test failed"`. This English fallback is a hardcoded string in a non-JSX context.
**Why it happens:** Catch blocks are often scanned less carefully than render return statements.
**How to avoid:** Replace with `t("settings.personio.test_connection.error_fallback")`.

## Code Examples

### Fully wired component skeleton (reference pattern from HrKpiCardGrid.tsx)
```tsx
import { useTranslation } from "react-i18next";

export function PersonioCard({ draft, setField, hasCredentials }: PersonioCardProps) {
  const { t } = useTranslation();

  // INTERVAL_OPTIONS MUST be inside component — re-evaluates on language change
  const INTERVAL_OPTIONS: Array<{ value: 0 | 1 | 6 | 24; label: string }> = [
    { value: 0, label: t("settings.personio.sync_interval.manual") },
    { value: 1, label: t("settings.personio.sync_interval.hourly") },
    { value: 6, label: t("settings.personio.sync_interval.every6h") },
    { value: 24, label: t("settings.personio.sync_interval.daily") },
  ];

  const noCredentialsHint = !hasCredentials
    ? t("settings.personio.credentials.configure_hint")
    : null;

  // ... rest of component
}
```

### Parity check command (existing script)
```bash
node --experimental-strip-types frontend/scripts/check-locale-parity.mts
# Exits 0: PARITY OK: 164 keys in both en.json and de.json
# Exits 1: prints MISSING_IN_DE / MISSING_IN_EN lines
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ASCII-safe German placeholders ("Stuendlich") | Proper UTF-8 (ä/ö/ü/ß) in de.json | Phase 16 (D-03) | Correct German display |
| Module-scope `INTERVAL_OPTIONS` array | Component-scope, uses `t()` | Phase 16 | Language toggle works without page refresh |

## Open Questions

None. All decisions are locked. The string inventory above is complete and verified against the actual source file.

## Environment Availability

Step 2.6: SKIPPED — phase is frontend-only code/locale-file changes. No external tools, services, or runtimes beyond Node.js (already confirmed available by `check-locale-parity.mts` running successfully).

## Sources

### Primary (HIGH confidence)
- Direct file read: `frontend/src/components/settings/PersonioCard.tsx` — complete string inventory
- Direct file read: `frontend/src/locales/en.json` — 141 keys confirmed
- Direct file read: `frontend/src/locales/de.json` — 141 keys confirmed
- Direct file read: `frontend/scripts/check-locale-parity.mts` — parity script exists and runs
- Direct file read: `frontend/src/components/dashboard/HrKpiCardGrid.tsx` — reference pattern for `useTranslation` in v1.3
- Script execution: `node --experimental-strip-types frontend/scripts/check-locale-parity.mts` → PARITY OK: 141 keys

## Metadata

**Confidence breakdown:**
- String inventory: HIGH — derived from direct file read of PersonioCard.tsx, all strings enumerated by line number
- Key naming: HIGH — follows locked D-01 namespace convention, mirrors existing settings patterns exactly
- Translation values: HIGH — EN values from D-02 (locked); DE values use proper UTF-8 per D-03 (locked) with natural German equivalents
- Parity script: HIGH — script exists, tested, exits 0/1

**Research date:** 2026-04-12
**Valid until:** Until PersonioCard.tsx is modified (stable — no moving parts)
