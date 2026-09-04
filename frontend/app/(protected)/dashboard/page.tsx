"use client";

/**
 * Dashboard — Pattern A (WACC-P1-001 … P1-004)
 *
 * Four levels, in answer order:
 *   Level 1  the KPI row — composite score first, then revenue vs target, then active customers
 *   Level 2  the "ต้องดำเนินการ" action bar, derived from the already-loaded payload
 *   Level 3  trend and criteria side by side, then the two composition bar lists
 *   Level 4  a collapsed deep-dive — coaching insights and the remaining supplementary metrics
 *
 * Period and subject come from useContextStore via the shell's ContextBar, never from
 * page-local state (WACC-P0-013). There is deliberately no "first in list" fallback for
 * the subject (WACC-P1-004): a manager with no subject picked sees a chooser, an unlinked
 * account sees the existing banner — nobody sees a stranger's numbers under their own name.
 */

import { useEffect, useState } from "react";
import { getDerivedTarget } from "@/features/territories/api/territories.api";
import { getSalespersonKpi, getTeamKpi } from "@/features/kpi/api/kpi.api";
import { listSalespeople } from "@/features/master-data/api/master-data.api";
import { getErrorMessage } from "@/lib/api-client";
import { useAbortableEffect } from "@/lib/useAbortableEffect";
import {
  computeTeamAverageComposite,
  computeTeamAverageScores,
  formatScore,
  periodLabelTh,
} from "@/lib/kpiLabels";
import { DrillDownMetric, DerivedTarget, Salesperson, SalespersonKpiResponse } from "@/lib/types";
import { formatMoney } from "@/lib/importLabels";
import { useAuthStore } from "@/store/useAuthStore";
import { useContextStore } from "@/store/useContextStore";
import {
  EmptyState,
  KpiTile,
  PageContainer,
  PageHeader,
  SkeletonCard,
  SkeletonKpiRow,
} from "@/components/shared";
import {
  ScoreCard,
  SupplementaryKpisPanel,
  KpiDrillDownModal,
} from "@/features/kpi";
import {
  SalespersonSwitcher,
  RevenueTargetProgress,
  MonthlyTrendChart,
  BreakdownBarList,
  ActionNeededBar,
} from "@/features/dashboard";
import { CoachingInsightPanel } from "@/features/coaching";
import { DerivedTargetCard } from "@/features/territories";

/** Metrics whose cards the dashboard renders elsewhere: active customers in the Level-1
 *  row, hospital composition and the trend in Level 3. */
const PANEL_EXCLUDED_METRICS = [
  "ACTIVE_CUSTOMERS",
  "REVENUE_BY_HOSPITAL",
  "MONTHLY_TREND",
] as const;

