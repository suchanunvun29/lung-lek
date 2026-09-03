import { request } from "@/lib/api-client";
import {
  Target,
  TargetRevision,
  TargetScope,
} from "@/lib/types";

export interface UpsertTargetInput {
  revenueTarget: number;
  newCustomerTarget: number;
}

export interface ProductGroupTargetInput {
  productTypeId: string;
  revenueTarget: number;
}

export interface CopyTargetsInput {
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  overwrite?: boolean;
}

export interface CopyTargetsResult {
  sourceCount: number;
  created: string[];
  updated: string[];
  skipped: string[];
}

export function listTargets(token: string, year: number, scope: TargetScope = "SALESPERSON") {
  return request<{ targets: Target[] }>(`/targets?year=${year}&scope=${scope}`, { method: "GET" }, token);
}

export function upsertTarget(
  token: string,
  salespersonId: string,
  year: number,
  month: number,
  input: UpsertTargetInput
) {
  return request<{ target: Target }>(
    `/targets/${salespersonId}/${year}/${month}`,
    { method: "PUT", body: JSON.stringify(input) },
    token
  );
}

export function updateTargetProductGroups(
  token: string,
  targetId: string,
  productGroups: ProductGroupTargetInput[]
) {
  return request<{ target: Target }>(
    `/targets/${targetId}/product-groups`,
    { method: "PUT", body: JSON.stringify({ productGroups }) },
    token
  );
}

export const upsertProductGroupTargets = updateTargetProductGroups;

export function upsertTerritoryTarget(
  token: string,
  territoryId: string,
  year: number,
  month: number,
  input: UpsertTargetInput
) {
  return request<{ target: Target }>(
    `/targets/territory/${territoryId}/${year}/${month}`,
    { method: "PUT", body: JSON.stringify(input) },
    token
  );
}

export function upsertTerritoryGroupTarget(
  token: string,
  territoryGroupId: string,
  year: number,
  month: number,
  input: UpsertTargetInput
) {
  return request<{ target: Target }>(
    `/targets/group/${territoryGroupId}/${year}/${month}`,
    { method: "PUT", body: JSON.stringify(input) },
    token
  );
}

export function listTargetRevisions(token: string, targetId: string) {
  return request<{ revisions: TargetRevision[] }>(`/targets/${targetId}/revisions`, { method: "GET" }, token);
}

export function copyTargets(token: string, input: CopyTargetsInput) {
  return request<CopyTargetsResult>(
    "/targets/copy",
    { method: "POST", body: JSON.stringify(input) },
    token
  );
}
