"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getTargetSuggestions,
  reinstateDeal,
  RegionSuggestionsTable,
  CutDealsPanel,
  AcceptOffersPanel,
} from "@/features/target-assist";
import { getEvaluationSetting } from "@/features/settings/api/settings.api";
import { listTargets, upsertTerritoryTarget } from "@/features/targets/api/targets.api";
import { getErrorMessage } from "@/lib/api-client";
import { formatThaiMonth } from "@/lib/importLabels";
import {
  POTENTIAL_METRIC_LABEL_TH,
  SUGGESTION_MODE_LABEL_TH,
  formatRatioPercent,
  formatTargetMoney,
} from "@/lib/targetLabels";
import { SuggestionMode, Target, TargetSuggestionPreview } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ForbiddenState } from "@/components/shared/auth/ForbiddenState";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { Breadcrumb } from "@/components/shared/navigation/Breadcrumb";
import { InlineMessage } from "@/components/shared/feedback/InlineMessage";
import { SkeletonCard } from "@/components/shared/feedback/Skeleton";

const YEAR_OFFSETS = [-1, 0, 1];
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const TARGET_GROWTH_RATE_MIN = 0;
const TARGET_GROWTH_RATE_MAX = 999.999;
const TARGET_GROWTH_RATE_STEP = 0.001;

