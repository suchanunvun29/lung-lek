"use client";

/**
 * BreakdownBarList — WACC-P1-003
 *
 * Replaces BreakdownPieChart: a horizontal bar list (top 5 + "ดูทั้งหมด") shows the same
 * composition data once, in a form that can actually be compared — a pie that buckets
 * everything past 7 slices into "อื่น ๆ" answers nothing a sorted list does not.
 *
 * Bar lengths are relative to the largest share so the top rows stay comparable; the %
 * labels are the payload's own share values (`revenueShare` / `sharePercent`), never
 * recomputed. "ดูทั้งหมด" reveals every item, including those previously only visible in
 * the duplicate lists this component replaces. Labels truncate with a title attribute
 * rather than wrapping on narrow screens.
 */

import { useState } from "react";
import { formatKpiNumber } from "@/lib/kpiLabels";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export interface BreakdownItem {
  name: string;
  /** Share value from the payload — drives both the bar length and the % label. */
  sharePercent: number;
  /** Optional secondary value shown before the share (hospital rows: formatted revenue). */
  secondaryLabel?: string;
}

export interface BreakdownBarListProps {
  title: string;
  items: BreakdownItem[];
  emptyLabel?: string;
  /** Opens the metric's drill-down when this list is the metric's only trigger. */
  onDrillDown?: () => void;
}

const TOP_VISIBLE_COUNT = 5;
/** Chart colours from the semantic token layer (WACC-P0-006) — no colour literals here. */
const BAR_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

export function BreakdownBarList({ title, items, emptyLabel = "ไม่มีข้อมูล", onDrillDown }: BreakdownBarListProps) {
  const [showAll, setShowAll] = useState(false);

  const sorted = [...items].sort((a, b) => b.sharePercent - a.sharePercent);
  const visible = showAll ? sorted : sorted.slice(0, TOP_VISIBLE_COUNT);
  const maxShare = sorted.reduce((max, item) => Math.max(max, item.sharePercent), 0);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-medium text-[var(--text-secondary)]">{title}</h2>
        {onDrillDown && (
          <Button type="button" variant="outline" size="sm" onClick={onDrillDown}>
            ดูที่มา
          </Button>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">{emptyLabel}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-3">
            {visible.map((item, index) => (
              <li key={item.name}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate" title={item.name}>
                    {item.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-600">
                    {item.secondaryLabel && (
                      <span className="mr-2 text-xs text-zinc-500">{item.secondaryLabel}</span>
                    )}
                    {formatKpiNumber(item.sharePercent)}%
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: maxShare > 0 ? `${(item.sharePercent / maxShare) * 100}%` : "0%",
                      backgroundColor: BAR_COLORS[index % BAR_COLORS.length],
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>

          {sorted.length > TOP_VISIBLE_COUNT && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setShowAll((prev) => !prev)}
            >
              {showAll ? "แสดงน้อยลง" : `ดูทั้งหมด (${sorted.length})`}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}

export default BreakdownBarList;
