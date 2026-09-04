"use client";

/**
 * TargetsGrid — WACC-P1-010 (shared with WACC-P1-014)
 *
 * One 12-month inline-editing grid for every target owner type (salesperson,
 * territory — group comes with WACC-P2-005), parameterised by `ownerNoun` +
 * `owners` instead of hardcoding "salesperson".
 *
 * ── Editing model (behavior preservation) ─────────────────────────────────────
 * • Each cell still PUTs its own (ownerId, year, month) via `onSave` — save-all
 *   issues the same per-cell requests sequentially and keeps failed drafts, so
 *   one TargetRevision per save is unchanged and "target = 0" is never treated
 *   as empty (business rule A).
 * • Unsaved edits live in a drafts map keyed by `targetKey(ownerId, month)`.
 *   A cell is dirty when its draft differs from the stored target (a cell with
 *   no target record whose draft is still the "0/0" default is NOT dirty).
 * • The dirty bar reports the count, saves all dirty cells sequentially with
 *   per-cell failure reporting, and discard goes through ConfirmDialog.
 * • A `beforeunload` warning is active while any cell is dirty.
 *
 * ── Responsive ────────────────────────────────────────────────────────────────
 * • ≥1024px: full grid — frozen owner-name column, sticky month header,
 *   max-height scroll container, client-side search on the owner name.
 * • <1024px: per-person view — pick an owner, edit 12 months vertically with
 *   numeric keyboards and a sticky save bar (explicitly not a card grid, §22).
 */

import { useEffect, useMemo, useState } from "react";
import { Target } from "@/lib/types";
import { formatThaiMonth } from "@/lib/importLabels";
import { TargetCell, type TargetCellDraft, type TargetCellInput } from "./TargetCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/feedback/ConfirmDialog";
import { Search } from "lucide-react";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function targetKey(ownerId: number, month: number) {
  return `${ownerId}-${month}`;
}

export interface GridOwner {
  id: number;
  displayName: string;
}

export interface TargetsGridProps {
  /** Business noun for the row owner — "พนักงานขาย" or "เขต". */
  ownerNoun: string;
  owners: GridOwner[];
  targetsByKey: Map<string, Target>;
  canEdit: boolean;
  savingKey: string | null;
  onSave: (
    ownerId: number,
    month: number,
    input: TargetCellInput
  ) => Promise<boolean>;
  onOpenProductGroups?: (target: Target) => void;
  onViewHistory?: (target: Target) => void;
}

interface BulkFailure {
  ownerName: string;
  month: number;
  reason: string;
}

function isCellDirty(draft: TargetCellDraft, target: Target | undefined): boolean {
  const revenue = Number(draft.revenueTarget);
  const customers = Number(draft.newCustomerTarget);
  // Incomplete input always counts as unsaved — never silently dropped.
  if (draft.revenueTarget.trim() === "" || draft.newCustomerTarget.trim() === "") return true;
  if (!Number.isFinite(revenue) || !Number.isFinite(customers)) return true;
  const storedRevenue = target ? Number(target.revenueTarget) : 0;
  const storedCustomers = target ? target.newCustomerTarget : 0;
  return revenue !== storedRevenue || customers !== storedCustomers;
}

