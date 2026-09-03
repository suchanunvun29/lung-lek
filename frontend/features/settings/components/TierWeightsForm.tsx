"use client";

import { useState } from "react";
import { TierWeightRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

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
    if (weights.some((row) => !Number.isFinite(valuesByTier[row.tier]) || valuesByTier[row.tier] < 0 || valuesByTier[row.tier] > 999.999)) {
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
    <Card className="p-4">
      <form onSubmit={handleSubmit}>
        <p className="text-sm text-zinc-600">
          ศักยภาพรายโรงพยาบาล = ค่าตัวชี้วัด × น้ำหนักระดับ × ค่าปรับรายแห่ง · ระดับที่ไม่ได้ตั้งค่าถือว่าน้ำหนัก 1.000
          เสมอ และการตั้ง 0 คือการตัดทุกโรงพยาบาลในระดับนั้นออกจากศักยภาพ
        </p>

        <div className="mt-4 space-y-3">
          {weights.map((row) => (
            <label key={row.tier} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-zinc-700">
                {row.tier}
                {!row.isCustom && <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">ค่าเริ่มต้น</span>}
              </span>
              <Input
                type="number"
                min={0}
                max={999.999}
                step={TIER_WEIGHT_STEP}
                value={valuesByTier[row.tier]}
                onChange={(e) => updateValue(row.tier, e.target.value)}
                className="w-28 text-right"
              />
            </label>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <Button
          type="submit"
          disabled={submitting}
          className="mt-4 bg-zinc-900 text-white hover:bg-zinc-800"
        >
          {submitting ? "กำลังบันทึก..." : "บันทึกน้ำหนักทุกระดับ"}
        </Button>
      </form>
    </Card>
  );
}

export default TierWeightsForm;
