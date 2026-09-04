"use client";

/**
 * HospitalNameReviewTable — WACC-P1-009
 *
 * The hospital name-review queue on DataTable (client-side search; the endpoint
 * returns the full list). "รวม" (MERGED) no longer acts directly — it asks the
 * page to open a ConfirmDialog naming both records; "แยกถาวร" (KEPT_SEPARATE)
 * stays a single click because it deletes nothing.
 */

import { useState } from "react";
import { HospitalNameReview } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table/DataTable";

export interface HospitalNameReviewTableProps {
  reviews: HospitalNameReview[];
  /** KEPT_SEPARATE — runs immediately, not destructive. */
  onDecide: (review: HospitalNameReview, decision: "KEPT_SEPARATE") => Promise<void>;
  /** MERGED — asks the page to confirm first; the page sends the payload. */
  onRequestMerge: (review: HospitalNameReview) => void;
}

export function HospitalNameReviewTable({ reviews, onDecide, onRequestMerge }: HospitalNameReviewTableProps) {
  const [busyId, setBusyId] = useState<number | null>(null);

  async function keepSeparate(review: HospitalNameReview) {
    setBusyId(review.id);
    try {
      await onDecide(review, "KEPT_SEPARATE");
    } finally {
      setBusyId(null);
    }
  }

  function renderActions(review: HospitalNameReview, compact: boolean) {
    return (
      <div className={`gap-2 ${compact ? "flex w-full flex-col" : "flex flex-wrap"}`}>
        <Button
          type="button"
          variant="success"
          size={compact ? "default" : "sm"}
          disabled={busyId === review.id}
          onClick={() => onRequestMerge(review)}
          className={compact ? "min-h-[44px] w-full" : ""}
        >
          รวมเป็นชื่อเดียวกัน
        </Button>
        <Button
          type="button"
          variant="outline"
          size={compact ? "default" : "sm"}
          disabled={busyId === review.id}
          onClick={() => void keepSeparate(review)}
          className={compact ? "min-h-[44px] w-full" : ""}
        >
          คนละชื่อกัน — แยกถาวร
        </Button>
      </div>
    );
  }

  const columns: DataTableColumn<HospitalNameReview>[] = [
    {
      key: "names",
      header: "ชื่อที่พบในไฟล์",
      mobileRole: "identity",
      render: (review) => (
        <div className="space-y-0.5">
          <p className="font-medium text-text-primary">{review.sampleRawA}</p>
          <p className="text-text-secondary">{review.sampleRawB}</p>
        </div>
      ),
    },
    {
      key: "actions",
      header: "การตัดสินใจ",
      render: (review) => renderActions(review, false),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={reviews}
      getRowId={(review) => review.id}
      caption="คิวตรวจสอบชื่อโรงพยาบาลที่ซ้ำกัน"
      searchable
      searchPredicate={(review, query) =>
        review.sampleRawA.toLowerCase().includes(query) || review.sampleRawB.toLowerCase().includes(query)
      }
      searchPlaceholder="ค้นหาชื่อโรงพยาบาล…"
      emptyTitle="ไม่มีชื่อโรงพยาบาลที่รอยืนยัน"
      rowAction={(review) => renderActions(review, true)}
    />
  );
}

export default HospitalNameReviewTable;
