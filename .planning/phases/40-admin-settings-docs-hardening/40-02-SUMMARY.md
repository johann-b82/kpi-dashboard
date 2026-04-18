---
phase: 40-admin-settings-docs-hardening
plan: 02
subsystem: sensor-admin
tags: [v1.15, sensors, admin, snmp, walk, probe, i18n, react]
requires:
  - Phase 40-01 (sub-page + CRUD form + useSensorDraft + DE/EN admin keys)
  - Phase 38-02 (POST /api/sensors/snmp-walk + /snmp-probe admin-gated endpoints)
provides:
  - runSnmpProbe + runSnmpWalk api.ts fetchers with payload types
  - SensorProbeButton — per-row state-machine component (idle/running/success/failure/timeout)
  - SnmpWalkCard — collapsible OID-Finder with click-to-assign into draft rows
  - SensorRemoveDialog — sensor-specific confirmation dialog (NOT a generalization of DeleteConfirmDialog)
  - SettingsPage admin-only link → /settings/sensors
  - 25 new sensors.admin.walk.* / sensors.admin.probe.* / settings.sensors_link.* i18n keys (EN + DE)
affects:
  - frontend/src/components/settings/sensors/SensorRowForm.tsx (Probe embedded + Remove routed through dialog)
  - frontend/src/pages/SensorsSettingsPage.tsx (SnmpWalkCard rendered between sensor list and PollIntervalCard)
  - frontend/src/pages/SettingsPage.tsx (new AdminOnly Card linking to /settings/sensors)
tech-stack:
  added:
    - 30s Promise.race timeout mirrors for Walk + Probe (identical sentinel pattern to PollNowButton.tsx)
  patterns:
    - "Community write-only rule extended to Probe/Walk: admin must retype community per session — never auto-fill from stored ciphertext"
    - Sensor-specific SensorRemoveDialog instead of generalizing DeleteConfirmDialog — avoids UploadPage regression risk
    - Unsaved-new-row removal bypasses dialog (immediate drop) — only existing rows trigger confirmation
    - SnmpWalkCard seeds host/port from first live sensor row on mount (but not community)
key-files:
  created:
    - frontend/src/components/settings/sensors/SensorProbeButton.tsx
    - frontend/src/components/settings/sensors/SnmpWalkCard.tsx
    - frontend/src/components/settings/sensors/SensorRemoveDialog.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/settings/sensors/SensorRowForm.tsx
    - frontend/src/pages/SensorsSettingsPage.tsx
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
decisions:
  - Client Promise.race(30_000) mirrors backend asyncio.wait_for(timeout=30) with the same "timeout" sentinel string as PollNowButton
  - Probe "needs community" rule — UX exposes disabled button + tooltip "Enter community to probe" rather than silently failing; this enforces the write-only rule without surprising admins
  - SnmpWalkCard uses a dropdown + field-selector picker (not two inline buttons) so scaling to 3+ sensor rows stays clean
  - SensorRemoveDialog is a parallel component (not a DeleteConfirmDialog rewrite) — keeps UploadPage untouched (its prop shape is batch-specific)
  - Unsaved new rows drop immediately on Remove — no server state, no dialog
  - Blank-to-clear for thresholds still not supported — carry-forward from 40-01
metrics:
  duration: ~25min
  completed: 2026-04-17
  tasks: 1 (+1 human-verify checkpoint pending)
  files_created: 3
  files_modified: 6
---

# Phase 40 Plan 02: SNMP Walk + Probe + Remove Dialog + Settings Link Summary

Interactive admin tooling layered on top of the 40-01 foundation: SNMP-Walk OID-Finder with click-to-assign into sensor rows, per-row Probe button with inline result chip / destructive toast, sensor-specific confirmation dialog replacing the `window.confirm()` stub, and the admin-only link from `/settings` → `/settings/sensors`. All guarded by a 30 s client-side `Promise.race` that mirrors the backend's `asyncio.wait_for(timeout=30)` on both endpoints.

## What Shipped

**api.ts fetchers (Task 1):**
- `runSnmpProbe(body: SnmpProbeRequestPayload) → Promise<SnmpProbeResult>` wrapping `POST /api/sensors/snmp-probe`
- `runSnmpWalk(body: SnmpWalkRequestPayload) → Promise<SnmpWalkEntry[]>` wrapping `POST /api/sensors/snmp-walk`
- Payload + result types match the Pydantic `SnmpProbeRequest` / `SnmpWalkRequest` / `SnmpProbeResult` shapes (Decimal scales on the wire as strings; OIDs nullable for Probe)

