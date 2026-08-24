import { PeriodType } from "@prisma/client";

export interface PeriodKey {
  periodType: PeriodType;
  year: number;
  periodNumber: number;
}

export interface YearMonth {
  year: number;
  month: number;
}

export function monthsInPeriod({ periodType, year, periodNumber }: PeriodKey): YearMonth[] {
  if (periodType === "MONTH") {
    return [{ year, month: periodNumber }];
  }
  if (periodType === "QUARTER") {
    const startMonth = (periodNumber - 1) * 3 + 1;
    return [0, 1, 2].map((offset) => ({ year, month: startMonth + offset }));
  }
  return Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1 }));
}

export function previousPeriod({ periodType, year, periodNumber }: PeriodKey): PeriodKey {
  if (periodType === "MONTH") {
    return periodNumber === 1
      ? { periodType, year: year - 1, periodNumber: 12 }
      : { periodType, year, periodNumber: periodNumber - 1 };
  }
  if (periodType === "QUARTER") {
    return periodNumber === 1
      ? { periodType, year: year - 1, periodNumber: 4 }
      : { periodType, year, periodNumber: periodNumber - 1 };
  }
  return { periodType, year: year - 1, periodNumber: 0 };
}

export function lastMonthOfPeriod(period: PeriodKey): YearMonth {
  const months = monthsInPeriod(period);
  return months[months.length - 1];
}

export function firstDayOfPeriod(period: PeriodKey): Date {
  const first = monthsInPeriod(period)[0];
  return new Date(Date.UTC(first.year, first.month - 1, 1));
}

export function lastDayOfPeriod(period: PeriodKey): Date {
  const last = lastMonthOfPeriod(period);
  return new Date(Date.UTC(last.year, last.month, 0));
}

export function trailingMonths(endYear: number, endMonth: number, count: number): YearMonth[] {
  const result: YearMonth[] = [];
  let year = endYear;
  let month = endMonth;
  for (let i = 0; i < count; i++) {
    result.unshift({ year, month });
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return result;
}

export function monthsWhereOr(months: YearMonth[]) {
  return months.map((m) => ({ year: m.year, month: m.month }));
}

export function monthKey(m: YearMonth): string {
  return `${m.year}-${m.month}`;
}
