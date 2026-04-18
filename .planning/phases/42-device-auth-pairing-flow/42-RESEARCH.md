# Phase 42: Device Auth + Pairing Flow — Research

**Researched:** 2026-04-18
**Domain:** FastAPI auth dependency + pairing handshake + APScheduler cleanup (backend-only)
**Confidence:** HIGH

## Summary

Phase 42 delivers three routes (`POST /api/signage/pair/request`, `GET /pair/status`, `POST /pair/claim`), one reusable FastAPI dependency (`get_current_device`), one APScheduler cron job (pairing cleanup at 03:00 UTC), and a "Revoke device" admin endpoint. The CONTEXT.md locks almost every decision — this research confirms those decisions against project infrastructure, current library versions, and the established v1.15 patterns, and resolves the three items marked "Claude's Discretion".

All locked decisions (D-01..D-16) align with existing codebase conventions: PyJWT 2.10.1 is already pinned and imported in `directus_auth.py`, APScheduler 3.11.2 lifespan is already set up with the 03:00 UTC cron slot, `require_admin` and `get_current_user` ship from `app.security.directus_auth`, Pydantic DTOs for the pairing flow are already drafted in `app.schemas.signage`, and the partial-unique index on pairing codes was landed in Phase 41. There is no library-selection or greenfield architecture work — this phase is composition, not invention.

**Primary recommendation:** Reuse PyJWT 2.10.1 (already in `requirements.txt`, used identically in `directus_auth.py`); mirror the sensor-router structure from `backend/app/routers/sensors.py`; register the pairing-cleanup job as a second `CronTrigger(hour=3, minute=0, timezone=timezone.utc)` in `scheduler.py` alongside `SENSOR_RETENTION_JOB_ID`. Pairing code alphabet: **Crockford-style 31-char set `23456789ABCDEFGHJKMNPQRSTUVWXYZ`** (31⁶ ≈ 887M, excludes `0/O/1/I/L/U`). Single-consume semantic for `/pair/status` post-claim: **`DELETE signage_pairing_sessions WHERE id=:id RETURNING *` during the status-return transaction** — row-delete-on-deliver is the cleanest atomic primitive and collapses "consumed" into "not found → return 404 or `{status: expired}`". Planner picks the exact wire-level response shape.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Device authentication**
- **D-01:** Device token format is a scoped JWT — `{sub: device_id, scope: "device", iat, exp}`, HS256, 24h TTL. Verifying middleware checks signature + `signage_devices.revoked_at IS NULL` on every request. Follows PITFALLS §21 recommendation.
- **D-02:** No rotation — fixed 24h JWT, re-issued only at re-pair. Small-fleet (≤5 devices) scope does not justify rotate-on-heartbeat complexity; admin "Revoke device" + re-pair is the kill path.
- **D-03:** Token transport is `Authorization: Bearer <token>` header (not HttpOnly cookie). Matches existing admin auth style; keeps SSE (Phase 45) simple.
- **D-04:** JWT-signing secret is a new environment variable `SIGNAGE_DEVICE_JWT_SECRET` (separate from Directus JWT secret — different trust domain, different rotation cadence). HS256 is sufficient given single-process verification.

**Pairing flow**
- **D-05:** Pairing code format is `XXX-XXX` (6 chars, dash-separated) per ROADMAP SC #1. Alphabet: unambiguous subset (exclude `O/0/1/I/L`) — researcher confirms below. TTL 600s (10 min).
- **D-06:** `POST /pair/claim` uses a single atomic `UPDATE ... WHERE code=:code AND claimed_at IS NULL RETURNING *` (PITFALLS §13). Partial-unique index on `code` guarantees at most one active row per code.
- **D-07:** Pair-status polling cadence is 3 seconds from the Pi.
- **D-08:** After a successful `/pair/claim`, the very next `GET /pair/status` returns `{status: "claimed", device_token: "..."}` exactly once; subsequent polls return `{status: "claimed_consumed"}` or equivalent (researcher confirms below).

**Rate limiting**
- **D-09:** Rate-limit backing is an in-process `{ip: deque[timestamp]}` with `asyncio.Lock` — no new dependencies. Viable under `--workers 1`. Cap: 5 requests/minute per source IP on `POST /pair/request` only.
- **D-10:** Client IP resolution respects existing reverse-proxy semantics — researcher verifies below. Default to `request.client.host` if no proxy header is trusted.

**Pairing cleanup cron**
- **D-11:** Cleanup job reuses the existing 03:00 UTC APScheduler slot. `coalesce=True`, `max_instances=1`, `misfire_grace_time=30/300`, wrapped in `asyncio.wait_for` — mirror the v1.15 pattern.
- **D-12:** Deletion predicate is `expires_at < now() - interval '24 hours'` — 24-hour grace window per ROADMAP SC #4.
- **D-13:** This cron is a correctness requirement — it carries the expiration half of SGN-DB-02. Document inline.

**Revocation**
- **D-14:** Admin "Revoke device" = `UPDATE signage_devices SET revoked_at = now() WHERE id = :id`. `get_current_device` dep checks `revoked_at IS NULL`. Revoked devices get 401.

