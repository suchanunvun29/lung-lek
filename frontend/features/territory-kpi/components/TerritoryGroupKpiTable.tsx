"use client";

/**
 * TerritoryGroupKpiTable — WACC-P1-012
 *
 * The group view on DataTable (client-side sort + search). Group rows are
 * TERRITORY_FULL only when the payload says so — the viewer has FULL on every
 * member territory — and visibility is read from the row, never inferred
 * (business rule G: a group's numbers are the sum of its member territories).
 */

import { formatMoney } from "@/lib/importLabels";
import { TerritoryGroupKpiRow } from "@/lib/types";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table/DataTable";
import { RestrictedValue } from "@/components/shared/data-table/RestrictedValue";

export interface TerritoryGroupKpiTableProps {
  groups: TerritoryGroupKpiRow[];
}

function percentage(value: number | null) {
  return value === null ? "ยังไม่ได้ตั้งเป้า" : `${value.toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`;
}

function ownerLabel(owners: string[]) {
  return owners.length ? owners.join(", ") : "ยังไม่มีผู้ดูแล";
}

export function TerritoryGroupKpiTable({ groups }: TerritoryGroupKpiTableProps) {
  const columns: DataTableColumn<TerritoryGroupKpiRow>[] = [
    {
      key: "name",
      header: "กลุ่มเขต",
      mobileRole: "identity",
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => <span className="font-medium text-text-primary">{row.name}</span>,
    },
    {
      key: "owners",
      header: "ผู้ดูแล",
      priority: 3,
      sortable: true,
      sortValue: (row) => row.ownerNames.join(", ") || null,
      render: (row) => <span className="text-text-secondary">{ownerLabel(row.ownerNames)}</span>,
    },
    {
      key: "revenue",
      header: "ยอดรวม",
      numeric: true,
      sortable: true,
      sortValue: (row) => (row.visibility === "TERRITORY_FULL" ? row.revenue : null),
      render: (row) =>
        row.visibility === "TERRITORY_FULL" ? (
          <span className="font-numeric">{formatMoney(row.revenue)}</span>
        ) : (
          <RestrictedValue visibility={row.visibility} />
        ),
    },
    {
      key: "target",
      header: "เป้ารวม",
      numeric: true,
      priority: 3,
      sortable: true,
      sortValue: (row) => (row.visibility === "TERRITORY_FULL" ? row.revenueTarget : null),
      render: (row) =>
        row.visibility !== "TERRITORY_FULL" ? (
          <RestrictedValue visibility={row.visibility} label="จำกัดตามสิทธิ์" />
        ) : row.revenueTarget === null ? (
          "—"
        ) : (
          <span className="font-numeric">{formatMoney(row.revenueTarget)}</span>
        ),
    },
    {
      key: "achievement",
      header: "% ถึงเป้า",
      numeric: true,
      priority: 3,
      sortable: true,
      sortValue: (row) => (row.visibility === "TERRITORY_FULL" ? row.achievementPercent : null),
      render: (row) =>
        row.visibility !== "TERRITORY_FULL" ? (
          <RestrictedValue visibility={row.visibility} label="จำกัดตามสิทธิ์" />
        ) : (
          percentage(row.achievementPercent)
        ),
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
          <p className="font-semibold text-text-primary font-numeric">
            {row.compositeScore === null ? "—" : row.compositeScore.toLocaleString("th-TH", { maximumFractionDigits: 1 })}
          </p>
          <p className="mt-1 text-xs text-text-muted">{row.computedMetricLabel}</p>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={groups}
      getRowId={(row) => row.territoryId}
      caption="KPI กลุ่มเขต — ยอดของกลุ่มเป็นผลรวมของเขตสมาชิก"
      searchable
      searchPlaceholder="ค้นหากลุ่มเขต…"
      emptyTitle="ไม่มีข้อมูลกลุ่มเขตในรอบที่เลือก"
    />
  );
}

export default TerritoryGroupKpiTable;
