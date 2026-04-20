---
phase: 48-pi-provisioning-e2e-docs
plan: 05
type: execute
wave: 3
depends_on: [48-01, 48-02, 48-03, 48-04]
files_modified:
  - .planning/phases/48-pi-provisioning-e2e-docs/48-E2E-RESULTS.md
  - .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md
  - frontend/scripts/check-player-bundle-size.mjs
autonomous: false
requirements: [SGN-OPS-01, SGN-OPS-02, SGN-OPS-03]
must_haves:
  truths:
    - "E2E walkthrough executed on real Pi hardware; all 5 scenarios from RESEARCH §8 recorded with timings in `48-E2E-RESULTS.md`"
    - "SGN-OPS-03 success criterion 1 verified: boot → pairing code ≤30s after provision-pi.sh exit; claim → first playback ≤5s; 5-min offline loop holds; reconnect → change arrives ≤30s"
    - "`journalctl --user -u signage-player` shows no `--no-sandbox` and no 'Running as root' warning (SGN-OPS-03 success criterion 4)"
    - "`48-VERIFICATION.md` captures: (a) SGN-OPS-01 docs-path amendment, (b) Phase 47 D-7/D-8 closeout confirmation, (c) Phase 47 G2 bundle-cap decision (raise to 210_000 OR dynamic-import PdfPlayer — whichever the user picks at the blocking checkpoint), (d) SGN-PLY-05 ownership: Pi sidecar per Plan 48-01 heartbeat task"
    - "G2 decision captured at a `checkpoint:decision` gate — plan does NOT flip the cap unilaterally"
    - "If decision is 'raise to 210_000', `frontend/scripts/check-player-bundle-size.mjs` constant LIMIT is updated in a single, separate commit"
    - "Phase 48 is closable — SGN-OPS-01..03 requirements all marked verified in `48-VERIFICATION.md`"
  artifacts:
    - path: .planning/phases/48-pi-provisioning-e2e-docs/48-E2E-RESULTS.md
      provides: "Filled-in walkthrough result artifact (RESEARCH §8 scaffold)"
    - path: .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md
      provides: "Phase 48 verification doc + amendments + carry-forward closeouts"
    - path: frontend/scripts/check-player-bundle-size.mjs
      provides: "(conditional on G2 decision) updated LIMIT constant"
  key_links:
    - from: .planning/phases/48-pi-provisioning-e2e-docs/48-E2E-RESULTS.md
      to: .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md
      via: "Pass/fail summary feeds the verification matrix"
      pattern: "Scenario [1-5]"
---

<objective>
Run the end-to-end walkthrough on real Pi hardware, fill `48-E2E-RESULTS.md`, make the G2 bundle-cap decision (via human-checkpoint), and write `48-VERIFICATION.md` closing Phase 48 (and finalizing the Phase 47 carry-forwards).

Purpose: This is the "does it actually work on a real Pi" gate for v1.16 Digital Signage. Plans 48-01 through 48-04 delivered code, scripts, and docs — none of that has been executed on hardware yet. This plan executes the walkthrough, records timings, surfaces any defects, and writes the verification document that lets the milestone close.
Output: Two planning docs (E2E-RESULTS + VERIFICATION), optionally one CI-guard constant update, and a signed-off human checkpoint.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/48-pi-provisioning-e2e-docs/48-CONTEXT.md
@.planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md
@.planning/phases/47-player-bundle/47-VERIFICATION.md
@.planning/phases/47-player-bundle/47-05-ci-guards-bundle-size-and-uat-SUMMARY.md
@.planning/REQUIREMENTS.md
@scripts/provision-pi.sh
@scripts/README-pi.md
@pi-sidecar/sidecar.py
@pi-sidecar/README.md
@frontend/scripts/check-player-bundle-size.mjs
</context>

<pitfalls_inherited>
From 48-RESEARCH.md §11 — relevant during the E2E walkthrough:

- **Pitfall 3 (Wayland socket race):** if pairing code takes >30s to appear, check `journalctl --user -u signage-player` for crash-loops. The `ExecStartPre` guard loop should prevent this but first-boot timing can vary.
- **Pitfall 9 (media cache growth):** during the 5-min offline test, monitor `du -sh /var/lib/signage/media/` — flag if it grows unboundedly. This should be bounded by the playlist item count.
- **Pitfall 11 (sidecar-restart flash):** testing Scenario 5 (`systemctl --user restart signage-sidecar`) may cause a brief media URL flicker. Note but do not fail the scenario unless playback is actually interrupted.
- **RESEARCH §1 Unknown 5:** the 30s reconnect target may be tight in practice; if Scenario 4 records >30s consistently, recommend tightening `useSseWithPollingFallback` from 30s → 15s polling in a follow-up (NOT this plan).
- **RESEARCH LOW-confidence flags (Metadata):** Pi 3B Wayland default; RSS estimate; EventSource reconnect timing — all expected to be resolved by actually running §8.
</pitfalls_inherited>

