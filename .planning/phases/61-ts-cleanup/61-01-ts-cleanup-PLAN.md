---
phase: 61-ts-cleanup
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/signage/pages/SchedulesPage.test.tsx
  - frontend/src/signage/components/ScheduleEditDialog.test.tsx
  - frontend/src/signage/components/ScheduleEditDialog.tsx
  - frontend/src/components/settings/PersonioCard.tsx
  - frontend/src/components/settings/sensors/SnmpWalkCard.tsx
  - frontend/src/lib/defaults.ts
  - frontend/src/hooks/useSensorDraft.ts
  - frontend/src/components/ui/select.tsx
  - frontend/src/components/dashboard/HrKpiCharts.tsx
  - frontend/src/components/dashboard/SalesTable.tsx
  - frontend/tsconfig.app.json
autonomous: true
requirements:
  - TS-CLEANUP-01  # npm run build exits 0 with zero error TS lines; no || true swallowing tsc/vite-build
must_haves:
  truths:
    - "`npx tsc --noEmit` run from frontend/ exits 0 with zero `error TS` lines"
    - "`npm run build` run from frontend/ exits 0 (tsc -b AND both vite build steps succeed)"
    - "No build / CI / Dockerfile / pre-commit hook swallows tsc or vite-build failure with `|| true`"
    - "No new `@ts-expect-error` or `@ts-ignore` directive was introduced by this phase"
    - "No runtime behaviour change — only type-level edits (per D-01/D-02/D-03)"
  artifacts:
    - path: "frontend/src/signage/pages/SchedulesPage.test.tsx"
      provides: "Test file with unused afterEach import removed + 2 stale @ts-expect-error directives removed"
    - path: "frontend/src/signage/components/ScheduleEditDialog.test.tsx"
      provides: "Test file using ES import (not bare require) for react shim"
    - path: "frontend/src/signage/components/ScheduleEditDialog.tsx"
      provides: "Explicit parameter annotation on line 254 callback (no implicit any)"
    - path: "frontend/src/components/settings/PersonioCard.tsx"
      provides: "Explicit parameter annotation on line 154 callback (no implicit any)"
    - path: "frontend/src/components/settings/sensors/SnmpWalkCard.tsx"
      provides: "Explicit parameter annotations on lines 277 + 297 callbacks"
    - path: "frontend/src/lib/defaults.ts"
      provides: "DEFAULT_SETTINGS satisfies full Settings type including 5 sensor_* fields"
    - path: "frontend/src/hooks/useSensorDraft.ts"
      provides: "SensorDraftValidationError without parameter-property (erasableSyntaxOnly clean) + single settings payload spread with no duplicate keys"
    - path: "frontend/src/components/ui/select.tsx"
      provides: "Select wrappers using correct base-ui Props generic arity + no unused React import"
    - path: "frontend/src/components/dashboard/HrKpiCharts.tsx"
      provides: "Recharts Tooltip labelFormatter + formatter callbacks typed to satisfy Recharts 3.8.1 surfaces (no value-shape change)"
    - path: "frontend/src/components/dashboard/SalesTable.tsx"
      provides: "useTableState call type-compatible with SalesRecordRow; row cells render without unknown/{} mismatches"
  key_links:
    - from: "frontend/package.json build script"
      to: "tsc -b (frontend root)"
      via: "`\"build\": \"tsc -b && vite build && vite build --mode player && ...\"`"
      pattern: "tsc -b && vite build"
    - from: "frontend/src/hooks/useSensorDraft.ts buildGlobalsPayload → updateSettings call"
      to: "SettingsUpdatePayload surface"
      via: "single spread merge (no duplicate-key overwrites at compile time)"
      pattern: "updateSettings\\(\\{"
    - from: "frontend/src/components/dashboard/SalesTable.tsx processed.map"
      to: "useTableState generic"
      via: "SalesRecordRow flowing through useTableState<T extends Record<string, unknown>>"
      pattern: "useTableState\\(data"
---

