import { type ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface KpiCardProps {
  label: string;
  value?: string;
  isLoading: boolean;
  /**
   * Phase 9 slot. Rendered on the right side of the card, vertically
   * centered against the value. When undefined or null, the card
   * renders exactly as v1.1 (no extra DOM, no spacing). KpiCardGrid
   * in 09-03 populates this with a `<DeltaBadgeStack />` per card.
   */
  delta?: ReactNode;
}

export function KpiCard({ label, value, isLoading, delta }: KpiCardProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="h-4 w-24 bg-muted rounded animate-pulse mb-4" />
        <div className="h-9 w-36 bg-muted rounded animate-pulse" />
      </Card>
    );
  }
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-3xl font-semibold tabular-nums mt-2">
            {value ?? "—"}
          </p>
        </div>
        {delta != null && (
          <div className="flex-shrink-0 text-right">{delta}</div>
        )}
      </div>
    </Card>
  );
}
