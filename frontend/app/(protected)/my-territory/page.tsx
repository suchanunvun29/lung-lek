"use client";

/**
 * /my-territory — WACC-P1-011
 *
 * Pattern B + Tabs: the three queues — ขายได้แล้ว / เคยขายแต่หายไป / ยังไม่เคยขาย —
 * each with its row count, one shared FilterBar above the tabs, and the export
 * as the active tab's secondary action (each tab maps to its existing export
 * route; the sold/churned export stays one route covering both).
 *
 * Deep link: ?tab=churned (the dashboard churn item) opens the right queue;
 * switching tabs updates the URL without a navigation.
 *
 * Period comes from the shell (useContextStore — ContextBar renders the global
 * selector for this route), so the page no longer renders its own.
 *
 * Query parameters are unchanged: province/top-N/potential-metric only ever go
 * to the never-sold query, credit-only and product group exactly as before.
 */

import { useCallback, useEffect, useState } from "react";
import { getTeamKpi } from "@/features/kpi";
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
  ProvinceMapping,
  TeamKpiResultRow,
} from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { useContextStore } from "@/store/useContextStore";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { FilterBar, type FilterChip } from "@/components/shared/filters/FilterBar";
import { ExportButton } from "@/components/shared/export/ExportButton";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table/DataTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";

type TerritoryTab = "sold" | "churned" | "never-sold";

const TAB_LABELS: Record<TerritoryTab, string> = {
  sold: "ขายได้แล้ว",
  churned: "เคยขายแต่หายไป",
  "never-sold": "ยังไม่เคยขาย",
};

const TAB_DESCRIPTIONS: Record<TerritoryTab, string> = {
  sold: "โรงพยาบาลในเขตที่มียอดขายในงวดนี้",
  churned: "เคยขายได้ แต่ไม่มีในงวดนี้",
  "never-sold": "โรงพยาบาลรัฐทั่วไป (GOVERNMENT_GENERAL) ในเขตที่ไม่เคยมีประวัติการซื้อ",
};

/** Business wording — the enum key stays in the option's value, never in its text. */
const POTENTIAL_METRIC_OPTIONS = [
  { key: "BEDS", label: "จำนวนเตียง" },
  { key: "CMI", label: "ดัชนีความรุนแรงของผู้ป่วย" },
  { key: "SUM_ADJ_RW", label: "ผลรวมค่าน้ำหนักสัมพัทธ์ของโรงพยาบาล" },
  { key: "OCCUPANCY_RATE", label: "อัตราครองเตียง" },
  { key: "PATIENTS", label: "จำนวนผู้ป่วยใน" },
  { key: "VISITS", label: "จำนวนผู้ป่วยนอก" },
];

function potentialMetricLabel(key: string): string {
  return POTENTIAL_METRIC_OPTIONS.find((option) => option.key === key)?.label ?? key;
}

const DEFAULT_TOP_N = 20;
const DEFAULT_POTENTIAL_METRIC = "BEDS";

function readInitialTab(): TerritoryTab {
  if (typeof window === "undefined") return "sold";
  const value = new URLSearchParams(window.location.search).get("tab");
  return value === "churned" || value === "never-sold" ? value : "sold";
}

function setTabInUrl(tab: TerritoryTab) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  window.history.replaceState(null, "", url.toString());
}

