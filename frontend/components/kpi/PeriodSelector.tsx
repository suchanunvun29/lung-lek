"use client";

import { PERIOD_TYPE_LABEL_TH } from "@/lib/kpiLabels";
import { formatThaiMonth } from "@/lib/importLabels";
import { PeriodKey, PeriodType } from "@/lib/types";

interface PeriodSelectorProps {
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

export default function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const currentYear = new Date().getFullYear();

  function handlePeriodTypeChange(periodType: PeriodType) {
    onChange({ periodType, year: value.year, periodNumber: defaultPeriodNumber(periodType) });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="font-medium text-zinc-600">รอบ</label>
      <select
        value={value.periodType}
        onChange={(e) => handlePeriodTypeChange(e.target.value as PeriodType)}
        className="rounded-md border border-zinc-300 px-3 py-2"
      >
        {PERIOD_TYPES.map((pt) => (
          <option key={pt} value={pt}>
            {PERIOD_TYPE_LABEL_TH[pt]}
          </option>
        ))}
      </select>

      <label className="font-medium text-zinc-600">ปี</label>
      <select
        value={value.year}
        onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
        className="rounded-md border border-zinc-300 px-3 py-2"
      >
        {YEAR_OFFSETS.map((offset) => {
          const y = currentYear + offset;
          return (
            <option key={y} value={y}>
              {y}
            </option>
          );
        })}
      </select>

      {value.periodType === "MONTH" && (
        <select
          value={value.periodNumber}
          onChange={(e) => onChange({ ...value, periodNumber: Number(e.target.value) })}
          className="rounded-md border border-zinc-300 px-3 py-2"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {formatThaiMonth(m)}
            </option>
          ))}
        </select>
      )}

      {value.periodType === "QUARTER" && (
        <select
          value={value.periodNumber}
          onChange={(e) => onChange({ ...value, periodNumber: Number(e.target.value) })}
          className="rounded-md border border-zinc-300 px-3 py-2"
        >
          {[1, 2, 3, 4].map((q) => (
            <option key={q} value={q}>
              ไตรมาส {q}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
