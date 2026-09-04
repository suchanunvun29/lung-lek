"use client";

/**
 * SalesmanNameReviewTable — WACC-P1-009
 *
 * The new-salesman review queue on DataTable. "ซ้ำ — รวมเข้าคนนี้" (MERGED)
 * no longer acts directly — it asks the page to open a ConfirmDialog naming
 * which record merges into which; "คนใหม่จริง" (KEPT_SEPARATE) stays a single
 * click. The per-row warning about merge finality moved to the tab-level note —
 * the dialog now carries it at the moment of decision.
 */

import { useState } from "react";
import { SalesmanNameReview } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table/DataTable";

export interface SalesmanNameReviewTableProps {
  reviews: SalesmanNameReview[];
  mergeTargets: { id: number; displayName: string }[];
  /** KEPT_SEPARATE — runs immediately, not destructive. */
  onDecide: (review: SalesmanNameReview, decision: "KEPT_SEPARATE") => Promise<void>;
  /** MERGED — asks the page to confirm first; the page sends the payload. */
  onRequestMerge: (review: SalesmanNameReview, mergedIntoId: number) => void;
}

export function SalesmanNameReviewTable({ reviews, mergeTargets, onDecide, onRequestMerge }: SalesmanNameReviewTableProps) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [targets, setTargets] = useState<Record<number, string>>({});

  function updateTarget(reviewId: number, value: string) {
    setTargets((prev) => ({ ...prev, [reviewId]: value }));
  }

  async function keepSeparate(review: SalesmanNameReview) {
    setBusyId(review.id);
    try {
      await onDecide(review, "KEPT_SEPARATE");
    } finally {
      setBusyId(null);
    }
  }

  function renderDecision(review: SalesmanNameReview, compact: boolean) {
    const selectableTargets = mergeTargets.filter((person) => person.id !== review.createdSalespersonId);
    const mergedTarget = targets[review.id] ?? "";
    return (
      <div className={compact ? "space-y-2" : "flex flex-wrap items-center gap-2"}>
        <Button
          type="button"
          variant="success"
          size={compact ? "default" : "sm"}
          disabled={busyId === review.id}
          onClick={() => void keepSeparate(review)}
          className={compact ? "min-h-[44px] w-full" : ""}
        >
          คนใหม่จริง — ไม่ซ้ำกับใคร
        </Button>
        <Select
          aria-label={`เลือกพนักงานขายที่ "${review.sampleRaw}" ซ้ำด้วย`}
          value={mergedTarget}
          onChange={(event) => updateTarget(review.id, event.target.value)}
          disabled={busyId === review.id}
          className={compact ? "w-full" : "w-auto"}
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
          size={compact ? "default" : "sm"}
          disabled={busyId === review.id || !mergedTarget}
          onClick={() => onRequestMerge(review, Number(mergedTarget))}
          className={compact ? "min-h-[44px] w-full bg-zinc-900 text-white hover:bg-zinc-700" : "bg-zinc-900 text-white hover:bg-zinc-700"}
        >
          ซ้ำ — รวมเข้าคนนี้
        </Button>
      </div>
    );
  }

  const columns: DataTableColumn<SalesmanNameReview>[] = [
    {
      key: "name",
      header: "ชื่อพนักงานขายที่พบ",
      mobileRole: "identity",
      sortValue: (review) => review.sampleRaw,
      render: (review) => (
        <div className="space-y-0.5">
          <p className="font-medium text-zinc-900">{review.sampleRaw}</p>
          <p className="text-xs text-zinc-500">
            ระบบสร้างพนักงานขายใหม่ไว้แล้ว: {review.createdSalesperson?.displayName ?? "(ถูกลบไปแล้ว)"}
          </p>
        </div>
      ),
    },
    {
      key: "decision",
      header: "การตัดสินใจ",
      render: (review) => renderDecision(review, false),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={reviews}
      getRowId={(review) => review.id}
      caption="คิวตรวจสอบชื่อพนักงานขายใหม่ที่อาจซ้ำกับคนที่มีอยู่"
      searchable
      searchPredicate={(review, query) =>
        review.sampleRaw.toLowerCase().includes(query) ||
        (review.createdSalesperson?.displayName.toLowerCase().includes(query) ?? false)
      }
      searchPlaceholder="ค้นหาชื่อพนักงานขาย…"
      emptyTitle="ไม่มีชื่อพนักงานขายใหม่รอยืนยัน"
      rowAction={(review) => renderDecision(review, true)}
    />
  );
}

export default SalesmanNameReviewTable;
