# Phase 56: Breadcrumb Header + Content-Nav Relocation - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

The top header (`NavBar.tsx`) carries only global identity — brand/logo, breadcrumb trail, theme toggle, language toggle, and a user menu dropdown. All route-specific controls (Sales/HR toggle, upload icon, settings gear, docs shortcut, bare sign-out button, contextual back button) leave the top header. Page navigation happens through the breadcrumb trail; per-page controls live in the `SubHeader` or their owning page.

Out of scope: redesigning the SubHeader layout itself (Phase 58 handles /sensors), adding new page controls, auth/user-profile changes beyond surfacing name/initials in the menu.

</domain>

<decisions>
## Implementation Decisions

### Breadcrumb source of truth (HDR-02)
- **D-01:** Breadcrumb labels come from a **static route→label map** (e.g. `frontend/src/lib/breadcrumbs.ts`) keyed by route pattern, with values as i18n keys. Simple lookup driven by `useLocation()` from `wouter`. No per-page register hook, no route-config refactor.
- **D-02:** **Dynamic segments are skipped as leaves.** For `/signage/playlists/:id`, the crumb renders `Home › Signage › Playlists` — the dynamic id is the current page itself and isn't worth an extra crumb. No async name resolution needed.

### Breadcrumb depth & scope (HDR-02, HDR-03)
- **D-03:** Breadcrumb renders on every route **except `/` (launcher) and `/login`**. On those routes, the top header has no crumb (launcher hides chrome entirely today; login is pre-auth).
- **D-04:** `Home` is always the first crumb on every non-excluded route and links to `/`. Localized via new i18n key `nav.home` — DE: `Start`, EN: `Home`. DE/EN key count parity required (HDR-03).
- **D-05:** Separator is the lucide `ChevronRight` icon (not the `›` character), matching the existing lucide iconography in `NavBar.tsx`. Rendered as decorative (`aria-hidden`).
- **D-06:** The current (last) crumb renders as **plain muted text with `aria-current="page"`** — not a link. Prior crumbs render as `<a>` via `wouter`'s `Link`. Matches HDR-02 wording (`<a>` links for navigable items) while avoiding the self-link a11y smell.

### Relocation targets (HDR-04)
- **D-07:** The **Sales/HR segmented Toggle** moves to the **SubHeader left slot on `/sales` and `/hr` only**. Other routes don't render it. Today the SubHeader left slot holds the date-range filter on `/sales`; the Toggle joins that slot (planner decides arrangement — Toggle + DateRangeFilter stacked or side-by-side).
- **D-08:** The **Upload icon** moves to the **SubHeader right slot on `/sales` and `/hr` only**, preserving the existing `AdminOnly` gate. Still links to `/upload`. Not shown on signage, settings, docs, sensors.
- **D-09:** The **Settings gear, Docs shortcut, and Sign-out** consolidate into a **user menu dropdown** in the top header's right side (after theme + language toggles). This satisfies HDR-01's "user menu" wording and HDR-04's "per-page settings gear" removal in one move.
- **D-10:** The **contextual back-to-last-dashboard button** (currently shown on `/settings`, `/upload`, `/docs`) is **removed**. Breadcrumbs provide the way back. The existing `lastDashboard` sessionStorage memory can also be removed if nothing else depends on it (planner to verify grep).

### User menu (HDR-01)
- **D-11:** **Trigger** is a circular initials avatar derived from the authenticated user's name/email (e.g. `JB`). Falls back to a generic lucide `User` icon if no name is available. Sized to match the other header icon buttons.
- **D-12:** **Menu contents (in order):**
  1. Non-interactive identity header row (name + email, muted)
  2. Divider
  3. Documentation → `/docs`
  4. Settings → `/settings` (no special gating beyond what `/settings` route already enforces)
  5. Divider
  6. Sign out (calls `signOut()` from `useAuth`)
- **D-13:** **Backed by the Phase 55 `Dropdown` primitive** (`ui/dropdown.tsx` from plan 55-03). The Dropdown was scoped as an action-menu primitive with no current call sites — the user menu is its first consumer. No hand-rolled Popover.

### Claude's Discretion
- Exact visual sizing / spacing of the breadcrumb trail within the 64px top header (alignment, gap, truncation at small widths)
- Whether `max-w-7xl` container needs adjustment to accommodate breadcrumb + user menu
- Whether to extract a shared `BREADCRUMB_ROUTES` constant alongside route config or keep it with the Breadcrumb component
- How the SubHeader arranges the new Sales/HR toggle + existing DateRangeFilter + upload icon (layout details — left slot internal arrangement)
- Whether to add a subtle hover/focus style to the initials avatar beyond the primitive's default
- Exact initials derivation rule (first+last name? first 2 letters of email local-part? whichever works with current auth user shape)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §21-26 — HDR-01 through HDR-04 (header refactor acceptance criteria)
- `.planning/ROADMAP.md` §Phase 56 — Goal + Success Criteria

