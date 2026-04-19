---
phase: 46-admin-ui
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/package.json
  - frontend/src/App.tsx
  - frontend/src/pages/LauncherPage.tsx
  - frontend/src/lib/queryKeys.ts
  - frontend/src/signage/pages/SignagePage.tsx
  - frontend/src/signage/pages/MediaPage.tsx
  - frontend/src/signage/pages/PlaylistsPage.tsx
  - frontend/src/signage/pages/DevicesPage.tsx
  - frontend/src/locales/en.json
  - frontend/src/locales/de.json
autonomous: true
requirements:
  - SGN-ADM-01
  - SGN-ADM-02
  - SGN-ADM-03
  - SGN-ADM-10
must_haves:
  truths:
    - "Admin logs in and sees a MonitorPlay 'Digital Signage' tile on /"
    - "Viewer logs in and does NOT see the signage tile"
    - "Clicking the tile navigates to /signage which redirects to /signage/media"
    - "SignagePage renders a three-button nav group (Media / Playlists / Devices); active tab matches URL"
    - "All new launcher.tiles.signage + signage.admin.nav.* keys exist in BOTH en.json and de.json"
  artifacts:
    - path: frontend/src/signage/pages/SignagePage.tsx
      provides: "Tab shell component with URL-driven active state"
      contains: "initialTab"
    - path: frontend/src/signage/pages/MediaPage.tsx
      provides: "Media sub-page stub (expanded in 46-04)"
    - path: frontend/src/signage/pages/PlaylistsPage.tsx
      provides: "Playlists list stub (expanded in 46-05)"
    - path: frontend/src/signage/pages/DevicesPage.tsx
      provides: "Devices list stub (expanded in 46-06)"
    - path: frontend/package.json
      contains: "@dnd-kit/core"
  key_links:
    - from: frontend/src/App.tsx
      to: frontend/src/signage/pages/SignagePage.tsx
      via: "wouter Route entries wrapped in <AdminOnly>"
      pattern: "Route path=\"/signage"
    - from: frontend/src/pages/LauncherPage.tsx
      to: "/signage"
      via: "setLocation('/signage') inside <AdminOnly>"
      pattern: "/signage"
---

<objective>
Foundation layer for Phase 46: install all new npm dependencies, register `/signage/*` routes in App.tsx wrapped in `<AdminOnly>`, add the admin-only MonitorPlay launcher tile, build the `SignagePage` tab shell + three empty sub-page stubs (MediaPage / PlaylistsPage / DevicesPage), extend `queryKeys.ts` with `signageKeys`, and seed both locale files with the navigation keys.

Purpose: Unblocks 46-02 through 46-06 by establishing routing, deps, and the i18n namespace. Without this, sub-page plans have no parent shell and no locale keys to reference.

Output: Clickable `/signage` route that lands on an empty Media tab with working tab navigation. All deps installed. Locale parity intact.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/46-admin-ui/46-CONTEXT.md
@.planning/phases/46-admin-ui/46-RESEARCH.md
@.planning/phases/46-admin-ui/46-UI-SPEC.md

<interfaces>
<!-- Existing stable contracts the executor needs. -->

From frontend/src/App.tsx (current <Switch> structure — routes are flat, order matters):
```tsx
import { Route, Switch, useLocation } from "wouter";
// existing: /login, /sales, /, /upload, /hr, /sensors, /settings/sensors, /settings, /docs/:section/:slug, /docs
```

From frontend/src/auth/AdminOnly.tsx:
```tsx
// Wraps children; renders null (or redirects) when user role != admin.
export function AdminOnly({ children }: { children: React.ReactNode }): JSX.Element | null;
```

From frontend/src/pages/LauncherPage.tsx (existing tile pattern — follow verbatim):
```tsx
// Tile is a button with w-[120px] h-[120px] rounded-2xl bg-card border border-border
// hover:bg-accent/10, focus-visible:ring-2 focus-visible:ring-ring
// Icon: <LucideIcon className="w-10 h-10 text-foreground" aria-hidden="true" />
// Label: text-xs text-muted-foreground text-center below tile
// Admin-only tiles wrap ENTIRE tile-column div in <AdminOnly>
// Existing keys: launcher.tile.kpi_dashboard, launcher.tile.sensors, launcher.tile.coming_soon
```

