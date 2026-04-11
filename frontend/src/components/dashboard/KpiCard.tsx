import { type ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface KpiCardProps {
  label: string;
  value?: string;
  isLoading: boolean;
  /**
   * Phase 9 slot. Rendered below the value line with `mt-3` spacing.
   * When undefined or null, the card renders exactly as v1.1 (no
   * extra DOM, no spacing). KpiCardGrid in 09-03 populates this
   * with a `<DeltaBadgeStack />` per card.
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
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-3xl font-semibold tabular-nums mt-2">{value ?? "—"}</p>
      {delta != null && <div className="mt-3">{delta}</div>}
    </Card>
  );
}
