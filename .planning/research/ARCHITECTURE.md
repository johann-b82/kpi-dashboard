# Architecture Patterns

**Domain:** Internal KPI dashboard — v1.1 Branding & Settings integration
**Researched:** 2026-04-11
**Confidence:** HIGH (based on direct codebase inspection)

---

## v1.0 Architecture (Shipped — Reference Baseline)

Three-tier: browser frontend → FastAPI backend → PostgreSQL. All in a single Docker Compose stack.

```
┌─────────────────────────────────────────────────────┐
│                   Browser                           │
│  NavBar │ DashboardPage │ UploadPage                │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP REST + multipart
┌─────────────────────▼───────────────────────────────┐
│             FastAPI (app container)                 │
│                                                     │
│  routers/uploads.py  POST /api/uploads              │
│  routers/kpis.py     GET  /api/kpis                 │
│                       GET  /api/kpis/chart          │
│                       GET  /api/kpis/latest-upload  │
│                                                     │
│  models.py           UploadBatch, SalesRecord       │
│  schemas.py          Pydantic request/response      │
│  database.py         AsyncSession factory           │
│  parsing/            ERP parser + column mapping    │
└─────────────────────┬───────────────────────────────┘
                      │ asyncpg TCP 5432
┌─────────────────────▼───────────────────────────────┐
│            PostgreSQL (postgres container)          │
│                                                     │
│  upload_batches   — upload audit log                │
│  sales_records    — parsed ERP row data             │
└─────────────────────────────────────────────────────┘
```

**Existing Alembic migrations (3 files):**
- `be7013446181_initial_schema.py` — baseline tables
- `d7547428d885_phase2_full_sales_schema.py` — full 38-column sales schema
- `phase3_order_date_index.py` — order_date index

**Existing frontend route tree (wouter):**
- `/` → `DashboardPage`
- `/upload` → `UploadPage`
- `NavBar` is a global fixed header rendered in `App.tsx` above the `<Switch>`

**Key observations from codebase inspection:**
- `NavBar.tsx` renders the brand name via `t("nav.brand")` — an i18n key, not a hardcoded string. The app name is already translatable but not DB-backed.
- `index.css` uses Tailwind v4 CSS custom properties. Theme variables (e.g., `--primary`, `--background`, `--foreground`) are defined in a `:root {}` block as oklch values. These are the injection points for runtime theme application.
- `App.tsx` wraps everything in `QueryClientProvider` then renders `<NavBar>` and `<Switch>`. No ThemeProvider exists yet.
- `main.py` includes routers via `app.include_router()`. Pattern: add `settings_router` the same way.
- `schemas.py` and `models.py` are single files. Settings will add new entries to both.
- `DropZone.tsx` is tightly coupled to ERP file upload (CSV/TXT accept filter, mutation to `/api/uploads`, KPI cache invalidation). It cannot be reused for logo upload as-is — a new `LogoDropZone` or a generalized variant is needed.

---

## v1.1 Integration Architecture

