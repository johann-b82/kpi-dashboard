// Phase 47 D-6: per-format default duration_s when item omits it.
// SINGLE SOURCE OF TRUTH — change here only.

import type { PlayerItem } from "@/signage/player/types";

export const IMAGE_DEFAULT_DURATION_S = 10;
export const PDF_PER_PAGE_DURATION_S = 6;
export const IFRAME_DEFAULT_DURATION_S = 30;
export const HTML_DEFAULT_DURATION_S = 30;
export const PPTX_PER_SLIDE_DURATION_S = 8;
/** Sentinel meaning "let the video element's onended advance the playlist" (D-6). */
export const VIDEO_DURATION_NATURAL = 0;

/**
 * Fill in `duration_s` on items that omit it, per the per-format defaults.
 * Pure: returns a new array; does not mutate inputs.
 */
export function applyDurationDefaults(items: PlayerItem[]): PlayerItem[] {
  return items.map((item) => {
    if (typeof item.duration_s === "number" && item.duration_s > 0) return item;
    switch (item.kind) {
      case "image":
        return { ...item, duration_s: IMAGE_DEFAULT_DURATION_S };
      case "video":
        return { ...item, duration_s: VIDEO_DURATION_NATURAL };
      case "pdf": {
        const pageCount = typeof item.pageCount === "number" ? item.pageCount : 1;
        return { ...item, duration_s: pageCount * PDF_PER_PAGE_DURATION_S };
      }
      case "iframe":
        return { ...item, duration_s: IFRAME_DEFAULT_DURATION_S };
      case "html":
        return { ...item, duration_s: HTML_DEFAULT_DURATION_S };
      case "pptx": {
        const slidePaths = Array.isArray(item.slide_paths) ? item.slide_paths : [];
        const n = slidePaths.length || 1;
        return { ...item, duration_s: n * PPTX_PER_SLIDE_DURATION_S };
      }
      default:
        return item;
    }
  });
}
