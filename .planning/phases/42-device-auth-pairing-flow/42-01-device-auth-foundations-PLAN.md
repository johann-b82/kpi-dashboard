---
phase: 42-device-auth-pairing-flow
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/config.py
  - backend/app/security/device_auth.py
  - backend/app/security/rate_limit.py
  - backend/app/services/signage_pairing.py
  - docker-compose.yml
  - .env.example
autonomous: true
requirements:
  - SGN-BE-04
user_setup:
  - service: signage-device-jwt
    why: "HS256 signing key for device JWT — new trust domain separate from Directus"
    env_vars:
      - name: SIGNAGE_DEVICE_JWT_SECRET
        source: "Generate locally: python -c \"import secrets; print(secrets.token_urlsafe(64))\""

must_haves:
  truths:
    - "A forged or unsigned bearer token on /api/signage/player/* is rejected with 401"
    - "A valid device JWT whose signage_devices.revoked_at is NOT NULL is rejected with 401"
    - "POST /pair/request rate-limits to 5 req/min per client IP (429 + Retry-After on 6th)"
    - "Pairing code generator only uses alphabet 23456789ABCDEFGHJKMNPQRSTUVWXYZ and returns 6-char strings"
  artifacts:
    - path: "backend/app/security/device_auth.py"
      provides: "get_current_device FastAPI dep (SGN-BE-04)"
      contains: "async def get_current_device"
    - path: "backend/app/security/rate_limit.py"
      provides: "rate_limit_pair_request FastAPI dep (D-09)"
      contains: "async def rate_limit_pair_request"
    - path: "backend/app/services/signage_pairing.py"
      provides: "generate_pairing_code, format_for_display, mint_device_jwt"
      contains: "PAIRING_ALPHABET"
    - path: "backend/app/config.py"
      provides: "SIGNAGE_DEVICE_JWT_SECRET on Settings"
      contains: "SIGNAGE_DEVICE_JWT_SECRET"
  key_links:
    - from: "backend/app/security/device_auth.py"
      to: "app.config.settings.SIGNAGE_DEVICE_JWT_SECRET"
      via: "jwt.decode(..., settings.SIGNAGE_DEVICE_JWT_SECRET, algorithms=[\"HS256\"])"
      pattern: "algorithms=\\[\"HS256\"\\]"
    - from: "backend/app/security/device_auth.py"
      to: "signage_devices table"
      via: "SELECT id, revoked_at WHERE id = :device_id"
      pattern: "SignageDevice\\.revoked_at"
---

<objective>
Land the foundational building blocks that Wave 2's router and Wave 3's cron depend on:
a scoped-device JWT dependency, an in-process rate-limit dep, the code/JWT helper
service, the new `SIGNAGE_DEVICE_JWT_SECRET` config field, and the docker-compose
+ `.env.example` wiring for that secret.

Purpose: SGN-BE-04 (`get_current_device`) is the gate every `/api/signage/player/*`
route will use in Phase 43; shipping it first lets Phase 43 plug straight in.
D-09 rate-limit dep is required by the `/pair/request` endpoint in Plan 02.

Output:
- `backend/app/security/device_auth.py` with `get_current_device`
- `backend/app/security/rate_limit.py` with `rate_limit_pair_request`
- `backend/app/services/signage_pairing.py` with `generate_pairing_code`, `format_for_display`, `mint_device_jwt`
- `SIGNAGE_DEVICE_JWT_SECRET` added to `Settings`, `docker-compose.yml`, `.env.example`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/42-device-auth-pairing-flow/42-CONTEXT.md
@.planning/phases/42-device-auth-pairing-flow/42-RESEARCH.md
@backend/app/security/directus_auth.py
@backend/app/config.py
@backend/app/models/signage.py
@backend/app/schemas/signage.py

<interfaces>
<!-- Key contracts extracted from phase 41 models/schemas — executor uses these directly. -->

