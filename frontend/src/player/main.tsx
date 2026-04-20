// Phase 47 player entry. App component + router added in Plan 47-04.
// pdfWorker MUST be imported before any PdfPlayer instance is rendered.

import "./lib/pdfWorker";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";

const rootEl = document.getElementById("player-root");
if (!rootEl) {
  throw new Error("Phase 47: #player-root element missing from player.html");
}

function PlayerBootstrap() {
  return (
    <div className="w-screen h-screen bg-neutral-950 text-neutral-50 grid place-items-center">
      {/* Plan 47-04 replaces this with the wouter <App /> */}
      <p className="text-2xl font-semibold">Signage Player — bootstrapping…</p>
    </div>
  );
}

createRoot(rootEl).render(
  <StrictMode>
    <PlayerBootstrap />
  </StrictMode>,
);
