# Research Summary — KPI Light v1.1 Branding & Settings

**Project:** KPI Light
**Domain:** Runtime corporate-identity theming + settings persistence for a Dockerized internal ERP dashboard
**Researched:** 2026-04-11
**Confidence:** HIGH

---

## Executive Summary

KPI Light v1.1 adds a Settings page where teams can brand the app (logo, colors, app name, default language) without touching code. This is a well-trodden problem: a singleton settings table in the existing PostgreSQL database, a React context that fetches settings on boot and injects CSS custom properties at runtime, and a new `/settings` route. The v1.0 stack handles all of it — the only new dependency is `nh3==0.3.3` for server-side SVG sanitization. Every other v1.1 feature (runtime theming, logo serving, language switching, live preview, save/reset flows) is implementable with already-installed libraries.

The recommended approach builds in four sequential phases: backend schema + API, frontend plumbing (ThemeProvider + NavBar wiring), the SettingsPage UI + sub-components, and finally i18n integration + polish. This order is forced by dependency: the Alembic migration must exist before the API, the ThemeProvider must exist before SettingsPage (which calls `previewSettings()`), and i18n integration can trail the UI without blocking anything. The architecture makes zero changes to DashboardPage or UploadPage — theme propagation is automatic via CSS cascade.

The two hard requirements that cannot be deferred or skimped are SVG sanitization and CSS color value validation. Both are security-level concerns on a zero-auth app: an unvalidated SVG upload is a stored XSS vector (Ghost CMS patched this exact attack in 2025), and an unvalidated color string passed to `document.documentElement.style.setProperty` is a CSS injection vector. Both must be implemented in Phase 1 (backend), before any logo or color is persistable. All other pitfalls are moderate-severity UX or operational concerns with straightforward mitigations.

---

## Key Findings

### Recommended Stack

No new frontend packages are needed. The entire v1.1 frontend — runtime theming, live preview, logo display, language switching, all Settings UI — is achievable with React state, `document.documentElement.style.setProperty`, TanStack Query, i18next `changeLanguage()`, and existing shadcn/ui components. The only backend addition is `nh3==0.3.3`, a Rust-backed SVG sanitizer chosen over the deprecated `bleach`, the CVE-carrying `lxml html.clean`, and the removed `defusedxml.lxml`.

**New dependency (backend only):**
- `nh3==0.3.3` — SVG XSS sanitization; Rust-backed allowlist approach; pre-built manylinux wheels (no C compiler in Docker); actively maintained

**Key existing libraries doing new work in v1.1:**
- `SQLAlchemy LargeBinary` (maps to `BYTEA`) — logo storage inline in `app_settings` table
- `Alembic` — new migration adding `app_settings` table + seeding the singleton row
- `document.documentElement.style.setProperty` (no library) — runtime CSS var injection for theme
- `i18next.changeLanguage()` — language switching on boot and on save; no detector plugin
- `TanStack Query` — settings fetch with `staleTime: Infinity`, mutation for save, cache invalidation

**What NOT to add:**
- `bleach` — deprecated by Mozilla
- `defusedxml` — lxml module removed in current versions
- `lxml html.clean / Cleaner` — CVE GHSA-5jfw-gq64-q45f (SVG/math context-switching bypass)
- `i18next-browser-languageDetector` — localStorage caching overrides the server default after first visit; defeats the purpose
- `fastapi-cache / fastapi-cache2` — Redis/Memcached for a 1 MB logo is overkill; inline ETag + 304 is sufficient
- Filesystem logo storage — container-ephemeral without an explicitly declared named Docker volume

### Expected Features

