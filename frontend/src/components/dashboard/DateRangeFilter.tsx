import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getPresetRange, type Preset } from "@/lib/dateUtils";

export interface DateRangeValue {
  from: Date | undefined;
  to: Date | undefined;
}

interface DateRangeFilterProps {
  value: DateRangeValue;
  preset: Preset | null;
  onChange: (value: DateRangeValue, preset: Preset | null) => void;
}

const PRESETS: Preset[] = ["thisMonth", "thisQuarter", "thisYear", "allTime"];

export function DateRangeFilter({
  value,
  preset,
  onChange,
}: DateRangeFilterProps) {
  const { t } = useTranslation();
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>({
    from: value.from,
    to: value.to,
  });
  const [popoverOpen, setPopoverOpen] = useState(false);

  const selectPreset = (p: Preset) => {
    const range = getPresetRange(p);
    onChange({ from: range.from, to: range.to }, p);
  };

  const applyCustom = () => {
    onChange({ from: pendingRange?.from, to: pendingRange?.to }, null);
    setPopoverOpen(false);
  };

  const resetToDefault = () => {
    setPendingRange(undefined);
    const range = getPresetRange("thisYear");
    onChange({ from: range.from, to: range.to }, "thisYear");
    setPopoverOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("dashboard.filter.label")}
      </span>
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
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger
            render={
              <Button type="button" variant="outline" size="sm" />
            }
          >
            {t("dashboard.filter.custom")}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-4">
            <Calendar
              mode="range"
              selected={pendingRange}
              onSelect={setPendingRange}
              numberOfMonths={2}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetToDefault}
              >
                {t("dashboard.filter.reset")}
              </Button>
              <Button type="button" size="sm" onClick={applyCustom}>
                {t("dashboard.filter.apply")}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
