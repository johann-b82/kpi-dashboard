# Roadmap: KPI Light

## Milestones

- ✅ **v1.0 MVP** — Phases 1–3 (shipped 2026-04-11) — [archive](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 Branding & Settings** — Phases 4–7 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–3) — SHIPPED 2026-04-11</summary>

- [x] Phase 1: Infrastructure and Schema (2/2 plans) — completed 2026-04-10
- [x] Phase 2: File Ingestion Pipeline (4/4 plans) — completed 2026-04-10
- [x] Phase 3: Dashboard Frontend (4/4 plans) — completed 2026-04-11

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
Requirements: [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)
Audit: [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

</details>

### 🚧 v1.1 Branding & Settings (In Progress)

**Milestone Goal:** Make the app's corporate identity (logo, colors, app name, default language) editable via a new Settings page so teams can brand KPI Light without touching code.

- [ ] **Phase 4: Backend — Schema, API, and Security** - Security-gated backend foundation: settings table, API endpoints, SVG sanitization, and color validation
- [ ] **Phase 5: Frontend Plumbing — ThemeProvider and NavBar** - Settings consumed by the app: CSS var injection, NavBar brand slot, and FOUC mitigation
- [x] **Phase 6: Settings Page and Sub-components** - Full settings UI: color pickers, logo upload, live preview, Save, Reset, and unsaved-changes guard (completed 2026-04-11)
- [ ] **Phase 7: i18n Integration and Polish** - Language default persistence, translation keys, toast feedback, and Docker rebuild verification

## Phase Details

### Phase 4: Backend — Schema, API, and Security
**Goal**: A curl-testable settings API exists with security enforced at the persistence boundary — no logo or color value can be stored without passing sanitization and validation
**Depends on**: Phase 3 (v1.0 shipped stack)
**Requirements**: SET-02, SET-03, SET-04, BRAND-01, BRAND-02, BRAND-04, BRAND-09
**Success Criteria** (what must be TRUE):
  1. `GET /api/settings` returns a JSON object with all settings fields including `logo_updated_at` and `logo_url`
  2. `PUT /api/settings` with a color value containing `;` or `url(` returns HTTP 422 (CSS injection blocked)
  3. `POST /api/settings/logo` with a malicious SVG containing `<script>` stores a sanitized version (no script in retrieved bytes)
  4. `PUT /api/settings` with default values resets the singleton row and returns canonical defaults from `defaults.py`
  5. Logo survives `docker compose up --build` (stored as bytea in Postgres, not in container filesystem)
**Plans:** 6 plans
  - [x] 04-01-PLAN.md — Wave 0 deps + test harness scaffold (nh3, pytest stack, conftest)
  - [x] 04-02-PLAN.md — AppSettings model + defaults.py + Alembic migration with singleton seed
  - [x] 04-03-PLAN.md — Pydantic schemas + BRAND-09 strict oklch validator with unit tests
  - [x] 04-04-PLAN.md — Logo validation module (nh3 SVG sanitize, PNG magic bytes) with unit tests
  - [x] 04-05-PLAN.md — Settings router (4 handlers) + integration tests for success criteria 1–4
  - [x] 04-06-PLAN.md — Docker rebuild verification (criterion 5) + human checkpoint

### Phase 5: Frontend Plumbing — ThemeProvider and NavBar
**Goal**: The running app applies persisted settings on every load — NavBar shows the stored logo and app name, CSS variables reflect stored colors, and no default-brand flash occurs during the settings fetch
**Depends on**: Phase 4
**Requirements**: BRAND-03, BRAND-06
**Success Criteria** (what must be TRUE):
  1. On app load, a neutral skeleton is shown during the settings API call — no "KPI Light" default colors or name flash before stored settings apply
  2. The NavBar displays the stored logo (60×60 px, CSS-constrained) when one is set, and falls back to the stored app name text when no logo exists
  3. The stored app name replaces "KPI Light" in the NavBar and in the browser tab title on every page
  4. A "Settings" link appears in the NavBar and routes to `/settings`
**Plans:** 3 plans
  - [x] 05-01-PLAN.md — Data layer: defaults.ts, Settings type + fetchSettings, useSettings hook, locale keys
  - [x] 05-02-PLAN.md — ThemeProvider (skeleton + CSS var injection + document.title + error fallback), SettingsPage stub, App.tsx wiring
  - [x] 05-03-PLAN.md — NavBar brand slot (logo-or-text) + Settings gear icon + human verification checkpoint
**UI hint**: yes

### Phase 6: Settings Page and Sub-components
**Goal**: Users can open the Settings page and edit all branding properties — colors, logo, and app name — with live preview before committing, a save confirmation flow, and protection against accidental data loss
**Depends on**: Phase 5
**Requirements**: SET-01, BRAND-05, BRAND-07, BRAND-08, UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. User can navigate to `/settings` from the NavBar and see a page with color pickers, logo upload, and app name input
  2. Changing a color or app name updates the live UI immediately (before Save) without persisting to the database
  3. Clicking Save persists all draft changes and shows a success toast; a failed save shows an error toast and preserves the draft
  4. Each color picker shows a WCAG AA contrast badge warning for the 3 critical pairs (primary/primary-foreground, background/foreground, destructive/white) when contrast falls below 4.5:1
  5. Navigating away from Settings with unsaved changes shows a confirmation dialog; closing the browser tab triggers the `beforeunload` warning
**Plans:** 4/4 plans complete
  - [x] 06-01-PLAN.md — Foundation: deps (react-colorful, culori, @types/culori), shadcn input/label, api.ts fetchers (updateSettings, uploadLogo), lib/color.ts (hex↔oklch + wcagContrast)
  - [x] 06-02-PLAN.md — Hooks: useSettingsDraft (draft/snapshot/save/discard/reset with live preview via setQueryData) + useUnsavedGuard (beforeunload + document-capture click + popstate)
  - [x] 06-03-PLAN.md — Presentational sub-components: ColorPicker, ContrastBadge, LogoUpload + EN locale keys
  - [x] 06-04-PLAN.md — Assembly: ActionBar, ResetDialog, UnsavedChangesDialog, SettingsPage.tsx rewrite + human verification checkpoint
**UI hint**: yes

### Phase 7: i18n Integration and Polish
**Goal**: The stored default language is applied before any content renders, the Settings page is fully translated in DE and EN, and the end-to-end Docker stack is verified to survive a full image rebuild with branding intact
**Depends on**: Phase 6
**Requirements**: I18N-01, I18N-02
**Success Criteria** (what must be TRUE):
  1. User can select DE or EN as the app-wide default language from the Settings page and save it; the language persists across browser sessions and hard refreshes
  2. On app boot, `i18n.changeLanguage()` is called with the server-persisted language before any translated content renders — no language flash on hard refresh
  3. The Settings page UI (all labels, buttons, toasts, and dialog text) is fully translated in both DE and EN locale files
  4. After `docker compose up --build`, all persisted settings (logo, colors, app name, language) are intact — no data loss from image rebuild
**Plans:** 6 plans
  - [ ] 07-01-PLAN.md — Wave 0 infra: install requirements-dev.txt in api Dockerfile + @playwright/test + chromium
  - [x] 07-02-PLAN.md — i18n bootstrap: bootstrap.ts, main.tsx top-level await, i18n.ts lng fix, index.html splash
  - [ ] 07-03-PLAN.md — PreferencesCard + useSettingsDraft i18n extension + SettingsDraftContext + 4 new EN keys
  - [ ] 07-04-PLAN.md — NavBar LanguageToggle rewrite (useMutation, dirty-aware disable, full PUT payload)
  - [ ] 07-05-PLAN.md — Full DE translation pass (111 keys, informal du, loanwords, fix 2 pre-existing Sie strings)
  - [ ] 07-06-PLAN.md — Rebuild persistence harness (pytest seed/assert/cleanup + Playwright + smoke-rebuild.sh + human verify)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infrastructure and Schema | v1.0 | 2/2 | Complete | 2026-04-10 |
| 2. File Ingestion Pipeline | v1.0 | 4/4 | Complete | 2026-04-10 |
| 3. Dashboard Frontend | v1.0 | 4/4 | Complete | 2026-04-11 |
| 4. Backend — Schema, API, and Security | v1.1 | 0/6 | Not started | - |
| 5. Frontend Plumbing — ThemeProvider and NavBar | v1.1 | 0/3 | Not started | - |
| 6. Settings Page and Sub-components | v1.1 | 4/4 | Complete   | 2026-04-11 |
| 7. i18n Integration and Polish | v1.1 | 0/6 | Not started | - |
