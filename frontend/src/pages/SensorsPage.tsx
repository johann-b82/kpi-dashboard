import {
  SensorTimeWindowProvider,
  SensorTimeWindowPicker,
} from "@/components/sensors/SensorTimeWindow";
import { SensorStatusCards } from "@/components/sensors/SensorStatusCards";
import { SensorTimeSeriesChart } from "@/components/sensors/SensorTimeSeriesChart";

/**
 * SensorsPage — Phase 39 admin-gated sensor dashboard.
 *
 * Mirrors HRPage shell layout. The SegmentedControl lives inside the page
 * (not SubHeader) so SensorTimeWindowContext is scoped to this route.
 * Server-side admin gate on /api/sensors/* is primary; AdminOnly on the
 * launcher tile is belt-and-braces (D-03).
 */
export function SensorsPage() {
  return (
    <SensorTimeWindowProvider>
      <div className="max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8">
        <div className="flex justify-end">
          <SensorTimeWindowPicker />
        </div>
        <SensorStatusCards />
        <SensorTimeSeriesChart />
      </div>
    </SensorTimeWindowProvider>
  );
}
