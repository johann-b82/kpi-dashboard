---
phase: 42-device-auth-pairing-flow
plan: 02
type: execute
wave: 2
depends_on:
  - 42-01
files_modified:
  - backend/app/routers/signage_pair.py
  - backend/app/routers/__init__.py
  - backend/app/main.py
  - backend/tests/test_signage_pair_router.py
autonomous: true
requirements:
  - SGN-BE-03

must_haves:
  truths:
    - "POST /api/signage/pair/request with no auth returns 201 with {pairing_code, pairing_session_id, expires_in: 600}"
    - "GET /api/signage/pair/status?pairing_session_id=<uuid> returns {status: 'pending'} before claim"
    - "POST /api/signage/pair/claim with admin JWT atomically binds a pending code to a new device and returns 204"
    - "POST /api/signage/pair/claim without admin auth returns 401 or 403"
    - "The FIRST GET /pair/status after claim returns {status: 'claimed', device_token: <jwt>}; subsequent polls return {status: 'expired'} (delete-on-deliver)"
    - "Unknown/expired/consumed pairing_session_id returns {status: 'expired'} (not 404)"
    - "6th POST /pair/request from same IP within 60s is rate-limited with 429"
  artifacts:
    - path: "backend/app/routers/signage_pair.py"
      provides: "SGN-BE-03 router with /request, /status, /claim"
      contains: "APIRouter(prefix=\"/api/signage/pair\""
    - path: "backend/app/main.py"
      provides: "signage_pair router mounted on the app"
      contains: "signage_pair"
  key_links:
    - from: "backend/app/routers/signage_pair.py"
      to: "backend/app/security/rate_limit.py"
      via: "dependencies=[Depends(rate_limit_pair_request)] on /request"
      pattern: "rate_limit_pair_request"
    - from: "backend/app/routers/signage_pair.py"
      to: "backend/app/security/directus_auth.py"
      via: "per-endpoint dependencies=[Depends(get_current_user), Depends(require_admin)] on /claim"
      pattern: "require_admin"
    - from: "backend/app/routers/signage_pair.py"
      to: "backend/app/services/signage_pairing.py"
      via: "generate_pairing_code() + mint_device_jwt()"
      pattern: "mint_device_jwt|generate_pairing_code"
    - from: "backend/app/main.py"
      to: "backend/app/routers/signage_pair.py"
      via: "app.include_router(signage_pair.router)"
      pattern: "include_router.*signage_pair"
---

<objective>
Land the `/api/signage/pair` router implementing the three pairing endpoints
(`POST /request`, `GET /status`, `POST /claim`) and mount it in the FastAPI app.
This plan DOES NOT land the admin-revoke endpoint or the cleanup cron — those go in Plan 03.

Purpose: Delivers SGN-BE-03. Uses the atomic `UPDATE … RETURNING` claim pattern
(PITFALLS §13 / D-06) and delete-on-deliver single-consume semantic (D-08,
researcher-chosen — RESEARCH §"Open Questions" Q1). The router is an
intentional exception to the "router-level admin gate" cross-cutting hazard
(RESEARCH §"v1.16 Cross-Cutting Hazards Applicable to Phase 42" point 2):
`/request` and `/status` are public; `/claim` is per-endpoint admin-gated.
Phase 43's dep-audit test (SGN-BE-09) will be written to permit this.

Output:
- `backend/app/routers/signage_pair.py` with 3 endpoints
- `backend/app/main.py` mounts the router
- Integration tests under `backend/tests/test_signage_pair_router.py`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/42-device-auth-pairing-flow/42-CONTEXT.md
@.planning/phases/42-device-auth-pairing-flow/42-RESEARCH.md
@.planning/phases/42-device-auth-pairing-flow/42-01-device-auth-foundations-SUMMARY.md
@backend/app/routers/sensors.py
@backend/app/security/directus_auth.py
@backend/app/models/signage.py
@backend/app/schemas/signage.py
@backend/app/main.py

<interfaces>
<!-- Already-drafted DTOs from Phase 41. Use verbatim — do NOT modify schemas/signage.py. -->

