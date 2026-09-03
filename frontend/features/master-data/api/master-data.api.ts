import { request } from "@/lib/api-client";
import { Hospital, Salesperson } from "@/lib/types";

export function listHospitals(token: string) {
  return request<{ hospitals: Hospital[] }>("/hospitals", { method: "GET" }, token);
}

export function updateHospital(token: string, id: number, isPreExistingCustomer: boolean) {
  return request<{ hospital: Hospital }>(
    `/hospitals/${id}`,
    { method: "PATCH", body: JSON.stringify({ isPreExistingCustomer }) },
    token
  );
}

export function listSalespeople(token: string) {
  return request<{ salespeople: Salesperson[] }>("/salespeople", { method: "GET" }, token);
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
