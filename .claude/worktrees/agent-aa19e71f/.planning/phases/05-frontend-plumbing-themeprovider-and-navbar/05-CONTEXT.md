# Phase 5: Frontend Plumbing — ThemeProvider and NavBar - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

On every app load, persisted settings from `GET /api/settings` are applied before any branded UI renders. Deliverables:

- A `<ThemeProvider>` component at the top of the React tree that:
  - Fetches settings once via TanStack Query
  - Gates the entire app behind a neutral skeleton while the fetch is in flight
  - On success, writes the 6 editable oklch tokens onto `document.documentElement` and sets `document.title`
  - On error, falls back to built-in frontend defaults and fires a sonner error toast
- A `useSettings()` hook exposing `{ data, isLoading, error }` for downstream consumers (NavBar now, Phase 6 Settings page later)
- NavBar updates:
  - Renders the stored logo (CSS-constrained ~56×56 inside the existing h-16 bar) **or** the stored `app_name` as text — never both
  - Removes `t('nav.brand')` in favor of `settings.app_name`
  - Adds a right-side Settings gear icon grouped with FreshnessIndicator and LanguageToggle
- A `/settings` route stub wired into wouter (empty page, real implementation lands in Phase 6)
- Frontend default palette constants (mirror of `backend/app/defaults.py`) so the error fallback works without a backend