From backend/app/schemas/signage.py (lines ~152-178, drafted in Phase 41):
```python
class SignagePairingRequestResponse(BaseModel):
    pairing_code: str              # "XXX-XXX" display format
    pairing_session_id: UUID
    expires_in: int                # seconds; 600 for 10-min TTL

class SignagePairingStatusResponse(BaseModel):
    status: Literal["pending", "claimed", "expired"]
    device_token: str | None = None   # populated only when status == "claimed"

class SignagePairingClaimRequest(BaseModel):
    code: str                      # 6-char, undashed or dashed — accept both, strip dashes server-side
    device_name: str
    tag_ids: list[int] | None = None
```
Confirm exact field names by reading the file before implementing.

From Phase 41 ORM:
```python
class SignagePairingSession(Base):
    id: UUID (pk)
    code: str                      # 6-char undashed
    expires_at: datetime           # tz-aware
    claimed_at: datetime | None    # set by claim
    device_id: UUID | None         # FK to signage_devices, set by claim
    created_at: datetime

class SignageDevice(Base):
    id: UUID (pk)
    name: str
    status: str                    # "pending"/"online"/"offline"
    revoked_at: datetime | None
    # tag linkage via signage_device_tag_map (not used in this plan; tag_ids on claim
    # become device_tag_map rows via insert-many)
```

