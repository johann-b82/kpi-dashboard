---
phase: 57
phase_name: Section Context + Standardized Trashcan
phase_slug: section-context-standardized-trashcan
milestone: v1.19
milestone_name: UI Consistency Pass 2
requirements: [SECTION-01, SECTION-02, SECTION-03, SECTION-04]
depends_on: [55]
date: 2026-04-22
---

# Phase 57 — Context

## Purpose

Every admin section explains itself with a heading + short description, and every
destructive row action across the admin surface uses ONE shared delete control +
confirm dialog. This phase closes the last two major consistency gaps in the
admin UI before the a11y/parity sweep (Phase 59).

Two independent domains land together because they are both "one shared primitive
replacing N ad-hoc variants" — the refactor pattern is identical and they touch
the same files.

---

## Scope (what's IN)

- All `/signage/*` admin sections: Media, Playlists, Devices, Schedules, Tags
- All `/settings/*` admin sections: Sensors, Users
- Every destructive row action on those surfaces
- A new `SectionHeader` primitive under `components/ui/`
- A new `DeleteButton` composed control under `components/ui/` (icon button + dialog)
- A promoted `DeleteDialog` primitive under `components/ui/delete-dialog.tsx`
- 8 call-site refactors (one per section + one per feature-variant dialog retirement)

## Out of scope (explicitly deferred)

- `/sales` and `/hr` dashboards — they are the product, not admin surfaces, and
  have their own identity via the H1 + SubHeader Toggle (Phase 56). A descriptive
  line here would add noise.
- Typed-confirmation (e.g., "type DELETE to continue") for high-risk deletes.
  Would be its own polish phase if ever wanted. **Deferred idea.**
- Bulk delete flows. Current scope is row-level destructive action only.

---

## Decisions

### D-01 · Canonical DeleteDialog: promote, don't rebuild
Promote `frontend/src/components/DeleteConfirmDialog.tsx` to
`frontend/src/components/ui/delete-dialog.tsx` (kebab-case, matches Toggle/Card
convention). Retire the three feature variants in the same phase:
- `frontend/src/signage/components/MediaDeleteDialog.tsx`
- `frontend/src/signage/components/ScheduleDeleteDialog.tsx`
- `frontend/src/components/settings/sensors/SensorRemoveDialog.tsx`

Feature-specific copy (impact text, item name) passes in as props — no per-feature
dialog components remain after this phase.

### D-02 · TrashIcon: composed control, not raw icon
Ship a **self-contained** `<DeleteButton />` under `components/ui/delete-button.tsx`
that wires the icon trigger + DeleteDialog internally. Consumer API:

```tsx
<DeleteButton
  itemLabel={playlist.name}
  onConfirm={() => deletePlaylist(playlist.id)}
  dialogBody={optional i18n key or node for impact text}
  aria-label={t("…delete playlist…")}
/>
```

This kills the boilerplate currently duplicated across PlaylistsPage,
SchedulesPage, MediaPage, SensorRowForm, UploadHistory. A raw `<TrashIcon />`
glyph is also exported for the rare case someone needs just the glyph
(non-row contexts).

### D-03 · SectionHeader: extract primitive
Extract `<SectionHeader title description />` into
`frontend/src/components/ui/section-header.tsx`. Spacing and typography match
the current Playlist-editor pattern verbatim (source of truth for visual
style). Every admin section route imports this primitive — no inline heading
markup remains.

### D-04 · Admin-only scope
"Every admin section" means `/signage/*` + `/settings/*`. Dashboards are OUT.
The seven concrete sections to touch:
1. Media (`/signage/media`)
2. Playlists (`/signage/playlists`)
3. Devices (`/signage/devices`)
4. Schedules (`/signage/schedules`)
5. Tags (`/signage/tags`)
6. Sensors (`/settings/sensors`)
7. Users (`/settings/users`)

### D-05 · Dialog affordances
- Item name/preview in every dialog body (via `itemLabel` prop already on
  DeleteConfirmDialog; propagate to all call sites)
