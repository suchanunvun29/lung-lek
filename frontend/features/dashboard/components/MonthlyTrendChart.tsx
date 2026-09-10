"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatThaiMonth, formatMoney } from "@/lib/importLabels";
import { MonthlyTrendEntry } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface MonthlyTrendChartProps {
  data: MonthlyTrendEntry[];
  /** Opens the MONTHLY_TREND drill-down where this chart is the metric's only trigger (dashboard). */
  onDrillDown?: () => void;
}

const CHART_HEIGHT_PX = 260;

export function MonthlyTrendChart({ data, onDrillDown }: MonthlyTrendChartProps) {
  const chartData = data.map((entry) => ({
    label: `${formatThaiMonth(entry.month).slice(0, 3)} ${entry.year}`,
    revenue: entry.revenue,
  }));

  const hasData = chartData.length > 0;
  // Text alternative for the chart (WCAG 1.1.1) — recomputed from the data, so it
  // follows the period/subject picked in ContextBar without extra wiring.
  const firstEntry = data[0];
  const lastEntry = data[data.length - 1];
  const peak = hasData ? data.reduce((a, b) => (b.revenue > a.revenue ? b : a)) : null;
  const low = hasData ? data.reduce((a, b) => (b.revenue < a.revenue ? b : a)) : null;
  const chartSummary = hasData && peak && low
    ? `กราฟแนวโน้มยอดขายรายเดือน ${formatThaiMonth(firstEntry.month)} ${firstEntry.year} ถึง ${formatThaiMonth(lastEntry.month)} ${lastEntry.year} — สูงสุด ${formatThaiMonth(peak.month)} ${peak.year} (${formatMoney(peak.revenue)} บาท) ต่ำสุด ${formatThaiMonth(low.month)} ${low.year} (${formatMoney(low.revenue)} บาท)`
    : undefined;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-medium text-text-secondary">แนวโน้มยอดขายรายเดือนย้อนหลัง</h2>
        {onDrillDown && (
          <Button type="button" variant="outline" size="sm" onClick={onDrillDown}>
            ดูที่มา
          </Button>
        )}
      </div>
      {chartData.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">ไม่มีข้อมูล</p>
      ) : (
        <>
          <div className="mt-3" style={{ height: CHART_HEIGHT_PX }}>
            <div role="img" aria-label={chartSummary} className="h-full">
              {/* inert keeps keyboard focus out of the decorative recharts internals. */}
              <div aria-hidden="true" inert className="h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    {/* Chart colours from the semantic tokens (WACC-P0-006) — no colour literals. */}
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} width={70} tickFormatter={(v) => Number(v).toLocaleString("th-TH")} />
                    <Tooltip
                      formatter={(value) => [`${Number(value).toLocaleString("th-TH")} บาท`, "ยอดขาย"]}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          {/* sr-only data table — every plotted point, for screen-reader users only (no layout impact). */}
          <table className="sr-only">
            <caption>ยอดขายรายเดือน</caption>
            <thead>
              <tr>
                <th scope="col">เดือน</th>
                <th scope="col">ยอดขาย (บาท)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry) => (
                <tr key={`${entry.year}-${entry.month}`}>
                  <th scope="row">{formatThaiMonth(entry.month)} {entry.year}</th>
                  <td>{entry.revenue.toLocaleString("th-TH")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}

export default MonthlyTrendChart;
