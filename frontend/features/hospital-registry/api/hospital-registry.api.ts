import { request } from "@/lib/api-client";
import {
  HospitalRegistry,
  HospitalRegistryLink,
  ImportBatch,
  ProvinceMapping,
  Region,
  RegistryLinkStatus,
} from "@/lib/types";

export function uploadHospitalRegistryFile(token: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request<{ importBatch: ImportBatch; links: { linked: number; unreviewed: number } }>(
    "/registry-import",
    { method: "POST", body: formData },
    token
  );
}

export function listProvinces(token: string) {
  return request<{ provinces: ProvinceMapping[]; regions: Region[] }>("/provinces", { method: "GET" }, token);
}

export function updateProvince(token: string, id: string, input: { canonicalName?: string; regionId?: string }) {
  return request<{ province: ProvinceMapping }>(`/provinces/${id}`, { method: "PATCH", body: JSON.stringify(input) }, token);
}

export function listHospitalRegistryLinks(token: string, status?: RegistryLinkStatus) {
  const query = status ? `?status=${status}` : "";
  return request<{ hospitalRegistryLinks: HospitalRegistryLink[] }>(`/hospital-registry-links${query}`, { method: "GET" }, token);
}

export function updateHospitalRegistryLink(
  token: string,
  hospitalId: string,
  input: { status: Exclude<RegistryLinkStatus, "UNREVIEWED">; hospitalRegistryId?: string | null; note?: string | null }
) {
  return request<{ hospitalRegistryLink: HospitalRegistryLink }>(
    `/hospital-registry-links/${hospitalId}`,
    { method: "PATCH", body: JSON.stringify(input) },
    token
  );
}

export function listHospitalRegistries(
  token: string,
  filter: { q?: string; provinceMappingId?: string; territoryId?: string; page?: number; pageSize?: number } = {}
) {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => value !== undefined && params.set(key, String(value)));
  const query = params.toString();
  return request<{ hospitalRegistries: HospitalRegistry[]; total: number; page: number; pageSize: number }>(
    `/hospital-registries${query ? `?${query}` : ""}`,
    { method: "GET" },
    token
  );
}

export function updatePotentialAdjustment(token: string, id: number, potentialAdjustment: number) {
  return request<{ hospitalRegistry: { id: number; displayName: string; tier: string | null; potentialAdjustment: string; updatedAt: string } }>(
    `/hospital-registry/${id}/potential-adjustment`,
    { method: "PATCH", body: JSON.stringify({ potentialAdjustment }) },
    token
  );
}
