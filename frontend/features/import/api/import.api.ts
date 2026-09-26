import { request } from "@/lib/api-client";
import {
  AppendDryRunResponse,
  ImportBatch,
  PeriodDryRunResponse,
  PeriodImportConfirmedResponse,
  PeriodTouched,
  SalesmanDecisionInput,
  SalesmanDryRunResult,
} from "@/lib/types";

export interface ReplacePeriodImportInput {
  mode: "REPLACE_PERIOD";
  targetPeriods: PeriodTouched[];
  confirm: boolean;
}

/**
 * T-UX-027 — APPEND also takes confirm now: confirm=false returns a dry-run preview,
 * confirm=true commits. The confirm step re-uploads the same file (stateless, per task
 * direction) so the preview and the commit see identical data.
 */
export interface AppendImportInput {
  mode: "APPEND";
  confirm: boolean;
}

export type UploadImportInput = ReplacePeriodImportInput | AppendImportInput;

export type UploadImportResponse =
  | { importBatch: ImportBatch }
  | PeriodDryRunResponse
  | PeriodImportConfirmedResponse
  | AppendDryRunResponse;

export interface PeriodDeleteInput {
  targetPeriods: PeriodTouched[];
  confirm: boolean;
}

export type PeriodDeleteResponse = PeriodDryRunResponse | PeriodImportConfirmedResponse;

export function dryRunSalesmanVerification(token: string, file: File, signal?: AbortSignal) {
  const formData = new FormData();
  formData.append("file", file);
  return request<SalesmanDryRunResult>("/import/dry-run", { method: "POST", body: formData, signal }, token);
}

export function uploadImportFile(
  token: string,
  file: File,
  input: UploadImportInput = { mode: "APPEND", confirm: true },
  salesmanDecisions?: SalesmanDecisionInput[]
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", input.mode);
  if (input.mode === "REPLACE_PERIOD") {
    formData.append("targetPeriods", JSON.stringify(input.targetPeriods));
  }
  if (salesmanDecisions && salesmanDecisions.length > 0) {
    formData.append("salesmanDecisions", JSON.stringify(salesmanDecisions));
  }
  // The backend validates `confirm` from the query string (see import.routes.ts), not the body.
  return request<UploadImportResponse>(`/import?confirm=${input.confirm}`, { method: "POST", body: formData }, token);
}

export function deleteImportPeriods(token: string, input: PeriodDeleteInput) {
  return request<PeriodDeleteResponse>(
    `/import/period-delete?confirm=${input.confirm}`,
    { method: "POST", body: JSON.stringify({ targetPeriods: input.targetPeriods }) },
    token
  );
}

export function listImportBatches(token: string, signal?: AbortSignal) {
  return request<{ importBatches: ImportBatch[] }>("/import-batches", { method: "GET", signal }, token);
}

/** T-UX-025 — server pagination; total counts after the status/q filters. */
export function listImportBatchesPage(
  token: string,
  params: { page: number; pageSize: number; status?: string; q?: string },
  signal?: AbortSignal
) {
  const search = new URLSearchParams();
  search.set("page", String(params.page));
  search.set("pageSize", String(params.pageSize));
  if (params.status && params.status !== "ALL") search.set("status", params.status);
  if (params.q && params.q.trim() !== "") search.set("q", params.q.trim());
  return request<{ items: ImportBatch[]; total: number; page: number; pageSize: number }>(
    `/import-batches?${search.toString()}`,
    { method: "GET", signal },
    token
  );
}

export function getImportBatch(token: string, id: string, signal?: AbortSignal) {
  return request<{ importBatch: ImportBatch }>(`/import-batches/${id}`, { method: "GET", signal }, token);
}
