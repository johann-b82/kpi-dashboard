# Phase 14: Navigation & HR Tab Shell - Research

**Researched:** 2026-04-12
**Domain:** React frontend — wouter routing, react-i18next, TanStack Query, FastAPI backend (new GET endpoint)
**Confidence:** HIGH

## Summary

Phase 14 is a well-bounded, predominantly frontend task. The codebase is fully established: wouter handles routing, react-i18next handles bilingual strings, TanStack Query handles server state. All three are in active use with clear patterns to follow. The backend already has the `PersonioSyncMeta` model and data written by `hr_sync.py`; this phase only needs a new `GET /api/sync/meta` endpoint to expose that singleton row to the frontend.

The main work is: (1) rename the "Dashboard" nav link label from `nav.dashboard` to `nav.sales` in both locale files; (2) add an `<HRPage>` component and route `/hr` in `App.tsx`; (3) make `FreshnessIndicator` contextual to Sales/Upload routes only; (4) implement the HR page shell with inline sync freshness, "Daten aktualisieren" button, and placeholder content. All patterns are proven in the codebase — no novel dependencies or new libraries required.

No Alembic migration is needed: `personio_sync_meta` already exists from Phase 13. The only backend change is a new route handler on the existing `sync.py` router.

**Primary recommendation:** Follow the `FreshnessIndicator` + `kpiKeys` + `api.ts` fetcher pattern exactly. Add `syncKeys` to `queryKeys.ts`, add `fetchSyncMeta` to `api.ts`, add `GET /api/sync/meta` to `sync.py`, build `HRPage.tsx`, wire route in `App.tsx`, update locale files.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tab Structure & Routing**
- D-01: Keep `/` as the Sales (formerly Dashboard) route. Add `/hr` for the HR tab. No route change for existing pages.
- D-02: Rename `DashboardPage` to reflect "Sales" context internally. The NavBar link changes from `nav.dashboard` to `nav.sales`.
- D-03: Tab labels are bilingual: EN "Sales" / DE "Vertrieb" for the renamed tab, EN "HR" / DE "HR" for the new tab.

**HR Tab Content Shell**
- D-04: HR page shows sync freshness indicator, "Daten aktualisieren" button, and a subtle placeholder message (e.g., "KPI-Karten folgen in Kuerze") until Phase 15 adds KPI cards.
- D-05: HR page reuses the same `max-w-7xl mx-auto px-6 py-8` layout wrapper as the Sales dashboard for visual consistency.

**Sync Freshness & Manual Sync**
- D-06: Sync freshness appears at the top of the HR page content area, right-aligned in a header/toolbar row: "Letzte Synchronisierung: [timestamp] [Daten aktualisieren]"
- D-07: "Daten aktualisieren" button shows loading spinner and is disabled during sync. On success: brief green checkmark feedback, then revert. On error: red text with error message inline.
- D-08: When no sync has ever run: show "Noch nicht synchronisiert" with a subtle hint to configure Personio credentials in Settings.
- D-09: Sync freshness reads from `personio_sync_meta` singleton (last_synced_at, last_sync_status).

**FreshnessIndicator Scope**
- D-10: NavBar FreshnessIndicator becomes contextual — only visible on Sales (`/`) and Upload (`/upload`) pages. Hidden on HR and Settings pages.
- D-11: HR page has its own inline sync freshness (D-06), separate from the NavBar upload freshness.
- D-12: NavBar uses `useLocation()` (already imported) to conditionally render FreshnessIndicator based on current route.

**Phase Boundary**
- D-13: Phase 14 creates the HR page shell. Phase 15 fills it with KPI cards and backend aggregation endpoints.
- D-14: No time filter on HR tab — HR tab shows current period only.

### Claude's Discretion
- Internal component naming (HRPage vs HrDashboardPage)
- Whether to extract a shared SyncStatusBar component or inline the freshness/button into HRPage
- Backend endpoint for fetching sync meta (new GET endpoint or extend existing)
- Whether to rename DashboardPage.tsx file or just update the locale key

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NAV-01 | Existing "Dashboard" tab is renamed to "Sales" | Locale key `nav.dashboard` → `nav.sales` in both en.json and de.json; NavBar.tsx `t("nav.dashboard")` → `t("nav.sales")` |
| NAV-02 | New "HR" tab appears alongside "Sales" in NavBar navigation | Add `<Link href="/hr">` with `linkClass(location === "/hr")` pattern; add `/hr` Route in App.tsx; create HRPage component |
| NAV-03 | HR tab shows last Personio sync timestamp as freshness indicator | New `GET /api/sync/meta` backend endpoint; `fetchSyncMeta` in api.ts; `syncKeys` in queryKeys.ts; inline freshness display in HRPage |
</phase_requirements>

