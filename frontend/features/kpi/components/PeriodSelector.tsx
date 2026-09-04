"use client";

import { PERIOD_TYPE_LABEL_TH } from "@/lib/kpiLabels";
import { formatThaiMonth } from "@/lib/importLabels";
import { PeriodKey, PeriodType } from "@/lib/types";
import { Select } from "@/components/ui/select";

export interface PeriodSelectorProps {
  value: PeriodKey;
  onChange: (period: PeriodKey) => void;
}

const PERIOD_TYPES: PeriodType[] = ["MONTH", "QUARTER", "YEAR"];
const YEAR_OFFSETS = [-1, 0, 1];

function defaultPeriodNumber(periodType: PeriodType): number {
  const now = new Date();
  if (periodType === "MONTH") return now.getMonth() + 1;
  if (periodType === "QUARTER") return Math.floor(now.getMonth() / 3) + 1;
  return 0;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const currentYear = new Date().getFullYear();

  function handlePeriodTypeChange(periodType: PeriodType) {
    onChange({ periodType, year: value.year, periodNumber: defaultPeriodNumber(periodType) });
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 text-sm">
      <div className="inline-flex items-center gap-1.5 shrink-0">
        <label htmlFor="period-type-select" className="text-xs font-medium text-[var(--text-muted)] shrink-0">รอบ</label>
        <Select
          id="period-type-select"
          aria-label="เลือกรอบการประเมิน"
          value={value.periodType}
          onChange={(e) => handlePeriodTypeChange(e.target.value as PeriodType)}
          className="w-auto min-w-[76px] h-8 text-xs py-1 px-2.5"
        >
          {PERIOD_TYPES.map((pt) => (
            <option key={pt} value={pt}>
              {PERIOD_TYPE_LABEL_TH[pt]}
            </option>
          ))}
        </Select>
      </div>

      <div className="inline-flex items-center gap-1.5 shrink-0">
        <label htmlFor="period-year-select" className="text-xs font-medium text-[var(--text-muted)] shrink-0">ปี</label>
        <Select
          id="period-year-select"
          aria-label="เลือกปี"
          value={value.year}
          onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
          className="w-auto min-w-[80px] h-8 text-xs py-1 px-2.5"
        >
          {YEAR_OFFSETS.map((offset) => {
            const y = currentYear + offset;
            return (
              <option key={y} value={y}>
                {y}
              </option>
            );
          })}
        </Select>
      </div>

      {value.periodType === "MONTH" && (
        <div className="inline-flex items-center gap-1.5 shrink-0">
          <label htmlFor="period-month-select" className="text-xs font-medium text-[var(--text-muted)] shrink-0">เดือน</label>
          <Select
            id="period-month-select"
            aria-label="เลือกเดือน"
            value={value.periodNumber}
            onChange={(e) => onChange({ ...value, periodNumber: Number(e.target.value) })}
            className="w-auto min-w-[96px] h-8 text-xs py-1 px-2.5"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {formatThaiMonth(m)}
              </option>
            ))}
          </Select>
        </div>
      )}

      {value.periodType === "QUARTER" && (
        <div className="inline-flex items-center gap-1.5 shrink-0">
          <label htmlFor="period-quarter-select" className="text-xs font-medium text-[var(--text-muted)] shrink-0">ไตรมาส</label>
          <Select
            id="period-quarter-select"
            aria-label="เลือกไตรมาส"
            value={value.periodNumber}
            onChange={(e) => onChange({ ...value, periodNumber: Number(e.target.value) })}
            className="w-auto min-w-[88px] h-8 text-xs py-1 px-2.5"
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                ไตรมาส {q}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}

export default PeriodSelector;
