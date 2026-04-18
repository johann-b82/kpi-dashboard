---
phase: 32-rebrand-login-ci
verified: 2026-04-16T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
re_verification: false
human_verification:
  - test: "Start app with docker compose up, navigate to login page (incognito or logged out). Verify logo renders above 'KPI Dashboard' title when a logo has been uploaded in Settings."
    expected: "Logo image appears centered above the 'KPI Dashboard' wordmark in the login card."
    why_human: "Logo rendering requires a running container with an uploaded logo; cannot verify blob URL resolution or image display programmatically."
  - test: "With no logo uploaded, open the login page."
    expected: "Only the 'KPI Dashboard' text title is shown — no broken image, no empty space."
    why_human: "Graceful degradation of the conditional img block requires a running UI with no logo stored."
  - test: "Compare login card visual styling against a Settings page card."
    expected: "Both cards show a white background, subtle border, and soft shadow. The 'Sign in' button is blue (primary accent)."
    why_human: "CSS visual match between pages requires browser rendering."
  - test: "After signing in, check the navbar brand text and the browser tab title."
    expected: "Navbar reads 'KPI Dashboard'; browser tab title reads 'KPI Dashboard'."
    why_human: "Navbar brand text is loaded dynamically from /api/settings (app_name field); final rendered value requires a running app."
---

# Phase 32: Rebrand + Login CI Verification Report

**Phase Goal:** Users see "KPI Dashboard" branding consistently and encounter a login page that matches the app's visual identity
**Verified:** 2026-04-16
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | "KPI Light" appears nowhere in the running application | VERIFIED | grep across all 8 modified files returns zero matches. No occurrences in backend/app/defaults.py, main.py, routers/settings.py, frontend/src/lib/defaults.ts, locales/en.json, locales/de.json, index.html, LoginPage.tsx |
| 2 | A public (unauthenticated) logo endpoint exists | VERIFIED | `public_router` defined without `dependencies=[Depends(get_current_user)]` at line 29 of settings.py; `get_logo_public` handler at line 313; `settings_public_router` imported and included in main.py lines 6 and 19 |
| 3 | Both DE and EN locale files read "KPI Dashboard" | VERIFIED | en.json line 28: `"nav.brand": "KPI Dashboard"`, line 131: `"settings.identity.app_name.placeholder": "KPI Dashboard"`; de.json line 28: `"nav.brand": "KPI Dashboard"`, line 131: `"settings.identity.app_name.placeholder": "KPI Dashboard"` |
| 4 | Login page fetches logo from public endpoint and conditionally renders it | VERIFIED | LoginPage.tsx: useEffect fetches `/api/settings/logo/public` (lines 40-57), creates object URL via `URL.createObjectURL`, sets `logoUrl` state; conditionally renders `<img>` only when `logoUrl` is non-null (lines 82-88) |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/defaults.py` | Updated default app_name | VERIFIED | Line 20: `"app_name": "KPI Dashboard"` |
| `backend/app/main.py` | Updated FastAPI title + public router wired | VERIFIED | Line 14: `FastAPI(title="KPI Dashboard")`; line 6 imports `public_router as settings_public_router`; line 19 includes it |
| `backend/app/routers/settings.py` | Public logo endpoint | VERIFIED | `public_router` at line 29 (no auth dependency); `get_logo_public` at line 313; returns logo bytes with `Cache-Control: public, max-age=300`; 304 ETag support; 404 when no logo |
| `frontend/src/lib/defaults.ts` | Updated default app_name | VERIFIED | Line 10: `app_name: "KPI Dashboard"` |
| `frontend/src/locales/en.json` | nav.brand and placeholder updated | VERIFIED | Line 28 and 131 both read "KPI Dashboard" |
| `frontend/src/locales/de.json` | nav.brand and placeholder updated | VERIFIED | Line 28 and 131 both read "KPI Dashboard" |
| `frontend/index.html` | Browser tab title | VERIFIED | Line 7: `<title>KPI Dashboard</title>` |
| `frontend/src/pages/LoginPage.tsx` | Logo fetch, conditional render, card styling | VERIFIED | 160 lines; contains useEffect logo fetch, URL.createObjectURL, conditional img, `border border-border shadow-sm` card class, no "KPI Light" |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| LoginPage.tsx | /api/settings/logo/public | fetch in useEffect + blob object URL | WIRED | Line 42: `fetch("/api/settings/logo/public")`; line 49: `URL.createObjectURL(blob)`; line 50: `setLogoUrl(revoke)`; cleanup revokes URL on unmount |
| main.py | public_router in settings.py | import + include_router | WIRED | Line 6: `from app.routers.settings import ... public_router as settings_public_router`; line 19: `app.include_router(settings_public_router)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| LoginPage.tsx | `logoUrl` state | `fetch("/api/settings/logo/public")` → blob → `URL.createObjectURL` | Yes — endpoint reads `row.logo_data` from DB via `_get_singleton` | FLOWING |
| settings.py `get_logo_public` | `row.logo_data` | `_get_singleton(db)` → `select(AppSettings).where(AppSettings.id == 1)` | Yes — DB query; returns raw bytes or 404 | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires a running Docker stack. The public endpoint and login page fetch are statically verified to be wired; runtime behavior delegated to human verification.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BRAND-01 | 32-01 | App name reads "KPI Dashboard" everywhere | SATISFIED | Zero grep hits for "KPI Light" in all 8 UI-surface files; defaults, locale keys, FastAPI title, browser tab all updated |
| BRAND-02 | 32-01, 32-02 | Login page shows uploaded logo above title | SATISFIED (automated) / NEEDS HUMAN (visual) | Public endpoint exists with no auth; LoginPage.tsx fetches and conditionally renders logo; visual confirmation requires running app |
| BRAND-03 | 32-02 | Login card styling matches app aesthetic | SATISFIED (code) / NEEDS HUMAN (visual) | Card className: `"w-full max-w-sm border border-border shadow-sm"` matches pattern described; visual match requires browser rendering |