<objective>
Close 31 pre-existing TypeScript errors across 9 frontend files so `npm run build` (in the frontend container) exits 0 with zero `error TS` lines, and confirm no `|| true` fallback exists in the build path that would mask a regression. Cleanup is mechanical per D-01 — no behaviour changes, no test-logic changes, no refactors beyond what typing requires.

Purpose: Unblock the `npm run build`-green gate for v1.20 shipping. Closes v1.19 milestone-audit tech-debt carry-forward.

Output: 9 source files + (if needed) `tsconfig.app.json` with errors resolved, 1 atomic commit per file per D-06, `tsc --noEmit` clean, full `npm run build` exit 0.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/61-ts-cleanup/61-CONTEXT.md
@.planning/milestones/v1.19-MILESTONE-AUDIT.md

@frontend/tsconfig.json
@frontend/tsconfig.app.json
@frontend/package.json
@frontend/src/hooks/useTableState.ts
@frontend/src/lib/defaults.ts
@frontend/src/components/ui/select.tsx
@frontend/src/hooks/useSensorDraft.ts
@frontend/src/components/dashboard/HrKpiCharts.tsx
@frontend/src/components/dashboard/SalesTable.tsx
@frontend/src/signage/components/ScheduleEditDialog.test.tsx
@frontend/src/signage/pages/SchedulesPage.test.tsx

<interfaces>
<!-- Key contracts already on disk. DO NOT re-derive; use these exact shapes. -->

From frontend/src/hooks/useTableState.ts:
```typescript
export function useTableState<T extends Record<string, unknown>>(
  data: T[] | undefined,
  defaultSort?: { key: keyof T & string; dir: SortDir }
): { processed: T[]; sortKey: string; sortDir: SortDir; toggleSort: (k: string) => void;
     filters: Record<string, string>; setFilter: (k: string, v: string) => void };
```

From frontend/src/lib/api.ts (already has the 5 sensor_* fields on Settings, lines 136..164):
```typescript
export interface Settings {
  // ... existing brand + personio fields ...
  sensor_poll_interval_s: number;
  sensor_temperature_min: string | null;
  sensor_temperature_max: string | null;
  sensor_humidity_min: string | null;
  sensor_humidity_max: string | null;
}
```

From frontend/tsconfig.app.json:
```jsonc
{
  "compilerOptions": {
    "erasableSyntaxOnly": true,   // D-01 constraint: parameter-property constructors, enums, namespaces all banned
    "verbatimModuleSyntax": true, // import type required for type-only imports
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": ["vite/client"]      // Note: "node" NOT in types — `require` is undeclared in .ts
    // ...
  },
  "include": ["src"]
}
```

From frontend/package.json:
```jsonc
{
  "dependencies": { "@base-ui/react": "^1.3.0", "recharts": "^3.8.1" },
  "devDependencies": { "@types/node": "^24.12.2" }  // already present — D-04 enables if needed
}
```
</interfaces>

**Error census (31 errors, 9 files; per CONTEXT.md):** HrKpiCharts(4), SalesTable(8), PersonioCard(1), SnmpWalkCard(2), select.tsx(2), useSensorDraft(7), defaults(1), ScheduleEditDialog.tsx(1), ScheduleEditDialog.test(1), SchedulesPage.test(3). Track error-count drop per file after each commit (D-07).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Baseline capture + trivial file fixes (6 files, low-risk)</name>
  <files>
    frontend/src/signage/pages/SchedulesPage.test.tsx
    frontend/src/signage/components/ScheduleEditDialog.test.tsx
    frontend/src/signage/components/ScheduleEditDialog.tsx
    frontend/src/components/settings/PersonioCard.tsx
    frontend/src/components/settings/sensors/SnmpWalkCard.tsx
    frontend/src/lib/defaults.ts
  </files>
  <action>
**Step 0 — Baseline (do first, keep the output):**
```bash
cd frontend && npx tsc --noEmit 2>&1 | tee /tmp/ts-baseline.log
grep -c "error TS" /tmp/ts-baseline.log   # expect 31
```
Stash this count; every sub-step below MUST reduce it.

