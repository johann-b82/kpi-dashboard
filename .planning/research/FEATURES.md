# Feature Research

**Domain:** Corporate-identity / white-label settings page for an internal B2B ERP dashboard
**Milestone:** v1.1 Branding & Settings
**Researched:** 2026-04-11
**Confidence:** HIGH for table stakes (established patterns, verified against real shadcn/Tailwind v4 CSS var structure in codebase); MEDIUM for differentiators (opinion-dependent); HIGH for anti-features (scope decisions explicitly set in PROJECT.md)

---

## Context: What Already Exists

v1.0 shipped these components relevant to v1.1:
- `NavBar.tsx` — hardcoded brand name via `t("nav.brand")` key (`"KPI Light"` in locales)
- `index.css` — full shadcn/Tailwind v4 CSS variable palette using OKLCH color space: `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`, plus chart and sidebar tokens
- `i18n.ts` — hardcoded `lng: "de"` default, no `i18next-browser-languageDetector` installed, flat key convention with `keySeparator: false`
- `App.tsx` — two routes via wouter (`/` and `/upload`); a `/settings` route is a pure addition
- No `document.title` management yet — browser tab shows static Vite default

**Critical constraint:** CSS variables use OKLCH color space (not hex), which is a Tailwind v4 default. Any color picker must convert hex/RGB input to OKLCH for storage and injection, or store hex and inject as hex (overriding the OKLCH defaults). Hex injection into `:root` via `document.documentElement.style.setProperty()` works regardless of the CSS file's color space — the browser accepts any valid color value for a CSS custom property.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that must exist for v1.1 to feel complete. Missing any of these = the milestone is not done.

| Feature | Why Expected | Complexity | User-Capability Phrasing |
|---------|--------------|------------|--------------------------|
| Settings page reachable from top-nav | Standard pattern in every admin panel — users look for a gear icon or "Settings" link in the nav | LOW | User can navigate to Settings from the top navigation bar |
| App name / brand label editing | The primary white-label act; "KPI Light" must be replaceable without touching code | LOW | User can rename the application (replaces "KPI Light" wherever the brand label appears) |
| Primary color editing (hex input) | Minimum viable CI customization — one brand color changes the whole app feel | MEDIUM | User can set a brand primary color using a hex code input |
| Logo upload (PNG/SVG, max 1 MB) | Logos are the most visible CI element; internal teams always want their company mark in the header | MEDIUM | User can upload a PNG or SVG logo that replaces the text brand label in the header |
| Logo preview before save | Users must confirm they uploaded the right file before it goes live — standard UX for image uploads | LOW | User sees a preview of the uploaded logo before committing the change |
| Save action with explicit confirmation | Settings changes must not auto-apply permanently — users need a deliberate commit step | LOW | User can save all settings changes with a single Save button; unsaved changes do not persist across sessions |
| Reset to defaults | Users will inevitably break their color palette or want to undo; a reset escape hatch is expected | LOW | User can reset all branding settings to the factory defaults in one action |
| Default UI language (DE/EN) | The app currently hardcodes `lng: "de"` — making this editable is the natural v1.1 completion of the i18n work already done | LOW | User can set the default application language (German or English) for all sessions |
| Live preview while editing | Industry standard for settings pages with visual impact — users expect to see color and logo changes reflected immediately without saving | MEDIUM | User sees a live preview of theme changes (colors, logo, name) reflected in the app header while editing, before saving |
| Unsaved-changes warning on navigation | Without this, users lose edits when clicking away — basic data-integrity expectation | LOW | User is warned before navigating away from Settings with unsaved changes |

### Differentiators (Nice-to-Have, Worth Scoping Discussion)

