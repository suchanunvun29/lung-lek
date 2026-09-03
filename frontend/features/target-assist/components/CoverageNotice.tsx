import { BANGKOK_REGION_NAME } from "@/features/targets/utils/targetLabels";

export interface CoverageNoticeProps {
  /** Linked sales share of the area, already ×100 — null when there is no sales figure at all. */
  coveragePercent: number | null;
  /** Region name, so the Bangkok-specific wording can kick in (Territory & Potential Rules ข้อ 7). */
  regionName?: string;
}

const BANGKOK_NOT_COVERED_MESSAGE_TH =
  "ทะเบียนโรงพยาบาลที่ใช้ไม่ครอบคลุมกรุงเทพ จึงยังประเมินศักยภาพพื้นที่นี้ไม่ได้";
const ZERO_LINKED_SALES_MESSAGE_TH =
  "ยอดขายในพื้นที่นี้ยังไม่มีส่วนที่จับคู่ทะเบียนได้ จึงยังประเมินศักยภาพพื้นที่นี้ไม่ได้";

/** Territory & Potential Rules ข้อ 7 — every surface showing potential/penetration carries this
 *  notice; a bare 0 must never appear where this explanation belongs. */
export function CoverageNotice({ coveragePercent, regionName }: CoverageNoticeProps) {
  if (coveragePercent === null || coveragePercent === 0) {
    const message = regionName === BANGKOK_REGION_NAME ? BANGKOK_NOT_COVERED_MESSAGE_TH : ZERO_LINKED_SALES_MESSAGE_TH;
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {message}
      </p>
    );
  }

  return (
    <p className="text-sm text-zinc-600">
      คำนวณจากโรงพยาบาลที่จับคู่ทะเบียนได้{" "}
      {coveragePercent.toLocaleString("th-TH", { maximumFractionDigits: 1 })}% ของยอดขาย
    </p>
  );
}

export default CoverageNotice;