**Must have (table stakes — v1.1 is incomplete without these):**
- Settings route `/settings` reachable from NavBar
- App name input — replaces "KPI Light" in header and `document.title`
- Logo upload (PNG/SVG, ≤ 1 MB, drag-and-drop + click) with client-side preview before save
- Full semantic color palette editing: `--primary`, `--accent`, `--background`, `--foreground`, `--muted`, `--destructive` (user decision — full 6 tokens, not primary-only)
- Live preview — theme changes reflected immediately while editing, before Save
- Explicit Save button + Reset to defaults
- Unsaved-changes warning on navigation away
- Default UI language setting (DE/EN)
- Browser tab title updated from stored app name

**Should have (included in v1.1 scope):**
- WCAG AA contrast ratio badge on color pickers (warn, do not block)
- Color preset swatches (4–6 hardcoded options feeding the hex input; zero backend cost)
- Logo drag-and-drop (reuse `react-dropzone` library — NOT `DropZone.tsx` component)

**Defer to v1.2+:**
- Dark mode toggle (per-user preference; needs auth for per-user scoping)
- Per-user CI customization (needs Authentik/auth from v2)
- Admin-only settings gating (needs Authentik roles)
- Font selection (FOUC complexity, low demand)
- Full OKLCH-native color picker UI (non-designer unfamiliar; hex input is sufficient)

**Scope note — full semantic palette:** The user explicitly requested all 6 semantic color tokens (primary, accent, background, foreground, muted, destructive). FEATURES.md had recommended primary-only for v1.1. User decision overrides — implement all 6 tokens, but scope the WCAG contrast checks to the 3 most critical pairs only (`primary/primary-foreground`, `background/foreground`, `destructive/white`).

### Architecture Approach

v1.1 is an additive layer on the existing three-tier stack. One new router (`routers/settings.py`) with 4 endpoints, one new SQLAlchemy model (`AppSettings`), one new Alembic migration, one new React context (`ThemeContext.tsx`), one new page (`SettingsPage.tsx`), two new sub-components (`ColorPicker.tsx`, `LogoUpload.tsx`), and modifications to `App.tsx` and `NavBar.tsx`. `DashboardPage` and `UploadPage` require zero changes — they consume Tailwind utility classes that reference the CSS vars, so theme changes propagate automatically.

**Major components:**
1. `app_settings` table (PostgreSQL) — single row (id=1, enforced by CHECK constraint), typed columns for all settings, `BYTEA` for logo, `TIMESTAMPTZ` for `logo_updated_at` (cache-busting) and `updated_at` (concurrency locking)
2. `routers/settings.py` (FastAPI) — `GET/PUT /api/settings`, `GET/POST /api/settings/logo`; logo served as `Response` (not `StreamingResponse`) with ETag from SHA-256 of bytes; nh3 sanitization in the POST logo handler
3. `ThemeContext.tsx` (React) — wraps entire app; fetches settings once on mount with `staleTime: Infinity`; injects CSS vars via `document.documentElement.style.setProperty`; exposes `useSettings()` and `previewSettings()` hooks; calls `i18n.changeLanguage()` before first render
4. `SettingsPage.tsx` — draft state in `useState`; drives live preview via `previewSettings()`; Save calls `PUT /api/settings` + logo mutation + TanStack Query invalidation
5. `NavBar.tsx` (modified) — logo slot renders `<img src="/api/settings/logo?v={logo_updated_at}">` if logo set, otherwise falls back to `settings.app_name` text; adds Settings nav link

**Key patterns:**
- Single-row upsert via `session.execute(insert(...).on_conflict_do_update(...))` — avoids SQLAlchemy issue #9739 (LargeBinary multi-object commit bug) and enforces singleton
- `QueryClientProvider` wraps `ThemeProvider` wraps the app — order matters; ThemeProvider uses TanStack Query internally
- `logo_updated_at` timestamp as URL cache-buster: `?v={logo_updated_at}` — deterministic, no ETag complexity on the client
- Settings query: `staleTime: Infinity, gcTime: Infinity` — settings change only on explicit user save, never on interval

