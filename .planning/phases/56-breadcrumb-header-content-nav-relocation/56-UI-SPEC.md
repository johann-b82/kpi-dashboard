---
phase: 56
slug: breadcrumb-header-content-nav-relocation
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-21
---

# Phase 56 — UI Design Contract

> Visual and interaction contract for the top-header refactor: breadcrumb trail, user menu, and relocation of content controls to the SubHeader. Pure frontend phase; every primitive (Toggle, Dropdown, Button) already exists from Phases 54 + 55. This phase is composition, not primitive engineering.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (hand-rolled primitives under `frontend/src/components/ui/`) |
| Preset | not applicable |
| Component library | @base-ui/react 1.3.0 (NOT Radix) |
| Icon library | lucide-react 1.8.0 |
| Font | project default (Tailwind v4 sans stack via `--font-sans`) |

Primitives reused this phase (no new primitives created):

- `ui/toggle.tsx` (Phase 54) — Sales/HR switch in SubHeader
- `ui/dropdown.tsx` (Phase 55) — backs UserMenu (first real consumer)
- `ui/button.tsx` (Phase 55) — menu items, upload link styling
- wouter `<Link>` — breadcrumb crumbs, brand link

---

## Spacing Scale

Declared values (all multiples of 4, matching the existing NavBar/SubHeader chrome contract):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-text gap inside menu items (`gap-1`) |
| sm | 8px | Breadcrumb crumb gap (`gap-1.5` rounds to 6px — see exception) |
| md | 16px | Menu popup inner padding, header right-cluster gap (`gap-4`) |
| lg | 24px | Header horizontal padding (`px-6`), NavBar inter-section gap (`gap-6`) |
| xl | 32px | — |
| 2xl | 48px | SubHeader total height (`h-12`) |
| 3xl | 64px | NavBar total height (`h-16`); combined chrome `pt-28` unchanged |

**Fixed chrome contract (DO NOT CHANGE):**

| Surface | Height | Top offset | Z-index |
|---------|--------|-----------|---------|
| NavBar | 64px (`h-16`) | `top-0` | `z-50` |
| SubHeader | 48px (`h-12`) | `top-16` | `z-40` |
| App content offset | 112px (`pt-28`) | — | — |

Exceptions:

- **Breadcrumb crumb gap = 6px (`gap-1.5`)**: tighter than the 8px rhythm because ChevronRight icon has visual padding baked in; 6px produces optical 8px.
- **Avatar size = 36px (`size-9`)**: matches the existing header icon-button touch target used by ThemeToggle/LanguageToggle triggers, not the h-8 control norm. Required for WCAG 2.5.5 (44px recommended, 36px minimum on pointer surfaces — this is an internal-tool waiver consistent with the rest of the header).
- **Menu popup min-width = 224px (`min-w-56`)**: wide enough to render the identity-header row (email can be 25+ chars) without truncation at the first breakpoint.

---

## Typography

Single sans stack; project does not use a display face. All values are verbatim Tailwind v4 classes resolving through tokens.

| Role | Size | Weight | Line Height | Tailwind |
|------|------|--------|-------------|----------|
| Breadcrumb crumbs | 14px | 400 (regular) | 1.5 | `text-sm` |
| Menu item label | 14px | 400 (regular) | 1.5 | `text-sm` |
| Menu identity name | 14px | 500 (medium) | 1.5 | `text-sm font-medium` |
| Menu identity email | 12px | 400 (regular) | 1.5 | `text-xs` |
| Avatar initials | 14px | 500 (medium) | 1.0 | `text-sm font-medium` |
| Brand (unchanged) | 14px | 500 (medium) | 1.5 | `text-sm font-medium` |

**Total sizes used: 2** (12px, 14px). **Total weights used: 2** (400 regular, 500 medium). No headings or display type in this phase — all surface copy is navigational chrome.

---

## Color

Every color below resolves from existing CSS custom properties in `frontend/src/index.css`. **No hardcoded hex values, no `dark:` variants** (Phase 59 enforces the no-`dark:` invariant across migrated surfaces; this phase must not introduce any).

| Role | Token | Usage |
|------|-------|-------|
| Dominant (60%) | `--background` | Page canvas behind everything |
| Secondary (30%) | `--card` | NavBar surface (`bg-card`); SubHeader `bg-background` (matches existing) |
| Accent (10%) | `--primary` | Breadcrumb link hover (`hover:text-primary`), active route indicator on Upload icon |
| Destructive | `--destructive` | Sign-out menu item label + icon only |

