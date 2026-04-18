# Phase 42: Device Auth + Pairing Flow — Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Fresh Pi ↔ admin pairing handshake, plus the device-token guard that protects `/api/signage/player/*`. Backend-only (FastAPI routers, auth dep, APScheduler cleanup job). No frontend work — the admin pairing UI lives in Phase 46, the player kiosk in Phase 47.

**Deliverables:**
- `backend/app/routers/signage_pair.py` — `POST /request` (unauth + rate-limited), `GET /status` (unauth), `POST /claim` (admin)
- `backend/app/security/device_auth.py` — `get_current_device` FastAPI dependency
- APScheduler pairing-cleanup job on the existing 03:00 UTC slot
- Admin "revoke device" endpoint flipping `signage_devices.revoked_at`

**Out of scope (explicitly deferred):**
- Media/Playlist/Device CRUD → Phase 43
- SSE broadcast → Phase 45
- Admin pairing UI → Phase 46
- Player kiosk → Phase 47

</domain>

<decisions>
## Implementation Decisions

### Device authentication
- **D-01:** Device token format is a **scoped JWT** — `{sub: device_id, scope: "device", iat, exp}`, HS256, 24h TTL. Verifying middleware checks signature + `signage_devices.revoked_at IS NULL` on every request. Follows PITFALLS §21 recommendation.
- **D-02:** **No rotation** — fixed 24h JWT, re-issued only at re-pair. Small-fleet (≤5 devices) scope does not justify rotate-on-heartbeat complexity; admin "Revoke device" + re-pair is the kill path.
- **D-03:** Token transport is `Authorization: Bearer <token>` header (not HttpOnly cookie). Matches existing admin auth style; keeps SSE (Phase 45) simple. XSS surface from HTML snippets is mitigated at the snippet sanitizer boundary (Phase 43+), not by cookie posture here.
- **D-04:** JWT-signing secret is a new environment variable `SIGNAGE_DEVICE_JWT_SECRET` (separate from Directus JWT secret — different trust domain, different rotation cadence). HS256 is sufficient given single-process verification.

### Pairing flow
- **D-05:** Pairing code format is `XXX-XXX` (6 chars, dash-separated) per ROADMAP SC #1. Alphabet: unambiguous subset (exclude `O/0/1/I/L`) — researcher to confirm exact alphabet against collision math during research phase. TTL 600s (10 min) per ROADMAP.
- **D-06:** `POST /pair/claim` uses a **single atomic `UPDATE ... WHERE code=:code AND claimed_at IS NULL RETURNING *`** (PITFALLS §13 pattern). No `SELECT…FOR UPDATE` transaction needed — the `UPDATE…RETURNING` is race-free by construction, and the partial-unique index on `code` guarantees at most one active row per code.
- **D-07:** Pair-status polling cadence is **3 seconds** from the Pi. ~200 polls over the 10-min TTL ceiling. 2s was snappier but chattier; 5s had noticeable wait at claim. 3s is the sweet spot.
- **D-08:** After a successful `/pair/claim`, the very next `GET /pair/status` returns `{status: "claimed", device_token: "..."}` **exactly once**; subsequent polls return `{status: "claimed_consumed"}` (or equivalent — researcher to confirm the cleanest single-consume semantic). The session row is deleted or marked-consumed at that point; the cleanup cron sweeps stragglers.

### Rate limiting
- **D-09:** Rate-limit backing is an **in-process `{ip: deque[timestamp]}` with `asyncio.Lock`** — ~30 LOC, no new dependencies. Viable because `--workers 1` invariant is already enforced (documented in `scheduler.py` and `docker-compose.yml`, mirrors v1.15 APScheduler singleton). Cap: 5 requests/minute per source IP on `POST /pair/request` only.
- **D-10:** Client IP resolution respects existing reverse-proxy semantics if any — researcher to verify whether the app sits behind a proxy that sets `X-Forwarded-For`. Default to `request.client.host` if no proxy header is trusted.

