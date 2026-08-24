import ExcelJS from "exceljs";
import { Request, Response } from "express";
import {
  buildFullTerritoryRows,
  buildTerritoryGroupRows,
  FullTerritoryKpiRow,
  getTerritoryBuckets,
  SerializedGroupRow,
  SerializedTerritoryKpiRow,
  serializeGroupRows,
  serializeTerritoryRows,
  TerritoryGroupKpiRowData,
} from "../services/territoryKpi.service";
import { SalespersonCompositeEntry, computeActiveSalespersonComposites, computeCompositeScore, teamAverageComposite } from "../services/kpi.service";
import { resolveViewerScope } from "../services/viewerScope.service";
import { resolveViewerTerritoryIds } from "../services/viewerTerritoryScope.service";
import { prisma } from "../lib/prisma";
import { TerritoryLeaderboardQuery } from "../validators/territoryLeaderboard.validators";

// Module F2 (Territory KPI Rules ข้อ 12): every number comes from Module N's service —
// this controller only assembles "target units", orders them and strips fields per viewer.

type Criterion = TerritoryLeaderboardQuery["criteria"];

interface CriterionValue {
  value: number | null;
  computable: boolean;
  reason: string | null;
}

function territoryCriterion(row: FullTerritoryKpiRow, criteria: Criterion): CriterionValue {
  switch (criteria) {
    case "COMPOSITE":
      return row.compositeScore !== null
        ? { value: row.compositeScore, computable: true, reason: null }
        : { value: null, computable: false, reason: row.message ?? "คำนวณไม่ได้" };
    case "PERCENT_TARGET": {
      const metric = row.metrics.find((m) => m.metric === "REVENUE_VS_TARGET");
      return metric?.computable && row.achievementPercent !== null
        ? { value: row.achievementPercent, computable: true, reason: null }
        : { value: null, computable: false, reason: metric?.reason ?? "คำนวณไม่ได้" };
    }
    case "REVENUE":
      // revenue(T) needs no target — always rankable, including 0.
      return { value: row.revenue, computable: true, reason: null };
    case "NEW_CUSTOMERS": {
      const metric = row.metrics.find((m) => m.metric === "NEW_CUSTOMERS");
      const actual = typeof metric?.detail.actual === "number" ? metric.detail.actual : null;
      return metric?.computable && actual !== null
        ? { value: actual, computable: true, reason: null }
        : { value: null, computable: false, reason: metric?.reason ?? "คำนวณไม่ได้" };
    }
  }
}

function groupCriterion(row: TerritoryGroupKpiRowData, fullRows: FullTerritoryKpiRow[], criteria: Criterion): CriterionValue {
  switch (criteria) {
    case "COMPOSITE":
    case "PERCENT_TARGET":
      return row.achievementPercent !== null
        ? { value: criteria === "COMPOSITE" ? row.compositeScore : row.achievementPercent, computable: true, reason: null }
        : { value: null, computable: false, reason: "ยังไม่ได้ตั้งเป้า" };
    case "REVENUE":
      return { value: row.revenue, computable: true, reason: null };
    case "NEW_CUSTOMERS": {
      // NEW_CUSTOMERS has no group-level definition in Territory KPI Rules. The group never ranks
      // on it; the tail reason mirrors the members' own non-computable reason when uniform.
      const memberReasons = new Set(
        fullRows
          .filter((member) => row.memberTerritoryIds.includes(member.territoryId))
          .map((member) => member.metrics.find((m) => m.metric === "NEW_CUSTOMERS")?.reason ?? "คำนวณไม่ได้")
      );
      const [only] = memberReasons;
      return { value: null, computable: false, reason: memberReasons.size === 1 ? only : "คำนวณไม่ได้" };
    }
  }
}

