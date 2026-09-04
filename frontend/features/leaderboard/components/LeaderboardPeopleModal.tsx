"use client";

import { useEffect, useState } from "react";
import { getTerritoryLeaderboardPeople } from "@/features/leaderboard/api/leaderboard.api";
import { getErrorMessage } from "@/lib/api-client";
import { LeaderboardCriteria, LeaderboardPeopleOrSummary, LeaderboardUnit, PeriodKey } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/shared/feedback/EmptyState";

export interface LeaderboardPeopleModalProps {
  token: string;
  criteria: LeaderboardCriteria;
  period: PeriodKey;
  unit: LeaderboardUnit;
  onClose: () => void;
}

/**
 * Tier-2 drill-down — WACC-P1-008.
 *
 * Which version renders is decided entirely by the server's response — the UI
 * never synthesises one shape from another:
 *  • FULL — MANAGER / supervisor of this territory: every person's composite.
 *  • SELF_SUMMARY — a plain member of the territory: exactly { rank, totalRanked,
 *    ownValue, teamAverage }, presented under its own explicit heading because it
 *    is a different thing from an empty list.
 *  • null — no permission at all (non-member): an explicit "no permission" state,
 *    not a blank modal (Data Visibility Rules ข้อ 3/ข้อ 7).
 */
export function LeaderboardPeopleModal({ token, criteria, period, unit, onClose }: LeaderboardPeopleModalProps) {
  const [data, setData] = useState<LeaderboardPeopleOrSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // The modal mounts fresh per opening, so loading starts true and error null —
    // no synchronous reset needed here.
    let cancelled = false;
    getTerritoryLeaderboardPeople(token, unit.territoryId, criteria, period)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(getErrorMessage(loadError, "โหลดข้อมูลรายบุคคลไม่สำเร็จ"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, unit.territoryId, criteria, period]);

  return (
    <Modal
      title={`รายบุคคลใน${unit.unitType === "GROUP" ? "กลุ่มเขตของ " : "เขต "}${unit.name}`}
      onClose={onClose}
      widthClassName="max-w-2xl"
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && !error && <p className="text-sm text-zinc-400">กำลังโหลด...</p>}

      {!loading && !error && data === null && (
        <EmptyState
          title="ไม่มีสิทธิ์ดูรายชื่อในเขตนี้"
          description="การดูรายชื่อรายบุคคลจำกัดเฉพาะผู้จัดการและหัวหน้าเขต — หากคุณเป็นสมาชิกของเขตนี้ ระบบจะแสดงสรุปเฉพาะของคุณแทน"
          className="mt-2"
        />
      )}

      {!loading && !error && data?.mode === "FULL" && (
        <ul className="space-y-2">
          {data.results.length === 0 && <li className="text-sm text-zinc-400">ยังไม่มีผู้ดูแลที่มีผลอยู่</li>}
          {data.results.map((row) => (
            <li key={row.salesperson.id} className="rounded-lg border border-zinc-200 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-zinc-900">{row.salesperson.displayName}</span>
                <span className="font-semibold">
                  {row.composite.composite !== null ? `${row.composite.composite.toFixed(2)} คะแนน` : "—"}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{row.composite.computedFromLabel}</p>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && data?.mode === "SELF_SUMMARY" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">สรุปเฉพาะของคุณในเขตนี้</p>
          <p className="mt-1 text-xs text-amber-700">
            สิทธิ์การดูของคุณจำกัดเฉพาะอันดับและสถิติของตัวเองเทียบค่าเฉลี่ยทีม — ไม่มีรายชื่อของผู้อื่นในการตอบนี้
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-amber-700">อันดับของคุณตามเกณฑ์</dt>
              <dd className="font-semibold">{data.rank !== null ? `${data.rank} จาก ${data.totalRanked}` : data.reason ?? "คำนวณไม่ได้"}</dd>
            </div>
            <div>
              <dt className="text-amber-700">ค่าของคุณตามเกณฑ์</dt>
              <dd className="font-semibold">{data.ownComputable && data.ownValue !== null ? data.ownValue.toFixed(2) : data.reason ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-amber-700">คะแนนรวมเฉลี่ยทีม</dt>
              <dd className="font-semibold">{data.teamAverage !== null ? data.teamAverage.toFixed(2) : "—"}</dd>
            </div>
            <div>
              <dt className="text-amber-700">จำนวนคนที่คำนวณเกณฑ์นี้ได้จริง</dt>
              <dd className="font-semibold">{data.totalRanked}</dd>
            </div>
          </dl>
        </div>
      )}
    </Modal>
  );
}

export default LeaderboardPeopleModal;