---

## Standard Stack

### Core (already installed — no new dependencies required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wouter | already installed | Routing — `Route`, `Switch`, `Link`, `useLocation` | Project router; `useLocation` already imported in NavBar |
| react-i18next | already installed | Bilingual strings via `t()` | All user-facing strings go through i18n; locale files are en.json / de.json |
| @tanstack/react-query | 5.97.0 | Server state for sync meta fetch + mutation | Established pattern for all API calls in this project |
| FastAPI | 0.135.3 | New GET endpoint on existing sync router | `sync.py` already registered in main.py |

No new npm packages. No new Python packages. No Alembic migration.

**Verified:** All dependencies present in existing codebase as of 2026-04-12.

---

## Architecture Patterns

### Recommended Project Structure Changes

```
frontend/src/
├── pages/
│   ├── DashboardPage.tsx       # rename internal references to "Sales", no file rename needed
│   └── HRPage.tsx              # NEW — HR tab shell
├── components/
│   └── NavBar.tsx              # update: nav.sales, add HR link, make FreshnessIndicator conditional
├── lib/
│   ├── api.ts                  # add: SyncMetaResponse type, fetchSyncMeta function, triggerSync already exists
│   └── queryKeys.ts            # add: syncKeys object alongside kpiKeys
├── locales/
│   ├── en.json                 # rename nav.dashboard → nav.sales, add nav.hr, hr.* strings
│   └── de.json                 # same as en.json
backend/app/routers/
└── sync.py                     # add: GET /api/sync/meta endpoint
```

### Pattern 1: Conditional NavBar element (D-10, D-12)

`useLocation()` is already imported and used in NavBar. Add a route guard array:

```typescript
// NavBar.tsx — conditionalize FreshnessIndicator
const [location] = useLocation();

const showUploadFreshness = location === "/" || location === "/upload";

// In JSX:
{showUploadFreshness && <FreshnessIndicator />}
```

**Source:** Established pattern — `linkClass(location === "/")` already does the same conditional based on `location`.

### Pattern 2: New Route in App.tsx

```typescript
// App.tsx — add after existing routes
import { HRPage } from "./pages/HRPage";

// Inside <Switch>:
<Route path="/hr" component={HRPage} />
```

**Source:** Existing pattern from App.tsx lines 20–22.

### Pattern 3: TanStack Query key factory extension

```typescript
// queryKeys.ts — add syncKeys alongside kpiKeys
export const syncKeys = {
  meta: () => ["sync", "meta"] as const,
};
```

**Source:** `kpiKeys.latestUpload: () => ["kpis", "latest-upload"] as const` — identical shape.

### Pattern 4: API fetcher for sync meta

```typescript
// api.ts — new types and fetcher
export interface SyncMetaResponse {
  last_synced_at: string | null;
  last_sync_status: "ok" | "error" | null;
  last_sync_error: string | null;
}

export async function fetchSyncMeta(): Promise<SyncMetaResponse> {
  const res = await fetch("/api/sync/meta");
  if (!res.ok) throw new Error("Failed to fetch sync meta");
  return res.json();
}
```

**Source:** `fetchLatestUpload` in api.ts lines 139–143 — identical shape.

### Pattern 5: Backend GET /api/sync/meta

```python
# sync.py — new endpoint appended to existing router
from app.models import PersonioSyncMeta
from app.schemas import SyncMetaRead  # new schema

@router.get("/meta", response_model=SyncMetaRead)
async def get_sync_meta(db: AsyncSession = Depends(get_async_db_session)) -> SyncMetaRead:
    """Return the personio_sync_meta singleton for HR freshness display."""
    result = await db.execute(select(PersonioSyncMeta).where(PersonioSyncMeta.id == 1))
    row = result.scalar_one_or_none()
    if row is None:
        return SyncMetaRead(last_synced_at=None, last_sync_status=None, last_sync_error=None)
    return SyncMetaRead.model_validate(row)
```

**Source:** Pattern mirrors `GET /api/kpis/latest-upload` in kpis.py — singleton fetch with None fallback.

### Pattern 6: Pydantic schema for sync meta response

```python
# schemas.py — append new schema
class SyncMetaRead(BaseModel):
    last_synced_at: datetime | None
    last_sync_status: str | None = None
    last_sync_error: str | None = None

    model_config = {"from_attributes": True}
```

