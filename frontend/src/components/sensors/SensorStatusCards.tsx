import { useQueries, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  fetchSensorReadings,
  fetchSensors,
  type SensorRead,
  type SensorReadingRead,
} from "@/lib/api";
import { sensorKeys } from "@/lib/queryKeys";

/**
 * SensorStatusCards — Phase 39-01. One KPI card per enabled sensor.
 *
 * Data model:
 *   - sensor list: staleTime 60s (config rarely changes)
 *   - per-sensor readings for the last 1h: D-07 refetch (15s foreground,
 *     no background, refetch on focus, 5s stale)
 *
 * Threshold-aware colors, delta badges (DIFF-01) and health chip (DIFF-10)
 * are explicit 39-02 scope — NOT rendered here.
 */
export function SensorStatusCards() {
  const { t } = useTranslation();

  const sensorsQuery = useQuery({
    queryKey: sensorKeys.list(),
    queryFn: fetchSensors,
    staleTime: 60_000,
  });

  const sensors = sensorsQuery.data ?? [];

  // One reading query per sensor, all gated on sensor list resolving.
  const readingResults = useQueries({
    queries: sensors.map((s) => ({
      queryKey: sensorKeys.readings(s.id, 1),
      queryFn: () => fetchSensorReadings(s.id, 1),
      refetchInterval: 15_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
      staleTime: 5_000,
    })),
  });

  if (sensorsQuery.isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div
            key={`skel-${i}`}
            className="animate-pulse bg-muted rounded-lg h-36"
          />
        ))}
      </div>
    );
  }

  if (sensorsQuery.isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">
        {t("sensors.error.loading")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sensors.map((sensor, idx) => (
        <SensorCard
          key={sensor.id}
          sensor={sensor}
          readings={readingResults[idx]?.data ?? []}
        />
      ))}
    </div>
  );
}

interface SensorCardProps {
  sensor: SensorRead;
  readings: SensorReadingRead[];
}

function SensorCard({ sensor, readings }: SensorCardProps) {
  const { t } = useTranslation();

  // Latest reading = last element (backend returns chronological asc); but be
  // defensive about ordering and pick max recorded_at instead.
  const latest = readings.length
    ? readings.reduce((acc, r) =>
        new Date(r.recorded_at).getTime() > new Date(acc.recorded_at).getTime()
          ? r
          : acc,
      )
    : null;

  const hasValues =
    latest != null &&
    latest.error_code == null &&
    (latest.temperature != null || latest.humidity != null);

  const freshnessLabel =
    latest != null
      ? (() => {
          const seconds = Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(latest.recorded_at).getTime()) / 1000,
            ),
          );
          return t("sensors.kpi.freshness", { seconds });
        })()
      : t("sensors.kpi.freshness.never");

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-medium text-foreground">{sensor.name}</h3>

      {hasValues ? (
        <div className="flex items-baseline gap-6">
          <div>
            <div className="text-3xl font-semibold text-foreground">
              {latest!.temperature != null
                ? `${Number(latest!.temperature).toFixed(1)} °C`
                : "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {t("sensors.kpi.temperature")}
            </div>
          </div>
          <div>
            <div className="text-3xl font-semibold text-foreground">
              {latest!.humidity != null
                ? `${Number(latest!.humidity).toFixed(0)} %`
                : "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {t("sensors.kpi.humidity")}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          {t("sensors.empty.noReadings")}
        </div>
      )}

      <div className="text-xs text-muted-foreground pt-2 border-t border-border">
        {freshnessLabel}
      </div>
    </div>
  );
}
