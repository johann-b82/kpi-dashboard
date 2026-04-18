# Phase 20: Frontend — Checkbox List UI and i18n - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the 3 single-select controls in PersonioCard (2 `<select>` dropdowns + 1 `<Input>`) with scrollable checkbox lists supporting multi-select. Wire the array state through the draft/save cycle to the updated array-based API (Phase 19). Add DE/EN i18n keys for all new and changed labels.

**Scope includes one small backend change:** Extend the `personio-options` endpoint to return `skill_attributes: string[]` so the skill_attr_key field can also render checkboxes (currently free-text input with no options source).

</domain>

<decisions>
## Implementation Decisions

### Skill Attribute Options Source
- **D-01:** Extend the `GET /api/settings/personio-options` endpoint to include a `skill_attributes: string[]` field. Extract available attribute keys from employee `raw_json["attributes"]`, filtering to only keys where at least one employee has a non-null, non-empty value. This mirrors how departments are already extracted from the same employee data.
- **D-02:** Update `PersonioOptions` Pydantic schema (backend) and `PersonioOptions` TypeScript interface (frontend) to include `skill_attributes`.

### Checkbox List Component Design
- **D-03:** Bordered scrollable box — a `max-h-[200px]` container with `overflow-y-auto`, styled to match the existing input/select aesthetic (`rounded-md border border-input`). Each row contains a shadcn `Checkbox` primitive + label.
- **D-04:** Use the shadcn Checkbox component (add via shadcn CLI if not already present). Provides consistent styling and built-in accessibility.
- **D-05:** Create a reusable `CheckboxList` component accepting `options`, `selected`, `onChange`, `disabled`, and `label` props. Used 3 times in PersonioCard with different option shapes (absence types have `{id, name}`, departments and skill attributes are plain strings).

### Draft State Type Migration
- **D-06:** Change `DraftFields` types from scalars to arrays:
  - `personio_sick_leave_type_id: number | null` → `personio_sick_leave_type_id: number[]`
  - `personio_production_dept: string | null` → `personio_production_dept: string[]`
  - `personio_skill_attr_key: string | null` → `personio_skill_attr_key: string[]`
- **D-07:** Update `buildSnapshot` to initialize from the API's array response (already returns arrays after Phase 19). Map `null`/`undefined` to `[]`.
- **D-08:** Update `buildPayload` to send arrays directly. The `?? undefined` guard changes: empty array `[]` is a valid value to send (clears the field), `undefined` means "don't change" — but since these fields are always in the draft, always include them.
- **D-09:** Array equality in `fieldsEqual` via `JSON.stringify(a) === JSON.stringify(b)`. Backend returns sorted arrays so order is stable.
- **D-10:** Update the `Settings` interface in `api.ts` to match the Phase 19 API contract: `personio_sick_leave_type_id: number[]`, `personio_production_dept: string[]`, `personio_skill_attr_key: string[]`.
- **D-11:** Update `SettingsUpdatePayload` in `api.ts` to use array types matching the backend's Pydantic `SettingsUpdate` schema.

### Empty State & Disabled UX
- **D-12:** When disabled (`!hasCredentials || optionsLoading || !!options?.error`): show the bordered box with reduced opacity (`opacity-50 cursor-not-allowed`) and the existing "configure credentials first" hint text below.
- **D-13:** When loading: show "Loading..." text inside the bordered container.
- **D-14:** When options loaded but list is empty: show "No options available" text inside the container (localized).

### Claude's Discretion
- Exact Tailwind styling of the scrollable container (shadow, padding, gap between rows)
- Whether CheckboxList is a standalone file or inline in PersonioCard
- shadcn Checkbox installation method (CLI vs manual copy)
- Exact i18n key naming for new labels (e.g., `settings.personio.no_options`, `settings.personio.loading`)
- Whether to add a subtle "N selected" summary below the checkbox list when collapsed/scrolled

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — UI-01, UI-02, UI-03 requirements for this phase
- `.planning/ROADMAP.md` — Phase 20 success criteria (4 items)

### Phase 19 Context (array contract this phase consumes)
- `.planning/phases/19-backend-array-migration-api-and-kpi-aggregation/19-CONTEXT.md` — D-03 (arrays-only API), D-05 (OR/union semantics), D-06 (empty=not configured)
- `.planning/phases/19-backend-array-migration-api-and-kpi-aggregation/19-01-SUMMARY.md` — What was built: migration, model, schemas, router

### Phase 6 Context (Settings page patterns)
- `.planning/phases/06-settings-page-and-sub-components/06-CONTEXT.md` — D-04 (live preview via cache), D-06 (snapshot/dirty), D-08 (Card layout), D-09 (sticky action bar)

### Existing Implementation (must-read before modifying)
- `frontend/src/components/settings/PersonioCard.tsx` — Current component with 2 `<select>` + 1 `<Input>` to replace
- `frontend/src/hooks/useSettingsDraft.ts` — DraftFields type, buildSnapshot, buildPayload, fieldsEqual — all need array migration
- `frontend/src/lib/api.ts` — Settings and SettingsUpdatePayload interfaces, PersonioOptions interface, fetchPersonioOptions
- `frontend/src/locales/en.json` — EN translation keys (settings.personio.* namespace)
- `frontend/src/locales/de.json` — DE translation keys
- `backend/app/routers/settings.py` — personio-options endpoint (lines 85-145) to extend with skill_attributes
- `backend/app/schemas.py` — PersonioOptions Pydantic model (line 191) to extend

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **PersonioCard component**: 295 lines, well-structured with credential inputs, test connection, sync interval, and the 3 config fields. Only the 3 config field sections (lines 221-290) need replacing.
- **shadcn primitives**: Card, Label, Button, Input already used. Need to add Checkbox.
- **`useQuery` for personio-options**: Already fetches `absence_types` and `departments` with `staleTime: 0`. Just needs to also return `skill_attributes`.
- **Tailwind form styling**: Existing select elements use `rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs` — checkbox list container should match.
- **i18n pattern**: `useTranslation()` + `t("settings.personio.*.label")` / `t("settings.personio.*.placeholder")` — add new keys in same namespace.

### Established Patterns
- **Draft/setField pattern**: `setField("personio_sick_leave_type_id", value)` — for arrays, the onChange handler will pass the full new array (toggle item in/out).
- **Disabled state**: `dropdownsDisabled` boolean already computed from credentials + loading + error state. Reuse for checkbox lists.
- **Error/hint text**: Pattern of `{(noCredentialsHint || optionsError) && <p>...}` below each field. Keep for checkbox lists.

### Integration Points
- **PersonioCard.tsx**: Replace lines 221-290 (3 field sections) with CheckboxList components
- **useSettingsDraft.ts**: Update DraftFields type, buildSnapshot, buildPayload, fieldsEqual
- **api.ts**: Update Settings, SettingsUpdatePayload, PersonioOptions interfaces
- **en.json / de.json**: Add new i18n keys for checkbox-specific labels
- **backend/app/schemas.py**: Add `skill_attributes: list[str]` to PersonioOptions
- **backend/app/routers/settings.py**: Extract skill attribute keys from employee raw_json in personio-options endpoint

</code_context>

<specifics>
## Specific Ideas

- The bordered scrollable box should match the existing form input styling (border-input color, rounded-md, same shadow)
- Checkbox rows should have enough padding for comfortable click targets (~py-1.5 px-3)
- The personio-options endpoint already fetches `employees_raw` — extracting attribute keys is a loop over `e["attributes"].keys()` filtered by value presence

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-frontend-checkbox-list-ui-and-i18n*
*Context gathered: 2026-04-12*