Out of scope:
- Settings page UI (Phase 6)
- Color pickers, live preview mutation path, contrast badges (Phase 6)
- Logo upload UI (Phase 6)
- i18n `changeLanguage` based on `default_language` (Phase 7)
- Removing the `nav.brand` locale key (Phase 7's i18n pass)
- Any backend changes

</domain>

<decisions>
## Implementation Decisions

### FOUC / loading gate
- **D-01:** `<ThemeProvider>` blocks the full app behind a neutral full-screen skeleton while `GET /api/settings` is in flight. No children render until the query resolves (success OR error). This is the literal reading of Phase 5 success criterion #1.
- **D-02:** Skeleton uses neutral defaults only — background `oklch(0.97 0 0)` (near `--muted`), optional centered spinner/skeleton bars. Zero branded text, zero default "KPI Light" anywhere in the skeleton.
- **D-03:** On fetch error (network down, 500, etc.), ThemeProvider applies the frontend-side built-in default palette + default app name, renders the app, and fires a sonner error toast (e.g. `"Could not load settings — showing defaults"`). The app stays usable; last-write-wins philosophy carries over from the backend decisions.

### NavBar layout
- **D-04:** NavBar stays at `h-16` (64px). The 60×60 spec from BRAND-03 is interpreted as "that size class, CSS-constrained" — logo rendered with `max-h-14 max-w-14 object-contain` (~56×56 visual) to leave vertical padding. No change to `App.tsx` `pt-16`.
- **D-05:** Logo slot is **mutually exclusive** with the app-name text: if `settings.logo_url` is non-null, render `<img src={logo_url} alt={app_name}>`; otherwise render `<span>{app_name}</span>`. Matches BRAND-03 fallback wording exactly.
- **D-06:** The brand slot replaces the current `{t('nav.brand')}` span. Do NOT keep both translated text and logo. NavBar reads `settings.app_name` directly — brand is not localized.
- **D-07:** Settings link is a **right-side gear icon button** grouped with FreshnessIndicator and LanguageToggle. Primary nav (Dashboard, Upload) stays on the left; utilities live on the right. Use an existing lucide-react icon (already available via shadcn) — no new icon library.
- **D-08:** The `/settings` route is registered in `App.tsx` with a stub page component (`<SettingsPage />` that renders a placeholder). Phase 6 fills in the real UI without having to touch routing.
- **D-09:** `document.title` is set to `settings.app_name`. No page-specific title suffixes in v1.1 — none exist today, not worth inventing.

### CSS variable injection
- **D-10:** ThemeProvider writes CSS variables via `document.documentElement.style.setProperty(tokenName, value)` inside a `useEffect` keyed on `settings`. Inline styles on `<html>` have higher specificity than the `:root { ... }` block in `index.css`, so stored oklch values override defaults without needing `!important` or a style tag.
- **D-11:** Exactly **6 tokens** are written on each settings change: `--primary`, `--accent`, `--background`, `--foreground`, `--muted`, `--destructive`. Derived tokens (`--primary-foreground`, `--card`, `--border`, etc.) stay as defaults from `index.css` — contrast tradeoffs are Phase 6's problem via the WCAG badge.
- **D-12:** The setProperty function lives on ThemeProvider's side-effect path. Phase 6's live preview mutation will call the same function (via useSettings's queryClient cache update) — no separate "apply draft" pipeline. One writer, always from the cached settings state.

### Data layer
- **D-13:** TanStack Query config: `queryKey: ['settings']`, `staleTime: Infinity`, `gcTime: Infinity`. Fetched once on app load, never auto-refetches. Phase 6 Save mutation invalidates or uses `queryClient.setQueryData(['settings'], newData)` to update in place (live preview = optimistic cache update).
- **D-14:** `useSettings()` is a thin wrapper around `useQuery({ queryKey: ['settings'], queryFn: fetchSettings })`. It returns `{ data, isLoading, error }` — matches TanStack Query's default return shape for minimum surprise.
- **D-15:** `<ThemeProvider>` is the **single owner** of settings side effects. It subscribes to the same query (via useSettings or directly) and applies CSS vars + document.title in useEffect. NavBar and future Settings page are pure readers. This prevents duplicate applications and makes "who writes `:root`?" trivial to reason about.
- **D-16:** Frontend default palette lives in a new file `frontend/src/lib/defaults.ts` mirroring `backend/app/defaults.py`. Used by the error fallback and for the TypeScript `Settings` type. Duplication is intentional — no build-time cross-language import dance.
- **D-17:** TypeScript `Settings` type is defined in `frontend/src/lib/api.ts` next to `fetchSettings`, matching the existing pattern where request/response interfaces sit beside the fetchers (`UploadResponse`, `KpiSummary`, etc.).

### i18n interaction
- **D-18:** `t('nav.brand')` is removed from `NavBar.tsx` in this phase. The locale key itself in `de.json` / `en.json` is **left in place** — Phase 7's i18n pass will decide whether to delete it or repurpose it. Do not touch locale files in Phase 5.
- **D-19:** Phase 5 does NOT wire `i18n.changeLanguage(settings.default_language)`. The i18n init still hardcodes `lng: "de"` in `frontend/src/i18n.ts`. Phase 7 owns the language wiring — explicitly deferred per the REQUIREMENTS.md Phase 7 split (I18N-02).

### Claude's Discretion
- Exact skeleton visual (spinner vs shimmer bars vs blank with fade-in)
- Whether `<ThemeProvider>` is a wrapper component or a hook-based side-effect host + a gate component — downstream planner picks
- Whether the Settings gear icon has a tooltip/aria-label in DE + EN, and the key naming (`t('nav.settings')` most likely — but add the locale keys as needed)
- Whether `fetchSettings` lives in `lib/api.ts` alongside the existing fetchers or in a new `lib/settings.ts` (recommend the former, matches convention)
- Cache-busted logo URL handling: backend already returns `logo_url` with `?v=<epoch>` — frontend just uses it as-is. No frontend-side cache-buster logic.
- Test strategy: vitest + @testing-library/react for ThemeProvider loading/error states, NavBar logo/text fallback, setProperty side effects (jsdom supports it). MSW or plain fetch mocks — whichever matches existing v1.0 frontend test patterns.
- Whether to prefetch settings in `main.tsx` (before ReactDOM.createRoot) to shave a few ms off the skeleton — NOT required by success criteria, but a nice optimization if planner judges it cheap.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and scope
- `.planning/REQUIREMENTS.md` — BRAND-03, BRAND-06 are the primary requirements for this phase; BRAND-04 (cache-busting) is already satisfied by the backend URL shape
- `.planning/ROADMAP.md` §Phase 5 — goal statement and 4 success criteria
- `.planning/PROJECT.md` — v1.1 milestone goal, constraints, "global single CI, any user can edit"
- `.planning/phases/04-backend-schema-api-and-security/04-CONTEXT.md` — Phase 4 decisions that define the API contract this phase consumes (especially D-03, D-04 for `logo_url` shape)

### Existing frontend patterns (to reuse / match)
- `frontend/src/App.tsx` — Current provider nesting (`QueryClientProvider` → `NavBar` → `Switch`); ThemeProvider inserts between QueryClientProvider and NavBar
- `frontend/src/main.tsx` — React 19 root setup, `import "./i18n"` side-effect import
- `frontend/src/components/NavBar.tsx` — Current layout (`fixed top-0 inset-x-0 h-16 bg-card border-b`), brand text via `t('nav.brand')`, link class pattern, wouter `useLocation` for active state
- `frontend/src/index.css` §`:root` — The 6 semantic tokens already exist as oklch defaults; ThemeProvider overrides these at runtime
- `frontend/src/lib/api.ts` — Fetcher + interface colocation pattern; `fetchSettings` and `Settings` interface go here
- `frontend/src/lib/queryKeys.ts` — `kpiKeys.all` pattern; settings is simple enough to not need a key factory, but the `['settings']` key lives near here conceptually
- `frontend/src/i18n.ts` — Hardcoded `lng: "de"` — DO NOT change in this phase (Phase 7 owns it)
- `frontend/src/components/LanguageToggle.tsx` + `frontend/src/components/dashboard/FreshnessIndicator.tsx` — Examples of right-side NavBar utility components the Settings gear sits beside

### Stack rules (project-level)
- `CLAUDE.md` §Technology Stack — React 19, TanStack Query 5.97, Tailwind v4, shadcn/ui wraps @base-ui/react (use `render` prop, not `asChild`), wouter not react-router
- `CLAUDE.md` §Project — Docker Compose, no bare-metal deps

No external ADRs or spec docs exist for this project — requirements are fully captured in REQUIREMENTS.md and the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **TanStack Query client** — already instantiated in [frontend/src/App.tsx:8](frontend/src/App.tsx#L8); ThemeProvider inserts inside `QueryClientProvider`, not around it
- **Sonner Toaster** — already mounted in [frontend/src/App.tsx:20](frontend/src/App.tsx#L20); `import { toast } from "sonner"` for the error fallback toast
- **Fetcher + interface pattern** — [frontend/src/lib/api.ts](frontend/src/lib/api.ts) shows the convention: named interface + `async function fetchX(): Promise<X>` with `fetch("/api/...")` and `if (!res.ok) throw new Error(...)`. Reuse verbatim for `fetchSettings`
- **NavBar active-link pattern** — [frontend/src/components/NavBar.tsx:10-14](frontend/src/components/NavBar.tsx#L10-L14) — `linkClass(active)` helper; reuse or adapt for the Settings gear
- **shadcn + base-ui** — `frontend/src/components/ui/` has Button and other primitives (confirmed in Phase 3); gear icon button can use the existing Button primitive with `variant="ghost"` or similar
- **wouter `<Route>` + `<Switch>`** — [frontend/src/App.tsx:15-18](frontend/src/App.tsx#L15-L18) — add `<Route path="/settings" component={SettingsPage} />` alongside existing routes
- **`:root` CSS variables in oklch** — [frontend/src/index.css:58-91](frontend/src/index.css#L58-L91) — defaults already exist; ThemeProvider overrides via inline `<html>` styles

### Established patterns
- **Vite path alias `@/`** resolves to `frontend/src/` — used throughout; e.g. `@/components/LanguageToggle`
- **Side-effect imports in `main.tsx`** — `import "./index.css"; import "./i18n"` — if ThemeProvider needs any global CSS, it follows the same pattern
- **Tailwind v4 with `@theme` block** — [frontend/src/index.css:8-13](frontend/src/index.css#L8-L13) — class-based colors reference CSS vars via `--color-*` aliases; overriding `--primary` (var at `:root`) flows to `--color-primary` (alias) to Tailwind classes like `bg-primary`. This is what makes runtime theming possible with zero refactor of existing components.
- **`fetch("/api/...")` relative URLs** — proxied in dev via Vite config; `fetchSettings` uses the same relative path `/api/settings`

### Integration points
- **Insert `<ThemeProvider>`** in `frontend/src/App.tsx` between `<QueryClientProvider>` and `<NavBar>`:
  ```tsx
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <NavBar />
      <main className="pt-16">...</main>
    </ThemeProvider>
    <Toaster />
  </QueryClientProvider>
  ```
  Note: Toaster stays OUTSIDE ThemeProvider so error toasts can fire even during the fetch-error fallback path.
- **Add `/settings` route** in `App.tsx` `<Switch>` — with a stub `SettingsPage` component in `frontend/src/pages/SettingsPage.tsx` (Phase 6 replaces body)
- **Remove `t('nav.brand')`** in `frontend/src/components/NavBar.tsx:19` — replace with `settings.app_name` read via `useSettings()`
- **New files to create:**
  - `frontend/src/components/ThemeProvider.tsx` — gate + side-effect owner
  - `frontend/src/hooks/useSettings.ts` — TanStack Query wrapper
  - `frontend/src/lib/defaults.ts` — default palette + app name (mirror of backend)
  - `frontend/src/pages/SettingsPage.tsx` — stub page for Phase 6
- **Extend:**
  - `frontend/src/lib/api.ts` — add `Settings` interface + `fetchSettings()`
  - `frontend/src/App.tsx` — insert ThemeProvider wrapper + Settings route
  - `frontend/src/components/NavBar.tsx` — logo/text slot + gear icon

</code_context>

<specifics>
## Specific Ideas

- Test matrix (map directly to Phase 5 success criteria):
  1. ThemeProvider renders skeleton while GET /api/settings is pending — no `nav.brand` default text visible in the DOM
  2. With logo_url set: NavBar renders `<img>` with that URL; no brand-name text
  3. With logo_url null: NavBar renders `<span>{app_name}</span>`; no img
  4. `document.title` equals `settings.app_name` after load
  5. After load, `document.documentElement.style.getPropertyValue('--primary')` returns the stored oklch string
  6. `<Link href="/settings">` (the gear) appears in NavBar and navigates to the stub page
  7. Fetch error path: ThemeProvider applies defaults, renders the app, toast is fired
- Component-test focus: vitest + @testing-library/react + jsdom — the v1.0 frontend test setup already exists (from Phase 3). Planner should confirm which util file registers MSW or fetch mocks and reuse it.
- `logo_url` from Phase 4 is `/api/settings/logo?v=<epoch>` OR `null`. Treat `null` as the text-fallback trigger. No other sentinel (don't check for empty string).

</specifics>

<deferred>
## Deferred Ideas

- **Language wiring** (`i18n.changeLanguage(default_language)`) — Phase 7 (I18N-02). Even though `settings.default_language` is available in Phase 5, Phase 7 owns the i18n rewire because it also handles boot-order (no flash) and locale file translation.
- **Removing the `nav.brand` locale key from `de.json` / `en.json`** — Phase 7. Phase 5 only removes the `t('nav.brand')` *call site* in NavBar; the keys stay in the JSON files.
- **Page-specific document.title suffixes** — no pages have them today; not worth inventing. If added later, the per-page pattern would be useHead-style effects, not a ThemeProvider concern.
- **Dark mode** — already deferred to v1.2+ in REQUIREMENTS.md; `.dark` class in index.css stays untouched.
- **Prefetch settings in `main.tsx`** — possible micro-optimization to shave skeleton time; not a requirement. Planner decides if cheap.
- **Auto-derived foreground colors** — Phase 6 + culori, not Phase 5.
- **Settings-aware logo sizing variants** — the phrase "60×60 px, CSS-constrained" is final; no user-adjustable logo size.
- **`<DELETE /api/settings/logo>` endpoint exposure** — backend deferred this; no frontend hook needed.

</deferred>

---

*Phase: 05-frontend-plumbing-themeprovider-and-navbar*
*Context gathered: 2026-04-11*
