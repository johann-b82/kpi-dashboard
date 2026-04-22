---
phase: 62-signage-calibration
plan: 02
type: execute
wave: 2
depends_on:
  - 62-signage-calibration-01
files_modified:
  - frontend/src/signage/lib/signageTypes.ts
  - frontend/src/signage/lib/signageApi.ts
  - frontend/src/signage/components/DeviceEditDialog.tsx
  - frontend/src/locales/en.json
  - frontend/src/locales/de.json
  - frontend/src/signage/components/DeviceEditDialog.test.tsx
autonomous: true
requirements:
  - CAL-UI-01
  - CAL-UI-02
  - CAL-UI-03
  - CAL-UI-04
must_haves:
  truths:
    - "Admin opens the device edit dialog on /signage/devices and sees a Calibration section"
    - "Rotation dropdown offers 0/90/180/270 and defaults to the device's current value"
    - "HDMI mode dropdown shows 'Auto' placeholder when no device-reported modes exist yet (CAL-UI-02)"
    - "Audio toggle reflects audio_enabled and flips on click"
    - "Saving calls PATCH /api/signage/devices/{id}/calibration and invalidates the devices TanStack query with a toast"
    - "All new copy exists in both EN and DE with du-tone + key parity"
  artifacts:
    - path: "frontend/src/signage/components/DeviceEditDialog.tsx"
      provides: "Calibration section (rotation dropdown + HDMI dropdown + audio toggle) wired to form state"
      contains: "calibration"
    - path: "frontend/src/signage/lib/signageApi.ts"
      provides: "updateDeviceCalibration(id, body) → apiClient.patch"
      contains: "updateDeviceCalibration"
    - path: "frontend/src/signage/lib/signageTypes.ts"
      provides: "SignageDevice gains rotation/hdmi_mode/audio_enabled"
      contains: "rotation"
    - path: "frontend/src/locales/en.json + de.json"
      provides: "~8 new signage.admin.device.calibration.* keys at parity"
      contains: "calibration"
  key_links:
    - from: "DeviceEditDialog save mutation"
      to: "signageApi.updateDeviceCalibration"
      via: "after existing PATCH name + PUT tags, call PATCH /calibration with only changed fields"
      pattern: "updateDeviceCalibration"
    - from: "save onSuccess"
      to: "queryClient.invalidateQueries({queryKey: signageKeys.devices()})"
      via: "existing invalidation already present; extend to include calibration in devices fetch"
      pattern: "invalidateQueries.*devices"
    - from: "HDMI dropdown"
      to: "device.available_modes (future backend heartbeat field)"
      via: "CAL-UI-02 — placeholder 'Auto' when modes list empty/missing; real modes populate once device reports them"
      pattern: "available_modes"
---

<objective>
Add the Calibration section to the device edit dialog on `/signage/devices`. Rotation dropdown (0/90/180/270), HDMI mode dropdown with an "Auto" placeholder entry (until the device reports its supported modes), and an audio on/off Toggle. Save extends the existing sequenced mutation (PATCH name → PUT tags → **PATCH calibration**) and invalidates the devices query with a toast.

Purpose: Give operators the admin surface for the backend contract 62-01 just shipped. No backend changes (D-11).

Output: One extended component + one new API client method + ~8 i18n keys at DE/EN parity.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/62-signage-calibration/62-CONTEXT.md
@.planning/phases/62-signage-calibration/62-01-SUMMARY.md

<interfaces>
From frontend/src/signage/components/DeviceEditDialog.tsx (lines 26-30, 82-112) — form schema + save mutation to extend:

```typescript
const schema = z.object({
  name: z.string().min(1).max(128),
  tags: z.array(z.string()),
});
// saveMutation sequences: PATCH /devices/{id} (name) → PUT /devices/{id}/tags
// Extend: add a third call to signageApi.updateDeviceCalibration when
// calibration fields are dirty.
```

From frontend/src/signage/lib/signageApi.ts (lines 156-164):
```typescript
updateDevice: (id: string, body: { name?: string; tag_ids?: number[] }) =>
  apiClient.patch(`/api/signage/devices/${id}`, body),
replaceDeviceTags: (id: string, tag_ids: number[]) =>
  apiClient.put(`/api/signage/devices/${id}/tags`, { tag_ids }),
```

From frontend/src/signage/lib/signageTypes.ts (line 46) — extend SignageDevice shape.

Components to use (all already in repo):
- `@/components/ui/select` (shadcn Select with SelectTrigger/Content/Item — Phase 55 primitive)
- `@/components/ui/toggle` (pill Toggle primitive from Phase 54 — use the 2-segment `<Toggle>` with icon-or-label segments)
- `react-hook-form` Controller for the Select + Toggle integrations (dialog already uses it for tags)

