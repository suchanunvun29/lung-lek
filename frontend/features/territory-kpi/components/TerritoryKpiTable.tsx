"use client";

/**
 * TerritoryKpiTable — WACC-P1-012
 *
 * The territory view on DataTable (client-side sort + search). Masked rows are
 * decided by the payload's `visibility` field only: anything that is not
 * TERRITORY_FULL renders RestrictedValue — never inferred from a null/empty
 * value. Drill-down ("ดูที่มา") is unchanged and stays the row action.
 */

import { formatMoney } from "@/lib/importLabels";
import { metricLabelTh } from "@/lib/kpiLabels";
import { DrillDownMetric, TerritoryKpiRow } from "@/lib/types";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table/DataTable";
import { RestrictedValue } from "@/components/shared/data-table/RestrictedValue";

export interface TerritoryKpiTableProps {
  territories: TerritoryKpiRow[];
  onDrillDown: (territory: TerritoryKpiRow, metric: DrillDownMetric) => void;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`;
}

function ownerLabel(ownerNames: string[]) {
  return ownerNames.length ? ownerNames.join(", ") : "ยังไม่มีผู้ดูแล";
}

export function TerritoryKpiTable({ territories, onDrillDown }: TerritoryKpiTableProps) {
  const columns: DataTableColumn<TerritoryKpiRow>[] = [
    {
      key: "rank",
      header: "อันดับ",
      numeric: true,
      priority: 3,
      mobileRole: "hidden",
      sortable: true,
      sortValue: (row) => row.rank,
      render: (row) => <span className="font-medium text-zinc-700">{row.rank}</span>,
    },
    {
      key: "name",
      header: "เขต",
      mobileRole: "identity",
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => <span className="font-medium text-zinc-900">{row.name}</span>,
    },
    {
      key: "owners",
      header: "ผู้ดูแล",
      priority: 3,
      sortable: true,
      sortValue: (row) => row.ownerNames.join(", ") || null,
      render: (row) => <span className="text-zinc-600">{ownerLabel(row.ownerNames)}</span>,
    },
    {
      key: "revenue",
      header: "ยอดขาย",
      numeric: true,
      sortable: true,
      sortValue: (row) => (row.visibility === "TERRITORY_FULL" ? row.revenue : null),
      render: (row) =>
        row.visibility === "TERRITORY_FULL" ? (
          formatMoney(row.revenue)
        ) : (
          <RestrictedValue visibility={row.visibility} />
        ),
    },
    {
      key: "target",
      header: "เป้า",
      numeric: true,
      priority: 3,
      sortable: true,
      sortValue: (row) => (row.visibility === "TERRITORY_FULL" ? row.target : null),
      render: (row) => {
        if (row.visibility !== "TERRITORY_FULL") return <RestrictedValue visibility={row.visibility} label="จำกัดตามสิทธิ์" />;
        if (row.target === null) {
          return <span className="text-xs text-amber-700">{row.targetLabel ?? "ยังไม่ได้ตั้งเป้า"}</span>;
        }
        return formatMoney(row.target);
      },
    },
    {
      key: "achievement",
      header: "% ถึงเป้า",
      numeric: true,
      sortable: true,
      sortValue: (row) => (row.visibility === "TERRITORY_FULL" ? row.achievementPercent : null),
      render: (row) => {
        if (row.visibility !== "TERRITORY_FULL") return <RestrictedValue visibility={row.visibility} label="จำกัดตามสิทธิ์" />;
        if (row.achievementPercent === null) {
          return <span className="text-xs text-amber-700">{row.targetLabel ?? "ยังไม่ได้ตั้งเป้า"}</span>;
        }
        return <span className="font-semibold">{formatPercent(row.achievementPercent)}</span>;
      },
    },
    {
      key: "metrics",
      header: "KPI",
      mobileRole: "meta",
      render: (row) => {
        if (row.visibility !== "TERRITORY_FULL") return <RestrictedValue visibility={row.visibility} label="จำกัดตามสิทธิ์" />;
        return (
          <div className="min-w-52 space-y-1">
            {row.metrics.map((metric) => (
              <p key={metric.metric} className="text-xs text-zinc-600">
                {metricLabelTh(metric.metric)}:{" "}
                {metric.computable ? `${metric.score?.toLocaleString("th-TH", { maximumFractionDigits: 1 })} คะแนน` : metric.reason}
              </p>
            ))}
          </div>
        );
      },
    },
    {
      key: "composite",
      header: "คะแนนรวม",
      numeric: true,
      sortable: true,
      mobileRole: "metric",
      sortValue: (row) => row.compositeScore,
      render: (row) => (
        <div>
          {row.compositeScore !== null ? (
            <p className="font-medium text-zinc-900">{row.compositeScore.toLocaleString("th-TH", { maximumFractionDigits: 1 })}</p>
          ) : (
            <p className="max-w-44 text-xs text-amber-700">
              {row.visibility === "TERRITORY_FULL" ? row.message ?? "ยังไม่มีคะแนนรวมในงวดนี้" : "ยังไม่มีคะแนนรวมในงวดนี้"}
            </p>
          )}
          <p className="mt-1 text-xs text-zinc-500">{row.computedMetricLabel}</p>
        </div>
      ),
    },
    {
      key: "detail",
      header: "รายละเอียด",
      render: (row) =>
        row.visibility === "TERRITORY_FULL" ? (
          <button
            type="button"
            onClick={() => onDrillDown(row, "REVENUE_VS_TARGET")}
            className="text-sm font-medium text-zinc-700 hover:underline cursor-pointer"
          >
            ดูที่มา
          </button>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={territories}
      getRowId={(row) => row.territoryId}
      caption="KPI รายเขต — ยอดขาย เป้า และคะแนนรวมของแต่ละเขต"
      searchable
      searchPlaceholder="ค้นหาเขต…"
      emptyTitle="ไม่มีข้อมูลเขตในรอบที่เลือก"
      rowAction={(row) =>
        row.visibility === "TERRITORY_FULL" ? (
          <button
            type="button"
            onClick={() => onDrillDown(row, "REVENUE_VS_TARGET")}
            className="min-h-[44px] w-full rounded-md border border-border px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
          >
            ดูที่มา
          </button>
        ) : (
          <span className="text-zinc-400">—</span>
        )
      }
    />
  );
}

export default TerritoryKpiTable;
