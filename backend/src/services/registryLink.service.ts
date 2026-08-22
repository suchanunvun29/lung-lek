import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { latinCore, thaiCore } from "./nameNormalizer.util";

type RegistryCandidate = { id: string; nameInFile: string; displayName: string; provinceMappingId: string | null };

function candidatesForHospital(
  hospital: { nameInFile: string; displayName: string; provinceMappingId: string | null },
  registries: RegistryCandidate[]
) {
  const sameProvince = registries.filter((registry) => !hospital.provinceMappingId || registry.provinceMappingId === hospital.provinceMappingId);
  const exact = sameProvince.filter((registry) => registry.nameInFile === hospital.nameInFile || registry.displayName === hospital.displayName);
  if (exact.length === 1) return { registry: exact[0], method: "EXACT" as const };

  const hospitalName = hospital.displayName || hospital.nameInFile;
  const hospitalThai = thaiCore(hospitalName);
  const hospitalLatin = latinCore(hospitalName);
  const normalized = sameProvince.filter((registry) => {
    const registryName = registry.displayName || registry.nameInFile;
    return (hospitalThai.length > 0 && thaiCore(registryName) === hospitalThai) || (hospitalLatin.length > 0 && latinCore(registryName) === hospitalLatin);
  });
  return normalized.length === 1 ? { registry: normalized[0], method: "NORMALIZED" as const } : null;
}

export async function linkHospitalsToRegistry() {
  const [hospitals, registries] = await Promise.all([
    prisma.hospital.findMany({ include: { registryLink: true }, orderBy: { id: "asc" } }),
    prisma.hospitalRegistry.findMany({ select: { id: true, nameInFile: true, displayName: true, provinceMappingId: true } }),
  ]);
  let linked = 0;
  let unreviewed = 0;
  for (const hospital of hospitals) {
    if (hospital.registryLink?.method === "MANUAL" || hospital.registryLink?.status === "CONFIRMED_ABSENT") continue;
    const match = candidatesForHospital(hospital, registries);
    if (!match) {
      if (!hospital.registryLink) {
        await prisma.hospitalRegistryLink.create({ data: { hospitalId: hospital.id, status: "UNREVIEWED" } });
        unreviewed++;
      }
      continue;
    }
    await prisma.hospitalRegistryLink.upsert({
      where: { hospitalId: hospital.id },
      create: { hospitalId: hospital.id, hospitalRegistryId: match.registry.id, status: "LINKED", method: match.method, confidence: new Prisma.Decimal(1) },
      update: { hospitalRegistryId: match.registry.id, status: "LINKED", method: match.method, confidence: new Prisma.Decimal(1), reviewedById: null, reviewedAt: null },
    });
    linked++;
  }
  return { linked, unreviewed };
}
