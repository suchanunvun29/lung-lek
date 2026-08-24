"use client";

import { useCallback, useEffect, useState } from "react";
import TerritoryKpiDrillDownModal from "@/components/territoryKpi/TerritoryKpiDrillDownModal";
import TerritoryGroupKpiTable from "@/components/territoryKpi/TerritoryGroupKpiTable";
import TerritoryKpiTable from "@/components/territoryKpi/TerritoryKpiTable";
import PeriodSelector from "@/components/kpi/PeriodSelector";
import { exportTerritoryOverviewReport, getErrorMessage, getTerritoryOverview } from "@/lib/api";
import { formatMoney } from "@/lib/importLabels";
import { DrillDownMetric, PeriodKey, TerritoryKpiRow, TerritoryOverviewResponse } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";

function defaultPeriod(): PeriodKey {
  const now = new Date();
  return { periodType: "MONTH", year: now.getFullYear(), periodNumber: now.getMonth() + 1 };
}

interface DrillDownState { territory: TerritoryKpiRow; metric: DrillDownMetric; }

export default function TerritoryKpiPage() {
  const token = useAuthStore((state) => state.token);
  const [period, setPeriod] = useState<PeriodKey>(defaultPeriod());
  const [data, setData] = useState<TerritoryOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drillDown, setDrillDown] = useState<DrillDownState | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await getTerritoryOverview(token, period);
      setData(response);
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "โหลดรายงาน KPI รายเขตไม่สำเร็จ"));
    } finally { setLoading(false); }
  }, [period, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function exportReport() {
    if (!token) return;
    try { await exportTerritoryOverviewReport(token, period); }
    catch (exportError) { setError(getErrorMessage(exportError, "ส่งออกรายงานไม่สำเร็จ")); }
  }

  return <div className="mx-auto max-w-7xl p-4 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold text-zinc-900">รายงาน KPI รายเขต</h1><p className="mt-1 text-sm text-zinc-600">เปรียบเทียบยอดขาย เป้า และคะแนนรวมของแต่ละเขต</p></div><div className="flex flex-wrap items-center gap-3"><PeriodSelector value={period} onChange={setPeriod} /><button type="button" onClick={() => void exportReport()} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100">Export Excel</button></div></div>{error && <p className="mt-4 text-sm text-red-600">{error}</p>}{loading && <p className="mt-6 text-zinc-400">กำลังโหลด...</p>}{data && !loading && <div className="mt-6 space-y-5"><TerritoryKpiTable territories={data.territories} onDrillDown={(territory, metric) => setDrillDown({ territory, metric })} /><TerritoryGroupKpiTable groups={data.territoryGroups} />{data.buckets && <section className="rounded-lg border border-zinc-200 bg-white p-4"><h2 className="text-base font-semibold text-zinc-900">ยอดนอกเขต</h2><p className="mt-1 text-sm text-zinc-600">ยอดบริษัท = ผลรวมของทุกเขต + ยอดส่วนบุคคล + ยอดที่ยังไม่กำหนดเขต</p><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-zinc-500">ยอดบริษัท</dt><dd className="mt-1 font-semibold text-zinc-900">{formatMoney(data.buckets.companyTotal)}</dd></div><div><dt className="text-zinc-500">ยอดรวมทุกเขต</dt><dd className="mt-1 font-semibold text-zinc-900">{formatMoney(data.buckets.territorySum)}</dd></div><div><dt className="text-zinc-500">ยอดส่วนบุคคล</dt><dd className="mt-1 font-semibold text-zinc-900">{formatMoney(data.buckets.personalBucket)}</dd></div><div><dt className="text-zinc-500">ยอดที่ยังไม่กำหนดเขต ({data.buckets.unassignedHospitalCount} โรงพยาบาล)</dt><dd className="mt-1 font-semibold text-zinc-900">{formatMoney(data.buckets.unassignedBucket)}</dd></div></dl>{data.buckets.personalBucketEntries.length > 0 && <table className="mt-4 min-w-full divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm"><thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500"><tr><th className="px-4 py-3">ผู้ใช้เป้าส่วนบุคคล</th><th className="px-4 py-3 text-right">ยอดขาย</th><th className="px-4 py-3 text-right">เป้าส่วนบุคคล</th><th className="px-4 py-3 text-right">% ถึงเป้า</th></tr></thead><tbody className="divide-y divide-zinc-100">{data.buckets.personalBucketEntries.map((entry) => <tr key={entry.salespersonId}><td className="px-4 py-3 text-zinc-900">{entry.displayName}</td><td className="px-4 py-3 text-right text-zinc-700">{formatMoney(entry.revenue)}</td><td className="px-4 py-3 text-right text-zinc-700">{entry.personalTarget > 0 ? formatMoney(entry.personalTarget) : <span className="text-xs text-amber-700">ยังไม่ได้ตั้งเป้า</span>}</td><td className="px-4 py-3 text-right font-medium text-zinc-900">{entry.achievementPercent === null ? <span className="text-xs text-amber-700">ยังไม่ได้ตั้งเป้า</span> : `${entry.achievementPercent.toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`}</td></tr>)}</tbody></table>}</section>}</div>}{drillDown && <TerritoryKpiDrillDownModal territoryId={drillDown.territory.territoryId} territoryName={drillDown.territory.name} metric={drillDown.metric} period={period} onClose={() => setDrillDown(null)} />}</div>;
}