**Integration file paths (confirmed by codebase inspection):**
- `backend/app/models.py` — add `AppSettings` model
- `backend/app/schemas.py` — add `AppSettingsResponse`, `AppSettingsUpdate`
- `backend/app/routers/settings.py` — new file
- `backend/app/main.py` — add `app.include_router(settings_router)`
- `backend/alembic/versions/` — new migration file
- `backend/app/defaults.py` — new file (canonical default settings for reset)
- `frontend/src/contexts/ThemeContext.tsx` — new file
- `frontend/src/App.tsx` — wrap with ThemeProvider, add `/settings` route
- `frontend/src/components/NavBar.tsx` — logo slot, app name hook, Settings link
- `frontend/src/pages/SettingsPage.tsx` — new file
- `frontend/src/components/settings/ColorPicker.tsx` — new file
- `frontend/src/components/settings/LogoUpload.tsx` — new file
- `frontend/src/locales/de.json`, `frontend/src/locales/en.json` — add `settings.*` and `nav.settings` keys

**Do NOT touch:** `DropZone.tsx`, `DashboardPage.tsx`, `UploadPage.tsx`, `index.css`

### Critical Pitfalls

1. **SVG XSS (CRITICAL)** — User uploads an SVG with `<script>` or `on*` event handlers; stored and served as-is; executes in the app's origin. Prevention: server-side `nh3` sanitization with a strict element/attribute allowlist before any DB write. Serve logo via `<img>` tag only — never `dangerouslySetInnerHTML`. Add `X-Content-Type-Options: nosniff` header. Phase 1 (backend), before logo is persistable.

2. **CSS Color Injection (CRITICAL)** — Raw user-supplied color string passed to `document.documentElement.style.setProperty()` can break out of CSS value context and inject arbitrary declarations. Prevention: Pydantic `@field_validator` with strict regex on the backend (reject strings containing `;`, `}`, `{`, `url(`, `expression(`, quotes). Same regex validation on the frontend before `setProperty` call. Phase 1 (Pydantic schema) + Phase 3 (color picker).

3. **FOUC on Settings Load (MODERATE)** — App boots with CSS-file defaults for 200–800ms while settings API call resolves. Prevention: ThemeProvider renders a neutral skeleton until settings query reaches `isSuccess`; `i18n.changeLanguage()` called inside ThemeProvider before any translated content renders. Phase 2 (ThemeProvider architecture — must be designed correctly the first time; retrofitting the skeleton is a pain).

4. **Logo Cache Staleness (MODERATE)** — Browser caches old logo after upload. Prevention: `logo_updated_at` stored on every logo write; frontend constructs URL as `/api/settings/logo?v={logo_updated_at}`; URL changes on every upload. Phase 1 (backend column + response) + Phase 3 (URL construction in NavBar + SettingsPage).

5. **Language Detection Loop (MODERATE)** — `i18next-browser-languageDetector` creates a race between browser language and server default; localStorage cache fights the DB value. Prevention: do NOT install the detector. Server default is the single source of truth. Phase 4 (i18n wiring), but ThemeProvider architecture must accommodate this from Phase 2.

---

## Divergence Resolutions

Four areas where the 4 researchers disagreed — each resolved with explicit rationale:

### 1. Logo Storage: bytea vs Filesystem
**Vote:** STACK (bytea) + ARCHITECTURE (bytea) + PITFALLS (bytea) vs FEATURES (filesystem). 3:1.

**Resolution: bytea.** In Docker Compose, filesystem storage inside the API container is ephemeral — logo is lost on `docker compose up --build` (every deploy) unless a named volume is explicitly declared and mounted. Adding a volume mount for a single 1 MB file introduces operational complexity disproportionate to the benefit. Bytea keeps the settings row self-contained, fully ACID, and `pg_dump`-backed. Frontend cache-busting via `?v={logo_updated_at}` eliminates the "no browser caching" objection. The 1 MB size limit makes bytea practical — TOAST handles out-of-line storage transparently.

