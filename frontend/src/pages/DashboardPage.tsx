import { useState } from "react";
import {
  DateRangeFilter,
  type DateRangeValue,
} from "@/components/dashboard/DateRangeFilter";
import { KpiCardGrid } from "@/components/dashboard/KpiCardGrid";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { getPresetRange, toApiDate } from "@/lib/dateUtils";

export function DashboardPage() {
  // D-13: Default range = current calendar year
  const [range, setRange] = useState<DateRangeValue>(() => {
    const initial = getPresetRange("thisYear");
    return { from: initial.from, to: initial.to };
  });

  const startDate = toApiDate(range.from);
  const endDate = toApiDate(range.to);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <DateRangeFilter value={range} onChange={setRange} />
      <KpiCardGrid startDate={startDate} endDate={endDate} />
      <RevenueChart startDate={startDate} endDate={endDate} />
    </div>
  );
}