- **Default focus on Cancel button** (one-liner safety — `autoFocus` on Cancel
  in the promoted primitive)
- No typed-confirmation (deferred)

### D-06 · Destructive styling stays red
The destructive button variant in `components/ui/button.tsx` stays the
red/danger variant. Primary (blue, Phase 56) is reserved for affirmative and
active-state emphasis. Accessibility + convention both require destructive
actions to look destructive.

### D-07 · i18n parity gate
New keys added this phase must land in both `en.json` and `de.json` in a
single commit. Parity checker (`check-locale-parity.mts`) must pass before
each commit. DE stays du-tone (locked since prior phases). Section
descriptions are ≤ 2 lines — enforced by copy, not by CSS clamp.

### D-08 · window.confirm eradication
After this phase, `grep -rn "window.confirm" frontend/src` returns zero
matches. Call sites currently using `window.confirm`:
- `frontend/src/components/settings/sensors/SensorRowForm.tsx`
- `frontend/src/components/settings/sensors/SensorRemoveDialog.tsx`

---

## Canonical refs

MANDATORY reading for researcher + planner:

- `/Users/johannbechtold/Documents/kpi-dashboard/.planning/ROADMAP.md` — phase 57 entry, success criteria
- `/Users/johannbechtold/Documents/kpi-dashboard/.planning/REQUIREMENTS.md` — SECTION-01..04 at lines 30–33
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/components/DeleteConfirmDialog.tsx` — source shape to promote (D-01)
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/signage/components/MediaDeleteDialog.tsx` — feature variant #1 to retire
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/signage/components/ScheduleDeleteDialog.tsx` — feature variant #2 to retire
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/components/settings/sensors/SensorRemoveDialog.tsx` — feature variant #3 to retire
- Playlist-editor source — visual source of truth for SectionHeader (D-03). Researcher must locate (search `/signage/playlists` editor page) and cite file:line.
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/components/ui/button.tsx` — destructive variant (D-06)
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/components/ui/toggle.tsx` — kebab-case primitive convention (D-01, D-02, D-03)
- `/Users/johannbechtold/Documents/kpi-dashboard/.planning/phases/56-breadcrumb-header-content-nav-relocation/56-CONTEXT.md` — prior milestone consistency decisions
- `/Users/johannbechtold/Documents/kpi-dashboard/CLAUDE.md` — stack + conventions

---

## Open questions for researcher

1. **Exact Playlist-editor pattern location** — which file/lines define the heading+description pattern to standardize on? Need file:line citation before planner can spec `SectionHeader`.
2. **`useDeleteMutation` pattern** — does an existing hook wrap the REST delete + React Query invalidation, or does each call site inline its own `useMutation`? If inline, `DeleteButton` must stay agnostic and only surface `onConfirm`; no mutation logic baked into the primitive.
3. **Dialog transition/focus-trap** — the existing DeleteConfirmDialog uses which base? (shadcn Dialog? Radix Dialog directly?) Confirm before promoting.
4. **Users admin route** — does `/settings/users` exist yet, or is it part of a later phase? If not yet, SECTION-01 scope for Users is deferred.

---

## Deferred ideas (don't lose)

- Typed-confirmation for high-risk deletes (schedules with live devices, users with active sessions)
- Bulk delete flows across admin tables
- Per-section help-text tooltips ("what is a schedule?")
- SectionHeader variant with inline action (e.g., "+ New" button to the right of the title)

---

## Success criteria (restated from ROADMAP, for verifier)

1. Every admin page section has a heading + ≤ 2-line description matching the Playlist-editor pattern.
2. Section headings/descriptions are DE (du-tone) + EN with matching i18n key parity.
3. One shared `<DeleteButton>` / `<TrashIcon>` from `components/ui/` is the only destructive row action across Media, Playlists, Devices, Schedules, Tags, Sensors, Users.
4. Every delete action opens the shared `DeleteDialog`; zero `window.confirm` and zero one-off modal variants remain.

## Next step

Research via `/gsd:plan-phase 57` (which runs the researcher first, then planner).