| Feature | Value Proposition | Complexity | Recommendation |
|---------|-------------------|------------|----------------|
| Contrast ratio hint on primary color | Shows WCAG 4.5:1 pass/fail inline next to the color picker — prevents users from picking a color that makes text unreadable | MEDIUM | Include in v1.1 — low surface area, prevents real UX damage. A single pass/fail badge against white/black background is sufficient; full APCA audit is overkill. |
| Full semantic color palette editing (all shadcn tokens) | Allows deep CI customization — background, foreground, muted, destructive, border, ring | HIGH | Defer to v1.2 or make it an advanced/expandable section within v1.1 Settings. Starting with just `--primary` reduces complexity while delivering 80% of the CI value. |
| Color palette swatches / preset themes | Offer 3–5 preset palettes (e.g., "Corporate Blue", "Forest Green", "Neutral") — users who don't know brand hex codes benefit | LOW | Include in v1.1 as 4–6 hardcoded swatch buttons feeding the hex input. Zero backend cost; high perceived polish. |
| Logo drag-and-drop | The v1.0 file upload already has drag-and-drop; users will expect it in logo upload too for consistency | LOW | Include in v1.1 — reuse the existing `DropZone` component pattern. |
| App name reflected in browser tab title | `document.title` is trivially updated via `useEffect` on the stored app name; users notice when the tab still says "Vite App" | LOW | Include in v1.1 — 5 lines of code, high perceived quality signal. |

### Anti-Features (Explicitly Excluded — Document the Reasoning)

| Feature | Why It Seems Appealing | Why Excluded from v1.1 | What to Do Instead |
|---------|------------------------|------------------------|---------------------|
| Per-user CI / per-session theme | Some tools let each user set their own colors | No auth, no user identity — single global CI is the correct model for v1.1's pre-auth architecture | Global instance-wide settings only; revisit after Authentik (v2) |
| Admin-only settings gating | Prevents random team members from changing the brand | Would require pulling Authentik (auth) work forward into v1.1 | Any user can edit; document this as a known limitation to be addressed in v2 |
| Dark mode / light mode toggle | Users often expect a theme toggle in settings | The CSS already has a `.dark` class variant defined in `index.css`, but there's no toggle yet and the scope question (per-user vs global?) requires auth to answer properly | Defer dark mode toggle to after auth; it's a per-user preference, not a CI setting |
| Full OKLCH-native color picker | OKLCH is perceptually uniform and maps directly to the CSS variable format used in `index.css` | OKLCH color pickers are not widely understood by non-designers; implementing conversion is extra complexity | Accept hex input; convert to OKLCH at runtime via CSS `color()` function or store as hex and inject directly into CSS custom properties — both work in modern browsers |
| HSL slider color picker | HSL looks intuitive but is perceptually non-uniform — saturation/hue changes affect perceived brightness in unexpected ways, which is particularly bad for WCAG contrast checking | Would create false confidence in accessibility; users think only the lightness slider affects contrast | Hex input with contrast ratio hint is simpler and more honest |
| Real-time persistence (auto-save) | Some tools save every keystroke | For settings with visual impact (colors, logo) auto-save creates a jarring live-production-edit experience | Explicit Save button only; live preview is in-memory only until saved |
| Per-field reset buttons | "Reset this field only" is a UX nicety | Adds significant UI complexity for a settings page with few fields; users can reset all or manually retype | Single "Reset to defaults" button for the whole form |
| Logo stored as bytea in PostgreSQL | Storing binary in DB is one valid approach | Binary blobs inflate DB backup size, complicate migrations, and are not cacheable by the browser without custom endpoints | Store as file path (uploaded to a volume-mounted directory); serve via a static file route from FastAPI. This is the standard pattern for user-uploaded assets in Dockerized apps. |
| Font selection / typography settings | Some white-label tools include font pickers | Scope creep for v1.1; font loading is complex (FOUC, variable fonts, fallback stacks) | Geist Variable is already configured and looks professional; lock it for now |
| Custom CSS / code editor | Power users want to inject arbitrary CSS | Security risk in a shared internal tool; no auth to gate it | Expose the semantic tokens only |

---

## Feature Dependencies