export function TargetsGrid({
  ownerNoun,
  owners,
  targetsByKey,
  canEdit,
  savingKey,
  onSave,
  onOpenProductGroups,
  onViewHistory,
}: TargetsGridProps) {
  const [drafts, setDrafts] = useState<Record<string, TargetCellDraft | undefined>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [bulkFailures, setBulkFailures] = useState<BulkFailure[] | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [query, setQuery] = useState("");
  const [mobileOwnerId, setMobileOwnerId] = useState<number | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleOwners = useMemo(() => {
    if (!normalizedQuery) return owners;
    return owners.filter((owner) => owner.displayName.toLowerCase().includes(normalizedQuery));
  }, [owners, normalizedQuery]);

  const dirtyEntries = useMemo(
    () =>
      Object.entries(drafts).filter(([key, draft]) => draft && isCellDirty(draft, targetsByKey.get(key))) as [
        string,
        TargetCellDraft,
      ][],
    [drafts, targetsByKey]
  );
  const dirtyCount = dirtyEntries.length;

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (dirtyCount === 0) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyCount]);

  function setDraft(key: string, draft: TargetCellDraft | null) {
    setDrafts((prev) => {
      const next = { ...prev };
      if (draft === null) delete next[key];
      else next[key] = draft;
      return next;
    });
  }

  function ownerName(ownerId: number) {
    return owners.find((owner) => owner.id === ownerId)?.displayName ?? `#${ownerId}`;
  }

  function discardAll() {
    setDrafts({});
    setBulkFailures(null);
    setConfirmDiscard(false);
  }

  async function saveAll() {
    if (savingAll) return;
    setSavingAll(true);
    setBulkFailures(null);
    const failures: BulkFailure[] = [];
    for (const [key, draft] of dirtyEntries) {
      const [ownerId, month] = key.split("-").map(Number) as [number, number];
      const revenue = Number(draft.revenueTarget);
      const customers = Number(draft.newCustomerTarget);
      if (
        draft.revenueTarget.trim() === "" ||
        draft.newCustomerTarget.trim() === "" ||
        Number.isNaN(revenue) ||
        revenue < 0 ||
        !Number.isInteger(customers) ||
        customers < 0
      ) {
        failures.push({
          ownerName: ownerName(ownerId),
          month,
          reason: "ค่าที่กรอกไม่ถูกต้อง (ยอดขายต้องเป็นตัวเลขไม่ติดลบ ลูกค้าใหม่ต้องเป็นจำนวนเต็มไม่ติดลบ)",
        });
        continue;
      }
      const success = await onSave(ownerId, month, { revenueTarget: revenue, newCustomerTarget: customers });
      if (success) {
        setDraft(key, null);
      } else {
        failures.push({ ownerName: ownerName(ownerId), month, reason: "บันทึกไม่สำเร็จ" });
      }
    }
    setBulkFailures(failures.length > 0 ? failures : null);
    setSavingAll(false);
  }

  function renderCell(owner: GridOwner, month: number, wide = false) {
    const key = targetKey(owner.id, month);
    const target = targetsByKey.get(key);
    return (
      <TargetCell
        target={target}
        canEdit={canEdit}
        saving={savingKey === key || savingAll}
        draft={drafts[key] ?? null}
        onDraftChange={(draft) => setDraft(key, draft)}
        onSave={(input) => onSave(owner.id, month, input)}
        onOpenProductGroups={target && onOpenProductGroups ? () => onOpenProductGroups(target) : undefined}
        onViewHistory={target && onViewHistory ? () => onViewHistory(target) : undefined}
        wide={wide}
      />
    );
  }

  function renderDirtyBar(sticky = false) {
    if (!canEdit || dirtyCount === 0) return null;
    return (
      <div
        className={`flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning-subtle p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 ${
          sticky ? "sticky bottom-0 z-20" : ""
        }`}
        role="status"
      >
        <p className="text-sm font-medium text-warning">
          มี {dirtyCount.toLocaleString("th-TH")} ช่องยังไม่บันทึก — ออกจากหน้านี้โดยไม่บันทึกแล้วข้อมูลที่แก้ไขจะหาย
        </p>
        <div className="flex gap-2 sm:ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirmDiscard(true)}
            disabled={savingAll}
            className="min-h-[44px] sm:min-h-0"
          >
            ยกเลิกการแก้ไข
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void saveAll()}
            disabled={savingAll}
            className="min-h-[44px] sm:min-h-0"
          >
            {savingAll ? "กำลังบันทึก..." : `บันทึกทั้งหมด (${dirtyCount.toLocaleString("th-TH")})`}
          </Button>
        </div>
        {bulkFailures && (
          <ul className="w-full space-y-1 text-xs text-danger">
            {bulkFailures.map((failure, index) => (
              <li key={`${failure.ownerName}-${failure.month}-${index}`}>
                {failure.ownerName} — {formatThaiMonth(failure.month)}: {failure.reason}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (owners.length === 0) {
    return <p className="text-text-muted">ยังไม่มี{ownerNoun}ในระบบ</p>;
  }

  const mobileOwner =
    mobileOwnerId !== null && owners.some((owner) => owner.id === mobileOwnerId)
      ? owners.find((owner) => owner.id === mobileOwnerId)!
      : visibleOwners[0] ?? owners[0];

  return (
    <div className="space-y-3">
      {/* Search — the list is returned whole, so filtering is client-side only */}
      <div className="relative w-full max-w-xs">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`ค้นหา${ownerNoun}…`}
          aria-label={`ค้นหา${ownerNoun}`}
          className="pl-8"
        />
      </div>

      {renderDirtyBar()}

      {/* ── Desktop / tablet grid (≥1024px) ── */}
      <div className="hidden lg:block">
        {visibleOwners.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
            ไม่พบ{ownerNoun}ที่ตรงกับ &quot;{query.trim()}&quot;
          </p>
        ) : (
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-surface">
            <table className="min-w-max border-collapse text-sm">
              <thead>
                <tr className="bg-surface-subtle">
                  <th className="sticky left-0 top-0 z-30 border-b border-border bg-surface-subtle px-3 py-2 text-left font-medium text-text-secondary">
                    {ownerNoun}
                  </th>
                  {MONTHS.map((month) => (
                    <th
                      key={month}
                      className="sticky top-0 z-20 border-b border-border bg-surface-subtle px-2 py-2 text-left font-medium text-text-secondary"
                    >
                      {formatThaiMonth(month)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleOwners.map((owner) => (
                  <tr key={owner.id} className="border-b border-border last:border-0">
                    <td className="sticky left-0 z-10 border-r border-border bg-surface px-3 py-2 font-medium text-text-primary">
                      {owner.displayName}
                    </td>
                    {MONTHS.map((month) => (
                      <td key={month} className="px-1 py-1 align-top">
                        {renderCell(owner, month)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Mobile / small tablet (<1024px): per-owner vertical view ── */}
      <div className="space-y-3 lg:hidden">
        <div className="flex items-center gap-2 text-sm">
          <label className="shrink-0 font-medium text-text-secondary">{ownerNoun}</label>
          <Select
            value={String(mobileOwner?.id ?? "")}
            onChange={(e) => setMobileOwnerId(Number(e.target.value))}
            className="w-auto flex-1"
          >
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.displayName}
              </option>
            ))}
          </Select>
        </div>
        {mobileOwner && (
          <div className="divide-y divide-border rounded-lg border border-border bg-surface">
            {MONTHS.map((month) => (
              <div key={month} className="flex flex-col gap-2 p-3">
                <p className="text-sm font-medium text-text-primary">{formatThaiMonth(month)}</p>
                {renderCell(mobileOwner, month, true)}
              </div>
            ))}
          </div>
        )}
        {renderDirtyBar(true)}
      </div>

      {confirmDiscard && (
        <ConfirmDialog
          title="ยกเลิกการแก้ไขทั้งหมด?"
          description={`การแก้ไขที่ยังไม่บันทึกทั้งหมด ${dirtyCount.toLocaleString("th-TH")} ช่องจะถูกยกเลิก และค่าเดิมจะกลับมาแสดงแทน`}
          confirmLabel="ยกเลิกการแก้ไข"
          cancelLabel="กลับไปแก้ไขต่อ"
          tone="danger"
          onConfirm={discardAll}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
    </div>
  );
}

export default TargetsGrid;
