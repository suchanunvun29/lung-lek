"use client";

import { useState } from "react";
import { PeriodTouched } from "@/lib/types";
import { formatThaiMonth } from "@/lib/importLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export interface PeriodPickerProps {
  value: PeriodTouched[];
  onChange: (periods: PeriodTouched[]) => void;
  disabled?: boolean;
}

const MIN_MONTH = 1;
const MAX_MONTH = 12;

export function PeriodPicker({ value, onChange, disabled }: PeriodPickerProps) {
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [error, setError] = useState<string | null>(null);

  function addPeriod() {
    const parsedYear = Number(year);
    const parsedMonth = Number(month);
    if (!Number.isInteger(parsedYear) || !Number.isInteger(parsedMonth) || parsedMonth < MIN_MONTH || parsedMonth > MAX_MONTH) {
      setError("ระบุปีและเดือนให้ถูกต้องก่อนเพิ่มงวด");
      return;
    }

    if (value.some((period) => period.year === parsedYear && period.month === parsedMonth)) {
      setError("เลือกงวดนี้แล้ว");
      return;
    }

    onChange([...value, { year: parsedYear, month: parsedMonth }].sort((a, b) => a.year - b.year || a.month - b.month));
    setError(null);
    setMonth("");
  }

  function removePeriod(periodToRemove: PeriodTouched) {
    onChange(value.filter((period) => period.year !== periodToRemove.year || period.month !== periodToRemove.month));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm font-medium text-zinc-700">
          ปี
          <Input
            type="number"
            inputMode="numeric"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            disabled={disabled}
            className="w-28"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-zinc-700">
          เดือน
          <Select
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            disabled={disabled}
            className="w-auto"
          >
            <option value="">เลือกเดือน</option>
            {Array.from({ length: MAX_MONTH }, (_, index) => index + MIN_MONTH).map((monthNumber) => (
              <option key={monthNumber} value={monthNumber}>
                {formatThaiMonth(monthNumber)}
              </option>
            ))}
          </Select>
        </label>
        <Button
          type="button"
          variant="outline"
          onClick={addPeriod}
          disabled={disabled}
        >
          เพิ่มงวด
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex min-h-8 flex-wrap gap-2">
        {value.map((period) => (
          <span key={`${period.year}-${period.month}`} className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700">
            {formatThaiMonth(period.month)} {period.year}
            <button
              type="button"
              onClick={() => removePeriod(period)}
              disabled={disabled}
              aria-label={`ลบงวด ${formatThaiMonth(period.month)} ${period.year}`}
              className="font-semibold text-zinc-500 hover:text-zinc-900 disabled:cursor-not-allowed cursor-pointer"
            >
              ×
            </button>
          </span>
        ))}
        {value.length === 0 && <p className="text-sm text-zinc-500">ยังไม่ได้เลือกงวด</p>}
      </div>
    </div>
  );
}

export default PeriodPicker;
