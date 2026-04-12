# Phase 12: HR Schema & Personio Client - Research

**Researched:** 2026-04-12
**Domain:** SQLAlchemy models / Alembic migration for HR tables, Fernet credential encryption, httpx async Personio client
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Personio client_id and client_secret are encrypted at rest using Fernet symmetric encryption (`cryptography` library)
- **D-02:** Encryption key sourced from environment variable (e.g. `ENCRYPTION_KEY` or `FERNET_KEY`)
- **D-03:** Write-only enforced at the API layer — credentials never included in GET /api/settings responses (per PERS-01)
- **D-04:** Encrypted values stored as columns on the existing AppSettings singleton row
- **D-05:** All models remain in a single `models.py` file (no package split)
- **D-06:** Typed columns for all fields needed by KPI calculations (employee_id, department, hire_date, termination_date, hours, etc.)
- **D-07:** Additional `raw_json` JSONB column on each Personio table preserving the full API response for future use
- **D-08:** Tables: personio_employees, personio_attendances, personio_absences, personio_sync_meta (per research ARCHITECTURE.md)
- **D-09:** Custom exception hierarchy — `PersonioAuthError`, `PersonioRateLimitError`, `PersonioNetworkError`, `PersonioAPIError` (base)
- **D-10:** Specific, user-facing error messages — "Invalid credentials", "Rate limited, retry in Xs", "Personio unreachable (timeout)"
- **D-11:** Routers catch Personio exceptions and map to appropriate HTTP status codes
- **D-12:** Bearer token cached in-memory on the client instance (not persisted to DB)
- **D-13:** Proactive token refresh — check TTL before each request, re-authenticate if <60s remaining
- **D-14:** Token lost on container restart; re-authentication is a single cheap HTTP call

### Claude's Discretion

- Exact JSONB column naming and typed column selection for each HR table
- Exception class file location (inline in client module or separate exceptions module)
- Fernet key env var naming convention

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERS-01 | User can enter Personio API client_id and client_secret in Settings (masked display, write-only — never returned in GET responses) | D-01 through D-04: Fernet encryption, env-key sourcing, write-only API enforcement, storage on AppSettings singleton. Covered by credential storage and schema sections. |
| PERS-04 | Personio raw data (employees, attendances, absences) is fetched and stored in PostgreSQL | D-06 through D-08: typed columns + JSONB raw column on each table; httpx client authentication and data access patterns fully documented. Phase 12 scope = schema + client auth only; actual fetch/upsert loop is Phase 13. |

</phase_requirements>

---

## Summary

Phase 12 is a pure backend phase: it has zero frontend deliverables. The work is three tightly scoped tasks — database schema, credential encryption, and a testable Personio client. All three lay the foundation that Phase 13 (sync service, scheduler, HR API endpoints) depends on, so getting them right before advancing is the key objective.

The database schema task follows the fully established project pattern: SQLAlchemy 2.0 `Mapped[]` / `mapped_column()` models in the single `models.py`, one Alembic migration file, UPSERT-safe design (Personio native IDs as PKs). The only wrinkle is the JSONB `raw_json` column (D-07), which requires importing `JSONB` from `sqlalchemy.dialects.postgresql` — the same import path already used for `BYTEA`.

Credential encryption uses the `cryptography` library's `Fernet` class. The pattern is approximately 10 lines of code: load the base64-encoded key from an env var at module import, call `Fernet(key).encrypt(plaintext.encode())` on write and `Fernet(key).decrypt(ciphertext).decode()` on read. The ciphertext is stored as `LargeBinary` (maps to PostgreSQL `BYTEA`), consistent with the existing `logo_data` column pattern. The write-only contract for the settings API is enforced at the Pydantic layer by simply omitting the secret fields from `SettingsRead`.

The Personio client is a thin `httpx.AsyncClient` wrapper: POST to `https://api.personio.de/v1/auth`, cache the returned token on the instance with `expires_at = now + 86400s`, check TTL before each request (D-13 requires re-auth if <60 s remaining). The custom exception hierarchy (D-09) is straightforward: map HTTP 401 to `PersonioAuthError`, 429 to `PersonioRateLimitError`, `httpx.TimeoutException` to `PersonioNetworkError`, everything else to `PersonioAPIError`.

