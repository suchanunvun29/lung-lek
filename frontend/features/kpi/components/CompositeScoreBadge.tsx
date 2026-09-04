"use client";

import { formatScore, metricLabelTh } from "@/lib/kpiLabels";
import { CompositeScoreResult } from "@/lib/types";
import { MetricReason } from "@/components/shared/kpi/MetricReason";

export interface CompositeScoreBadgeProps {
  composite: CompositeScoreResult;
}

export function CompositeScoreBadge({ composite }: CompositeScoreBadgeProps) {
  const excluded = composite.metrics.filter((m) => !m.computable);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-3xl font-semibold text-zinc-900">{formatScore(composite.composite)}</span>
        {composite.composite !== null && <span className="text-sm text-zinc-500">/ 100</span>}
        {/* Business rule B: the "คิดจาก N จาก 5 เกณฑ์" label is mandatory and always visible. */}
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
          {composite.computedFromLabel}
        </span>
      </div>

      {composite.message && (
        <div className="mt-1">
          <MetricReason reason={composite.message} />
        </div>
      )}

      {/* Excluded criteria are data the backend deliberately sends (WACC-P0-020):
          readable without expanding anything — no expander required. */}
      {excluded.length > 0 && (
        <ul className="mt-2 space-y-1">
          {excluded.map((m) => (
            <li key={m.metric}>
              <MetricReason label={metricLabelTh(m.metric)} reason={m.reason ?? "คำนวณไม่ได้"} />
            </li>
          ))}
        </ul>
      )}
      {excluded.length === 0 && (
        <p className="mt-2 text-sm text-zinc-500">คำนวณได้ครบทั้ง 5 เกณฑ์</p>
      )}
    </div>
  );
}

export default CompositeScoreBadge;