**Step 1 — `frontend/src/signage/pages/SchedulesPage.test.tsx` (−3 errors: TS6133 line 6, TS2578 lines 200 + 202):**
- Line 6: remove `afterEach` from the vitest import list. If the file truly no longer needs it, it drops out; if `afterEach` is used elsewhere in the file, keep it (re-grep `afterEach` in the file first).
- Lines 200 + 202: remove the two stale `@ts-expect-error` directives. Per D-03 no test-logic change — the lines below each directive should already compile cleanly; if removing the directive re-introduces a TS error, STOP and escalate (would mean a real type bug that we are not scoped to refactor).
- Verify just this file: `npx tsc --noEmit 2>&1 | grep "SchedulesPage.test.tsx" | wc -l` should print `0`.
- Commit: `git add frontend/src/signage/pages/SchedulesPage.test.tsx && git commit -m "fix(61): SchedulesPage.test.tsx — drop unused afterEach + stale @ts-expect-error"`

**Step 2 — `frontend/src/signage/components/ScheduleEditDialog.test.tsx` (−1 error: TS2591 line 45):**
- Read lines 40–55 first. Line 45 uses `const React = require("react")` inside a `vi.mock` factory. Fix by replacing with a top-of-file ES import and a local alias inside the factory. Minimal transform:
  - Add at top of file (if not already present): `import * as React from "react";`
  - Replace `const React = require("react");` with nothing (or `// React already imported at top`).
  - If the existing test uses `React` only inside factory scope and TS complains about value-vs-type drift, use `import React from "react"` — whichever matches the surrounding file's import style (look at sibling test files in `frontend/src/signage/` before picking).
- Do NOT change the shim behaviour (`CtxRoot`, `Select`, etc.) per D-03.
- If `@types/node` is strictly cleaner (adds `node` to tsconfig `types`), D-04 permits that path — but prefer the ES-import fix here because it does not widen global typings.
- Verify: `npx tsc --noEmit 2>&1 | grep "ScheduleEditDialog.test.tsx" | wc -l` → `0`.
- Commit: `fix(61): ScheduleEditDialog.test.tsx — replace bare require with ES import`

**Step 3 — `frontend/src/signage/components/ScheduleEditDialog.tsx` (−1 error: TS7006 line 254):**
- Read lines 245–260. Line 254 has a callback with an implicit-any `v` parameter. Annotate with the concrete type at the call site — likely `(v: string) =>` from the parent Select's `onValueChange`, or the row's value type.
- Do NOT change callback body.
- Verify: `npx tsc --noEmit 2>&1 | grep "ScheduleEditDialog.tsx" | wc -l` → `0`.
- Commit: `fix(61): ScheduleEditDialog.tsx — annotate onValueChange parameter`

