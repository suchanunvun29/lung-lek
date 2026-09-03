import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { trailingMonths } from "./period.util";

// Module L — Territory & Potential Rules contract (design.md). Per the 2026-08-16 round-2
// amendment every formula here is computed at TERRITORY grain (sp → T), per region, and suggested
// values land on Target(scope=TERRITORY) through the existing Phase 12 endpoints; person-level
// numbers come from GET /targets/derived (Territory KPI Rules ข้อ 6), never from this module.
// Money always flows through SalesLineCredit with the excludedFromTerritoryTotals filter
// (Territory KPI Rules ข้อ 2) — never SalesLine.salespersonId. This file never touches
// ScoringWeight or the Phase 4 composite score (scripts/guardModuleLScoring.ts enforces it).

export type SuggestionMode = "SUGGEST" | "REBALANCE";

export class RebalancePreconditionError extends Error {
  status = 400;
  constructor(public missingByRegionName: Record<string, string[]>) {
    const detail = Object.entries(missingByRegionName)
      .map(([region, territories]) => `${region}: ${territories.join(", ")}`)
      .join(" · ");
    super(`โหมด REBALANCE เปิดใช้ได้เฉพาะเมื่อทุกเขตในภาคมีเป้าของงวดนั้นครบแล้ว — ยังขาด: ${detail}`);
  }
}

const MISSING_SETTINGS_MESSAGE = "EvaluationSetting singleton row is missing — re-run the seed script";
const DEFAULT_TIER_WEIGHT = 1.0;

// ---------- Pure math (exported for scripts/guardModuleLScoring.ts — no DB access below) ----------

export interface UnitInvoice {
  invoiceNo: string;
  total: number; // full credited value of the invoice for this unit across all regions + unmapped
  byRegion: Map<string, number>; // regionId -> portion credited via mapped hospitals
  unmapped: number; // portion credited via hospitals without provinceMappingId
}

export interface OutlierCutResult {
  beforeByRegion: Map<string, number>;
  beforeUnmapped: number;
  afterByRegion: Map<string, number>;
  afterUnmapped: number;
  cutDeals: Array<{ invoiceNo: string; value: number; ratio: number }>;
}

// Territory & Potential Rules ข้อ 5.1 — the deal unit is one invoiceNo and the outlier divisor is
// the unit's whole-window total across ALL regions plus unmapped money. Cutting is never silent:
// every removed invoice comes back in cutDeals with its ratio, and reinstatedInvoiceNos puts a
// deal back into the base for this preview only.
export function applyOutlierCut(
  invoices: UnitInvoice[],
  threshold: number,
  reinstatedInvoiceNos: ReadonlySet<string>
): OutlierCutResult {
  const result: OutlierCutResult = {
    beforeByRegion: new Map(),
    beforeUnmapped: 0,
    afterByRegion: new Map(),
    afterUnmapped: 0,
    cutDeals: [],
  };
  const grandTotal = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const bump = (map: Map<string, number>, key: string, value: number) => map.set(key, (map.get(key) ?? 0) + value);

  for (const invoice of invoices) {
    const ratio = grandTotal > 0 ? invoice.total / grandTotal : 0;
    const isOutlier = !reinstatedInvoiceNos.has(invoice.invoiceNo) && ratio > threshold;
    for (const [regionId, value] of invoice.byRegion) {
      bump(result.beforeByRegion, regionId, value);
      if (!isOutlier) bump(result.afterByRegion, regionId, value);
    }
    result.beforeUnmapped += invoice.unmapped;
    if (!isOutlier) result.afterUnmapped += invoice.unmapped;
    if (isOutlier) result.cutDeals.push({ invoiceNo: invoice.invoiceNo, value: invoice.total, ratio });
  }
  return result;
}

export function monthlyHistoryValue(base: number, monthsUsed: number, growthRate: number): number {
  return monthsUsed > 0 ? (base / monthsUsed) * growthRate : 0;
}

