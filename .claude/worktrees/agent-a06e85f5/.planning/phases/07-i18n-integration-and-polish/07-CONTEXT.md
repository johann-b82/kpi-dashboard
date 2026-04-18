# Phase 7: i18n Integration and Polish - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the `default_language` setting into the i18n runtime so no language flash occurs on hard refresh, add a language picker UI to the Settings page, complete German translations for every locale key, and prove that a full `docker compose up --build` cycle preserves all persisted branding state (colors, logo, app name, language) through automated pytest + Playwright tests.

**In scope:**
- `main.tsx` async bootstrap that fetches `/api/settings` and seeds i18n + TanStack cache BEFORE React renders
- `index.html` minimal CSS splash during bootstrap
- Settings page "Preferences" card with DE/EN segmented language picker
- Live-preview behavior for language (setField + i18n.changeLanguage, mirrors color live-preview)
- NavBar `LanguageToggle` persistence upgrade (immediate PUT on click)
- Disable NavBar toggle while Settings draft is dirty
- Full German translation of all 105 locale keys, informal "du" tone, English loanwords for Dashboard/Upload/KPI/Logo
- Backend pytest setup (test DB fixture, conftest, pytest installed in backend image)
- Frontend Playwright setup (config, one e2e spec)
- Bash harness script orchestrating `docker compose` rebuild + pytest assertion + Playwright visual assertion

**Out of scope:**
- Additional languages beyond DE/EN
- i18n pluralization, ICU MessageFormat, or namespace splitting
- Locale-specific number/date/currency formatting
- RTL support
- Authentik integration (future milestone)

</domain>

<decisions>
## Implementation Decisions

### Boot-time Language Init (SC2: no language flash)

- **D-01:** `main.tsx` performs a top-level `await bootstrap()` before `ReactDOM.createRoot().render()`. Bootstrap fetches `GET /api/settings`, calls `i18n.changeLanguage(settings.default_language.toLowerCase())`, and calls `queryClient.setQueryData(['settings'], settings)` to warm the TanStack cache. Then — and only then — React renders.
- **D-02:** `i18n.ts` must NOT hardcode `lng: "de"`. Change `init()` to omit `lng` (or set it to `undefined`); bootstrap is the single writer of the initial language value.
- **D-03:** `frontend/index.html` contains a minimal inline-CSS splash in `<body>` (centered text with app name or a simple spinner, styled with `<style>` in `<head>`). React replaces the splash on first mount. No JS before React.
- **D-04:** If bootstrap settings fetch fails (network error, backend down, 5xx), bootstrap catches the error, falls back to `i18n.changeLanguage('en')` with hardcoded default, renders React anyway, and the normal `useSettings()` query (mounted by App) surfaces the real error via the existing toast/error-boundary path. Do NOT block the app on a fatal error screen.
- **D-05:** Bootstrap uses the same `fetchSettings()` function from `lib/api.ts` — do not duplicate fetch logic. If `fetchSettings` throws, catch at bootstrap level.
- **D-06:** Bootstrap seeds TanStack cache so the App-level `useSettings()` hook reads from cache on first mount → zero duplicate round-trip on hard refresh.

### Language Picker UI (SC1: user can change language from Settings)

- **D-07:** Add a new Card section "Preferences" on the Settings page, positioned AFTER the existing Colors card and BEFORE the sticky ActionBar. Title key: `settings.preferences.title` ("Preferences" / "Einstellungen" — note: use a different key name than the page title to avoid collision).
- **D-08:** Language picker control: segmented control with two options `[DE] [EN]`. Reuse the visual pattern from the existing NavBar `LanguageToggle` (bold active / muted inactive) but render inside the card as a labeled form control, not a button. Label key: `settings.preferences.language.label` + help-text key: `settings.preferences.language.help`.
- **D-09:** The picker uses `useSettingsDraft.setField('default_language', value)` so it participates in the standard draft/save/discard flow exactly like colors. Changing the picker:
  1. Updates the draft via `setField`
  2. Synchronously calls `i18n.changeLanguage(value.toLowerCase())` so the entire Settings page re-renders in the new language immediately (live preview)
  3. Does NOT fire a network request
  4. On Save: PUT persists the new `default_language`; server response writes cache
  5. On Discard: `useSettingsDraft.discard()` reverts draft AND calls `i18n.changeLanguage()` back to the snapshot value
