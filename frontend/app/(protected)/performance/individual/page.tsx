"use client";

/**
 * ผลงานรายบุคคล — Pattern A (condensed) — WACC-P1-005
 *
 * The single individual-performance screen, merged from `/kpi` (ScoreCard +
 * SupplementaryKpisPanel) and `/reports/individual` (the same plus
 * RevenueTargetProgress, CompositeScoreBadge, the previous-period delta,
 * CoachingInsightPanel and Export — the superset, which used to 404).
 * Both old routes redirect here.
 *
 * Period and subject come from the shell's ContextBar (useContextStore) — the
 * local selectors both old pages carried are gone. Subject defaults to the
 * viewer's own record and never to "first in list" (same rule as the dashboard,
 * WACC-P1-004): a manager with no subject sees a chooser, an unlinked account
 * sees the existing banner. The subject is still gated server-side by
 * CanViewSalespersonAsync — a forbidden subject arrives as a handled 403.
 *
 * Desktop: KPI row, then two columns — scores left, coaching + supplementary right.
 * Mobile: stacked; Export renders full-width under the header (PageHeader).
 */

import { useEffect, useState } from "react";
import { exportIndividualReport, getIndividualReport } from "@/features/reports/api/reports.api";
import { listSalespeople } from "@/features/master-data/api/master-data.api";
import { getErrorMessage } from "@/lib/api-client";
import { useAbortableEffect } from "@/lib/useAbortableEffect";
import { formatScore, periodLabelTh, SCORED_METRIC_LABEL_TH, SCORED_METRIC_ORDER } from "@/lib/kpiLabels";
import { DrillDownMetric, IndividualReportData, Salesperson } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { useContextStore } from "@/store/useContextStore";
import {
  EmptyState,
  ExportButton,
  KpiTile,
  PageContainer,
  PageHeader,
  SkeletonCard,
  SkeletonKpiRow,
} from "@/components/shared";
import { Card } from "@/components/ui/card";
import { ScoreCard, SupplementaryKpisPanel, KpiDrillDownModal } from "@/features/kpi";
import { SalespersonSwitcher, RevenueTargetProgress } from "@/features/dashboard";
import { CoachingInsightPanel } from "@/features/coaching";

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

