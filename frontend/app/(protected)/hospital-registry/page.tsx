"use client";

import { useCallback, useEffect, useState } from "react";
import { ForbiddenState } from "@/components/shared/auth/ForbiddenState";
import {
  HospitalRegistryTable,
  listHospitalRegistries,
  updatePotentialAdjustment,
  uploadHospitalRegistryFile,
} from "@/features/hospital-registry";
import { UploadForm } from "@/features/import";
import { getErrorMessage } from "@/lib/api-client";
import { IMPORT_STATUS_BADGE_CLASS, IMPORT_STATUS_LABEL_TH } from "@/lib/importLabels";
import { HospitalRegistry, ImportBatch } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";

interface RegistryImportResult {
  importBatch: ImportBatch;
  links: { linked: number; unreviewed: number };
}

const REGISTRY_PAGE_SIZE = 50;

function RegistryImportSummary({ result }: { result: RegistryImportResult }) {
  const { importBatch, links } = result;

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium text-zinc-900">{importBatch.fileName}</p>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${IMPORT_STATUS_BADGE_CLASS[importBatch.status]}`}>
          {IMPORT_STATUS_LABEL_TH[importBatch.status]}
        </span>
      </div>
      {importBatch.errorMessage && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{importBatch.errorMessage}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <ImportCount label="ทั้งหมด" value={importBatch.totalRows} />
        <ImportCount label="นำเข้าใหม่" value={importBatch.insertedRows} />
        <ImportCount label="อัปเดต" value={importBatch.updatedRows} />
        <ImportCount label="ข้าม" value={importBatch.skippedRows} />
        <ImportCount label="ผิดพลาด" value={importBatch.errorRows} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ImportCount label="จับคู่กับข้อมูลการขายได้" value={links.linked} tone="success" />
        <ImportCount label="รอตรวจสอบการจับคู่" value={links.unreviewed} tone="warning" />
      </div>
    </div>
  );
}

function ImportCount({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "success" | "warning" }) {
  const toneClass = tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-zinc-200 bg-zinc-50 text-zinc-900";
  return <div className={`rounded-lg border p-4 ${toneClass}`}><p className="text-sm">{label}</p><p className="mt-1 text-2xl font-semibold">{value.toLocaleString("th-TH")}</p></div>;
}

export default function HospitalRegistryPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [registries, setRegistries] = useState<HospitalRegistry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<RegistryImportResult | null>(null);
  const [savingAdjustmentId, setSavingAdjustmentId] = useState<number | null>(null);
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);

  const loadRegistries = useCallback(async () => {
    if (!token || user?.role !== "MANAGER") return;
    setLoading(true);
    try {
      const data = await listHospitalRegistries(token, { pageSize: REGISTRY_PAGE_SIZE });
      setRegistries(data.hospitalRegistries);
      setTotal(data.total);
      setLoadError(null);
    } catch (error) {
      setLoadError(getErrorMessage(error, "โหลดทะเบียนโรงพยาบาลไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token, user?.role]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRegistries();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRegistries]);

  if (user?.role !== "MANAGER") {
    return <ForbiddenState reason="หน้านี้สำหรับผู้จัดการเท่านั้น" />;
  }

  async function handleUpload(file: File) {
    if (!token) return;
    try {
      const data = await uploadHospitalRegistryFile(token, file);
      setUploadResult(data);
      await loadRegistries();
    } catch (error) {
      throw new Error(getErrorMessage(error, "นำเข้าไฟล์ทะเบียนโรงพยาบาลไม่สำเร็จ"));
    }
  }

  async function handleSaveAdjustment(registryId: number, potentialAdjustment: number): Promise<boolean> {
    if (!token) return false;
    setSavingAdjustmentId(registryId);
    setAdjustmentError(null);
    try {
      const data = await updatePotentialAdjustment(token, registryId, potentialAdjustment);
      setRegistries((prev) =>
        prev.map((registry) => (registry.id === registryId ? { ...registry, potentialAdjustment: data.hospitalRegistry.potentialAdjustment } : registry))
      );
      return true;
    } catch (error) {
      setAdjustmentError(getErrorMessage(error, "บันทึกค่าปรับศักยภาพไม่สำเร็จ"));
      return false;
    } finally {
      setSavingAdjustmentId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">ทะเบียนโรงพยาบาล</h1>
      <p className="mt-1 text-sm text-zinc-600">อัปโหลดไฟล์ .xlsx เพื่อสร้างหรืออัปเดตทะเบียน แล้วตรวจสอบผลการจับคู่กับข้อมูลการขาย</p>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-zinc-900">นำเข้าไฟล์ทะเบียน</h2>
        <UploadForm onUpload={handleUpload} />
      </section>

      {uploadResult && (
        <section className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900">ผลการนำเข้า</h2>
          <RegistryImportSummary result={uploadResult} />
        </section>
      )}

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-900">รายการโรงพยาบาล</h2>
          {!loading && <p className="text-sm text-zinc-500">แสดง {registries.length.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")} รายการ</p>}
        </div>
        {loading && <p className="mt-4 text-zinc-400">กำลังโหลด...</p>}
        {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}
        {adjustmentError && <p className="mt-4 text-sm text-red-600">{adjustmentError}</p>}
        {!loading && !loadError && (
          <div className="mt-4">
            <HospitalRegistryTable registries={registries} savingId={savingAdjustmentId} onSaveAdjustment={handleSaveAdjustment} />
            <p className="mt-2 text-xs text-zinc-500">
              ศักยภาพรายโรงพยาบาล = ค่าตัวชี้วัด × น้ำหนักระดับ × ค่าปรับรายแห่ง — ตั้ง 0 เพื่อตัดโรงพยาบาลนั้นออกจากศักยภาพทั้งหมด
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
