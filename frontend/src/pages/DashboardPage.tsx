import { useTranslation } from "react-i18next";

export function DashboardPage() {
  useTranslation(); // ensures i18n is initialized on this page
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Plan 03 inserts DateRangeFilter and KpiCardGrid here */}
      {/* Plan 04 inserts RevenueChart here */}
      <div data-testid="dashboard-stub" className="text-sm text-muted-foreground">
        Dashboard loading…
      </div>
    </div>
  );
}
