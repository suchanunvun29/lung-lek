import { EntitySummary } from "@/lib/types";
import { formatThaiMonth } from "@/lib/importLabels";
import { Select } from "@/components/ui/select";

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
}

export function SalesLinesFilters({
  values,
  onChange,
  salespeople,
  hospitals,
  productTypes,
}: SalesLinesFiltersProps) {
  function update(partial: Partial<SalesLinesFilterValues>) {
    onChange({ ...values, ...partial });
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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
  );
}

export default SalesLinesFilters;