function formatFixed3(value: number): string {
  return value.toLocaleString("th-TH", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export default function TargetAssistPage() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const isManager = currentUser?.role === "MANAGER";

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [mode, setMode] = useState<SuggestionMode>("SUGGEST");

  const [preview, setPreview] = useState<TargetSuggestionPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [growthRateInput, setGrowthRateInput] = useState("");
  const [growthRateError, setGrowthRateError] = useState<string | null>(null);
  const growthRateOverrideRef = useRef<number | undefined>(undefined);
  const growthRateTouchedRef = useRef(false);

  const [reinstated, setReinstated] = useState<ReadonlySet<string>>(new Set());
  const [pendingInvoiceNo, setPendingInvoiceNo] = useState<string | null>(null);

  const [existingByTerritoryId, setExistingByTerritoryId] = useState<Map<number, Target>>(new Map());
  const [savingTerritoryId, setSavingTerritoryId] = useState<number | null>(null);

  const loadSavedTargets = useCallback(async () => {
    if (!token) return;
    try {
      const data = await listTargets(token, year, "TERRITORY");
      setExistingByTerritoryId(
        new Map(
          data.targets
            .filter((target) => target.territoryId !== null)
            .map((target) => [target.territoryId as number, target])
        )
      );
    } catch {
      // Saved targets only enrich the accept panel ("เป้าปัจจุบัน" column) — the assist table works without them.
    }
  }, [token, year]);

  const runFetch = useCallback(
    async (requestedMode: SuggestionMode) => {
      if (!token || !isManager) return;
      setLoading(true);
      try {
        const data = await getTargetSuggestions(token, year, month, requestedMode, growthRateOverrideRef.current);
        setPreview(data);
        setReinstated(new Set());
        setErrorBanner(null);
      } catch (err) {
        const message = getErrorMessage(err, "โหลดตัวช่วยตั้งเป้าไม่สำเร็จ");
        if (requestedMode === "REBALANCE") {
          setErrorBanner(message);
          setMode("SUGGEST");
        } else {
          setErrorBanner(message);
          setPreview(null);
        }
      } finally {
        setLoading(false);
      }
    },
    [token, isManager, year, month]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMode("SUGGEST");
      void runFetch("SUGGEST");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [runFetch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSavedTargets();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSavedTargets]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(async () => {
      try {
        const data = await getEvaluationSetting(token);
        if (!growthRateTouchedRef.current) setGrowthRateInput(data.setting.targetGrowthRate);
      } catch {
        // Keep the field empty — omitting the parameter is the same fallback.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [token]);

  function handleApplyGrowthRate() {
    const text = growthRateInput.trim();
    if (text === "") {
      setGrowthRateError(null);
      growthRateOverrideRef.current = undefined;
      void runFetch(mode);
      return;
    }
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || parsed < TARGET_GROWTH_RATE_MIN || parsed > TARGET_GROWTH_RATE_MAX) {
      setGrowthRateError(`อัตราเติบโตต้องเป็นตัวเลขระหว่าง ${TARGET_GROWTH_RATE_MIN} ถึง ${TARGET_GROWTH_RATE_MAX}`);
      return;
    }
    setGrowthRateError(null);
    growthRateOverrideRef.current = parsed;
    void runFetch(mode);
  }

  function handleModeChange(next: SuggestionMode) {
    if (next === mode) return;
    setMode(next);
    void runFetch(next);
  }

  async function handleToggleDeal(invoiceNo: string) {
    if (!token || !preview || pendingInvoiceNo !== null) return;
    const nextSet = new Set(reinstated);
    if (nextSet.has(invoiceNo)) nextSet.delete(invoiceNo);
    else nextSet.add(invoiceNo);

    setPendingInvoiceNo(invoiceNo);
    setActionError(null);
    try {
      const data = await reinstateDeal(token, {
        year,
        month,
        mode: preview.mode,
        reinstateInvoiceNos: [...nextSet],
        targetGrowthRate: growthRateOverrideRef.current,
      });
      setPreview(data);
      setReinstated(new Set(data.reinstatedInvoiceNos));
    } catch (err) {
      setActionError(getErrorMessage(err, "แก้รายการดีลที่ถูกตัดไม่สำเร็จ"));
    } finally {
      setPendingInvoiceNo(null);
    }
  }

  async function handleAccept(territoryId: number, revenueTarget: number): Promise<boolean> {
    if (!token) return false;
    setSavingTerritoryId(territoryId);
    setActionError(null);
    try {
      await upsertTerritoryTarget(token, territoryId, year, month, {
        revenueTarget,
        newCustomerTarget: existingByTerritoryId.get(territoryId)?.newCustomerTarget ?? 0,
      });
      await loadSavedTargets();
      return true;
    } catch (err) {
      setActionError(getErrorMessage(err, "บันทึกเป้าระดับเขตไม่สำเร็จ"));
      return false;
    } finally {
      setSavingTerritoryId(null);
    }
  }

  if (!isManager) {
    return <ForbiddenState reason="หน้านี้สำหรับผู้จัดการเท่านั้น" />;
  }

  const windowLabel =
    preview?.window.start && preview.window.end
      ? `${formatThaiMonth(preview.window.start.month)} ${preview.window.start.year} – ${formatThaiMonth(preview.window.end.month)} ${preview.window.end.year}`
      : "ยังไม่มีข้อมูลย้อนหลัง";

  return (
    <PageContainer width="standard">
      {/* Pattern F: Breadcrumb */}
      <div className="mb-4">
        <Breadcrumb
          segments={[
            { label: "เป้าหมาย" },
            { label: "ตัวช่วยตั้งเป้า" },
          ]}
        />
      </div>

      <PageHeader
        title="ตัวช่วยตั้งเป้า"
        description="เทียบฐานประวัติ (historyBased) กับฐานศักยภาพ (potentialBased) รายเขตในแต่ละภาค พร้อมตัวเลขที่ระบบเสนอ (suggested) — ตัวเลขจะถูกเขียนลงเป้าจริงเมื่อผู้จัดการกดรับข้อเสนอเท่านั้น"
      />

      {/* Pattern F: Sticky Parameter Bar */}
      <div className="sticky top-14 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-6 bg-surface/95 backdrop-blur-xs border-y border-border shadow-xs">
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="font-medium text-text-secondary">งวด</span>
            <Select value={String(month)} onChange={(e) => setMonth(Number(e.target.value))} className="w-auto">
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {formatThaiMonth(m)}
                </option>
              ))}
            </Select>
            <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} className="w-auto">
              {YEAR_OFFSETS.map((offset) => {
                const y = currentYear + offset;
                return (
                  <option key={y} value={y}>
                    {y}
                  </option>
                );
              })}
            </Select>
          </label>
          <label className="flex items-center gap-2">
            <span className="font-medium text-text-secondary">โหมด</span>
            <Select
              value={mode}
              onChange={(e) => handleModeChange(e.target.value as SuggestionMode)}
              className="w-auto"
            >
              {(Object.keys(SUGGESTION_MODE_LABEL_TH) as SuggestionMode[]).map((value) => (
                <option key={value} value={value}>
                  {SUGGESTION_MODE_LABEL_TH[value]}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2">
            <span className="font-medium text-text-secondary">อัตราเติบโต</span>
            <Input
              type="number"
              min={TARGET_GROWTH_RATE_MIN}
              max={TARGET_GROWTH_RATE_MAX}
              step={TARGET_GROWTH_RATE_STEP}
              aria-label="อัตราเติบโต (ใช้ครั้งนี้ ไม่บันทึกลงการตั้งค่า)"
              value={growthRateInput}
              onChange={(e) => {
                growthRateTouchedRef.current = true;
                setGrowthRateInput(e.target.value);
              }}
              placeholder="0.000"
              className="w-24 text-right font-numeric"
            />
          </label>
          <Button
            type="button"
            onClick={handleApplyGrowthRate}
            size="sm"
          >
            ใช้ค่านี้
          </Button>
        </div>

        {growthRateError && <p className="mt-2 text-xs text-danger">{growthRateError}</p>}
      </div>

      {errorBanner && (
        <div className="mb-6">
          <InlineMessage variant="destructive">{errorBanner}</InlineMessage>
        </div>
      )}

      {actionError && (
        <div className="mb-6">
          <InlineMessage variant="destructive">{actionError}</InlineMessage>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && !errorBanner && preview && (
        <div className="space-y-8 pb-32">
          {/* Main Workbench Layout: Desktop side-by-side / Tablet & Mobile stacked */}
          <div className="xl:grid xl:grid-cols-12 xl:gap-6 items-start">
            {/* Left/Main Column: Parameters Summary + Results + Unmapped (8 cols) */}
            <div className="xl:col-span-8 space-y-6">
              {/* Parameters Summary Card */}
              <section className="rounded-lg border border-border bg-surface p-4 shadow-xs">
                <h2 className="text-base font-semibold text-text-primary">พารามิเตอร์ที่ใช้ครั้งนี้</h2>
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex justify-between gap-2 border-b border-border/40 py-1">
                    <dt className="text-text-muted">ฐานประวัติ</dt>
                    <dd className="font-medium text-text-primary text-right">
                      {windowLabel} · {preview.window.monthsUsed}/{preview.settings.targetLookbackMonths} ด.
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-border/40 py-1">
                    <dt className="text-text-muted">ตัวชี้วัดศักยภาพ</dt>
                    <dd className="font-medium text-text-primary">
                      {POTENTIAL_METRIC_LABEL_TH[preview.settings.potentialMetric]}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-border/40 py-1">
                    <dt className="text-text-muted">α (ฐานประวัติ)</dt>
                    <dd className="font-medium text-text-primary font-numeric">
                      {formatFixed3(preview.settings.targetSuggestionAlpha)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-border/40 py-1">
                    <dt className="text-text-muted">coverage ขั้นต่ำของภาค</dt>
                    <dd className="font-medium text-text-primary font-numeric">
                      {formatRatioPercent(preview.settings.minRegionCoverage)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-border/40 py-1">
                    <dt className="text-text-muted">เกณฑ์ตัด outlier</dt>
                    <dd className="font-medium text-text-primary font-numeric">
                      {formatRatioPercent(preview.settings.targetOutlierThreshold)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-border/40 py-1">
                    <dt className="text-text-muted">อัตราเติบโต</dt>
                    <dd className="font-medium text-text-primary font-numeric">
                      {formatFixed3(preview.settings.targetGrowthRate)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 rounded-md bg-surface-subtle px-3 py-2 text-xs text-text-secondary flex items-center justify-between">
                  <span>โหมดที่ใช้อยู่: <strong className="text-text-primary">{SUGGESTION_MODE_LABEL_TH[preview.mode]}</strong></span>
                  <span className="text-text-muted">
                    {preview.mode === "REBALANCE" ? "กระจายตามศักยภาพ" : "แนะนำตามประวัติและศักยภาพ"}
                  </span>
                </div>
              </section>

              {/* Region Suggestions Table */}
              <section className="rounded-lg border border-border bg-surface p-4 shadow-xs">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">ข้อเสนอรายภาค</h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      เปรียบเทียบฐานประวัติกับฐานศักยภาพ และคำนวณสัดส่วน R ตามสูตรที่กำหนด
                    </p>
                  </div>
                  <span className="text-xs font-medium text-text-secondary bg-surface-subtle px-2 py-0.5 rounded border border-border">
                    {preview.regions.length} ภาค
                  </span>
                </div>
                <RegionSuggestionsTable regions={preview.regions} />
              </section>

              {/* Unmapped Base Section — renamed per WACC-P2-010 */}
              <section className="rounded-lg border border-border bg-surface p-4 shadow-xs">
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-base font-semibold text-text-primary">ยอดที่ระบุภาคไม่ได้</h2>
                  <div className="group relative inline-flex items-center">
                    <span
                      tabIndex={0}
                      role="button"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-surface-subtle text-text-muted hover:text-text-primary text-xs font-semibold cursor-help border border-border"
                      aria-label="คำอธิบายยอดที่ระบุภาคไม่ได้"
                    >
                      ?
                    </span>
                    <div className="invisible group-hover:visible group-focus:visible absolute left-0 bottom-full mb-2 w-80 p-2.5 bg-surface text-text-secondary text-xs rounded-md shadow-lg border border-border z-30 pointer-events-none">
                      ยอดจากโรงพยาบาลที่ยังไม่มีการ map จังหวัด → ภาค ผ่านฝั่งประวัติ 100% ไม่เข้าสูตรศักยภาพและไม่เข้า R ของภาคใด (ผ่าน 100% ไม่ถูก blend หรือ gate)
                    </div>
                  </div>
                </div>
                <p className="mb-3 text-xs text-text-muted">
                  ยอดจากโรงพยาบาลที่ยังไม่มีการ map จังหวัด → ภาค ผ่านฝั่งประวัติ 100% ไม่เข้าสูตรศักยภาพและไม่เข้า R ของภาคใด
                </p>
                <div className="overflow-x-auto rounded-md border border-border bg-surface">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead className="bg-surface-subtle text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      <tr>
                        <th className="px-4 py-3">เขต</th>
                        <th className="px-4 py-3">ยอด / เดือน</th>
                        <th className="px-4 py-3">จำนวนโรงพยาบาลที่ยังไม่ได้ map</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {preview.unmapped.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-6 text-center text-text-muted">
                            ทุกยอดในงวดนี้ระบุภาคได้ครบ
                          </td>
                        </tr>
                      )}
                      {preview.unmapped.map((entry) => (
                        <tr key={entry.territoryId}>
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-text-primary">
                            {entry.territoryName}
                          </td>
                          <td className="px-4 py-3 text-text-secondary font-numeric">
                            {formatTargetMoney(entry.unmappedBase)}
                          </td>
                          <td className="px-4 py-3 text-text-secondary font-numeric">
                            {entry.unmappedHospitalCount.toLocaleString("th-TH")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Right Column: Persistent Cut Deals Panel on Desktop, in-flow on Tablet/Mobile (4 cols) */}
            <div className="mt-6 xl:mt-0 xl:col-span-4">
              <div className="xl:sticky xl:top-36 space-y-4">
                <CutDealsPanel
                  cutDeals={preview.cutDeals}
                  reinstatedInvoiceNos={reinstated}
                  pendingInvoiceNo={pendingInvoiceNo}
                  onToggle={(invoiceNo) => void handleToggleDeal(invoiceNo)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pattern F: Sticky Bottom Apply Bar */}
      {!loading && !errorBanner && preview && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-surface/95 backdrop-blur-xs p-3 sm:p-4 shadow-xl">
          <div className="mx-auto max-w-[var(--content-standard)]">
            <AcceptOffersPanel
              totals={preview.totals}
              existingByTerritoryId={existingByTerritoryId}
              savingTerritoryId={savingTerritoryId}
              onSave={handleAccept}
            />
          </div>
        </div>
      )}
    </PageContainer>
  );
}
