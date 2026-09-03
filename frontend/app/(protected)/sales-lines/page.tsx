"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listSalesLines } from "@/features/sales-lines/api/sales-lines.api";
import { listHospitals, listSalespeople } from "@/features/master-data/api/master-data.api";
import { fetchKnownProductTypes } from "@/features/products/utils/deriveProductTypes";
import { EntitySummary, SalesLine } from "@/lib/types";
import { getErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/useAuthStore";
import {
  SalesLinesFilters,
  SalesLinesFilterValues,
  SalesLinesTable,
} from "@/features/sales-lines";
import { Pagination } from "@/components/shared/data-table/Pagination";

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

  const [filters, setFilters] = useState<SalesLinesFilterValues>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [salesLines, setSalesLines] = useState<SalesLine[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [salespeople, setSalespeople] = useState<EntitySummary[]>([]);
  const [hospitals, setHospitals] = useState<EntitySummary[]>([]);
  const [productTypes, setProductTypes] = useState<EntitySummary[]>([]);

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

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">ข้อมูลการขาย</h1>
      <p className="mt-1 text-sm text-zinc-600">
        ยอดรวมของหน้านี้: {totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
      </p>

      <div className="mt-4">
        <SalesLinesFilters
          values={filters}
          onChange={handleFilterChange}
          salespeople={salespeople}
          hospitals={hospitals}
          productTypes={productTypes}
        />
      </div>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}

      <div className="mt-4">
        <SalesLinesTable salesLines={salesLines} loading={loading} />
      </div>

      <div className="mt-4">
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>
    </div>
  );
}
