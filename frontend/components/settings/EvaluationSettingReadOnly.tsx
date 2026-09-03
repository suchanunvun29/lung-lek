import { EvaluationSetting } from "@/lib/types";
import { POTENTIAL_METRIC_LABEL_TH } from "@/lib/targetLabels";

interface EvaluationSettingReadOnlyProps {
  setting: EvaluationSetting;
}

function formatDecimal(value: string): string {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString("th-TH", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : value;
}

export default function EvaluationSettingReadOnly({ setting }: EvaluationSettingReadOnlyProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-zinc-700">ไม่สั่งเกินกี่เดือนถือว่า &quot;หายไป&quot;</dt>
          <dd className="font-medium text-zinc-900">{setting.churnMonths} เดือน</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-zinc-700">จำนวนเดือนขั้นต่ำก่อนคำนวณ Retention</dt>
          <dd className="font-medium text-zinc-900">{setting.minMonthsForChurn} เดือน</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-zinc-700">จำนวนเดือนขั้นต่ำก่อนคำนวณ Consistency</dt>
          <dd className="font-medium text-zinc-900">{setting.minMonthsForConsistency} เดือน</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-zinc-700">สรุปจุดแข็ง/จุดที่ควรพัฒนาด้วย AI</dt>
          <dd className="font-medium text-zinc-900">{setting.aiEnabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-zinc-700">ปิดบังชื่อก่อนส่งให้ AI</dt>
          <dd className="font-medium text-zinc-900">{setting.aiAnonymize ? "เปิดใช้งาน" : "ปิดใช้งาน"}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-zinc-700">ตัวชี้วัดศักยภาพที่ใช้จากทะเบียน</dt>
          <dd className="font-medium text-zinc-900">{POTENTIAL_METRIC_LABEL_TH[setting.potentialMetric]}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-zinc-700">coverage ขั้นต่ำของภาคก่อนใช้ศักยภาพกับเป้า</dt>
          <dd className="font-medium text-zinc-900">{formatDecimal(setting.minRegionCoverage)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-zinc-700">สัดส่วนฐานประวัติ α (1.000 = ประวัติล้วน)</dt>
          <dd className="font-medium text-zinc-900">{formatDecimal(setting.targetSuggestionAlpha)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-zinc-700">จำนวนเดือนย้อนหลังของฐานประวัติ</dt>
          <dd className="font-medium text-zinc-900">{setting.targetLookbackMonths} เดือน</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-zinc-700">สัดส่วนดีลที่ถือเป็น outlier ต่อใบกำกับ</dt>
          <dd className="font-medium text-zinc-900">{formatDecimal(setting.targetOutlierThreshold)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-zinc-700">อัตราเติบโตที่คูณเข้าฐานประวัติ</dt>
          <dd className="font-medium text-zinc-900">{formatDecimal(setting.targetGrowthRate)}</dd>
        </div>
      </dl>
    </div>
  );
}
