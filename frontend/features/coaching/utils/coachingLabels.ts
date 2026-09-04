import { InsightStatus } from "@/lib/types";

export const INSIGHT_STATUS_LABEL_TH: Record<InsightStatus, string> = {
  PENDING: "กำลังสร้าง",
  SUCCESS: "สร้างสำเร็จ",
  FAILED: "ใช้สรุปสำรอง",
};

export const INSIGHT_STATUS_BADGE_CLASS: Record<InsightStatus, string> = {
  PENDING: "bg-surface-subtle text-text-muted border border-border",
  SUCCESS: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-warning-subtle text-warning border border-warning/30",
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