<tasks>

<task type="checkpoint:decision" gate="blocking">
  <name>Task 1: G2 bundle-cap decision — raise to 210_000 or dynamic-import PdfPlayer?</name>
  <files>.planning/phases/47-player-bundle/47-VERIFICATION.md (read-only reference)</files>
  <decision>
    Phase 47 closed with a 200KB bundle cap but the actual gzipped total is 204 505 bytes (2.2% over). Phase 47 VERIFICATION.md flagged this as open. The plan carries TWO options forward into Phase 48 for the user to pick between:
  </decision>
  <context>
    - Phase 47-05 SUMMARY: bundle is 204 505 gz / 200 000 cap. The overshoot is driven primarily by the Tailwind CSS layer that DEFECT-1 added in Phase 47 (needed to fix pairing-code font/sizing); without that the 200K target would hold.
    - RESEARCH §10 suggests the planner surface this decision, NOT flip it unilaterally.
    - Both options preserve the intent of SGN-PLY-01 (small, Pi-deployable bundle). Option 1 is a one-line constant change; Option 2 is a day of engineering.
  </context>
  <options>
    <option id="option-a">
      <name>Raise cap to 210_000 bytes (210KB gz)</name>
      <pros>One-line change in `frontend/scripts/check-player-bundle-size.mjs`. Acknowledges the Tailwind fix was necessary. Still well under any meaningful "small bundle" threshold. Consistent with 47-VERIFICATION.md §Bundle Size option 1.</pros>
      <cons>Moves the goalpost. Future phase lands <10KB more and we'd be at the same decision.</cons>
    </option>
    <option id="option-b">
      <name>Keep 200_000 cap; dynamic-import PdfPlayer to shrink the entry chunk</name>
      <pros>Preserves the original SGN-PLY-01 gate. PdfPlayer is the fattest non-vendor chunk; lazy-loading it drops the initial bundle well under 200K. Most players start with image/video items anyway.</pros>
      <cons>Substantive change: touches PlaybackShell.tsx format-handler dispatch, introduces a loading state, needs re-testing of PDF crossfade flow. Probably a new Wave 2/3 plan, not a 1-liner.</cons>
    </option>
    <option id="option-c">
      <name>Defer to v1.17; leave cap at 200K and skip/allowlist this one overshoot</name>
      <pros>Unblocks Phase 48 immediately; treats 204K as acceptable transient state.</pros>
      <cons>Leaves a red CI check in `check-player-bundle-size.mjs` OR requires disabling the guard, which is worse.</cons>
    </option>
  </options>
  <recommendation>
    **Option A (raise cap to 210_000).** Per 47-VERIFICATION.md §Bundle Size option 1 rationale: the Tailwind inclusion is a correctness fix from Phase 47 DEFECT-1, not bloat. 210K is still ~50% of what a naive Vite React bundle would weigh. Dynamic-import-PdfPlayer (Option B) is legitimate but not worth blocking Phase 48 closure for. Defer Option B to a v1.17 performance pass if bundle weight becomes a concern.
  </recommendation>
  <resume-signal>
    Reply with "option-a" (raise to 210_000), "option-b" (dynamic-import PdfPlayer — creates a new plan), or "option-c" (defer, accept 204K as-is).
  </resume-signal>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Apply G2 decision from Task 1</name>
  <files>frontend/scripts/check-player-bundle-size.mjs</files>
  <read_first>
    - User's decision from Task 1 resume-signal
    - frontend/scripts/check-player-bundle-size.mjs (current state — LIMIT constant is currently 200_000)
  </read_first>
  <action>
    Branch on the decision:

    - **If "option-a":** Edit `frontend/scripts/check-player-bundle-size.mjs` changing the `const LIMIT = 200_000;` line to `const LIMIT = 210_000;` and update the header comment to reference this plan's amendment. Re-run the guard:
      ```
      cd frontend && npm run build && node scripts/check-player-bundle-size.mjs
      ```
      Must exit 0.

    - **If "option-b":** Do NOT edit `check-player-bundle-size.mjs`. Instead, record in `48-VERIFICATION.md` that a new follow-up plan (48-06 or v1.17) is required for the PdfPlayer dynamic-import. Skip further work in this task. Flag to the orchestrator that Phase 48 closure is blocked on the follow-up plan unless the cap is also raised temporarily.

    - **If "option-c":** Do NOT edit. Record the acceptance + rationale in `48-VERIFICATION.md`. In this case, re-running `check-player-bundle-size.mjs` still FAILS — so also add a comment at the top of the script noting the knowing-overshoot, AND the plan executor must manually confirm with the orchestrator whether to skip the gate in CI or hard-fail. Default behavior: do NOT disable the gate automatically.
  </action>
  <verify>
    <automated>test -f frontend/scripts/check-player-bundle-size.mjs && grep -E "LIMIT = (200_000|210_000)" frontend/scripts/check-player-bundle-size.mjs</automated>
  </verify>
  <done>
    File state matches the decision. Either LIMIT = 210_000 (option-a), or unchanged with a documented rationale (options b/c). Bundle-size check passes if option-a was chosen.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: Execute E2E walkthrough on real Pi hardware — fill 48-E2E-RESULTS.md</name>
  <files>.planning/phases/48-pi-provisioning-e2e-docs/48-E2E-RESULTS.md</files>
  <what-built>
    - Plan 48-01: `pi-sidecar/sidecar.py` + tests (HTTP cache proxy on the Pi)
    - Plan 48-02: `scripts/provision-pi.sh` + 3 systemd unit templates + `scripts/README-pi.md`
    - Plan 48-03: player-side `postSidecarToken` + D-8 `cache: "no-store"` fix + sidecar-restart re-post
    - Plan 48-04: bilingual admin guide + `docs/operator-runbook.md`
  </what-built>
  <how-to-verify>
    Execute the walkthrough on real Pi hardware following the scaffold in RESEARCH §8. Start by creating `.planning/phases/48-pi-provisioning-e2e-docs/48-E2E-RESULTS.md` with the template from RESEARCH §8 (copy verbatim including the pre-conditions, 5 scenarios, pass/fail summary, defects table, timing buckets).

    **Setup (once):**
    1. Flash fresh Bookworm Lite 64-bit to SD card via Raspberry Pi Imager. Pre-configure Wi-Fi + SSH + non-`pi` username.
    2. SHA256-verify the flashed image.
    3. Boot Pi. SSH in.
    4. `sudo git clone <this repo> /opt/signage`
    5. `sudo SIGNAGE_API_URL=<host:port> /opt/signage/scripts/provision-pi.sh` — expect exit 0 + completion banner.

    **Scenario 1 — Flash → Boot → Pair (SGN-OPS-03):**
    - Record boot-to-pairing-code time (target ≤30s after provision script exits). Fill into results table.

    **Scenario 2 — Admin Claim → Playlist Renders:**
    - From an admin browser tab, open `/signage/pair`, enter the 6-digit code + device name + tag. Record claim-to-first-play time (target ≤5s).

    **Scenario 3 — Wi-Fi Drop → Offline Loop:**
    - `sudo nmcli device disconnect wlan0` (or the actual wireless iface). Watch for 5 minutes. Record: does playback keep looping? `curl http://localhost:8080/health` on the Pi should return `{"online": false, ...}`.

    **Scenario 4 — Reconnect → Admin Change Arrives:**
    - `sudo nmcli device connect wlan0`. Make a change in admin (e.g., add a new item). Record change-to-display time on the Pi (target ≤30s).

    **Scenario 5 — Sidecar Restart Resilience:**
    - `sudo -u signage XDG_RUNTIME_DIR=/run/user/$(id -u signage) systemctl --user restart signage-sidecar`
    - Verify playback continues uninterrupted, /health returns online within 60s (confirms Plan 48-03's re-post path).

    **Security gate (SGN-OPS-03 success 4):**
    - `sudo -u signage journalctl --user -u signage-player | grep -E "no-sandbox|Running as root"` — MUST return no matches.
    - `ps -u signage -f | grep chromium-browser` — confirms kiosk runs as `signage`, not root.

    **Record defects:** any step that fails populates the Defects table in the results file with severity + suggested fix. Critical defects (Scenario 1/2 outright fail) block Phase 48 closure and trigger a gap-closure plan via `/gsd:plan-phase 48 --gaps`.

    Fill every timing bucket. Commit the results file.
  </how-to-verify>
  <resume-signal>
    Reply with "walkthrough-complete" after the 5 scenarios + security gate are all recorded in 48-E2E-RESULTS.md and the file is committed. OR "blocked: <scenario#>" with a description of the failure so the orchestrator can route to gap closure.
  </resume-signal>
  <done>
    `48-E2E-RESULTS.md` exists, all 5 scenarios have actual-vs-expected entries filled, timing buckets populated, defects table populated (empty is fine), pass/fail summary signed.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Write 48-VERIFICATION.md — Phase 48 closeout, amendments, carry-forwards</name>
  <files>.planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md</files>
  <read_first>
    - .planning/phases/48-pi-provisioning-e2e-docs/48-E2E-RESULTS.md (just-written; pass/fail + timing data)
    - .planning/REQUIREMENTS.md SGN-OPS-01..03 (original wording)
    - .planning/phases/47-player-bundle/47-VERIFICATION.md (carry-forward context)
    - 47-05 SUMMARY (G2 context)
    - User's decision from Task 1
  </read_first>
  <action>
    Create `.planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md` following the 47-VERIFICATION.md shape. Required sections:

    **1. Summary** — Phase 48 closes SGN-OPS-01, SGN-OPS-02, SGN-OPS-03. Three amendments captured below. Carry-forwards from Phase 47 (D-7, D-8, G2, SGN-PLY-05) resolved.

    **2. Requirement Amendments Table** — at least three rows:

    | Requirement | Original wording | Amendment | Rationale |
    |---|---|---|---|
    | SGN-OPS-01 | `frontend/src/docs/admin/digital-signage.{en,de}.md` | **Path corrected** to `frontend/src/docs/{en,de}/admin-guide/digital-signage.md` | CONTEXT.md D-5 + RESEARCH §9 — the admin guide follows the established in-app docs convention (`en/admin-guide/…` / `de/admin-guide/…`), matching sensor-monitor.md, personio.md, etc. The original REQUIREMENTS.md path is a typo; the intent (bilingual admin guide covering signage) is preserved. |
    | SGN-PLY-05 (carried from Phase 47) | "Heartbeat every 60s from the player JS" | **Ownership moved to Pi sidecar** (Plan 48-01 heartbeat background task) | Phase 47 VERIFICATION.md deferred. Browser tabs throttle setInterval when backgrounded; sidecar is the reliable liveness source. |
    | SGN-PLY-08/09 (carried from Phase 47) | (see 47-VERIFICATION.md) | Re-affirmed: **SW caches playlist METADATA only; media caching is the sidecar's job** | Now operational — Plan 48-01 ships the sidecar. Closes the architectural contract. |

    **3. Verification Matrix** — one row per SGN-OPS-01/02/03, linking to artifacts:

    | Req | Plan | Verified by |
    |---|---|---|
    | SGN-OPS-01 | 48-04 | `frontend/src/docs/en/admin-guide/digital-signage.md` + DE counterpart exist; TOC matches RESEARCH §9 |
    | SGN-OPS-02 | 48-04 | `registry.ts`/`toc.ts` updated; `docs.nav.adminDigitalSignage` in both locales; i18n parity green |
    | SGN-OPS-03 | 48-02 + 48-04 | Systemd units match RESEARCH §4 verbatim; `provision-pi.sh` creates non-root `signage` user; `docs/operator-runbook.md` documents image, flag set, units, user, fallback; E2E walkthrough (Scenario 1, security gate) confirms no `--no-sandbox` and no "Running as root" |

    **4. E2E Walkthrough Summary** — 2-3 lines summarizing `48-E2E-RESULTS.md` findings. Link out. Call out any scenario that failed + link to gap-closure plan if one was created.

    **5. Phase 47 Carry-forward Closeouts** — update status:

    | Defect | Status | Resolved by | Notes |
    |---|---|---|---|
    | D-7 (SW scope) | RESOLVED | Plan 48-01 (sidecar) | Runtime caching moved off SW onto sidecar; SW stays precache-only at `/player/` scope |
    | D-8 (fetch HTTP cache) | RESOLVED | Plan 48-03 Task 1 | `cache: "no-store"` added to `playerFetch` |
    | G2 (bundle 204 505 / 200 000) | {RESOLVED if option-a; DEFERRED if b/c} | Plan 48-05 Task 2 | See decision log below |

    **6. G2 Decision Log** — record the Task 1 decision verbatim: which option was chosen, why, and what the new state is (LIMIT = 210_000 OR unchanged + follow-up).

    **7. Open Items / Follow-ups** — any defects surfaced during E2E walkthrough that are NOT critical and are deferred to v1.17 or a later polish phase.

    **8. Sign-off** — date, reviewer line, Phase 48 closable state (yes/no based on E2E results + verification matrix green).

    Replace placeholders with actual data from the E2E walkthrough.
  </action>
  <verify>
    <automated>test -f .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md && grep -q "SGN-OPS-01" .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md && grep -q "admin-guide/digital-signage" .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md && grep -q "D-7" .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md && grep -q "D-8" .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md && grep -q "G2" .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md && grep -q "SGN-PLY-05" .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md && grep -q "E2E" .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md</automated>
  </verify>
  <done>
    `48-VERIFICATION.md` contains all 8 sections. Amendments table has the 3 required rows. Verification matrix cross-references artifacts from Plans 48-01..04. Carry-forward closeouts reflect current resolution state. G2 decision recorded. Sign-off line present.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: Phase 48 sign-off — review all docs + close milestone</name>
  <files>.planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md, .planning/phases/48-pi-provisioning-e2e-docs/48-E2E-RESULTS.md</files>
  <what-built>
    - Full v1.16 Digital Signage Pi-deployable stack: sidecar + provision script + bilingual admin guide + operator runbook + E2E walkthrough
    - Phase 47 carry-forwards resolved: D-7, D-8 closed; G2 decision logged; SGN-PLY-05 ownership confirmed at Pi sidecar
  </what-built>
  <how-to-verify>
    Review:
    1. `48-E2E-RESULTS.md` — all 5 scenarios recorded. Any critical defects must be either resolved (via `/gsd:plan-phase 48 --gaps`) or explicitly accepted as v1.17 follow-ups.
    2. `48-VERIFICATION.md` — amendments + matrix + G2 decision + sign-off all present.
    3. `47-VERIFICATION.md` — Carry-forward Closeouts section (added by Plan 48-03) now accurate.
    4. `docs/operator-runbook.md` — SGN-OPS-03 Chromium flag set verbatim.
    5. Both admin-guide markdown files — DE tone check (`grep -E "Sie |Ihre |Ihr |Ihnen" frontend/src/docs/de/admin-guide/digital-signage.md` returns empty).

    If all four items are clean, v1.16 Digital Signage is shippable.
  </how-to-verify>
  <resume-signal>
    Reply with "approved — ship v1.16" to close Phase 48 and mark the milestone complete, OR list specific remediation items.
  </resume-signal>
  <done>
    User approval recorded. Phase 48 SUMMARY notes the sign-off. Roadmap Progress Table updated by the execute-phase workflow.
  </done>
</task>

</tasks>

<verification>
- G2 decision made at checkpoint (Task 1).
- Bundle-size script updated iff option-a (Task 2).
- `48-E2E-RESULTS.md` exists with 5 scenarios filled + security gate pass/fail (Task 3).
- `48-VERIFICATION.md` exists with 8 sections; amendments + matrix + carry-forward closeouts correct (Task 4).
- User approval on Phase 48 closure (Task 5).
</verification>

<success_criteria>
- SGN-OPS-01, SGN-OPS-02, SGN-OPS-03 all verified in the matrix.
- Phase 47 carry-forwards (D-7, D-8) marked RESOLVED; G2 has a definitive decision.
- Real-hardware E2E evidence on disk (not just "it should work").
- v1.16 Digital Signage milestone ready to flip to SHIPPED in ROADMAP.md.
</success_criteria>

<output>
After completion, create `.planning/phases/48-pi-provisioning-e2e-docs/48-05-SUMMARY.md` recording:
- E2E walkthrough outcome per scenario (link to 48-E2E-RESULTS.md)
- G2 decision + resulting state
- Phase 48 closable: yes/no + reasoning
- If yes: ready for ROADMAP milestone flip (v1.16 SHIPPED)
- If no: list of unresolved blockers + recommended next step (gap-closure plan, follow-up plan, or scope deferral)
</output>

<files_to_read>
- .planning/phases/48-pi-provisioning-e2e-docs/48-CONTEXT.md
- .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md
- .planning/phases/47-player-bundle/47-VERIFICATION.md
- .planning/phases/47-player-bundle/47-05-ci-guards-bundle-size-and-uat-SUMMARY.md
- .planning/REQUIREMENTS.md
- .planning/ROADMAP.md
- scripts/provision-pi.sh
- scripts/README-pi.md
- scripts/systemd/signage-sidecar.service
- scripts/systemd/signage-player.service
- scripts/systemd/labwc.service
- pi-sidecar/sidecar.py
- pi-sidecar/README.md
- docs/operator-runbook.md
- frontend/src/docs/en/admin-guide/digital-signage.md
- frontend/src/docs/de/admin-guide/digital-signage.md
- frontend/scripts/check-player-bundle-size.mjs
</files_to_read>
