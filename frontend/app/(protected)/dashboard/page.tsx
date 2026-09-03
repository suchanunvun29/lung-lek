"use client";

import { useCallback, useEffect, useState } from "react";
import { getDerivedTarget } from "@/features/territories/api/territories.api";
import { getSalespersonKpi, getTeamKpi } from "@/features/kpi/api/kpi.api";
import { listSalespeople } from "@/features/master-data/api/master-data.api";
import { getErrorMessage } from "@/lib/api-client";
import { computeTeamAverageScores } from "@/lib/kpiLabels";
import { DrillDownMetric, DerivedTarget, PeriodKey, Salesperson, SalespersonKpiResponse } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import {
  PeriodSelector,
  ScoreCard,
  SupplementaryKpisPanel,
  KpiDrillDownModal,
} from "@/features/kpi";
import {
  SalespersonSwitcher,
  RevenueTargetProgress,
  MonthlyTrendChart,
  BreakdownPieChart,
} from "@/features/dashboard";
import { CoachingInsightPanel } from "@/features/coaching";
import { DerivedTargetCard } from "@/features/territories";

function defaultPeriod(): PeriodKey {
  const now = new Date();
  return { periodType: "MONTH", year: now.getFullYear(), periodNumber: now.getMonth() + 1 };
}

export default function DashboardPage() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);

  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [salespersonId, setSalespersonId] = useState<string>("");
  const [period, setPeriod] = useState<PeriodKey>(defaultPeriod());
  const [kpi, setKpi] = useState<SalespersonKpiResponse | null>(null);
  const [teamAverages, setTeamAverages] = useState<ReturnType<typeof computeTeamAverageScores>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drillDownMetric, setDrillDownMetric] = useState<DrillDownMetric | null>(null);
  const [accountNotLinked, setAccountNotLinked] = useState(false);
  const [derivedTarget, setDerivedTarget] = useState<DerivedTarget | null>(null);
  const [derivedError, setDerivedError] = useState(false);

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

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const teamData = await getTeamKpi(token, period);
      if (teamData.reason === "ACCOUNT_NOT_LINKED") {
        setAccountNotLinked(true);
        setKpi(null);
        setTeamAverages({});
        setLoadError(null);
        return;
      }
      setAccountNotLinked(false);
      if (!salespersonId) return;
      const kpiData = await getSalespersonKpi(token, salespersonId, period);
      setKpi(kpiData);
      setTeamAverages(computeTeamAverageScores(teamData.results));
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "โหลด Dashboard ไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token, salespersonId, period]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();
  }, [loadDashboard]);

  // GET /targets/derived is monthly-only (/:year/:month), so the card renders for MONTH
  // periods only — a quarter/year selection has no single month to derive from. The fetch
  // is independent of loadDashboard: a failed derive must never break the rest of the page.
  const loadDerivedTarget = useCallback(async () => {
    if (!token || !salespersonId || period.periodType !== "MONTH") return;
    setDerivedTarget(null);
    setDerivedError(false);
    try {
      const data = await getDerivedTarget(token, salespersonId, period.year, period.periodNumber);
      setDerivedTarget(data.derivedTarget);
    } catch {
      setDerivedError(true);
    }
  }, [token, salespersonId, period]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDerivedTarget();
  }, [loadDerivedTarget]);

  const revenueMetric = kpi?.composite.metrics.find((m) => m.metric === "REVENUE_VS_TARGET");

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">
        {kpi ? `Dashboard ของ ${kpi.salesperson.displayName}` : `สวัสดี, ${currentUser?.displayName}`}
      </h1>
      <p className="mt-1 text-sm text-zinc-600">ยอดสะสมเทียบเป้า แนวโน้ม และ KPI เทียบค่าเฉลี่ยทีม</p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <SalespersonSwitcher salespeople={salespeople} value={salespersonId} onChange={setSalespersonId} />
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}
      {accountNotLinked && <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">บัญชีนี้ยังไม่ได้ผูกกับพนักงานขาย กรุณาติดต่อผู้จัดการ</p>}
      {loading && <p className="mt-6 text-zinc-400">กำลังโหลด...</p>}

      {!loading && !accountNotLinked && kpi && revenueMetric && (
        <div className="mt-6 space-y-4">
          <RevenueTargetProgress metric={revenueMetric} />

          {period.periodType === "MONTH" &&
            (derivedTarget ? (
              <DerivedTargetCard target={derivedTarget} />
            ) : derivedError ? (
              <p className="text-sm text-zinc-500">ไม่สามารถโหลดเป้ารายคนที่คำนวณแล้วได้</p>
            ) : null)}

          <MonthlyTrendChart data={kpi.supplementary.monthlyRevenueTrend} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BreakdownPieChart
              title="สัดส่วนยอดตามกลุ่มสินค้า"
              data={kpi.supplementary.productPenetration.productTypeGroupsSold.map((g) => ({
                name: g.name,
                value: g.revenueShare,
              }))}
            />
            <BreakdownPieChart
              title="สัดส่วนยอดตามโรงพยาบาล"
              data={kpi.supplementary.revenueShareByHospital.map((h) => ({
                name: h.hospitalName,
                value: h.sharePercent,
              }))}
            />
          </div>

          <ScoreCard
            composite={kpi.composite}
            onDrillDown={(metric) => setDrillDownMetric(metric)}
            teamAverages={teamAverages}
          />

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
            />
          </div>
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
    </div>
  );
}
