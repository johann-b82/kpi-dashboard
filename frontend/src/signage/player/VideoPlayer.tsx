export interface VideoPlayerProps {
  uri: string | null;
}

export function VideoPlayer({ uri }: VideoPlayerProps) {
  if (!uri) return null;
  return (
    <video
      src={uri}
      muted
      autoPlay
      playsInline
      loop
      className="w-full h-full object-contain"
    />
  );
}