### System Diagram (with Settings layer added)

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser                                │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ThemeProvider (NEW — wraps entire app in App.tsx)       │   │
│  │  • Fetches GET /api/settings on mount                    │   │
│  │  • Injects CSS vars into document.documentElement.style  │   │
│  │  • Exposes useSettings() hook to consumers               │   │
│  │  • Holds draft state for live-preview                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  NavBar (MODIFIED)          SettingsPage (NEW)                  │
│  • Logo slot (60×60)        • Color pickers per CSS var         │
│  • app name from hook       • LogoUpload component              │
│  • Settings link added      • App name input                    │
│                             • Language default select           │
│                             • Live preview + Save button        │
│                                                                 │
│  DashboardPage (unchanged)  UploadPage (unchanged)              │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP REST
┌──────────────────────────────▼──────────────────────────────────┐
│                    FastAPI (app container)                       │
│                                                                 │
│  routers/settings.py (NEW)                                      │
│  • GET  /api/settings          → AppSettingsResponse            │
│  • PUT  /api/settings          ← AppSettingsUpdate body         │
│  • GET  /api/settings/logo     → Response(media_type=image/*)   │
│  • POST /api/settings/logo     ← multipart UploadFile           │
│                                                                 │
│  models.py (MODIFIED — add AppSettings model)                   │
│  schemas.py (MODIFIED — add AppSettingsResponse/Update)         │
│  main.py (MODIFIED — include settings_router)                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │ asyncpg TCP 5432
┌──────────────────────────────▼──────────────────────────────────┐
│                         PostgreSQL                              │
│                                                                 │
│  app_settings (NEW, single-row)                                 │
│  upload_batches / sales_records (unchanged)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Status | File Path | Responsibility |
|-----------|--------|-----------|----------------|
| `app_settings` table | NEW | via Alembic migration | Single-row settings store |
| `AppSettings` SQLAlchemy model | NEW | `backend/app/models.py` | ORM mapping for settings row |
| `AppSettingsResponse` / `AppSettingsUpdate` | NEW | `backend/app/schemas.py` | Pydantic I/O contracts |
| `routers/settings.py` | NEW | `backend/app/routers/settings.py` | GET/PUT settings, GET/POST logo |
| `main.py` | MODIFIED | `backend/app/main.py` | Include `settings_router` |
| Alembic migration | NEW | `backend/alembic/versions/` | Add `app_settings` table |
| `ThemeProvider` | NEW | `frontend/src/contexts/ThemeContext.tsx` | Fetch settings, inject CSS vars, expose hook |
| `App.tsx` | MODIFIED | `frontend/src/App.tsx` | Wrap tree in `ThemeProvider`; add `/settings` route |
| `NavBar.tsx` | MODIFIED | `frontend/src/components/NavBar.tsx` | Add logo slot, app-name from `useSettings()`, Settings link |
| `SettingsPage` | NEW | `frontend/src/pages/SettingsPage.tsx` | Color pickers, logo upload, app name, language default |
| `LogoUpload` | NEW | `frontend/src/components/settings/LogoUpload.tsx` | PNG/SVG logo drop + preview; separate from `DropZone` |
| `ColorPicker` | NEW | `frontend/src/components/settings/ColorPicker.tsx` | Per-CSS-var color input (hex input + native `<input type="color">`) |
| `DropZone.tsx` | UNCHANGED | `frontend/src/components/DropZone.tsx` | ERP file upload only — do not generalize |

---

## Database Schema: `app_settings`

**Decision: Single-row table with typed columns (not key/value, not JSONB)**

Rationale: There are fewer than 15 known settings. Typed columns give Pydantic validation for free, make queries trivial (`SELECT * FROM app_settings WHERE id = 1`), and avoid schema-less JSON blobs that complicate future migrations. JSONB would be appropriate only if settings were user-extensible or unknown at design time — they are not here.

**Logo storage: `bytea` column directly in the table**

Rationale: Logo is a single small file (max 1 MB per spec). Storing as `bytea` avoids introducing a volume mount or file-system path dependency. The v1.0 architecture explicitly avoids file storage (Anti-Pattern 1 in v1.0 ARCHITECTURE.md referred to sales data files, not settings assets — a 1 MB logo is categorically different from raw data files). `bytea` keeps the settings self-contained and backup-friendly.

```sql
CREATE TABLE app_settings (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  -- Constraint: only one row allowed
  CONSTRAINT single_row CHECK (id = 1),

  -- Branding
  app_name         TEXT    NOT NULL DEFAULT 'KPI Light',
  logo_data        BYTEA   NULL,           -- raw PNG/SVG bytes
  logo_mime_type   TEXT    NULL,           -- 'image/png' | 'image/svg+xml'
  logo_updated_at  TIMESTAMPTZ NULL,       -- used as cache-buster ETag source

  -- Theme (store as CSS-compatible strings, e.g. oklch(...) or hex)
  color_primary          TEXT NULL,
  color_primary_fg       TEXT NULL,
  color_accent           TEXT NULL,
  color_accent_fg        TEXT NULL,
  color_background       TEXT NULL,
  color_foreground       TEXT NULL,
  color_muted            TEXT NULL,
  color_muted_fg         TEXT NULL,
  color_destructive      TEXT NULL,

  -- i18n
  default_language TEXT NOT NULL DEFAULT 'de',   -- 'de' | 'en'

  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the single row on migration
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
```

**Alembic strategy:** Add as a new migration file following the existing naming convention. The migration both creates the table and seeds the single row. No existing tables are touched.

---

## Backend API: `routers/settings.py`

```python
# Endpoints
GET  /api/settings          → AppSettingsResponse   (all settings except logo bytes)
PUT  /api/settings          ← AppSettingsUpdate     (partial update, logo excluded)
GET  /api/settings/logo     → Response(bytes, media_type=logo_mime_type)
POST /api/settings/logo     ← UploadFile (PNG/SVG, max 1 MB)
```

**`GET /api/settings`** — Returns all settings except `logo_data` bytes. Returns `logo_url: "/api/settings/logo"` and `logo_updated_at` (ISO string) for cache-busting. Frontend appends `?v={logo_updated_at}` to bust browser image cache.

**`PUT /api/settings`** — JSON body, partial update. Validates color values are valid CSS color strings (regex or cssutils). Updates `updated_at`. Returns the full updated `AppSettingsResponse`.

**`GET /api/settings/logo`** — Returns raw bytes with correct `Content-Type` header. Returns HTTP 404 if `logo_data IS NULL` (frontend falls back to text logo). Sets `ETag` header from `logo_updated_at` for HTTP-level caching.

**`POST /api/settings/logo`** — Accepts `multipart/form-data` with a single `UploadFile`. Validates MIME type (`image/png` or `image/svg+xml`) and size (≤ 1 MB). Stores bytes + mime_type + updates `logo_updated_at`. Returns updated `AppSettingsResponse`.

**Pydantic schemas to add to `backend/app/schemas.py`:**

```python
class AppSettingsResponse(BaseModel):
    app_name: str
    logo_url: str | None          # "/api/settings/logo" or None
    logo_updated_at: datetime | None
    color_primary: str | None
    color_primary_fg: str | None
    color_accent: str | None
    color_accent_fg: str | None
    color_background: str | None
    color_foreground: str | None
    color_muted: str | None
    color_muted_fg: str | None
    color_destructive: str | None
    default_language: str         # "de" | "en"
    updated_at: datetime

class AppSettingsUpdate(BaseModel):
    app_name: str | None = None
    color_primary: str | None = None
    color_primary_fg: str | None = None
    color_accent: str | None = None
    color_accent_fg: str | None = None
    color_background: str | None = None
    color_foreground: str | None = None
    color_muted: str | None = None
    color_muted_fg: str | None = None
    color_destructive: str | None = None
    default_language: str | None = None
```

---

## Frontend: ThemeProvider

**Location:** `frontend/src/contexts/ThemeContext.tsx`

**Role:** Fetches `GET /api/settings` once on app mount (via TanStack Query), injects non-null color values as inline style properties on `document.documentElement`, exposes `useSettings()` hook.

**Why inline styles on `documentElement` and not a CSS file rewrite:**
- Tailwind v4 in this project uses CSS custom properties (e.g., `--primary`, `--background`) defined in `:root {}` in `index.css`. Inline styles on `:root` (`document.documentElement.style.setProperty('--primary', value)`) override the stylesheet-defined values with highest specificity within the same cascade layer. This is the correct, minimal-footprint approach — no stylesheet mutation, no `<style>` tag injection.
- The `@theme inline` block in `index.css` maps Tailwind color tokens to these CSS vars (e.g., `--color-primary: var(--primary)`). So overriding `--primary` at runtime automatically propagates to all Tailwind utility classes that use `bg-primary`, `text-primary`, etc.

**Initial-load flash prevention (SSR-less Vite context):**
- There is no SSR. On cold load, the browser paints with the CSS-file defaults first, then after the settings fetch resolves (~1 network round-trip), `ThemeProvider` injects overrides. For internal tooling this is acceptable. If flash is objectionable, a future mitigation is an inline `<script>` in `index.html` that reads settings from localStorage and applies vars synchronously — but this adds complexity and should be deferred.
- TanStack Query should set `staleTime: Infinity` for settings (they change only on explicit user save, not on interval) and `gcTime: Infinity` to keep the cache warm across navigations.

**Draft state for live preview:**
- `SettingsPage` maintains its own local `draft` state (a copy of current settings). Color/name changes update `draft` immediately — `ThemeProvider` exposes a `previewSettings(draft)` function that re-injects CSS vars without persisting. On "Save", the page calls `PUT /api/settings`, which on success invalidates the settings query, causing `ThemeProvider` to refetch and lock in the saved values.

```tsx
// Simplified ThemeProvider interface
interface ThemeContextValue {
  settings: AppSettingsResponse | undefined;
  isLoading: boolean;
  previewSettings: (draft: Partial<AppSettingsResponse>) => void;
  resetPreview: () => void;
}
```

**Integration in `App.tsx`:**
```tsx
// App.tsx — modified
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>           {/* NEW — wraps everything below */}
        <NavBar />
        <main className="pt-16">
          <Switch>
            <Route path="/" component={DashboardPage} />
            <Route path="/upload" component={UploadPage} />
            <Route path="/settings" component={SettingsPage} />  {/* NEW */}
          </Switch>
        </main>
        <Toaster position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

