// Phase 46-03 originally hardcoded `loop`. Phase 47 P12 made it a prop:
//   - admin preview keeps backward-compat default (loop=true)
//   - player wrapper (frontend/src/player/PlaybackShell.tsx) passes loop=false
//     so video plays once and `onEnded` advances the playlist (D-6 VIDEO_DURATION_NATURAL).
export interface VideoPlayerProps {
  uri: string | null;
  /** When true (default), the video element loops. Admin preview relies on this
   *  backward-compatible default; the Phase 47 player wrapper passes `false`
   *  and uses `onEnded` to advance the playlist (D-6 video sentinel). */
  loop?: boolean;
  /** Fires on natural video end (only meaningful when `loop={false}`). */
  onEnded?: () => void;
}

export function VideoPlayer({ uri, loop = true, onEnded }: VideoPlayerProps) {
  if (!uri) return null;
  return (
    <video
      src={uri}
      muted
      autoPlay
      playsInline
      loop={loop}
      onEnded={onEnded}
      className="w-full h-full object-contain"
    />
  );
}
