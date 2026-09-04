"use client";

import { useState } from "react";
import { TierWeightRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { AlertCircle, Info } from "lucide-react";

export interface TierWeightsFormProps {
  weights: TierWeightRow[];
  onSubmit: (weights: { tier: string; weight: number }[]) => Promise<void>;
}

const TIER_WEIGHT_STEP = 0.001;

export function TierWeightsForm({ weights, onSubmit }: TierWeightsFormProps) {
  const [valuesByTier, setValuesByTier] = useState<Record<string, number>>(() =>
    Object.fromEntries(weights.map((row) => [row.tier, Number(row.weight)]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateValue(tier: string, raw: string) {
    const value = Number(raw);
    setValuesByTier((prev) => ({ ...prev, [tier]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (
      weights.some(
        (row) =>
          !Number.isFinite(valuesByTier[row.tier]) ||
          valuesByTier[row.tier] < 0 ||
          valuesByTier[row.tier] > 999.999
      )
    ) {
      setError("น้ำหนักต้องเป็นตัวเลขระหว่าง 0 ถึง 999.999");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(weights.map((row) => ({ tier: row.tier, weight: valuesByTier[row.tier] })));
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
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

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={999.999}
                    step={TIER_WEIGHT_STEP}
                    value={valuesByTier[row.tier]}
                    onChange={(e) => updateValue(row.tier, e.target.value)}
                    className="w-28 text-right font-medium tabular-nums h-11 sm:h-9"
                    aria-label={`น้ำหนักระดับ ${row.tier}`}
                  />
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
