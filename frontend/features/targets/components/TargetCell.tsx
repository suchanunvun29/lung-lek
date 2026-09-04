"use client";

import { useState } from "react";
import { Target } from "@/lib/types";
import { formatTargetMoney } from "@/features/targets/utils/targetLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface TargetCellInput {
  revenueTarget: number;
  newCustomerTarget: number;
}

/** Unsaved edit state for one cell — owned by TargetsGrid so the dirty bar can see it. */
export interface TargetCellDraft {
  revenueTarget: string;
  newCustomerTarget: string;
}

export interface TargetCellProps {
  target: Target | undefined;
  canEdit: boolean;
  saving: boolean;
  /** Draft value while editing; null = displaying the stored value. Controlled by TargetsGrid. */
  draft: TargetCellDraft | null;
  onDraftChange: (draft: TargetCellDraft | null) => void;
  onSave: (input: TargetCellInput) => Promise<boolean>;
  onOpenProductGroups?: () => void;
  onViewHistory?: () => void;
  /** Full-width layout for the per-person mobile view. */
  wide?: boolean;
}

export function TargetCell({
  target,
  canEdit,
  saving,
  draft,
  onDraftChange,
  onSave,
  onOpenProductGroups,
  onViewHistory,
  wide = false,
}: TargetCellProps) {
  const [error, setError] = useState<string | null>(null);
  const editing = draft !== null;

  function startEdit() {
    if (!canEdit || editing) return;
    setError(null);
    onDraftChange({
      revenueTarget: target ? String(Number(target.revenueTarget)) : "0",
      newCustomerTarget: String(target?.newCustomerTarget ?? 0),
    });
  }

  function updateDraft(patch: Partial<TargetCellDraft>) {
    if (!draft) return;
    onDraftChange({ ...draft, ...patch });
  }

  async function handleSave() {
    if (!draft) return;
    const revenueTarget = Number(draft.revenueTarget);
    const newCustomerTarget = Number(draft.newCustomerTarget);
    if (draft.revenueTarget.trim() === "" || Number.isNaN(revenueTarget) || revenueTarget < 0) {
      setError("ยอดขายเป้าต้องเป็นตัวเลขไม่ติดลบ");
      return;
    }
    if (draft.newCustomerTarget.trim() === "" || !Number.isInteger(newCustomerTarget) || newCustomerTarget < 0) {
      setError("จำนวนลูกค้าใหม่ต้องเป็นจำนวนเต็มไม่ติดลบ");
      return;
    }
    setError(null);
    const success = await onSave({ revenueTarget, newCustomerTarget });
    if (success) onDraftChange(null);
  }

  if (editing && draft) {
    return (
      <div className={`space-y-1 rounded border border-zinc-300 bg-white p-1.5 ${wide ? "w-full" : "w-32"}`}>
        <Input
          type="number"
          min={0}
          inputMode="decimal"
          value={draft.revenueTarget}
          onChange={(e) => updateDraft({ revenueTarget: e.target.value })}
          className="h-7 text-xs px-1.5 py-1"
          placeholder="ยอดขาย"
          aria-label="ยอดขายเป้า"
        />
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          value={draft.newCustomerTarget}
          onChange={(e) => updateDraft({ newCustomerTarget: e.target.value })}
          className="h-7 text-xs px-1.5 py-1"
          placeholder="ลูกค้าใหม่"
          aria-label="เป้าลูกค้าใหม่"
        />
        {error && <p className="text-[10px] text-red-600">{error}</p>}
        <div className="flex gap-1">
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 bg-zinc-900 text-white hover:bg-zinc-800 text-[10px] px-1.5 py-1 h-auto"
          >
            บันทึก
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setError(null);
              onDraftChange(null);
            }}
            disabled={saving}
            className="flex-1 text-[10px] px-1.5 py-1 h-auto"
          >
            ยกเลิก
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${wide ? "w-full" : "w-32"} rounded border p-1.5 text-xs ${
        target
          ? "border-transparent bg-white"
          : "border-dashed border-amber-400 bg-amber-50/70"
      } ${canEdit && !saving ? "cursor-pointer hover:border-zinc-400 hover:bg-zinc-50" : ""}`}
      onClick={startEdit}
    >
      {target ? (
        <>
          <p className="font-medium text-zinc-900">{formatTargetMoney(target.revenueTarget)} บาท</p>
          <p className="text-zinc-500">ลูกค้าใหม่ {target.newCustomerTarget} ราย</p>
          {(onOpenProductGroups || onViewHistory) && (
            <div className="mt-1 flex gap-2 text-[10px]">
              {onOpenProductGroups && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProductGroups();
                  }}
                  className="text-zinc-600 underline hover:text-zinc-900 cursor-pointer"
                >
                  กลุ่มสินค้า
                </button>
              )}
              {onViewHistory && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewHistory();
                  }}
                  className="text-zinc-600 underline hover:text-zinc-900 cursor-pointer"
                >
                  ประวัติ
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-amber-700">{canEdit ? "คลิกเพื่อตั้งเป้า" : "ยังไม่ได้ตั้งเป้า"}</p>
      )}
    </div>
  );
}

export default TargetCell;
