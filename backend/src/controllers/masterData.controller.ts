import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { resolveViewerScope, visibleSalespersonIds } from "../services/viewerScope.service";
import { UpdateHospitalInput, UpdateSalespersonInput } from "../validators/masterData.validators";

export async function listHospitals(_req: Request, res: Response) {
  const hospitals = await prisma.hospital.findMany({ orderBy: { displayName: "asc" } });
  res.json({ hospitals });
}

export async function updateHospital(req: Request, res: Response) {
  const { id } = req.params;
  const { isPreExistingCustomer } = req.body as UpdateHospitalInput;

  const hospital = await prisma.hospital.findUnique({ where: { id } });
  if (!hospital) {
    return res.status(404).json({ error: "Hospital not found" });
  }

  const updated = await prisma.hospital.update({ where: { id }, data: { isPreExistingCustomer } });
  res.json({ hospital: updated });
}

export async function listProductTypes(_req: Request, res: Response) {
  const productTypes = await prisma.productType.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  res.json({ productTypes });
}

export async function listSalespeople(req: Request, res: Response) {
  // Data Visibility Rules ข้อ 4 — list-of-people endpoints filter in the query layer
  // via the single viewerScope resolver (Module Q); MANAGER sees everyone.
  const scope = await resolveViewerScope(req.user!);
  const ids = await visibleSalespersonIds(scope);
  const salespeople = await prisma.salesperson.findMany({
    where: ids === null ? {} : { id: { in: ids } },
    orderBy: { displayName: "asc" },
    include: { user: { select: { id: true, email: true, displayName: true } } },
  });
  res.json({ salespeople });
}

export async function updateSalesperson(req: Request, res: Response) {
  const { id } = req.params;
  const { userId, employmentEndedAt } = req.body as UpdateSalespersonInput;

  const salesperson = await prisma.salesperson.findUnique({ where: { id } });
  if (!salesperson) {
    return res.status(404).json({ error: "Salesperson not found" });
  }

  const data: { userId?: string | null; employmentEndedAt?: Date | null } = {};
  if (userId !== undefined) {
    if (userId !== null) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const linkedSalesperson = await prisma.salesperson.findUnique({ where: { userId } });
      if (linkedSalesperson && linkedSalesperson.id !== id) {
        return res.status(409).json({ error: "This user is already linked to another salesperson" });
      }
    }
    data.userId = userId;
  }
  if (employmentEndedAt !== undefined) {
    data.employmentEndedAt = employmentEndedAt === null ? null : new Date(employmentEndedAt);
  }

  const updated = await prisma.salesperson.update({
    where: { id },
    data,
    include: { user: { select: { id: true, email: true, displayName: true } } },
  });
  res.json({ salesperson: updated });
}
