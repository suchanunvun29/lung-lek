"use client";

import { useState } from "react";
import { HospitalRegistry } from "@/lib/types";
import { POTENTIAL_METRIC_LABEL_TH } from "@/lib/targetLabels";
import { DataTable, DataTableColumn } from "@/components/shared/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface HospitalRegistryTableProps {
  registries: HospitalRegistry[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Present while its PATCH /hospital-registry/:id/potential-adjustment round-trips. */
  savingId: number | null;
  onSaveAdjustment: (registryId: number, potentialAdjustment: number) => Promise<boolean>;
  /** Server pagination — the endpoint owns paging; this table never sorts or searches locally. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
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

/** requirement 10.5 — ค่าปรับ/ยกเว้นรายโรงพยาบาล; 0 ตัดโรงพยาบาลนั้นออกจากศักยภาพทั้งหมด.
 *  The value stays a number; 0 is a real value, never treated as empty. */
function AdjustmentCell({ registry, saving, onSave }: { registry: HospitalRegistry; saving: boolean; onSave: (registryId: number, potentialAdjustment: number) => Promise<boolean> }) {
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
          inputMode="decimal"
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

/** The registry grid on Pattern B: DataTable in `serverPaginated` mode — paging (and the
 *  q / province / territory filtering) belongs to the API, so no sort or client-search
 *  affordance is rendered (correction C4). Inline adjustment editing is unchanged. */
export function HospitalRegistryTable({
  registries,
  loading,
  error,
  onRetry,
  savingId,
  onSaveAdjustment,
  page,
  pageSize,
  total,
  onPageChange,
}: HospitalRegistryTableProps) {
  const columns: DataTableColumn<HospitalRegistry>[] = [
    {
      key: "sourceCode",
      header: "รหัส ร.พ.",
      render: (registry) => <span className="font-mono text-zinc-700">{registry.sourceCode ?? "—"}</span>,
      priority: 2,
      mobileRole: "meta",
    },
    {
      key: "displayName",
      header: "โรงพยาบาล",
      render: (registry) => (
        <div className="min-w-0">
          <p className="font-medium text-zinc-900">{registry.displayName}</p>
          {registry.nameInFile !== registry.displayName && (
            <p className="mt-0.5 truncate text-xs text-zinc-500">{registry.nameInFile}</p>
          )}
        </div>
      ),
      priority: 1,
      mobileRole: "identity",
    },
    {
      key: "province",
      header: "จังหวัด / ภาค",
      render: (registry) => (
        <div>
          <p className="text-zinc-600">{registry.provinceMapping?.canonicalName ?? (registry.provinceRaw || "—")}</p>
          {registry.region && <p className="mt-0.5 text-xs text-zinc-500">{registry.region.name}</p>}
        </div>
      ),
      priority: 3,
      mobileRole: "meta",
    },
    {
      key: "healthZone",
      header: "เขตสุขภาพ / ระดับ",
      render: (registry) => (
        <div>
          <p className="text-zinc-600">{registry.healthZone ?? "—"}</p>
          {registry.tier && <p className="mt-0.5 text-xs text-zinc-500">{registry.tier}</p>}
        </div>
      ),
      priority: 3,
      mobileRole: "meta",
    },
    {
      key: "beds",
      header: POTENTIAL_METRIC_LABEL_TH.BEDS,
      numeric: true,
      render: (registry) => <span className="text-zinc-700">{formatMetric(metricValue(registry))}</span>,
      priority: 2,
      mobileRole: "meta",
    },
    {
      key: "potentialAdjustment",
      header: "ค่าปรับศักยภาพ",
      render: (registry) => (
        <AdjustmentCell registry={registry} saving={savingId === registry.id} onSave={onSaveAdjustment} />
      ),
      priority: 1,
      mobileRole: "metric",
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={registries}
      getRowId={(registry) => registry.id}
      caption="ทะเบียนโรงพยาบาล — ค่าปรับศักยภาพรายแห่ง"
      density="comfortable"
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyTitle="ยังไม่มีข้อมูลทะเบียนโรงพยาบาล"
      emptyDescription="นำเข้าไฟล์ทะเบียน หรือปรับตัวกรอง/คำค้นหาเพื่อดูรายการ"
      serverPaginated
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={onPageChange}
    />
  );
}

export default HospitalRegistryTable;