### Existing components (primary surface of change)
- `frontend/src/components/NavBar.tsx` — current top header; strip all route-specific controls, add breadcrumb + user menu
- `frontend/src/components/SubHeader.tsx` — destination for relocated Sales/HR Toggle + Upload icon on `/sales` and `/hr`
- `frontend/src/components/ui/toggle.tsx` — Phase 54 Toggle primitive; reused for Sales/HR in SubHeader
- `frontend/src/components/ui/dropdown.tsx` — Phase 55 Dropdown primitive; backs the user menu
- `frontend/src/components/ui/button.tsx` — Phase 55 Button primitive; reused for user menu items + upload link
- `frontend/src/components/LanguageToggle.tsx`, `frontend/src/components/ThemeToggle.tsx` — stay in top header

### Routing & auth context
- `frontend/src/App.tsx` — route table (all routes that need breadcrumb entries)
- `frontend/src/auth/useAuth.ts` / `frontend/src/auth/AdminOnly.tsx` — auth user shape for initials + `signOut`; admin gate on upload

### Prior phase context (patterns, conventions, primitives)
- `.planning/phases/54-toggle-primitive-migrations/54-CONTEXT.md` — Toggle primitive contract
- `.planning/phases/55-consolidated-form-controls/55-CONTEXT.md` — Dropdown/Button/primitive conventions (esp. D-01, D-02, D-08)

### i18n
- `frontend/public/locales/de/translation.json`, `frontend/public/locales/en/translation.json` — DE/EN parity; new `nav.home` key + any new breadcrumb/menu labels must land in both with matching key counts

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Toggle** (`ui/toggle.tsx`): already used for Sales/HR in NavBar — move the same usage into SubHeader unchanged.
- **Dropdown** (`ui/dropdown.tsx`): Phase 55 built it, zero consumers today — user menu is the first real call site. Exercises the primitive for free.
- **Button** (`ui/button.tsx`): ghost variant already used for SignOut; reuse for menu items.
- **wouter `Link`** + `useLocation`: available everywhere; drives both breadcrumb links and route-based visibility in SubHeader.

### Established Patterns
- Fixed two-row header layout: `NavBar` `h-16 top-0`, `SubHeader` `h-12 top-16`. Content offset already accounts for both; relocation keeps total chrome height identical.
- `SubHeader` already does per-route conditional rendering (`location === "/sales"` etc.) — extend the pattern for the Toggle + Upload slots rather than introducing a new abstraction.
- `NavBar` already hides content controls on `/` (launcher) and `/signage` — the same hide-on-launcher pattern applies to breadcrumb (D-03).
- DE/EN i18n parity is enforced across the codebase; add new keys in both files in the same PR.

### Integration Points
- `NavBar.tsx`: add `<Breadcrumb />` between brand and right-side controls; replace Toggle/Upload/Gear/Docs/SignOut JSX block with `<UserMenu />`.
- `SubHeader.tsx`: extend left slot with the Sales/HR Toggle on `/sales` and `/hr`; add right-slot Upload link on the same two routes (alongside existing FreshnessIndicator — planner to place within the current `justify-between` layout).
- New files likely: `frontend/src/components/Breadcrumb.tsx`, `frontend/src/components/UserMenu.tsx`, `frontend/src/lib/breadcrumbs.ts` (route→label map). Planner confirms final file layout.
- `App.tsx` routes are the source of truth for what route patterns need crumb entries; every authenticated route must have a matching entry in the map.

</code_context>

<specifics>
## Specific Ideas

- Breadcrumb format per spec: `Home › Section › [Subsection]` — but rendered with `ChevronRight` icons instead of the literal `›` character (D-05).
- User menu primitive is the Phase 55 `Dropdown` — reusing it immediately validates the primitive without waiting for a later phase to find a call site.
- Removing the back button is a deliberate simplification: breadcrumbs are the canonical "go up" mechanism after this phase.

</specifics>

<deferred>
## Deferred Ideas

- **Dynamic-name crumbs** (e.g., showing an actual playlist title on `/signage/playlists/:id`): not required in Phase 56. If needed later, introduce a `useBreadcrumb([...])` hook and per-page override; track as a follow-up.
- **User profile page / avatar upload**: the menu trigger uses initials only. Any real avatar image or profile-editing surface is a separate phase.
- **Command palette / keyboard nav shortcuts**: out of scope — top header stays mouse/icon driven.
- **Mobile-responsive behavior of breadcrumb trail** (truncation, collapse-to-dropdown): not explicitly scoped; planner may choose a simple overflow-ellipsis fallback, but a dedicated responsive pass can be a later phase if needed.

</deferred>

---

*Phase: 56-breadcrumb-header-content-nav-relocation*
*Context gathered: 2026-04-21*
