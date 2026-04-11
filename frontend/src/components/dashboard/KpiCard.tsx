import { Card } from "@/components/ui/card";

interface KpiCardProps {
  label: string;
  value?: string;
  isLoading: boolean;
}

export function KpiCard({ label, value, isLoading }: KpiCardProps) {
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
    </Card>
  );
}