From Plan 01 (must exist before this plan runs):
```python
# backend/app/security/device_auth.py
async def get_current_device(...) -> SignageDevice  # Phase 43 uses; not called here
# backend/app/security/rate_limit.py
async def rate_limit_pair_request(request: Request) -> None
# backend/app/services/signage_pairing.py
PAIRING_ALPHABET: str                  # "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
def generate_pairing_code() -> str     # 6 chars, undashed
def format_for_display(code: str) -> str  # "ABC-234"
def mint_device_jwt(device_id: UUID) -> str  # HS256, 24h
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement signage_pair router with 3 endpoints + mount in main.py</name>
  <files>backend/app/routers/signage_pair.py, backend/app/routers/__init__.py, backend/app/main.py</files>
  <read_first>
    - backend/app/routers/sensors.py (mirror router composition, db dep usage, response_model conventions)
    - backend/app/routers/__init__.py (see existing router-module exports — add signage_pair alongside)
    - backend/app/main.py (see where other routers are included — add signage_pair in same style)
    - backend/app/schemas/signage.py (confirm exact DTO field names before coding)
    - backend/app/models/signage.py (confirm field names + FK names on SignagePairingSession, SignageDevice, and any device-tag-map table)
    - .planning/phases/42-device-auth-pairing-flow/42-RESEARCH.md lines 210-248 (atomic claim pattern), lines 394-410 (delete-on-deliver pattern), lines 524-580 (router skeleton)
    - backend/app/security/directus_auth.py (confirm exact names: `get_current_user`, `require_admin` — the latter may live in `roles.py`; verify)
    - backend/app/security/roles.py (confirm `require_admin` export)
  </read_first>
  <behavior>
    All tests use FastAPI TestClient with the live-Postgres fixture (pattern from Phase 41 round-trip test).

    POST /api/signage/pair/request:
    - Test 1: No auth headers → 201 with body {pairing_code: "XXX-XXX", pairing_session_id: <uuid4>, expires_in: 600}; code matches regex `^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{3}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{3}$`
    - Test 2: DB row is created in signage_pairing_sessions with claimed_at IS NULL, expires_at ≈ now + 600s
    - Test 3: 6th call from same IP within 60s → 429 with Retry-After header

    GET /api/signage/pair/status:
    - Test 4: Valid pairing_session_id (pending row) → 200 {status: "pending", device_token: None}
    - Test 5: Unknown pairing_session_id UUID → 200 {status: "expired", device_token: None} (NOT 404 — per RESEARCH §"Open Questions" Q1 recommendation)
    - Test 6: After a successful claim, first poll → 200 {status: "claimed", device_token: <non-empty jwt string>}; the JWT decodes with scope=device and sub=device_id
    - Test 7: Second poll after claim → 200 {status: "expired"} (row was deleted on first delivery; delete-on-deliver per D-08 + RESEARCH Pitfall 2)

    POST /api/signage/pair/claim:
    - Test 8: No auth → 401
    - Test 9: Viewer JWT (non-admin) → 403
    - Test 10: Admin JWT + valid pending code → 204; signage_devices has a new row with name=payload.device_name, status="pending" (or similar initial state consistent with Phase 41 model defaults); signage_pairing_sessions row has claimed_at set and device_id set
    - Test 11: Admin JWT + already-claimed code → 404 (with detail string mentioning invalid/expired/already claimed)
    - Test 12: Admin JWT + expired code (expires_at in past) → 404
    - Test 13: Admin JWT + code with dashes accepted interchangeably with undashed (strip dashes server-side before SQL)
    - Test 14: Concurrent /claim with same valid code from two admin sessions — exactly one gets 204, the other gets 404 (race-free by atomic UPDATE + partial-unique index)
  </behavior>
  <action>
    **Router file** — Create `backend/app/routers/signage_pair.py` mirroring `backend/app/routers/sensors.py` structure. Skeleton is in RESEARCH.md lines 524-580.

    ```python
    from datetime import datetime, timedelta, timezone
    from uuid import UUID
    from fastapi import APIRouter, Depends, HTTPException, Request, status
    from sqlalchemy import delete, insert, select, update, func
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.database import get_async_db_session
    from app.models import SignagePairingSession, SignageDevice
    from app.schemas.signage import (
        SignagePairingRequestResponse,
        SignagePairingStatusResponse,
        SignagePairingClaimRequest,
    )
    from app.security.directus_auth import get_current_user
    from app.security.roles import require_admin
    from app.security.rate_limit import rate_limit_pair_request
    from app.services.signage_pairing import (
        generate_pairing_code,
        format_for_display,
        mint_device_jwt,
    )

    # Per D-15 + RESEARCH §Cross-Cutting Hazard 2: INTENTIONAL EXCEPTION to the
    # router-level admin-gate rule. /request and /status are public; /claim is
    # per-endpoint admin-gated. Phase 43's dep-audit test (SGN-BE-09) must
    # permit this exception. Do not "fix" by moving admin gate to the router.
    router = APIRouter(prefix="/api/signage/pair", tags=["signage-pair"])

    PAIRING_TTL_SECONDS = 600  # 10 minutes per ROADMAP SC #1
    CODE_GEN_RETRIES = 5       # defense in depth; partial-unique index is primary guard
    ```

    **POST /request** (per D-05, D-09, ROADMAP SC #1):
    - `dependencies=[Depends(rate_limit_pair_request)]` at endpoint decorator (NOT router-level)
    - `status_code=201`, `response_model=SignagePairingRequestResponse`
    - Loop up to CODE_GEN_RETRIES: generate code via `generate_pairing_code()`, `INSERT INTO signage_pairing_sessions(code, expires_at=now+600s)` via async session. Catch `IntegrityError` on unique-index collision and retry. On 5 failures, raise HTTPException(503, "pairing system saturated, retry shortly", headers={"Retry-After": "60"}) per RESEARCH Pitfall 6.
    - Return `SignagePairingRequestResponse(pairing_code=format_for_display(code), pairing_session_id=row.id, expires_in=PAIRING_TTL_SECONDS)`

    **GET /status** (per D-08, delete-on-deliver):
    - Query param `pairing_session_id: UUID`
    - `response_model=SignagePairingStatusResponse`
    - `SELECT * FROM signage_pairing_sessions WHERE id = :pairing_session_id` via async session
    - Branches (all return 200):
      1. Row is None → `{status: "expired", device_token: None}`
      2. Row exists AND claimed_at IS NULL AND expires_at > now → `{status: "pending", device_token: None}`
      3. Row exists AND claimed_at IS NULL AND expires_at <= now → `{status: "expired", device_token: None}` (cron will sweep)
      4. Row exists AND claimed_at IS NOT NULL AND device_id IS NOT NULL → mint JWT via `mint_device_jwt(row.device_id)`, THEN in same transaction `DELETE FROM signage_pairing_sessions WHERE id = :id`, commit, return `{status: "claimed", device_token: <jwt>}`. This is the exactly-once delivery (RESEARCH Pitfall 2 + D-08). Inline comment block documenting the invariant.

    **POST /claim** (per D-06, D-15):
    - `dependencies=[Depends(get_current_user), Depends(require_admin)]` at endpoint decorator
    - `status_code=204`, no response body
    - Strip dashes from `payload.code` before SQL (accept both dashed and undashed)
    - Transaction:
      1. `INSERT INTO signage_devices(name=payload.device_name, status=<initial>)` — read the actual SignageDevice column default / NOT NULL constraints from models/signage.py; use whatever initial status Phase 41 set (likely "pending" or "offline"). Flush to populate device.id without committing.
      2. Atomic claim UPDATE (PITFALLS §13 pattern): `UPDATE signage_pairing_sessions SET claimed_at = func.now(), device_id = device.id WHERE code = :code AND claimed_at IS NULL AND expires_at > func.now() RETURNING *`. The `expires_at > now()` check MUST be in the WHERE (RESEARCH §"IMPORTANT — SGN-DB-02 amendment" — partial index only covers `claimed_at IS NULL`).
      3. If UPDATE returns no row → `await db.rollback()`, raise HTTPException(404, "pairing code invalid, expired, or already claimed"). Rolling back discards the inserted device row (keeps DB clean).
      4. If `payload.tag_ids`: bulk-insert into the device-tag-map table (field name — verify from models/signage.py; likely `signage_device_tag_map` with cols `device_id`, `tag_id`).
      5. Commit.
    - Return None (implicit 204).

    Do NOT write tokens to `signage_devices.device_token_hash` — that field stays null under JWT format (RESEARCH anti-pattern).

    **Mount in main.py** — Edit `backend/app/main.py`: `from app.routers import signage_pair` and `app.include_router(signage_pair.router)` in the same block as existing `app.include_router(sensors.router)` calls. Update `backend/app/routers/__init__.py` to include `signage_pair` in any `__all__` list or imports, matching the existing style.

    **Tests** — Create `backend/tests/test_signage_pair_router.py` with the 14 test cases above. Use the existing async-postgres fixture + a TestClient fixture that seeds a known admin Directus JWT (pattern from v1.15 router tests — read `backend/tests/` for conftest.py first). Test 14 (concurrency) can use `asyncio.gather` on two in-process client calls; at least one must get 404.
  </action>
  <verify>
    <automated>cd backend &amp;&amp; python -m pytest tests/test_signage_pair_router.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - File backend/app/routers/signage_pair.py exists
    - grep -q 'APIRouter(prefix="/api/signage/pair"' backend/app/routers/signage_pair.py
    - grep -q "rate_limit_pair_request" backend/app/routers/signage_pair.py
    - grep -q "require_admin" backend/app/routers/signage_pair.py
    - grep -q "get_current_user" backend/app/routers/signage_pair.py
    - grep -q "mint_device_jwt" backend/app/routers/signage_pair.py
    - grep -q "generate_pairing_code" backend/app/routers/signage_pair.py
    - grep -Eq "INTENTIONAL EXCEPTION|intentional exception" backend/app/routers/signage_pair.py
    - grep -Eq "claimed_at\\.is_\\(None\\)|claimed_at IS NULL" backend/app/routers/signage_pair.py
    - grep -Eq "returning\\(" backend/app/routers/signage_pair.py
    - grep -Eq "delete\\(SignagePairingSession\\)" backend/app/routers/signage_pair.py
    - grep -q "signage_pair" backend/app/main.py
    - grep -q "include_router" backend/app/main.py | grep signage_pair
    - Not written: `! grep -r "device_token_hash" backend/app/routers/signage_pair.py`
    - pytest: all 14 cases pass, including the concurrent-claim test
  </acceptance_criteria>
  <done>The three pairing endpoints work end-to-end against a live Postgres test DB; atomic claim is race-free; delete-on-deliver delivers the device JWT exactly once; rate limit enforces 5 req/min; router is mounted in main.py and the intentional exception to the router-level admin gate is documented inline.</done>
</task>

</tasks>

<verification>
- `curl -X POST http://localhost:8000/api/signage/pair/request` returns 201 with correctly-formatted pairing code (manual smoke — captured in SUMMARY if run)
- All router integration tests pass: `pytest tests/test_signage_pair_router.py -v`
- Router is importable via `from app.routers import signage_pair`
- `app.include_router(signage_pair.router)` is present in main.py
- Plan 01's foundations are in place and not duplicated here
</verification>

<success_criteria>
- SGN-BE-03 acceptance test is satisfiable end-to-end (request → status pending → admin claim → status claimed once → status expired)
- Concurrent-claim race test proves atomicity (ROADMAP SC #1 "exactly once" + PITFALLS §13 compliance)
- Rate limit proves ROADMAP SC #3 (5 req/min cap)
</success_criteria>

<output>
Create `.planning/phases/42-device-auth-pairing-flow/42-02-signage-pair-router-SUMMARY.md` summarizing the endpoints shipped, the exact wire shapes chosen for open questions (delete-on-deliver + 200 `expired` semantics), and any pattern deviations for Plan 03 to reference.
</output>