**Router wiring**
- **D-15:** `signage_pair` router mounted under `/api/signage/pair`. `/request` and `/status` have no auth dep; `/claim` uses `Depends(get_current_user), Depends(require_admin)`.
- **D-16:** `/api/signage/player/*` routes (Phase 43) will use `Depends(get_current_device)` — the dep is landed in Phase 42.

### Claude's Discretion

- Exact JWT library — `python-jose` vs `PyJWT` vs `authlib`. **Resolved here: PyJWT 2.10.1** (already pinned, already used in `directus_auth.py`).
- Pairing code alphabet — user accepts "unambiguous subset". **Resolved here: `23456789ABCDEFGHJKMNPQRSTUVWXYZ`** (Crockford-derived, 31 chars).
- Single-consume semantic for `/pair/status` after claim. **Resolved here: delete-row-on-deliver** inside the same transaction that returns the token; subsequent polls hit the "row not found" branch and return `{status: "expired"}` (or 404 — planner picks).
- Error-response shapes (401 vs 403 boundaries beyond revoked-device) — follow existing FastAPI/Directus conventions in `backend/app/security/`.

### Deferred Ideas (OUT OF SCOPE)

- **Rotate-on-heartbeat token rotation** — considered and rejected for small-fleet scope; revisit if fleet grows past ~20 devices or a leak incident drives it.
- **HttpOnly cookie transport** — considered and rejected; revisit together with HTML-snippet sanitizer hardening in Phase 43+.
- **`slowapi` dependency** — rejected in favor of in-process deque; revisit if `--workers 1` invariant is ever relaxed.
- **Media-download token scoping** (PITFALLS §21 "per-request short-lived tokens derived from device token") — not in Phase 42 scope; belongs in Phase 43 or later.
- **Admin audit log for `/pair/claim`** — not in Phase 42 success criteria; could land in Phase 46 or a future observability phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SGN-BE-03 | `backend/app/routers/signage_pair.py` (unauthenticated) — `POST /request`, `GET /status`; admin-gated `POST /claim` | Router composition mirrors `sensors.py`; `/request` and `/status` have no `dependencies=[...]`; `/claim` uses per-endpoint `Depends(get_current_user), Depends(require_admin)` (D-15). Atomic claim pattern in PITFALLS §13. |
| SGN-BE-04 | `backend/app/security/device_auth.py` — `get_current_device` dep resolving `Authorization: Bearer <device_token>` | PITFALLS §21 scoped JWT pattern (D-01). PyJWT 2.10.1 already in stack; verification pattern mirrors `directus_auth.get_current_user` exactly, plus an extra `SELECT revoked_at` round-trip (D-14). |
| SGN-SCH-02 | Daily pairing session cleanup (reuse 03:00 UTC cron slot from v1.15 retention job) — deletes expired `signage_pairing_sessions` rows | Existing `scheduler.py` already has `CronTrigger(hour=3, minute=0, timezone=timezone.utc)` registration for `SENSOR_RETENTION_JOB_ID`. Add `PAIRING_CLEANUP_JOB_ID` with the same pattern (`coalesce=True`, `max_instances=1`, `misfire_grace_time=300`). This is the **expiration invariant carrier** for SGN-DB-02 per D-13. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **FastAPI 0.135.3 / SQLAlchemy 2.0.49 async + asyncpg / Alembic 1.18.4** — no sync session mixing, no `Base.metadata.create_all()` bypass.
- **PostgreSQL 17-alpine** — pinned Docker image tag.
- **Pydantic v2** — DTOs use `model_config = {"from_attributes": True}` (already the style in `schemas/signage.py`).
- **Docker Compose healthcheck pattern** — env-var changes require editing `docker-compose.yml` AND `.env.example` (documented convention).
- **No `dark:` Tailwind variants / no direct `fetch()`** — not relevant here (backend-only phase).
- **GSD workflow enforcement** — edits only via `/gsd:execute-phase`.

## v1.16 Cross-Cutting Hazards Applicable to Phase 42

From ROADMAP.md §"v1.16 Cross-Cutting Hazards":

1. **`--workers 1` invariant preserved** — HARD GATE. In-process rate-limit deque (D-09) and APScheduler singleton (D-11) both depend on this. `docker-compose.yml` line 30 already reads `--workers 1`.
2. **Router-level admin gate via `APIRouter(dependencies=[...])` is the *usual* pattern, but Phase 42 is an intentional exception** — `signage_pair` has two unauthenticated routes (`/request`, `/status`) alongside one admin route (`/claim`). Per-endpoint `Depends(require_admin)` on `/claim` is correct here; ROADMAP SC #3 explicitly tests this. **Document inline that this is an intentional exception** to the cross-cutting hazard so Phase 43's dep-audit test (SGN-BE-09) is written to permit it.
3. **No `import sqlite3` / no `import psycopg2`** — not at risk; backend is async SQLAlchemy + asyncpg.
4. **No sync `subprocess.run`** — not at risk; Phase 42 has no subprocess calls.

## Standard Stack