### Pairing cleanup cron
- **D-11:** Cleanup job reuses the existing **03:00 UTC APScheduler slot** (alongside `sensor_retention_cleanup` from v1.15). `coalesce=True`, `max_instances=1`, `misfire_grace_time=30`, wrapped in `asyncio.wait_for` — mirror the v1.15 pattern.
- **D-12:** Deletion predicate is `expires_at < now() - interval '24 hours'` — 24-hour grace window per ROADMAP SC #4. This keeps recently-expired sessions visible briefly (debugging + "why did my code fail?" admin triage) before physical delete.
- **D-13:** **This cron is now a correctness requirement, not a cosmetic nicety** — it carries the expiration half of SGN-DB-02 (phase 41 dropped `expires_at > now()` from the partial-unique predicate because Postgres forbids `now()` in IMMUTABLE partial predicates). An active, unclaimed, expired code still participates in the partial-unique index until the cron deletes it, so the cron MUST run daily. Document this inline in both `signage_pair.py` and the cron job.

### Revocation
- **D-14:** Admin "Revoke device" = `UPDATE signage_devices SET revoked_at = now() WHERE id = :id`. `get_current_device` dep checks `revoked_at IS NULL` on every call. Revoked devices get 401 (not 403 — token is no longer valid, not scope-mismatched).

### Router wiring
- **D-15:** `signage_pair` router is mounted under `/api/signage/pair`. `/request` and `/status` have no auth dep; `/claim` uses the existing `Depends(get_current_user), Depends(require_admin)` pair from `backend/app/security/directus_auth.py` + `roles.py`.
- **D-16:** `/api/signage/player/*` routes (shape defined in Phase 43) will use `Depends(get_current_device)` — the dep is landed in this phase so Phase 43 can plug straight in.

### Claude's Discretion
- Exact JWT library — `python-jose` vs `PyJWT` vs `authlib` — deferred to research/planning. Pick whichever is already transitively available or most idiomatic for FastAPI HS256 in 2026.
- Pairing code alphabet — user accepts "unambiguous subset" as the intent; researcher picks the exact character set based on collision math and UX precedent.
- Single-consume semantic for `/pair/status` after claim — `claimed_consumed` vs 404 vs delete-row-immediately. Planner picks based on test ergonomics.
- Error-response shapes (401 vs 403 boundaries beyond revoked-device) — follow existing FastAPI/Directus conventions in `backend/app/security/`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Security & pairing design
- `.planning/research/PITFALLS.md` §13 — Pairing code collision, partial-unique index pattern, atomic `UPDATE…RETURNING` claim (lines 267–304)
- `.planning/research/PITFALLS.md` §21 — Device token leak cross-device, scoped JWT pattern with 24h HS256, scope-enforcement at every route (lines 417–435)
- `.planning/research/PITFALLS.md` §22 — HTML snippet XSS boundary (informs D-03 transport choice; full mitigation lands in Phase 43+)

### Roadmap & requirements (phase 42 scope)
- `.planning/ROADMAP.md` §"Phase 42: Device Auth + Pairing Flow" (lines 195–207) — 5 success criteria are the verification checklist
- `.planning/REQUIREMENTS.md` SGN-BE-03, SGN-BE-04, SGN-SCH-02 (lines 27, 28, 39) — acceptance criteria

### Phase 41 schema context (consumed, not modified, by phase 42)
- `.planning/phases/41-signage-schema-models/41-CONTEXT.md` — D-1..D-17 schema decisions, including D-13/D-15 partial-unique amendment
- `.planning/phases/41-signage-schema-models/41-05-round-trip-verification-SUMMARY.md` — records SGN-DB-02 semantic amendment (partial predicate weakened to `WHERE claimed_at IS NULL`); phase 42 cleanup cron is now the expiration-invariant carrier
- `backend/app/models/signage.py` — `SignagePairingSession`, `SignageDevice` ORM models (fields, FKs, revoked_at column already in place)
- `backend/app/schemas/signage.py` — `SignagePairingRequestResponse`, `SignagePairingStatusResponse`, `SignagePairingClaimRequest`, `SignagePairingClaimResponse` Pydantic DTOs already drafted

