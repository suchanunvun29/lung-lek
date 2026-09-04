"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PeriodSelector } from "@/features/kpi";
import {
  getTerritoryProductRanking,
  getTerritoryKpiTeam,
  exportTerritoryProductRanking,
} from "@/features/territory-kpi/api/territory-kpi.api";
import { formatMoney } from "@/lib/importLabels";
import { periodLabelTh } from "@/lib/kpiLabels";
import { PeriodKey, TerritoryProductRankingItem, TerritoryProductRankingResponse } from "@/lib/types";
import { getErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/useAuthStore";
import { useContextStore } from "@/store/useContextStore";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { ExportButton } from "@/components/shared/export/ExportButton";
import { FilterBar } from "@/components/shared/filters/FilterBar";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table/DataTable";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

function defaultPeriod(): PeriodKey {
  const now = new Date();
  return { periodType: "MONTH", year: now.getFullYear(), periodNumber: now.getMonth() + 1 };
}

const statusLabel = {
  NEVER_SOLD_IN_TERRITORY: "ยังไม่เคยขายในเขตนี้เลย",
  SOLD_BEFORE_NOT_IN_PERIOD: "เคยขายได้ แต่ไม่มีในงวดที่เลือก",
};

interface RankedProductItem extends TerritoryProductRankingItem {
  serverRank: number;
}

export default function TerritoryProductsPage() {
  const token = useAuthStore((s) => s.token);
  const period = useContextStore((s) => s.period);
  const setPeriod = useContextStore((s) => s.setPeriod);
  const territoryId = useContextStore((s) => s.territoryId);
  const setTerritoryId = useContextStore((s) => s.setTerritoryId);

  const [territories, setTerritories] = useState<{ id: number; name: string }[]>([]);
  const [data, setData] = useState<TerritoryProductRankingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    void getTerritoryKpiTeam(token, period)
      .then((r) => {
        const entries = r.territories.map((x) => ({ id: x.territoryId, name: x.name }));
        setTerritories(entries);
        if (territoryId === null && entries.length > 0) {
          setTerritoryId(entries[0].id);
        }
      })
      .catch((e) => setError(getErrorMessage(e, "โหลดรายชื่อเขตไม่สำเร็จ")));
  }, [period, territoryId, token, setTerritoryId]);

  const load = useCallback(async () => {
    if (!token || territoryId === null) return;
    setLoading(true);
    try {
      setData(await getTerritoryProductRanking(token, String(territoryId), period));
      setError(null);
    } catch (e) {
      setData(null);
      setError(getErrorMessage(e, "โหลดอันดับสินค้าไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [period, territoryId, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function exportFile() {
    if (!token || territoryId === null) return;
    await exportTerritoryProductRanking(token, String(territoryId), period);
  }

  function resetFilters() {
    setPeriod(defaultPeriod());
    if (territories.length > 0) {
      setTerritoryId(territories[0].id);
    }
  }

  const territoryName = territories.find((t) => t.id === territoryId)?.name ?? "—";

  const items = data?.items;
  const currentTerritoryName = data?.territory.name ?? "—";
  const currentOwnerNames = data?.territory.ownerNames.join(", ") || "—";

  const rankedItems: RankedProductItem[] = useMemo(() => {
    if (!items) return [];
    return items.map((item, index) => ({
      ...item,
      serverRank: index + 1,
    }));
  }, [items]);

  const columns: DataTableColumn<RankedProductItem>[] = useMemo(
    () => [
      {
        key: "serverRank",
        header: "อันดับ (ระบบ)",
        render: (item) => (
          <span className="font-semibold text-text-muted font-numeric">{item.serverRank}</span>
        ),
        numeric: true,
        sortable: true,
        sortValue: (item) => item.serverRank,
        priority: 1,
        mobileRole: "meta",
      },
      {
        key: "code",
        header: "รหัส",
        render: (item) => (
          <span
            title={item.code === "—" ? "สินค้านี้ยังไม่มีรหัสจากแคตตาล็อก" : undefined}
            className="text-text-secondary font-mono text-xs"
          >
            {item.code}
          </span>
        ),
        sortable: true,
        sortValue: (item) => item.code,
        priority: 2,
        mobileRole: "meta",
      },
      {
        key: "name",
        header: "สินค้า",
        render: (item) => <span className="font-medium text-text-primary">{item.name}</span>,
        sortable: true,
        sortValue: (item) => item.name,
        priority: 1,
        mobileRole: "identity",
      },
      {
        key: "productType",
        header: "กลุ่มสินค้า",
        render: (item) => item.productType.name,
        sortable: true,
        sortValue: (item) => item.productType.name,
        priority: 2,
        mobileRole: "meta",
      },
      {
        key: "territory",
        header: "เขต",
        render: () => currentTerritoryName,
        priority: 3,
        mobileRole: "meta",
      },
      {
        key: "owners",
        header: "ผู้ดูแลเขต",
        render: () => currentOwnerNames,
        priority: 3,
        mobileRole: "meta",
      },
      {
        key: "revenue",
        header: "ยอดขาย",
        render: (item) => formatMoney(item.revenue),
        numeric: true,
        sortable: true,
        sortValue: (item) => Number(item.revenue),
        priority: 1,
        mobileRole: "metric",
      },
      {
        key: "quantity",
        header: "จำนวน",
        render: (item) => item.quantity.toLocaleString("th-TH", { maximumFractionDigits: 2 }),
        numeric: true,
        sortable: true,
        sortValue: (item) => item.quantity,
        priority: 2,
        mobileRole: "meta",
      },
      {
        key: "zeroSaleStatus",
        header: "สถานะ",
        render: (item) =>
          item.zeroSaleStatus ? (
            <Badge variant="secondary" className="text-xs">
              {statusLabel[item.zeroSaleStatus]}
            </Badge>
          ) : null,
        priority: 2,
        mobileRole: "meta",
      },
    ],
    [currentTerritoryName, currentOwnerNames]
  );

  return (
    <PageContainer width="standard" className="space-y-6">
      <PageHeader
        title="อันดับสินค้ารายเขต"
        description="เรียงตามยอดขายของเขตในงวดที่เลือก"
        controls={false}
        primaryAction={
          <ExportButton
            onExport={exportFile}
            label="ส่งออก Excel"
            disabled={territoryId === null || loading}
          />
        }
      />

      <FilterBar
        chips={[
          { key: "territory", label: `เขต: ${territoryName}` },
          { key: "period", label: `งวด: ${periodLabelTh(period)}` },
        ]}
        onReset={resetFilters}
      >
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <span>เขต</span>
          <Select
            value={territoryId !== null ? String(territoryId) : ""}
            onChange={(e) => setTerritoryId(e.target.value ? Number(e.target.value) : null)}
            className="w-auto"
            aria-label="เลือกเขต"
          >
            {territories.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </label>
        <PeriodSelector value={period} onChange={setPeriod} />
      </FilterBar>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger-subtle p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {data?.zeroSaleWarning && (
        <div className="rounded-lg border border-warning/30 bg-warning-subtle p-3 text-sm text-warning">
          {data.zeroSaleWarning}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rankedItems}
        getRowId={(item) => item.productId}
        caption="ตารางอันดับสินค้ารายเขต"
        loading={loading}
        searchable
        searchPlaceholder="ค้นหาชื่อสินค้า รหัส หรือกลุ่มสินค้า…"
        searchPredicate={(item, q) =>
          item.name.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          item.productType.name.toLowerCase().includes(q)
        }
        emptyTitle="ไม่มีข้อมูลการขายสินค้าในงวดนี้"
        emptyDescription="ลองเปลี่ยนเขตหรือเลือกงวดอื่นเพื่อดูข้อมูล"
      />

      {data?.personalBucket && data.personalBucket.length > 0 && (
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-semibold text-text-primary">ยอดขายส่วนบุคคล</h2>
          <p className="mt-1 text-xs text-text-muted">ยอดนี้ไม่ถูกรวมในเขตใด</p>
          <ul className="mt-3 divide-y divide-border/60 text-sm">
            {data.personalBucket.map((item) => (
              <li key={item.productId} className="flex items-center justify-between py-1.5">
                <span className="text-text-primary">{item.name}</span>
                <span className="font-numeric font-medium text-text-secondary">
                  {formatMoney(item.revenue)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageContainer>
  );
}
