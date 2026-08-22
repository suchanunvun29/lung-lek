"use client";

import { useCallback, useEffect, useState } from "react";
import PeriodSelector from "@/components/kpi/PeriodSelector";
import { exportMyTerritoryView, getErrorMessage, getMyTerritoryView, getTeamKpi, listProductTypes } from "@/lib/api";
import { formatMoney } from "@/lib/importLabels";
import { MyTerritoryViewResponse, PeriodKey, TeamKpiResultRow } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";

function defaultPeriod(): PeriodKey { const now = new Date(); return { periodType: "MONTH", year: now.getFullYear(), periodNumber: now.getMonth() + 1 }; }

export default function MyTerritoryPage() {
  const token = useAuthStore((state) => state.token);
  const [period, setPeriod] = useState<PeriodKey>(defaultPeriod());
  const [people, setPeople] = useState<TeamKpiResultRow[]>([]);
  const [salespersonId, setSalespersonId] = useState("");
  const [productTypes, setProductTypes] = useState<{ id: string; name: string }[]>([]);
  const [productTypeId, setProductTypeId] = useState("");
  const [creditOnly, setCreditOnly] = useState(false);
  const [view, setView] = useState<MyTerritoryViewResponse | null>(null);
  const [accountNotLinked, setAccountNotLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!token) return; void Promise.all([getTeamKpi(token, period), listProductTypes(token)]).then(([team, types]) => { setPeople(team.results); setSalespersonId((current) => current || team.results[0]?.salesperson.id || ""); setAccountNotLinked(team.reason === "ACCOUNT_NOT_LINKED"); setProductTypes(types.productTypes); }).catch((loadError) => setError(getErrorMessage(loadError, "โหลดตัวเลือกไม่สำเร็จ"))); }, [period, token]);

  const load = useCallback(async () => { if (!token || !salespersonId || accountNotLinked) return; setLoading(true); try { const data = await getMyTerritoryView(token, salespersonId, period, { productTypeId: productTypeId || undefined, creditOnly }); setView(data); setError(null); } catch (loadError) { setError(getErrorMessage(loadError, "โหลดมุมมองพื้นที่รับผิดชอบไม่สำเร็จ")); } finally { setLoading(false); } }, [accountNotLinked, creditOnly, period, productTypeId, salespersonId, token]);
  useEffect(() => { // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(); }, [load]);

  async function exportData() { if (!token || !salespersonId) return; try { await exportMyTerritoryView(token, salespersonId, period, { productTypeId: productTypeId || undefined, creditOnly }); } catch (exportError) { setError(getErrorMessage(exportError, "ส่งออกข้อมูลไม่สำเร็จ")); } }

  const fallback = view?.mode === "NATIONWIDE_PRODUCT_TYPE_FALLBACK";
  return <div className="mx-auto max-w-6xl p-4 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold text-zinc-900">มุมมองพื้นที่รับผิดชอบ</h1><p className="mt-1 text-sm text-zinc-600">โรงพยาบาลที่ขายได้แล้วและโรงพยาบาลที่เคยขายได้แต่ไม่มีในงวดนี้</p></div><button type="button" onClick={() => void exportData()} disabled={!salespersonId || accountNotLinked} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50">Export Excel</button></div><div className="mt-4 flex flex-wrap items-center gap-3"><label className="text-sm font-medium text-zinc-600">พนักงานขาย <select value={salespersonId} onChange={(event) => setSalespersonId(event.target.value)} className="ml-2 rounded-md border border-zinc-300 px-3 py-2">{people.map((item) => <option key={item.salesperson.id} value={item.salesperson.id}>{item.salesperson.displayName}</option>)}</select></label><label className="text-sm font-medium text-zinc-600">กลุ่มสินค้า <select value={productTypeId} onChange={(event) => setProductTypeId(event.target.value)} className="ml-2 rounded-md border border-zinc-300 px-3 py-2"><option value="">ทุกกลุ่มสินค้า</option>{productTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label><label className="inline-flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" checked={creditOnly} onChange={(event) => setCreditOnly(event.target.checked)} />เฉพาะที่ฉันมีเครดิต</label><PeriodSelector value={period} onChange={setPeriod} /></div>{accountNotLinked && <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">บัญชีนี้ยังไม่ได้ผูกกับพนักงานขาย กรุณาติดต่อผู้จัดการ</p>}{error && <p className="mt-4 text-sm text-red-600">{error}</p>}{loading && !accountNotLinked && <p className="mt-6 text-zinc-400">กำลังโหลด...</p>}{view && !loading && <div className="mt-6 space-y-5">{fallback ? <p className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">พนักงานขายคนนี้ไม่มีเขตที่รับผิดชอบ จึงแสดงข้อมูลตามกลุ่มสินค้าทั่วประเทศ</p> : <p className="text-sm text-zinc-600">เขตที่ดูแล: {view.territories.length ? view.territories.map((territory) => territory.displayName).join(", ") : "ยังไม่มีผู้ดูแล"} · {view.mode === "OWN_CREDIT_ONLY" ? "กำลังแสดงเฉพาะรายการที่มีเครดิตของพนักงานขายคนนี้" : "กำลังแสดงยอดขายระดับเขต"}</p>}<div className="grid gap-5 lg:grid-cols-2"><section><h2 className="mb-2 text-lg font-semibold text-zinc-900">โรงพยาบาลที่ขายได้แล้ว</h2><div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white"><table className="min-w-full divide-y divide-zinc-200 text-sm"><thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-3 py-2">โรงพยาบาล</th><th className="px-3 py-2 text-right">ยอดขาย</th></tr></thead><tbody className="divide-y divide-zinc-100">{view.soldHospitals.length === 0 ? <tr><td colSpan={2} className="px-3 py-5 text-center text-zinc-400">ไม่มีรายการ</td></tr> : view.soldHospitals.map((row) => <tr key={row.hospital.id}><td className="px-3 py-2">{row.hospital.displayName}</td><td className="px-3 py-2 text-right">{formatMoney(row.revenue)}</td></tr>)}</tbody></table></div></section><section><h2 className="mb-2 text-lg font-semibold text-zinc-900">เคยขายได้ แต่ไม่มีในงวดนี้</h2><div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white"><table className="min-w-full divide-y divide-zinc-200 text-sm"><thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-3 py-2">โรงพยาบาล</th><th className="px-3 py-2">จังหวัด</th></tr></thead><tbody className="divide-y divide-zinc-100">{view.soldBeforeButNotInPeriod.length === 0 ? <tr><td colSpan={2} className="px-3 py-5 text-center text-zinc-400">ไม่มีรายการ</td></tr> : view.soldBeforeButNotInPeriod.map((hospital) => <tr key={hospital.id}><td className="px-3 py-2">{hospital.displayName}</td><td className="px-3 py-2">{hospital.province ?? "—"}</td></tr>)}</tbody></table></div></section></div></div>}</div>;
}