### Core (all already in `backend/requirements.txt`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.135.3 | Router, `HTTPBearer` credentials extraction, `Depends()` composition | Already canonical in repo; `sensors.py` + `directus_auth.py` are exact templates |
| PyJWT | 2.10.1 | HS256 encode/decode of scoped device JWT | Already pinned; already used in `directus_auth.py` line 3 (`import jwt`). `jwt.encode` + `jwt.decode(..., algorithms=["HS256"])` is the exact surface needed |
| SQLAlchemy | 2.0.49 | Async ORM — `session.execute(update(...).returning(...))` for the atomic claim | 2.0 async API is the project standard |
| asyncpg | 0.31.0 | Async PG driver underneath SQLAlchemy | Already wired |
| APScheduler | 3.11.2 | `CronTrigger(hour=3, minute=0, timezone=timezone.utc)` for cleanup job | Already initialized in `scheduler.lifespan`; second `add_job` alongside `SENSOR_RETENTION_JOB_ID` |
| pydantic-settings | 2.9.1 | `BaseSettings` — add `SIGNAGE_DEVICE_JWT_SECRET` field to `app.config.Settings` | Already the pattern for `DIRECTUS_SECRET` |
| Pydantic v2 | >=2.9.0 | `SignagePairingRequestResponse`, `SignagePairingStatusResponse`, `SignagePairingClaimRequest` | **Already drafted** in `app/schemas/signage.py` lines 152–178 — Phase 42 consumes them unchanged |

**Version verification note (2026-04-18):** PyPI currently publishes PyJWT 2.12.1 (2026-03-13); project pins 2.10.1. **Do not upgrade in this phase** — pinning policy is owned by a separate upgrade-sweep task; use what's in the lockfile. The 2.10 → 2.12 delta is non-breaking for HS256 encode/decode.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `secrets` (stdlib) | — | `secrets.choice(alphabet)` for pairing-code generation; `secrets.token_urlsafe` NOT used (JWT is the token) | Every code generation call; never `random.choice` |
| `collections.deque` (stdlib) | — | Rate-limit sliding window per IP | In-process store under `asyncio.Lock` (D-09) |
| `asyncio.Lock` (stdlib) | — | Guard deque mutations | Compose inside the rate-limit dependency |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PyJWT | `python-jose[cryptography]` | python-jose supports JWE/JWS; overkill for HS256; NOT in project. Adding it creates import inconsistency with `directus_auth.py`. |
| PyJWT | `authlib` | Full OAuth/OIDC framework; bloat for a single HS256 encode/decode. |
| In-process deque | `slowapi` | Adds a dependency + Redis/memory backend; unnecessary for one endpoint at 5 req/min. Rejected in D-09. |
| JWT device token | Opaque `secrets.token_urlsafe(32)` sha256-hashed | Requires extra DB column + lookup per request; JWT is self-contained with signature verification in < 1ms. Rejected in D-01. |
| Row-delete-on-deliver | Add `claimed_consumed_at` column + status enum expansion | Extra migration; ORM complexity; row-delete is atomic and simpler. |

**Installation:** Nothing new to pip install. Only addition: one environment variable (`SIGNAGE_DEVICE_JWT_SECRET`).

## Architecture Patterns

### Recommended File Layout (additions only)

```
backend/app/
├── security/
│   ├── directus_auth.py          # existing — get_current_user, require_admin (reused)
│   ├── device_auth.py            # NEW — get_current_device dep (SGN-BE-04)
│   └── rate_limit.py             # NEW — in-process IP deque + asyncio.Lock (D-09)
├── routers/
│   └── signage_pair.py           # NEW — POST /request, GET /status, POST /claim (SGN-BE-03)
├── services/
│   └── signage_pairing.py        # NEW (optional) — pure-function code generator + token minter
├── scheduler.py                  # EDIT — add PAIRING_CLEANUP_JOB_ID + _run_pairing_cleanup()
├── main.py                       # EDIT — app.include_router(signage_pair_router)
└── config.py                     # EDIT — add SIGNAGE_DEVICE_JWT_SECRET: str
```

### Pattern 1: Scoped JWT dependency (PITFALLS §21)

**What:** FastAPI dependency that resolves `Authorization: Bearer <token>` → `SignageDevice` ORM row, rejecting unsigned/expired/revoked/wrong-scope tokens.
**When to use:** `/api/signage/player/*` routes in Phase 43 via `Depends(get_current_device)`.
**Example:**
```python
# Source: mirrors backend/app/security/directus_auth.py pattern + PITFALLS §21 spec
# backend/app/security/device_auth.py
from uuid import UUID
import jwt  # PyJWT 2.10.1 — same import as directus_auth
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_async_db_session
from app.models import SignageDevice

_bearer = HTTPBearer(auto_error=False)

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="invalid or missing device token",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_device(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_async_db_session),
) -> SignageDevice:
    if credentials is None or not credentials.credentials:
        raise _UNAUTHORIZED
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SIGNAGE_DEVICE_JWT_SECRET,
            algorithms=["HS256"],
        )
    except jwt.PyJWTError:
        raise _UNAUTHORIZED

    if payload.get("scope") != "device":
        raise _UNAUTHORIZED  # 401 per D-14: token no longer valid for us

    sub = payload.get("sub")
    try:
        device_id = UUID(sub)
    except (ValueError, TypeError):
        raise _UNAUTHORIZED

    result = await db.execute(
        select(SignageDevice).where(SignageDevice.id == device_id)
    )
    device = result.scalar_one_or_none()
    if device is None or device.revoked_at is not None:
        raise _UNAUTHORIZED
    return device
```

