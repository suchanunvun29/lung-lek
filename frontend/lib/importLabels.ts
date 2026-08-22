import { ImportIssueLevel, ImportStatus } from "./types";

export const IMPORT_STATUS_LABEL_TH: Record<ImportStatus, string> = {
  PROCESSING: "กำลังประมวลผล",
  SUCCESS: "สำเร็จ",
  PARTIAL: "สำเร็จบางส่วน",
  FAILED: "ล้มเหลว",
};

export const IMPORT_STATUS_BADGE_CLASS: Record<ImportStatus, string> = {
  PROCESSING: "bg-zinc-200 text-zinc-700",
  SUCCESS: "bg-emerald-100 text-emerald-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  FAILED: "bg-red-100 text-red-700",
};

export const IMPORT_ISSUE_LEVEL_LABEL_TH: Record<ImportIssueLevel, string> = {
  WARNING: "คำเตือน",
  ERROR: "ข้อผิดพลาด",
};

export const IMPORT_ISSUE_LEVEL_BADGE_CLASS: Record<ImportIssueLevel, string> = {
  WARNING: "bg-amber-100 text-amber-700",
  ERROR: "bg-red-100 text-red-700",
};

export function formatFileSize(bytes: number): string {
  const KILOBYTE = 1024;
  const MEGABYTE = KILOBYTE * 1024;
  if (bytes >= MEGABYTE) return `${(bytes / MEGABYTE).toFixed(2)} MB`;
  if (bytes >= KILOBYTE) return `${(bytes / KILOBYTE).toFixed(1)} KB`;
  return `${bytes} bytes`;
}

const THAI_MONTH_NAMES = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

export function formatThaiMonth(month: number): string {
  return THAI_MONTH_NAMES[month - 1] ?? String(month);
}

export function formatMoney(value: string | number): string {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value);
  return numeric.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
