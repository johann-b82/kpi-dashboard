# FEATURES — v1.16 Digital Signage

**Domain:** Digital signage CMS (admin) + Chromium-kiosk player (Raspberry Pi) embedded in the existing KPI Dashboard monorepo.
**Researched:** 2026-04-18
**Confidence:** HIGH for table-stakes taxonomy (four reference platforms converge); MEDIUM for complexity labels (codebase-specific, finalised during phase-sizing); HIGH for anti-feature boundaries (explicit in milestone brief).

**Scope note:** This document covers ONLY the new signage features. Existing KPI Dashboard capabilities (Directus auth + Admin/Viewer roles, FastAPI+Alembic, APScheduler singleton, React+TanStack Query, i18n DE/EN, dark mode, App Launcher, in-app docs) are assumed and reused — never re-researched.

---

## Executive Summary

v1.16 adds a **second first-class app** to the launcher — a signage CMS + Chromium-kiosk player — using the same stack that v1.11 through v1.15 proved out. The universal floor across every serious signage platform (Xibo, Screenly OSE, Yodeck, Rise Vision) is Media + Playlist + Device + Tag routing + Pairing + Offline cache + a handful of format handlers. This is the v1.16 table-stakes set. Three Yodeck-tier niceties (SSE real-time push, PDF page-flip crossfade, admin WYSIWYG preview) fall out of that architecture cheaply enough to ship in v1. Dayparting, analytics, fleet ops, and multi-site federation are explicitly deferred and called out as anti-features for this milestone.

Biggest feature decision: **PPTX is supported via server-side LibreOffice-headless → PDF → pdf.js**, not native browser rendering. Native PPTX in the browser is impractical; every reference platform converts. This is a HIGH-complexity line item and the longest pole of the milestone — but skipping it loses the PowerPoint-heavy German office audience.

---

## Reference-Platform Convergence

| Concept | Xibo | Screenly OSE | Yodeck | Rise Vision |
|---------|------|--------------|--------|-------------|
| Media library (upload + categorize) | ✓ | ✓ (assets) | ✓ | ✓ |
| Playlists (ordered + per-item duration) | ✓ (layouts/timelines) | ✓ | ✓ | ✓ (presentations) |
| Devices (register + tag + health) | ✓ | ✓ (OSE single, Pro fleet) | ✓ | ✓ |
| 6-digit pairing code | ✓ | ✓ | ✓ | ✓ |
| Tag / group-based targeting | ✓ | Pro only | ✓ | ✓ |
| Offline cache-and-loop | ✓ | ✓ (core prop) | ✓ | ✓ |
| Image / Video / URL | ✓ | ✓ | ✓ | ✓ |
| PDF | widget | partial | ✓ | ✓ |
| PPTX | widget (MS Office) | no | cloud-convert | template-based |
| Real-time push | XMPP | — (polling only) | WebSocket | polling+push |
| Dayparting schedules | ✓ | basic | ✓ | rich |
| Proof-of-play / analytics | ✓ | — | ✓ | ✓ |

**Key takeaway:** The first six rows are the universal floor — matching those makes this recognizably "signage." Rows 7–9 are the format-handler spread; rows 10–12 are where platforms actually differentiate. For a ≤5-device single-site internal tool, Screenly-OSE floor + selective Yodeck features is the pragmatic target.

---

## Table Stakes (MUST ship in v1.16)

Features without which this doesn't qualify as a signage product.

