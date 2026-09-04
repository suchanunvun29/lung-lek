"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listSalesLines } from "@/features/sales-lines/api/sales-lines.api";
import { listHospitals, listSalespeople } from "@/features/master-data/api/master-data.api";
import { fetchKnownProductTypes } from "@/features/products/utils/deriveProductTypes";
import { EntitySummary, SalesLine } from "@/lib/types";
import { getErrorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/importLabels";
import { useAuthStore } from "@/store/useAuthStore";
import { useContextStore } from "@/store/useContextStore";
import {
  SalesLinesFilters,
  SalesLinesFilterValues,
  SalesLinesTable,
} from "@/features/sales-lines";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import { PageHeader } from "@/components/shared/layout/PageHeader";

const PAGE_SIZE = 50;
const EMPTY_FILTERS: SalesLinesFilterValues = {
  salespersonId: "",
  hospitalId: "",
  productTypeId: "",
  year: "",
  month: "",
};

export default function SalesLinesPage() {
  const token = useAuthStore((state) => state.token);
  const period = useContextStore((state) => state.period);

  const [filters, setFilters] = useState<SalesLinesFilterValues>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [salesLines, setSalesLines] = useState<SalesLine[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [salespeople, setSalespeople] = useState<EntitySummary[]>([]);
  const [hospitals, setHospitals] = useState<EntitySummary[]>([]);
  const [productTypes, setProductTypes] = useState<EntitySummary[]>([]);

  // Safe Automation: synchronize year/month from shell period when periodType is MONTH
  useEffect(() => {
    if (period.periodType === "MONTH") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilters((prev) => ({
        ...prev,
        year: String(period.year),
        month: String(period.periodNumber),
      }));
      setPage(1);
    }
  }, [period.periodType, period.year, period.periodNumber]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [spData, hospitalData, productTypeData] = await Promise.all([
          listSalespeople(token),
          listHospitals(token),
          fetchKnownProductTypes(token),
        ]);
        setSalespeople(spData.salespeople.map((sp) => ({ id: sp.id, displayName: sp.displayName })));
        setHospitals(hospitalData.hospitals.map((h) => ({ id: h.id, displayName: h.displayName })));
        setProductTypes(productTypeData);
      } catch {
        // filter dropdowns are a convenience — table still works without them
      }
    })();
  }, [token]);

  const loadSalesLines = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await listSalesLines(token, {
        salespersonId: filters.salespersonId || undefined,
        hospitalId: filters.hospitalId || undefined,
        productTypeId: filters.productTypeId || undefined,
        year: filters.year ? Number(filters.year) : undefined,
        month: filters.month ? Number(filters.month) : undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setSalesLines(data.data);
      setTotal(data.total);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "โหลดข้อมูลการขายไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token, filters, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSalesLines();
  }, [loadSalesLines]);

  const totalAmount = useMemo(
    () => salesLines.reduce((sum, line) => sum + Number(line.total), 0),
    [salesLines]
  );

  function handleFilterChange(values: SalesLinesFilterValues) {
    setFilters(values);
    setPage(1);
  }

  function handleResetFilters() {
    setFilters({
      ...EMPTY_FILTERS,
      year: period.periodType === "MONTH" ? String(period.year) : "",
      month: period.periodType === "MONTH" ? String(period.periodNumber) : "",
    });
    setPage(1);
  }

  return (
    <PageContainer width="wide">
      <PageHeader
        title="ข้อมูลการขาย"
        meta={`ยอดรวมของหน้านี้: ${formatMoney(totalAmount)} บาท (${salesLines.length} รายการ จากทั้งหมด ${total.toLocaleString("th-TH")} รายการ)`}
      />

      <div className="mb-6">
        <SalesLinesFilters
          values={filters}
          onChange={handleFilterChange}
          salespeople={salespeople}
          hospitals={hospitals}
          productTypes={productTypes}
          onReset={handleResetFilters}
        />
      </div>

      <SalesLinesTable
        salesLines={salesLines}
        loading={loading}
        error={loadError}
        onRetry={loadSalesLines}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />
    </PageContainer>
  );
}
