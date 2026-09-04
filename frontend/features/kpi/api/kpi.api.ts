import { request, periodQueryParams } from "@/lib/api-client";
import {
  DrillDownMetric,
  KpiDrillDownResponse,
  PeriodKey,
  SalespersonKpiResponse,
  TeamKpiResponse,
} from "@/lib/types";

export function getSalespersonKpi(token: string, salespersonId: number, period: PeriodKey, signal?: AbortSignal) {
  return request<SalespersonKpiResponse>(
    `/kpi/${salespersonId}?${periodQueryParams(period)}`,
    { method: "GET", signal },
    token
  );
}

export function getTeamKpi(token: string, period: PeriodKey, signal?: AbortSignal) {
  return request<TeamKpiResponse>(`/kpi/team?${periodQueryParams(period)}`, { method: "GET", signal }, token);
}

export function getKpiDrillDown(
  token: string,
  salespersonId: number,
  metric: DrillDownMetric,
  period: PeriodKey,
  hospitalId?: number,
  signal?: AbortSignal
) {
  const params = new URLSearchParams(periodQueryParams(period));
  if (hospitalId) params.set("hospitalId", String(hospitalId));
  return request<KpiDrillDownResponse>(
    `/kpi/${salespersonId}/drill-down/${metric}?${params.toString()}`,
    { method: "GET", signal },
    token
  );
}