`QueryClientProvider` must remain the outer wrapper so `ThemeProvider` can use TanStack Query internally.

---

## Frontend: NavBar Modifications

**File:** `frontend/src/components/NavBar.tsx` (MODIFIED)

Changes needed:
1. Replace `t("nav.brand")` span with a composite brand slot: if `settings.logo_url` is set, render `<img src="{logo_url}?v={logo_updated_at}" className="h-[60px] w-[60px] object-contain" />` alongside or instead of the text name. If no logo, show app name text from `settings.app_name ?? t("nav.brand")`.
2. Add `<Link href="/settings">` with the same `linkClass` pattern as existing nav links.
3. Pull `settings` from `useSettings()` hook.

No structural refactor needed — the existing flexbox layout accommodates the logo slot on the left side.

---

## Frontend: SettingsPage

**File:** `frontend/src/pages/SettingsPage.tsx` (NEW)

**Layout:** Standard page card, matching DashboardPage/UploadPage visual pattern.

**Sections:**
1. **Branding** — App name text input + LogoUpload component
2. **Theme** — Grid of ColorPicker components, one per editable CSS var
3. **Localization** — `<select>` for default language (DE / EN)
4. **Actions** — "Preview" (implicit, as editing drives live preview) + "Save" button + "Reset to defaults" link

