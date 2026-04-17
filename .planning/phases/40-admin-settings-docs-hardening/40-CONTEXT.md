# Phase 40: Admin Settings + Docs + Hardening — Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Auto — decisions from locked OQ defaults + research

<domain>
## Phase Boundary

Admin can onboard a sensor from the UI without shelling into DB or YAML: discover OIDs via walk, validate via probe, save config, change polling interval on the fly, and find complete bilingual operator documentation. Host-mode fallback documented for operators whose Docker bridge can't reach 192.9.201.x.

**Covers REQs (12):** SEN-ADM-01..08, SEN-OPS-02..04, plus the admin-form keys remainder of SEN-I18N-01.

**Depends on:** Phase 38 (CRUD + probe + walk + settings endpoints), Phase 39 (`/sensors` dashboard live so admin sees edits take effect).

</domain>

<decisions>
## Implementation Decisions

### Admin Settings Location (OQ-2 default)
- **Dedicated sub-page `/settings/sensors`** — NOT a card inside the main `/settings` page.
- Rationale: accommodates probe/walk tooling without cramping the current Settings layout; gives room for future per-sensor threshold overrides; matches "full admin sub-page" pattern if ever extended.
- Access: link/button from main `/settings` page (admin-only row). Page itself uses `<AdminOnly>` guard + server-side admin on all POST/PATCH/DELETE.
- Reuses existing `SettingsDraft` + `UnsavedGuard` + `ActionBar` infrastructure.

### Sensor CRUD Form
- Per-sensor fields editable: name (unique), host, port (default 161), community (SecretStr — write-only; never displayed after save, show placeholder `••••••` if unchanged), temperature_oid, temperature_scale, humidity_oid, humidity_scale, enabled.
- List shows existing sensors; each row has Edit + Remove. "+ Sensor hinzufügen" opens a new-row form.
- Remove confirm dialog reuses `DeleteConfirmDialog` pattern.
- Validation: name non-empty + unique; host non-empty (inline validation); OIDs optional; scales must be positive numbers.

### Polling Interval Input (SEN-ADM-04)
- Integer seconds input, bounds 5–86400 (5s min, 24h max).
- Save triggers `PUT /api/settings` which calls `scheduler.reschedule_sensor_poll(new_seconds)` in try/except (helper created in Phase 38-03).
- Inline help text: "Alle Sensoren werden alle X Sekunden abgefragt."

### Global Threshold Inputs (SEN-ADM-05)
- Four optional numeric inputs: sensor_temperature_min/max, sensor_humidity_min/max.
- Persist via same `PUT /api/settings` as interval.
- All optional; empty-string → null (unset threshold).

### SNMP Walk UI (SEN-ADM-06)
- Collapsible section "SNMP-Walk (OID-Finder)" inside the sub-page.
- Inputs: host, port (default 161), community, base OID (default `.1.3.6.1`).
- Walk button → `POST /api/sensors/snmp-walk` → results table (OID | type | value), scrollable.
- Click-to-assign: copy OID into a sensor's temp/humidity field (pick target via dropdown).

### SNMP Probe UI (SEN-ADM-07)
- Per-sensor "Probe" button (inline with row).
- Triggers `POST /api/sensors/snmp-probe` with current draft config (uncommitted OK).
- Shows live temp + humidity result inline + toast (success green token, failure destructive).

### Dirty-Guard (SEN-ADM-08)
- Reuse `UnsavedChangesDialog` + `SettingsDraft` provider.
- Unsaved changes → navigate-away prompt.

### Bilingual Admin Guide (SEN-OPS-02..03)
- Two new Markdown files:
  - `frontend/src/docs/admin/sensor-monitor.en.md`
  - `frontend/src/docs/admin/sensor-monitor.de.md`
- Follow v1.13 admin-guide format exactly — frontmatter, headings, same Markdown pipeline.
- Content covers:
  - Prerequisites (Docker host reachability to 192.9.201.x)
  - Onboarding a new sensor (walk → probe → save)
  - Thresholds (global min/max)
  - Polling interval
  - Troubleshooting (offline sensors, Docker network, pre-flight smoke test)
  - Security warnings: "never use `public` as community in production" + "community string is stored encrypted"
- Docs index updated (both locales) to include the new article.

### Host-Mode Fallback Runbook (SEN-OPS-04)
- Embedded in the admin guide under "Troubleshooting".
- Explains: if `docker compose exec api snmpget ...` fails but works from the host → options:
  1. `network_mode: host` on `api` service (with trade-offs: breaks port mapping and internal DNS — full compose changes needed)
  2. `macvlan` network (less invasive alternative)