**Primary recommendation:** Write schema first (unblocks everything), then Fernet helpers, then the Personio client class. All three can be written, tested, and verified without a live Personio account.

---

## Standard Stack

### Core (new additions for Phase 12)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `cryptography` | 46.0.7 (latest) | Fernet symmetric encryption for credential storage | Locked by D-01. Industry-standard library; Fernet provides authenticated encryption (not just confidentiality) — prevents ciphertext tampering. Already installed in system env. |
| `httpx` | 0.28.1 (latest) | Async HTTP client for Personio API calls | Locked by STACK.md. AsyncClient integrates cleanly with FastAPI asyncio event loop. Latest stable as of Dec 2024; no newer release exists. |
| `APScheduler` | 3.11.2 | Interval scheduler (needed Phase 13, but added to requirements.txt this phase to avoid a second requirements change) | Verified in system env. 3.x branch is stable; 4.x is pre-release alpha. |

### Already Installed (no action needed)

| Library | Version | Role in this phase |
|---------|---------|-------------------|
| SQLAlchemy | 2.0.49 | New model classes, `Mapped[]` typing |
| Alembic | 1.18.4 | New migration file |
| asyncpg | 0.31.0 | Underlying PostgreSQL async driver (unchanged) |
| FastAPI | 0.135.3 | Settings router extension |
| Pydantic v2 | bundled with FastAPI | `SettingsUpdate` / `SettingsRead` schema extension |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `cryptography` Fernet | `itsdangerous` | Fernet is stronger (AES-128-CBC + HMAC-SHA256 + timestamp); itsdangerous is signing-focused, not encryption-focused |
| `cryptography` Fernet | nacl / PyNaCl | PyNaCl (libsodium) is excellent but adds a C extension dependency; Fernet is pure Python and sufficient for this use case |
| `LargeBinary` (BYTEA) for ciphertext | `String` (TEXT) | Fernet ciphertext is bytes; storing as BYTEA avoids base64 round-trip in application code; consistent with existing `logo_data` pattern |

**Installation (additions to `backend/requirements.txt`):**
```
cryptography==46.0.7
httpx==0.28.1
APScheduler==3.11.2
```

---

## Architecture Patterns

### Recommended File Structure (Phase 12 changes only)

```
backend/app/
├── models.py                   # MODIFIED: +PersonioEmployee, +PersonioAttendance,
│                               #           +PersonioAbsence, +PersonioSyncMeta,
│                               #           AppSettings +6 cols
├── schemas.py                  # MODIFIED: SettingsUpdate +personio fields,
│                               #           SettingsRead +personio_has_credentials bool
├── routers/
│   └── settings.py             # MODIFIED: accept + encrypt credentials on PUT,
│                               #           return personio_has_credentials in _build_read
├── services/
│   └── personio_client.py      # NEW: PersonioClient class + exception hierarchy
└── security/
    └── fernet.py               # NEW: encrypt_credential / decrypt_credential helpers

backend/alembic/versions/
└── XXXX_v1_3_hr_schema.py      # NEW: single migration for all Phase 12 schema changes

docker-compose.yml              # MODIFIED: add FERNET_KEY to api and migrate env_file
.env                            # MODIFIED: add FERNET_KEY=<generated base64 key>
```

### Pattern 1: Fernet Credential Encryption Helpers

**What:** A thin module (`app/security/fernet.py`) exposes `encrypt_credential(plaintext: str) -> bytes` and `decrypt_credential(ciphertext: bytes) -> str`. Both read `FERNET_KEY` from the environment at call time (not at module import) so the key can be injected via Docker Compose env_file.

**When to use:** Called by `routers/settings.py` PUT handler when personio credentials are present in the payload. Called by `services/personio_client.py` (Phase 13) when reading credentials from the DB row.

