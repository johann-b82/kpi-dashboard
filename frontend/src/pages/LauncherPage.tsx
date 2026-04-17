import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { LayoutDashboard, Box } from "lucide-react";
import { useAuth } from "@/auth/useAuth";

export function LauncherPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // LAUNCH-05 / D-05: Admin-only tiles absent (not greyed) for viewer role.
  // v1.14 defines ZERO admin-only tiles, so this variable is unused but the
  // hook + pattern is wired so future admin tiles slot in cleanly.
  const isAdmin = user?.role === "admin";
  void isAdmin; // silence unused-var until an admin tile is added

  return (
    <div className="max-w-7xl mx-auto px-8 pt-16 pb-8">
      <div
        className="grid gap-8"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}
      >
        {/* Active tile: KPI Dashboard → navigates to /sales (Sales Dashboard route) */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setLocation("/sales")}
            aria-label={t("launcher.tile.kpi_dashboard")}
            className="w-[120px] h-[120px] rounded-2xl bg-card border border-border
                       flex items-center justify-center p-4
                       cursor-pointer hover:bg-accent/10 transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LayoutDashboard className="w-10 h-10 text-foreground" aria-hidden="true" />
          </button>
          <span className="text-xs text-muted-foreground text-center">
            {t("launcher.tile.kpi_dashboard")}
          </span>
        </div>

        {/* Coming-soon tiles (3x) — opacity-40 + pointer-events-none per D-04 */}
        {[0, 1, 2].map((i) => (
          <div key={`coming-soon-${i}`} className="flex flex-col items-center gap-2">
            <div
              aria-hidden="true"
              className="w-[120px] h-[120px] rounded-2xl bg-card border border-border
                         flex items-center justify-center p-4
                         opacity-40 pointer-events-none"
            >
              <Box className="w-10 h-10 text-foreground" />
            </div>
            <span className="text-xs text-muted-foreground text-center opacity-40">
              {t("launcher.tile.coming_soon")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