From backend/app/models/signage.py (already exists):
```python
class SignageDevice(Base):
    __tablename__ = "signage_devices"
    id: Mapped[UUID]           # primary key, gen_random_uuid()
    name: Mapped[str]
    revoked_at: Mapped[datetime | None]  # nullable; set by admin revoke
    # ... other fields exist but not needed here
```

From backend/app/security/directus_auth.py (already exists — mirror its style exactly):
```python
import jwt  # PyJWT 2.10.1
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

_bearer = HTTPBearer(auto_error=False)  # convention: auto_error=False + explicit raise
# jwt.decode(token, secret, algorithms=["HS256"]) — algorithms list MUST be explicit
# Catches jwt.PyJWTError base class and raises 401 with WWW-Authenticate: Bearer header
```

Settings pattern (backend/app/config.py):
```python
# pydantic_settings.BaseSettings — add new field:
SIGNAGE_DEVICE_JWT_SECRET: str  # no default — fail fast if unset
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add SIGNAGE_DEVICE_JWT_SECRET config + docker-compose + .env.example wiring</name>
  <files>backend/app/config.py, docker-compose.yml, .env.example</files>
  <read_first>
    - backend/app/config.py (read entirely — know the existing Settings shape)
    - docker-compose.yml (read entirely — find the `api` service env block + the `migrate` service env block)
    - .env.example (read entirely — match existing secret-documentation style)
    - backend/app/security/directus_auth.py (see how DIRECTUS_SECRET is read from settings — mirror that exactly)
  </read_first>
  <behavior>
    - Test 1: `from app.config import settings; settings.SIGNAGE_DEVICE_JWT_SECRET` returns the value set in env
    - Test 2: Starting the app with SIGNAGE_DEVICE_JWT_SECRET unset raises a pydantic-settings validation error (fail-fast, no silent default)
  </behavior>
  <action>
    Per D-04, add a new secret `SIGNAGE_DEVICE_JWT_SECRET` to the Pydantic `Settings` class in `backend/app/config.py`. Type: `str`. NO default value (fail fast; matches how `DIRECTUS_SECRET` or equivalent is declared — verify against the existing file).

    In `docker-compose.yml`, add `SIGNAGE_DEVICE_JWT_SECRET: ${SIGNAGE_DEVICE_JWT_SECRET}` to the `api` service environment block (alongside existing `DIRECTUS_*` / `SENSOR_*` vars). Do NOT add it to the `migrate` service — migrate has no runtime JWT need (confirmed in CONTEXT code_context line "migrate doesn't need it at runtime but consistency keeps diff small; confirm during planning" — resolution: skip migrate, keep diff minimal).

    In `.env.example`, add a commented line documenting the new var with generation hint:
    ```
    # Device JWT signing secret (HS256). Generate with:
    #   python -c "import secrets; print(secrets.token_urlsafe(64))"
    # Separate from DIRECTUS_SECRET — different trust domain (per D-04).
    SIGNAGE_DEVICE_JWT_SECRET=
    ```

    Also append (or create) a local `.env` entry with a generated value so `docker compose up` works locally. If `.env` is gitignored (it should be), that's a runtime-only change. If `.env` does not exist, create it as a copy of `.env.example` with the field populated.

    Per D-04: HS256 is sufficient, single-process verification.
  </action>
  <verify>
    <automated>cd backend &amp;&amp; python -c "from app.config import settings; assert hasattr(settings, 'SIGNAGE_DEVICE_JWT_SECRET'), 'missing SIGNAGE_DEVICE_JWT_SECRET'; assert settings.SIGNAGE_DEVICE_JWT_SECRET, 'empty secret'; print('ok')"</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "SIGNAGE_DEVICE_JWT_SECRET" backend/app/config.py
    - grep -q "SIGNAGE_DEVICE_JWT_SECRET" docker-compose.yml
    - grep -q "SIGNAGE_DEVICE_JWT_SECRET" .env.example
    - Settings field is typed `str` with no default (grep shows `SIGNAGE_DEVICE_JWT_SECRET: str` or equivalent, no `= ""`, no `= None`)
    - `.env.example` comment references `secrets.token_urlsafe(64)` generation hint
  </acceptance_criteria>
  <done>SIGNAGE_DEVICE_JWT_SECRET is loadable via `app.config.settings`, wired in docker-compose `api` service env block, and documented in `.env.example`; app fails fast if unset.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement signage_pairing service (code generator + JWT minter)</name>
  <files>backend/app/services/signage_pairing.py, backend/app/services/__init__.py, backend/tests/test_signage_pairing_service.py</files>
  <read_first>
    - backend/app/services/ (list — verify whether __init__.py exists; create if not)
    - backend/app/config.py (confirm SIGNAGE_DEVICE_JWT_SECRET is in Settings after Task 1)
    - .planning/phases/42-device-auth-pairing-flow/42-RESEARCH.md lines 467-521 (exact code for pairing code gen + mint_device_jwt)
  </read_first>
  <behavior>
    - Test 1: `generate_pairing_code()` returns a 6-char string using ONLY alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (regex `^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$`)
    - Test 2: `PAIRING_ALPHABET` has exactly 31 chars and contains no `0`, `1`, `O`, `I`, or `L`
    - Test 3: `format_for_display("ABC234")` returns `"ABC-234"` (XXX-XXX format)
    - Test 4: `mint_device_jwt(uuid4())` returns a string that `jwt.decode(..., settings.SIGNAGE_DEVICE_JWT_SECRET, algorithms=["HS256"])` decodes to `{sub: <uuid>, scope: "device", iat: int, exp: int}` with exp ≈ iat + 24*3600 (±5s tolerance)
    - Test 5: Two consecutive calls to `generate_pairing_code()` are not equal (probabilistic; acceptable flake rate negligible)
  </behavior>
  <action>
    Create `backend/app/services/signage_pairing.py` with three exports:

    1. `PAIRING_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"` (module-level constant). Include `assert len(PAIRING_ALPHABET) == 31` as a top-level assertion. Docstring references D-05 + exclusion of `0/O/1/I/L` per CONTEXT. U is retained per RESEARCH line 498 (31 chars vs 30 is UX-neutral; kept for entropy margin).

    2. `def generate_pairing_code() -> str:` — uses `secrets.choice(PAIRING_ALPHABET)` 6 times and joins. MUST use `secrets` not `random`. Returns uppercase 6-char string (no dash).

    3. `def format_for_display(code: str) -> str:` — asserts `len(code) == 6`, returns `f"{code[:3]}-{code[3:]}"`.

    4. `def mint_device_jwt(device_id: UUID) -> str:` — creates payload `{sub: str(device_id), scope: "device", iat: int(now_ts), exp: int((now + 24h).timestamp())}`, calls `jwt.encode(payload, settings.SIGNAGE_DEVICE_JWT_SECRET, algorithm="HS256")`. Constant `DEVICE_JWT_TTL_HOURS = 24` at module level (per D-01).

    Imports: `import secrets`, `import jwt`, `from datetime import datetime, timedelta, timezone`, `from uuid import UUID`, `from app.config import settings`.

    If `backend/app/services/__init__.py` does not exist, create it empty.

    Write test file `backend/tests/test_signage_pairing_service.py` covering the behavior block above. Use pytest. For the JWT test, monkeypatch `settings.SIGNAGE_DEVICE_JWT_SECRET = "test-secret-for-unit-test"` if needed, or require the `.env` to be loaded (existing test conftest already handles this per v1.15 pattern — verify during execution).
  </action>
  <verify>
    <automated>cd backend &amp;&amp; python -m pytest tests/test_signage_pairing_service.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - grep -q 'PAIRING_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"' backend/app/services/signage_pairing.py
    - grep -q "assert len(PAIRING_ALPHABET) == 31" backend/app/services/signage_pairing.py
    - grep -q "import secrets" backend/app/services/signage_pairing.py
    - grep -Eq "secrets\\.choice" backend/app/services/signage_pairing.py
    - grep -q 'algorithm="HS256"' backend/app/services/signage_pairing.py
    - grep -q '"scope": "device"' backend/app/services/signage_pairing.py
    - No occurrence of `random.choice` or `import random` in signage_pairing.py: `! grep -E "^import random|random\\.choice" backend/app/services/signage_pairing.py`
    - pytest passes all 5 test cases
  </acceptance_criteria>
  <done>signage_pairing service module exists with working code generator, display formatter, and JWT minter; unit tests pass; alphabet and JWT claims match D-01/D-05.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Implement get_current_device dep + rate_limit dep</name>
  <files>backend/app/security/device_auth.py, backend/app/security/rate_limit.py, backend/tests/test_device_auth.py, backend/tests/test_rate_limit.py</files>
  <read_first>
    - backend/app/security/directus_auth.py (mirror `get_current_user` pattern exactly — imports, HTTPBearer auto_error=False, 401 shape, WWW-Authenticate header)
    - backend/app/database.py (know the correct async session dep name — likely `get_async_db_session`)
    - backend/app/models/signage.py (confirm SignageDevice fields: id: UUID, revoked_at: datetime | None)
    - .planning/phases/42-device-auth-pairing-flow/42-RESEARCH.md lines 148-206 (exact device_auth.py code) and lines 251-292 (exact rate_limit.py code)
  </read_first>
  <behavior>
    get_current_device:
    - Test 1: No Authorization header → raises HTTPException(401) with `WWW-Authenticate: Bearer` header
    - Test 2: Malformed token (garbage) → 401
    - Test 3: Valid JWT but scope != "device" → 401
    - Test 4: Valid JWT with scope "device" but sub is not a valid UUID → 401
    - Test 5: Valid JWT, sub UUID does not exist in signage_devices → 401
    - Test 6: Valid JWT, device exists, revoked_at IS NULL → returns SignageDevice row
    - Test 7: Valid JWT, device exists, revoked_at IS NOT NULL → 401 (NOT 403, per D-14)
    - Test 8: Expired JWT (exp in past) → 401

    rate_limit_pair_request:
    - Test 1: 5 sequential calls from same IP within 60s all pass
    - Test 2: 6th call within 60s from same IP raises HTTPException(429) with `Retry-After: 60` header
    - Test 3: Calls from different IPs do not share a window
    - Test 4: After 60s elapse (monkeypatched time), window resets
  </behavior>
  <action>
    **device_auth.py** — Create `backend/app/security/device_auth.py` following the exact template in RESEARCH.md lines 148-206. Key points:

    - `_bearer = HTTPBearer(auto_error=False)` — match directus_auth.py convention
    - `_UNAUTHORIZED = HTTPException(401, detail="invalid or missing device token", headers={"WWW-Authenticate": "Bearer"})`
    - `async def get_current_device(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer), db: AsyncSession = Depends(get_async_db_session)) -> SignageDevice:`
    - If credentials is None OR `not credentials.credentials` → raise `_UNAUTHORIZED`
    - Call `jwt.decode(credentials.credentials, settings.SIGNAGE_DEVICE_JWT_SECRET, algorithms=["HS256"])` — algorithms list MUST be explicit (Pitfall 1). Catch base `jwt.PyJWTError` and raise 401.
    - Check `payload.get("scope") != "device"` → 401 (scope enforcement per D-01)
    - Parse `sub` as UUID; on ValueError/TypeError → 401
    - `SELECT SignageDevice WHERE id = device_id` via async session
    - If None OR `device.revoked_at is not None` → 401 (D-14)
    - Return the SignageDevice row

    **rate_limit.py** — Create `backend/app/security/rate_limit.py` following RESEARCH.md lines 256-292. Key points:

    - Module-level `_WINDOW_S = 60.0`, `_LIMIT = 5`
    - Module-level `_buckets: dict[str, deque[float]] = defaultdict(lambda: deque(maxlen=_LIMIT + 1))`
    - Module-level `_lock = asyncio.Lock()`
    - Private `_client_ip(request: Request) -> str:` returns `request.client.host if request.client else "unknown"` (D-10 default; no X-Forwarded-For parsing — document inline that if a reverse proxy is introduced, this helper must gain a trusted-proxy-IP allowlist)
    - `async def rate_limit_pair_request(request: Request) -> None:` — uses `time.monotonic()`, prunes entries older than `_WINDOW_S`, raises HTTPException(429) with `Retry-After: str(int(_WINDOW_S))` header and detail `"too many pairing requests from this IP"` when window is full, else appends and returns
    - Expose a test-only `_reset_for_tests()` helper that clears `_buckets` (or test uses `_buckets.clear()` directly — planner prefers helper for discoverability)

    Inline comment block in rate_limit.py noting D-09 viability requires `--workers 1` invariant (cross-cutting hazard #4).

    **Tests** — Author both test files covering behavior above. Use FastAPI's `TestClient` with a dummy endpoint `POST /_test/rate-limited` mounted via `dependencies=[Depends(rate_limit_pair_request)]` for rate_limit tests. For device_auth tests, mint test JWTs via `mint_device_jwt` from Task 2 and seed SignageDevice rows via the existing async session fixture (pattern from `test_signage_schema_roundtrip.py` — verify during execution).

    Do NOT write anywhere to `signage_devices.device_token_hash` — that legacy column stays null under the JWT format (anti-pattern flagged in RESEARCH).
  </action>
  <verify>
    <automated>cd backend &amp;&amp; python -m pytest tests/test_device_auth.py tests/test_rate_limit.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "async def get_current_device" backend/app/security/device_auth.py
    - grep -q 'algorithms=\["HS256"\]' backend/app/security/device_auth.py
    - grep -q 'payload.get("scope") != "device"' backend/app/security/device_auth.py
    - grep -q "revoked_at is not None" backend/app/security/device_auth.py
    - grep -q "HTTPBearer(auto_error=False)" backend/app/security/device_auth.py
    - grep -q "async def rate_limit_pair_request" backend/app/security/rate_limit.py
    - grep -q "deque" backend/app/security/rate_limit.py
    - grep -q "asyncio.Lock" backend/app/security/rate_limit.py
    - grep -q "429" backend/app/security/rate_limit.py
    - grep -q "Retry-After" backend/app/security/rate_limit.py
    - grep -q -- "--workers 1" backend/app/security/rate_limit.py
    - No write to device_token_hash: `! grep -r "device_token_hash" backend/app/security/ backend/app/services/signage_pairing.py`
    - pytest passes all cases in test_device_auth.py and test_rate_limit.py
  </acceptance_criteria>
  <done>get_current_device and rate_limit_pair_request deps exist, mirror directus_auth.py conventions, and pass unit + integration-style tests; revoked devices get 401 per D-14; rate limiter returns 429 + Retry-After at the 6th request.</done>
</task>

</tasks>

<verification>
- `python -c "from app.security.device_auth import get_current_device; from app.security.rate_limit import rate_limit_pair_request; from app.services.signage_pairing import generate_pairing_code, mint_device_jwt"` imports cleanly
- All three new test files pass: `pytest tests/test_signage_pairing_service.py tests/test_device_auth.py tests/test_rate_limit.py -v`
- `SIGNAGE_DEVICE_JWT_SECRET` is loaded by `app.config.settings`
- No use of `random.choice` or `import random` in any new file
- No writes to `signage_devices.device_token_hash`
</verification>

<success_criteria>
- Foundations for Wave 2 are in place: router can import `rate_limit_pair_request` and pairing service helpers; Phase 43 can import `get_current_device`
- SGN-BE-04 is feature-complete and test-covered
- New env var is declared, documented, and fail-fast
- All unit tests pass under `--workers 1` model (no external rate-limit store)
</success_criteria>

<output>
Create `.planning/phases/42-device-auth-pairing-flow/42-01-device-auth-foundations-SUMMARY.md` summarizing what was implemented, which SGN-BE-04 acceptance tests pass, and any deviations from the plan.
</output>
