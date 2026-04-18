# Phase 7: i18n Integration and Polish — Research

**Researched:** 2026-04-11
**Domain:** Frontend i18n bootstrap, async React 19 startup, pytest + Playwright harness for Docker rebuild verification
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Boot-time language init (SC2: no flash)**
- **D-01:** `main.tsx` performs a top-level `await bootstrap()` before `ReactDOM.createRoot().render()`. Bootstrap fetches `GET /api/settings`, calls `i18n.changeLanguage(settings.default_language.toLowerCase())`, seeds `queryClient.setQueryData(['settings'], settings)`, THEN renders.
- **D-02:** `i18n.ts` must NOT hardcode `lng: "de"`. Omit `lng` (or set to `undefined`) — bootstrap is the single writer of the initial language.
- **D-03:** `frontend/index.html` contains a minimal inline-CSS splash inside `<body>`. No JS before React. React replaces the splash on first mount.
- **D-04:** Bootstrap settings fetch failure → catch, `i18n.changeLanguage('en')` as hardcoded fallback, render React anyway, `useSettings()` surfaces the error via the existing toast/error-boundary path. Do NOT block on a fatal screen.
- **D-05:** Bootstrap reuses `fetchSettings()` from `lib/api.ts` — no duplicated fetch.
- **D-06:** Bootstrap seeds the TanStack cache so App-level `useSettings()` reads from cache on first mount (zero duplicate round-trip).

**Language picker UI (SC1)**
- **D-07:** New Card "Preferences" on Settings page, positioned AFTER Colors and BEFORE the sticky ActionBar. Title key: `settings.preferences.title` (distinct from the page title key to avoid collision).
- **D-08:** Segmented control `[DE] [EN]`, visual pattern mirrors NavBar `LanguageToggle` (bold active / muted inactive) but rendered as a labeled form control inside the card. Keys: `settings.preferences.language.label`, `settings.preferences.language.help`.
- **D-09:** Picker uses `useSettingsDraft.setField('default_language', value)`. Changing picker: (1) updates draft via `setField`, (2) synchronously calls `i18n.changeLanguage(value.toLowerCase())` for live preview, (3) NO network request, (4) on Save: PUT persists, (5) on Discard: `discard()` reverts draft AND syncs i18n back to snapshot value.
- **D-10:** `useSettingsDraft.setField` extended: when field is `default_language`, call `i18n.changeLanguage(value.toLowerCase())` in addition to cache write. Import `i18n` from `../i18n` in the hook. `discard()` / `resetToDefaults()` call `i18n.changeLanguage(snapshot.default_language.toLowerCase())`.
- **D-11:** `DraftFields` type already includes `default_language: "DE" | "EN"` (verified); `shallowEqualDraft` and `draftToCacheSettings` already compare/include it. **Audit result: no missing wiring** — Phase 6 already laid the plumbing for Phase 7.

**NavBar LanguageToggle (SC1 cross-cut)**
- **D-12:** NavBar `LanguageToggle` stays visible on ALL routes. On click: (1) fires `PUT /api/settings` with `{ default_language, ...current_other_fields }` (immediate, no draft), (2) calls `i18n.changeLanguage()`, (3) writes response to `['settings']` cache, (4) shows toast.
- **D-13:** When on `/settings` AND `useSettingsDraft.isDirty === true`, NavBar toggle is DISABLED (grayed, `aria-disabled`, not clickable), tooltip `settings.preferences.toggle_disabled_tooltip`. Dirty-state detection mechanism = Claude's discretion but NavBar must NOT import page-specific code.
- **D-14:** On non-Settings routes, toggle is always enabled.
- **D-15:** Toggle reads current settings from TanStack cache before building the PUT payload (all 8 required fields: 6 colors + app_name + default_language).

**German translation (SC3)**
- **D-16:** Translate ALL 105 keys in `en.json` to German. Current `de.json` has 62 keys — 43 new `settings.*` keys + polish of the existing 62 for tone consistency.
- **D-17:** Tone: **informal "du"** throughout. "Wähle eine Farbe", "Deine Einstellungen wurden gespeichert", "Lade ein Logo hoch".
- **D-18:** Keep English loanwords: Dashboard, Upload (noun) / hochladen (verb), KPI, Logo, Settings → Einstellungen, Primary → Primärfarbe (or Hauptfarbe), Save → Speichern, Discard → Verwerfen, Reset to defaults → Auf Standard zurücksetzen, Contrast → Kontrast.
- **D-19:** All toast/dialog/error/label/placeholder/help/aria strings translated. No EN-only strings after this phase. Key-parity assertion (pytest or node script) must fail if key sets diverge.
- **D-20:** Review existing 62 DE keys for formal "Sie" / "Ihre" / "Ihnen" and rewrite to "du" form.

**Rebuild persistence (SC4)**
- **D-21:** Add pytest to backend via `requirements-dev.txt` (pytest, pytest-asyncio, httpx, asgi-lifespan) — **NOTE:** already present from Phase 4 (verified). `tests/conftest.py` already exposes an async client and a `reset_settings` fixture. **Phase 7 adds NEW test files only**; no conftest rewrite.
- **D-22:** Add Playwright to frontend: `npm install -D @playwright/test`, `npx playwright install chromium`, `frontend/playwright.config.ts` pointing at `http://localhost:5173`, one e2e spec `tests/e2e/rebuild-persistence.spec.ts`.
- **D-23:** `scripts/smoke-rebuild.sh` top-level harness with 9 ordered steps (see CONTEXT.md). Key invariant: `docker compose down` is used (NOT `down -v`) so `postgres_data` survives. Rebuild is `docker compose up -d --build`.
- **D-24:** Seed/assert scripts are SEPARATE pytest files (not fixtures) because a single pytest session cannot survive `docker compose down`. They share state via the live DB.
- **D-25:** Harness lives at `scripts/smoke-rebuild.sh`, executable, documented in README under "Testing". NOT added to CI (no CI exists yet).
- **D-26:** Coverage: exact equality on all 8 editable fields + logo byte round-trip + visual browser assertion (not just API echo).
- **D-27:** Harness pass = SC4 satisfied. Phase verification checkpoint confirms harness exit code 0.

### Claude's Discretion

- Exact CSS/markup of bootstrap splash (constraints: no external fonts/CSS, works on slow connections).
- Shape of "is Settings dirty" exposure to NavBar — Claude picks lightest mechanism that doesn't leak page-specific logic into NavBar.
- Name of new card in German: user preference "Allgemein" (over "Präferenzen") per D-18.
- Playwright browser: chromium only is fine.
- pytest fixture scope: session fine for seed/assert.
- Test DB: separate Postgres schema vs in-memory SQLite — user notes "separate Postgres schema is probably cleanest". **See `## Environment Availability` + `## Code Examples` for the recommended pattern.**
- Exact German translation strings — Claude writes following D-17/D-18; user reviews at verification.

### Deferred Ideas (OUT OF SCOPE)

- Additional languages (FR, IT, ES)
- i18n pluralization / ICU MessageFormat
- Locale-specific number/date/currency formatting (`Intl.NumberFormat`)
- RTL layout
- Playwright in CI (no CI exists yet)
- Playwright screenshot visual regression (beyond SC4)
- Per-user language preference (requires Authentik)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **I18N-01** | User can set the app-wide default language (DE or EN) from the Settings page | Preferences card pattern (§Architecture Pattern 2), `useSettingsDraft` extension (§Architecture Pattern 3), NavBar immediate-PUT mutation (§Architecture Pattern 4), locale key additions (§Locale Key Additions) |
| **I18N-02** | On app boot, `i18n.changeLanguage()` is called with server-persisted language before any translated content renders — no language flash | Async bootstrap pattern (§Architecture Pattern 1), `index.html` splash (§Splash HTML), race-free single-writer invariant (§Pitfall 1), verified against i18next docs |
</phase_requirements>

