// One-off backfill for Module J: every pre-existing SalesLine (846 rows, all single-salesperson
// deals) needs exactly one SalesLineCredit row at sharePercent = 100 / isPrimary = true, because
// SalesLineCredit is now the only source KPI/reporting queries read from (design.md, KPI &
// Scoring Rules). Run once, before the updated import service starts writing real credits for
// new files, from backend/: `npx ts-node scripts/backfillSalesLineCredits.ts`.
//
// Idempotent: skips any SalesLine that already has at least one SalesLineCredit row.
// Reversible: `--revert` deletes only credit rows matching the exact backfill signature (single
// credit row per SalesLine, sharePercent = 100, isPrimary = true, salespersonId ===
// SalesLine.salespersonId). This only safely undoes the backfill itself — run it before any real
// shared-credit import lands, since a genuine single-salesperson deal produces the same shape.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FULL_SHARE_PERCENT = "100.000";
const BATCH_SIZE = 200;

async function backfill(): Promise<void> {
  let created = 0;
  let skipped = 0;
  let cursor: string | undefined;

  for (;;) {
    const salesLines = await prisma.salesLine.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true, salespersonId: true, credits: { select: { id: true }, take: 1 } },
    });
    if (salesLines.length === 0) break;

    for (const line of salesLines) {
      if (line.credits.length > 0) {
        skipped++;
        continue;
      }
      await prisma.salesLineCredit.create({
        data: {
          salesLineId: line.id,
          salespersonId: line.salespersonId,
          sharePercent: FULL_SHARE_PERCENT,
          isPrimary: true,
        },
      });
      created++;
    }

    cursor = salesLines[salesLines.length - 1].id;
    if (salesLines.length < BATCH_SIZE) break;
  }

  console.log(`Backfill complete. Created ${created} SalesLineCredit row(s), skipped ${skipped} already-backfilled SalesLine row(s).`);
}

async function revert(): Promise<void> {
  const candidates = await prisma.salesLineCredit.findMany({
    where: { isPrimary: true, sharePercent: FULL_SHARE_PERCENT },
    select: { id: true, salesLineId: true, salespersonId: true },
  });

  let deleted = 0;
  for (const credit of candidates) {
    const siblingCount = await prisma.salesLineCredit.count({ where: { salesLineId: credit.salesLineId } });
    if (siblingCount !== 1) continue;

    const salesLine = await prisma.salesLine.findUnique({
      where: { id: credit.salesLineId },
      select: { salespersonId: true },
    });
    if (!salesLine || salesLine.salespersonId !== credit.salespersonId) continue;

    await prisma.salesLineCredit.delete({ where: { id: credit.id } });
    deleted++;
  }

  console.log(`Revert complete. Deleted ${deleted} backfilled SalesLineCredit row(s).`);
}

async function main(): Promise<void> {
  const isRevert = process.argv.includes("--revert");
  if (isRevert) {
    await revert();
  } else {
    await backfill();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