**Key point on D-14 "401 vs 403":** CONTEXT locks 401 for revoked — mirror that shape here (the token signature may still be valid, but we treat the token as no-longer-valid once `revoked_at` is set, rather than as scope-mismatched).

### Pattern 2: Atomic claim (PITFALLS §13, §14)

**What:** Single `UPDATE … RETURNING` under the partial-unique index; race-free by construction.
**When to use:** `POST /pair/claim` handler.
**Example:**
```python
# Source: PITFALLS §13 pattern + SQLAlchemy 2.0 async idiom
from datetime import datetime, timezone
from sqlalchemy import update
from app.models import SignagePairingSession, SignageDevice

async def claim_pairing_session(
    db: AsyncSession, code: str, device_name: str, tag_ids: list[int] | None
) -> SignageDevice:
    # 1. Create the device row first (claim binds session → device)
    device = SignageDevice(name=device_name, status="pending")
    db.add(device)
    await db.flush()  # populate device.id without committing

    # 2. Atomic claim — guarded by partial-unique index (claimed_at IS NULL)
    stmt = (
        update(SignagePairingSession)
        .where(SignagePairingSession.code == code)
        .where(SignagePairingSession.claimed_at.is_(None))
        .where(SignagePairingSession.expires_at > datetime.now(timezone.utc))
        .values(claimed_at=func.now(), device_id=device.id)
        .returning(SignagePairingSession)
    )
    result = await db.execute(stmt)
    session_row = result.scalar_one_or_none()
    if session_row is None:
        await db.rollback()
        raise HTTPException(404, "pairing code invalid, expired, or already claimed")

    await db.commit()
    return device
```

**IMPORTANT — SGN-DB-02 amendment:** The partial-unique predicate on `signage_pairing_sessions.code` is `WHERE claimed_at IS NULL` (not `expires_at > now() AND claimed_at IS NULL` — Postgres forbids `now()` in IMMUTABLE partial predicates, rejected errcode 42P17). The `expires_at > now()` check **must be carried in the WHERE clause of the claim UPDATE** (see above), not relied on from the index. Two expired-but-unclaimed rows for the same code CAN co-exist until the cleanup cron runs — this is fine because only one will satisfy `expires_at > now()` in the claim UPDATE.

### Pattern 3: In-process sliding-window rate limit (D-09)

**What:** `{ip: deque[float]}` where each entry is a Unix timestamp; prune entries older than 60s on every hit; reject when `len(window) >= 5`.
**When to use:** FastAPI dependency mounted only on `POST /pair/request`.
**Example:**
```python
# Source: designed from D-09 spec + asyncio.Lock stdlib pattern
# backend/app/security/rate_limit.py
import asyncio
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

_WINDOW_S = 60.0
_LIMIT = 5

_buckets: dict[str, deque[float]] = defaultdict(lambda: deque(maxlen=_LIMIT + 1))
_lock = asyncio.Lock()


def _client_ip(request: Request) -> str:
    # D-10: default to request.client.host unless a trusted proxy header is configured.
    # See "Proxy header verification" section below for current infra posture.
    return request.client.host if request.client else "unknown"


async def rate_limit_pair_request(request: Request) -> None:
    now = time.monotonic()
    ip = _client_ip(request)
    async with _lock:
        window = _buckets[ip]
        # prune old entries
        while window and (now - window[0]) > _WINDOW_S:
            window.popleft()
        if len(window) >= _LIMIT:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="too many pairing requests from this IP",
                headers={"Retry-After": str(int(_WINDOW_S))},
            )
        window.append(now)
```

**Memory note:** With `maxlen=_LIMIT + 1 = 6` the bucket is bounded per IP. The `defaultdict` itself grows unboundedly over time. Mitigation: periodic GC of empty buckets inside the pairing cleanup cron (D-11). Add a tiny sweep that removes keys whose deque is empty after pruning. Alternatively ignore — the ceiling is ~100 IPs × 6 floats ≈ trivial — and document it as tech debt.

### Pattern 4: Cron job registration in existing scheduler (D-11, D-13)

**What:** Add a second `CronTrigger(hour=3, minute=0)` job alongside the v1.15 retention cron.
**When to use:** Inside `scheduler.lifespan()`, after the existing retention job registration.
**Example:**
```python
# Source: backend/app/scheduler.py lines 241-249 pattern
PAIRING_CLEANUP_JOB_ID = "signage_pairing_cleanup"


async def _run_signage_pairing_cleanup() -> None:
    """D-12: delete expired pairing sessions older than 24h.

    D-13: This cron carries the expiration invariant for SGN-DB-02
    (partial-unique predicate cannot reference now() — Postgres 42P17).
    It is a correctness requirement, not a cosmetic nicety.
    """
    from app.models import SignagePairingSession
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


# Registration alongside SENSOR_RETENTION_JOB_ID in lifespan:
scheduler.add_job(
    _run_signage_pairing_cleanup,
    trigger=CronTrigger(hour=3, minute=0, timezone=timezone.utc),
    id=PAIRING_CLEANUP_JOB_ID,
    replace_existing=True,
    max_instances=1,
    coalesce=True,
    misfire_grace_time=300,
)
```

### Anti-Patterns to Avoid

