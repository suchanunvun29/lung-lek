"use client";

import { useState } from "react";
import { ScoringWeightInput } from "@/features/settings/api/settings.api";
import { SCORED_METRIC_ORDER } from "@/lib/kpiLabels";
import { ScoredKpiMetric, ScoringWeight } from "@/lib/types";
import { ApiError, getErrorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/shared/form/FormField";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { announce } from "@/components/shared/feedback/LiveRegion";
import { toast } from "@/components/shared/feedback/toast/ToastProvider";

export interface ScoringWeightsFormProps {
  weights: ScoringWeight[];
  onSubmit: (weights: ScoringWeightInput[], note: string | null) => Promise<void>;
}

const TOTAL_WEIGHT = 100;

export const METRIC_DESCRIPTIONS: Record<
  ScoredKpiMetric,
  { label: string; description: string }
> = {
  REVENUE_VS_TARGET: {
    label: "ยอดขายเทียบเป้า",
    description: "สัดส่วนผลงานยอดขายจริงเทียบกับเป้าหมายที่ได้รับมอบหมายในงวดนั้น",
  },
  NEW_CUSTOMERS: {
    label: "ลูกค้าใหม่",
    description: "จำนวนหรือผลงานจากลูกค้าใหม่ที่เปิดการสั่งซื้อสำเร็จในงวด",
  },
  PRODUCT_GROUP: {
    label: "กลุ่มสินค้าตามเป้า",
    description: "การกระจายยอดขายและผลงานตามหมวดหมู่สินค้าสำคัญเชิงยุทธศาสตร์",
  },
  RETENTION: {
    label: "การรักษาลูกค้าเดิม (Retention)",
    description:
      "การคงความต่อเนื่องของลูกค้าเดิม ไม่หยุดสั่งซื้อติดต่อกันเกินเกณฑ์ Churn",
  },
  CONSISTENCY: {
    label: "ความสม่ำเสมอของยอดขาย (Consistency)",
    description:
      "ความต่อเนื่องและความคงเส้นคงวาของยอดขายตลอดช่วงเวลา (ต้องมีข้อมูลอย่างน้อยตามเกณฑ์)",
  },
};

export function ScoringWeightsForm({ weights, onSubmit }: ScoringWeightsFormProps) {
  const [values, setValues] = useState<Record<ScoredKpiMetric, number>>(() => {
    const map = {} as Record<ScoredKpiMetric, number>;
    SCORED_METRIC_ORDER.forEach((metric) => {
      map[metric] = weights.find((w) => w.metric === metric)?.weight ?? 0;
    });
    return map;
  });
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const total = SCORED_METRIC_ORDER.reduce(
    (sum, metric) => sum + (values[metric] || 0),
    0
  );
  const is100 = total === TOTAL_WEIGHT;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const newErrors: Record<string, string> = {};
    for (const metric of SCORED_METRIC_ORDER) {
      const val = values[metric];
      if (!Number.isInteger(val) || val < 0 || val > TOTAL_WEIGHT) {
        newErrors[metric] = `ค่าน้ำหนักต้องเป็นจำนวนเต็มระหว่าง 0 ถึง ${TOTAL_WEIGHT}`;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setError("กรุณาตรวจสอบค่าน้ำหนักในเกณฑ์ที่มีข้อผิดพลาด");
      const firstInvalid = SCORED_METRIC_ORDER.find((m) => newErrors[m]);
      if (firstInvalid) {
        setTimeout(() => document.getElementById(`metric-${firstInvalid}`)?.focus(), 0);
      }
      return;
    }

    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    announce("กำลังบันทึกน้ำหนักคะแนน...", "polite");
    try {
      await onSubmit(
        SCORED_METRIC_ORDER.map((metric) => ({ metric, weight: values[metric] })),
        note.trim() || null
      );
      setNote("");
      // T-UX-012 — เดิม success เป็น announce-only (มองไม่เห็นกับตา); success = toast
      toast.success("บันทึกน้ำหนักคะแนนเรียบร้อยแล้ว");
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        const details = err.details;
        const serverFieldErrors: Record<string, string> = {};
        for (const metric of SCORED_METRIC_ORDER) {
          if (typeof details === "string" && details.toLowerCase().includes(metric.toLowerCase())) {
            serverFieldErrors[metric] = details;
          } else if (typeof details === "object" && details !== null) {
            const obj = details as Record<string, unknown>;
            if (obj[metric] && typeof obj[metric] === "string") {
              serverFieldErrors[metric] = obj[metric] as string;
            }
          }
        }
        if (Object.keys(serverFieldErrors).length > 0) {
          setFieldErrors(serverFieldErrors);
          setError("ข้อมูลที่ส่งไม่ผ่านการตรวจสอบจากระบบ");
          const firstMetric = SCORED_METRIC_ORDER.find((m) => serverFieldErrors[m]);
          if (firstMetric) {
            setTimeout(() => document.getElementById(`metric-${firstMetric}`)?.focus(), 0);
          }
          return;
        }
      }
      setError(getErrorMessage(err, "บันทึกไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-5">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Business Rule Explanation Card/Banner */}
        <div className="flex gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] p-3 text-xs text-[var(--text-secondary)] leading-relaxed">
          <Info size={18} className="shrink-0 text-[var(--primary)] mt-0.5" />
          <div>
            <p className="font-semibold text-[var(--text-primary)] mb-0.5">
              หลักการคำนวณคะแนนรวม (Composite Score):
            </p>
            <p>
              ระบบคิดคะแนนรวมโดยถ่วงน้ำหนักเฉพาะเกณฑ์ที่สามารถคำนวณได้จริง (Computable Criteria) เท่านั้น
              และตัวหารคือผลรวมค่าน้ำหนักของเกณฑ์ที่คำนวณได้
              หากมีเกณฑ์ที่ไม่สามารถคำนวณได้ ระบบจะนำเกณฑ์นั้นออกและปรับสัดส่วนตัวหารโดยอัตโนมัติ
            </p>
          </div>
        </div>

        {/* Weights inputs grid */}
        <div className="divide-y divide-[var(--border)]">
          {SCORED_METRIC_ORDER.map((metric) => {
            const item = METRIC_DESCRIPTIONS[metric];
            return (
              <div
                key={metric}
                className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex-1 pr-4">
                  <span className="font-medium text-sm text-[var(--text-primary)]">
                    {item.label}
                  </span>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {item.description}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 self-end sm:self-center">
                  <div className="flex items-center gap-2">
                    <Input
                      id={`metric-${metric}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={TOTAL_WEIGHT}
                      step={1}
                      value={values[metric]}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setValues((prev) => ({
                          ...prev,
                          [metric]: val,
                        }));
                        if (fieldErrors[metric]) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next[metric];
                            return next;
                          });
                        }
                      }}
                      className={`w-24 text-right tabular-nums font-medium h-11 sm:h-9 ${
                        fieldErrors[metric] ? "border-[var(--danger)] focus-visible:ring-[var(--danger)]" : ""
                      }`}
                      aria-label={`ค่าน้ำหนัก ${item.label}`}
                      aria-invalid={Boolean(fieldErrors[metric])}
                      aria-describedby={fieldErrors[metric] ? `metric-${metric}-error` : undefined}
                    />
                    <span className="text-sm font-medium text-[var(--text-secondary)]">%</span>
                  </div>
                  {fieldErrors[metric] && (
                    <p
                      id={`metric-${metric}-error`}
                      role="alert"
                      aria-live="polite"
                      className="text-xs text-[var(--danger)] font-medium text-right"
                    >
                      {fieldErrors[metric]}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Live sum indicator & non-blocking notice */}
        <div className="pt-2">
          <div className="flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-[var(--surface-subtle)] border border-[var(--border)]">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              ผลรวมค่าน้ำหนักทั้งหมด:
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`font-semibold text-base tabular-nums ${
                  is100 ? "text-[var(--success)]" : "text-[var(--warning)]"
                }`}
              >
                {total}%
              </span>
              {is100 ? (
                <CheckCircle2 size={18} className="text-[var(--success)]" />
              ) : (
                <AlertCircle size={18} className="text-[var(--warning)]" />
              )}
            </div>
          </div>

          {!is100 && (
            <Alert variant="warning" className="mt-3">
              <AlertCircle className="h-4 w-4" />
              <div className="ml-2 text-xs">
                ผลรวมค่าน้ำหนักปัจจุบันอยู่ที่ <strong>{total}%</strong> (ไม่ได้รวมเป็น 100%)
                ระบบอนุญาตให้บันทึกได้โดยจะคำนวณถ่วงน้ำหนักตามสัดส่วนจริงของเกณฑ์ที่เปิดใช้งาน
              </div>
            </Alert>
          )}
        </div>

        <div className="pt-2">
          <FormField
            label="หมายเหตุการแก้ไข (ไม่บังคับ)"
            hint="ระบุเหตุผลหรือบันทึกประกอบการปรับเปลี่ยนค่าน้ำหนักครั้งนี้เพื่อใช้อ้างอิงในประวัติ"
          >
            <Input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ปรับเกณฑ์ความสม่ำเสมอสำหรับงวด Q3"
              className="h-11 sm:h-9"
            />
          </FormField>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <div className="ml-2 text-xs">{error}</div>
          </Alert>
        )}

        {/* Sticky footer action on mobile / standard on desktop */}
        <div className="sticky bottom-0 -mx-5 -mb-5 mt-6 border-t border-[var(--border)] bg-[var(--surface)] p-4 sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:p-0">
          <Button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px]"
          >
            {submitting ? "กำลังบันทึก..." : "บันทึกน้ำหนักคะแนน"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default ScoringWeightsForm;
