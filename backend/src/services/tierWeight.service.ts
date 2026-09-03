import { prisma } from "../lib/prisma";

// Module L — TierWeight (น้ำหนักตามระดับโรงพยาบาล). Default is 1.000 for every tier, so day-one
// behaviour equals raw metric sums (Territory & Potential Rules ข้อ 1); the table starts empty and
// rows appear only when a manager overrides a tier.
const DEFAULT_TIER_WEIGHT = "1.000";

export async function getEffectiveTierWeights() {
  const [rows, registries] = await Promise.all([
    prisma.tierWeight.findMany({ orderBy: { tier: "asc" } }),
    prisma.hospitalRegistry.findMany({ where: { tier: { not: null } }, select: { tier: true }, distinct: ["tier"] }),
  ]);
  const customByTier = new Map(rows.map((row) => [row.tier, row]));
  const tiers = [...new Set([...registries.map((registry) => registry.tier as string), ...customByTier.keys()])].sort();
  return tiers.map((tier) => {
    const custom = customByTier.get(tier);
    return {
      tier,
      weight: custom ? custom.weight : DEFAULT_TIER_WEIGHT,
      isCustom: Boolean(custom),
      updatedAt: custom?.updatedAt ?? null,
    };
  });
}

export async function upsertTierWeights(weights: Array<{ tier: string; weight: number }>) {
  await prisma.$transaction(
    weights.map((entry) =>
      prisma.tierWeight.upsert({
        where: { tier: entry.tier },
        create: { tier: entry.tier, weight: entry.weight },
        update: { weight: entry.weight },
      })
    )
  );
  return getEffectiveTierWeights();
}