- **Using `random.choice` for code generation** — `random` is not cryptographically secure. **Use `secrets.choice`** exclusively (std-lib; zero deps).
- **Querying `signage_devices` by token string** — tokens are JWTs. The DB has `device_token_hash` as a legacy field (line 175 in `models/signage.py`), but D-01 locks JWT format. **Do NOT write tokens to `device_token_hash`** in Phase 42 — it stays nullable/null.
- **Returning the token on every `/pair/status` poll after claim** — violates the "exactly once" contract in ROADMAP SC #1. Token must be returned only on the first post-claim status poll; subsequent polls must NOT leak it.
- **Running the cleanup inside the API worker without `asyncio.wait_for`** — a stuck delete would block the event loop. Mirror the `asyncio.wait_for` wrapper from `_run_scheduled_sensor_poll`.
- **Catching `jwt.PyJWTError` and returning 400** — PyJWT bundles multiple exception types (`ExpiredSignatureError`, `InvalidSignatureError`, `DecodeError`). All of them map to 401. Always catch the base class and return 401, matching `directus_auth.py` line 39.
- **Using `random` anywhere** — `secrets` module only.
- **Duplicating `HTTPBearer` with `auto_error=True`** — the project convention is `auto_error=False` + explicit raise (line 11 of `directus_auth.py`) so we control the error shape.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT encode/decode + signature verification | Custom HMAC/base64url | **PyJWT 2.10.1** | PyJWT handles header/claims/exp/nbf parsing, constant-time signature compare, and a dozen edge cases around alg confusion. Already in the stack. |
| Bearer-token extraction from `Authorization` header | Custom regex on `request.headers` | **`fastapi.security.HTTPBearer`** | Parses `Authorization: Bearer <token>`, auto-hands-back `HTTPAuthorizationCredentials`, composable with `Depends`. Used already in `directus_auth.py`. |
| Cron expression evaluation | Custom time comparison in a background task | **APScheduler `CronTrigger`** | Already in the stack (3.11.2); handles TZ, DST, misfire semantics, coalescing. |
| Cryptographically-secure random selection | `random.SystemRandom` indirection | **`secrets.choice`** | stdlib; purpose-built for this. |
| Atomic "claim a row if unclaimed" semantics | `SELECT … FOR UPDATE` + separate `UPDATE` | **`UPDATE … WHERE claimed_at IS NULL RETURNING *`** | Single round-trip, race-free by partial-unique-index construction (PITFALLS §13). |
| Rate-limit sliding window | Redis / external store | **In-process `deque` + `asyncio.Lock`** | `--workers 1` invariant makes this viable; zero new deps (D-09). |
| Env config loading | Manual `os.environ.get` | **`pydantic_settings.BaseSettings`** | Already in `app/config.py`; type coercion + validation built in. |
| Pydantic DTOs for request/response | Hand-written dicts | **`app.schemas.signage.SignagePairing*`** | Already drafted in Phase 41 (lines 152–178). Reuse verbatim. |

**Key insight:** Phase 42 is almost entirely glue code over already-installed primitives. No new dependencies should land.

## Runtime State Inventory

Not applicable — Phase 42 is greenfield within an already-greenfield domain (Phase 41 created the `signage_pairing_sessions` and `signage_devices` tables; they are empty in production). No rename, no refactor, no migration of existing data.

- **Stored data:** None — pairing sessions and devices tables are empty (first use is in this phase).
- **Live service config:** None — no external services embed this phase's identifiers.
- **OS-registered state:** None.
- **Secrets/env vars:** **One new secret required** — `SIGNAGE_DEVICE_JWT_SECRET`. Must be added to `.env`, `.env.example`, `docker-compose.yml` (`api` service environment block), and `app/config.py` `Settings`. Generate with `python -c "import secrets; print(secrets.token_urlsafe(64))"`. This is a code-edit + env-var addition, not a data migration.
- **Build artifacts:** None — no Dockerfile layer changes (no new apt/pip deps).

## Common Pitfalls

### Pitfall 1: JWT `algorithms=["HS256"]` omitted on decode (alg-confusion attack)

**What goes wrong:** If you call `jwt.decode(token, secret)` without `algorithms=`, PyJWT raises by default in 2.x but older guidance is inconsistent. Worse: if the list includes `"none"` or asymmetric algs, an attacker can forge tokens.

**Why it happens:** Copy-paste from outdated blog posts; defaults change across PyJWT majors.

**How to avoid:** ALWAYS pass `algorithms=["HS256"]` explicitly. `directus_auth.py` line 38 does this — mirror it exactly.

**Warning signs:** Tests pass but a token signed with a different alg verifies successfully.

### Pitfall 2: Returning the device JWT on every `/pair/status` poll

**What goes wrong:** A curious operator scrolls through the logs and sees the full token on dozens of polls. ROADMAP SC #1 says "exactly once" for a reason.

**Why it happens:** Developer writes the simplest `SELECT … RETURN DTO` path without thinking about idempotency.

**How to avoid:** Delete-on-deliver (recommended) or gate with a `claimed_consumed_at` column. The delete path is cleaner because it also GCs the row. Implement inside the same transaction that returns the token:

```python
# pseudo-code for /pair/status after claim is detected
if session_row.claimed_at is not None and session_row.device_id is not None:
    # mint token, then DELETE row in same txn
    token = mint_device_jwt(session_row.device_id)
    await db.execute(
        delete(SignagePairingSession).where(SignagePairingSession.id == session_row.id)
    )
    await db.commit()
    return SignagePairingStatusResponse(status="claimed", device_token=token)
```

