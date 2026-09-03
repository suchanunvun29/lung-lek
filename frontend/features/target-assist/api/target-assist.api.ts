import { request } from "@/lib/api-client";
import {
  ReinstateDealResponse,
  SuggestionMode,
  TargetSuggestionPreview,
} from "@/lib/types";

export function getTargetSuggestions(
  token: string,
  year: number,
  month: number,
  mode: SuggestionMode,
  targetGrowthRate?: number
) {
  const params = new URLSearchParams({ mode });
  // Territory & Potential Rules ข้อ 5.1 — per-round override; omitting it lets the backend fall back to EvaluationSetting.
  if (targetGrowthRate !== undefined) params.set("targetGrowthRate", String(targetGrowthRate));
  return request<TargetSuggestionPreview>(
    `/target-suggestions/${year}/${month}?${params.toString()}`,
    { method: "GET" },
    token
  );
}

/** Rebuilding the preview replaces the whole reinstated set — send every invoice to keep, not just the change. */
export interface ReinstateDealInput {
  year: number;
  month: number;
  mode: SuggestionMode;
  reinstateInvoiceNos: string[];
  /** Same per-round override as getTargetSuggestions — undefined drops the key in JSON.stringify (mirrors reinstateDealBodySchema). */
  targetGrowthRate?: number;
}

/** Affects this preview only — nothing is written until the manager accepts into Target. */
export function reinstateDeal(token: string, input: ReinstateDealInput) {
  return request<ReinstateDealResponse>(
    "/target-suggestions/reinstate-deal",
    { method: "POST", body: JSON.stringify(input) },
    token
  );
}
