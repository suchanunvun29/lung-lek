"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  SalesmanDecisionAction,
  SalesmanDecisionInput,
  Salesperson,
  UnverifiedSalesman,
} from "@/lib/types";
import { UserCheck, UserPlus, UserX, AlertTriangle } from "lucide-react";

export interface SalesmanVerificationModalProps {
  unverifiedSalesmen: UnverifiedSalesman[];
  totalRows: number;
  fileName: string;
  existingSalespeople: Salesperson[];
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (decisions: SalesmanDecisionInput[]) => void;
}

interface DecisionState {
  action: SalesmanDecisionAction;
  targetSalespersonId?: number | null;
}

export function SalesmanVerificationModal({
  unverifiedSalesmen,
  totalRows,
  fileName,
  existingSalespeople,
  isOpen,
  isLoading = false,
  onClose,
  onConfirm,
}: SalesmanVerificationModalProps) {
  const initialDecisions = useMemo(() => {
    const map: Record<string, DecisionState> = {};
    for (const item of unverifiedSalesmen) {
      if (item.suggestedSalespersonId) {
        map[item.normalizedKey] = {
          action: "MAP_EXISTING",
          targetSalespersonId: item.suggestedSalespersonId,
        };
      } else {
        map[item.normalizedKey] = {
          action: "AUTO_CREATE",
        };
      }
    }
    return map;
  }, [unverifiedSalesmen]);

  const [decisions, setDecisions] = useState<Record<string, DecisionState>>(initialDecisions);
  const [searchTerm, setSearchTerm] = useState("");

  const counts = useMemo(() => {
    let autoCreate = 0;
    let mapExisting = 0;
    let skip = 0;
    for (const item of unverifiedSalesmen) {
      const d = decisions[item.normalizedKey]?.action ?? "AUTO_CREATE";
      if (d === "AUTO_CREATE") autoCreate++;
      else if (d === "MAP_EXISTING") mapExisting++;
      else if (d === "SKIP") skip++;
    }
    return { autoCreate, mapExisting, skip };
  }, [unverifiedSalesmen, decisions]);

  const filteredItems = useMemo(() => {
    return unverifiedSalesmen.filter((item) =>
      item.rawName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [unverifiedSalesmen, searchTerm]);

  const handleActionChange = (normalizedKey: string, action: SalesmanDecisionAction) => {
    setDecisions((prev) => {
      const current = prev[normalizedKey] || { action: "AUTO_CREATE" };
      let targetId = current.targetSalespersonId;
      if (action === "MAP_EXISTING" && !targetId && existingSalespeople.length > 0) {
        const item = unverifiedSalesmen.find((u) => u.normalizedKey === normalizedKey);
        targetId = item?.suggestedSalespersonId || existingSalespeople[0].id;
      }
      return {
        ...prev,
        [normalizedKey]: {
          action,
          targetSalespersonId: action === "MAP_EXISTING" ? targetId : undefined,
        },
      };
    });
  };

  const handleTargetChange = (normalizedKey: string, targetId: number) => {
    setDecisions((prev) => ({
      ...prev,
      [normalizedKey]: {
        action: "MAP_EXISTING",
        targetSalespersonId: targetId,
      },
    }));
  };

  const setAllActions = (action: SalesmanDecisionAction) => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const item of unverifiedSalesmen) {
        let targetId: number | undefined = undefined;
        if (action === "MAP_EXISTING") {
          targetId = item.suggestedSalespersonId || existingSalespeople[0]?.id;
        }
        next[item.normalizedKey] = {
          action,
          targetSalespersonId: targetId,
        };
      }
      return next;
    });
  };

  const handleSubmit = () => {
    const results: SalesmanDecisionInput[] = unverifiedSalesmen.map((item) => {
      const state = decisions[item.normalizedKey] || { action: "AUTO_CREATE" };
      return {
        normalizedKey: item.normalizedKey,
        rawName: item.rawName,
        action: state.action,
        targetSalespersonId: state.action === "MAP_EXISTING" ? state.targetSalespersonId : undefined,
      };
    });
    onConfirm(results);
  };

  if (!isOpen) return null;

  return (
    <Modal
      title="ตรวจสอบรายชื่อพนักงานขายใหม่"
      onClose={onClose}
      widthClassName="max-w-4xl"
    >
      <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
        <div className="rounded-md border border-warning/30 bg-warning-subtle p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning-text shrink-0 mt-0.5" />
            <div className="text-sm text-warning-text">
              <p className="font-semibold text-text-primary">
                พบรายชื่อพนักงานขายที่ยังไม่มีในระบบ {unverifiedSalesmen.length} ชื่อ (จากทั้งหมด {totalRows.toLocaleString()} แถว ในไฟล์ {fileName})
              </p>
              <p className="mt-1 text-text-secondary">
                กรุณาเลือกว่าต้องการสร้างชื่อใหม่, จับคู่กับพนักงานเดิมที่มีอยู่, หรือข้ามแถวของพนักงานคนนั้น
              </p>
            </div>
          </div>
        </div>

        {/* Bulk action toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-subtle p-3 rounded-lg border border-border">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-secondary">กำหนดพร้อมกัน:</span>
            <button
              type="button"
              onClick={() => setAllActions("AUTO_CREATE")}
              className="min-h-[44px] px-3 py-2 text-xs font-medium rounded border border-border bg-surface hover:bg-surface-subtle text-text-primary transition-colors cursor-pointer"
            >
              สร้างใหม่ทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setAllActions("SKIP")}
              className="min-h-[44px] px-3 py-2 text-xs font-medium rounded border border-border bg-surface hover:bg-surface-subtle text-text-primary transition-colors cursor-pointer"
            >
              ข้ามทั้งหมด
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
            <span>สรุป:</span>
            <span className="px-2 py-1 rounded bg-success-subtle text-success-text border border-success/30">
              สร้างใหม่ {counts.autoCreate}
            </span>
            <span className="px-2 py-1 rounded bg-info-subtle text-info-text border border-info/30">
              จับคู่ {counts.mapExisting}
            </span>
            <span className="px-2 py-1 rounded bg-surface border border-border text-text-muted">
              ข้าม {counts.skip}
            </span>
          </div>
        </div>

        {unverifiedSalesmen.length > 5 && (
          <div>
            <input
              type="search"
              placeholder="ค้นหาชื่อพนักงาน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-sm rounded-md border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {/* List of unverified salespeople */}
        <div className="divide-y divide-border border border-border rounded-lg bg-surface">
          {filteredItems.map((item) => {
            const currentDecision = decisions[item.normalizedKey] || { action: "AUTO_CREATE" };
            return (
              <div
                key={item.normalizedKey}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-surface-subtle/50 transition-colors"
              >
                <div className="min-w-[200px] flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-primary text-base">
                      {item.rawName}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface-subtle text-text-muted border border-border">
                      {item.rowCount.toLocaleString()} แถว
                    </span>
                  </div>
                  {item.suggestedSalespersonName && (
                    <p className="text-xs text-info-text mt-1">
                      💡 แนะนำจับคู่กับ: <span className="font-medium underline">{item.suggestedSalespersonName}</span>
                    </p>
                  )}
                </div>

                {/* 3 Action Buttons with accessible touch targets */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-md shadow-sm" role="group">
                    <button
                      type="button"
                      onClick={() => handleActionChange(item.normalizedKey, "AUTO_CREATE")}
                      className={`min-h-[44px] min-w-[100px] px-3 py-2 text-xs font-medium rounded-l-md border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                        currentDecision.action === "AUTO_CREATE"
                          ? "bg-primary text-primary-foreground border-primary z-10"
                          : "bg-surface text-text-primary border-border hover:bg-surface-subtle"
                      }`}
                    >
                      <UserPlus className="h-4 w-4" />
                      สร้างใหม่
                    </button>
                    <button
                      type="button"
                      onClick={() => handleActionChange(item.normalizedKey, "MAP_EXISTING")}
                      className={`min-h-[44px] min-w-[110px] px-3 py-2 text-xs font-medium border-t border-b border-r transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                        currentDecision.action === "MAP_EXISTING"
                          ? "bg-primary text-primary-foreground border-primary z-10"
                          : "bg-surface text-text-primary border-border hover:bg-surface-subtle"
                      }`}
                    >
                      <UserCheck className="h-4 w-4" />
                      จับคู่คนเดิม
                    </button>
                    <button
                      type="button"
                      onClick={() => handleActionChange(item.normalizedKey, "SKIP")}
                      className={`min-h-[44px] min-w-[80px] px-3 py-2 text-xs font-medium rounded-r-md border-t border-b border-r transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                        currentDecision.action === "SKIP"
                          ? "bg-danger text-white border-danger z-10"
                          : "bg-surface text-text-primary border-border hover:bg-surface-subtle"
                      }`}
                    >
                      <UserX className="h-4 w-4" />
                      ข้าม
                    </button>
                  </div>

                  {/* If MAP_EXISTING is active, show select dropdown */}
                  {currentDecision.action === "MAP_EXISTING" && (
                    <div className="min-w-[200px]">
                      <Select
                        value={String(currentDecision.targetSalespersonId || "")}
                        onChange={(e) => handleTargetChange(item.normalizedKey, Number(e.target.value))}
                        className="min-h-[44px] text-sm"
                      >
                        {existingSalespeople.map((sp) => (
                          <option key={sp.id} value={sp.id}>
                            {sp.displayName} ({sp.nameInFile})
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="min-h-[44px] px-5"
          >
            ยกเลิก
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="min-h-[44px] px-6 font-semibold"
          >
            {isLoading ? "กำลังดำเนินการ..." : "ยืนยันและนำเข้าข้อมูล"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default SalesmanVerificationModal;