**LogoUpload (`frontend/src/components/settings/LogoUpload.tsx`):**
- Uses `react-dropzone` (already installed via `DropZone.tsx`) with `accept: { "image/png": [".png"], "image/svg+xml": [".svg"] }` and `maxSize: 1_048_576`.
- On drop, calls `POST /api/settings/logo` via a dedicated TanStack Query mutation.
- Does NOT reuse `DropZone.tsx` — that component is coupled to ERP upload callbacks and KPI cache invalidation. A separate component avoids conditional branching and keeps responsibilities clean.
- Shows current logo preview (from `useSettings()`) above the drop target.

**ColorPicker (`frontend/src/components/settings/ColorPicker.tsx`):**
- Props: `label`, `varName` (e.g., `"--primary"`), `value`, `onChange`.
- Renders a label + `<input type="color">` (native browser color wheel) + a hex text input for precise entry.
- Color values stored internally as hex strings (simpler for `<input type="color">`). The backend receives and stores whatever CSS-compatible string is passed. On injection into CSS vars, hex strings work natively — no oklch conversion required.
- Note: The existing `:root` defaults use oklch. New user-set values will be hex. This is valid CSS — mixing color spaces in custom properties is fine since the browser resolves them at paint time.

---

## Theme Application Flow (End-to-End)