```
Settings page route (/settings)
  └──requires──> NavBar link to /settings

App name editing
  └──requires──> Settings page route
  └──enhances──> Browser tab title update (document.title)
  └──enhances──> nav.brand i18n key resolved from DB, not locale file

Logo upload
  └──requires──> File storage pattern (volume-mounted dir + FastAPI static route)
  └──requires──> Logo preview component
  └──enhances──> Header logo replaces text brand label when logo present

Primary color editing
  └──requires──> Hex input component
  └──enhances──> Contrast ratio hint (WCAG badge)
  └──requires──> CSS var injection: document.documentElement.style.setProperty('--primary', value)
  └──enhances──> Color preset swatches (feed the hex input, no additional storage)

Live preview
  └──requires──> In-memory draft state (separate from persisted state)
  └──requires──> CSS var injection for color live preview
  └──requires──> Logo preview via object URL (URL.createObjectURL before upload)
  └──note──> No debounce needed for swatch selection; debounce only hex text input (300ms typical)

Save flow
  └──requires──> Settings API endpoint (POST /api/settings)
  └──requires──> New `settings` table via Alembic migration
  └──requires──> TanStack Query mutation + queryKey invalidation

Unsaved-changes warning
  └──requires──> wouter's navigation event (use beforeunload for tab close; wouter has no built-in route guard — handle with a confirmation dialog triggered before Link navigation)

Default language setting
  └──requires──> i18n.changeLanguage() call on app load when DB setting differs from current lng
  └──note──> i18n.ts currently hardcodes `lng: "de"`; replace with value fetched from settings API on init
  └──note──> i18next-browser-languageDetector is NOT installed — no conflict to resolve; just call i18n.changeLanguage() after fetching settings
```

---

## MVP Definition

### v1.1 Launch With (Table Stakes + Selected Differentiators)

- [ ] Settings route (`/settings`) reachable from NavBar gear icon or text link — why: no entry point = feature is invisible
- [ ] App name input — user can rename "KPI Light" to their company's tool name; updates `t("nav.brand")` equivalent in the header and `document.title` — why: primary white-label act
- [ ] Logo upload (PNG/SVG, ≤1 MB, click-to-upload + drag-and-drop) with client-side preview before save — why: most visible CI element
- [ ] Primary color hex input with live CSS variable injection into `:root` — why: single color change transforms app feel with minimal complexity
- [ ] Contrast ratio badge (WCAG AA pass/fail for text on primary color) — why: prevents accessibility regressions; very low implementation cost
- [ ] Color preset swatches (4–6 options) — why: zero backend cost; helps users without brand hex codes
- [ ] Default UI language toggle (DE / EN) — why: completes the i18n work; currently hardcoded in `i18n.ts`
- [ ] Save button (explicit commit of all changes to DB) — why: settings are meaningless without persistence
- [ ] Reset to defaults button — why: escape hatch; prevents users from getting stuck with a broken palette
- [ ] Unsaved-changes warning modal when navigating away — why: prevents silent data loss

### Add After v1.1 Validation (v1.x)

- [ ] Full semantic color palette editing (background, foreground, muted, destructive, border, ring) — trigger: user feedback that primary color alone isn't enough customization
- [ ] Dark mode toggle — trigger: after auth (v2) enables per-user preference; or as a global setting if demand exists

### Future / v2+

- [ ] Per-user theme preferences — requires Authentik auth (user identity)
- [ ] Admin-only gating for settings edits — requires Authentik roles (RBAC)
- [ ] Font selection — low demand vs high complexity; defer indefinitely

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Settings route + NavBar link | HIGH | LOW | P1 |
| App name editing | HIGH | LOW | P1 |
| Browser tab title update | MEDIUM | LOW | P1 |
| Logo upload + preview | HIGH | MEDIUM | P1 |
| Primary color hex input + live preview | HIGH | MEDIUM | P1 |
| Contrast ratio WCAG badge | MEDIUM | LOW | P1 |
| Color preset swatches | MEDIUM | LOW | P1 |
| Default language setting (DE/EN) | HIGH | LOW | P1 |
| Save / Reset flows | HIGH | LOW | P1 |
| Unsaved-changes warning | MEDIUM | LOW | P1 |
| Full semantic palette editing | MEDIUM | HIGH | P2 |
| Dark mode toggle | MEDIUM | MEDIUM | P3 (post-auth) |
| Per-user CI | LOW (for v1 scope) | HIGH | P3 (post-auth) |

**Priority key:** P1 = v1.1 scope, P2 = v1.2 candidate, P3 = v2+

---

## Implementation Notes by Feature Area

### 1. Settings Page Layout

**Recommendation: Single-page form with section headers, not tabbed.**

Rationale: The settings surface is small (5–7 fields total). Tabs add navigation overhead that only pays off with 4+ distinct setting categories. B2B admin panels use tabs for large surfaces (Billing, Security, Integrations, Team, etc.). For this scope, a vertical single-form layout with visual section dividers ("Branding", "Appearance", "Language") is the correct pattern. This mirrors how tools like Linear, Vercel dashboard, and Metabase handle small settings pages.

