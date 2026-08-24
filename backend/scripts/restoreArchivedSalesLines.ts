import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ArchivePayload {
  salesLine: {
    id: string;
    invoiceNo: string;
    poNo: string | null;
    invoiceDate: string;
    year: number;
    month: number;
    hospitalId: string;
    salespersonId: string;
    productId: string;
    productTypeId: string;
    lot: string | null;
    expiryDate: string | null;
    province: string | null;
    qty: string;
    unitPrice: string;
    amount: string;
    vat: string;
    total: string;
    rowKey: string;
    sourceSheetName: string;
    sourceRowNumber: number;
    importBatchId: string;
  };
  credits: {
    id: string;
    salespersonId: string;
    sharePercent: string;
    isPrimary: boolean;
  }[];
}

function parsePayload(payload: Prisma.JsonValue): ArchivePayload {
  return payload as unknown as ArchivePayload;
}

async function main() {
  const removedByBatchId = process.argv[2];
  if (!removedByBatchId) {
    throw new Error("Usage: npx ts-node scripts/restoreArchivedSalesLines.ts <removedByBatchId>");
  }
  const archives = await prisma.salesLineArchive.findMany({ where: { removedByBatchId }, orderBy: { removedAt: "asc" } });
  if (archives.length === 0) throw new Error("No archived sales lines found for the supplied batch id");

  let restored = 0;
  let alreadyPresent = 0;

  await prisma.$transaction(async (tx) => {
    for (const archive of archives) {
      const existing = await tx.salesLine.findFirst({
        where: { OR: [{ id: archive.salesLineId }, { rowKey: archive.rowKey }] },
        select: { id: true },
      });
      if (existing) {
        alreadyPresent++;
        continue;
      }
      const { salesLine, credits } = parsePayload(archive.payload);
      await tx.salesLine.create({
        data: {
          id: salesLine.id,
          invoiceNo: salesLine.invoiceNo,
          poNo: salesLine.poNo,
          invoiceDate: new Date(salesLine.invoiceDate),
          year: salesLine.year,
          month: salesLine.month,
          hospitalId: salesLine.hospitalId,
          salespersonId: salesLine.salespersonId,
          productId: salesLine.productId,
          productTypeId: salesLine.productTypeId,
          lot: salesLine.lot,
          expiryDate: salesLine.expiryDate ? new Date(salesLine.expiryDate) : null,
          province: salesLine.province,
          qty: salesLine.qty,
          unitPrice: salesLine.unitPrice,
          amount: salesLine.amount,
          vat: salesLine.vat,
          total: salesLine.total,
          rowKey: salesLine.rowKey,
          sourceSheetName: salesLine.sourceSheetName,
          sourceRowNumber: salesLine.sourceRowNumber,
          importBatchId: salesLine.importBatchId,
        },
      });
      await tx.salesLineCredit.createMany({
        data: credits.map((credit) => ({
          id: credit.id,
          salesLineId: salesLine.id,
          salespersonId: credit.salespersonId,
          sharePercent: credit.sharePercent,
          isPrimary: credit.isPrimary,
        })),
      });
      restored++;
    }
  });
  console.log(`Restored ${restored} archived SalesLine row(s)${alreadyPresent > 0 ? ` — skipped ${alreadyPresent} already present` : ""}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