---

## Summary

Phase 7 is an integration and verification phase that closes the v1.1 milestone. The technical unknowns cluster into three buckets:

1. **Frontend i18n bootstrap** — well-understood: i18next's `init()` returns a Promise, top-level `await` in an ES module works in Vite 8, React 19's `createRoot().render()` replaces anything inside `#root` including a static splash. The hard part is discipline: ensure exactly one code path writes the language (bootstrap on cold start, `useSettingsDraft` on live preview, NavBar toggle on immediate-PUT), and document the single-writer contract in a comment block alongside `ThemeProvider`'s existing invariant.
2. **Backend pytest harness** — **already built in Phase 4.** `backend/tests/conftest.py` exposes an async client via `ASGITransport` + `LifespanManager`, `reset_settings` fixture resets the singleton, pytest + pytest-asyncio + httpx + asgi-lifespan are already in `requirements-dev.txt`. Phase 7 only adds two new test files (`test_rebuild_seed.py`, `test_rebuild_assert.py`) and exposes an API to run pytest inside the `api` container.
3. **Playwright + smoke-rebuild orchestration** — new ground. Recommendation: run Playwright from the **host** (not inside a container) against `http://localhost:5173`. This avoids the version-mismatch trap of the official Playwright image vs `@playwright/test` in package.json, and keeps the Docker topology unchanged. The host already has Node 25.9 and Docker 29.3.1 installed (verified), so `npx playwright install chromium` is a one-shot.

**Primary recommendation:** Build the phase in five waves: (1) i18n bootstrap + splash + `i18n.ts` fix, (2) `useSettingsDraft` i18n extension + `PreferencesCard` + EN locale additions, (3) NavBar `LanguageToggle` upgrade + dirty-state exposure, (4) German translation pass + key-parity check, (5) rebuild harness (pytest seed/assert + Playwright spec + bash orchestrator). Waves 1–4 are the risky integration work; wave 5 is mostly shell scripting once (1)–(4) land.

---

## Standard Stack

### Core (already installed — verify and use)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `i18next` | 26.0.4 (installed) | i18n runtime | Canonical Promise-returning `init()`; `changeLanguage()` returns a Promise. Version verified in `frontend/package.json` and against npm (latest 26.0.4). |
| `react-i18next` | 17.0.2 (installed) | React bindings (`useTranslation`) | Uses `initReactI18next` plugin; re-renders on `languageChanged` event. Installed version matches npm latest. |
| `@tanstack/react-query` | 5.97.0 (installed) | `queryClient.setQueryData(['settings'], s)` for cache seed + immediate-PUT writes | Already the single source of truth for settings cache (Phase 5 D-13). |
| `wouter` | 3.9.0 (installed) | Route detection for "is on /settings" check | NavBar already uses `useLocation()` from wouter. |
| `sonner` | 2.0.7 (installed) | Toast for NavBar-toggle save success/failure | Reuse existing pattern from Phase 6. |

### New dependencies to install

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@playwright/test` | 1.59.1 | E2E harness for SC4 visual assertion | Current Playwright version (verified via `npm view @playwright/test version` 2026-04-11). Includes test runner, assertions, `expect()` with auto-retry, and `playwright install` CLI. |

**Installation:**
```bash
# Frontend — Playwright (devDependency)
cd frontend
npm install -D @playwright/test@1.59.1
npx playwright install chromium   # downloads chromium into ~/.cache/ms-playwright/

# Backend — pytest stack is ALREADY in requirements-dev.txt from Phase 4:
#   pytest==9.0.3 pytest-asyncio==1.3.0 httpx==0.28.1 asgi-lifespan==2.1.0
# No changes needed.
```

**Version verification (2026-04-11):**
- `@playwright/test` — `npm view` → 1.59.1 (HIGH confidence)
- `i18next` — `npm view` → 26.0.4 (matches installed)
- `react-i18next` — `npm view` → 17.0.2 (matches installed)

### Alternatives Considered

| Instead of | Could Use | Why Not |
|------------|-----------|---------|
| Playwright from host | Playwright inside a new `test` service in docker-compose | Adds a 1GB+ image layer, risks version drift between `@playwright/test` in package.json and the base image tag, unnecessary given the host already has Node + Docker and the harness is manual-only (D-25). Official Playwright docs warn the image's bundled browsers must match the package version exactly. |
| Playwright from host | Installing chromium in existing `frontend` node:22-alpine image | Alpine is NOT a Playwright-supported distro. Playwright explicitly requires glibc-based images (Ubuntu, Debian slim). Would force a base image rewrite for a manual test. |
| pytest in a separate `test` service | Run pytest inside the existing `api` container via `docker compose exec api pytest` | API container has source bind-mounted at `/app` (see `docker-compose.yml` L29). `requirements-dev.txt` can be installed at image build time (see §Don't Hand-Roll). One container, one pytest invocation. Simpler. |
| Node-based locale key-parity script | pytest-based parity test reading the JSON from disk | pytest is already wired for CI and the harness; adding a node-test framework just for one assertion is disproportionate. A trivial `test_locale_parity.py` using `json.load` is 10 lines and runs with the existing pytest infrastructure. |
| `i18next-browser-languageDetector` | (explicitly out of scope) | REQUIREMENTS.md §"Explicitly excluded": fights server-persisted default; server is single source of truth. |
| Zustand / React Context for dirty exposure | Module-level `let isSettingsDirty = false` + event emitter | Context is lightest here — Phase 6 already has `useSettingsDraft` returning `isDirty`; a thin `<SettingsDraftContext.Provider>` wrapping `SettingsPage` gives NavBar a `useContext` read (with `null` default = "not on settings page"). No new dependency, no global state library. See §Architecture Pattern 5. |

---

## Architecture Patterns

### Recommended Project Structure (additions)

```
frontend/
├── index.html                      # MODIFY: add splash markup + inline <style>
├── src/
│   ├── main.tsx                    # MODIFY: async bootstrap, top-level await
│   ├── bootstrap.ts                # NEW (D-05): async function bootstrap()
│   ├── i18n.ts                     # MODIFY: remove lng: "de", omit lng entirely
│   ├── hooks/
│   │   └── useSettingsDraft.ts     # MODIFY: i18n-aware setField / discard / resetToDefaults
│   ├── contexts/
│   │   └── SettingsDraftContext.tsx # NEW: lightweight dirty-state exposure for NavBar
│   ├── components/
│   │   ├── NavBar.tsx              # MODIFY: read SettingsDraftContext, disable toggle when dirty
│   │   ├── LanguageToggle.tsx      # MODIFY: immediate-PUT + toast + context-aware disabled
│   │   └── settings/
│   │       └── PreferencesCard.tsx # NEW: language segmented control inside Settings page
│   ├── pages/
│   │   └── SettingsPage.tsx        # MODIFY: wrap in SettingsDraftContext, render PreferencesCard
│   └── locales/
│       ├── en.json                 # MODIFY: add settings.preferences.* keys + toggle tooltip
│       └── de.json                 # MODIFY: reach 105 keys, informal "du" tone pass
├── playwright.config.ts            # NEW
└── tests/
    └── e2e/
        └── rebuild-persistence.spec.ts  # NEW

backend/
└── tests/
    ├── test_rebuild_seed.py        # NEW (seeds known state)
    ├── test_rebuild_assert.py      # NEW (asserts state after rebuild)
    └── test_locale_parity.py       # NEW (optional: key set en.json == de.json)

