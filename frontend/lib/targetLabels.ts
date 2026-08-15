import { TargetChangeType } from "./types";

export const TARGET_CHANGE_TYPE_LABEL_TH: Record<TargetChangeType, string> = {
  CREATE: "สร้างใหม่",
  UPDATE: "แก้ไข",
  DELETE: "ลบ",
};

export const TARGET_CHANGE_TYPE_BADGE_CLASS: Record<TargetChangeType, string> = {
  CREATE: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
};

export function formatTargetMoney(value: number | string): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(numeric)) return String(value);
  return numeric.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
