---
phase: 48-pi-provisioning-e2e-docs
plan: 04
type: execute
wave: 2
depends_on: []
files_modified:
  - frontend/src/docs/en/admin-guide/digital-signage.md
  - frontend/src/docs/de/admin-guide/digital-signage.md
  - frontend/src/lib/docs/registry.ts
  - frontend/src/lib/docs/toc.ts
  - frontend/src/i18n/locales/en.json
  - frontend/src/i18n/locales/de.json
  - docs/operator-runbook.md
autonomous: true
requirements: [SGN-OPS-01, SGN-OPS-02, SGN-OPS-03]
must_haves:
  truths:
    - "`frontend/src/docs/en/admin-guide/digital-signage.md` + DE counterpart exist, follow the structure in RESEARCH §9 (onboarding → media → playlists → offline → troubleshooting → PPTX)"
    - "DE article uses informal 'du' tone throughout (v1.16 cross-cutting hazard 1); never 'Sie'"
    - "`registry.ts` + `toc.ts` (whichever owns the admin-guide section list) register the new slug `digital-signage` with titleKey `docs.nav.adminDigitalSignage`"
    - "en.json AND de.json both contain `docs.nav.adminDigitalSignage` — CI parity check (scripts/check-i18n-parity.mjs) passes"
    - "`docs/operator-runbook.md` exists at repo root and covers TOC from RESEARCH §9 (Pi hardware → software stack → image → provision-pi.sh reference → systemd units → Chromium flags → sidecar cache → recovery → fallback)"
    - "Operator runbook reproduces the full SGN-OPS-03 Chromium kiosk flag set verbatim"
    - "A section documents the REQUIREMENTS.md path-text typo amendment: SGN-OPS-01 refers to `frontend/src/docs/admin/digital-signage.{en,de}.md` but the actual docs convention is `frontend/src/docs/{en,de}/admin-guide/digital-signage.md`. Phase 48-05 formalizes the amendment in 48-VERIFICATION.md; this plan notes it here for docs authors."
  artifacts:
    - path: frontend/src/docs/en/admin-guide/digital-signage.md
      provides: "EN admin guide covering onboarding, media, playlists, offline, PPTX, troubleshooting"
    - path: frontend/src/docs/de/admin-guide/digital-signage.md
      provides: "DE informal 'du' counterpart with same structure"
    - path: frontend/src/lib/docs/registry.ts
      provides: "?raw imports for the two new markdown files"
    - path: frontend/src/lib/docs/toc.ts
      provides: "admin-guide section entry: {slug: 'digital-signage', titleKey: 'docs.nav.adminDigitalSignage'}"
    - path: docs/operator-runbook.md
      provides: "Pi-focused technical runbook — unit files, journalctl, recovery procedures"
  key_links:
    - from: frontend/src/lib/docs/registry.ts
      to: frontend/src/docs/en/admin-guide/digital-signage.md
      via: "Vite `?raw` import"
      pattern: "admin-guide/digital-signage.md\\?raw"
    - from: frontend/src/i18n/locales/{en,de}.json
      to: docs.nav.adminDigitalSignage
      via: "i18n parity script"
      pattern: "adminDigitalSignage"
---

<objective>
Ship SGN-OPS-01 (bilingual admin guide), SGN-OPS-02 (docs index registration in both locales), and the admin-facing half of SGN-OPS-03 (operator runbook at `docs/operator-runbook.md`).

Purpose: The admin guide is the end-user documentation a non-developer admin reads when onboarding a new Pi, uploading media, or troubleshooting Wi-Fi flakiness. The operator runbook is the technical companion for operators SSH'd into the Pi — systemd unit content, journalctl commands, cache directory layout, recovery procedures.
Output: 2 markdown docs (EN + DE), registry/toc/i18n registration, 1 operator runbook, all following the existing docs convention (sensor-monitor.md / personio.md pattern).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/48-pi-provisioning-e2e-docs/48-CONTEXT.md
@.planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md
@frontend/src/docs/en/admin-guide/sensor-monitor.md
@frontend/src/docs/de/admin-guide/sensor-monitor.md
@frontend/src/lib/docs/registry.ts
@frontend/src/lib/docs/toc.ts
</context>

