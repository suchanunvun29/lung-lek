"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listTerritories,
  listUnassignedTerritoryHospitals,
  moveHospitalToTerritory,
  bulkAssignHospitalsToTerritory,
} from "@/features/territories/api/territories.api";
import { getErrorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/importLabels";
import { Territory, UnassignedTerritoryHospital } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "@/components/shared/feedback/toast/ToastProvider";
import { refreshQueueCounts } from "@/components/shared/navigation/useQueueCounts";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table/DataTable";
import { ConfirmDialog } from "@/components/shared/feedback/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface MultiAssignResult {
  total: number;
  success: number;
  failed: { id: number; name: string; error: string }[];
}

export default function UnassignedTerritoriesPage() {
  const token = useAuthStore((state) => state.token);
  const canEdit = useAuthStore((state) => state.user?.role === "MANAGER");
  const [hospitals, setHospitals] = useState<UnassignedTerritoryHospital[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [bucket, setBucket] = useState(0);
  const [hospitalCount, setHospitalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Multi-row selection state
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [bulkTerritoryId, setBulkTerritoryId] = useState("");
  const [assigningMulti, setAssigningMulti] = useState(false);
  const [confirmingMulti, setConfirmingMulti] = useState(false);
  const [multiResult, setMultiResult] = useState<MultiAssignResult | null>(null);

  // Quick-assign (T-UX-011 จุดที่ 4) — เลือกเขตเก็บใน state ก่อน แล้วกดปุ่มยืนยัน
  // จึงยิง API (เดิมยิงทันทีที่ onChange ไม่มี in-flight guard)
  const [quickAssignChoice, setQuickAssignChoice] = useState<Record<number, string>>({});
  const [assigningId, setAssigningId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [hospitalData, territoryData] = await Promise.all([
        listUnassignedTerritoryHospitals(token),
        listTerritories(token),
      ]);
      setHospitals(hospitalData.hospitals);
      setBucket(hospitalData.unassignedBucket);
      setHospitalCount(hospitalData.hospitalCount);
      setTerritories(territoryData.territories);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "โหลดโรงพยาบาลที่ยังไม่ผูกเขตไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Single-row quick assignment
  const assignSingle = useCallback(
    async (hospital: UnassignedTerritoryHospital, territoryId: string) => {
      if (!token || !territoryId || assigningId !== null) return;
      const territoryName = territories.find((t) => String(t.id) === territoryId)?.name;
      setAssigningId(hospital.id);
      try {
        await moveHospitalToTerritory(token, hospital.id, Number(territoryId));
        // T-UX-011 ระดับ 1 — เขียนเกิดแล้วแจ้งผลชัด (ยังไม่มี undo จึงไม่อวดปุ่มย้อน)
        toast.success(
          `ผูก ${hospital.displayName} เข้าเขต ${territoryName ?? ""} เรียบร้อยแล้ว`
        );
        setQuickAssignChoice((prev) => {
          const next = { ...prev };
          delete next[hospital.id];
          return next;
        });
        await load();
        // WACC-P1-015 — the unassigned count just dropped; refresh the sidebar badge.
        void refreshQueueCounts(token);
      } catch (err) {
        setError(getErrorMessage(err, "ผูกเขตให้โรงพยาบาลไม่สำเร็จ"));
      } finally {
        setAssigningId(null);
      }
    },
    [token, load, assigningId, territories]
  );

  // Multi-row assignment — T-UX-026: one POST per batch (per-item atomic server-side),
  // replacing the old sequential PATCH loop; the partial report UI is unchanged.
  async function executeMultiAssign() {
    if (!token || !bulkTerritoryId || selectedIds.size === 0) return;
    setAssigningMulti(true);
    setMultiResult(null);

    const ids = Array.from(selectedIds).map(Number);
    try {
      const report = await bulkAssignHospitalsToTerritory(token, ids, Number(bulkTerritoryId));
      setMultiResult({
        total: report.requestedCount,
        success: report.assignedCount,
        failed: report.failed.map((f) => ({
          id: f.hospitalId,
          name: hospitals.find((h) => h.id === f.hospitalId)?.displayName ?? `ID: ${f.hospitalId}`,
          error: f.error,
        })),
      });
    } catch (err) {
      // The batch request itself failed — nothing was reported per item.
      setError(getErrorMessage(err, "ผูกเขตหลายรายการไม่สำเร็จ"));
    }

    setSelectedIds(new Set());
    setBulkTerritoryId("");
    setConfirmingMulti(false);
    setAssigningMulti(false);

    await load();
    if (token) {
      void refreshQueueCounts(token);
    }
  }

  function handleStartMultiAssign() {
    if (!bulkTerritoryId || selectedIds.size === 0) return;
    // T-UX-011 จุดที่ 6 — เกณฑ์เดียวตาม policy: กระทบหลายรายการ = ConfirmDialog
    // ที่ระบุจำนวนจริงเสมอ (เดิมใช้ threshold 10 ตัดขาด — ≤10 ยิงเลยไม่มีเกราะ)
    setConfirmingMulti(true);
  }

  const selectedTerritoryName = territories.find(
    (t) => String(t.id) === bulkTerritoryId
  )?.name ?? "";

  const columns: DataTableColumn<UnassignedTerritoryHospital>[] = useMemo(
    () => [
      {
        key: "displayName",
        header: "โรงพยาบาล",
        render: (item) => <span className="font-medium">{item.displayName}</span>,
        sortable: true,
        sortValue: (item) => item.displayName,
        priority: 1,
        mobileRole: "identity",
      },
      {
        key: "province",
        header: "จังหวัด",
        render: (item) => item.province ?? "—",
        sortable: true,
        sortValue: (item) => item.province ?? "",
        priority: 2,
        mobileRole: "meta",
      },
      {
        key: "unassignedBucket",
        header: "ยอดขายที่ยังไม่จัดเขต",
        render: (item) => formatMoney(item.unassignedBucket),
        numeric: true,
        sortable: true,
        sortValue: (item) => item.unassignedBucket,
        priority: 1,
        mobileRole: "metric",
      },
      {
        key: "ambiguous",
        header: "สถานะ",
        render: (item) =>
          item.ambiguous ? (
            <Badge variant="warning" className="text-xs">
              กำกวม: อันดับ 2 ≥ 30%
            </Badge>
          ) : (
            "—"
          ),
        priority: 2,
        mobileRole: "meta",
      },
      {
        key: "quickAssign",
        header: "ผูกเขตอย่างเร็ว",
        render: (item) =>
          canEdit ? (
            <div className="flex items-center gap-1.5">
              <Select
                value={quickAssignChoice[item.id] ?? ""}
                onChange={(event) =>
                  setQuickAssignChoice((prev) => ({
                    ...prev,
                    [item.id]: event.target.value,
                  }))
                }
                className="w-32 text-xs h-8"
                disabled={assigningId !== null}
                aria-label={`เลือกเขตสำหรับ ${item.displayName}`}
              >
                <option value="">เลือกเขต</option>
                {territories
                  .filter((t) => t.isActive)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </Select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!quickAssignChoice[item.id] || assigningId !== null}
                onClick={() => void assignSingle(item, quickAssignChoice[item.id])}
                className="text-xs px-2.5 py-1.5 h-8"
              >
                {assigningId === item.id ? "กำลังผูก..." : "ผูกเขต"}
              </Button>
            </div>
          ) : (
            "—"
          ),
        priority: 1,
        mobileRole: "meta",
      },
    ],
    [canEdit, territories, assignSingle, quickAssignChoice, assigningId]
  );

  const selectionToolbar = canEdit && selectedIds.size > 0 ? (
    <div className="rounded-lg border border-primary/20 bg-surface-subtle p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-text-primary">
            เลือกแล้ว {selectedIds.size.toLocaleString("th-TH")} แห่ง
          </span>
          <Select
            value={bulkTerritoryId}
            onChange={(e) => setBulkTerritoryId(e.target.value)}
            className="w-48 text-sm"
            disabled={assigningMulti}
          >
            <option value="">เลือกเขตที่จะผูก…</option>
            {territories
              .filter((t) => t.isActive)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </Select>
          <Button
            type="button"
            size="sm"
            disabled={!bulkTerritoryId || assigningMulti}
            onClick={handleStartMultiAssign}
          >
            {assigningMulti ? "กำลังดำเนินการ..." : "ผูกเขตที่เลือก"}
          </Button>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setSelectedIds(new Set())}
          disabled={assigningMulti}
          className="text-xs text-text-muted hover:text-text-primary"
        >
          ยกเลิกการเลือก
        </Button>
      </div>
      <p className="text-xs text-text-muted">
        หมายเหตุ: ส่งข้อมูลทั้งชุดให้เซิร์ฟเวอร์ประมวลผลในครั้งเดียว — บันทึกรายการต่อรายการ (per-item atomic) รายการที่ล้มเหลวจะรายงานกลับโดยไม่ดึงรายการอื่นลง
      </p>
    </div>
  ) : null;

  return (
    <PageContainer width="standard" className="space-y-6">
      <PageHeader
        title="โรงพยาบาลที่ยังไม่ผูกเขต"
        description={`จำนวน ${hospitalCount.toLocaleString("th-TH")} แห่ง · ยอดรวมที่ยังไม่จัดเขต: ฿${bucket.toLocaleString("th-TH")}`}
      />

      {!canEdit && (
        <div className="rounded-lg border border-warning/30 bg-warning-subtle p-3 text-sm text-warning-text">
          คุณดูข้อมูลได้เท่านั้น การแก้ไขสงวนไว้สำหรับผู้จัดการ
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger-subtle p-3 text-sm text-danger-text">
          {error}
        </div>
      )}

      {/* Multi-assign execution result summary */}
      {multiResult && (
        <div
          className={`rounded-lg border p-4 space-y-2 text-sm ${
            multiResult.failed.length === 0
              ? "border-success/30 bg-success-subtle text-success-text"
              : "border-warning/30 bg-warning-subtle text-warning-text"
          }`}
        >
          <p className="font-semibold">
            {multiResult.failed.length === 0
              ? `ผูกเขตสำเร็จครบทั้ง ${multiResult.success} แห่ง เรียบร้อยแล้ว`
              : `ดำเนินการเสร็จสิ้น: สำเร็จ ${multiResult.success} แห่ง, ไม่สำเร็จ ${multiResult.failed.length} แห่ง`}
          </p>
          {multiResult.failed.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-danger-text space-y-1">
              {multiResult.failed.map((f) => (
                <li key={f.id}>
                  {f.name}: {f.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={hospitals}
        getRowId={(item) => item.id}
        caption="รายการโรงพยาบาลที่ยังไม่ผูกเขต"
        loading={loading}
        searchable
        searchPlaceholder="ค้นหาโรงพยาบาล หรือ จังหวัด…"
        searchPredicate={(item, q) =>
          item.displayName.toLowerCase().includes(q) ||
          Boolean(item.province?.toLowerCase().includes(q))
        }
        selectable={canEdit}
        selectedRowIds={selectedIds}
        onSelectionChange={setSelectedIds}
        getRowLabel={(item) => item.displayName}
        selectionToolbar={selectionToolbar}
        emptyTitle="ไม่มีโรงพยาบาลค้างผูกเขต"
        emptyDescription="โรงพยาบาลทั้งหมดได้รับการจัดเขตเรียบร้อยแล้ว"
      />

      {/* Confirmation Dialog when selecting > 10 rows */}
      {confirmingMulti && (
        <ConfirmDialog
          title="ยืนยันการผูกเขตหลายรายการ"
          description={`คุณกำลังจะผูกโรงพยาบาลที่เลือกจำนวน ${selectedIds.size} แห่ง เข้าเขต ${selectedTerritoryName}`}
          consequence="เซิร์ฟเวอร์จะบันทึกทีละรายการ (per-item atomic) — รายการที่สำเร็จจะมีผลทันทีแม้รายการอื่นล้มเหลว และจะมีรายงานสรุปผลรายรายการให้ตรวจสอบหลังเสร็จ"
          tone="default"
          confirmLabel="ยืนยันการผูกเขต"
          cancelLabel="ยกเลิก"
          pending={assigningMulti}
          onConfirm={executeMultiAssign}
          onCancel={() => {
            if (!assigningMulti) setConfirmingMulti(false);
          }}
        />
      )}
    </PageContainer>
  );
}
