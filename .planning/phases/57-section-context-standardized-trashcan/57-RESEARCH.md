# Phase 57: Section Context + Standardized Trashcan — Research

**Researched:** 2026-04-22
**Domain:** Frontend UI primitive extraction + admin-section chrome consistency (React 19 / Vite 8 / Tailwind v4 / @base-ui/react 1.3.0 / i18next)
**Confidence:** HIGH (all answers verified by direct file reads — 100% in-repo, no external dependencies)

---

## Executive Summary

- **All 4 OPEN QUESTIONS answered against actual files.** Playlist-editor SOTT is verified at `frontend/src/signage/pages/PlaylistEditorPage.tsx:330-336` (preview section) and `:342-349` (items section) — UI-SPEC's cited range is correct; CONTEXT's `:330-349` spans both sections.
- **No `useDeleteMutation` hook exists.** Every page inlines its own `useMutation`. The `<DeleteButton>` primitive MUST stay mutation-agnostic (`onConfirm` only) — do not wrap React Query logic inside the primitive.
- **Dialog base is `@base-ui/react/dialog`** (not shadcn, not Radix directly). Promoted `DeleteDialog` wraps the existing `components/ui/dialog.tsx` wrapper stack (`Dialog` → `DialogContent` → `DialogHeader`/`DialogTitle`/`DialogDescription` → `DialogFooter`). UI-SPEC claim is correct.
- **No `/settings/users` route. No `/signage/tags` route.** Only 5 of the 7 "admin sections" in D-04 exist as routes today: Media, Playlists, Devices, Schedules, Sensors. Planner must descope Users and Tags OR define them as "reserve keys only, no consumer yet."
- **Zero `window.confirm` calls exist.** Only two comment references in `SensorRowForm.tsx:36` and `SensorRemoveDialog.tsx:14`. D-08 is already de facto satisfied; phase only needs to keep the `grep -rn "window.confirm" frontend/src` gate green.
- **Four (not three) ad-hoc delete-dialog call-sites to retire:** `MediaDeleteDialog`, `ScheduleDeleteDialog`, `SensorRemoveDialog`, AND an **inline Dialog** in `PlaylistsPage.tsx:215-250` (not a separate component). The inline one needs explicit migration too.
- **Devices page has NO Delete action** — it has a `Revoke` action (`ShieldOff` icon, `DevicesPage.tsx:210-217`). Revoke is semantically distinct (network credential revoke, not row delete); planner should decide whether SECTION-03 covers it. Recommendation: leave Revoke alone, document as out of scope for the standardized-Trashcan requirement.

**Primary recommendation:** Ship three new kebab-case primitives (`section-header.tsx`, `delete-dialog.tsx`, `delete-button.tsx`) under `frontend/src/components/ui/`, then migrate the 5 live admin sections + 4 delete-dialog call-sites + 5 Trash icon call-sites. Reserve i18n keys for Users + Tags even though no route consumes them yet (UI-SPEC §Copywriting explicitly allows this).

---

## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim)

- **D-01** Promote `components/DeleteConfirmDialog.tsx` → `components/ui/delete-dialog.tsx` (kebab-case). Retire `MediaDeleteDialog`, `ScheduleDeleteDialog`, `SensorRemoveDialog`.
- **D-02** `<DeleteButton />` under `components/ui/delete-button.tsx` — self-contained composed control (icon trigger + dialog). Also export `TrashIcon` as re-export of lucide `Trash2`.
- **D-03** `<SectionHeader title description />` under `components/ui/section-header.tsx`. Spacing/typography match Playlist-editor SOTT.
- **D-04** Admin-only scope: `/signage/*` (Media, Playlists, Devices, Schedules, Tags) + `/settings/*` (Sensors, Users). Dashboards OUT.
- **D-05** Item-name in dialog body; default focus on Cancel (autoFocus); no typed-confirmation.
- **D-06** Destructive variant stays red; `--primary` (blue) reserved for active-state emphasis only.
- **D-07** DE/EN parity CI green before commit; new keys land in both locales together.
- **D-08** Zero `window.confirm` after this phase.

### Claude's Discretion

- Exact spacing/typography inside `SectionHeader` (UI-SPEC already pinned this — `text-base font-medium` + `text-xs text-muted-foreground` + `mt-1`).
- Whether `DeleteButton` internalizes its own `open` state or accepts controlled `open`/`onOpenChange` props. **Recommendation:** internalize — cleaner API, matches UI-SPEC §Interaction Contract.
- Whether to migrate `PlaylistsPage.tsx` inline Dialog (line 215-250) as a retire-a-variant task or fold into the Playlists call-site migration. **Recommendation:** fold in; it's the same work.

### Deferred Ideas (OUT OF SCOPE)

