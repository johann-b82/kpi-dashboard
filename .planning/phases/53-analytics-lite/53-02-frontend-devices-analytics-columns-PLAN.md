---
phase: 53-analytics-lite
plan: 02
type: execute
wave: 2
depends_on:
  - 53-01
files_modified:
  - frontend/src/signage/lib/signageTypes.ts
  - frontend/src/signage/lib/signageApi.ts
  - frontend/src/lib/queryKeys.ts
  - frontend/src/signage/components/UptimeBadge.tsx
  - frontend/src/signage/components/UptimeBadge.test.tsx
  - frontend/src/signage/pages/DevicesPage.tsx
  - frontend/src/signage/pages/DevicesPage.test.tsx
  - frontend/src/locales/en.json
  - frontend/src/locales/de.json
  - frontend/src/docs/en/admin-guide/digital-signage.md
  - frontend/src/docs/de/admin-guide/digital-signage.md
autonomous: true
requirements:
  - SGN-ANA-01
must_haves:
  truths:
    - "DevicesPage renders two new columns between Status and Last Seen: 'Uptime 24h %' and 'Missed 24h' (column order Status → Uptime → Missed → Last Seen → actions, per D-14)."
    - "Both columns derive from a second useQuery against signageKeys.deviceAnalytics() that polls signageApi.listDeviceAnalytics() every 30 s with refetchOnWindowFocus: true (D-11), independent of the existing listDevices query."
    - "UptimeBadge colour switches at threshold boundaries per D-13: green ≥ 95 %, amber 80–95 %, red < 80 %, neutral '—' when server returns uptime_24h_pct: null (zero-heartbeats case per D-16)."
    - "UptimeBadge tooltip shows the literal numerator/denominator wording ('1382 / 1440 one-minute windows had a heartbeat in the last 24 h' / 'über die letzten 24 h' — DE/EN parity per D-15), with window suffix 'over last Xh' when window_minutes < 1440 (D-06)."
    - "No dark: Tailwind variants in any new file inside frontend/src/signage/** (hard gate 3); no raw fetch( (hard gate 2); apiClient-only."
    - "All signage.admin.device.analytics.* i18n keys exist in both en.json and de.json; DE tone is informal 'du' (never 'Sie'/'Ihre'); check-locale-parity CI passes."
    - "Admin guide §Analytics / §Analyse appended to both frontend/src/docs/en/admin-guide/digital-signage.md and frontend/src/docs/de/admin-guide/digital-signage.md covering badge meaning, thresholds, 60 s window definition, partial-window note for new devices."
    - "npm run check:signage passes automatically — frontend/src/signage/components/UptimeBadge.tsx is inside check-signage-invariants.mjs ROOTS and scanned without the script needing edits (per RESEARCH §Invariants CI)."
    - "Vitest component test on DevicesPage renders both new columns, asserts badge-tier class mapping on threshold values (e.g. 95 → green, 94.9 → amber, 79.9 → red), asserts tooltip copy for both EN and DE (D-21). Separate UptimeBadge.test.tsx covers the pure tier-selector logic."
  artifacts:
    - path: "frontend/src/signage/lib/signageTypes.ts"
      provides: "SignageDeviceAnalytics TypeScript interface (mirror of backend DeviceAnalyticsRead)"
      contains: "SignageDeviceAnalytics"
    - path: "frontend/src/signage/lib/signageApi.ts"
      provides: "signageApi.listDeviceAnalytics() apiClient-backed method"
      contains: "listDeviceAnalytics"
    - path: "frontend/src/lib/queryKeys.ts"
      provides: "signageKeys.deviceAnalytics() query key factory entry"
      contains: "deviceAnalytics"
    - path: "frontend/src/signage/components/UptimeBadge.tsx"
      provides: "UptimeBadge component: threshold→colour + tooltip, no dark: variants"
      contains: "UptimeBadge"
      min_lines: 60
    - path: "frontend/src/signage/components/UptimeBadge.test.tsx"
      provides: "Unit tests for tier(pct) selector + tooltip copy switches"
      min_lines: 60
    - path: "frontend/src/signage/pages/DevicesPage.tsx"
      provides: "Two new <TableHead> + <TableCell> columns between Status and Last Seen + second useQuery"
      contains: "deviceAnalytics"
    - path: "frontend/src/signage/pages/DevicesPage.test.tsx"
      provides: "Component test: renders 2 new columns + threshold tier switching + EN/DE tooltip parity (D-21)"
      min_lines: 100
    - path: "frontend/src/locales/en.json"
      provides: "EN signage.admin.device.analytics.* keys"
      contains: "uptime24h"
    - path: "frontend/src/locales/de.json"
      provides: "DE signage.admin.device.analytics.* keys (du tone)"
      contains: "Betriebszeit"
    - path: "frontend/src/docs/en/admin-guide/digital-signage.md"
      provides: "§Analytics section"
      contains: "Analytics"
    - path: "frontend/src/docs/de/admin-guide/digital-signage.md"
      provides: "§Analyse section (du tone)"
      contains: "Analyse"
  key_links:
    - from: "DevicesPage second useQuery"
      to: "signageApi.listDeviceAnalytics"
      via: "queryKey signageKeys.deviceAnalytics(), refetchInterval 30_000, refetchOnWindowFocus: true"
      pattern: "signageKeys\\.deviceAnalytics\\(\\)"
    - from: "signageApi.listDeviceAnalytics"
      to: "GET /api/signage/analytics/devices"
      via: "apiClient<SignageDeviceAnalytics[]>"
      pattern: "apiClient.*signage/analytics/devices"
    - from: "DevicesPage row render"
      to: "UptimeBadge"
      via: "analyticsByDevice[device.id] lookup + <UptimeBadge />"
      pattern: "<UptimeBadge"
    - from: "UptimeBadge className classMap"
      to: "DeviceStatusChip pattern"
      via: "bg-green-100/text-green-800 + bg-amber-100/text-amber-800 + bg-red-100/text-red-800 + bg-muted/text-muted-foreground (no dark: variants, no new cva variants)"
      pattern: "bg-green-100|bg-amber-100|bg-red-100"
---

<objective>
Ship the frontend side of Phase 53 Analytics-lite: `listDeviceAnalytics` API client method, `signageKeys.deviceAnalytics()` query key, an `UptimeBadge` component that reuses DeviceStatusChip's className-override pattern, two new columns on `DevicesPage` between Status and Last Seen, a second polling `useQuery` with `refetchOnWindowFocus: true`, all `signage.admin.device.analytics.*` i18n keys in both locales (du-tone DE), a new §Analytics section in both EN and DE admin guides, and the two Vitest component tests (UptimeBadge + DevicesPage) required by D-21.