Supporting neutrals (not part of 60/30/10 — structural):

| Token | Usage |
|-------|-------|
| `--foreground` | Breadcrumb non-leaf link text, brand text, menu item text |
| `--muted-foreground` | Breadcrumb leaf crumb (current page), menu identity email row, ChevronRight separator |
| `--muted` | Avatar background, dropdown item `data-[highlighted]` background |
| `--border` | NavBar bottom border (existing) |
| `--ring` | Focus-visible ring on every interactive element |

**Accent reserved for:**

- Breadcrumb non-leaf link on hover (`hover:text-primary`)
- Active-route highlight on the Upload icon in SubHeader (`text-primary` when `location === "/upload"`)

Accent is NOT used for: avatar background, menu items, breadcrumb separators, non-leaf crumbs in default state, sign-out (uses `--destructive`).

**Focus-ring contract (CTRL-04 invariant — already enforced project-wide):**

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
```

Applied uniformly to: breadcrumb links, avatar trigger, all menu items, SubHeader Upload link, Sales/HR Toggle segments. No per-element ring color overrides allowed.

---

## Copywriting Contract

All copy uses flat-dotted i18n keys under the single `translation` namespace. Every key lands in BOTH `frontend/src/locales/de.json` and `en.json` in the same plan task. DE copy uses du-tone where an imperative form exists; these keys are nominal labels so du-tone is mostly neutral. CI gate: `node --experimental-strip-types frontend/scripts/check-locale-parity.mts` must print `PARITY OK`.

### New keys (8 to add)

| Key | EN | DE | Usage |
|-----|----|----|-------|
| `nav.home` | Home | Start | First breadcrumb crumb on every mapped route |
| `breadcrumb.aria_label` | Breadcrumb | Brotkrumen | `<nav aria-label>` on Breadcrumb component |
| `breadcrumb.signage.pair` | Pair | Koppeln | Leaf crumb on `/signage/pair` |
| `userMenu.triggerLabel` | User menu | Benutzermenü | `aria-label` on the avatar trigger |
| `userMenu.docs` | Documentation | Dokumentation | Menu row → `/docs` |
| `userMenu.settings` | Settings | Einstellungen | Menu row → `/settings` |
| `userMenu.signOut` | Sign out | Abmelden | Menu row → `signOut()` |
| `nav.dashboardToggleLabel` | Dashboard | Dashboard-Auswahl | `aria-label` on Sales/HR Toggle in SubHeader |

### Obsolete keys (6 entries to delete — 3 keys × 2 locales)

| Key | Reason |
|-----|--------|
| `nav.back` | Back button removed (D-10) |
| `nav.back_to_sales` | Back button removed (D-10) |
| `nav.back_to_hr` | Back button removed (D-10) |

### Reused keys (no copy changes; must already exist in both locales)

`nav.sales`, `nav.hr`, `nav.upload`, `nav.settings`, `sensors.title`, `signage.admin.page_title`, `signage.admin.nav.media`, `signage.admin.nav.playlists`, `signage.admin.nav.devices`, `signage.admin.nav.schedules`, `settings.sensors_link.title`, `docs.nav.docsLabel`.

### Per-element copy

| Element | Copy source |
|---------|-------------|
| Primary CTA (this phase) | Not applicable — navigational chrome only; no CTA introduced |
| Empty state | Not applicable — breadcrumb renders `null` on `/` and `/login`; no empty-state UI |
| Error state | Not applicable — pure frontend nav with no async fetch |
| Destructive confirmation | Sign out: **no confirm dialog** — single click signs out (matches current behavior; see Phase 57 for standardized destructive patterns) |

### Identity-header row (inside UserMenu dropdown)

- Line 1 (name slot): Email local-part, `font-medium text-foreground`, truncated on overflow.
- Line 2 (email): Full email, `text-xs text-muted-foreground`, truncated on overflow.
- Non-interactive; rendered as `<div>` (NOT `Menu.Item`) so it is not in the roving-tabindex.

Example (email `johann.bechtold@example.com`):

```
johann.bechtold
johann.bechtold@example.com
```

### Initials derivation (avatar label)

1. Split email at `@`, take local-part (`johann.bechtold`).
2. Split local-part on `[.\-_]+` and drop empties.
3. If ≥2 parts: concatenate first letter of parts[0] + first letter of parts[1], uppercase → `JB`.
4. Else: first 2 chars of local-part, uppercased → `AD` for `admin@…`.
5. If local-part is empty (impossible but defensive): render lucide `<User>` icon instead.

---

## Interaction Contract

### Breadcrumb (HDR-02, HDR-03)

- Structure: `<nav aria-label>` > `<ol>` > `<li>` per crumb.
- Separator: lucide `ChevronRight` (16px, `text-muted-foreground`, `aria-hidden`). Appears between crumbs, never before the first or after the last.
- Non-leaf crumbs: wouter `<Link>` → renders `<a href>`. Tab focuses, Enter navigates natively — no custom keyboard handler.
- Leaf crumb: `<span aria-current="page">`, `text-muted-foreground`, not focusable.
- Home crumb: always the first entry, always a link, key = `nav.home`, href = `/`.
- Render suppression: `matchBreadcrumb("/") === null` and `matchBreadcrumb("/login") === null` → component returns `null`.
- Hover: non-leaf crumbs transition to `--primary` (`hover:text-primary transition-colors`).
- Focus: `focus-visible:ring-2 focus-visible:ring-ring rounded`.
- Truncation: not scoped this phase (deferred to responsive pass); planner may add `truncate max-w-[Xch]` per crumb as a safety net.

### UserMenu (HDR-01, HDR-04)

- Trigger: circular 36px button, `rounded-full size-9 bg-muted`, centered initials or fallback `<User>` icon.
- Hover: `hover:bg-accent/20`.
- Focus: same `--ring` contract.
- `aria-label` = `t("userMenu.triggerLabel")`.
- Popup alignment: `align="end"` (right-aligned under trigger), `min-w-56`.
- Keyboard (provided by base-ui Menu): Arrow Up/Down navigates items, Enter activates, Esc closes, Tab closes + moves focus forward.
- Item rendering decision (from RESEARCH Pitfall 3):
  - Docs, Settings → `Menu.LinkItem` with `render={<WouterLink href="…" />}` (preferred: client-side nav).
  - If that breaks base-ui's highlight state, fallback to `Menu.Item onClick={() => navigate("…")}`.
  - Sign out → `DropdownItem onClick={() => void signOut()}` — button semantics are correct (not a navigation).

### Sales/HR Toggle in SubHeader (HDR-04, TOGGLE-04 reuse)

- Rendered only when `location === "/sales" || location === "/hr"`.
- 2-tuple segments: `[{value: "/sales", label: "Sales"}, {value: "/hr", label: "HR"}]`.
- Value bound to current pathname; `onChange` calls wouter `navigate(path)`.
- Respects `prefers-reduced-motion` (Phase 54 invariant — indicator swaps instantly).
- `aria-label` = `t("nav.dashboardToggleLabel")`.
- Border override: `className="border-transparent"` to blend into SubHeader background.

### Upload icon in SubHeader (HDR-04)

- Rendered only when `isDashboard && <AdminOnly>` gate passes.
- 32px square tap target (`p-1.5` + 16px icon = 28px interior + padding).
- Icon: lucide `Upload`, `h-4 w-4`.
- Active state: when `location === "/upload"` (never true on `/sales` or `/hr`, but kept for symmetry with existing pattern) → `text-primary`; default → `text-foreground`.
- Hover: `hover:bg-accent/10`.
- `aria-label` = `t("nav.upload")` (existing key).

---

## Dark Mode Invariant

Zero `dark:` Tailwind variants introduced by this phase. Every color resolves through CSS custom properties (`--background`, `--foreground`, `--muted`, `--muted-foreground`, `--primary`, `--destructive`, `--ring`, `--card`, `--border`). Light/dark parity is derived automatically from `:root` vs `.dark` token scopes already defined in `index.css`.

Verification gate (post-edit): `rg -n "dark:" frontend/src/components/Breadcrumb.tsx frontend/src/components/UserMenu.tsx frontend/src/components/NavBar.tsx frontend/src/components/SubHeader.tsx` must return zero matches.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable (no shadcn in project) |
| Third-party | none | not applicable |

No external component copies are introduced this phase. Every dependency (wouter, @base-ui/react, lucide-react, i18next) is already installed at a verified version; see RESEARCH §Standard Stack for provenance.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
