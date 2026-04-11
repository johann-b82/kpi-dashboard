import { useState } from "react";
import {
  DateRangeFilter,
  type DateRangeValue,
} from "@/components/dashboard/DateRangeFilter";
import { KpiCardGrid } from "@/components/dashboard/KpiCardGrid";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { getPresetRange, toApiDate, type Preset } from "@/lib/dateUtils";

export function DashboardPage() {
  // D-13: default preset = thisYear (YTD semantics per Phase 9 decision A)
  const [preset, setPreset] = useState<Preset>("thisYear");
  const [range, setRange] = useState<DateRangeValue>(() => {
    const initial = getPresetRange("thisYear");
    return { from: initial.from, to: initial.to };
  });

  const handleFilterChange = (next: DateRangeValue, nextPreset: Preset) => {
    setRange(next);
    setPreset(nextPreset);
  };

  const startDate = toApiDate(range.from);
  const endDate = toApiDate(range.to);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <DateRangeFilter
        value={range}
        preset={preset}
        onChange={handleFilterChange}
      />
      <KpiCardGrid
        startDate={startDate}
        endDate={endDate}
        preset={preset}
        range={range}
      />
      <RevenueChart startDate={startDate} endDate={endDate} />
    </div>
  );
}
