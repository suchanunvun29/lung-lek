"use client";

import { useState } from "react";
import { Target } from "@/lib/types";
import { formatTargetMoney } from "@/lib/targetLabels";

interface TargetCellInput {
  revenueTarget: number;
  newCustomerTarget: number;
}

interface TargetCellProps {
  target: Target | undefined;
  canEdit: boolean;
  saving: boolean;
  onSave: (input: TargetCellInput) => Promise<boolean>;
  onOpenProductGroups: () => void;
  onViewHistory: () => void;
}

export default function TargetCell({
  target,
  canEdit,
  saving,
  onSave,
  onOpenProductGroups,
  onViewHistory,
}: TargetCellProps) {
  const [editing, setEditing] = useState(false);
  const [revenueInput, setRevenueInput] = useState(target ? target.revenueTarget : "0");
  const [newCustomerInput, setNewCustomerInput] = useState(target ? String(target.newCustomerTarget) : "0");
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    if (!canEdit) return;
    setRevenueInput(target ? target.revenueTarget : "0");
    setNewCustomerInput(target ? String(target.newCustomerTarget) : "0");
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    const revenueTarget = Number(revenueInput);
    const newCustomerTarget = Number(newCustomerInput);
    if (Number.isNaN(revenueTarget) || revenueTarget < 0) {
      setError("ยอดขายเป้าต้องเป็นตัวเลขไม่ติดลบ");
      return;
    }
    if (!Number.isInteger(newCustomerTarget) || newCustomerTarget < 0) {
      setError("จำนวนลูกค้าใหม่ต้องเป็นจำนวนเต็มไม่ติดลบ");
      return;
    }
    setError(null);
    const success = await onSave({ revenueTarget, newCustomerTarget });
    if (success) setEditing(false);
  }

  if (editing) {
    return (
      <div className="w-32 space-y-1 rounded border border-zinc-300 bg-white p-1.5">
        <input
          type="number"
          min={0}
          value={revenueInput}
          onChange={(e) => setRevenueInput(e.target.value)}
          className="w-full rounded border border-zinc-300 px-1.5 py-1 text-xs"
          placeholder="ยอดขาย"
        />
        <input
          type="number"
          min={0}
          value={newCustomerInput}
          onChange={(e) => setNewCustomerInput(e.target.value)}
          className="w-full rounded border border-zinc-300 px-1.5 py-1 text-xs"
          placeholder="ลูกค้าใหม่"
        />
        {error && <p className="text-[10px] text-red-600">{error}</p>}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded bg-zinc-900 px-1.5 py-1 text-[10px] font-medium text-white disabled:opacity-50"
          >
            บันทึก
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={saving}
            className="flex-1 rounded border border-zinc-300 px-1.5 py-1 text-[10px] text-zinc-600"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-32 rounded border border-transparent p-1.5 text-xs ${
        canEdit ? "cursor-pointer hover:border-zinc-300 hover:bg-zinc-50" : ""
      }`}
      onClick={startEdit}
    >
      {target ? (
        <>
          <p className="font-medium text-zinc-900">{formatTargetMoney(target.revenueTarget)} บาท</p>
          <p className="text-zinc-500">ลูกค้าใหม่ {target.newCustomerTarget} ราย</p>
          <div className="mt-1 flex gap-2 text-[10px]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenProductGroups();
              }}
              className="text-zinc-600 underline hover:text-zinc-900"
            >
              กลุ่มสินค้า
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewHistory();
              }}
              className="text-zinc-600 underline hover:text-zinc-900"
            >
              ประวัติ
            </button>
          </div>
        </>
      ) : (
        <p className="text-zinc-400">{canEdit ? "คลิกเพื่อตั้งเป้า" : "ยังไม่ได้ตั้งเป้า"}</p>
      )}
    </div>
  );
}
