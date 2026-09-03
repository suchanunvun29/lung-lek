import { formatMoney } from "@/lib/importLabels";
import { TerritoryGroupKpiRow } from "@/lib/types";

export interface TerritoryGroupKpiTableProps {
  groups: TerritoryGroupKpiRow[];
}

function percentage(value: number | null) {
  return value === null ? "ยังไม่ได้ตั้งเป้า" : `${value.toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`;
}

function ownerLabel(owners: string[]) {
  return owners.length ? owners.join(", ") : "ยังไม่มีผู้ดูแล";
}

export function TerritoryGroupKpiTable({ groups }: TerritoryGroupKpiTableProps) {
  if (!groups.length) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold text-zinc-900">เป้ารวมกลุ่มเขต</h2>
      <p className="mt-1 text-sm text-zinc-600">ยอดของกลุ่มเป็นผลรวมของเขตสมาชิก จึงไม่รวมซ้ำในยอดรวมตารางเขตด้านบน</p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">กลุ่มเขต</th>
              <th className="px-4 py-3">ผู้ดูแล</th>
              <th className="px-4 py-3 text-right">ยอดรวม</th>
              <th className="px-4 py-3 text-right">เป้ารวม</th>
              <th className="px-4 py-3 text-right">% ถึงเป้า</th>
              <th className="px-4 py-3">คะแนนรวม</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {groups.map((group) => {
              const full = group.visibility === "TERRITORY_FULL";
              return (
                <tr key={group.territoryId}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{group.name}</td>
                  <td className="px-4 py-3 text-zinc-600">{ownerLabel(group.ownerNames)}</td>
                  {full ? (
                    <>
                      <td className="px-4 py-3 text-right">{formatMoney(group.revenue)}</td>
                      <td className="px-4 py-3 text-right">{group.revenueTarget === null ? "—" : formatMoney(group.revenueTarget)}</td>
                      <td className="px-4 py-3 text-right">{percentage(group.achievementPercent)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-zinc-400">—</td>
                      <td className="px-4 py-3 text-zinc-400">—</td>
                      <td className="px-4 py-3 text-zinc-400">—</td>
                    </>
                  )}
                  <td className="px-4 py-3">
                    <p className="font-semibold text-zinc-900">{group.compositeScore === null ? "—" : group.compositeScore.toLocaleString("th-TH", { maximumFractionDigits: 1 })}</p>
                    <p className="mt-1 text-xs text-zinc-500">{group.computedMetricLabel}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default TerritoryGroupKpiTable;
