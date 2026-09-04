"use client";

/**
 * ทะเบียนโรงพยาบาล — Pattern B (server pagination) — WACC-P1-007
 *
 * The old page requested pageSize 50, showed "แสดง 50 จาก N รายการ" and gave
 * no way to reach the rest — silent data truncation. Every row is now reachable:
 * paging, a debounced server-side search (`q`), and province/territory filters
 * all pass through to `GET /hospital-registries`, which already accepted
 * `q`, `provinceMappingId`, `territoryId`, `page` and `pageSize` (1–200).
 * The previous in-flight request is aborted when the query changes
 * (WACC-P0-021 signal), so a stale response never renders.
 *
 * Upload is a secondary action in the page header opening a modal — no longer
 * a form stacked above the table. Inline `potentialAdjustment` editing keeps
 * its per-row saving state, its Thai aria-labels, and its rule that 0 means
 * "exclude this hospital from potential entirely" — 0 is never treated as empty.
 * MANAGER-only guard retained via ForbiddenState (WACC-P0-022).
 */

import { useCallback, useEffect, useState } from "react";
import { ForbiddenState } from "@/components/shared/auth/ForbiddenState";
import { FilterBar, PageContainer, PageHeader, StatusBadge } from "@/components/shared";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Upload } from "lucide-react";
import {
  HospitalRegistryTable,
  listHospitalRegistries,
  listProvinces,
  updatePotentialAdjustment,
  uploadHospitalRegistryFile,
} from "@/features/hospital-registry";
import { listTerritories } from "@/features/territories/api/territories.api";
import { UploadForm } from "@/features/import";
import { getErrorMessage } from "@/lib/api-client";
import { useAbortableEffect } from "@/lib/useAbortableEffect";
import { HospitalRegistry, ImportBatch, ProvinceMapping, Territory } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";

interface RegistryImportResult {
  importBatch: ImportBatch;
  links: { linked: number; unreviewed: number };
}

const REGISTRY_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

function RegistryImportSummary({ result }: { result: RegistryImportResult }) {
  const { importBatch, links } = result;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium text-text-primary">{importBatch.fileName}</p>
        <StatusBadge status={{ type: "importStatus", value: importBatch.status }} />
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
  const toneClass = tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : tone === "warning" ? "border-warning/30 bg-warning-subtle text-warning" : "border-border bg-surface-subtle text-text-primary";
  return <div className={`rounded-lg border p-4 ${toneClass}`}><p className="text-sm">{label}</p><p className="mt-1 text-2xl font-semibold">{value.toLocaleString("th-TH")}</p></div>;
}

