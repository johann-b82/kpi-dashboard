---
phase: 70
slug: mig-sign-devices
status: approved
shadcn_initialized: true
preset: base-nova
created: 2026-04-25
reviewed_at: 2026-04-25
---

# Phase 70 — UI Design Contract

> Visual and interaction contract for MIG-SIGN — Devices. Phase 70 is a backend writer-swap (FastAPI → Directus SDK) plus a `useQueries` merge on the existing `/signage/devices` admin page. **No new visual surfaces.** This spec locks v1.21 visual parity as the contract and pins the per-row "playlist" cell loading/error semantics introduced by the new per-device `GET /api/signage/resolved/{device_id}` fetch.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn |
| Preset | `base-nova` (from `frontend/components.json`) |
| Component library | Radix (via shadcn primitives) |
| Icon library | lucide-react |
| Font | Inherits app default (Tailwind v4 CSS vars; no override this phase) |

Detected from `frontend/components.json`: `style: base-nova`, `baseColor: neutral`, `cssVariables: true`, `iconLibrary: lucide`, `aliases: @/components`, `@/components/ui`, `@/lib`. No third-party registries. No new shadcn blocks added by this phase — Devices page already uses `Table`, `Dialog`, `Button`, `Badge`, plus project primitives `SectionHeader`, `DeviceStatusChip`, `DeviceEditDialog`, `UptimeBadge`.

---

## Spacing Scale

Declared values (must be multiples of 4 — Tailwind defaults; no project override):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | `gap-1` between row action icons + tag badge gaps |
| sm | 8px | `gap-2` inline icon/label, dialog footer button gap |
| md | 16px | `space-y-4` section vertical rhythm, `p-4` card padding |
| lg | 24px | `mt-6` between SectionHeader and table |
| xl | 32px | `mt-8` SectionHeader top margin (existing `DevicesPage` uses this) |
| 2xl | 48px | `p-12` empty-state container padding (existing) |
| 3xl | 64px | Reserved (no new use this phase) |

**Exceptions:** Icon button uses `size-icon-sm` (Button primitive variant) — sized by component, not the spacing scale. Touch target ≥32px preserved by primitive.

---

## Typography

Inherits existing app/Tailwind defaults via shadcn `base-nova` preset. No new typographic roles introduced this phase. The contract pins the four roles in active use on `DevicesPage`:

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px (`text-sm`) | 400 | 1.5 (Tailwind default for `text-sm`) |
| Label (column header / cell text) | 14px (`text-sm`) | 600 (`font-semibold` for device name; 400 for muted cells) | 1.5 |
| Heading (empty-state h2, dialog title) | 18px (`text-lg`) | 600 (`font-semibold`) | 1.4 (`leading-7`) |
| Display | not used on this surface | — | — |

Three sizes in active use (14, 18 — plus `text-xs` 12px on tag badges only). Two weights (400, 600). Within budget.

---

## Color