### Pattern 7: HRPage structure (inline sync freshness, D-04 to D-09)

```typescript
// HRPage.tsx — key structural pattern
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchSyncMeta, triggerSync } from "@/lib/api";  // triggerSync = POST /api/sync
import { syncKeys } from "@/lib/queryKeys";

export function HRPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data: meta } = useQuery({
    queryKey: syncKeys.meta(),
    queryFn: fetchSyncMeta,
  });
  const [syncFeedback, setSyncFeedback] = useState<"idle" | "success" | "error">("idle");
  const [syncError, setSyncError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: triggerSync,  // POST /api/sync (already in api.ts)
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: syncKeys.meta() });
      setSyncFeedback("success");
      setTimeout(() => setSyncFeedback("idle"), 3000);
    },
    onError: (err) => {
      setSyncFeedback("error");
      setSyncError(err.message);
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Sync toolbar — D-06 */}
      <div className="flex justify-end items-center gap-3 mb-8">
        {/* freshness text */}
        {/* "Daten aktualisieren" button — D-07 */}
      </div>
      {/* Placeholder — D-04 */}
      <p className="text-muted-foreground text-sm">{t("hr.placeholder")}</p>
    </div>
  );
}
```

**Note on triggerSync:** POST /api/sync is already wired. The frontend needs a `triggerSync` wrapper in `api.ts` (returns `SyncResult`). Check if it already exists — if not, add it following the `testPersonioConnection` pattern.

### Pattern 8: Bilingual timestamp formatting

Reuse the exact `Intl.DateTimeFormat` pattern from `FreshnessIndicator.tsx`:

```typescript
const locale = i18n.language === "de" ? "de-DE" : "en-US";
const formatted = new Intl.DateTimeFormat(locale, {
  dateStyle: "short",
  timeStyle: "short",
}).format(new Date(meta.last_synced_at));
```

**Source:** FreshnessIndicator.tsx lines 23–27 — verified existing pattern.

### Anti-Patterns to Avoid

- **Do not rename DashboardPage.tsx.** D-02 says rename internal references. The file rename is Claude's discretion and adds risk (import path updates) with no user-visible benefit. Update the component internals and locale key only.
- **Do not add a `triggerSync` function if it already exists in api.ts.** Verify before adding — the file already has POST /api/sync wired via `testPersonioConnection`'s pattern, but there may not be a dedicated `triggerSync` export. Check before adding.
- **Do not use `useEffect` + `useState` for data fetching.** TanStack Query (`useQuery` / `useMutation`) is the project standard.
- **Do not hardcode strings in JSX.** Every user-facing string goes through `t()` with keys in both locale files.
- **Do not use `latest` Docker image tag.** Not relevant to this frontend/API phase, but noted per CLAUDE.md.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loading state on sync button | Manual `isLoading` boolean + setState | `mutation.isPending` from useMutation | TanStack Query tracks pending state automatically |
| Query cache invalidation after sync | Manual refetch call | `queryClient.invalidateQueries({ queryKey: syncKeys.meta() })` | Standard TanStack Query invalidation pattern |
| Timestamp locale formatting | Custom date formatter | `Intl.DateTimeFormat` with `i18n.language` check | Already proven in FreshnessIndicator |
| Route-based conditional rendering | Complex conditional logic | `useLocation()` comparison | Already used in NavBar linkClass helper |

---

## Common Pitfalls

### Pitfall 1: PersonioSyncMeta singleton may not exist (row id=1 missing)

**What goes wrong:** `GET /api/sync/meta` calls `scalar_one()` and crashes if no row has been inserted yet (first run before any sync).
**Why it happens:** `_update_sync_meta` in hr_sync.py uses `update()` not `insert()` — it only updates if the row exists. Whether the migration seeds a row depends on the Alembic migration.
**How to avoid:** Use `scalar_one_or_none()` and return a zero-state response (`last_synced_at=None, last_sync_status=None`) when row is missing. Verified: models.py has CHECK CONSTRAINT `id = 1` (singleton) but no guarantee of initial row presence.
**Warning signs:** HTTP 500 on `/api/sync/meta` on a fresh install before any sync.

**Action:** The backend endpoint must use `scalar_one_or_none()` and return a default SyncMetaRead with all nulls if missing. Cross-check whether the Alembic migration seeds this row — if not, the endpoint must handle the None case.

### Pitfall 2: POST /api/sync does not return SyncMetaRead — cache not fresh after mutation

