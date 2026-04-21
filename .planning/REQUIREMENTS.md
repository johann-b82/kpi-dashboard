# Requirements: v1.18 Pi Polish + Scheduling

**Milestone:** v1.18
**Status:** Active
**Created:** 2026-04-21
**Core Value:** Close v1.17's operator carry-forwards (hardware E2E Scenarios 4 + 5; shrink the player bundle back under 200 KB gz), then add time-based playlist scheduling so admins can run "Menu A 07:00–11:00, Menu B 11:00–14:00, Weekend menu 10:00–16:00 Sat/Sun" without touching the device.

**Inherits from:** v1.17 (installer library, sidecar). v1.16 (signage schema, player, admin UI). The `pi-image/` custom image-build path was retired in v1.18 — the sole Pi provisioning path is `scripts/provision-pi.sh` on fresh Raspberry Pi OS Bookworm Lite 64-bit.

**Locked defaults (2026-04-21):**
- Schedule model: **day-of-week mask + time-of-day window** (weekday_mask `0bMoTuWeThFrSaSu` + start_hhmm + end_hhmm + priority + enabled). Not iCal RRULE; not date-specific overrides.
- Analytics: **heartbeat + last-seen only** (no per-item playtime tracking this milestone).
- Per-device calibration: **deferred to v1.19.**
- Pi provisioning: **`scripts/provision-pi.sh` on fresh Raspberry Pi OS Bookworm Lite 64-bit** — single path, no custom `.img.xz`.

---

## Active Requirements

### Polish — close v1.17 carry-forwards (SGN-POL-*)

> **Scope change 2026-04-21:** The custom `.img.xz` distribution pipeline was retired — the Pi player ships via `scripts/provision-pi.sh` on fresh Raspberry Pi OS only. SGN-POL-01 (minisign key ceremony), SGN-POL-02 (arm64 runner), SGN-POL-03 (tag-triggered signed-image release), and SGN-POL-06 (image↔provision byte-diff test) were removed together with the `pi-image/` directory and `.github/workflows/pi-image.yml`.

- [ ] **SGN-POL-04**: Real-hardware E2E **Scenario 4** (reconnect → admin mutation arrives within 30 s) and **Scenario 5** (sidecar systemd restart resilience) run on a Pi provisioned via `scripts/provision-pi.sh` on fresh Raspberry Pi OS Bookworm Lite 64-bit; results recorded in `.planning/phases/50-pi-polish/50-E2E-RESULTS.md` with numerical timings. Supersedes the Phase 49 carry-forward.
- [x] **SGN-POL-05**: `PdfPlayer` + `react-pdf` dynamic-imported in the player bundle so the entry chunk drops under 200 KB gz. `frontend/scripts/check-player-bundle-size.mjs` `LIMIT` reset from 210 000 back to 200 000. Build passes.

### Schedule schema + resolver (SGN-TIME-*)

- [ ] **SGN-TIME-01**: Alembic migration creates `signage_schedules` with columns: `id UUID PK`, `playlist_id UUID FK RESTRICT`, `weekday_mask SMALLINT NOT NULL CHECK (weekday_mask BETWEEN 0 AND 127)` (7-bit mask, bit 0 = Monday), `start_hhmm INTEGER NOT NULL CHECK (0 <= start_hhmm <= 2359)`, `end_hhmm INTEGER NOT NULL CHECK (0 <= end_hhmm <= 2359)`, `priority INTEGER NOT NULL DEFAULT 0`, `enabled BOOLEAN NOT NULL DEFAULT true`, `created_at`, `updated_at`. CHECK constraint `start_hhmm < end_hhmm` (no midnight-spanning ranges in v1.18 — a row that crosses midnight must be split into two). Round-trip upgrade/downgrade clean.
- [ ] **SGN-TIME-02**: Resolver gains time-window awareness. For a device at query time: look up all schedules whose `weekday_mask` matches `now.weekday()`, `start_hhmm <= now.hhmm < end_hhmm`, `enabled = true`, and whose `playlist.tag_ids` overlap the device's tag set. Pick the highest `(priority DESC, updated_at DESC)`. If no schedule matches, fall back to the existing always-on tag-based resolution. Pure-read (D-10). Timezone from app settings (`app_settings.timezone`, defaulting to `Europe/Berlin`).
- [ ] **SGN-TIME-03**: Resolver integration tests: schedule-match (single), priority tiebreak (two overlapping), weekday-miss, time-miss, disabled-schedule-skip, tag-mismatch-skip, empty-schedules-falls-back-to-tag-resolver.
- [ ] **SGN-TIME-04**: Schedule mutations fire `notify_device` SSE fanout (same contract as playlist mutations). Players re-resolve within ≤ 2 s of a schedule save that affects them.

