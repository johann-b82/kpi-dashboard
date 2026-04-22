---
phase: quick-260422-hxt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/signage/pages/SignagePage.tsx
  - frontend/src/components/SubHeader.tsx
autonomous: false
requirements:
  - QUICK-260422-HXT: "Remove Digital Signage h1 page title and move tabs pill into SubHeader"
must_haves:
  truths:
    - "Navigating to /signage/media, /signage/playlists, /signage/devices, /signage/schedules no longer renders an h1 'Digital Signage' heading above the content"
    - "The 4-tab pill (Medien/Playlists/Geräte/Zeitpläne) is visible in the SubHeader strip (h-12 below NavBar) on all /signage/* admin routes except /signage/pair"
    - "Clicking a tab segment navigates between the four signage routes with the same active-state behavior as before"
    - "/signage/pair, /sales, /hr, /sensors, / SubHeader content is unchanged"
    - "DE/EN locales stay in sync; parity CI passes"
    - "No hardcoded color literals introduced; no aria-label regressions on icon-only controls"
  artifacts:
    - path: "frontend/src/components/SubHeader.tsx"
      provides: "Hosts the signage 4-tab SegmentedControl, gated on /signage/* (excluding /signage/pair)"
      contains: "SegmentedControl"
    - path: "frontend/src/signage/pages/SignagePage.tsx"
      provides: "Signage route shell without h1 or tabs pill — just renders the active child page"
      contains: "initialTab"
  key_links:
    - from: "frontend/src/components/SubHeader.tsx"
      to: "frontend/src/components/ui/segmented-control.tsx"
      via: "import + render on /signage/* routes"
      pattern: "SegmentedControl"
    - from: "frontend/src/components/SubHeader.tsx"
      to: "wouter setLocation"
      via: "onChange handler navigates to tab.path"
      pattern: "setLocation|navigate"
---

<objective>
Remove the "Digital Signage" h1 heading from the SignagePage shell and relocate the 4-tab pill (Media/Playlists/Devices/Schedules) up into the shared SubHeader strip so the signage admin pages no longer render a title row above the pill — matching the flatter chrome pattern used for /sales, /hr, and /sensors.

Purpose: Finishes the Phase 56 chrome consolidation for signage — the h1 was redundant with the breadcrumb trail and the Toggle-style pill in other sections already lives in SubHeader.
Output: SignagePage becomes a thin shell that only renders the active tab's page; SubHeader gains a `/signage/*` branch that renders the 4-segment SegmentedControl pill.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@frontend/src/signage/pages/SignagePage.tsx
@frontend/src/components/SubHeader.tsx
@frontend/src/components/ui/segmented-control.tsx
@frontend/src/App.tsx
@frontend/src/lib/breadcrumbs.ts
@frontend/src/locales/en.json
@frontend/src/locales/de.json

<interfaces>
<!-- Key contracts extracted from the codebase so the executor does not need to explore. -->

SubHeader renders a fixed h-12 strip below the NavBar and uses wouter useLocation
for per-route slotting. Current gating pattern (SubHeader.tsx lines 98–125):

  if (location === "/") return null;
  const isDashboard = location === "/sales" || location === "/hr";
  // isDashboard -> Toggle + Upload
  // location === "/sensors" -> SensorTimeWindowPicker + PollNowButton + freshness

SignagePage.tsx current shape:

  interface SignagePageProps { initialTab: "media" | "playlists" | "devices" | "schedules" }
  // Currently renders: <h1>{t("signage.admin.page_title")}</h1>, SegmentedControl (4 segments), active child page

SegmentedControl primitive (frontend/src/components/ui/segmented-control.tsx):
  Generic n-segment pill — still the right primitive for 4 tabs (Toggle is 2-tuple only).
  Signature: segments: { value, label }[], value, onChange(value), aria-label

Signage routes in App.tsx (all wrapped in <AdminOnly>):
  /signage/media, /signage/playlists, /signage/playlists/:id, /signage/devices,
  /signage/schedules, /signage/pair, /signage (redirects to /signage/media)

i18n keys (KEEP — still consumed by breadcrumbs.ts and SubHeader aria-label):
  "signage.admin.page_title" — "Digital Signage" / "Digital Signage"
  "signage.admin.nav.media"      — "Media" / "Medien"
  "signage.admin.nav.playlists"  — "Playlists" / "Playlists"
  "signage.admin.nav.devices"    — "Devices" / "Geräte"
  "signage.admin.nav.schedules"  — "Schedules" / "Zeitpläne"
  DO NOT delete any of these keys. page_title is still used by breadcrumbs.ts
  lines 54, 61, 68, 75, 82, 89. nav.* keys remain segment labels.

