import { prisma } from "../lib/prisma";

export function normalizeProvince(value: string): string {
  return value.normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, "").toUpperCase();
}

export async function resolveProvinceMapping(rawProvince: string) {
  const normalizedProvince = normalizeProvince(rawProvince);
  if (!normalizedProvince) return null;

  return prisma.provinceMapping.findFirst({
    where: {
      OR: [
        { canonicalName: rawProvince.trim() },
        { aliases: { some: { normalizedAlias: normalizedProvince } } },
      ],
    },
    include: { region: true },
  });
}
