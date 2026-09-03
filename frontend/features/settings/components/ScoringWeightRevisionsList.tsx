import { SCORED_METRIC_LABEL_TH } from "@/lib/kpiLabels";
import { ScoringWeightRevision } from "@/lib/types";
import { Card } from "@/components/ui/card";

export interface ScoringWeightRevisionsListProps {
  revisions: ScoringWeightRevision[];
}

export function ScoringWeightRevisionsList({ revisions }: ScoringWeightRevisionsListProps) {
  if (revisions.length === 0) {
    return <p className="text-sm text-zinc-400">ยังไม่มีประวัติการแก้ไข</p>;
  }

  return (
    <div className="space-y-3">
      {revisions.map((rev) => (
        <Card key={rev.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <span>
              {rev.changedBy.displayName} · {new Date(rev.changedAt).toLocaleString("th-TH")}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="mb-1 font-medium text-zinc-500">ก่อนแก้</p>
              <ul className="space-y-0.5">
                {rev.before.map((w) => (
                  <li key={w.metric}>
                    {SCORED_METRIC_LABEL_TH[w.metric]}: {w.weight}%
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 font-medium text-zinc-500">หลังแก้</p>
              <ul className="space-y-0.5">
                {rev.after.map((w) => (
                  <li key={w.metric}>
                    {SCORED_METRIC_LABEL_TH[w.metric]}: {w.weight}%
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {rev.note && <p className="mt-2 text-xs text-zinc-500">หมายเหตุ: {rev.note}</p>}
        </Card>
      ))}
    </div>
  );
}

export default ScoringWeightRevisionsList;
