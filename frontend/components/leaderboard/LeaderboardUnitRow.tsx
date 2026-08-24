"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/importLabels";
import { LeaderboardUnit } from "@/lib/types";

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function rankLabel(rank: number | null): string {
  if (rank === null) return "—";
  return RANK_MEDAL[rank] ?? String(rank);
}

/** Renders strictly from server-sent fields — restricted (TERRITORY_RANK_ONLY) units show only
 *  name/owners/rank/score/label, never money or %ถึงเป้า (Data Visibility Rules ข้อ 6). */
export default function LeaderboardUnitRow({ unit, onDrillDown }: { unit: LeaderboardUnit; onDrillDown: (unit: LeaderboardUnit) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isGroup = unit.unitType === "GROUP";

  return (
    <li className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {isGroup && (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="shrink-0 rounded border border-zinc-300 px-1.5 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100"
              aria-expanded={expanded}
            >
              {expanded ? "▾" : "▸"} สมาชิก
            </button>
          )}
          <span className="w-9 shrink-0 text-center text-lg font-semibold text-zinc-500">{rankLabel(unit.rank)}</span>
          <div className="min-w-0">
            <p className="truncate font-medium text-zinc-900">{unit.name}</p>
            <p className="text-xs text-zinc-500">{unit.ownerNames.join(", ")}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-right">
          <div>
            <p className="font-semibold text-zinc-900">{unit.compositeScore !== null ? unit.compositeScore.toFixed(2) : "—"}</p>
            <p className="text-xs text-zinc-500">{unit.computedMetricLabel}</p>
          </div>
          {unit.visibility === "TERRITORY_FULL" && (
            <div className="hidden sm:block">
              <p className="font-semibold text-zinc-900">{formatMoney(unit.revenue ?? 0)}</p>
              <p className="text-xs text-zinc-500">
                {unit.targetLabel ??
                  (unit.achievementPercent !== null && unit.achievementPercent !== undefined
                    ? `${unit.achievementPercent.toFixed(1)}% ของเป้า ${formatMoney(unit.target ?? 0)}`
                    : "ยังไม่ได้ตั้งเป้า")}
              </p>
            </div>
          )}
          {!isGroup && (
            <button type="button" onClick={() => onDrillDown(unit)} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
              ดูรายบุคคล
            </button>
          )}
        </div>
      </div>

      {/* Criterion reason for FULL rows that landed in the tail block — never shown instead of a value. */}
      {unit.visibility === "TERRITORY_FULL" && unit.rank === null && unit.criterionReason && (
        <p className="border-t border-zinc-100 px-4 py-2 text-xs text-amber-700">{unit.criterionReason}</p>
      )}

      {isGroup && expanded && (
        <ul className="space-y-1 border-t border-zinc-100 bg-zinc-50 px-4 py-3">
          {(unit.members ?? []).length === 0 && <li className="text-xs text-zinc-400">กลุ่มนี้ยังไม่มีเขตสมาชิกในงวดนี้</li>}
          {(unit.members ?? []).map((member) => (
            <li key={member.territoryId} className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-200 bg-white px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-800">{member.name}</p>
                <p className="text-xs text-zinc-500">{member.ownerNames.join(", ")}</p>
              </div>
              <div className="flex items-center gap-3 text-right">
                <span className="text-xs text-zinc-500">{member.rank ? `อันดับ ${member.rank}` : ""}</span>
                <span className="font-semibold text-zinc-800">{member.compositeScore !== null ? member.compositeScore.toFixed(2) : "—"}</span>
                {member.visibility === "TERRITORY_FULL" && (
                  <span className="text-xs text-zinc-600">
                    {formatMoney(member.revenue ?? 0)}
                    {member.achievementPercent !== null && member.achievementPercent !== undefined ? ` · ${member.achievementPercent.toFixed(1)}%` : ""}
                  </span>
                )}
                <span className="text-xs text-zinc-400">{member.computedMetricLabel}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
