import { request } from "@/lib/api-client";
import { Hospital, Salesperson } from "@/lib/types";

export function listHospitals(token: string, signal?: AbortSignal) {
  return request<{ hospitals: Hospital[] }>("/hospitals", { method: "GET", signal }, token);
}

/** T-UX-025 — server pagination for the hospitals table; total counts after the q filter. */
export function listHospitalsPage(
  token: string,
  params: { page: number; pageSize: number; q?: string },
  signal?: AbortSignal
) {
  const search = new URLSearchParams();
  search.set("page", String(params.page));
  search.set("pageSize", String(params.pageSize));
  if (params.q && params.q.trim() !== "") search.set("q", params.q.trim());
  return request<{ items: Hospital[]; total: number; page: number; pageSize: number }>(
    `/hospitals?${search.toString()}`,
    { method: "GET", signal },
    token
  );
}

export function updateHospital(token: string, id: number, isPreExistingCustomer: boolean) {
  return request<{ hospital: Hospital }>(
    `/hospitals/${id}`,
    { method: "PATCH", body: JSON.stringify({ isPreExistingCustomer }) },
    token
  );
}

export function listSalespeople(token: string, signal?: AbortSignal) {
  return request<{ salespeople: Salesperson[] }>("/salespeople", { method: "GET", signal }, token);
}

export function updateSalesperson(
  token: string,
  id: number,
  input: { userId?: number | null; employmentEndedAt?: string | null }
) {
  return request<{ salesperson: Salesperson }>(
    `/salespeople/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
    token
  );
}