Subsequent polls → `scalar_one_or_none()` returns None → return `{status: "expired"}` (or 404 — planner picks; test ergonomics favor the 200 + `expired` shape because the Pi already has a polling state machine for `expired`).

**Warning signs:** Token appears in API access logs more than once per pairing; integration test asserting "exactly once" fails.

### Pitfall 3: Pairing race — Pi polls `/status` before admin commit lands

**What goes wrong:** Pi polls at T=0.1s, admin claim commits at T=0.2s; Pi sees `pending`, retries 3s later, eventually sees `claimed`. Benign. **Real risk:** Pi polls with a UUID that doesn't exist → naively returns 404 → Pi thinks pairing failed and regenerates a new code, abandoning a valid one.

**Why it happens:** Non-existence is overloaded — does it mean "code never existed" or "code expired mid-poll"?

**How to avoid:** `GET /pair/status` keys on `pairing_session_id` (UUID), not `code`. UUIDs don't collide. A missing row after a successful `/request` means either consumed (delete-on-deliver) or expired (cron swept it). Treat both as `{status: "expired"}` and let the Pi regenerate.

**Warning signs:** Pi UI flickers between `pending` and `expired`; duplicate codes in the DB.

### Pitfall 4: `request.client.host` behind a reverse proxy yields the proxy IP, not the Pi

**What goes wrong:** If the API is deployed behind nginx/Traefik/Cloudflare, `request.client.host` returns `127.0.0.1` or the proxy's IP. Rate limit becomes "5 req/min total" instead of "5 req/min per Pi".

**Why it happens:** `request.client` reads the direct TCP socket peer, not `X-Forwarded-For`.

**Proxy header verification (current infra):** `docker-compose.yml` publishes the API on the Docker network with no explicit reverse proxy in front of it in the dev/compose topology. There is no ingress controller, no nginx/Traefik service in `docker-compose.yml`. **Default to `request.client.host` per D-10.** Add a TODO comment noting that if a production deployment fronts the API with a proxy, the client-IP helper must be updated to parse `X-Forwarded-For` with a trusted-proxy allowlist (anything else is trivially spoofable).

**How to avoid:** Document the assumption inline in `rate_limit.py`; gate any `X-Forwarded-For` parsing behind an explicit config flag + trusted-proxy-IP list.

**Warning signs:** Rate-limit triggers fire for traffic from unrelated Pis once any reverse proxy is introduced.

### Pitfall 5: Cron job not carrying the expiration invariant

**What goes wrong:** Cleanup cron is skipped for a week (APScheduler jobstore lost, container restarted with `replace_existing=False`, misfire exceeded). Expired codes accumulate; partial-unique index prevents reuse of those codes; eventually `/pair/request` fails with index-collision retries.

**Why it happens:** SGN-DB-02 amendment (2026-04-18) moved the expiration check from the DB partial predicate into the cron. The cron is now correctness-load-bearing.