**Step 4 — `frontend/src/components/settings/PersonioCard.tsx` (−1 error: TS7006 line 154):**
- Annotate parameter `v` at line 154 from its consuming API (grep its siblings — if it's a `Select.onValueChange`, type is `string`; if a `CheckboxList` entry, inspect).
- Commit: `fix(61): PersonioCard.tsx — annotate v parameter`

**Step 5 — `frontend/src/components/settings/sensors/SnmpWalkCard.tsx` (−2 errors: TS7006 lines 277 + 297):**
- Same approach as Step 4 for both parameters.
- Commit: `fix(61): SnmpWalkCard.tsx — annotate v parameters`

**Step 6 — `frontend/src/lib/defaults.ts` (−1 error: TS2739):**
- `Settings` gained 5 `sensor_*` fields in v1.15 (see `frontend/src/lib/api.ts:160–164`). Add them to `DEFAULT_SETTINGS` with sane defaults that match the backend migration's server_default shape. Suggested values (verify in the alembic migration for v1.15 sensors schema if available, else use these):
  ```typescript
  sensor_poll_interval_s: 60,
  sensor_temperature_min: null,
  sensor_temperature_max: null,
  sensor_humidity_min: null,
  sensor_humidity_max: null,
  ```
  Rationale: `null` thresholds mean "no threshold set" — matches the `SensorDraftGlobals.buildGlobalsPayload` early-exit-on-empty-string contract in `useSensorDraft.ts`. `60` seconds matches the Phase 38 sensor scheduler baseline.
- If the exact server_default differs in the alembic migration, use that instead — document the number in the commit message.
- Commit: `fix(61): defaults.ts — add 5 sensor_* fields to DEFAULT_SETTINGS`

**After Step 6 — mid-task verify:**
```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"   # expect 31 − (3+1+1+1+2+1) = 22
```
If the count is not exactly 22, STOP and diagnose before proceeding to Task 2.
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit 2>&1 | tee /tmp/ts-after-task1.log; COUNT=$(grep -c "error TS" /tmp/ts-after-task1.log || true); test "$COUNT" = "22" || { echo "Expected 22 errors, got $COUNT"; exit 1; }; for f in SchedulesPage.test.tsx ScheduleEditDialog.test.tsx ScheduleEditDialog.tsx PersonioCard.tsx SnmpWalkCard.tsx defaults.ts; do test "$(grep -c "$f" /tmp/ts-after-task1.log || true)" = "0" || { echo "$f still has errors"; exit 1; }; done; git log --oneline -6 | grep -c "fix(61):" | xargs -I{} test {} = 6</automated>
  </verify>
  <done>
    - `npx tsc --noEmit` reports 22 errors remaining (9 down from baseline 31)
    - Zero errors remain in any of the 6 files touched
    - 6 atomic commits on branch, each with `fix(61): <filename>` subject line
    - No new `@ts-expect-error` / `@ts-ignore` introduced (grep-verified in Task 3)
  </done>
</task>

<task type="auto">
  <name>Task 2: Structural fixes (4 files: useSensorDraft, select, HrKpiCharts, SalesTable)</name>
  <files>
    frontend/src/hooks/useSensorDraft.ts
    frontend/src/components/ui/select.tsx
    frontend/src/components/dashboard/HrKpiCharts.tsx
    frontend/src/components/dashboard/SalesTable.tsx
  </files>
  <action>
**Step 1 — `frontend/src/hooks/useSensorDraft.ts` (−7 errors: TS1294 line 232 + TS2783 lines 434–440):**

(a) Line 232 — `erasableSyntaxOnly` violation. Read 228–244. The violation is TypeScript's parameter-property shorthand `constructor(public readonly key: string)`. Rewrite to the erasable-syntax-compatible form:
```typescript
export class SensorDraftValidationError extends Error {
  readonly key: string;
  constructor(key: string) {
    super(key);
    this.key = key;
    this.name = "SensorDraftValidationError";
  }
}
```
This preserves the public `key` field and the `super(key)` pattern. If line 232 turns out to be a different construct (const enum, namespace, decorator) — inspect and pick the minimal equivalent per CONTEXT "Claude's discretion". Do NOT touch `validateSensorDraft` below.

(b) Lines 434–440 — TS2783 duplicate spread keys. Read 420–445. The violation is the 7 individual brand keys declared literally (`color_primary: settingsData.color_primary, ..., app_name: settingsData.app_name`) followed by `...globalsBody` where `globalsBody` (typed as `SettingsUpdatePayload`) includes those same keys in its surface. Resolution per D-02 (minimise blast radius): the original comment says "PUT /api/settings requires the full brand block — merge with cache." The intent is brand-block-from-cache plus globals-from-draft. The fix is to make the spread explicit so it cannot double-declare: spread `settingsData` brand fields first, then spread `globalsBody`, letting the latter win (which is the current documented intent). Replace the 8-line object literal with:
```typescript
await updateSettings({
  ...settingsData,   // brings color_* + app_name from cache (brand block)
  ...globalsBody,    // overrides sensor_* thresholds + poll interval from draft
});
```
Verify that `settingsData`'s type (from `useQuery<Settings>`) is assignable to `SettingsUpdatePayload` — if not, narrow via a helper or destructure the 7 brand keys once and spread the narrow object. Do NOT widen `SettingsUpdatePayload`.

If `settingsData` carries non-payload fields that `updateSettings` rejects (e.g. `logo_url`, `personio_has_credentials`), prefer the explicit-7-keys form but remove the `...globalsBody` spread and instead `Object.assign({}, brandBlock, globalsBody)` — whichever keeps the payload shape minimal. Pick the approach that produces the **smallest diff** while resolving all 7 TS2783s.

- Verify: `npx tsc --noEmit 2>&1 | grep "useSensorDraft.ts" | wc -l` → `0`.
- Commit: `fix(61): useSensorDraft.ts — remove parameter-property + collapse duplicate spread keys`

**Step 2 — `frontend/src/components/ui/select.tsx` (−2 errors: TS6133 line 1, TS2707 line 7):**

(a) Line 1: `import * as React from "react"` is unused (react-jsx runtime doesn't need it). Remove the import entirely.
(b) Line 7: `SelectPrimitive.Root.Props` is a generic type requiring 1–2 type arguments in the installed `@base-ui/react@^1.3.0`. Check the installed type surface:
```bash
cat frontend/node_modules/@base-ui/react/select/root.d.ts 2>/dev/null | head -60
# or
grep -n "Props" frontend/node_modules/@base-ui/react/select/index.d.ts 2>/dev/null | head -20
```
Identify the generic parameter(s). Likely shape is `Root.Props<Value, Multiple>` or similar. For our wrapper, use the broadest accepting form that preserves current behaviour:
```typescript
function Select<Value>(props: SelectPrimitive.Root.Props<Value>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}
```
If a second parameter (e.g. `Multiple extends boolean = false`) has a default, a single-generic wrapper suffices. Do NOT upgrade `@base-ui/react` per CONTEXT non-goals.

If `SelectValue.Props`, `SelectTrigger.Props`, etc., at lines 11/15/43/70/91/95/108 ALSO broke their generic arity after the fix (they shouldn't, but confirm), mirror the same narrow-generic pass-through pattern.

- Verify: `npx tsc --noEmit 2>&1 | grep "select.tsx" | wc -l` → `0`.
- Commit: `fix(61): select.tsx — drop unused React import + fix Root.Props generic arity`

**Step 3 — `frontend/src/components/dashboard/HrKpiCharts.tsx` (−4 errors: TS2322 lines 146/147/185/186):**

Recharts 3.8.1 tightened `Tooltip.labelFormatter` and `Tooltip.formatter` to return `ReactNode`. Read 130–200.
- Lines 146, 185 — `labelFormatter={formatMonth}` where `formatMonth: (m: string) => string`. The Recharts signature is now `(label: ReactNode, payload: readonly Payload[]) => ReactNode`. Wrap at the call site:
  ```typescript
  labelFormatter={(label) => formatMonth(String(label))}
  ```
- Lines 147, 186 — `formatter={hasTarget ? tooltipFormatter : (v: number) => [formatValue(v), title]}`. The Recharts `Formatter` wants `(value, name, item, index, payload) => ReactNode | [ReactNode, ReactNode]`. Wrap:
  ```typescript
  formatter={hasTarget ? tooltipFormatter : ((v: ValueType) => [formatValue(Number(v)), title] as [string, string])}
  ```
  where `ValueType` is imported from `recharts` (or inline `number | string | Array<number | string>`). If `tooltipFormatter` (the `hasTarget` branch) ALSO mismatches, wrap it the same way — inspect the AreaChart branch (146/147) + BarChart branch (185/186) errors after each wrap.
- Do NOT change what gets rendered (value string + title) — D-01.
- Import any needed Recharts types via `import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent"` if they are not re-exported from the main entry — check with `grep -n "ValueType" frontend/node_modules/recharts/types/index.d.ts`.

- Verify: `npx tsc --noEmit 2>&1 | grep "HrKpiCharts.tsx" | wc -l` → `0`.
- Commit: `fix(61): HrKpiCharts.tsx — wrap Tooltip labelFormatter + formatter for Recharts 3.8.1 signature`

**Step 4 — `frontend/src/components/dashboard/SalesTable.tsx` (−8 errors: TS2345/TS2322 lines 31, 110–116):**

Root cause: `useTableState<T extends Record<string, unknown>>` requires the row type to have an index signature; `SalesRecordRow` (from `frontend/src/lib/api.ts`) has concrete fields only, so `T = SalesRecordRow` fails with "missing index signature" which cascades into every `row[col.key]` access resolving to `unknown` (hence the downstream 7 errors at 110–116).

Per D-02 "minimise blast radius, prefer adding an index signature to the row type over rewriting the hook's API". Two acceptable options — **take option A**:

**Option A (preferred, single-file):** narrow the generic at the call site in `SalesTable.tsx`:
```typescript
// top of file
import type { SalesRecordRow } from "@/lib/api";
type SalesRow = SalesRecordRow & Record<string, unknown>;
// ...
const { processed, sortKey, sortDir, toggleSort } =
  useTableState<SalesRow>(data as SalesRow[] | undefined, { key: "order_date", dir: "desc" });
```
This keeps `SalesRecordRow` pristine (no change to `api.ts`) and removes all 8 errors (the `data` arg at line 31, the `key` narrowing at 110, and the cell renders at 111–116 — now typed through `SalesRow` which allows string/number/null).

If cells at 111–116 still fail because they access fields like `row.customer_name` (typed `string | null` on `SalesRecordRow`) and TS complains about `string | null | unknown`, add a minimal per-cell narrowing — but first verify Option A alone doesn't already fix them; the index-signature merge usually doesn't suppress concrete field types.

**Option B (fallback, only if Option A fails):** add `[key: string]: unknown;` to `SalesRecordRow` in `frontend/src/lib/api.ts`. If you take Option B, commit separately as `fix(61): api.ts — add index signature to SalesRecordRow` per D-06.

- Do NOT change `useTableState.ts` — its generic is correct and used by other tables.
- Verify: `npx tsc --noEmit 2>&1 | grep "SalesTable.tsx" | wc -l` → `0`.
- Commit: `fix(61): SalesTable.tsx — narrow useTableState generic via SalesRow intersection`

**After Step 4 — end-of-task verify:**
```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"   # expect 0
```
If non-zero, STOP and diagnose.
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit 2>&1 | tee /tmp/ts-after-task2.log; COUNT=$(grep -c "error TS" /tmp/ts-after-task2.log || true); test "$COUNT" = "0" || { echo "Expected 0 errors, got $COUNT"; cat /tmp/ts-after-task2.log; exit 1; }; git log --oneline -10 | grep -c "fix(61):" | xargs -I{} test {} -ge 10</automated>
  </verify>
  <done>
    - `npx tsc --noEmit` reports 0 errors
    - Zero errors in useSensorDraft.ts, select.tsx, HrKpiCharts.tsx, SalesTable.tsx
    - 4 more atomic commits on branch (one per file), each `fix(61): <filename>` — total now ≥ 10
    - `useTableState.ts` unchanged on disk (verify with `git log -1 --format=%H -- frontend/src/hooks/useTableState.ts` — should predate Phase 61)
    - No new `@ts-expect-error` / `@ts-ignore` introduced
  </done>
</task>

<task type="auto">
  <name>Task 3: Full-build gate + || true audit + suppression-directive audit</name>
  <files>
    frontend/package.json
  </files>
  <action>
**Step 1 — Full `npm run build` inside the frontend container (D-08):**
```bash
docker compose exec -T frontend npm run build 2>&1 | tee /tmp/build-out.log
echo "exit=$?"
grep -c "error TS" /tmp/build-out.log   # expect 0
```
If the frontend container is not running, fall back to host:
```bash
cd frontend && npm run build 2>&1 | tee /tmp/build-out.log
```
Hard gate: exit 0 AND zero `error TS` lines AND the post-build `renameSync('dist/player/player.html','dist/player/index.html')` step must succeed (it's part of the build script). If Vite errors on anything not caught by `tsc --noEmit` (e.g. missing entry-point types, rollup schema), fix in-file and commit under the appropriate `fix(61):` subject.

**Step 2 — `|| true` build-path audit (D-05):**
```bash
# Check the canonical build surfaces ONLY — ignore worktrees and unrelated scripts.
grep -nE "(tsc|vite build|npm (run )?build)\b[^|]*\|\|\s*true" \
  frontend/package.json \
  frontend/Dockerfile* 2>/dev/null \
  Dockerfile* 2>/dev/null \
  docker-compose*.yml \
  .github/workflows/*.{yml,yaml} 2>/dev/null \
  scripts/smoke-*.sh \
  .husky/* 2>/dev/null \
  || echo "CLEAN: no || true swallowing tsc/vite/npm-build in canonical surfaces"
```
If any match is returned, delete the `|| true` fallback in-file. Scope: ONLY the files listed above. Do NOT touch `|| true` in `scripts/verify-phase-04.sh` (curl probe, intentional), `scripts/firstboot.sh` (pi provisioning), `scripts/lib/signage-install.sh` (installer hygiene), or `.claude/worktrees/**` (agent scratch).

If no matches (likely — repo grep confirmed none in the main surfaces as of 2026-04-22), record in the SUMMARY: "No `|| true` fallbacks exist in the build path — D-05 satisfied by verification."

If the build script in `frontend/package.json` is edited (e.g. `|| true` was sneaked in later), commit separately: `fix(61): package.json — remove || true from build script`.

**Step 3 — Suppression-directive gap-safety audit:**
```bash
# Confirm Phase 61 did not replace real errors with suppressions.
# Baseline count BEFORE Phase 61 can be reconstructed from git:
BASELINE=$(git grep -cE "@ts-expect-error|@ts-ignore" -- "frontend/src/**/*.ts" "frontend/src/**/*.tsx" HEAD~12 2>/dev/null || echo "0")
CURRENT=$(git grep -cE "@ts-expect-error|@ts-ignore" -- "frontend/src/**/*.ts" "frontend/src/**/*.tsx" 2>/dev/null || echo "0")
echo "baseline=$BASELINE current=$CURRENT"
test "$CURRENT" -le "$BASELINE" || { echo "FAIL: Phase 61 introduced new suppressions"; exit 1; }

# Stronger: enumerate each remaining suppression and manually confirm it pre-dates Phase 61
git grep -nE "@ts-expect-error|@ts-ignore" -- "frontend/src/**/*.ts" "frontend/src/**/*.tsx" \
  | tee /tmp/suppressions.log
# For each hit, blame the line:
while IFS=: read -r file line _; do
  git blame -L "$line,$line" "$file" | head -1
done < /tmp/suppressions.log | tee /tmp/suppressions-blame.log
# Every blame SHA must be pre-Phase-61 (i.e. not one of the fix(61): commits).
grep -cE "fix\(61\)" /tmp/suppressions-blame.log | xargs -I{} test {} = 0 \
  || { echo "FAIL: at least one suppression is authored by Phase 61"; exit 1; }
```
If any Phase 61 commit authored a suppression, revert it and re-approach that specific fix (D-01/D-03 violation).

**Step 4 — Final summary artifacts:**
- Re-run `docker compose exec -T frontend npm run build` one more time to confirm determinism. Exit must be 0 with 0 `error TS` lines.
- Write the phase SUMMARY (in the output step) citing: baseline 31 errors, 9 files fixed, 10 atomic `fix(61):` commits, `npm run build` exit 0, `|| true` audit result, suppression audit result, v1.19-MILESTONE-AUDIT carry-forward reference.

No production code is edited in this task unless Step 2 finds a `|| true` to remove; treat `frontend/package.json` as edit-on-demand.
  </action>
  <verify>
    <automated>cd frontend && (docker compose exec -T frontend npm run build 2>&1 || npm run build 2>&1) | tee /tmp/build-final.log; test "${PIPESTATUS[0]}" = "0" || exit 1; grep -c "error TS" /tmp/build-final.log | xargs -I{} test {} = 0; cd .. && ! grep -rnE "(tsc|vite build|npm (run )?build)\b[^|]*\|\|\s*true" frontend/package.json docker-compose*.yml .github/workflows/ 2>/dev/null; BASE_SUPP=$(git grep -cE "@ts-expect-error|@ts-ignore" HEAD~12 -- "frontend/src/**/*.ts" "frontend/src/**/*.tsx" 2>/dev/null | awk -F: '{s+=$NF} END {print s+0}'); CUR_SUPP=$(git grep -cE "@ts-expect-error|@ts-ignore" -- "frontend/src/**/*.ts" "frontend/src/**/*.tsx" 2>/dev/null | awk -F: '{s+=$NF} END {print s+0}'); test "$CUR_SUPP" -le "$BASE_SUPP"</automated>
  </verify>
  <done>
    - `npm run build` (in frontend container or host) exits 0 with zero `error TS` lines and produces `dist/player/index.html` (post-build rename succeeded)
    - No `|| true` pattern found in frontend/package.json, Dockerfiles, docker-compose*.yml, or .github/workflows/ adjacent to tsc/vite/npm-build commands
    - Suppression-directive count is ≤ baseline; zero suppressions authored by `fix(61):` commits (git blame verified)
    - SUMMARY.md written with error census + commit list + audit outcomes
  </done>
</task>

</tasks>

<verification>
**Phase gate (all MUST pass before SUMMARY):**

1. `cd frontend && npx tsc --noEmit` → exit 0, zero `error TS`
2. `cd frontend && npm run build` (or via `docker compose exec -T frontend`) → exit 0, zero `error TS`, `dist/player/index.html` exists
3. `git log --oneline --grep="fix(61):"` → ≥ 9 commits, one per file touched (D-06)
4. `git grep -E "@ts-expect-error|@ts-ignore" -- frontend/src` — no hits authored by `fix(61):` commits (git blame)
5. `grep -rnE "(tsc|vite build|npm (run )?build)\b[^|]*\|\|\s*true" frontend/package.json docker-compose*.yml .github/workflows/ 2>/dev/null` → empty (D-05)
6. `git diff HEAD~12 -- frontend/src/hooks/useTableState.ts` → empty (D-02: hook not rewritten)
7. `git diff HEAD~12 -- frontend/src/lib/api.ts` → either empty OR only an added `[key: string]: unknown;` line on `SalesRecordRow` (D-02 Option B)
</verification>

<success_criteria>
- [ ] `npx tsc --noEmit` exits 0 in frontend/
- [ ] `npm run build` exits 0 in frontend container with zero `error TS` lines
- [ ] 9 files fixed, ≥ 9 atomic `fix(61): <filename>` commits on the branch
- [ ] Zero `|| true` fallbacks remain in tsc/vite/npm-build commands in package.json, Dockerfiles, docker-compose, or CI workflows
- [ ] No new `@ts-expect-error` / `@ts-ignore` directive authored by Phase 61 commits
- [ ] `useTableState.ts` unchanged; `SalesRecordRow` either unchanged or changed only to add an index signature
- [ ] Behaviour unchanged: no test file had assertions modified, no runtime-code branch was altered beyond types (D-01/D-03)
</success_criteria>

<output>
After completion, create `.planning/phases/61-ts-cleanup/61-01-SUMMARY.md` with:
- Baseline error count (31) vs. final (0), with per-file deltas
- List of the 10 (±) atomic commits and their subject lines
- `|| true` audit outcome (expected: no matches, D-05 satisfied by verification)
- Suppression-directive audit outcome (expected: count unchanged, no Phase 61 authorship)
- Citation: "closes v1.19-MILESTONE-AUDIT tech-debt carry-forward" (per CONTEXT §Requirements traceability)
- Note any Option A vs Option B branch taken in SalesTable (and whether `api.ts` was touched)
- Note the exact replacement used for line 232 `useSensorDraft.ts` (parameter-property → explicit field assignment)
</output>