**What goes wrong:** After "Daten aktualisieren" succeeds, the HR page still shows the old timestamp.
**Why it happens:** POST /api/sync returns `SyncResult` (employee/attendance counts), not the updated `last_synced_at`. Invalidating `syncKeys.meta()` triggers a re-fetch of `GET /api/sync/meta` which returns the updated value.
**How to avoid:** Always call `queryClient.invalidateQueries({ queryKey: syncKeys.meta() })` in `onSuccess` of the mutation. Do NOT try to compute the new timestamp client-side.

### Pitfall 3: FreshnessIndicator visible on HR page (D-10 violated)

**What goes wrong:** NavBar upload freshness indicator appears on the HR tab, confusing users (it shows data upload freshness, not Personio sync freshness).
**Why it happens:** FreshnessIndicator renders unconditionally in current NavBar.
**How to avoid:** Apply the `showUploadFreshness` location guard in NavBar (Pattern 1 above). Test by navigating to `/hr` and `/settings` and verifying the indicator is absent.

### Pitfall 4: nav.dashboard key left in one locale file

**What goes wrong:** German UI shows "Dashboard" while English shows "Sales" (or vice versa).
**Why it happens:** The key is renamed in en.json but not de.json (or vice versa).
**How to avoid:** Both locale files must have `nav.sales` added and `nav.dashboard` removed in the same task. Add both in one edit.

### Pitfall 5: `triggerSync` function missing in api.ts

**What goes wrong:** TypeScript compile error — `triggerSync` not exported from api.ts.
**Why it happens:** api.ts already has `testPersonioConnection` (POST /api/sync/test) but no dedicated `triggerSync` (POST /api/sync).
**How to avoid:** Check api.ts before building HRPage. If absent, add:
```typescript
export async function triggerSync(): Promise<SyncResult> {
  const res = await fetch("/api/sync", { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Sync failed" }));
    throw new Error(formatDetail(err.detail) || "Sync failed");
  }
  return res.json();
}
```

### Pitfall 6: i18n key collision risk

**What goes wrong:** Adding `nav.hr` or `hr.*` keys that conflict with existing namespace structure.
**Why it happens:** Both locale files use flat key structure. Naming collisions are not caught at compile time.
**How to avoid:** Prefix all HR page strings with `hr.` (e.g., `hr.sync.lastSynced`, `hr.sync.never`, `hr.sync.button`, `hr.sync.error`, `hr.placeholder`). Verify no existing keys use `hr.` prefix.

---

## Code Examples

### NavBar contextual FreshnessIndicator (D-10, D-12)

```typescript
// Source: NavBar.tsx existing pattern + useLocation already imported line 2
const [location] = useLocation();
const showUploadFreshness = location === "/" || location === "/upload";

// In JSX ml-auto div:
{showUploadFreshness && <FreshnessIndicator />}
```

### SyncMetaRead schema (new — schemas.py)

```python
# Source: established SettingsRead model_config pattern (schemas.py line 165)
class SyncMetaRead(BaseModel):
    last_synced_at: datetime | None
    last_sync_status: str | None = None
    last_sync_error: str | None = None

    model_config = {"from_attributes": True}
```

### HR page freshness display with never-synced state (D-08)

```typescript
// HRPage.tsx
{meta?.last_synced_at == null ? (
  <span className="text-xs text-muted-foreground">
    {t("hr.sync.never")} —{" "}
    <Link href="/settings" className="underline">
      {t("hr.sync.configureHint")}
    </Link>
  </span>
) : (
  <span className="text-xs text-muted-foreground">
    {t("hr.sync.lastSynced")} {formatted}
  </span>
)}
```

### Locale keys to add (en.json)

```json
"nav.sales": "Sales",
"nav.hr": "HR",
"hr.sync.lastSynced": "Last sync:",
"hr.sync.never": "Not yet synced",
"hr.sync.configureHint": "Configure Personio credentials in Settings",
"hr.sync.button": "Refresh data",
"hr.sync.success": "Sync complete",
"hr.sync.error": "Sync failed",
"hr.placeholder": "KPI cards coming soon"
```

### Locale keys to add (de.json)

