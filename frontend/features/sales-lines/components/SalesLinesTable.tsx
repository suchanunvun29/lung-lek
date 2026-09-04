"use client";

import { SalesLine } from "@/lib/types";
import { formatMoney } from "@/lib/importLabels";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table/DataTable";

export interface SalesLinesTableProps {
  salesLines: SalesLine[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}

const COLUMNS: DataTableColumn<SalesLine>[] = [
  // ── P1: Hospital + Total ──────────────────────────────────────────
  {
    key: "hospital",
    header: "โรงพยาบาล",
    priority: 1,
    mobileRole: "identity",
    render: (line) => (
      <div>
        <p className="font-medium text-text-primary">{line.hospital.displayName}</p>
        {line.province && <p className="text-xs text-text-muted">{line.province}</p>}
      </div>
    ),
  },
  {
    key: "total",
    header: "ยอดรวม (Total)",
    priority: 1,
    align: "right",
    numeric: true,
    mobileRole: "metric",
    render: (line) => (
      <span className="font-medium text-text-primary">
        {formatMoney(line.total)}
      </span>
    ),
  },

  // ── P2: Salesperson + Invoice Date ────────────────────────────────
  {
    key: "salesperson",
    header: "พนักงานขาย",
    priority: 2,
    mobileRole: "meta",
    render: (line) => <span className="text-text-primary">{line.salesperson.displayName}</span>,
  },
  {
    key: "invoiceDate",
    header: "วันที่ใบแจ้งหนี้",
    priority: 2,
    mobileRole: "meta",
    render: (line) => (
      <span className="whitespace-nowrap text-text-secondary">
        {new Date(line.invoiceDate).toLocaleDateString("th-TH")}
      </span>
    ),
  },

  // ── P3: Invoice No, Product, Product Type, Qty, Lot/Expiry ────────
  {
    key: "invoiceNo",
    header: "เลขที่ใบแจ้งหนี้",
    priority: 3,
    mobileRole: "meta",
    render: (line) => <span className="font-mono text-xs text-text-secondary">{line.invoiceNo}</span>,
  },
  {
    key: "product",
    header: "สินค้า",
    priority: 3,
    mobileRole: "meta",
    render: (line) => <span className="text-text-secondary">{line.product.name}</span>,
  },
  {
    key: "productType",
    header: "กลุ่มสินค้า",
    priority: 3,
    mobileRole: "meta",
    render: (line) => <span className="text-text-secondary">{line.productType.name}</span>,
  },
  {
    key: "qty",
    header: "จำนวน",
    align: "right",
    numeric: true,
    priority: 3,
    mobileRole: "meta",
    render: (line) => <span className="text-text-secondary">{line.qty}</span>,
  },
  {
    key: "lotExpiry",
    header: "Lot / Expiry",
    priority: 3,
    mobileRole: "meta",
    render: (line) => {
      if (!line.lot && !line.expiryDate) {
        return <span className="text-text-muted">—</span>;
      }
      return (
        <span className="text-xs text-text-muted">
          {[line.lot ? `Lot: ${line.lot}` : "", line.expiryDate ? `Exp: ${line.expiryDate}` : ""]
            .filter(Boolean)
            .join(" · ")}
        </span>
      );
    },
  },
];

export function SalesLinesTable({
  salesLines,
  loading,
  error,
  onRetry,
  page,
  pageSize,
  total,
  onPageChange,
}: SalesLinesTableProps) {
  return (
    <DataTable
      caption="ตารางข้อมูลการขาย"
      columns={COLUMNS}
      rows={salesLines}
      getRowId={(line) => line.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      serverPaginated={true}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={onPageChange}
      emptyTitle="ไม่พบข้อมูลการขาย"
      emptyDescription="ไม่พบรายการขายตามเงื่อนไขตัวกรองที่เลือก"
    />
  );
}

export default SalesLinesTable;