No orphaned requirements — all three BRAND IDs from REQUIREMENTS.md are claimed by plans 32-01 and 32-02 and have implementation evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME/placeholder comments, no empty handlers, no stub returns found in any modified files.

### Human Verification Required

#### 1. Logo renders on login page

**Test:** Upload a logo via Settings, then open the login page in incognito or sign out.
**Expected:** The uploaded logo image appears centered above the "KPI Dashboard" wordmark inside the login card.
**Why human:** Blob URL creation and img rendering require a live browser against a running container.

#### 2. Text-only fallback when no logo is set

**Test:** Reset settings to remove the logo (or use a fresh DB), then open the login page.
**Expected:** The login card shows only the "KPI Dashboard" text — no broken image element, no visual gap.
**Why human:** The `{logoUrl && <img>}` conditional requires runtime state to be null.

#### 3. Card styling matches Dashboard/Settings pages

**Test:** Open the login page and compare visually to a Settings page card.
**Expected:** Same white background, subtle border, soft shadow, and blue primary "Sign in" button.
**Why human:** CSS rendering and visual consistency cannot be verified by static code analysis.

#### 4. Navbar + browser tab title post-login

**Test:** Sign in and inspect the navbar brand text and browser tab.
**Expected:** Navbar reads "KPI Dashboard" (from app_name setting); tab title reads "KPI Dashboard" (from index.html).
**Why human:** Navbar brand is rendered from the /api/settings response; confirming it shows the updated value requires a running app.

### Gaps Summary

No gaps found. All automated checks pass. The phase goal is satisfied at the code level — all "KPI Light" references replaced, the public logo endpoint is properly wired without authentication, both locale files updated, and LoginPage.tsx implements the full logo-fetch-and-display flow with the correct card styling. The four human verification items are confirmation checks for visual/runtime behavior, not blockers to goal achievement.

---

_Verified: 2026-04-16_
_Verifier: Claude (gsd-verifier)_