scripts/
└── smoke-rebuild.sh                # NEW: 9-step orchestrator per D-23
```

### Pattern 1: Async Bootstrap Before `createRoot().render()`

**What:** Top-level await in `main.tsx` to fetch settings, seed i18n, seed cache, THEN render.

**When to use:** Exactly this phase (SC2 "no language flash on hard refresh"). Do NOT extend this pattern to fetch other data — it blocks first paint. Only use when the data is required to render anything sensibly.

**Why it works:**
- Vite 8 (verified installed) transpiles ES modules with native top-level await (TLA) support in modern browsers. Browsers have supported TLA since Chrome 89 / Firefox 89 / Safari 15 (2021). All Phase 7 target browsers support it.
- `i18next.init()` and `i18next.changeLanguage()` both return Promises — awaiting them guarantees the language is live before any `useTranslation()` call renders.
- `ReactDOM.createRoot(el).render(<App />)` REPLACES anything already inside `el` — the static splash in `<body>` placed OUTSIDE `#root` will remain until React mounts a first commit. If the splash is placed INSIDE `#root`, React wipes it on first render. Either works; outside `#root` avoids flicker because React's commit overlays on top of empty `#root`. CONTEXT.md D-03 says "React replaces the splash on first mount" — both options honor that, but **recommendation: place the splash inside `#root`** so that when React mounts, it atomically swaps out the splash with the first commit (no gap).

**Reference implementation sketch:**

```typescript
// frontend/src/bootstrap.ts
import i18n from "./i18n";
import { queryClient } from "./queryClient"; // (existing, Phase 3)
import { fetchSettings } from "./lib/api";
import { DEFAULT_SETTINGS } from "./lib/defaults";

// Guard against double-init if hot-reload re-evaluates the module.
let bootstrapPromise: Promise<void> | null = null;

export function bootstrap(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    // i18next.init() is synchronous in our current i18n.ts (no backend plugin),
    // but changeLanguage() is a Promise. We must await it to be safe.
    try {
      const settings = await fetchSettings();
      await i18n.changeLanguage(settings.default_language.toLowerCase());
      queryClient.setQueryData(["settings"], settings);
    } catch (err) {
      // D-04: fallback — do NOT rethrow. App renders, useSettings() surfaces the error.
      // eslint-disable-next-line no-console
      console.warn("[bootstrap] fetchSettings failed, falling back to EN:", err);
      await i18n.changeLanguage("en");
      // Do NOT seed cache with DEFAULT_SETTINGS — let useSettings() do a real fetch
      // and surface the error via the normal query error path. Seeding defaults
      // would mask the error.
    }
  })();
  return bootstrapPromise;
}
```

