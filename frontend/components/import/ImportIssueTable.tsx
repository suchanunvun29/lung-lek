"use client";

import { useMemo, useState } from "react";
import { ImportIssue, ImportIssueLevel } from "@/lib/types";
import { IMPORT_ISSUE_LEVEL_BADGE_CLASS, IMPORT_ISSUE_LEVEL_LABEL_TH } from "@/lib/importLabels";

type LevelFilter = ImportIssueLevel | "ALL";

const SHARED_CREDIT_ISSUE_LABELS: Record<string, string> = {
  SHARED_CREDIT_RULE_CREATED: "สร้างกฎแบ่งเครดิตดีลร่วมใหม่",
  UNKNOWN_SALESMAN_IN_SHARED_DEAL: "ไม่พบพนักงานขายในดีลร่วม",
};

interface ImportIssueTableProps {
  issues: ImportIssue[];
}

export default function ImportIssueTable({ issues }: ImportIssueTableProps) {
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("ALL");

  const filtered = useMemo(
    () => (levelFilter === "ALL" ? issues : issues.filter((issue) => issue.level === levelFilter)),
    [issues, levelFilter]
  );

  const errorCount = issues.filter((issue) => issue.level === "ERROR").length;
  const warningCount = issues.filter((issue) => issue.level === "WARNING").length;

  if (issues.length === 0) {
    return <p className="text-sm text-zinc-500">ไม่พบปัญหาในการนำเข้าครั้งนี้</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">
          รายการปัญหา ({errorCount} ข้อผิดพลาด, {warningCount} คำเตือน)
        </h3>
        <div className="flex gap-1 text-sm">
          {(["ALL", "ERROR", "WARNING"] as LevelFilter[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setLevelFilter(level)}
              className={`rounded px-3 py-1 font-medium ${
                levelFilter === level ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {level === "ALL" ? "ทั้งหมด" : IMPORT_ISSUE_LEVEL_LABEL_TH[level]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">ระดับ</th>
              <th className="px-4 py-3">แถวที่</th>
              <th className="px-4 py-3">รหัส</th>
              <th className="px-4 py-3">รายละเอียด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.map((issue) => (
              <tr key={issue.id}>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${IMPORT_ISSUE_LEVEL_BADGE_CLASS[issue.level]}`}
                  >
                    {IMPORT_ISSUE_LEVEL_LABEL_TH[issue.level]}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-600">{issue.rowNumber ?? "-"}</td>
                <td className="px-4 py-3">
                  {SHARED_CREDIT_ISSUE_LABELS[issue.code] ? (
                    <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                      {SHARED_CREDIT_ISSUE_LABELS[issue.code]}
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-zinc-500">{issue.code}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-700">{issue.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
