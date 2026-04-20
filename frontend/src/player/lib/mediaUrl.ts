// Phase 47 D-1: rewrite media URLs to localhost:8080 when the Phase 48 sidecar is online.
// Phase 47 ships the detector; Phase 48 ships the sidecar.

declare global {
  interface Window {
    signageSidecarReady?: boolean;
  }
}

export interface MediaForUrl {
  id: string;
  uri: string;
}

/**
 * Synchronous resolver. Reads window.signageSidecarReady at call time.
 * For the more robust hybrid detector (window flag + 200ms localhost probe), see useSidecarStatus
 * (added in Plan 47-03 per Pitfall P10).
 */
export function resolveMediaUrl(media: MediaForUrl): string {
  if (typeof window !== "undefined" && window.signageSidecarReady === true) {
    return `http://localhost:8080/media/${media.id}`;
  }
  return media.uri;
}

export {};
