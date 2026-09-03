import { request } from "@/lib/api-client";
import {
  ImportBatch,
  PeriodDryRunResponse,
  PeriodImportConfirmedResponse,
  PeriodTouched,
} from "@/lib/types";

export interface ReplacePeriodImportInput {
  mode: "REPLACE_PERIOD";
  targetPeriods: PeriodTouched[];
  confirm: boolean;
}

export type UploadImportResponse =
  | { importBatch: ImportBatch }
  | PeriodDryRunResponse
  | PeriodImportConfirmedResponse;

export interface PeriodDeleteInput {
  targetPeriods: PeriodTouched[];
  confirm: boolean;
}

export type PeriodDeleteResponse = PeriodDryRunResponse | PeriodImportConfirmedResponse;

export function uploadImportFile(
  token: string,
  file: File,
  input?: ReplacePeriodImportInput
) {
  const formData = new FormData();
  formData.append("file", file);
  let path = "/import";
  if (input) {
    formData.append("mode", input.mode);
    formData.append("targetPeriods", JSON.stringify(input.targetPeriods));
    // The backend validates `confirm` from the query string (see import.routes.ts), not the body.
    path += `?confirm=${input.confirm}`;
  }
  return request<UploadImportResponse>(path, { method: "POST", body: formData }, token);
}

export function deleteImportPeriods(token: string, input: PeriodDeleteInput) {
  return request<PeriodDeleteResponse>(
    `/import/period-delete?confirm=${input.confirm}`,
    { method: "POST", body: JSON.stringify({ targetPeriods: input.targetPeriods }) },
    token
  );
}

export function listImportBatches(token: string) {
  return request<{ importBatches: ImportBatch[] }>("/import-batches", { method: "GET" }, token);
}

export function getImportBatch(token: string, id: string) {
  return request<{ importBatch: ImportBatch }>(`/import-batches/${id}`, { method: "GET" }, token);
}