| ID | Feature | Why Expected | Complexity | Stack Dependency |
|----|---------|--------------|------------|-------------------|
| SGN-01 | **Media library** — upload, preview, per-item metadata | Every reference platform opens on this screen. | MEDIUM | Directus file storage + thumbnails; admin table via shadcn + `apiClient`. |
| SGN-02 | **Media tagging / categorization** | Filter 50+ assets by purpose ("lobby", "safety", "Q2"). | LOW | JSONB tag array on `media` (v1.6 precedent). Reuse CheckboxList for tag picker. |
| SGN-03 | **Playlist CRUD** — ordered items, per-item duration | Core abstraction; without duration, images never advance. | MEDIUM | New `playlists` + `playlist_items` tables; DnD reorder (`@dnd-kit/sortable`) or up/down arrows. |
| SGN-04 | **Device CRUD** — name, tags, current playlist, last-seen | Operators need to know what's out there and what state it's in. | MEDIUM | `devices` table: `id`, `name`, `tags[]`, `current_playlist_id`, `last_heartbeat_at`, `app_version`. |
| SGN-05 | **Tag-based playlist routing** | Bind once ("lobby playlist → lobby tag"), onboard by tagging. | MEDIUM | Playlist has `target_tags[]`. Resolution: device-tags ∩ playlist-tags → highest-priority match. One-playlist-per-tag keeps v1 deterministic. |
| SGN-06 | **6-digit pairing flow** | Industry-standard Pi onboarding (Chromecast / Yodeck). Alternatives (SSH provisioning, per-device cert) are operator-hostile. | MEDIUM | Ephemeral code store (in-memory dict with TTL; no Redis needed at 5 devices); admin claim endpoint. |
| SGN-07 | **Offline cache-and-loop** | Network flaps are the #1 failure mode in internal deployments. Blanking on disconnect is unusable. | MEDIUM | Service Worker + IndexedDB manifest; player keeps looping last snapshot on fetch failure; only admin view flags the stale state. |
| SGN-08 | **Polling resolve + heartbeat (30s)** | Baseline sync + liveness. Guarantees eventual consistency even when push fails behind proxies. | LOW | `/api/signage/resolve?device_id=X` + heartbeat bumps `last_heartbeat_at`. |
| SGN-09 | **Device health column** (status chip on last-seen) | "Which screen is dead?" at a glance. | LOW | Green < 2 min, amber < 10 min, red > 10 min. Reuse v1.15 sensor status-chip pattern. |
| SGN-10 | **Image handler** (PNG/JPG/WebP) | Baseline format. | LOW | `<img>` + object-fit + CSS crossfade. |
| SGN-11 | **Video handler** (MP4/WebM) | Expected for any real signage use. | LOW | `<video autoplay muted playsinline>` — `muted` required by Chromium autoplay policy without user gesture. |
| SGN-12 | **URL / iframe handler** | "Show this dashboard/webpage" is a top-3 internal signage ask. | LOW | `<iframe sandbox>`. CSP caveat: target must allow framing (no `X-Frame-Options: DENY`). Surface in admin UI. |
| SGN-13 | **PDF handler** (page-flip playback) | PDFs are the lingua franca of internal comms. | MEDIUM | pdf.js canvas; each page = one playlist beat at item-level duration. Native-quality over convert-to-image. |
| SGN-14 | **PPTX handler** (server-side converted) | #1 content source in German office environments. Native browser PPTX is impractical. | **HIGH** | LibreOffice headless (`soffice --headless --convert-to pdf`) → reuse PDF handler. Async pipeline (BackgroundTask for v1; formal queue is v2). Cold-start 8–15s, warm 2–4s. |
| SGN-15 | **HTML snippet handler** | Escape hatch for ad-hoc custom slides; every platform has it. | LOW | Admin-only input → sandboxed `<iframe srcdoc>`. Role-gated (Admin writes, Viewer cannot). |
| SGN-16 | **Admin-only launcher tile** (`/signage`) | Project constraint — launcher (v1.14) is the entry point. | LOW | Tile wrapped in `AdminOnly`; bilingual `launcher.signage.{title,subtitle}`. |
| SGN-17 | **Chromium-kiosk player route** | The actual device-facing surface. | MEDIUM | Served by backend at `/player`; device-token auth (from pairing); boot-time code display when unclaimed. |
| SGN-18 | **Bilingual DE/EN admin UI + admin-guide article** | Project-wide constraint (DE "du" tone; full parity). | LOW | New `signage.*` i18n namespace; one admin-guide Markdown article (EN + DE) via the v1.13 docs pipeline. |
| SGN-19 | **Alembic schema** (`media`, `playlists`, `playlist_items`, `devices`) | Schema-as-code project invariant; Directus must not own tables. | MEDIUM | Standard pattern: Alembic owns `public.*`; collections hidden from Directus Data Model UI (v1.11 precedent). |
| SGN-20 | **APScheduler heartbeat sweeper** | Marks devices "stale" after N minutes without heartbeat. | LOW | 1-min cadence job on existing singleton. **Must respect the `--workers 1` + `max_instances=1` invariant locked in during v1.15.** |