// Standard competition ranking over the chosen criterion (1, 2, 2, 4). Ranking is presentation
// ordering of service-computed values — never a second formula.
function standardCompetitionRanks<T>(rows: T[], valueOf: (row: T) => number | null, setRank: (row: T, rank: number) => void): void {
  const sorted = [...rows].sort((a, b) => (valueOf(b) ?? Number.NEGATIVE_INFINITY) - (valueOf(a) ?? Number.NEGATIVE_INFINITY));
  let previousValue: number | null = null;
  let previousRank = 0;
  sorted.forEach((row, index) => {
    const value = valueOf(row);
    if (value !== null && previousValue === value) setRank(row, previousRank);
    else {
      setRank(row, index + 1);
      previousValue = value;
      previousRank = index + 1;
    }
  });
}

interface LeaderboardUnit {
  unitType: "TERRITORY" | "GROUP";
  id: string;
  name: string;
  ownerNames: string[];
  criterion: CriterionValue;
  rank: number | null; // null for unranked units (tail block)
  serialized: SerializedTerritoryKpiRow | SerializedGroupRow;
  members?: SerializedTerritoryKpiRow[];
}

async function buildUnits(req: Request, q: TerritoryLeaderboardQuery) {
  const visible = await resolveViewerTerritoryIds(req.user!);
  const fullRows = await buildFullTerritoryRows(q);
  const groupRows = await buildTerritoryGroupRows(fullRows, q);

  // Territories effective in a group during P appear as details under the group row, never as
  // their own ranked rows (หน่วยเป้า definition, Territory KPI Rules ข้อ 6).
  const groupedTerritoryIds = new Set(groupRows.flatMap((group) => group.memberTerritoryIds));
  const serializedByTerritoryId = new Map(serializeTerritoryRows(fullRows, visible).map((row) => [row.territoryId, row]));

  const units: LeaderboardUnit[] = [];
  for (const row of fullRows) {
    if (groupedTerritoryIds.has(row.territoryId)) continue;
    units.push({
      unitType: "TERRITORY",
      id: row.territoryId,
      name: row.name,
      ownerNames: row.ownerNames,
      criterion: territoryCriterion(row, q.criteria),
      rank: null,
      serialized: serializedByTerritoryId.get(row.territoryId)!,
    });
  }
  for (const row of groupRows) {
    units.push({
      unitType: "GROUP",
      id: row.territoryId,
      name: `${row.name} (กลุ่มเขต)`,
      ownerNames: row.ownerNames,
      criterion: groupCriterion(row, fullRows, q.criteria),
      rank: null,
      serialized: serializeGroupRows([row], visible)[0],
      members: serializeTerritoryRows(
        fullRows.filter((member) => row.memberTerritoryIds.includes(member.territoryId)),
        visible
      ),
    });
  }

  const ranked = units.filter((unit) => unit.criterion.computable);
  standardCompetitionRanks(ranked, (unit) => unit.criterion.value, (unit, rank) => { unit.rank = rank; });
  const unranked = units.filter((unit) => !unit.criterion.computable).sort((a, b) => a.name.localeCompare(b.name, "th"));
  return { ranked, unranked, buckets: req.user!.role === "MANAGER" ? await getTerritoryBuckets(q) : null };
}

function serializeUnit(unit: LeaderboardUnit) {
  // Data Visibility Rules ข้อ 6: the whitelist is absolute for restricted rows — the chosen
  // criterion's value/reason must never leak through the leaderboard either.
  if (unit.serialized.visibility === "TERRITORY_FULL") {
    return { ...unit.serialized, unitType: unit.unitType, rank: unit.rank, criterionReason: unit.criterion.reason, ...(unit.members ? { members: unit.members } : {}) };
  }
  const { visibility, territoryId, name, ownerNames, compositeScore, computedMetricLabel } = unit.serialized;
  return { visibility, unitType: unit.unitType, territoryId, name, ownerNames, rank: unit.rank, compositeScore, computedMetricLabel, ...(unit.members ? { members: unit.members } : {}) };
}

export async function getTerritoryLeaderboard(req: Request, res: Response) {
  const q = req.query as unknown as TerritoryLeaderboardQuery;
  const { ranked, unranked, buckets } = await buildUnits(req, q);
  res.json({
    criteria: q.criteria,
    period: q,
    ranked: ranked.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)).map(serializeUnit),
    unranked: unranked.map(serializeUnit),
    ...(buckets ? { buckets } : {}),
  });
}

