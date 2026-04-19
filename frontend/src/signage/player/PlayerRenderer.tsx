import { useEffect, useState } from "react";
import type { PlayerItem } from "./types";
import { ImagePlayer } from "./ImagePlayer";
import { VideoPlayer } from "./VideoPlayer";
import { PdfPlayer } from "./PdfPlayer";
import { IframePlayer } from "./IframePlayer";
import { HtmlPlayer } from "./HtmlPlayer";
import { PptxPlayer } from "./PptxPlayer";

export interface PlayerRendererProps {
  items: PlayerItem[];
  className?: string;
}

function renderItem(item: PlayerItem) {
  switch (item.kind) {
    case "image":
      return <ImagePlayer uri={item.uri} />;
    case "video":
      return <VideoPlayer uri={item.uri} />;
    case "pdf":
      return <PdfPlayer uri={item.uri} autoFlipSeconds={item.duration_s} />;
    case "url":
      return <IframePlayer uri={item.uri} />;
    case "html":
      return <HtmlPlayer html={item.html} />;
    case "pptx":
      return <PptxPlayer slidePaths={item.slide_paths} durationS={item.duration_s} />;
    default:
      return null;
  }
}

/**
 * Admin-preview PlayerRenderer (SGN-DIFF-02 / D-09, D-10).
 *
 * Accepts in-memory items (form state or server state) and auto-advances
 * through them using each item.duration_s. Loops back to 0 after last.
 * Resets currentIndex to 0 when the items prop reference changes
 * (playlist save, item add/remove).
 *
 * No SSE, no heartbeat, no offline cache — those are Phase 47 wrappers.
 *
 * Transition handling:
 *  - "fade" (default): 300ms CSS opacity transition between swaps
 *  - "cut": immediate swap (no transition)
 */
export function PlayerRenderer({ items, className }: PlayerRendererProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fading, setFading] = useState(false);

  // Reset on items reference change — mitigates stale-index after add/remove.
  useEffect(() => {
    setCurrentIndex(0);
  }, [items]);

  useEffect(() => {
    if (items.length === 0) return;
    const item = items[currentIndex] ?? items[0];
    const durationMs = Math.max(1000, item.duration_s * 1000);

    const next = items[(currentIndex + 1) % items.length];
    const useFade = next?.transition !== "cut";
    const fadeOutMs = useFade ? 300 : 0;

    const advanceTimer = setTimeout(() => {
      if (useFade) {
        setFading(true);
        setTimeout(() => {
          setCurrentIndex((i) => (i + 1) % items.length);
          setFading(false);
        }, fadeOutMs);
      } else {
        setCurrentIndex((i) => (i + 1) % items.length);
      }
    }, durationMs);

    return () => clearTimeout(advanceTimer);
  }, [items, currentIndex]);

  if (items.length === 0) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-sm ${className ?? ""}`}
      >
        —
      </div>
    );
  }

  const current = items[currentIndex] ?? items[0];
  return (
    <div
      // Stable key per item forces unmount/remount — critical for iframes (HTML preview) and to
      // reset react-pdf internal state between items.
      key={current.id}
      className={`w-full h-full relative overflow-hidden bg-background transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"} ${className ?? ""}`}
    >
      {renderItem(current)}
    </div>
  );
}
