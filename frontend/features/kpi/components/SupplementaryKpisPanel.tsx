"use client";

import { formatKpiNumber, SUPPLEMENTARY_METRIC_LABEL_TH } from "@/lib/kpiLabels";
import { formatMoney, formatThaiMonth } from "@/lib/importLabels";
import { SupplementaryKpiMetric, SupplementaryKpis } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface SupplementaryKpisPanelProps {
  supplementary: SupplementaryKpis;
  onDrillDown: (metric: SupplementaryKpiMetric) => void;
}

function SectionHeader({ metric, onDrillDown }: { metric: SupplementaryKpiMetric; onDrillDown: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="font-medium text-zinc-900">{SUPPLEMENTARY_METRIC_LABEL_TH[metric]}</h3>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onDrillDown}
      >
        ดูที่มา
      </Button>
    </div>
  );
}

export function SupplementaryKpisPanel({ supplementary, onDrillDown }: SupplementaryKpisPanelProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <SectionHeader metric="ACTIVE_CUSTOMERS" onDrillDown={() => onDrillDown("ACTIVE_CUSTOMERS")} />
        <p className="mt-2 text-2xl font-semibold text-zinc-900">
          {supplementary.activeCustomers.count} <span className="text-sm font-normal text-zinc-500">แห่ง</span>
        </p>
      </Card>

      <Card className="p-4">
        <SectionHeader metric="CHURNED_CUSTOMERS" onDrillDown={() => onDrillDown("CHURNED_CUSTOMERS")} />
        <p className="mt-2 text-2xl font-semibold text-zinc-900">
          {supplementary.churnedCustomers.count} <span className="text-sm font-normal text-zinc-500">แห่ง</span>
        </p>
        {supplementary.churnedCustomers.hospitals.length > 0 && (
          <ul className="mt-2 max-h-32 space-y-0.5 overflow-auto text-xs text-zinc-600">
            {supplementary.churnedCustomers.hospitals.map((h) => (
              <li key={h.hospitalId}>
                ไม่สั่งมา {h.monthsSinceLastOrder} เดือน (สั่งล่าสุด {formatThaiMonth(h.lastOrderMonth)} {h.lastOrderYear})
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <SectionHeader metric="PRODUCT_PENETRATION" onDrillDown={() => onDrillDown("PRODUCT_PENETRATION")} />
        <p className="mt-2 text-2xl font-semibold text-zinc-900">
          {formatKpiNumber(supplementary.productPenetration.avgDistinctProductTypesPerCustomer)}{" "}
          <span className="text-sm font-normal text-zinc-500">กลุ่มสินค้าเฉลี่ยต่อลูกค้า</span>
        </p>
        {supplementary.productPenetration.productTypeGroupsSold.length > 0 && (
          <ul className="mt-2 max-h-32 space-y-0.5 overflow-auto text-xs text-zinc-600">
            {supplementary.productPenetration.productTypeGroupsSold.map((g) => (
              <li key={g.productTypeId}>
                {g.name}: {formatKpiNumber(g.revenueShare)}%
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <SectionHeader metric="REVENUE_BY_HOSPITAL" onDrillDown={() => onDrillDown("REVENUE_BY_HOSPITAL")} />
        {supplementary.revenueShareByHospital.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">ไม่มีข้อมูล</p>
        ) : (
          <ul className="mt-2 max-h-32 space-y-0.5 overflow-auto text-xs text-zinc-600">
            {supplementary.revenueShareByHospital.map((h) => (
              <li key={h.hospitalId} className="flex justify-between gap-2">
                <span className="truncate">{h.hospitalName}</span>
                <span className="shrink-0">
                  {formatMoney(String(h.revenue))} บาท ({formatKpiNumber(h.sharePercent)}%)
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4 lg:col-span-2">
        <SectionHeader metric="MONTHLY_TREND" onDrillDown={() => onDrillDown("MONTHLY_TREND")} />
        {supplementary.monthlyRevenueTrend.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">ไม่มีข้อมูล</p>
        ) : (
          <div className="mt-2 flex gap-3 overflow-x-auto text-xs text-zinc-600">
            {supplementary.monthlyRevenueTrend.map((m) => (
              <div key={`${m.year}-${m.month}`} className="shrink-0 rounded border border-zinc-100 px-2 py-1 text-center">
                <p className="whitespace-nowrap">
                  {formatThaiMonth(m.month)} {m.year}
                </p>
                <p className="font-medium text-zinc-900">{formatMoney(String(m.revenue))}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default SupplementaryKpisPanel;
