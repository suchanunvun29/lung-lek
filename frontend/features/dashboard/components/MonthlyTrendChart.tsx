"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatThaiMonth } from "@/lib/importLabels";
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

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-500">แนวโน้มยอดขายรายเดือนย้อนหลัง</h2>
        {onDrillDown && (
          <Button type="button" variant="outline" size="sm" onClick={onDrillDown}>
            ดูที่มา
          </Button>
        )}
      </div>
      {chartData.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-400">ไม่มีข้อมูล</p>
      ) : (
        <div className="mt-3" style={{ height: CHART_HEIGHT_PX }}>
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
      )}
    </Card>
  );
}

export default MonthlyTrendChart;