### Existing patterns to mirror
- `backend/app/security/directus_auth.py` — `get_current_user` dep, Directus JWT verification (model for `get_current_device`)
- `backend/app/security/roles.py` — `require_admin` dep (reused on `/pair/claim`)
- `backend/app/scheduler.py` lines 1–140 — APScheduler singleton pattern, 03:00 UTC retention cron, `coalesce=True` / `max_instances=1` / `misfire_grace_time=30` invariants, `asyncio.wait_for` outer guard. **This is the exact template for the pairing-cleanup job.**
- `backend/app/routers/sensors.py` — FastAPI router composition with nested admin deps (structural analog for `signage_pair.py`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get_current_user` + `require_admin` deps — drop-in for `/pair/claim` admin gate
- `Fernet` helper in `backend/app/security/fernet.py` — NOT used here (device tokens are JWT, not stored secrets); flagged so a well-meaning contributor doesn't reach for it by reflex
- APScheduler singleton in `scheduler.py` — pairing-cleanup is a second `CronTrigger(hour=3, minute=0)` job registered alongside `sensor_retention_cleanup`
- Async `AsyncSession` + `asyncpg` engine — already wired; pairing code uses standard `session.execute(update(...).returning(...))`

### Established Patterns
- Env-var secret pattern — follow `SENSOR_COMMUNITY_FERNET_KEY` precedent: declare in `docker-compose.yml`, load via Pydantic `BaseSettings`, document in CLAUDE.md's env section
- Router structure — `APIRouter(prefix="/api/signage/pair", tags=["signage-pair"])`, mount in `backend/app/main.py` alongside existing routers
- Test structure — `backend/tests/test_signage_*` file per feature; live Postgres fixture already set up from phase 41 round-trip test

### Integration Points
- `backend/app/main.py` — register `signage_pair.router` and future `signage_player.router` (Phase 43); declare the device-auth dep module
- `backend/app/scheduler.py` — add `PAIRING_CLEANUP_JOB_ID`, a `_run_pairing_cleanup()` coroutine, and registration inside the existing startup hook
- `docker-compose.yml` — add `SIGNAGE_DEVICE_JWT_SECRET` to the `api` and `migrate` service env (migrate doesn't need it at runtime but consistency keeps diff small; confirm during planning)
- `backend/app/config.py` / `settings.py` — extend Pydantic `Settings` with the new secret

</code_context>

<specifics>
## Specific Ideas

- User explicitly accepted "recommended" on all 6 gray areas — no bespoke preferences beyond PITFALLS alignment
- Preferred error shape is whatever the existing `directus_auth.py` / `roles.py` emit — don't invent new error envelopes for this phase

</specifics>

<deferred>
## Deferred Ideas

- **Rotate-on-heartbeat token rotation** — considered and rejected for small-fleet scope; revisit if fleet grows past ~20 devices or a leak incident drives it
- **`HttpOnly` cookie transport** — considered and rejected; revisit together with HTML-snippet sanitizer hardening in Phase 43+ if XSS surface proves meaningful
- **`slowapi` dependency** — rejected in favor of in-process deque; revisit if `--workers 1` invariant is ever relaxed or if rate limiting spreads beyond this one endpoint
- **Media-download token scoping** (PITFALLS §21 "per-request short-lived tokens derived from device token") — not in Phase 42 scope; belongs in Phase 43 (media endpoints) or later
- **Admin audit log for `/pair/claim`** — not in Phase 42 success criteria; could land in Phase 46 or a future observability phase

</deferred>

---

*Phase: 42-device-auth-pairing-flow*
*Context gathered: 2026-04-18*
