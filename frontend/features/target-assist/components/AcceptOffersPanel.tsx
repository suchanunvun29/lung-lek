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
      <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-900">{total.territoryName}</td>
      <td className="px-4 py-3 text-zinc-500">{formatTargetMoney(total.suggestedTotal)}</td>
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
          className={`w-40 text-right ${saved ? "border-emerald-300 bg-emerald-50" : "border-zinc-300"}`}
        />
      </td>
      <td className="px-4 py-3 text-zinc-600">
        {existing ? formatTargetMoney(existing.revenueTarget) : "ยังไม่มีเป้า"}
      </td>
      <td className="px-4 py-3 text-right">
        <Button
          type="button"
          size="sm"
          disabled={!valid || saving}
          onClick={() => void handleSave()}
          className="bg-zinc-900 text-white hover:bg-zinc-800 text-xs px-3 py-1.5"
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
    <section className="rounded-lg border border-zinc-200 bg-white">
      <header className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        <h3 className="text-base font-semibold text-zinc-900">รับข้อเสนอเข้าเป้ารายเขต</h3>
        <p className="mt-1 text-sm text-zinc-600">
          ค่าที่เสนอ = Σ suggested ทุกภาค + unmappedBase · แก้ตัวเลขก่อนบันทึกได้ ·
          เขียนผ่านเป้ารายเขต (TERRITORY) เดิม และไม่แก้เป้าลูกค้าใหม่ของเขต
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
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
          <tbody className="divide-y divide-zinc-100">
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
