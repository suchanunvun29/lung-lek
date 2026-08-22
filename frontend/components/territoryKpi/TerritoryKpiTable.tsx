"use client";

import { formatMoney } from "@/lib/importLabels";
import { metricLabelTh } from "@/lib/kpiLabels";
import { DrillDownMetric, TerritoryKpiRow } from "@/lib/types";

interface TerritoryKpiTableProps {
  territories: TerritoryKpiRow[];
  onDrillDown: (territory: TerritoryKpiRow, metric: DrillDownMetric) => void;
}

function formatPercent(value: number | null) {
  return value === null ? "ยังไม่ได้ตั้งเป้า" : `${value.toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`;
}

function ownerLabel(ownerNames: string[]) {
  return ownerNames.length ? ownerNames.join(", ") : "ยังไม่มีผู้ดูแล";
}

export default function TerritoryKpiTable({ territories, onDrillDown }: TerritoryKpiTableProps) {
  return <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white"><table className="min-w-full divide-y divide-zinc-200 text-sm"><thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500"><tr><th className="px-4 py-3">อันดับ</th><th className="px-4 py-3">เขต</th><th className="px-4 py-3">ผู้ดูแล</th><th className="px-4 py-3 text-right">ยอดขาย</th><th className="px-4 py-3 text-right">เป้า</th><th className="px-4 py-3 text-right">% ถึงเป้า</th><th className="px-4 py-3">KPI</th><th className="px-4 py-3">คะแนนรวม</th><th className="px-4 py-3">รายละเอียด</th></tr></thead><tbody className="divide-y divide-zinc-100">{territories.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-zinc-400">ไม่มีข้อมูลเขตในรอบที่เลือก</td></tr>}{territories.map((territory) => { const isFull = territory.visibility === "TERRITORY_FULL"; return <tr key={territory.territoryId}><td className="px-4 py-3 font-medium text-zinc-700">{territory.rank}</td><td className="px-4 py-3 font-medium text-zinc-900">{territory.name}</td><td className="px-4 py-3 text-zinc-600">{ownerLabel(territory.ownerNames)}</td>{isFull ? <><td className="px-4 py-3 text-right text-zinc-700">{formatMoney(territory.revenue)}</td><td className="px-4 py-3 text-right text-zinc-700">{territory.target === null ? "—" : formatMoney(territory.target)}</td><td className="px-4 py-3 text-right font-medium text-zinc-900">{formatPercent(territory.achievementPercent)}</td><td className="px-4 py-3"><div className="min-w-52 space-y-1">{territory.metrics.map((metric) => <p key={metric.metric} className="text-xs text-zinc-600">{metricLabelTh(metric.metric)}: {metric.computable ? `${metric.score?.toLocaleString("th-TH", { maximumFractionDigits: 1 })} คะแนน` : metric.reason}</p>)}</div></td></> : <><td className="px-4 py-3 text-zinc-400">—</td><td className="px-4 py-3 text-zinc-400">—</td><td className="px-4 py-3 text-zinc-400">—</td><td className="px-4 py-3 text-zinc-400">—</td></>}<td className="px-4 py-3"><p className="font-semibold text-zinc-900">{territory.compositeScore === null ? "—" : territory.compositeScore.toLocaleString("th-TH", { maximumFractionDigits: 1 })}</p><p className="mt-1 text-xs text-zinc-500">{territory.computedMetricLabel}</p></td><td className="px-4 py-3">{isFull ? <button type="button" onClick={() => onDrillDown(territory, "REVENUE_VS_TARGET")} className="text-sm font-medium text-zinc-700 hover:underline">ดูที่มา</button> : <span className="text-zinc-400">—</span>}</td></tr>; })}</tbody></table></div>;
}
