import { request, downloadFile, periodQueryParams } from "@/lib/api-client";
import {
  IndividualReportData,
  PeriodKey,
  TeamOverviewData,
} from "@/lib/types";

export function getIndividualReport(token: string, salespersonId: string, period: PeriodKey, signal?: AbortSignal) {
  return request<IndividualReportData>(
    `/reports/individual/${salespersonId}?${periodQueryParams(period)}`,
    { method: "GET", signal },
    token
  );
}

export function getTeamOverviewReport(token: string, period: PeriodKey, signal?: AbortSignal) {
  return request<TeamOverviewData>(
    `/reports/team-overview?${periodQueryParams(period)}`,
    { method: "GET", signal },
    token
  );
}

export function exportIndividualReport(token: string, salespersonId: string, period: PeriodKey) {
  return downloadFile(`/reports/individual/${salespersonId}/export?${periodQueryParams(period)}`, token);
}

export function exportTeamOverviewReport(token: string, period: PeriodKey) {
  return downloadFile(`/reports/team-overview/export?${periodQueryParams(period)}`, token);
}

export function exportTerritoryOverviewReport(token: string, period: PeriodKey) {
  return downloadFile(`/reports/territory-overview/export?${periodQueryParams(period)}`, token);
}
