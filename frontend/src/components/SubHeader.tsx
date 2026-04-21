import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Upload as UploadIcon } from "lucide-react";
import { AdminOnly } from "@/auth/AdminOnly";
import { Toggle } from "@/components/ui/toggle";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { FreshnessIndicator } from "@/components/dashboard/FreshnessIndicator";
import { useDateRange } from "@/contexts/DateRangeContext";
import { fetchSyncMeta, fetchSensorStatus } from "@/lib/api";
import { syncKeys, sensorKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

function HrFreshnessIndicator() {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: syncKeys.meta(),
    queryFn: fetchSyncMeta,
  });

  if (isLoading) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (!data?.last_synced_at) {
    return (
      <span className="text-xs text-muted-foreground">
        {t("hr.sync.never")}
      </span>
    );
  }
  const locale = i18n.language === "de" ? "de-DE" : "en-US";
  const formatted = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(data.last_synced_at));
  return (
    <span className="text-xs text-muted-foreground">
      {t("hr.sync.lastSynced")} {formatted}
    </span>
  );
}

/**
 * Sensor freshness — aggregate "last measured" across all enabled sensors.
 * Uses sensorKeys.status() with D-07 refetch config (15s foreground, stop in
 * background, refetch on focus, 5s stale). Next-poll display is deferred to a
 * later plan: sensor_poll_interval_s lives on AppSettings but isn't exposed
 * via /api/settings yet (Phase 40 scope).
 */
function SensorFreshnessIndicator() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: sensorKeys.status(),
    queryFn: fetchSensorStatus,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });

  if (isLoading) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const successTimestamps = (data ?? [])
    .map((s) => s.last_success_at)
    .filter((v): v is string => v != null)
    .map((ts) => new Date(ts).getTime())
    .filter((n) => Number.isFinite(n));

  if (successTimestamps.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {t("sensors.subheader.never")}
      </span>
    );
  }

  const latest = Math.max(...successTimestamps);
  const seconds = Math.max(0, Math.floor((Date.now() - latest) / 1000));
  return (
    <span className="text-xs text-muted-foreground">
      {t("sensors.subheader.lastMeasured", { seconds })}
    </span>
  );
}

export function SubHeader() {
  const { t } = useTranslation();
  const [location, navigate] = useLocation();
  const { preset, range, handleFilterChange } = useDateRange();

  // Launcher surface hides chrome entirely — return null after all hooks
  // so React's rules-of-hooks (constant hook order) are preserved across
  // navigation between / and other routes.
  if (location === "/") return null;

  const isDashboard = location === "/sales" || location === "/hr";

  return (
    <div className="fixed top-16 inset-x-0 h-12 bg-background z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isDashboard && (
            <Toggle
              segments={[
                { value: "/sales", label: t("nav.sales") },
                { value: "/hr", label: t("nav.hr") },
              ] as const}
              value={location === "/hr" ? "/hr" : "/sales"}
              onChange={(path) => navigate(path)}
              aria-label={t("nav.dashboardToggleLabel")}
              className="border-transparent"
            />
          )}
          {location === "/sales" && (
            <DateRangeFilter
              value={range}
              preset={preset}
              onChange={handleFilterChange}
            />
          )}
        </div>
        <div className="flex items-center gap-3">
          {isDashboard && (
            <AdminOnly>
              <Link
                href="/upload"
                aria-label={t("nav.upload")}
                className={cn(
                  "inline-flex items-center justify-center rounded-md p-1.5 hover:bg-accent/10 transition-colors",
                  "text-foreground",
                )}
              >
                <UploadIcon className="h-4 w-4" />
              </Link>
            </AdminOnly>
          )}
          {location === "/sensors" ? (
            <SensorFreshnessIndicator />
          ) : location === "/hr" ? (
            <HrFreshnessIndicator />
          ) : (
            <FreshnessIndicator />
          )}
        </div>
      </div>
    </div>
  );
}
