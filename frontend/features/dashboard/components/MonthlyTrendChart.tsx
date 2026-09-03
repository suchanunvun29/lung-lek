"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatThaiMonth } from "@/lib/importLabels";
import { MonthlyTrendEntry } from "@/lib/types";
import { Card } from "@/components/ui/card";

export interface MonthlyTrendChartProps {
  data: MonthlyTrendEntry[];
}

const CHART_HEIGHT_PX = 260;

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  const chartData = data.map((entry) => ({
    label: `${formatThaiMonth(entry.month).slice(0, 3)} ${entry.year}`,
    revenue: entry.revenue,
  }));

  return (
    <Card className="p-4">
      <h2 className="text-sm font-medium text-zinc-500">แนวโน้มยอดขายรายเดือนย้อนหลัง</h2>
      {chartData.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-400">ไม่มีข้อมูล</p>
      ) : (
        <div className="mt-3" style={{ height: CHART_HEIGHT_PX }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} width={70} tickFormatter={(v) => Number(v).toLocaleString("th-TH")} />
              <Tooltip
                formatter={(value) => [`${Number(value).toLocaleString("th-TH")} บาท`, "ยอดขาย"]}
              />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export default MonthlyTrendChart;