```json
"nav.sales": "Vertrieb",
"nav.hr": "HR",
"hr.sync.lastSynced": "Letzte Synchronisierung:",
"hr.sync.never": "Noch nicht synchronisiert",
"hr.sync.configureHint": "Personio-Zugangsdaten in den Einstellungen konfigurieren",
"hr.sync.button": "Daten aktualisieren",
"hr.sync.success": "Synchronisierung abgeschlossen",
"hr.sync.error": "Synchronisierung fehlgeschlagen",
"hr.placeholder": "KPI-Karten folgen in Kuerze"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `nav.dashboard` key | `nav.sales` key | Phase 14 | NavBar link text changes; no route change |
| FreshnessIndicator always visible | Contextual by route | Phase 14 | Cleaner nav on HR/Settings pages |
| 3 routes (/, /upload, /settings) | 4 routes (adds /hr) | Phase 14 | New HR dashboard page reachable |

**No deprecated items in this phase.**

---

## Open Questions

1. **Does the Alembic migration seed a `personio_sync_meta` row?**
   - What we know: The model has CHECK CONSTRAINT `id = 1` (singleton). `hr_sync._update_sync_meta` uses `update()` not `insert_or_update()`.
   - What's unclear: Whether the migration inserts a seed row with nulls, or relies on the first sync to create it.
   - Recommendation: The plan should include a task to verify this. If no seed row exists, either fix the migration (risky — alters existing migration) or use `INSERT ... ON CONFLICT DO UPDATE` in the endpoint, or simply handle `scalar_one_or_none() → None` and return all-null SyncMetaRead. The null-return approach is safest.

2. **Is `triggerSync` (POST /api/sync wrapper) already in api.ts?**
   - What we know: `testPersonioConnection` calls POST /api/sync/test. No `triggerSync` export found in api.ts review.
   - What's unclear: Whether it was added outside the visible file content.
   - Recommendation: Plan task should add `triggerSync` to api.ts as first action before building HRPage.

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — this phase uses only existing Docker Compose stack and installed npm/Python packages).

---

## Validation Architecture

Step 4: SKIPPED — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`.

---

## Project Constraints (from CLAUDE.md)

| Constraint | Directive |
|------------|-----------|
| Containerization | Must run via Docker Compose — no bare-metal dependencies |
| Database | PostgreSQL only |
| Routing | wouter (not React Router) |
| State management | TanStack Query for server state — no Redux/Zustand for API data |
| Styling | Tailwind CSS utility classes — no CSS modules |
| Strings | react-i18next `t()` for all user-facing strings |
| Components | shadcn/ui copy-paste pattern — no native `<select>` shadcn |
| Migrations | Alembic only — never `Base.metadata.create_all()` |
| Docker Compose | Use `docker compose` (v2) — not `docker-compose` (v1) |
| Docker image | Never use `latest` tag for postgres |
| GSD workflow | All file changes via GSD workflow entry points |

---

## Sources

### Primary (HIGH confidence)

- Codebase direct read — `frontend/src/components/NavBar.tsx` — confirmed `useLocation` import, `linkClass` pattern, `FreshnessIndicator` unconditional render
- Codebase direct read — `frontend/src/App.tsx` — confirmed wouter Switch/Route pattern, 3 existing routes
- Codebase direct read — `frontend/src/components/dashboard/FreshnessIndicator.tsx` — confirmed Intl.DateTimeFormat + TanStack Query pattern
- Codebase direct read — `frontend/src/lib/api.ts` — confirmed no `triggerSync` export; SyncResult type exists; `fetchLatestUpload` pattern available
- Codebase direct read — `frontend/src/lib/queryKeys.ts` — confirmed `kpiKeys.latestUpload` as model for `syncKeys.meta`
- Codebase direct read — `backend/app/models.py` — confirmed `PersonioSyncMeta` with singleton CHECK constraint; all nullable fields
- Codebase direct read — `backend/app/routers/sync.py` — confirmed router prefix `/api/sync`; no GET endpoint exists
- Codebase direct read — `backend/app/schemas.py` — confirmed `SyncResult`, `SyncTestResult`; no `SyncMetaRead` yet
- Codebase direct read — `backend/app/main.py` — confirmed `sync_router` already included
- Codebase direct read — `backend/app/services/hr_sync.py` — confirmed `_update_sync_meta` uses `update()` (not insert), confirming the seed-row open question

### Secondary (MEDIUM confidence)

- `.planning/phases/14-navigation-hr-tab-shell/14-CONTEXT.md` — all locked decisions D-01 through D-14 verified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in codebase; no new dependencies
- Architecture: HIGH — all patterns traced to existing working code in repo
- Pitfalls: HIGH — most identified from direct code inspection (scalar_one vs scalar_one_or_none, missing triggerSync, locale key consistency)
- Open questions: MEDIUM — seed row question requires runtime verification

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable codebase; no fast-moving dependencies in this phase)
