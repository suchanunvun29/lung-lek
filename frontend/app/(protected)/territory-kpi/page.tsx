"use client";

/**
 * /territory-kpi — WACC-P1-012
 *
 * Pattern B + Tabs: เขต / กลุ่มเขต, each on DataTable (sort + search inside the
 * table components). The old "ยอดนอกเขต" bucket box becomes the การกระทบยอด
 * panel: it states the identity the service already computes — ยอดขายบริษัท =
 * ยอดรวมทุกเขต + ยอดผู้ใช้เป้าส่วนบุคคล + ยอดจากโรงพยาบาลที่ยังไม่มีเขต — in
 * business Thai; the numbers are rendered exactly as returned, never recomputed.
 * Export goes through ExportButton to GET /reports/territory-overview/export
 * (WACC-P0-004). Drill-down modal unchanged. Period comes from the shell.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  TerritoryKpiDrillDownModal,
  TerritoryGroupKpiTable,
  TerritoryKpiTable,
  getTerritoryOverview,
} from "@/features/territory-kpi";
import { exportTerritoryOverviewReport } from "@/features/reports/api/reports.api";
import { formatMoney } from "@/lib/importLabels";
import { DrillDownMetric, TerritoryKpiRow, TerritoryOverviewResponse } from "@/lib/types";
import { getErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/useAuthStore";
import { useContextStore } from "@/store/useContextStore";
import { useAbortableEffect } from "@/lib/useAbortableEffect";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { ExportButton } from "@/components/shared/export/ExportButton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/feedback/EmptyState";
import { SkeletonTable } from "@/components/shared/feedback/Skeleton";
import { Button } from "@/components/ui/button";

interface DrillDownState {
  territoryId: number;
  territoryName: string;
  metric: DrillDownMetric;
}

export default function TerritoryKpiPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const token = useAuthStore((state) => state.token);
  const period = useContextStore((state) => state.period);

  const [tab, setTab] = useState<"territories" | "groups">("territories");
  const [reconciliationOpen, setReconciliationOpen] = useState(false);
  const [data, setData] = useState<TerritoryOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  // WACC-P3-005: drill-down driven by ?drill=<metric>&territoryId=<id>
  const drillMetricParam = searchParams.get("drill") as DrillDownMetric | null;
  const drillTerritoryIdParam = searchParams.get("territoryId");

  const activeTerritory = data?.territories.find(
    (t) => String(t.territoryId) === drillTerritoryIdParam
  );

  const isInvalidDrill = Boolean(
    !loading &&
    data &&
    drillMetricParam &&
    drillTerritoryIdParam &&
    !activeTerritory
  );

  const drillDown: DrillDownState | null =
    drillMetricParam && drillTerritoryIdParam && activeTerritory
      ? {
          territoryId: Number(drillTerritoryIdParam),
          territoryName: activeTerritory.name,
          metric: drillMetricParam,
        }
      : null;

  const setDrillDown = (item: { territory: TerritoryKpiRow; metric: DrillDownMetric } | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (item) {
      params.set("drill", item.metric);
      params.set("territoryId", String(item.territory.territoryId));
    } else {
      params.delete("drill");
      params.delete("territoryId");
    }
    const newQuery = params.toString();
    const newUrl = newQuery ? `?${newQuery}` : window.location.pathname;
    startTransition(() => {
      router.replace(newUrl, { scroll: false });
    });
  };

  useAbortableEffect(
    async (signal) => {
      if (!token) return;
      setLoading(true);
      try {
        const response = await getTerritoryOverview(token, period, signal);
        if (signal.aborted) return;
        setData(response);
        setError(null);
      } catch (loadError) {
        if (!signal.aborted) {
          setError(getErrorMessage(loadError, "โหลดรายงาน KPI รายเขตไม่สำเร็จ"));
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [period, token, reloadNonce]
  );

  async function exportReport() {
    if (!token) return;
    await exportTerritoryOverviewReport(token, period);
  }

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <PageHeader
        title="รายงาน KPI รายเขต"
        description="เปรียบเทียบยอดขาย เป้า และคะแนนรวมของแต่ละเขต"
        primaryAction={<ExportButton onExport={exportReport} label="ส่งออก Excel" className="sm:items-end" />}
      />

      {isInvalidDrill && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning-subtle p-4 text-sm text-warning-text">
          <span>ไม่พบเขตนี้หรือลิงก์หมดอายุ (รหัสเขต: {drillTerritoryIdParam})</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDrillDown(null)}
          >
            ปิดการแจ้งเตือน
          </Button>
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={8} columns={6} />
      ) : error ? (
        <EmptyState
          variant="error"
          title="เกิดข้อผิดพลาดในการโหลดรายงาน KPI รายเขต"
          description={error}
          onRetry={() => setReloadNonce((n) => n + 1)}
          isRetrying={loading}
        />
      ) : data ? (
        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <div className="overflow-x-auto">
            <TabsList className="max-w-full">
              <TabsTrigger value="territories">เขต ({data.territories.length.toLocaleString("th-TH")})</TabsTrigger>
              <TabsTrigger value="groups">
                กลุ่มเขต{data.territoryGroups.length > 0 ? ` (${data.territoryGroups.length.toLocaleString("th-TH")})` : ""}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="territories" className="mt-4">
            <TerritoryKpiTable
              territories={data.territories}
              onDrillDown={(territory, metric) => setDrillDown({ territory, metric })}
            />
          </TabsContent>

          <TabsContent value="groups" className="mt-4 space-y-3">
            <p className="text-sm text-text-secondary">
              ยอดของกลุ่มเป็นผลรวมของเขตสมาชิก จึงไม่รวมซ้ำกับยอดรวมในแท็บเขต —
              และจะแสดงผลเมื่อคุณมีสิทธิ์เห็นข้อมูลครบทุกเขตสมาชิกเท่านั้น
            </p>
            <TerritoryGroupKpiTable groups={data.territoryGroups} />
          </TabsContent>
        </Tabs>
      ) : null}

      {/* การกระทบยอด — the reconciliation identity as the service computes it */}
      {data?.buckets && !loading && (
        <section className="mt-6 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-text-primary">การกระทบยอด</h2>
            {/* Collapsible on mobile only; open by default from tablet up */}
            <button
              type="button"
              className="text-sm font-medium text-text-secondary hover:text-text-primary hover:underline cursor-pointer md:hidden"
              aria-expanded={reconciliationOpen}
              onClick={() => setReconciliationOpen((open) => !open)}
            >
              {reconciliationOpen ? "ซ่อน" : "แสดงรายละเอียด"}
            </button>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            ยอดขายบริษัททั้งหมด = ยอดรวมของทุกเขต + ยอดของผู้ใช้เป้าส่วนบุคคล + ยอดจากโรงพยาบาลที่ยังไม่มีเขต
          </p>
          <div className={`${reconciliationOpen ? "block" : "hidden"} md:block`}>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-text-muted">ยอดขายบริษัททั้งหมด</dt>
                <dd className="mt-1 font-semibold text-text-primary font-numeric">{formatMoney(data.buckets.companyTotal)}</dd>
              </div>
              <div>
                <dt className="text-text-muted">ยอดรวมของทุกเขต</dt>
                <dd className="mt-1 font-semibold text-text-primary font-numeric">{formatMoney(data.buckets.territorySum)}</dd>
              </div>
              <div>
                <dt className="text-text-muted">ยอดของผู้ใช้เป้าส่วนบุคคล</dt>
                <dd className="mt-1 font-semibold text-text-primary font-numeric">{formatMoney(data.buckets.personalBucket)}</dd>
              </div>
              <div>
                <dt className="text-text-muted">
                  ยอดจากโรงพยาบาลที่ยังไม่มีเขต ({data.buckets.unassignedHospitalCount.toLocaleString("th-TH")} แห่ง)
                </dt>
                <dd className="mt-1 font-semibold text-text-primary font-numeric">{formatMoney(data.buckets.unassignedBucket)}</dd>
              </div>
            </dl>

            {data.buckets.personalBucketEntries.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                    <tr>
                      <th className="px-4 py-3">พนักงานขายที่ใช้เป้าส่วนบุคคล</th>
                      <th className="px-4 py-3 text-right">ยอดขาย</th>
                      <th className="px-4 py-3 text-right">เป้าส่วนบุคคล</th>
                      <th className="px-4 py-3 text-right">% ถึงเป้า</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.buckets.personalBucketEntries.map((entry) => (
                      <tr key={entry.salespersonId}>
                        <td className="px-4 py-3 text-text-primary">{entry.displayName}</td>
                        <td className="px-4 py-3 text-right text-text-secondary font-numeric">{formatMoney(entry.revenue)}</td>
                        <td className="px-4 py-3 text-right text-text-secondary font-numeric">
                          {entry.personalTarget > 0 ? formatMoney(entry.personalTarget) : <span className="text-xs text-warning">ยังไม่ได้ตั้งเป้า</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-text-primary font-numeric">
                          {entry.achievementPercent === null ? <span className="text-xs text-warning">ยังไม่ได้ตั้งเป้า</span> : `${entry.achievementPercent.toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {drillDown && (
        <TerritoryKpiDrillDownModal
          territoryId={drillDown.territoryId}
          territoryName={drillDown.territoryName}
          metric={drillDown.metric}
          period={period}
          onClose={() => setDrillDown(null)}
        />
      )}
    </div>
  );
}