**Table-stakes count:** 20 features. Appropriate for a milestone that already includes new schema + new admin app + new player app + async conversion pipeline.

---

## Differentiators (Nice-to-have; ship the cheap wins, defer the rest)

| ID | Feature | Value Proposition | Complexity | Recommendation |
|----|---------|-------------------|------------|----------------|
| DIFF-01 | **SSE real-time push** | "Hit save → screen updates in <2s" instead of "up to 30s." Huge perceived-quality win. | MEDIUM | **Ship in v1.** `sse-starlette` EventSourceResponse per device. Polling remains as fallback for proxies that buffer SSE. Incremental cost low given polling exists. |
| DIFF-02 | **Admin WYSIWYG preview** | "See what the Pi will show" before publishing — avoids the walk-to-the-lobby debug loop. | MEDIUM | **Ship in v1.** Embed the same Player component in a `<div>`, fed with chosen playlist. Falls out of player reuse. |
| DIFF-03 | **PDF crossfade between pages** | Feels modern vs. hard cut. | LOW | **Ship in v1.** CSS `transition: opacity` on pdf.js canvas swap. Trivial once pdf.js is in. |
| DIFF-04 | **Per-item transition picker** (fade / slide / cut) | Polish. | LOW | **Defer.** Ship single default (crossfade) in v1; picker is v1.17. |
| DIFF-05 | **Device health alerts** (email / toast on stale > 30 min) | Proactive vs. reactive failure detection. | MEDIUM | **Defer.** Status chips in the dashboard are sufficient for ≤5 devices; alerts need SMTP which isn't provisioned (per PROJECT.md). |
| DIFF-06 | **Content expiration dates** (`valid_until` on items) | "Show this Q2 banner only until June 30." | LOW | **Ship if fits** under half a day of effort; otherwise defer. Marginal v1 value. |
| DIFF-07 | **Playlist item thumbnail** on admin rows | Faster scanning. | LOW | **Defer.** Directus already thumbnails images; PDF/PPTX need first-page extraction. Not worth the extra pipeline branch in v1. |
| DIFF-08 | **PPTX native rendering** (preserve animations/fonts) | True-fidelity PowerPoint. | HIGH | **Skip.** No viable browser-native path. Convert-to-PDF is the right tradeoff. |
| DIFF-09 | **"Healthy since X" heartbeat chip** | Signals uptime streak to operators. | LOW | **Stretch.** Cheap derivation from `last_heartbeat_at` trend; ship if budget allows. |
| DIFF-10 | **Playlist priority / fallback** when multiple playlists match a device's tags | Deterministic conflict resolution. | LOW | **Ship in v1** only if the tag-resolution algorithm needs it; prefer constraining to "one playlist per tag" in v1 to avoid needing priority. |

**Recommended v1.16 differentiator set:** DIFF-01 (SSE), DIFF-02 (WYSIWYG preview), DIFF-03 (PDF crossfade). All three are low-incremental-cost and disproportionately improve the live-demo impression.

---

## Anti-Features (Explicitly NOT in this milestone)

