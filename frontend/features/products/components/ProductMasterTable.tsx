"use client";

import { useState } from "react";
import { ProductMasterItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ProductMasterTableProps {
  products: ProductMasterItem[];
  canEdit: boolean;
  onSave: (product: ProductMasterItem, input: { code: string | null; displayName: string | null; isActive: boolean }) => Promise<void>;
}

export function ProductMasterTable({ products, canEdit, onSave }: ProductMasterTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isActive, setIsActive] = useState(true);

  function startEditing(product: ProductMasterItem) {
    setEditingId(product.id);
    setCode(product.code ?? "");
    setDisplayName(product.displayName ?? "");
    setIsActive(product.isActive);
  }

  async function save(product: ProductMasterItem) {
    setBusyId(product.id);
    try {
      await onSave(product, { code: code.trim() || null, displayName: displayName.trim() || null, isActive });
      setEditingId(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">รหัสสินค้า</th>
            <th className="px-4 py-3">ชื่อ</th>
            <th className="px-4 py-3">กลุ่มสินค้า</th>
            <th className="px-4 py-3">ที่มา</th>
            <th className="px-4 py-3">สถานะ</th>
            {canEdit && <th className="px-4 py-3">จัดการ</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {products.length === 0 && (
            <tr><td colSpan={canEdit ? 6 : 5} className="px-4 py-6 text-center text-zinc-400">ยังไม่มีข้อมูลสินค้า</td></tr>
          )}
          {products.map((product) => {
            const isEditing = editingId === product.id;
            return (
              <tr key={product.id}>
                <td className="px-4 py-3">
                  {isEditing ? (
                    <Input
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      className="w-32"
                    />
                  ) : product.code ? (
                    <span className="font-mono text-zinc-700">{product.code}</span>
                  ) : (
                    <span title="สินค้านี้มาจากประวัติการขาย จึงยังไม่มีรหัสสินค้า" className="cursor-help text-zinc-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-900">{product.name}</p>
                  {isEditing ? (
                    <Input
                      aria-label="ชื่อแสดงสินค้า"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="ชื่อทางการ (ถ้ามี)"
                      className="mt-2 w-full min-w-52"
                    />
                  ) : product.displayName && (
                    <p className="mt-1 text-zinc-500">{product.displayName}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-600">{product.productType.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                    {product.source === "SALES_HISTORY" ? "ประวัติการขาย" : "แคตตาล็อก"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {isEditing ? (
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(event) => setIsActive(event.target.checked)}
                        className="cursor-pointer"
                      />
                      <span>{isActive ? "ใช้งาน" : "ไม่ใช้งาน"}</span>
                    </label>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${product.isActive ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600"}`}>
                      {product.isActive ? "ใช้งาน" : "ไม่ใช้งาน"}
                    </span>
                  )}
                </td>
                {canEdit && (
                  <td className="px-4 py-3 whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyId === product.id}
                          onClick={() => void save(product)}
                          className="bg-zinc-900 text-white hover:bg-zinc-800 text-xs px-3 py-1.5"
                        >
                          บันทึก
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busyId === product.id}
                          onClick={() => setEditingId(null)}
                          className="text-xs px-3 py-1.5"
                        >
                          ยกเลิก
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditing(product)}
                        className="text-sm font-medium text-zinc-700 hover:underline cursor-pointer"
                      >
                        แก้ไข
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ProductMasterTable;
