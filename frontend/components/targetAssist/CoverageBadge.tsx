import { formatRatioPercent } from "@/lib/targetLabels";

interface CoverageBadgeProps {
  /** What the coverage is of — e.g. "ภาค" or "เขต". */
  scopeLabel: string;
  coverage: number | null;
  /** Present only on region level, where minRegionCoverage decides pass/fail. */
  gate?: { pass: boolean };
}

const BADGE_BASE_CLASS = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium";

export default function CoverageBadge({ scopeLabel, coverage, gate }: CoverageBadgeProps) {
  const toneClass = !gate ? "border border-zinc-200 bg-zinc-100 text-zinc-700" : gate.pass ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-900";
  return (
    <span className={`${BADGE_BASE_CLASS} ${toneClass}`}>
      {scopeLabel} {formatRatioPercent(coverage)}
      {gate && (gate.pass ? " · ผ่านเกณฑ์" : " · ไม่ผ่านเกณฑ์")}
    </span>
  );
}