### 2. Color Format: Hex input, oklch stored
**Vote:** FEATURES (hex input + swatches; CSS vars accept any format) vs PITFALLS (oklch only, match `index.css`) vs STACK (store oklch to match CSS) vs ARCHITECTURE (TEXT column, convert hex→oklch in UI).

**Resolution: Hex `<input type="color">` for UX; convert to oklch before submission; store as TEXT.** The native color widget and hex swatches are the most universally understood format for non-designers. The UI accepts hex, converts to oklch before API submission using `culori` (small, tree-shakeable). Backend stores as TEXT with no format lock-in. On injection via `setProperty`, the oklch string matches the existing `:root` format in `index.css`. The PITFALLS color validator must expect oklch input from the client. Do NOT use a heavy color library — `culori`'s hex→oklch path is the only conversion needed.

### 3. SVG Sanitization: nh3 (unanimous choice, different paths)
**Vote:** STACK (nh3) vs PITFALLS (defusedxml + allowlist; cairosvg as nuclear fallback).

**Resolution: nh3.** Single mature dependency, Rust-backed, actively maintained, pre-built wheels (no Docker compiler needed), explicit SVG allowlist API. `defusedxml` is deprecated. `lxml html.clean` has CVE GHSA-5jfw-gq64-q45f. The cairosvg→PNG rasterization approach is documented as a fallback option only if nh3 proves insufficient in practice — at 60×60 display, PNG is visually identical to vector.

### 4. Semantic Color Palette Scope: Full 6 tokens (user decision)
**Vote:** FEATURES (primary-only for v1.1 simplicity) vs PITFALLS + PROJECT.md (full semantic palette).

**Resolution: Full 6 tokens — user decision overrides.** User confirmed full semantic palette in PROJECT.md: primary, accent, background, foreground, muted, destructive. The schema already accommodates all tokens. Scope WCAG contrast warnings to 3 most critical pairs only; do not attempt to check all permutations.

### 5. Language Detector: Unanimous no
**All 4 researchers agree:** Do NOT install `i18next-browser-languageDetector`. Fetch settings on boot; call `i18n.changeLanguage()` before first render. Server value is the single source of truth.

---

## Implications for Roadmap

Suggested 4-phase structure — matches ARCHITECTURE.md's build order, validated by PITFALLS.md's phase-to-pitfall mapping.

### Phase 1: Backend — Schema, API, and Security
**Rationale:** Schema must exist before API; API must exist before UI. Security pitfalls (SVG XSS, CSS injection) must be addressed here — they cannot be retrofitted after the feature ships. This phase gates everything that follows.

**Delivers:**
- `app_settings` Alembic migration (table + singleton row seed + CHECK constraint)
- `AppSettings` SQLAlchemy model with `LargeBinary` logo column
- `AppSettingsResponse` / `AppSettingsUpdate` Pydantic schemas with color field validators
- `routers/settings.py`: `GET /api/settings`, `PUT /api/settings`, `GET /api/settings/logo`, `POST /api/settings/logo`
- `nh3==0.3.3` added to `requirements.txt`; nh3 sanitization wired in logo POST handler
- `app/defaults.py` — canonical default settings object (used by reset)
- ETag + `logo_updated_at` on logo GET response

**Avoids:** Pitfall 1 (SVG XSS), Pitfall 2 (CSS injection — Pydantic validator), Pitfall 6 (bytea vs filesystem), Pitfall 9 (reset-to-defaults divergence)
**Research flag:** None — well-documented patterns. Skip research-phase.

### Phase 2: Frontend Plumbing — ThemeProvider + NavBar Wiring
**Rationale:** SettingsPage calls `previewSettings()` which lives in ThemeProvider. NavBar consumes `useSettings()`. FOUC mitigation must be designed here — retrofitting the skeleton architecture later requires rewriting the provider. This phase produces a working themed app even before the Settings UI exists.

