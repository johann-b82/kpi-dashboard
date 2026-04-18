---
phase: 42-device-auth-pairing-flow
plan: 03
type: execute
wave: 3
depends_on:
  - 42-01
  - 42-02
files_modified:
  - backend/app/scheduler.py
  - backend/app/routers/signage_pair.py
  - backend/tests/test_signage_pairing_cleanup.py
  - backend/tests/test_signage_device_revoke.py
autonomous: true
requirements:
  - SGN-SCH-02

must_haves:
  truths:
    - "APScheduler registers a second 03:00 UTC cron named signage_pairing_cleanup alongside the v1.15 sensor_retention_cleanup"
    - "The cleanup job deletes signage_pairing_sessions rows where expires_at < now() - 24h"
    - "Admin POST /api/signage/pair/devices/{id}/revoke sets signage_devices.revoked_at and returns 204"
    - "After a device is revoked, a subsequent request using that device's JWT on a protected endpoint returns 401 (proved by an integration test using get_current_device)"
    - "No signage_devices.device_token_hash writes are introduced anywhere in the codebase"
  artifacts:
    - path: "backend/app/scheduler.py"
      provides: "PAIRING_CLEANUP_JOB_ID + _run_signage_pairing_cleanup + CronTrigger registration"
      contains: "signage_pairing_cleanup"
    - path: "backend/app/routers/signage_pair.py"
      provides: "Admin revoke endpoint (extension of existing router from Plan 02)"
      contains: "revoke"
  key_links:
    - from: "backend/app/scheduler.py"
      to: "signage_pairing_sessions table"
      via: "DELETE WHERE expires_at < now() - interval '24 hours'"
      pattern: "SignagePairingSession"
    - from: "backend/app/routers/signage_pair.py"
      to: "signage_devices.revoked_at"
      via: "UPDATE signage_devices SET revoked_at = now() WHERE id = :id"
      pattern: "revoked_at"
---

<objective>
Close Phase 42 by shipping the two remaining deliverables from CONTEXT:
1. The APScheduler pairing-cleanup job at the existing 03:00 UTC slot (SGN-SCH-02).
   This cron is a correctness requirement, not a cosmetic nicety — it carries
   the expiration half of SGN-DB-02 that Phase 41 dropped from the partial-unique
   index predicate (Postgres errcode 42P17 — now() not IMMUTABLE). Documented
   inline in both scheduler.py and signage_pair.py per D-13.
2. The admin "Revoke device" endpoint flipping `signage_devices.revoked_at` (D-14),
   satisfying ROADMAP SC #5.

Purpose: Phase 42 success criteria #4 (cron deletes expired rows) and #5
(revoked device gets 401) both land here. After this plan, Phase 43 can build
the full device admin CRUD router and SGN-BE-09 dep-audit against a complete
Phase 42 surface.

Output:
- `scheduler.py` edited: new `PAIRING_CLEANUP_JOB_ID`, `_run_signage_pairing_cleanup()`, registration inside lifespan
- `signage_pair.py` edited: new `POST /api/signage/pair/devices/{id}/revoke` endpoint
- Integration tests for both
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/42-device-auth-pairing-flow/42-CONTEXT.md
@.planning/phases/42-device-auth-pairing-flow/42-RESEARCH.md
@.planning/phases/42-device-auth-pairing-flow/42-01-device-auth-foundations-SUMMARY.md
@.planning/phases/42-device-auth-pairing-flow/42-02-signage-pair-router-SUMMARY.md
@backend/app/scheduler.py
@backend/app/models/signage.py
@backend/app/routers/signage_pair.py

<interfaces>
<!-- Cron registration pattern — mirror the v1.15 SENSOR_RETENTION_JOB_ID block exactly. -->

From backend/app/scheduler.py (already exists, v1.15 pattern):
```python
SENSOR_RETENTION_JOB_ID = "sensor_retention_cleanup"
# Inside lifespan, after scheduler.start():
scheduler.add_job(
    _run_sensor_retention_cleanup,           # coroutine, wraps DELETE in asyncio.wait_for
    trigger=CronTrigger(hour=3, minute=0, timezone=timezone.utc),
    id=SENSOR_RETENTION_JOB_ID,
    replace_existing=True,
    max_instances=1,
    coalesce=True,
    misfire_grace_time=300,
)
```

From Plan 01:
```python
# backend/app/security/device_auth.py — used by the revoke integration test
async def get_current_device(...) -> SignageDevice  # 401s when revoked_at is not None
```

