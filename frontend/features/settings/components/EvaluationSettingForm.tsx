"use client";

import { useState } from "react";
import { EvaluationSettingUpdateInput } from "@/features/settings/api/settings.api";
import { EvaluationSetting, PotentialMetricKey } from "@/lib/types";
import { POTENTIAL_METRIC_LABEL_TH } from "@/lib/targetLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

export interface EvaluationSettingFormProps {
  setting: EvaluationSetting;
  onSubmit: (input: EvaluationSettingUpdateInput) => Promise<void>;
}

const POTENTIAL_METRIC_KEYS = Object.keys(POTENTIAL_METRIC_LABEL_TH) as PotentialMetricKey[];

export function EvaluationSettingForm({ setting, onSubmit }: EvaluationSettingFormProps) {
  const [churnMonths, setChurnMonths] = useState(setting.churnMonths);
  const [minMonthsForChurn, setMinMonthsForChurn] = useState(setting.minMonthsForChurn);
  const [minMonthsForConsistency, setMinMonthsForConsistency] = useState(setting.minMonthsForConsistency);
  const [aiEnabled, setAiEnabled] = useState(setting.aiEnabled);
  const [aiAnonymize, setAiAnonymize] = useState(setting.aiAnonymize);
  const [potentialMetric, setPotentialMetric] = useState<PotentialMetricKey>(setting.potentialMetric);
  const [minRegionCoverage, setMinRegionCoverage] = useState(Number(setting.minRegionCoverage));
  const [targetSuggestionAlpha, setTargetSuggestionAlpha] = useState(Number(setting.targetSuggestionAlpha));
  const [targetLookbackMonths, setTargetLookbackMonths] = useState(setting.targetLookbackMonths);
  const [targetOutlierThreshold, setTargetOutlierThreshold] = useState(Number(setting.targetOutlierThreshold));
  const [targetGrowthRate, setTargetGrowthRate] = useState(Number(setting.targetGrowthRate));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      minRegionCoverage < 0 ||
      minRegionCoverage > 1 ||
      targetSuggestionAlpha < 0 ||
      targetSuggestionAlpha > 1 ||
      targetLookbackMonths < 1 ||
      targetOutlierThreshold <= 0 ||
      targetOutlierThreshold > 1 ||
      targetGrowthRate < 0
    ) {
      setError("ค่าที่กรอกอยู่นอกช่วงที่กำหนด กรุณาตรวจสอบอีกครั้ง");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        churnMonths,
        minMonthsForChurn,
        minMonthsForConsistency,
        aiEnabled,
        aiAnonymize,
        potentialMetric,
        minRegionCoverage,
        targetSuggestionAlpha,
        targetLookbackMonths,
        targetOutlierThreshold,
        targetGrowthRate,
      });
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-700">
              ไม่สั่งเกินกี่เดือนถือว่า &quot;หายไป&quot; (churnMonths)
            </span>
            <Input
              type="number"
              min={1}
              value={churnMonths}
              onChange={(e) => setChurnMonths(Number(e.target.value))}
              className="w-20 text-right"
            />
          </label>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-700">จำนวนเดือนขั้นต่ำก่อนคำนวณ Retention (minMonthsForChurn)</span>
            <Input
              type="number"
              min={1}
              value={minMonthsForChurn}
              onChange={(e) => setMinMonthsForChurn(Number(e.target.value))}
              className="w-20 text-right"
            />
          </label>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-700">จำนวนเดือนขั้นต่ำก่อนคำนวณ Consistency (minMonthsForConsistency)</span>
            <Input
              type="number"
              min={1}
              value={minMonthsForConsistency}
              onChange={(e) => setMinMonthsForConsistency(Number(e.target.value))}
              className="w-20 text-right"
            />
          </label>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-700">เปิดใช้งานสรุปจุดแข็ง/จุดที่ควรพัฒนาด้วย AI (aiEnabled)</span>
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
              className="h-5 w-5 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-700">ปิดบังชื่อพนักงานขาย/โรงพยาบาลก่อนส่งให้ AI (aiAnonymize)</span>
            <input
              type="checkbox"
              checked={aiAnonymize}
              onChange={(e) => setAiAnonymize(e.target.checked)}
              className="h-5 w-5 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-700">ตัวชี้วัดศักยภาพที่ใช้จากทะเบียน (potentialMetric)</span>
            <Select
              value={potentialMetric}
              onChange={(e) => setPotentialMetric(e.target.value as PotentialMetricKey)}
              className="w-auto"
            >
              {POTENTIAL_METRIC_KEYS.map((key) => (
                <option key={key} value={key}>
                  {POTENTIAL_METRIC_LABEL_TH[key]}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-700">
              coverage ขั้นต่ำของภาคก่อนใช้ศักยภาพกับเป้า 0–1 (minRegionCoverage)
            </span>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={minRegionCoverage}
              onChange={(e) => setMinRegionCoverage(Number(e.target.value))}
              className="w-20 text-right"
            />
          </label>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-700">
              สัดส่วนฐานประวัติ α — 1.000 = เสนอจากประวัติล้วน (targetSuggestionAlpha)
            </span>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.001}
              value={targetSuggestionAlpha}
              onChange={(e) => setTargetSuggestionAlpha(Number(e.target.value))}
              className="w-20 text-right"
            />
          </label>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-700">
              จำนวนเดือนย้อนหลังของฐานประวัติในตัวช่วยตั้งเป้า (targetLookbackMonths)
            </span>
            <Input
              type="number"
              min={1}
              value={targetLookbackMonths}
              onChange={(e) => setTargetLookbackMonths(Number(e.target.value))}
              className="w-20 text-right"
            />
          </label>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-700">
              สัดส่วนดีลต่อใบกำกับที่เกินกว่าถือเป็น outlier 0–1 (targetOutlierThreshold)
            </span>
            <Input
              type="number"
              min={0.001}
              max={1}
              step={0.01}
              value={targetOutlierThreshold}
              onChange={(e) => setTargetOutlierThreshold(Number(e.target.value))}
              className="w-20 text-right"
            />
          </label>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-700">
              อัตราเติบโตที่คูณเข้าฐานประวัติ — 1.000 = ไม่บวกเติบโต (targetGrowthRate)
            </span>
            <Input
              type="number"
              min={0}
              step={0.001}
              value={targetGrowthRate}
              onChange={(e) => setTargetGrowthRate(Number(e.target.value))}
              className="w-20 text-right"
            />
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <Button
          type="submit"
          disabled={submitting}
          className="mt-4 bg-zinc-900 text-white hover:bg-zinc-800"
        >
          {submitting ? "กำลังบันทึก..." : "บันทึกค่าคงที่ของการประเมิน"}
        </Button>
      </form>
    </Card>
  );
}

export default EvaluationSettingForm;
