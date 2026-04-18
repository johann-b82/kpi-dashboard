# Settings Walkthrough

`/settings` is the single configuration surface. Changes save via the sticky **Save** button in the ActionBar at the bottom of the page; nothing auto-commits. Reset-to-defaults wipes all custom values in one section.

## Appearance

Identity and brand controls live in a single **Appearance** card (merged from previous Identity + Colors cards in v1.10).

- **App name** — displayed in the NavBar. Default is "KPI Dashboard" as of Phase 30.1.
- **Logo** — upload a PNG (<512 KB) or SVG (<64 KB). The logo shows in the NavBar alongside the app name. Reset clears to default icon.
- **Color tokens** — 6-column row of color pickers for `primary`, `accent`, `background`, `foreground`, `destructive`, `success`. Accepts OKLCH, HSL, or hex. The theme live-previews at the top of the card without saving.

## HR

One HR card wraps two subsections:

### Personio
Credentials + sync interval + **Sync now** button. See [[Personio Sync Runbook]] for the full workflow.

### Sollwerte (targets)
Monthly attendance targets per department or role. Consumed by the [[HR Dashboard User Guide]] attendance + overtime charts as reference lines.

Multi-select filters (included departments, employment types, attendance types) live below Sollwerte — they determine which employees count toward HR KPIs.

## Global toggles (NavBar)

Not in `/settings` itself, but relevant:

- **Theme toggle** (sun / moon icon, top right) — light ↔ dark. Stored in localStorage.
- **Language toggle** (DE / EN segmented control) — stored in localStorage.
- **Back button** — context-aware: on `/settings` or `/upload`, returns to your last dashboard (Sales or HR).

## Reset sub-sections

Every section has a **Reset** link in its top-right. Reset writes default values for that section only — other sections are untouched. The action is immediate (no "Save" needed).

## Persistence

- Settings save to the `app_settings` singleton row via `PUT /api/settings`.
- Logo bytes are stored in the same row (`logo_data` column) — a full DB backup captures them.
- Color tokens apply on save by rewriting CSS variables; no page reload required.

See [[Admin Runbook]] for how to back up the Settings data with `pg_dump`.