From Plan 02 (router already mounted + exists):
```python
# backend/app/routers/signage_pair.py already exists with 3 endpoints
# This plan appends a 4th endpoint (device revoke) to the same router file.
router = APIRouter(prefix="/api/signage/pair", tags=["signage-pair"])
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add signage_pairing_cleanup APScheduler cron (03:00 UTC)</name>
  <files>backend/app/scheduler.py, backend/tests/test_signage_pairing_cleanup.py</files>
  <read_first>
    - backend/app/scheduler.py (read entirely — especially the lifespan function and the SENSOR_RETENTION_JOB_ID registration + _run_sensor_retention_cleanup coroutine; this is the exact template)
    - backend/app/models/signage.py (confirm SignagePairingSession field names: `expires_at`, `claimed_at`)
    - .planning/phases/42-device-auth-pairing-flow/42-RESEARCH.md lines 297-341 (exact cron registration code)
  </read_first>
  <behavior>
    - Test 1: Seed a `signage_pairing_sessions` row with `expires_at = now - 25h` (≥24h stale) and call `_run_signage_pairing_cleanup()` directly → the row is gone after the call.
    - Test 2: Seed a row with `expires_at = now - 23h` (inside grace) → row survives.
    - Test 3: Seed a row with `expires_at = now + 10min` (still active) → row survives.
    - Test 4: Seed a claimed row with `expires_at = now - 25h` → row is also deleted (predicate is expires_at only; claim-state irrelevant for cleanup).
    - Test 5: Module-level `PAIRING_CLEANUP_JOB_ID == "signage_pairing_cleanup"` exported from scheduler.py.
    - Test 6 (optional / smoke): After `lifespan(app)` startup, `scheduler.get_job("signage_pairing_cleanup")` is not None and has a CronTrigger at hour=3, minute=0, UTC.
  </behavior>
  <action>
    Edit `backend/app/scheduler.py`. Mirror the v1.15 `SENSOR_RETENTION_JOB_ID` / `_run_sensor_retention_cleanup` pattern exactly (RESEARCH lines 297-341).

    1. Add module-level constant: `PAIRING_CLEANUP_JOB_ID = "signage_pairing_cleanup"`
    2. Add imports as needed: `from app.models import SignagePairingSession` (if not already imported for other reasons; if already imported, skip).
    3. Define coroutine `_run_signage_pairing_cleanup()`:
       ```python
       async def _run_signage_pairing_cleanup() -> None:
           """D-12: delete expired pairing sessions older than 24h.

           D-13: This cron carries the expiration invariant for SGN-DB-02.
           Phase 41 dropped `expires_at > now()` from the partial-unique index
           predicate because Postgres forbids now() in IMMUTABLE partial
           predicates (errcode 42P17). Without this cron, expired-but-unclaimed
           codes stay in the unique index indefinitely and /pair/request will
           eventually trip the 5-retry saturation path. This is correctness,
           not cosmetics.
           """
           from datetime import datetime, timedelta, timezone
           from sqlalchemy import delete
           cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
           async with AsyncSessionLocal() as session:
               try:
                   await asyncio.wait_for(
                       session.execute(
                           delete(SignagePairingSession).where(
                               SignagePairingSession.expires_at < cutoff
                           )
                       ),
                       timeout=30,
                   )
                   await session.commit()
               except Exception:
                   log.exception("signage_pairing_cleanup failed")
                   await session.rollback()
       ```
    4. Inside the existing `lifespan` function, AFTER the `SENSOR_RETENTION_JOB_ID` registration, add:
       ```python
       scheduler.add_job(
           _run_signage_pairing_cleanup,
           trigger=CronTrigger(hour=3, minute=0, timezone=timezone.utc),
           id=PAIRING_CLEANUP_JOB_ID,
           replace_existing=True,
           max_instances=1,
           coalesce=True,
           misfire_grace_time=300,
       )
       log.info("registered signage_pairing_cleanup cron (03:00 UTC)")
       ```

    Inline comment directly above the add_job call: `# SGN-SCH-02 + D-13: carries expiration invariant for SGN-DB-02 (see _run_signage_pairing_cleanup docstring).`

    Do NOT modify the Personio sync or sensor polling/retention jobs. Additive change only.

    **Tests** — Create `backend/tests/test_signage_pairing_cleanup.py` with tests 1-5 above. Use existing async-postgres fixture. Test 6 (lifespan smoke) can be attempted but is optional if it requires heavy TestClient setup.
  </action>
  <verify>
    <automated>cd backend &amp;&amp; python -m pytest tests/test_signage_pairing_cleanup.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - grep -q 'PAIRING_CLEANUP_JOB_ID = "signage_pairing_cleanup"' backend/app/scheduler.py
    - grep -q "async def _run_signage_pairing_cleanup" backend/app/scheduler.py
    - grep -Eq "CronTrigger\\(hour=3, minute=0" backend/app/scheduler.py
    - grep -q "SGN-DB-02" backend/app/scheduler.py
    - grep -q "asyncio.wait_for" backend/app/scheduler.py
    - grep -Eq "timedelta\\(hours=24\\)|interval.*24" backend/app/scheduler.py
    - grep -q "max_instances=1" backend/app/scheduler.py (already present for v1.15; still grep'able after additive change)
    - grep -q "coalesce=True" backend/app/scheduler.py
    - grep -q "misfire_grace_time=300" backend/app/scheduler.py
    - pytest: tests 1-5 all pass; ≥24h-stale rows deleted; <24h rows preserved; active rows preserved
    - No regression: `pytest tests/ -k "not signage" -x` still green (v1.15 and earlier tests unaffected)
  </acceptance_criteria>
  <done>03:00 UTC cron is registered alongside the v1.15 retention job; coroutine deletes expired-beyond-24h pairing sessions; the SGN-DB-02 correctness dependency is documented inline; tests prove 24h grace boundary behavior.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add admin "Revoke device" endpoint + cross-check against get_current_device</name>
  <files>backend/app/routers/signage_pair.py, backend/tests/test_signage_device_revoke.py</files>
  <read_first>
    - backend/app/routers/signage_pair.py (current state after Plan 02 — confirm router shape, imports; the revoke endpoint APPENDS to this file)
    - backend/app/security/device_auth.py (confirm get_current_device raises 401 when revoked_at is not None — this is the other half of the integration test)
    - backend/app/models/signage.py (confirm SignageDevice.revoked_at field name + type)
    - .planning/phases/42-device-auth-pairing-flow/42-RESEARCH.md lines 605-609 (§Open Questions Q3 — "Where does the Revoke device endpoint live?" — recommendation: Phase 42 lands a minimal endpoint on the existing signage_pair router to satisfy SC #5)
    - backend/app/services/signage_pairing.py (use mint_device_jwt in tests to produce a valid JWT for the revoked-device path)
  </read_first>
  <behavior>
    - Test 1: POST /api/signage/pair/devices/{id}/revoke with no auth → 401
    - Test 2: POST with Viewer Directus JWT → 403
    - Test 3: POST with admin Directus JWT + valid device_id → 204; DB shows signage_devices.revoked_at IS NOT NULL
    - Test 4: POST with admin JWT + unknown device_id → 404
    - Test 5: POST on an already-revoked device → 204 and revoked_at is left at the original timestamp (idempotent — no-op when already revoked) OR updated to now() (planner picks; preferred: idempotent no-op to preserve audit timestamp)
    - Test 6 (integration, THE critical test for ROADMAP SC #5): mint a device JWT for a fresh device, construct a mock protected endpoint that uses `Depends(get_current_device)`, prove: (a) pre-revoke call → 200 returning the SignageDevice, (b) call /revoke endpoint as admin, (c) post-revoke call with the same JWT → 401 with WWW-Authenticate: Bearer header
  </behavior>
  <action>
    **Append revoke endpoint to existing router** — Edit `backend/app/routers/signage_pair.py` (do NOT create a new file; the router from Plan 02 gains a new endpoint).

    Add imports if missing: `from app.models import SignageDevice`, `from sqlalchemy import update`.

    Per RESEARCH §Open Questions Q3: use path `POST /api/signage/pair/devices/{device_id}/revoke`. This sits on the existing pair router to avoid creating a second router file in this phase. Phase 43's device admin CRUD router MAY later consolidate under `/api/signage/devices/{id}` — that's a future refactor, not a Phase 42 concern. Document inline:

    ```python
    # POST /devices/{device_id}/revoke — minimal revoke endpoint to satisfy
    # ROADMAP SC #5 in Phase 42. Phase 43 may move this under
    # /api/signage/devices/{id} as part of the admin CRUD router.
    # Kept here for now so Phase 42 can be verified end-to-end.
    @router.post(
        "/devices/{device_id}/revoke",
        status_code=status.HTTP_204_NO_CONTENT,
        dependencies=[Depends(get_current_user), Depends(require_admin)],
    )
    async def revoke_device(
        device_id: UUID,
        db: AsyncSession = Depends(get_async_db_session),
    ) -> None:
        # D-14: UPDATE signage_devices SET revoked_at = now() WHERE id = :id
        # If already revoked, this is idempotent: we preserve the original
        # revoked_at timestamp (audit-friendly).
        result = await db.execute(select(SignageDevice).where(SignageDevice.id == device_id))
        device = result.scalar_one_or_none()
        if device is None:
            raise HTTPException(status_code=404, detail="device not found")
        if device.revoked_at is None:
            await db.execute(
                update(SignageDevice)
                .where(SignageDevice.id == device_id)
                .values(revoked_at=func.now())
            )
            await db.commit()
        # else: idempotent no-op; original revoked_at preserved
    ```

    **Integration test (Test 6)** — Create `backend/tests/test_signage_device_revoke.py`. Key structure:
    ```python
    # 1. Seed a SignageDevice row (name="testpi", revoked_at=None)
    # 2. Mint a JWT for it via mint_device_jwt(device.id)
    # 3. Mount a temporary test route on the test app that uses Depends(get_current_device)
    #    and returns {"id": str(device.id)} — OR reuse an existing Phase 43 endpoint if
    #    it lands first (unlikely; Phase 42 ships before Phase 43)
    # 4. With Bearer <jwt> header — assert 200 and body matches
    # 5. Call POST /api/signage/pair/devices/{device.id}/revoke with admin JWT — assert 204
    # 6. Query DB: SignageDevice.revoked_at is not None
    # 7. Call the test-only protected route again with the SAME JWT — assert 401,
    #    WWW-Authenticate: Bearer header present
    ```

    The temporary test route can be registered directly on the test FastAPI app inside a fixture using `app.add_api_route("/_test/me-device", ..., dependencies=[Depends(get_current_device)])`. This avoids needing Phase 43's player routes to exist.

    Do NOT create a new top-level `/api/signage/devices/*` router in this phase — resist the temptation to pre-build Phase 43's CRUD surface.
  </action>
  <verify>
    <automated>cd backend &amp;&amp; python -m pytest tests/test_signage_device_revoke.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "/devices/{device_id}/revoke" backend/app/routers/signage_pair.py
    - grep -q "async def revoke_device" backend/app/routers/signage_pair.py
    - grep -Eq "values\\(revoked_at=func\\.now\\(\\)\\)|revoked_at=.*now" backend/app/routers/signage_pair.py
    - grep -Eq "require_admin" backend/app/routers/signage_pair.py (still present; dep wiring on revoke endpoint)
    - grep -q "get_current_device" backend/tests/test_signage_device_revoke.py
    - grep -q "mint_device_jwt" backend/tests/test_signage_device_revoke.py
    - pytest: all 6 tests pass including the post-revoke 401 integration test
    - No new files under backend/app/routers/ besides signage_pair.py (confirmed with `ls backend/app/routers/`)
    - No writes to signage_devices.device_token_hash: `! grep "device_token_hash" backend/app/routers/signage_pair.py`
  </acceptance_criteria>
  <done>Admin can revoke any device; subsequent player-side requests with that device's JWT are rejected 401 via get_current_device; ROADMAP SC #5 is demonstrably satisfied end-to-end.</done>
</task>

</tasks>

<verification>
- Both cron and revoke tests pass: `pytest tests/test_signage_pairing_cleanup.py tests/test_signage_device_revoke.py -v`
- Existing tests still green: `pytest tests/ -x` (no regressions in Personio sync, sensor retention, Phase 41 schema round-trip, or Plan 02 router tests)
- Scheduler log message "registered signage_pairing_cleanup cron (03:00 UTC)" appears on app startup (manual smoke via `docker compose up api`)
- All 5 ROADMAP §Phase 42 Success Criteria are covered across Plans 01/02/03:
  - SC #1 (request/status/claim flow, exactly once) → Plan 02
  - SC #2 (player 401 without device token) → foundation in Plan 01 (Phase 43 closes the endpoint-level loop)
  - SC #3 (admin gate + rate limit) → Plan 02 + Plan 01
  - SC #4 (cron deletes expired rows after 24h) → Plan 03 Task 1
  - SC #5 (revoked device → 401) → Plan 03 Task 2
</verification>

<success_criteria>
- SGN-SCH-02 complete: 03:00 UTC cleanup cron ships and is proven to delete ≥24h-stale rows
- ROADMAP SC #5 complete: revocation is implemented and proven end-to-end via get_current_device
- Phase 42 as a whole is feature-complete and testable; Phase 43 can consume `get_current_device` on its `/api/signage/player/*` routes without further Phase 42 changes
</success_criteria>

<output>
Create `.planning/phases/42-device-auth-pairing-flow/42-03-cleanup-cron-and-revoke-SUMMARY.md` summarizing:
- Cron registration pattern + exact cutoff (24h)
- Revoke endpoint path chosen (`POST /api/signage/pair/devices/{id}/revoke`) and the rationale for NOT building Phase 43's device CRUD here
- Any tech debt (e.g. `_buckets` defaultdict memory note from Plan 01 rate_limit.py — still an open followup)
- Confirmation that all 5 ROADMAP §Phase 42 success criteria are satisfied across Plans 01/02/03
</output>