```python
# backend/app/security/fernet.py
import os
from cryptography.fernet import Fernet, InvalidToken

_ENV_VAR = "FERNET_KEY"


def _get_fernet() -> Fernet:
    key = os.environ.get(_ENV_VAR)
    if not key:
        raise RuntimeError(f"Environment variable {_ENV_VAR} is not set")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_credential(plaintext: str) -> bytes:
    """Encrypt a plaintext credential string. Returns Fernet token bytes."""
    return _get_fernet().encrypt(plaintext.encode("utf-8"))


def decrypt_credential(ciphertext: bytes) -> str:
    """Decrypt a Fernet token. Raises ValueError on invalid/tampered token."""
    try:
        return _get_fernet().decrypt(ciphertext).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Credential decryption failed — token invalid or key mismatch") from exc
```

**Key generation (one-time, run once during setup):**
```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())  # paste into .env as FERNET_KEY
```

### Pattern 2: AppSettings Extension — Write-Only Credentials

**What:** Two new `BYTEA` columns on `AppSettings` (`personio_client_id_enc`, `personio_client_secret_enc`). `SettingsRead` exposes `personio_has_credentials: bool` (True if both columns are non-null). `SettingsUpdate` accepts optional `personio_client_id: str | None` and `personio_client_secret: str | None`. The PUT handler encrypts on write; GET never returns the raw values.

**Critical:** On PUT, if `personio_client_secret` is omitted (None), preserve the existing encrypted value — do not overwrite with None. This matches the "clear only if explicitly provided" pattern.

```python
# In routers/settings.py PUT handler (extension)
from app.security.fernet import encrypt_credential

if payload.personio_client_id is not None:
    row.personio_client_id_enc = encrypt_credential(payload.personio_client_id)
if payload.personio_client_secret is not None:
    row.personio_client_secret_enc = encrypt_credential(payload.personio_client_secret)
```

```python
# In _build_read helper (extension)
def _build_read(row: AppSettings) -> SettingsRead:
    ...
    personio_has_credentials = (
        row.personio_client_id_enc is not None
        and row.personio_client_secret_enc is not None
    )
    return SettingsRead(
        ...,
        personio_has_credentials=personio_has_credentials,
        # personio_client_id and personio_client_secret are NOT included
    )
```

### Pattern 3: HR SQLAlchemy Models

**What:** Three new table classes (`PersonioEmployee`, `PersonioAttendance`, `PersonioAbsence`) plus `PersonioSyncMeta` (D-08). All use SQLAlchemy 2.0 `Mapped[]` + `mapped_column()` style. Personio native IDs are the PKs (no surrogate autoincrement). `raw_json` JSONB column on each table (D-07).

**JSONB import:**
```python
from sqlalchemy.dialects.postgresql import BYTEA, JSONB
```

```python
# models.py additions

class PersonioEmployee(Base):
    __tablename__ = "personio_employees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    first_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str | None] = mapped_column(String(50), nullable=True)   # "active" | "inactive"
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)
    position: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hire_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    termination_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    weekly_working_hours: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    raw_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    attendances: Mapped[list["PersonioAttendance"]] = relationship(
        "PersonioAttendance", back_populates="employee", cascade="all, delete-orphan"
    )
    absences: Mapped[list["PersonioAbsence"]] = relationship(
        "PersonioAbsence", back_populates="employee", cascade="all, delete-orphan"
    )


class PersonioAttendance(Base):
    __tablename__ = "personio_attendance"
    __table_args__ = (
        Index("ix_personio_attendance_employee_date", "employee_id", "date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("personio_employees.id"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    break_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_holiday: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    raw_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    employee: Mapped["PersonioEmployee"] = relationship("PersonioEmployee", back_populates="attendances")


class PersonioAbsence(Base):
    __tablename__ = "personio_absences"
    __table_args__ = (
        Index("ix_personio_absences_employee_start_type", "employee_id", "start_date", "absence_type_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("personio_employees.id"), nullable=False
    )
    absence_type_id: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    time_unit: Mapped[str] = mapped_column(String(10), nullable=False)   # "hours" | "days"
    hours: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    raw_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    employee: Mapped["PersonioEmployee"] = relationship("PersonioEmployee", back_populates="absences")


class PersonioSyncMeta(Base):
    """Singleton sync metadata row — id=1, mirrors AppSettings singleton pattern."""
    __tablename__ = "personio_sync_meta"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_personio_sync_meta_singleton"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # "ok" | "error"
    last_sync_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    employees_synced: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attendance_synced: Mapped[int | None] = mapped_column(Integer, nullable=True)
    absences_synced: Mapped[int | None] = mapped_column(Integer, nullable=True)
```

