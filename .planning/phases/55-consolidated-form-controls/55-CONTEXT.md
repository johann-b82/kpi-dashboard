# Phase 55: Consolidated Form Controls - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

One canonical set of form-control primitives exists under
`frontend/src/components/ui/` — `Input`, `Select`, `Button`, `Textarea`,
`Dropdown` — all standard-size at the `h-8` height token, with focus /
disabled / invalid/error states driven by tokens (not per-component color
literals). All raw `<input>`, `<select>`, `<button>`, `<textarea>` usages
across `frontend/src/` migrate to the primitives. Documented native
exceptions (file pickers) stay native, annotated in-source.

No backend changes. No new animation / form / state-mgmt library. No
changes to the existing `SegmentedControl` or the `Toggle` primitive
shipped in Phase 54.

</domain>

<decisions>
## Implementation Decisions

### Primitive surface (CTRL-01)
- **D-01:** Canonical primitives live under `frontend/src/components/ui/`,
  lowercase-kebab, sibling to `toggle.tsx` / `segmented-control.tsx`:
  - `button.tsx` (already exists — cleanup only, see D-04/D-05)
  - `input.tsx` (already exists — unchanged)
  - `select.tsx` (new — `@base-ui/react/select`)
  - `textarea.tsx` (new — mirrors Input's shape + tokens)
  - `dropdown.tsx` (new — `@base-ui/react/menu`, action-menu primitive
    distinct from `Select`)
- **D-02:** `Dropdown` is an **action menu** (kebab / three-dot trigger →
  Edit / Delete / Duplicate items), NOT a form value picker. It is
  distinct from `Select`. Ship the primitive only this phase — no
  migrations to it (no current action-menu call sites). Future phases
  (e.g. admin-table row actions) can adopt it. Closes CTRL-01's
  five-primitive roster.
- **D-03:** `Select` uses `@base-ui/react/select` (same library family as
  the existing `Button`/`Input`). Styled with Tailwind v4 to match
  `Input` (h-8, same border / focus-ring / disabled / invalid tokens).
  NOT a styled native `<select>` — we need consistent popup styling and
  a11y across themes.

### Button variants cleanup (CTRL-03)
- **D-04:** **Remove** `lg: "h-9 …"` and `icon-lg: "size-9"` from
  `buttonVariants` in `ui/button.tsx`. Audit every call site that
  currently uses `size="lg"` / `size="icon-lg"` and migrate to
  `size="default"` (h-8) / `size="icon"` (size-8).
- **D-05:** **Keep** `xs: "h-6 …"`, `sm: "h-7 …"`, `icon-xs: "size-6"`,
  `icon-sm: "size-7"`. CTRL-03 explicitly allows non-`h-8` variants "for
  documented exceptional surfaces" — `xs`/`sm` are used in dense
  contexts (table row actions, sub-toolbars). Add a JSDoc block above
  `buttonVariants` documenting that the default standard size is `h-8`
  and `xs`/`sm` are reserved for dense/inline surfaces. Default remains
  `size="default"` (h-8).

### Textarea (CTRL-01)
- **D-06:** Ship a minimal `ui/textarea.tsx` wrapping
  `@base-ui/react/textarea` (or the plain element if base-ui has no
  Textarea — planner decides based on library check). Mirror Input's
  class composition: `rounded-lg`, `border border-input`,
  `bg-transparent` / `dark:bg-input/30`, token-driven focus /
  disabled / `aria-invalid` states. Minimum height ≈ 3 rows, `resize-y`.
  No current call sites, but shipping the primitive closes CTRL-01
  cleanly and future-proofs settings / notes fields.

### Invalid / error state contract (CTRL-04)
- **D-07:** **Caller-driven** invalid-state pattern on all primitives
  (matches the current `Input` contract):
  - Callers pass `aria-invalid={hasError}` when appropriate.
  - Primitives style invalid visuals via
    `aria-invalid:border-destructive aria-invalid:ring-3
    aria-invalid:ring-destructive/20` (+ `dark:` counterparts), driven
    by the existing `--destructive` token.
  - NO new `error?: string` prop on primitives this phase. Error-message
    rendering stays a consumer concern (react-hook-form, inline `<p
    className="text-destructive">`, or future `FormField` wrapper).
- **D-08:** Focus, disabled, and invalid visuals must resolve identically
  from tokens across `Button`, `Input`, `Select`, `Textarea`, and the
  `Dropdown` trigger. Planner extracts the shared class fragments (e.g.
  `FOCUS_RING_CLASSES`, `INVALID_CLASSES`) if duplication gets
  unwieldy; otherwise keep per-file for readability. Spot-check:
  visually diff the four disabled states in both themes.

### Migration structure (CTRL-02)
- **D-09:** Wave shape mirrors Phase 54:
  - **Wave 1 (primitives):** build `select.tsx`, `textarea.tsx`,
    `dropdown.tsx`; clean up `button.tsx` (remove `lg`/`icon-lg`).
  - **Wave 2 (migrations, parallel — grouped by primitive type):**
    (a) raw `<button>` → `Button` (~16 usages across signage/, settings/,
        dashboard/, pages/)
    (b) raw `<select>` → `Select` (~6 usages: ScheduleEditDialog,
        PlaylistItemList, SnmpWalkCard, PersonioCard)
    (c) raw `<input>` → `Input` (~7 usages; EXCLUDING file inputs —
        see D-10)
    (d) `Button size="lg"` / `"icon-lg"` call-site cleanup (cross-cut
        after D-04 lands)
- **D-10:** **File inputs stay native** (`<input type="file" …>`) as
  CTRL-02 documented exceptions. Each call site (`DropZone.tsx`,
  `LogoUpload.tsx`, `MediaUploadDropZone.tsx`, `MediaRegisterUrlDialog`
  if applicable, any others surfaced during migration) gets an inline
  comment annotation:
  ```tsx
  // CTRL-02 exception: native file picker — primitive <Input> does
  // not wrap file-type inputs (browser-native styling retained).
  ```
  `Input` primitive will NOT add a `type="file"` code path this phase.
- **D-11:** Each Wave-2 plan is expected to be small (1 primitive type;
  list concrete files modified in the plan frontmatter). Plans run in
  parallel after Wave 1 lands. Verification grep: no raw
  `<button|select|input|textarea>` opens remain in `frontend/src/`
  except:
  - `ui/` primitives themselves (they wrap the native element).
  - Annotated file-input exceptions (grep for `CTRL-02 exception`).

### Testing
- **D-12:** Unit-test the three NEW primitives (`Select`, `Textarea`,
  `Dropdown`) for: render, keyboard interaction (Space/Enter/Arrow on
  Select + Dropdown; basic typing on Textarea), disabled state, invalid
  state styling. Button cleanup: regression-check existing Button tests
  if any; otherwise a focused render test for `xs`/`sm`/`default` /
  `icon` variants. Migration plans do NOT require per-file tests
  beyond `tsc --noEmit` + the existing test suite staying green.

### Claude's Discretion
- Exact Tailwind class composition for `Select`'s trigger + popup + item
  styles (must resolve from tokens; must visually match `Input` for
  trigger).
- Exact `Dropdown` popup positioning defaults (base-ui defaults are
  usually fine; planner may pick `align="end"` for row-action triggers).
- Whether to extract shared class-fragment constants or keep class
  strings per-file. Optimise for readability / CTRL-04 consistency.
- How `Textarea`'s default `min-height` translates to rows (≈ `min-h-16`
  / `min-h-[4.5rem]` / `rows={3}` — pick whichever composes best with
  `h-*` tokens; height token alignment is NOT required for Textarea
  since it's inherently multi-line).
- Whether base-ui ships a `Textarea` primitive or a plain `<textarea>`
  wrapper is needed — planner checks during research.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap + requirements
- `.planning/ROADMAP.md` § Phase 55 — goal, depends-on (Phase 54),
  success criteria (4 TRUEs mapped to CTRL-01..04).
- `.planning/REQUIREMENTS.md` § CTRL-01..04 — acceptance rules for this
  phase.
- `.planning/REQUIREMENTS.md` § A11Y-01..03 — cross-milestone a11y
  guardrails (full sweep in Phase 59; must not regress here).
- `.planning/REQUIREMENTS.md` § "Out of Scope" — no backend changes.

### Prior-phase context to carry forward
- `.planning/phases/54-toggle-primitive-migrations/54-CONTEXT.md`
  § Animation / A11y — token-only styling, no hex literals, `.dark`
  class on documentElement, `@base-ui/react` family as the primitive
  library, DE/EN i18n parity on labels.
- `.planning/phases/54-toggle-primitive-migrations/54-VERIFICATION.md`
  — patterns for `tsc --noEmit` scoped checks + `rg` grep invariants
  used to verify migrations without relying on full `npm run build`
  (which has pre-existing unrelated TS errors — see deferred-items).
- `.planning/phases/54-toggle-primitive-migrations/deferred-items.md`
  — known pre-existing build failures to ignore during Phase 55
  migrations (SalesTable.tsx, useSensorDraft.ts, defaults.ts,
  SchedulesPage.test.tsx). Do NOT treat these as regressions.

### Existing code to replicate / reuse
- `frontend/src/components/ui/button.tsx` — current primitive. Keep cva
  + `@base-ui/react/button` wrapper. Apply D-04/D-05 cleanup here.
- `frontend/src/components/ui/input.tsx` — current primitive. Reference
  implementation for class composition + token-driven invalid/disabled
  states (copy to `textarea.tsx` + `select.tsx` trigger).
- `frontend/src/components/ui/segmented-control.tsx`,
  `frontend/src/components/ui/toggle.tsx` — reference for token-only
  styling + `data-slot` annotations.
- `frontend/src/components/ui/form.tsx`,
  `frontend/src/components/ui/label.tsx` — existing form helpers;
  primitives should compose cleanly with these.
- `frontend/src/components/ui/popover.tsx` — if base-ui `Menu` /
  `Select` popovers share styling concerns, crib from here.
- `@base-ui/react` package docs — confirm `Select`, `Menu`, `Textarea`
  API shapes during planning research.

### Migration audit call sites (non-exhaustive, confirm with planner)
- Raw `<button>` (~16): `NavBar.tsx` (4), `TagPicker.tsx`,
  `MediaPickerDialog.tsx`, `PlaylistItemList.tsx`, `SnmpWalkCard.tsx`,
  `ColorPicker.tsx`, `EmployeeTable.tsx`, `SalesTable.tsx` (read-only;
  do NOT fix pre-existing TS errors here),
  `MediaUploadDropZone.tsx`, `MediaRegisterUrlDialog.tsx`,
  `ScheduleEditDialog.tsx`, `LogoUpload.tsx`, `PersonioCard.tsx`,
  `LauncherPage.tsx`, `DropZone.tsx`.
- Raw `<select>` (~6): `ScheduleEditDialog.tsx`, `PlaylistItemList.tsx`,
  `SnmpWalkCard.tsx`, `PersonioCard.tsx` (+ test file —
  `ScheduleEditDialog.test.tsx` can stay as-is).
- Raw `<input>` (~7): mostly `type="file"` — see D-10; any remaining
  `type="text|number|…"` usages migrate to `Input`.
- Raw `<textarea>`: **none** — primitive shipped as future-proofing
  (D-06).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Button` (`ui/button.tsx`): cva + `@base-ui/react/button`. Already
  `h-8` default. `lg`/`icon-lg` removal is the cleanup target.
- `Input` (`ui/input.tsx`): `h-8`, base-ui, token-driven invalid/focus.
  Reference for all other primitives' class composition.
- `Label`, `Form`, `Popover` primitives exist in `ui/` — compose with
  these rather than inventing new wrappers.
- Tailwind v4 tokens: `--primary`, `--destructive`, `--input`, `--ring`,
  `--muted`, `--border`, `--radius-md`, `--radius-lg` — already driving
  Button + Input; reuse for the new primitives.

### Established Patterns
- `@base-ui/react` (NOT Radix) is the a11y primitive library in use.
  `Select` and `Menu` must come from this family for consistency.
- `data-slot="<name>"` attribute on each primitive root — pattern used
  by Button / Input / Toggle for CSS querying + debugging.
- `cva` used when the primitive has variants (Button). Simple wrappers
  (Input, Toggle) skip cva and use plain `cn()`.
- Focus + invalid styling is declared on the primitive itself via
  `focus-visible:*` and `aria-invalid:*` utility chains — NOT via
  consumer-applied classes.

### Integration Points
- Primitives are imported across `pages/`, `components/`,
  `signage/components/`, `signage/pages/` — migrations touch all four
  surfaces (Wave 2 parallel plans grouped by primitive type).
- `form.tsx` + `label.tsx` + react-hook-form (if used) must continue
  to work. Caller-driven `aria-invalid` (D-07) keeps the contract
  form-library-agnostic.

</code_context>

<specifics>
## Specific Ideas

- Phase 54 shape is the template: 1 primitive-build wave, then a
  parallel migration wave, each plan small and grep-verifiable.
- Keep `deferred-items.md` known pre-existing TS errors out of scope.
  Verification uses scoped `tsc --noEmit <file>` / `rg` invariants,
  NOT a green `npm run build`.
- `Dropdown` is explicitly the action-menu primitive (kebab / three-dot
  pattern). Do NOT confuse with Combobox or Select.

</specifics>

<deferred>
## Deferred Ideas

- **`FormField` wrapper** — optional `<FormField label error>` helper
  that handles label + inline error message layout. Considered in
  D-07 discussion; not shipped this phase because consumers currently
  handle this ad-hoc and react-hook-form integration is form-specific.
  Surface as a candidate if a later UI phase consolidates error
  messaging.
- **`error?: string` prop on primitives** — ergonomic for one-off
  forms but couples messaging to the primitive. Revisit if a11y sweep
  (Phase 59) finds inconsistent error-message presentation.
- **Combobox / searchable Select** — not needed for current short-list
  selects. Add as a separate primitive only if a future phase needs a
  long-list / type-ahead picker.
- **`hero`/`xl` button size (h-10+)** — no current use case. Don't
  invent; add only if a landing-page CTA surfaces.
- **Input `type="file"` variant** — rejected this phase (D-10);
  reconsider only if file pickers need a brand-styled custom UI.

</deferred>

---

*Phase: 55-consolidated-form-controls*
*Context gathered: 2026-04-21*
