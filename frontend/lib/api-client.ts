import { PeriodKey } from "./types";
import { useAuthStore } from "@/store/useAuthStore";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  code?: string;

  constructor(status: number, message: string, details?: unknown, code?: string) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
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

// ── Session expiry handling (401 / MUST_CHANGE_PASSWORD) ────────────────────
// Lives at module level so both request() and downloadFile() share one guard.

/** Login page reads this to show "เซสชันหมดอายุ..." once after the redirect. */
export const SESSION_EXPIRED_STORAGE_KEY = "session-expired";

// Pages that manage their own auth state — never redirect away from them.
const AUTH_PAGES = ["/login", "/change-password"];
// Requests made by those pages (login itself 401s on a wrong password) must
// never be treated as an expired session.
const AUTH_API_PATHS = ["/auth/login", "/auth/change-password"];

let isRedirectingToAuthPage = false;

function isOnAuthPage(): boolean {
  const path = window.location.pathname;
  return AUTH_PAGES.some((page) => path === page || path.startsWith(`${page}/`));
}

function isAuthApiRequest(path: string): boolean {
  const barePath = path.split("?")[0];
  return AUTH_API_PATHS.some((apiPath) => barePath === apiPath);
}

function redirectToAuthPage(url: string): void {
  // Multiple requests can fail with 401 in the same tick — navigate once.
  // A full navigation also rebuilds this module, which resets the guard.
  if (isRedirectingToAuthPage) return;
  isRedirectingToAuthPage = true;
  window.location.assign(url);
}

// Side effect only — the caller still throws the ApiError so page-level catch
// blocks keep working while the navigation is under way.
function handleSessionFailure(status: number, code?: string): void {
  if (typeof window === "undefined" || isRedirectingToAuthPage) return;
  if (isOnAuthPage()) return;

  if (code === "MUST_CHANGE_PASSWORD") {
    // If the client already believes the password was changed, this 403 means
    // the server disagrees — redirecting would fight the /change-password page
    // (which bounces back to the app) and loop. Let the error surface instead.
    if (useAuthStore.getState().user?.mustChangePassword !== false) {
      redirectToAuthPage("/change-password");
    }
    return;
  }

  if (status === 401) {
    useAuthStore.getState().logout();
    try {
      window.sessionStorage.setItem(SESSION_EXPIRED_STORAGE_KEY, "1");
    } catch {
      // storage unavailable — login still works, just without the banner
    }
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    redirectToAuthPage(`/login?next=${next}`);
  }
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
      const code = typeof data.code === "string" ? data.code : undefined;
      if (!isAuthApiRequest(path)) {
        handleSessionFailure(res.status, code);
      }
      throw new ApiError(
        res.status,
        typeof data.error === "string" ? data.error : GENERIC_ERROR_MESSAGE,
        data.details,
        code
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
      const code = typeof data.code === "string" ? data.code : undefined;
      handleSessionFailure(res.status, code);
      throw new ApiError(
        res.status,
        typeof data.error === "string" ? data.error : GENERIC_ERROR_MESSAGE,
        data.details,
        code
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
  "Validation failed": "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
  "Internal server error": "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง",
};

const THAI_CHARACTERS = /[\u0E00-\u0E7F]/;

// Backend details are the human-readable part of validation errors ("revenueTarget
// must be…") — surface them when they carry readable text, ignore opaque shapes.
function extractErrorDetails(details: unknown): string | null {
  if (typeof details === "string") {
    const trimmed = details.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(details)) {
    const parts = details
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim());
    return parts.length > 0 ? parts.join(" ") : null;
  }
  return null;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (isAbortError(error)) {
    return "";
  }
  if (!(error instanceof ApiError)) {
    return fallback;
  }

  // "Validation failed" says nothing on its own — it is only useful together
  // with the per-field details, so show those when present.
  if (error.message === "Validation failed") {
    const details = extractErrorDetails(error.details);
    return details ? `ข้อมูลไม่ถูกต้อง: ${details}` : KNOWN_ERROR_TRANSLATIONS["Validation failed"];
  }

  const translated = KNOWN_ERROR_TRANSLATIONS[error.message];
  if (translated) {
    return translated;
  }

  const details = extractErrorDetails(error.details);
  if (details) {
    return details;
  }

  // Business-rule messages written in Thai by the backend pass through as-is;
  // anything else (raw English outside the whitelist) falls back to Thai.
  if (error.message && THAI_CHARACTERS.test(error.message)) {
    return error.message;
  }

  return fallback;
}

