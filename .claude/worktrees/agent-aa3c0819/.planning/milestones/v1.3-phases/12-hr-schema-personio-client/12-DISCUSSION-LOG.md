# Phase 12: HR Schema & Personio Client - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 12-HR Schema & Personio Client
**Areas discussed:** Credential storage, HR table design, Personio client error handling, Token lifecycle

---

## Credential Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Plaintext in DB | Store as plain String columns, write-only at API layer only | |
| Symmetric encryption at rest | Fernet encryption with env var key, decrypt only when needed | ✓ |
| Env-only (no DB storage) | Credentials from env vars only, no UI config | |

**User's choice:** Symmetric encryption at rest
**Notes:** Protects against DB dump exposure while still allowing UI-based configuration per PERS-01.

### Follow-up: Encryption Library

| Option | Description | Selected |
|--------|-------------|----------|
| Fernet (cryptography library) | Industry standard, HMAC verification, well-documented | ✓ |
| AES-GCM via built-in | No dependency, but manual nonce management | |
| You decide | Claude picks | |

**User's choice:** Fernet (cryptography library)

---

## HR Table Design

### Model file organization

| Option | Description | Selected |
|--------|-------------|----------|
| Single models.py | Keep everything together, ~250-300 lines | ✓ |
| Split into models/ package | Separate files per domain, requires import updates | |
| You decide | Claude picks | |

**User's choice:** Single models.py

### Column strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Typed columns only | Only fields needed for KPIs, lean schema | |
| Typed columns + raw JSON | Typed for queries + JSONB preserving full response | ✓ |
| You decide | Claude picks | |

**User's choice:** Typed columns + raw JSON

---

## Personio Client Error Handling

### Error pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Custom exception hierarchy | PersonioAuthError, PersonioRateLimitError, etc. | ✓ |
| Result type pattern | Success/Failure return objects, no exceptions | |
| You decide | Claude picks | |

**User's choice:** Custom exception hierarchy

### Error granularity for user

| Option | Description | Selected |
|--------|-------------|----------|
| Specific messages | "Invalid credentials", "Rate limited", "Unreachable" | ✓ |
| Generic + log detail | Frontend sees generic message, detail logged server-side | |
| You decide | Claude picks | |

**User's choice:** Specific messages — helps users self-diagnose

---

## Token Lifecycle

### Storage approach

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory cache with TTL | Module/instance variable, lost on restart, re-auth cheap | ✓ |
| DB column on AppSettings | Persist token + expiry, survives restarts | |
| You decide | Claude picks | |

**User's choice:** In-memory cache

### Refresh strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Proactive refresh | Check TTL before each request, refresh if <60s remaining | ✓ |
| Reactive refresh | Use until 401, then retry once | |
| You decide | Claude picks | |

**User's choice:** Proactive refresh

---

## Claude's Discretion

- Exact JSONB column naming and typed column selection for each HR table
- Exception class file location
- Fernet key env var naming convention

## Deferred Ideas

None — discussion stayed within phase scope