NavBar placement: Add "Settings" as a link in the right side of the NavBar (next to LanguageToggle). A gear icon + "Settings" text is conventional. Use wouter `<Link href="/settings">`.

### 2. Color Editing UX

**Recommendation: Hex text input + preset swatches + WCAG contrast badge. No HSL sliders.**

Hex input is universal — every brand guideline document lists hex codes. HSL sliders are counterintuitive for accessibility (perceived lightness is non-linear in HSL). OKLCH is even less familiar to non-designers.

Live preview: `document.documentElement.style.setProperty('--primary', hexValue)` injects directly into the `:root` computed style, overriding the CSS file value immediately without a re-render. This is the standard shadcn live-theming pattern (used by tweakcn, shadcn's own theme generator). No React context re-render needed for the color change itself — only the draft state needs to live in React state.

Debounce strategy: Debounce hex input at 300ms so CSS var injection doesn't fire on every keystroke. Swatches fire immediately (no debounce needed — one discrete selection).

WCAG contrast badge: Calculate contrast ratio between the hex primary and white (`#ffffff`) and black (`#000000`) using the WCAG luminance formula (no library needed — it's 10 lines of JavaScript). Show "AA Pass" (≥4.5:1 for normal text) or "AA Fail" inline next to the input.

Dark/light mode interaction: v1.1 has no dark mode toggle. The `.dark` class in `index.css` defines separate `--primary` values, but since no toggle exists yet, only the `:root` (light) values need to be written. Injecting via `document.documentElement.style.setProperty` sets an inline style that takes precedence over both `:root` and `.dark` selectors — this is acceptable for v1.1. When dark mode is eventually added, the settings model will need two color values per token (one for light, one for dark).

### 3. Logo Upload UX

**Recommendation: Drag-and-drop zone (reuse DropZone pattern) + click fallback. Preview via object URL. Store as file path on disk, not bytea.**

Accept PNG and SVG only. 1 MB client-side size limit before upload. Reject other formats with an inline error message (same pattern as upload page).

Preview: Use `URL.createObjectURL(file)` to show an immediate in-browser preview in a 60×60 container before the file is sent to the backend. No server round-trip needed for preview — the object URL is revoked on save or discard.

Replace vs reset: The logo state has three states — (a) no logo uploaded (show text brand label), (b) pending new logo (preview shown, not saved), (c) saved logo (served from backend). "Reset logo" removes the saved logo and reverts to text label. "Replace" is just uploading a new file while a saved logo exists — the new preview replaces the old preview in the UI; save overwrites the stored file.

Storage: FastAPI serves static files from a volume-mounted directory (`/app/static/logos/` or similar). This is the standard Docker pattern — simpler than bytea, browser-cacheable, no custom streaming endpoint needed. The settings table stores the relative path or filename.

### 4. Live Preview Pattern

**Recommendation: React state for draft values + CSS var injection for colors + object URL for logo preview. No full app re-render.**

The draft state lives in a `useState` hook in the Settings page. On every change:
- Colors → `document.documentElement.style.setProperty('--primary', draftColor)` (direct DOM mutation, no React re-render of the whole tree)
- Logo → object URL set on an `<img>` in the preview component
- App name → update `document.title` and the header brand label via a React context or by re-rendering the NavBar with a prop

On discard: revert CSS var injection from saved values (`document.documentElement.style.removeProperty('--primary')` or re-inject saved value), revoke object URL, restore draft to saved.

On save: POST to `/api/settings`, on success invalidate the settings query (TanStack Query), the CSS var injection becomes the persisted state on next load.

### 5. Save / Discard / Reset Flows

**Recommendation: Explicit Save button + "Discard changes" link + "Reset to defaults" button (in a danger zone section or with a confirmation modal).**

Unsaved-changes warning: wouter does not have a built-in route guard (`<Prompt>` equivalent). Handle by: (a) blocking browser tab close/refresh with `beforeunload` event when `isDirty` is true, and (b) intercepting NavBar link clicks to show a confirmation dialog ("You have unsaved changes. Leave without saving?") when `isDirty`. A shadcn `<Dialog>` component is already in the codebase for this. The dialog uses "Leave" / "Stay" (not "OK" / "Cancel") per UX best practices for action clarity.

Reset to defaults: Show a confirmation dialog before resetting. Reset resets the draft AND (if confirmed) immediately saves defaults to the backend so the reset is persistent. A "Reset" that only resets the draft but not the DB is confusing.

Per-field reset: Excluded (see anti-features). Single global reset is sufficient for this settings surface.

### 6. App Name / Title Editing

**Surfaces where app name appears:**
- NavBar brand label (currently `t("nav.brand")` → `"KPI Light"`)
- Browser tab title (`document.title` — currently Vite default, not yet managed)

**Not in scope for v1.1:** PDF export (not a v1 feature). Per-page title suffixes (e.g., "KPI Light | Dashboard") are a v1.2 nicety — for now, a single document.title = appName is sufficient.

Implementation: Store app name in the settings table. On app load, fetch settings and call `document.title = settings.appName`. The NavBar brand label reads from settings context, not from the i18n `nav.brand` key. The i18n key can remain as a fallback if no app name is set.

### 7. Default Language Interaction

**Current state:** `i18n.ts` hardcodes `lng: "de"`. No `i18next-browser-languageDetector` is installed. Users manually toggle via `LanguageToggle` component (which presumably calls `i18n.changeLanguage()`), but that choice is lost on page reload.

**v1.1 behavior:** The settings-stored default language is the app-wide default. On app init, fetch settings and call `i18n.changeLanguage(settings.defaultLanguage)` before rendering. The LanguageToggle remains functional for per-session override (calls `i18n.changeLanguage()` without writing to the DB — session-only).

**Interaction model:** DB setting = instance default (what new sessions start with). LanguageToggle = per-session override (not persisted). This is the correct model for a pre-auth single-instance app. Do not install `i18next-browser-languageDetector` — it adds localStorage caching that would conflict with the DB setting without additional configuration.

---

## Competitor / Reference Pattern Analysis

| Pattern | Reference | Our Approach |
|---------|-----------|--------------|
| Settings as single-page form | Linear, Vercel dashboard (small settings surfaces) | Single vertical form with section headers |
| Live color preview via CSS vars | tweakcn.com, shadcn theme generator | Same pattern — `document.documentElement.style.setProperty` |
| Logo upload with preview | Slack workspace settings, Notion workspace settings | Click + drag-drop zone; object URL preview; save to disk |
| Unsaved changes modal | AWS Cloudscape design system, GitHub settings | shadcn Dialog with "Leave" / "Stay" actions |
| WCAG contrast badge | Figma color picker, Material Design color tool | Inline badge next to hex input |
| Explicit save (not auto-save) | All major admin settings pages (explicit save for config) | Save button; autosave explicitly excluded |

---

## Sources

- shadcn/ui theming and CSS variables: https://ui.shadcn.com/docs/theming
- Tailwind v4 shadcn integration: https://ui.shadcn.com/docs/tailwind-v4
- tweakcn visual theme editor (live CSS var preview reference): https://tailkits.com/tools/tweakcn/
- Cloudscape unsaved-changes pattern: https://cloudscape.design/patterns/general/unsaved-changes/
- GitHub Primer saving patterns: https://primer.style/product/ui-patterns/saving/
- LogRocket tabs UX: https://blog.logrocket.com/ux-design/tabs-ux-best-practices
- NNGroup tabs used right: https://www.nngroup.com/articles/tabs-used-right/
- i18next configuration options: https://www.i18next.com/overview/configuration-options
- i18next-browser-languageDetector detection order: https://deepwiki.com/i18next/i18next-browser-languageDetector/4.1-detection-order-and-caching
- React dynamic document.title: https://react.dev/reference/react-dom/components/title
- Josh W. Comeau on CSS variables in React: https://www.joshwcomeau.com/css/css-variables-for-react-devs/
- WCAG contrast ratios: https://webaim.org/resources/contrastchecker/
- Sidebar UX best practices: https://uxplanet.org/best-ux-practices-for-designing-a-sidebar-9174ee0ecaa2
- File upload UX best practices: https://uploadcare.com/blog/file-uploader-ux-best-practices/

---
*Feature research for: KPI Light v1.1 Branding & Settings*
*Researched: 2026-04-11*
