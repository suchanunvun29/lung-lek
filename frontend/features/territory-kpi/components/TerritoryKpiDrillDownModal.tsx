"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { getTerritoryKpiDrillDown } from "@/features/territory-kpi/api/territory-kpi.api";
import { getErrorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/importLabels";
import { metricLabelTh } from "@/lib/kpiLabels";
import { DrillDownMetric, PeriodKey, TerritoryKpiDrillDownResponse } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";

export interface TerritoryKpiDrillDownModalProps {
  territoryId: string;
  territoryName: string;
  metric: DrillDownMetric;
  period: PeriodKey;
  onClose: () => void;
}

export function TerritoryKpiDrillDownModal({ territoryId, territoryName, metric, period, onClose }: TerritoryKpiDrillDownModalProps) {
  const token = useAuthStore((state) => state.token);
  const [data, setData] = useState<TerritoryKpiDrillDownResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void getTerritoryKpiDrillDown(token, territoryId, metric, period)
      .then((response) => { setData(response); setError(null); })
      .catch((loadError) => setError(getErrorMessage(loadError, "โหลดรายละเอียดที่มาไม่สำเร็จ")));
  }, [metric, period, territoryId, token]);

  return (
    <Modal title={`ที่มาของ ${metricLabelTh(metric)} · ${territoryName}`} onClose={onClose} widthClassName="max-w-4xl">
      {!data && !error && <p className="text-zinc-400">กำลังโหลด...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && (
        <div className="space-y-5">
          <section>
            <h3 className="text-sm font-semibold text-zinc-900">กลุ่มสินค้าที่ขายได้</h3>
            <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">กลุ่มสินค้า</th>
                    <th className="px-3 py-2 text-right">ยอดขาย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data.productTypes.length === 0 ? (
                    <tr><td colSpan={2} className="px-3 py-5 text-center text-zinc-400">ไม่มีรายการ</td></tr>
                  ) : (
                    data.productTypes.map((productType) => (
                      <tr key={productType.id}>
                        <td className="px-3 py-2">{productType.name}</td>
                        <td className="px-3 py-2 text-right">{formatMoney(productType.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h3 className="text-sm font-semibold text-zinc-900">โรงพยาบาลที่ขายให้</h3>
            <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="sticky top-0 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">โรงพยาบาล</th>
                    <th className="px-3 py-2 text-right">ยอดขาย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data.hospitals.length === 0 ? (
                    <tr><td colSpan={2} className="px-3 py-5 text-center text-zinc-400">ไม่มีรายการ</td></tr>
                  ) : (
                    data.hospitals.map((hospital) => (
                      <tr key={hospital.id}>
                        <td className="px-3 py-2">{hospital.name}</td>
                        <td className="px-3 py-2 text-right">{formatMoney(hospital.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}

export default TerritoryKpiDrillDownModal;
