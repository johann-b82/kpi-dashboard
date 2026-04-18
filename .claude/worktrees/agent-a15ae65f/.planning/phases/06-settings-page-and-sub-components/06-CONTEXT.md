# Phase 6: Settings Page and Sub-components - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

A full Settings page at `/settings` where any user can edit the app's branding and see changes live before committing. Deliverables:

- Replace the Phase 5 `SettingsPage.tsx` stub with a real form page consuming `useSettings()`
- **Color pickers** (6) for the semantic tokens: primary, accent, background, foreground, muted, destructive — hex input + visual picker; converted to oklch on submit
- **App name** text input
- **Logo upload** — drag-and-drop + click-to-browse; current logo thumbnail + "Replace" affordance
- **Live preview** — all color and app-name changes flow through `ThemeProvider` instantly via TanStack Query cache mutation (`queryClient.setQueryData(['settings'], draft)`); logo updates after immediate POST
- **Save** — single `PUT /api/settings` for colors + app name; success/error sonner toasts (UX-02)
- **Discard changes** — revert draft to the pre-edit server snapshot (visible only when dirty)
- **Reset to defaults** — confirm dialog → full server reset via `PUT` with canonical defaults (also clears logo per Phase 4 D-07)
- **Contrast badges** — inline WCAG AA warning (warn-only, not blocking) on primary, background, destructive pickers for the 3 critical pairs
- **Unsaved-changes guard** — custom wouter nav intercept + shadcn Dialog; `beforeunload` for tab close (UX-01)
- Two new frontend deps: `react-colorful`, `culori`

Out of scope:
- Language select / I18N-01 / I18N-02 (Phase 7)
- Dedicated "remove logo" button (Phase 4 deferred; Reset handles it)
- Any backend changes (Phase 4 API is final)
- Translations for new Settings page copy — stub in EN only; DE translation is part of Phase 7's i18n polish
- Tabs or accordion primitives (not currently in `ui/`, not needed)

</domain>

<decisions>
## Implementation Decisions

### Color pickers (BRAND-05)
- **D-01:** Use **`react-colorful`** (adds ~2.8KB) combined with a hex text input side-by-side. One `ColorPicker` sub-component reused 6 times, driven by `{ label, tokenKey, value, onChange }`.
- **D-02:** Add **`culori`** as a frontend dependency. Used for three jobs: (1) hex → oklch on draft change (before writing to cache and on Save submit), (2) oklch → hex when loading existing settings into the picker, (3) computing relative luminance for the contrast badges. Tree-shake `parse`, `formatCss`, `converter('oklch')`, `wcagContrast` from culori.
- **D-03:** Picker component API emits the **hex** value; the Settings page container is responsible for hex→oklch conversion before touching the query cache or the PUT payload. Keeps the picker ignorant of color space.

### Live preview mechanism
- **D-04:** Live preview uses **`queryClient.setQueryData(['settings'], draft)`** on every draft change. ThemeProvider's existing `useEffect` (Phase 5 D-12, D-15) reapplies CSS vars + `document.title` automatically — no new writer code. One writer, always from the cached state.
- **D-05:** Updates are **not debounced**. CSS `setProperty` on 6 tokens is microsecond-cheap; instant feedback is the point of BRAND-07.
- **D-06:** **Pre-edit snapshot** — on mount (and after every successful Save/Reset), Settings page captures a deep-copy snapshot of the current server settings. Snapshot is used for: dirty detection, Discard action, and unsaved-guard dialog comparison.
- **D-07:** **Dirty detection** — shallow-equal of the 8 draft fields (`color_*` ×6, `app_name`, `default_language`) against snapshot. `default_language` is in the draft even though Phase 6 doesn't expose a UI for it (Phase 7 will), so the shape stays whole. Logo is excluded from dirty state because it uploads immediately.

### Page layout
- **D-08:** **Single scrolling page** with shadcn `Card` sections:
  1. **Identity** — app name input, logo upload (thumbnail + dropzone)
  2. **Colors** — 6 color pickers in a responsive grid (2 cols desktop, 1 col mobile-ish widths)
  3. *(Phase 7 adds Language card here)*
  Matches the dashboard page's Card idiom; no Tabs or Accordion primitive needed.
