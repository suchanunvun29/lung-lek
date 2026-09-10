import { ImportIssueLevel, ImportStatus } from "./types";

export const IMPORT_STATUS_LABEL_TH: Record<ImportStatus, string> = {
  PROCESSING: "กำลังประมวลผล",
  SUCCESS: "สำเร็จ",
  PARTIAL: "สำเร็จบางส่วน",
  FAILED: "ล้มเหลว",
};

export const IMPORT_ISSUE_LEVEL_LABEL_TH: Record<ImportIssueLevel, string> = {
  WARNING: "คำเตือน",
  ERROR: "ข้อผิดพลาด",
};

export const IMPORT_ISSUE_CODE_LABEL_TH: Record<string, string> = {
  AMOUNT_RECOMPUTED: "คำนวณยอดเงินใหม่",
  DATE_PERIOD_MISMATCH: "วันที่ไม่ตรงกับงวด",
  HEADER_NOT_FOUND: "ไม่พบหัวตารางที่จำเป็น",
  INVALID_DATE: "รูปแบบวันที่ไม่ถูกต้อง",
  INVALID_NUMBER: "รูปแบบตัวเลขไม่ถูกต้อง",
  MISSING_REQUIRED: "ข้อมูลที่จำเป็นไม่ครบ",
  NEGATIVE_AMOUNT: "พบยอดเงินติดลบ",
  NEW_HOSPITAL: "พบโรงพยาบาลใหม่",
  PERIOD_OUT_OF_SCOPE: "ข้อมูลงวดอยู่นอกขอบเขต",
  PRODUCT_TYPE_ALIAS_MISMATCH: "ชื่อกลุ่มสินค้าไม่ตรงกัน",
  SHARED_CREDIT_RULE_CREATED: "สร้างกฎแบ่งเครดิตดีลร่วมใหม่",
  SHEET_IGNORED: "ข้ามชีตที่ไม่ได้นำเข้า",
  TOTAL_MISMATCH: "ยอดรวมไม่ตรงกัน",
  UNKNOWN_SALESMAN_IN_SHARED_DEAL: "ไม่พบพนักงานขายในดีลร่วม",
  UNKNOWN_SALESMAN: "ไม่พบพนักงานขาย",
};

export function importIssueCodeLabelTh(code: string): string {
  return IMPORT_ISSUE_CODE_LABEL_TH[code] ?? "ปัญหาการนำเข้า";
}

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
