import i18n, { i18nInitPromise } from "./i18n";
import { queryClient } from "./queryClient";
import { fetchSettings } from "./lib/api";

// Guard against double-init (hot reload, StrictMode effects, etc.).
let bootstrapPromise: Promise<void> | null = null;

/**
 * Single cold-start writer for initial i18n language and the TanStack
 * `["settings"]` cache entry (Phase 7 D-01, D-04, D-05, D-06).
 *
 * Flow:
 * 1. Await i18n init (defensive — Research Open Q3).
 * 2. Fetch /api/settings via the shared `fetchSettings()` (D-05).
 * 3. On success: set runtime language + seed query cache (D-06 — App-level
 *    `useSettings()` hook reads from cache on first mount, zero round-trip).
 * 4. On error: warn, fall back to EN, and return normally. Do NOT rethrow.
 *    Do NOT seed DEFAULT_SETTINGS — let `useSettings()` do a real fetch so
 *    the error surfaces via the existing toast/error-boundary path (D-04).
 *
 * Bootstrap runs BEFORE React mounts, so it must not use react-i18next hooks.
 */
// Mirror i18n language onto the <html lang="..."> attribute for
// accessibility (screen readers) and Playwright assertion (Phase 7 Plan 06).
// i18next does NOT do this automatically — we wire it once here so both the
// cold-start `changeLanguage` and every later `LanguageToggle` click update
// the document's lang attribute.
let htmlLangHookWired = false;
function wireHtmlLangSync() {
  if (htmlLangHookWired) return;
  htmlLangHookWired = true;
  const apply = (lng: string) => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lng;
    }
  };
  apply(i18n.language);
  i18n.on("languageChanged", apply);
}

export function bootstrap(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    await i18nInitPromise;
    wireHtmlLangSync();
    try {
      const settings = await fetchSettings();
      await i18n.changeLanguage(settings.default_language.toLowerCase());
      queryClient.setQueryData(["settings"], settings);
    } catch (err) {
      // D-04: fallback — do NOT rethrow. App renders, useSettings() surfaces
      // the real error via the normal query error path. Intentionally do NOT
      // seed the cache — that would mask the error.
      // eslint-disable-next-line no-console
      console.warn("[bootstrap] fetchSettings failed, falling back to EN:", err);
      await i18n.changeLanguage("en");
    }
  })();
  return bootstrapPromise;
}
