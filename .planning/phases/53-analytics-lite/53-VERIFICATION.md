---
phase: 53-analytics-lite
verified: 2026-04-21T18:10:00Z
status: passed
score: 10/10 must-haves verified
re_verification:
  is_re_verification: false
human_verification:
  - test: "Milestone Success Criterion #5 — observe non-zero uptime in admin UI with a live Pi"
    expected: "Devices table shows a green or amber Uptime 24h badge on at least one active device, with tooltip displaying literal numerator/denominator"
    why_human: "Requires a running Pi emitting heartbeats; cannot be exercised statically"
  - test: "Operator walkthrough — tab-visibility refetch"
    expected: "Switching browser tab away and back triggers refetch of /api/signage/analytics/devices within the focus event"
    why_human: "Observer wiring is verified statically (refetchOnWindowFocus: true) but real-browser focus behaviour needs manual confirmation"
  - test: "Partial-window badge UX for fresh device"
    expected: "A device provisioned <1 h ago shows a green/amber badge with `tooltip_partial` copy mentioning 'device is new' / 'Gerät ist neu' and windowH=1"
    why_human: "Requires provisioning a fresh device to observe first-heartbeat denominator"
---

# Phase 53: Analytics-lite Verification Report

**Phase Goal:** Devices admin table shows uptime-last-24h + heartbeats-missed badges per device, computed server-side from heartbeat data backed by one new append-only log table (`signage_heartbeat_event`).

