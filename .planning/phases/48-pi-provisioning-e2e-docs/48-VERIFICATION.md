---
phase: 48-pi-provisioning-e2e-docs
requirements_verified: [SGN-OPS-01, SGN-OPS-02, SGN-OPS-03]
carry_forwards_closed: [47-D-7, 47-D-8, 47-G2, 47-SGN-PLY-05]
created: 2026-04-20
status: partial — hardware walkthrough pending
---

# Phase 48 Verification

Consolidates the verification state for the final phase of v1.16 Digital Signage. Closes out Phase 47 carry-forward items and records the requirement amendments discovered during research and execution.

## Requirement verification

| ID | Status | Evidence |
|----|--------|----------|
| SGN-OPS-01 | **VERIFIED (code)** pending hardware walkthrough | `frontend/src/docs/en/admin-guide/digital-signage.md` + `frontend/src/docs/de/admin-guide/digital-signage.md` created by Plan 48-04. Coverage: Pi onboarding, media upload, playlist building, offline behavior, PPTX font-embed best practice. Full hardware validation: Scenario 1–5 in `48-E2E-RESULTS.md` after operator runs the walkthrough. |
| SGN-OPS-02 | **VERIFIED** | Both locales' docs-index registries updated in `frontend/src/lib/docs/registry.ts` with `digital-signage` entries; new i18n key `docs.nav.adminDigitalSignage` added to `en.json` and `de.json`. Plan 48-04. |
| SGN-OPS-03 | **VERIFIED (code)** pending hardware walkthrough | `scripts/provision-pi.sh` + three systemd unit templates in `scripts/systemd/` (verbatim from RESEARCH §4) + `docs/operator-runbook.md` + `scripts/README-pi.md`. Hardware confirmation is 48-E2E-RESULTS Scenarios 1–5 + security checks. |

## Requirement amendments

### SGN-OPS-01 docs-path amendment

**Original text (REQUIREMENTS.md line 76):**

> `frontend/src/docs/admin/digital-signage.en.md` + `frontend/src/docs/admin/digital-signage.de.md`

**Actual path used (CONTEXT D-5):**

> `frontend/src/docs/en/admin-guide/digital-signage.md` + `frontend/src/docs/de/admin-guide/digital-signage.md`

**Reason:** Existing repo convention filed every admin-guide doc under `frontend/src/docs/{en,de}/admin-guide/*.md` (personio, sensor-monitor, architecture, system-setup, user-management). Following the literal text in the requirement would have created a new sibling tree and required touching the five existing docs to stay consistent — much larger surface than intended. The requirement's intent ("bilingual admin guide covering signage") is preserved; only the path string is corrected.

Amendment agreed at `/gsd:discuss-phase 48` on 2026-04-20.

### SGN-PLY-05 ownership (Phase 47 → Phase 48)

Phase 47-VERIFICATION.md deferred the heartbeat-to-sidecar invariant to Phase 48. The sidecar shipped in Plan 48-01 includes a background `_heartbeat_loop` task (60 s cadence, skips when offline). The heartbeat invariant is therefore owned by the sidecar, not the kiosk browser. Phase 47's deferral is now closed.

## Phase 47 carry-forward closeouts

### D-7 — SW scope cannot intercept `/api/signage/player/*`

**Status: RESOLVED as a consequence of Phase 48.**

- Runtime caching of `/api/signage/player/playlist` moved off the service worker onto the Pi sidecar (Plan 48-01's `GET /api/signage/player/playlist` proxy with deterministic ETag).
- The service worker stays precache-only at `/player/` scope — no re-registration to `/` with `Service-Worker-Allowed` was required.
- 47-VERIFICATION.md was updated in Plan 48-03 (commit `85ebf8a`) with the closeout note.

### D-8 — `playerFetch` returned stale HTTP-cached bodies

**Status: RESOLVED in Plan 48-03.**

- `frontend/src/player/lib/playerApi.ts` now passes `cache: "no-store"` on every `fetch()` call inside `playerFetch`.
- 47-VERIFICATION.md was updated in Plan 48-03 with the closeout note.

### G2 — bundle cap overshoot (204 505 / 200 000 gz)

**Status: RESOLVED via cap raise (Option A per `47-VERIFICATION.md §Bundle Size`).**

- User decision at 48-05 Task 1 checkpoint on 2026-04-20: raise `LIMIT` in `frontend/scripts/check-player-bundle-size.mjs` from 200 000 to 210 000.
- Rationale: the Tailwind layer added by Phase 47 DEFECT-1 is a correctness fix (pairing-code font/sizing), not bloat. 210 K is still roughly half a naive React+Vite production bundle.
- Follow-up (v1.17 polish): dynamic-import `PdfPlayer` to shrink the initial chunk if bundle weight becomes material again.
- Commit: _pending — rolled into 48-05 commit_.

## Security checks — SGN-OPS-03 success criterion 4

| Check | Owner | Status |
|-------|-------|--------|
| Chromium flag set does NOT include `--no-sandbox` | `scripts/systemd/signage-player.service` (verbatim from RESEARCH §4.2) | **VERIFIED (code)** — grep of the unit file; hardware confirmation is 48-E2E-RESULTS |
| Chromium runs as `signage` user, not root | `provision-pi.sh` creates `signage`, systemd unit runs as that user | **VERIFIED (code)** — hardware confirmation is 48-E2E-RESULTS |
| Sidecar binds `127.0.0.1:8080` only | `pi-sidecar/sidecar.py` uvicorn `host="127.0.0.1"` | **VERIFIED (code + unit test)** — Plan 48-01 test `test_sidecar.py::test_binds_localhost_only` |

## Hard gates (v1.16 cross-cutting hazards)

| # | Gate | Phase 48 status |
|---|------|-----------------|
| 1 | DE/EN i18n parity | PASS — `check-i18n-parity.mjs` ran clean after Plan 48-04 (both `adminDigitalSignage` keys added) |
| 2 | apiClient-only in admin | N/A — no admin signage code changed |
| 3 | No `dark:` Tailwind variants | PASS — Plan 48-04 is Markdown docs + registry.ts only |
| 4 | `--workers 1` invariant | N/A — no backend process changes |
| 5 | Router-level admin gate | N/A |
| 6 | No `import sqlite3` / `psycopg2` | PASS — sidecar uses the filesystem, not a DB |
| 7 | No sync `subprocess.run` in signage services | N/A — no new subprocess call paths |

## Outstanding items before phase closure

- [ ] Operator runs the 5-scenario hardware walkthrough and fills `48-E2E-RESULTS.md`.
- [ ] Security checks (this doc's "Security checks" table) pass on the real Pi — confirmed via the commands in `48-E2E-RESULTS.md` §"Security checks".
- [ ] Operator signs off at the bottom of `48-E2E-RESULTS.md`.
- [ ] Plan 48-05 SUMMARY.md written; STATE.md + ROADMAP.md updated; milestone v1.16 marked ready for `/gsd:complete-milestone`.

## Deferred (not phase closure blockers)

- Dynamic-import PdfPlayer for a tighter bundle (v1.17 polish).
- Multi-Pi fleet orchestration (a v1.17 milestone candidate if fleet size grows).
- QEMU-driven CI for the E2E walkthrough (revisit if hardware E2E becomes a flake source).
