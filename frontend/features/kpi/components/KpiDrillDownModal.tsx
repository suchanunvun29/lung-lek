"use client";

import { useEffect, useState } from "react";
import { getKpiDrillDown } from "@/features/kpi/api/kpi.api";
import { getErrorMessage } from "@/lib/api-client";
import { formatMoney, formatThaiMonth } from "@/lib/importLabels";
import { metricLabelTh } from "@/lib/kpiLabels";
import { DrillDownMetric, KpiDrillDownResponse, PeriodKey } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { Modal } from "@/components/ui/modal";

export interface KpiDrillDownModalProps {
  salespersonId: number;
  metric: DrillDownMetric;
  period: PeriodKey;
  hospitalId?: number;
  onClose: () => void;
}

export function KpiDrillDownModal({
  salespersonId,
  metric,
  period,
  hospitalId,
  onClose,
}: KpiDrillDownModalProps) {
  const token = useAuthStore((state) => state.token);
  const [data, setData] = useState<KpiDrillDownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    async function load() {
      setLoading(true);
      try {
        const res = await getKpiDrillDown(token!, salespersonId, metric, period, hospitalId);
        setData(res);
        setLoadError(null);
      } catch (err) {
        setLoadError(getErrorMessage(err, "โหลดรายการที่มาไม่สำเร็จ"));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [token, salespersonId, metric, period, hospitalId]);

  return (
    <Modal title={`ที่มาของ: ${metricLabelTh(metric)}`} onClose={onClose} widthClassName="max-w-4xl">
      {loading && <p className="text-text-muted">กำลังโหลด...</p>}
      {loadError && <p className="text-sm text-danger">{loadError}</p>}

      {data && !loading && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
            <span>พนักงานขาย: {data.salesperson.displayName}</span>
            {data.retainedHospitalIds && <span>โรงพยาบาลที่รักษาไว้ได้: {data.retainedHospitalIds.length} แห่ง</span>}
            {data.churnMonths !== undefined && <span>เกณฑ์ churn: ไม่สั่งเกิน {data.churnMonths} เดือน</span>}
            {data.trailingMonths && (
              <span>
                ช่วงเดือนที่พิจารณา: {data.trailingMonths.map((m) => `${formatThaiMonth(m.month)} ${m.year}`).join(", ")}
              </span>
            )}
          </div>

          <div className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-surface">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="sticky top-0 bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="px-3 py-2">วันที่</th>
                  <th className="px-3 py-2">เลขที่ใบแจ้งหนี้</th>
                  <th className="px-3 py-2">โรงพยาบาล</th>
                  <th className="px-3 py-2">สินค้า</th>
                  <th className="px-3 py-2">กลุ่มสินค้า</th>
                  <th className="px-3 py-2 text-right">ยอดรวม (Total)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.salesLines.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                      ไม่มีรายการที่มา
                    </td>
                  </tr>
                )}
                {data.salesLines.map((line) => (
                  <tr key={line.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-text-secondary">
                      {new Date(line.invoiceDate).toLocaleDateString("th-TH")}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{line.invoiceNo}</td>
                    <td className="px-3 py-2 text-text-primary">{line.hospital.displayName}</td>
                    <td className="px-3 py-2 text-text-secondary">{line.product?.name ?? "-"}</td>
                    <td className="px-3 py-2 text-text-secondary">{line.productType?.name ?? "-"}</td>
                    <td className="px-3 py-2 text-right font-medium text-text-primary font-numeric">{formatMoney(line.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default KpiDrillDownModal;
