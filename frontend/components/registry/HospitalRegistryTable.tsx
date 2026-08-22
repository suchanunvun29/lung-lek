import { HospitalRegistry, PotentialMetricKey } from "@/lib/types";

interface HospitalRegistryTableProps {
  registries: HospitalRegistry[];
}

const METRIC_LABEL_TH: Record<PotentialMetricKey, string> = {
  BEDS: "จำนวนเตียง",
  CMI: "CMI",
  SUM_ADJ_RW: "SumAdjRW",
  OCCUPANCY_RATE: "อัตราครองเตียง",
  PATIENTS: "จำนวนผู้ป่วย",
  VISITS: "จำนวนครั้งรับบริการ",
};

function metricValue(registry: HospitalRegistry, metric: PotentialMetricKey) {
  return registry.metrics.find((item) => item.metric === metric)?.value ?? null;
}

function formatMetric(value: string | null) {
  if (value === null) return "—";
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue.toLocaleString("th-TH", { maximumFractionDigits: 2 }) : value;
}

export default function HospitalRegistryTable({ registries }: HospitalRegistryTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">รหัส ร.พ.</th>
            <th className="px-4 py-3">โรงพยาบาล</th>
            <th className="px-4 py-3">จังหวัด / ภาค</th>
            <th className="px-4 py-3">เขตสุขภาพ / ระดับ</th>
            <th className="px-4 py-3">{METRIC_LABEL_TH.BEDS}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {registries.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
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
              <td className="px-4 py-3 text-zinc-700">{formatMetric(metricValue(registry, "BEDS"))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
