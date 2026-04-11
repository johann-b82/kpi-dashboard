# Requirements — KPI Light v1.1 Branding & Settings

**Milestone:** v1.1 Branding & Settings
**Started:** 2026-04-11
**Goal:** Make the app's corporate identity (logo, colors, app name, default language) editable via a new Settings page so teams can brand KPI Light without touching code.

---

## v1.1 Requirements

### Settings Infrastructure

- [x] **SET-01**: User can navigate to a dedicated Settings page via a top-nav link
- [x] **SET-02**: All settings persist in PostgreSQL via a new `app_settings` singleton table (Alembic migration)
- [x] **SET-03**: Backend exposes `GET /api/settings` and `PUT /api/settings` with Pydantic validation (color format, language enum, size/type constraints)
- [x] **SET-04**: User can click "Reset to defaults" to revert all settings to canonical values defined in `backend/app/defaults.py`

### Branding (Corporate Identity)

- [x] **BRAND-01**: User can upload a logo (PNG or SVG only, max 1 MB) from the Settings page
- [x] **BRAND-02**: Uploaded SVG logos are sanitized server-side via `nh3` before persistence (no `<script>`, no `on*` handlers, strict element/attribute allowlist)
- [x] **BRAND-03**: The logo is displayed in the top-left of every page at 60×60 px (CSS-constrained; original preserved); fallback to app name text if no logo set
- [x] **BRAND-04**: Logo URL includes a cache-busting query param derived from `logo_updated_at` so browser caches never show a stale logo after upload
- [x] **BRAND-05**: User can edit all 6 semantic color tokens (primary, accent, background, foreground, muted, destructive) via hex color inputs; values are converted to oklch before API submission
- [x] **BRAND-06**: User can edit the app name; the new name replaces "KPI Light" in the top-nav header AND in the browser tab title (`document.title`)
- [x] **BRAND-07**: While editing, theme changes (colors, logo, app name) reflect instantly as a live preview via CSS variable injection on `:root`; changes only persist after explicit Save
- [x] **BRAND-08**: Color inputs show a WCAG AA contrast badge (warn, do not block) for the 3 critical pairs: primary/primary-foreground, background/foreground, destructive/white
- [x] **BRAND-09**: Backend validates color strings against a strict oklch/hex regex (rejecting `;`, `}`, `{`, `url(`, `expression(`, quotes) to prevent CSS injection

### i18n Default Language

- [ ] **I18N-01**: User can set the app-wide default language (DE or EN) from the Settings page
- [x] **I18N-02**: On app boot, the ThemeProvider fetches settings and calls `i18n.changeLanguage(default_language)` before the first render (no `i18next-browser-languageDetector`); server-persisted value is the single source of truth

### UX Safety & Polish

- [x] **UX-01**: Attempting to navigate away from the Settings page with unsaved changes shows a confirmation dialog (existing shadcn Dialog); `beforeunload` handler covers browser tab close
- [x] **UX-02**: Save action shows a success or error toast using the v1.0 toast infrastructure; failed saves preserve the draft state

---

## Out of Scope (Deferred)

### Deferred to v2 (requires Authentik/auth)
- **Admin-only settings gating** — v1.1 allows any user to edit; admin roles require auth (v2)
- **Per-user CI customization** — needs user identity; v1.1 is global-single-CI

### Deferred to v1.2+ (scope/complexity)
- **Dark mode toggle** — per-user preference, requires auth for per-user scoping
- **Font selection** — FOUC complexity, low demand
- **Color preset swatches** — user can paste/type hex directly; swatches are convenience polish
- **Logo reset/remove button** — user can re-upload to replace; explicit clear deferred
- **Optimistic concurrency on settings PUT** — low-value in a single-team internal app; last-write-wins acceptable for v1.1

### Deferred from v1.0 candidates (still future)
- **Authentik integration** (AUTH-01) — v2
- **Period-over-period deltas on KPI cards** (DASH-06) — v1.2+
- **Export filtered data as CSV** (DASH-07) — v1.2+
- **Duplicate upload detection** (UPLD-07) — v1.2+
- **Per-upload drill-down view** (DASH-08) — v1.2+

### Explicitly excluded (anti-features)
- **JPG/GIF/WebP logo formats** — PNG/SVG only by design (vector crispness + bitmap fallback)
- **HSL color sliders** — perceptually non-uniform, misleading for contrast work; hex is universal
- **localStorage language caching** — fights server-persisted default; `i18next-browser-languageDetector` excluded
- **Dynamic default drift** — if code defaults change, existing user-customized settings are untouched; reset always uses current canonical defaults

---

## Traceability

| REQ-ID | Phase | Notes |
|--------|-------|-------|
| SET-01 | Phase 6 | Settings page nav link — delivered as part of SettingsPage |
| SET-02 | Phase 4 | `app_settings` singleton table via Alembic migration |
| SET-03 | Phase 4 | GET/PUT /api/settings with Pydantic validation |
| SET-04 | Phase 4 | Reset endpoint wired to `defaults.py` canonical values |
| BRAND-01 | Phase 4 | Logo upload endpoint (POST /api/settings/logo); PNG/SVG, 1 MB limit |
| BRAND-02 | Phase 4 | nh3 SVG sanitization in logo POST handler — security gate |
| BRAND-03 | Phase 5 | NavBar logo slot (60×60 px) + text fallback |
| BRAND-04 | Phase 4 | `logo_updated_at` column + ETag; URL cache-busting strategy |
| BRAND-05 | Phase 6 | ColorPicker component — 6 semantic tokens, hex→oklch via culori |
| BRAND-06 | Phase 5 | NavBar app name from `useSettings()` hook + `document.title` |
| BRAND-07 | Phase 6 | Live preview via `previewSettings()` + explicit Save wiring in SettingsPage |
| BRAND-08 | Phase 6 | WCAG AA contrast badge in ColorPicker for 3 critical pairs |
| BRAND-09 | Phase 4 | Pydantic `@field_validator` strict regex on color fields |
| I18N-01 | Phase 7 | Language select in SettingsPage wired to PUT + `i18n.changeLanguage()` |
| I18N-02 | Phase 7 | ThemeProvider calls `changeLanguage(default_language)` before first render |
| UX-01 | Phase 6 | Unsaved-changes Dialog + `beforeunload` handler in SettingsPage |
| UX-02 | Phase 6 | Success/error toast on Save using v1.0 toast infrastructure |

---

*Last updated: 2026-04-11 — v1.1 roadmap created; traceability populated*