export interface RegionUnitInput {
  territoryId: string;
  potential: number;
  territoryCoverage: number | null; // null = the unit has no sales at all → coverage cap 0
  historyBase: number; // this region, after outlier cut
}

export interface RegionSuggestionRow extends RegionUnitInput {
  potentialShare: number;
  historyBased: number;
  potentialBased: number;
  w: number;
  suggested: number;
}

export interface RegionSuggestionResult {
  coveragePass: boolean;
  r: number;
  suggestedSum: number;
  potentialBasedSum: number;
  rows: RegionSuggestionRow[];
}

// Territory & Potential Rules ข้อ 3/5.2/5.3 — R by mode, the blended weight capped by coverage,
// and NO renormalization: Σ suggested may differ from R and that difference is surfaced as-is.
export function computeRegionSuggestions(params: {
  regionCoverage: number | null; // null = the region has no sales at all
  minRegionCoverage: number;
  alpha: number;
  monthsUsed: number;
  growthRate: number;
  rebalanceTargetByTerritory: Map<string, number> | null;
  units: RegionUnitInput[];
}): RegionSuggestionResult {
  const { regionCoverage, minRegionCoverage, alpha, monthsUsed, growthRate, rebalanceTargetByTerritory, units } = params;
  const rows: RegionSuggestionRow[] = units.map((unit) => ({
    ...unit,
    potentialShare: 0,
    historyBased: monthlyHistoryValue(unit.historyBase, monthsUsed, growthRate),
    potentialBased: 0,
    w: 0,
    suggested: 0,
  }));

  const potentialTotal = rows.reduce((sum, row) => sum + row.potential, 0);
  let r: number;
  if (rebalanceTargetByTerritory) {
    r = [...rebalanceTargetByTerritory.values()].reduce((sum, value) => sum + value, 0);
  } else {
    r = rows.reduce((sum, row) => sum + row.historyBased, 0);
  }

  const coveragePass = regionCoverage !== null && regionCoverage >= minRegionCoverage;
  for (const row of rows) {
    row.potentialShare = potentialTotal > 0 ? row.potential / potentialTotal : 0;
    row.potentialBased = r * row.potentialShare;
    // w = 0 unless the region passes the gate; otherwise the alpha headroom is capped by the
    // unit's own linked-sales coverage (the heart of ข้อ 5.3).
    row.w = coveragePass ? Math.min(1 - alpha, row.territoryCoverage ?? 0) : 0;
    row.suggested = (1 - row.w) * row.historyBased + row.w * row.potentialBased;
  }

  return {
    coveragePass,
    r,
    suggestedSum: rows.reduce((sum, row) => sum + row.suggested, 0),
    potentialBasedSum: rows.reduce((sum, row) => sum + row.potentialBased, 0),
    rows,
  };
}

// ---------- DB orchestration ----------

interface PreviewOptions {
  mode: SuggestionMode;
  growthRateOverride?: number;
  reinstatedInvoiceNos?: ReadonlySet<string>;
}

interface WindowCreditRow {
  sharePercent: number | Prisma.Decimal;
  salesLine: {
    invoiceNo: string;
    total: number | Prisma.Decimal;
    hospitalId: string;
    hospital: { territoryId: string | null; provinceMapping: { regionId: string } | null };
  };
}

interface CoverageCreditRow {
  sharePercent: number | Prisma.Decimal;
  salesperson: { excludedFromTerritoryTotals: boolean };
  salesLine: {
    total: number | Prisma.Decimal;
    hospital: {
      territoryId: string | null;
      provinceMapping: { regionId: string } | null;
      registryLink: { status: string; hospitalRegistryId: string | null } | null;
    };
  };
}

function isLinked(link: { status: string; hospitalRegistryId: string | null } | null | undefined): boolean {
  return Boolean(link && link.status === "LINKED" && link.hospitalRegistryId !== null);
}