- **D-09:** **Sticky bottom action bar** with: left-side "Unsaved changes" indicator (only when dirty), right-side buttons — `Discard` (ghost, visible only when dirty), `Reset to defaults` (ghost/outline, always visible), `Save` (primary, disabled when not dirty). Bar is `fixed bottom-0 inset-x-0 bg-card border-t` with enough `pb` padding on the scroll container so content isn't hidden behind it.

### Save / Discard / Reset semantics (SET-04, BRAND-07, UX-02)
- **D-10:** **Save** = `PUT /api/settings` with the full draft payload (colors converted to oklch, plus `app_name` and current `default_language`). On success: (1) `toast.success(...)`, (2) update snapshot to the response body, (3) `queryClient.setQueryData(['settings'], response)` so the cache stays in sync. On failure: `toast.error(err.detail)`, draft is **preserved** so the user can retry or fix.
- **D-11:** **Discard** (visible only when dirty) = restore draft from pre-edit snapshot + call `queryClient.setQueryData(['settings'], snapshot)` so ThemeProvider immediately reverts the live preview. No server call, no toast.
- **D-12:** **Reset to defaults** = shadcn Dialog confirm ("Reset all branding to defaults? This also removes your logo.") → on confirm, `PUT /api/settings` with `DEFAULT_SETTINGS` payload (server clears logo per Phase 4 D-07) → on success: refresh settings from response, update snapshot, success toast. No "Reset colors only" variant.

### Logo upload UX (BRAND-01 UI)
- **D-13:** Reuse **`react-dropzone`** (already in deps, used by `components/DropZone.tsx`) for a drag-and-drop zone that also supports click-to-browse. `accept: { 'image/png': ['.png'], 'image/svg+xml': ['.svg'] }`, `maxSize: 1_048_576`, `maxFiles: 1`.
- **D-14:** **Immediate POST on file drop** to `POST /api/settings/logo`. On success: invalidate or update the settings query so the new `logo_url` flows through ThemeProvider → NavBar updates live. Logo is **not** part of the save draft because it has its own endpoint (Phase 4 D-05/D-06) and its own lifecycle.
- **D-15:** **Current logo preview** — when `settings.logo_url` is non-null, render a thumbnail (max 120×120, object-contain) next to the dropzone, with the dropzone labeled "Replace logo". When null, dropzone is labeled "Upload logo" and no thumbnail is shown.
- **D-16:** **Error handling** — `react-dropzone` client-side rejections (wrong MIME, >1MB) fire `toast.error` with a localized message. Backend 422 responses (nh3 SVG rejection, magic-byte mismatch) are caught from the fetch and surfaced via `toast.error(err.detail)`. No inline error state on the dropzone.
- **D-17:** No dedicated "remove logo" button. Deferred per Phase 4 D-08 — users clear the logo via **Reset to defaults**.

### Unsaved-changes guard (UX-01)
- **D-18:** Build a custom **`useUnsavedGuard(isDirty)`** hook. Responsibilities:
  1. **In-app nav intercept** — the SettingsPage wraps wouter's `useLocation` setter to show a dialog before navigating, and the NavBar links are caught by a document-level capture-phase click listener that checks `isDirty` + `window.location.pathname.startsWith('/settings')`. The hook installs and removes this listener.
  2. **Tab close** — `window.addEventListener('beforeunload', e => { if (dirty) e.preventDefault() })` while dirty.
  3. **Cleanup** on unmount.
- **D-19:** **Dialog actions** — "Discard & leave" (proceeds with the pending navigation after reverting the draft), "Stay" (cancels the navigation). No "Save & leave" option — keeps the state machine small.
- **D-20:** Guard **only triggers** when leaving `/settings` for another route. Intra-page interactions (opening the Reset dialog, clicking a color picker) do not trigger. Reset's own confirm dialog is a separate shadcn Dialog, not routed through the unsaved-guard.

