# Phase 16: i18n & Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 16-i18n-polish
**Areas discussed:** PersonioCard string extraction, Parity verification approach, Polish scope

---

## PersonioCard String Extraction

### Key Naming Convention

| Option | Description | Selected |
|--------|-------------|----------|
| settings.personio.* | Mirrors existing settings.* namespace (settings.identity.*, settings.colors.*) | ✓ |
| personio.* | Top-level namespace separate from settings | |
| You decide | Claude picks whichever fits existing codebase patterns best | |

**User's choice:** settings.personio.*
**Notes:** Consistent with established settings section key naming.

### Sync Interval English Labels

| Option | Description | Selected |
|--------|-------------|----------|
| Literal translations | Manual only / Hourly / Every 6 hours / Daily | ✓ |
| Shorter labels | Manual / 1h / 6h / 24h — more compact, technical feel | |
| You decide | Claude picks based on rest of UI's tone | |

**User's choice:** Literal translations
**Notes:** Matches German intent exactly.

### Umlaut Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Fix umlauts | Use proper German: Stündlich, Ändern, wählen. UTF-8 locale file supports it | ✓ |
| Keep simplified | Preserve current ASCII-safe spelling as-is | |

**User's choice:** Fix umlauts
**Notes:** Locale file is UTF-8, no reason to avoid proper German characters.

---

## Parity Verification Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Automated key-diff script | Compare keys in en.json vs de.json, report mismatches. Reuse v1.2 tooling | ✓ |
| Manual audit only | Reviewer visually scans both files | |
| TypeScript compile check | Rely on tsc — insufficient since flat keys aren't type-checked | |

**User's choice:** Automated key-diff script
**Notes:** v1.2 had a locale parity check script that can be reused or extended.

---

## Polish Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Strictly i18n only | Extract strings, add translations, verify parity. No visual changes | ✓ |
| i18n + minor visual consistency | Also fix spacing/alignment inconsistencies | |
| i18n + placeholder cleanup | Also remove dead keys like hr.placeholder | |

**User's choice:** Strictly i18n only
**Notes:** Keeps phase minimal and shippable.

---

## Claude's Discretion

- Exact key suffixes within settings.personio.* namespace
- Whether to split parity check into own task or inline with extraction

## Deferred Ideas

None — discussion stayed within phase scope.
