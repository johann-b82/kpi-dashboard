import { useLocation } from "wouter";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { FreshnessIndicator } from "@/components/dashboard/FreshnessIndicator";
import { useDateRange } from "@/contexts/DateRangeContext";

export function SubHeader() {
  const [location] = useLocation();
  const { preset, range, handleFilterChange } = useDateRange();

  return (
    <div className="fixed top-16 inset-x-0 h-12 bg-card border-b border-border shadow-sm z-40">
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
        <FreshnessIndicator />
      </div>
    </div>
  );
}
