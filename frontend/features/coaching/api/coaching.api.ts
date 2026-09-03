import { request, periodQueryParams } from "@/lib/api-client";
import {
  CoachingInsightGenerateResponse,
  CoachingInsightGetResponse,
  PeriodKey,
} from "@/lib/types";

export function getCoachingInsight(token: string, salespersonId: string, period: PeriodKey) {
  return request<CoachingInsightGetResponse>(
    `/coaching-insights/${salespersonId}?${periodQueryParams(period)}`,
    { method: "GET" },
    token
  );
}

export function generateCoachingInsight(token: string, salespersonId: string, period: PeriodKey) {
  return request<CoachingInsightGenerateResponse>(
    `/coaching-insights/${salespersonId}/generate`,
    { method: "POST", body: JSON.stringify(period) },
    token
  );
}