| Anti-Feature | Surface Appeal | Why Problematic at This Scope | Alternative |
|--------------|----------------|-------------------------------|-------------|
| **Time-based schedules per device (dayparting)** | "Morning greeting, afternoon news." | Scheduler UI (time ranges, day-of-week, timezone, precedence) is half a milestone on its own and breaks one-playlist-per-tag simplicity. | v1 uses tag-based routing only; revisit in v1.17+ with a dedicated `schedules` table. |
| **Per-device calibration / screen-size adaptation** | "This TV is 4K, that one is 1080p." | Responsive variants + per-device detection + conditional pipelines for no demonstrated value. | Author media at 1920×1080; Chromium kiosk scales. |
| **20+ device fleet features** (bulk ops, CSV import, groups-of-groups) | "What if we scale?" | Premature abstraction — at ≤5 devices, manual ops beat abstract fleet tooling. | Single-device forms. Revisit at ~15+ devices. |
| **Proof-of-play / playback analytics** | "Prove the ad ran." | Event ingestion + aggregation + reporting UI is its own milestone. GDPR adjacency if external content. | Heartbeat + current-playlist chip is sufficient "is it running" evidence for internal use. |
| **SSO / OIDC for devices** | "Secure the player." | Kiosk devices can't do interactive auth. Industry-standard answer is device token from pairing. | Pairing issues long-lived device bearer token; rotate on re-pair. |
| **Multi-site / multi-tenant federation** | "What if another office joins?" | Org model + cross-site perms + routing = weeks of work. Single-site by design. | Spin up a second deployment if ever needed. |
| **Mobile app for device control** | "Preview from phone." | Separate build pipeline for marginal gain. | Make `/signage` admin pages responsive via Tailwind; skip native. |
| **External API for third-party integrations (Zapier, etc.)** | "Integrate with CRM." | Auth + rate limiting + contract stability = can of worms. | Keep API private to our frontend + players. |
| **PPTX native rendering in the browser** | "Why convert? Just render it." | No reliable browser PPTX renderer preserves animations/fonts. All serious platforms convert. | LibreOffice-headless → PDF → pdf.js. |
| **User-generated content moderation** | "Employees might upload bad media." | Only Admin uploads in v1 — no moderation needed. | Defer until Viewer-uploads are ever contemplated. |
| **On-the-fly video transcoding at upload** | "Auto-convert MOV to MP4." | FFmpeg-in-container adds build complexity, CPU load, job-queue surface. | Reject non-MP4/WebM at upload with a clear error. Operator converts offline. |
| **Regions / zones within a playlist** (Xibo-style layout engine) | "Logo in corner + ticker bottom + video main." | Layout engine is a product, not a feature. | Single full-screen item at a time; if overlays become essential, build a template for that one combo. |

---

## Feature Dependency Graph

```
SGN-16 (launcher tile, AdminOnly)
    └──hosts──> SGN-18 (bilingual admin UI)
                   └──consumes──> SGN-01..SGN-05 (CRUD surfaces)

SGN-19 (Alembic schema)
    ├──enables──> SGN-01 (media CRUD)
    ├──enables──> SGN-03 (playlist CRUD)
    └──enables──> SGN-04 (device CRUD)

SGN-01 (media) ──feeds──> SGN-03 (playlist items)
SGN-03 (playlist) ──consumed by──> SGN-08 (resolve endpoint)
SGN-05 (tag routing) ──drives──> SGN-08 (resolve endpoint)

SGN-06 (pairing)
    ├──requires──> ephemeral code store (in-memory TTL dict)
    └──claims──> SGN-04 (device record)

SGN-17 (player route)
    ├──requires──> SGN-08 (resolve + heartbeat)
    ├──requires──> SGN-10..SGN-15 (format handlers)
    ├──enhanced by──> DIFF-01 (SSE push)
    └──enhanced by──> SGN-07 (offline cache)

SGN-14 (PPTX handler)
    └──requires──> LibreOffice-headless service
                      ├──run via──> FastAPI BackgroundTask (v1) OR APScheduler queue job
                      ├──must respect──> workers=1 + max_instances=1 invariant (v1.15)
                      └──outputs──> PDF → reused by SGN-13

SGN-20 (heartbeat sweeper)
    ├──shares pattern──> v1.15 sensor-polling scheduler
    └──marks stale──> SGN-09 (status chip)

DIFF-01 (SSE) ──overlays──> SGN-08 (polling)     # never replaces, always coexists
DIFF-02 (preview) ──reuses──> SGN-17 (player component)
DIFF-03 (crossfade) ──requires──> SGN-13 (pdf.js in place)
```

