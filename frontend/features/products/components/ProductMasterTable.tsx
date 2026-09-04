"use client";

import { useCallback, useMemo, useState } from "react";
import { ProductMasterItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table/DataTable";

export interface ProductMasterTableProps {
  products: ProductMasterItem[];
  canEdit: boolean;
  onSave: (product: ProductMasterItem, input: { code: string | null; displayName: string | null; isActive: boolean }) => Promise<void>;
}

export function ProductMasterTable({ products, canEdit, onSave }: ProductMasterTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isActive, setIsActive] = useState(true);

  function startEditing(product: ProductMasterItem) {
    setEditingId(product.id);
    setCode(product.code ?? "");
    setDisplayName(product.displayName ?? "");
    setIsActive(product.isActive);
  }

  const save = useCallback(async (product: ProductMasterItem) => {
    setBusyId(product.id);
    try {
      await onSave(product, { code: code.trim() || null, displayName: displayName.trim() || null, isActive });
      setEditingId(null);
    } finally {
      setBusyId(null);
    }
  }, [code, displayName, isActive, onSave]);

  const columns = useMemo<DataTableColumn<ProductMasterItem>[]>(() => {
    const cols: DataTableColumn<ProductMasterItem>[] = [
      {
        key: "code",
        header: "รหัสสินค้า",
        priority: 2,
        mobileRole: "meta",
        sortable: true,
        sortValue: (p) => p.code ?? "",
        render: (product) => {
          const isEditing = editingId === product.id;
          if (isEditing) {
            return (
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="รหัสสินค้า"
                className="w-32 h-8 text-sm"
              />
            );
          }
          if (product.code) {
            return <span className="font-mono text-text-secondary">{product.code}</span>;
          }
          return (
            <span title="สินค้านี้มาจากประวัติการขาย จึงยังไม่มีรหัสสินค้า" className="cursor-help text-text-muted">
              —
            </span>
          );
        },
      },
      {
        key: "name",
        header: "ชื่อสินค้า",
        priority: 1,
        mobileRole: "identity",
        sortable: true,
        sortValue: (p) => p.name,
        render: (product) => {
          const isEditing = editingId === product.id;
          return (
            <div>
              <p className="font-medium text-text-primary">{product.name}</p>
              {isEditing ? (
                <Input
                  aria-label="ชื่อแสดงสินค้า"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="ชื่อทางการ (ถ้ามี)"
                  className="mt-1 w-full min-w-52 h-8 text-sm"
                />
              ) : (
                product.displayName && <p className="text-xs text-text-muted">{product.displayName}</p>
              )}
            </div>
          );
        },
      },
      {
        key: "productType",
        header: "กลุ่มสินค้า",
        priority: 2,
        mobileRole: "meta",
        sortable: true,
        sortValue: (p) => p.productType.name,
        render: (product) => <span className="text-text-secondary">{product.productType.name}</span>,
      },
      {
        key: "source",
        header: "ที่มา",
        priority: 3,
        mobileRole: "meta",
        render: (product) => (
          <span className="rounded-full bg-surface-subtle border border-border px-2 py-0.5 text-xs font-medium text-text-secondary">
            {product.source === "SALES_HISTORY" ? "ประวัติการขาย" : "แคตตาล็อก"}
          </span>
        ),
      },
      {
        key: "status",
        header: "สถานะ",
        priority: 1,
        mobileRole: "meta",
        sortable: true,
        sortValue: (p) => (p.isActive ? 1 : 0),
        render: (product) => {
          const isEditing = editingId === product.id;
          if (isEditing) {
            return (
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary cursor-pointer"
                />
                <span className="text-sm text-text-secondary">{isActive ? "ใช้งาน" : "ไม่ใช้งาน"}</span>
              </label>
            );
          }
          return (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                product.isActive ? "bg-emerald-100 text-emerald-800" : "bg-surface-subtle text-text-muted border border-border"
              }`}
            >
              {product.isActive ? "ใช้งาน" : "ไม่ใช้งาน"}
            </span>
          );
        },
      },
    ];

    if (canEdit) {
      cols.push({
        key: "action",
        header: "จัดการ",
        priority: 1,
        mobileRole: "metric",
        render: (product) => {
          const isEditing = editingId === product.id;
          if (isEditing) {
            return (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === product.id}
                  onClick={() => void save(product)}
                  className="text-xs px-3 py-1"
                >
                  บันทึก
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId === product.id}
                  onClick={() => setEditingId(null)}
                  className="text-xs px-3 py-1"
                >
                  ยกเลิก
                </Button>
              </div>
            );
          }
          return (
            <button
              type="button"
              onClick={() => startEditing(product)}
              className="text-sm font-medium text-primary hover:underline cursor-pointer"
            >
              แก้ไข
            </button>
          );
        },
      });
    }

    return cols;
  }, [editingId, busyId, code, displayName, isActive, canEdit, save]);

  return (
    <DataTable
      caption="ตารางทะเบียนสินค้า"
      density="comfortable"
      columns={columns}
      rows={products}
      getRowId={(p) => p.id}
      searchable
      searchPlaceholder="ค้นหาชื่อสินค้า, รหัส หรือกลุ่มสินค้า…"
      searchPredicate={(p, query) =>
        p.name.toLowerCase().includes(query) ||
        (p.code?.toLowerCase().includes(query) ?? false) ||
        (p.displayName?.toLowerCase().includes(query) ?? false) ||
        p.productType.name.toLowerCase().includes(query)
      }
      emptyTitle="ยังไม่มีข้อมูลสินค้า"
      emptyDescription="ยังไม่พบข้อมูลสินค้าในระบบ"
    />
  );
}

export default ProductMasterTable;