### Schedule admin UI (SGN-SCHED-UI-*)

- [ ] **SGN-SCHED-UI-01**: New "Schedules" tab on `/signage` (4th tab; `SegmentedControl` same pattern as Media / Playlists / Devices). Admin-only (`AdminOnly` wrapper). Lists all schedules with columns: playlist name, days, time window, priority, enabled toggle, actions (edit / delete).
- [ ] **SGN-SCHED-UI-02**: Schedule editor form: playlist picker (required), weekday checkbox row Mo Di Mi Do Fr Sa So, two `HH:MM` time inputs (required, start < end), priority integer input (default 0), enabled toggle (default true). Submits via `apiClient` (hard gate 2 — no raw `fetch`).
- [ ] **SGN-SCHED-UI-03**: Admin guide updated. Both `frontend/src/docs/en/admin-guide/digital-signage.md` and `frontend/src/docs/de/admin-guide/digital-signage.md` get a new §"Zeitpläne" / §"Schedules" section. Hard gate 1 DE/EN parity CI green.
- [ ] **SGN-SCHED-UI-04**: Signage invariants CI script covers the new tab/components — no `dark:` variants (hazard 3), apiClient-only (hazard 2), no direct DB imports, etc.

### Analytics-lite (SGN-ANA-*)

- [ ] **SGN-ANA-01**: Devices admin table gains two badges per row computed server-side from `signage_devices.last_seen_at` and `signage_heartbeat` log: "Uptime 24h %" (percentage of 60-second windows in the last 24 h with a heartbeat recorded) and "Heartbeats missed" (count of 60-second windows without a heartbeat in the last 24 h, excluding windows where the device was revoked). Admin-only. Refresh on tab visibility + 30 s polling. No new database tables.

---

## Success Criteria (milestone-level)

1. Operator provisions a fresh Pi via `scripts/provision-pi.sh` on Bookworm Lite 64-bit, boots, and runs E2E Scenarios 4 + 5 to completion with recorded timings. (SGN-POL-04)
2. Player bundle back under 200 KB gz. (SGN-POL-05)
3. Admin creates a schedule "Mo–Fr 07:00–11:00 → Playlist X (priority 10)" AND "Mo–So 11:00–14:00 → Playlist Y (priority 5)". At 08:30 on a Wednesday the device resolves Playlist X; at 12:00 it resolves Playlist Y; at 15:00 with no matching schedule it falls back to the device's always-on tag playlist. (SGN-TIME-01, 02, 03)
4. Scheduling changes propagate to connected players within 2 s via SSE. (SGN-TIME-04)
5. Devices table shows non-zero uptime numbers for at least one active device under observation. (SGN-ANA-01)

## Hard gates carried forward from v1.16/v1.17

1. DE/EN i18n parity — Schedule tab i18n keys land in both `en.json` and `de.json` with informal "du" tone. CI gate green.
2. apiClient-only in admin frontend — Schedule CRUD uses shared `apiClient`.
3. No `dark:` Tailwind variants.
4. `--workers 1` invariant preserved in docker-compose and scheduler.
5. Router-level admin gate via `APIRouter(prefix="/api/signage", dependencies=[…])` — Schedule routes inherit.
6. No `import sqlite3` / no `import psycopg2`.
7. No sync `subprocess.run` in signage services.

## Amendments anticipated (resolve during planning)

- Resolver timezone source: `app_settings.timezone` column exists? If not, add default `Europe/Berlin` + optional per-device override.
- `signage_schedules.end_hhmm` CHECK semantics: exclusive upper bound so two schedules can boundary-touch without overlap (11:00 end + 11:00 start).
- Midnight-spanning ranges (22:00–02:00) must be split into two rows by admin UI. Surface as a validation rule on the form.
