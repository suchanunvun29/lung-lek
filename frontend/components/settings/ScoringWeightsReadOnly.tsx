import { SCORED_METRIC_LABEL_TH, SCORED_METRIC_ORDER } from "@/lib/kpiLabels";
import { ScoringWeight } from "@/lib/types";

interface ScoringWeightsReadOnlyProps {
  weights: ScoringWeight[];
}

export default function ScoringWeightsReadOnly({ weights }: ScoringWeightsReadOnlyProps) {
  const weightByMetric = new Map(weights.map((w) => [w.metric, w.weight]));

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SCORED_METRIC_ORDER.map((metric) => (
          <div key={metric} className="flex items-center justify-between text-sm">
            <span className="text-zinc-700">{SCORED_METRIC_LABEL_TH[metric]}</span>
            <span className="font-medium text-zinc-900">{weightByMetric.get(metric) ?? 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