- Typed-confirmation ("type DELETE to continue")
- Bulk delete flows
- Per-section help-text tooltips
- `SectionHeader` variant with inline action button to the right
- Migrating `PlaylistEditorPage.tsx` itself (`font-semibold` there is tracked as future follow-on per UI-SPEC §Typography note)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SECTION-01 | Heading + ≤2-line description on every admin section | Q1 (SOTT at PlaylistEditorPage:330-349), Q4/Q7 (inventory of existing heading markup — ALL 5 existing admin sections lack a proper heading+description block; each needs a diff) |
| SECTION-02 | DE (du-tone) + EN key parity | Q9 (14 new section keys + 4 primitive keys; no collisions with existing `signage.admin.*.delete_*`, `sensors.admin.remove_confirm.*`, `delete_*` legacy) |
| SECTION-03 | Single `<TrashIcon>` / delete-button under `components/ui/` is the only destructive row action | Q6 (5 Trash2 call-sites to migrate); Devices page uses `ShieldOff` revoke — NOT in scope |
| SECTION-04 | Shared delete button → shared confirm dialog; no `window.confirm`, no one-off variants | Q2 (mutation-agnostic), Q3 (base-ui/react), Q5 (0 window.confirm), Q8 (4 variants to retire incl. inline) |

---

## Answers to Research Questions

### Q1. Playlist-editor visual source of truth

**Verified file:** `frontend/src/signage/pages/PlaylistEditorPage.tsx`

The pattern appears **twice** in that file:

- **Preview section** — `:330-336`:
  ```tsx
  <section>
    <h2 className="text-base font-semibold">
      {t("signage.admin.editor.preview_title")}
    </h2>
    <p className="text-xs text-muted-foreground mb-2" lang={i18n.language}>
      {t("signage.admin.editor.preview_help")}
    </p>
  ```
- **Items section** — `:342-349`:
  ```tsx
  <section className="space-y-3">
    <div>
      <h2 className="text-base font-semibold">
        {t("signage.admin.editor.items_title")}
      </h2>
      <p className="text-xs text-muted-foreground" lang={i18n.language}>
        {t("signage.admin.editor.items_help")}
      </p>
    </div>
  ```

**Reconciliation:** UI-SPEC's `330-336` / `342-349` is the authoritative pair. CONTEXT.md's `330-349` is a loose superset (spans both). **Pin both ranges** in the plan. The primitive's `<h2>` uses `font-medium` (Phase 57 harmonization, UI-SPEC §Typography) — do not carry `font-semibold` forward. The Playlist editor itself is NOT edited this phase (UI-SPEC §SectionHeader rhythm).

### Q2. `useDeleteMutation` pattern

**There is no such hook.** Each admin page inlines its own `useMutation` directly:

- `frontend/src/signage/pages/MediaPage.tsx:69` — `const deleteMutation = useMutation({ mutationFn: (id: string) => signageApi.deleteMedia(id), onSuccess: invalidate + toast + dialog close, onError: 409 handling })`
- `frontend/src/signage/pages/PlaylistsPage.tsx:79` — `const deleteMutation = useMutation({ mutationFn: (id: string) => signageApi.deletePlaylist(id), ... })`
- `frontend/src/signage/pages/SchedulesPage.tsx:166` — `const deleteMutation = useMutation({ ... })`
- **No hook wrapper exists** in `frontend/src/hooks/`, `frontend/src/signage/lib/`, or `frontend/src/components/settings/`.

**Implication for `<DeleteButton>` API:** Stay mutation-agnostic. `onConfirm: () => void | Promise<void>` is the only contract. Each call-site keeps its own `useMutation` and passes `deleteMutation.mutate(id)` as `onConfirm`. This matches UI-SPEC §DeleteButton props. **Do NOT introduce a `useDeleteMutation` hook this phase** — 409 handling (Media) and optimistic updates (potential future) differ too much across call-sites.

### Q3. Dialog base primitive

**Verified file:** `frontend/src/components/ui/dialog.tsx`

- **Line 2:** `import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"` — confirms UI-SPEC's `@base-ui/react` claim.
- **Exports (`:147-158`):** `Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger`.
- **`DialogContent` default surface (`:54`):** `fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 ... sm:max-w-sm` — **exactly what UI-SPEC §DeleteDialog surface specifies** (inherited, not overridden).
- **`DialogTitle` default class (`:118-128`):** `font-heading text-base leading-none font-medium` — **already `font-medium`**, NOT `font-semibold`. UI-SPEC §Typography "Note on DialogTitle" is stale; no override needed. Verify at plan-time by reading `dialog.tsx:123`. **Planner: remove the "DialogTitle override" line item from UI-SPEC** — it's a no-op.
- **Close button (`:60-74`):** top-right X via `DialogPrimitive.Close` render-prop'd with `<Button variant="ghost" size="icon-sm" />`.

**Exact imports the promoted `delete-dialog.tsx` will need:**
```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
```
(Same as existing `DeleteConfirmDialog.tsx:1-10`.)

### Q4. Users admin route status

**Does NOT exist today.** Verified by:

- `frontend/src/App.tsx:74-75` — only `/settings/sensors` and `/settings` routes exist under `/settings`.
- `frontend/src/pages/` ls — no `UsersPage.tsx` / `UsersSettingsPage.tsx` / `AdminUsersPage.tsx`.
- Grep for `/settings/users`, `UsersPage` — zero matches in `frontend/src/`.

**What exists under `/settings/*`:**
- `/settings/sensors` → `SensorsSettingsPage` (pages/SensorsSettingsPage.tsx)
- `/settings` → `SettingsPage` (pages/SettingsPage.tsx) — general site settings (logo, HR targets, thresholds, colour picker)