```
App cold load:
1. main.tsx renders <App> → <QueryClientProvider> → <ThemeProvider>
2. ThemeProvider fires useQuery({ queryKey: ["settings"], ... })
3. During loading: CSS-file defaults apply (index.css :root block)
4. Fetch resolves → ThemeProvider calls applySettings(data):
   - For each non-null color field → document.documentElement.style.setProperty(cssVar, value)
   - Sets document.title = settings.app_name
   - Calls i18n.changeLanguage(settings.default_language) if browser detection
     hasn't already matched user preference

Settings live-preview (SettingsPage editing):
5. User changes a color picker → draft state updates → previewSettings(draft) called
6. ThemeProvider injects draft CSS vars immediately (no network round-trip)
7. All pages/components re-render with new var values (CSS cascade handles this)

Settings save:
8. User clicks Save → PUT /api/settings with draft body
9. On success: queryClient.invalidateQueries({ queryKey: ["settings"] })
10. ThemeProvider refetches → reapplies persisted values
11. logo_updated_at changes on logo save → NavBar img src ?v= param changes → browser re-fetches logo

Logo cache-busting:
- NavBar renders: <img src={`/api/settings/logo?v=${settings.logo_updated_at}`} />
- When logo is updated, logo_updated_at changes → URL changes → browser fetches new image
- No ETag complexity needed on the client side — query param is sufficient for internal tooling
```

---

## Impact on Existing Pages

| Page/Component | Impact | Change Required |
|----------------|--------|-----------------|
| `DashboardPage.tsx` | None | No change |
| `UploadPage.tsx` | None | No change |
| `DropZone.tsx` | None | No change |
| `App.tsx` | MODIFIED | Add `ThemeProvider` wrapper + `/settings` route |
| `NavBar.tsx` | MODIFIED | Logo slot + app name from hook + Settings nav link |
| `main.tsx` | None | No change |
| `index.css` | None (no changes to CSS file) | CSS vars overridden at runtime via JS, not by editing the file |
| `schemas.py` | MODIFIED | Add `AppSettingsResponse`, `AppSettingsUpdate` |
| `models.py` | MODIFIED | Add `AppSettings` SQLAlchemy model |
| `main.py` | MODIFIED | `app.include_router(settings_router)` |
| i18n locale files | MODIFIED | Add `nav.settings` key (and possibly `settings.*` keys for the settings page UI) |

`DashboardPage` and `UploadPage` require **zero changes** — they consume Tailwind utility classes that reference the CSS vars, so theme changes propagate automatically through the cascade without touching those files.

---

## Build Order / Phase Breakdown

**Constraint:** Schema before API, API before UI, ThemeProvider before color editor.

```
Phase 1: Backend — Database schema + API
  1a. Add AppSettings SQLAlchemy model to backend/app/models.py
  1b. Add Pydantic schemas to backend/app/schemas.py
  1c. Write Alembic migration (table + seed row)
  1d. Implement backend/app/routers/settings.py (GET/PUT /api/settings)
  1e. Register router in backend/app/main.py
  1f. Implement GET/POST /api/settings/logo endpoints
  → Deliverable: curl-testable settings API, logo round-trip works

Phase 2: Frontend plumbing — ThemeProvider + NavBar
  2a. Create frontend/src/contexts/ThemeContext.tsx (ThemeProvider + useSettings hook)
  2b. Modify frontend/src/App.tsx: wrap with ThemeProvider, add /settings route
  2c. Modify frontend/src/components/NavBar.tsx: logo slot, app name, Settings link
  → Deliverable: App loads settings on mount, CSS vars injected, NavBar shows name from DB
  → This must come before SettingsPage because SettingsPage calls previewSettings()
     which is exposed by ThemeProvider

Phase 3: Frontend — SettingsPage + sub-components
  3a. Create frontend/src/components/settings/ColorPicker.tsx
  3b. Create frontend/src/components/settings/LogoUpload.tsx
  3c. Create frontend/src/pages/SettingsPage.tsx (assembles sub-components)
  3d. Wire live-preview: draft state → previewSettings() → CSS var injection
  3e. Wire Save: PUT /api/settings + settings query invalidation
  → Deliverable: Full settings UX functional end-to-end

Phase 4: i18n + polish
  4a. Add settings page translation keys to DE/EN locale files
  4b. Wire default_language setting to i18n.changeLanguage() in ThemeProvider
  4c. Reset-to-defaults logic (PUT with null values → backend returns CSS-file defaults)
  → Deliverable: Language default persists across sessions; settings page fully translated
```

