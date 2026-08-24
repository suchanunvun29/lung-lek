import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import {
  ImportInProgressError,
  PeriodOutOfScopeError,
  deleteSalesPeriods,
  importSalesFile,
} from "../services/import.service";
import { ImportConfirmQuery, ImportRequest, PeriodDeleteRequest, SalesLinesQuery } from "../validators/import.validators";

export async function uploadImport(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: "File is required (field name: file)" });
  }

  try {
    const result = await importSalesFile({
      fileBuffer: req.file.buffer,
      fileName: req.file.originalname,
      fileSizeBytes: req.file.size,
      uploadedById: req.user!.id,
      ...(req.body as ImportRequest),
      ...(req.query as unknown as ImportConfirmQuery),
    });
    return res.status(result.dryRun ? 200 : 201).json(result);
  } catch (error) {
    if (error instanceof ImportInProgressError) {
      return res.status(409).json({ error: "Import already in progress", code: "IMPORT_IN_PROGRESS" });
    }
    if (error instanceof PeriodOutOfScopeError) {
      return res.status(400).json({
        error: "ไฟล์มีแถวของงวดอื่นนอกเหนือจากงวดที่เลือก — ยกเลิกทั้งไฟล์",
        code: "PERIOD_OUT_OF_SCOPE",
      });
    }
    throw error;
  }
}

export async function periodDelete(req: Request, res: Response) {
  try {
    const result = await deleteSalesPeriods({
      uploadedById: req.user!.id,
      ...(req.body as PeriodDeleteRequest),
      ...(req.query as unknown as ImportConfirmQuery),
    });
    return res.status(result.dryRun ? 200 : 201).json(result);
  } catch (error) {
    if (error instanceof ImportInProgressError) {
      return res.status(409).json({ error: "Import already in progress", code: "IMPORT_IN_PROGRESS" });
    }
    throw error;
  }
}

export async function listImportBatches(_req: Request, res: Response) {
  const batches = await prisma.importBatch.findMany({
    orderBy: { startedAt: "desc" },
    include: { uploadedBy: { select: { id: true, displayName: true, email: true } } },
  });
  res.json({ importBatches: batches });
}

export async function getImportBatch(req: Request, res: Response) {
  const { id } = req.params;
  const batch = await prisma.importBatch.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { id: true, displayName: true, email: true } },
      issues: true,
    },
  });
  if (!batch) {
    return res.status(404).json({ error: "Import batch not found" });
  }
  res.json({ importBatch: batch });
}

export async function listSalesLines(req: Request, res: Response) {
  const { salespersonId, hospitalId, productTypeId, year, month, page, pageSize } = req.query as unknown as SalesLinesQuery;

  const where = {
    ...(salespersonId ? { salespersonId } : {}),
    ...(hospitalId ? { hospitalId } : {}),
    ...(productTypeId ? { productTypeId } : {}),
    ...(year ? { year } : {}),
    ...(month ? { month } : {}),
  };

  const [total, salesLines] = await Promise.all([
    prisma.salesLine.count({ where }),
    prisma.salesLine.findMany({
      where,
      orderBy: { invoiceDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        hospital: { select: { id: true, displayName: true } },
        salesperson: { select: { id: true, displayName: true } },
        product: { select: { id: true, name: true } },
        productType: { select: { id: true, name: true } },
      },
    }),
  ]);

  res.json({ data: salesLines, total, page, pageSize });
}
