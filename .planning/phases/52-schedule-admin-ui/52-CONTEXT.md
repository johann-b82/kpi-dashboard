# Phase 52: Schedule Admin UI - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin frontend: a new "Schedules" tab on `/signage` (4th `SegmentedControl` segment after Media / Playlists / Devices) that exposes the Phase 51 `signage_schedules` table through CRUD. Adds bilingual admin-guide coverage. No backend work (routers + SSE were shipped in Phase 51). No resolver changes. No new routes below `/signage/schedules`.

</domain>

<decisions>
## Implementation Decisions

### List (Schedules tab, populated state)
- **D-01:** Default table ordering is **priority desc, then updated_at desc**. This mirrors the resolver tie-break in `resolve_schedule_for_device` so the operator sees the same precedence the device uses.
- **D-02:** The `enabled` column renders an **interactive toggle** on each row (inline `PATCH /signage_admin/schedules/{id}` with `{ enabled }`). Optimistic update + sonner toast on success; rollback + error toast on failure. Fast path for "turn this schedule off for tonight" without opening the editor.
- **D-03:** List refresh driven by SSE `schedule-changed` events + mutation-triggered `queryClient.invalidateQueries(['signage', 'schedules'])`. No `refetchInterval`. (Confirms UI-SPEC.)

### Editor dialog (create + edit)
- **D-04:** Editor is a shadcn `<Dialog>` (not a separate `/signage/schedules/:id` route, not an inline row editor). (Confirms UI-SPEC.)
- **D-05:** Weekday input is **7 checkboxes Mo/Di/Mi/Do/Fr/Sa/So** plus **3 quick-pick chip buttons** above them: `Wochentags` (Mo–Fr / bit 0..4), `Wochenende` (Sa+So / bit 5..6), `Täglich` (all 7). Quick-picks OVERWRITE the checkbox state; checkboxes remain the source of truth. Bit order bit0=Mo..bit6=So (matches backend `weekday_mask`).
- **D-06:** Time inputs are two HTML5 `<Input type="time">` fields returning `"HH:MM"` strings; on submit, a client-side adapter converts to backend integer `HHMM` (e.g., `"07:30" → 730`). On load, a reverse adapter converts backend integers back to `"HH:MM"`. Invariant `start < end` strict (inclusive start, exclusive end per REQUIREMENTS amendment).
- **D-07:** Midnight-spanning ranges (e.g., 22:00–02:00) are **not supported in a single row**. The form blocks submit with an inline error ("Zeitraum muss innerhalb eines Tages liegen. Teile ihn in zwei Einträge auf.") and a short helper hint showing the two-row pattern. No auto-split.
- **D-08:** Priority is a plain `<Input type="number" min=0>` integer field with inline helper caption ("Höhere Zahl gewinnt bei Überlappung"). Default value `0`. No preset buttons, no labeled stepper — keeps the backend semantic direct.
- **D-09:** Enabled toggle in the editor defaults to `true` on create.
- **D-10:** Playlist picker is required; populated by existing `signageApi.listPlaylists()` (already used elsewhere in the admin UI). Empty playlist list shows an inline hint linking to the Playlists tab.

### Validation timing
- **D-11:** Errors appear **on submit** for all fields, AND **on blur** for any field the user has touched at least once. Avoids noisy live-red-text while typing but gives fast cross-field feedback (e.g., blurring `end` after start triggers the `start < end` error immediately). Untouched fields stay neutral until submit.
- **D-12:** Validation rules enforced client-side before submit:
  - playlist required
  - at least one weekday selected
  - both times filled in `HH:MM` format
  - `start < end` strict
  - priority is a non-negative integer
  - optional: warn (not block) when the weekday+time window fully overlaps an existing enabled schedule for the same playlist (advisory only; resolver handles overlap via priority + updated_at).

### Cross-tab integration (playlist-409)
- **D-13:** When `DELETE /signage_admin/playlists/{id}` returns 409 with `{ detail, schedule_ids: [...] }` (from Phase 51 Plan 02), the Playlists tab surfaces a **sonner error toast** with:
  - title: "Playlist kann nicht gelöscht werden"
  - body: "{N} Zeitpläne verweisen darauf."
  - action button: "Zu den Zeitplänen" → navigates to `/signage/schedules?highlight={id1,id2,...}`.