Token-driven via Tailwind CSS variables (no `dark:` variants per cross-cutting hazard #3). Concrete values come from existing `frontend/src/index.css` `--background` / `--card` / `--primary` / `--destructive` / `--muted-foreground` tokens — **do not redefine in this phase**.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `bg-background` | Page background, table cells, empty-state default |
| Secondary (30%) | `bg-card` + `border-border` | Table container card, empty-state container |
| Accent (10%) | `bg-primary` (via default `Button` variant) | Pair-new-device CTA, dialog confirm button (non-destructive paths) |
| Destructive | `text-destructive` + `variant="destructive"` Button | Revoke-device confirm, ShieldOff icon on row |

**Accent reserved for:** the `Pair new device` button at the bottom of the list **and** the primary action button inside non-destructive dialogs (e.g., the existing `DeviceEditDialog` save action). Accent MUST NOT be used for: row hover, status chip backgrounds, tag badges (use `variant="secondary"`), uptime/missed badges (their own variant), playlist-name cell text.

**Destructive reserved for:** the `Revoke device access` dialog confirm button **and** the `ShieldOff` row-action icon (`text-destructive`). No other element on the page uses destructive color.

**Muted-foreground:** "Last seen" relative time, "Playlist" cell text, empty-state body text, em-dash placeholders.

---

## Copywriting Contract

All copy must come from `frontend/src/locales/en.json` (existing keys). DE parity enforced by cross-cutting hazard #1. **No new keys are created by this phase** — the FE swap uses Directus internally but consumer-facing strings are unchanged.

| Element | Copy (key → text) |
|---------|------|
| Primary CTA (bottom of list + empty state) | `signage.admin.devices.pair_button` → "Pair new device" / `…empty_cta` → "Pair device" |
| Empty state heading | `signage.admin.devices.empty_title` → "No devices yet" |
| Empty state body | `signage.admin.devices.empty_body` → "Pair a device to start displaying playlists." |
| Error state — list load failure | Use existing toast pattern: `toast.error(err.message)` (no new copy; matches Phase 69 D-03 inline-swap convention) |
| Error state — per-device resolved fetch failure | Render em-dash `—` in the Playlist cell, identical to today's "no resolved playlist" rendering at line 185 of `DevicesPage.tsx`. **No toast** for per-row failure (it would noise-spam on a stack of N parallel queries — D-02b). |
| Loading state — per-device resolved fetch in flight | Render em-dash `—` in the Playlist cell while `isPending`. No skeleton — preserves current visual rhythm and avoids layout shift on the typical <500ms resolution. |
| Destructive confirmation — Revoke | `signage.admin.device.revoke_title` → "Revoke device access" + `…revoke_confirm_body` → "Revoke access for \"{{name}}\"? The device will stop playing until it re-pairs." + `…revoke_confirm` → "Revoke access" / `…revoke_cancel` → existing cancel key |
| Destructive confirmation — Delete (NEW writer behind existing Revoke flow) | Reuse the existing Revoke dialog copy and shape. The Phase 70 migration replaces the FastAPI revoke endpoint with a Directus `deleteItem('signage_devices', id)` call inside `signageApi.revokeDevice`; the dialog copy MUST NOT change (consumer contract per D-00g). |
| Edit-device dialog | Copy owned by existing `DeviceEditDialog` component — no change |

---

## Interaction Contract — Per-Device Resolved Playlist Cell

Phase 70 introduces a new client-side fetch pattern: each device row's "Playlist" cell is fed by an independent `useQuery` keyed `['fastapi', 'resolved', deviceId]` (D-02). The visible behavior contract:

| Fetch state | Cell render | Rationale |
|-------------|-------------|-----------|
| `isPending` (initial) | `—` (em-dash, `text-muted-foreground`) | Matches today's "null playlist" rendering; zero layout shift on typical <500ms resolve |
| `isSuccess`, `current_playlist_name` truthy | Playlist name in `text-sm text-muted-foreground` | Identical to v1.21 line 185 |
| `isSuccess`, name null but `current_playlist_id` truthy | UUID string in `text-sm text-muted-foreground` | Identical to v1.21 fallback |
| `isSuccess`, both null | `—` (em-dash, `text-muted-foreground`) | Identical to v1.21 |
| `isError` | `—` (em-dash, `text-muted-foreground`) | Silent fallback per D-02b — no per-row toast |

**No new visual primitives.** No skeleton, no spinner, no inline error chip. The cell is read-only and ephemeral; the list refetches on SSE `playlist-changed` (D-02c invalidates the per-device key).

---

## Visual Parity Lock (v1.21 → v1.22)

This phase is a writer-swap. The following must be byte-for-byte visually identical to v1.21 ship:

- Table header order, labels, and alignment (8 columns: Name, Status, Uptime 24h, Missed 24h, Tags, Playlist, Last seen, Actions)
- Row layout: name (semibold) · status chip · uptime badge · missed badge · tag badges (secondary, `text-xs`, wrapping) · playlist (muted) · relative time (muted) · two icon-sm ghost buttons right-aligned (Pencil / ShieldOff-destructive)
- Empty state: bordered card, `p-12`, centered, h2 + body + primary button
- Pair-new-device CTA right-aligned below the table (Phase v1.19 quick task `260422-i41` placement)
- SectionHeader at top with `mt-8` (existing)
- DE/EN i18n keys unchanged

**Checker test:** open `/signage/devices` on a v1.21 build and a v1.22 build with the same seed data — pixel diff (excluding the per-cell async load order) must be zero.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | None added this phase (existing: Table, Dialog, Button, Badge — already in repo) | not required |
| third-party | none declared | not applicable |

No third-party registry use. `registries: {}` in `frontend/components.json` confirmed empty.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