**SensorProbeButton (new component):**
- State machine: `idle → running → success(inline chip for 5s) / failure(toast)`. Success chip uses `bg-primary/10 text-primary` tokens + formats as `{{temp}} °C · {{humidity}} %` (toFixed(1) / toFixed(0), em-dash for null values)
- Disabled + tooltip `"Enter community to probe"` when `!row.communityDirty || !row.community || !row.host`
- 30 s `Promise.race` timeout with shared `"timeout"` sentinel → dedicated `sensors.admin.probe.timeout` toast
- Non-timeout failures surface `err.message` through `sensors.admin.probe.failure` toast

**SnmpWalkCard (new component):**
- Collapsible Card with ChevronRight/Down toggle; expands to 4-column grid (host | port | community(password) | base-OID) + Walk button
- Host/port seeded from the first live (non-`_markedForDelete`) sensor row on mount; community NEVER seeded (write-only rule)
- Results panel: scrollable `max-h-96 overflow-y-auto` table with sticky header; columns OID (font-mono, break-all) | Type | Value | Assign
- Click-to-assign picker: dropdown listing live rows by name (falls back to `(unnamed)`) + field selector (Temperature OID / Humidity OID) + Cancel / Assign buttons; Assign calls `onUpdateRow(_localId, { [field]: oid })` — marks draft dirty via existing hook
- 30 s `Promise.race` timeout with dedicated `sensors.admin.walk.timeout` toast; success toast shows `{count}` OIDs

**SensorRemoveDialog (new component):**
- Small wrapper around `<Dialog>` + `<DialogContent>` primitives; props `{ open, onOpenChange, sensorName, onConfirm }`
- Uses pre-landed `sensors.admin.remove_confirm.*` i18n keys (interpolates `{name}` into body)
- Confirm button `variant="destructive"`; Cancel button `variant="outline"`
- Deliberately NOT a generalization of `DeleteConfirmDialog.tsx` — that component's UploadPage consumer depends on the `batch` prop shape. A parallel component avoids cross-feature blast radius.

**SensorRowForm integration:**
- `window.confirm()` stub removed. New flow:
  - `row.id === null` (unsaved) → immediate `onRemove()` — no dialog (no server consequences to warn about)
  - Existing rows → open `<SensorRemoveDialog>`; confirm triggers `onRemove()`
- `<SensorProbeButton row={row} />` added to row 5 alongside the Remove button

**SensorsSettingsPage integration:**
- `<SnmpWalkCard rows={rows} onUpdateRow={updateRow} />` rendered between the sensor list Card and `<PollIntervalCard />` so the OID-Finder sits adjacent to the rows it assigns into

**SettingsPage integration:**
- New admin-only Card between the General Card and the HR Card
- Imports `AdminOnly` (from `@/auth/AdminOnly`), `Link` (from `wouter`), `Thermometer` (from `lucide-react`)
- `<Link to="/settings/sensors">` rendered inside `<AdminOnly>` — Viewer never sees the Card

**i18n (25 new keys, EN + DE parity):**
- `sensors.admin.walk.*` (15 keys): title, host, port, community, base_oid, run, running, empty, timeout, failure, results_count, assign_to_temp, assign_to_humidity, assign_target, assign_confirm
- `sensors.admin.probe.*` (7 keys): test, running, success, failure, timeout, need_community, result
- `settings.sensors_link.*` (3 keys): title, body, cta
- "du" tone on DE side; verified by the parity script

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written. The only micro-adjustment was removing a stray `toast.success(...)` call in the picker's confirm handler (the plan's template had it reuse `walk.results_count` which would have shown `"1 OIDs found"`; removing it leaves the visual feedback to the field update + dirty ActionBar, which is cleaner).

### Intentional Carry-Forwards (not bugs)

1. **Probe requires retyped community for every session.** This is the security-correct outcome: the backend stores community as Fernet-encrypted ciphertext and cannot decrypt it for the admin; auto-filling would require either sending ciphertext (useless — server would try to decrypt it as plaintext) or relaxing the write-only rule. We surface a disabled button + tooltip `"Enter community to probe"` so admins understand the constraint.

