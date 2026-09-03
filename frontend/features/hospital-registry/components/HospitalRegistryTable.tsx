"use client";

import { useState } from "react";
import { HospitalRegistry } from "@/lib/types";
import { POTENTIAL_METRIC_LABEL_TH } from "@/lib/targetLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface HospitalRegistryTableProps {
  registries: HospitalRegistry[];
  /** Present while its PATCH /hospital-registry/:id/potential-adjustment round-trips. */
  savingId: string | null;
  onSaveAdjustment: (registryId: string, potentialAdjustment: number) => Promise<boolean>;
}

const ADJUSTMENT_MIN = 0;
const ADJUSTMENT_MAX = 999.999;

function formatDecimal(value: string): string {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString("th-TH", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : value;
}

function metricValue(registry: HospitalRegistry) {
  return registry.metrics.find((item) => item.metric === "BEDS")?.value ?? null;
}

function formatMetric(value: string | null) {
  if (value === null) return "—";
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue.toLocaleString("th-TH", { maximumFractionDigits: 2 }) : value;
}

/** requirement 10.5 — ค่าปรับ/ยกเว้นรายโรงพยาบาล; 0 ตัดโรงพยาบาลนั้นออกจากศักยภาพทั้งหมด. */
function AdjustmentCell({ registry, saving, onSave }: { registry: HospitalRegistry; saving: boolean; onSave: (registryId: string, potentialAdjustment: number) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(Number(registry.potentialAdjustment)));
  const value = Number(raw);
  const valid = Number.isFinite(value) && value >= ADJUSTMENT_MIN && value <= ADJUSTMENT_MAX;

  async function handleSave() {
    if (!valid || saving) return;
    const ok = await onSave(registry.id, value);
    if (ok) setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className={registry.potentialAdjustment === "0" ? "font-medium text-amber-700" : "text-zinc-700"}>
          {formatDecimal(registry.potentialAdjustment)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setRaw(String(Number(registry.potentialAdjustment)));
            setEditing(true);
          }}
          className="text-xs px-2 py-1"
        >
          แก้ไข
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={ADJUSTMENT_MIN}
          max={ADJUSTMENT_MAX}
          step={0.001}
          aria-label={`ค่าปรับศักยภาพของ ${registry.displayName}`}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="w-24 text-right"
        />
        <Button
          type="button"
          size="sm"
          disabled={!valid || saving}
          onClick={() => void handleSave()}
          className="bg-zinc-900 text-white hover:bg-zinc-800 text-xs px-2 py-1"
        >
          {saving ? "..." : "บันทึก"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditing(false)}
          className="text-xs px-2 py-1"
        >
          ยกเลิก
        </Button>
      </div>
      {!valid && <span className="text-xs text-red-600">ต้องเป็น 0–{ADJUSTMENT_MAX}</span>}
    </div>
  );
}

export function HospitalRegistryTable({ registries, savingId, onSaveAdjustment }: HospitalRegistryTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">รหัส ร.พ.</th>
            <th className="px-4 py-3">โรงพยาบาล</th>
            <th className="px-4 py-3">จังหวัด / ภาค</th>
            <th className="px-4 py-3">เขตสุขภาพ / ระดับ</th>
            <th className="px-4 py-3">{POTENTIAL_METRIC_LABEL_TH.BEDS}</th>
            <th className="px-4 py-3">ค่าปรับศักยภาพ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {registries.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-zinc-400">
                ยังไม่มีข้อมูลทะเบียนโรงพยาบาล
              </td>
            </tr>
          )}
          {registries.map((registry) => (
            <tr key={registry.id}>
              <td className="px-4 py-3 font-mono text-zinc-700">{registry.sourceCode ?? "—"}</td>
              <td className="px-4 py-3">
                <p className="font-medium text-zinc-900">{registry.displayName}</p>
                {registry.nameInFile !== registry.displayName && <p className="mt-1 text-xs text-zinc-500">{registry.nameInFile}</p>}
              </td>
              <td className="px-4 py-3 text-zinc-600">
                <p>{registry.provinceMapping?.canonicalName ?? (registry.provinceRaw || "—")}</p>
                {registry.region && <p className="mt-1 text-xs text-zinc-500">{registry.region.name}</p>}
              </td>
              <td className="px-4 py-3 text-zinc-600">
                <p>{registry.healthZone ?? "—"}</p>
                {registry.tier && <p className="mt-1 text-xs text-zinc-500">{registry.tier}</p>}
              </td>
              <td className="px-4 py-3 text-zinc-700">{formatMetric(metricValue(registry))}</td>
              <td className="px-4 py-3">
                <AdjustmentCell registry={registry} saving={savingId === registry.id} onSave={onSaveAdjustment} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default HospitalRegistryTable;
