import {
  AppUser,
  AuthUser,
  CoachingInsightGenerateResponse,
  CoachingInsightGetResponse,
  DrillDownMetric,
  EvaluationSetting,
  Hospital,
  ImportBatch,
  IndividualReportData,
  KpiDrillDownResponse,
  LeaderboardCriteria,
  LeaderboardResponse,
  PeriodKey,
  Salesperson,
  SalespersonKpiResponse,
  SalesLine,
  ScoringWeight,
  ScoringWeightRevision,
  ScoredKpiMetric,
  Target,
  TargetRevision,
  TeamKpiResponse,
  TeamOverviewData,
  UserRole,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const GENERIC_ERROR_MESSAGE = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, typeof data.error === "string" ? data.error : GENERIC_ERROR_MESSAGE);
  }

  return data as T;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export function login(email: string, password: string) {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function changePassword(token: string, currentPassword: string, newPassword: string) {
  return request<{ message: string }>(
    "/auth/change-password",
    { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) },
    token
  );
}

export function listUsers(token: string) {
  return request<{ users: AppUser[] }>("/users", { method: "GET" }, token);
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  role: UserRole;
  temporaryPassword?: string;
}

export function createUser(token: string, input: CreateUserInput) {
  return request<{ user: AppUser; temporaryPassword: string }>(
    "/users",
    { method: "POST", body: JSON.stringify(input) },
    token
  );
}

export interface UpdateUserInput {
  displayName?: string;
  role?: UserRole;
  isActive?: boolean;
  salespersonId?: string | null;
}

