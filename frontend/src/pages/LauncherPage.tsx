import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { LayoutDashboard, Box } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_SETTINGS } from "@/lib/defaults";

export function LauncherPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data } = useSettings();
  const settings = data ?? DEFAULT_SETTINGS;

  // LAUNCH-05 / D-05: Admin-only tiles absent (not greyed) for viewer role.
  // v1.14 defines ZERO admin-only tiles, so this variable is unused but the
  // hook + pattern is wired so future admin tiles slot in cleanly.
  const isAdmin = user?.role === "admin";
  void isAdmin; // silence unused-var until an admin tile is added

  return (
    <div className="max-w-7xl mx-auto px-8 pt-16 pb-8 space-y-12">
      <h1 className="text-2xl font-medium">{settings.app_name}</h1>
      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}
      >
        {/* Active tile: KPI Dashboard → navigates to /sales (Sales Dashboard route) */}
        <button
          type="button"
          onClick={() => setLocation("/sales")}
          aria-label={t("launcher.tile.kpi_dashboard")}
          className="w-[120px] h-[120px] rounded-2xl bg-card border border-border
                     flex flex-col items-center justify-center gap-2 p-4
                     cursor-pointer hover:bg-accent/10 transition-colors
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LayoutDashboard className="w-10 h-10 text-foreground" aria-hidden="true" />
          <span className="text-xs font-medium text-muted-foreground text-center truncate w-full">
            {t("launcher.tile.kpi_dashboard")}
          </span>
        </button>

        {/* Coming-soon tiles (3x) — opacity-40 + pointer-events-none per D-04 */}
        {[0, 1, 2].map((i) => (
          <div
            key={`coming-soon-${i}`}
            aria-hidden="true"
            className="w-[120px] h-[120px] rounded-2xl bg-card border border-border
                       flex flex-col items-center justify-center gap-2 p-4
                       opacity-40 pointer-events-none"
          >
            <Box className="w-10 h-10 text-foreground" />
            <span className="text-xs font-medium text-muted-foreground text-center truncate w-full">
              {t("launcher.tile.coming_soon")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