- **D-10:** `useSettingsDraft.setField` must be extended: when the field is `default_language`, call `i18n.changeLanguage(value.toLowerCase())` in addition to the standard cache write. Import `i18n` from `../i18n` in the hook. When `discard()` or `resetToDefaults()` fires, call `i18n.changeLanguage(snapshot.default_language.toLowerCase())` to sync the runtime back to the snapshot.
- **D-11:** `DraftFields` type in `useSettingsDraft.ts` must include `default_language: "DE" | "EN"`. `shallowEqualDraft` must compare it. `draftToCacheSettings` must include it. This is currently wired on the Settings type but the draft-specific code paths need to be audited — some fields may be missing.

### NavBar LanguageToggle Interaction (SC1 cross-cut)

- **D-12:** The existing NavBar `LanguageToggle` component stays visible and functional on ALL routes. When clicked, it now:
  1. Fires `PUT /api/settings` with `{ default_language: 'DE' | 'EN', ...current_other_fields }` — the toggle persists immediately, NO draft flow
  2. Calls `i18n.changeLanguage()` to update the runtime
  3. Writes the response to `queryClient.setQueryData(['settings'], response)`
  4. Shows a toast on success/failure using the same toast patterns as Phase 6
- **D-13:** When on the Settings route AND `useSettingsDraft` reports `isDirty === true`, the NavBar `LanguageToggle` button is DISABLED (grayed out + `aria-disabled` + not clickable) and shows a tooltip `settings.preferences.toggle_disabled_tooltip` ("Save or discard changes first"). This prevents a race between two writers (Settings draft and NavBar toggle). Detection mechanism: the Settings page exposes `isDirty` via a lightweight context or a global Zustand store — implementation detail for planner but the contract is: NavBar must be able to read "is Settings page currently dirty?" without importing page-specific code.
- **D-14:** On non-Settings routes, `LanguageToggle` is always enabled — only Settings page dirty state disables it.
- **D-15:** NavBar toggle fetches the CURRENT settings (from the TanStack cache) before building the PUT payload so it doesn't overwrite other fields with stale defaults. The PUT body must include all 8 required fields (6 colors + app_name + default_language) per Phase 4 schema.

### German Translation (SC3: Settings page fully translated in DE and EN)

