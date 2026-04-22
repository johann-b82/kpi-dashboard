---
phase: 57
slug: section-context-standardized-trashcan
status: approved
shadcn_initialized: false
preset: none
created: 2026-04-22
reviewed_at: 2026-04-22
---

# Phase 57 — UI Design Contract

> Visual and interaction contract for two admin-wide primitives: `SectionHeader`
> (heading + short description per admin section) and `DeleteButton` /
> `DeleteDialog` (standardized destructive row action). Pure frontend phase,
> admin surfaces only (`/signage/*` + `/settings/*`). All 8 locked decisions in
> CONTEXT.md (D-01..D-08) are inputs; this spec pins the visual specifics.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (hand-rolled primitives under `frontend/src/components/ui/`) |
| Preset | not applicable |
| Component library | @base-ui/react 1.3.0 (Dialog + Button backing primitives) |
| Icon library | lucide-react 1.8.0 (`Trash2` canonical) |
| Font | project default (Tailwind v4 sans stack via `--font-sans`) |

Primitives reused this phase (no new design tokens):

- `ui/dialog.tsx` — base-ui Dialog wrapper; `DeleteDialog` renders INSIDE `DialogContent` (default surface: `sm:max-w-sm`, `bg-popover`, `rounded-xl`, `p-4`, close-X in top-right).
- `ui/button.tsx` — Phase 55 canonical. `variant="destructive"` supplies the red affordance (`bg-destructive/10 text-destructive hover:bg-destructive/20`). `size="icon"` (size-8) for the row trigger.
- `ui/label.tsx` — not used by these primitives (SectionHeader uses raw `<h2>` + `<p>`).
- `ui/toggle.tsx` (Phase 54), `ui/breadcrumb.tsx` (Phase 56) — listed only as kebab-case naming precedent for new files.

New primitives introduced this phase:

| File | Export | Role |
|------|--------|------|
| `frontend/src/components/ui/section-header.tsx` | `SectionHeader` | Heading + ≤2-line description wrapper (D-03) |
| `frontend/src/components/ui/delete-dialog.tsx` | `DeleteDialog` | Promoted from `components/DeleteConfirmDialog.tsx` (D-01) |
| `frontend/src/components/ui/delete-button.tsx` | `DeleteButton`, `TrashIcon` (re-export of `Trash2`) | Composed icon-trigger + dialog (D-02) |

---

## Spacing Scale

Declared values (all multiples of 4, matching the existing chrome contract from Phase 56):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-text gap inside dialog footer (`gap-1`) |
| sm | 8px | `DialogFooter` button gap (`gap-2`), `SectionHeader` title→description rhythm (`mt-1`) |
| md | 16px | `DialogContent` inner padding (existing `p-4`), dialog internal `gap-4` |
| lg | 24px | Page horizontal padding (`px-6`, existing) |
| xl | 32px | `SectionHeader` top margin on first-section pages (`mt-8`) |
| 2xl | 48px | SubHeader total height (`h-12`, unchanged) |
| 3xl | 64px | NavBar total height (`h-16`, unchanged) |

### SectionHeader rhythm (locked)

The Playlist-editor pattern is the structural source of truth
(`frontend/src/signage/pages/PlaylistEditorPage.tsx` lines 330–336 and 342–349).
Phase 57 **harmonizes** the weight token from `font-semibold` → `font-medium`
across all admin sections to conform to the project's 2-weight typography
contract (see Typography section below). The Playlist editor file itself is
NOT changed in this phase; it is tracked as a future follow-on if flagged as
inconsistent.

Standard pattern (Phase 57 onward):

```
<section>
  <h2 className="text-base font-medium">{title}</h2>
  <p className="text-xs text-muted-foreground" lang={i18n.language}>
    {description}
  </p>
</section>
```

**Focal point:** the `<h2>` title is the primary visual anchor for each admin
section — it is the first textual element consumers scan when landing on a
route. Hierarchy is maintained via size (16px vs 12px body) and color
(`--foreground` vs `--muted-foreground`) rather than weight.

Primitive wrapper rhythm:

| Position | Class | Value |
|----------|-------|-------|
| Wrapper | `mb-6` | 24px bottom gap to section body |
| Title → description | `mt-1` | 4px rhythm (matches Playlist editor: `<p>` renders immediately below `<h2>`) |
| Top-of-page variant | Accept optional `className="mt-8"` | Planner applies at first SectionHeader on a route; not part of primitive default |

The primitive renders `<section>` (landmark) with an `<h2>` title; pages may nest `<h3>` subheads within. **Page H1 is owned by breadcrumbs / top chrome (Phase 56) — SectionHeader never promotes to H1.**

### DeleteButton trigger (row context)

| Property | Value | Rationale |
|----------|-------|-----------|
| Button size | `size="icon"` → `size-8` (32px square) | Matches CTRL-03 `h-8` norm; consistent with other row actions |
| Variant | `variant="destructive"` | D-06 red affordance via token |
| Icon | lucide `Trash2`, `h-4 w-4` (inherited from button primitive's `[&_svg]:size-4`) | Canonical trash icon already used by PlaylistsPage L203, MediaPage, SchedulesPage |
| Button-to-button gap in row cluster | `gap-1` | Existing row-action rhythm (PlaylistsPage uses `gap-1` between Pencil/Copy/Trash2) |

### DeleteDialog surface

Inherits `DialogContent` defaults — **do NOT override**:

| Property | Value (inherited) |
|----------|-------------------|
| Width | `max-w-[calc(100%-2rem)] sm:max-w-sm` (≈384px at `sm` breakpoint) |
| Padding | `p-4` (16px) |
| Gap between header / body / footer | `gap-4` (16px) |
| Radius | `rounded-xl` |
| Ring | `ring-1 ring-foreground/10` |

Footer (`DialogFooter` is `flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2`, existing); two buttons at `size="default"` (h-8).

Exceptions: none.

---

## Typography

All values verbatim Tailwind v4 utility classes resolving through tokens. No new type sizes introduced. **Matches Phase 56 typography scale; hierarchy maintained via size + color (foreground vs muted-foreground), not weight.**

| Role | Size | Weight | Line Height | Tailwind |
|------|------|--------|-------------|----------|
| Section title (`<h2>`) | 16px | 500 (medium) | 1.5 | `text-base font-medium` |
| Section description (`<p>`) | 12px | 400 (regular) | 1.5 | `text-xs text-muted-foreground` |
| Dialog title | 16px | 500 (medium) | 1.25 | `text-base font-medium leading-none` |
| Dialog description / body | 14px | 400 (regular) | 1.5 | `text-sm text-muted-foreground` (existing `DialogDescription`) |
| Item-name highlight inside body | 14px | 500 (medium) | 1.5 | `text-sm font-medium text-foreground` |
| Button label (Cancel / Delete) | 14px | 500 (medium) | 1.0 | inherited from `Button` primitive |

**Total sizes used: 3** (12px, 14px, 16px). **Total weights used: 2** (400 regular, 500 medium) — matches Phase 56 typography scale exactly. The item-name highlight inside dialog body remains differentiable from 400 body copy via weight (500) plus color (`text-foreground` vs `text-muted-foreground`).

> **Note on `DialogTitle` primitive:** the existing base-ui `DialogTitle` primitive currently ships `font-semibold`. Phase 57 overrides this at the call site by passing `className="text-base font-medium leading-none"`. Planner task must confirm override is applied. If a full primitive-level change to `font-medium` is desired, it is tracked as a cross-cutting follow-on (the Phase 56 chrome does not use `DialogTitle`, so no regression risk).

Description length rule (D-07): ≤ 2 visual lines at typical dashboard width. Enforced by **copy**, not by `line-clamp`. CI-adjacent: Planner's i18n task must budget copy accordingly (~120 chars DE / ~100 chars EN max).

---

## Color

Every color resolves from CSS custom properties in `frontend/src/index.css`. **No hardcoded hex values, no `dark:` variants introduced.** Phase 59 invariant applies.

| Role | Token | Usage |
|------|-------|-------|
| Dominant (60%) | `--background` | Page canvas, section body default |
| Secondary (30%) | `--card`, `--popover` | Card surfaces (unchanged); `--popover` backs DialogContent |
| Accent (10%) | `--primary` | **Not used by this phase's primitives** — primary is reserved for active-state emphasis (Phase 56) |
| Destructive | `--destructive` | DeleteButton trigger icon + dialog primary button + destructive ring on focus |

Supporting neutrals (structural, not part of 60/30/10):

| Token | Usage |
|-------|-------|
| `--foreground` | SectionHeader title (`<h2>` default), dialog title, item-name highlight in body |
| `--muted-foreground` | SectionHeader description, DialogDescription body text |
| `--border` | Dialog ring `ring-foreground/10` (existing) |
| `--ring` | Focus-visible ring on Cancel; destructive variant uses `ring-destructive/20` |

**Accent (`--primary`) reserved for:** not applicable this phase. The DeleteButton does NOT get a primary hover state; the SectionHeader title does NOT get `text-primary`. Primary is chrome-only (breadcrumb active, SubHeader active route) per Phase 56.

**Destructive (`--destructive`) reserved for:**

- DeleteButton trigger: `variant="destructive"` supplies `bg-destructive/10 text-destructive hover:bg-destructive/20` (D-06).
- DeleteDialog primary button (Confirm / Delete): `variant="destructive"` identical styling.
- Focus ring on the destructive button: `focus-visible:border-destructive/40 focus-visible:ring-destructive/20` (inherited from button primitive).

**NO other surface uses destructive color.** In particular, SectionHeader never uses destructive; error states inside admin sections are outside this phase.

Focus-ring contract (CTRL-04 invariant, project-wide):

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
```

Both the DeleteButton trigger and the Cancel button inherit this via the Button primitive. No per-element overrides.

---

## Copywriting Contract

All copy uses flat-dotted i18n keys under the single `translation` namespace. Every new key lands in **both** `frontend/src/locales/de.json` and `en.json` in the same plan task (D-07). DE copy is du-tone. CI gate: `node --experimental-strip-types frontend/scripts/check-locale-parity.mts` must print `PARITY OK` before commit.

### New primitive-level keys (4 to add)

| Key | EN | DE | Usage |
|-----|----|----|-------|
| `ui.delete.title` | Delete | Löschen | Default `DialogTitle` when consumer passes no override |
| `ui.delete.cancel` | Cancel | Abbrechen | Cancel button label (autofocused per D-05) |
| `ui.delete.confirm` | Delete | Löschen | Destructive primary button label |
| `ui.delete.bodyFallback` | Are you sure you want to delete **{{itemLabel}}**? This cannot be undone. | Willst du **{{itemLabel}}** wirklich löschen? Das lässt sich nicht rückgängig machen. | Fallback body when consumer passes no `dialogBody` — renders `itemLabel` in `<strong class="text-foreground font-medium">` |

**Two existing keys are reused where available** for `Upload History` compatibility (these already exist — do NOT re-add):

- `delete_title`, `delete_body`, `delete_cancel`, `delete_confirm` (legacy, scoped to upload batches in `DeleteConfirmDialog`).

Planner decision: Upload-history call site may keep its legacy copy by passing explicit `title` / `cancelLabel` / `confirmLabel` props; generic `ui.delete.*` is the default for the 7 admin sections.

### New section-level keys (14 to add — 7 sections × 2 keys)

Pattern: `section.<area>.title` and `section.<area>.description`. All localized in DE (du-tone) + EN.

| Key pair | EN title | EN description (≤2 lines) |
|----------|----------|---------------------------|
| `section.signage.media.*` | Media library | Upload, preview, and delete signage media items. Shared across playlists. |
| `section.signage.playlists.*` | Playlists | Group media into ordered playlists that devices play on a loop. |
| `section.signage.devices.*` | Devices | Pair, tag, and monitor every screen connected to your signage network. |
| `section.signage.schedules.*` | Schedules | Pin playlists to time windows and weekdays. Tags fall back when no schedule is active. |
| `section.signage.tags.*` | Tags | Tags route playlists to devices. Every device and playlist carries one or more. |
| `section.settings.sensors.*` | Sensors | Track environment sensors — add, rename, or remove them here. |
| `section.settings.users.*` | Users | Manage admin access to the dashboard. Sign-in happens via the identity provider. |

DE copy (du-tone; planner may refine):

| Key pair | DE title | DE description |
|----------|----------|----------------|
| `section.signage.media.*` | Medienbibliothek | Lade Medien hoch, prüfe die Vorschau und lösche nicht mehr benötigte Inhalte. Playlist-übergreifend. |
| `section.signage.playlists.*` | Playlists | Bündle Medien zu geordneten Playlists, die deine Geräte in Schleife abspielen. |
| `section.signage.devices.*` | Geräte | Koppele, tagge und überwache jeden Bildschirm in deinem Signage-Netz. |
| `section.signage.schedules.*` | Zeitpläne | Binde Playlists an Zeitfenster und Wochentage. Ohne aktiven Zeitplan greifen die Tags. |
| `section.signage.tags.*` | Tags | Tags verbinden Playlists mit Geräten. Jedes Gerät und jede Playlist trägt mindestens einen. |
| `section.settings.sensors.*` | Sensoren | Überwache Umgebungssensoren — hier kannst du sie hinzufügen, umbenennen oder entfernen. |
| `section.settings.users.*` | Benutzer | Verwalte den Admin-Zugriff auf das Dashboard. Die Anmeldung läuft über den Identity-Provider. |

**If `/settings/users` does not yet exist** (open question Q4 in CONTEXT.md), the Users key pair is still added this phase to satisfy DE/EN parity even though the consumer lands later. **UI researcher call:** reserve the key pair now to avoid a parity churn in a future phase.

### aria-label copy patterns (D-02)

Consumer-supplied per call site. Pattern: `t("ui.delete.ariaLabelFor", { itemKind: t(...), itemLabel: <name> })`.

| Key | EN | DE |
|-----|----|----|
| `ui.delete.ariaLabel` | Delete {{itemLabel}} | {{itemLabel}} löschen |

The DeleteButton does NOT infer aria-label from `itemLabel` alone — consumer must pass it explicitly so the accessible-name audit (Phase 59) finds a literal source.

### Per-element copy table

| Element | Copy |
|---------|------|
| Primary CTA (this phase) | Not applicable — this phase introduces destructive controls only. |
| Empty state | Not applicable — SectionHeader is pure chrome; empty-states belong to consuming tables. |
| Error state | Not applicable — destructive dialog on error is handled by caller's toast/inline error. |
| Destructive confirmation | **Delete / Löschen** (red destructive button); Cancel / Abbrechen is default-focused (D-05); item name rendered `<strong class="text-foreground font-medium">` inside body text. |

### `window.confirm` eradication (D-08)

Zero matches for `window.confirm` in `frontend/src/` after this phase. Current call sites (to migrate):

- `frontend/src/components/settings/sensors/SensorRowForm.tsx`
- `frontend/src/components/settings/sensors/SensorRemoveDialog.tsx` (retired entirely per D-01)

---

## Interaction Contract

### `<SectionHeader title description />` (D-03, SECTION-01, SECTION-02)

- Renders a `<section>` landmark with an `<h2 class="text-base font-medium text-foreground">` title and a `<p class="mt-1 text-xs text-muted-foreground">` description.
- The `<h2>` title is the **focal point** of each admin section (primary visual anchor).
- `lang={i18n.language}` on the `<p>` so browser hyphenation selects the correct dictionary (matches Playlist-editor L334).
- Props: `{ title: string; description: string; className?: string; children?: never }`. Primitive is non-interactive; `children` are NOT accepted (section body lives next to, not inside, the header).
- Null handling: if `title` is empty, primitive renders `null` (safety; should not happen in practice).
- No focus semantics (static content).

### `<DeleteButton />` (D-02, SECTION-03)

- Renders a `<Button variant="destructive" size="icon">` with a lucide `<Trash2 aria-hidden="true" />` glyph.
- Props:
  ```ts
  interface DeleteButtonProps {
    itemLabel: string;                  // interpolated into fallback body + default aria-label
    onConfirm: () => void | Promise<void>;
    dialogTitle?: string;               // default: t("ui.delete.title")
    dialogBody?: ReactNode;             // default: <Trans i18nKey="ui.delete.bodyFallback" values={{itemLabel}} components={{1: <strong className="text-foreground font-medium" />}} />
    cancelLabel?: string;               // default: t("ui.delete.cancel")
    confirmLabel?: string;              // default: t("ui.delete.confirm")
    "aria-label": string;               // REQUIRED — consumer must pass explicit label
    disabled?: boolean;
  }
  ```
- Internally composes `<Dialog>` + `<DeleteDialog>` (from D-01 primitive); consumer never sees dialog plumbing.
- Click opens dialog; dialog's Cancel or backdrop-dismiss closes it; Confirm calls `onConfirm` THEN closes (async: awaits promise, closes on settle regardless of outcome — caller shows toast on error).
- Focus: dialog open → focus lands on Cancel (autoFocus per D-05). On close → focus returns to the trigger (base-ui default).
- Keyboard: Enter/Space on trigger opens dialog; Esc closes; Enter on Cancel dismisses; Enter on Delete confirms.
- Tooltip-on-trigger: **not introduced this phase** (deferred to Phase 59 a11y sweep if audit flags missing affordance).

### `<DeleteDialog />` (D-01, SECTION-04)

- Exported for exotic use (e.g., delete wired to a non-trash trigger like "Discard draft"). Consumers should prefer `<DeleteButton>` for row actions.
- Signature:
  ```ts
  interface DeleteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;              // default: t("ui.delete.title")
    body: ReactNode;             // REQUIRED (for explicit call sites)
    cancelLabel?: string;
    confirmLabel?: string;
    onConfirm: () => void | Promise<void>;
    confirmDisabled?: boolean;   // allows caller to gate during async work
  }
  ```
- Renders: `<Dialog>` → `<DialogContent>` → `<DialogHeader>` with `<DialogTitle className="text-base font-medium leading-none">` + `<DialogDescription>` (body) → `<DialogFooter>` with Cancel (variant="outline", autoFocus) + Confirm (variant="destructive"). Close-X stays in top-right (inherited, `showCloseButton={true}`).
- `DialogTitle` is required by base-ui for a11y; primitive always renders it. `DialogDescription` wraps the body ReactNode.
- Item-label highlighting: body text renders `itemLabel` as `<strong className="text-foreground font-medium">{itemLabel}</strong>` within `muted-foreground` body copy for scan-readable emphasis (weight + color, no size change).

### Dialog focus and escape behavior (base-ui Dialog inherited)

- `initialFocus` on Cancel (our explicit autoFocus; D-05).
- Esc: closes dialog without invoking `onConfirm`.
- Backdrop click: closes dialog without invoking `onConfirm` (base-ui default, retained).
- Focus trap: active while open (base-ui Portal default).
- Return-focus: to trigger element on close.

### Row-context layout guidance (for consuming pages)

- Place DeleteButton as the **last** action in a row-action cluster (`<div class="flex items-center gap-1 justify-end">…<Pencil /><Copy /><DeleteButton />`). Right-anchored destructive placement is convention across Playlists, Schedules, Media today and is preserved.
- Never pair DeleteButton with an adjacent "Delete" text button — only one destructive surface per row.

---

## Dark Mode Invariant

Zero `dark:` Tailwind variants introduced by this phase. Every color resolves through CSS custom properties. Verification gate (post-edit):

```
rg -n "dark:" frontend/src/components/ui/section-header.tsx frontend/src/components/ui/delete-dialog.tsx frontend/src/components/ui/delete-button.tsx
```

Must return zero matches. (The existing `button.tsx` has `dark:bg-destructive/20 dark:hover:bg-destructive/30` fragments in the destructive variant — those are pre-existing Phase 55 code and out of scope for this phase's "no new `dark:`" rule.)

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable (no shadcn in project) |
| Third-party | none | not applicable |

No external component copies are introduced this phase. Every dependency (@base-ui/react, lucide-react, i18next, react) is already installed at a verified version; see `CLAUDE.md` → Technology Stack for provenance.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
