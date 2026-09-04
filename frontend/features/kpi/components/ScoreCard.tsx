"use client";

import { formatScore, SCORED_METRIC_LABEL_TH, SCORED_METRIC_ORDER } from "@/lib/kpiLabels";
import { CompositeScoreResult, ScoredKpiMetric } from "@/lib/types";
import { CompositeScoreBadge } from "./CompositeScoreBadge";
import { MetricReason } from "@/components/shared/kpi/MetricReason";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface ScoreCardProps {
  composite: CompositeScoreResult;
  onDrillDown: (metric: ScoredKpiMetric) => void;
  /** Team-average score per metric (0-100, same scale as `MetricResult.score`) — Phase 5's "เทียบค่าเฉลี่ยทีม". */
  teamAverages?: Partial<Record<ScoredKpiMetric, number>>;
}

export function ScoreCard({ composite, onDrillDown, teamAverages }: ScoreCardProps) {
  const metricByKey = new Map(composite.metrics.map((m) => [m.metric, m]));

  return (
    <Card className="p-4">
      <h2 className="text-sm font-medium text-zinc-500">คะแนนรวม</h2>
      <div className="mt-1">
        <CompositeScoreBadge composite={composite} />
      </div>

      <div className="mt-5 divide-y divide-zinc-100 border-t border-zinc-100">
        {SCORED_METRIC_ORDER.map((metric) => {
          const result = metricByKey.get(metric);
          if (!result) return null;
          return (
            <div key={metric} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium text-zinc-900">{SCORED_METRIC_LABEL_TH[metric]}</p>
                {!result.computable && (
                  <MetricReason reason={result.reason} className="mt-0.5" />
                )}
                {teamAverages?.[metric] !== undefined && (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    ค่าเฉลี่ยทีม: {formatScore(teamAverages[metric] ?? null)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-lg font-semibold text-zinc-900">
                  {result.computable ? formatScore(result.score) : "คำนวณไม่ได้"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDrillDown(metric)}
                >
                  ดูที่มา
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default ScoreCard;