**Recommendation for planner:**
- **Descope Users from SECTION-01/SECTION-03 consumer migration** — there is no page component to add a heading to or to put a DeleteButton on.
- **Keep Users i18n keys reserved this phase** (`section.settings.users.title` + `section.settings.users.description`) per UI-SPEC's explicit note ("reserve the key pair now to avoid parity churn").
- Document as deferred work in CONTEXT §Deferred: "Users admin page — page scaffold lives in a future Authentik/identity phase; section-header call-site migration lands then."

### Q5. Current `window.confirm` call-sites

**Zero actual call-sites.** Grep `window\.confirm` in `frontend/src` returns only two **comment** references:

- `frontend/src/components/settings/sensors/SensorRowForm.tsx:36` — `// (Plan 40-02 SensorRemoveDialog) replacing the old window.confirm().`
- `frontend/src/components/settings/sensors/SensorRemoveDialog.tsx:14` — `* window.confirm() stub from Plan 40-01.`

**Implication:** D-08 is already satisfied at runtime. The phase's "eradication" gate is trivially green. Planner should add the CI grep assertion anyway (as UI-SPEC §window.confirm eradication specifies) to prevent regressions. The two comment lines can optionally be cleaned up as the historical context is no longer useful once SensorRemoveDialog itself is retired.

### Q6. Existing Trash icon usage patterns — per-file migration spec

| File | Line | Current shape | Migration |
|------|------|---------------|-----------|
| `frontend/src/signage/pages/PlaylistsPage.tsx` | `:196-204` | `<Button variant="ghost" size="sm" onClick={() => setDeleteTarget(p)} aria-label="Delete {name}"><Trash2 className="w-4 h-4 text-destructive" /></Button>` | Replace with `<DeleteButton itemLabel={p.name} onConfirm={() => deleteMutation.mutate(p.id)} aria-label={...}>`. Also delete the **inline Dialog at `:215-250`**. `setDeleteTarget` state becomes unnecessary (primitive owns it). |
| `frontend/src/signage/pages/MediaPage.tsx` | `:206-215` | `<Button variant="ghost" size="sm" onClick={() => onClickDelete(media)} aria-label={t("signage.admin.media.delete_title")}><Trash2 className="w-4 h-4 text-muted-foreground" /></Button>` + `MediaDeleteDialog` at `:227-232` | **Complication:** Media has 409-in-use mode (two-state dialog). `<DeleteButton>` primitive supports only single-confirm mode. Planner options: (a) keep `MediaDeleteDialog` in-place for the in-use branch and use `<DeleteButton>` for the confirm branch (two dialogs, one per mode) — messy; (b) introduce a `dialogBody` override path where the 409 callback swaps the body — clean; (c) exception: Media keeps a thin wrapper that composes `DeleteButton` with conditional `MediaInUseDialog`. **Recommendation:** keep a slim `MediaInUseDialog` (renamed from the "in_use" branch of `MediaDeleteDialog`) for the post-409 follow-up, and use `<DeleteButton>` for the initial confirm. Net result: one variant retired, one narrow single-purpose dialog remains. |
| `frontend/src/signage/pages/SchedulesPage.tsx` | `:315-323` | `<Button variant="ghost" size="sm" onClick={() => setDeleteTarget(s)} aria-label="Delete {name}"><Trash2 className="w-4 h-4 text-destructive" /></Button>` + `ScheduleDeleteDialog` at `:341+` | Clean replace with `<DeleteButton>`; delete `ScheduleDeleteDialog.tsx`. |
| `frontend/src/components/settings/sensors/SensorRowForm.tsx` | `:213-222` | `<Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleRemove} disabled={isMarkedForDelete}><Trash2 className="h-4 w-4 mr-1" aria-hidden />...label</Button>` + `SensorRemoveDialog` at `:225-230` | **Special case:** this is a text+icon button with a visible label ("Remove sensor"), not an icon-only trigger. Also routes new-row (id=null) drops directly without dialog. **Planner options:** (a) keep the text-button shape, use `DeleteDialog` primitive directly (skip `DeleteButton`); (b) add a `<DeleteButton variant="label">` mode. **Recommendation:** (a) — row-deletion in Sensors is mid-form, not a table row; the icon-only contract doesn't fit. Use `DeleteDialog` directly. Delete `SensorRemoveDialog.tsx`. |
| `frontend/src/components/UploadHistory.tsx` | `:117-126` | `<AdminOnly><Button variant="ghost" size="icon" onClick={() => setSelectedBatch(batch)} aria-label={t("delete_title")} className="hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button></AdminOnly>` + `DeleteConfirmDialog` at `:133+` | **Not in D-04 admin scope** (`/upload` is its own surface, not `/signage` or `/settings`). **Planner decision:** either include in migration (arguably UploadHistory is admin-only) or leave as-is. Legacy i18n keys (`delete_title`, `delete_body` etc.) live here. UI-SPEC §Copywriting §Upload History compatibility allows this call-site to keep legacy keys via explicit `title`/`cancelLabel`/`confirmLabel` props. **Recommendation:** migrate to `<DeleteButton>` pass-through of legacy keys, to close the "standardized Trashcan" contract across all admin surfaces, even though D-04 doesn't explicitly list it. Decide with user at plan-time. |

**Devices page (intentionally NOT in this table):** `DevicesPage.tsx:210-217` uses `<ShieldOff className="h-4 w-4 text-destructive" />` for a **Revoke** action (network-credential revoke, returns 200 → device must re-pair). Semantically distinct from delete. Planner: **leave Revoke alone** in SECTION-03 scope — it's not a row-delete.