```typescript
// frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n"; // side-effect: runs init()
import { bootstrap } from "./bootstrap";

// Top-level await — Vite transpiles this for modern browsers.
await bootstrap();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Pitfalls:**
- Do NOT await inside a `useEffect` in a root-level component; the first paint happens before the effect fires, and `useTranslation()` will render in whatever language i18next had when `init()` ran (the hardcoded `lng: "de"` currently). Pattern 1's top-level await is what actually eliminates the flash.
- `i18n.ts` must NOT pass `lng: "de"` — if it does, `init()` sets language synchronously before bootstrap runs. Set `lng: undefined` or omit the key. Then bootstrap is the first writer. (D-02)
- StrictMode double-invokes components but NOT module-level code; the `bootstrapPromise` guard is belt-and-braces for hot reload, not StrictMode.

### Pattern 2: Segmented Language Control in a Settings Card

**What:** A two-option segmented control inside a `<Card>` that mirrors the NavBar `LanguageToggle` visual style but behaves like a Phase 6 form control.

**When to use:** Any binary setting that maps to the draft/save/discard flow. For a third language, upgrade to a proper `<Select>`.

**Recommendation:** Render as two `<button>` elements inside a `<div role="radiogroup">` with `aria-checked` on the active option. Match Phase 6 form styling: `<Label>` + control + help-text in the `<CardContent>`. Visual treatment: bold active, muted inactive, shared bordered container.

```tsx
// components/settings/PreferencesCard.tsx (sketch)
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function PreferencesCard({
  value,
  onChange,
}: {
  value: "DE" | "EN";
  onChange: (v: "DE" | "EN") => void;
}) {
  const { t } = useTranslation();
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">
          {t("settings.preferences.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 max-w-md">
          <Label className="text-sm font-medium">
            {t("settings.preferences.language.label")}
          </Label>
          <div role="radiogroup" className="inline-flex rounded-md border border-border overflow-hidden w-fit">
            {(["DE", "EN"] as const).map((lang) => {
              const active = value === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange(lang)}
                  className={
                    "px-4 py-2 text-sm " +
                    (active
                      ? "bg-accent/20 font-semibold text-primary"
                      : "text-muted-foreground hover:bg-accent/10")
                  }
                >
                  {lang}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("settings.preferences.language.help")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Pattern 3: Extending `useSettingsDraft` with i18n Side Effects

**What:** `setField`, `discard`, and `resetToDefaults` each gain a single line that calls `i18n.changeLanguage()` when the field is `default_language` (setField) or always (discard/reset, to sync to the snapshot).

**When to use:** This is the phase-specific extension. Do NOT add a second writer to i18n — the hook is the draft path, `bootstrap.ts` is the cold-start path, and NavBar toggle is the immediate-PUT path. Three writers, three code paths, no overlap.

**Implementation sketch:**

```typescript
// hooks/useSettingsDraft.ts (diff from Phase 6)
import i18n from "@/i18n";

// In setField:
const setField = useCallback(
  <K extends keyof DraftFields>(field: K, value: DraftFields[K]) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };
      // ... existing cache sync code ...
      return next;
    });
    // NEW: sync i18n runtime for live preview when language changes.
    if (field === "default_language") {
      void i18n.changeLanguage(String(value).toLowerCase());
    }
  },
  [queryClient],
);

// In discard:
const discard = useCallback(() => {
  if (!snapshot) return;
  setDraft(snapshot);
  // ... existing cache revert code ...
  // NEW: sync i18n back to snapshot language.
  void i18n.changeLanguage(snapshot.default_language.toLowerCase());
}, [snapshot, queryClient]);

// In resetToDefaults: after the successful PUT response,
// nextSnapshot already reflects the canonical default_language ("EN").
// Add after setDraft(nextSnapshot):
await i18n.changeLanguage(nextSnapshot.default_language.toLowerCase());
```

**Circular import risk:** `useSettingsDraft.ts` already imports from `@/lib/*`. Adding `import i18n from "@/i18n"` is safe because `i18n.ts` has no reverse dependency on hooks. No cycle.

**Why `void i18n.changeLanguage()`:** The return Promise is fire-and-forget for live preview — `useTranslation()` re-renders via the `languageChanged` event, not via the Promise resolution. Not awaiting avoids making `setField` async (which would break the callsite signature).

### Pattern 4: NavBar Immediate-PUT with Full Payload

**What:** On toggle click, read the current settings from the TanStack cache, build the complete 8-field PUT payload, call `updateSettings()`, sync i18n, write the response to cache, toast.

**Why reading cache vs reading from `useSettings().data`:** They're the same underlying source with TanStack Query, but reading via `queryClient.getQueryData<Settings>(["settings"])` in the click handler avoids making the component re-render on every cache write. The `useSettings()` hook is still needed to re-render the bold/muted visual state.

**Implementation sketch:**

```tsx
// components/LanguageToggle.tsx (rewrite)
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import i18n from "@/i18n";
import { useSettings } from "@/hooks/useSettings";
import { updateSettings, type Settings } from "@/lib/api";
import { useSettingsDraftStatus } from "@/contexts/SettingsDraftContext";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const { t } = useTranslation();
  const { data } = useSettings();
  const queryClient = useQueryClient();
  const draftStatus = useSettingsDraftStatus(); // null when not on /settings
  const isDisabled = draftStatus?.isDirty === true;

  const isDE = i18n.language === "de";

  const mutation = useMutation({
    mutationFn: async (nextLang: "DE" | "EN") => {
      const current = queryClient.getQueryData<Settings>(["settings"]) ?? data;
      if (!current) throw new Error("Settings not loaded");
      const payload = {
        color_primary: current.color_primary,
        color_accent: current.color_accent,
        color_background: current.color_background,
        color_foreground: current.color_foreground,
        color_muted: current.color_muted,
        color_destructive: current.color_destructive,
        app_name: current.app_name,
        default_language: nextLang,
      };
      return updateSettings(payload);
    },
    onSuccess: async (response, nextLang) => {
      queryClient.setQueryData<Settings>(["settings"], response);
      await i18n.changeLanguage(nextLang.toLowerCase());
      toast.success(t("settings.toasts.saved"));
    },
    onError: (err) => {
      const detail = err instanceof Error ? err.message : "Unknown error";
      toast.error(t("settings.toasts.save_error", { detail }));
    },
  });

  function handleToggle() {
    if (isDisabled) return;
    mutation.mutate(isDE ? "EN" : "DE");
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={isDisabled || mutation.isPending}
      aria-disabled={isDisabled}
      title={isDisabled ? t("settings.preferences.toggle_disabled_tooltip") : undefined}
      className="text-sm"
    >
      {/* existing DE / EN visual */}
    </Button>
  );
}
```

**Pessimistic vs optimistic:** Recommendation = **pessimistic** (wait for server response before flipping language). The toggle is rare and instant on a local Docker stack; optimistic adds rollback complexity for minimal UX gain. If the PUT fails mid-flight, an optimistic flip would briefly show the wrong language before reverting.

### Pattern 5: `SettingsDraftContext` for Dirty-State Exposure

**What:** A React Context provider rendered by `SettingsPage` that exposes `{ isDirty: boolean }` to descendants. The NavBar — which is NOT a descendant of `SettingsPage` but a SIBLING in App — needs a different mechanism OR the Provider must wrap at `App` level.

**Critical:** NavBar and SettingsPage are siblings under `App`. A Context provider rendered inside SettingsPage cannot be read by NavBar. Two viable options:

1. **(RECOMMENDED) Hoist the context provider to App level**, with a `useSettingsDraftStore` hook that returns `{ isDirty, setDirty }`. `SettingsPage` calls `setDirty(draft.isDirty)` in a `useEffect`, and unmounts clear it to `false`. NavBar calls `useSettingsDraftStore().isDirty` directly.

2. **Window-level custom event** (`document.dispatchEvent(new CustomEvent('settings-dirty-change', { detail: true }))`). Lighter but harder to test and reason about.

**Recommendation: Option 1.** Lightest Context-based approach:

```tsx
// contexts/SettingsDraftContext.tsx
import { createContext, useContext, useState, type ReactNode } from "react";

interface SettingsDraftStatus {
  isDirty: boolean;
  setDirty: (v: boolean) => void;
}

const Ctx = createContext<SettingsDraftStatus | null>(null);

export function SettingsDraftProvider({ children }: { children: ReactNode }) {
  const [isDirty, setDirty] = useState(false);
  return <Ctx.Provider value={{ isDirty, setDirty }}>{children}</Ctx.Provider>;
}

export function useSettingsDraftStatus(): SettingsDraftStatus | null {
  return useContext(Ctx);
}
```

Then in `App.tsx`:

```tsx
<SettingsDraftProvider>
  <NavBar />
  {/* routes including <SettingsPage /> */}
</SettingsDraftProvider>
```

And in `SettingsPage.tsx`:

```tsx
const { isDirty } = useSettingsDraft();
const status = useSettingsDraftStatus();
useEffect(() => {
  status?.setDirty(isDirty);
  return () => status?.setDirty(false); // clear on unmount (nav away from /settings)
}, [isDirty, status]);
```

**Why this is the lightest mechanism:** Zero new dependencies, zero globals, one `useState`, clears itself on unmount so NavBar naturally sees `false` on non-settings routes (D-14).

### Anti-Patterns to Avoid

- **Do not install a second i18n language writer.** The three legitimate writers are: `bootstrap.ts` (cold start), `useSettingsDraft` (draft live-preview), `LanguageToggle` mutation `onSuccess` (immediate-PUT). Any fourth call is a bug.
- **Do not use `i18next-browser-languageDetector`** — REQUIREMENTS.md explicitly excludes it; server is single source of truth.
- **Do not put the language picker inside the existing Identity card.** D-07 requires a new Preferences card below Colors. Users expect language = meta-setting, separate from visual branding.
- **Do not make the NavBar toggle `async` in its JSX handler.** Use the TanStack `useMutation` pattern — it handles pending state correctly (disable during in-flight) and integrates with React's concurrent rendering.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Backend test async HTTP client | Custom FastAPI TestClient wrapper | Already-wired `httpx.AsyncClient` + `ASGITransport` + `LifespanManager` in `backend/tests/conftest.py` | Done in Phase 4. Reuse verbatim — just write new test functions. |
| Docker healthcheck polling | Custom `nc -z` / `curl` retry loop | `docker compose up -d --wait` (Docker Compose v2.17+) OR poll the existing api healthcheck `docker compose ps --format json` | Docker Compose natively understands `healthcheck:` blocks and `--wait` blocks until all services are healthy. The compose file already defines an `api` healthcheck (L33). |
| PNG bytes for seed test | Build a PNG byte-by-byte in pytest | Vendor a 1×1 red PNG as a module constant (see §Code Examples) — known-good 67-byte sequence | Writing a PNG parser to verify roundtrip is out of scope. A hardcoded bytes literal is deterministic, zero-dep, and asserts byte-for-byte equality. |
| i18next Promise resolution polling | `while (!i18n.isInitialized) setTimeout(...)` | `await i18n.changeLanguage(lng)` — returns Promise that resolves when change is complete | `changeLanguage()` emits `languageChanged` AND resolves its Promise when the new language is loaded. No polling needed. |
| Playwright multi-browser matrix | Install chromium + firefox + webkit | Chromium only (D-discretion, CONTEXT.md) | Phase 7 goal is "branding survives rebuild", not "all browsers render correctly". One browser is enough. |
| Locale key-parity diffing | Hand-written recursive diff | `set(json.load(en).keys()) ^ set(json.load(de).keys())` | Flat keys (confirmed: `keySeparator: false` in `i18n.ts`) → simple set symmetric-difference is 3 lines of Python. |

**Key insight:** The hardest part of Phase 7 is NOT infrastructure — Phase 4 already built the pytest harness, Phase 6 already built the draft/save/discard flow, Phase 5 already built the settings-reading cache pattern. Phase 7 is 80% integration glue + 20% German translation labor. The only genuinely new infrastructure is Playwright (one config file + one spec) and the bash orchestrator.

---

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| **Stored data** | `app_settings` singleton row (PostgreSQL, `postgres_data` volume) holds `default_language` ("DE"\|"EN"). After Phase 6, this is live. Changing it via PUT from Phase 7's new code paths uses the existing Phase 4 PUT endpoint — no migration needed. | None — same endpoint, same row. |
| **Live service config** | None — i18next is a client-side library, not a live service with external configuration. | None. |
| **OS-registered state** | None — no OS-level registrations involved. | None. |
| **Secrets / env vars** | `.env` contains `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`. Harness script will need to source or pass these to any direct `psql` diagnostic step. **Verified: no secrets are renamed by Phase 7.** | None — harness uses `docker compose exec` so env propagates automatically. |
| **Build artifacts / installed packages** | Frontend: `node_modules` inside `frontend` bind-mount. Adding `@playwright/test` as a devDependency requires an `npm install` step — will run automatically on next `docker compose up --build` because `frontend/Dockerfile` L4 `RUN npm install` re-runs on `package.json` changes. Backend: `requirements-dev.txt` already exists but is NOT currently installed in the image (see §Environment Availability for fix). Playwright browsers (`chromium`) cached at `~/.cache/ms-playwright/` on the HOST. | (1) Modify `backend/Dockerfile` to install `requirements-dev.txt` OR use a multi-stage build (see §Common Pitfalls). (2) `npx playwright install chromium` runs once on host — document in README. |

**Nothing found in categories 2, 3.** Phase 7 is additive to existing settings plumbing — no rename, no data migration, no OS registration changes.

---

## Common Pitfalls

### Pitfall 1: i18n Flash from Synchronous `init({ lng: "de" })`

**What goes wrong:** Even with a bootstrap fetch and `await i18n.changeLanguage('en')`, if `i18n.ts` runs `init({ lng: "de" })` at import time, React's first render (AFTER bootstrap awaits) uses whatever language was active at the moment of import-evaluation — BUT since bootstrap awaits `changeLanguage`, the async queue is flushed before `render()`. **The trap is more subtle:** if any module at import time (before bootstrap) calls `i18n.t()` eagerly (e.g., to build a constant), the hardcoded `lng` value leaks into that constant.

**Why it happens:** Module initialization order. `import "./i18n"` runs `init()` synchronously with whatever `lng` is configured. If that value is `"de"`, every eager `t()` call before `bootstrap()` returns sees German.

**How to avoid:** Two-part fix. (1) Remove `lng: "de"` from `i18n.ts` — use `lng: undefined` or omit entirely so i18next falls back to `fallbackLng: "en"` until bootstrap sets the real value. (2) Grep the codebase for module-level `t()` calls or `i18n.t()` calls outside of component render — there should be NONE. **Grep result (verified):** no module-level `i18n.t()` calls exist. Safe.

**Warning signs:** Visible text flash on hard refresh in the milliseconds before React's first commit. Test by throttling network in Chrome devtools and forcing a cold reload.

### Pitfall 2: `requirements-dev.txt` Not Installed in API Image

**What goes wrong:** `docker compose exec api pytest` fails with `pytest: command not found` because `backend/Dockerfile` L6 only installs `requirements.txt`, not `requirements-dev.txt`.

**Why it happens:** Phase 4 created `requirements-dev.txt` but Phase 4's smoke test ran pytest against a LOCAL Python environment, not inside the container. Phase 7's harness needs pytest INSIDE the container (see D-23 step 3).

**How to avoid:** Modify `backend/Dockerfile` to install dev deps — two reasonable approaches:

- **(A) Single stage, always install dev deps** (simplest, acceptable for internal app):
  ```dockerfile
  COPY requirements.txt requirements-dev.txt ./
  RUN pip install --no-cache-dir -r requirements.txt -r requirements-dev.txt
  ```
- **(B) Multi-stage with a build-time `DEV_MODE` arg** (cleanest for prod, overkill here):
  ```dockerfile
  ARG INSTALL_DEV=true
  COPY requirements.txt requirements-dev.txt ./
  RUN pip install --no-cache-dir -r requirements.txt && \
      if [ "$INSTALL_DEV" = "true" ]; then pip install --no-cache-dir -r requirements-dev.txt; fi
  ```

**Recommendation: (A).** CLAUDE.md explicitly says "internal team use" and the image size cost of pytest + httpx + asgi-lifespan is ~30MB. Simplicity wins.

**Warning signs:** Harness script dies at step 3 with "pytest: not found". Verify fix by `docker compose exec api which pytest`.

### Pitfall 3: Playwright Version ≠ Installed Browsers Version

**What goes wrong:** `@playwright/test@1.59.1` expects a specific Chromium revision; if `npx playwright install` was last run with `1.58.x`, tests fail with "Executable doesn't exist at ~/.cache/ms-playwright/chromium-XXXX".

**Why it happens:** Playwright browsers are installed out-of-band into a user cache, keyed to the package version. Upgrading the package without re-running `install` leaves the cache stale.

**How to avoid:** Document in README that after any `@playwright/test` version bump, the user must run `npx playwright install chromium`. Or add a `postinstall` hook in `frontend/package.json`:
```json
"scripts": { "postinstall": "playwright install chromium" }
```
**Warning:** `postinstall` runs on every `npm install` including CI. For a manual harness, README documentation is sufficient.

### Pitfall 4: `docker compose down -v` Nukes `postgres_data`

**What goes wrong:** Harness runs `docker compose down -v` intending to clean up, and the `-v` flag deletes all named volumes including `postgres_data`. The assert step then sees an empty DB seeded with defaults — **test passes for the wrong reason** (Alembic migrations re-seeded DEFAULT_SETTINGS on rebuild, masking the persistence bug the test is meant to catch).

**Why it happens:** Copy-paste from standard docker-compose tutorials which use `-v` as the "clean slate" idiom.

**How to avoid:** The smoke-rebuild harness must use `docker compose down` (no `-v`) per D-23 step 4. Add an explicit comment in the bash script at the `down` line: `# NOT 'down -v' — we need postgres_data to survive the rebuild`.

**Warning signs:** Test passes but `GET /api/settings/logo` returns 404 after rebuild (no logo persisted). Shouldn't happen if harness is correct.

### Pitfall 5: Test DB Schema / Isolation

**What goes wrong:** The rebuild harness writes to the LIVE `app_settings` singleton (id=1) via pytest. After the harness runs, the developer's local DB is in "Rebuild Test Corp" / DE / red-oklch state — they see corrupted branding on their next `docker compose up`.

**Why it happens:** The pytest `reset_settings` autouse fixture (conftest.py L32) runs between tests but NOT after the whole pytest session ends. Also, the seed and assert files run in DIFFERENT pytest sessions (across a `docker compose down`/`up`), so fixtures can't clean up the final state.

**How to avoid:** Three options:

1. **(RECOMMENDED) Final cleanup step in `smoke-rebuild.sh`** — after the assert test passes, the script runs a final `docker compose exec api pytest backend/tests/test_rebuild_cleanup.py` that PUTs `DEFAULT_SETTINGS`, or `docker compose exec api python -m app.reset_settings` (a one-liner script).
2. Use `docker compose down -v && docker compose up -d` AT THE END (after all assertions) to wipe the test state. Safe because assertions are done.
3. Use a separate Postgres **database** (not schema) via `POSTGRES_DB=kpi_test` env override. More isolation but significantly more setup — needs a second compose file.

**Recommendation: Option 1.** Keeps the developer flow intact and doesn't rely on clever env juggling.

### Pitfall 6: Locale Key-Parity Test Runs in a Container That Can't See Locale Files

**What goes wrong:** A pytest file `test_locale_parity.py` tries to read `frontend/src/locales/en.json` but runs inside the `api` container where `/app` is `backend/` only.

**Why it happens:** The compose bind-mount is `./backend:/app` (frontend is NOT bind-mounted into the api container).

**How to avoid:** Run the key-parity check OUTSIDE pytest — do it in `smoke-rebuild.sh` directly with a trivial Python one-liner executed on the host:
```bash
python3 -c "import json; e=set(json.load(open('frontend/src/locales/en.json'))); d=set(json.load(open('frontend/src/locales/de.json'))); diff=e^d; exit(0 if not diff else print('Locale parity mismatch:', sorted(diff)) or 1)"
```
Or a standalone script `scripts/check-locale-parity.py`. Host has Python 3.9.6 (verified) — sufficient for `json` + sets.

**Warning signs:** pytest import error "no such file or directory" in the container.

### Pitfall 7: German "du" / "Sie" Mix After Polish Pass

**What goes wrong:** Phase 7 translates 43 new keys in "du" form but misses 2–3 existing `dashboard.*` keys that still use formal "Sie" (verified in current `de.json` L52 `Laden Sie eine Umsatzdatei auf der Upload-Seite hoch, um Ihre KPIs zu sehen.`, L55 `Wählen Sie einen größeren Zeitraum oder einen der voreingestellten Bereiche.`).

**Why it happens:** The translation pass is additive; reviewers focus on new keys and skim old ones.

**How to avoid:** Before writing any new keys, grep existing `de.json` for `\\b(Sie|Ihre|Ihnen|Sie\\.)\\b` — the D-20 pre-check. Currently confirmed matches:
- `dashboard.empty.body` — "Laden Sie...Ihre KPIs"
- `dashboard.emptyFiltered.body` — "Wählen Sie..."
- `dashboard.error.body` — "Bitte prüfen" (imperative, neutral — OK)

Rewrite the two identified strings to "du" form as part of the translation task.

---

## Code Examples

Verified patterns from the existing codebase + official documentation.

### Example 1: Deterministic 1×1 Red PNG Bytes (67-byte sequence)

Known-good 1×1 red PNG. Byte-exact, zero dependencies. Use verbatim in `test_rebuild_seed.py` and `test_rebuild_assert.py`.

```python
# backend/tests/test_rebuild_seed.py
# 1x1 opaque red PNG (67 bytes).
# Structure: 8-byte signature + IHDR (25) + IDAT (22) + IEND (12) = 67 bytes.
# Filter-byte 0x00 + raw RGB 0xFF 0x00 0x00, deflate-compressed.
RED_1X1_PNG: bytes = bytes.fromhex(
    "89504E470D0A1A0A"                      # PNG signature
    "0000000D49484452"                      # IHDR chunk length (13) + type
    "00000001000000010806000000"            # width=1, height=1, 8-bit RGBA
    "1F15C4890000000D49444154789C"          # CRC + IDAT length (13) + type + zlib header
    "63F8CFC0000000030001"                  # deflate: red pixel
    "5BBC0F650000000049454E44AE426082"      # CRC + IEND
)
# Note: the exact hex above is illustrative. The planner should verify by
# generating once with Python's PIL (Pillow) or by hand-crafting:
#
#   from PIL import Image
#   import io
#   buf = io.BytesIO()
#   Image.new("RGB", (1, 1), (255, 0, 0)).save(buf, format="PNG")
#   print(buf.getvalue().hex())
#
# Then freeze the resulting hex as a constant. The test asserts the EXACT
# bytes come back via GET /api/settings/logo, so determinism is key.
```

**CRITICAL:** The hex literal above is a SKETCH of the structure — PNG CRCs and the deflate IDAT payload are variable-length and must be generated, not hand-written. Planner MUST generate once via Pillow (or `struct` + `zlib`) and freeze the resulting bytes as a module constant. Do NOT ship with a hand-edited hex string.

Alternative (no Pillow needed): vendor a tiny prebuilt PNG as a base64 string:

```python
import base64
# 1x1 red PNG generated once with Pillow, base64-encoded, frozen here.
RED_1X1_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
RED_1X1_PNG: bytes = base64.b64decode(RED_1X1_PNG_B64)
assert len(RED_1X1_PNG) > 60  # sanity
```

**Recommendation: base64 literal.** Simpler, portable, passes `sniff_mime` (starts with `\x89PNG...`) without any gymnastics. Generate once and commit.

### Example 2: Seed pytest Test (sketch)

```python
# backend/tests/test_rebuild_seed.py
import base64

RED_1X1_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
)

REBUILD_SEED_PAYLOAD = {
    "color_primary":     "oklch(0.5 0.2 30)",
    "color_accent":      "oklch(0.5 0.2 84)",
    "color_background":  "oklch(0.5 0.2 138)",
    "color_foreground":  "oklch(0.5 0.2 192)",
    "color_muted":       "oklch(0.5 0.2 246)",
    "color_destructive": "oklch(0.5 0.2 300)",
    "app_name":          "Rebuild Test Corp",
    "default_language":  "DE",
}

async def test_seed_all_fields(client):
    # IMPORTANT: override the autouse reset_settings fixture for this test
    # by using a conftest skip marker, or: accept that reset runs FIRST,
    # then we write over it. Either way, the final state of the DB is the
    # seeded values. See Pitfall 5 for cleanup strategy.

    r = await client.put("/api/settings", json=REBUILD_SEED_PAYLOAD)
    assert r.status_code == 200
    body = r.json()
    for k, v in REBUILD_SEED_PAYLOAD.items():
        assert body[k] == v, f"{k}: expected {v}, got {body[k]}"

    # Logo upload
    files = {"file": ("seed.png", RED_1X1_PNG, "image/png")}
    r2 = await client.post("/api/settings/logo", files=files)
    assert r2.status_code == 200
    assert r2.json()["logo_url"] is not None
```

```python
# backend/tests/test_rebuild_assert.py
from tests.test_rebuild_seed import RED_1X1_PNG, REBUILD_SEED_PAYLOAD

async def test_all_fields_survive_rebuild(client):
    r = await client.get("/api/settings")
    assert r.status_code == 200
    body = r.json()
    for k, v in REBUILD_SEED_PAYLOAD.items():
        assert body[k] == v, f"{k}: expected {v} after rebuild, got {body[k]}"
    assert body["logo_url"] is not None, "logo_url went null after rebuild"

async def test_logo_bytes_survive_rebuild(client):
    r = await client.get("/api/settings/logo")
    assert r.status_code == 200
    assert r.content == RED_1X1_PNG, "logo bytes corrupted or replaced"
    assert r.headers["content-type"] == "image/png"
```

**CRITICAL:** The `reset_settings` autouse fixture in the current `conftest.py` will RESET the singleton before `test_seed_all_fields` runs, which is fine (seed overwrites defaults). But it will ALSO run before `test_all_fields_survive_rebuild` (in the assert file) and wipe the persistent state we're trying to verify. **The assert file must opt out of `reset_settings`.**

Fix: add to `test_rebuild_assert.py`:

```python
import pytest
# Override the autouse fixture to a no-op for this module.
@pytest.fixture(autouse=True)
async def reset_settings():
    yield
```

Or, cleaner, scope the autouse fixture to exclude the rebuild test files by marker. Planner's choice.

### Example 3: Playwright Config + Spec

```typescript
// frontend/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
```

```typescript
// frontend/tests/e2e/rebuild-persistence.spec.ts
import { test, expect } from "@playwright/test";

test("branding survives docker compose up --build", async ({ page }) => {
  await page.goto("/settings");

  // 1. Language was seeded to DE; bootstrap should have called changeLanguage('de')
  await expect(page.locator("html")).toHaveAttribute("lang", "de");

  // 2. Settings page title renders in German (a translated key we know from the seed)
  //    NOTE: we do NOT assert a specific German string — just that the page
  //    uses the translated settings.preferences.title key value, which will be
  //    'Allgemein' or similar. The assertion asserts the key path.
  await expect(page.getByRole("heading", { name: /Einstellungen/i })).toBeVisible();

  // 3. NavBar logo renders (uploaded PNG)
  const logo = page.locator('nav img[alt="Rebuild Test Corp"]');
  await expect(logo).toBeVisible();

  // 4. Check that the primary color CSS variable matches the seeded oklch
  //    (proves ThemeProvider applied it)
  const primary = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()
  );
  expect(primary).toContain("oklch(0.5 0.2 30)");

  // 5. App name appears as alt (no text brand when logo is present per Phase 5 D-05)
  await expect(logo).toHaveAttribute("alt", "Rebuild Test Corp");
});
```

### Example 4: `scripts/smoke-rebuild.sh` Skeleton

```bash
#!/usr/bin/env bash
# Phase 7 rebuild persistence smoke test.
# Verifies that all settings (colors, app_name, language, logo) survive
# a full `docker compose down && up --build` cycle. See D-23.
#
# Usage: ./scripts/smoke-rebuild.sh
# Exit 0 on success, non-zero on any failure.
set -euo pipefail

log()  { printf '\n\033[1;34m[smoke-rebuild]\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31m[smoke-rebuild FAIL]\033[0m %s\n' "$*" >&2; exit 1; }

cleanup() {
  log "Cleanup: resetting settings to defaults..."
  docker compose exec -T api pytest backend/tests/test_rebuild_cleanup.py -q || true
}
trap cleanup EXIT

# Step 1-2: Start stack fresh (preserving postgres_data volume)
log "Starting stack (preserves postgres_data)..."
docker compose up -d --wait   # --wait blocks until healthchecks pass

# Step 3: Seed known state
log "Seeding test state..."
docker compose exec -T api pytest backend/tests/test_rebuild_seed.py -q \
  || die "Seed step failed"

# Step 4: Stop containers WITHOUT -v (postgres_data survives)
log "Stopping containers (volume persists)..."
docker compose down   # NOT 'down -v' — we need postgres_data to survive

# Step 5-6: Rebuild and wait for health
log "Rebuilding images and restarting..."
docker compose up -d --build --wait

# Step 7: Assert persistence via pytest
log "Asserting DB persistence..."
docker compose exec -T api pytest backend/tests/test_rebuild_assert.py -q \
  || die "Assert step failed — state did not survive rebuild"

# Step 8: Playwright visual assertion (run from host)
log "Running Playwright visual check..."
( cd frontend && npx playwright test tests/e2e/rebuild-persistence.spec.ts ) \
  || die "Playwright visual check failed"

# Step 9: Locale parity check (fast, on host)
log "Checking locale key parity..."
python3 -c "
import json, sys
e = set(json.load(open('frontend/src/locales/en.json')))
d = set(json.load(open('frontend/src/locales/de.json')))
diff = e ^ d
if diff:
    print('Locale parity mismatch:', sorted(diff))
    sys.exit(1)
" || die "Locale key-parity check failed"

log "✓ Rebuild persistence verified"
```

**Key flags:**
- `docker compose up -d --wait` — blocks until healthchecks report healthy. Requires compose v2.17+. (Host has 29.3.1 — way above threshold.) Avoids hand-rolled polling.
- `docker compose exec -T` — the `-T` flag disables TTY allocation, required for scripted pytest invocation.
- `trap cleanup EXIT` — runs cleanup pytest regardless of success/failure so developer doesn't end up with "Rebuild Test Corp" state.

### Locale Key Additions (EN, to be translated to DE)

New keys to add to `en.json` (Phase 6 did NOT add these):

```jsonc
{
  "settings.preferences.title": "General",
  "settings.preferences.language.label": "Language",
  "settings.preferences.language.help": "Applies app-wide. Your choice is saved to the database.",
  "settings.preferences.toggle_disabled_tooltip": "Save or discard changes first"
}
```

German translations (D-17 informal tone, D-18 loanwords):

```jsonc
{
  "settings.preferences.title": "Allgemein",
  "settings.preferences.language.label": "Sprache",
  "settings.preferences.language.help": "Gilt für die gesamte App. Deine Auswahl wird in der Datenbank gespeichert.",
  "settings.preferences.toggle_disabled_tooltip": "Speichere oder verwirf zuerst deine Änderungen"
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `i18next-browser-languageDetector` + localStorage | Server-persisted default + bootstrap fetch | v1.1 requirement (REQUIREMENTS.md "Explicitly excluded") | Single source of truth; no client/server drift |
| `create-react-app` + `i18n.init().then(() => render())` | Vite + top-level `await bootstrap()` in module scope | Vite 5+ with TLA support; widely adopted 2023+ | Cleaner, no callback nesting |
| Inline `<script>` loader for flash prevention | Static CSS splash in `#root`, React commits atomically replace | React 18's `createRoot` replacement semantics | No JS before React, no FOUC |
| Playwright inside a docker-compose test service | Playwright from host against `http://localhost:5173` | Community best practice 2024+ for manual / local harness | Avoids image-size bloat and version-drift traps |

**Deprecated / outdated:**
- `i18next.init({ lng: "de" })` hardcoded — kept around in the current `i18n.ts`. D-02 explicitly removes it.
- `docker-compose` (v1 Python CLI) — use `docker compose` (v2 plugin). Host has 29.3.1, fine.

---

## Open Questions

1. **German name for Preferences card**
   - What we know: D-18 terminology rules; user commentary "Allgemein reads better than Präferenzen"; shadcn convention is "General".
   - What's unclear: Final user preference.
   - Recommendation: Use `"Allgemein"` per user's explicit inline preference. Document as a translator note.

2. **Should `reset_settings` autouse fixture be scoped out of the rebuild test files?**
   - What we know: The autouse fixture wipes the singleton before every test, conflicting with the seed/assert roundtrip.
   - What's unclear: Cleanest mechanism (module-level fixture override vs pytest marker + conftest conditional skip).
   - Recommendation: Module-level fixture override (Example 2 above). Simplest, keeps marker inventory small.

3. **Should bootstrap also `await i18n.init()` or trust it's synchronous?**
   - What we know: Current `i18n.ts` uses `init()` without a backend plugin and without `initAsync: true`, so it resolves synchronously under the hood. `i18next` docs say `init()` returns a Promise regardless.
   - What's unclear: Edge cases with `react-i18next`'s `initReactI18next` plugin — does it do any async work?
   - Recommendation: Await it defensively. `await i18n.init(...)` is free when it's already synchronous, and bullet-proofs against future plugin additions:

     ```typescript
     // i18n.ts
     import i18n from "i18next";
     import { initReactI18next } from "react-i18next";
     import de from "./locales/de.json";
     import en from "./locales/en.json";

     export const i18nInitPromise = i18n.use(initReactI18next).init({
       resources: { de: { translation: de }, en: { translation: en } },
       fallbackLng: "en",
       // no `lng` — bootstrap is the single writer (D-02)
       keySeparator: false,
       interpolation: { escapeValue: false },
     });

     export default i18n;
     ```

     And in bootstrap:
     ```typescript
     import i18n, { i18nInitPromise } from "./i18n";
     await i18nInitPromise;
     const settings = await fetchSettings();
     await i18n.changeLanguage(settings.default_language.toLowerCase());
     ```

4. **Does `docker compose up --wait` fire correctly when `migrate` is `service_completed_successfully`?**
   - What we know: `migrate` is a one-shot container that exits. Compose v2.17+ `--wait` honors the `completed_successfully` condition — confirmed via [Compose CLI reference](https://docs.docker.com/compose/reference/up/).
   - Recommendation: Use `up -d --wait` confidently; if the harness flakes on this, fall back to a 30-second sleep + curl loop on `/health`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Engine | Rebuild harness | ✓ | 29.3.1 | — |
| Docker Compose v2 | Rebuild harness | ✓ (bundled in Docker 29) | v2+ | — |
| Node.js | Playwright install + run from host | ✓ | 25.9.0 | — |
| npx | Playwright install + run | ✓ | 11.12.1 | — |
| Python 3 (host) | Locale parity check | ✓ | 3.9.6 | — |
| PostgreSQL 17 | DB persistence | ✓ (via compose `db` service) | 17-alpine image | — |
| pytest | Backend test runner | ✗ (inside api container) | — in `requirements-dev.txt` but not installed in image | Modify `backend/Dockerfile` to install `requirements-dev.txt` (see Pitfall 2) |
| Chromium browser | Playwright e2e | ✗ (not installed yet) | — | `npx playwright install chromium` — one-shot, ~170MB download to host cache |
| `@playwright/test` package | Playwright config + spec | ✗ (not in package.json) | — | `npm install -D @playwright/test@1.59.1` |
| Pillow (for PNG gen, dev only) | Generating the seed PNG once | ✗ | — | Use base64 literal approach (§Code Examples); no Pillow needed |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- pytest in api image → fix via Dockerfile change (Wave 0 of Phase 7 plan).
- `@playwright/test` + chromium → add to frontend package.json + one `playwright install` call.

**Blocking gaps:** None. Phase 7 can proceed end-to-end on the current machine with the adjustments above.

---

## Project Constraints (from CLAUDE.md)

These are directives extracted from `./CLAUDE.md` that Phase 7 implementation MUST honor:

- **Containerization mandatory:** App runs via Docker Compose. No bare-metal deps. → Harness script must orchestrate via `docker compose`, not native processes. (Playwright is the exception per §Architecture — it runs from host, acting as an external browser client against `http://localhost:5173`.)
- **PostgreSQL 17-alpine, exact tag:** Do NOT use `latest`. → No change — docker-compose already pins.
- **asyncpg for async DB:** `postgresql+asyncpg://`. → Pytest reuses the existing async engine via Phase 4 conftest; no new driver dependency.
- **`docker compose` (v2 syntax, no hyphen):** `docker-compose` is EOL. → Harness uses `docker compose`.
- **No `Base.metadata.create_all()` direct:** Schema changes go through Alembic. → Phase 7 adds no schema changes; `app_settings` stays at its Phase 4 shape.
- **No `--reload` in production uvicorn:** Docker-compose currently uses `--reload` (L24). → NOT a Phase 7 concern; harness tests against dev container.
- **GSD workflow enforcement:** Edits must go through a GSD command. → Planner output must define clear waves/tasks executable via `/gsd:execute-phase`.
- **shadcn `render` prop, not `asChild`:** → PreferencesCard and any new shadcn usage must follow this. Already established in Phase 6.
- **`keySeparator: false`:** Locale files are flat key-value with dot keys. → All new keys follow `settings.preferences.*` pattern; no nested objects.
- **TypeScript 6.0 installed:** `tsc -b` is in the build. → Any new TS files must type-check cleanly; prefer explicit `"DE" | "EN"` literals over `string` typing.
- **No `i18next-browser-languageDetector`:** → Explicitly excluded in REQUIREMENTS.md. Server is single source of truth.

---

## Validation Architecture

**Phase config:** `.planning/config.json` has `workflow.nyquist_validation: false`. **Section skipped per phase-researcher instructions.**

However, the phase itself defines a rebuild harness (SC4) which is a form of validation — captured in §Code Examples Example 4.

---

## Sources

### Primary (HIGH confidence)

- **CLAUDE.md** (project root) — stack rules, version pins, Docker Compose conventions. Verified verbatim.
- **`backend/tests/conftest.py`** — already-wired async test client + autouse reset fixture. Verified to exist; Phase 7 reuses as-is.
- **`backend/requirements-dev.txt`** — pytest 9.0.3, pytest-asyncio 1.3.0, httpx 0.28.1, asgi-lifespan 2.1.0 already present from Phase 4.
- **`frontend/package.json`** — verified installed versions of i18next 26.0.4, react-i18next 17.0.2, TanStack Query 5.97, wouter 3.9, sonner 2.0.7, react 19.2.4, vite 8.0.4.
- **npm registry** (2026-04-11) — `@playwright/test@1.59.1` latest, verified via `npm view`.
- **`docker-compose.yml`** — healthcheck patterns, `postgres_data` named volume, bind-mount topology.
- **[Playwright Docker docs](https://playwright.dev/docs/docker)** — official recommendation to use host execution for local/manual harnesses; image is intended for CI.
- **[i18next configuration options](https://www.i18next.com/overview/configuration-options)** — `init()` returns Promise, `lng` fallback behavior.
- **[i18next API docs](https://www.i18next.com/overview/api)** — `changeLanguage()` returns Promise, emits `languageChanged` event.
- **[Docker Compose CLI reference — `up --wait`](https://docs.docker.com/compose/reference/up/)** — `--wait` blocks until healthchecks pass; supports `service_completed_successfully`.

### Secondary (MEDIUM confidence)

- **[i18next async init discussion #1935](https://github.com/i18next/i18next/discussions/1935)** — community-validated pattern for awaiting initialization; aligns with our bootstrap approach.
- **[Locize blog — Using i18next.t() outside React components](https://www.locize.com/blog/how-to-use-i18next-t-outside-react-components/)** — warns about the synchronous-read-before-async-init trap (Pitfall 1).
- **[Running Playwright inside Docker — OddBird](https://www.oddbird.net/2022/11/30/headed-playwright-in-docker/)** — explains Alpine incompatibility with Playwright bundled browsers.
- **[Phase 4 smoke script](scripts/verify-phase-04.sh)** — reference pattern for bash + curl-based verification that Phase 7 harness extends.
- **[Phase 6 CONTEXT.md D-07, D-11, D-22, D-23](/.planning/phases/06-settings-page-and-sub-components/06-CONTEXT.md)** — draft/save/discard invariants, contrast badge pattern, dirty-detection semantics that Phase 7 extends.

### Tertiary (LOW confidence)

None — all load-bearing claims are backed by either the existing codebase or an official source.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| i18n async bootstrap pattern | HIGH | i18next official docs + Promise semantics + existing codebase verification |
| `useSettingsDraft` extension | HIGH | Existing hook code read verbatim; extension points are unambiguous |
| NavBar dirty-detection via React Context | HIGH | Standard React pattern; no new dependency; matches Phase 6 patterns |
| pytest harness reuse from Phase 4 | HIGH | `backend/tests/conftest.py` read verbatim; fixture shape verified |
| Playwright from host against compose stack | HIGH | Playwright official docs + existing host environment verified |
| `requirements-dev.txt` installation gap | HIGH | `backend/Dockerfile` read verbatim; pytest NOT installed in image currently |
| Deterministic PNG generation | MEDIUM | Two approaches proposed; planner picks one. Base64 literal approach is simpler and known-good. |
| German translation tone / vocabulary | MEDIUM | User provided explicit style rules (D-17, D-18); subjective but well-constrained |
| Docker Compose `--wait` reliability with `service_completed_successfully` | MEDIUM | Documented feature, but edge cases possible on first rebuild — fallback is a 30s sleep |
| Locale key-parity mechanism | HIGH | Trivial set-diff on flat JSON; verified `keySeparator: false` means flat keys |

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (30 days — stable stack, no expected upstream breakage)
