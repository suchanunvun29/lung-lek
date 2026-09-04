"use client";

import { useState } from "react";
import { SCORED_METRIC_LABEL_TH } from "@/lib/kpiLabels";
import { ScoringWeightRevision } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronRight, History } from "lucide-react";

export interface ScoringWeightRevisionsListProps {
  revisions: ScoringWeightRevision[];
}

export function ScoringWeightRevisionsList({ revisions }: ScoringWeightRevisionsListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (revisions.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-center text-sm text-[var(--text-muted)]">
        ยังไม่มีประวัติการแก้ไข
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-left text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <History size={16} className="text-[var(--text-muted)]" />
          <span>ประวัติการแก้ไข ({revisions.length} รายการ)</span>
        </div>
        {isExpanded ? (
          <ChevronDown size={18} className="text-[var(--text-muted)]" />
        ) : (
          <ChevronRight size={18} className="text-[var(--text-muted)]" />
        )}
      </button>

      {isExpanded && (
        <div className="space-y-3 pt-1">
          {revisions.map((rev) => (
            <Card key={rev.id} className="p-4 border-[var(--border)]">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)] border-b border-[var(--border)] pb-2">
                <span className="font-medium text-[var(--text-secondary)]">
                  {rev.changedBy.displayName}
                </span>
                <span>{new Date(rev.changedAt).toLocaleString("th-TH")}</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div className="rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] p-2.5">
                  <p className="mb-1 text-xs font-semibold text-[var(--text-muted)]">ก่อนแก้</p>
                  <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
                    {rev.before.map((w) => (
                      <li key={w.metric} className="flex justify-between">
                        <span>{SCORED_METRIC_LABEL_TH[w.metric]}</span>
                        <span className="tabular-nums font-medium">{w.weight}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] p-2.5">
                  <p className="mb-1 text-xs font-semibold text-[var(--text-muted)]">หลังแก้</p>
                  <ul className="space-y-1 text-xs text-[var(--text-primary)]">
                    {rev.after.map((w) => (
                      <li key={w.metric} className="flex justify-between">
                        <span>{SCORED_METRIC_LABEL_TH[w.metric]}</span>
                        <span className="tabular-nums font-medium">{w.weight}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {rev.note && (
                <p className="mt-3 text-xs text-[var(--text-muted)] bg-[var(--surface-subtle)] p-2 rounded-[var(--radius-sm)]">
                  <span className="font-medium text-[var(--text-secondary)]">หมายเหตุ:</span> {rev.note}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default ScoringWeightRevisionsList;
