"use client";

import { useState } from "react";
import { HospitalNameReview } from "@/lib/types";
import { Button } from "@/components/ui/button";

export interface HospitalNameReviewTableProps {
  reviews: HospitalNameReview[];
  onDecide: (review: HospitalNameReview, decision: "MERGED" | "KEPT_SEPARATE") => Promise<void>;
}

export function HospitalNameReviewTable({ reviews, onDecide }: HospitalNameReviewTableProps) {
  const [busyId, setBusyId] = useState<number | null>(null);

  async function handleDecision(review: HospitalNameReview, decision: "MERGED" | "KEPT_SEPARATE") {
    setBusyId(review.id);
    try {
      await onDecide(review, decision);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">ชื่อที่พบ</th>
            <th className="px-4 py-3">การตัดสินใจ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {reviews.length === 0 && (
            <tr><td colSpan={2} className="px-4 py-6 text-center text-zinc-400">ไม่มีชื่อโรงพยาบาลที่รอยืนยัน</td></tr>
          )}
          {reviews.map((review) => (
            <tr key={review.id}>
              <td className="px-4 py-3">
                <p className="font-medium text-zinc-900">{review.sampleRawA}</p>
                <p className="mt-1 text-zinc-600">{review.sampleRawB}</p>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="success"
                    size="sm"
                    disabled={busyId === review.id}
                    onClick={() => void handleDecision(review, "MERGED")}
                  >
                    รวม
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === review.id}
                    onClick={() => void handleDecision(review, "KEPT_SEPARATE")}
                  >
                    แยกถาวร
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default HospitalNameReviewTable;