**Why this order minimizes rework:**
- Schema first: API can be developed and tested via curl before any frontend exists. If schema needs adjustment, it's cheap to add another Alembic migration.
- ThemeProvider before SettingsPage: `SettingsPage` depends on `previewSettings()` from `ThemeContext`. Building the provider first means the page can be developed against a real context, not a mock.
- NavBar after ThemeProvider: NavBar consumes `useSettings()`, so the context must exist first.
- i18n last: Translation keys can be added any time without blocking functionality — English strings work as fallback. Deferring keeps phase 3 focused on interaction logic.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Logo on the Filesystem
**What:** Saving logo PNG to a Docker volume path and serving it statically.
**Why bad:** Adds a volume mount dependency, complicates backup, and requires the API container to have write access to shared storage. The v1 Compose stack has no shared volume between api and frontend containers.
**Instead:** Store as `bytea` in Postgres, serve via `GET /api/settings/logo`.

### Anti-Pattern 2: Writing CSS Vars Back to index.css at Runtime
**What:** Using the settings API to rewrite `index.css` or inject a `<style>` tag with new `:root {}` values.
**Why bad:** Requires server-side file mutation inside the container (read-only build artifact), and `<style>` injection fights with Tailwind's cascade specificity unpredictably.
**Instead:** Use `document.documentElement.style.setProperty()` — inline styles on `:root` override stylesheet rules within the same origin without mutation.

### Anti-Pattern 3: Per-User Settings
**What:** Scoping settings to an authenticated user session.
**Why bad:** Auth is deferred to v2. Per-user scoping requires the user identity layer that doesn't exist yet.
**Instead:** Single global row (`id = 1`, enforced by CHECK constraint). Any user can edit. This matches the v1.0 pre-auth model explicitly.

### Anti-Pattern 4: Reusing DropZone for Logo Upload
**What:** Adding a `mode` prop to `DropZone.tsx` to handle both ERP file upload and logo upload.
**Why bad:** `DropZone.tsx` is coupled to `kpiKeys` cache invalidation, `UploadResponse` type, and ERP-specific accept filters. Conditional branching on `mode` creates a fragile dual-purpose component.
**Instead:** New `LogoUpload` component that reuses `react-dropzone` (the library) but not `DropZone.tsx` (the component).

### Anti-Pattern 5: Polling Settings on Every Page
**What:** Each page independently queries `GET /api/settings`.
**Why bad:** Redundant network requests, inconsistent state between pages if one refetches and another doesn't.
**Instead:** Single `useQuery` in `ThemeProvider` at app root. All consumers call `useSettings()` which reads from context — one fetch, shared state.

---

## Scalability Notes

Settings are read on every app mount and cached indefinitely (`staleTime: Infinity`). This is appropriate: settings change rarely (manual admin action), there are no concurrent users competing to update them (no auth in v1, single team), and the single-row table query is negligible Postgres load. No caching layer is needed.

---

## Sources

- Codebase direct inspection: `backend/app/main.py`, `backend/app/models.py`, `backend/app/schemas.py`, `backend/app/routers/kpis.py`, `frontend/src/App.tsx`, `frontend/src/components/NavBar.tsx`, `frontend/src/components/DropZone.tsx`, `frontend/src/index.css`, `frontend/src/main.tsx`
- Alembic migration history: `backend/alembic/versions/` (3 existing migrations confirmed)
- `.planning/PROJECT.md` — v1.1 feature spec and constraints
- Tailwind v4 CSS custom property cascade behavior: `index.css` `@theme inline` block confirms `--color-primary: var(--primary)` mapping
- `document.documentElement.style.setProperty` overrides stylesheet `:root` rules per CSS cascade specification (inline style > author stylesheet in same origin)
