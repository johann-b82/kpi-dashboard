import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { MediaPage } from "./MediaPage";
import { PlaylistsPage } from "./PlaylistsPage";
import { DevicesPage } from "./DevicesPage";
import { SegmentedControl } from "@/components/ui/segmented-control";

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

      {/* Sub-nav: same pill SegmentedControl as SALES/HR in the top NavBar
          for visual consistency with the dashboard navigation. */}
      <SegmentedControl
        segments={tabs.map((tab) => ({ value: tab.id, label: t(tab.labelKey) }))}
        value={active}
        onChange={(id) => {
          const target = tabs.find((tab) => tab.id === id);
          if (target) setLocation(target.path);
        }}
        aria-label={t("signage.admin.page_title")}
      />

      {active === "media" && <MediaPage />}
      {active === "playlists" && <PlaylistsPage />}
      {active === "devices" && <DevicesPage />}
    </div>
  );
}