i18n pattern (from v1.19 Phase 57): flat-dotted keys, du-tone, EN/DE parity verified by `npm run check:i18n-parity` + `check:i18n-du-tone`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend SignageDevice type + signageApi + zod schema + i18n keys</name>
  <files>frontend/src/signage/lib/signageTypes.ts, frontend/src/signage/lib/signageApi.ts, frontend/src/locales/en.json, frontend/src/locales/de.json</files>
  <behavior>
    - `SignageDevice` interface gains `rotation: 0 | 90 | 180 | 270`, `hdmi_mode: string | null`, `audio_enabled: boolean`, and optional `available_modes?: string[] | null` (from future heartbeat reporting per D-02 / CAL-UI-02).
    - `signageApi.updateDeviceCalibration(id, body)` exists and maps to `PATCH /api/signage/devices/{id}/calibration` via apiClient. Body type: `Partial<{rotation: 0|90|180|270; hdmi_mode: string | null; audio_enabled: boolean}>`.
    - i18n keys added to both en.json and de.json at parity (CAL-UI-04, du-tone for DE):
      - `signage.admin.device.calibration.title` — "Calibration" / "Kalibrierung"
      - `signage.admin.device.calibration.rotation_label` — "Rotation" / "Drehung"
      - `signage.admin.device.calibration.hdmi_mode_label` — "HDMI mode" / "HDMI-Modus"
      - `signage.admin.device.calibration.hdmi_mode_auto` — "Auto (use current)" / "Automatisch (aktuellen übernehmen)"
      - `signage.admin.device.calibration.audio_label` — "Audio" / "Audio"
      - `signage.admin.device.calibration.audio_on` — "On" / "An"
      - `signage.admin.device.calibration.audio_off` — "Off" / "Aus"
      - `signage.admin.device.calibration.saved` — "Calibration saved" / "Kalibrierung gespeichert"
  </behavior>
  <action>
    1. Edit frontend/src/signage/lib/signageTypes.ts — extend `SignageDevice` with `rotation`, `hdmi_mode`, `audio_enabled`, and `available_modes?: string[] | null` (per D-02 — sidecar reports modes via heartbeat in the future; until then this is `null`/undefined and the dropdown shows only the Auto placeholder — CAL-UI-02).

    2. Edit frontend/src/signage/lib/signageApi.ts — after `replaceDeviceTags` add:
       ```typescript
       updateDeviceCalibration: (
         id: string,
         body: Partial<{
           rotation: 0 | 90 | 180 | 270;
           hdmi_mode: string | null;
           audio_enabled: boolean;
         }>,
       ) => apiClient.patch(`/api/signage/devices/${id}/calibration`, body),
       ```

    3. Append the 8 keys above to frontend/src/locales/en.json and frontend/src/locales/de.json at the SAME JSON path (flat-dotted top-level, matching v1.16 Phase 46 parity contract). DE uses "du"-tone (no Sie/Ihre).

    4. Run `npm run check:i18n-parity` and `npm run check:i18n-du-tone` — both must pass.
  </action>
  <verify>
    <automated>cd frontend && npm run check:i18n-parity && npm run check:i18n-du-tone && npm run tsc -- --noEmit</automated>
  </verify>
  <done>Types extended; API method exists; 8 new keys present in both locales with identical paths; parity + du-tone scripts green; tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: DeviceEditDialog — Calibration section + save flow + invalidation</name>
  <files>frontend/src/signage/components/DeviceEditDialog.tsx, frontend/src/signage/components/DeviceEditDialog.test.tsx</files>
  <behavior>
    - Form zod schema extended with `rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])`, `hdmi_mode: z.string().nullable()`, `audio_enabled: z.boolean()`.
    - `form.reset` in the `device`-change effect (lines 69-80) now also seeds those three fields from `device.rotation`, `device.hdmi_mode`, `device.audio_enabled`.
    - A new JSX block renders below the tags row:
      - Heading `t("signage.admin.device.calibration.title")`
      - Rotation `<Select>`: 4 items (0°/90°/180°/270°, labels rendered as e.g. "0°") wired via `<Controller name="rotation">` — value+onValueChange coerce number.
      - HDMI mode `<Select>`: items = `[{value: "", label: t("...hdmi_mode_auto")}, ...(device?.available_modes ?? []).map(m => ({value: m, label: m}))]` — the Auto placeholder maps to `null` in the form state (empty string = Auto = null). CAL-UI-02.
      - Audio `<Toggle>` (2-segment pill): segments `[{value: false, label: t("...audio_off")}, {value: true, label: t("...audio_on")}]` via `<Controller name="audio_enabled">`.
    - Save mutation (existing `saveMutation.mutationFn`) extends its sequence: PATCH name (if name dirty) → PUT tags (if tags dirty) → **PATCH /calibration (if any of rotation/hdmi_mode/audio_enabled dirty)**. Use `form.formState.dirtyFields` to build a minimal `Partial<>` body for the calibration call.
    - `onSuccess`: invalidate `signageKeys.devices()` (already present) — that query already fetches calibration fields post-62-01, so the UI reflects the server state. Toast key: `signage.admin.device.calibration.saved` (or existing `device.saved` if it feels tighter — prefer the new key so operators understand what was saved).
    - Test file: extends DeviceEditDialog.test.tsx with a test that:
      - Opens dialog with a device whose rotation=0, audio_enabled=false
      - Changes rotation dropdown to 90° and flips audio toggle on
      - Clicks save
      - Asserts `signageApi.updateDeviceCalibration` was called once with `{rotation: 90, audio_enabled: true}` (NOT hdmi_mode — unchanged)
      - Asserts toast success + query invalidation.
  </behavior>
  <action>
    1. Edit frontend/src/signage/components/DeviceEditDialog.tsx — extend the `schema` at line 26-30:
       ```typescript
       const schema = z.object({
         name: z.string().min(1).max(128),
         tags: z.array(z.string()),
         rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
         hdmi_mode: z.string().nullable(),
         audio_enabled: z.boolean(),
       });
       ```

    2. Update `form.reset` in the `useEffect` (lines 69-80) to include `rotation: device.rotation`, `hdmi_mode: device.hdmi_mode`, `audio_enabled: device.audio_enabled`. Update `defaultValues` too.

    3. Add Calibration section JSX after the tags block (before `<DialogFooter>`):
       - Use `<Select>` from `@/components/ui/select` with `<Controller>` wrapping. Value coerce: `onValueChange={(v) => field.onChange(Number(v))}`.
       - HDMI `<Select>` — build options from `[{value: "", label: t("...hdmi_mode_auto")}, ...(device?.available_modes ?? []).map(m => ({value: m, label: m}))]`. In Controller, map `""` → `null` and vice versa.
       - Audio `<Toggle>` (import from `@/components/ui/toggle`) with 2 segments per behavior.

    4. Extend `saveMutation.mutationFn`:
       ```typescript
       // after existing PATCH name + PUT tags
       const dirty = form.formState.dirtyFields;
       const calibBody: Partial<{rotation: ...; hdmi_mode: ...; audio_enabled: ...}> = {};
       if (dirty.rotation) calibBody.rotation = values.rotation;
       if (dirty.hdmi_mode) calibBody.hdmi_mode = values.hdmi_mode;
       if (dirty.audio_enabled) calibBody.audio_enabled = values.audio_enabled;
       if (Object.keys(calibBody).length > 0) {
         await signageApi.updateDeviceCalibration(device.id, calibBody);
       }
       ```

    5. Add the test in DeviceEditDialog.test.tsx (mirror existing tests' fixture shape; `vi.mock` signageApi to spy on `updateDeviceCalibration`).
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/signage/components/DeviceEditDialog.test.tsx && npm run tsc -- --noEmit</automated>
  </verify>
  <done>Dialog renders Calibration section with all three controls. Partial-dirty save sends only changed fields. Devices query invalidated on success. Toast localized. Test green. tsc clean.</done>
</task>

</tasks>

<verification>
```
cd frontend && npm run check:i18n-parity && npm run check:i18n-du-tone && npx vitest run && npm run build
```

Manual smoke:
1. Start dev, log in as admin, navigate to `/signage/devices`, click edit on any device.
2. Confirm Calibration section appears with: Rotation dropdown (4 options), HDMI mode dropdown (only "Auto" present), Audio toggle (pill).
3. Change rotation to 90°, click save. Network tab: one `PATCH /api/signage/devices/{id}/calibration {"rotation": 90}`. Toast appears. Dialog closes. Row (when refreshed) reflects new state.
</verification>

<success_criteria>
- CAL-UI-01: Calibration section present with all 3 controls.
- CAL-UI-02: HDMI dropdown shows only "Auto" until `device.available_modes` has entries.
- CAL-UI-03: Save calls PATCH /calibration and invalidates devices query + toast on success.
- CAL-UI-04: DE/EN parity at 8 new keys, du-tone clean.
- No backend changes (D-11).
</success_criteria>

<output>
After completion, create `.planning/phases/62-signage-calibration/62-02-SUMMARY.md`.
</output>
