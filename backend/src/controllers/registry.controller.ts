import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { UpdatePotentialAdjustmentInput, UpdateProvinceInput, UpdateRegistryLinkInput } from "../validators/registry.validators";
import { importRegistry } from "../services/registryImport.service";

export async function uploadRegistry(req: Request, res: Response) {
  if (!req.file) return res.status(400).json({ error: "File is required" });
  const result = await importRegistry(req.file.buffer, req.file.originalname, req.file.size, req.user!.id);
  return res.status(201).json(result);
}

export async function listProvinces(_req: Request, res: Response) {
  const [provinces, regions] = await Promise.all([
    prisma.provinceMapping.findMany({ include: { region: true }, orderBy: { canonicalName: "asc" } }),
    prisma.region.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  res.json({ provinces, regions });
}

export async function updateProvince(req: Request, res: Response) {
  const province = await prisma.provinceMapping.findUnique({ where: { id: req.params.id } });
  if (!province) return res.status(404).json({ error: "Province not found" });

  const input = req.body as UpdateProvinceInput;
  if (input.regionId && !(await prisma.region.findUnique({ where: { id: input.regionId } }))) {
    return res.status(404).json({ error: "Region not found" });
  }

  const updated = await prisma.provinceMapping.update({
    where: { id: province.id },
    data: input,
    include: { region: true },
  });
  return res.json({ province: updated });
}

export async function updatePotentialAdjustment(req: Request, res: Response) {
  const registry = await prisma.hospitalRegistry.findUnique({ where: { id: req.params.id } });
  if (!registry) return res.status(404).json({ error: "Hospital registry not found" });

  const { potentialAdjustment } = req.body as UpdatePotentialAdjustmentInput;
  // requirement 10.5 — per-hospital exemption/reduction; 0 removes it from potential entirely.
  const updated = await prisma.hospitalRegistry.update({
    where: { id: registry.id },
    data: { potentialAdjustment },
    select: { id: true, displayName: true, tier: true, potentialAdjustment: true, updatedAt: true },
  });
  return res.json({ hospitalRegistry: updated });
}

export async function listRegistryLinks(req: Request, res: Response) {
  const status = req.query.status as "UNREVIEWED" | "LINKED" | "CONFIRMED_ABSENT" | undefined;
  const hospitalRegistryLinks = await prisma.hospitalRegistryLink.findMany({
    where: status ? { status } : undefined,
    include: {
      hospital: { select: { id: true, displayName: true, province: true, provinceMapping: { include: { region: true } } } },
      hospitalRegistry: { include: { provinceMapping: { include: { region: true } }, territory: true } },
      reviewedBy: { select: { id: true, displayName: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  res.json({ hospitalRegistryLinks });
}

export async function listHospitalRegistries(req: Request, res: Response) {
  const { q, provinceMappingId, territoryId, page, pageSize } = req.query as unknown as {
    q?: string; provinceMappingId?: string; territoryId?: string; page: number; pageSize: number;
  };
  const where = {
    ...(q ? { OR: [{ displayName: { contains: q, mode: "insensitive" as const } }, { sourceCode: { contains: q, mode: "insensitive" as const } }] } : {}),
    ...(provinceMappingId ? { provinceMappingId } : {}),
    ...(territoryId ? { territoryId } : {}),
  };
  const [total, hospitalRegistries] = await Promise.all([
    prisma.hospitalRegistry.count({ where }),
    prisma.hospitalRegistry.findMany({
      where,
      include: { provinceMapping: { include: { region: true } }, territory: true, metrics: true },
      orderBy: { displayName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  res.json({ hospitalRegistries, total, page, pageSize });
}

export async function updateRegistryLink(req: Request, res: Response) {
  const hospital = await prisma.hospital.findUnique({ where: { id: req.params.hospitalId } });
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });

  const input = req.body as UpdateRegistryLinkInput;
  if (input.status === "LINKED" && input.hospitalRegistryId) {
    const registry = await prisma.hospitalRegistry.findUnique({ where: { id: input.hospitalRegistryId } });
    if (!registry) return res.status(404).json({ error: "Hospital registry not found" });
  }

  const hospitalRegistryLink = await prisma.hospitalRegistryLink.upsert({
    where: { hospitalId: hospital.id },
    create: {
      hospitalId: hospital.id,
      hospitalRegistryId: input.status === "LINKED" ? input.hospitalRegistryId : null,
      status: input.status,
      method: "MANUAL",
      confidence: input.status === "LINKED" ? 1 : null,
      reviewedById: req.user!.id,
      reviewedAt: new Date(),
      note: input.note ?? null,
    },
    update: {
      hospitalRegistryId: input.status === "LINKED" ? input.hospitalRegistryId : null,
      status: input.status,
      method: "MANUAL",
      confidence: input.status === "LINKED" ? 1 : null,
      reviewedById: req.user!.id,
      reviewedAt: new Date(),
      note: input.note ?? null,
    },
    include: {
      hospital: { select: { id: true, displayName: true, province: true } },
      hospitalRegistry: true,
      reviewedBy: { select: { id: true, displayName: true } },
    },
  });
  return res.json({ hospitalRegistryLink });
}
