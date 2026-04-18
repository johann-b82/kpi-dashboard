# Phase 42: Device Auth + Pairing Flow — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 42-device-auth-pairing-flow
**Areas discussed:** Device token format, Token rotation, Token transport, Rate-limit backing, Claim atomicity, Pair-status polling cadence, Cron deletion window

---

## 1. Device token format

| Option | Description | Selected |
|--------|-------------|----------|
| Scoped JWT | `{sub, scope:"device", iat, exp}`, HS256, 24h. Revocation via DB `revoked_at` check. PITFALLS §21 recommendation. | ✓ |
| Opaque sha256-hashed | Random 32-byte secret, stored hash; revocation via deletion/flag. | |

**User's choice:** Scoped JWT (recommended).

---

## 2. Token rotation

| Option | Description | Selected |
|--------|-------------|----------|
| No rotation, fixed 24h JWT | Simplest; re-pair is the kill path. | ✓ |
| Rotate-on-heartbeat | Narrower leak window; requires atomic client-side token swap each beat. | |

**User's choice:** No rotation (recommended for ≤5 device fleet).

---

## 3. Token transport

| Option | Description | Selected |
|--------|-------------|----------|
| `Authorization: Bearer` header | Standard REST; no cross-origin drama; matches admin auth style. | ✓ |
| `HttpOnly` cookie | Stronger XSS posture; complicates SSE + off-origin players. | |

**User's choice:** Authorization header (recommended). XSS mitigated at snippet sanitizer boundary in Phase 43+.

---

## 4. Rate-limit backing

| Option | Description | Selected |
|--------|-------------|----------|
| In-process `{ip: deque[ts]}` + `asyncio.Lock` | ~30 LOC, no new deps, viable under `--workers 1` invariant. | ✓ |
| `slowapi` | New dependency; more features than needed for one endpoint at 5 req/min. | |

**User's choice:** In-process deque (recommended).

---

## 5. Claim atomicity

| Option | Description | Selected |
|--------|-------------|----------|
| Atomic `UPDATE … WHERE code=:code AND claimed_at IS NULL RETURNING *` | PITFALLS §13 pattern; one round-trip, race-free by construction. | ✓ |
| `SELECT … FOR UPDATE` + `UPDATE` in transaction | Correct but more code and locks. | |

**User's choice:** Atomic UPDATE…RETURNING (recommended).

---

## 6. Pair-status polling cadence

| Option | Description | Selected |
|--------|-------------|----------|
| 2s | Snappiest; ~300 polls/TTL. | |
| 3s | Good UX, ~200 polls/TTL. | ✓ |
| 5s | Easiest on server; noticeable wait at claim. | |

**User's choice:** 3 seconds (recommended).

---

## 7. Cron deletion window (confirmation question)

| Option | Description | Selected |
|--------|-------------|----------|
| `expires_at < now() - 24h` | 24-hour grace window per ROADMAP SC #4. | ✓ |
| `expires_at < now()` | Delete immediately on expiry. | |

**User's choice:** 24h grace (ROADMAP default, implicit accept via "all recommended").

---

## Claude's Discretion

- Exact JWT library (`python-jose` vs `PyJWT` vs `authlib`) — to be picked during research/planning
- Pairing code alphabet (exact "unambiguous" character set) — researcher picks based on collision math
- Single-consume semantic for `/pair/status` post-claim (`claimed_consumed` vs 404 vs row-delete) — planner picks based on test ergonomics

## Deferred Ideas

- Rotate-on-heartbeat (fleet scale / leak response)
- HttpOnly cookie transport (Phase 43+ sanitizer hardening)
- `slowapi` dependency (if `--workers 1` relaxes or rate limiting spreads)
- Media-download token scoping (Phase 43)
- Admin audit log for `/pair/claim` (Phase 46 or later)
