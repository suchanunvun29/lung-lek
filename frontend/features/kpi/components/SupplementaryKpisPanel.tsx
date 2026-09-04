"use client";

import { formatKpiNumber, SUPPLEMENTARY_METRIC_LABEL_TH } from "@/lib/kpiLabels";
import { formatMoney, formatThaiMonth } from "@/lib/importLabels";
import { SupplementaryKpiMetric, SupplementaryKpis } from "@/lib/types";
import { KpiTile } from "@/components/shared/kpi/KpiTile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface SupplementaryKpisPanelProps {
  supplementary: SupplementaryKpis;
  onDrillDown: (metric: SupplementaryKpiMetric) => void;
  /**
   * Metrics to skip entirely — for host pages that already render them from the same
   * payload elsewhere (the dashboard's Level-1 row and Level-3 charts). Pages without
   * another representation (/kpi, /reports/individual) leave this unset and every
   * card renders, so no data disappears from those screens.
   */
  exclude?: SupplementaryKpiMetric[];
  /**
   * Hides the product-group share list inside the penetration card — the host page
   * renders the same composition as a chart (BreakdownBarList) instead.
   */
  showProductGroupList?: boolean;
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

export function SupplementaryKpisPanel({
  supplementary,
  onDrillDown,
  exclude,
  showProductGroupList = true,
}: SupplementaryKpisPanelProps) {
  const hidden = new Set(exclude ?? []);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {!hidden.has("ACTIVE_CUSTOMERS") && (
        <KpiTile
          label={SUPPLEMENTARY_METRIC_LABEL_TH.ACTIVE_CUSTOMERS}
          value={String(supplementary.activeCustomers.count)}
          unit="แห่ง"
          onDrillDown={() => onDrillDown("ACTIVE_CUSTOMERS")}
        />
      )}

      {!hidden.has("CHURNED_CUSTOMERS") && (
        <KpiTile
          label={SUPPLEMENTARY_METRIC_LABEL_TH.CHURNED_CUSTOMERS}
          value={String(supplementary.churnedCustomers.count)}
          unit="แห่ง"
          onDrillDown={() => onDrillDown("CHURNED_CUSTOMERS")}
        >
          {supplementary.churnedCustomers.hospitals.length > 0 && (
            <ul className="mt-2 max-h-32 space-y-0.5 overflow-auto text-xs text-zinc-600">
              {supplementary.churnedCustomers.hospitals.map((h) => (
                <li key={h.hospitalId}>
                  ไม่สั่งมา {h.monthsSinceLastOrder} เดือน (สั่งล่าสุด {formatThaiMonth(h.lastOrderMonth)} {h.lastOrderYear})
                </li>
              ))}
            </ul>
          )}
        </KpiTile>
      )}

      {!hidden.has("PRODUCT_PENETRATION") && (
        <KpiTile
          label={SUPPLEMENTARY_METRIC_LABEL_TH.PRODUCT_PENETRATION}
          value={formatKpiNumber(supplementary.productPenetration.avgDistinctProductTypesPerCustomer)}
          unit="กลุ่มสินค้าเฉลี่ยต่อลูกค้า"
          onDrillDown={() => onDrillDown("PRODUCT_PENETRATION")}
        >
          {showProductGroupList && supplementary.productPenetration.productTypeGroupsSold.length > 0 && (
            <ul className="mt-2 max-h-32 space-y-0.5 overflow-auto text-xs text-zinc-600">
              {supplementary.productPenetration.productTypeGroupsSold.map((g) => (
                <li key={g.productTypeId}>
                  {g.name}: {formatKpiNumber(g.revenueShare)}%
                </li>
              ))}
            </ul>
          )}
        </KpiTile>
      )}

      {!hidden.has("REVENUE_BY_HOSPITAL") && (
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
      )}

      {!hidden.has("MONTHLY_TREND") && (
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
      )}
    </div>
  );
}

export default SupplementaryKpisPanel;
