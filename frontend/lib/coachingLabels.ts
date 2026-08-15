import { InsightStatus } from "./types";

export const INSIGHT_STATUS_LABEL_TH: Record<InsightStatus, string> = {
  PENDING: "กำลังสร้าง",
  SUCCESS: "สร้างสำเร็จ",
  FAILED: "ใช้สรุปสำรอง",
};

export const INSIGHT_STATUS_BADGE_CLASS: Record<InsightStatus, string> = {
  PENDING: "bg-zinc-200 text-zinc-700",
  SUCCESS: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-amber-100 text-amber-700",
};

export function providerLabelTh(provider: string | null): string {
  if (provider === "gemini") return "Gemini AI";
  if (provider === "rule-based") return "สรุปอัตโนมัติจากกฎ (ไม่ผ่าน AI)";
  return "-";
}

export function formatDateTimeTh(value: string): string {
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