**How to avoid:** Document this inline in BOTH `scheduler.py` and `routers/signage_pair.py`. Add a startup log line on cron registration. Consider adding a smoke test that seeds an expired-unclaimed row and asserts the cron deletes it (ROADMAP SC #4).

**Warning signs:** `/pair/request` returns 500s after extended cron downtime; "code collision after 5 retries" log spam.

### Pitfall 6: Pairing code collision retry loop exhausts itself

**What goes wrong:** Generation code retries up to 5 times on `IntegrityError`; under adversarial or high-birthday-bound conditions, 5 retries isn't enough and `/pair/request` returns 500.

**Why it happens:** 31⁶ ≈ 887M codes; at 5 active devices the expected collisions are negligible. But if the cron has been failing (Pitfall 5), active-unclaimed set balloons.

**How to avoid:** Use 31-char alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (see below); on 5 retries, return a 503 with `Retry-After: 60` rather than a 500 — it's not a bug, it's saturation. Log a warning so ops notices.

**Warning signs:** 500 response body includes "IntegrityError" string; same pattern repeats.

### Pitfall 7: JWT secret rotation makes all devices dark

**What goes wrong:** Admin rotates `SIGNAGE_DEVICE_JWT_SECRET` for hygiene; every device's existing token immediately fails signature verification; every Pi falls back to the pairing screen until re-claimed manually.

**Why it happens:** HS256 symmetric key; no JWKS / kid header to support overlapping keys.

**How to avoid:** Document that secret rotation is a fleet-wide kill-switch. For a ≤5 device fleet, this is acceptable. If the fleet grows, revisit (kid header + 2-key rolling scheme). Flag in admin docs (Phase 48 owns this).

**Warning signs:** "Why did all my devices go offline after I changed the .env?" support ticket.

## Code Examples

### Pairing Code Generation (Crockford-derived alphabet)

```python
# Source: Crockford base32 spec (https://www.crockford.com/base32.html)
# trimmed to exclude U (which Crockford includes but reads as V) for v1.16 UX.
# Stdlib secrets per OWASP guidance.
import secrets

# 31 chars: 23456789 (8 digits) + ABCDEFGHJKMNPQRSTUVWXYZ (23 letters)
# Excluded: 0 (→ O), 1 (→ I/L), O, I, L — the five visually confusing glyphs
# named in CONTEXT D-05. Kept U despite Crockford's usual exclusion — we render
# in a sans-serif kiosk font where U is unambiguous; 31 > 30 keeps entropy
# comfortably above 30 bits for a 6-char code (log2(31**6) ≈ 29.7 bits).
PAIRING_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
assert len(PAIRING_ALPHABET) == 31


def generate_pairing_code() -> str:
    """Return a 6-char uppercase code. 31**6 ≈ 887M combinations."""
    return "".join(secrets.choice(PAIRING_ALPHABET) for _ in range(6))


def format_for_display(code: str) -> str:
    """XXX-XXX display format (matches ROADMAP SC #1 + SGN-PLY-03)."""
    assert len(code) == 6
    return f"{code[:3]}-{code[3:]}"
```

**Collision math:** For 5 active pairing sessions simultaneously, probability of a birthday-paradox collision at code generation is ≈ 5² / (2 × 31⁶) ≈ 1.4e-8. Negligible. The partial-unique index + 5-retry loop is still required (defense in depth), but won't trip in practice.

**Planner note on D-05 scope:** CONTEXT excludes `O/0/1/I/L` — the alphabet above matches. `U` retained: Crockford also excludes U to prevent profanity in generated strings, but (a) we render as 3 chars per half so profanity is near-impossible, (b) excluding U drops alphabet to 30 chars with no meaningful UX gain. Planner may downgrade to 30 chars if team has a documented preference — no functional difference.

### JWT Minting

```python
# Source: PyJWT 2.x docs + PITFALLS §21 claim spec
from datetime import datetime, timedelta, timezone
import jwt  # PyJWT 2.10.1
from uuid import UUID

from app.config import settings

DEVICE_JWT_TTL_HOURS = 24


def mint_device_jwt(device_id: UUID) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(device_id),
        "scope": "device",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=DEVICE_JWT_TTL_HOURS)).timestamp()),
    }
    return jwt.encode(payload, settings.SIGNAGE_DEVICE_JWT_SECRET, algorithm="HS256")
```

### Router Skeleton (structural only; planner fills in)

```python
# Source: mirrors backend/app/routers/sensors.py structure
# backend/app/routers/signage_pair.py
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.schemas.signage import (
    SignagePairingRequestResponse,
    SignagePairingStatusResponse,
    SignagePairingClaimRequest,
)
from app.security.directus_auth import get_current_user, require_admin
from app.security.rate_limit import rate_limit_pair_request

# D-15: intentionally NO router-level dependencies — per-endpoint gating
# because /request and /status are public; /claim is admin-only.
# Phase 43's dep-audit test (SGN-BE-09) documents this as an intentional
# exception to the cross-cutting "router-level admin gate" hazard.
router = APIRouter(prefix="/api/signage/pair", tags=["signage-pair"])


@router.post(
    "/request",
    response_model=SignagePairingRequestResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit_pair_request)],  # D-09
)
async def request_pairing_code(
    request: Request,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignagePairingRequestResponse:
    ...


@router.get("/status", response_model=SignagePairingStatusResponse)
async def pair_status(
    pairing_session_id: UUID,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignagePairingStatusResponse:
    ...


@router.post(
    "/claim",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(get_current_user), Depends(require_admin)],  # D-15
)
async def claim_pair(
    payload: SignagePairingClaimRequest,
    db: AsyncSession = Depends(get_async_db_session),
) -> None:
    ...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Opaque tokens in DB + per-request SELECT | Scoped self-contained JWT | Project decision in CONTEXT D-01 | Removes one DB round-trip on every player request; revocation via `revoked_at` SELECT is still required on each request to maintain PITFALLS §21 kill-switch, so the net saving is small but the code is cleaner. |
| `python-jose` | **PyJWT** for HS256 flows | PyJWT maintenance accelerated post-2024; python-jose slower-maintenance; FastAPI docs updated to PyJWT examples in 2025 | PyJWT is the current default; already pinned in this repo. |
| `SELECT … FOR UPDATE` + `UPDATE` for claim | `UPDATE … RETURNING` atomic | PostgreSQL 9.5+ has had this for years; 2020s idiom for single-row claim | One round-trip; race-free under partial-unique index. |
| `slowapi` / Redis-backed rate limit | In-process deque | `--workers 1` invariant lets single-process rate limits work | ~30 LOC vs. new dependency. |

**Deprecated/outdated:**
- `python-jose` for new HS256 code — prefer PyJWT.
- `random.choice` for any security-adjacent generation — always `secrets.choice`.

## Open Questions

1. **Should `/pair/status` on a missing row return 200 `{status: expired}` or 404?**
   - What we know: D-08 locks single-consume semantic; delete-on-deliver is the simplest implementation.
   - What's unclear: wire-level shape. 404 matches REST orthodoxy; 200 + `expired` matches the Pi's polling state machine which already has an `expired` branch.
   - **Recommendation:** 200 + `{status: "expired"}`. Rationale: (a) Pi's state machine (Phase 47 SGN-PLY-03) polls on a UUID it owns, so "not found" is never a Pi-error; (b) the `expired` state is already in `SignagePairingStatusResponse.status` Literal. Planner decides — both are valid.

2. **Should revoked-device responses be 401 or 403?**
   - What we know: D-14 locks 401.
   - What's unclear: CONTEXT explicitly says 401 — not unclear, just flagging.
   - **Recommendation:** 401 per D-14, matches `directus_auth.py` 401 on auth failures. The token-scope mismatch case (a Directus JWT hitting `/player/*`) is also 401 via `get_current_device`'s `payload.get("scope") != "device"` branch.

3. **Where does the "Revoke device" endpoint live?**
   - What we know: D-14 specifies the UPDATE; does not specify the route.
   - What's unclear: In Phase 42 as `PATCH /api/signage/devices/{id}/revoke` or deferred to Phase 43's device admin CRUD?
   - **Recommendation:** Phase 42 lands a minimal `POST /api/signage/pair/devices/{id}/revoke` or `PATCH /api/signage/devices/{id}` with `{revoked_at: now()}` — pick the simplest shape that satisfies ROADMAP SC #5. Phase 43 can later consolidate under the admin CRUD router. Planner picks. **This IS in Phase 42 scope** — CONTEXT `## Deliverables` line 15 explicitly includes "Admin 'revoke device' endpoint flipping `signage_devices.revoked_at`".

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.x (via backend container) | All | ✓ | 3.11+ (project standard) | — |
| PostgreSQL | pairing session storage, device lookup | ✓ | 17-alpine (Docker image) | — |
| PyJWT | JWT encode/decode | ✓ | 2.10.1 (pinned) | — |
| APScheduler | cron job | ✓ | 3.11.2 (pinned, already initialized) | — |
| SQLAlchemy async | DB ops | ✓ | 2.0.49 (pinned) | — |
| asyncpg | async PG driver | ✓ | 0.31.0 (pinned) | — |
| pydantic-settings | config | ✓ | 2.9.1 (pinned) | — |
| fastapi.security | `HTTPBearer` | ✓ | FastAPI 0.135.3 (pinned) | — |
| stdlib `secrets`, `collections.deque`, `asyncio.Lock` | code gen + rate limit | ✓ | stdlib | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.
**New env var required:** `SIGNAGE_DEVICE_JWT_SECRET` — add to `.env`, `.env.example`, `docker-compose.yml` `api` service env block, `app/config.Settings`.

## Validation Architecture

**Skipped per `.planning/config.json` — `workflow.nyquist_validation: false`.**

(The project uses its own verification model via `/gsd:verify-work` and Phase 43's dep-audit test SGN-BE-09. Phase 42 plans should still author unit + integration tests under `backend/tests/test_signage_pair_*` — the test-file convention is already established.)

## Sources

### Primary (HIGH confidence)

- `backend/app/security/directus_auth.py` — canonical template for FastAPI+PyJWT HS256 dep; verified in-repo.
- `backend/app/scheduler.py` (lines 114–249) — canonical template for 03:00 UTC cron + `asyncio.wait_for` guard; verified in-repo.
- `backend/app/routers/sensors.py` — canonical template for SQLAlchemy 2.0 async router with admin deps; verified in-repo.
- `backend/app/models/signage.py` — `SignagePairingSession`, `SignageDevice` ORM models; verified in-repo.
- `backend/app/schemas/signage.py` (lines 152–178) — `SignagePairing*` DTOs drafted in Phase 41; verified in-repo.
- `backend/requirements.txt` — PyJWT 2.10.1 confirmed pinned.
- `.planning/research/PITFALLS.md` §13 (lines 267–304) — pairing code + atomic claim spec.
- `.planning/research/PITFALLS.md` §21 (lines 417–431) — scoped JWT + revocation spec.
- `.planning/phases/41-signage-schema-models/41-05-round-trip-verification-SUMMARY.md` — SGN-DB-02 amendment; partial-predicate is `claimed_at IS NULL` only; cron now carries expiration.
- `.planning/ROADMAP.md` §"Phase 42" (lines 195–207) — 5 success criteria.
- [PyPI PyJWT](https://pypi.org/project/pyjwt/) — version 2.12.1 is current (2026-03-13); repo pins 2.10.1 (non-breaking delta for HS256).

### Secondary (MEDIUM confidence)

- [Crockford Base32 spec](https://www.crockford.com/base32.html) — basis for the 31/32-char unambiguous alphabet; cross-verified against OWASP secure-random guidance (stdlib `secrets`).
- PostgreSQL docs on partial indexes (errcode 42P17, "functions in index predicate must be marked IMMUTABLE") — referenced in SUMMARY.md; verified by the Phase 41 round-trip test regression.

### Tertiary (LOW confidence)

- None flagged — every recommendation is either a direct mirror of existing repo code or a CONTEXT-locked decision.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library is already pinned and imported elsewhere in this repo.
- Architecture: HIGH — two primary patterns (scoped JWT dep, atomic claim) are explicit in PITFALLS; third (cron) is a literal mirror of the v1.15 sensor retention job.
- Pitfalls: HIGH — six of the seven pitfalls flagged here are evidence-based from either project history (SGN-DB-02 amendment, v1.15 cron learnings) or well-documented generic JWT/pairing-flow gotchas.
- Code examples: HIGH — all examples mirror existing in-repo code or PITFALLS spec.

**Research date:** 2026-04-18
**Valid until:** ~2026-05-18 (30 days; stable stack, no dependency moving fast)
