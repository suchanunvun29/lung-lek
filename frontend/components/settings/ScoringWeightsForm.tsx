"use client";

import { useState } from "react";
import { ScoringWeightInput } from "@/lib/api";
import { SCORED_METRIC_LABEL_TH, SCORED_METRIC_ORDER } from "@/lib/kpiLabels";
import { ScoredKpiMetric, ScoringWeight } from "@/lib/types";

interface ScoringWeightsFormProps {
  weights: ScoringWeight[];
  onSubmit: (weights: ScoringWeightInput[], note: string | null) => Promise<void>;
}

const TOTAL_WEIGHT = 100;

export default function ScoringWeightsForm({ weights, onSubmit }: ScoringWeightsFormProps) {
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

  const total = SCORED_METRIC_ORDER.reduce((sum, metric) => sum + (values[metric] || 0), 0);
  const isValid = total === TOTAL_WEIGHT;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) {
      setError(`น้ำหนักรวมต้องเท่ากับ ${TOTAL_WEIGHT} (ปัจจุบันรวม ${total})`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(
        SCORED_METRIC_ORDER.map((metric) => ({ metric, weight: values[metric] })),
        note.trim() || null
      );
      setNote("");
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SCORED_METRIC_ORDER.map((metric) => (
          <label key={metric} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-700">{SCORED_METRIC_LABEL_TH[metric]}</span>
            <span className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={TOTAL_WEIGHT}
                step={1}
                value={values[metric]}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [metric]: Number(e.target.value) }))
                }
                className="w-20 rounded-md border border-zinc-300 px-2 py-1.5 text-right"
              />
              <span className="text-zinc-500">%</span>
            </span>
          </label>
        ))}
      </div>

      <p className={`mt-3 text-sm font-medium ${isValid ? "text-emerald-700" : "text-red-600"}`}>
        รวม {total} / {TOTAL_WEIGHT}
      </p>

      <div className="mt-3">
        <label className="mb-1 block text-sm font-medium text-zinc-600">หมายเหตุ (ไม่บังคับ)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          placeholder="เหตุผลของการปรับน้ำหนักครั้งนี้"
        />
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !isValid}
        className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {submitting ? "กำลังบันทึก..." : "บันทึกน้ำหนักคะแนน"}
      </button>
    </form>
  );
}