### Q7. Current heading markup per admin section (for SectionHeader migration)

| Section | Route | File | Current page-top heading | Has description? |
|---------|-------|------|--------------------------|------------------|
| Signage parent (shared chrome) | `/signage/*` | `signage/pages/SignagePage.tsx:35` | `<h1 className="text-3xl font-semibold">{t("signage.admin.page_title")}</h1>` | No. This is an `<h1>` shared by all 4 signage tabs. |
| Media | `/signage/media` | `signage/pages/MediaPage.tsx` | **No top heading** for the section (only empty-state `<h2>` at `:145`). | No |
| Playlists | `/signage/playlists` | `signage/pages/PlaylistsPage.tsx` | **No top heading** (only empty-state `<h2>` at `:147`). | No |
| Devices | `/signage/devices` | `signage/pages/DevicesPage.tsx:120` | `<h2 className="text-lg font-semibold">{t("signage.admin.devices.col_name")}</h2>` — **this is actually the "Name" column label repurposed as a page heading** and should be replaced with a proper title key. Empty-state also has `<h2>` at `:101`. | No |
| Schedules | `/signage/schedules` | `signage/pages/SchedulesPage.tsx` | **No top heading** (only empty-state `<h2>` at `:214`). | No |
| Sensors | `/settings/sensors` | `pages/SensorsSettingsPage.tsx:138` uses `<SensorAdminHeader />` → `components/settings/sensors/SensorAdminHeader.tsx:13` — `<h1 className="text-3xl font-semibold leading-tight">` + `:16` `<p className="text-base text-muted-foreground">` | **Yes — existing heading+description pair**, but uses `<h1>` + `text-3xl` + `text-base`, not the `<h2>` + `text-base` + `text-xs` SOTT. Migration collapses `SensorAdminHeader` to `<SectionHeader />`. Existing i18n keys inside `SensorAdminHeader` should be mapped to the new `section.settings.sensors.*` keys (or kept and aliased — planner call). |
| Tags | _no route_ | n/a | n/a — no page | Defer (reserve i18n keys only per UI-SPEC). |
| Users | _no route_ | n/a | n/a — no page | Defer (reserve i18n keys only per UI-SPEC). |

**Implication:** planner must add `<SectionHeader />` at the top of each of the 5 existing section pages. For `Sensors`, the migration is a **replace** of `SensorAdminHeader` (retire the component or rewrite it to wrap `SectionHeader`). For `MediaPage`, `PlaylistsPage`, `SchedulesPage` — net-new `<SectionHeader />` insertion at the top of each page body. For `DevicesPage` — replace the misappropriated `<h2>` at `:120` (which is `col_name` key!) with a proper `<SectionHeader />`.

**Also:** `SignagePage.tsx:35` `<h1>` remains the page H1 for all signage tabs. SectionHeader's `<h2>` nests underneath it — correct hierarchy. For `/settings/sensors` the current `<h1>` inside `SensorAdminHeader` needs to demote to `<h2>` via SectionHeader, OR the planner must decide: keep one shared `<h1>` for the Settings pages (does not exist today — `SettingsPage.tsx` has no shared shell like SignagePage). Phase 56 breadcrumbs own the H1 per UI-SPEC §SectionHeader rhythm — so demoting to `<h2>` is correct.

### Q8. Existing feature-variant dialogs to retire — import audit

Grep for each import name across `frontend/src/`:

- **`MediaDeleteDialog`** imported in: `frontend/src/signage/pages/MediaPage.tsx:19-21` (only consumer). Type export `MediaDeleteDialogMode` also imported there. Retire plan: extract the `in_use` branch into a new `MediaInUseDialog.tsx` (see Q6), delete `MediaDeleteDialog.tsx`.
- **`ScheduleDeleteDialog`** imported in: `frontend/src/signage/pages/SchedulesPage.tsx:25` (only consumer). Clean retire — delete the file.
- **`SensorRemoveDialog`** imported in: `frontend/src/components/settings/sensors/SensorRowForm.tsx:10` (only consumer). Clean retire — delete the file.
- **`DeleteConfirmDialog`** imported in: `frontend/src/components/UploadHistory.tsx:17` (only consumer). Per D-01, this is the one being **promoted** to `components/ui/delete-dialog.tsx`. After promotion, UploadHistory's import updates to the new path; the old file at `components/DeleteConfirmDialog.tsx` is deleted.
- **Inline Dialog in PlaylistsPage.tsx:215-250** — no separate file, no named export. This is a fourth variant that the CONTEXT listing missed. Retire by deleting lines `:215-250` and replacing the `setDeleteTarget` state with internalized `<DeleteButton>` state.

### Q9. i18n key inventory — collision check

**Existing keys that DO NOT collide with UI-SPEC's new keys:**

Upload (legacy, keep):
- `delete_title`, `delete_body`, `delete_confirm`, `delete_cancel` (`en.json:23-26`, `de.json` pair)

Signage delete keys (will be superseded by `ui.delete.*` after migration, but can coexist):
- `signage.admin.media.delete_title`, `.delete_body`, `.delete_confirm`, `.delete_cancel`, `.delete_in_use_title`, `.delete_in_use_body`, `.delete_in_use_close` (`en.json:229-235`)
- `signage.admin.playlists.delete_title`, `.delete_body`, `.delete_confirm`, `.delete_cancel` (`en.json:244-247`)
- `signage.admin.schedules.delete.title`, `.body`, `.confirm`, `.cancel` (`en.json:373-376`)
- `sensors.admin.remove_confirm.title`, `.body`, `.confirm`, `.cancel` (`en.json:420-423`)