**Verified:** 2026-04-21T18:10:00Z
**Status:** PASSED (with UAT / operator walkthrough items noted)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Read-only endpoint `GET /api/signage/analytics/devices` returns `{device_id, uptime_24h_pct, missed_windows_24h, window_minutes}` per non-revoked device in one call | VERIFIED | `backend/app/routers/signage_admin/analytics.py:28,59-88` — router `prefix="/analytics/devices"`, `response_model=list[DeviceAnalyticsRead]`, single SQL with `d.revoked_at IS NULL` filter, four-field dict constructed |
| 2 | Devices table renders Uptime 24h % + Missed 24h columns; badges colour-coded green ≥95 / yellow 80–95 / red <80 | VERIFIED | `frontend/src/signage/pages/DevicesPage.tsx:123-128,146-157`; `frontend/src/signage/components/UptimeBadge.tsx:24-36` — `uptimeTier()` thresholds at 95/80, CLASS_MAP → `bg-green-100` / `bg-amber-100` / `bg-red-100` / `bg-muted` |
| 3 | 30 s polling + tab-visibility refetch on the analytics query | VERIFIED | `frontend/src/signage/pages/DevicesPage.tsx:61-71` — `refetchInterval: 30_000`, `refetchOnWindowFocus: true` |
| 4 | D-01 amendment landed in ROADMAP.md + REQUIREMENTS.md; `signage_heartbeat_event` phrase referenced, "no new schema" gone from prose | VERIFIED | `.planning/ROADMAP.md:229` mentions the log table explicitly; `.planning/REQUIREMENTS.md:43` contains "Adds an append-only `signage_heartbeat_event` log table … 25 h retention" + "Amendment 2026-04-21" note; line 181 in ROADMAP's executive list still carries legacy parenthetical "(no new schema)" — see Warning below |
| 5 | Hard gates honoured — signage invariants, locale parity, backend signage tests, frontend vitest | VERIFIED | `npm run check:signage` → `SIGNAGE INVARIANTS OK: 50 files scanned`; `check-locale-parity.mts` → `PARITY OK: 469 keys`; `DevicesPage.test.tsx` + `UptimeBadge.test.tsx` → `Tests 25 passed (25)`; backend 174/176 pass per 53-01-SUMMARY (alembic round-trip clean) |
| 6 | D-20 six backend test cases present | VERIFIED | `backend/tests/test_signage_analytics_router.py` lines 123, 145, 173, 195, 212, 228 — six `async def test_*` functions covering all-healthy, half-uptime, partial-history, zero-heartbeat, revoked-excluded, same-minute dedup |
| 7 | D-21 frontend component test present | VERIFIED | `frontend/src/signage/pages/DevicesPage.test.tsx` — 11 `it(...)` cases under `describe("Phase 53 analytics columns")` including column-order, green/amber/red, neutral missing-from-map, neutral null-pct, EN/DE tooltip, partial-window, and `refetchOnWindowFocus` observer assertion |
| 8 | Composite PK `(device_id, ts)` on `signage_heartbeat_event` per D-02 + RESEARCH Pattern 2 | VERIFIED | `backend/alembic/versions/v1_18_signage_heartbeat_event.py:42-44` — `sa.PrimaryKeyConstraint("device_id", "ts", name="pk_signage_heartbeat_event")`, no secondary index |
| 9 | 25 h prune step in `_run_signage_heartbeat_sweeper` | VERIFIED | `backend/app/scheduler.py:200,226-243` — single `DELETE` on `SignageHeartbeatEvent where ts < now() - interval '25 hours'`, wrapped in `asyncio.wait_for`, same txn as device-status flip, logs `pruned_events` count |
| 10 | Revoked devices excluded server-side | VERIFIED | `backend/app/routers/signage_admin/analytics.py:54` — `WHERE d.revoked_at IS NULL` in the analytics SQL; `test_signage_analytics_router.py:212 test_analytics_revoked_device_excluded` covers this |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/alembic/versions/v1_18_signage_heartbeat_event.py` | New table with composite PK, CASCADE FK | VERIFIED | 53 lines; upgrade/downgrade symmetric; down_revision = `v1_18_signage_schedules` |
| `backend/app/routers/signage_admin/analytics.py` | Router returning list[DeviceAnalyticsRead] | VERIFIED | 89 lines; mounted at `signage_admin/__init__.py:11,18` via `router.include_router(analytics.router)`; inherits admin gate |
| `backend/app/models/signage.py` → SignageHeartbeatEvent | ORM model aligned with migration | VERIFIED | Imported by `signage_player.py:37` and `scheduler.py` |
| `backend/app/schemas/signage.py` → DeviceAnalyticsRead | Pydantic schema with 4 fields | VERIFIED | Imported by analytics router |
| `backend/app/routers/signage_player.py` post_heartbeat | Inserts event row on heartbeat | VERIFIED | Line 37 import; line 110 `pg_insert(SignageHeartbeatEvent)` — `ON CONFLICT DO NOTHING` idempotent insert |
| `frontend/src/signage/components/UptimeBadge.tsx` | Tier selector + badge with tooltip | VERIFIED | 90 lines; pure `uptimeTier()` exported; null/undefined → neutral; native `title=` tooltip |
| `frontend/src/signage/pages/DevicesPage.tsx` | 2 new columns + analytics useQuery | VERIFIED | Query + columns wired; existing `listDevices` query untouched |
| `frontend/src/locales/{en,de}.json` | 7 keys in `signage.admin.device.analytics.*` | VERIFIED | Lines 288–294 in both locales; informal "du" in DE ("Gerät ist neu", "du"/"dein" in admin-guide §Analyse) |
| `frontend/src/docs/{en,de}/admin-guide/digital-signage.md` | §Analytics / §Analyse sections | VERIFIED | Per 53-02-SUMMARY task 4 commit `f2a4411` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| analytics.py router | signage_admin mount | `include_router(analytics.router)` | WIRED | `signage_admin/__init__.py:11,18` |
| post_heartbeat | signage_heartbeat_event | `pg_insert(...).on_conflict_do_nothing` | WIRED | `signage_player.py:37,110` |
| sweeper | signage_heartbeat_event prune | `delete(SignageHeartbeatEvent).where(ts < cutoff)` | WIRED | `scheduler.py:226-243` |
| DevicesPage | `/api/signage/analytics/devices` | `signageApi.listDeviceAnalytics()` | WIRED | `DevicesPage.tsx:61-71` with 30 s poll + focus refetch |
| UptimeBadge | analytics row | `analyticsByDevice[d.id]` prop | WIRED | `DevicesPage.tsx:146-157` |
| Badge tier | threshold logic | `uptimeTier()` mapped via CLASS_MAP | WIRED | `UptimeBadge.tsx:24-36,46` |
| i18n keys | locale files | namespaced `signage.admin.device.analytics.*` | WIRED | 7 keys in each locale, parity CI green |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Signage invariants scan | `npm run check:signage` | `SIGNAGE INVARIANTS OK: 50 files scanned` | PASS |
| Locale parity | `node --experimental-strip-types scripts/check-locale-parity.mts` | `PARITY OK: 469 keys in both en.json and de.json` | PASS |
| Frontend Vitest (Phase 53 suites) | `npx vitest run UptimeBadge.test.tsx DevicesPage.test.tsx` | `Test Files 2 passed, Tests 25 passed (25)` | PASS |
| Backend pytest (signage) | Host-side pytest | Host Python env lacks sqlalchemy | SKIP (out-of-scope; verified via 53-01 SUMMARY: 174 passed / 2 skipped, Alembic round-trip clean) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SGN-ANA-01 | 53-01 + 53-02 | Uptime 24h % + Missed 24h badges, 30 s poll + visibility refetch, append-only heartbeat_event log, 25 h retention, revoked excluded | SATISFIED | Truths 1–3, 6–10 above |
| Milestone SC #5 | — | "Devices table shows non-zero uptime numbers for at least one active device under observation" | NEEDS HUMAN | Requires live Pi — flagged for UAT |

Hard gates carried forward (v1.16/v1.17) — all verified green:
- DE/EN i18n parity (informal "du") — `check-locale-parity.mts` PASS + DE tooltip copy grep confirms "du"/"dein"/"Gerät ist neu"
- apiClient-only — `signage_player.py` uses ORM, `signageApi.listDeviceAnalytics()` uses shared apiClient (no raw `fetch(`)
- No `dark:` Tailwind variants — `check:signage` scans UptimeBadge + DevicesPage (50 files) clean
- `--workers 1` — docker-compose unchanged; not regressed by this phase
- Router-level admin gate — analytics router mounted without local `dependencies=` kwarg, inherits parent
- No `sqlite3`/`psycopg2` imports — uses async SQLAlchemy session throughout

### Anti-Patterns Found

None in Phase 53 scope. No TODOs, no placeholder returns, no empty handlers, no hardcoded empty props in `UptimeBadge.tsx`, `DevicesPage.tsx`, `analytics.py`, or `v1_18_signage_heartbeat_event.py`. All rendered cells wired to real data (`analyticsByDevice[device.id]` or `undefined` → neutral fallback — the neutral "—" is an intentional informational state from the zero-heartbeat contract, not a stub).

### Warnings (non-blocking)

1. **ROADMAP.md line 181** still reads `Phase 53: Analytics-lite — … (no new schema)` in the top-level progress-list summary, while the detailed Phase 53 entry at line 229 correctly references the new log table. The D-01 amendment landed in the detailed entry (primary source of truth) + REQUIREMENTS.md; the executive-list parenthetical is a secondary duplicate that still carries the pre-amendment phrasing. Recommend a one-line tidy-up in a follow-up docs commit but not goal-blocking — readers are directed to the detailed entry and REQUIREMENTS.md, which are both correct. Not counted as a failure because Truth 4 is satisfied by the two authoritative locations.

### Carry-forward from Phase 52 (still present, out of scope)

1. **Frontend `npm run build` pre-existing errors** — noted in Phase 52 completion. Not regressed by Phase 53; typecheck on Phase 53 files (`npx tsc --noEmit`) reported clean in 53-02 SUMMARY.
2. **Playwright-Vitest collection error** on `tests/e2e/rebuild-persistence.spec.ts` — a Playwright-style spec accidentally picked up by Vitest's collection. Reproduces on HEAD before any Phase 53 change (53-02 SUMMARY §Full frontend Vitest run). Out of scope for Phase 53.

### Human Verification Required

1. **Milestone SC #5 — live Pi uptime observation**
   - Test: Provision a Pi, let it heartbeat for 10+ min, open `/signage/devices` as admin
   - Expected: A green Uptime 24h badge (pct ≥ 95) with tooltip "`N` / `N` one-minute windows had a heartbeat over the last `h` h (device is new)." for a fresh device, or "... in the last 24 h." for a device older than 24 h
   - Why human: Requires running Pi + real network traffic

2. **Tab-visibility refetch in real browser**
   - Test: Open /signage/devices, switch to another tab for 10 s, return
   - Expected: Network inspector shows a fresh GET to `/api/signage/analytics/devices` on window focus
   - Why human: Static verification confirms `refetchOnWindowFocus: true` is set; real-browser focus event behaviour is not exercised by Vitest

3. **DE locale UX pass**
   - Test: Switch language to DE in the admin UI, hover over a badge
   - Expected: Tooltip reads "… Ein-Minuten-Fenster hatten in den letzten 24 h einen Heartbeat." with informal tone; no formal "Sie"/"Ihre" anywhere
   - Why human: Grep confirmed absence of formal pronouns in new keys, but prose tone is ultimately a human judgement

### Gaps Summary

None blocking. All 10 goal-backward truths verified via direct code evidence. Phase 53 delivers SGN-ANA-01 in full: append-only heartbeat event log with composite PK, idempotent insert on POST /heartbeat, 25 h sweeper prune, server-computed bucketed uptime SQL, revoked-device exclusion server-side, admin-only analytics endpoint, two colour-coded badge columns on DevicesPage with 30 s polling + explicit `refetchOnWindowFocus: true`, DE/EN i18n parity with informal "du" tone, bilingual admin-guide §Analytics/§Analyse sections, and full test coverage (6 backend D-20 scenarios + 11 frontend D-21 scenarios, 25/25 frontend green, 174/176 backend green per SUMMARY). Milestone SC #5 awaits a live-Pi UAT observation.

---

*Verified: 2026-04-21T18:10:00Z*
*Verifier: Claude (gsd-verifier)*
