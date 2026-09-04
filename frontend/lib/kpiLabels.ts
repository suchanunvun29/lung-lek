import {
  DrillDownMetric,
  LeaderboardCriteria,
  PeriodKey,
  PeriodType,
  ScoredKpiMetric,
  SupplementaryKpiMetric,
  TeamKpiResultRow,
} from "./types";

export const SCORED_METRIC_LABEL_TH: Record<ScoredKpiMetric, string> = {
  REVENUE_VS_TARGET: "ยอดขายเทียบเป้า",
  NEW_CUSTOMERS: "ลูกค้าใหม่",
  PRODUCT_GROUP: "กลุ่มสินค้าตามเป้า",
  RETENTION: "การรักษาลูกค้าเดิม (Retention)",
  CONSISTENCY: "ความสม่ำเสมอของยอดขาย (Consistency)",
};

export const SCORED_METRIC_ORDER: ScoredKpiMetric[] = [
  "REVENUE_VS_TARGET",
  "NEW_CUSTOMERS",
  "PRODUCT_GROUP",
  "RETENTION",
  "CONSISTENCY",
];

export const SUPPLEMENTARY_METRIC_LABEL_TH: Record<SupplementaryKpiMetric, string> = {
  ACTIVE_CUSTOMERS: "ลูกค้าที่ยัง Active",
  CHURNED_CUSTOMERS: "ลูกค้าที่หายไป (Churn)",
  PRODUCT_PENETRATION: "Product Penetration",
  REVENUE_BY_HOSPITAL: "สัดส่วนยอดขายตามโรงพยาบาล",
  MONTHLY_TREND: "แนวโน้มยอดขายรายเดือน",
};

export function metricLabelTh(metric: DrillDownMetric): string {
  return (
    SCORED_METRIC_LABEL_TH[metric as ScoredKpiMetric] ??
    SUPPLEMENTARY_METRIC_LABEL_TH[metric as SupplementaryKpiMetric] ??
    metric
  );
}

export const PERIOD_TYPE_LABEL_TH: Record<PeriodType, string> = {
  MONTH: "เดือน",
  QUARTER: "ไตรมาส",
  YEAR: "ปี",
};

/** Mirrors backend/src/services/report.service.ts's `periodLabel` — used wherever a report shows a period. */
export function periodLabelTh(period: PeriodKey): string {
  if (period.periodType === "YEAR") return `ปี ${period.year}`;
  return `${PERIOD_TYPE_LABEL_TH[period.periodType]} ${period.periodNumber}/${period.year}`;
}

export function formatScore(score: number | null): string {
  if (score === null) return "-";
  return score.toLocaleString("th-TH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatKpiNumber(value: number): string {
  return value.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export const LEADERBOARD_CRITERIA_LABEL_TH: Record<LeaderboardCriteria, string> = {
  COMPOSITE: "คะแนนรวม",
  PERCENT_TARGET: "% ทำได้ตามเป้า",
  REVENUE: "ยอดขาย",
  NEW_CUSTOMERS: "ลูกค้าใหม่",
};

export const LEADERBOARD_CRITERIA_ORDER: LeaderboardCriteria[] = [
  "COMPOSITE",
  "PERCENT_TARGET",
  "REVENUE",
  "NEW_CUSTOMERS",
];

export function formatLeaderboardValue(criteria: LeaderboardCriteria, value: number): string {
  if (criteria === "COMPOSITE") return `${formatScore(value)} / 100`;
  if (criteria === "PERCENT_TARGET") return `${formatKpiNumber(value)}%`;
  if (criteria === "REVENUE") return `${value.toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท`;
  return `${value.toLocaleString("th-TH")} ราย`;
}

/** Average composite across the team, counting only computable composites — feeds the dashboard's Level-1 score tile "เทียบค่าเฉลี่ยทีม" (WACC-P1-001). */
export function computeTeamAverageComposite(
  results: TeamKpiResultRow[]
): number | null {
  const scores = results
    .map((row) => row.composite.composite)
    .filter((score): score is number => score !== null);
  if (scores.length === 0) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

/** Average score per scored metric across the team, counting only entries where that metric is computable — used for the dashboard's "เทียบค่าเฉลี่ยทีม". */
export function computeTeamAverageScores(
  results: TeamKpiResultRow[]
): Partial<Record<ScoredKpiMetric, number>> {
  const sums = new Map<ScoredKpiMetric, { sum: number; count: number }>();
  for (const row of results) {
    for (const metric of row.composite.metrics) {
      if (!metric.computable || metric.score === null) continue;
      const entry = sums.get(metric.metric) ?? { sum: 0, count: 0 };
      entry.sum += metric.score;
      entry.count += 1;
      sums.set(metric.metric, entry);
    }
  }
  const averages: Partial<Record<ScoredKpiMetric, number>> = {};
  for (const [metric, { sum, count }] of sums) {
    if (count > 0) averages[metric] = sum / count;
  }
  return averages;
}
