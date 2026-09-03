import { request, periodQueryParams } from "@/lib/api-client";
import {
  DrillDownMetric,
  KpiDrillDownResponse,
  PeriodKey,
  SalespersonKpiResponse,
  TeamKpiResponse,
} from "@/lib/types";

export function getSalespersonKpi(token: string, salespersonId: string, period: PeriodKey) {
  return request<SalespersonKpiResponse>(
    `/kpi/${salespersonId}?${periodQueryParams(period)}`,
    { method: "GET" },
    token
  );
}

export function getTeamKpi(token: string, period: PeriodKey) {
  return request<TeamKpiResponse>(`/kpi/team?${periodQueryParams(period)}`, { method: "GET" }, token);
}

export function getKpiDrillDown(
  token: string,
  salespersonId: string,
  metric: DrillDownMetric,
  period: PeriodKey,
  hospitalId?: string
) {
  const params = new URLSearchParams(periodQueryParams(period));
  if (hospitalId) params.set("hospitalId", hospitalId);
  return request<KpiDrillDownResponse>(
    `/kpi/${salespersonId}/drill-down/${metric}?${params.toString()}`,
    { method: "GET" },
    token
  );
}