export async function exportTerritoryLeaderboard(req: Request, res: Response) {
  const q = req.query as unknown as TerritoryLeaderboardQuery;
  const { ranked, unranked, buckets } = await buildUnits(req, q);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Leaderboard");
  sheet.columns = [
    { header: "หน่วยเป้า", key: "name", width: 30 },
    { header: "ผู้ดูแล", key: "owners", width: 28 },
    { header: "อันดับ", key: "rank", width: 8 },
    { header: "คะแนนรวม", key: "score", width: 12 },
    { header: "คิดจาก", key: "label", width: 22 },
    { header: "ยอดขาย", key: "revenue", width: 16 },
    { header: "เป้า", key: "target", width: 16 },
    { header: "% ถึงเป้า", key: "achievement", width: 12 },
    { header: "เกณฑ์ที่ใช้จัดอันดับ", key: "criteria", width: 18 },
  ];
  // Export parity (Data Visibility Rules ข้อ 4/6): the file is written FROM the same serialized
  // rows the screen gets — restricted units contribute whitelist columns only.
  const writeRow = (unit: ReturnType<typeof serializeUnit>, indent: boolean) => {
    if (unit.visibility === "TERRITORY_FULL") {
      const money = "revenue" in unit ? unit : null;
      const achievement = money && money.achievementPercent !== null ? money.achievementPercent : undefined;
      const target = money && "targetLabel" in money && money.targetLabel ? money.targetLabel : money && "revenueTarget" in money && money.revenueTarget !== null ? money.revenueTarget : money && "target" in money && money.target !== null ? money.target : undefined;
      sheet.addRow({
        name: indent ? `— ${unit.name}` : unit.name,
        owners: unit.ownerNames.join(", "),
        rank: unit.rank ?? "",
        score: unit.compositeScore,
        label: unit.computedMetricLabel,
        revenue: money ? money.revenue : undefined,
        target,
        achievement,
        criteria: q.criteria,
      });
    } else {
      sheet.addRow({ name: indent ? `— ${unit.name}` : unit.name, owners: unit.ownerNames.join(", "), rank: unit.rank ?? "", score: unit.compositeScore, label: unit.computedMetricLabel, criteria: q.criteria });
    }
  };
  for (const unit of ranked.map(serializeUnit)) {
    writeRow(unit, false);
    for (const member of unit.members ?? []) {
      if (member.visibility === "TERRITORY_FULL") {
        sheet.addRow({ name: `· ${member.name}`, owners: member.ownerNames.join(", "), rank: "", score: member.compositeScore, label: member.computedMetricLabel, revenue: member.revenue, target: member.targetLabel ?? member.target ?? undefined, achievement: member.achievementPercent ?? undefined });
      } else {
        sheet.addRow({ name: `· ${member.name}`, owners: member.ownerNames.join(", "), score: member.compositeScore, label: member.computedMetricLabel });
      }
    }
  }
  for (const unit of unranked.map(serializeUnit)) {
    writeRow(unit, false);
  }
  // Bucket blocks are MANAGER-only in the payload, so they can only land in the manager's file.
  if (buckets) {
    const personalTargets = buckets.personalBucketEntries.reduce((sum, entry) => sum + entry.personalTarget, 0);
    sheet.addRow({
      name: "personalBucket",
      owners: buckets.personalBucketEntries.map((entry) => entry.displayName).join(", ") || "—",
      score: "",
      label: "",
      revenue: buckets.personalBucket,
      ...(personalTargets > 0 ? { target: personalTargets, achievement: buckets.personalBucket / personalTargets * 100 } : {}),
    });
    sheet.addRow({ name: "unassignedBucket", owners: `ไม่มีเขต ${buckets.unassignedHospitalCount} โรงพยาบาล`, revenue: buckets.unassignedBucket });
  }
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="leaderboard-${q.criteria}-${q.periodType}-${q.year}-${q.periodNumber}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

// ---------- Tier 2 — people within one territory ----------

function personCriterion(entry: SalespersonCompositeEntry, criteria: Criterion): CriterionValue {
  const result = entry.result;
  switch (criteria) {
    case "COMPOSITE":
      return result.composite !== null
        ? { value: result.composite, computable: true, reason: null }
        : { value: null, computable: false, reason: result.message ?? "คำนวณไม่ได้" };
    case "PERCENT_TARGET":
    case "REVENUE": {
      const metric = result.metrics.find((m) => m.metric === "REVENUE_VS_TARGET");
      const actual = typeof metric?.detail.actual === "number" ? metric.detail.actual : null;
      const target = typeof metric?.detail.target === "number" ? metric.detail.target : null;
      if (!metric?.computable || actual === null || target === null) return { value: null, computable: false, reason: metric?.reason ?? "คำนวณไม่ได้" };
      return criteria === "REVENUE"
        ? { value: actual, computable: true, reason: null }
        : { value: actual / target * 100, computable: true, reason: null };
    }
    case "NEW_CUSTOMERS": {
      const metric = result.metrics.find((m) => m.metric === "NEW_CUSTOMERS");
      const actual = typeof metric?.detail.actual === "number" ? metric.detail.actual : null;
      return metric?.computable && actual !== null
        ? { value: actual, computable: true, reason: null }
        : { value: null, computable: false, reason: metric?.reason ?? "คำนวณไม่ได้" };
    }
  }
}

export async function getTerritoryPeople(req: Request, res: Response) {
  const q = req.query as unknown as TerritoryLeaderboardQuery;
  const scope = await resolveViewerScope(req.user!);
  const territoryId = req.params.territoryId;

  // Tier-2 drill-down permissions (Data Visibility Rules ข้อ 3): MANAGER anywhere, supervisor on
  // their supervised territories only. Rights are "as of today" (ข้อ 2).
  if (scope.canSeeEveryone || scope.supervisedTerritoryIds.includes(territoryId)) {
    const people = await prisma.territoryAssignment.findMany({
      where: { territoryId, effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }] },
      include: { salesperson: { select: { id: true, displayName: true } } },
      orderBy: { effectiveFrom: "asc" },
    });
    // Tier-2 numbers are Phase 4's own person-level KPI (Territory KPI Rules ข้อ 12) — the same
    // computeCompositeScore the dashboard uses, never a territory-total divided by people.
    const results = await Promise.all(people.map(async (assignment) => ({
      salesperson: assignment.salesperson,
      composite: await computeCompositeScore(assignment.salespersonId, q),
    })));
    return res.json({ mode: "FULL", results });
  }

  if (!scope.selfSalespersonId) return res.status(403).json({ error: "Forbidden" });
  const selfAssignment = await prisma.territoryAssignment.findFirst({
    where: { territoryId, salespersonId: scope.selfSalespersonId, effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }] },
  });
  if (!selfAssignment) return res.status(403).json({ error: "Forbidden" });

  // Data Visibility Rules ข้อ 7: exactly { rank, totalRanked, ownValue, teamAverage } — nobody
  // else's rows leave the server. teamAverage is Phase 4's original team-average function.
  const entries = await computeActiveSalespersonComposites(q);
  const values = new Map(entries.map((entry) => [entry.salespersonId, personCriterion(entry, q.criteria)]));
  const myCriterion = values.get(scope.selfSalespersonId)!;
  const computableValues = [...values.values()].filter((criterion) => criterion.computable).map((criterion) => criterion.value!);
  const betterCount = myCriterion.computable
    ? [...values.values()].filter((criterion) => criterion.computable && (criterion.value ?? 0) > (myCriterion.value ?? 0)).length
    : 0;
  return res.json({
    mode: "SELF_SUMMARY",
    criteria: q.criteria,
    rank: myCriterion.computable ? betterCount + 1 : null,
    totalRanked: computableValues.length,
    ownValue: myCriterion.value,
    ownComputable: myCriterion.computable,
    reason: myCriterion.reason,
    teamAverage: teamAverageComposite(entries),
  });
}
