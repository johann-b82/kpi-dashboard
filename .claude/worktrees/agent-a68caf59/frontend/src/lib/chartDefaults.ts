// Shared Recharts token defaults per 21-UI-SPEC.md §"Recharts Contract (DM-03)".
// All values reference CSS variables so charts auto-adapt when `.dark` toggles.

export const gridProps = {
  strokeDasharray: "3 3",
  stroke: "var(--color-border)",
} as const;

export const axisProps = {
  stroke: "var(--color-border)",
  tick: { fill: "var(--color-muted-foreground)", fontSize: 12 },
  tickLine: { stroke: "var(--color-border)" },
  axisLine: { stroke: "var(--color-border)" },
} as const;

export const tooltipStyle = {
  background: "var(--color-popover)",
  color: "var(--color-popover-foreground)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
} as const;

export const tooltipLabelStyle = {
  color: "var(--color-popover-foreground)",
} as const;

export const tooltipItemStyle = {
  color: "var(--color-popover-foreground)",
} as const;

export const tooltipCursorProps = {
  fill: "var(--color-accent)",
  opacity: 0.3,
} as const;

export const legendWrapperStyle = {
  color: "var(--color-muted-foreground)",
} as const;