### WCAG contrast badges (BRAND-08)
- **D-21:** **Inline badges** rendered under the affected picker. Three pairs:
  - `primary` / `primary-foreground` → badge under the primary picker
  - `background` / `foreground` → badge under the background picker AND under the foreground picker (both contribute)
  - `destructive` / white → badge under the destructive picker
  Badge appears only when contrast drops below 4.5:1. Warn-only — never blocks Save (BRAND-08 "warn, do not block").
- **D-22:** **Derived token lookup** — for `--primary-foreground`, read `getComputedStyle(document.documentElement).getPropertyValue('--primary-foreground')` once per render. Reflects the real derived value from `index.css` rather than hard-coding white. For the `destructive/white` pair, use `oklch(1 0 0)` literally (matches the BRAND-08 wording and avoids culori parse of the keyword "white").
- **D-23:** Contrast math via **`culori.wcagContrast(a, b)`**. Display format: "contrast 3.8 : 1 (needs 4.5)". Badge component is `<Badge variant="destructive">` or similar from `ui/badge.tsx`.

### Claude's Discretion
- Exact styling of the sticky bottom bar (shadow, blur, border treatment)
- Whether the Identity card renders app name above or beside the logo section
- Whether the color pickers share a single Popover or each has its own
- Exact copy strings and whether they are localized or stub EN-only (Phase 7 will translate)
- Component file split: `SettingsPage.tsx` may decompose into `components/settings/ColorPicker.tsx`, `LogoUpload.tsx`, `ActionBar.tsx`, `ResetDialog.tsx`, `useUnsavedGuard.ts`, `useSettingsDraft.ts` — final layout is the planner's call
- Whether `useSettingsDraft` returns `{ draft, set, reset, isDirty, save, resetToDefaults }` as one hook or splits into smaller hooks
- Test strategy: vitest + @testing-library/react; focus tests on dirty detection, discard-vs-reset distinction, unsaved-guard flow, contrast badge threshold, logo error toast. Use MSW or fetch mocks — match Phase 3/5 conventions.
- Whether the locale files (`de.json`/`en.json`) get new `settings.*` keys in Phase 6 or are deferred to Phase 7 — recommend adding EN-only stubs now, DE in Phase 7

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and scope
- `.planning/REQUIREMENTS.md` — SET-01, BRAND-05, BRAND-07, BRAND-08, UX-01, UX-02 map to this phase; SET-04 (reset) is backend-done but surfaces via UI here
- `.planning/ROADMAP.md` §Phase 6 — goal, 5 success criteria, "Full settings UI: color pickers, logo upload, live preview, Save, Reset, unsaved-changes guard"
- `.planning/PROJECT.md` — v1.1 milestone goal, "global single CI, any user can edit", no admin gating
- `.planning/phases/04-backend-schema-api-and-security/04-CONTEXT.md` — defines the API contract this UI consumes:
  - D-03/D-04 (logo_url shape + separate GET /api/settings/logo)
  - D-05 (PUT does NOT accept logo bytes)
  - D-06 (POST /api/settings/logo for uploads)
  - D-07 (reset clears logo)
  - D-09/D-10 (oklch-only on the wire; hex→oklch is frontend's job)
- `.planning/phases/05-frontend-plumbing-themeprovider-and-navbar/05-CONTEXT.md` — defines the frontend plumbing this phase builds on:
  - D-12 (Phase 6's live preview calls setProperty via cache update, not a separate writer)
  - D-13 (TanStack Query `['settings']`, staleTime Infinity — live preview updates via setQueryData)
  - D-15 (ThemeProvider is the SINGLE owner of CSS var + document.title side effects)
  - D-16 (`frontend/src/lib/defaults.ts` is the canonical default palette)

### Existing frontend patterns (to reuse / match)
- `frontend/src/pages/SettingsPage.tsx` — current stub; gets fully replaced
- `frontend/src/components/ThemeProvider.tsx` — do NOT modify; its `applyTheme` fires automatically when cache changes
- `frontend/src/hooks/useSettings.ts` — read path; Settings page also uses `useQueryClient()` for the cache mutation + invalidation
- `frontend/src/lib/api.ts` — extend with `updateSettings(payload)` and `uploadLogo(file)` fetchers; match existing `UploadResponse` / `fetchX` conventions
- `frontend/src/lib/defaults.ts` — `DEFAULT_SETTINGS` + `THEME_TOKEN_MAP` — Reset payload source
- `frontend/src/components/DropZone.tsx` — reference implementation of `react-dropzone` integration (Phase 2) — copy the error-toast pattern and rejection handling
- `frontend/src/components/ui/card.tsx`, `dialog.tsx`, `button.tsx`, `badge.tsx`, `popover.tsx` — shadcn primitives already available
- `frontend/src/components/NavBar.tsx` — Settings gear link destination; no changes expected in Phase 6
- `frontend/src/i18n.ts` + `frontend/src/locales/*.json` — pattern for adding new translation keys (EN stubs in Phase 6; DE in Phase 7)
- `frontend/src/pages/UploadPage.tsx` (from Phase 2/3) — reference for toast + error.detail parsing pattern

### Stack rules (project-level)
- `CLAUDE.md` §Technology Stack — React 19, TanStack Query 5.97, Tailwind v4, wouter (not react-router), shadcn wraps @base-ui/react (use `render` prop, not `asChild`)
- `CLAUDE.md` §Conventions — currently empty; Phase 6 is free to establish patterns for forms with draft state
- New deps to add: **`react-colorful`**, **`culori`** — both small, tree-shakeable, widely used

No external ADRs or spec docs — requirements are fully captured in REQUIREMENTS.md + Phase 4/5 CONTEXT files + the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **Single cache writer invariant** — `ThemeProvider.applyTheme` ([frontend/src/components/ThemeProvider.tsx:9-18](frontend/src/components/ThemeProvider.tsx#L9-L18)) already reapplies on any `['settings']` cache change. Phase 6 gets live preview "for free" by mutating the cache.
- **`useSettings()` hook** — [frontend/src/hooks/useSettings.ts](frontend/src/hooks/useSettings.ts) — read the current server state on mount; draft + snapshot layer sits on top of this
- **`Settings` type** — [frontend/src/lib/api.ts:94-105](frontend/src/lib/api.ts#L94-L105) — already defines all 10 fields including `logo_url`/`logo_updated_at`
- **`DEFAULT_SETTINGS` + `THEME_TOKEN_MAP`** — [frontend/src/lib/defaults.ts](frontend/src/lib/defaults.ts) — drive Reset payload and the 6-picker iteration order
- **`react-dropzone` in package.json** + [frontend/src/components/DropZone.tsx](frontend/src/components/DropZone.tsx) — copy the dropzone + error-toast + accept-config patterns
- **`sonner` toast** — globally mounted in App.tsx; `import { toast } from "sonner"` and use `toast.success` / `toast.error`
- **shadcn Dialog primitive** — `frontend/src/components/ui/dialog.tsx` — unsaved-guard dialog + Reset confirm dialog both use this
- **`Badge` primitive** — `frontend/src/components/ui/badge.tsx` — contrast warning badges
- **`lucide-react` icons** — already available; use for picker/upload/reset icons to match NavBar's aesthetic

### Established patterns
- **Fetcher + interface colocation** in `lib/api.ts` — add `SettingsUpdatePayload`, `updateSettings`, `uploadLogo` there
- **`fetch("/api/...")` relative URLs** — dev proxy already configured; use `/api/settings` and `/api/settings/logo`
- **Error shape** — backend returns `{ detail: string }` on 422; parse with `await res.json()` and use `err.detail` as toast message (matches UploadPage + Phase 4 conventions)
- **Vite alias `@/`** → `frontend/src/` — use for all new imports
- **Tailwind v4 + shadcn** — CSS vars at `:root` drive Tailwind color classes via `@theme` block in `index.css`; this is what makes live preview work with zero component refactors

### Integration points
- **Replace** [frontend/src/pages/SettingsPage.tsx](frontend/src/pages/SettingsPage.tsx) — from stub to real page
- **Extend** [frontend/src/lib/api.ts](frontend/src/lib/api.ts) — add `updateSettings`, `uploadLogo`, shared payload types
- **Add deps** to `frontend/package.json`: `react-colorful`, `culori`, `@types/culori` (if needed — culori ships its own types, verify)
- **New files to create (planner may split differently):**
  - `frontend/src/components/settings/ColorPicker.tsx`
  - `frontend/src/components/settings/LogoUpload.tsx`
  - `frontend/src/components/settings/ActionBar.tsx`
  - `frontend/src/components/settings/ResetDialog.tsx`
  - `frontend/src/components/settings/UnsavedChangesDialog.tsx`
  - `frontend/src/hooks/useSettingsDraft.ts`
  - `frontend/src/hooks/useUnsavedGuard.ts`
  - `frontend/src/lib/color.ts` — hex↔oklch conversion + contrast helpers wrapping culori
- **Locale files** (`frontend/src/locales/en.json`, `de.json`) — add `settings.*` keys for EN in Phase 6; DE in Phase 7

</code_context>

<specifics>
## Specific Ideas

- Test matrix mapping to Phase 6 success criteria:
  1. Navigating to `/settings` renders Identity card, Colors card with 6 pickers, and a logo upload area
  2. Changing a color picker value mutates the query cache and the NavBar element's `getComputedStyle(...).backgroundColor` reflects the new value — no PUT fired
  3. Clicking Save fires PUT with oklch-converted colors; success path updates snapshot and fires toast.success; 422 path fires toast.error and keeps draft dirty
  4. Setting primary to a low-contrast value shows the contrast badge under the primary picker; Save is still enabled
  5. Making a change then clicking a NavBar link shows the unsaved-guard dialog; "Stay" stays on `/settings`; "Discard & leave" navigates and reverts the cache to snapshot
  6. `beforeunload` fires when navigating away from tab with dirty state (test via `window.dispatchEvent(new Event('beforeunload'))`)
  7. Reset to defaults shows confirm; confirming fires PUT with DEFAULT_SETTINGS; NavBar reverts to text brand (logo cleared)
  8. Logo drop fires POST; on success, NavBar img src updates; on >1MB file, toast.error with size message, no POST
- `logo_updated_at` from the backend feeds the cache-busting query param; frontend never constructs the `?v=...` itself (Phase 5 D-16)
- Contrast threshold: 4.5:1 (WCAG AA for normal text). 3:1 (AA large text) is NOT used here — BRAND-08 says 4.5:1 critical pairs
- Color picker popover should trap focus while open (react-colorful default) — aria for accessibility
- Unsaved-guard navigation capture must handle both NavBar `<Link>` clicks AND direct browser back/forward — planner should verify wouter's `useLocation` hook fires on popstate

</specifics>

<deferred>
## Deferred Ideas

- **Language select UI** (I18N-01) — Phase 7 adds the Language card to the Settings page. Phase 6 leaves a predictable spot in the layout but doesn't add the control.
- **`i18n.changeLanguage` wiring** on Save (I18N-02) — Phase 7. If a user edits `default_language` in Phase 6 (they can't, no UI), Save would PUT it but nothing would react to it.
- **DE translations** for new Settings page copy — Phase 7 i18n polish. Phase 6 adds `en.json` stubs only.
- **Dedicated DELETE /api/settings/logo endpoint** — Phase 4 deferred; Reset covers the clear-logo case.
- **"Save & leave" option** on the unsaved-guard dialog — intentionally omitted; adds failure modes without much user value in an internal tool.
- **Color preset swatches / palette library** — explicitly deferred in REQUIREMENTS.md v1.2+.
- **Dark mode toggle** — deferred to v1.2+; `.dark` class in index.css stays untouched.
- **Per-section save buttons** — considered and rejected; one PUT updates all.
- **Optimistic concurrency on Save** — REQUIREMENTS.md defers; last-write-wins is acceptable.
- **Auto-derived foreground colors** — deferred; the 6 editable tokens are the contract. Derived tokens like `--primary-foreground` stay as `index.css` defaults.
- **Field-level validation errors inline** (e.g., "app_name too long") — current thinking: single toast.error on Save failure with `err.detail`. Inline field errors can be added later if users trip the backend validators often.
- **Dirty detection for `default_language`** — kept in the shape but not UI-reachable in Phase 6; Phase 7 will need to revisit dirty/snapshot semantics when it adds the language select.

</deferred>

---

*Phase: 06-settings-page-and-sub-components*
*Context gathered: 2026-04-11*
