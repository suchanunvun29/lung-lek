import { Prisma } from "@prisma/client";

// Single source of the Territory KPI Rules ข้อ 9 ambiguity predicate (runner-up ≥ 30% of #1),
// shared by the unassigned-hospitals endpoint and scripts/bootstrapTerritories.ts so the two
// can never drift apart.
export const AMBIGUITY_THRESHOLD = 0.3;

export type CreditRow = {
  salespersonId: string;
  sharePercent: number | Prisma.Decimal;
  salesLine: { hospitalId: string; total: number | Prisma.Decimal };
};

// Territory KPI Rules ข้อ 2 math per (hospital, person): Σ (total × sharePercent ÷ 100).
// Exclusion is the caller's job: pass only rows whose salesperson has excludedFromTerritoryTotals = false.
export function creditedRevenueByHospital(credits: Iterable<CreditRow>): Map<string, Map<string, number>> {
  const byHospital = new Map<string, Map<string, number>>();
  for (const credit of credits) {
    let byPerson = byHospital.get(credit.salesLine.hospitalId);
    if (!byPerson) {
      byPerson = new Map();
      byHospital.set(credit.salesLine.hospitalId, byPerson);
    }
    byPerson.set(credit.salespersonId, (byPerson.get(credit.salespersonId) ?? 0) + Number(credit.salesLine.total) * Number(credit.sharePercent) / 100);
  }
  return byHospital;
}

export function rankContributors(byPerson: Map<string, number>): Array<{ salespersonId: string; revenue: number }> {
  return [...byPerson.entries()].map(([salespersonId, revenue]) => ({ salespersonId, revenue })).sort((a, b) => b.revenue - a.revenue);
}

export function hasAmbiguousRunnerUp(ranked: Array<{ revenue: number }>, threshold: number = AMBIGUITY_THRESHOLD): boolean {
  return ranked.length > 1 && ranked[1].revenue >= ranked[0].revenue * threshold;
}
