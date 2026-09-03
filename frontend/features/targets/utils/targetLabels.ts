import { PotentialMetricKey, SuggestionMode, TargetChangeType } from "@/lib/types";

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

export const POTENTIAL_METRIC_LABEL_TH: Record<PotentialMetricKey, string> = {
  BEDS: "จำนวนเตียง",
  CMI: "CMI",
  SUM_ADJ_RW: "SumAdjRW",
  OCCUPANCY_RATE: "อัตราครองเตียง",
  PATIENTS: "จำนวนผู้ป่วย",
  VISITS: "จำนวนครั้งรับบริการ",
};

export const SUGGESTION_MODE_LABEL_TH: Record<SuggestionMode, string> = {
  SUGGEST: "SUGGEST — เสนอเป้าตั้งต้น (R = Σ historyBased ของภาค)",
  REBALANCE: "REBALANCE — เกลี่ยเป้าที่ตั้งไว้แล้ว (R = Σ เป้าเดิม snapshot)",
};

/** The seed's exact Region.name for Bangkok — the registry structurally never covers it (design.md Territory & Potential Rules ข้อ 7). */
export const BANGKOK_REGION_NAME = "กทม.";

export function formatTargetMoney(value: number | string): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(numeric)) return String(value);
  return numeric.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Fraction (0–1) → Thai percent with up to 1 decimal; null/undefined → "—" instead of a bare 0. */
export function formatRatioPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const percent = value * 100;
  if (!Number.isFinite(percent)) return "—";
  return `${percent.toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`;
}