Device revoke (unrelated):
- `signage.admin.device.revoke_title`, `.revoke_confirm_body`, `.revoke_confirm`, `.revoke_cancel`, `.revoked`, `.revoke_error` (`en.json:292-297`)

**New keys to add (from UI-SPEC, no collisions):**

Primitive keys (4):
- `ui.delete.title`, `ui.delete.cancel`, `ui.delete.confirm`, `ui.delete.bodyFallback`, `ui.delete.ariaLabel` — _five, not four_ (UI-SPEC lists 4 in one table and then adds `ariaLabel` separately). Confirm with planner: final count is **5 primitive keys**.

Section keys (14 — 7 sections × 2):
- `section.signage.media.title` / `.description`
- `section.signage.playlists.title` / `.description`
- `section.signage.devices.title` / `.description`
- `section.signage.schedules.title` / `.description`
- `section.signage.tags.title` / `.description` (no consumer yet)
- `section.settings.sensors.title` / `.description`
- `section.settings.users.title` / `.description` (no consumer yet)

**Namespace collision check:** Grep for `"section\.` and `"ui\.delete` in both locale files returned **zero matches** — all new keys are fresh.

**Locale parity status:** en.json has 502 quoted lines, de.json has 502 quoted lines (CI-green as of last check). The parity script `frontend/scripts/check-locale-parity.mts` counts top-level keys, not line count — planner task must budget a `npm run check-parity` (or equivalent) in the i18n task's acceptance check.

**Retirement note:** After this phase, the 18 legacy delete keys above could be cleaned up as a follow-on. Not in D-08 scope.

---

## Project Constraints (from CLAUDE.md)

Extracted actionable directives that bind this phase:

- **Stack:** React 19.2.5 / TypeScript / Vite 8.0.8 / Tailwind v4.2.2 (CSS-first config — NO `tailwind.config.js`). NO `dark:` Tailwind variants (cross-cutting hazard #3). Tokens only.
- **GSD workflow:** Every edit goes through a GSD plan. Quick fixes via `/gsd:quick`.
- **Dialog base:** `@base-ui/react` 1.3.0 (confirmed in dialog.tsx:2 — NOT shadcn).
- **Button primitive:** `components/ui/button.tsx` — use `variant="destructive"` + `size="icon"` per UI-SPEC (NOT `size="sm"`, despite existing call-sites using `size="sm"`).
- **i18n:** i18next, flat-dotted key namespace, DE du-tone, EN-DE parity checker is the gate.
- **No hand-rolled color literals.** All colours via `--background`, `--foreground`, `--muted-foreground`, `--destructive`, `--popover`, `--ring`.

---

## Architecture Patterns

### File-naming convention (verified from existing primitives)

All `components/ui/*` files are kebab-case: `button.tsx`, `dialog.tsx`, `segmented-control.tsx`, `toggle.tsx`, `dropdown.tsx`. New files follow suit: `section-header.tsx`, `delete-dialog.tsx`, `delete-button.tsx`.

### Primitive composition pattern

Inspect `components/ui/dialog.tsx` — primitives wrap `@base-ui/react` primitives with `data-slot` attributes + `cn()` class-merging + named exports. New `delete-dialog.tsx` follows the same stack (wraps `Dialog`/`DialogContent`/etc., not base-ui directly).

### `<DeleteButton>` internal state pattern (recommended)

```tsx
export function DeleteButton({ itemLabel, onConfirm, "aria-label": ariaLabel, ... }: DeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  return (
    <>
      <Button variant="destructive" size="icon" aria-label={ariaLabel} onClick={() => setOpen(true)}>
        <Trash2 aria-hidden="true" />
      </Button>
      <DeleteDialog
        open={open}
        onOpenChange={setOpen}
        title={dialogTitle ?? t("ui.delete.title")}
        body={dialogBody ?? <Trans i18nKey="ui.delete.bodyFallback" values={{ itemLabel }} components={{ 1: <strong className="text-foreground font-medium" /> }} />}
        onConfirm={async () => { await onConfirm(); setOpen(false); }}
      />
    </>
  );
}
```

`<Trans>` from `react-i18next` is already in the project (check `frontend/src` — used in multiple places; verify at plan-time). The `components={{ 1: ... }}` syntax maps the `<strong>` in the translation string (`**{{itemLabel}}**` rendered via markdown-style, OR explicit `<1>{{itemLabel}}</1>`). Planner: choose one style (markdown parsing not native to i18next — prefer `<1>…</1>`).

### `<SectionHeader>` (recommended)

```tsx
export function SectionHeader({ title, description, className }: { title: string; description: string; className?: string }) {
  const { i18n } = useTranslation();
  if (!title) return null;
  return (
    <section className={cn("mb-6", className)}>
      <h2 className="text-base font-medium text-foreground">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground" lang={i18n.language}>{description}</p>
    </section>
  );
}
```

Non-interactive; `children` deliberately not accepted (UI-SPEC §Interaction Contract).

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Dialog focus trap | Custom focus-manager | `@base-ui/react/dialog` (already vendored via `Dialog` primitive) | base-ui handles Esc, backdrop, return-focus, Portal |
| i18n interpolation with markup | String concat + `dangerouslySetInnerHTML` | `<Trans>` from `react-i18next` | XSS safe, parity-checker friendly, already in the project |
| Icon glyphs | Inline SVG | `lucide-react` (`Trash2`) | Already vendored, consistent stroke/sizing, tree-shaken |
| Delete mutation plumbing | Custom hook (this phase) | Per-page inline `useMutation` | 409 handling differs per API; don't over-abstract |

---

## Common Pitfalls

### Pitfall 1: Forgetting PlaylistsPage's inline Dialog
CONTEXT.md lists 3 dialog variants to retire. Reality is **4**: the three components + the inline `<Dialog>` block at `PlaylistsPage.tsx:215-250`. If the planner only retires the three named files, PlaylistsPage will be left with an ad-hoc dialog that SECTION-04 explicitly forbids. **Prevention:** include `PlaylistsPage.tsx:215-250` as an explicit deletion in the Playlists migration task.

### Pitfall 2: Media 409 "in use" two-state dialog
`MediaDeleteDialog` has two modes (`confirm` and `in_use`). `<DeleteButton>` is single-mode. **Prevention:** extract `in_use` into a new narrow `MediaInUseDialog.tsx`; the 409 handler opens it after deletion fails. This preserves current UX without bloating the primitive. Plan explicitly.

### Pitfall 3: Sensors row-button visual parity
`SensorRowForm` uses a ghost text-button (`variant="ghost"`, `className="text-destructive"`, with visible label) — NOT an icon-only trigger. Using `<DeleteButton>` (which is `variant="destructive"` + `size="icon"`) would regress the visual. **Prevention:** use `DeleteDialog` directly at this call-site; keep the existing ghost+label trigger. Document as an intentional exception inline (CTRL-02 exception pattern from Phase 55 is precedent).

### Pitfall 4: Devices "Revoke" is not "Delete"
Don't migrate DevicesPage's `ShieldOff` revoke button to `<DeleteButton>`. It's semantically different (`POST /pair/devices/{id}/revoke` returns 200; the device can re-pair). **Prevention:** scope plan to the 5 actual delete-row sites in Q6; call out Devices as intentionally NOT migrated.

### Pitfall 5: DialogTitle font-weight stale note in UI-SPEC
UI-SPEC §Typography includes a "Note on DialogTitle" saying the primitive ships `font-semibold` and must be overridden. **Verified false** at `dialog.tsx:123` — already `font-medium`. **Prevention:** planner removes the override as a no-op; validation task confirms via `rg "font-semibold" frontend/src/components/ui/dialog.tsx` → zero matches.

### Pitfall 6: UploadHistory in or out of scope?
D-04 says admin sections = `/signage/*` + `/settings/*`. UploadHistory lives at `/upload`. UI-SPEC allows legacy keys via explicit overrides. Ambiguous. **Prevention:** planner picks explicitly and documents. Recommendation: include — "the only destructive row action" language in SECTION-03 reads best as project-wide, not literally-D-04-only.

### Pitfall 7: SensorAdminHeader collapse risk
`SensorAdminHeader` is a standalone component. Inlining it into `<SectionHeader />` at `SensorsSettingsPage.tsx:138` changes the H1-vs-H2 hierarchy (currently `<h1 class="text-3xl font-semibold">`). The page's overall structure has no shared shell like SignagePage's `<h1>`. **Prevention:** verify breadcrumb chrome from Phase 56 renders the page H1; if it does, demote to `<h2>` via SectionHeader is correct. If not, planner must introduce a settings shell or leave an `<h1>` on the page.

### Pitfall 8: i18n `<Trans>` component index
Using `<Trans i18nKey="ui.delete.bodyFallback" components={{ 1: <strong /> }} />` requires the translation string to contain `<1>…</1>` markers around the highlighted fragment. The DE/EN strings in UI-SPEC use `**{{itemLabel}}**` (markdown-style). **Prevention:** switch UI-SPEC copy to `<1>{{itemLabel}}</1>` OR use react-i18next's `Trans` with markdown-style (requires `react-i18next` markdown plugin — NOT configured). Planner: pick `<1>…</1>` style and update UI-SPEC copy at plan-time.

### Pitfall 9: Upload-history legacy keys + i18n cleanup
If UploadHistory is migrated (Pitfall 6), but its call-site passes `title={t("delete_title")}` etc. to preserve legacy copy, the new `ui.delete.*` keys are defaults never used at that call-site. That's fine — they apply to the 5 admin sections. **Prevention:** explicit plan-level documentation.

---

## Code Examples

### Existing Playlist-editor SOTT pattern
```tsx
// frontend/src/signage/pages/PlaylistEditorPage.tsx:330-336
<section>
  <h2 className="text-base font-semibold">
    {t("signage.admin.editor.preview_title")}
  </h2>
  <p className="text-xs text-muted-foreground mb-2" lang={i18n.language}>
    {t("signage.admin.editor.preview_help")}
  </p>
  ...
</section>
```

### Existing DeleteConfirmDialog (source to promote)
```tsx
// frontend/src/components/DeleteConfirmDialog.tsx:28-50
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{t("delete_title")}</DialogTitle>
      <DialogDescription>
        {t("delete_body", { filename: batch?.filename, count: batch?.row_count })}
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => onOpenChange(false)}>
        {t("delete_cancel")}
      </Button>
      <Button variant="destructive" onClick={onConfirm}>
        {t("delete_confirm")}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Promote to generic: replace batch-specific props with `{ open, onOpenChange, title, body, cancelLabel, confirmLabel, onConfirm, confirmDisabled }`; add `autoFocus` on the Cancel `<Button>` for D-05.

### Existing inline useMutation pattern (MediaPage)
```tsx
// frontend/src/signage/pages/MediaPage.tsx:69-80
const deleteMutation = useMutation({
  mutationFn: (id: string) => signageApi.deleteMedia(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: signageKeys.media() });
    toast.success(t("signage.admin.media.delete_title"));
    ...
  },
  onError: (err: unknown) => {
    if (err instanceof ApiErrorWithBody && err.status === 409) { ... }
  },
});
```

Unchanged post-migration — `<DeleteButton onConfirm={() => deleteMutation.mutate(id)}>`.

---

## State of the Art (Project-local)

| Old pattern | New pattern | Changed | Impact |
|-------------|-------------|---------|--------|
| Per-feature delete dialogs (`MediaDeleteDialog`, `ScheduleDeleteDialog`, `SensorRemoveDialog`) | Single `DeleteDialog` + composed `DeleteButton` under `components/ui/` | Phase 57 | -3 files, +3 files net zero; API consolidation |
| Raw `<Button variant="ghost" size="sm"><Trash2 .../></Button>` row action | `<DeleteButton itemLabel=... onConfirm=... aria-label=... />` | Phase 57 | 5 call-sites simplified, boilerplate removed |
| `font-semibold` section headings | `font-medium` (2-weight typography contract from Phase 56) | Phase 57 | Matches primary/destructive-emphasis-via-size+color project invariant |
| Inline section `<h2>` + `<p>` markup | `<SectionHeader title description />` | Phase 57 | Single source of rhythm + i18n lang attribute |

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| React | Whole frontend | ✓ | 19.2.5 | — |
| Vite | Build/dev | ✓ | 8.0.8 | — |
| `@base-ui/react` | Dialog | ✓ | 1.3.0 | — |
| `lucide-react` | Trash2 icon | ✓ | 1.8.0 | — |
| `react-i18next` | `<Trans>`, `useTranslation` | ✓ | (existing — verified via many call-sites) | — |
| Tailwind v4 | Utility classes | ✓ | 4.2.2 | — |

Zero external deps added. All new primitives compose what's already vendored. (Step 2.6 complete — no missing deps.)

---

## Runtime State Inventory

**Skipped** — Phase 57 is pure frontend UI extraction/migration. No stored data, no live service config, no OS-registered state, no secrets, no build artifacts carry runtime state tied to these primitives. Verified:
- **Stored data:** None — primitives and i18n keys have no persistence.
- **Live service config:** None — no API, no service re-registration.
- **OS-registered state:** None.
- **Secrets/env vars:** None.
- **Build artifacts:** Vite cache is rebuilt automatically on `npm run build`; no manual re-install.

---

## Open Questions

None blocking. All OPEN QUESTIONS from CONTEXT.md are answered with file:line citations.

**Non-blocking planner decisions carried forward** (Claude's discretion):

1. UploadHistory in scope or not? (Pitfall 6 — recommendation: in scope.)
2. MediaInUseDialog extraction file name? (recommend `signage/components/MediaInUseDialog.tsx`.)
3. Are deprecated legacy delete i18n keys cleaned up this phase or next? (recommend: leave for a dedicated cleanup phase; 18 keys with no consumers would require a separate sweep.)
4. `SensorAdminHeader` — retire the component, or keep the file as a thin wrapper around `SectionHeader`? (recommend: retire and inline `<SectionHeader />` at `SensorsSettingsPage.tsx:138`.)

---

## Sources

### Primary (HIGH — direct file reads)

- `frontend/src/signage/pages/PlaylistEditorPage.tsx` (SOTT, Q1)
- `frontend/src/components/DeleteConfirmDialog.tsx` (source to promote, Q3/Q8)
- `frontend/src/signage/components/MediaDeleteDialog.tsx` (Q8)
- `frontend/src/signage/components/ScheduleDeleteDialog.tsx` (Q8)
- `frontend/src/components/settings/sensors/SensorRemoveDialog.tsx` (Q8)
- `frontend/src/components/settings/sensors/SensorRowForm.tsx` (Q5/Q6)
- `frontend/src/signage/pages/MediaPage.tsx` (Q2/Q6/Q7)
- `frontend/src/signage/pages/PlaylistsPage.tsx` (Q2/Q6/Q7/Q8 — inline Dialog at :215-250)
- `frontend/src/signage/pages/SchedulesPage.tsx` (Q2/Q6/Q7)
- `frontend/src/signage/pages/DevicesPage.tsx` (Q6/Q7 — Revoke is NOT Delete)
- `frontend/src/signage/pages/SignagePage.tsx` (Q7 — shared signage `<h1>`)
- `frontend/src/pages/SensorsSettingsPage.tsx` (Q4/Q7)
- `frontend/src/components/settings/sensors/SensorAdminHeader.tsx` (Q7)
- `frontend/src/components/UploadHistory.tsx` (Q6/Pitfall 6)
- `frontend/src/components/ui/dialog.tsx` (Q3 — base-ui/react confirmation, DialogTitle already `font-medium`)
- `frontend/src/components/ui/button.tsx` (variant/size confirmation)
- `frontend/src/App.tsx` (Q4 — route inventory)
- `frontend/src/locales/en.json` (Q9 — key collision check)
- `.planning/config.json` (nyquist_validation: false — Validation section skipped)

All verified today (2026-04-22).

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Playlist-editor SOTT (Q1) | HIGH | Direct file read — both ranges verified |
| Mutation pattern (Q2) | HIGH | Grep on `useMutation` in signage+settings exhaustive |
| Dialog base (Q3) | HIGH | Import line 2 of dialog.tsx explicit |
| Users route (Q4) | HIGH | App.tsx + `ls frontend/src/pages` + grep |
| window.confirm (Q5) | HIGH | Grep exhaustive, 0 runtime hits |
| Trash icon call-sites (Q6) | HIGH | Grep exhaustive; 5 hits + Devices (revoke) disambiguated |
| Heading markup (Q7) | HIGH | Per-file grep + direct reads |
| Variant imports (Q8) | HIGH | Grep exhaustive; found bonus inline variant in PlaylistsPage |
| i18n keys (Q9) | HIGH | Locale files inspected; 0 collisions for new keys |
| Architecture patterns | HIGH | Matches existing Phase 54/55/56 primitive extractions |
| Pitfalls | HIGH | Each derived from direct file evidence |

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable frontend stack, no external dep churn expected)

---

## Recommended Wave / Plan Structure

> Planner has final authority. This is the researcher's suggestion based on dependency graph.

**Wave A — Primitives (parallel):**
- **Plan 57-01:** `components/ui/section-header.tsx` primitive + unit tests (shape, `lang=` attribute, null-handling)
- **Plan 57-02:** `components/ui/delete-dialog.tsx` (promote from `DeleteConfirmDialog`) + unit tests (autoFocus Cancel, footer shape, item-label highlight)
- **Plan 57-03:** `components/ui/delete-button.tsx` (composes DeleteDialog) + unit tests (open/close state, onConfirm await, aria-label)
- **Plan 57-04:** i18n keys — add 14 `section.*` + 5 `ui.delete.*` keys in en.json + de.json (parity task; gate: `check-locale-parity.mts` passes)

**Wave B — Call-site migrations (can parallelize per call-site; each depends on Wave A):**
- **Plan 57-05:** MediaPage — `<SectionHeader>` at top + `<DeleteButton>` for initial confirm + extract `MediaInUseDialog.tsx` for 409 branch + retire `MediaDeleteDialog.tsx`
- **Plan 57-06:** PlaylistsPage — `<SectionHeader>` at top + `<DeleteButton>` replacing row Trash + **delete inline Dialog at `:215-250`**
- **Plan 57-07:** SchedulesPage — `<SectionHeader>` + `<DeleteButton>` + retire `ScheduleDeleteDialog.tsx`
- **Plan 57-08:** DevicesPage — `<SectionHeader>` (replaces misappropriated `col_name` `<h2>` at `:120`); Revoke button NOT touched
- **Plan 57-09:** SensorsSettingsPage — `<SectionHeader>` (replaces `SensorAdminHeader` usage; retire component) + migrate `SensorRowForm` to use `DeleteDialog` directly (keeping ghost+label trigger per Pitfall 3) + retire `SensorRemoveDialog.tsx`

**Wave C — Cross-cutting (optional/last):**
- **Plan 57-10:** UploadHistory — migrate to `<DeleteButton>` with legacy key overrides (pending user/planner decision per Pitfall 6)
- **Plan 57-11:** Verification — CI grep guards: `window.confirm` zero, `dark:` zero in new primitives; UI-SPEC §Dark Mode Invariant gate; parity checker green

**Parallelization notes:**
- Waves A plans can all run in parallel (4 independent files).
- Wave B plans are mutually independent once A lands (each touches distinct page files).
- Plan 57-09 is the heaviest (two retirements + component collapse) — plan extra time.

**Total plans: 10-11** depending on whether UploadHistory is included.

---

## RESEARCH COMPLETE

**Phase:** 57 — Section Context + Standardized Trashcan
**Confidence:** HIGH

### Key Findings
- SOTT verified at `PlaylistEditorPage.tsx:330-336` + `:342-349` (two separate sections).
- No `useDeleteMutation` hook exists — primitive must stay mutation-agnostic.
- Dialog base is `@base-ui/react`; `DialogTitle` is already `font-medium` (UI-SPEC override note is stale).
- No `/settings/users`, no `/signage/tags` routes — reserve i18n keys only.
- **Four** delete-dialog variants to retire (not three) — PlaylistsPage has an inline Dialog at `:215-250`.
- Devices "Revoke" is semantically distinct from delete — do NOT migrate.
- Sensors row-delete uses text+label trigger (not icon-only) — use `DeleteDialog` directly, not `DeleteButton`.
- Zero `window.confirm` runtime hits — D-08 is already satisfied.

### File Created
`.planning/phases/57-section-context-standardized-trashcan/57-RESEARCH.md`

### Ready for Planning
Research complete. Planner can now create PLAN.md files across Waves A/B/C as sketched above.