2. **SnmpWalkCard community never auto-filled.** Same rule as above applied to the Walk card. Host/port ARE seeded from the first existing sensor row to save typing.

3. **Blank-to-clear for thresholds remains unsupported** (carried forward from 40-01). Admin cannot clear a previously-set threshold by emptying the field because the draft sends `None`-means-don't-change on PUT. Follow-up options: (a) add a per-field clear icon in a future plan, or (b) ship a dedicated `POST /api/settings/sensor-thresholds/reset` endpoint. Neither is in scope for Phase 40.

4. **DeleteConfirmDialog left untouched.** Planned alternative of refactoring it to a generic `{title, body, confirmLabel, cancelLabel, onConfirm}` shape was explicitly rejected in the plan — the UploadPage consumer depends on the `batch` prop shape and Phase 40's scope boundary forbids cross-feature blast radius.

## Success Criteria

- [x] SEN-ADM-06: SNMP-Walk OID-Finder functional — host/port/community/base-OID inputs, Walk button, scrollable results table, click-to-assign picker writing into `temperature_oid` / `humidity_oid` via `updateRow`
- [x] SEN-ADM-07: per-row Probe button — idle/running/success/failure/timeout states, inline chip on success, destructive toast on failure/timeout, disabled + tooltip when community blank
- [x] SEN-ADM-02: confirmation dialog replaces `window.confirm()` — verified no `window.confirm(` remains in `SensorRowForm.tsx`
- [x] SEN-I18N-01 (walk/probe/link subset): 25 new keys in EN + DE with parity script green
- [x] `/settings` has admin-only link → `/settings/sensors` (viewer does not see it)
- [x] `cd frontend && npx tsc --noEmit` → clean
- [x] `grep -rE 'dark:' frontend/src/components/settings/sensors/` → zero real usages (only comment mention in SensorAdminHeader)
- [x] `grep -rE '#[0-9a-fA-F]{6}' frontend/src/components/settings/sensors/ frontend/src/pages/SensorsSettingsPage.tsx` → zero
- [ ] SEN-ADM-02 full CRUD (add + edit + remove) end-to-end: **pending human UAT (Task 2 checkpoint)**
- [ ] Full admin-onboarding flow (walk → pick OID → fill row → probe → save): **pending human UAT**

## Verification Evidence

- Frontend types: `cd frontend && npx tsc --noEmit` → **clean (0 errors)**
- i18n parity: `node -e ... filter(startsWith(walk/probe/sensors_link))` → **OK — 25 new keys, DE parity**
- No hex literals in new files: `grep -rE '#[0-9a-fA-F]{6}' src/components/settings/sensors/ src/pages/SensorsSettingsPage.tsx` → **zero hits**
- No `dark:` variants in new files (comment mention in SensorAdminHeader is 40-01 docs)
- `grep -n 'window.confirm' frontend/src/components/settings/sensors/` → **zero**
- `grep -n 'runSnmpWalk\|runSnmpProbe' frontend/src/lib/api.ts` → both present with correct signatures

## Commits

- `d93d5d9` `feat(40-02): sensor admin interactive tooling — walk + probe + remove dialog + settings link`

## Known Stubs

None. Every component is wired end-to-end:
- `SensorProbeButton` calls the real `runSnmpProbe` endpoint against the draft row's uncommitted state
- `SnmpWalkCard` calls the real `runSnmpWalk` endpoint and mutates the draft via `updateRow`
- `SensorRemoveDialog` issues the real `markRowDeleted` → `deleteSensor` path on save
- `SettingsPage` link is a real wouter `<Link>` guarded by `<AdminOnly>`

## Human UAT — 14-Step Verification Protocol (checkpoint:human-verify)

**Prerequisites:**
- Stack up: `docker compose up -d` — 5 services healthy
- Phase 38-03 scheduler live (so `reschedule_sensor_poll` is wired end-to-end)
- Phase 39 `/sensors` dashboard accessible (for verifying interval + threshold changes propagate)
- One Admin account + one Viewer account
- Seeded sensor `Produktion` (192.9.201.27) from Phase 38-01
- Frontend: <http://localhost:5173/settings/sensors>

**Steps:**

1. **Route guard** — As Viewer: visit <http://localhost:5173/settings/sensors>. Expected: "Admin only" shell, no form, no data leaked. As Admin: same URL renders the full page.