**Note on PersonioSyncMeta vs. ARCHITECTURE.md:** ARCHITECTURE.md mentions `personio_last_synced_at` as a column on `app_settings`. D-08 calls for a separate `personio_sync_meta` table. The separate table approach is cleaner for Phase 13 (the sync service writes to it without touching the main settings row). Use the separate table; the settings row keeps only the `personio_sync_interval_h` scheduling column.

### Pattern 4: PersonioClient Class with TTL-based Token Cache

**What:** `services/personio_client.py` — a class that owns a single `httpx.AsyncClient` instance, stores the token with `expires_at`, and exposes an `authenticate()` coroutine plus a checked `_get_valid_token()` helper. The custom exception hierarchy lives in the same file (Claude's discretion per CONTEXT.md).

```python
# backend/app/services/personio_client.py
import time
from datetime import datetime, timezone

import httpx

PERSONIO_BASE_URL = "https://api.personio.de/v1"
TOKEN_TTL_SECONDS = 86400   # Personio tokens are valid 24 hours
TOKEN_REFRESH_BUFFER = 60   # Re-auth if less than 60s remaining (D-13)


# --- Exception hierarchy (D-09) ------------------------------------------

class PersonioAPIError(Exception):
    """Base exception for all Personio client errors."""
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class PersonioAuthError(PersonioAPIError):
    """401 — invalid or expired credentials."""


class PersonioRateLimitError(PersonioAPIError):
    """429 — rate limited. retry_after is seconds to wait."""
    def __init__(self, message: str, retry_after: int = 60):
        super().__init__(message, status_code=429)
        self.retry_after = retry_after


class PersonioNetworkError(PersonioAPIError):
    """Connection error or timeout reaching Personio API."""


# --- Client ---------------------------------------------------------------

class PersonioClient:
    def __init__(self, client_id: str, client_secret: str):
        self._client_id = client_id
        self._client_secret = client_secret
        self._token: str | None = None
        self._expires_at: float = 0.0
        self._http = httpx.AsyncClient(
            base_url=PERSONIO_BASE_URL,
            timeout=30.0,
        )

    async def close(self) -> None:
        await self._http.aclose()

    async def authenticate(self) -> str:
        """Force a fresh token fetch. Returns the new token."""
        try:
            resp = await self._http.post(
                "/auth",
                json={"client_id": self._client_id, "client_secret": self._client_secret},
            )
        except httpx.TimeoutException as exc:
            raise PersonioNetworkError("Personio unreachable (timeout)") from exc
        except httpx.RequestError as exc:
            raise PersonioNetworkError(f"Personio unreachable: {exc}") from exc

        if resp.status_code == 401:
            raise PersonioAuthError("Invalid credentials")
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", "60"))
            raise PersonioRateLimitError(
                f"Rate limited, retry in {retry_after}s", retry_after=retry_after
            )
        if not resp.is_success:
            raise PersonioAPIError(
                f"Personio auth failed with status {resp.status_code}", status_code=resp.status_code
            )

        token = resp.json()["data"]["token"]
        self._token = token
        self._expires_at = time.monotonic() + TOKEN_TTL_SECONDS
        return token

    async def _get_valid_token(self) -> str:
        """Return a cached token, refreshing if within the buffer window (D-13)."""
        if self._token is None or time.monotonic() > self._expires_at - TOKEN_REFRESH_BUFFER:
            await self.authenticate()
        return self._token  # type: ignore[return-value]
```

### Pattern 5: Alembic Migration for HR Schema

**What:** A single migration file adds all Phase 12 schema changes — the three new HR tables, `personio_sync_meta`, and the columns added to `app_settings`. Using a single file avoids partial migration states.

**AppSettings additions in migration:**
```python
# In upgrade():
op.add_column("app_settings",
    sa.Column("personio_client_id_enc", BYTEA(), nullable=True))
op.add_column("app_settings",
    sa.Column("personio_client_secret_enc", BYTEA(), nullable=True))
op.add_column("app_settings",
    sa.Column("personio_sync_interval_h", sa.Integer(), nullable=False,
               server_default="1"))
```

**JSONB in migration:**
```python
from sqlalchemy.dialects.postgresql import BYTEA, JSONB
# Use JSONB() in column definitions
sa.Column("raw_json", JSONB(), nullable=True)
```

**Index creation in migration:**
```python
op.create_index("ix_personio_attendance_employee_date",
    "personio_attendance", ["employee_id", "date"])
op.create_index("ix_personio_absences_employee_start_type",
    "personio_absences", ["employee_id", "start_date", "absence_type_id"])
```

### Anti-Patterns to Avoid

- **Returning secrets in SettingsRead:** `SettingsRead` must never include `personio_client_id_enc` or `personio_client_secret_enc`. Use `personio_has_credentials: bool` only.
- **Storing token in DB:** Token is ephemeral, in-process only. No column for it. See D-12.
- **Overwriting secret with None on every PUT:** If `personio_client_secret` is absent from the payload, preserve the existing encrypted value. Null payload field ≠ intent to clear.
- **Importing live app code from migrations:** Alembic migration files must not import `app.security.fernet` or any app module. Encrypt/decrypt only happens at runtime, not at migration time. The new columns are just BYTEA nullable — no default values needed.
- **`asyncio.gather` on a single AsyncSession:** Already documented in ARCHITECTURE.md Anti-Pattern 1. Relevant here because the Personio client's `authenticate()` will be called from the same session context in Phase 13.
- **`JSONB` from `sqlalchemy` (not dialect):** Must import from `sqlalchemy.dialects.postgresql`, not from `sqlalchemy` directly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Symmetric encryption for credentials | Custom AES wrapper | `cryptography.fernet.Fernet` | Fernet handles IV generation, HMAC authentication, and key rotation — 10 lines vs. a correct custom AES-CBC-HMAC implementation |
| Async HTTP client | `urllib` / `requests` with thread pool | `httpx.AsyncClient` | httpx is async-native; shares the event loop with FastAPI; handles connection pooling, redirects, timeout |
| Token TTL management | Manual datetime subtraction | `time.monotonic()` + numeric `expires_at` | Monotonic clock is not affected by system time changes; correct for durations |

---

## Common Pitfalls

### Pitfall 1: Fernet Key Not Base64-URL-encoded

**What goes wrong:** `Fernet(key)` raises `ValueError: Fernet key must be 32 url-safe base64-encoded bytes` if the key is raw bytes, a hex string, or not URL-safe base64.

**Why it happens:** `Fernet.generate_key()` returns a `bytes` object that is already the correct 44-character URL-safe base64 string. If this is stored in `.env` without care (e.g., decoded to raw bytes, or a different encoding), `Fernet()` raises at runtime.

**How to avoid:** Store the key exactly as `Fernet.generate_key().decode()` outputs — a 44-character string like `dGhpcyBpcyBhIHRlc3Qga2V5IGZvciBGZXJuZXQh==`. In `fernet.py`, pass `key.encode()` if the env var value is a `str`. Test at startup: add a smoke-test assertion that `Fernet(key)` succeeds during app initialization.

**Warning signs:** `ValueError: Fernet key must be 32 url-safe base64-encoded bytes` at app startup or on first encrypt call.

### Pitfall 2: Alembic Autogenerate Flags Existing Tables

**What goes wrong:** `alembic revision --autogenerate` produces a migration that includes unexpected `ALTER TABLE` or even `DROP TABLE` statements for existing tables, not just the new Personio tables.

**Why it happens:** Model drift (e.g., a type difference between `Mapped[str | None]` and the actual DB column nullable status), or new models not yet imported into Alembic's `env.py` target metadata.

**How to avoid:** Run `alembic check` before `alembic revision --autogenerate`. Review the generated file's `upgrade()` function line by line — it should contain only `CREATE TABLE` for the 4 new tables, `add_column` for the 3 new `app_settings` columns, and `create_index` calls. Any `alter_column` or `drop_table` on existing tables is a red flag.

**Warning signs:** Generated migration contains `op.alter_column` on `upload_batches`, `sales_records`, or `app_settings` columns that were not changed in this phase.

### Pitfall 3: `personio_client_secret` Omission vs. Intentional Clear

**What goes wrong:** On every Settings PUT, if the frontend does not send `personio_client_secret` (because the user didn't change it), the router overwrites the stored encrypted value with `None`, effectively clearing the credential.

**Why it happens:** The PUT handler sets `row.personio_client_secret_enc = encrypt_credential(payload.personio_client_secret)` without checking whether the payload field is present.

**How to avoid:** In `SettingsUpdate`, make both credential fields `Optional[str] = None`. In the PUT handler, use the guard pattern:
```python
if payload.personio_client_id is not None:
    row.personio_client_id_enc = encrypt_credential(payload.personio_client_id)
if payload.personio_client_secret is not None:
    row.personio_client_secret_enc = encrypt_credential(payload.personio_client_secret)
```
Sending an explicit empty string `""` should be treated as a clear (validate: reject empty string at Pydantic layer, require min_length=1 or None).

### Pitfall 4: Token `expires_at` Using Wall Clock Instead of Monotonic

**What goes wrong:** If `expires_at` is set using `datetime.utcnow() + timedelta(hours=24)`, a system clock adjustment (DST, NTP sync, Docker host clock drift) can cause the token to appear expired or valid when it isn't.

**How to avoid:** Use `time.monotonic()` for duration-based TTLs. Store `_expires_at = time.monotonic() + TOKEN_TTL_SECONDS` and compare with `time.monotonic()` at check time. Monotonic clocks never go backwards.

### Pitfall 5: httpx `AsyncClient` Not Closed on App Shutdown

**What goes wrong:** If `PersonioClient._http` (the `httpx.AsyncClient` instance) is never closed, the application logs `Unclosed client session` warnings on shutdown, and may leak file descriptors in long-running containers.

**How to avoid:** Phase 13 will manage the client lifecycle (factory function or dependency injection). For Phase 12, expose a `close()` coroutine on `PersonioClient` (already shown in the code example above) so Phase 13 can call it from the FastAPI lifespan shutdown handler.

### Pitfall 6: `time` column type not imported

**What goes wrong:** `PersonioAttendance` uses `start_time: Mapped[time]` and `end_time: Mapped[time]`. The `Time` SQLAlchemy type and Python `time` class must both be imported.

**How to avoid:**
```python
from datetime import date, datetime, time     # add `time` to existing import
from sqlalchemy import ..., Time              # add `Time` to existing import
```

---

## Code Examples

### Fernet Key Generation (run once, paste into .env)
```python
# Run in a Python shell
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
# Example output: dGhpcyBpcyBhIHRlc3Qga2V5IGZvciBGZXJuZXQhZmFrZQ==
```

### JSONB Column in SQLAlchemy 2.0 Mapped Style
```python
# Source: SQLAlchemy 2.0 docs — PostgreSQL dialect
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

raw_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
```

### Personio Auth Verification Test (no live credentials needed)
```python
# Can be tested by asserting exception type on a mocked 401 response
import pytest
import httpx
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_authenticate_invalid_credentials():
    client = PersonioClient("bad_id", "bad_secret")
    mock_response = httpx.Response(401, json={"error": "unauthorized"})
    with patch.object(client._http, "post", return_value=mock_response):
        with pytest.raises(PersonioAuthError):
            await client.authenticate()
```

### Alembic Migration Structure
```python
# backend/alembic/versions/XXXX_v1_3_hr_schema.py
"""v1.3 HR schema: personio tables + app_settings credential columns

Revision ID: <auto>
Revises: b2c3d4e5f6a7
Create Date: 2026-04-XX
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import BYTEA, JSONB

revision = "<new_revision_id>"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Extend app_settings singleton
    op.add_column("app_settings",
        sa.Column("personio_client_id_enc", BYTEA(), nullable=True))
    op.add_column("app_settings",
        sa.Column("personio_client_secret_enc", BYTEA(), nullable=True))
    op.add_column("app_settings",
        sa.Column("personio_sync_interval_h", sa.Integer(), nullable=False,
                  server_default="1"))

    # 2. personio_employees
    op.create_table(
        "personio_employees",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=False),
        sa.Column("first_name", sa.String(255), nullable=True),
        sa.Column("last_name", sa.String(255), nullable=True),
        sa.Column("status", sa.String(50), nullable=True),
        sa.Column("department", sa.String(255), nullable=True),
        sa.Column("position", sa.String(255), nullable=True),
        sa.Column("hire_date", sa.Date(), nullable=True),
        sa.Column("termination_date", sa.Date(), nullable=True),
        sa.Column("weekly_working_hours", sa.Numeric(5, 2), nullable=True),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("raw_json", JSONB(), nullable=True),
    )

    # 3. personio_attendance
    op.create_table(
        "personio_attendance",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=False),
        sa.Column("employee_id", sa.Integer(),
                  sa.ForeignKey("personio_employees.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("break_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_holiday", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("raw_json", JSONB(), nullable=True),
    )
    op.create_index("ix_personio_attendance_employee_date",
        "personio_attendance", ["employee_id", "date"])

    # 4. personio_absences
    op.create_table(
        "personio_absences",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=False),
        sa.Column("employee_id", sa.Integer(),
                  sa.ForeignKey("personio_employees.id"), nullable=False),
        sa.Column("absence_type_id", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("time_unit", sa.String(10), nullable=False),
        sa.Column("hours", sa.Numeric(8, 2), nullable=True),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("raw_json", JSONB(), nullable=True),
    )
    op.create_index("ix_personio_absences_employee_start_type",
        "personio_absences", ["employee_id", "start_date", "absence_type_id"])

    # 5. personio_sync_meta singleton
    sync_meta = op.create_table(
        "personio_sync_meta",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_status", sa.String(20), nullable=True),
        sa.Column("last_sync_error", sa.Text(), nullable=True),
        sa.Column("employees_synced", sa.Integer(), nullable=True),
        sa.Column("attendance_synced", sa.Integer(), nullable=True),
        sa.Column("absences_synced", sa.Integer(), nullable=True),
        sa.CheckConstraint("id = 1", name="ck_personio_sync_meta_singleton"),
    )
    op.bulk_insert(sync_meta, [{"id": 1}])


def downgrade() -> None:
    op.drop_index("ix_personio_absences_employee_start_type", table_name="personio_absences")
    op.drop_table("personio_absences")
    op.drop_index("ix_personio_attendance_employee_date", table_name="personio_attendance")
    op.drop_table("personio_attendance")
    op.drop_table("personio_employees")
    op.drop_table("personio_sync_meta")
    op.drop_column("app_settings", "personio_sync_interval_h")
    op.drop_column("app_settings", "personio_client_secret_enc")
    op.drop_column("app_settings", "personio_client_id_enc")
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.9+ | Backend runtime | Yes | 3.9.6 | — |
| Docker | Container build | Yes | 29.3.1 | — |
| `cryptography` Python package | Fernet encryption | Yes | 46.0.7 | — |
| `httpx` Python package | Personio HTTP client | Yes (latest) | 0.28.1 | — |
| `APScheduler` Python package | Scheduler (Phase 13) | Yes | 3.11.2 | — |
| `FERNET_KEY` env var | Credential encryption | Not yet — must be generated and added to `.env` | N/A | None — blocking if absent |
| Personio API (live) | Client smoke test | Not required for Phase 12 | N/A | Mock httpx responses in tests |

**Missing dependencies with no fallback:**
- `FERNET_KEY` env var: must be generated (`Fernet.generate_key().decode()`) and added to `.env` and to the `api` service's `env_file` block in `docker-compose.yml`. Without this, `encrypt_credential()` raises `RuntimeError` on any settings PUT that includes personio fields.

**Missing dependencies with fallback:**
- Live Personio account: not needed for Phase 12. All Personio client tests use mocked httpx responses. The `authenticate()` coroutine can be tested with `unittest.mock.AsyncMock`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store API secrets in env vars (no UI config) | Store encrypted in DB, write-only API | D-01 to D-04 (this phase) | Enables Settings UI credential input without container restart |
| `sqlalchemy.Column()` style | `Mapped[T] = mapped_column()` style (2.0) | SQLAlchemy 2.0 release | Type-safe, IDE-friendly; project already uses this style throughout |
| `asyncio.gather` for parallel DB ops | Sequential `await` on single `AsyncSession` | Learned in v1.2 Phase 8 | Prevents `InvalidRequestError`; documented in `routers/kpis.py` |

**Deprecated/outdated:**
- `personio-py` library: last released ~2022, sync-only (`requests`-based); do not use.
- APScheduler 4.x: alpha pre-release (`4.0.0a6`); not production-ready; stay on 3.11.2.

---

## Open Questions

1. **`personio_sync_interval_h` column location: `app_settings` vs. `personio_sync_meta`**
   - What we know: ARCHITECTURE.md places it on `app_settings`; `personio_sync_meta` is the sync state table (D-08).
   - Recommendation: Keep `personio_sync_interval_h` on `app_settings` (it is a user-configurable setting, not sync state). `personio_sync_meta` holds sync result data only.

2. **`personio_client_id` display in SettingsRead**
   - What we know: D-03 says credentials are write-only. ARCHITECTURE.md notes returning `personio_client_id` (not the secret) as "visible for reference" is acceptable.
   - Recommendation: Return `personio_has_credentials: bool` for the secret, but also return the decrypted `personio_client_id` string (not the secret) so the Settings UI can pre-fill the client_id field. This is a reasonable UX choice — client_id is not the sensitive half. If the team prefers full write-only, return only the bool. **Suggest confirming with planner notes.**

3. **Exception module location**
   - Claude's discretion. Recommendation: inline in `personio_client.py` for Phase 12 (fewer files, clear co-location). Extract to `app/exceptions/personio.py` in Phase 13 if the routers need to import them independently.

---

## Project Constraints (from CLAUDE.md)

These directives are mandatory — research does not override them:

| Directive | Applies To |
|-----------|-----------|
| Must run via Docker Compose — no bare-metal dependencies | `FERNET_KEY` must be in `env_file`, not hardcoded |
| PostgreSQL only — no other DB | HR tables go in the same PostgreSQL instance |
| SQLAlchemy 2.0 `Mapped[]` + `mapped_column()` style — no legacy patterns | All new model classes must use this style |
| Alembic migrations only — never `Base.metadata.create_all()` | The HR schema must be added via migration, not programmatically |
| asyncpg driver — `postgresql+asyncpg://` URL | No sync driver calls in async context |
| `AsyncSession` with `create_async_engine` — no mixing sync/async | `get_async_db_session` dependency used for all new endpoints |
| `docker compose` v2 (no hyphen) syntax | Used in any compose command examples |
| `depends_on: condition: service_healthy` | Already in place; `migrate` service runs before `api` |
| FastAPI 0.135.3, Pydantic v2, SQLAlchemy 2.0.49, Alembic 1.18.4 | No version bumps — pin exactly as per requirements.txt |
| Single `models.py` (D-05) | No package split for models |

---

## Sources

### Primary (HIGH confidence)
- `backend/app/models.py` — current SQLAlchemy 2.0 patterns, BYTEA usage, singleton CHECK constraint
- `backend/app/routers/settings.py` — write-only logo pattern (template for write-only credential pattern)
- `backend/app/database.py` — `AsyncSessionLocal`, `Base`, async engine pattern
- `backend/app/schemas.py` — `SettingsUpdate` / `SettingsRead` extension points
- `backend/alembic/versions/b2c3d4e5f6a7_v1_1_app_settings.py` — migration file structure, bulk_insert seed pattern
- `.planning/research/ARCHITECTURE.md` — canonical HR table schema, data flow, anti-patterns (HIGH — researched 2026-04-12)
- `.planning/research/PITFALLS.md` — credential exposure, Alembic pitfalls, token lifecycle (HIGH — researched 2026-04-12)
- `.planning/research/STACK.md` — httpx 0.28.1, APScheduler 3.11.2 version decisions (HIGH — researched 2026-04-12)

### Secondary (MEDIUM confidence)
- `cryptography` PyPI — version 46.0.7 confirmed as current latest
- `httpx` PyPI — version 0.28.1 confirmed as current latest (no newer release)
- `APScheduler` system install — 3.11.2 confirmed installed

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages verified against PyPI and system env
- Architecture: HIGH — based on direct codebase inspection + prior milestone research
- Pitfalls: HIGH — sourced from project PITFALLS.md (researched with official Personio and Alembic docs)

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable libraries; Personio API auth model is unchanged)
