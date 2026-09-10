import { request, downloadFile, periodQueryParams } from "@/lib/api-client";
import {
  DrillDownMetric,
  PeriodKey,
  TerritoryKpiDrillDownResponse,
  TerritoryKpiTeamResponse,
  TerritoryOverviewResponse,
  TerritoryProductRankingResponse,
} from "@/lib/types";

export function getTerritoryKpiTeam(token: string, period: PeriodKey, signal?: AbortSignal) {
  return request<TerritoryKpiTeamResponse>(
    `/territory-kpi/team?${periodQueryParams(period)}`,
    { method: "GET", signal },
    token
  );
}

export function getTerritoryKpiDrillDown(
  token: string,
  territoryId: number,
  metric: DrillDownMetric,
  period: PeriodKey,
  signal?: AbortSignal
) {
  return request<TerritoryKpiDrillDownResponse>(
    `/territory-kpi/${territoryId}/drill-down/${metric}?${periodQueryParams(period)}`,
    { method: "GET", signal },
    token
  );
}

export function getTerritoryOverview(token: string, period: PeriodKey, signal?: AbortSignal) {
  return request<TerritoryOverviewResponse>(
    `/reports/territory-overview?${periodQueryParams(period)}`,
    { method: "GET", signal },
    token
  );
}

export function getTerritoryProductRanking(token: string, territoryId: string, period: PeriodKey, signal?: AbortSignal) {
  return request<TerritoryProductRankingResponse>(
    `/territory-product-ranking/${territoryId}?${periodQueryParams(period)}`,
    { method: "GET", signal },
    token
  );
}

export function exportTerritoryProductRanking(token: string, territoryId: string, period: PeriodKey, signal?: AbortSignal) {
  return downloadFile(
    `/territory-product-ranking/${territoryId}/export?${periodQueryParams(period)}`,
    token,
    signal
  );
}
