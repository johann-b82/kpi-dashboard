import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { MediaPage } from "./MediaPage";
import { PlaylistsPage } from "./PlaylistsPage";
import { DevicesPage } from "./DevicesPage";

type SignageTab = "media" | "playlists" | "devices";

interface SignagePageProps {
  initialTab: SignageTab;
}

/**
 * Phase 46 SGN-ADM-03 / D-04: Signage tab shell.
 * URL is the source of truth — App.tsx's <Route> picks which tab via `initialTab` prop.
 * Custom button group (NOT shadcn <Tabs>) per UI-SPEC §"Sub-Nav Button Group".
 */
export function SignagePage({ initialTab }: SignagePageProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  const active: SignageTab = initialTab;

  const tabs: { id: SignageTab; path: string; labelKey: string }[] = [
    { id: "media", path: "/signage/media", labelKey: "signage.admin.nav.media" },
    { id: "playlists", path: "/signage/playlists", labelKey: "signage.admin.nav.playlists" },
    { id: "devices", path: "/signage/devices", labelKey: "signage.admin.nav.devices" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 pt-4 pb-16 space-y-6">
      <h1 className="text-3xl font-semibold">{t("signage.admin.page_title")}</h1>

      {/* Sub-nav button group — custom (D-04: NOT shadcn <Tabs>) */}
      <nav
        className="inline-flex rounded-md border border-border overflow-hidden"
        aria-label={t("signage.admin.page_title")}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          const base =
            "px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
          const cls = isActive
            ? `${base} bg-primary text-primary-foreground`
            : `${base} bg-transparent text-foreground hover:bg-muted`;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setLocation(tab.path)}
              aria-current={isActive ? "page" : undefined}
              className={cls}
            >
              {t(tab.labelKey)}
            </button>
          );
        })}
      </nav>

      {active === "media" && <MediaPage />}
      {active === "playlists" && <PlaylistsPage />}
      {active === "devices" && <DevicesPage />}
    </div>
  );
}
