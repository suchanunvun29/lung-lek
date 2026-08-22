import { prisma } from "../lib/prisma";
import { TerritoryViewQuery } from "../validators/territoryView.validators";
import { monthsInPeriod, monthsWhereOr } from "./period.util";
export async function getTerritoryView(salespersonId: string, query: TerritoryViewQuery) {
  const salesperson = await prisma.salesperson.findUnique({ where: { id: salespersonId } }); if (!salesperson) return null;
  const assignments = await prisma.territoryAssignment.findMany({ where: { salespersonId, effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }] }, include: { territory: true } });
  const territoryIds = assignments.map((row) => row.territoryId); const fallback = salesperson.excludedFromTerritoryTotals || !territoryIds.length; const months = monthsInPeriod(query);
  const base = fallback ? {} : { hospital: { territoryId: { in: territoryIds } } };
  const credited = query.creditOnly ? { credits: { some: { salespersonId } } } : {};
  const filters = { ...base, ...credited, ...(query.productTypeId ? { productTypeId: query.productTypeId } : {}) };
  const [current, historic] = await Promise.all([prisma.salesLine.findMany({ where: { ...filters, OR: monthsWhereOr(months) }, include: { hospital: true, productType: true, credits: { where: query.creditOnly ? { salespersonId } : undefined, select: { sharePercent: true, salesperson: { select: { excludedFromTerritoryTotals: true } } } } } }), prisma.salesLine.findMany({ where: filters, include: { hospital: true } })]);
  const currentHospitalIds = new Set(current.map((line) => line.hospitalId)); const historicByHospital = new Map(historic.map((line) => [line.hospitalId, line.hospital]));
  const revenue = (line: typeof current[number]) => query.creditOnly ? Number(line.total) * (Number(line.credits[0]?.sharePercent ?? 0) / 100) : Number(line.total);
  const sold = [...currentHospitalIds].map((id) => { const rows = current.filter((line) => line.hospitalId === id); return { hospital: historicByHospital.get(id), revenue: rows.reduce((sum, line) => sum + revenue(line), 0) }; }).sort((a,b) => b.revenue-a.revenue);
  const inactive = [...historicByHospital.entries()].filter(([id]) => !currentHospitalIds.has(id)).map(([, hospital]) => hospital).sort((a,b) => a.displayName.localeCompare(b.displayName));
  return { salesperson: { id: salesperson.id, displayName: salesperson.displayName }, territories: assignments.map((row) => ({ id: row.territory.id, name: row.territory.name })), mode: fallback ? "NATIONWIDE_PRODUCT_TYPE_FALLBACK" : query.creditOnly ? "OWN_CREDIT_ONLY" : "TERRITORY_TOTAL", creditOnly: query.creditOnly, productTypeId: query.productTypeId ?? null, soldHospitals: sold, soldBeforeButNotInPeriod: inactive };
}
