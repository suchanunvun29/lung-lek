import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { TerritoryViewQuery } from "../validators/territoryView.validators";
import { firstDayOfPeriod, lastDayOfPeriod, monthsInPeriod, monthsWhereOr, YearMonth } from "./period.util";
import { creditedRevenueByHospital, hospitalIdsWithCreditedSales, hospitalIdsWithSalesBySalesperson } from "./kpi.service";

// Module P1 (Territory KPI Rules ข้อ 8): the salesperson's territories come from assignments
// effective IN THE VIEWED PERIOD (same window as ownerNamesFor/activeOwnerCount), membership is
// territory-grain, and every amount uses revenue(T)'s ข้อ-2 math through SalesLineCredit — the
// shared helpers from kpi.service.ts, never a parallel definition.
export async function getTerritoryView(salespersonId: string, query: TerritoryViewQuery) {
  const salesperson = await prisma.salesperson.findUnique({ where: { id: salespersonId } });
  if (!salesperson) return null;

  const months: YearMonth[] = monthsInPeriod(query);
  const periodWindow = { effectiveFrom: { lte: lastDayOfPeriod(query) }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: firstDayOfPeriod(query) } }] };
  const assignments = await prisma.territoryAssignment.findMany({ where: { salespersonId, ...periodWindow }, include: { territory: true } });
  const territoryIds = assignments.map((row) => row.territoryId);

  const fallback = salesperson.excludedFromTerritoryTotals || !territoryIds.length;
  const baseWhere: Prisma.SalesLineWhereInput = fallback ? {} : { hospital: { territoryId: { in: territoryIds } } };
  const productTypeFilter: Prisma.SalesLineWhereInput = query.productTypeId ? { productTypeId: query.productTypeId } : {};
  const scopedWhere = { ...baseWhere, ...productTypeFilter };

  // Membership + amounts both follow the credit lens: a territory's hospitals count whoever
  // holds non-excluded credit there (or, in OWN_CREDIT_ONLY / fallback mode, this person only).
  const ownCreditsOnly = fallback || query.creditOnly;
  const [currentIdsRaw, everIdsRaw, currentRevenue] = await Promise.all([
    ownCreditsOnly
      ? hospitalIdsWithSalesBySalesperson(salespersonId, scopedWhere, months)
      : hospitalIdsWithCreditedSales(scopedWhere, months),
    ownCreditsOnly
      ? hospitalIdsWithSalesBySalesperson(salespersonId, scopedWhere)
      : hospitalIdsWithCreditedSales(scopedWhere),
    ownCreditsOnly
      ? creditedSelfRevenueByHospital(salespersonId, scopedWhere, months)
      : creditedRevenueByHospital(scopedWhere, months),
  ]);

  const hospitals = await prisma.hospital.findMany({
    where: { id: { in: [...new Set([...currentIdsRaw, ...everIdsRaw])] } },
    select: { id: true, displayName: true, province: true },
  });
  const byId = new Map(hospitals.map((hospital) => [hospital.id, hospital]));

  const soldHospitals = [...currentIdsRaw]
    .map((hospitalId) => {
      const hospital = byId.get(hospitalId)!;
      return { hospital: { id: hospital.id, displayName: hospital.displayName }, revenue: currentRevenue.get(hospitalId) ?? 0 };
    })
    .sort((a, b) => b.revenue - a.revenue);
  const soldBeforeButNotInPeriod = [...everIdsRaw]
    .filter((id) => !currentIdsRaw.has(id))
    .map((hospitalId) => {
      const hospital = byId.get(hospitalId)!;
      return { hospital: { id: hospital.id, displayName: hospital.displayName, province: hospital.province ?? null } };
    })
    .sort((a, b) => a.hospital.displayName.localeCompare(b.hospital.displayName, "th"));

  return {
    salesperson: { id: salesperson.id, displayName: salesperson.displayName },
    territories: assignments.map((row) => ({ id: row.territory.id, displayName: row.territory.name })),
    mode: fallback ? "NATIONWIDE_PRODUCT_TYPE_FALLBACK" : query.creditOnly ? "OWN_CREDIT_ONLY" : "TERRITORY_TOTAL",
    creditOnly: query.creditOnly,
    productTypeId: query.productTypeId ?? null,
    soldHospitals,
    soldBeforeButNotInPeriod,
  };
}

async function creditedSelfRevenueByHospital(salespersonId: string, baseWhere: Prisma.SalesLineWhereInput, months?: YearMonth[]): Promise<Map<string, number>> {
  const rows = await prisma.salesLineCredit.findMany({
    where: { salespersonId, salesLine: { ...baseWhere, ...(months ? { OR: monthsWhereOr(months) } : {}) } },
    select: { sharePercent: true, salesLine: { select: { hospitalId: true, total: true } } },
  });
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.salesLine.hospitalId, (totals.get(row.salesLine.hospitalId) ?? 0) + Number(row.salesLine.total) * Number(row.sharePercent) / 100);
  return totals;
}