export function updateUser(token: string, id: string, input: UpdateUserInput) {
  return request<{ user: AppUser }>(
    `/users/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
    token
  );
}

export function resetUserPassword(token: string, id: string) {
  return request<{ message: string; temporaryPassword: string }>(
    `/users/${id}/reset-password`,
    { method: "POST", body: JSON.stringify({}) },
    token
  );
}

export function uploadImportFile(token: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request<{ importBatch: ImportBatch }>("/import", { method: "POST", body: formData }, token);
}

export function listImportBatches(token: string) {
  return request<{ importBatches: ImportBatch[] }>("/import-batches", { method: "GET" }, token);
}

export function getImportBatch(token: string, id: string) {
  return request<{ importBatch: ImportBatch }>(`/import-batches/${id}`, { method: "GET" }, token);
}

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

export function listProductTypes(token: string) {
  return request<{ productTypes: { id: string; name: string }[] }>(
    "/product-types",
    { method: "GET" },
    token
  );
}

export function listHospitals(token: string) {
  return request<{ hospitals: Hospital[] }>("/hospitals", { method: "GET" }, token);
}

export function updateHospital(token: string, id: string, isPreExistingCustomer: boolean) {
  return request<{ hospital: Hospital }>(
    `/hospitals/${id}`,
    { method: "PATCH", body: JSON.stringify({ isPreExistingCustomer }) },
    token
  );
}

export function listSalespeople(token: string) {
  return request<{ salespeople: Salesperson[] }>("/salespeople", { method: "GET" }, token);
}

export function updateSalesperson(token: string, id: string, userId: string | null) {
  return request<{ salesperson: Salesperson }>(
    `/salespeople/${id}`,
    { method: "PATCH", body: JSON.stringify({ userId }) },
    token
  );
}

export function listTargets(token: string, year: number) {
  return request<{ targets: Target[] }>(`/targets?year=${year}`, { method: "GET" }, token);
}

export interface UpsertTargetInput {
  revenueTarget: number;
  newCustomerTarget: number;
  note?: string | null;
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

export interface ProductGroupTargetInput {
  productTypeId: string;
  revenueTarget: number;
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

export function copyTargets(token: string, input: CopyTargetsInput) {
  return request<CopyTargetsResult>("/targets/copy", { method: "POST", body: JSON.stringify(input) }, token);
}

export function listTargetRevisions(token: string, targetId: string) {
  return request<{ revisions: TargetRevision[] }>(`/targets/${targetId}/revisions`, { method: "GET" }, token);
}

function periodQueryParams(period: PeriodKey): string {
  const params = new URLSearchParams({ periodType: period.periodType, year: String(period.year) });
  if (period.periodType !== "YEAR") params.set("periodNumber", String(period.periodNumber));
  return params.toString();
}

export function getSalespersonKpi(token: string, salespersonId: string, period: PeriodKey) {
  return request<SalespersonKpiResponse>(
    `/kpi/${salespersonId}?${periodQueryParams(period)}`,
    { method: "GET" },
    token
  );
}

export function getTeamKpi(token: string, period: PeriodKey) {
  return request<TeamKpiResponse>(`/kpi/team?${periodQueryParams(period)}`, { method: "GET" }, token);
}

export function getKpiDrillDown(
  token: string,
  salespersonId: string,
  metric: DrillDownMetric,
  period: PeriodKey,
  hospitalId?: string
) {
  const params = new URLSearchParams(periodQueryParams(period));
  if (hospitalId) params.set("hospitalId", hospitalId);
  return request<KpiDrillDownResponse>(
    `/kpi/${salespersonId}/drill-down/${metric}?${params.toString()}`,
    { method: "GET" },
    token
  );
}

export function getScoringWeights(token: string) {
  return request<{ weights: ScoringWeight[]; revisions: ScoringWeightRevision[] }>(
    "/settings/scoring-weights",
    { method: "GET" },
    token
  );
}

export interface ScoringWeightInput {
  metric: ScoredKpiMetric;
  weight: number;
}

export function updateScoringWeights(token: string, weights: ScoringWeightInput[], note?: string | null) {
  return request<{ weights: ScoringWeight[] }>(
    "/settings/scoring-weights",
    { method: "PUT", body: JSON.stringify({ weights, note: note ?? undefined }) },
    token
  );
}

export function getEvaluationSetting(token: string) {
  return request<{ setting: EvaluationSetting }>("/settings/evaluation", { method: "GET" }, token);
}

export interface EvaluationSettingUpdateInput {
  churnMonths?: number;
  minMonthsForChurn?: number;
  minMonthsForConsistency?: number;
  aiEnabled?: boolean;
  aiAnonymize?: boolean;
}

export function updateEvaluationSetting(token: string, input: EvaluationSettingUpdateInput) {
  return request<{ setting: EvaluationSetting }>(
    "/settings/evaluation",
    { method: "PATCH", body: JSON.stringify(input) },
    token
  );
}

export function getLeaderboard(token: string, criteria: LeaderboardCriteria, period: PeriodKey) {
  const params = new URLSearchParams(periodQueryParams(period));
  params.set("criteria", criteria);
  return request<LeaderboardResponse>(`/leaderboard?${params.toString()}`, { method: "GET" }, token);
}

export function getCoachingInsight(token: string, salespersonId: string, period: PeriodKey) {
  return request<CoachingInsightGetResponse>(
    `/coaching-insights/${salespersonId}?${periodQueryParams(period)}`,
    { method: "GET" },
    token
  );
}

export function generateCoachingInsight(token: string, salespersonId: string, period: PeriodKey) {
  return request<CoachingInsightGenerateResponse>(
    `/coaching-insights/${salespersonId}/generate`,
    { method: "POST", body: JSON.stringify(period) },
    token
  );
}

export function getIndividualReport(token: string, salespersonId: string, period: PeriodKey) {
  return request<IndividualReportData>(
    `/reports/individual/${salespersonId}?${periodQueryParams(period)}`,
    { method: "GET" },
    token
  );
}

export function getTeamOverviewReport(token: string, period: PeriodKey) {
  return request<TeamOverviewData>(`/reports/team-overview?${periodQueryParams(period)}`, { method: "GET" }, token);
}

const DEFAULT_XLSX_FILE_NAME = "report.xlsx";
const CONTENT_DISPOSITION_FILENAME_PATTERN = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i;

// The /export endpoints stream back a real .xlsx file (see report.controller.ts's
// Content-Disposition header), not JSON — so this bypasses `request()` and triggers a real
// browser download instead of trying to parse the response body as JSON.
async function downloadFile(path: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, typeof data.error === "string" ? data.error : GENERIC_ERROR_MESSAGE);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(CONTENT_DISPOSITION_FILENAME_PATTERN);
  const fileName = match ? decodeURIComponent(match[1]) : DEFAULT_XLSX_FILE_NAME;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportIndividualReport(token: string, salespersonId: string, period: PeriodKey) {
  return downloadFile(`/reports/individual/${salespersonId}/export?${periodQueryParams(period)}`, token);
}

export function exportTeamOverviewReport(token: string, period: PeriodKey) {
  return downloadFile(`/reports/team-overview/export?${periodQueryParams(period)}`, token);
}

const KNOWN_ERROR_TRANSLATIONS: Record<string, string> = {
  "Invalid email or password": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "Current password is incorrect": "รหัสผ่านปัจจุบันไม่ถูกต้อง",
  "A user with this email already exists": "มีอีเมลนี้ในระบบอยู่แล้ว",
  "User not found": "ไม่พบผู้ใช้นี้ในระบบ",
  "Salesperson not found": "ไม่พบพนักงานขายรายนี้",
  "This salesperson is already linked to another user": "พนักงานขายรายนี้ผูกกับบัญชีอื่นอยู่แล้ว",
  "Missing or invalid Authorization header": "กรุณาเข้าสู่ระบบใหม่อีกครั้ง",
  "Invalid or expired token": "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง",
  "User not found or inactive": "บัญชีนี้ถูกปิดใช้งานหรือไม่พบในระบบ",
  "Forbidden: insufficient role": "คุณไม่มีสิทธิ์ทำรายการนี้",
  "File is required (field name: file)": "กรุณาเลือกไฟล์ก่อนอัปโหลด",
  "Only .xlsx files are supported": "รองรับเฉพาะไฟล์ .xlsx เท่านั้น",
  "Hospital not found": "ไม่พบโรงพยาบาลนี้",
  "This user is already linked to another salesperson": "บัญชีนี้ผูกกับพนักงานขายรายอื่นอยู่แล้ว",
  "Upload error: File too large": "ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 20MB)",
  "Target not found": "ไม่พบเป้าหมายนี้ในระบบ",
};

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return KNOWN_ERROR_TRANSLATIONS[error.message] ?? error.message ?? fallback;
  }
  return fallback;
}