<cross_cutting_hazards>
## v1.16 Hazard 1 — DE "du" tone (ROADMAP line 318)

> Every `signage.*` i18n key authored in `en.json` must exist in `de.json` (informal "du" tone). CI parity script must be green before any admin-UI plan ships. Missing keys surface as literal keys on screen.

**This plan ships German content in TWO places:**
1. `frontend/src/docs/de/admin-guide/digital-signage.md` — must use "du" throughout, never "Sie". Validate against sensor-monitor.md DE patterns.
2. `frontend/src/i18n/locales/de.json` — the new `docs.nav.adminDigitalSignage` key. (For this specific key the value is the proper noun "Digital Signage" which is invariant across locales — per RESEARCH §9 note — but the KEY must still exist in de.json for parity.)

**Spot checks before committing DE content:** scan for "Sie ", "Ihre ", "Ihr ", "Ihnen" — all are formal. Replace with "du", "deine", "dein", "dir".
</cross_cutting_hazards>

<pitfalls_inherited>
- **RESEARCH §9 path amendment:** SGN-OPS-01 literal text in REQUIREMENTS.md says `frontend/src/docs/admin/digital-signage.{en,de}.md`. The real path per existing convention (see sibling files) is `frontend/src/docs/{en,de}/admin-guide/digital-signage.md`. This plan uses the correct path; Plan 48-05 formalizes the amendment in 48-VERIFICATION.md. Call this out in the operator runbook's introduction.
- **RESEARCH §9 i18n key path:** `docs.nav.adminDigitalSignage` is a NESTED key path (`docs → nav → adminDigitalSignage`). Edit the JSON accordingly; do not create a flat key.
</pitfalls_inherited>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Write EN + DE admin guides + register in docs system</name>
  <files>frontend/src/docs/en/admin-guide/digital-signage.md, frontend/src/docs/de/admin-guide/digital-signage.md, frontend/src/lib/docs/registry.ts, frontend/src/lib/docs/toc.ts, frontend/src/i18n/locales/en.json, frontend/src/i18n/locales/de.json</files>
  <read_first>
    - frontend/src/docs/en/admin-guide/sensor-monitor.md (structural template — sections, depth, tone)
    - frontend/src/docs/de/admin-guide/sensor-monitor.md (DE "du" tone reference)
    - frontend/src/lib/docs/registry.ts + toc.ts (existing registration pattern — read both, edit whichever actually holds the section list)
    - .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md §9 "Admin Guide" TOC + i18n key path
  </read_first>
  <action>
    **Step 1: EN admin guide** — create `frontend/src/docs/en/admin-guide/digital-signage.md` covering the TOC from RESEARCH §9 "Admin Guide Table of Contents (English)":

    - Overview (what signage is, supported formats: image / video / PDF / PPTX / URL / HTML)
    - Prerequisites (admin role, Pi 4/5 recommended, Pi 3B best-effort, local network + internet)
    - Onboarding a Pi (flash Bookworm Lite 64-bit → run `provision-pi.sh <api-url>` → claim at /signage/pair → assign tags)
    - Uploading Media (drag-drop, URL register, HTML register, PPTX with conversion status states)
    - Building Playlists (drag-reorder, duration per item, transition, tag targeting)
    - Offline Behavior (sidecar caches playlist + media; 5-minute target; reconnect within 30s)
    - Troubleshooting (Wi-Fi, pairing code, black screen, PPTX rendering)
    - PPTX Best Practices (embed all fonts before upload; avoid OLE objects / embedded videos)

    Tone: concise, admin-facing (not engineer-facing). Reference the Pi provisioning by pointing at `scripts/README-pi.md` (written by Plan 48-02) and the operator runbook for anything technical.

    **Step 2: DE admin guide** — create `frontend/src/docs/de/admin-guide/digital-signage.md` — translate the EN structure using **informal "du" tone throughout**. After writing, `grep -E "Sie |Ihre |Ihr |Ihnen" frontend/src/docs/de/admin-guide/digital-signage.md` MUST return nothing. Proper nouns (Digital Signage, Raspberry Pi, Bookworm Lite, Chromium) stay in English.

    **Step 3: Registry registration** — read `frontend/src/lib/docs/registry.ts` and `toc.ts`. Add the admin-guide entry per the existing pattern:
    - `toc.ts` (or wherever sections[] live): add `{ slug: "digital-signage", titleKey: "docs.nav.adminDigitalSignage" }` to the `admin-guide` section entries.
    - `registry.ts`: add `import enDigitalSignage from "../../docs/en/admin-guide/digital-signage.md?raw";` + DE counterpart, then add `"digital-signage": enDigitalSignage` and `"digital-signage": deDigitalSignage` to the EN and DE admin-guide maps respectively.
    - Match the EXISTING import ordering (alphabetical by slug in the existing file — follow what's there).

    **Step 4: i18n keys** — edit `frontend/src/i18n/locales/en.json` and `de.json`:
    - Under the nested `docs.nav` object, add `"adminDigitalSignage": "Digital Signage"` in BOTH locales (proper noun, same in both).

    **Step 5: Parity + build check** — run:
    ```
    cd frontend && node scripts/check-i18n-parity.mjs
    npm run build || npx vite build
    ```
    Both must exit 0. If parity fails, the key is missing from one locale. If build fails, the import path is wrong (check `?raw` suffix) or toc.ts entry is malformed.
  </action>
  <verify>
    <automated>test -f frontend/src/docs/en/admin-guide/digital-signage.md && test -f frontend/src/docs/de/admin-guide/digital-signage.md && (! grep -E "^|[^a-zA-Z]Sie |Ihre |Ihr |Ihnen" frontend/src/docs/de/admin-guide/digital-signage.md | grep -E "Sie |Ihre |Ihr |Ihnen") && grep -q "adminDigitalSignage" frontend/src/i18n/locales/en.json && grep -q "adminDigitalSignage" frontend/src/i18n/locales/de.json && grep -q "digital-signage" frontend/src/lib/docs/registry.ts && cd frontend && node scripts/check-i18n-parity.mjs</automated>
  </verify>
  <done>
    Both admin-guide files exist with the RESEARCH §9 TOC coverage. DE uses "du" tone (no formal "Sie"/"Ihr"). Registry + toc + both JSON locale files contain `docs.nav.adminDigitalSignage`. i18n parity green. Build succeeds.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Write docs/operator-runbook.md (technical operator-facing runbook)</name>
  <files>docs/operator-runbook.md</files>
  <read_first>
    - .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md §9 "Operator Runbook" TOC + §4 (full unit-file content) + §6 (Chromium flag set)
    - .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md §11 (pitfalls — include key ones in recovery section)
    - scripts/README-pi.md (written by Plan 48-02 — cross-link, don't duplicate)
  </read_first>
  <action>
    Create `docs/operator-runbook.md` at the repo root. If `docs/` does not exist, create it (RESEARCH §12 OQ5 resolution: separate file at repo root).

    Sections per RESEARCH §9 "Operator Runbook Table of Contents":

    1. **Pi Hardware Requirements** — Pi 4 / Pi 5 recommended, Pi 3B best-effort (Wayland caveats), RAM ≥1GB, ≥16GB SD, HDMI display, Ethernet or Wi-Fi.
    2. **Software Stack** — Raspberry Pi OS Bookworm Lite 64-bit, Chromium 136+ (from RPi archive), labwc, seatd, Python 3.11, unclutter-xfixes, Carlito/Caladea/Noto/DejaVu fonts.
    3. **Pi Image (from scratch)** — Raspberry Pi Imager steps, Wi-Fi + SSH pre-configure, first-boot verification.
    4. **Provision Script Reference** — pointer to `scripts/README-pi.md`, exit codes table from RESEARCH §7, idempotency note.
    5. **Systemd Service Reference** — full content of `signage-sidecar.service`, `signage-player.service`, `labwc.service` VERBATIM from the committed `scripts/systemd/*.service` files (Plan 48-02). journalctl commands for each.
    6. **Full Chromium Flag Set** — reproduce SGN-OPS-03 verbatim:
       ```
       --kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required --disable-session-crashed-bubble --ozone-platform=wayland --app=<url>
       ```
       Brief explanation per flag (from RESEARCH §6).
    7. **Sidecar Cache Reference** — `/var/lib/signage/` layout from RESEARCH §2 (device_token, playlist.json, playlist.etag, media/<uuid>). Inspection commands. `curl localhost:8080/health` contract.
    8. **signage User and Security** — non-root rationale (SGN-OPS-03), groups `video,audio,render,input` (Pitfall 10), ProtectSystem=strict + ReadWritePaths.
    9. **Recovery Procedures** — restart sidecar/player, reprovision, factory reset (`rm -rf /var/lib/signage/`), Chromium profile corruption fix, Wayland socket race (Pitfall 3 + journalctl signature).
    10. **Fallback — Image-Only Playlist** — if PPTX/PDF fails on specific Pi hardware, operators can build an image-only playlist (SGN-OPS-03 explicit fallback requirement).
    11. **Notes on documentation path amendment** — brief paragraph: "REQUIREMENTS.md SGN-OPS-01 originally referenced `frontend/src/docs/admin/digital-signage.{en,de}.md`. The actual path used follows the established in-app docs convention: `frontend/src/docs/{en,de}/admin-guide/digital-signage.md`. Plan 48-05's `48-VERIFICATION.md` formalizes this amendment."

    Formatting: use the same markdown style as existing `docs/` entries if any exist, otherwise use a clean hierarchical structure (## for sections, ### for subsections, fenced code blocks for commands).
  </action>
  <verify>
    <automated>test -f docs/operator-runbook.md && grep -q "ozone-platform=wayland" docs/operator-runbook.md && grep -q "autoplay-policy=no-user-gesture-required" docs/operator-runbook.md && grep -q "loginctl enable-linger" docs/operator-runbook.md && grep -q "signage" docs/operator-runbook.md && grep -q "ReadWritePaths=/var/lib/signage" docs/operator-runbook.md && grep -q "path amendment\\|REQUIREMENTS.md" docs/operator-runbook.md</automated>
  </verify>
  <done>
    `docs/operator-runbook.md` exists with all 11 sections. Contains verbatim Chromium flag set. Includes systemd unit content inline (copied from scripts/systemd/). Path amendment note is present.
  </done>
</task>

</tasks>

<verification>
- Both admin-guide markdown files exist and load in the in-app docs viewer (verifiable by running `npm run dev` and navigating to the docs page — but that's Plan 48-05's Pi-E2E concern; here `npm run build` success is sufficient).
- i18n parity green.
- DE admin-guide free of formal pronouns ("Sie"/"Ihr"/"Ihnen").
- `docs/operator-runbook.md` exists with SGN-OPS-03 Chromium flag set verbatim + full systemd unit content.
</verification>

<success_criteria>
- SGN-OPS-01: bilingual admin guide covers all six required topics (onboarding, media, playlists, offline, Wi-Fi troubleshooting, PPTX).
- SGN-OPS-02: both locale docs indexes register the new article.
- SGN-OPS-03 admin-facing half: operator runbook documents Pi image, full Chromium flag set, systemd unit, dedicated `signage` user, fallback to image-only playlist.
- v1.16 Hazard 1 respected: DE tone is informal "du".
</success_criteria>

<output>
After completion, create `.planning/phases/48-pi-provisioning-e2e-docs/48-04-SUMMARY.md` recording:
- Both admin-guide word counts (ballpark)
- Tone-check result for DE (grep output should be empty)
- Registry + toc + JSON changes (line diffs)
- docs/operator-runbook.md section count + chromium-flag-set presence confirmed
- Path-amendment note documented (handoff to Plan 48-05's 48-VERIFICATION.md)
</output>

<files_to_read>
- .planning/phases/48-pi-provisioning-e2e-docs/48-CONTEXT.md
- .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md
- frontend/src/docs/en/admin-guide/sensor-monitor.md
- frontend/src/docs/de/admin-guide/sensor-monitor.md
- frontend/src/docs/en/admin-guide/personio.md
- frontend/src/lib/docs/registry.ts
- frontend/src/lib/docs/toc.ts
- frontend/src/i18n/locales/en.json
- frontend/src/i18n/locales/de.json
- scripts/README-pi.md  (written by Plan 48-02; may not yet exist — OK, cross-link forward)
- scripts/systemd/signage-sidecar.service
- scripts/systemd/signage-player.service
- scripts/systemd/labwc.service
- CLAUDE.md
</files_to_read>