- **D-14:** The Schedules tab reads the optional `?highlight=...` query param. Matching rows are visually marked (e.g., subtle `ring-1 ring-primary/40` for ~5 s) and the first match scrolls into view. Highlight is removed from URL after initial load so it isn't restored on back-nav.

### Admin guide (SGN-SCHED-UI-03)
- **D-15:** Both `frontend/src/docs/en/admin-guide/digital-signage.md` and `.../de/...` gain a new **§Schedules / §Zeitpläne** section with:
  - brief overview (what schedules are, when to use them vs always-on tag playlists)
  - field-by-field reference (playlist, days, time window, priority, enabled)
  - invariants called out: `start < end` strict, midnight split rule, weekday bit order is an implementation detail (never shown to operator as bitmask)
  - **worked example** copied from milestone Success Criteria: "Mo–Fr 07:00–11:00 → Playlist X (priority 10); Mo–So 11:00–14:00 → Playlist Y (priority 5); at 15:00 with no match, device falls back to the always-on tag playlist." Shown as a small numbered walkthrough.
  - FK-RESTRICT caveat: "Ein Playlist kann nicht gelöscht werden, solange ein Zeitplan darauf verweist."
- **D-16:** **No screenshots.** Matches existing digital-signage.md convention (all-text with field tables). Keeps i18n-parity effort proportional and avoids screenshot rot.
- **D-17:** DE copy uses informal "du" tone ("Wähle ein Playlist", "Teile den Zeitraum auf"). Hard gate 1 CI validates every new key exists in both locales.

### Test + CI hooks (SGN-SCHED-UI-04)
- **D-18:** The existing `npm run check:signage` script (project convention) is extended (or already broad enough) to scan the new files for: no `dark:` variants, no raw `fetch(`, no direct backend imports. If the script is pattern-based over `frontend/src/signage/**`, no change needed; if path-scoped per file, add the new files.
- **D-19:** Vitest component tests for the editor (validation rules, weekday quick-picks, time adapter) and for the list (inline toggle optimistic update + rollback, SSE-triggered invalidation, highlight query param).

### Claude's Discretion
- Loading + skeleton states (use existing signage tab skeleton pattern).
- Specific toast copy beyond the locked strings above — planner picks phrasing consistent with existing tabs.
- Empty-state illustration / lack thereof (default to text + CTA per UI-SPEC).
- Exact z-index / animation polish of the highlight ring.
- Whether to batch SSE invalidations (trailing-edge debounce) — planner decides based on perf.

### Folded Todos
None.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 52 artifacts
- `.planning/phases/52-schedule-admin-ui/52-UI-SPEC.md` — Locked visual/interaction contract (design system, spacing, typography, color, copy keys, registry safety). Six design dimensions approved by gsd-ui-checker.

### Phase 51 upstream
- `.planning/phases/51-schedule-schema-resolver/51-01-SUMMARY.md` — Schema migration + `signage_schedules` columns + `app_settings.timezone`.
- `.planning/phases/51-schedule-schema-resolver/51-02-SUMMARY.md` — `/signage_admin/schedules` CRUD routes, `schedule-changed` SSE payload shape, playlist DELETE 409 response shape (`{ detail, schedule_ids }`).
- `backend/app/routers/signage_admin/schedules.py` — Canonical API shape the UI binds to.
- `backend/app/schemas/signage.py` — `SignageScheduleCreate / Update / Read` Pydantic types (field names, int vs string, defaults).
- `backend/app/services/signage_resolver.py` — `resolve_schedule_for_device` tie-break logic (priority desc, updated_at desc) that D-01 mirrors.

### Project-level
- `CLAUDE.md` — Stack + hard gates (no `dark:`, apiClient-only, DE/EN parity "du" tone).
- `.planning/REQUIREMENTS.md` §SGN-SCHED-UI-01..04 — Phase requirements + milestone Success Criteria 3–4 used in D-15 worked example.
- `.planning/ROADMAP.md` §"Phase 52" — Goal statement and explicit Success Criteria points.

