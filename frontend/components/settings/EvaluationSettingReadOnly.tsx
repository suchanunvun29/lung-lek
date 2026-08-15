import { EvaluationSetting } from "@/lib/types";

interface EvaluationSettingReadOnlyProps {
  setting: EvaluationSetting;
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
      </dl>
    </div>
  );
}
