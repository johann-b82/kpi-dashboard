import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { FreshnessIndicator } from "@/components/dashboard/FreshnessIndicator";
import { useDateRange } from "@/contexts/DateRangeContext";
import { fetchSyncMeta } from "@/lib/api";
import { syncKeys } from "@/lib/queryKeys";

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

export function SubHeader() {
  const [location] = useLocation();
  const { preset, range, handleFilterChange } = useDateRange();

  return (
    <div className="fixed top-16 inset-x-0 h-12 bg-background z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        <div>
          {location === "/" && (
            <DateRangeFilter
              value={range}
              preset={preset}
              onChange={handleFilterChange}
            />
          )}
        </div>
        {location === "/hr" ? <HrFreshnessIndicator /> : <FreshnessIndicator />}
      </div>
    </div>
  );
}
