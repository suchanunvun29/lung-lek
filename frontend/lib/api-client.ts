import { PeriodKey } from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class RequestAbortedError extends Error {
  constructor(message = "Request was cancelled") {
    super(message);
    this.name = "RequestAbortedError";
  }
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof RequestAbortedError) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
}

export const GENERIC_ERROR_MESSAGE = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

export async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new ApiError(
        res.status,
        typeof data.error === "string" ? data.error : GENERIC_ERROR_MESSAGE
      );
    }

    return data as T;
  } catch (error) {
    if (isAbortError(error)) {
      throw new RequestAbortedError();
    }
    throw error;
  }
}

export async function downloadFile(
  path: string,
  token: string,
  signal?: AbortSignal
): Promise<void> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(
        res.status,
        typeof data.error === "string" ? data.error : GENERIC_ERROR_MESSAGE
      );
    }

    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="?([^";]+)"?/);
    const filename = match ? decodeURIComponent(match[1]) : "report.xlsx";

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    if (isAbortError(error)) {
      throw new RequestAbortedError();
    }
    throw error;
  }
}

export function periodQueryParams(period: PeriodKey): string {
  const params = new URLSearchParams({ periodType: period.periodType, year: String(period.year) });
  if (period.periodType !== "YEAR") params.set("periodNumber", String(period.periodNumber));
  return params.toString();
}

export const KNOWN_ERROR_TRANSLATIONS: Record<string, string> = {
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
  "Forbidden": "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้",
  "Not found": "ไม่พบข้อมูลหรือฟังก์ชันนี้ในระบบ",
  "File is required (field name: file)": "กรุณาเลือกไฟล์ก่อนอัปโหลด",
  "Only .xlsx files are supported": "รองรับเฉพาะไฟล์ .xlsx เท่านั้น",
  "Hospital not found": "ไม่พบโรงพยาบาลนี้",
  "This user is already linked to another salesperson": "บัญชีนี้ผูกกับพนักงานขายรายอื่นอยู่แล้ว",
  "Upload error: File too large": "ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 20MB)",
  "Target not found": "ไม่พบเป้าหมายนี้ในระบบ",
  "Import already in progress": "มีการนำเข้าข้อมูลอื่นกำลังดำเนินการอยู่ กรุณารอสักครู่แล้วลองใหม่",
};

export function getErrorMessage(error: unknown, fallback: string): string {
  if (isAbortError(error)) {
    return "";
  }
  if (error instanceof ApiError) {
    return KNOWN_ERROR_TRANSLATIONS[error.message] ?? error.message ?? fallback;
  }
  return fallback;
}

