# Phase 32: Rebrand & Login CI - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Rename the app from "KPI Light" to "KPI Dashboard" across all user-visible surfaces (navbar, login, browser tab, i18n strings, settings default, FastAPI docs). Restyle the login page to show the uploaded logo and match the app's card aesthetic. No package/repo rename. No new features.

</domain>

<decisions>
## Implementation Decisions

### Logo on Login Page
- **D-01:** Add a new public (unauthed) endpoint `GET /api/settings/logo/public` that returns the logo image. Login page fetches this to display the logo above the title.
- **D-02:** If no logo has been uploaded, show only the "KPI Dashboard" text title — no placeholder icon.

### Login Card Restyling
- **D-03:** Minimal tweaks only — ensure border, shadow, and accent color tokens match the existing app card aesthetic (Settings/Dashboard pages). No layout overhaul, no background gradients.

### Rename Strategy
- **D-04:** Rename "KPI Light" → "KPI Dashboard" in ALL locations including FastAPI `title=` parameter (shows in /docs page).
- **D-05:** Do NOT touch old Alembic migration (`b2c3d4e5f6a7`). Change the default in `backend/app/defaults.py` only. Existing DB installs already have their own `app_name` value; new installs pick up the updated default.

### Claude's Discretion
- Card restyling details (exact border-radius, shadow values) — match what Dashboard/Settings cards already use.
- Public logo endpoint implementation details (response headers, caching, 404 handling when no logo exists).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Branding requirements
- `.planning/REQUIREMENTS.md` — BRAND-01, BRAND-02, BRAND-03 acceptance criteria

### Login page (current implementation)
- `frontend/src/pages/LoginPage.tsx` — Current login card with hardcoded "KPI Light" wordmark
- `frontend/src/auth/useAuth.ts` — Auth hook used by login page

### "KPI Light" occurrences (all files to change)
- `frontend/src/pages/LoginPage.tsx` — Hardcoded wordmark + comment
- `frontend/src/lib/defaults.ts` — `app_name: "KPI Light"` default
- `frontend/src/locales/en.json` — `nav.brand` and `settings.identity.app_name.placeholder`
- `frontend/src/locales/de.json` — `nav.brand` and `settings.identity.app_name.placeholder`
- `backend/app/defaults.py` — `app_name: "KPI Light"` default
- `backend/app/main.py` — `FastAPI(title="KPI Light")`
- `frontend/index.html` — `<title>frontend</title>` (update to "KPI Dashboard")

### Settings/logo infrastructure
- `frontend/src/lib/api.ts` — Settings interface with `logo_url`, `app_name`
- `frontend/src/components/ThemeProvider.tsx` — Sets `document.title = settings.app_name`
- `frontend/src/lib/defaults.ts` — DEFAULT_SETTINGS with app_name

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Card`, `CardHeader`, `CardContent` from shadcn/ui — already used on login page
- `ThemeProvider` already sets `document.title` from `settings.app_name` — authed pages auto-update
- Logo upload/fetch infrastructure exists in Settings page and API

### Established Patterns
- Unauthed pages don't call `/api/settings` (login page pattern from Phase 29)
- All user-facing strings go through i18n (`en.json`, `de.json`) with `nav.brand` key
- Card styling uses Tailwind utility classes + CSS variable tokens (dark mode compatible)

### Integration Points
- Backend: new public logo endpoint alongside existing `/api/settings/logo`
- Frontend: `LoginPage.tsx` needs to fetch logo from new public endpoint
- `index.html` `<title>` tag — static, not dynamic (only changes at build/deploy time)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for the restyling. Requirements doc explicitly states: "clean white cards, subtle border/shadow, blue accent button" as the target aesthetic.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 32-rebrand-login-ci*
*Context gathered: 2026-04-16*
