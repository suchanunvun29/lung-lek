"use client";

import { useState } from "react";
import { SalesmanNameReview } from "@/lib/types";

interface SalesmanNameReviewTableProps {
  reviews: SalesmanNameReview[];
  mergeTargets: { id: string; displayName: string }[];
  onDecide: (
    review: SalesmanNameReview,
    decision: { decision: "MERGED"; mergedIntoId: string } | { decision: "KEPT_SEPARATE" }
  ) => Promise<void>;
}

export default function SalesmanNameReviewTable({ reviews, mergeTargets, onDecide }: SalesmanNameReviewTableProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});

  function updateTarget(reviewId: string, value: string) {
    setTargets((prev) => ({ ...prev, [reviewId]: value }));
  }

  async function decide(review: SalesmanNameReview, decision: { decision: "MERGED" | "KEPT_SEPARATE" }) {
    setBusyId(review.id);
    try {
      if (decision.decision === "MERGED") {
        await onDecide(review, { decision: "MERGED", mergedIntoId: targets[review.id] ?? "" });
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
              <button
                type="button"
                disabled={busyId === review.id}
                onClick={() => void decide(review, { decision: "KEPT_SEPARATE" })}
                className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                คนใหม่จริง — ไม่ซ้ำกับใคร
              </button>
              <select
                aria-label={`เลือกพนักงานเป้าหมายสำหรับ ${review.sampleRaw}`}
                value={mergedTarget}
                onChange={(event) => updateTarget(review.id, event.target.value)}
                disabled={busyId === review.id}
                className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm disabled:opacity-50"
              >
                <option value="">— เลือกคนที่ชื่อนี้ซ้ำด้วย —</option>
                {selectableTargets.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.displayName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busyId === review.id || !mergedTarget}
                onClick={() => void decide(review, { decision: "MERGED" })}
                className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ซ้ำ — รวมเข้าคนนี้
              </button>
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
