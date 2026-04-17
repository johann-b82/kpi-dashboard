import { useQueries, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  axisProps,
  gridProps,
  legendWrapperStyle,
  sensorPalette,
  tooltipCursorProps,
  tooltipItemStyle,
  tooltipLabelStyle,
  tooltipStyle,
} from "@/lib/chartDefaults";
import {
  fetchSensorReadings,
  fetchSensors,
  type SensorRead,
  type SensorReadingRead,
} from "@/lib/api";
import { sensorKeys } from "@/lib/queryKeys";
import {
  useSensorWindow,
  windowToHours,
} from "@/components/sensors/SensorTimeWindow";

type ChartRow = { ts: string } & Record<string, number | null | string>;

/**
 * SensorTimeSeriesChart — Phase 39-01. Two stacked Recharts LineCharts (°C and %)
 * with one Line per sensor. Same color index across both charts (consistent legend).
 *
 * D-07: TanStack Query refetch 15s foreground, no background, refetch on focus, 5s stale.
 * D-08: connectNulls={false} — gaps show as absent segments, not straight bridges.
 * D-05: sensorPalette is the only documented hex exception; no Tailwind dark variants.
 *
 * TODO(39-02): Add <ReferenceLine /> for global temperature / humidity thresholds
 * once /api/settings exposes sensor_temperature_min/max + sensor_humidity_min/max.
 */
export function SensorTimeSeriesChart() {
  const { t, i18n } = useTranslation();
  const { window } = useSensorWindow();
  const hours = windowToHours(window);

  const sensorsQuery = useQuery({
    queryKey: sensorKeys.list(),
    queryFn: fetchSensors,
    staleTime: 60_000,
  });

  const sensors = sensorsQuery.data ?? [];

  const readingResults = useQueries({
    queries: sensors.map((s) => ({
      queryKey: sensorKeys.readings(s.id, hours),
      queryFn: () => fetchSensorReadings(s.id, hours),
      refetchInterval: 15_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
      staleTime: 5_000,
    })),
  });

  if (sensorsQuery.isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">
        {t("sensors.error.loading")}
      </div>
    );
  }

  const perSensor: Array<{
    sensor: SensorRead;
    readings: SensorReadingRead[];
  }> = sensors.map((s, idx) => ({
    sensor: s,
    readings: readingResults[idx]?.data ?? [],
  }));

  const chartData = buildChartData(perSensor);
  const locale = i18n.language === "de" ? "de-DE" : "en-US";
  const labelFormatter = (value: unknown) => {
    const iso = typeof value === "string" ? value : String(value);
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(d);
  };

  const anyData = chartData.length > 0;

  return (
    <div className="space-y-8">
      <ChartCard
        title={t("sensors.chart.temperature.title")}
        empty={!anyData}
        emptyText={t("sensors.chart.empty")}
      >
        {/* TODO(39-02): <ReferenceLine y={tempMin} stroke="..." strokeDasharray="4 4"/> */}
        <LineChart data={chartData}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="ts"
            {...axisProps}
            tickFormatter={labelFormatter}
            minTickGap={40}
          />
          <YAxis {...axisProps} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            cursor={tooltipCursorProps}
            labelFormatter={labelFormatter}
          />
          <Legend wrapperStyle={legendWrapperStyle} />
          {perSensor.map(({ sensor }, i) => (
            <Line
              key={sensor.id}
              type="monotone"
              dataKey={`s_${sensor.id}_temp`}
              name={sensor.name}
              stroke={sensorPalette[i % sensorPalette.length]}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ChartCard>

      <ChartCard
        title={t("sensors.chart.humidity.title")}
        empty={!anyData}
        emptyText={t("sensors.chart.empty")}
      >
        {/* TODO(39-02): <ReferenceLine y={humMin} stroke="..." strokeDasharray="4 4"/> */}
        <LineChart data={chartData}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="ts"
            {...axisProps}
            tickFormatter={labelFormatter}
            minTickGap={40}
          />
          <YAxis {...axisProps} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            cursor={tooltipCursorProps}
            labelFormatter={labelFormatter}
          />
          <Legend wrapperStyle={legendWrapperStyle} />
          {perSensor.map(({ sensor }, i) => (
            <Line
              key={sensor.id}
              type="monotone"
              dataKey={`s_${sensor.id}_hum`}
              name={sensor.name}
              stroke={sensorPalette[i % sensorPalette.length]}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ChartCard>
    </div>
  );
}

function buildChartData(
  perSensor: Array<{ sensor: SensorRead; readings: SensorReadingRead[] }>,
): ChartRow[] {
  const rows = new Map<string, ChartRow>();
  for (const { sensor, readings } of perSensor) {
    for (const r of readings) {
      const key = r.recorded_at;
      const row = rows.get(key) ?? ({ ts: key } as ChartRow);
      row[`s_${sensor.id}_temp`] =
        r.temperature != null ? Number(r.temperature) : null;
      row[`s_${sensor.id}_hum`] =
        r.humidity != null ? Number(r.humidity) : null;
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort((a, b) =>
    String(a.ts).localeCompare(String(b.ts)),
  );
}

interface ChartCardProps {
  title: string;
  empty: boolean;
  emptyText: string;
  children: React.ReactElement;
}

function ChartCard({ title, empty, emptyText, children }: ChartCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-foreground mb-4">{title}</h3>
      {empty ? (
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          {children}
        </ResponsiveContainer>
      )}
    </div>
  );
}
