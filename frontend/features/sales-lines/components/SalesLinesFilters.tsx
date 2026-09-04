"use client";

import { useCallback, useMemo } from "react";
import { EntitySummary } from "@/lib/types";
import { formatThaiMonth } from "@/lib/importLabels";
import { Select } from "@/components/ui/select";
import { FilterBar, type FilterChip } from "@/components/shared/filters/FilterBar";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export interface SalesLinesFilterValues {
  salespersonId: string;
  hospitalId: string;
  productTypeId: string;
  year: string;
  month: string;
}

export interface SalesLinesFiltersProps {
  values: SalesLinesFilterValues;
  onChange: (values: SalesLinesFilterValues) => void;
  salespeople: EntitySummary[];
  hospitals: EntitySummary[];
  productTypes: EntitySummary[];
  onReset?: () => void;
}

export function SalesLinesFilters({
  values,
  onChange,
  salespeople,
  hospitals,
  productTypes,
  onReset,
}: SalesLinesFiltersProps) {
  const update = useCallback((partial: Partial<SalesLinesFilterValues>) => {
    onChange({ ...values, ...partial });
  }, [onChange, values]);

  const chips = useMemo<FilterChip[]>(() => {
    const list: FilterChip[] = [];
    if (values.salespersonId) {
      const sp = salespeople.find((s) => String(s.id) === values.salespersonId);
      list.push({
        key: "salesperson",
        label: `พนักงาน: ${sp?.displayName ?? values.salespersonId}`,
        onRemove: () => update({ salespersonId: "" }),
      });
    }
    if (values.hospitalId) {
      const h = hospitals.find((item) => String(item.id) === values.hospitalId);
      list.push({
        key: "hospital",
        label: `โรงพยาบาล: ${h?.displayName ?? values.hospitalId}`,
        onRemove: () => update({ hospitalId: "" }),
      });
    }
    if (values.productTypeId) {
      const pt = productTypes.find((item) => String(item.id) === values.productTypeId);
      list.push({
        key: "productType",
        label: `กลุ่มสินค้า: ${pt?.displayName ?? values.productTypeId}`,
        onRemove: () => update({ productTypeId: "" }),
      });
    }
    if (values.year) {
      list.push({
        key: "year",
        label: `ปี: ${values.year}`,
        onRemove: () => update({ year: "" }),
      });
    }
    if (values.month) {
      list.push({
        key: "month",
        label: `เดือน: ${formatThaiMonth(Number(values.month))}`,
        onRemove: () => update({ month: "" }),
      });
    }
    return list;
  }, [values, salespeople, hospitals, productTypes, update]);

  return (
    <FilterBar
      chips={chips}
      onReset={onReset}
      secondaryFilters={
        <>
          <div className="w-full sm:w-36">
            <label className="block text-xs font-medium text-text-muted mb-1">ปี</label>
            <Select
              value={values.year}
              onChange={(e) => update({ year: e.target.value })}
            >
              <option value="">ปีทั้งหมด</option>
              {[0, 1, 2].map((offset) => {
                const year = new Date().getFullYear() - offset;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </Select>
          </div>

          <div className="w-full sm:w-36">
            <label className="block text-xs font-medium text-text-muted mb-1">เดือน</label>
            <Select
              value={values.month}
              onChange={(e) => update({ month: e.target.value })}
            >
              <option value="">เดือนทั้งหมด</option>
              {MONTHS.map((month) => (
                <option key={month} value={month}>
                  {formatThaiMonth(month)}
                </option>
              ))}
            </Select>
          </div>
        </>
      }
    >
      <div className="w-full sm:w-52">
        <label className="block text-xs font-medium text-text-muted mb-1">พนักงานขาย</label>
        <Select
          value={values.salespersonId}
          onChange={(e) => update({ salespersonId: e.target.value })}
        >
          <option value="">พนักงานขายทั้งหมด</option>
          {salespeople.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.displayName}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-full sm:w-52">
        <label className="block text-xs font-medium text-text-muted mb-1">โรงพยาบาล</label>
        <Select
          value={values.hospitalId}
          onChange={(e) => update({ hospitalId: e.target.value })}
        >
          <option value="">โรงพยาบาลทั้งหมด</option>
          {hospitals.map((hospital) => (
            <option key={hospital.id} value={hospital.id}>
              {hospital.displayName}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-full sm:w-52">
        <label className="block text-xs font-medium text-text-muted mb-1">กลุ่มสินค้า</label>
        <Select
          value={values.productTypeId}
          onChange={(e) => update({ productTypeId: e.target.value })}
        >
          <option value="">กลุ่มสินค้าทั้งหมด</option>
          {productTypes.map((pt) => (
            <option key={pt.id} value={pt.id}>
              {pt.displayName}
            </option>
          ))}
        </Select>
      </div>
    </FilterBar>
  );
}

export default SalesLinesFilters;
