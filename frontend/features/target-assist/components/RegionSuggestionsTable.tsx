import { RegionSuggestionGroup } from "@/lib/types";
import { formatRatioPercent, formatTargetMoney } from "@/features/targets/utils/targetLabels";
import { CoverageBadge } from "./CoverageBadge";
import { CoverageNotice } from "./CoverageNotice";

export interface RegionSuggestionsTableProps {
  regions: RegionSuggestionGroup[];
}

function formatSignedMoney(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatTargetMoney(Math.abs(value))}`;
}

function formatPenetration(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("th-TH", { maximumFractionDigits: 1 });
}

export function RegionSuggestionsTable({ regions }: RegionSuggestionsTableProps) {
  if (regions.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
        ยังไม่มีภาคใดที่มีข้อมูลการขายหรือเขตรับผิดชอบ
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {regions.map((region) => (
        <section key={region.regionId} className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <header className="space-y-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-zinc-900">{region.regionName}</h3>
              <CoverageBadge
                scopeLabel="ภาค"
                coverage={region.regionCoverage}
                gate={{ pass: region.coveragePass }}
              />
            </div>
            <CoverageNotice
              coveragePercent={region.regionCoverage === null ? null : region.regionCoverage * 100}
              regionName={region.regionName}
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600">
              <span>
                R (เป้าอ้างอิงของภาค) ={" "}
                <span className="font-medium text-zinc-900">{formatTargetMoney(region.r)}</span> บาท/เดือน
              </span>
              <span>
                Σ suggested − R ={" "}
                <span className={`font-medium ${region.differenceFromR === 0 ? "text-zinc-900" : "text-amber-700"}`}>
                  {formatSignedMoney(region.differenceFromR)}
                </span>{" "}
                บาท/เดือน (ระบบไม่ renormalize ให้ลงตัว — ผู้จัดการเป็นผู้เกลี่ยเอง)
              </span>
            </div>
          </header>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-white text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">เขต</th>
                  <th className="px-4 py-3">ศักยภาพ</th>
                  <th className="px-4 py-3">ส่วนแบ่งศักยภาพ</th>
                  <th className="px-4 py-3">coverage เขต</th>
                  <th className="px-4 py-3">ประวัติ ก่อนตัด</th>
                  <th className="px-4 py-3">ประวัติ หลังตัด</th>
                  <th className="px-4 py-3">historyBased /เดือน</th>
                  <th className="px-4 py-3">potentialBased /เดือน</th>
                  <th className="px-4 py-3">ส่วนต่าง hist−pot</th>
                  <th className="px-4 py-3">w (น้ำหนักศักยภาพ)</th>
                  <th className="px-4 py-3">suggested /เดือน</th>
                  <th className="px-4 py-3">penetration (บาท/หน่วยศักยภาพ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {region.territories.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-6 text-center text-zinc-400">
                      ไม่มีเขตใดรับผิดชอบโรงพยาบาลในภาคนี้
                    </td>
                  </tr>
                )}
                {region.territories.map((row) => (
                  <tr key={row.territoryId}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-900">{row.territoryName}</td>
                    <td className="px-4 py-3 text-zinc-700">{formatTargetMoney(row.potential)}</td>
                    <td className="px-4 py-3 text-zinc-700">{formatRatioPercent(row.potentialShare)}</td>
                    <td className="px-4 py-3 text-zinc-700">{formatRatioPercent(row.territoryCoverage)}</td>
                    <td className="px-4 py-3 text-zinc-500">{formatTargetMoney(row.historyBeforeCut)}</td>
                    <td className="px-4 py-3 text-zinc-700">{formatTargetMoney(row.historyAfterCut)}</td>
                    <td className="px-4 py-3 font-medium text-zinc-900">{formatTargetMoney(row.historyBased)}</td>
                    <td className="px-4 py-3 font-medium text-zinc-900">{formatTargetMoney(row.potentialBased)}</td>
                    <td className="px-4 py-3 font-medium text-amber-700">
                      {formatSignedMoney(row.historyBased - row.potentialBased)}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{formatRatioPercent(row.w)}</td>
                    <td className="px-4 py-3 font-semibold text-zinc-900">{formatTargetMoney(row.suggested)}</td>
                    <td className="px-4 py-3 text-zinc-700">{formatPenetration(row.penetrationIndex)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

export default RegionSuggestionsTable;
