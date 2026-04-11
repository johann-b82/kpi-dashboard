import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type Granularity = "daily" | "weekly" | "monthly";

interface GranularityToggleProps {
  value: Granularity;
  onChange: (next: Granularity) => void;
}

export function GranularityToggle({ value, onChange }: GranularityToggleProps) {
  const { t } = useTranslation();
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as Granularity)}>
      <TabsList>
        <TabsTrigger value="daily">
          {t("dashboard.chart.granularity.daily")}
        </TabsTrigger>
        <TabsTrigger value="weekly">
          {t("dashboard.chart.granularity.weekly")}
        </TabsTrigger>
        <TabsTrigger value="monthly">
          {t("dashboard.chart.granularity.monthly")}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