export default function DashboardPage() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);

  const period = useContextStore((state) => state.period);
  const salespersonId = useContextStore((state) => state.salespersonId);
  const setSalespersonId = useContextStore((state) => state.setSalespersonId);

  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [kpi, setKpi] = useState<SalespersonKpiResponse | null>(null);
  const [teamAverages, setTeamAverages] = useState<ReturnType<typeof computeTeamAverageScores>>({});
  const [teamCompositeAverage, setTeamCompositeAverage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [drillDownMetric, setDrillDownMetric] = useState<DrillDownMetric | null>(null);
  const [accountNotLinked, setAccountNotLinked] = useState(false);
  const [derivedTarget, setDerivedTarget] = useState<DerivedTarget | null>(null);
  const [derivedError, setDerivedError] = useState(false);
  const [derivedLoading, setDerivedLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    listSalespeople(token)
      .then((data) => {
        setSalespeople(data.salespeople);
        // WACC-P0-013 safe automation: default the subject to the viewer's own record,
        // or leave it null (a manager then gets the chooser) — never "first in list"
        // (WACC-P1-004). Same rule the shell's ContextBar applies; both are idempotent.
        if (useContextStore.getState().salespersonId === null && currentUser?.id != null) {
          const own = data.salespeople.find((sp) => sp.userId === currentUser.id);
          if (own) setSalespersonId(own.id);
        }
      })
      .catch(() => {
        // salesperson dropdown is a convenience — nothing else on the page depends on it loading
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useAbortableEffect(
    async (signal) => {
      if (!token) return;
      setLoading(true);
      try {
        const teamData = await getTeamKpi(token, period, signal);
        if (signal.aborted) return;
        if (teamData.reason === "ACCOUNT_NOT_LINKED") {
          setAccountNotLinked(true);
          setKpi(null);
          setTeamAverages({});
          setLoadError(null);
          return;
        }
        setAccountNotLinked(false);
        if (!salespersonId) {
          setKpi(null);
          setTeamAverages({});
          setTeamCompositeAverage(null);
          return;
        }
        const kpiData = await getSalespersonKpi(token, salespersonId, period, signal);
        if (signal.aborted) return;
        setKpi(kpiData);
        setTeamAverages(computeTeamAverageScores(teamData.results));
        setTeamCompositeAverage(computeTeamAverageComposite(teamData.results));
        setLoadError(null);
      } catch (err) {
        if (!signal.aborted) {
          setLoadError(getErrorMessage(err, "โหลด Dashboard ไม่สำเร็จ"));
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

  // GET /targets/derived is monthly-only (/:year/:month), so the card renders for MONTH
  // periods only — a quarter/year selection has no single month to derive from. The fetch
  // is independent of loadDashboard: a failed derive must never break the rest of the page.
  useAbortableEffect(
    async (signal) => {
      if (!token || !salespersonId || period.periodType !== "MONTH") return;
      setDerivedLoading(true);
      setDerivedTarget(null);
      setDerivedError(false);
      try {
        const data = await getDerivedTarget(
          token,
          salespersonId,
          period.year,
          period.periodNumber,
          signal
        );
        if (!signal.aborted) {
          setDerivedTarget(data.derivedTarget);
        }
      } catch {
        if (!signal.aborted) {
          setDerivedError(true);
        }
      } finally {
        if (!signal.aborted) {
          setDerivedLoading(false);
        }
      }
    },
    [token, salespersonId, period]
  );

  const revenueMetric = kpi?.composite.metrics.find((m) => m.metric === "REVENUE_VS_TARGET") ?? null;

  // The salesperson list is the only user→salesperson link the frontend has. When it
  // failed to load, a rendered SALESPERSON can only ever be viewing themselves — the
  // backend's CanViewSalespersonAsync would 403 any other subject before kpi exists.
  const ownSalespersonId =
    salespeople.find((sp) => sp.userId === currentUser?.id)?.id ?? null;
  const viewingSelf =
    kpi !== null &&
    (kpi.salesperson.id === ownSalespersonId || currentUser?.role === "SALESPERSON");

  const title = kpi
    ? viewingSelf
      ? `Dashboard ของ ${kpi.salesperson.displayName}`
      : `ผลงานของ ${kpi.salesperson.displayName}`
    : `สวัสดี, ${currentUser?.displayName}`;

  const composite = kpi?.composite;
  const compositeDelta =
    composite && teamCompositeAverage !== null && composite.composite !== null
      ? composite.composite - teamCompositeAverage
      : null;

  return (
    <PageContainer width="standard">
      <PageHeader
        title={title}
        description="ยอดสะสมเทียบเป้า แนวโน้ม และ KPI เทียบค่าเฉลี่ยทีม"
        meta={`งวด: ${periodLabelTh(period)}`}
      />

      {loadError && !loading && (
        <EmptyState
          variant="error"
          title="โหลด Dashboard ไม่สำเร็จ"
          description={loadError}
          onRetry={() => setReloadNonce((n) => n + 1)}
          className="mt-2"
        />
      )}

      {accountNotLinked && (
        <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          บัญชีนี้ยังไม่ได้ผูกกับพนักงานขาย กรุณาติดต่อผู้จัดการ
        </p>
      )}

      {loading && !accountNotLinked && (
        <div className="mt-2 space-y-4">
          <SkeletonKpiRow />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* WACC-P1-004: no subject selected and none auto-selected means this account has no
          linked salesperson record. A manager picks explicitly; anyone else sees the banner. */}
      {!loading && !accountNotLinked && !loadError && !salespersonId && (
        currentUser?.role === "MANAGER" ? (
          <EmptyState
            title="เลือกพนักงานขายเพื่อดูผลงาน"
            description="เลือกได้จากรายการด้านล่าง หรือจากแถบ “มุมมอง” ด้านบนของหน้า — จะไม่แสดงตัวเลขใดจนกว่าจะเลือก"
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

      {!loading && !accountNotLinked && salespersonId && kpi && revenueMetric && (
        <div className="space-y-4">
          {/* Level 1 — the numbers to know first */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiTile
              label="คะแนนรวม"
              value={composite!.composite === null ? "คำนวณไม่ได้" : formatScore(composite!.composite)}
              unit={composite!.composite === null ? undefined : "/ 100"}
              status={composite!.composite === null ? "warning" : "default"}
              comparison={
                <>
                  {/* Business rule B: the "คิดจาก N จาก 5 เกณฑ์" label stays visible next to the score. */}
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                    {composite!.computedFromLabel}
                  </span>
                  {teamCompositeAverage !== null && composite!.composite !== null && (
                    <p className="mt-1.5 text-xs text-zinc-600">
                      ค่าเฉลี่ยทีม {formatScore(teamCompositeAverage)}
                      {compositeDelta !== null &&
                        (compositeDelta === 0
                          ? " · เท่าค่าเฉลี่ยทีม"
                          : ` · ${compositeDelta > 0 ? "สูงกว่า" : "ต่ำกว่า"}ค่าเฉลี่ย ${formatScore(Math.abs(compositeDelta))}`)}
                    </p>
                  )}
                </>
              }
            />

            <RevenueTargetProgress metric={revenueMetric} />

            <KpiTile
              label="ลูกค้าที่ยัง Active"
              value={String(kpi.supplementary.activeCustomers.count)}
              unit="แห่ง"
              onDrillDown={() => setDrillDownMetric("ACTIVE_CUSTOMERS")}
            />
          </div>

          {/* Level 2 — what to do next, from the payload already loaded */}
          <ActionNeededBar
            supplementary={kpi.supplementary}
            composite={kpi.composite}
            period={period}
            revenueMetric={revenueMetric}
            derivedTarget={derivedTarget}
            derivedUnavailable={derivedLoading || derivedError}
          />

          {/* Level 3 — trend, criteria and composition */}
          {period.periodType === "MONTH" &&
            (derivedTarget ? (
              <DerivedTargetCard target={derivedTarget} />
            ) : derivedError ? (
              <p className="text-sm text-zinc-500">ไม่สามารถโหลดเป้ารายคนที่คำนวณแล้วได้</p>
            ) : null)}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <MonthlyTrendChart
              data={kpi.supplementary.monthlyRevenueTrend}
              onDrillDown={() => setDrillDownMetric("MONTHLY_TREND")}
            />
            <ScoreCard
              composite={kpi.composite}
              onDrillDown={(metric) => setDrillDownMetric(metric)}
              teamAverages={teamAverages}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BreakdownBarList
              title="สัดส่วนยอดตามกลุ่มสินค้า"
              items={kpi.supplementary.productPenetration.productTypeGroupsSold.map((g) => ({
                name: g.name,
                sharePercent: g.revenueShare,
              }))}
            />
            <BreakdownBarList
              title="สัดส่วนยอดตามโรงพยาบาล"
              items={kpi.supplementary.revenueShareByHospital.map((h) => ({
                name: h.hospitalName,
                sharePercent: h.sharePercent,
                secondaryLabel: `${formatMoney(String(h.revenue))} บาท`,
              }))}
              onDrillDown={() => setDrillDownMetric("REVENUE_BY_HOSPITAL")}
            />
          </div>

          {/* Level 4 — deep-dive */}
          <details className="rounded-lg border border-border bg-surface p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--text-primary)]">
              เจาะลึก — Coaching และตัวชี้วัดเพิ่มเติม
            </summary>
            <div className="mt-4 space-y-4">
              <CoachingInsightPanel
                salespersonId={kpi.salesperson.id}
                period={period}
                onDrillDown={(metric) => setDrillDownMetric(metric)}
              />

              <div>
                <h2 className="mb-2 text-lg font-semibold text-zinc-900">ตัวชี้วัดเพิ่มเติม (ไม่คิดคะแนน)</h2>
                <SupplementaryKpisPanel
                  supplementary={kpi.supplementary}
                  onDrillDown={(metric) => setDrillDownMetric(metric)}
                  exclude={[...PANEL_EXCLUDED_METRICS]}
                  showProductGroupList={false}
                />
              </div>
            </div>
          </details>
        </div>
      )}

      {drillDownMetric && kpi && (
        <KpiDrillDownModal
          salespersonId={kpi.salesperson.id}
          metric={drillDownMetric}
          period={period}
          onClose={() => setDrillDownMetric(null)}
        />
      )}
    </PageContainer>
  );
}
