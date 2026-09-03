import { request } from "@/lib/api-client";
import {
  EvaluationSetting,
  PotentialMetricKey,
  ScoredKpiMetric,
  ScoringWeight,
  ScoringWeightRevision,
  TierWeightRow,
} from "@/lib/types";

export function getScoringWeights(token: string) {
  return request<{ weights: ScoringWeight[]; revisions: ScoringWeightRevision[] }>(
    "/settings/scoring-weights",
    { method: "GET" },
    token
  );
}

export interface ScoringWeightInput {
  metric: ScoredKpiMetric;
  weight: number;
}

export function updateScoringWeights(token: string, weights: ScoringWeightInput[], note?: string | null) {
  return request<{ weights: ScoringWeight[] }>(
    "/settings/scoring-weights",
    { method: "PUT", body: JSON.stringify({ weights, note: note ?? undefined }) },
    token
  );
}

export function getEvaluationSetting(token: string) {
  return request<{ setting: EvaluationSetting }>("/settings/evaluation", { method: "GET" }, token);
}

export interface EvaluationSettingUpdateInput {
  churnMonths?: number;
  minMonthsForChurn?: number;
  minMonthsForConsistency?: number;
  aiEnabled?: boolean;
  aiAnonymize?: boolean;
  potentialMetric?: PotentialMetricKey;
  minRegionCoverage?: number;
  targetSuggestionAlpha?: number;
  targetLookbackMonths?: number;
  targetOutlierThreshold?: number;
  targetGrowthRate?: number;
}

export function updateEvaluationSetting(token: string, input: EvaluationSettingUpdateInput) {
  return request<{ setting: EvaluationSetting }>(
    "/settings/evaluation",
    { method: "PATCH", body: JSON.stringify(input) },
    token
  );
}

export function getTierWeights(token: string) {
  return request<{ weights: TierWeightRow[] }>("/settings/tier-weights", { method: "GET" }, token);
}

export function updateTierWeights(token: string, weights: { tier: string; weight: number }[]) {
  return request<{ weights: TierWeightRow[] }>(
    "/settings/tier-weights",
    { method: "PATCH", body: JSON.stringify({ weights }) },
    token
  );
}
