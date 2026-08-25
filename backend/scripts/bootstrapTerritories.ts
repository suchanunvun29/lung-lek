// Phase 12 / Module M bootstrap (Territory KPI Rules item 9): infer each hospital's territory from
// its highest credited-revenue salesperson — only when that person holds exactly ONE active
// territory assignment and the runner-up is below the 30% ambiguity threshold. Everything else is
// left unassigned and flagged for a manager decision; the script never picks for them.
//
// Idempotent: safe to re-run. It never touches hospitals whose territorySource is already MANUAL
// (a manager's explicit call always wins) and simply recomputes INFERRED links otherwise.
//
// Run from backend/: `npx ts-node scripts/bootstrapTerritories.ts`
// Optional dry run first: `npx ts-node --transpile-only scripts/bootstrapTerritories.ts --dry-run`

import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { creditedRevenueByHospital, hasAmbiguousRunnerUp, rankContributors } from "../src/services/hospitalCreditRanking.util";

dotenv.config();

const prisma = new PrismaClient();

function isActiveToday(from: Date, to: Date | null): boolean {
  const now = new Date();
  return from <= now && (to === null || to >= now);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const [hospitals, credits, assignments] = await Promise.all([
    prisma.hospital.findMany({ select: { id: true, nameInFile: true, territoryId: true, territorySource: true } }),
    prisma.salesLineCredit.findMany({
      where: { salesperson: { excludedFromTerritoryTotals: false } },
      select: { salespersonId: true, sharePercent: true, salesLine: { select: { hospitalId: true, total: true } } },
    }),
    prisma.territoryAssignment.findMany({
      where: { salesperson: { excludedFromTerritoryTotals: false } },
      select: { salespersonId: true, territoryId: true, effectiveFrom: true, effectiveTo: true },
    }),
  ]);

  // credited revenue per (hospital, person), exclusion already filtered in the query above
  const revenueByHospitalPerson = creditedRevenueByHospital(credits);

  // active territory ids per person
  const activeTerritoriesByPerson = new Map<string, Set<string>>();
  for (const row of assignments) {
    if (!isActiveToday(row.effectiveFrom, row.effectiveTo)) continue;
    let set = activeTerritoriesByPerson.get(row.salespersonId);
    if (!set) {
      set = new Set();
      activeTerritoriesByPerson.set(row.salespersonId, set);
    }
    set.add(row.territoryId);
  }

  let inferred = 0;
  let keptManual = 0;
  let ambiguousMulti = 0;
  let ambiguousRunnerUp = 0;
  let noRevenue = 0;
  const flags: Array<{ hospital: string; reason: string }> = [];

  for (const hospital of hospitals) {
    if (hospital.territorySource === "MANUAL" && hospital.territoryId) {
      keptManual += 1;
      continue;
    }

    const byPerson = revenueByHospitalPerson.get(hospital.id);
    if (!byPerson || byPerson.size === 0) {
      noRevenue += 1;
      continue;
    }
    const ranked = rankContributors(byPerson);
    if (hasAmbiguousRunnerUp(ranked)) {
      ambiguousRunnerUp += 1;
      flags.push({ hospital: hospital.nameInFile, reason: `อันดับ 2 ทำได้ ${((ranked[1].revenue / ranked[0].revenue) * 100).toFixed(1)}% ของอันดับ 1` });
      continue;
    }
    const territories = [...(activeTerritoriesByPerson.get(ranked[0].salespersonId) ?? [])];
    if (territories.length !== 1) {
      ambiguousMulti += 1;
      flags.push({ hospital: hospital.nameInFile, reason: territories.length === 0 ? "ผู้ขายอันดับ 1 ไม่มีเขต ACTIVE" : "ผู้ขายอันดับ 1 ดูแลหลายเขต" });
      continue;
    }
    if (!dryRun) {
      await prisma.hospital.update({
        where: { id: hospital.id },
        data: { territoryId: territories[0], territorySource: "INFERRED" },
      });
    }
    inferred += 1;
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        totals: { hospitals: hospitals.length, inferred, keptManual, noRevenue, ambiguousMulti, ambiguousRunnerUp },
        flags,
      },
      null,
      1
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
