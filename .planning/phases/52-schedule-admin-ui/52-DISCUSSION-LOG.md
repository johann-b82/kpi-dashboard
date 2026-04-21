# Phase 52: Schedule Admin UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 52-schedule-admin-ui
**Areas discussed:** List ordering + inline toggle, Weekday + priority UX, Validation + error timing, Admin guide depth

---

## Gray-Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| List ordering + inline toggle | Sort default + interactive row toggle vs read-only | ✓ |
| Weekday + priority UX | Checkbox/quick-picks + integer vs preset priority | ✓ |
| Validation + error timing | On-submit vs on-blur vs live; 409 surface | ✓ |
| Admin guide depth | Overview / overview+example / full cookbook; screenshots | ✓ |

User selected all four.

---

## List ordering + inline toggle

### Default table ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Priority desc, then updated_at desc | Mirrors resolver tie-break (highest priority wins; updated_at breaks ties). Operator sees the same ordering the device uses. | ✓ |
| Enabled first, then priority desc | Disabled schedules sink to the bottom. Visual signal at a glance; may hide disabled schedules that still matter. | |
| Playlist name A-Z, then priority desc | Easiest to scan for a specific playlist. Decouples from resolver semantics. | |

**User's choice:** Priority desc, then updated_at desc (recommended).

### Row enable toggle

| Option | Description | Selected |
|--------|-------------|----------|
| Inline PATCH | Click toggle in row → PATCH /schedules/{id} { enabled }. Optimistic + toast. | ✓ |
| Read-only display, edit-only via dialog | Toggle visual only; change requires dialog. | |

**User's choice:** Inline PATCH (recommended).

---

## Weekday + priority UX

### Weekday input

| Option | Description | Selected |
|--------|-------------|----------|
| Checkboxes + 3 quick-pick buttons | 7 checkboxes + chips above (Wochentags / Wochenende / Täglich). Quick-picks overwrite checkbox state. | ✓ |
| Checkboxes only | Plain 7-checkbox row. Minimal, predictable. | |
| Multi-select chip group | Each day a toggleable chip. Modern feel, slightly less obvious for keyboard users. | |

**User's choice:** Checkboxes + 3 quick-pick buttons (recommended).

### Priority input

| Option | Description | Selected |
|--------|-------------|----------|
| Integer input with inline help text | Number input with helper "Höhere Zahl gewinnt bei Überlappung". Default 0. | ✓ |
| Labeled stepper (Low/Medium/High = 0/5/10) | 3 preset buttons writing the integer. Easier for novices; hides range. | |
| Integer input + preset buttons | Both. Best of both, busier UI. | |

**User's choice:** Integer input with inline help text (recommended).

---

## Validation + error timing

### When errors appear

| Option | Description | Selected |
|--------|-------------|----------|
| On-submit + on-blur for completed fields | Errors on Submit; touched fields re-validate on blur. | ✓ |
| On-submit only | Errors only after clicking Save. Calmest while typing. | |
| Live as user types | Re-validates on every keystroke. Most responsive but noisy. | |

**User's choice:** On-submit + on-blur for completed fields (recommended).

### Playlist-409 UX

| Option | Description | Selected |
|--------|-------------|----------|
| Toast with "Jump to Schedules" action | sonner error toast with action button → /signage/schedules?highlight=… | ✓ |
| Inline error banner on Playlists row | Sticky red banner above playlists table. Static; manual nav. | |
| Blocking modal | Modal forcing acknowledgement. Highest attention; interrupts flow. | |

**User's choice:** Toast with "Jump to Schedules" action (recommended).

---

## Admin guide depth

### Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Overview + worked example | Overview + fields + milestone success-criteria worked example + midnight-split rule + 409 caveat. | ✓ |
| Overview only | Brief section: fields + invariants + link to UI. | |
| Full cookbook | Overview + worked example + 2-3 scenarios + troubleshooting. | |

**User's choice:** Overview + worked example (recommended).

### Screenshots

| Option | Description | Selected |
|--------|-------------|----------|
| No screenshots | Matches existing digital-signage.md all-text convention. | ✓ |
| One screenshot per language | Capture Schedules tab populated state for EN + DE. Adds ~2 assets + ops cost. | |

**User's choice:** No screenshots (recommended).

---

## Wrap-up

| Option | Description | Selected |
|--------|-------------|----------|
| Ready for context | Write CONTEXT.md. | ✓ |
| Explore more gray areas | Surface SSE reconnection UX, skeleton states, empty-state copy, tag-overlap preview, midnight-split helper. | |

**User's choice:** Ready for context.

## Claude's Discretion

- Loading/skeleton states (reuse existing signage tab pattern)
- Exact toast copy beyond the locked strings
- Empty-state illustration (default to text + CTA per UI-SPEC)
- Highlight-ring animation polish
- SSE invalidation debounce strategy

## Deferred Ideas

- Priority presets (Low/Medium/High) — reopen if operators pick {0,5,10} consistently
- Tag-overlap preview / schedule simulator
- Midnight-span auto-split helper (blocking hint sufficient)
- Schedule duplicate/templates
- Per-device "what will device X show at time T?" preview
- iCal/RRULE support (milestone-level deferral)
