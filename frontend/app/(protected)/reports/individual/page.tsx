"use client";

import { useCallback, useEffect, useState } from "react";
import { exportIndividualReport, getErrorMessage, getIndividualReport, listSalespeople } from "@/lib/api";
import { formatScore, periodLabelTh, SCORED_METRIC_LABEL_TH, SCORED_METRIC_ORDER } from "@/lib/kpiLabels";
import { DrillDownMetric, IndividualReportData, PeriodKey, Salesperson } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import PeriodSelector from "@/components/kpi/PeriodSelector";
import SalespersonSwitcher from "@/components/dashboard/SalespersonSwitcher";
import ScoreCard from "@/components/kpi/ScoreCard";
import CompositeScoreBadge from "@/components/kpi/CompositeScoreBadge";
import RevenueTargetProgress from "@/components/dashboard/RevenueTargetProgress";
import SupplementaryKpisPanel from "@/components/kpi/SupplementaryKpisPanel";
import KpiDrillDownModal from "@/components/kpi/KpiDrillDownModal";
import CoachingInsightPanel from "@/components/coaching/CoachingInsightPanel";

function defaultPeriod(): PeriodKey {
  const now = new Date();
  return { periodType: "MONTH", year: now.getFullYear(), periodNumber: now.getMonth() + 1 };
}

function formatScoreDelta(current: number | null, previous: number | null): { text: string; className: string } {
  if (current === null || previous === null) {
    return { text: "เทียบไม่ได้ (บางงวดยังไม่มีคะแนน)", className: "text-zinc-400" };
  }
  const delta = Math.round((current - previous) * 100) / 100;
  if (delta === 0) return { text: "ไม่เปลี่ยนแปลง", className: "text-zinc-500" };
  const sign = delta > 0 ? "+" : "";
  return {
    text: `${sign}${formatScore(delta)}`,
    className: delta > 0 ? "text-emerald-700" : "text-red-600",
  };
}

export default function IndividualReportPage() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);

  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [salespersonId, setSalespersonId] = useState<string>("");
  const [period, setPeriod] = useState<PeriodKey>(defaultPeriod());
  const [report, setReport] = useState<IndividualReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [drillDownMetric, setDrillDownMetric] = useState<DrillDownMetric | null>(null);

  useEffect(() => {
    if (!token) return;
    listSalespeople(token)
      .then((data) => {
        setSalespeople(data.salespeople);
        setSalespersonId((prev) => {
          if (prev) return prev;
          const own = data.salespeople.find((sp) => sp.user?.id === currentUser?.id);
          return (own ?? data.salespeople[0])?.id ?? "";
        });
      })
      .catch(() => {
        // salesperson dropdown is a convenience — nothing else on the page depends on it loading
      });
  }, [token, currentUser]);

  const loadReport = useCallback(async () => {
    if (!token || !salespersonId) return;
    setLoading(true);
    try {
      const data = await getIndividualReport(token, salespersonId, period);
      setReport(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "โหลดรายงานไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token, salespersonId, period]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReport();
  }, [loadReport]);

  async function handleExport() {
    if (!token || !salespersonId) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportIndividualReport(token, salespersonId, period);
    } catch (err) {
      setExportError(getErrorMessage(err, "ดาวน์โหลดรายงานไม่สำเร็จ"));
    } finally {
      setExporting(false);
    }
  }

  const revenueMetric = report?.composite.metrics.find((m) => m.metric === "REVENUE_VS_TARGET");
  const previousMetricByKey = new Map(report?.previousComposite.metrics.map((m) => [m.metric, m]) ?? []);

  const ownSalespersonId = salespeople.find((sp) => sp.user?.id === currentUser?.id)?.id;
  const canGenerateInsight =
    currentUser?.role === "MANAGER" || (!!ownSalespersonId && ownSalespersonId === salespersonId);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">รายงาน Coaching รายบุคคล</h1>
      <p className="mt-1 text-sm text-zinc-600">
        เป้า vs ผลจริง, KPI ทุกตัว, คะแนนรวม, จุดแข็ง/จุดที่ควรพัฒนา, เทียบกับงวดก่อน — สำหรับใช้ในการประชุมประเมิน
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <SalespersonSwitcher salespeople={salespeople} value={salespersonId} onChange={setSalespersonId} />
        <PeriodSelector value={period} onChange={setPeriod} />
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || loading || !report}
          className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {exporting ? "กำลังดาวน์โหลด..." : "Export Excel"}
        </button>
      </div>

      {exportError && <p className="mt-3 text-sm text-red-600">{exportError}</p>}
      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}
      {loading && <p className="mt-6 text-zinc-400">กำลังโหลด...</p>}

      {!loading && report && revenueMetric && (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-zinc-900">{report.salesperson.displayName}</h2>
            <p className="text-sm text-zinc-500">งวด: {periodLabelTh(report.period)}</p>
          </div>

          <RevenueTargetProgress metric={revenueMetric} />

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-medium text-zinc-500">คะแนนรวม เทียบงวดก่อน ({periodLabelTh(report.previousPeriod)})</h2>
            <div className="mt-2 flex flex-wrap items-start gap-6">
              <CompositeScoreBadge composite={report.composite} />
              <div className="text-sm">
                <p className="text-zinc-500">งวดก่อน: {formatScore(report.previousComposite.composite)}</p>
                {(() => {
                  const delta = formatScoreDelta(report.composite.composite, report.previousComposite.composite);
                  return <p className={`mt-1 font-medium ${delta.className}`}>{delta.text}</p>;
                })()}
              </div>
            </div>

            <div className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
              {SCORED_METRIC_ORDER.map((metric) => {
                const current = report.composite.metrics.find((m) => m.metric === metric);
                const previous = previousMetricByKey.get(metric);
                const delta = formatScoreDelta(current?.score ?? null, previous?.score ?? null);
                return (
                  <div key={metric} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="text-zinc-700">{SCORED_METRIC_LABEL_TH[metric]}</span>
                    <span className={`font-medium ${delta.className}`}>{delta.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <ScoreCard composite={report.composite} onDrillDown={(metric) => setDrillDownMetric(metric)} />

          <CoachingInsightPanel
            salespersonId={report.salesperson.id}
            period={period}
            canGenerate={canGenerateInsight}
            onDrillDown={(metric) => setDrillDownMetric(metric)}
          />

          <div>
            <h2 className="mb-2 text-lg font-semibold text-zinc-900">ตัวชี้วัดเพิ่มเติม (ไม่คิดคะแนน)</h2>
            <SupplementaryKpisPanel
              supplementary={report.supplementary}
              onDrillDown={(metric) => setDrillDownMetric(metric)}
            />
          </div>
        </div>
      )}

      {drillDownMetric && report && (
        <KpiDrillDownModal
          salespersonId={report.salesperson.id}
          metric={drillDownMetric}
          period={period}
          onClose={() => setDrillDownMetric(null)}
        />
      )}
    </div>
  );
}