- **D-16:** Translate ALL 105 keys in `frontend/src/locales/en.json` to German in `frontend/src/locales/de.json`. Currently de.json has only 62 keys — 43 new `settings.*` keys plus review/polish of the existing 62 dashboard/upload keys for tone consistency.
- **D-17:** Tone: **informal "du"** throughout. Examples: "Wähle eine Farbe", "Deine Einstellungen wurden gespeichert", "Möchtest du die Änderungen verwerfen?", "Lade ein Logo hoch". Matches the modern SaaS tone the team prefers.
- **D-18:** Terminology: keep common English loanwords that are native German software vocabulary. Specific rules:
  - "Dashboard" → Dashboard (not Übersicht)
  - "Upload" as a noun/section label → Upload; as a verb → "hochladen"
  - "KPI" → KPI (not Kennzahl)
  - "Logo" → Logo
  - "Settings" → Einstellungen
  - "Primary color" → Primärfarbe (or Hauptfarbe — planner's discretion)
  - "Save" → Speichern
  - "Discard" → Verwerfen
  - "Reset to defaults" → Auf Standard zurücksetzen
  - "Contrast" → Kontrast
- **D-19:** All toast messages, dialog titles/bodies, error messages, form labels, placeholders, help text, and aria labels must be translated. No EN-only strings remaining after this phase. Add a key-parity assertion (pytest or a simple node script) that fails if en.json and de.json have different key sets.
- **D-20:** The existing 62 DE keys should be reviewed — if any are in formal "Sie" form, rewrite to informal "du". Phase planner should grep the existing de.json for "Sie" / "Ihre" / "Ihnen" and flag occurrences.

### Rebuild Persistence Verification (SC4: docker compose up --build preserves state)

- **D-21:** Add **pytest** to the backend: `requirements-dev.txt` with `pytest`, `pytest-asyncio`, `httpx`, `asgi-lifespan`; `backend/tests/conftest.py` with `async_client` fixture and a `test_db` fixture that uses a separate Postgres schema or database. A second Dockerfile stage or dev-time install pattern so pytest is available in the backend container for the harness. Tests run via `docker compose exec api pytest` or equivalent.
- **D-22:** Add **Playwright** to the frontend: `npm install -D @playwright/test`, `npx playwright install chromium` (bundled in Docker or installed in host), `frontend/playwright.config.ts` pointing at `http://localhost:5173`, one e2e spec `tests/e2e/rebuild-persistence.spec.ts` that loads `/settings`, asserts visible color swatches and logo image, changes language via the picker, and reloads to verify persistence.
- **D-23:** Ship `scripts/smoke-rebuild.sh` as the top-level harness. Exact steps:
  1. `docker compose down -v` is NOT called (we need to preserve postgres_data)
  2. `docker compose up -d` → wait for api health
  3. `pytest backend/tests/test_rebuild_seed.py` — seeds all 10 settings fields with unique, verifiable values: 6 colors to specific oklch strings, app_name to "Rebuild Test Corp", default_language to "DE", upload a deterministic 1×1 PNG (known bytes) via `POST /api/settings/logo`
  4. `docker compose down` (containers stop, postgres_data volume persists)
  5. `docker compose up -d --build` → rebuilds images
  6. Wait for api health
  7. `pytest backend/tests/test_rebuild_assert.py` — re-fetches `GET /api/settings`, asserts exact equality on all 8 JSON fields + `logo_url` non-null, then `GET /api/settings/logo` asserts bytes match the known PNG
  8. `npx playwright test tests/e2e/rebuild-persistence.spec.ts` — opens `/settings` and visually asserts: one of the known colors is applied to a swatch, the uploaded logo renders in the NavBar, `html[lang="de"]` attribute is set, Settings page labels are in German
  9. On success: print "✓ Rebuild persistence verified" and exit 0
- **D-24:** Seed and assert scripts are separate pytest files (not fixtures) so the harness can run them in sequence across a rebuild cycle (a single pytest session cannot survive `docker compose down`). They share data via the live database — the seed script leaves state in postgres_data; the assert script reads it back.
- **D-25:** The harness script lives at `scripts/smoke-rebuild.sh`, executable, documented in README. It is NOT added to CI yet (no CI exists). Running it is a Phase 7 verification step and a documented command users can run manually.
- **D-26:** Coverage target: exact equality on all 8 editable settings fields (6 colors + app_name + default_language), logo byte round-trip via `GET /api/settings/logo`, visual assertion that the browser actually applies the branding (not just API echoes). This is maximum paranoia — catches any unnoticed storage or caching regression.
- **D-27:** The harness run is the phase verification for SC4. The phase plan's human-verify checkpoint confirms the harness passed (not a manual color-change ritual). If the harness passes, SC4 is satisfied.

### Claude's Discretion

- Exact CSS styling of the bootstrap splash in index.html (font, spinner vs text, colors) — Claude decides. Constraint: no external fonts, no external CSS, must work on slow connections.
- Exact shape of the "is Settings dirty" exposure to NavBar (React context, Zustand, location+ref check) — Claude picks the lightest mechanism that doesn't leak page-specific logic into NavBar.
- Whether to name the new card "Preferences" or "Allgemein" in German — Claude picks per D-18 terminology rules. My preference: "Präferenzen" reads too technical; "Allgemein" ("General") is the shadcn/GitHub convention.
- Playwright browser choice (chromium only, or multi-browser) — chromium only is fine for Phase 7.
- pytest fixture scope (session vs function) — Claude picks; session scope is fine for seed/assert sequence.
- Whether the rebuild test DB is an in-memory SQLite or a separate Postgres schema — planner decides based on how the existing backend connects; separate Postgres schema is probably cleanest given async SQLAlchemy + asyncpg already wired.
- Exact German translation strings — Claude writes them following D-17, D-18 rules. User will review in the phase verification step.

### Folded Todos

None — no pending todos were matched to this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 6 (Settings page foundation — MUST be extended, not rewritten)
- `.planning/phases/06-settings-page-and-sub-components/06-CONTEXT.md` — draft/save/discard flow, single-writer invariant, hex↔oklch boundary, unsaved-changes guard
- `.planning/phases/06-settings-page-and-sub-components/06-RESEARCH.md` — settings API contract, oklch pitfalls, wouter limitations
- `.planning/phases/06-settings-page-and-sub-components/06-UI-SPEC.md` — visual design contract (sticky ActionBar, card layout, toast patterns)
- `frontend/src/hooks/useSettingsDraft.ts` — the hook to EXTEND with i18n-aware setField/discard
- `frontend/src/pages/SettingsPage.tsx` — the page to ADD a Preferences card to

### Phase 5 (NavBar + LanguageToggle)
- `frontend/src/components/NavBar.tsx` — where LanguageToggle mounts, needs dirty-detection wiring
- `frontend/src/components/LanguageToggle.tsx` — existing component; upgrade from ephemeral toggle to persisting toggle
- `frontend/src/components/ThemeProvider.tsx` — single DOM writer invariant (do not violate)

### Phase 4 (Settings backend API — FROZEN contract)
- `backend/app/routers/settings.py` — PUT /api/settings, POST /api/settings/logo, GET /api/settings/logo
- `backend/app/schemas.py` — SettingsUpdate, OklchColor validator, default_language Literal["DE", "EN"]
- `backend/app/models.py` — Settings table with logo_data BYTEA + logo_mime + logo_updated_at
- `backend/app/defaults.py` — DEFAULT_SETTINGS constant (default_language: "EN")

### Project
- `CLAUDE.md` — React 19 + Vite + Tailwind v4 + shadcn + TanStack Query + Wouter; no `asChild`, use `render` prop
- `.planning/REQUIREMENTS.md` — I18N-01, I18N-02 acceptance criteria
- `.planning/PROJECT.md` — v1.1 Branding & Settings milestone goal

### i18n current state
- `frontend/src/i18n.ts` — i18next + react-i18next init; currently hardcodes `lng: "de"` (MUST change)
- `frontend/src/main.tsx` — where bootstrap must be added
- `frontend/index.html` — where the CSS splash must be added
- `frontend/src/locales/en.json` — source of truth for keys (105 keys)
- `frontend/src/locales/de.json` — incomplete (62 keys); must reach 105 with informal tone

### Docker / infrastructure
- `docker-compose.yml` — api + frontend + db + migrate services; `postgres_data` named volume (persistence source of truth)
- `backend/Dockerfile` — must gain pytest dev deps (or a dev stage)
- `frontend/Dockerfile` — must gain Playwright + chromium (or run Playwright from host)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `useSettingsDraft` hook (Phase 6) — handles draft state, save/discard/reset, live preview via setQueryData. Extend with i18n-awareness, do NOT fork.
- `useUnsavedGuard` hook (Phase 6) — already guards navigation on dirty state. NavBar dirty-detection can piggyback on the same mechanism.
- `ColorPicker` / `ContrastBadge` / `LogoUpload` (Phase 6) — reference implementations for card-section patterns. The new language picker should match card/label/help styling.
- `ActionBar` (Phase 6) — sticky Save/Discard/Reset bar already handles `isDirty` display. No changes needed unless language picker has edge cases.
- `LanguageToggle` (Phase 5) — exists but is ephemeral. Upgrade in-place per D-12, do not create a second component.
- `fetchSettings` / `updateSettings` / `uploadLogo` in `lib/api.ts` — already support default_language on the type level. Bootstrap reuses `fetchSettings`.
- `queryClient` + TanStack Query setup (Phase 3) — already mounted. Bootstrap seeds the same client that Apps later read.
- `toast` (sonner, Phase 6) — already used for settings save/error. NavBar toggle reuses the same pattern.

### Established Patterns

- Single-writer invariant: only `queryClient.setQueryData(['settings'], ...)` mutates the live preview; only `ThemeProvider` writes CSS variables to DOM. i18n adds a third DOM-ish writer (html[lang] attribute + text content) — must NOT let multiple call sites write different lang values concurrently. The rule extends: only `useSettingsDraft` and the NavBar toggle mutate i18n, and NavBar is disabled while Settings is dirty.
- Draft/save/discard flow: extend, don't invent a new pattern.
- Error handling: `formatDetail()` in api.ts handles FastAPI 422 array errors. New language PUT reuses it.
- shadcn `render` prop pattern (not asChild) for base-ui components.
- Locale files are flat key-value with dot-separated keys, `keySeparator: false` — new keys must follow `settings.preferences.*` naming.

### Integration Points

- `main.tsx` → bootstrap → `i18n.changeLanguage` + `queryClient.setQueryData` → `ReactDOM.createRoot().render(<App />)` — the critical sequence
- `SettingsPage.tsx` → new `<PreferencesCard />` component → `useSettingsDraft.setField('default_language', ...)` → i18n.changeLanguage
- `useSettingsDraft` → import `i18n` → wrap setField/discard/resetToDefaults with i18n sync
- `NavBar` → `useSettings` cache read + `updateSettings` mutation + dirty-detection subscription → disable state
- `docker-compose.yml` → pytest + Playwright run against the running stack; `postgres_data` volume is the persistence anchor

</code_context>

<specifics>
## Specific Ideas

- Seed test PNG: a deterministic 1×1 red PNG (8-byte PNG signature + minimal IHDR + IDAT + IEND) hardcoded in the seed pytest file. Hash asserted byte-exact in the assert test.
- Seed color values: 6 distinct oklch strings (e.g., `oklch(0.5 0.2 30)` through `oklch(0.5 0.2 300)` at 54° intervals) so byte-level diffs would be obvious.
- Seed app_name: `"Rebuild Test Corp"` — non-default, non-empty, no special chars.
- Seed language: `"DE"` — default is `"EN"`, so we flip it; the Playwright spec then asserts `html[lang="de"]` after rebuild.
- Playwright spec name: `tests/e2e/rebuild-persistence.spec.ts`
- Harness script name: `scripts/smoke-rebuild.sh`, documented in README under a new "Testing" section.
- i18n bootstrap file name: `frontend/src/bootstrap.ts` exposing `async function bootstrap(): Promise<void>` — imported and awaited in main.tsx.

</specifics>

<deferred>
## Deferred Ideas

- Adding more languages (FR, IT, ES) — out of scope for v1.1; would need a language registry, flag icons, locale file CI check.
- i18n pluralization / ICU MessageFormat — no plural forms in current keys; add when needed.
- Locale-specific number/date/currency formatting (Intl.NumberFormat for revenue values) — belongs in a Dashboard i18n phase.
- RTL layout support — not needed for DE/EN.
- Playwright in CI — no CI exists yet; add when CI is set up.
- Additional visual regression testing (Playwright screenshot diffs) — beyond SC4 scope.
- Per-user language preference — conflicts with v1.0/v1.1 pre-auth single-CI model; belongs with Authentik phase.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 07-i18n-integration-and-polish*
*Context gathered: 2026-04-11*
