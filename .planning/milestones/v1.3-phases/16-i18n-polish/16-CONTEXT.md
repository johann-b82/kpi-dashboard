# Phase 16: i18n & Polish - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract all hardcoded strings from v1.3 components into i18n locale files (en.json / de.json), ensuring full DE/EN parity for every visible string added in Phases 12-15. Strictly i18n — no visual changes, no refactoring, no new features.

</domain>

<decisions>
## Implementation Decisions

### PersonioCard String Extraction
- **D-01:** Key namespace is `settings.personio.*` — mirrors existing `settings.identity.*`, `settings.colors.*` pattern
- **D-02:** English translations for sync interval dropdown are literal: "Manual only" / "Hourly" / "Every 6 hours" / "Daily"
- **D-03:** Fix German umlauts in locale keys — use proper UTF-8 German ("Stündlich", "Ändern", "wählen") instead of the current ASCII-safe simplified spellings ("Stuendlich", "Aendern", "waehlen")
- **D-04:** PersonioCard.tsx gets `useTranslation()` hook — all ~20 hardcoded strings replaced with `t()` calls

### Parity Verification
- **D-05:** Automated key-diff script compares keys in en.json vs de.json and reports mismatches. Reuse or extend the locale parity check script from v1.2 if it exists
- **D-06:** Parity check runs as part of plan verification step

### Polish Scope
- **D-07:** Strictly i18n only — no visual tweaks, no CSS changes, no refactoring. Extract strings, add translations, verify parity
- **D-08:** Dead keys (e.g. `hr.placeholder` which Phase 15 replaced with live cards) may be cleaned up as part of the parity audit

### Claude's Discretion
- Exact key suffixes within the `settings.personio.*` namespace (e.g. `.label`, `.placeholder`, `.help`)
- Whether to split the parity check into its own task or inline it with the extraction task

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locale files
- `frontend/src/locales/en.json` — Current EN locale (143 keys, all v1.0-v1.3)
- `frontend/src/locales/de.json` — Current DE locale (143 keys, perfect parity with EN)

### Components with hardcoded strings (the work)
- `frontend/src/components/settings/PersonioCard.tsx` — ~20 hardcoded German strings, no useTranslation

### Already i18n'd v1.3 components (reference patterns)
- `frontend/src/components/dashboard/HrKpiCardGrid.tsx` — Phase 15, fully i18n'd with `hr.kpi.*` keys
- `frontend/src/pages/HRPage.tsx` — Phase 14, fully i18n'd with `hr.sync.*` keys
- `frontend/src/components/settings/SettingsPage.tsx` — v1.1, established `settings.*` key pattern

### Prior context
- `.planning/phases/13-sync-service-settings-extension/13-CONTEXT.md` — D-10 through D-17 define PersonioCard layout and behavior

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useTranslation()` from react-i18next — standard hook used across all i18n'd components
- Flat-key JSON locale pattern — no nested objects, keys like `settings.identity.app_name.label`

### Established Patterns
- All Settings components except PersonioCard use `t()` for every visible string
- Locale files are flat JSON with dot-separated keys
- Key naming: `{domain}.{section}.{field}.{type}` (e.g. `settings.identity.app_name.label`)

### Integration Points
- PersonioCard.tsx — add `useTranslation` import, replace all string literals with `t()` calls
- en.json / de.json — add ~15-20 new `settings.personio.*` keys each
- INTERVAL_OPTIONS array — labels become `t()` calls (requires moving inside component or using a render-time mapping)

</code_context>

<specifics>
## Specific Ideas

- Umlauts must be proper UTF-8 German in de.json (ä, ö, ü, ß) — not ASCII-safe substitutes
- Sync interval EN labels: "Manual only", "Hourly", "Every 6 hours", "Daily"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-i18n-polish*
*Context gathered: 2026-04-12*
