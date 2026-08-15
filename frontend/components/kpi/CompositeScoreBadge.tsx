"use client";

import { useState } from "react";
import { formatScore, metricLabelTh } from "@/lib/kpiLabels";
import { CompositeScoreResult } from "@/lib/types";

interface CompositeScoreBadgeProps {
  composite: CompositeScoreResult;
}

/**
 * Shows the 0-100 composite score plus the "คิดจาก X จาก 5 เกณฑ์" badge design.md's KPI &
 * Scoring Rules requires everywhere a composite score appears — click the badge to see which
 * criteria were excluded and why. Meant to be reused as-is on dashboard/leaderboard/report.
 */
export default function CompositeScoreBadge({ composite }: CompositeScoreBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const excluded = composite.metrics.filter((m) => !m.computable);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-3xl font-semibold text-zinc-900">{formatScore(composite.composite)}</span>
        {composite.composite !== null && <span className="text-sm text-zinc-500">/ 100</span>}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
        >
          {composite.computedFromLabel}
        </button>
      </div>

      {composite.message && <p className="mt-1 text-sm text-amber-700">{composite.message}</p>}

      {expanded && excluded.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {excluded.map((m) => (
            <li key={m.metric}>
              <span className="font-medium">{metricLabelTh(m.metric)}</span>
              {m.reason ? `: ${m.reason}` : ""}
            </li>
          ))}
        </ul>
      )}
      {expanded && excluded.length === 0 && (
        <p className="mt-2 text-sm text-zinc-500">คำนวณได้ครบทั้ง 5 เกณฑ์</p>
      )}
    </div>
  );
}
