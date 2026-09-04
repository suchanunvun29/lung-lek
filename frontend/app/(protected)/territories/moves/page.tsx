"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  bulkMoveHospitalsByProvince,
  listTerritories,
  moveHospitalToTerritory,
} from "@/features/territories/api/territories.api";
import { listHospitals } from "@/features/master-data/api/master-data.api";
import { getErrorMessage } from "@/lib/api-client";
import { Hospital, Territory } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/feedback/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/shared/feedback/Skeleton";

const MAX_SEARCH_RESULTS = 50;

type MoveTab = "single" | "bulk";

function readInitialTab(): MoveTab {
  if (typeof window === "undefined") return "single";
  const value = new URLSearchParams(window.location.search).get("tab");
  return value === "bulk" ? "bulk" : "single";
}

function setTabInUrl(tab: MoveTab) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  window.history.replaceState(null, "", url.toString());
}

export default function HospitalMovesPage() {
  const token = useAuthStore((state) => state.token);
  const canEdit = useAuthStore((state) => state.user?.role === "MANAGER");

  const [tab, setTabState] = useState<MoveTab>(readInitialTab);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Single move state
  const [query, setQuery] = useState("");
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | "">("");
  const [singleTerritoryId, setSingleTerritoryId] = useState<number | "">("");
  const [singleSuccess, setSingleSuccess] = useState<string | null>(null);
  const [singleSubmitting, setSingleSubmitting] = useState(false);

  // Bulk move state
  const [province, setProvince] = useState("");
  const [bulkTerritoryId, setBulkTerritoryId] = useState<number | "">("");
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);

  function setTab(nextTab: MoveTab) {
    setTabState(nextTab);
    setTabInUrl(nextTab);
  }

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [hospitalData, territoryData] = await Promise.all([
        listHospitals(token),
        listTerritories(token),
      ]);
      setHospitals(hospitalData.hospitals);
      setTerritories(territoryData.territories);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "โหลดข้อมูลโรงพยาบาลไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const provinces = useMemo(
    () =>
      Array.from(
        new Set(
          hospitals
            .map((item) => item.province)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b, "th")),
    [hospitals]
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return hospitals
      .filter(
        (item) =>
          item.displayName.toLowerCase().includes(needle) ||
          item.nameInFile.toLowerCase().includes(needle)
      )
      .slice(0, MAX_SEARCH_RESULTS);
  }, [hospitals, query]);

  const selectedHospital = hospitals.find((item) => item.id === selectedHospitalId);
  const bulkHospitalCount = useMemo(() => {
    if (!province) return 0;
    return hospitals.filter((item) => item.province === province).length;
  }, [hospitals, province]);

  const territoryName = useCallback(
    (territoryId: number | "") =>
      territories.find((item) => item.id === territoryId)?.name ?? "",
    [territories]
  );

  function selectHospital(item: Hospital) {
    setSelectedHospitalId(item.id);
    setSingleSuccess(null);
  }

  async function submitSingle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedHospitalId || !singleTerritoryId || singleSubmitting) return;
    setSingleSubmitting(true);
    const hospitalName = selectedHospital?.displayName ?? "";
    try {
      await moveHospitalToTerritory(token, selectedHospitalId, singleTerritoryId);
      setSingleSuccess(`ย้าย ${hospitalName} เข้าเขต ${territoryName(singleTerritoryId)} แล้ว`);
      setSelectedHospitalId("");
      setQuery("");
      setSingleTerritoryId("");
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "ย้ายโรงพยาบาลไม่สำเร็จ"));
    } finally {
      setSingleSubmitting(false);
    }
  }

  function submitBulk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!province || !bulkTerritoryId || bulkHospitalCount === 0) return;
    setBulkSuccess(null);
    setConfirmingBulk(true);
  }

  async function handleConfirmBulk() {
    if (!token || !province || !bulkTerritoryId) return;
    setBulkPending(true);
    try {
      const { updatedCount } = await bulkMoveHospitalsByProvince(token, province, bulkTerritoryId);
      setBulkSuccess(
        `ย้ายแล้ว ${updatedCount} แห่งในจังหวัด${province} เข้าเขต ${territoryName(bulkTerritoryId)} เรียบร้อยแล้ว`
      );
      setConfirmingBulk(false);
      setProvince("");
      setBulkTerritoryId("");
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "ย้ายโรงพยาบาลทั้งจังหวัดไม่สำเร็จ"));
    } finally {
      setBulkPending(false);
    }
  }

  return (
    <PageContainer width="standard" className="space-y-6">
      <PageHeader
        title="ย้ายโรงพยาบาลเข้าเขต"
        description="ย้ายทีละแห่งหรือยกทั้งจังหวัด — การแก้ไขสงวนไว้สำหรับผู้จัดการ"
      />

      {!canEdit && (
        <div className="rounded-lg border border-warning/30 bg-warning-subtle p-3 text-sm text-warning">
          คุณดูข้อมูลได้เท่านั้น การแก้ไขสงวนไว้สำหรับผู้จัดการ
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger-subtle p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(value) => setTab(value as MoveTab)}>
          <TabsList className="mb-4">
            <TabsTrigger value="single">ย้ายรายแห่ง</TabsTrigger>
            <TabsTrigger value="bulk">ย้ายยกจังหวัด</TabsTrigger>
          </TabsList>

          {/* Tab 1: Single Move */}
          <TabsContent value="single">
            <div className="max-w-2xl rounded-lg border border-border bg-surface p-5">
              <h2 className="mb-1 font-semibold text-text-primary">ย้ายโรงพยาบาลรายแห่ง</h2>
              <p className="mb-4 text-xs text-text-muted">
                ค้นหาและเลือกโรงพยาบาลที่ต้องการย้ายเข้าเขตเป้าหมาย
              </p>

              <form onSubmit={submitSingle} className="space-y-4">
                <label className="block text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">ค้นหาโรงพยาบาล</span>
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="พิมพ์ชื่อโรงพยาบาลเพื่อค้นหา…"
                    className="mt-1.5"
                    disabled={!canEdit}
                  />
                </label>

                <div className="max-h-60 overflow-y-auto rounded-md border border-border bg-surface">
                  {matches.length === 0 ? (
                    <p className="p-3 text-sm text-text-muted">
                      {query.trim() ? "ไม่พบโรงพยาบาลที่ตรงกับคำค้นหา" : "พิมพ์ชื่อเพื่อค้นหาโรงพยาบาล"}
                    </p>
                  ) : (
                    <ul className="divide-y divide-border text-sm">
                      {matches.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => selectHospital(item)}
                            className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface-subtle cursor-pointer ${
                              selectedHospitalId === item.id ? "bg-surface-subtle font-medium text-primary" : "text-text-primary"
                            }`}
                          >
                            <span>{item.displayName}</span>
                            <span className="text-xs text-text-muted">{item.province ?? "—"}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {matches.length === MAX_SEARCH_RESULTS && (
                  <p className="text-xs text-text-muted">
                    แสดง {MAX_SEARCH_RESULTS} รายการแรก กรุณาค้นหาให้เจาะจงขึ้น
                  </p>
                )}

                {selectedHospital && (
                  <div className="rounded-md border border-border bg-surface-subtle p-3 text-sm">
                    <span className="text-text-muted">เลือกอยู่: </span>
                    <span className="font-medium text-text-primary">{selectedHospital.displayName}</span>
                    {selectedHospital.province && (
                      <span className="text-text-secondary"> (จังหวัด: {selectedHospital.province})</span>
                    )}
                  </div>
                )}

                <label className="block text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">เขตเป้าหมาย</span>
                  <Select
                    required
                    value={singleTerritoryId}
                    onChange={(event) =>
                      setSingleTerritoryId(event.target.value ? Number(event.target.value) : "")
                    }
                    className="mt-1.5 w-full"
                    disabled={!canEdit}
                  >
                    <option value="">เลือกเขตเป้าหมาย</option>
                    {territories
                      .filter((item) => item.isActive)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </Select>
                </label>

                {canEdit && (
                  <Button
                    type="submit"
                    disabled={!selectedHospitalId || !singleTerritoryId || singleSubmitting}
                    size="sm"
                  >
                    {singleSubmitting ? "กำลังย้าย..." : "ย้ายโรงพยาบาล"}
                  </Button>
                )}

                {singleSuccess && (
                  <p className="rounded-md border border-success/30 bg-success-subtle p-3 text-sm text-success font-medium">
                    {singleSuccess}
                  </p>
                )}
              </form>
            </div>
          </TabsContent>

          {/* Tab 2: Bulk Move */}
          <TabsContent value="bulk">
            <div className="max-w-2xl rounded-lg border border-border bg-surface p-5">
              <h2 className="mb-1 font-semibold text-text-primary">ย้ายโรงพยาบาลยกทั้งจังหวัด</h2>
              <p className="mb-4 text-xs text-text-muted">
                เลือกจังหวัดและเขตเป้าหมาย ระบบจะสรุปจำนวนโรงพยาบาลที่ได้รับผลกระทบก่อนยืนยัน
              </p>

              <form onSubmit={submitBulk} className="space-y-4">
                <label className="block text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">จังหวัด</span>
                  <Select
                    required
                    value={province}
                    onChange={(event) => {
                      setProvince(event.target.value);
                      setBulkSuccess(null);
                    }}
                    className="mt-1.5 w-full"
                    disabled={!canEdit}
                  >
                    <option value="">เลือกจังหวัด</option>
                    {provinces.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="block text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">เขตเป้าหมาย</span>
                  <Select
                    required
                    value={bulkTerritoryId}
                    onChange={(event) => {
                      setBulkTerritoryId(event.target.value ? Number(event.target.value) : "");
                      setBulkSuccess(null);
                    }}
                    className="mt-1.5 w-full"
                    disabled={!canEdit}
                  >
                    <option value="">เลือกเขตเป้าหมาย</option>
                    {territories
                      .filter((item) => item.isActive)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </Select>
                </label>

                {/* Pre-action Impact Preview */}
                {province && (
                  <div className="rounded-md border border-border bg-surface-subtle p-3 text-sm">
                    <p className="font-medium text-text-primary">
                      สรุปผลกระทบ (Preview):
                    </p>
                    <p className="mt-1 text-text-secondary">
                      มีโรงพยาบาลในจังหวัด{province} ทั้งหมด{" "}
                      <span className="font-semibold text-text-primary">
                        {bulkHospitalCount.toLocaleString("th-TH")}
                      </span>{" "}
                      แห่ง
                      {bulkTerritoryId && (
                        <span> ที่จะถูกย้ายไปยังเขต {territoryName(bulkTerritoryId)}</span>
                      )}
                    </p>
                    {bulkHospitalCount === 0 && (
                      <p className="mt-1 text-xs text-warning">
                        * ไม่มีโรงพยาบาลในจังหวัดนี้ ไม่สามารถดำเนินการได้
                      </p>
                    )}
                  </div>
                )}

                {canEdit && (
                  <Button
                    type="submit"
                    disabled={!province || !bulkTerritoryId || bulkHospitalCount === 0}
                    size="sm"
                  >
                    ตรวจสอบและยืนยันการย้าย
                  </Button>
                )}

                {bulkSuccess && (
                  <p className="rounded-md border border-success/30 bg-success-subtle p-3 text-sm text-success font-medium">
                    {bulkSuccess}
                  </p>
                )}
              </form>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Confirmation dialog for Bulk Move */}
      {confirmingBulk && (
        <ConfirmDialog
          title="ยืนยันการย้ายโรงพยาบาลยกทั้งจังหวัด"
          description={`คุณกำลังจะย้ายโรงพยาบาลทั้งหมดในจังหวัด${province} จำนวน ${bulkHospitalCount.toLocaleString("th-TH")} แห่ง ไปยังเขต ${territoryName(bulkTerritoryId)}`}
          consequence="การย้ายนี้จะมีผลต่อการจัดกลุ่มข้อมูลและการคำนวณ KPI ทันที และจะถูกบันทึกในประวัติการย้าย (HospitalTerritoryChange)"
          tone="danger"
          confirmLabel="ยืนยันย้ายทั้งจังหวัด"
          cancelLabel="ยกเลิก"
          pending={bulkPending}
          onConfirm={handleConfirmBulk}
          onCancel={() => {
            if (!bulkPending) setConfirmingBulk(false);
          }}
        />
      )}
    </PageContainer>
  );
}