### Dependency notes

- **Polling is the trunk; SSE is a graft.** Build polling first; SSE is additive. Corporate proxies that silently buffer SSE are a real failure mode — polling remains the safety net.
- **PPTX is the longest pole.** LibreOffice container dependency, conversion queuing, error surfacing. Scope-pressure fallback: ship "upload pre-converted PDF" as documented workaround. **Strongly recommend keeping auto-conversion** — operator-pre-converts-PPTX is exactly the friction that erodes adoption.
- **Pairing-code store doesn't need persistence** at 5 devices. 10-min TTL in-memory dict on FastAPI side is enough; restart invalidates unclaimed codes (acceptable). **Do NOT reach for Redis.**
- **Tags live on both sides.** Device has tags ("what am I?"); playlist has target tags ("who am I for?"). Intersection = routing. Xibo/Yodeck pattern; scales from 1 to 100 devices without re-architecture.

---

## MVP Definition

### Launch With (v1.16)

All 20 table-stakes (SGN-01..SGN-20) plus three low-cost differentiators (DIFF-01, DIFF-02, DIFF-03).

**Admin:**
- `/signage` admin tile (AdminOnly) on launcher
- Media library: upload (image, video, PDF, PPTX, URL, HTML), preview, tags, delete
- Playlist CRUD: create, reorder items, per-item duration, target-tag picker
- Device CRUD: list with status chips, edit name + tags, delete, issue pairing code
- Pair-new-device flow: operator enters 6-digit code shown on Pi → device claimed
- WYSIWYG preview panel (embed player with chosen playlist) — DIFF-02
- Bilingual DE/EN UI + one admin-guide article (Pi setup, pairing, offline behaviour, PPTX caveat)

**Player:**
- Chromium-kiosk page served at `/player` with device-token auth
- Boot-time pairing-code display when unclaimed
- Polling resolve + heartbeat (30s)
- SSE push for instant updates — DIFF-01
- Offline cache-and-loop (Service Worker + IndexedDB)
- Format handlers: image, video, URL iframe, pdf.js with crossfade (DIFF-03), HTML srcdoc, PPTX-as-PDF

**Infrastructure:**
- Alembic migration: `media`, `playlists`, `playlist_items`, `devices` (JSONB `tags`)
- FastAPI `/api/signage/*` router: media CRUD, playlist CRUD, device CRUD, `resolve`, `heartbeat`, `events` (SSE), `pair/{request,claim}`
- LibreOffice-headless conversion via FastAPI BackgroundTask (defer formal queue worker)
- APScheduler heartbeat-stale sweeper (1-min cadence; respects workers=1 invariant)

### Add After Validation (v1.17+)

- Dayparting / time-of-day schedules — once a dominant recurring use-case emerges
- Device health alerts (email / toast on stale > 30 min) — once SMTP is provisioned and operators stop watching the dashboard
- Per-item transition picker (DIFF-04) — polish pass
- Content expiration dates (DIFF-06) — when a user actually asks
- Playlist item thumbnails on admin rows (DIFF-07) — polish pass
- Formal background-worker queue (arq / rq / Celery) — only if PPTX conversion volume warrants

### Future Consideration (v2+)