export default function MyTerritoryPage() {
  const token = useAuthStore((state) => state.token);
  const period = useContextStore((state) => state.period);
  const [tab, setTabState] = useState<TerritoryTab>(readInitialTab);
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
  const [topN, setTopN] = useState(DEFAULT_TOP_N);
  const [provinceMappingId, setProvinceMappingId] = useState("");
  const [potentialMetric, setPotentialMetric] = useState(DEFAULT_POTENTIAL_METRIC);

  function setTab(value: TerritoryTab) {
    setTabState(value);
    setTabInUrl(value);
  }

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

  async function exportSoldChurned() {
    if (!token || !salespersonId) return;
    await exportMyTerritoryView(token, salespersonId, period, {
      productTypeId: productTypeId || undefined,
      creditOnly,
    });
  }

  async function exportNeverSold() {
    if (!token || !salespersonId) return;
    await exportNeverSoldHospitals(token, salespersonId, period, {
      topN,
      provinceMappingId: provinceMappingId || undefined,
      potentialMetric,
      productTypeId: productTypeId || undefined,
    });
  }

  function resetFilters() {
    setProductTypeId("");
    setCreditOnly(false);
    setProvinceMappingId("");
    setTopN(DEFAULT_TOP_N);
    setPotentialMetric(DEFAULT_POTENTIAL_METRIC);
  }

  const fallback = view?.mode === "NATIONWIDE_PRODUCT_TYPE_FALLBACK";
  const ownCreditOnly = view?.mode === "OWN_CREDIT_ONLY";

  const selectedProductType = productTypes.find((type) => String(type.id) === productTypeId);
  const selectedProvince = provinces.find((province) => String(province.id) === provinceMappingId);

  const chips: FilterChip[] = [];
  if (selectedProductType) {
    chips.push({
      key: "productType",
      label: `กลุ่มสินค้า: ${selectedProductType.name}`,
      onRemove: () => setProductTypeId(""),
    });
  }
  if (selectedProvince) {
    chips.push({
      key: "province",
      label: `จังหวัด: ${selectedProvince.canonicalName}`,
      onRemove: () => setProvinceMappingId(""),
    });
  }
  if (creditOnly) {
    chips.push({ key: "creditOnly", label: "เฉพาะที่ฉันมีเครดิต", onRemove: () => setCreditOnly(false) });
  }
  if (topN !== DEFAULT_TOP_N) {
    chips.push({ key: "topN", label: `จำนวนสูงสุด ${topN} แห่ง`, onRemove: () => setTopN(DEFAULT_TOP_N) });
  }
  if (potentialMetric !== DEFAULT_POTENTIAL_METRIC) {
    chips.push({
      key: "potentialMetric",
      label: `เกณฑ์ศักยภาพ: ${potentialMetricLabel(potentialMetric)}`,
      onRemove: () => setPotentialMetric(DEFAULT_POTENTIAL_METRIC),
    });
  }

  const soldColumns: DataTableColumn<{ hospital: { id: number; displayName: string }; revenue: number }>[] = [
    {
      key: "hospital",
      header: "โรงพยาบาล",
      mobileRole: "identity",
      sortable: true,
      sortValue: (row) => row.hospital.displayName,
      render: (row) => <span className="font-medium text-zinc-900">{row.hospital.displayName}</span>,
    },
    {
      key: "revenue",
      header: "ยอดขาย",
      numeric: true,
      sortable: true,
      mobileRole: "metric",
      sortValue: (row) => row.revenue,
      render: (row) => formatMoney(row.revenue),
    },
  ];

  const churnedColumns: DataTableColumn<{ hospital: { id: number; displayName: string; province: string | null } }>[] = [
    {
      key: "hospital",
      header: "โรงพยาบาล",
      mobileRole: "identity",
      sortable: true,
      sortValue: (row) => row.hospital.displayName,
      render: (row) => <span className="font-medium text-zinc-900">{row.hospital.displayName}</span>,
    },
    {
      key: "province",
      header: "จังหวัด",
      sortable: true,
      sortValue: (row) => row.hospital.province,
      render: (row) => row.hospital.province ?? "—",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
      <PageHeader
        title="มุมมองพื้นที่รับผิดชอบ"
        description="โรงพยาบาลที่ขายได้แล้ว โรงพยาบาลที่เคยขายได้แต่ไม่มีในงวดนี้ และโรงพยาบาลรัฐที่ยังไม่เคยขายเลย"
      />

      {accountNotLinked && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          บัญชีนี้ยังไม่ได้ผูกกับพนักงานขาย กรุณาติดต่อผู้จัดการ
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* One shared filter block above the tabs */}
      <FilterBar
        chips={chips}
        onReset={resetFilters}
        secondaryFilters={
          <>
            <label className="text-sm font-medium text-zinc-600 flex items-center gap-2">
              จำนวนสูงสุด (Top N)
              <Select value={String(topN)} onChange={(e) => setTopN(Number(e.target.value))} className="w-auto">
                <option value="10">Top 10</option>
                <option value="20">Top 20</option>
                <option value="50">Top 50</option>
                <option value="100">Top 100</option>
              </Select>
            </label>
            <label className="text-sm font-medium text-zinc-600 flex items-center gap-2">
              เกณฑ์ศักยภาพ
              <Select value={potentialMetric} onChange={(e) => setPotentialMetric(e.target.value)} className="w-auto">
                {POTENTIAL_METRIC_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </label>
          </>
        }
      >
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
        <label className="inline-flex items-center gap-2 text-sm text-zinc-700 cursor-pointer pb-1.5">
          <input
            type="checkbox"
            checked={creditOnly}
            onChange={(event) => setCreditOnly(event.target.checked)}
            className="cursor-pointer"
          />
          เฉพาะที่ฉันมีเครดิต
        </label>
      </FilterBar>

      {/* Mode banners — kept in full; removing either would make the numbers read wrong */}
      {fallback && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          พนักงานขายคนนี้ไม่มีเขตที่รับผิดชอบ จึงแสดงข้อมูลตามกลุ่มสินค้าทั่วประเทศ
        </p>
      )}
      {ownCreditOnly && (
        <p className="text-sm text-zinc-600">
          เขตที่ดูแล:{" "}
          {view?.territories.length
            ? view.territories.map((territory) => territory.displayName).join(", ")
            : "ยังไม่มีผู้ดูแล"}{" "}
          · กำลังแสดงเฉพาะรายการที่มีเครดิตของพนักงานขายคนนี้
        </p>
      )}
      {view && !fallback && !ownCreditOnly && (
        <p className="text-sm text-zinc-600">
          เขตที่ดูแล:{" "}
          {view.territories.length
            ? view.territories.map((territory) => territory.displayName).join(", ")
            : "ยังไม่มีผู้ดูแล"}{" "}
          · กำลังแสดงยอดขายระดับเขต
        </p>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value as TerritoryTab)}>
        <div className="overflow-x-auto">
          <TabsList className="max-w-full">
            {(Object.keys(TAB_LABELS) as TerritoryTab[]).map((value) => {
              const count =
                value === "sold"
                  ? view?.soldHospitals.length
                  : value === "churned"
                    ? view?.soldBeforeButNotInPeriod.length
                    : neverSoldView?.neverSoldHospitals.length;
              return (
                <TabsTrigger key={value} value={value} className="whitespace-nowrap">
                  {TAB_LABELS[value]}
                  {typeof count === "number" ? ` (${count.toLocaleString("th-TH")})` : ""}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="sold" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm text-zinc-600">{TAB_DESCRIPTIONS.sold}</p>
            <ExportButton
              label="ส่งออก Excel"
              onExport={exportSoldChurned}
              disabled={!salespersonId || accountNotLinked}
            />
          </div>
          <DataTable
            columns={soldColumns}
            rows={view?.soldHospitals ?? []}
            getRowId={(row) => row.hospital.id}
            caption="โรงพยาบาลที่ขายได้แล้วในงวดนี้"
            loading={loading && !accountNotLinked}
            emptyTitle="ไม่มีรายการ"
          />
        </TabsContent>

        <TabsContent value="churned" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm text-zinc-600">{TAB_DESCRIPTIONS.churned}</p>
            <ExportButton
              label="ส่งออก Excel"
              onExport={exportSoldChurned}
              disabled={!salespersonId || accountNotLinked}
            />
          </div>
          <DataTable
            columns={churnedColumns}
            rows={view?.soldBeforeButNotInPeriod ?? []}
            getRowId={(row) => row.hospital.id}
            caption="โรงพยาบาลที่เคยขายได้แต่ไม่มีในงวดนี้"
            loading={loading && !accountNotLinked}
            emptyTitle="ไม่มีรายการ"
          />
        </TabsContent>

        <TabsContent value="never-sold" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm text-zinc-600">
              {TAB_DESCRIPTIONS["never-sold"]}
              {neverSoldView ? ` · เกณฑ์ศักยภาพ: ${potentialMetricLabel(neverSoldView.potentialMetric)}` : ""}
            </p>
            <ExportButton
              label="ส่งออก Excel"
              onExport={exportNeverSold}
              disabled={!salespersonId || accountNotLinked}
            />
          </div>
          <DataTable
            columns={neverSoldTableColumns(neverSoldView?.potentialMetric)}
            rows={neverSoldView?.neverSoldHospitals ?? []}
            getRowId={(row) => row.id}
            caption="โรงพยาบาลรัฐที่ยังไม่เคยขายเลย"
            loading={neverSoldLoading && !accountNotLinked}
            emptyTitle={
              neverSoldView
                ? `ไม่พบโรงพยาบาลรัฐที่ยังไม่เคยขายตามเงื่อนไขที่เลือก (จากทั้งหมด ${neverSoldView.totalNeverSold.toLocaleString("th-TH")} แห่ง)`
                : "ไม่มีรายการ"
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function neverSoldTableColumns(
  potentialMetric: string | undefined
): DataTableColumn<NeverSoldHospitalsResponse["neverSoldHospitals"][number]>[] {
  return [
    {
      key: "hospital",
      header: "โรงพยาบาล",
      mobileRole: "identity",
      sortable: true,
      sortValue: (row) => row.displayName,
      render: (row) => <span className="font-medium text-zinc-900">{row.displayName}</span>,
    },
    {
      key: "province",
      header: "จังหวัด",
      sortable: true,
      sortValue: (row) => row.province,
      render: (row) => row.province,
    },
    {
      key: "tier",
      header: "ระดับ (Tier)",
      priority: 3,
      sortable: true,
      sortValue: (row) => row.tier,
      render: (row) => row.tier ?? "—",
    },
    {
      key: "metricValue",
      header: potentialMetric ? `ศักยภาพ: ${potentialMetricLabel(potentialMetric)}` : "ศักยภาพ",
      numeric: true,
      sortable: true,
      mobileRole: "metric",
      sortValue: (row) => row.metricValue,
      render: (row) => row.metricValue.toLocaleString("th-TH"),
    },
    {
      key: "territory",
      header: "เขต",
      priority: 2,
      sortValue: (row) => row.territory?.displayName ?? null,
      render: (row) => row.territory?.displayName ?? "—",
    },
  ];
}