export async function buildTargetSuggestionPreview(year: number, month: number, options: PreviewOptions) {
  const settings = await prisma.evaluationSetting.findUnique({ where: { id: "singleton" } });
  if (!settings) throw new Error(MISSING_SETTINGS_MESSAGE);
  const growthRate = options.growthRateOverride ?? Number(settings.targetGrowthRate);
  const threshold = Number(settings.targetOutlierThreshold);
  const alpha = Number(settings.targetSuggestionAlpha);
  const minRegionCoverage = Number(settings.minRegionCoverage);

  // Window: the targetLookbackMonths before the target period (ข้อ 5.1); months that hold no data
  // anywhere don't count toward the divisor (Risks ข้อ 18 — the screen shows months actually used).
  const previousMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const windowMonths = trailingMonths(previousMonth.year, previousMonth.month, settings.targetLookbackMonths);
  const monthsWithData = await prisma.salesLine.findMany({
    where: { OR: windowMonths.map((m) => ({ year: m.year, month: m.month })) },
    select: { year: true, month: true },
    distinct: ["year", "month"],
  });
  const windowMonthKeys = new Set(monthsWithData.map((row) => `${row.year}-${row.month}`));
  const monthsUsed = windowMonths.filter((m) => windowMonthKeys.has(`${m.year}-${m.month}`)).length;

  const [windowCredits, allTimeCredits, regions, tierWeightRows, registries, hospitals, targets] = await Promise.all([
    prisma.salesLineCredit.findMany({
      where: {
        salesperson: { excludedFromTerritoryTotals: false },
        salesLine: { OR: windowMonths.map((m) => ({ year: m.year, month: m.month })) },
      },
      select: {
        sharePercent: true,
        salesLine: {
          select: {
            invoiceNo: true,
            total: true,
            hospitalId: true,
            hospital: { select: { territoryId: true, provinceMapping: { select: { regionId: true } } } },
          },
        },
      },
    }),
    prisma.salesLineCredit.findMany({
      select: {
        sharePercent: true,
        salesperson: { select: { excludedFromTerritoryTotals: true } },
        salesLine: {
          select: {
            total: true,
            hospital: {
              select: {
                territoryId: true,
                provinceMapping: { select: { regionId: true } },
                registryLink: { select: { status: true, hospitalRegistryId: true } },
              },
            },
          },
        },
      },
    }),
    prisma.region.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.tierWeight.findMany(),
    prisma.hospitalRegistry.findMany({
      select: {
        id: true,
        tier: true,
        potentialAdjustment: true,
        metrics: { where: { metric: settings.potentialMetric, periodYear: null, periodMonth: null }, take: 1 },
      },
    }),
    prisma.hospital.findMany({
      where: { territoryId: { not: null } },
      select: {
        id: true,
        territoryId: true,
        provinceMapping: { select: { regionId: true } },
        registryLink: { select: { status: true, hospitalRegistryId: true } },
      },
    }),
    prisma.target.findMany({ where: { scope: "TERRITORY", year, month }, select: { territoryId: true, revenueTarget: true } }),
  ]);

  // ข้อ 1 — potential(h) = metricValue × tierWeight × potentialAdjustment, only for hospitals
  // linked to a registry row that actually has the configured metric; everything else has no
  // potential at all and surfaces through coverage instead (never counted as 0-potential).
  const weightByTier = new Map(tierWeightRows.map((row) => [row.tier, Number(row.weight)]));
  const registryByLinkedId = new Map<string, { tier: string | null; adjustment: number; metricValue: number | null }>();
  for (const registry of registries) {
    const rawMetricValue = registry.metrics[0]?.value;
    registryByLinkedId.set(registry.id, {
      tier: registry.tier,
      adjustment: Number(registry.potentialAdjustment),
      metricValue: rawMetricValue === undefined ? null : Number(rawMetricValue),
    });
  }

  const potentialByUnitRegion = new Map<string, Map<string, number>>();
  const unitRegions = new Map<string, Set<string>>(); // presence: any assigned hospital mapped to the region
  for (const hospital of hospitals) {
    const territoryId = hospital.territoryId;
    if (!territoryId) continue;
    const regionId = hospital.provinceMapping?.regionId ?? null;
    if (regionId) {
      if (!unitRegions.has(territoryId)) unitRegions.set(territoryId, new Set());
      unitRegions.get(territoryId)!.add(regionId);
    }
    if (!regionId || !isLinked(hospital.registryLink)) continue;
    const registry = registryByLinkedId.get(hospital.registryLink!.hospitalRegistryId!);
    if (!registry || registry.metricValue === null) continue;
    const potential = registry.metricValue * (weightByTier.get(registry.tier ?? "") ?? DEFAULT_TIER_WEIGHT) * registry.adjustment;
    if (!potentialByUnitRegion.has(territoryId)) potentialByUnitRegion.set(territoryId, new Map());
    const byRegion = potentialByUnitRegion.get(territoryId)!;
    byRegion.set(regionId, (byRegion.get(regionId) ?? 0) + potential);
  }

  // Coverage (ข้อ 3) — all-time, matching how the contract's own baseline numbers were computed.
  // Region level counts everyone (registry quality vs all real money in the geography); unit level
  // applies the Territory KPI Rules ข้อ 2 pool on both sides so the ratio stays consistent.
  const regionSales = new Map<string, number>();
  const regionLinkedSales = new Map<string, number>();
  const unitSales = new Map<string, number>();
  const unitLinkedSales = new Map<string, number>();
  const unitRegionLinkedSales = new Map<string, Map<string, number>>();
  for (const credit of allTimeCredits as unknown as CoverageCreditRow[]) {
    const amount = Number(credit.salesLine.total) * Number(credit.sharePercent) / 100;
    const regionId = credit.salesLine.hospital.provinceMapping?.regionId ?? null;
    const territoryId = credit.salesLine.hospital.territoryId;
    if (regionId) {
      regionSales.set(regionId, (regionSales.get(regionId) ?? 0) + amount);
      if (isLinked(credit.salesLine.hospital.registryLink)) {
        regionLinkedSales.set(regionId, (regionLinkedSales.get(regionId) ?? 0) + amount);
      }
    }
    if (!territoryId || credit.salesperson.excludedFromTerritoryTotals) continue;
    unitSales.set(territoryId, (unitSales.get(territoryId) ?? 0) + amount);
    if (!isLinked(credit.salesLine.hospital.registryLink)) continue;
    unitLinkedSales.set(territoryId, (unitLinkedSales.get(territoryId) ?? 0) + amount);
    if (regionId) {
      if (!unitRegionLinkedSales.has(territoryId)) unitRegionLinkedSales.set(territoryId, new Map());
      const byRegion = unitRegionLinkedSales.get(territoryId)!;
      byRegion.set(regionId, (byRegion.get(regionId) ?? 0) + amount);
    }
  }

  // History deals per unit (ข้อ 5.1): group window credits by invoiceNo within the unit, split
  // into mapped-region buckets and the unmapped bucket. Unassigned hospitals belong to no unit.
  const invoicesByUnit = new Map<string, Map<string, UnitInvoice>>();
  const unmappedHospitalIdsByUnit = new Map<string, Set<string>>();
  for (const credit of windowCredits as unknown as WindowCreditRow[]) {
    const territoryId = credit.salesLine.hospital.territoryId;
    if (!territoryId) continue;
    const invoiceNo = credit.salesLine.invoiceNo;
    if (!invoicesByUnit.has(territoryId)) invoicesByUnit.set(territoryId, new Map());
    const invoices = invoicesByUnit.get(territoryId)!;
    let invoice = invoices.get(invoiceNo);
    if (!invoice) {
      invoice = { invoiceNo, total: 0, byRegion: new Map(), unmapped: 0 };
      invoices.set(invoiceNo, invoice);
    }
    const amount = Number(credit.salesLine.total) * Number(credit.sharePercent) / 100;
    invoice.total += amount;
    const regionId = credit.salesLine.hospital.provinceMapping?.regionId ?? null;
    if (regionId) invoice.byRegion.set(regionId, (invoice.byRegion.get(regionId) ?? 0) + amount);
    else {
      invoice.unmapped += amount;
      if (!unmappedHospitalIdsByUnit.has(territoryId)) unmappedHospitalIdsByUnit.set(territoryId, new Set());
      unmappedHospitalIdsByUnit.get(territoryId)!.add(credit.salesLine.hospitalId);
    }
  }

  const reinstated = options.reinstatedInvoiceNos ?? new Set<string>();
  const cutsByUnit = new Map<string, OutlierCutResult>();
  for (const [territoryId, invoices] of invoicesByUnit) {
    cutsByUnit.set(territoryId, applyOutlierCut([...invoices.values()], threshold, reinstated));
  }

  // Regions to render: any region with coverage data, unit presence, or unit history (before-cut
  // membership so a fully-cut unit keeps its row — cutting must stay visible).
  const activeRegionIds = new Set<string>([...regionSales.keys()]);
  for (const regionIds of unitRegions.values()) for (const regionId of regionIds) activeRegionIds.add(regionId);
  for (const cut of cutsByUnit.values()) {
    for (const regionId of cut.beforeByRegion.keys()) activeRegionIds.add(regionId);
    for (const regionId of cut.afterByRegion.keys()) activeRegionIds.add(regionId);
  }

  const sortedRegions = regions.filter((region) => activeRegionIds.has(region.id));
  const territoryRows = await prisma.territory.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  const territoryNameById = new Map(territoryRows.map((territory) => [territory.id, territory.name]));
  const targetByTerritory = new Map(
    targets.filter((target) => target.territoryId !== null).map((target) => [target.territoryId as string, Number(target.revenueTarget)])
  );

  const missingByRegionName: Record<string, string[]> = {};
  const regionResults = sortedRegions.map((region) => {
    const regionId = region.id;
    const unitIds = new Set<string>([
      ...(potentialByUnitRegion.get(regionId)?.keys() ?? []),
      ...[...(unitRegions.get(regionId) ?? new Set<string>())],
      ...[...cutsByUnit.entries()].filter(([, cut]) => cut.beforeByRegion.has(regionId) || cut.afterByRegion.has(regionId)).map(([territoryId]) => territoryId),
    ]);

    if (options.mode === "REBALANCE") {
      const lacking = [...unitIds].filter((territoryId) => !targetByTerritory.has(territoryId));
      if (lacking.length > 0) {
        missingByRegionName[region.name] = lacking.map((territoryId) => territoryNameById.get(territoryId) ?? territoryId);
      }
    }
    const rebalanceTargets =
      options.mode === "REBALANCE"
        ? new Map([...unitIds].map((territoryId) => [territoryId, targetByTerritory.get(territoryId) ?? 0]))
        : null;

    const total = regionSales.get(regionId) ?? 0;
    const linked = regionLinkedSales.get(regionId) ?? 0;
    const regionCoverage = total > 0 ? linked / total : null;
    const result = computeRegionSuggestions({
      regionCoverage,
      minRegionCoverage,
      alpha,
      monthsUsed,
      growthRate,
      rebalanceTargetByTerritory: rebalanceTargets,
      units: [...unitIds].map((territoryId) => {
        const cut = cutsByUnit.get(territoryId);
        const unitTotal = unitSales.get(territoryId) ?? 0;
        return {
          territoryId,
          potential: potentialByUnitRegion.get(territoryId)?.get(regionId) ?? 0,
          territoryCoverage: unitTotal > 0 ? (unitLinkedSales.get(territoryId) ?? 0) / unitTotal : null,
          historyBase: cut?.afterByRegion.get(regionId) ?? 0,
        };
      }),
    });

    return {
      regionId,
      regionName: region.name,
      coveragePass: result.coveragePass,
      regionCoverage,
      r: result.r,
      suggestedSum: result.suggestedSum,
      differenceFromR: result.suggestedSum - result.r,
      territories: result.rows.map((row) => {
        const cut = cutsByUnit.get(row.territoryId);
        // ข้อ 4 — display-only: linked sales ÷ potential, baht per potential unit, never a %.
        const linkedInRegion = unitRegionLinkedSales.get(row.territoryId)?.get(regionId) ?? 0;
        return {
          territoryId: row.territoryId,
          territoryName: territoryNameById.get(row.territoryId) ?? row.territoryId,
          potential: row.potential,
          potentialShare: row.potentialShare,
          territoryCoverage: row.territoryCoverage,
          historyBeforeCut: cut?.beforeByRegion.get(regionId) ?? 0,
          historyAfterCut: cut?.afterByRegion.get(regionId) ?? 0,
          historyBased: row.historyBased,
          potentialBased: row.potentialBased,
          w: row.w,
          suggested: row.suggested,
          penetrationIndex: row.potential > 0 ? linkedInRegion / row.potential : null,
        };
      }),
    };
  });

  // ข้อ 5.4 — the unmapped chunk per unit passes the history side 100% (no blending, no gate)
  // and joins only the per-unit total, never any region's R.
  const unmapped = [...cutsByUnit.entries()]
    .map(([territoryId, cut]) => ({
      territoryId,
      territoryName: territoryNameById.get(territoryId) ?? territoryId,
      unmappedBase: monthlyHistoryValue(cut.afterUnmapped, monthsUsed, growthRate),
      unmappedHospitalCount: unmappedHospitalIdsByUnit.get(territoryId)?.size ?? 0,
    }))
    .sort((a, b) => a.territoryName.localeCompare(b.territoryName));

  // ข้อ 5.5 — suggested(unit) = Σ suggested(unit, region) over every region + unmappedBase.
  const totals = territoryRows
    .map((territory) => {
      const suggestedFromRegions = regionResults.reduce(
        (sum, region) => sum + (region.territories.find((row) => row.territoryId === territory.id)?.suggested ?? 0),
        0
      );
      const unmappedEntry = unmapped.find((entry) => entry.territoryId === territory.id);
      return {
        territoryId: territory.id,
        territoryName: territory.name,
        suggestedTotal: suggestedFromRegions + (unmappedEntry?.unmappedBase ?? 0),
      };
    })
    .filter((entry) => entry.suggestedTotal !== 0 || invoicesByUnit.has(entry.territoryId));

  const cutDeals = [...cutsByUnit.entries()].flatMap(([territoryId, cut]) =>
    cut.cutDeals.map((deal) => ({
      territoryId,
      territoryName: territoryNameById.get(territoryId) ?? territoryId,
      invoiceNo: deal.invoiceNo,
      dealValue: deal.value,
      ratio: deal.ratio,
    }))
  );

  // ข้อ 5.2 — REBALANCE opens only when every unit present in the region has a Target for this
  // period; never fall back to the other mode silently.
  if (options.mode === "REBALANCE" && Object.keys(missingByRegionName).length > 0) {
    throw new RebalancePreconditionError(missingByRegionName);
  }

  return {
    year,
    month,
    mode: options.mode,
    settings: {
      potentialMetric: settings.potentialMetric,
      minRegionCoverage,
      targetSuggestionAlpha: alpha,
      targetLookbackMonths: settings.targetLookbackMonths,
      targetOutlierThreshold: threshold,
      targetGrowthRate: growthRate,
    },
    window: {
      start: windowMonths[0] ?? null,
      end: windowMonths[windowMonths.length - 1] ?? null,
      monthsUsed,
    },
    regions: regionResults,
    unmapped,
    totals,
    cutDeals,
  };
}