Phase 58 / Phase 56 precedent for SubHeader per-route slotting: commit bed7d43.
Phase 59-03 guards: no hardcoded color literals (use tokens), icon-only buttons need aria-label.
The SegmentedControl pill is label-based (not icon-only), so aria guard is unaffected.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Relocate 4-tab SegmentedControl from SignagePage into SubHeader and strip the h1 + pill from the page shell</name>
  <files>frontend/src/components/SubHeader.tsx, frontend/src/signage/pages/SignagePage.tsx</files>
  <action>
1) Edit `frontend/src/components/SubHeader.tsx`:
   - Add imports:
     - `import { SegmentedControl } from "@/components/ui/segmented-control";`
   - Inside `SubHeader()`, after the existing `isDashboard` computation, add:
     ```ts
     // Signage admin routes share a 4-tab pill. /signage/pair is a standalone
     // pairing screen and keeps the default SubHeader layout (no tabs).
     const signageTabs = [
       { id: "media",     path: "/signage/media",     labelKey: "signage.admin.nav.media" },
       { id: "playlists", path: "/signage/playlists", labelKey: "signage.admin.nav.playlists" },
       { id: "devices",   path: "/signage/devices",   labelKey: "signage.admin.nav.devices" },
       { id: "schedules", path: "/signage/schedules", labelKey: "signage.admin.nav.schedules" },
     ] as const;
     const signageActive = location.startsWith("/signage/playlists")
       ? "playlists"
       : location.startsWith("/signage/devices")
       ? "devices"
       : location.startsWith("/signage/schedules")
       ? "schedules"
       : location.startsWith("/signage/media")
       ? "media"
       : null;
     const showSignageTabs = signageActive !== null && location !== "/signage/pair";
     ```
     Note: `location.startsWith("/signage/playlists")` catches the editor route `/signage/playlists/:id` so the pill stays visible (and "Playlists" stays highlighted) while editing a playlist. `/signage/pair` is explicitly excluded. Top-level `/signage` redirects before this ever paints.
   - In the left-hand `<div className="flex items-center gap-3">` block, add a new conditional branch rendering the SegmentedControl — place it next to the dashboard Toggle branch (same slot the Sales/HR Toggle uses on `/sales` and `/hr`):
     ```tsx
     {showSignageTabs && (
       <SegmentedControl
         segments={signageTabs.map((tab) => ({ value: tab.id, label: t(tab.labelKey) }))}
         value={signageActive}
         onChange={(id) => {
           const target = signageTabs.find((tab) => tab.id === id);
           if (target) navigate(target.path);
         }}
         aria-label={t("signage.admin.page_title")}
       />
     )}
     ```
   - Do NOT introduce any hardcoded color literals (respect 59-03 guard). Do NOT touch the right-hand (freshness / upload) slot behavior for non-signage routes.
   - The existing right-hand slot already gates `AdminOnly` + upload on `isDashboard`, and freshness on `/sensors` vs `/hr`. Signage falls through to the default `<FreshnessIndicator />` today. Preserve that behavior by NOT adding a signage branch in the right-hand slot in this plan (out of scope). If FreshnessIndicator renders something irrelevant on /signage, leave it — the task is strictly header relocation.

2) Edit `frontend/src/signage/pages/SignagePage.tsx`:
   - Remove the unused imports: `useLocation` from wouter, `SegmentedControl` from `@/components/ui/segmented-control`.
   - Remove the `useLocation()` hook call (no longer needed — SubHeader owns navigation).
   - Remove the `tabs` array and the entire `<SegmentedControl>` render block (lines ~26–47).
   - Remove the `<h1 className="text-3xl font-semibold">{t("signage.admin.page_title")}</h1>` line.
   - Keep `useTranslation()` ONLY if `t(...)` is still referenced after the removals; if not, drop that import too. (After removals the page body just mounts the active child — `t` is not used; delete the import.)
   - Keep the outer wrapper `<div className="max-w-7xl mx-auto px-6 pt-4 pb-16 space-y-6">` — do not change padding. Rationale: children (MediaPage, PlaylistsPage, DevicesPage, SchedulesPage) currently rely on being inside this container for horizontal spacing. Leaving it avoids scope creep.
   - Keep the `initialTab` prop contract unchanged (App.tsx still passes it).
   - Keep the JSDoc block above `SignagePage` but amend the second paragraph to read:
     `Custom 4-tab SegmentedControl lives in <SubHeader /> (moved 2026-04-22 — h1 removed and pill hoisted for chrome consistency with /sales, /hr, /sensors).`

