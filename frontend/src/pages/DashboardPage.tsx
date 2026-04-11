import { useState } from "react";
import {
  DateRangeFilter,
  type DateRangeValue,
} from "@/components/dashboard/DateRangeFilter";
import { KpiCardGrid } from "@/components/dashboard/KpiCardGrid";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import {
  GranularityToggle,
  type Granularity,
} from "@/components/dashboard/GranularityToggle";
import {
  ChartTypeToggle,
  type ChartType,
} from "@/components/dashboard/ChartTypeToggle";
import { getPresetRange, toApiDate } from "@/lib/dateUtils";

export function DashboardPage() {
  // D-13: Default range = current calendar year
  const [range, setRange] = useState<DateRangeValue>(() => {
    const initial = getPresetRange("thisYear");
    return { from: initial.from, to: initial.to };
  });
  // Interaction Contract #1: default granularity monthly, chart type line
  const [granularity, setGranularity] = useState<Granularity>("monthly");
  const [chartType, setChartType] = useState<ChartType>("line");

  const startDate = toApiDate(range.from);
  const endDate = toApiDate(range.to);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <DateRangeFilter value={range} onChange={setRange} />
      <KpiCardGrid startDate={startDate} endDate={endDate} />
      <div className="flex flex-wrap items-center justify-end gap-4">
        <GranularityToggle value={granularity} onChange={setGranularity} />
        <ChartTypeToggle value={chartType} onChange={setChartType} />
      </div>
      <RevenueChart
        startDate={startDate}
        endDate={endDate}
        granularity={granularity}
        chartType={chartType}
      />
    </div>
  );
}
