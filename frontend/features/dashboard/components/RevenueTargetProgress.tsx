"use client";

import { formatMoney } from "@/lib/importLabels";
import { formatKpiNumber } from "@/lib/kpiLabels";
import { MetricResult } from "@/lib/types";
import { KpiTile } from "@/components/shared/kpi/KpiTile";
import { MetricReason } from "@/components/shared/kpi/MetricReason";

export interface RevenueTargetProgressProps {
  metric: MetricResult;
}

const FULL_PROGRESS_PERCENT = 100;

export function RevenueTargetProgress({ metric }: RevenueTargetProgressProps) {
  if (!metric.computable) {
    return (
      <KpiTile
        label="ยอดสะสมเทียบเป้า"
        value="คำนวณไม่ได้"
        status="warning"
        comparison={<MetricReason reason={metric.reason ?? undefined} />}
      />
    );
  }

  const actual = Number(metric.detail.actual ?? 0);
  const target = Number(metric.detail.target ?? 0);
  const achievementPercent = Number(metric.detail.achievementPercent ?? 0);
  const remaining = target - actual;
  const progressWidth = Math.min(achievementPercent, FULL_PROGRESS_PERCENT);

  return (
    <KpiTile
      label="ยอดสะสมเทียบเป้า"
      value={formatMoney(String(actual))}
      unit="บาท"
      comparison={
        <span>
          จากเป้า {formatMoney(String(target))} บาท · {formatKpiNumber(achievementPercent)}% ของเป้า
        </span>
      }
      status={remaining <= 0 ? "positive" : "default"}
    >
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${progressWidth}%` }}
        />
      </div>

      <div className="mt-2 text-sm">
        {remaining > 0 ? (
          <span className="font-medium text-zinc-900">เหลืออีก {formatMoney(String(remaining))} บาท ถึงเป้า</span>
        ) : (
          <span className="font-medium text-emerald-700">ถึงเป้าแล้ว (เกินเป้า {formatMoney(String(-remaining))} บาท)</span>
        )}
      </div>
    </KpiTile>
  );
}

export default RevenueTargetProgress;
