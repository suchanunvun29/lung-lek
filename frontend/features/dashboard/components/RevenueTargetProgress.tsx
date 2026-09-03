"use client";

import { formatMoney } from "@/lib/importLabels";
import { formatKpiNumber } from "@/lib/kpiLabels";
import { MetricResult } from "@/lib/types";
import { Card } from "@/components/ui/card";

export interface RevenueTargetProgressProps {
  metric: MetricResult;
}

const FULL_PROGRESS_PERCENT = 100;

export function RevenueTargetProgress({ metric }: RevenueTargetProgressProps) {
  if (!metric.computable) {
    return (
      <Card className="p-4">
        <h2 className="text-sm font-medium text-zinc-500">ยอดสะสมเทียบเป้า</h2>
        <p className="mt-2 text-sm text-amber-700">{metric.reason ?? "คำนวณไม่ได้"}</p>
      </Card>
    );
  }

  const actual = Number(metric.detail.actual ?? 0);
  const target = Number(metric.detail.target ?? 0);
  const achievementPercent = Number(metric.detail.achievementPercent ?? 0);
  const remaining = target - actual;
  const progressWidth = Math.min(achievementPercent, FULL_PROGRESS_PERCENT);

  return (
    <Card className="p-4">
      <h2 className="text-sm font-medium text-zinc-500">ยอดสะสมเทียบเป้า</h2>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-semibold text-zinc-900">{formatMoney(String(actual))} บาท</span>
        <span className="text-sm text-zinc-500">จากเป้า {formatMoney(String(target))} บาท</span>
      </div>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${progressWidth}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-zinc-600">{formatKpiNumber(achievementPercent)}% ของเป้า</span>
        {remaining > 0 ? (
          <span className="font-medium text-zinc-900">เหลืออีก {formatMoney(String(remaining))} บาท ถึงเป้า</span>
        ) : (
          <span className="font-medium text-emerald-700">ถึงเป้าแล้ว (เกินเป้า {formatMoney(String(-remaining))} บาท)</span>
        )}
      </div>
    </Card>
  );
}

export default RevenueTargetProgress;