export default function HospitalRegistryPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const [registries, setRegistries] = useState<HospitalRegistry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  // The search input is free-typing; `q` is its debounced value that actually
  // drives the server query. Any query/filter change also resets to page 1.
  const [searchText, setSearchText] = useState("");
  const [q, setQ] = useState("");
  const [provinceMappingId, setProvinceMappingId] = useState("");
  const [territoryId, setTerritoryId] = useState("");

  const [provinces, setProvinces] = useState<ProvinceMapping[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<RegistryImportResult | null>(null);
  const [savingAdjustmentId, setSavingAdjustmentId] = useState<number | null>(null);
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);

  // Debounce the search box into the actual query parameter.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(searchText.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    if (!token || user?.role !== "MANAGER") return;
    listProvinces(token)
      .then((data) => {
        setProvinces([...data.provinces].sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, "th")));
      })
      .catch(() => {
        // province filter options are a convenience — the table works without them
      });
    listTerritories(token)
      .then((data) => setTerritories(data.territories))
      .catch(() => {
        // territory filter options are a convenience — the table works without them
      });
  }, [token, user?.role]);

  const loadRegistries = useCallback(
    async (signal: AbortSignal) => {
      if (!token || user?.role !== "MANAGER") return;
      setLoading(true);
      try {
        const data = await listHospitalRegistries(
          token,
          {
            q: q || undefined,
            provinceMappingId: provinceMappingId || undefined,
            territoryId: territoryId || undefined,
            page,
            pageSize: REGISTRY_PAGE_SIZE,
          },
          signal
        );
        if (signal.aborted) return;
        setRegistries(data.hospitalRegistries);
        setTotal(data.total);
        setLoadError(null);
      } catch (error) {
        if (!signal.aborted) {
          setRegistries([]);
          setTotal(0);
          setLoadError(getErrorMessage(error, "โหลดทะเบียนโรงพยาบาลไม่สำเร็จ"));
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [token, user?.role, q, provinceMappingId, territoryId, page]
  );

  // useAbortableEffect aborts the in-flight request whenever the query, filters
  // or page change — the previous request can never overwrite a newer one.
  useAbortableEffect(
    (signal) => loadRegistries(signal),
    // reloadNonce only changes via the table error state's retry button and after an upload.
    [loadRegistries, reloadNonce]
  );

  if (user?.role !== "MANAGER") {
    return <ForbiddenState reason="หน้านี้สำหรับผู้จัดการเท่านั้น" />;
  }

  const hasActiveFilters = q !== "" || provinceMappingId !== "" || territoryId !== "";

  function resetFilters() {
    setSearchText("");
    setProvinceMappingId("");
    setTerritoryId("");
    setPage(1);
  }

  function removeFilter(key: string) {
    if (key === "q") setSearchText("");
    if (key === "province") setProvinceMappingId("");
    if (key === "territory") setTerritoryId("");
    setPage(1);
  }

  async function handleUpload(file: File) {
    if (!token) return;
    try {
      const data = await uploadHospitalRegistryFile(token, file);
      setUploadResult(data);
      setUploadOpen(false);
      setPage(1);
      setReloadNonce((n) => n + 1);
    } catch (error) {
      // UploadForm renders this message in the modal.
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
    <PageContainer width="wide">
      <PageHeader
        title="ทะเบียนโรงพยาบาล"
        description="ค้นหาและกรองทะเบียนทั้งหมด แล้วแก้ไขค่าปรับศักยภาพรายโรงพยาบาลได้ในตาราง"
        meta={!loading && !loadError ? `แสดง ${registries.length.toLocaleString("th-TH")} จาก ${total.toLocaleString("th-TH")} รายการ` : undefined}
        secondaryActions={[
          <Button key="upload" type="button" variant="outline" onClick={() => setUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            นำเข้าไฟล์ทะเบียน
          </Button>,
        ]}
      />

      {uploadResult && (
        <section className="mb-6 space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">ผลการนำเข้า</h2>
          <RegistryImportSummary result={uploadResult} />
        </section>
      )}

      <FilterBar
        chips={[
          ...(q ? [{ key: "q", label: `ค้นหา: "${q}"`, onRemove: () => removeFilter("q") }] : []),
          ...(provinceMappingId
            ? [
                {
                  key: "province",
                  label: `จังหวัด: ${provinces.find((p) => String(p.id) === provinceMappingId)?.canonicalName ?? provinceMappingId}`,
                  onRemove: () => removeFilter("province"),
                },
              ]
            : []),
          ...(territoryId
            ? [
                {
                  key: "territory",
                  label: `เขต: ${territories.find((t) => String(t.id) === territoryId)?.name ?? territoryId}`,
                  onRemove: () => removeFilter("territory"),
                },
              ]
            : []),
        ]}
        onReset={hasActiveFilters ? resetFilters : undefined}
        onApply={() => setPage(1)}
      >
        <div className="w-full sm:w-64">
          <label htmlFor="registry-search" className="mb-1 block text-xs font-medium text-text-secondary">
            ค้นหาชื่อโรงพยาบาล
          </label>
          <Input
            id="registry-search"
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="พิมพ์ชื่อ ร.พ. หรือรหัส…"
            aria-label="ค้นหาทะเบียนโรงพยาบาล"
          />
        </div>
        <div className="w-full sm:w-52">
          <label htmlFor="registry-province" className="mb-1 block text-xs font-medium text-text-secondary">
            จังหวัด
          </label>
          <Select
            id="registry-province"
            value={provinceMappingId}
            onChange={(e) => {
              setProvinceMappingId(e.target.value);
              setPage(1);
            }}
            aria-label="กรองตามจังหวัด"
          >
            <option value="">ทุกจังหวัด</option>
            {provinces.map((province) => (
              <option key={province.id} value={province.id}>
                {province.canonicalName}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-52">
          <label htmlFor="registry-territory" className="mb-1 block text-xs font-medium text-text-secondary">
            เขต
          </label>
          <Select
            id="registry-territory"
            value={territoryId}
            onChange={(e) => {
              setTerritoryId(e.target.value);
              setPage(1);
            }}
            aria-label="กรองตามเขต"
          >
            <option value="">ทุกเขต</option>
            {territories.map((territory) => (
              <option key={territory.id} value={territory.id}>
                {territory.name}
              </option>
            ))}
          </Select>
        </div>
      </FilterBar>

      {adjustmentError && <p className="mt-4 text-sm text-danger">{adjustmentError}</p>}

      <div className="mt-4">
        <HospitalRegistryTable
          registries={registries}
          loading={loading}
          error={loadError}
          onRetry={() => setReloadNonce((n) => n + 1)}
          savingId={savingAdjustmentId}
          onSaveAdjustment={handleSaveAdjustment}
          page={page}
          pageSize={REGISTRY_PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
        <p className="mt-2 text-xs text-text-muted">
          ศักยภาพรายโรงพยาบาล = ค่าตัวชี้วัด × น้ำหนักระดับ × ค่าปรับรายแห่ง — ตั้ง 0 เพื่อตัดโรงพยาบาลนั้นออกจากศักยภาพทั้งหมด
        </p>
      </div>

      {uploadOpen && (
        <Modal title="นำเข้าไฟล์ทะเบียนโรงพยาบาล" onClose={() => setUploadOpen(false)} widthClassName="max-w-xl">
          <UploadForm onUpload={handleUpload} />
          <p className="mt-3 text-xs text-text-muted">
            ระบบจะสร้างหรืออัปเดตทะเบียนจากไฟล์ .xlsx แล้วแสดงผลการจับคู่กับข้อมูลการขายหลังนำเข้าเสร็จ
          </p>
        </Modal>
      )}
    </PageContainer>
  );
}
