/**
 * Full-screen auth-gate splash. Mirrors the pre-hydration splash in
 * `frontend/index.html` by reusing the same `--splash-bg` / `--splash-dot`
 * CSS variables set by the IIFE in <head> — this guarantees no color flash
 * between the bootstrap splash and the React-rendered splash.
 */
export function AuthSplash() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "var(--splash-bg)" }}
      role="status"
      aria-live="polite"
    >
      <div
        className="h-10 w-10 animate-pulse rounded-full"
        style={{ backgroundColor: "var(--splash-dot)" }}
      />
      <span className="sr-only">Loading</span>
    </div>
  );
}
