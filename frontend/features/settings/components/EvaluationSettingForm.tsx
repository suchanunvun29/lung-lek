"use client";

import { useState } from "react";
import { EvaluationSettingUpdateInput } from "@/features/settings/api/settings.api";
import { EvaluationSetting, PotentialMetricKey } from "@/lib/types";
import { POTENTIAL_METRIC_LABEL_TH } from "@/lib/targetLabels";
import { ApiError, getErrorMessage } from "@/lib/api-client";
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

const FIELD_ORDER = [
  "churnMonths",
  "minMonthsForChurn",
  "minMonthsForConsistency",
  "potentialMetric",
  "minRegionCoverage",
  "targetSuggestionAlpha",
  "targetLookbackMonths",
  "targetOutlierThreshold",
  "targetGrowthRate",
] as const;

type FieldKey = (typeof FIELD_ORDER)[number];

function focusFirstInvalidField(errors: Record<string, string>) {
  for (const field of FIELD_ORDER) {
    if (errors[field]) {
      const el = document.getElementById(field);
      if (el) {
        el.focus();
        break;
      }
    }
  }
}

function parseServerErrors(err: unknown): { fieldErrors: Record<string, string>; generalError: string | null } {
  const fieldErrors: Record<string, string> = {};
  let generalError: string | null = null;

  if (err instanceof ApiError) {
    const details = err.details;
    if (typeof details === "string") {
      let matched = false;
      for (const field of FIELD_ORDER) {
        if (details.toLowerCase().includes(field.toLowerCase())) {
          fieldErrors[field] = details;
          matched = true;
          break;
        }
      }
      if (!matched) generalError = details;
    } else if (typeof details === "object" && details !== null) {
      const obj = details as Record<string, unknown>;
      for (const field of FIELD_ORDER) {
        if (obj[field] && typeof obj[field] === "string") {
          fieldErrors[field] = obj[field] as string;
        }
      }
      if (Array.isArray(obj.errors)) {
        for (const item of obj.errors) {
          if (typeof item === "string") {
            for (const field of FIELD_ORDER) {
              if (item.toLowerCase().includes(field.toLowerCase())) {
                fieldErrors[field] = item;
              }
            }
          } else if (item && typeof item === "object" && "field" in item && "message" in item) {
            fieldErrors[String(item.field)] = String(item.message);
          }
        }
      }
      if (Object.keys(fieldErrors).length === 0) {
        generalError = err.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่";
      }
    } else {
      generalError = err.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่";
    }
  } else {
    generalError = getErrorMessage(err, "บันทึกไม่สำเร็จ กรุณาลองใหม่");
  }

  return { fieldErrors, generalError };
}

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function clearFieldError(field: FieldKey) {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!Number.isInteger(churnMonths) || churnMonths < 1) {
      newErrors.churnMonths = "เกณฑ์ตัดสินลูกค้าหยุดสั่งซื้อต้องเป็นจำนวนเต็มอย่างน้อย 1 เดือน";
    }
    if (!Number.isInteger(minMonthsForChurn) || minMonthsForChurn < 1) {
      newErrors.minMonthsForChurn = "ข้อมูลย้อนหลังขั้นต่ำสำหรับ Retention ต้องเป็นจำนวนเต็มอย่างน้อย 1 เดือน";
    }
    if (!Number.isInteger(minMonthsForConsistency) || minMonthsForConsistency < 1) {
      newErrors.minMonthsForConsistency = "ข้อมูลย้อนหลังขั้นต่ำสำหรับ Consistency ต้องเป็นจำนวนเต็มอย่างน้อย 1 เดือน";
    }
    if (!Number.isFinite(minRegionCoverage) || minRegionCoverage < 0 || minRegionCoverage > 1) {
      newErrors.minRegionCoverage = "ความครอบคลุมขั้นต่ำของภาคต้องอยู่ระหว่าง 0 ถึง 1";
    }
    if (!Number.isFinite(targetSuggestionAlpha) || targetSuggestionAlpha < 0 || targetSuggestionAlpha > 1) {
      newErrors.targetSuggestionAlpha = "สัดส่วนฐานประวัติ α ต้องอยู่ระหว่าง 0 ถึง 1";
    }
    if (!Number.isInteger(targetLookbackMonths) || targetLookbackMonths < 1) {
      newErrors.targetLookbackMonths = "จำนวนเดือนย้อนหลังต้องเป็นจำนวนเต็มอย่างน้อย 1 เดือน";
    }
    if (!Number.isFinite(targetOutlierThreshold) || targetOutlierThreshold <= 0 || targetOutlierThreshold > 1) {
      newErrors.targetOutlierThreshold = "สัดส่วนบิลผิดปกติต้องมากกว่า 0 และไม่เกิน 1";
    }
    if (!Number.isFinite(targetGrowthRate) || targetGrowthRate < 0) {
      newErrors.targetGrowthRate = "อัตราเติบโตเป้าหมายต้องไม่ต่ำกว่า 0";
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setError("กรุณาตรวจสอบข้อมูลที่ระบุในฟิลด์ที่มีข้อผิดพลาด");
      setTimeout(() => focusFirstInvalidField(newErrors), 0);
      return;
    }

    setSubmitting(true);
    setError(null);
    setFieldErrors({});

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
    } catch (err) {
      const parsed = parseServerErrors(err);
      if (Object.keys(parsed.fieldErrors).length > 0) {
        setFieldErrors(parsed.fieldErrors);
        setError("ข้อมูลที่ส่งไม่ผ่านการตรวจสอบจากระบบ");
        setTimeout(() => focusFirstInvalidField(parsed.fieldErrors), 0);
      } else {
        setError(parsed.generalError ?? "บันทึกไม่สำเร็จ กรุณาลองใหม่");
      }
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
            id="churnMonths"
            label="เกณฑ์ตัดสินลูกค้าหยุดสั่งซื้อ (churnMonths)"
            hint="กำหนดจำนวนเดือนที่ไม่มีการสั่งซื้อต่อเนื่อง ก่อนระบบจะนับว่าลูกค้าหลุดมือ (กระทบเกณฑ์ Retention)"
            error={fieldErrors.churnMonths}
          >
            {(props) => (
              <div className="flex items-center gap-2">
                <Input
                  {...props}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={churnMonths}
                  onChange={(e) => {
                    setChurnMonths(Number(e.target.value));
                    clearFieldError("churnMonths");
                  }}
                  className="w-28 text-right font-medium tabular-nums h-11 sm:h-9"
                />
                <span className="text-sm text-[var(--text-secondary)]">เดือน</span>
              </div>
            )}
          </FormField>

          <FormField
            id="minMonthsForChurn"
            label="ข้อมูลย้อนหลังขั้นต่ำสำหรับ Retention (minMonthsForChurn)"
            hint="ต้องมีข้อมูลย้อนหลังอย่างน้อยตามจำนวนเดือนนี้ มิฉะนั้นเกณฑ์ Retention จะคำนวณไม่ได้ (Non-computable)"
            error={fieldErrors.minMonthsForChurn}
          >
            {(props) => (
              <div className="flex items-center gap-2">
                <Input
                  {...props}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={minMonthsForChurn}
                  onChange={(e) => {
                    setMinMonthsForChurn(Number(e.target.value));
                    clearFieldError("minMonthsForChurn");
                  }}
                  className="w-28 text-right font-medium tabular-nums h-11 sm:h-9"
                />
                <span className="text-sm text-[var(--text-secondary)]">เดือน</span>
              </div>
            )}
          </FormField>

          <FormField
            id="minMonthsForConsistency"
            label="ข้อมูลย้อนหลังขั้นต่ำสำหรับ Consistency (minMonthsForConsistency)"
            hint="ต้องมีข้อมูลย้อนหลังอย่างน้อยตามจำนวนเดือนนี้ มิฉะนั้นเกณฑ์ Consistency จะคำนวณไม่ได้ (Non-computable)"
            className="md:col-span-2"
            error={fieldErrors.minMonthsForConsistency}
          >
            {(props) => (
              <div className="flex items-center gap-2">
                <Input
                  {...props}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={minMonthsForConsistency}
                  onChange={(e) => {
                    setMinMonthsForConsistency(Number(e.target.value));
                    clearFieldError("minMonthsForConsistency");
                  }}
                  className="w-28 text-right font-medium tabular-nums h-11 sm:h-9"
                />
                <span className="text-sm text-[var(--text-secondary)]">เดือน</span>
              </div>
            )}
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
            id="potentialMetric"
            label="ตัวชี้วัดศักยภาพหลักจากทะเบียน (potentialMetric)"
            hint="เลือกเกณฑ์จากทะเบียนโรงพยาบาลที่นำมาคำนวณน้ำหนักศักยภาพเขตการขาย (เช่น จำนวนเตียง หรือ CMI)"
            error={fieldErrors.potentialMetric}
          >
            <Select
              id="potentialMetric"
              value={potentialMetric}
              onChange={(e) => {
                setPotentialMetric(e.target.value as PotentialMetricKey);
                clearFieldError("potentialMetric");
              }}
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
            id="minRegionCoverage"
            label="ความครอบคลุมขั้นต่ำของภาค 0–1 (minRegionCoverage)"
            hint="สัดส่วนข้อมูลโรงพยาบาลในภาคที่ต้องมีครบก่อนนำศักยภาพมาใช้ปรับเป้าหมายใน Target Assist"
            error={fieldErrors.minRegionCoverage}
          >
            <Input
              id="minRegionCoverage"
              type="number"
              inputMode="decimal"
              min={0}
              max={1}
              step={0.01}
              value={minRegionCoverage}
              onChange={(e) => {
                setMinRegionCoverage(Number(e.target.value));
                clearFieldError("minRegionCoverage");
              }}
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
            id="targetSuggestionAlpha"
            label="สัดส่วนฐานประวัติ α (targetSuggestionAlpha)"
            hint="ค่า 0 ถึง 1 — 1.000 หมายถึงคำนวณข้อเสนอเป้าหมายจากสถิติประวัติยอดขายล้วน 100% (กระทบหน้า /target-assist)"
            error={fieldErrors.targetSuggestionAlpha}
          >
            <Input
              id="targetSuggestionAlpha"
              type="number"
              inputMode="decimal"
              min={0}
              max={1}
              step={0.001}
              value={targetSuggestionAlpha}
              onChange={(e) => {
                setTargetSuggestionAlpha(Number(e.target.value));
                clearFieldError("targetSuggestionAlpha");
              }}
              className="w-full font-medium tabular-nums h-11 sm:h-9"
            />
          </FormField>

          <FormField
            id="targetLookbackMonths"
            label="จำนวนเดือนย้อนหลังของฐานประวัติ (targetLookbackMonths)"
            hint="ช่วงเวลาย้อนหลังที่ระบบดึงยอดขายมาคำนวณฐานเพื่อเสนอเป้าหมายใน Target Assist"
            error={fieldErrors.targetLookbackMonths}
          >
            {(props) => (
              <div className="flex items-center gap-2">
                <Input
                  {...props}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={targetLookbackMonths}
                  onChange={(e) => {
                    setTargetLookbackMonths(Number(e.target.value));
                    clearFieldError("targetLookbackMonths");
                  }}
                  className="w-28 text-right font-medium tabular-nums h-11 sm:h-9"
                />
                <span className="text-sm text-[var(--text-secondary)]">เดือน</span>
              </div>
            )}
          </FormField>

          <FormField
            id="targetOutlierThreshold"
            label="สัดส่วนบิลผิดปกติ Outlier 0–1 (targetOutlierThreshold)"
            hint="สัดส่วนยอดต่อใบกำกับเทียบยอดรวม หากเกินเกณฑ์นี้จะถูกนับเป็น Outlier ใน Target Assist"
            error={fieldErrors.targetOutlierThreshold}
          >
            <Input
              id="targetOutlierThreshold"
              type="number"
              inputMode="decimal"
              min={0.001}
              max={1}
              step={0.01}
              value={targetOutlierThreshold}
              onChange={(e) => {
                setTargetOutlierThreshold(Number(e.target.value));
                clearFieldError("targetOutlierThreshold");
              }}
              className="w-full font-medium tabular-nums h-11 sm:h-9"
            />
          </FormField>

          <FormField
            id="targetGrowthRate"
            label="อัตราเติบโตเป้าหมาย (targetGrowthRate)"
            hint="ตัวคูณการเติบโตที่ระบบนำไปคูณกับฐานยอดขาย — เช่น 1.000 คือไม่เพิ่มการเติบโต, 1.050 คือเป้าโต 5%"
            error={fieldErrors.targetGrowthRate}
          >
            <Input
              id="targetGrowthRate"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.001}
              value={targetGrowthRate}
              onChange={(e) => {
                setTargetGrowthRate(Number(e.target.value));
                clearFieldError("targetGrowthRate");
              }}
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
