---
phase: 05-frontend-plumbing-themeprovider-and-navbar
plan: 03
subsystem: frontend-navbar-brand
tags: [frontend, react, navbar, branding, a11y]
one_liner: "NavBar rewritten with mutually-exclusive logo-or-text brand slot reading from useSettings() and a right-side Settings gear icon as a styled wouter Link to /settings; human verification of all 4 Phase 5 success criteria passed."
requires:
  - frontend/src/hooks/useSettings.ts (Plan 05-01)
  - frontend/src/lib/defaults.ts (Plan 05-01 — DEFAULT_SETTINGS)
  - frontend/src/components/ThemeProvider.tsx (Plan 05-02 — gates rendering)
  - /settings route (Plan 05-02)
provides:
  - NavBar with logo-or-text brand slot (BRAND-03, BRAND-06)
  - Settings gear icon navigation link to /settings
affects:
  - Phase 6 Settings page UI (can rely on NavBar gear link existing)
  - Phase 7 i18n cleanup (nav.brand key removal from locale files — deferred per D-18)
tech-stack:
  added: []
  patterns:
    - "Styled wouter <Link> directly with Tailwind ghost-icon classes (no nested <Button> to avoid invalid <a><button>)"
    - "Brand fallback chain: useSettings().data ?? DEFAULT_SETTINGS"
    - "Mutually exclusive logo or text render — never both"
key-files:
  created: []
  modified:
    - frontend/src/components/NavBar.tsx
decisions:
  - "Gear icon rendered as a styled <Link> directly, not wrapped in shadcn Button, to avoid invalid <a><button> HTML (wouter Link already renders an <a>)"
  - "Logo constrained to max-h-14 max-w-14 object-contain inside h-16 bar so uploads never overflow the nav (BRAND-03)"
  - "Logo alt text = settings.app_name (not a translated literal) per UI-SPEC §Component Inventory"
  - "Gear active-route style uses text-primary only (no border-b underline) — icon-link variant deliberate vs text-link pattern"
  - "t('nav.brand') removed from NavBar source; locale JSON key preserved per D-18 (Phase 7 owns cleanup)"
metrics:
  duration: "~8min"
  completed: "2026-04-11"
  tasks_completed: 2
  files_created: 0
  files_modified: 1
requirements_touched: [BRAND-03, BRAND-06]
---

# Phase 5 Plan 03: NavBar Logo and Brand Summary

## One-liner

NavBar rewritten with mutually-exclusive logo-or-text brand slot reading from useSettings() and a right-side Settings gear icon as a styled wouter Link to /settings; human verification of all 4 Phase 5 success criteria passed.

## Purpose

Completes Phase 5 by delivering the visible brand surface: Success Criterion #2 (logo ~56×56 CSS-constrained with text fallback from stored app_name), the visible NavBar side of #3 (NavBar app_name reflects stored value), and #4 (Settings nav link to /settings). With the Wave 2 human-verify checkpoint, this plan also gates the entire phase for Phase 6 start.

## What Shipped

### Task 1 — NavBar rewrite (commit 139772e)

**Modified `frontend/src/components/NavBar.tsx`:**

- Imported `useSettings` from `@/hooks/useSettings`, `DEFAULT_SETTINGS` from `@/lib/defaults`, and `Settings as SettingsIcon` from `lucide-react` (aliased to avoid shadowing the route name / type).
- Added `const settings = data ?? DEFAULT_SETTINGS` fallback chain — safe because ThemeProvider gates rendering during `isLoading`, so by the time NavBar mounts `data` is defined (success path) or `error` + DEFAULT_SETTINGS is the active state.
- Brand slot: ternary on `settings.logo_url != null` renders either an `<img src={settings.logo_url} alt={settings.app_name} className="max-h-14 max-w-14 object-contain" />` or a `<span className="text-sm font-semibold">{settings.app_name}</span>`. Mutually exclusive — verified by the ternary structure, never both.
- Settings gear: rendered DIRECTLY inside a styled `<Link href="/settings">` with Tailwind classes equivalent to a shadcn ghost-icon button (`inline-flex items-center justify-center rounded-md p-2 hover:bg-accent/10 transition-colors`). No nested `<Button>` — wouter's `<Link>` already renders an `<a>`, so nesting a `<button>` would produce invalid `<a><button>` HTML.
- `aria-label={t("nav.settings")}` on the gear Link per UI-SPEC §Copywriting.
- Active-route treatment on the gear uses `text-primary` applied directly (no variant class conflict, no border-b — icon link is square, underline would look wrong).
- Right-side cluster order preserved: FreshnessIndicator → LanguageToggle → Settings gear.
- Layout primitives preserved verbatim: `fixed top-0 inset-x-0 h-16 bg-card border-b border-border z-50`, `max-w-7xl mx-auto px-6 h-full flex items-center gap-6`, right cluster `ml-auto flex items-center gap-4`.
- `t("nav.brand")` fully removed from the file; Dashboard and Upload links unchanged.

Verification: `cd frontend && npx tsc --noEmit` exit 0; all 18 grep acceptance criteria pass (brand slot, logo img, gear link, aria-label, no Button, layout preserved, no t("nav.brand")).

### Task 2 — Human verification checkpoint (APPROVED)

User manually verified all 4 Phase 5 success criteria in the browser and responded "approved":

1. **Neutral skeleton, no flash of old brand** — Hard-refresh showed centered spinner on neutral background with no brand text, then full app rendered.
2. **NavBar logo slot with upload + text fallback** — Uploaded PNG via `POST /api/settings/logo`, NavBar showed the image constrained inside the 64px bar. Reset via PUT; logo disappeared and "KPI Light" text returned.
3. **document.title mirrors stored app_name** — Browser tab title reflected the DB value; after PUT to "Test Brand" and refresh, both tab title and NavBar updated.
4. **/settings route** — Gear icon click navigated to /settings; stub page showed h1 + body copy; DevTools confirmed gear renders as a single `<a href="/settings">` wrapping `<svg>` (no nested button).

All 4 criteria visually verified. Phase 5 is complete and ready to hand off to Phase 6 (Settings Page UI).

## Deviations from Plan

None — plan executed exactly as written. Task 1 applied verbatim, Task 2 is a checkpoint with no implementation.

## Authentication Gates

None.

## Known Stubs

The `/settings` route still renders the SettingsPage stub introduced in Plan 05-02 (title + "available in Phase 6" paragraph). This is intentional — Phase 6 replaces the page body with real controls. The NavBar gear now exercises that route end to end.

No new stubs introduced by this plan.

## Integration Notes for Phase 6

- NavBar gear link already routes to `/settings`; Phase 6 only needs to replace the SettingsPage body.
- Brand rendering is data-driven via `useSettings()`; Phase 6 mutations should `queryClient.setQueryData(['settings'], draft)` (or invalidate the key) so both ThemeProvider and NavBar re-render with the new logo/app_name without a hard reload.
- The logo `<img>` uses the backend URL verbatim; backend cache-busts via `?v=<logo_updated_at>` (Phase 4 BRAND-04), so simply updating `logo_updated_at` in the settings cache is sufficient to force a new fetch.

## Commits

- `139772e` — feat(05-03): rewrite NavBar with logo-or-text brand slot and Settings gear link

## Self-Check: PASSED

- FOUND: frontend/src/components/NavBar.tsx (modified with brand slot + gear link)
- FOUND commit: 139772e
- TypeScript compiles clean (`npx tsc --noEmit` exit 0 — recorded during Task 1 verify)
- Human verification of Phase 5 success criteria: APPROVED
- Phase 5 plan sequence complete (3/3 plans done)