- Code snippets for both approaches; explicit "preferred option: none (bridge) until it fails".

### i18n Keys (SEN-I18N-01 remaining)
- `sensors.admin.title`, `.subtitle`, `.description`
- `sensors.admin.add_sensor`, `.remove_sensor`, `.remove_confirm.{title,body,confirm,cancel}`
- `sensors.admin.fields.{name,host,port,community,temperature_oid,temperature_scale,humidity_oid,humidity_scale,enabled}`
- `sensors.admin.fields.{name,host}.placeholder`
- `sensors.admin.validation.{name_required,host_required,name_duplicate,positive_number}`
- `sensors.admin.walk.{title,host,base_oid,run,running,empty,assign_to_temp,assign_to_humidity}`
- `sensors.admin.probe.{test,running,success,failure}`
- `sensors.admin.poll_interval.{label,help,out_of_bounds}`
- `sensors.admin.thresholds.{title,temp_min,temp_max,humidity_min,humidity_max}`
- DE parity required. "du" tone.

### Scope Boundary
- This phase does NOT ship per-sensor threshold overrides (DIFF-09 deferred).
- This phase does NOT ship email/Slack alerting (DIFF-02/03 out of scope — OQ-8).
- This phase does NOT ship historical SQLite import (OQ-6 default skip).
- This phase does NOT ship retention-configurable UI (OQ-5 fixed 90d).

### Suggested Plan Split
- **40-01** — Admin settings sub-page foundation: route + page shell + CRUD form + dirty-guard + polling-interval input + global thresholds + AdminOnly wrap + admin i18n keys (EN+DE)
- **40-02** — Probe + Walk tooling + DeleteConfirmDialog + SettingsPage link + all SEN-ADM-06/07 — the interactive bits that call backend SNMP endpoints
- **40-03** — Bilingual admin guide + docs index update + host-mode fallback runbook (OPS work, not code)

Planner may combine 40-02 into 40-01 if scope is thin; 40-03 must stand alone since it's docs-only.

</decisions>

<code_context>
## Existing Code Insights

- `frontend/src/pages/SettingsPage.tsx` — main settings page with top-level Cards; add a link/button to `/settings/sensors`.
- `frontend/src/contexts/SettingsDraftContext.tsx` — draft + dirty-guard infrastructure.
- `frontend/src/components/settings/ActionBar.tsx` — sticky Save/Discard/Reset.
- `frontend/src/components/settings/PersonioCard.tsx` — structural reference for the sensors admin form (credentials + config + test button + manual action).
- `frontend/src/components/DeleteConfirmDialog.tsx` — reusable.
- `frontend/src/auth/AdminOnly.tsx`.
- `frontend/src/App.tsx` — add `<Route path="/settings/sensors">`.
- Docs pipeline already proven in v1.13 — reuse existing Markdown + rehype + registry pattern; find article registry + index files and extend.
- Backend endpoints live from Phase 38: POST /api/sensors/, PATCH /api/sensors/{id}, DELETE /api/sensors/{id}, POST /api/sensors/snmp-probe, POST /api/sensors/snmp-walk, PUT /api/settings.

</code_context>

<specifics>
## Specific Ideas

- Refer to `PersonioCard.tsx` for the community-as-secret pattern (write-only, never displayed).
- Refer to v1.13 admin-guide Markdown files for the article format and frontmatter shape.
- Probe button state machine: idle → running → success (inline result chip) / failure (destructive toast).
- Walk results table: max-height + scroll; row click copies OID to clipboard + highlights the target field.

</specifics>

<deferred>
## Deferred Ideas

- Per-sensor threshold overrides (DIFF-09) — future.
- Email/Slack alerting (DIFF-02/03) — out of scope until SMTP provisioned.
- Retention policy UI (SEN-FUTURE-01).
- SQLite import script (SEN-FUTURE-02, optional if operator requests).
- Calibration offsets (DIFF-08).
- SNMPv3 auth/priv (SEN-FUTURE-03).

</deferred>

<canonical_refs>
## Canonical References

- `.planning/research/SUMMARY.md` (section 6 Phase 40 deliverables)
- `.planning/research/FEATURES.md` (admin UX structure; SEN-ADM-* list)
- `.planning/research/ARCHITECTURE.md` (section 4 — frontend integration)
- `.planning/REQUIREMENTS.md` (12 REQs owned by this phase)
- Phase 38 router endpoints: `backend/app/routers/sensors.py`
- v1.13 admin-guide Markdown files as format reference

</canonical_refs>
