"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/importLabels";
import { LeaderboardMemberRow, LeaderboardUnit } from "@/lib/types";
import { RestrictedValue } from "@/components/shared/data-table/RestrictedValue";

/**
 * The identity cell of a leaderboard row — WACC-P1-008.
 *
 * Unit name + owners, and for a GROUP unit its member territories as detail
 * under the group row itself (business rule G: members never become their own
 * ranked rows). Members render strictly from server-sent fields: a
 * TERRITORY_FULL member shows its revenue/achievement; a TERRITORY_RANK_ONLY
 * member renders `RestrictedValue` keyed on its own `visibility` — the money
 * the server withheld is marked, never silently omitted and never inferred.
 */
export function LeaderboardUnitNameCell({ unit }: { unit: LeaderboardUnit }) {
  const isGroup = unit.unitType === "GROUP";

  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-text-primary">{unit.name}</p>
      <p className="truncate text-xs text-text-muted">{unit.ownerNames.join(", ")}</p>
      {isGroup && <LeaderboardGroupMembers members={unit.members ?? []} />}
    </div>
  );
}

function LeaderboardGroupMembers({ members }: { members: LeaderboardMemberRow[] }) {
  const [expanded, setExpanded] = useState(false);

  if (members.length === 0) {
    return <p className="mt-1 text-xs text-text-muted">กลุ่มนี้ยังไม่มีเขตสมาชิกในงวดนี้</p>;
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className="cursor-pointer rounded border border-border px-1.5 py-0.5 text-xs text-text-secondary hover:bg-surface-subtle"
      >
        {expanded ? "▾" : "▸"} สมาชิก ({members.length})
      </button>
      {expanded && (
        <ul className="mt-2 space-y-1">
          {members.map((member) => (
            <li key={member.territoryId} className="rounded border border-border bg-surface-subtle px-2.5 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-text-primary">{member.name}</p>
                <p className="truncate text-xs text-text-muted">{member.ownerNames.join(", ")}</p>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="text-text-muted">{member.rank ? `อันดับ ${member.rank}` : ""}</span>
                <span className="font-semibold text-text-primary font-numeric">
                  {member.compositeScore !== null ? member.compositeScore.toFixed(2) : "—"}
                </span>
                {member.visibility === "TERRITORY_FULL" ? (
                  <span className="text-text-secondary font-numeric">
                    {formatMoney(member.revenue ?? 0)}
                    {member.achievementPercent !== null && member.achievementPercent !== undefined
                      ? ` · ${member.achievementPercent.toFixed(1)}%`
                      : ""}
                  </span>
                ) : (
                  <RestrictedValue visibility={member.visibility} />
                )}
                <span className="text-text-muted">{member.computedMetricLabel}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default LeaderboardUnitNameCell;
