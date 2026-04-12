# Phase 14: Navigation & HR Tab Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 14-navigation-hr-tab-shell
**Areas discussed:** Tab structure & routing, HR tab content shell, Sync freshness & manual sync, FreshnessIndicator scope

---

## Tab Structure & Routing

### Routing strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Keep / as Sales (Recommended) | Rename DashboardPage internally, keep '/' route. Add '/hr'. Least disruption. | yes |
| Move to /sales and /hr | Redirect '/' to '/sales'. Cleaner URLs but breaks bookmarks. | |
| Tabbed single page | Client-side tab state, no URL change. No deep-linking to HR tab. | |

**User's choice:** Keep / as Sales
**Notes:** None

### Tab label language

| Option | Description | Selected |
|--------|-------------|----------|
| "Sales" / "Vertrieb" (i18n) | Locale key with DE/EN translations. Consistent bilingual pattern. | yes |
| "Sales" in both languages | English loan word, simpler. | |
| "Umsatz" / "Revenue" | More descriptive but differs from NAV-01 requirement wording. | |

**User's choice:** "Sales" / "Vertrieb" (i18n)
**Notes:** None

---

## HR Tab Content Shell

### Shell content before Phase 15

| Option | Description | Selected |
|--------|-------------|----------|
| Sync status + placeholder (Recommended) | Freshness indicator, sync button, and subtle empty state message. | yes |
| Sync status only | Just freshness and button, no placeholder text. | |
| Ghost/skeleton cards | 5 placeholder card outlines. May confuse users. | |

**User's choice:** Sync status + placeholder
**Notes:** None

### Layout wrapper

| Option | Description | Selected |
|--------|-------------|----------|
| Same layout (Recommended) | Reuse max-w-7xl mx-auto px-6 py-8. Consistent width. | yes |
| Full width | No max-width. More space for 5 KPI cards. | |

**User's choice:** Same layout
**Notes:** None

---

## Sync Freshness & Manual Sync

### Freshness placement

| Option | Description | Selected |
|--------|-------------|----------|
| Top of HR page, inline (Recommended) | Right-aligned toolbar: timestamp + sync button. | yes |
| Below page title | Subtitle text below heading. | |
| In a status card | Dedicated card for sync status. Takes KPI space. | |

**User's choice:** Top of HR page, inline
**Notes:** None

### Sync button behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Disable + spinner (Recommended) | Loading spinner, disabled during sync. Green checkmark on success, red text on error. | yes |
| Replace with progress text | Button text changes to 'Synchronisiere...'. | |
| Toast-based feedback | Success/error as toast. Consistent with Settings save. | |

**User's choice:** Disable + spinner
**Notes:** None

### No-sync-yet state

| Option | Description | Selected |
|--------|-------------|----------|
| Hint to configure (Recommended) | "Noch nicht synchronisiert" with Settings link hint. | yes |
| Just "never" | Same text, no guidance. Matches upload pattern. | |
| Hide completely | No freshness until first sync. | |

**User's choice:** Hint to configure
**Notes:** None

---

## FreshnessIndicator Scope

### Indicator visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Contextual per tab (Recommended) | NavBar shows upload freshness on Sales/Upload only. HR has its own inline sync freshness. | yes |
| Keep NavBar global + HR inline | Upload freshness stays global. Two timestamps on HR page. | |
| Move both to page level | Remove from NavBar entirely. Each page shows its own. | |

**User's choice:** Contextual per tab
**Notes:** None

---

## Claude's Discretion

- Internal component naming, SyncStatusBar extraction, backend sync meta endpoint design, DashboardPage file renaming

## Deferred Ideas

None