Purpose: Surface the per-device uptime/missed-windows metrics from the Plan 01 backend endpoint to operators — the user-visible deliverable of SGN-ANA-01 (milestone Success Criterion #5: "Devices table shows non-zero uptime numbers for at least one active device under observation").

Output: Plan 02 lands the entire frontend in a single atomic wave (Wave 2 gated on Plan 01's backend contract). After merge, the SegmentedControl's Devices tab gains two columns that tick every 30 s and refresh on tab visibility, with tooltips whose copy matches the literal SGN-ANA-01 wording.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/53-analytics-lite/53-CONTEXT.md
@.planning/phases/53-analytics-lite/53-RESEARCH.md
@.planning/phases/53-analytics-lite/53-01-SUMMARY.md
@frontend/src/signage/lib/signageTypes.ts
@frontend/src/signage/lib/signageApi.ts
@frontend/src/lib/queryKeys.ts
@frontend/src/signage/pages/DevicesPage.tsx
@frontend/src/signage/components/DeviceStatusChip.tsx
@frontend/src/components/ui/badge.tsx
@frontend/src/locales/en.json
@frontend/src/locales/de.json
@frontend/src/docs/en/admin-guide/digital-signage.md
@frontend/src/docs/de/admin-guide/digital-signage.md
@frontend/scripts/check-signage-invariants.mjs

<interfaces>
<!-- Committed by Plan 01. Executor mirrors these directly. -->

Backend contract (Plan 01):
- Endpoint: `GET /api/signage/analytics/devices`
- Response: `list[DeviceAnalyticsRead]` where each row is:
  ```python
  { "device_id": UUID_str,
    "uptime_24h_pct": float | None,   # null when server-side denominator == 0
    "missed_windows_24h": int,        # 0 when denominator == 0
    "window_minutes": int             # 0..1440 — drives "over last Xh" tooltip
  }
  ```
- Admin JWT required (inherited from signage_admin router — same auth as GET /api/signage/devices).
- Zero-heartbeat devices: Plan 01 SUMMARY must state whether the device is OMITTED from the response or INCLUDED with `uptime_24h_pct: null`. If omitted, Plan 02 client must handle the missing-key case (render neutral "—" badge when `analyticsByDevice[device.id]` is undefined). If included, Plan 02 client uses the null pct directly. Either way → neutral tier.

Existing frontend patterns (from codebase):

`frontend/src/lib/queryKeys.ts` (signageKeys factory, current shape after Phase 52):
```ts
export const signageKeys = {
  all: ["signage"] as const,
  media: () => ["signage", "media"] as const,
  mediaItem: (id) => ["signage", "media", id] as const,
  playlists: () => ["signage", "playlists"] as const,
  playlistItem: (id) => ["signage", "playlists", id] as const,
  devices: () => ["signage", "devices"] as const,
  tags: () => ["signage", "tags"] as const,
  schedules: () => ["signage", "schedules"] as const,
  scheduleItem: (id) => ["signage", "schedules", id] as const,
};
```

`frontend/src/signage/pages/DevicesPage.tsx` l.48–52 — existing query pattern:
```tsx
const { data: devices = [], isLoading } = useQuery({
  queryKey: signageKeys.devices(),
  queryFn: signageApi.listDevices,
  refetchInterval: 30_000,
});
```
Column order today: Name → Status → Last Seen → Actions (approximately — executor MUST grep the actual <TableHead> block and insert the two new columns between the Status column and the Last Seen column, NOT wherever they want).

`frontend/src/signage/components/DeviceStatusChip.tsx` l.37–52 — blessed pattern for semantic-colour badges without `dark:` variants:
```tsx
const classMap = {
  online:  "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  offline: "bg-red-100 text-red-800",
  unseen:  "bg-muted text-muted-foreground",
};
return <Badge className={classMap[status]}>{label}</Badge>;
```

Tooltip component availability (verified during planning):
- `frontend/src/components/ui/tooltip.tsx` does NOT exist in this repo.
- Fallback per RESEARCH §Pattern 8: use native `title={tooltipCopy}` attribute on a wrapping `<span>` (or directly on the Badge root). Less polished than a Radix Tooltip, keeps scope tight, zero new deps, screen-reader-accessible.

Global QueryClient refetchOnWindowFocus (verified during planning):
- `frontend/src/main.tsx` does NOT instantiate QueryClient locally — look in `frontend/src/App.tsx` or a dedicated provider file; executor should grep once at task start to confirm no global override is set to `false`.
- Defence-in-depth: always pass `refetchOnWindowFocus: true` explicitly on the analytics useQuery per D-11.

Invariants CI (from RESEARCH):
- `frontend/scripts/check-signage-invariants.mjs` scans `frontend/src/signage/pages`, `frontend/src/signage/components`, `frontend/src/signage/player`, `frontend/src/player`. Dropping `UptimeBadge.tsx` and `UptimeBadge.test.tsx` into `frontend/src/signage/components/` means the script covers them automatically — NO script edit needed.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Types + API client + query key + i18n keys (EN/DE du-tone)</name>
  <files>frontend/src/signage/lib/signageTypes.ts, frontend/src/signage/lib/signageApi.ts, frontend/src/lib/queryKeys.ts, frontend/src/locales/en.json, frontend/src/locales/de.json</files>
  <read_first>
    - frontend/src/signage/lib/signageTypes.ts — locate existing `SignageDevice` interface + append-point style
    - frontend/src/signage/lib/signageApi.ts — `listDevices` pattern (apiClient<SignageDevice[]>("/api/signage/devices"))
    - frontend/src/lib/queryKeys.ts l.60–71 — insertion point inside `signageKeys` object (before closing `};`)
    - frontend/src/locales/en.json — locate existing `signage.admin.device.*` block (inspect nesting style: flat-dotted vs nested-object; match whichever is used for current signage keys per Phase 52 precedent)
    - frontend/src/locales/de.json — existing du-tone phrasing for signage (e.g. "Wähle", "Lege an")
    - .planning/phases/53-analytics-lite/53-CONTEXT.md §D-17 (i18n namespace) and §D-15 (tooltip copy)
  </read_first>
  <behavior>
    - `SignageDeviceAnalytics` interface mirrors backend `DeviceAnalyticsRead` exactly: `{ device_id: string; uptime_24h_pct: number | null; missed_windows_24h: number; window_minutes: number }`.
    - `signageApi.listDeviceAnalytics()` GETs `/api/signage/analytics/devices` via the shared `apiClient` (hard gate 2 — no raw fetch).
    - `signageKeys.deviceAnalytics()` returns `["signage", "devices", "analytics"] as const` (subtree of devices for logical grouping).
    - All i18n keys in namespace `signage.admin.device.analytics.*` exist in BOTH locales with informal "du" tone in DE.
    - Key set (per D-17 minimum + tooltip copy derived from D-15/D-06):
      1. `signage.admin.device.analytics.uptime24h.label` → EN "Uptime 24h" / DE "Betriebszeit 24 h"
      2. `signage.admin.device.analytics.uptime24h.tooltip` → EN "{{buckets}} / {{denom}} one-minute windows had a heartbeat in the last 24 h." / DE "{{buckets}} / {{denom}} Ein-Minuten-Fenster hatten in den letzten 24 h einen Heartbeat."
      3. `signage.admin.device.analytics.uptime24h.tooltip_partial` → EN "{{buckets}} / {{denom}} one-minute windows had a heartbeat over the last {{windowH}} h (device is new)." / DE "{{buckets}} / {{denom}} Ein-Minuten-Fenster hatten in den letzten {{windowH}} h einen Heartbeat (Gerät ist neu)."
      4. `signage.admin.device.analytics.missed24h.label` → EN "Missed 24h" / DE "Ausfälle 24 h"
      5. `signage.admin.device.analytics.missed24h.tooltip` → EN "{{missed}} one-minute windows without a heartbeat in the last 24 h." / DE "{{missed}} Ein-Minuten-Fenster ohne Heartbeat in den letzten 24 h."
      6. `signage.admin.device.analytics.missed24h.tooltip_partial` → EN "{{missed}} one-minute windows without a heartbeat over the last {{windowH}} h." / DE "{{missed}} Ein-Minuten-Fenster ohne Heartbeat in den letzten {{windowH}} h."
      7. `signage.admin.device.analytics.badge.noData` → EN "No heartbeats yet." / DE "Noch keine Heartbeats."
    - All 7 keys exist in BOTH en.json and de.json (14 entries total). DE values contain no "Sie"/"Ihre".
    - No new raw `fetch(`; existing imports in signageApi.ts are preserved.
  </behavior>
  <action>
    **File 1 — frontend/src/signage/lib/signageTypes.ts:**
    Append AFTER the existing `SignageDevice` interface (and any adjacent Device* types) — do NOT edit any existing types:
    ```ts
    /**
     * Phase 53 SGN-ANA-01 — mirrors backend DeviceAnalyticsRead.
     * uptime_24h_pct is null when the server's denominator is 0 (zero
     * heartbeats retained). missed_windows_24h is 0 in that case.
     * window_minutes ∈ [0, 1440] — when < 1440 the frontend shows
     * the "_partial" tooltip variant with `windowH = Math.ceil(window_minutes/60)`.
     */
    export interface SignageDeviceAnalytics {
      device_id: string;
      uptime_24h_pct: number | null;
      missed_windows_24h: number;
      window_minutes: number;
    }
    ```

    **File 2 — frontend/src/signage/lib/signageApi.ts:**
    1. Ensure `SignageDeviceAnalytics` is imported from `./signageTypes` (add to the existing import block from that module).
    2. Inside the `signageApi` object, after `listDevices` (so the analytics method sits next to its subject), insert:
       ```ts
       // Phase 53 SGN-ANA-01 — Analytics-lite. Separate query from listDevices
       // so the two data streams can poll/invalidate independently (D-11).
       // Backend: backend/app/routers/signage_admin/analytics.py
       listDeviceAnalytics: () =>
         apiClient<SignageDeviceAnalytics[]>("/api/signage/analytics/devices"),
       ```

    **File 3 — frontend/src/lib/queryKeys.ts:**
    Inside the existing `signageKeys` object, BEFORE the closing `};`, add ONE entry. Mirror Phase 52's minimal-diff pattern:
    ```ts
      // Phase 53 SGN-ANA-01
      deviceAnalytics: () => ["signage", "devices", "analytics"] as const,
    ```
    Do NOT rewrite the entire `signageKeys` block.

    **Files 4+5 — frontend/src/locales/en.json AND frontend/src/locales/de.json:**
    Inspect the existing `signage.admin.device.*` keys first to determine the file's nesting style (flat-dotted top-level strings like `"signage.admin.device.revoked": "Revoked"` vs. nested objects like `signage: { admin: { device: { revoked: "Revoked" } } }`). Phase 52 Plan 01 chose flat-dotted — follow whatever convention the current file actually uses.

    Add these 7 key pairs in BOTH files (14 total entries) in the detected nesting style. Copy EN/DE text verbatim from <behavior>:

    - `signage.admin.device.analytics.uptime24h.label`
    - `signage.admin.device.analytics.uptime24h.tooltip`
    - `signage.admin.device.analytics.uptime24h.tooltip_partial`
    - `signage.admin.device.analytics.missed24h.label`
    - `signage.admin.device.analytics.missed24h.tooltip`
    - `signage.admin.device.analytics.missed24h.tooltip_partial`
    - `signage.admin.device.analytics.badge.noData`

    DE rules (hard gate 1):
    - No "Sie" / "Ihre" / "Ihr" in any new DE value.
    - Placeholders use the `{{var}}` form already used by Phase 52 DE copy (`{{detail}}`, `{{name}}`, etc.).

    Number-formatting note: `window_minutes` is rounded to hours via client-side `Math.ceil(window_minutes/60)` before interpolation — the template receives an integer via `{{windowH}}`.
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit 2>&1 | tail -15 && npm run check:i18n-parity 2>&1 | tail -15 && node -e "const en=require('./src/locales/en.json'); const de=require('./src/locales/de.json'); const keys=['signage.admin.device.analytics.uptime24h.label','signage.admin.device.analytics.uptime24h.tooltip','signage.admin.device.analytics.uptime24h.tooltip_partial','signage.admin.device.analytics.missed24h.label','signage.admin.device.analytics.missed24h.tooltip','signage.admin.device.analytics.missed24h.tooltip_partial','signage.admin.device.analytics.badge.noData']; const get=(o,k)=>k.split('.').reduce((a,p)=>a&&a[p],o)??(o[k]); const missEn=keys.filter(k=>get(en,k)===undefined); const missDe=keys.filter(k=>get(de,k)===undefined); if(missEn.length||missDe.length){console.error('MISSING',{missEn,missDe});process.exit(1)} console.log('All 7 keys present in both locales.')"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export interface SignageDeviceAnalytics" frontend/src/signage/lib/signageTypes.ts` succeeds
    - `grep -q "uptime_24h_pct: number | null" frontend/src/signage/lib/signageTypes.ts` succeeds
    - `grep -q "window_minutes: number" frontend/src/signage/lib/signageTypes.ts` succeeds
    - `grep -q "listDeviceAnalytics: () =>" frontend/src/signage/lib/signageApi.ts` succeeds
    - `grep -q '/api/signage/analytics/devices' frontend/src/signage/lib/signageApi.ts` succeeds
    - `grep -q 'deviceAnalytics: () => \["signage", "devices", "analytics"\] as const' frontend/src/lib/queryKeys.ts` succeeds
    - All 7 keys present in BOTH locales (node verify script inside `<automated>` exits 0)
    - `cd frontend && npm run check:i18n-parity` exits 0
    - DE locale has no "Sie "/"Ihre "/"Ihr " in the diff of newly-added keys: `git diff frontend/src/locales/de.json | grep -E '^\+' | grep -E '"Sie |"Ihre |"Ihr |: "Sie | Sie[^a-zäöüß]' ` returns empty
    - No new raw `fetch(` in any file: `git diff frontend/src/signage/lib/signageApi.ts | grep -E '^\+.*fetch\('` returns empty
    - `cd frontend && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Type, API client, query key, and all 7 i18n key-pairs land in the right files. No raw fetch. DE du-tone. Typechecks green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: UptimeBadge component + unit tests (tier selector + tooltip copy)</name>
  <files>frontend/src/signage/components/UptimeBadge.tsx, frontend/src/signage/components/UptimeBadge.test.tsx</files>
  <read_first>
    - frontend/src/signage/components/DeviceStatusChip.tsx (blessed className-override pattern — copy the shape)
    - frontend/src/components/ui/badge.tsx (shadcn Badge signature — confirm `className` prop overrides variant)
    - frontend/src/signage/components/*.test.tsx if any (test harness conventions — QueryClientProvider/i18n wrappers)
    - .planning/phases/53-analytics-lite/53-RESEARCH.md §Pattern 8 (UptimeBadge recommendation + tooltip fallback)
  </read_first>
  <behavior>
    **Pure tier selector (exported for unit tests):**
    ```ts
    export type UptimeTier = "green" | "amber" | "red" | "neutral";
    export function uptimeTier(pct: number | null): UptimeTier {
      if (pct === null) return "neutral";
      if (pct >= 95)   return "green";
      if (pct >= 80)   return "amber";
      return "red";
    }
    ```
    Threshold semantics match D-13 exactly: 95.0 → green, 94.9 → amber, 80.0 → amber, 79.9 → red.

    **Class map (no `dark:` variants):**
    ```ts
    const CLASS_MAP: Record<UptimeTier, string> = {
      green:   "bg-green-100 text-green-800",
      amber:   "bg-amber-100 text-amber-800",
      red:     "bg-red-100 text-red-800",
      neutral: "bg-muted text-muted-foreground",
    };
    ```

    **Component API:**
    ```ts
    interface UptimeBadgeProps {
      variant: "uptime" | "missed";          // drives which label + tooltip keyset is used
      data: SignageDeviceAnalytics | undefined;  // undefined → neutral tier, noData tooltip
    }
    ```

    **Render logic:**
    - `variant="uptime"`:
      - Label: `data?.uptime_24h_pct === null || data === undefined ? "—" : `${data.uptime_24h_pct.toFixed(1)}%"`
      - Tier: `uptimeTier(data?.uptime_24h_pct ?? null)` when `data` defined; `"neutral"` when `data` undefined.
      - Tooltip: `data === undefined || data.uptime_24h_pct === null` → `t("signage.admin.device.analytics.badge.noData")`; else if `data.window_minutes < 1440` → `t("signage.admin.device.analytics.uptime24h.tooltip_partial", { buckets, denom, windowH })` (where `buckets = data.window_minutes - data.missed_windows_24h`, `denom = data.window_minutes`, `windowH = Math.ceil(data.window_minutes / 60)`); else → `t("signage.admin.device.analytics.uptime24h.tooltip", { buckets, denom })`.
    - `variant="missed"`:
      - Label: `data === undefined || data.uptime_24h_pct === null ? "—" : String(data.missed_windows_24h)`
      - Tier: `data === undefined || data.uptime_24h_pct === null ? "neutral" : uptimeTier(data.uptime_24h_pct)` (mirrors the sibling uptime badge so a row's two badges are always the same colour).
      - Tooltip: same noData/partial/default logic as above, using `missed24h.tooltip` / `missed24h.tooltip_partial` keys with `{{missed}}` + `{{windowH}}` placeholders.
    - Tooltip is emitted as `title={tooltipCopy}` on a `<span>` wrapping the `<Badge>` (RESEARCH §Pattern 8 fallback — no Radix Tooltip in this repo). The Badge itself stays `<Badge className={CLASS_MAP[tier]}>{label}</Badge>`.

    **Unit tests (RED→GREEN; test file first):**
    1. `uptimeTier(null) === "neutral"`
    2. `uptimeTier(100) === "green"`; `uptimeTier(95) === "green"`; `uptimeTier(94.9) === "amber"`
    3. `uptimeTier(80) === "amber"`; `uptimeTier(79.9) === "red"`; `uptimeTier(0) === "red"`
    4. Render `<UptimeBadge variant="uptime" data={undefined} />` → label contains `"—"`, class string contains `bg-muted`, `title` attribute contains the `badge.noData` value for whichever locale is active in the test harness.
    5. Render `<UptimeBadge variant="uptime" data={{device_id:"d1", uptime_24h_pct:95.0, missed_windows_24h:72, window_minutes:1440}} />` → label `"95.0%"`, class string contains `bg-green-100`, title contains `"1368 / 1440"` (buckets=1440-72).
    6. Render `<UptimeBadge variant="uptime" data={{...pct:79.9, window_minutes:1440, missed_windows_24h:290}} />` → class contains `bg-red-100`.
    7. Render `<UptimeBadge variant="missed" data={{...pct:50.0, missed_windows_24h:720, window_minutes:1440}} />` → label `"720"`, class contains `bg-red-100` (mirrors uptime tier, which is red for 50%), title contains `"720 one-minute windows"` (or the DE equivalent).
    8. Render `<UptimeBadge variant="uptime" data={{...pct:100.0, missed_windows_24h:0, window_minutes:30}} />` → label `"100.0%"`, class contains `bg-green-100`, title matches the `tooltip_partial` copy with `{{windowH}}=1` (30/60 → Math.ceil → 1).
  </behavior>
  <action>
    **Write the test file FIRST (RED):**
    Create `frontend/src/signage/components/UptimeBadge.test.tsx`. Mirror whatever test-harness shape exists in e.g. `frontend/src/signage/components/DeviceEditDialog.test.tsx` (if present) — QueryClientProvider + I18nextProvider + Router wrappers as needed. For pure tier-selector tests, no wrappers needed: `import { uptimeTier } from "./UptimeBadge"`.

    Sketch:
    ```tsx
    import { render, screen } from "@testing-library/react";
    import { describe, it, expect } from "vitest";
    import { I18nextProvider } from "react-i18next";
    import i18n from "@/i18n";
    import { UptimeBadge, uptimeTier } from "./UptimeBadge";

    describe("uptimeTier", () => {
      it("maps null → neutral", () => expect(uptimeTier(null)).toBe("neutral"));
      it("maps ≥95 → green", () => {
        expect(uptimeTier(100)).toBe("green");
        expect(uptimeTier(95)).toBe("green");
        expect(uptimeTier(94.9)).toBe("amber");
      });
      it("maps 80..94.9 → amber", () => {
        expect(uptimeTier(80)).toBe("amber");
        expect(uptimeTier(79.9)).toBe("red");
        expect(uptimeTier(0)).toBe("red");
      });
    });

    describe("<UptimeBadge />", () => {
      const wrap = (ui) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

      it("renders neutral '—' for undefined data", () => {
        const { container } = wrap(<UptimeBadge variant="uptime" data={undefined} />);
        expect(container.textContent).toContain("—");
        expect(container.innerHTML).toMatch(/bg-muted/);
      });

      it("renders green for 95%", () => { /* ... */ });
      it("renders red for 79.9%", () => { /* ... */ });
      it("missed variant inherits row tier (red for 50% uptime)", () => { /* ... */ });
      it("partial window uses tooltip_partial with windowH=Math.ceil(window_minutes/60)", () => { /* ... */ });
      it("tooltip contains buckets / denom numbers for full 24h", () => {
        const { container } = wrap(<UptimeBadge variant="uptime" data={{device_id:"d1", uptime_24h_pct:95.0, missed_windows_24h:72, window_minutes:1440}} />);
        // query by title attribute on the wrapping span
        const span = container.querySelector("span[title]");
        expect(span?.getAttribute("title")).toContain("1368");
        expect(span?.getAttribute("title")).toContain("1440");
      });
    });
    ```

    Run this and confirm tests fail (file doesn't exist yet).

    **Now write the component (GREEN):**
    `frontend/src/signage/components/UptimeBadge.tsx`:

    ```tsx
    import { useTranslation } from "react-i18next";
    import { Badge } from "@/components/ui/badge";
    import type { SignageDeviceAnalytics } from "@/signage/lib/signageTypes";

    /**
     * Phase 53 SGN-ANA-01 — per-device uptime / missed-windows badge.
     *
     * Two variants (uptime / missed) share tier logic so a row's two badges
     * always agree in colour. Threshold boundaries per D-13:
     *   pct ≥ 95 → green, 80 ≤ pct < 95 → amber, pct < 80 → red,
     *   pct === null (zero heartbeats ever) → neutral '—'.
     *
     * className-override pattern mirrors DeviceStatusChip (no new shadcn variant,
     * no `dark:` classes — hard gate 3 stays clean because frontend/src/signage/**
     * is scanned by check-signage-invariants.mjs).
     *
     * Tooltip uses native `title=` on a wrapping span (no Radix Tooltip in this
     * repo — see 53-RESEARCH.md §Pattern 8). Literal numerator/denominator per
     * D-15. DE/EN parity driven by i18n.
     */
    export type UptimeTier = "green" | "amber" | "red" | "neutral";

    export function uptimeTier(pct: number | null): UptimeTier {
      if (pct === null) return "neutral";
      if (pct >= 95)    return "green";
      if (pct >= 80)    return "amber";
      return "red";
    }

    const CLASS_MAP: Record<UptimeTier, string> = {
      green:   "bg-green-100 text-green-800",
      amber:   "bg-amber-100 text-amber-800",
      red:     "bg-red-100 text-red-800",
      neutral: "bg-muted text-muted-foreground",
    };

    export interface UptimeBadgeProps {
      variant: "uptime" | "missed";
      data: SignageDeviceAnalytics | undefined;
    }

    export function UptimeBadge({ variant, data }: UptimeBadgeProps) {
      const { t } = useTranslation();
      const noData = data === undefined || data.uptime_24h_pct === null;
      const tier = noData ? "neutral" : uptimeTier(data!.uptime_24h_pct);
      const label = noData
        ? "—"
        : variant === "uptime"
          ? `${data!.uptime_24h_pct!.toFixed(1)}%`
          : String(data!.missed_windows_24h);

      let tooltip: string;
      if (noData) {
        tooltip = t("signage.admin.device.analytics.badge.noData");
      } else {
        const partial = data!.window_minutes < 1440;
        const buckets = data!.window_minutes - data!.missed_windows_24h;
        const denom = data!.window_minutes;
        const windowH = Math.ceil(data!.window_minutes / 60);
        if (variant === "uptime") {
          tooltip = partial
            ? t("signage.admin.device.analytics.uptime24h.tooltip_partial", { buckets, denom, windowH })
            : t("signage.admin.device.analytics.uptime24h.tooltip", { buckets, denom });
        } else {
          tooltip = partial
            ? t("signage.admin.device.analytics.missed24h.tooltip_partial", { missed: data!.missed_windows_24h, windowH })
            : t("signage.admin.device.analytics.missed24h.tooltip", { missed: data!.missed_windows_24h });
        }
      }

      return (
        <span title={tooltip} className="inline-block">
          <Badge className={CLASS_MAP[tier]}>{label}</Badge>
        </span>
      );
    }
    ```

    Run the tests again — all should pass. If any test asserts a specific substring against translated output and i18n loads asynchronously in the test harness, either use `waitFor` or configure the i18n test instance for synchronous init (match whatever existing `*.test.tsx` files do).

    Hard gates:
    - NO `dark:` variants anywhere in this file or the test file.
    - NO raw `fetch(`.
    - NO new shadcn variant added to `@/components/ui/badge.tsx` (that file is grandfathered but not part of this plan).
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/signage/components/UptimeBadge.test.tsx 2>&1 | tail -30 && npx tsc --noEmit 2>&1 | tail -15 && ! grep -nE 'dark:|fetch\(' src/signage/components/UptimeBadge.tsx src/signage/components/UptimeBadge.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `cd frontend && npx vitest run src/signage/components/UptimeBadge.test.tsx` exits 0 with ≥7 passing tests (tier pure-logic + component render cases)
    - `grep -q "export function uptimeTier" frontend/src/signage/components/UptimeBadge.tsx` succeeds
    - `grep -q "export function UptimeBadge" frontend/src/signage/components/UptimeBadge.tsx` succeeds
    - `grep -qE "bg-green-100|bg-amber-100|bg-red-100|bg-muted" frontend/src/signage/components/UptimeBadge.tsx` succeeds with all 4 tier colours present
    - `grep -q "title={tooltip}" frontend/src/signage/components/UptimeBadge.tsx` succeeds (native title fallback)
    - `grep -nE 'dark:|fetch\(' frontend/src/signage/components/UptimeBadge.tsx frontend/src/signage/components/UptimeBadge.test.tsx` returns empty
    - `grep -q "tooltip_partial" frontend/src/signage/components/UptimeBadge.tsx` succeeds (D-06 partial-window tooltip)
    - `grep -q "Math.ceil(data\\!\\.window_minutes / 60)" frontend/src/signage/components/UptimeBadge.tsx` succeeds
    - `cd frontend && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>UptimeBadge exports a pure tier selector + a component that renders threshold-coloured badges with numeric tooltips, covered by ≥7 Vitest tests.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: DevicesPage — 2 new columns + analytics useQuery + component test (D-21)</name>
  <files>frontend/src/signage/pages/DevicesPage.tsx, frontend/src/signage/pages/DevicesPage.test.tsx</files>
  <read_first>
    - frontend/src/signage/pages/DevicesPage.tsx (full file — identify the <TableHead> block order and the <TableCell> renderer to match)
    - frontend/src/signage/components/UptimeBadge.tsx (Task 2 — import + use)
    - frontend/src/signage/components/DeviceStatusChip.tsx (visual reference for column ordering context)
    - frontend/src/App.tsx or wherever QueryClient is instantiated — confirm no global `refetchOnWindowFocus: false` override
    - Any existing `frontend/src/signage/pages/*.test.tsx` — copy the render-wrapper pattern (QueryClientProvider + I18nextProvider + Router + sonner Toaster if needed)
    - .planning/phases/53-analytics-lite/53-CONTEXT.md §D-14 (column order) and §D-21 (test coverage)
  </read_first>
  <behavior>
    **DevicesPage.tsx edits (minimal diff):**
    1. New second useQuery alongside the existing `listDevices` query, using `signageKeys.deviceAnalytics()`, `refetchInterval: 30_000`, `refetchOnWindowFocus: true` (D-11). Transform the response into `analyticsByDevice: Record<string, SignageDeviceAnalytics>` via `Object.fromEntries(rows.map(r => [r.device_id, r]))` inside `queryFn` so the render layer does O(1) lookups.
    2. New imports:
       - `UptimeBadge` from `@/signage/components/UptimeBadge`
       - `SignageDeviceAnalytics` from `@/signage/lib/signageTypes`
    3. New `<TableHead>` cells in the header row, inserted BETWEEN the Status column and the Last Seen column:
       ```tsx
       <TableHead>{t("signage.admin.device.analytics.uptime24h.label")}</TableHead>
       <TableHead>{t("signage.admin.device.analytics.missed24h.label")}</TableHead>
       ```
    4. New `<TableCell>` renders in the body row, in the same position (between the existing Status cell and Last Seen cell):
       ```tsx
       <TableCell><UptimeBadge variant="uptime"  data={analyticsByDevice[device.id]} /></TableCell>
       <TableCell><UptimeBadge variant="missed"  data={analyticsByDevice[device.id]} /></TableCell>
       ```
    5. Final row order after edit: Name → Status → Uptime 24h → Missed 24h → Last Seen → Actions (confirming D-14).
    6. Empty-state branch (`devices.length === 0`) is unchanged — no analytics columns shown when there are no devices.
    7. NO changes to the existing listDevices query, the revoke mutation, or any edit dialog code.

    **DevicesPage.test.tsx (NEW or EXTEND if present) — D-21:**
    1. `renders two new analytics columns with correct header labels` — mock signageApi to return 1 device + 1 analytics row; assert `getByText("Uptime 24h")` AND `getByText("Missed 24h")` exist in the DOM (or the DE equivalents if the test harness sets DE as active).
    2. `column order is Status → Uptime → Missed → Last Seen` — query the <TableHead> row via `within(header).getAllByRole('columnheader')`; assert the ordered array of textContent includes `Uptime` then `Missed` consecutively, immediately after the Status header and immediately before the Last Seen header.
    3. `95% analytics value renders a green badge` — seed `{uptime_24h_pct: 95.0, missed_windows_24h: 72, window_minutes: 1440}`; assert the rendered row contains an element with class `bg-green-100`.
    4. `94.9% renders amber` — seed `{uptime_24h_pct: 94.9, ...}`; assert `bg-amber-100` present, `bg-green-100` absent.
    5. `79.9% renders red` — seed; assert `bg-red-100`.
    6. `device missing from analytics response renders neutral '—'` — seed 1 device with id `d1` but analytics returns `[]`. Assert the Uptime cell in row for `d1` contains `"—"` and class `bg-muted`.
    7. `tooltip shows literal numerator/denominator in EN` — seed `{pct:95.0, missed:72, window_minutes:1440}`. Switch i18n to EN in the test. Query the uptime Badge's wrapping `<span>` by title attribute; assert `title` contains `"1368"` and `"1440"` and the phrase `"had a heartbeat in the last 24 h"` (substring match).
    8. `tooltip shows DE copy when DE active` — same data, switch i18n to DE via `i18n.changeLanguage("de")`; re-render; assert title contains `"Heartbeat"` AND `"Ein-Minuten-Fenster"` (DE-only substring — ensures parity test actually proved DE rendered, not just that EN was present).
    9. `partial-window device shows tooltip_partial with windowH=1 for 30-minute-old device` — seed `{pct:100.0, missed:0, window_minutes:30}`. Assert title contains `"1"` (windowH) and `"30"` (denominator) AND the partial-variant unique substring (EN: "device is new" / DE: "Gerät ist neu").
    10. `analytics query uses refetchOnWindowFocus: true` — render the page, introspect the QueryClient via `queryClient.getQueryCache().find({queryKey: ["signage", "devices", "analytics"]})`, assert the query's state includes `refetchOnWindowFocus: true` in its options (check via the query instance's `options` or by mocking `useQuery` to capture its args — whichever is easier given the project's test-utils).
  </behavior>
  <action>
    **File 1 — frontend/src/signage/pages/DevicesPage.tsx:**

    Step A — Add imports at the top (matching existing import order):
    ```tsx
    import { UptimeBadge } from "@/signage/components/UptimeBadge";
    import type { SignageDeviceAnalytics } from "@/signage/lib/signageTypes";
    ```

    Step B — Add the second useQuery immediately after the existing `const { data: devices = [], isLoading } = useQuery({ ... });` block:
    ```tsx
    // Phase 53 SGN-ANA-01 — per-device analytics. Separate query so the two
    // streams poll/invalidate independently. 30 s matches existing cadence;
    // refetchOnWindowFocus covers the tab-visibility refresh requirement (D-11).
    const { data: analyticsByDevice = {} } = useQuery<Record<string, SignageDeviceAnalytics>>({
      queryKey: signageKeys.deviceAnalytics(),
      queryFn: async () => {
        const rows = await signageApi.listDeviceAnalytics();
        return Object.fromEntries(rows.map((r) => [r.device_id, r]));
      },
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    });
    ```

    Step C — Locate the `<TableHead>` row inside the `<TableHeader>` block. Find the entry whose i18n key matches Status (likely `signage.admin.device.col.status` or similar — grep first). IMMEDIATELY AFTER that Status `<TableHead>` and IMMEDIATELY BEFORE the Last Seen `<TableHead>`, insert:
    ```tsx
    <TableHead>{t("signage.admin.device.analytics.uptime24h.label")}</TableHead>
    <TableHead>{t("signage.admin.device.analytics.missed24h.label")}</TableHead>
    ```

    Step D — Locate the corresponding `<TableCell>` containing `<DeviceStatusChip ... />`. IMMEDIATELY AFTER it and IMMEDIATELY BEFORE the Last Seen `<TableCell>`, insert:
    ```tsx
    <TableCell><UptimeBadge variant="uptime"  data={analyticsByDevice[device.id]} /></TableCell>
    <TableCell><UptimeBadge variant="missed"  data={analyticsByDevice[device.id]} /></TableCell>
    ```

    Verify the final column count in both header and body rows matches (existing_count + 2). Do NOT reorder any other cells.

    **File 2 — frontend/src/signage/pages/DevicesPage.test.tsx:**

    If a DevicesPage test file already exists, EXTEND it with new `describe("Phase 53 analytics columns", ...)` block covering tests 1–10. If not, CREATE a new file. Render-wrapper pattern lifted from other signage tests:

    ```tsx
    import { render, screen, within } from "@testing-library/react";
    import { describe, it, expect, beforeEach, vi } from "vitest";
    import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
    import { I18nextProvider } from "react-i18next";
    import i18n from "@/i18n";
    import { Router } from "wouter";
    import { DevicesPage } from "./DevicesPage";
    import { signageApi } from "@/signage/lib/signageApi";

    vi.mock("@/signage/lib/signageApi", () => ({
      signageApi: {
        listDevices: vi.fn(),
        listDeviceAnalytics: vi.fn(),
        revokeDevice: vi.fn(),
        // ... any other methods DevicesPage calls
      },
    }));

    const renderPage = () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      return {
        qc,
        ...render(
          <QueryClientProvider client={qc}>
            <I18nextProvider i18n={i18n}>
              <Router base="">
                <DevicesPage />
              </Router>
            </I18nextProvider>
          </QueryClientProvider>
        ),
      };
    };

    describe("Phase 53 analytics columns", () => {
      beforeEach(async () => {
        await i18n.changeLanguage("en");
      });

      it("renders Uptime and Missed column headers", async () => {
        (signageApi.listDevices as any).mockResolvedValueOnce([
          { id: "d1", name: "Foo", status: "online", last_seen_at: new Date().toISOString(), revoked_at: null },
        ]);
        (signageApi.listDeviceAnalytics as any).mockResolvedValueOnce([
          { device_id: "d1", uptime_24h_pct: 95.0, missed_windows_24h: 72, window_minutes: 1440 },
        ]);
        renderPage();
        expect(await screen.findByText(/Uptime 24h/i)).toBeInTheDocument();
        expect(await screen.findByText(/Missed 24h/i)).toBeInTheDocument();
      });

      it("column order is Status → Uptime → Missed → Last Seen", async () => { /* … */ });
      it("95% renders a green badge", async () => { /* … */ });
      it("94.9% renders amber", async () => { /* … */ });
      it("79.9% renders red", async () => { /* … */ });
      it("device missing from analytics map renders neutral '—'", async () => { /* … */ });
      it("tooltip contains literal numerator/denominator in EN", async () => { /* … */ });
      it("tooltip switches to DE copy when i18n changes", async () => {
        /* … seed data, render, screen.getByTitle(/Heartbeat.*Ein-Minuten-Fenster/) … */
      });
      it("partial-window 30-minute device shows partial tooltip with windowH=1", async () => { /* … */ });
      it("analytics query uses refetchOnWindowFocus: true", async () => {
        const { qc } = renderPage();
        // wait for query to populate
        await vi.waitFor(() => {
          const q = qc.getQueryCache().find({ queryKey: ["signage", "devices", "analytics"] });
          expect(q).toBeDefined();
        });
        const q = qc.getQueryCache().find({ queryKey: ["signage", "devices", "analytics"] })!;
        expect((q.options as any).refetchOnWindowFocus).toBe(true);
      });
    });
    ```

    Use the exact mock signature that matches whatever other `*.test.tsx` files in this repo use (grep for `vi.mock("@/signage/lib/signageApi"` to align). If the existing harness uses `msw` instead of `vi.mock`, switch to that.

    Hard gates: NO `dark:` variants in either file. NO raw `fetch(`. NO new global state. The invariants CI script auto-scans both files — no script edit needed.
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/signage/pages/DevicesPage.test.tsx 2>&1 | tail -40 && npx tsc --noEmit 2>&1 | tail -15 && npm run check:signage 2>&1 | tail -15 && ! grep -nE 'dark:|fetch\(' src/signage/pages/DevicesPage.tsx src/signage/pages/DevicesPage.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "signageApi.listDeviceAnalytics" frontend/src/signage/pages/DevicesPage.tsx` succeeds
    - `grep -q "signageKeys.deviceAnalytics()" frontend/src/signage/pages/DevicesPage.tsx` succeeds
    - `grep -q "refetchOnWindowFocus: true" frontend/src/signage/pages/DevicesPage.tsx` succeeds (D-11)
    - `grep -q "refetchInterval: 30_000" frontend/src/signage/pages/DevicesPage.tsx` returns ≥2 matches now (existing one + new analytics query)
    - `grep -q "<UptimeBadge variant=\"uptime\"" frontend/src/signage/pages/DevicesPage.tsx` succeeds
    - `grep -q "<UptimeBadge variant=\"missed\"" frontend/src/signage/pages/DevicesPage.tsx` succeeds
    - `grep -cE '<TableHead>' frontend/src/signage/pages/DevicesPage.tsx` returns existing_count + 2 (verify vs. git diff)
    - `grep -cE '<TableCell>' frontend/src/signage/pages/DevicesPage.tsx` returns existing_count + 2
    - Column order check: the byte offset of `analytics.uptime24h.label` MUST be greater than the offset of `col.status` (or equivalent status header i18n key) AND less than the offset of `col.last_seen` (or equivalent last-seen header i18n key). Verify via: `awk '/signage\\.admin\\.device\\.(col\\.status|analytics\\.uptime24h\\.label|analytics\\.missed24h\\.label|col\\.last_seen|last_seen)/{print NR}' frontend/src/signage/pages/DevicesPage.tsx` returns 4 line numbers in strictly-ascending order
    - `cd frontend && npx vitest run src/signage/pages/DevicesPage.test.tsx` exits 0 with ≥10 tests in the "Phase 53 analytics columns" describe block passing
    - `grep -cE "^\\s*(it|test)\\(" frontend/src/signage/pages/DevicesPage.test.tsx` (inside the analytics describe block) returns ≥10
    - `cd frontend && npm run check:signage` exits 0 (invariants CI auto-covers the new files)
    - `cd frontend && npx tsc --noEmit` exits 0
    - `grep -nE 'dark:|fetch\\(' frontend/src/signage/pages/DevicesPage.tsx frontend/src/signage/pages/DevicesPage.test.tsx` returns empty
  </acceptance_criteria>
  <done>DevicesPage renders 2 new columns between Status and Last Seen, polling analytics every 30 s with tab-visibility refresh. D-21 test coverage (10+ tests) asserts column order, threshold-tier rendering, DE/EN tooltip parity, partial-window tooltip, and the refetchOnWindowFocus flag.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Admin-guide §Analytics / §Analyse in both EN + DE digital-signage.md</name>
  <files>frontend/src/docs/en/admin-guide/digital-signage.md, frontend/src/docs/de/admin-guide/digital-signage.md</files>
  <read_first>
    - frontend/src/docs/en/admin-guide/digital-signage.md (existing §Schedules structure from Phase 52 Plan 03 — match heading level + layout)
    - frontend/src/docs/de/admin-guide/digital-signage.md (existing §Zeitpläne for DE du-tone reference)
    - .planning/phases/53-analytics-lite/53-CONTEXT.md §D-18 (docs requirements)
  </read_first>
  <behavior>
    - Append a new §Analytics section (EN) / §Analyse section (DE) to the end of each admin-guide file (or immediately after the §Schedules / §Zeitpläne section — match whatever Phase 52 Plan 03 did).
    - Coverage per D-18:
      1. What the two badges mean (Uptime 24h %, Missed 24h).
      2. Threshold colour scale: green ≥ 95 %, amber 80–95 %, red < 80 %, neutral "—" when no heartbeats yet.
      3. 60-second window definition (distinct one-minute buckets containing ≥1 heartbeat).
      4. Partial-window note for fresh devices (denominator = minutes since first heartbeat up to 1440).
      5. Refresh cadence: 30 s polling + tab-visibility.
    - DE uses informal "du" tone throughout — no "Sie" / "Ihre" / "Ihr ".
    - Both files receive matching content structure (same number of bullets/paragraphs in same order) so docs-parity review is trivial.
  </behavior>
  <action>
    **frontend/src/docs/en/admin-guide/digital-signage.md — append at end (or after §Schedules):**
    ```markdown
    ## Analytics

    The Devices tab shows two badges per row computed from the device's heartbeats in the last 24 hours.

    - **Uptime 24h** — percentage of one-minute windows in the last 24 hours that recorded at least one heartbeat.
    - **Missed 24h** — count of one-minute windows in the last 24 hours without a heartbeat.

    ### Colour scale

    - 🟢 **Green** — Uptime ≥ 95 %. Device is healthy.
    - 🟡 **Amber** — Uptime 80 % – 95 %. Intermittent dropouts; worth checking the device's network.
    - 🔴 **Red** — Uptime < 80 %. Sustained outage; inspect power and network.
    - ⚪ **Neutral (—)** — No heartbeats recorded yet (freshly provisioned or never connected).

    ### How it's computed

    Every successful heartbeat is logged in an append-only table. Once per minute, a sweeper drops heartbeat rows older than 25 hours. The Uptime badge counts distinct one-minute windows with ≥1 heartbeat and divides by the denominator.

    For a freshly-provisioned device that has only been online for e.g. 30 minutes, the denominator is 30 (not 1440) so Uptime shows an honest signal from day one. Hover the badge to see the literal numerator/denominator and the window length.

    ### Refresh

    The table polls every 30 seconds and refreshes automatically when you switch back to the browser tab.
    ```

    **frontend/src/docs/de/admin-guide/digital-signage.md — append at end (or after §Zeitpläne):**
    ```markdown
    ## Analyse

    Der Tab "Geräte" zeigt pro Zeile zwei Badges, die aus den Heartbeats der letzten 24 Stunden berechnet werden.

    - **Betriebszeit 24 h** — Anteil der Ein-Minuten-Fenster der letzten 24 Stunden, in denen mindestens ein Heartbeat eingegangen ist.
    - **Ausfälle 24 h** — Anzahl der Ein-Minuten-Fenster ohne Heartbeat in den letzten 24 Stunden.

    ### Farbskala

    - 🟢 **Grün** — Betriebszeit ≥ 95 %. Gerät läuft stabil.
    - 🟡 **Gelb** — Betriebszeit 80 % – 95 %. Sporadische Aussetzer; prüfe das Netzwerk des Geräts.
    - 🔴 **Rot** — Betriebszeit < 80 %. Anhaltende Störung; prüfe Stromversorgung und Netzwerk.
    - ⚪ **Neutral (—)** — Noch keine Heartbeats vorhanden (gerade eingerichtet oder nie verbunden).

    ### Wie es berechnet wird

    Jeder erfolgreiche Heartbeat wird in einer Append-only-Tabelle protokolliert. Einmal pro Minute entfernt ein Sweeper Heartbeat-Zeilen, die älter als 25 Stunden sind. Das Betriebszeit-Badge zählt die eindeutigen Ein-Minuten-Fenster mit mindestens einem Heartbeat und teilt durch den Nenner.

    Für ein frisch eingerichtetes Gerät, das z. B. erst 30 Minuten online ist, beträgt der Nenner 30 (nicht 1440), damit du vom ersten Tag an ein ehrliches Signal siehst. Bewege den Mauszeiger über das Badge, um den exakten Zähler/Nenner und die Fensterlänge zu sehen.

    ### Aktualisierung

    Die Tabelle lädt alle 30 Sekunden neu und aktualisiert sich automatisch, wenn du zum Browser-Tab zurückkehrst.
    ```

    Match the exact indentation / list marker style used by the existing §Schedules/§Zeitpläne sections (e.g. `-` vs `*` for bullets, heading level `##` vs `###`). Do NOT modify any content above the new section.
  </action>
  <verify>
    <automated>grep -q "^## Analytics" frontend/src/docs/en/admin-guide/digital-signage.md && grep -q "^## Analyse" frontend/src/docs/de/admin-guide/digital-signage.md && grep -q "^### Colour scale" frontend/src/docs/en/admin-guide/digital-signage.md && grep -q "^### Farbskala" frontend/src/docs/de/admin-guide/digital-signage.md && ! grep -E '"Sie |"Ihre |"Ihr ' frontend/src/docs/de/admin-guide/digital-signage.md | grep -v "^$"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "^## Analytics" frontend/src/docs/en/admin-guide/digital-signage.md` succeeds
    - `grep -q "^## Analyse"   frontend/src/docs/de/admin-guide/digital-signage.md` succeeds
    - `grep -q "### Colour scale" frontend/src/docs/en/admin-guide/digital-signage.md` succeeds
    - `grep -q "### Farbskala"    frontend/src/docs/de/admin-guide/digital-signage.md` succeeds
    - Both EN and DE sections mention all 5 D-18 coverage items: (1) badge meaning, (2) thresholds 95/80, (3) 60-second window definition, (4) partial-window note for new devices, (5) 30-second polling. Verify via:
      - `grep -qE "95" frontend/src/docs/en/admin-guide/digital-signage.md` AND `... frontend/src/docs/de/admin-guide/digital-signage.md` both succeed
      - `grep -qE "80" frontend/src/docs/en/admin-guide/digital-signage.md` AND DE analog
      - `grep -qE "one-minute|Ein-Minuten" frontend/src/docs/{en,de}/admin-guide/digital-signage.md` succeed
      - `grep -qiE "30 (seconds|Sekunden)" frontend/src/docs/{en,de}/admin-guide/digital-signage.md` succeed
      - `grep -qiE "new device|frisch|gerät ist neu" frontend/src/docs/{en,de}/admin-guide/digital-signage.md` succeed (partial-window coverage)
    - DE section contains no formal pronouns in the newly-added block: `git diff frontend/src/docs/de/admin-guide/digital-signage.md | grep -E '^\+' | grep -iE '\bSie\b|\bIhre\b|\bIhr\b'` returns empty (match only the added lines; "Sie" as a word, not substring of e.g. "Sieben")
    - DE section uses informal "du" at least once: `git diff frontend/src/docs/de/admin-guide/digital-signage.md | grep -E '^\+' | grep -iE '\bdu\b|\bdein'` returns ≥1 match
    - Both files' total line count grew by approximately the same amount (structure parity): `echo "EN added: $(git diff --numstat frontend/src/docs/en/admin-guide/digital-signage.md | awk '{print $1}'); DE added: $(git diff --numstat frontend/src/docs/de/admin-guide/digital-signage.md | awk '{print $1}')"` shows both numbers within ±3 lines of each other
  </acceptance_criteria>
  <done>Admin guide has bilingual §Analytics / §Analyse sections covering all 5 D-18 coverage items, DE du-tone, structurally parallel.</done>
</task>

</tasks>

<verification>
Run from `frontend/`:
- `npx tsc --noEmit` → exit 0
- `npx vitest run src/signage/components/UptimeBadge.test.tsx src/signage/pages/DevicesPage.test.tsx` → all green
- `npm test -- --run` → full frontend test suite green (no regressions in other signage tests)
- `npm run check:signage` → exit 0 (invariants CI auto-scans new `UptimeBadge.tsx` / `UptimeBadge.test.tsx` / `DevicesPage.test.tsx` under `frontend/src/signage/` roots)
- `npm run check:i18n-parity` → exit 0 (all 7 new key-pairs present in both locales)
- `npm run build` → exit 0 (Vite production bundle builds without new errors; UptimeBadge adds ~1 KB — no bundle-size guard impact)

Manual smoke in dev server:
1. Load `/signage/devices` as an admin. Expect the devices table to show 5 columns: Name → Status → Uptime 24h → Missed 24h → Last Seen → Actions.
2. For a device with active heartbeats, Uptime badge renders `XX.X%` with a green/amber/red background depending on value.
3. For a device paired but never heartbeated, both new badges render `—` with a muted background.
4. Hover the Uptime badge → native tooltip shows `"N / D one-minute windows had a heartbeat in the last 24 h."` (EN) or the DE equivalent.
5. Hover on a freshly-provisioned device → tooltip shows the `_partial` variant with `over the last Xh` / `letzten Xh`.
6. Leave the tab for a minute, return — network tab shows a fresh GET /api/signage/analytics/devices firing on focus-regain (refetchOnWindowFocus: true).
7. Wait 30 s on the tab — analytics query refetches automatically.

Hard-gate checklist:
- [ ] No `dark:` variants in any file inside `frontend/src/signage/**` touched by this plan
- [ ] apiClient-only — no raw `fetch(` anywhere
- [ ] `npm run check:signage` passes (invariants CI)
- [ ] `npm run check:i18n-parity` passes (DE/EN parity, du-tone)
- [ ] `npx tsc --noEmit` exits 0
- [ ] Both UptimeBadge.test.tsx and DevicesPage.test.tsx ≥10 total passing tests

Open-question resolutions:
- `Tooltip` component does not exist in `frontend/src/components/ui/` → using native `title={...}` fallback per RESEARCH §Pattern 8.
- Global `refetchOnWindowFocus` override check: grep done during planning — no `refetchOnWindowFocus: false` found on a global QueryClient in `frontend/src/main.tsx`. Explicit `refetchOnWindowFocus: true` on the new useQuery is defence-in-depth per D-11.
- Invariants CI: `frontend/scripts/check-signage-invariants.mjs` auto-scans `frontend/src/signage/components/` and `frontend/src/signage/pages/` — no script edit needed. Verified by running the script after Task 3.
</verification>

<success_criteria>
1. **SGN-ANA-01 (frontend half):** DevicesPage table shows two new columns between Status and Last Seen; Uptime 24h % and Missed 24h; updates every 30 s and on tab-visibility regain; neutral "—" when no data.
2. **D-13 thresholds:** 95 → green, 80–95 → amber, <80 → red — verified by component tests with values 95.0 / 94.9 / 79.9.
3. **D-14 column order:** Status → Uptime → Missed → Last Seen → Actions — verified by test 2 asserting the ordered columnheader array.
4. **D-15 tooltip copy:** literal numerator/denominator wording, DE/EN parity, `windowH` interpolation for partial-window devices (D-06).
5. **D-21 test coverage:** Vitest component tests pass (UptimeBadge + DevicesPage), covering threshold tier switching, neutral fallback, EN/DE tooltip copy, partial-window tooltip, and `refetchOnWindowFocus: true` wiring.
6. **D-18 admin-guide update:** §Analytics (EN) + §Analyse (DE) cover all 5 required items; DE is du-tone.
7. **Hard gates:** no `dark:` variants, apiClient-only, DE/EN i18n parity, invariants CI green, `--workers 1` not applicable (frontend), typecheck green.
8. **Milestone Success Criterion #5:** Devices table shows non-zero uptime numbers for at least one active device under observation (verified manually after deploy).
</success_criteria>

<output>
After completion, create `.planning/phases/53-analytics-lite/53-02-SUMMARY.md` with:
- What shipped (type, API method, query key, UptimeBadge + test, DevicesPage columns + test, 7 i18n key-pairs, bilingual admin-guide §Analytics/§Analyse)
- Resolution of the two RESEARCH open questions: (a) tooltip fallback used (native `title=` confirmed) and (b) global `refetchOnWindowFocus` override status
- Whether the zero-heartbeat device is OMITTED or INCLUDED by the backend (from Plan 01 SUMMARY) and which fallback path DevicesPage exercises
- Any Vitest-harness surprises (e.g. had to await `i18n.changeLanguage('en')` before first render, or had to stub a specific API mock)
- Confirmation that the invariants CI auto-covered UptimeBadge and DevicesPage without a script edit
- Carry-forward: none — Phase 53 is fully delivered across Plans 01+02. Next action is `/gsd:verify-work 53`.
</output>
