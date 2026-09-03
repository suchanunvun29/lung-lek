"use client";

import { useState } from "react";
import { SalesmanNameReview } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export interface SalesmanNameReviewTableProps {
  reviews: SalesmanNameReview[];
  mergeTargets: { id: number; displayName: string }[];
  onDecide: (
    review: SalesmanNameReview,
    decision: { decision: "MERGED"; mergedIntoId: number } | { decision: "KEPT_SEPARATE" }
  ) => Promise<void>;
}

export function SalesmanNameReviewTable({ reviews, mergeTargets, onDecide }: SalesmanNameReviewTableProps) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [targets, setTargets] = useState<Record<number, string>>({});

  function updateTarget(reviewId: number, value: string) {
    setTargets((prev) => ({ ...prev, [reviewId]: value }));
  }

  async function decide(review: SalesmanNameReview, decision: { decision: "MERGED" | "KEPT_SEPARATE" }) {
    setBusyId(review.id);
    try {
      if (decision.decision === "MERGED") {
        await onDecide(review, { decision: "MERGED", mergedIntoId: Number(targets[review.id] ?? "") });
      } else {
        await onDecide(review, { decision: "KEPT_SEPARATE" });
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {reviews.length === 0 && (
        <p className="rounded-lg border border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-400">
          ไม่มีชื่อพนักงานขายใหม่รอยืนยัน
        </p>
      )}
      {reviews.map((review) => {
        const selectableTargets = mergeTargets.filter((person) => person.id !== review.createdSalespersonId);
        const mergedTarget = targets[review.id] ?? "";
        return (
          <section key={review.id} className="rounded-lg border border-zinc-200 bg-white p-4">
            <h3 className="font-medium text-zinc-900">{review.sampleRaw}</h3>
            <p className="mt-1 text-sm text-zinc-500">
              ระบบสร้างพนักงานขายใหม่ให้แล้ว: {review.createdSalesperson?.displayName ?? "(ถูกลบไปแล้ว)"} — ยืนยันว่าเป็นคนใหม่ หรือซ้ำกับคนที่มีอยู่
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="success"
                size="sm"
                disabled={busyId === review.id}
                onClick={() => void decide(review, { decision: "KEPT_SEPARATE" })}
              >
                คนใหม่จริง — ไม่ซ้ำกับใคร
              </Button>
              <Select
                aria-label={`เลือกพนักงานเป้าหมายสำหรับ ${review.sampleRaw}`}
                value={mergedTarget}
                onChange={(event) => updateTarget(review.id, event.target.value)}
                disabled={busyId === review.id}
                className="w-auto"
              >
                <option value="">— เลือกคนที่ชื่อนี้ซ้ำด้วย —</option>
                {selectableTargets.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.displayName}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                size="sm"
                className="bg-zinc-900 text-white hover:bg-zinc-700"
                disabled={busyId === review.id || !mergedTarget}
                onClick={() => void decide(review, { decision: "MERGED" })}
              >
                ซ้ำ — รวมเข้าคนนี้
              </Button>
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              การ “รวม” จะย้ายดีล/เครดิตทั้งหมดไปยังคนเป้าหมายแล้วลบแถวที่ถูกสร้างซ้ำ — ตัดสินแล้วจะไม่ถามซ้ำ
            </p>
          </section>
        );
      })}
    </div>
  );
}

export default SalesmanNameReviewTable;