**Delivers:**
- `ThemeContext.tsx` — settings fetch, CSS var injection, `useSettings()` / `previewSettings()` hooks, neutral skeleton during load
- `App.tsx` — `ThemeProvider` wrapper, `/settings` route added
- `NavBar.tsx` — logo slot (`<img>` with `?v=` cache-buster), app name from hook, Settings nav link
- Settings query configured: `staleTime: Infinity, gcTime: Infinity`

**Avoids:** Pitfall 3 (FOUC), Pitfall 4 (logo cache — URL construction in NavBar), Pitfall 5 (polling — single query in provider)
**Research flag:** None — TanStack Query + CSS var injection is well-documented. Skip research-phase.

### Phase 3: Frontend — SettingsPage and Sub-components
**Rationale:** Depends on ThemeProvider (Phase 2) and API (Phase 1). ColorPicker and LogoUpload are independent sub-components; build them before assembling the page. The live-preview wiring, unsaved-changes guard, and Save/Reset flows all assemble here.

**Delivers:**
- `ColorPicker.tsx` — hex `<input type="color">` + text input + culori hex→oklch conversion + WCAG contrast badge (warn only)
- `LogoUpload.tsx` — react-dropzone (PNG/SVG, 1 MB limit) + `URL.createObjectURL` preview; posts to logo endpoint
- `SettingsPage.tsx` — full Settings UI: draft state, live preview, Save, Reset, unsaved-changes warning (beforeunload + wouter intercept + shadcn Dialog)
- Color preset swatches (4–6 hardcoded oklch options)

**Avoids:** Pitfall 2 (CSS injection — frontend format validation before setProperty), Pitfall 4 (logo cache — `?v=` in URL), Pitfall 8 (accessibility — contrast badge)
**Research flag:** Wouter navigation guard requires explicit testing — no `<Prompt>` equivalent; use `beforeunload` + Dialog pattern. Not a research gap, but a testing checkpoint.

### Phase 4: i18n Integration + Polish
**Rationale:** Translation keys can be added after the page is built — English strings work as fallback throughout Phase 3. Deferring keeps Phase 3 focused on interaction logic. This phase closes the loop on language default persistence and end-to-end verification.

**Delivers:**
- DE/EN locale files updated with `settings.*` and `nav.settings` keys
- `i18n.changeLanguage(settings.default_language)` wired in ThemeProvider before first render
- Language dropdown in SettingsPage wired to PUT + immediate `i18n.changeLanguage()`
- Toast success/error feedback on Save (existing toast infrastructure)
- E2E verification: `docker compose up --build` after logo upload confirms logo survives

**Avoids:** Pitfall 7 (language detection loop — changeLanguage before render, no localStorage, no detector)
**Research flag:** None — i18next changeLanguage() is straightforward. Skip research-phase.

### Phase Ordering Rationale

- Schema before API is a hard dependency — no table, no endpoint
- Security (SVG XSS + CSS injection) must be backend-first, Phase 1 — cannot be retrofitted post-ship without invalidating stored data
- ThemeProvider before SettingsPage is a near-hard dependency — SettingsPage calls `previewSettings()` from context; building against a mock doubles the wiring work
- i18n last is deliberate — English fallback strings serve during Phase 3 development; deferring key additions avoids back-and-forth

### Research Flags

Needs deeper research during planning: None identified. All patterns have official docs + direct codebase evidence.

Standard patterns (skip research-phase during planning):
- Phase 1 — SQLAlchemy singleton row, Alembic migration, FastAPI UploadFile, nh3 API all have clear documentation and codebase precedent
- Phase 2 — TanStack Query + CSS var injection is the established shadcn live-theming pattern (tweakcn reference)
- Phase 3 — react-dropzone already installed; WCAG contrast formula is 10 lines of JS; culori is a focused library with a clear API
- Phase 4 — i18next changeLanguage() is documented in official i18next API docs

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against PyPI/npm registries; single new dep (nh3) confirmed. Codebase inspection confirmed oklch format, @theme inline structure, i18n setup. |
| Features | HIGH (table stakes) / MEDIUM (differentiators) | Table stakes confirmed against established shadcn/Tailwind patterns. Full 6-token scope is a user-overridden decision — complexity acknowledged and accepted. |
| Architecture | HIGH | Based on direct codebase inspection of all relevant files. Integration points are precise, confirmed file paths. No guesses. |
| Pitfalls | HIGH | Critical pitfalls have real-world CVE/PR precedent (Ghost CMS SVG XSS 2025; lxml CVE). Moderate pitfalls have well-sourced mitigations. Phase assignments validated. |