- Multi-site federation
- Proof-of-play analytics
- External API for third-party integrations
- Per-device resolution adaptation
- Bulk device operations / CSV import
- Xibo-style regions/zones layout engine (if ever)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Media upload + library (SGN-01) | HIGH | MEDIUM | P1 |
| Media tagging (SGN-02) | MEDIUM | LOW | P1 |
| Playlist CRUD + ordering (SGN-03) | HIGH | MEDIUM | P1 |
| Device CRUD + status (SGN-04, SGN-09) | HIGH | MEDIUM | P1 |
| Tag-based routing (SGN-05) | HIGH | MEDIUM | P1 |
| 6-digit pairing (SGN-06) | HIGH | MEDIUM | P1 |
| Offline cache-and-loop (SGN-07) | HIGH | MEDIUM | P1 |
| Polling resolve + heartbeat (SGN-08) | HIGH | LOW | P1 |
| Image / Video / URL handlers (SGN-10..12) | HIGH | LOW | P1 |
| PDF handler (SGN-13) | HIGH | MEDIUM | P1 |
| PPTX handler (SGN-14) | HIGH | **HIGH** | P1 |
| HTML snippet handler (SGN-15) | MEDIUM | LOW | P1 |
| Launcher tile + player route (SGN-16, SGN-17) | HIGH (constraint) | LOW | P1 |
| Bilingual admin UI + docs article (SGN-18) | HIGH (constraint) | LOW | P1 |
| Alembic schema (SGN-19) | HIGH (constraint) | MEDIUM | P1 |
| APScheduler heartbeat sweeper (SGN-20) | MEDIUM | LOW | P1 |
| SSE push (DIFF-01) | MEDIUM | MEDIUM | P1 (cheap given polling exists) |
| WYSIWYG admin preview (DIFF-02) | MEDIUM | MEDIUM | P1 (falls out of player reuse) |
| PDF crossfade (DIFF-03) | LOW | LOW | P1 (trivial once pdf.js in) |
| Device health alerts (DIFF-05) | MEDIUM | MEDIUM | P2 |
| Per-item transitions (DIFF-04) | LOW | LOW | P2 |
| Content expiration (DIFF-06) | LOW | LOW | P2 |
| Playlist thumbnail rows (DIFF-07) | LOW | LOW | P2 |
| "Healthy since X" chip (DIFF-09) | LOW | LOW | P2 (stretch) |
| Dayparting schedules | MEDIUM | HIGH | P3 (v1.17 candidate) |
| Proof-of-play / analytics | LOW (internal) | HIGH | P3 |
| Multi-site federation | LOW (internal) | HIGH | P3 |

**P1 count:** 19 line items. Aligns with a single-milestone scope but sits near the ceiling — monitor PPTX-pipeline hours during execution; that's the swing item most likely to force a scope re-negotiation.

---

## Competitor Feature Analysis

| Feature | Xibo (OSS CMS) | Screenly OSE | Yodeck (SaaS) | Rise Vision (SaaS) | Our v1.16 Approach |
|---------|----------------|--------------|---------------|---------------------|---------------------|
| Media library | Full + widget modules | Basic assets | Rich with folders | Template-driven | Directus-backed, flat + tags (no folders) |
| Playlist model | Layouts + regions + timelines (complex) | Simple ordered list | Ordered playlists | Presentations (template-driven) | Simple ordered list (Screenly-style); regions deferred |
| Pairing | Display registration via CMS | One-click pair | 6-digit code | Claim code | 6-digit code (matches Yodeck familiarity) |
| Tag targeting | Layout campaigns + tags | Pro only | Tags + groups | Display groups | Single playlist per tag; tag array on device |
| Offline | Local cache | Strong (core prop) | Cache | Cache | Service Worker + IndexedDB manifest |
| Real-time push | XMPP | None (polling) | WebSocket | Polling + push | SSE (simpler than XMPP/WS for one-way) |
| PPTX | Widget (MS Office) | None | Cloud convert | Template-based | LibreOffice → PDF → pdf.js |
| PDF | Widget | Asset | Asset | Asset | pdf.js page-flip with crossfade |
| Scheduling | Dayparting + priority | Basic | Dayparting | Rich schedules | None in v1 (tag-only routing) |
| Analytics | Proof-of-play | None | Proof-of-play | Proof-of-play | None in v1 |
| Device cap | Unlimited | 1 (OSE) / unlimited (Pro) | Unlimited | Unlimited | ≤5 deliberately |

