"use client";

/**
 * KpiTile — WACC-P1-001
 *
 * The one reusable tile for headline metrics: label on top, one big value with an
 * optional unit, an optional comparison line, and an optional drill-down.
 *
 * Replaces the bespoke tiles inside SupplementaryKpisPanel and the outer chrome of
 * RevenueTargetProgress — the Level-1 dashboard row is built from these. The value is
 * display-ready (formatted by the caller) so money values keep coming from the payload
 * as strings. `children` exists for tile bodies that carry more than a comparison line
 * (a progress bar, a per-hospital detail list); it is not a second card layout.
 */

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export interface KpiTileProps {
  label: string;
  /** Display-ready value — already formatted by the caller (payload strings stay strings). */
  value: string;
  unit?: string;
  /** Secondary line(s) beneath the value: team-average delta, target context, a progress bar. */
  comparison?: ReactNode;
  /** Tints the value — "positive" for achieved/above, "warning" for not computable. */
  status?: "default" | "positive" | "warning";
  /** Opens the metric's drill-down. Set only where this tile is the metric's trigger. */
  onDrillDown?: () => void;
  /** Extra tile body rendered after the comparison line. */
  children?: ReactNode;
}

const VALUE_COLOR: Record<NonNullable<KpiTileProps["status"]>, string> = {
  default: "text-[var(--text-primary)]",
  positive: "text-emerald-700",
  warning: "text-amber-700",
};

export function KpiTile({
  label,
  value,
  unit,
  comparison,
  status = "default",
  onDrillDown,
  children,
}: KpiTileProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-[var(--text-secondary)]">{label}</h3>
        {onDrillDown && (
          <Button type="button" variant="outline" size="sm" onClick={onDrillDown}>
            ดูที่มา
          </Button>
        )}
      </div>
      <p className="mt-1">
        <span className={`text-3xl font-semibold ${VALUE_COLOR[status]}`}>{value}</span>
        {unit && <span className="ml-1.5 text-sm text-[var(--text-secondary)]">{unit}</span>}
      </p>
      {comparison && (
        <div className="mt-2 text-sm text-[var(--text-secondary)]">{comparison}</div>
      )}
      {children}
    </Card>
  );
}

export default KpiTile;
