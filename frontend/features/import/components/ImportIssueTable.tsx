"use client";

import { useMemo, useState } from "react";
import { ImportIssue, ImportIssueLevel } from "@/lib/types";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table/DataTable";
import { StatusBadge } from "@/components/shared/status/StatusBadge";
import { Select } from "@/components/ui/select";

type LevelFilter = ImportIssueLevel | "ALL";

const SHARED_CREDIT_ISSUE_LABELS: Record<string, string> = {
  SHARED_CREDIT_RULE_CREATED: "สร้างกฎแบ่งเครดิตดีลร่วมใหม่",
  UNKNOWN_SALESMAN_IN_SHARED_DEAL: "ไม่พบพนักงานขายในดีลร่วม",
};

export interface ImportIssueTableProps {
  issues: ImportIssue[];
}

const COLUMNS: DataTableColumn<ImportIssue>[] = [
  {
    key: "level",
    header: "ระดับ",
    priority: 1,
    mobileRole: "identity",
    sortable: true,
    sortValue: (issue) => (issue.level === "ERROR" ? 0 : 1),
    render: (issue) => (
      <StatusBadge status={{ type: "importIssueLevel", value: issue.level }} />
    ),
  },
  {
    key: "message",
    header: "รายละเอียด",
    priority: 1,
    mobileRole: "meta",
    sortable: true,
    sortValue: (issue) => issue.message,
    render: (issue) => (
      <span className="font-medium text-text-primary text-sm">{issue.message}</span>
    ),
  },
  {
    key: "code",
    header: "รหัส",
    priority: 2,
    mobileRole: "meta",
    sortable: true,
    sortValue: (issue) => issue.code,
    render: (issue) => {
      const friendlyLabel = SHARED_CREDIT_ISSUE_LABELS[issue.code];
      if (friendlyLabel) {
        return (
          <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
            {friendlyLabel}
          </span>
        );
      }
      return <span className="font-mono text-xs text-text-muted">{issue.code}</span>;
    },
  },
  {
    key: "rowNumber",
    header: "แถวที่",
    numeric: true,
    priority: 2,
    mobileRole: "meta",
    sortable: true,
    sortValue: (issue) => issue.rowNumber ?? 0,
    render: (issue) => (
      <span className="text-text-secondary">{issue.rowNumber ?? "—"}</span>
    ),
  },
  {
    key: "sheetName",
    header: "Sheet",
    priority: 3,
    mobileRole: "meta",
    sortable: true,
    sortValue: (issue) => issue.sheetName ?? "",
    render: (issue) => (
      <span className="text-xs text-text-muted">{issue.sheetName ?? "—"}</span>
    ),
  },
];

export function ImportIssueTable({ issues }: ImportIssueTableProps) {
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("ALL");
  const [codeFilter, setCodeFilter] = useState<string>("ALL");

  const errorCount = useMemo(
    () => issues.filter((issue) => issue.level === "ERROR").length,
    [issues]
  );
  const warningCount = useMemo(
    () => issues.filter((issue) => issue.level === "WARNING").length,
    [issues]
  );

  const availableCodes = useMemo(() => {
    return Array.from(new Set(issues.map((i) => i.code))).sort();
  }, [issues]);

  // Safe Automation: default sort ERROR first, then by row number
  const sortedIssues = useMemo(() => {
    return [...issues].sort((a, b) => {
      if (a.level === "ERROR" && b.level !== "ERROR") return -1;
      if (a.level !== "ERROR" && b.level === "ERROR") return 1;
      return (a.rowNumber ?? 0) - (b.rowNumber ?? 0);
    });
  }, [issues]);

  const filteredIssues = useMemo(() => {
    return sortedIssues.filter((issue) => {
      if (levelFilter !== "ALL" && issue.level !== levelFilter) return false;
      if (codeFilter !== "ALL" && issue.code !== codeFilter) return false;
      return true;
    });
  }, [sortedIssues, levelFilter, codeFilter]);

  if (issues.length === 0) {
    return <p className="text-sm text-text-muted">ไม่พบปัญหาในการนำเข้าครั้งนี้</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-text-primary">
          รายการปัญหา ({errorCount} ข้อผิดพลาด, {warningCount} คำเตือน)
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          {availableCodes.length > 1 && (
            <div className="w-48">
              <Select
                value={codeFilter}
                onChange={(e) => setCodeFilter(e.target.value)}
                aria-label="กรองตามรหัสปัญหา"
                className="h-8 text-xs"
              >
                <option value="ALL">รหัสปัญหาทั้งหมด ({availableCodes.length})</option>
                {availableCodes.map((code) => (
                  <option key={code} value={code}>
                    {SHARED_CREDIT_ISSUE_LABELS[code] ?? code}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-xs font-medium">
            {(["ALL", "ERROR", "WARNING"] as LevelFilter[]).map((level) => {
              const isSelected = levelFilter === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setLevelFilter(level)}
                  className={`rounded px-2.5 py-1 transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {level === "ALL"
                    ? `ทั้งหมด (${issues.length})`
                    : level === "ERROR"
                    ? `ข้อผิดพลาด (${errorCount})`
                    : `คำเตือน (${warningCount})`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <DataTable
        caption="ตารางรายการปัญหาการนำเข้าข้อมูล"
        columns={COLUMNS}
        rows={filteredIssues}
        getRowId={(issue) => issue.id}
        searchable
        searchPlaceholder="ค้นหาข้อความ หรือรหัสปัญหา…"
        searchPredicate={(issue, query) =>
          issue.message.toLowerCase().includes(query) ||
          issue.code.toLowerCase().includes(query) ||
          (issue.sheetName?.toLowerCase().includes(query) ?? false) ||
          (issue.rowNumber ? String(issue.rowNumber).includes(query) : false)
        }
        emptyTitle="ไม่พบปัญหาตามเงื่อนไขตัวกรอง"
        emptyDescription="ลองปรับระดับหรือรหัสปัญหาเพื่อดูรายการอื่น"
      />
    </div>
  );
}

export default ImportIssueTable;
