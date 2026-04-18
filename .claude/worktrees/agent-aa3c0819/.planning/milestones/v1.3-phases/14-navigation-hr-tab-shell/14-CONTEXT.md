# Phase 14: Navigation & HR Tab Shell - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Rename existing "Dashboard" tab to "Sales", add a new "HR" tab with its own route, sync freshness indicator, and manual sync button. The HR page is a functional shell — Phase 15 populates it with KPI cards.

</domain>

<decisions>
## Implementation Decisions

### Tab Structure & Routing
- **D-01:** Keep `/` as the Sales (formerly Dashboard) route. Add `/hr` for the HR tab. No route change for existing pages — bookmarks/links continue to work.
- **D-02:** Rename `DashboardPage` to reflect "Sales" context internally. The NavBar link changes from `nav.dashboard` to `nav.sales`.
- **D-03:** Tab labels are bilingual: EN "Sales" / DE "Vertrieb" for the renamed tab, EN "HR" / DE "HR" for the new tab.

### HR Tab Content Shell
- **D-04:** HR page shows sync freshness indicator, "Daten aktualisieren" button, and a subtle placeholder message (e.g., "KPI-Karten folgen in Kuerze") until Phase 15 adds KPI cards.
- **D-05:** HR page reuses the same `max-w-7xl mx-auto px-6 py-8` layout wrapper as the Sales dashboard for visual consistency.

### Sync Freshness & Manual Sync
- **D-06:** Sync freshness appears at the top of the HR page content area, right-aligned in a header/toolbar row: "Letzte Synchronisierung: [timestamp] [Daten aktualisieren]"
- **D-07:** "Daten aktualisieren" button shows loading spinner and is disabled during sync. On success: brief green checkmark feedback, then revert. On error: red text with error message inline.
- **D-08:** When no sync has ever run: show "Noch nicht synchronisiert" with a subtle hint to configure Personio credentials in Settings. Guides the user to the setup flow.
- **D-09:** Sync freshness reads from `personio_sync_meta` singleton (last_synced_at, last_sync_status) — the same table hr_sync.py updates after each sync.

### FreshnessIndicator Scope
- **D-10:** NavBar FreshnessIndicator becomes contextual — only visible on Sales (`/`) and Upload (`/upload`) pages. Hidden on HR and Settings pages.
- **D-11:** HR page has its own inline sync freshness (D-06), separate from the NavBar upload freshness. Each tab shows its own relevant timestamp.
- **D-12:** NavBar uses `useLocation()` (already imported) to conditionally render FreshnessIndicator based on current route.

### Phase Boundary
- **D-13:** Phase 14 creates the HR page shell. Phase 15 fills it with KPI cards and backend aggregation endpoints. The "Daten aktualisieren" button and sync freshness are Phase 14 scope (they depend on Phase 13's sync API).
- **D-14:** No time filter on HR tab — user decision from v1.3 scoping. HR tab shows current period only.

### Claude's Discretion
- Internal component naming (HRPage vs HrDashboardPage)
- Whether to extract a shared SyncStatusBar component or inline the freshness/button into HRPage
- Backend endpoint for fetching sync meta (new GET endpoint or extend existing)
- Whether to rename DashboardPage.tsx file or just update the locale key

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Codebase
- `frontend/src/components/NavBar.tsx` — Current NavBar with tab links, FreshnessIndicator, LanguageToggle
- `frontend/src/App.tsx` — wouter Route/Switch configuration (3 routes: /, /upload, /settings)
- `frontend/src/pages/DashboardPage.tsx` — Current Sales dashboard (to be renamed/updated)
- `frontend/src/components/dashboard/FreshnessIndicator.tsx` — Upload freshness pattern to adapt for contextual display
- `frontend/src/locales/en.json` — nav.dashboard key to rename, new nav.sales and nav.hr keys
- `frontend/src/locales/de.json` — German translations for new/renamed keys

### Phase 13 Artifacts (Sync API)
- `backend/app/routers/sync.py` — POST /api/sync (manual sync), POST /api/sync/test (credential test)
- `backend/app/models.py` — PersonioSyncMeta model (last_synced_at, last_sync_status, last_sync_error)
- `backend/app/schemas.py` — SyncResult schema (response from POST /api/sync)
- `.planning/phases/13-sync-service-settings-extension/13-CONTEXT.md` — Phase 13 decisions (D-01 through D-17)

### Phase 12 Artifacts (HR Schema)
- `.planning/phases/12-hr-schema-personio-client/12-CONTEXT.md` — Phase 12 decisions on HR tables and Personio client

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FreshnessIndicator` component: Pattern for timestamp display with Intl.DateTimeFormat locale formatting. Can be adapted for sync freshness.
- `NavBar` linkClass helper: Active state styling with border-bottom + font-semibold. Reuse for new HR tab link.
- `useQuery` + `kpiKeys` pattern: TanStack Query key factory for data fetching. Extend for sync meta queries.
- `fetchLatestUpload` in api.ts: Pattern for simple GET fetcher functions.

### Established Patterns
- wouter for routing (Link, Route, Switch, useLocation)
- react-i18next for all user-facing strings (t() function)
- Tailwind utility classes for styling (no CSS modules)
- TanStack Query for all server state
- max-w-7xl container pattern for page content

### Integration Points
- App.tsx: Add new `<Route path="/hr" component={HRPage} />`
- NavBar.tsx: Add HR tab link, make FreshnessIndicator contextual
- api.ts: Add fetchSyncMeta function + SyncMeta type
- queryKeys.ts: Add sync-related query keys
- en.json / de.json: Add nav.sales, nav.hr, HR page strings

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches matching existing codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 14-navigation-hr-tab-shell*
*Context gathered: 2026-04-12*
