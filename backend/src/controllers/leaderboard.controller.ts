import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import * as kpiService from "../services/kpi.service";
import { PeriodKey } from "../services/period.util";
import { LeaderboardQuery } from "../validators/leaderboard.validators";

interface LeaderboardEntry {
  salesperson: { id: string; displayName: string };
  value: number | null;
  computable: boolean;
  reason: string | null;
}

async function buildEntry(
  salesperson: { id: string; displayName: string },
  criteria: LeaderboardQuery["criteria"],
  period: PeriodKey
): Promise<LeaderboardEntry> {
  const base = { salesperson };

  if (criteria === "COMPOSITE") {
    const composite = await kpiService.computeCompositeScore(salesperson.id, period);
    return { ...base, value: composite.composite, computable: composite.composite !== null, reason: composite.message };
  }

  if (criteria === "PERCENT_TARGET") {
    const revenue = await kpiService.computeRevenueVsTarget(salesperson.id, period);
    const achievementPercent = (revenue.detail.achievementPercent as number | undefined) ?? null;
    return { ...base, value: achievementPercent, computable: revenue.computable, reason: revenue.reason };
  }

  if (criteria === "REVENUE") {
    const revenue = await kpiService.computeRevenueVsTarget(salesperson.id, period);
    return { ...base, value: revenue.detail.actual as number, computable: true, reason: null };
  }

  // NEW_CUSTOMERS
  const actual = await kpiService.getNewCustomerActualCount(salesperson.id, period);
  return { ...base, value: actual, computable: true, reason: null };
}

export async function getLeaderboard(req: Request, res: Response) {
  const { criteria, ...period } = req.query as unknown as LeaderboardQuery;

  const salespeople = await prisma.salesperson.findMany({
    where: { isActive: true },
    orderBy: { displayName: "asc" },
  });

  const entries = await Promise.all(
    salespeople.map((sp) => buildEntry({ id: sp.id, displayName: sp.displayName }, criteria, period))
  );

  const ranked = entries
    .filter((e) => e.computable)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .map((e, index) => ({ ...e, rank: index + 1 }));
  const unranked = entries.filter((e) => !e.computable).map((e) => ({ ...e, rank: null }));

  res.json({ criteria, period, results: [...ranked, ...unranked] });
}