2. **Settings link** — As Admin on <http://localhost:5173/settings>. Expected: a "Sensor monitoring" / "Sensor-Monitoring" Card appears. Click "Open sensor configuration" / "Sensor-Konfiguration öffnen" → navigates to `/settings/sensors`. Viewer: the Card is absent.

3. **List existing sensors** — At least the seeded `Produktion` row appears with host `192.9.201.27`. Community field shows placeholder `••••••` + stored-hint under it. temperature_oid and humidity_oid populated from seed.

4. **Add new sensor** — Click "+ Sensor hinzufügen". Expected: a new empty row appears. Fill: name `Test-Lager`, host `192.9.201.27`, community `public`, leave OIDs empty. Click Probe. Expected: either toast `Prüfung fehlgeschlagen: ...` (OIDs empty) or success with `— · —` — either is contract-correct. Now: open SNMP Walk section.

5. **SNMP Walk — happy path** — Expand the "SNMP-Walk (OID-Finder)" card. Host/port pre-filled from first sensor; community blank. Type `public` into community, base-OID `.1.3.6.1.4.1.21796.4.9.3.1` and click "Walk starten". Expected: within 10–30s, a scrollable results table appears listing OIDs; success toast `"X OIDs gefunden"`.

6. **Click-to-assign** — In the Walk results, find a temperature-ish OID. Click "Assign" → picker opens. Pick the `Test-Lager` row as target. Pick "→ Temp-OID". Click Zuweisen. Expected: `Test-Lager` row's temperature_oid field now shows the clicked OID; field is dirty (sticky ActionBar shows "Nicht gespeichert").

7. **Probe with valid OIDs** — With `Test-Lager` populated (host, community, temp_oid), click Probe on its row. Expected: running state, then success chip shows `"23.4 °C · —"` (humidity OID still empty). Toast `Prüfung erfolgreich`. Error path: set host to `192.9.201.99` (unreachable), click Probe → destructive toast after ≤30s.

8. **Save flow** — Fill a valid humidity_oid via another Walk assign. Click Save. Expected: toast `Sensor-Konfiguration gespeichert`. ActionBar returns to pristine. Refresh page → new `Test-Lager` row persists; community field empty, stored-hint present.

9. **Edit existing + community omit** — Change `Test-Lager` name to `Test-Lager-2`. Do NOT touch community. Save. Expected: success. Refresh. Row shows new name; row is still reachable by Probe when admin re-types `public` (community ciphertext preserved server-side).

10. **Remove with dialog** — Click Remove on the `Test-Lager-2` row. Expected: custom dialog "Sensor entfernen?" with body `Damit werden Test-Lager-2 und alle Messwerte gelöscht...`. Click Abbrechen → dialog closes, row still present, draft un-dirtied. Click Remove again → Entfernen → row visually marked for deletion (strike-through / opacity-50 + destructive pending text). Save. Expected: toast success; refresh → row gone.

11. **Polling interval reschedule** — Change polling interval from 60 to 30. Save. Expected: toast success. `docker compose logs api --tail=50 | grep reschedule_sensor_poll` shows a log line with old=60 new=30 and a new `next_run_time`. Visit <http://localhost:5173/sensors>. SubHeader freshness ticks every ~30s. Revert interval to 60 and save.

12. **Threshold writes** — Set temperature_min=18, temperature_max=26. Save. Navigate to <http://localhost:5173/sensors>. Expected: two dashed destructive ReferenceLines on the temperature chart; if current value outside 18..26, card shows destructive color + "Außerhalb des Bereichs". Revert (set min=0, max=100 — blank-to-clear NOT supported this phase; documented).

13. **Dirty-guard navigate-away** — Add a new empty row (dirty). Click NavBar brand/logo or navigate to `/home`. Expected: UnsavedChangesDialog appears. Click Stay → stays on /settings/sensors, row preserved. Click again → Discard & leave → navigates away, draft reset.

14. **i18n parity end-to-end** — Toggle EN/DE. Expected: every visible string on /settings/sensors (header, fields, walk labels, probe labels, help text, toasts, dialog buttons) flips. Browser console: zero `i18next::translator: missingKey` warnings.

**Resume signal:** Reply `approved` to mark Plan 40-02 complete. If issues: list them and revision plans will be spun up.