export default function IndividualPerformancePage() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);

  const period = useContextStore((state) => state.period);
  const salespersonId = useContextStore((state) => state.salespersonId);
  const setSalespersonId = useContextStore((state) => state.setSalespersonId);

  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [report, setReport] = useState<IndividualReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [drillDownMetric, setDrillDownMetric] = useState<DrillDownMetric | null>(null);

  useEffect(() => {
    if (!token) return;
    listSalespeople(token)
      .then((data) => {
        setSalespeople(data.salespeople);
        // Same default as the shell's ContextBar and the dashboard: the viewer's
        // own record, or none — never "first in list" (WACC-P1-004).
        if (useContextStore.getState().salespersonId === null && currentUser?.id != null) {
          const own = data.salespeople.find((sp) => sp.userId === currentUser.id);
          if (own) setSalespersonId(own.id);
        }
      })
      .catch(() => {
        // salesperson list only feeds the chooser — the page has its own error handling
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useAbortableEffect(
    async (signal) => {
      if (!token || !salespersonId) return;
      setLoading(true);
      try {
        const data = await getIndividualReport(token, String(salespersonId), period, signal);
        if (signal.aborted) return;
        setReport(data);
        setLoadError(null);
      } catch (err) {
        if (!signal.aborted) {
          setReport(null);
          setLoadError(getErrorMessage(err, "โหลดรายงานไม่สำเร็จ"));
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    // reloadNonce only changes via the error state's retry button.
    [token, salespersonId, period, reloadNonce]
  );

  async function handleExport() {
    if (!token || !salespersonId) return;
    await exportIndividualReport(token, String(salespersonId), period);
  }

  const revenueMetric = report?.composite.metrics.find((m) => m.metric === "REVENUE_VS_TARGET") ?? null;
  const composite = report?.composite ?? null;
  const compositeDelta = composite ? formatScoreDelta(composite.composite, report!.previousComposite.composite) : null;
  const previousMetricByKey = new Map(report?.previousComposite.metrics.map((m) => [m.metric, m]) ?? []);

  return (
    <PageContainer width="standard">
      <PageHeader
        title={report ? `ผลงานรายบุคคล — ${report.salesperson.displayName}` : "ผลงานรายบุคคล"}
        description="เป้า vs ผลจริง, KPI ทุกตัว, คะแนนรวม, จุดแข็ง/จุดที่ควรพัฒนา, เทียบกับงวดก่อน — สำหรับใช้ในการประชุมประเมิน"
        meta={report ? `งวด: ${periodLabelTh(report.period)}` : `งวด: ${periodLabelTh(period)}`}
        secondaryActions={[
          <ExportButton
            key="export"
            onExport={handleExport}
            disabled={!report || loading}
            disabledReason="รอโหลดข้อมูลก่อน"
          />,
        ]}
      />

      {!salespersonId && (
        currentUser?.role === "MANAGER" ? (
          <EmptyState
            title="เลือกพนักงานขายเพื่อดูผลงาน"
            description="เลือกได้จากแถบ “มุมมอง” ด้านบนของหน้า หรือจากรายการด้านล่าง — จะไม่แสดงตัวเลขใดจนกว่าจะเลือก"
            className="mt-2"
            action={
              salespeople.length > 0 ? (
                <SalespersonSwitcher
                  salespeople={salespeople}
                  value=""
                  onChange={(id) => setSalespersonId(id ? Number(id) : null)}
                />
              ) : undefined
            }
          />
        ) : (
          <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            บัญชีนี้ยังไม่ได้ผูกกับพนักงานขาย กรุณาติดต่อผู้จัดการ
          </p>
        )
      )}

      {salespersonId && loadError && !loading && (
        <EmptyState
          variant="error"
          title="โหลดรายงานไม่สำเร็จ"
          description={loadError}
          onRetry={() => setReloadNonce((n) => n + 1)}
          className="mt-2"
        />
      )}

      {salespersonId && loading && (
        <div className="mt-2 space-y-4">
          <SkeletonKpiRow />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {salespersonId && !loading && report && revenueMetric && composite && compositeDelta && (
        <div className="space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RevenueTargetProgress metric={revenueMetric} />
            <KpiTile
              label="คะแนนรวม"
              value={composite.composite === null ? "คำนวณไม่ได้" : formatScore(composite.composite)}
              unit={composite.composite === null ? undefined : "/ 100"}
              status={composite.composite === null ? "warning" : "default"}
              comparison={
                <>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                    {composite.computedFromLabel}
                  </span>
                  <p className="mt-1.5 text-xs text-zinc-600">
                    งวดก่อน ({periodLabelTh(report.previousPeriod)}): {formatScore(report.previousComposite.composite)} ·{" "}
                    <span className={`font-medium ${compositeDelta.className}`}>{compositeDelta.text}</span>
                  </p>
                </>
              }
            />
          </div>

          {/* Two-column body: scores left, coaching and supplementary right */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="space-y-4 lg:col-span-3">
              <ScoreCard composite={composite} onDrillDown={(metric) => setDrillDownMetric(metric)} />

              <Card className="p-4">
                <h2 className="text-sm font-medium text-zinc-500">
                  คะแนนรายเกณฑ์ เทียบงวดก่อน ({periodLabelTh(report.previousPeriod)})
                </h2>
                <div className="mt-3 divide-y divide-zinc-100 border-t border-zinc-100">
                  {SCORED_METRIC_ORDER.map((metric) => {
                    const current = composite.metrics.find((m) => m.metric === metric);
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
              </Card>
            </div>

            <div className="space-y-4 lg:col-span-2">
              <CoachingInsightPanel
                salespersonId={report.salesperson.id}
                period={period}
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
    </PageContainer>
  );
}