**Positioning:** Screenly-OSE floor (offline, simple playlists, tag routing) plus three Yodeck-tier niceties (6-digit pairing, SSE push, PPTX support). Explicitly skips Xibo's region/layout engine and all scheduling — which is what keeps it shippable in one milestone.

---

## Gaps Roadmapper Should Flag

- **Player auth model.** Device-token bearer (issued at pairing, stored in player cookie / localStorage) vs. signed URL per-request — architectural decision; keep minimal in v1.
- **Pairing-code TTL.** 10 minutes is the Yodeck convention; tune during implementation.
- **Offline cache eviction policy.** Size cap vs. LRU vs. "never evict current playlist" — needs a brief implementation-phase spike.
- **PPTX pipeline failure UX.** LibreOffice can choke on password-protected / corrupt / exotic-font PPTX. Decide upfront: fail upload hard, or store with warning + last-good preview.
- **Media storage limits.** Directus file storage is on the DB server; a 500 MB video library is fine, a 50 GB one needs S3-compatible offload. Not v1 concern but surface in docs.
- **`iframe` sandbox caveat** for SGN-12. Target sites with `X-Frame-Options: DENY` won't render; admin UI should warn on save after a HEAD probe.
- **Chromium autoplay policy.** `muted` attribute is mandatory for video autoplay without user gesture. Call out in implementation notes.

---

## Confidence Assessment

| Area | Level | Basis |
|------|-------|-------|
| Table-stakes taxonomy | HIGH | Four reference platforms converge; stable in industry for ~10 years. |
| Anti-feature boundaries | HIGH | Explicit in milestone brief; reinforced by scope (≤5 devices, single site). |
| Complexity labels | MEDIUM | Grounded in this codebase's patterns; actual hours depend on playlist-item editor UX polish and PPTX pipeline edge cases. |
| PPTX conversion approach | HIGH | LibreOffice-headless → PDF is universal; OnlyOffice/Collabora over-engineered at this scope. |
| SSE over WebSocket | HIGH | One-way server→player; SSE auto-reconnects, works through most proxies, less infra. |
| pdf.js for PDF | HIGH | Mozilla-maintained; alternative (convert-to-image) loses quality. |
| Offline cache architecture | MEDIUM | Service Worker + IndexedDB is right; exact eviction policy needs implementation-phase decision. |
| Pairing-code in-memory store | HIGH | 5-device scale makes Redis unnecessary; TTL dict is sufficient. |

---

## Sources

- **Xibo** — xibo.org.uk/docs (layouts, campaigns, display groups, XMPP push)
- **Screenly OSE / Anthias** — github.com/Screenly/Anthias (offline single-device playback as core value prop)
- **Yodeck** — yodeck.com/features (6-digit code pairing, tag groups, proof-of-play)
- **Rise Vision** — risevision.com (template-driven presentations, schedules, display groups)
- **pdf.js** — mozilla.github.io/pdf.js (canvas rendering, crossfade via CSS)
- **LibreOffice headless conversion** — `soffice --headless --convert-to pdf`; widely documented pattern
- **Chromium autoplay policy** — stable since v66: `muted` attribute required for autoplay without user gesture
- **sse-starlette** — `EventSourceResponse` (STACK.md owns version pinning)
- **Existing project context** — `.planning/PROJECT.md`, `CLAUDE.md` (stack decisions, APScheduler invariant from v1.15)

Exact library versions + API surfaces are owned by STACK.md; integration points + data flow by ARCHITECTURE.md; failure modes by PITFALLS.md. This document is pure feature taxonomy + prioritization.

---
*Feature research for: digital signage CMS + Chromium-kiosk player (v1.16)*
*Researched: 2026-04-18*