**Overall confidence: HIGH**

### Gaps to Address

- **culori bundle impact:** culori's tree-shaken size in this Vite project was not benchmarked. If bundle impact is unacceptable, an inline ~20-line function covers hex→oklch conversion for the specific values produced by `<input type="color">`. Flag for Phase 3 implementation.

- **wouter navigation guard:** The `beforeunload` + Dialog intercept pattern for unsaved-changes warning requires careful implementation — verify it fires on NavBar link clicks (not just tab close). Not a research gap; a testing checkpoint for Phase 3.

- **Optimistic locking coordination:** PITFALLS.md recommends `updated_at`-based concurrency control (WHERE id=1 AND updated_at=$last_known → 409 on conflict). Implement the 409 response in Phase 1; wire the frontend 409 handler in Phase 3. Requires coordination across phases — note this in the requirements.

- **Color preset swatch values:** Specific oklch values for the 4–6 preset palettes are not defined in research. Requirements or implementation phase should define these or delegate to the implementer.

---

## Sources

### Primary (HIGH confidence — verified against live registries, official docs, direct codebase inspection)
- SQLAlchemy 2.0 LargeBinary / BYTEA PostgreSQL — type mapping
- SQLAlchemy issue #9739 — LargeBinary multi-object commit bug — singleton-row avoidance
- lxml html.clean SVG/math context bypass CVE GHSA-5jfw-gq64-q45f
- nh3 PyPI 0.3.3 (Feb 2026) — version confirmed
- FastAPI Custom Response docs — Response vs StreamingResponse
- Tailwind CSS v4 @theme directive — runtime CSS variable behavior
- shadcn/ui Tailwind v4 theming — CSS variable names and oklch format
- i18next API — changeLanguage programmatic switching
- Codebase: `frontend/src/index.css` — oklch format, @theme inline structure confirmed
- Codebase: `frontend/src/i18n.ts` — no language detector, hardcoded `lng: "de"` confirmed
- Codebase: `backend/app/models.py`, `schemas.py`, `main.py`, `routers/kpis.py` — patterns confirmed
- Codebase: `frontend/src/App.tsx`, `NavBar.tsx`, `DropZone.tsx` — integration points confirmed

### Secondary (MEDIUM confidence — multiple community sources agree)
- Ghost CMS SVG XSS PR #19646 (2025) — real-world SVG upload XSS precedent
- OWASP CSS Injection Testing Guide — CSS injection risk classification
- MDN: HTTP Caching (ETag / Cache-Control) — logo cache-busting strategy
- PostgreSQL BinaryFilesInDB wiki + CYBERTEC binary data performance — bytea trade-offs
- i18next-browser-languageDetector GitHub issue #250 — localStorage overwrite behavior
- WCAG color contrast 2025 (AllAccessible) — 4.5:1 ratio requirement for AA
- Vite FOUC fix patterns — skeleton approach for dark-mode-on-first-paint
- tweakcn.com — confirmed CSS var injection pattern used in production at scale
- Cloudscape unsaved-changes pattern — "Leave / Stay" dialog wording

### Tertiary (informational — no implementation decisions rest solely on these)
- CairoSVG documentation — nuclear fallback option (rasterize SVG→PNG), not used
- Docker volumes data persistence guide — named volume requirement context
- culori library — hex→oklch conversion; bundle size not benchmarked

---

*Research completed: 2026-04-11*
*Ready for roadmap: yes*