### Existing UI precedents (READ to match patterns)
- `frontend/src/signage/pages/SignagePage.tsx` — Layout container, SegmentedControl wiring.
- `frontend/src/signage/pages/PlaylistsPage.tsx` — Table + dialog editor + inline row actions precedent.
- `frontend/src/signage/pages/DevicesPage.tsx` — Inline toggle (revoke-ish) pattern + empty-state (`p-12`).
- `frontend/src/signage/pages/MediaPage.tsx` — TanStack Query cadence, toast shape.
- `frontend/src/components/ui/segmented-control.tsx` — Fourth-segment insertion point.
- `frontend/src/i18n/en.json` / `de.json` — "du"-tone baseline and key nesting convention (`signage.admin.*`).
- `frontend/src/docs/en/admin-guide/digital-signage.md` / DE counterpart — Admin-guide structure + no-screenshots convention.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SegmentedControl` component: already generic — insert `{ value: 'schedules', label: t('signage.admin.nav.schedules') }` as 4th option.
- shadcn primitives all on disk per UI-SPEC: `badge`, `button`, `card`, `checkbox`, `dialog`, `form`, `input`, `label`, `popover`, `separator`, `table`. Zero `shadcn add` calls.
- `apiClient` / `signageApi` helpers — mirror `playlists` module for `schedules`.
- TanStack Query + sonner toast already wired project-wide.
- `AdminOnly` wrapper is the existing admin gate.

### Established Patterns
- Dialog-based editors (not separate routes) per Phase 46 Playlists tab.
- `queryKey = ['signage', '<entity>']` naming.
- SSE subscription lives at `SignagePage` scope and invalidates queries by kind; extend existing handler to switch on `schedule-changed`.
- i18n keys nested under `signage.admin.<feature>.*`.

### Integration Points
- `SignagePage.tsx` router table: add a `schedules` route that renders the new `SchedulesPage`.
- `SegmentedControl` options array: 4th entry.
- SSE event-kind switch: add `schedule-changed` case → `invalidateQueries(['signage', 'schedules'])`.
- Playlists DELETE error handler: extend to detect 409 + `schedule_ids` and render the "Jump to Schedules" toast action (D-13).
- Admin-guide markdown: two new §Schedules / §Zeitpläne sections.

</code_context>

<specifics>
## Specific Ideas

- Worked example in admin guide must quote the exact milestone Success Criteria scenario so it doubles as a sanity-check for the resolver behavior: Mo–Fr 07:00–11:00 → Playlist X (pri 10); Mo–So 11:00–14:00 → Playlist Y (pri 5); at 15:00 falls back to tag playlist.
- Quick-pick labels (DE): "Wochentags", "Wochenende", "Täglich". EN equivalents: "Weekdays", "Weekend", "Daily".
- Highlight query-param format: `?highlight=1,2,3` (comma-separated schedule IDs). URL is cleaned (`history.replaceState`) after first render so back-nav doesn't restore the highlight.

</specifics>

<deferred>
## Deferred Ideas

- **Priority presets (Low/Medium/High)** — considered, rejected in D-08. Reopen if operators consistently pick {0, 5, 10}.
- **Tag-overlap preview** — live visualization of which devices a schedule would apply to based on tag filter. Valuable but belongs in a future "schedule preview / simulator" phase.
- **Midnight-span auto-split helper** — instead of blocking submit, auto-create two rows. Deferred; the explicit hint is sufficient and keeps the data model honest.
- **Schedule templates / duplicate** — "copy schedule" action on each row. Nice-to-have, not in the 4 REQ-IDs.
- **Per-device schedule preview ("what will device X show at time T?")** — belongs in analytics-lite or a later scheduler UX polish phase.
- **iCal / RRULE support** — already deferred at the milestone level.

</deferred>

---

*Phase: 52-schedule-admin-ui*
*Context gathered: 2026-04-21*
