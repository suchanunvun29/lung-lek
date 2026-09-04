import { SCORED_METRIC_ORDER } from "@/lib/kpiLabels";
import { ScoringWeight } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { METRIC_DESCRIPTIONS } from "./ScoringWeightsForm";
import { Info } from "lucide-react";

export interface ScoringWeightsReadOnlyProps {
  weights: ScoringWeight[];
}

export function ScoringWeightsReadOnly({ weights }: ScoringWeightsReadOnlyProps) {
  const weightByMetric = new Map(weights.map((w) => [w.metric, w.weight]));
  const total = SCORED_METRIC_ORDER.reduce(
    (sum, m) => sum + (weightByMetric.get(m) ?? 0),
    0
  );

  return (
    <Card className="p-5 space-y-4">
      <div className="flex gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] p-3 text-xs text-[var(--text-secondary)] leading-relaxed">
        <Info size={18} className="shrink-0 text-[var(--primary)] mt-0.5" />
        <div>
          <p className="font-semibold text-[var(--text-primary)] mb-0.5">
            หลักการคำนวณคะแนนรวม (Composite Score):
          </p>
          <p>
            ระบบคิดคะแนนรวมโดยถ่วงน้ำหนักเฉพาะเกณฑ์ที่สามารถคำนวณได้จริง (Computable Criteria) เท่านั้น
            และตัวหารคือผลรวมค่าน้ำหนักของเกณฑ์ที่คำนวณได้
          </p>
        </div>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {SCORED_METRIC_ORDER.map((metric) => {
          const item = METRIC_DESCRIPTIONS[metric];
          const val = weightByMetric.get(metric) ?? 0;
          return (
            <div
              key={metric}
              className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-sm"
            >
              <div>
                <span className="text-[var(--text-primary)] font-medium">
                  {item.label}
                </span>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {item.description}
                </p>
              </div>
              <span className="font-semibold text-[var(--text-primary)] tabular-nums shrink-0">
                {val}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          ผลรวมค่าน้ำหนัก:
        </span>
        <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
          {total}%
        </span>
      </div>
    </Card>
  );
}

export default ScoringWeightsReadOnly;
