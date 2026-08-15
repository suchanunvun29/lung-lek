"use client";

import { useState } from "react";
import { EvaluationSettingUpdateInput } from "@/lib/api";
import { EvaluationSetting } from "@/lib/types";

interface EvaluationSettingFormProps {
  setting: EvaluationSetting;
  onSubmit: (input: EvaluationSettingUpdateInput) => Promise<void>;
}

export default function EvaluationSettingForm({ setting, onSubmit }: EvaluationSettingFormProps) {
  const [churnMonths, setChurnMonths] = useState(setting.churnMonths);
  const [minMonthsForChurn, setMinMonthsForChurn] = useState(setting.minMonthsForChurn);
  const [minMonthsForConsistency, setMinMonthsForConsistency] = useState(setting.minMonthsForConsistency);
  const [aiEnabled, setAiEnabled] = useState(setting.aiEnabled);
  const [aiAnonymize, setAiAnonymize] = useState(setting.aiAnonymize);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ churnMonths, minMonthsForChurn, minMonthsForConsistency, aiEnabled, aiAnonymize });
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="space-y-4">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-zinc-700">
            ไม่สั่งเกินกี่เดือนถือว่า &quot;หายไป&quot; (churnMonths)
          </span>
          <input
            type="number"
            min={1}
            value={churnMonths}
            onChange={(e) => setChurnMonths(Number(e.target.value))}
            className="w-20 rounded-md border border-zinc-300 px-2 py-1.5 text-right"
          />
        </label>

        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-zinc-700">จำนวนเดือนขั้นต่ำก่อนคำนวณ Retention (minMonthsForChurn)</span>
          <input
            type="number"
            min={1}
            value={minMonthsForChurn}
            onChange={(e) => setMinMonthsForChurn(Number(e.target.value))}
            className="w-20 rounded-md border border-zinc-300 px-2 py-1.5 text-right"
          />
        </label>

        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-zinc-700">จำนวนเดือนขั้นต่ำก่อนคำนวณ Consistency (minMonthsForConsistency)</span>
          <input
            type="number"
            min={1}
            value={minMonthsForConsistency}
            onChange={(e) => setMinMonthsForConsistency(Number(e.target.value))}
            className="w-20 rounded-md border border-zinc-300 px-2 py-1.5 text-right"
          />
        </label>

        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-zinc-700">เปิดใช้งานสรุปจุดแข็ง/จุดที่ควรพัฒนาด้วย AI (aiEnabled)</span>
          <input
            type="checkbox"
            checked={aiEnabled}
            onChange={(e) => setAiEnabled(e.target.checked)}
            className="h-5 w-5"
          />
        </label>

        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-zinc-700">ปิดบังชื่อพนักงานขาย/โรงพยาบาลก่อนส่งให้ AI (aiAnonymize)</span>
          <input
            type="checkbox"
            checked={aiAnonymize}
            onChange={(e) => setAiAnonymize(e.target.checked)}
            className="h-5 w-5"
          />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {submitting ? "กำลังบันทึก..." : "บันทึกค่าคงที่ของการประเมิน"}
      </button>
    </form>
  );
}
