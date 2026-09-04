"use client";

import { useState } from "react";
import { EvaluationSettingUpdateInput } from "@/features/settings/api/settings.api";
import { EvaluationSetting, PotentialMetricKey } from "@/lib/types";
import { POTENTIAL_METRIC_LABEL_TH } from "@/lib/targetLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/shared/form/FormField";
import { Alert } from "@/components/ui/alert";
import { AlertCircle, BarChart3, Bot, Compass, Target } from "lucide-react";

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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* กลุ่มที่ 1: การประเมินผล (Evaluation Criteria Thresholds) */}
      <Card className="p-5">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3 mb-4">
          <BarChart3 size={18} className="text-[var(--primary)]" />
          <h2 className="font-semibold text-base text-[var(--text-primary)]">
            การประเมิน
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="เกณฑ์ตัดสินลูกค้าหยุดสั่งซื้อ (churnMonths)"
            hint="กำหนดจำนวนเดือนที่ไม่มีการสั่งซื้อต่อเนื่อง ก่อนระบบจะนับว่าลูกค้าหลุดมือ (กระทบเกณฑ์ Retention)"
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={churnMonths}
                onChange={(e) => setChurnMonths(Number(e.target.value))}
                className="w-28 text-right font-medium tabular-nums h-11 sm:h-9"
              />
              <span className="text-sm text-[var(--text-secondary)]">เดือน</span>
            </div>
          </FormField>

          <FormField
            label="ข้อมูลย้อนหลังขั้นต่ำสำหรับ Retention (minMonthsForChurn)"
            hint="ต้องมีข้อมูลย้อนหลังอย่างน้อยตามจำนวนเดือนนี้ มิฉะนั้นเกณฑ์ Retention จะคำนวณไม่ได้ (Non-computable)"
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={minMonthsForChurn}
                onChange={(e) => setMinMonthsForChurn(Number(e.target.value))}
                className="w-28 text-right font-medium tabular-nums h-11 sm:h-9"
              />
              <span className="text-sm text-[var(--text-secondary)]">เดือน</span>
            </div>
          </FormField>

          <FormField
            label="ข้อมูลย้อนหลังขั้นต่ำสำหรับ Consistency (minMonthsForConsistency)"
            hint="ต้องมีข้อมูลย้อนหลังอย่างน้อยตามจำนวนเดือนนี้ มิฉะนั้นเกณฑ์ Consistency จะคำนวณไม่ได้ (Non-computable)"
            className="md:col-span-2"
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={minMonthsForConsistency}
                onChange={(e) => setMinMonthsForConsistency(Number(e.target.value))}
                className="w-28 text-right font-medium tabular-nums h-11 sm:h-9"
              />
              <span className="text-sm text-[var(--text-secondary)]">เดือน</span>
            </div>
          </FormField>
        </div>
      </Card>

      {/* กลุ่มที่ 2: AI */}
      <Card className="p-5">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3 mb-4">
          <Bot size={18} className="text-[var(--primary)]" />
          <h2 className="font-semibold text-base text-[var(--text-primary)]">
            AI
          </h2>
        </div>
        <div className="space-y-4">
          <label className="flex items-start justify-between gap-4 p-3 rounded-[var(--radius-md)] bg-[var(--surface-subtle)] border border-[var(--border)] cursor-pointer">
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                เปิดใช้งานวิเคราะห์จุดแข็งและโอกาสพัฒนาด้วย AI (aiEnabled)
              </span>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                เปิดระบบสร้างบทวิเคราะห์ Coaching อัตโนมัติบนหน้ารายงานผลงานพนักงานขาย
              </p>
            </div>
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
              className="h-5 w-5 mt-1 cursor-pointer rounded border-[var(--border-strong)] accent-[var(--primary)]"
            />
          </label>

          <label className="flex items-start justify-between gap-4 p-3 rounded-[var(--radius-md)] bg-[var(--surface-subtle)] border border-[var(--border)] cursor-pointer">
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                ปิดบังข้อมูลระบุตัวบุคคลก่อนส่งให้ AI (aiAnonymize)
              </span>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                ปกป้องข้อมูลส่วนบุคคล (PII) โดยปิดบังชื่อพนักงานขายและชื่อโรงพยาบาลก่อนส่งคำขอไปยังโมเดลภายนอก (ตาม Business Rule I)
              </p>
            </div>
            <input
              type="checkbox"
              checked={aiAnonymize}
              onChange={(e) => setAiAnonymize(e.target.checked)}
              className="h-5 w-5 mt-1 cursor-pointer rounded border-[var(--border-strong)] accent-[var(--primary)]"
            />
          </label>
        </div>
      </Card>

      {/* กลุ่มที่ 3: ศักยภาพ (Potential Settings) */}
      <Card className="p-5">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3 mb-4">
          <Compass size={18} className="text-[var(--primary)]" />
          <h2 className="font-semibold text-base text-[var(--text-primary)]">
            ศักยภาพ
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="ตัวชี้วัดศักยภาพหลักจากทะเบียน (potentialMetric)"
            hint="เลือกเกณฑ์จากทะเบียนโรงพยาบาลที่นำมาคำนวณน้ำหนักศักยภาพเขตการขาย (เช่น จำนวนเตียง หรือ CMI)"
          >
            <Select
              value={potentialMetric}
              onChange={(e) => setPotentialMetric(e.target.value as PotentialMetricKey)}
              className="w-full h-11 sm:h-9"
            >
              {POTENTIAL_METRIC_KEYS.map((key) => (
                <option key={key} value={key}>
                  {POTENTIAL_METRIC_LABEL_TH[key]}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="ความครอบคลุมขั้นต่ำของภาค 0–1 (minRegionCoverage)"
            hint="สัดส่วนข้อมูลโรงพยาบาลในภาคที่ต้องมีครบก่อนนำศักยภาพมาใช้ปรับเป้าหมายใน Target Assist"
          >
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={1}
              step={0.01}
              value={minRegionCoverage}
              onChange={(e) => setMinRegionCoverage(Number(e.target.value))}
              className="w-full font-medium tabular-nums h-11 sm:h-9"
            />
          </FormField>
        </div>
      </Card>

      {/* กลุ่มที่ 4: ตัวช่วยตั้งเป้า (Target Assist) */}
      <Card className="p-5">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3 mb-4">
          <Target size={18} className="text-[var(--primary)]" />
          <h2 className="font-semibold text-base text-[var(--text-primary)]">
            ตัวช่วยตั้งเป้า
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="สัดส่วนฐานประวัติ α (targetSuggestionAlpha)"
            hint="ค่า 0 ถึง 1 — 1.000 หมายถึงคำนวณข้อเสนอเป้าหมายจากสถิติประวัติยอดขายล้วน 100% (กระทบหน้า /target-assist)"
          >
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={1}
              step={0.001}
              value={targetSuggestionAlpha}
              onChange={(e) => setTargetSuggestionAlpha(Number(e.target.value))}
              className="w-full font-medium tabular-nums h-11 sm:h-9"
            />
          </FormField>

          <FormField
            label="จำนวนเดือนย้อนหลังของฐานประวัติ (targetLookbackMonths)"
            hint="ช่วงเวลาย้อนหลังที่ระบบดึงยอดขายมาคำนวณฐานเพื่อเสนอเป้าหมายใน Target Assist"
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={targetLookbackMonths}
                onChange={(e) => setTargetLookbackMonths(Number(e.target.value))}
                className="w-28 text-right font-medium tabular-nums h-11 sm:h-9"
              />
              <span className="text-sm text-[var(--text-secondary)]">เดือน</span>
            </div>
          </FormField>

          <FormField
            label="สัดส่วนบิลผิดปกติ Outlier 0–1 (targetOutlierThreshold)"
            hint="สัดส่วนยอดต่อใบกำกับเทียบยอดรวม หากเกินเกณฑ์นี้จะถูกนับเป็น Outlier ใน Target Assist"
          >
            <Input
              type="number"
              inputMode="decimal"
              min={0.001}
              max={1}
              step={0.01}
              value={targetOutlierThreshold}
              onChange={(e) => setTargetOutlierThreshold(Number(e.target.value))}
              className="w-full font-medium tabular-nums h-11 sm:h-9"
            />
          </FormField>

          <FormField
            label="อัตราเติบโตเป้าหมาย (targetGrowthRate)"
            hint="ตัวคูณการเติบโตที่ระบบนำไปคูณกับฐานยอดขาย — เช่น 1.000 คือไม่เพิ่มการเติบโต, 1.050 คือเป้าโต 5%"
          >
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.001}
              value={targetGrowthRate}
              onChange={(e) => setTargetGrowthRate(Number(e.target.value))}
              className="w-full font-medium tabular-nums h-11 sm:h-9"
            />
          </FormField>
        </div>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <div className="ml-2 text-sm">{error}</div>
        </Alert>
      )}

      {/* Sticky footer action on mobile / standard on desktop */}
      <div className="sticky bottom-0 -mx-4 -mb-4 border-t border-[var(--border)] bg-[var(--surface)] p-4 sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:p-0">
        <Button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px]"
        >
          {submitting ? "กำลังบันทึก..." : "บันทึกค่าคงที่ของการประเมิน"}
        </Button>
      </div>
    </form>
  );
}

export default EvaluationSettingForm;
