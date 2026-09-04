"use client";

import { useState } from "react";
import { Target, TerritorySuggestedTotal } from "@/lib/types";
import { formatTargetMoney } from "@/features/targets/utils/targetLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface AcceptOffersPanelProps {
  totals: TerritorySuggestedTotal[];
  existingByTerritoryId: Map<number, Target>;
  savingTerritoryId: number | null;
  onSave: (territoryId: number, revenueTarget: number) => Promise<boolean>;
}

function OfferRow({
  total,
  existing,
  saving,
  onSave,
}: {
  total: TerritorySuggestedTotal;
  existing?: Target;
  saving: boolean;
  onSave: (territoryId: number, revenueTarget: number) => Promise<boolean>;
}) {
  const [revenueRaw, setRevenueRaw] = useState(String(total.suggestedTotal));
  const [saved, setSaved] = useState(false);
  const revenue = Number(revenueRaw);
  const valid = Number.isFinite(revenue) && revenue >= 0;

  async function handleSave() {
    if (!valid || saving) return;
    const ok = await onSave(total.territoryId, revenue);
    if (ok) setSaved(true);
  }

  return (
    <tr>
      <td className="whitespace-nowrap px-4 py-3 font-medium text-text-primary">{total.territoryName}</td>
      <td className="px-4 py-3 text-text-muted font-numeric">{formatTargetMoney(total.suggestedTotal)}</td>
      <td className="px-4 py-3">
        <Input
          type="number"
          min={0}
          aria-label={`เป้ายอดขายของเขต ${total.territoryName}`}
          value={revenueRaw}
          onChange={(e) => {
            setSaved(false);
            setRevenueRaw(e.target.value);
          }}
          className={`w-40 text-right ${saved ? "border-success/40 bg-success-subtle" : ""}`}
        />
      </td>
      <td className="px-4 py-3 text-text-secondary font-numeric">
        {existing ? formatTargetMoney(existing.revenueTarget) : "ยังไม่มีเป้า"}
      </td>
      <td className="px-4 py-3 text-right">
        <Button
          type="button"
          size="sm"
          disabled={!valid || saving}
          onClick={() => void handleSave()}
          className="text-xs px-3 py-1.5"
        >
          {saving ? "กำลังบันทึก..." : "รับข้อเสนอ"}
        </Button>
      </td>
    </tr>
  );
}

export function AcceptOffersPanel({ totals, existingByTerritoryId, savingTerritoryId, onSave }: AcceptOffersPanelProps) {
  if (totals.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
        ยังไม่มีตัวเลขข้อเสนอต่อเขตในงวดนี้
      </p>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-surface shadow-xs">
      <header className="border-b border-border bg-surface-subtle/70 px-4 py-3">
        <h3 className="text-base font-semibold text-text-primary">รับข้อเสนอเข้าเป้ารายเขต</h3>
        <p className="mt-1 text-xs text-text-muted">
          ค่าที่เสนอ = Σ suggested ทุกภาค + ยอดที่ระบุภาคไม่ได้ · แก้ตัวเลขก่อนบันทึกได้ ·
          เขียนผ่านเป้ารายเขต (TERRITORY) เดิม และไม่แก้เป้าลูกค้าใหม่ของเขต
        </p>
      </header>
      <div className="overflow-x-auto max-h-[35vh] overflow-y-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="sticky top-0 z-10 bg-surface-subtle text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
            <tr>
              <th className="px-4 py-3">เขต</th>
              <th className="px-4 py-3">ระบบเสนอ</th>
              <th className="px-4 py-3">ยอดที่จะบันทึก (แก้ได้)</th>
              <th className="px-4 py-3">เป้ายอดขายปัจจุบัน</th>
              <th className="px-4 py-3">
                <span className="sr-only">การจัดการ</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {totals.map((total) => (
              <OfferRow
                key={total.territoryId}
                total={total}
                existing={existingByTerritoryId.get(total.territoryId)}
                saving={savingTerritoryId === total.territoryId}
                onSave={onSave}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default AcceptOffersPanel;
