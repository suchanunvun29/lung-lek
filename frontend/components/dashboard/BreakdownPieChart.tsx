"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatKpiNumber } from "@/lib/kpiLabels";

interface BreakdownSlice {
  name: string;
  value: number;
}

interface BreakdownPieChartProps {
  title: string;
  data: BreakdownSlice[];
  emptyLabel?: string;
}

const CHART_HEIGHT_PX = 260;
const MAX_SLICES_BEFORE_GROUPING = 7;
const OTHER_SLICE_LABEL = "อื่น ๆ";
const SLICE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#ec4899", "#71717a"];

function groupIntoTopSlices(data: BreakdownSlice[]): BreakdownSlice[] {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  if (sorted.length <= MAX_SLICES_BEFORE_GROUPING) return sorted;

  const top = sorted.slice(0, MAX_SLICES_BEFORE_GROUPING);
  const restSum = sorted.slice(MAX_SLICES_BEFORE_GROUPING).reduce((sum, s) => sum + s.value, 0);
  return [...top, { name: OTHER_SLICE_LABEL, value: restSum }];
}

export default function BreakdownPieChart({ title, data, emptyLabel = "ไม่มีข้อมูล" }: BreakdownPieChartProps) {
  const slices = groupIntoTopSlices(data.filter((d) => d.value > 0));

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-medium text-zinc-500">{title}</h2>
      {slices.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-400">{emptyLabel}</p>
      ) : (
        <div className="mt-3" style={{ height: CHART_HEIGHT_PX }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={slices} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="75%">
                {slices.map((slice, index) => (
                  <Cell key={slice.name} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${formatKpiNumber(Number(value))}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