3) Do NOT touch locale files. `signage.admin.page_title` is still consumed by `frontend/src/lib/breadcrumbs.ts` (and by the new SubHeader aria-label) — deleting it would break those + the parity CI would pass only if deleted from both, but that breaks breadcrumbs. `signage.admin.nav.*` keys are still used as segment labels in SubHeader.

4) Do NOT change App.tsx routing, breadcrumbs.ts, or AdminOnly wrapping.
  </action>
  <verify>
    <automated>cd frontend && npm run check:i18n-parity && npm run typecheck && npm run check:phase-57 && npm run check:phase-59 2>&1 | tail -60</automated>
  </verify>
  <done>
- `grep -n "text-3xl font-semibold" frontend/src/signage/pages/SignagePage.tsx` returns no match.
- `grep -n "SegmentedControl" frontend/src/signage/pages/SignagePage.tsx` returns no match.
- `grep -n "SegmentedControl" frontend/src/components/SubHeader.tsx` returns at least one match (import + render).
- `grep -n "signage.admin.nav.media" frontend/src/components/SubHeader.tsx` succeeds (tabs defined in SubHeader).
- `grep -n "signage.admin.page_title" frontend/src/locales/en.json frontend/src/locales/de.json` still returns one match per file (key preserved for breadcrumbs).
- typecheck, i18n parity, and Phase 57/59 CI guards all pass.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
SignagePage no longer renders the "Digital Signage" h1 heading. The 4-tab pill (Medien/Playlists/Geräte/Zeitpläne in DE; Media/Playlists/Devices/Schedules in EN) now lives inside the SubHeader on every /signage/* admin route except /signage/pair. Tab navigation behavior is byte-for-byte unchanged — same SegmentedControl primitive, same routes, same aria-label, same active-state computation (extended to keep "Playlists" highlighted while editing a specific playlist at /signage/playlists/:id).
  </what-built>
  <how-to-verify>
1. Start the frontend dev server (`cd frontend && npm run dev`) if not already running, then open the admin UI and sign in as admin.
2. Visit `/signage/media`. Confirm:
   - The h1 "Digital Signage" heading ABOVE the pill is GONE.
   - The 4-tab pill now sits inside the SubHeader (the h-12 strip immediately below the top NavBar), left-aligned, same pill styling as the Sales/HR toggle.
   - "Medien" (DE) or "Media" (EN) is the active segment.
3. Click each of Playlists, Geräte/Devices, Zeitpläne/Schedules. Confirm the URL updates and the active segment tracks the URL. Browser back/forward also updates the highlighted segment.
4. Open a specific playlist (e.g. click a row on /signage/playlists). At /signage/playlists/:id the pill is still visible and "Playlists" remains highlighted.
5. Visit `/signage/pair`. Confirm the signage pill is NOT rendered there (pairing screen keeps its own layout).
6. Visit `/sales`, `/hr`, `/sensors`, and `/` (launcher). Confirm their SubHeader content is unchanged — no signage pill leaks into those routes.
7. Toggle DE ↔ EN in the language switcher and confirm segment labels translate and the pill does not overflow.
8. Keyboard: Tab into the pill on /signage/media, use ArrowLeft/ArrowRight (or whatever the SegmentedControl's native keyboard flow is), confirm focus ring is visible per 59-02.
  </how-to-verify>
  <resume-signal>Type "approved" or describe any visual/functional regressions.</resume-signal>
</task>

</tasks>

<verification>
- `cd frontend && npm run typecheck` passes
- `cd frontend && npm run check:i18n-parity` passes (EN/DE still aligned; no keys added or removed)
- `cd frontend && npm run check:phase-57` passes
- `cd frontend && npm run check:phase-59` passes (no new hardcoded color literals; no icon-only aria regressions)
- `cd frontend && npm test -- --run` passes (breadcrumbs.test.ts unchanged; SignagePage has no direct tests)
- Manual UAT checkpoint approved
</verification>

<success_criteria>
- No h1 "Digital Signage" renders on any /signage/* route
- 4-tab SegmentedControl renders in SubHeader on /signage/media, /signage/playlists, /signage/playlists/:id, /signage/devices, /signage/schedules
- No pill on /signage/pair, /sales, /hr, /sensors, /
- No i18n keys removed; DE/EN parity preserved
- No CI guard regressions (57 or 59)
- Keyboard navigation + focus ring unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/260422-hxt-remove-digital-signage-h1-heading-from-s/260422-hxt-SUMMARY.md` capturing:
- Files touched + exact diff shape (lines added/removed)
- Confirmation that `signage.admin.page_title` was preserved (still used by breadcrumbs)
- Any deviation from the plan (e.g. padding adjustments, right-hand SubHeader slot tweaks) and why
</output>
