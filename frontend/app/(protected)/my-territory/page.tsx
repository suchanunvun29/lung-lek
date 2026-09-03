"use client";

import { useCallback, useEffect, useState } from "react";
import { PeriodSelector, getTeamKpi } from "@/features/kpi";
import {
  getMyTerritoryView,
  getNeverSoldHospitals,
  exportMyTerritoryView,
  exportNeverSoldHospitals,
} from "@/features/territories/api/territories.api";
import { listProductTypes } from "@/features/products/api/products.api";
import { listProvinces } from "@/features/hospital-registry";
import { getErrorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/importLabels";
import {
  MyTerritoryViewResponse,
  NeverSoldHospitalsResponse,
  PeriodKey,
  ProvinceMapping,
  TeamKpiResultRow,
} from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

const POTENTIAL_METRIC_OPTIONS = [
  { key: "BEDS", label: "จำนวนเตียง (BEDS)" },
  { key: "CMI", label: "ดัชนีความรุนแรง (CMI)" },
  { key: "SUM_ADJ_RW", label: "ผลรวมค่าน้ำหนักสัมพัทธ์ (SUM_ADJ_RW)" },
  { key: "OCCUPANCY_RATE", label: "อัตราครองเตียง (OCCUPANCY_RATE)" },
  { key: "PATIENTS", label: "จำนวนผู้ป่วยใน (PATIENTS)" },
  { key: "VISITS", label: "จำนวนผู้ป่วยนอก (VISITS)" },
];

function defaultPeriod(): PeriodKey {
  const now = new Date();
  return { periodType: "MONTH", year: now.getFullYear(), periodNumber: now.getMonth() + 1 };
}

export default function MyTerritoryPage() {
  const token = useAuthStore((state) => state.token);
  const [period, setPeriod] = useState<PeriodKey>(defaultPeriod());
  const [people, setPeople] = useState<TeamKpiResultRow[]>([]);
  const [salespersonId, setSalespersonId] = useState("");
  const [productTypes, setProductTypes] = useState<{ id: number; name: string }[]>([]);
  const [productTypeId, setProductTypeId] = useState("");
  const [creditOnly, setCreditOnly] = useState(false);
  const [provinces, setProvinces] = useState<ProvinceMapping[]>([]);
  const [view, setView] = useState<MyTerritoryViewResponse | null>(null);
  const [neverSoldView, setNeverSoldView] = useState<NeverSoldHospitalsResponse | null>(null);
  const [accountNotLinked, setAccountNotLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [neverSoldLoading, setNeverSoldLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Never-sold dual-constraint controls
  const [topN, setTopN] = useState(20);
  const [provinceMappingId, setProvinceMappingId] = useState("");
  const [potentialMetric, setPotentialMetric] = useState("BEDS");

  useEffect(() => {
    if (!token) return;
    void Promise.all([getTeamKpi(token, period), listProductTypes(token), listProvinces(token)])
      .then(([team, types, provRes]) => {
        setPeople(team.results);
        setSalespersonId((current) => current || String(team.results[0]?.salesperson.id ?? ""));
        setAccountNotLinked(team.reason === "ACCOUNT_NOT_LINKED");
        setProductTypes(types.productTypes);
        setProvinces(provRes.provinces);
      })
      .catch((loadError) => setError(getErrorMessage(loadError, "โหลดตัวเลือกไม่สำเร็จ")));
  }, [period, token]);

  const load = useCallback(async () => {
    if (!token || !salespersonId || accountNotLinked) return;
    setLoading(true);
    try {
      const data = await getMyTerritoryView(token, salespersonId, period, {
        productTypeId: productTypeId || undefined,
        creditOnly,
      });
      setView(data);
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "โหลดมุมมองพื้นที่รับผิดชอบไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [accountNotLinked, creditOnly, period, productTypeId, salespersonId, token]);

  const loadNeverSold = useCallback(async () => {
    if (!token || !salespersonId || accountNotLinked) return;
    setNeverSoldLoading(true);
    try {
      const data = await getNeverSoldHospitals(token, salespersonId, period, {
        topN,
        provinceMappingId: provinceMappingId || undefined,
        potentialMetric,
        productTypeId: productTypeId || undefined,
      });
      setNeverSoldView(data);
    } catch (nsError) {
      setError(getErrorMessage(nsError, "โหลดรายการโรงพยาบาลที่ยังไม่เคยขายไม่สำเร็จ"));
    } finally {
      setNeverSoldLoading(false);
    }
  }, [accountNotLinked, period, potentialMetric, productTypeId, provinceMappingId, salespersonId, token, topN]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNeverSold();
  }, [loadNeverSold]);

  async function exportData() {
    if (!token || !salespersonId) return;
    try {
      await exportMyTerritoryView(token, salespersonId, period, {
        productTypeId: productTypeId || undefined,
        creditOnly,
      });
    } catch (exportError) {
      setError(getErrorMessage(exportError, "ส่งออกข้อมูลไม่สำเร็จ"));
    }
  }

  async function exportNeverSoldData() {
    if (!token || !salespersonId) return;
    try {
      await exportNeverSoldHospitals(token, salespersonId, period, {
        topN,
        provinceMappingId: provinceMappingId || undefined,
        potentialMetric,
        productTypeId: productTypeId || undefined,
      });
    } catch (exportError) {
      setError(getErrorMessage(exportError, "ส่งออกข้อมูลโรงพยาบาลที่ไม่เคยขายไม่สำเร็จ"));
    }
  }

  const fallback = view?.mode === "NATIONWIDE_PRODUCT_TYPE_FALLBACK";

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-8">
      {/* Header & Main Filters */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">มุมมองพื้นที่รับผิดชอบ</h1>
            <p className="mt-1 text-sm text-zinc-600">
              โรงพยาบาลที่ขายได้แล้ว โรงพยาบาลที่เคยขายได้แต่ไม่มีในงวดนี้ และโรงพยาบาลรัฐที่ยังไม่เคยขายเลย
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void exportData()}
            disabled={!salespersonId || accountNotLinked}
          >
            Export Excel (ขายได้แล้ว/เคยขาย)
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-zinc-600 flex items-center gap-2">
            พนักงานขาย
            <Select
              value={salespersonId}
              onChange={(event) => setSalespersonId(event.target.value)}
              className="w-auto"
            >
              {people.map((item) => (
                <option key={item.salesperson.id} value={item.salesperson.id}>
                  {item.salesperson.displayName}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm font-medium text-zinc-600 flex items-center gap-2">
            กลุ่มสินค้า
            <Select
              value={productTypeId}
              onChange={(event) => setProductTypeId(event.target.value)}
              className="w-auto"
            >
              <option value="">ทุกกลุ่มสินค้า</option>
              {productTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
            <input
              type="checkbox"
              checked={creditOnly}
              onChange={(event) => setCreditOnly(event.target.checked)}
              className="cursor-pointer"
            />
            เฉพาะที่ฉันมีเครดิต
          </label>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      {accountNotLinked && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          บัญชีนี้ยังไม่ได้ผูกกับพนักงานขาย กรุณาติดต่อผู้จัดการ
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Part 1: Sold & Churned hospitals */}
      {loading && !accountNotLinked && <p className="text-zinc-400">กำลังโหลด...</p>}
      {view && !loading && (
        <div className="space-y-5">
          {fallback ? (
            <p className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              พนักงานขายคนนี้ไม่มีเขตที่รับผิดชอบ จึงแสดงข้อมูลตามกลุ่มสินค้าทั่วประเทศ
            </p>
          ) : (
            <p className="text-sm text-zinc-600">
              เขตที่ดูแล:{" "}
              {view.territories.length
                ? view.territories.map((territory) => territory.displayName).join(", ")
                : "ยังไม่มีผู้ดูแล"}{" "}
              ·{" "}
              {view.mode === "OWN_CREDIT_ONLY"
                ? "กำลังแสดงเฉพาะรายการที่มีเครดิตของพนักงานขายคนนี้"
                : "กำลังแสดงยอดขายระดับเขต"}
            </p>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <section>
              <h2 className="mb-2 text-lg font-semibold text-zinc-900">โรงพยาบาลที่ขายได้แล้ว</h2>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-3 py-2">โรงพยาบาล</th>
                      <th className="px-3 py-2 text-right">ยอดขาย</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {view.soldHospitals.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-3 py-5 text-center text-zinc-400">
                          ไม่มีรายการ
                        </td>
                      </tr>
                    ) : (
                      view.soldHospitals.map((row) => (
                        <tr key={row.hospital.id}>
                          <td className="px-3 py-2">{row.hospital.displayName}</td>
                          <td className="px-3 py-2 text-right">{formatMoney(row.revenue)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-zinc-900">เคยขายได้ แต่ไม่มีในงวดนี้</h2>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-3 py-2">โรงพยาบาล</th>
                      <th className="px-3 py-2">จังหวัด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {view.soldBeforeButNotInPeriod.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-3 py-5 text-center text-zinc-400">
                          ไม่มีรายการ
                        </td>
                      </tr>
                    ) : (
                      view.soldBeforeButNotInPeriod.map((row) => (
                        <tr key={row.hospital.id}>
                          <td className="px-3 py-2">{row.hospital.displayName}</td>
                          <td className="px-3 py-2">{row.hospital.province ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Part 2: Never-sold government hospitals (Module P2 / Phase 16) */}
      <section className="border-t border-zinc-200 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">โรงพยาบาลรัฐที่ยังไม่เคยขายเลย</h2>
            <p className="mt-1 text-sm text-zinc-600">
              โรงพยาบาลรัฐทั่วไป (GOVERNMENT_GENERAL) ในเขตที่ไม่เคยมีประวัติการซื้อ {productTypeId ? "สำหรับกลุ่มสินค้านี้" : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void exportNeverSoldData()}
            disabled={!salespersonId || accountNotLinked}
          >
            Export Excel (โรงพยาบาลที่ยังไม่เคยขาย)
          </Button>
        </div>

        {/* Dual Constraint & Metric Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-zinc-600 flex items-center gap-2">
            จำนวนสูงสุด (Top N)
            <Select
              value={String(topN)}
              onChange={(e) => setTopN(Number(e.target.value))}
              className="w-auto"
            >
              <option value="10">Top 10</option>
              <option value="20">Top 20</option>
              <option value="50">Top 50</option>
              <option value="100">Top 100</option>
            </Select>
          </label>

          <label className="text-sm font-medium text-zinc-600 flex items-center gap-2">
            จังหวัด
            <Select
              value={provinceMappingId}
              onChange={(e) => setProvinceMappingId(e.target.value)}
              className="w-auto"
            >
              <option value="">ทุกจังหวัด</option>
              {provinces.map((prov) => (
                <option key={prov.id} value={prov.id}>
                  {prov.canonicalName}
                </option>
              ))}
            </Select>
          </label>

          <label className="text-sm font-medium text-zinc-600 flex items-center gap-2">
            เกณฑ์ศักยภาพ
            <Select
              value={potentialMetric}
              onChange={(e) => setPotentialMetric(e.target.value)}
              className="w-auto"
            >
              {POTENTIAL_METRIC_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </label>
        </div>

        {neverSoldLoading && !accountNotLinked && (
          <p className="mt-4 text-zinc-400">กำลังโหลดโรงพยาบาลที่ยังไม่เคยขาย...</p>
        )}

        {neverSoldView && !neverSoldLoading && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2 text-center w-16">อันดับ</th>
                  <th className="px-3 py-2">โรงพยาบาล</th>
                  <th className="px-3 py-2">จังหวัด</th>
                  <th className="px-3 py-2">ระดับ (Tier)</th>
                  <th className="px-3 py-2 text-right">ศักยภาพ ({neverSoldView.potentialMetric})</th>
                  <th className="px-3 py-2">เขต</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {neverSoldView.neverSoldHospitals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-zinc-400">
                      ไม่พบโรงพยาบาลรัฐที่ยังไม่เคยขายตามเงื่อนไขที่เลือก (จากทั้งหมด {neverSoldView.totalNeverSold} แห่ง)
                    </td>
                  </tr>
                ) : (
                  neverSoldView.neverSoldHospitals.map((row, index) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2 text-center text-zinc-500">{index + 1}</td>
                      <td className="px-3 py-2 font-medium text-zinc-900">{row.displayName}</td>
                      <td className="px-3 py-2 text-zinc-600">{row.province}</td>
                      <td className="px-3 py-2 text-zinc-600">{row.tier ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-zinc-900 font-mono">
                        {row.metricValue.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-zinc-600">
                        {row.territory ? row.territory.displayName : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
