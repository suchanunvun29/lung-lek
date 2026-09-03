import { request } from "@/lib/api-client";
import { SalesLine } from "@/lib/types";

export interface SalesLinesFilter {
  salespersonId?: string;
  hospitalId?: string;
  productTypeId?: string;
  year?: number;
  month?: number;
  page?: number;
  pageSize?: number;
}

export interface SalesLinesResponse {
  data: SalesLine[];
  total: number;
  page: number;
  pageSize: number;
}

export function listSalesLines(token: string, filter: SalesLinesFilter) {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return request<SalesLinesResponse>(`/sales-lines${query ? `?${query}` : ""}`, { method: "GET" }, token);
}
