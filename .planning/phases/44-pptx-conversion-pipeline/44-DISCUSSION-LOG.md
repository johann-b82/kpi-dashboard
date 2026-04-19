# Phase 44: PPTX Conversion Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 44-pptx-conversion-pipeline
**Areas discussed:** Worker location, Pipeline steps, Stuck-row recovery, Upload API shape, Failure surface

---

## 1. Worker Location

| Option | Description | Selected |
|--------|-------------|----------|
| A. LibreOffice in `api` + FastAPI `BackgroundTasks` | One image, one deploy unit, no IPC. Fastest to ship. CVE risk localized to api. | ✓ |
| B. Dedicated `pptx-worker` container (read_only, cap_drop ALL, no DB net) | Pitfall 22 CVE-sandboxed. Lean api image. Needs IPC + new service. | |
| C. Hybrid: soffice in api + subprocess user + seccomp profile | Partial sandbox without new service. Complexity without real isolation. | |

**User's choice:** A
**Notes:** Small-fleet (≤5 devices) internal deployment, admin-only upload surface, per-invocation tempdir + `asyncio.wait_for(60)` + `asyncio.Semaphore(1)` + `asyncio.subprocess_exec` already defang the event-loop/OOM risks called out in the Goal. Isolated-worker hardening deferred to a future phase if upload surface widens.

---

## 2. Pipeline Steps

| Option | Description | Selected |
|--------|-------------|----------|
| A. `soffice --convert-to png` (one step) | Simplest, one subprocess, no temp PDF. LO screen-renderer quirks on dimensions/order. | |
| B. `soffice → pdf` then `pdftoppm -r 144 -scale-to-x 1920 -scale-to-y 1080 -png` | Deterministic 1920×1080 output. Poppler already in SGN-INF-01. PDF intermediate surfaces font problems early. | ✓ |
| C. `soffice → pdf` + `pypdfium2` in-process | No second subprocess, but adds native wheel dep and loses pdftoppm's threading. | |

**User's choice:** B
**Notes:** Poppler's `pdftoppm` gives deterministic dimensions via explicit `-scale-to-x / -scale-to-y`. Dep cost already paid by SGN-INF-01.

---

## 3. Stuck-Row Recovery (SGN-SCH-03)

| Option | Description | Selected |
|--------|-------------|----------|
| A. Flip `processing > 5min` → `failed` (fail-forward) | Deterministic. No crash loop. Admin re-uploads (or calls /reconvert). | ✓ |
| B. Re-queue `processing > 5min` → `pending` (auto-retry) | Transparent recovery from transient worker crashes. Poison-pill risk without retry counter. | |
| C. Hybrid: first restart re-queues once, second consecutive stuck → failed | Best of both. Requires new `conversion_attempts` column — violates additive-only Phase 41 schema spirit. | |

**User's choice:** A
**Notes:** No retry counter exists in Phase 41 schema; adding one now would need migration without evidence of real transient failures. Fleet is small, admins are humans, `/reconvert` endpoint (see area 4) provides a manual retry path.

---

## 4. Upload API Shape

| Option | Description | Selected |
|--------|-------------|----------|
| A. Dedicated `POST /api/signage/media/pptx` multipart endpoint + `POST /api/signage/media/{id}/reconvert` | One admin action = one API call. Atomic. 50MB cap enforced at boundary. Clear re-convert affordance. | ✓ |
| B. Keep existing `POST /media` + add `POST /api/signage/media/{id}/convert` kick-off | Minimal delta. Two-call UX risks PPTX rows sitting `pending` forever. | |
| C. Auto-enqueue inside existing `POST /media` when `kind=pptx` | Zero new API shape. Mixes admin registration with backend-owned work; no reconvert affordance. | |

**User's choice:** A
**Notes:** Phase 46 admin UI will dispatch by kind anyway; dedicated endpoint keeps multipart + conversion concerns in one place. `/reconvert` is small and genuinely useful for fail recovery.

---

## 5. Failure Surface

| Option | Description | Selected |
|--------|-------------|----------|
| A. Short machine code + human message in `conversion_error`, exposed on admin GET; full stderr tail logged only | Actionable admin signal, stable taxonomy, testable. Leaks no internals. | ✓ |
| B. Full stderr tail (last 2KB) in `conversion_error`, exposed raw | Zero info loss. Noisy, unstable across LO versions, leaks paths/UUIDs. | |
| C. Boolean-ish failed status only; no `conversion_error` exposed on API | Minimal admin surface. Every failure becomes "ask the dev". | |

**User's choice:** A
**Notes:** Initial taxonomy: `timeout`, `soffice_failed`, `pdftoppm_failed`, `no_slides_produced`, `invalid_pptx`, `abandoned_on_restart`. Full stderr tail stays in `log.warning(...)` only.

---

## Claude's Discretion

- Exact module names (`signage_pptx.py` vs `pptx_converter.py`) — follow existing naming style.
- `conversion_started_at` timestamp source (`func.now()` vs app-side `datetime.now(UTC)`) — follow existing convention.
- CI test strategy around soffice (real invocation vs mocked subprocess + fixture).
- Directus upload token handling — follow existing Directus integration conventions.

## Deferred Ideas

- Isolated `pptx-worker` container (Pitfall 22 hardening) — revisit if surface widens / fleet grows.
- Retry counter / auto-retry policy — revisit only if real transient failures are observed.
- Re-conversion on font-package updates — admin can `/reconvert` manually.
- Conversion progress streaming (SSE slide-count) — Phase 46 polish if needed.
- Polling queue beyond `Semaphore(1)` — unjustified at ≤5-device scale.
- GPU rasterization — unnecessary at this scale.
