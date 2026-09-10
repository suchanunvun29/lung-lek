"use client";

import { useState } from "react";
import { TierWeightRow } from "@/lib/types";
import { ApiError, getErrorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Info, AlertCircle } from "lucide-react";
import { announce } from "@/components/shared/feedback/LiveRegion";
import { toast } from "@/components/shared/feedback/toast/ToastProvider";

export interface TierWeightsFormProps {
  weights: TierWeightRow[];
  onSubmit: (weights: { tier: string; weight: number }[]) => Promise<void>;
}

const TIER_WEIGHT_STEP = 0.001;

export function TierWeightsForm({ weights, onSubmit }: TierWeightsFormProps) {
  const [valuesByTier, setValuesByTier] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    weights.forEach((w) => {
      map[w.tier] = Number(w.weight);
    });
    return map;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function updateValue(tier: string, raw: string) {
    const value = Number(raw);
    setValuesByTier((prev) => ({ ...prev, [tier]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const newErrors: Record<string, string> = {};
    for (const row of weights) {
      const val = valuesByTier[row.tier];
      if (!Number.isFinite(val) || val < 0 || val > 999.999) {
        newErrors[row.tier] = "น้ำหนักต้องเป็นตัวเลขระหว่าง 0 ถึง 999.999";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setError("กรุณาตรวจสอบค่าน้ำหนักในระดับที่มีข้อผิดพลาด");
      const firstInvalidTier = weights.find((w) => newErrors[w.tier])?.tier;
      if (firstInvalidTier) {
        setTimeout(() => document.getElementById(`tier-${firstInvalidTier}`)?.focus(), 0);
      }
      return;
    }

    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    announce("กำลังบันทึกน้ำหนักทุกระดับ...", "polite");
    try {
      await onSubmit(weights.map((row) => ({ tier: row.tier, weight: valuesByTier[row.tier] })));
      // T-UX-012 — success = toast (คง banner ที่หน้า page ไว้เป็น visual โดยไม่ประกาศซ้ำ)
      toast.success("บันทึกน้ำหนักทุกระดับเรียบร้อยแล้ว");
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        const details = err.details;
        const serverFieldErrors: Record<string, string> = {};
        for (const row of weights) {
          if (typeof details === "string" && details.toLowerCase().includes(row.tier.toLowerCase())) {
            serverFieldErrors[row.tier] = details;
          } else if (typeof details === "object" && details !== null) {
            const obj = details as Record<string, unknown>;
            if (obj[row.tier] && typeof obj[row.tier] === "string") {
              serverFieldErrors[row.tier] = obj[row.tier] as string;
            }
          }
        }
        if (Object.keys(serverFieldErrors).length > 0) {
          setFieldErrors(serverFieldErrors);
          setError("ข้อมูลที่ส่งไม่ผ่านการตรวจสอบจากระบบ");
          const firstTier = weights.find((w) => serverFieldErrors[w.tier])?.tier;
          if (firstTier) {
            setTimeout(() => document.getElementById(`tier-${firstTier}`)?.focus(), 0);
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
        <div className="flex gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] p-3 text-xs text-[var(--text-secondary)] leading-relaxed">
          <Info size={18} className="shrink-0 text-[var(--primary)] mt-0.5" />
          <div>
            <p className="font-semibold text-[var(--text-primary)] mb-0.5">
              สูตรถ่วงน้ำหนักศักยภาพโรงพยาบาล:
            </p>
            <p>
              ศักยภาพรายแห่ง = ค่าตัวชี้วัด × น้ำหนักระดับ (TierWeight) × ค่าปรับรายแห่ง ·
              ระดับที่ไม่ได้ตั้งค่าจะใช้ค่าเริ่มต้น 1.000 เสมอ และการตั้งเป็น 0
              คือการตัดทุกโรงพยาบาลในระดับนั้นออกจากศักยภาพ
            </p>
          </div>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {weights.map((row) => {
            const isCustom = row.isCustom;
            return (
              <div
                key={row.tier}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-[var(--text-primary)]">
                    ระดับ {row.tier}
                  </span>
                  {isCustom ? (
                    <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
                      กำหนดเอง
                    </span>
                  ) : (
                    <span className="rounded-full bg-[var(--surface-subtle)] border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                      ค่าเริ่มต้น (1.000)
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1">
                  <Input
                    id={`tier-${row.tier}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={999.999}
                    step={TIER_WEIGHT_STEP}
                    value={valuesByTier[row.tier]}
                    onChange={(e) => {
                      updateValue(row.tier, e.target.value);
                      if (fieldErrors[row.tier]) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next[row.tier];
                          return next;
                        });
                      }
                    }}
                    className={`w-28 text-right font-medium tabular-nums h-11 sm:h-9 ${
                      fieldErrors[row.tier] ? "border-[var(--danger)] focus-visible:ring-[var(--danger)]" : ""
                    }`}
                    aria-label={`น้ำหนักระดับ ${row.tier}`}
                    aria-invalid={Boolean(fieldErrors[row.tier])}
                    aria-describedby={fieldErrors[row.tier] ? `tier-${row.tier}-error` : undefined}
                  />
                  {fieldErrors[row.tier] && (
                    <p
                      id={`tier-${row.tier}-error`}
                      role="alert"
                      aria-live="polite"
                      className="text-xs text-[var(--danger)] font-medium text-right"
                    >
                      {fieldErrors[row.tier]}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <div className="ml-2 text-sm">{error}</div>
          </Alert>
        )}

        {/* Sticky footer action on mobile / standard on desktop */}
        <div className="sticky bottom-0 -mx-5 -mb-5 mt-6 border-t border-[var(--border)] bg-[var(--surface)] p-4 sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:p-0">
          <Button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px]"
          >
            {submitting ? "กำลังบันทึก..." : "บันทึกน้ำหนักทุกระดับ"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default TierWeightsForm;
