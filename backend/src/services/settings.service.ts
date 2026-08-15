import { KpiMetric } from "@prisma/client";
import { prisma } from "../lib/prisma";

interface WeightInput {
  metric: KpiMetric;
  weight: number;
}

export async function updateScoringWeights(weights: WeightInput[], changedById: string, note: string | null | undefined) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.scoringWeight.findMany({ orderBy: { metric: "asc" } });

    for (const w of weights) {
      await tx.scoringWeight.update({ where: { metric: w.metric }, data: { weight: w.weight } });
    }

    const after = await tx.scoringWeight.findMany({ orderBy: { metric: "asc" } });

    await tx.scoringWeightRevision.create({
      data: {
        before: before.map((w) => ({ metric: w.metric, weight: w.weight })),
        after: after.map((w) => ({ metric: w.metric, weight: w.weight })),
        changedById,
        note: note ?? null,
      },
    });

    return after;
  });
}
