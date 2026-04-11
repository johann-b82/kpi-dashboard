import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ChartType = "line" | "bar";

interface ChartTypeToggleProps {
  value: ChartType;
  onChange: (next: ChartType) => void;
}

export function ChartTypeToggle({ value, onChange }: ChartTypeToggleProps) {
  const { t } = useTranslation();
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as ChartType)}>
      <TabsList>
        <TabsTrigger value="line">{t("dashboard.chart.type.line")}</TabsTrigger>
        <TabsTrigger value="bar">{t("dashboard.chart.type.bar")}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