From frontend/src/lib/queryKeys.ts (append pattern — follow kpiKeys/sensorKeys):
```ts
export const kpiKeys = { all: ["kpis"] as const, ... };
export const sensorKeys = { all: ["sensors"] as const, ... };
// ADD: signageKeys with the same shape pattern.
```

Locale files use FLAT DOTTED KEYS (not nested objects). Example existing keys:
```json
"launcher.tile.kpi_dashboard": "KPI Dashboard",
"launcher.tile.sensors": "Sensor Monitor",
"nav.brand": "KPI Dashboard"
```
NEW key per D-16 (locked): `launcher.tiles.signage` (plural `tiles` — intentional deviation from existing singular convention; do NOT rename existing keys).

From 46-RESEARCH.md (verified versions on npm 2026-04-19):
- @dnd-kit/core@6.3.1
- @dnd-kit/sortable@10.0.0
- @dnd-kit/utilities@3.2.2
- react-pdf@10.4.1

From 46-UI-SPEC.md "Routing Contract" — exact route declaration block:
```tsx
<Route path="/signage/playlists/:id"> ... </Route>   // MUST be before /signage/playlists
<Route path="/signage/playlists"> ... </Route>
<Route path="/signage/devices"> ... </Route>
<Route path="/signage/media"> ... </Route>
<Route path="/signage/pair"> ... </Route>
<Route path="/signage"> ... </Route>                 // redirect to /signage/media
```
In this plan: only register the stub routes. `/signage/playlists/:id` and `/signage/pair` routes will be added by 46-05 and 46-06 respectively (sibling changes to App.tsx).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Install deps, create signage directory tree, extend queryKeys.ts</name>
  <read_first>
    - frontend/package.json
    - frontend/src/lib/queryKeys.ts
    - 46-RESEARCH.md §"New Dependencies This Phase"
  </read_first>
  <files>
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/src/lib/queryKeys.ts
    - frontend/src/signage/pages/SignagePage.tsx (create placeholder dir)
    - frontend/src/signage/components/.gitkeep
    - frontend/src/signage/player/.gitkeep
  </files>
  <action>
    Run in frontend/ directory (use Bash cwd = /Users/johannbechtold/Documents/kpi-dashboard/frontend):
      npm install @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/utilities@3.2.2 react-pdf@10.4.1

    Create the signage directory tree with .gitkeep placeholders:
      mkdir -p frontend/src/signage/pages frontend/src/signage/components frontend/src/signage/player
      touch frontend/src/signage/components/.gitkeep frontend/src/signage/player/.gitkeep

    Extend `frontend/src/lib/queryKeys.ts` by appending (do not modify existing exports):
    ```ts
    /**
     * Phase 46 — signage admin query keys. Mirrors sensorKeys shape.
     * media()/playlists()/devices()/tags() are the top-level collections.
     * Item-level keys embed the id for per-row invalidation (e.g. PPTX polling).
     */
    export const signageKeys = {
      all: ["signage"] as const,
      media: () => ["signage", "media"] as const,
      mediaItem: (id: string) => ["signage", "media", id] as const,
      playlists: () => ["signage", "playlists"] as const,
      playlistItem: (id: string) => ["signage", "playlists", id] as const,
      devices: () => ["signage", "devices"] as const,
      tags: () => ["signage", "tags"] as const,
    };
    ```

    Do NOT set an `overrides` block on `pdfjs-dist` (D-11 / RESEARCH: Phase 47 owns that pin; adding it here breaks react-pdf's internal worker).
  </action>
  <verify>
    <automated>cd frontend && npm ls @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-pdf --depth=0 | grep -E "@dnd-kit/(core|sortable|utilities)@|react-pdf@" | wc -l | grep -q "^4$" && grep -q "signageKeys" src/lib/queryKeys.ts && test -d src/signage/pages && test -d src/signage/components && test -d src/signage/player</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "\"@dnd-kit/core\"" frontend/package.json` returns ≥1
    - `grep -c "\"@dnd-kit/sortable\"" frontend/package.json` returns ≥1
    - `grep -c "\"@dnd-kit/utilities\"" frontend/package.json` returns ≥1
    - `grep -c "\"react-pdf\"" frontend/package.json` returns ≥1
    - `grep -c "export const signageKeys" frontend/src/lib/queryKeys.ts` returns exactly 1
    - `grep -c "mediaItem\|playlistItem" frontend/src/lib/queryKeys.ts` returns ≥2
    - Directories `frontend/src/signage/{pages,components,player}` all exist (test -d)
    - `grep -c "\"pdfjs-dist\"" frontend/package.json` returns 0 (not a direct dep in Phase 46)
    - `grep -c "overrides" frontend/package.json` matches pre-change count (no new overrides added)
  </acceptance_criteria>
  <done>All 4 new npm packages installed at exact versions; signageKeys factory exported; signage/ directory tree present; no pdfjs-dist override leaked in.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add signage locale keys to en.json and de.json</name>
  <read_first>
    - frontend/src/locales/en.json (confirm flat-dotted-key format)
    - frontend/src/locales/de.json (confirm parity with en.json before edit)
    - 46-UI-SPEC.md §"Copywriting Contract" (full EN + DE tables — source of truth)
    - frontend/scripts/check-locale-parity.mts
  </read_first>
  <files>
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
  </files>
  <action>
    Add EVERY key from 46-UI-SPEC.md §"Copywriting Contract" to BOTH `frontend/src/locales/en.json` and `frontend/src/locales/de.json`. Use the EXACT copy from the spec tables (English table for en.json; German "du" table for de.json).

    Keys to add (flat dotted, as sibling entries to existing keys — NOT nested objects):

    Launcher tile:
      launcher.tiles.signage

    Navigation / page:
      signage.admin.page_title
      signage.admin.nav.media
      signage.admin.nav.playlists
      signage.admin.nav.devices

    Media (25 keys): signage.admin.media.upload_title, upload_or, browse_button, accepted_formats, register_url_button, register_url_title, register_url_label, register_url_cta, empty_title, empty_body, delete_title, delete_body, delete_confirm, delete_cancel, delete_in_use_title, delete_in_use_body, delete_in_use_close, status.pending, status.processing, status.done, status.failed

    Playlists list (10 keys): signage.admin.playlists.new_button, empty_title, empty_body, empty_cta, delete_title, delete_body, delete_confirm, delete_cancel, col_name, col_tags, col_items, col_created, col_actions

    Playlist editor (15 keys): signage.admin.editor.name_placeholder, save, cancel, add_item, empty_title, empty_body, duration_label, transition_label, transition_fade, transition_cut, saved, save_error; signage.admin.preview.label; signage.admin.unsaved.title, body, cancel, confirm

    Devices (16 keys): signage.admin.devices.pair_button, empty_title, empty_body, empty_cta, col_name, col_status, col_tags, col_playlist, col_last_seen, col_actions, status.online, status.warning, status.offline, status.unseen; signage.admin.device.edit_title, saved, save_error, revoke_title, revoke_confirm_body, revoke_confirm, revoke_cancel, revoked, revoke_error

    Pair page (12 keys): signage.admin.pair.title, subtitle, code_label, code_placeholder, name_label, name_placeholder, tags_label, tags_placeholder, submit, cancel, success, error_not_found, error_claimed, error_generic

    TagPicker (2 keys): signage.admin.tag_picker.placeholder, tag_picker.create

    Shared errors (2 keys): signage.admin.error.loading, error.generic

    IMPORTANT — the existing parity script `frontend/scripts/check-locale-parity.mts` treats the JSON as `Record<string, string>` (FLAT keys). Do NOT convert to nested objects. All new entries are string values at the top level of the JSON object, keyed with the full dotted string literal (e.g. `"signage.admin.page_title": "Digital Signage"`). This matches existing entries such as `"dashboard.kpi.totalRevenue.label"`.

    Add keys in the same order in both files so diff-review is sane. Use German "du" tone verbatim from UI-SPEC (informal; no "Sie").

    Do NOT rename existing `launcher.tile.*` (singular) keys; `launcher.tiles.signage` (plural) is a new sibling per D-16.
  </action>
  <verify>
    <automated>cd frontend && node --experimental-strip-types scripts/check-locale-parity.mts && grep -c "signage.admin" src/locales/en.json && grep -c "signage.admin" src/locales/de.json && grep -q "launcher.tiles.signage" src/locales/en.json && grep -q "launcher.tiles.signage" src/locales/de.json</automated>
  </verify>
  <acceptance_criteria>
    - `node --experimental-strip-types frontend/scripts/check-locale-parity.mts` exits 0 and prints "PARITY OK"
    - `grep -c "\"signage\\.admin\\." frontend/src/locales/en.json` returns ≥85 (approx; every key added)
    - `grep -c "\"signage\\.admin\\." frontend/src/locales/de.json` returns same number as en.json
    - `grep -c "\"launcher\\.tiles\\.signage\"" frontend/src/locales/en.json` returns exactly 1
    - `grep -c "\"launcher\\.tiles\\.signage\"" frontend/src/locales/de.json` returns exactly 1
    - `grep -c "\"Sie \\| Ihre \\| Ihnen\"" frontend/src/locales/de.json` returns pre-change count (no formal "Sie" introduced in new keys)
    - `grep "signage\\.admin\\.pair\\.code_placeholder" frontend/src/locales/en.json` contains `XXX-XXX`
    - Both files still parse as valid JSON: `node -e "JSON.parse(require('fs').readFileSync('frontend/src/locales/en.json'))"` exits 0; same for de.json
  </acceptance_criteria>
  <done>All UI-SPEC keys present in both locales; parity script passes; informal "du" tone in DE; JSON valid.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Register signage routes in App.tsx, add launcher tile, create SignagePage shell + 3 sub-page stubs</name>
  <read_first>
    - frontend/src/App.tsx (full file — observe Route ordering, wrapping idiom)
    - frontend/src/pages/LauncherPage.tsx (full file — observe tile markup + AdminOnly placement)
    - frontend/src/pages/SettingsPage.tsx (lines 1-80 — observe subpage patterns, useTranslation import style)
    - 46-UI-SPEC.md §"Interaction Contracts" 1, 2 (launcher tile + sub-nav button group exact class lists)
    - 46-UI-SPEC.md §"Routing Contract" (exact wouter flat-route block)
  </read_first>
  <files>
    - frontend/src/App.tsx
    - frontend/src/pages/LauncherPage.tsx
    - frontend/src/signage/pages/SignagePage.tsx (CREATE)
    - frontend/src/signage/pages/MediaPage.tsx (CREATE — stub)
    - frontend/src/signage/pages/PlaylistsPage.tsx (CREATE — stub)
    - frontend/src/signage/pages/DevicesPage.tsx (CREATE — stub)
  </files>
  <action>
    **3a. Launcher tile (LauncherPage.tsx):**

    Add a third admin-only tile AFTER the existing Sensors `<AdminOnly>` block and BEFORE the coming-soon `[0, 1].map(...)` block. Use `MonitorPlay` icon from lucide-react (add to existing import: `import { LayoutDashboard, Box, Thermometer, MonitorPlay } from "lucide-react";`). Reduce `[0, 1].map(...)` to `[0].map(...)` so the grid keeps the same total tile count (3 active + 1 coming-soon).

    Tile markup (copy EXACTLY from existing sensors tile, swap icon + i18n key):
    ```tsx
    <AdminOnly>
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => setLocation("/signage")}
          aria-label={t("launcher.tiles.signage")}
          className="w-[120px] h-[120px] rounded-2xl bg-card border border-border
                     flex items-center justify-center p-4
                     cursor-pointer hover:bg-accent/10 transition-colors
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MonitorPlay className="w-10 h-10 text-foreground" aria-hidden="true" />
        </button>
        <span className="text-xs text-muted-foreground text-center">
          {t("launcher.tiles.signage")}
        </span>
      </div>
    </AdminOnly>
    ```

    **3b. App.tsx routes — add INSIDE the `<Switch>` BEFORE the `/settings` route block (so the `/signage/playlists/:id` entry added by 46-05 later slots in the right place). Order MUST be specificity-first:**

    ```tsx
    import { SignagePage } from "@/signage/pages/SignagePage";
    import { Redirect } from "wouter";
    // (AdminOnly already imported)

    // Inside <Switch>:
    <Route path="/signage/playlists">
      <AdminOnly><SignagePage initialTab="playlists" /></AdminOnly>
    </Route>
    <Route path="/signage/devices">
      <AdminOnly><SignagePage initialTab="devices" /></AdminOnly>
    </Route>
    <Route path="/signage/media">
      <AdminOnly><SignagePage initialTab="media" /></AdminOnly>
    </Route>
    <Route path="/signage">
      <AdminOnly><Redirect to="/signage/media" /></AdminOnly>
    </Route>
    ```

    Plans 46-05 and 46-06 will add `<Route path="/signage/playlists/:id">` (BEFORE the `/signage/playlists` entry) and `<Route path="/signage/pair">` respectively.

    **3c. SignagePage.tsx (NEW FILE):**

    ```tsx
    import { useTranslation } from "react-i18next";
    import { useLocation } from "wouter";
    import { MediaPage } from "./MediaPage";
    import { PlaylistsPage } from "./PlaylistsPage";
    import { DevicesPage } from "./DevicesPage";

    type SignageTab = "media" | "playlists" | "devices";

    interface SignagePageProps {
      initialTab: SignageTab;
    }

    export function SignagePage({ initialTab }: SignagePageProps) {
      const { t } = useTranslation();
      const [, setLocation] = useLocation();

      // URL is the source of truth; initialTab prop selects the render.
      const active: SignageTab = initialTab;

      const tabs: { id: SignageTab; path: string; labelKey: string }[] = [
        { id: "media", path: "/signage/media", labelKey: "signage.admin.nav.media" },
        { id: "playlists", path: "/signage/playlists", labelKey: "signage.admin.nav.playlists" },
        { id: "devices", path: "/signage/devices", labelKey: "signage.admin.nav.devices" },
      ];

      return (
        <div className="max-w-7xl mx-auto px-6 pt-4 pb-16 space-y-6">
          <h1 className="text-3xl font-semibold">{t("signage.admin.page_title")}</h1>

          {/* Sub-nav button group — custom (D-04: NOT shadcn <Tabs>) */}
          <nav className="inline-flex rounded-md border border-border overflow-hidden" aria-label={t("signage.admin.page_title")}>
            {tabs.map((tab) => {
              const isActive = tab.id === active;
              const base = "px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
              const cls = isActive
                ? `${base} bg-primary text-primary-foreground`
                : `${base} bg-transparent text-foreground hover:bg-muted`;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLocation(tab.path)}
                  aria-current={isActive ? "page" : undefined}
                  className={cls}
                >
                  {t(tab.labelKey)}
                </button>
              );
            })}
          </nav>

          {active === "media" && <MediaPage />}
          {active === "playlists" && <PlaylistsPage />}
          {active === "devices" && <DevicesPage />}
        </div>
      );
    }
    ```

    **3d. MediaPage.tsx, PlaylistsPage.tsx, DevicesPage.tsx (stub files, to be expanded in 46-04/05/06):**

    Each stub is minimal — just a placeholder heading/empty-state text using existing i18n keys. Example `MediaPage.tsx`:
    ```tsx
    import { useTranslation } from "react-i18next";
    export function MediaPage() {
      const { t } = useTranslation();
      return (
        <section className="rounded-md border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">{t("signage.admin.media.empty_title")}</p>
        </section>
      );
    }
    ```
    PlaylistsPage.tsx uses `signage.admin.playlists.empty_title`; DevicesPage.tsx uses `signage.admin.devices.empty_title`. These three stubs will be replaced wholesale by later plans; keep them minimal.

    NO direct `fetch()` anywhere. NO `dark:` Tailwind variants. All content inside `<AdminOnly>` at the route level (already enforced by App.tsx wrapping).
  </action>
  <verify>
    <automated>cd frontend && npm run build 2>&1 | grep -v warn | tail -20 && grep -c "MonitorPlay" src/pages/LauncherPage.tsx && grep -c "path=\"/signage\"" src/App.tsx && grep -rn "dark:" src/signage 2>/dev/null | wc -l | grep -q "^0$" && grep -rn "fetch(" src/signage 2>/dev/null | wc -l | grep -q "^0$"</automated>
  </verify>
  <acceptance_criteria>
    - `cd frontend && npm run build` exits 0
    - `grep -c "MonitorPlay" frontend/src/pages/LauncherPage.tsx` returns ≥2 (import + usage)
    - `grep -c "launcher\\.tiles\\.signage" frontend/src/pages/LauncherPage.tsx` returns ≥2 (aria-label + label)
    - `grep -c "setLocation(\"/signage\")" frontend/src/pages/LauncherPage.tsx` returns exactly 1
    - `grep -c "path=\"/signage" frontend/src/App.tsx` returns exactly 4 (media, playlists, devices, /signage root)
    - App.tsx contains `path="/signage/media"` line BEFORE `path="/signage"` line (specificity order); verify via `awk '/path="\\/signage\\/media"/{a=NR} /path="\\/signage"[^\\/]/{b=NR} END{exit !(a<b)}' frontend/src/App.tsx`
    - `grep -c "<Redirect to=\"/signage/media\"" frontend/src/App.tsx` returns exactly 1
    - `grep -c "initialTab" frontend/src/signage/pages/SignagePage.tsx` returns ≥2
    - `grep -c "signage.admin.nav" frontend/src/signage/pages/SignagePage.tsx` returns ≥3
    - `test -f frontend/src/signage/pages/MediaPage.tsx && test -f frontend/src/signage/pages/PlaylistsPage.tsx && test -f frontend/src/signage/pages/DevicesPage.tsx` all true
    - `grep -rn "dark:" frontend/src/signage` returns nothing (exit 1 / zero matches)
    - `grep -rn "fetch(" frontend/src/signage` returns nothing
    - `grep -c "<AdminOnly>" frontend/src/App.tsx` increased by at least 4 vs pre-change
  </acceptance_criteria>
  <done>`/signage` renders SignagePage with tab nav; tab clicks update URL + active state; launcher tile navigates correctly; build clean; no dark: or direct fetch leaked.</done>
</task>

</tasks>

<verification>
1. `cd frontend && npm run build` exits 0.
2. `cd frontend && node --experimental-strip-types scripts/check-locale-parity.mts` prints "PARITY OK".
3. `cd frontend && npm run lint` exits 0 (no new lint errors in signage/ or LauncherPage.tsx).
4. Manual check (Phase 46-verify phase): log in as admin → tile visible → click → /signage/media renders with tab nav highlighting Media. Log in as viewer → tile absent.
5. `grep -rn "dark:" frontend/src/signage` returns nothing.
6. `grep -rn "fetch(" frontend/src/signage` returns nothing.
</verification>

<success_criteria>
- Three new `/signage/*` stub routes register in App.tsx wrapped in `<AdminOnly>` with correct wouter specificity ordering.
- Launcher tile MonitorPlay + `launcher.tiles.signage` i18n key resolves in both locales.
- SignagePage renders a three-button URL-routed nav group; no shadcn `<Tabs>` used.
- `signageKeys` query-key factory exported from `lib/queryKeys.ts`.
- All 4 new npm deps at pinned versions (@dnd-kit/core@6.3.1, @dnd-kit/sortable@10.0.0, @dnd-kit/utilities@3.2.2, react-pdf@10.4.1).
- No `pdfjs-dist` override added (Phase 47 concern).
- Locale parity script green.
</success_criteria>

<output>
After completion, create `.planning/phases/46-admin-ui/46-01-SUMMARY.md`.
</output>
