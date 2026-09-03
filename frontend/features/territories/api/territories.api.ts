import { request, downloadFile, periodQueryParams } from "@/lib/api-client";
import {
  DerivedTarget,
  Hospital,
  MyTerritoryViewResponse,
  NeverSoldHospitalsResponse,
  PeriodKey,
  Territory,
  TerritoryAssignment,
  TerritoryGroup,
  TerritoryGroupMember,
  UnassignedTerritoryHospital,
} from "@/lib/types";

export interface TerritoryInput {
  name: string;
  code?: string | null;
  regionId?: string | null;
  isActive?: boolean;
  note?: string | null;
}

export function listTerritories(token: string) {
  return request<{ territories: Territory[] }>("/territories", { method: "GET" }, token);
}

export function createTerritory(token: string, input: TerritoryInput) {
  return request<{ territory: Territory }>("/territories", { method: "POST", body: JSON.stringify(input) }, token);
}

export function updateTerritory(token: string, id: string, input: Partial<TerritoryInput>) {
  return request<{ territory: Territory }>(`/territories/${id}`, { method: "PATCH", body: JSON.stringify(input) }, token);
}

export function listTerritoryAssignments(
  token: string,
  filters: { territoryId?: string; salespersonId?: string; status?: "ACTIVE" | "INACTIVE" } = {}
) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
  const query = params.toString();
  return request<{ territoryAssignments: TerritoryAssignment[] }>(
    `/territory-assignments${query ? `?${query}` : ""}`,
    { method: "GET" },
    token
  );
}

export interface TerritoryAssignmentAssignInput {
  territoryId: string;
  salespersonId: string;
  effectiveFrom: string;
  isSupervisor: boolean;
  note?: string | null;
}

/** Withdraw closes the open row only — this path must NOT send effectiveFrom (fixed contract). */
export interface TerritoryAssignmentWithdrawInput {
  territoryId: string;
  salespersonId: string;
  effectiveTo: string;
}

export function saveTerritoryAssignment(token: string, input: TerritoryAssignmentAssignInput) {
  return request<{ assignment: TerritoryAssignment }>(
    "/territory-assignments",
    { method: "PUT", body: JSON.stringify(input) },
    token
  );
}

export function withdrawTerritoryAssignment(token: string, input: TerritoryAssignmentWithdrawInput) {
  return request<{ assignment: TerritoryAssignment }>(
    "/territory-assignments",
    { method: "PUT", body: JSON.stringify(input) },
    token
  );
}

export function moveHospitalToTerritory(token: string, hospitalId: string, territoryId: string | null, note?: string) {
  return request<{ hospital: Hospital }>(
    `/hospitals/${hospitalId}/territory`,
    { method: "PATCH", body: JSON.stringify({ territoryId, note }) },
    token
  );
}

export function bulkMoveHospitalsByProvince(token: string, province: string, territoryId: string | null, note?: string) {
  return request<{ updatedCount: number }>(
    "/hospitals/territory/bulk-by-province",
    { method: "POST", body: JSON.stringify({ province, territoryId, note }) },
    token
  );
}

export function listUnassignedTerritoryHospitals(token: string) {
  return request<{ unassignedBucket: number; hospitalCount: number; hospitals: UnassignedTerritoryHospital[] }>(
    "/hospitals/unassigned-territory",
    { method: "GET" },
    token
  );
}

export function getDerivedTarget(token: string, salespersonId: string, year: number, month: number) {
  return request<{ derivedTarget: DerivedTarget }>(
    `/targets/derived/${salespersonId}/${year}/${month}`,
    { method: "GET" },
    token
  );
}

export function listTerritoryGroups(token: string) {
  return request<{ territoryGroups: TerritoryGroup[] }>("/territory-groups", { method: "GET" }, token);
}

export function createTerritoryGroup(token: string, input: { name: string; isActive?: boolean; note?: string | null }) {
  return request<{ territoryGroup: TerritoryGroup }>("/territory-groups", { method: "POST", body: JSON.stringify(input) }, token);
}

export function updateTerritoryGroup(token: string, id: string, input: { name?: string; isActive?: boolean; note?: string | null }) {
  return request<{ territoryGroup: TerritoryGroup }>(`/territory-groups/${id}`, { method: "PATCH", body: JSON.stringify(input) }, token);
}

export interface TerritoryGroupMemberInput {
  territoryId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export function addTerritoryGroupMember(token: string, groupId: string, input: TerritoryGroupMemberInput) {
  return request<{ member: TerritoryGroupMember }>(
    `/territory-groups/${groupId}/members`,
    { method: "POST", body: JSON.stringify(input) },
    token
  );
}

export function updateTerritoryGroupMember(
  token: string,
  groupId: string,
  memberId: string,
  input: Partial<Pick<TerritoryGroupMemberInput, "effectiveFrom" | "effectiveTo">>
) {
  return request<{ member: TerritoryGroupMember }>(
    `/territory-groups/${groupId}/members/${memberId}`,
    { method: "PATCH", body: JSON.stringify(input) },
    token
  );
}

export function getMyTerritoryView(
  token: string,
  salespersonId: string,
  period: PeriodKey,
  filters: { productTypeId?: string; creditOnly?: boolean } = {}
) {
  const params = new URLSearchParams(periodQueryParams(period));
  if (filters.productTypeId) params.set("productTypeId", filters.productTypeId);
  if (filters.creditOnly) params.set("creditOnly", "true");
  return request<MyTerritoryViewResponse>(`/my-territory-view/${salespersonId}?${params.toString()}`, { method: "GET" }, token);
}

export function getNeverSoldHospitals(
  token: string,
  salespersonId: string,
  period: PeriodKey,
  filters: {
    topN?: number;
    provinceMappingId?: string;
    potentialMetric?: string;
    productTypeId?: string;
  } = {}
) {
  const params = new URLSearchParams(periodQueryParams(period));
  if (filters.topN) params.set("topN", String(filters.topN));
  if (filters.provinceMappingId) params.set("provinceMappingId", filters.provinceMappingId);
  if (filters.potentialMetric) params.set("potentialMetric", filters.potentialMetric);
  if (filters.productTypeId) params.set("productTypeId", filters.productTypeId);
  return request<NeverSoldHospitalsResponse>(`/my-territory-view/${salespersonId}/never-sold?${params.toString()}`, { method: "GET" }, token);
}

export function exportMyTerritoryView(
  token: string,
  salespersonId: string,
  period: PeriodKey,
  filters: { productTypeId?: string; creditOnly?: boolean } = {}
) {
  const params = new URLSearchParams(periodQueryParams(period));
  if (filters.productTypeId) params.set("productTypeId", filters.productTypeId);
  if (filters.creditOnly) params.set("creditOnly", "true");
  return downloadFile(`/my-territory-view/${salespersonId}/export?${params.toString()}`, token);
}

export function exportNeverSoldHospitals(
  token: string,
  salespersonId: string,
  period: PeriodKey,
  filters: {
    topN?: number;
    provinceMappingId?: string;
    potentialMetric?: string;
    productTypeId?: string;
  } = {}
) {
  const params = new URLSearchParams(periodQueryParams(period));
  if (filters.topN) params.set("topN", String(filters.topN));
  if (filters.provinceMappingId) params.set("provinceMappingId", filters.provinceMappingId);
  if (filters.potentialMetric) params.set("potentialMetric", filters.potentialMetric);
  if (filters.productTypeId) params.set("productTypeId", filters.productTypeId);
  return downloadFile(`/my-territory-view/${salespersonId}/never-sold/export?${params.toString()}`, token);
}
