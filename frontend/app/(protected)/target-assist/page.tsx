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
import { POTENTIAL_METRIC_LABEL_TH, SUGGESTION_MODE_LABEL_TH, formatRatioPercent, formatTargetMoney } from "@/lib/targetLabels";
import { SuggestionMode, Target, TargetSuggestionPreview } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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
        new Map(data.targets.filter((target) => target.territoryId !== null).map((target) => [target.territoryId as number, target]))
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
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">หน้านี้สำหรับผู้จัดการเท่านั้น</p>
      </div>
    );
  }

  const windowLabel =
    preview?.window.start && preview.window.end
      ? `${formatThaiMonth(preview.window.start.month)} ${preview.window.start.year} – ${formatThaiMonth(preview.window.end.month)} ${preview.window.end.year}`
      : "ยังไม่มีข้อมูลย้อนหลัง";

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">ตัวช่วยตั้งเป้า</h1>
      <p className="mt-1 text-sm text-zinc-600">
        เทียบฐานประวัติ (historyBased) กับฐานศักยภาพ (potentialBased) รายเขตในแต่ละภาค พร้อมตัวเลขที่ระบบเสนอ
        (suggested) — ตัวเลขจะถูกเขียนลงเป้าจริงเมื่อผู้จัดการกดรับข้อเสนอเท่านั้น
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="font-medium text-zinc-600">งวด</span>
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
          <span className="font-medium text-zinc-600">โหมด</span>
          <Select value={mode} onChange={(e) => handleModeChange(e.target.value as SuggestionMode)} className="w-auto">
            {(Object.keys(SUGGESTION_MODE_LABEL_TH) as SuggestionMode[]).map((value) => (
              <option key={value} value={value}>
                {SUGGESTION_MODE_LABEL_TH[value]}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-2">
          <span className="font-medium text-zinc-600">อัตราเติบโต (ใช้ครั้งนี้ ไม่บันทึกลงการตั้งค่า)</span>
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
            className="w-24 text-right"
          />
        </label>
        <Button
          type="button"
          onClick={handleApplyGrowthRate}
          className="bg-zinc-900 text-white hover:bg-zinc-800"
          size="sm"
        >
          ใช้ค่านี้
        </Button>
      </div>

      {growthRateError && <p className="mt-2 text-sm text-red-600">{growthRateError}</p>}

      {errorBanner && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorBanner}</p>
      )}
      {actionError && <p className="mt-4 text-sm text-red-600">{actionError}</p>}
      {loading && <p className="mt-6 text-zinc-400">กำลังโหลด...</p>}

      {!loading && !errorBanner && preview && (
        <div className="mt-6 space-y-8">
          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-base font-semibold text-zinc-900">พารามิเตอร์ที่ใช้ครั้งนี้</h2>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">ฐานประวัติ</dt>
                <dd className="font-medium text-zinc-900">
                  {windowLabel} · ใช้ข้อมูลจริง {preview.window.monthsUsed}/{preview.settings.targetLookbackMonths} เดือน
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">ตัวชี้วัดศักยภาพ</dt>
                <dd className="font-medium text-zinc-900">{POTENTIAL_METRIC_LABEL_TH[preview.settings.potentialMetric]}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">α (ฐานประวัติ)</dt>
                <dd className="font-medium text-zinc-900">{formatFixed3(preview.settings.targetSuggestionAlpha)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">coverage ขั้นต่ำของภาค</dt>
                <dd className="font-medium text-zinc-900">{formatRatioPercent(preview.settings.minRegionCoverage)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">เกณฑ์ตัด outlier</dt>
                <dd className="font-medium text-zinc-900">{formatRatioPercent(preview.settings.targetOutlierThreshold)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-600">อัตราเติบโต</dt>
                <dd className="font-medium text-zinc-900">{formatFixed3(preview.settings.targetGrowthRate)}</dd>
              </div>
            </dl>
            <p className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              โหมดที่ใช้อยู่: <span className="font-semibold">{SUGGESTION_MODE_LABEL_TH[preview.mode]}</span>
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900">ข้อเสนอรายภาค</h2>
            <RegionSuggestionsTable regions={preview.regions} />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900">ยอดที่ยังไม่ระบุภาค (unmappedBase)</h2>
            <p className="mb-3 text-sm text-zinc-600">
              ยอดจากโรงพยาบาลที่ยังไม่มีการ map จังหวัด → ภาค ผ่านฝั่งประวัติ 100% ไม่เข้าสูตรศักยภาพและไม่เข้า R ของภาคใด
            </p>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">เขต</th>
                    <th className="px-4 py-3">unmappedBase /เดือน</th>
                    <th className="px-4 py-3">จำนวนโรงพยาบาลที่ยังไม่ได้ map</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {preview.unmapped.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-zinc-400">
                        ทุกยอดในงวดนี้ระบุภาคได้ครบ
                      </td>
                    </tr>
                  )}
                  {preview.unmapped.map((entry) => (
                    <tr key={entry.territoryId}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-900">{entry.territoryName}</td>
                      <td className="px-4 py-3 text-zinc-700">{formatTargetMoney(entry.unmappedBase)}</td>
                      <td className="px-4 py-3 text-zinc-700">{entry.unmappedHospitalCount.toLocaleString("th-TH")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <CutDealsPanel
            cutDeals={preview.cutDeals}
            reinstatedInvoiceNos={reinstated}
            pendingInvoiceNo={pendingInvoiceNo}
            onToggle={(invoiceNo) => void handleToggleDeal(invoiceNo)}
          />

          <AcceptOffersPanel
            totals={preview.totals}
            existingByTerritoryId={existingByTerritoryId}
            savingTerritoryId={savingTerritoryId}
            onSave={handleAccept}
          />
        </div>
      )}
    </div>
  );
}
