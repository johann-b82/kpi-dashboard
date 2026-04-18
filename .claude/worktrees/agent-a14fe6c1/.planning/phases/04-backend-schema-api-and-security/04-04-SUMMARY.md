---
phase: 04-backend-schema-api-and-security
plan: 04
subsystem: backend-security
tags: [security, validation, svg, png, nh3, sanitization, brand]
requirements: [BRAND-01, BRAND-02]
dependency-graph:
  requires: [04-01]
  provides: [logo-validation-module, png-magic-byte-check, svg-sanitizer, mime-sniffer]
  affects: [04-05]
tech-stack:
  added: [nh3==0.3.4 (already declared in 04-01)]
  patterns:
    - "Reject-on-mutation SVG sanitization (byte-equality on cleaned vs. raw text)"
    - "Explicit SVG allowlist (tags + attributes + url_schemes) — Pitfall 1"
    - "Magic-byte MIME sniffing — never trust client Content-Type (D-17)"
    - "Pure-function security module, testable in ~20ms without DB or ASGI"
key-files:
  created:
    - backend/app/security/__init__.py
    - backend/app/security/logo_validation.py
    - backend/tests/test_logo_validation.py
  modified:
    - backend/tests/conftest.py
decisions:
  - "sanitize_svg uses byte-equality on UTF-8 text (over-rejects whitespace-normalised Illustrator exports — acceptable, 422 error instructs user to re-export)"
  - "strip_comments=True intentionally triggers mutation rejection (Pitfall 7) — any SVG with comments is rejected so users must clean exports"
  - "use.href only allowlisted, NOT xlink:href (modern SVG 2 + avoids XSS surface)"
  - "SVG_ALLOWED_URL_SCHEMES={'https'} — no data: or javascript: (D-12)"
metrics:
  duration: "~8 min"
  completed_date: 2026-04-11
---

# Phase 4 Plan 04: Logo Validation Security Module Summary

Pure-Python security helper that powers BRAND-01 (PNG magic-byte check + MIME sniff) and BRAND-02 (nh3 SVG sanitization with reject-on-mutation) as a standalone, unit-tested module — the router in Plan 05 consumes this as an import.

## What Shipped

- `backend/app/security/logo_validation.py` (128 lines) with:
  - `PNG_SIGNATURE` (8-byte canonical `\x89PNG\r\n\x1a\n`)
  - `SVG_ALLOWED_TAGS` (20 elements: svg, g, defs, symbol, use, title, desc, path, rect, circle, ellipse, line, polyline, polygon, text, tspan, linearGradient, radialGradient, stop, clipPath, mask — **script / foreignObject / iframe / a deliberately excluded**)
  - `SVG_ALLOWED_ATTRIBUTES` (explicit per-element attribute allowlist)
  - `SVG_ALLOWED_URL_SCHEMES = {"https"}`
  - `SvgRejected` exception
  - `validate_png(raw)` — raises on missing magic bytes
  - `sanitize_svg(raw_bytes)` — nh3.clean with allowlist + reject-on-mutation, UTF-8 guard
  - `sniff_mime(raw, ext)` — dispatches on `.png` / `.svg`, handles UTF-8 BOM, raises on unsupported ext
- `backend/tests/test_logo_validation.py` — 19 test cases (parametrized), 0.04s runtime:
  - 5 validate_png cases (signature accept + 4 bad-byte rejections)
  - 7 sniff_mime cases (png, svg xml decl, svg direct tag, svg with BOM, unknown ext, garbage png, garbage svg)
  - 7 sanitize_svg cases (minimal legitimate + 4 malicious variants + non-UTF-8 + HTML comment mutation)

## Verification Results

- `python -m pytest tests/test_logo_validation.py -q` → **19 passed in 0.04s**
- Module import + live sanitize/validate/sniff smoke check → `all checks pass`
- Allowlist audit: `svg`, `path`, `circle`, `g` present; `script`, `foreignObject`, `iframe`, `a` absent

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Conftest `reset_settings` autouse fixture crashed before the `app_settings` table exists**
- **Found during:** Task 2 (first `pytest` run)
- **Issue:** The autouse fixture in `backend/tests/conftest.py` (added by Plan 04-01) guards against `ImportError` when `app.models.AppSettings` is missing, but it does NOT guard against `SQLAlchemyError` (table missing) or `RuntimeError` (asyncpg "different loop"). On a partial Wave 2 tree where Plans 04-02 and 04-03 have not yet merged their model + migration, the import succeeds but the UPDATE fails, turning every test in this module into an ERROR even though they don't touch the DB.
- **Fix:** Extended the existing `try/except` inside the fixture body to also catch `SQLAlchemyError` and `RuntimeError`, letting pure unit tests proceed as a no-op (matches the intent of the existing Plan-01 guard, just one layer deeper).
- **Files modified:** `backend/tests/conftest.py`
- **Commit:** 13d4bce

No architectural deviations. No new dependencies — nh3 was already added to `backend/requirements.txt` by Plan 04-01. Note that the running `api` container was built before that plan merged, so it did not yet have `nh3` installed on disk; I pip-installed it inside the container for the verification run. The image rebuild happens at the end of Wave 2 when parallel plans merge.

## Known Stubs

None. The module is fully wired and testable standalone. Plan 05's router will import it directly.

## Commits

- f5d4b99 — `feat(04-04): add logo validation security module`
- 13d4bce — `test(04-04): add logo_validation unit tests`

## Self-Check: PASSED

- FOUND: backend/app/security/__init__.py
- FOUND: backend/app/security/logo_validation.py
- FOUND: backend/tests/test_logo_validation.py
- FOUND: commit f5d4b99
- FOUND: commit 13d4bce
