import { request, downloadFile, periodQueryParams } from "@/lib/api-client";
import {
  LeaderboardCriteria,
  LeaderboardPeopleOrSummary,
  PeriodKey,
  TerritoryLeaderboardResponse,
} from "@/lib/types";

export function getTerritoryLeaderboard(
  token: string,
  criteria: LeaderboardCriteria,
  period: PeriodKey
) {
  const params = new URLSearchParams(periodQueryParams(period));
  params.set("criteria", criteria);
  return request<TerritoryLeaderboardResponse>(
    `/leaderboard/territories?${params.toString()}`,
    { method: "GET" },
    token
  );
}

export function exportTerritoryLeaderboard(
  token: string,
  criteria: LeaderboardCriteria,
  period: PeriodKey
) {
  const params = new URLSearchParams(periodQueryParams(period));
  params.set("criteria", criteria);
  return downloadFile(`/leaderboard/territories/export?${params.toString()}`, token);
}

export function getTerritoryLeaderboardPeople(
  token: string,
  territoryId: string,
  criteria: LeaderboardCriteria,
  period: PeriodKey
) {
  const params = new URLSearchParams(periodQueryParams(period));
  params.set("criteria", criteria);
  return request<LeaderboardPeopleOrSummary>(
    `/leaderboard/territories/${territoryId}/people?${params.toString()}`,
    { method: "GET" },
    token
  );
}
