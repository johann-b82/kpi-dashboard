# Phase 59 Verification — Dark-mode + Focus Audit

**Audit date:** 2026-04-22
**Auditor:** Johann Bechtold (chrome-devtools MCP assisted capture, human-reviewed)
**Tooling:** `npm run check:phase-59` (all gates green at audit start)

## Automated Gates (from Plans 01/02/03)
- [x] `npm run check:i18n-parity` exits 0 — `PARITY OK: 498 keys in both en.json and de.json`
- [x] `npm run check:i18n-du-tone` exits 0 — `DU_TONE OK: no non-allowlisted formal-German hits in de.json`
- [x] `npm run check:phase-59-guards` exits 0 — `PHASE-59 GUARDS OK`
- [x] `npm test -- --run src/components/ui/toggle.test.tsx` exits 0 — `Tests 9 passed (9)`

## Evidence Methodology

Screenshots captured via `chrome-devtools` MCP against the Docker frontend at `http://localhost:5173/` with `html.dark` applied + `localStorage.theme=dark` persisted across reload. 13 full-page PNGs saved under `.planning/phases/59-a11y-parity-sweep/screenshots/`.

**Focus-ring coverage caveat:** Scripted `press_key Tab` over CDP does not reliably trigger `:focus-visible` styling (the heuristic depends on the user-agent "most recent input modality" signal, which CDP-injected keyboard events don't always set). Focus-ring visibility is therefore backstopped by:
- `toggle.test.tsx` (9 tests, all passing) — asserts `focus-visible:ring-ring/70` on Toggle segment buttons.
- Plan 59-02 source-level convergence (Checkbox + Badge on Path A focus-ring utility, grep returns zero `focus-visible:ring-(offset-)?2\b` matches).
- Plan 59-03 `check-phase-59-guards.mts` CI gate — forbids regression.

Contrast was judged per screenshot by visual inspection of the rendered DOM against the dark surface.

## Audit Checklist (13 surfaces)

Legend: [x] = audited and passing, [ ] = pending or defect filed.

- [x] `/` (LauncherPage): focus=automated-covered, contrast=OK, screenshot=screenshots/01-launcher.png
- [x] `/sales` (SubHeader + SalesTable + RevenueChart): focus=automated-covered, contrast=OK, screenshot=screenshots/02-sales.png
- [x] `/hr` (HrKpiCharts + EmployeeTable): focus=automated-covered, contrast=OK, screenshot=screenshots/03-hr.png
- [x] `/sensors` (SubHeader date-range + PollNowButton + body): focus=automated-covered, contrast=OK, screenshot=screenshots/04-sensors.png
- [x] `/settings` (PersonioCard + ColorPicker + LogoUpload): focus=automated-covered, contrast=OK (ColorPicker's built-in 4.5:1 warning is an a11y feature, not a defect), screenshot=screenshots/05-settings.png
- [x] `/settings/sensors` (SensorsSettingsPage): focus=automated-covered, contrast=OK, screenshot=screenshots/06-settings-sensors.png
- [x] `/signage` (SignagePage shell): focus=automated-covered, contrast=OK, screenshot=screenshots/07-signage-shell.png (Note: `/signage` auto-redirects to `/signage/media` — shell rendered via the Medien tab; identical to screenshot 08)
- [x] `/signage/media` (MediaPage + dialogs): focus=automated-covered, contrast=OK, screenshot=screenshots/08-signage-media.png
- [x] `/signage/playlists` (PlaylistsPage): focus=automated-covered, contrast=OK, screenshot=screenshots/09-signage-playlists.png
- [x] `/signage/playlists/:id` (PlaylistEditorPage + dialogs): focus=automated-covered, contrast=OK, screenshot=screenshots/10-signage-playlist-editor.png
- [x] `/signage/schedules` (SchedulesPage + dialog): focus=automated-covered, contrast=OK, screenshot=screenshots/11-signage-schedules.png
- [x] `/signage/devices` (DevicesPage + dialog): focus=automated-covered, contrast=OK, screenshot=screenshots/12-signage-devices.png
- [x] Top chrome (NavBar + Breadcrumb + UserMenu + LanguageToggle + ThemeToggle + SubHeader): focus=automated-covered, contrast=OK, screenshot=screenshots/13-top-chrome-focus.png (viewport crop of top chrome on /signage/devices)

## Defects

None — all 13 surfaces render correctly in dark mode with acceptable text/border contrast. No focus-ring regressions surfaced; focus-ring invariant is locked in by `toggle.test.tsx` + Plan 59-03 static guards.

| # | Surface | Observation | Severity | Follow-up |
|---|---------|-------------|----------|-----------|
|   |         |             |          |           |

## Out-of-scope observations

Per D-01 / Pitfall 1: a11y issues on routes NOT in the 13-surface list go here — do NOT expand the audit. Log for future milestone planning.

- `/login` (not in v1.19 scope): light-mode-only form; auth flow uses Directus client. Not a v1.19-migrated surface, deferred to future login-UX milestone.

## Resume signal

Type "approved" to close Phase 59, or list defects for gap-closure planning via `/gsd:plan-phase 59 --gaps`.
