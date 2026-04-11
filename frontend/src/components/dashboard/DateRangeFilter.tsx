import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { getPresetRange, type Preset } from "@/lib/dateUtils";

export interface DateRangeValue {
  from: Date | undefined;
  to: Date | undefined;
}

interface DateRangeFilterProps {
  value: DateRangeValue;
  preset: Preset;
  onChange: (value: DateRangeValue, preset: Preset) => void;
}

const PRESETS: Preset[] = ["thisMonth", "thisQuarter", "thisYear", "allTime"];

export function DateRangeFilter({
  value: _value,
  preset,
  onChange,
}: DateRangeFilterProps) {
  const { t } = useTranslation();

  const selectPreset = (p: Preset) => {
    const range = getPresetRange(p);
    onChange({ from: range.from, to: range.to }, p);
  };

  return (
    <div className="flex flex-wrap items-center justify-end">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p}
            type="button"
            variant={preset === p ? "default" : "outline"}
            size="sm"
            onClick={() => selectPreset(p)}
          >
            {t(`dashboard.filter.${p}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}
