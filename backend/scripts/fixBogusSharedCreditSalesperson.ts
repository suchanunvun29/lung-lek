// One-off fix for the bogus Salesperson record created before Module J's import-logic fix: any
// Salesperson whose nameInFile is actually multiple people's names joined by the shared-credit
// delimiter (e.g. "Mr.Chokechai/Miss Chidchanok") — the pre-Module-J import didn't know how to
// split that cell, so it created a fake "person" instead of splitting credit between the real
// two salespeople. requirement.md 1.1 confirms the split is 50/50 (splitEqualShares' default) for
// every deal these two did together.
//
// For each bogus Salesperson found:
//   1. splitSharedSalesmanNames() the nameInFile into sub-names.
//   2. Resolve each sub-name to a real Salesperson via personCore — both must already exist as
//      separate records, or the whole run stops (no guessing).
//   3. Create-or-reuse a SalesmanNameRule (+ members) for this name combination with equal
//      shares, so a future import of the same raw cell resolves via the rule immediately.
//   4. For every SalesLine currently pointing at the bogus Salesperson: delete its 100%
//      SalesLineCredit row, create one SalesLineCredit per real member with equal shares, and
//      repoint SalesLine.salespersonId at the first-listed (primary) member.
//   5. Delete the bogus Salesperson record.
//
// Everything runs in one transaction. Idempotent: a second run finds no Salesperson left with a
// multi-name nameInFile and does nothing. Reversible: writes a JSON backup with the deleted
// Salesperson row, the original SalesLine.salespersonId values, and the original
// SalesLineCredit rows; run with `--revert=<backup file>` to undo.
//
// Run once from backend/: `npx ts-node scripts/fixBogusSharedCreditSalesperson.ts`

import * as fs from "fs";
import * as path from "path";
import { Prisma, PrismaClient } from "@prisma/client";
import { personCore, splitSharedSalesmanNames, normalizeSharedSalesmanRaw } from "../src/services/nameNormalizer.util";
import { splitEqualShares } from "../src/services/creditResolution.service";

const prisma = new PrismaClient();

// Short first-name-only forms found inside bogus multi-name nameInFile values that personCore
// can't resolve on its own (the real Salesperson record has a surname, the bogus record's
// sub-name doesn't). Confirmed by the user for this specific pair — see plan.md handoff notes.
const KNOWN_SHORT_NAME_MAP: Record<string, string> = {
  "Mr.Chokechai": "Mr.Chokechai Tangsangkharom",
  "Miss Chidchanok": "Miss Chidchanok Seethong",
};

interface FixBackup {
  bogusSalesperson: Prisma.SalespersonGetPayload<Record<string, never>>;
  originalSalesLines: { id: string; salespersonId: string }[];
  originalCredits: Prisma.SalesLineCreditGetPayload<Record<string, never>>[];
  ruleCreatedId: string | null; // set only if this run created the rule (nothing to revert if reused)
}

async function fixBogusSalesperson(
  bogus: { id: string; nameInFile: string },
  backups: FixBackup[]
): Promise<void> {
  const subNames = splitSharedSalesmanNames(bogus.nameInFile);
  if (subNames.length <= 1) {
    console.warn(`Skipping ${JSON.stringify(bogus.nameInFile)} — no shared-credit delimiter found after split.`);
    return;
  }

  const realMembers = await prisma.salesperson.findMany({
    where: { nameInFile: { not: bogus.nameInFile } },
    select: { id: true, nameInFile: true },
  });
  const byNameInFile = new Map(realMembers.map((sp) => [sp.nameInFile, sp.id]));
  const byPersonCore = new Map(realMembers.map((sp) => [personCore(sp.nameInFile), sp.id]));

  const resolvedIds = subNames.map((name) => {
    const knownFullName = KNOWN_SHORT_NAME_MAP[name];
    if (knownFullName) return byNameInFile.get(knownFullName) ?? null;
    return byPersonCore.get(personCore(name)) ?? null;
  });
  const unresolved = subNames.filter((_, i) => resolvedIds[i] === null);
  if (unresolved.length > 0) {
    console.warn(
      `Stopping — could not resolve all sub-names of ${JSON.stringify(bogus.nameInFile)} to existing Salesperson records. ` +
        `Unresolved: ${unresolved.join(", ")}. Not touching this record.`
    );
    return;
  }
  const memberIds = resolvedIds as string[];

  const normalizedRaw = normalizeSharedSalesmanRaw(subNames);
  const shares = splitEqualShares(memberIds.length);

  const affectedSalesLines = await prisma.salesLine.findMany({
    where: { salespersonId: bogus.id },
    select: { id: true, salespersonId: true },
  });
  const affectedSalesLineIds = affectedSalesLines.map((l) => l.id);
  const originalCredits = await prisma.salesLineCredit.findMany({
    where: { salesLineId: { in: affectedSalesLineIds } },
  });

  let ruleCreatedId: string | null = null;

  await prisma.$transaction(
    async (tx) => {
      let rule = await tx.salesmanNameRule.findUnique({ where: { normalizedRaw }, include: { members: true } });
      if (!rule) {
        rule = await tx.salesmanNameRule.create({
          data: {
            normalizedRaw,
            sampleRaw: bogus.nameInFile,
            members: { create: memberIds.map((salespersonId, i) => ({ salespersonId, sharePercent: shares[i] })) },
          },
          include: { members: true },
        });
        ruleCreatedId = rule.id;
      }

      const primarySalespersonId = memberIds[0];

      for (const line of affectedSalesLines) {
        await tx.salesLineCredit.deleteMany({ where: { salesLineId: line.id } });
        await tx.salesLineCredit.createMany({
          data: memberIds.map((salespersonId, i) => ({
            salesLineId: line.id,
            salespersonId,
            sharePercent: shares[i],
            isPrimary: salespersonId === primarySalespersonId,
          })),
        });
        await tx.salesLine.update({ where: { id: line.id }, data: { salespersonId: primarySalespersonId } });
      }

      await tx.salesperson.delete({ where: { id: bogus.id } });
    },
    { timeout: 30_000 }
  );

  backups.push({
    bogusSalesperson: bogus as Prisma.SalespersonGetPayload<Record<string, never>>,
    originalSalesLines: affectedSalesLines,
    originalCredits,
    ruleCreatedId,
  });

  console.log(
    `Fixed ${JSON.stringify(bogus.nameInFile)} -> [${subNames.join(", ")}] ` +
      `(${affectedSalesLines.length} SalesLine rows repointed, equal-share SalesLineCredit rows created, ` +
      `SalesmanNameRule ${describeRule(ruleCreatedId, normalizedRaw)}).`
  );
}

function describeRule(createdId: string | null, normalizedRaw: string): string {
  return createdId ? `created (${createdId})` : `reused (existing rule for ${normalizedRaw})`;
}

async function run(): Promise<void> {
  const bogusCandidates = (await prisma.salesperson.findMany({ select: { id: true, nameInFile: true } })).filter(
    (sp) => splitSharedSalesmanNames(sp.nameInFile).length > 1
  );

  if (bogusCandidates.length === 0) {
    console.log("No Salesperson records with a multi-name nameInFile found — nothing to fix.");
    return;
  }

  const backups: FixBackup[] = [];
  for (const bogus of bogusCandidates) {
    await fixBogusSalesperson(bogus, backups);
  }

  if (backups.length === 0) {
    console.log("Run complete. Nothing was fixed (see warnings above).");
    return;
  }

  const backupPath = path.join(__dirname, `fix-bogus-shared-credit-backup-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backups, null, 2));
  console.log(`Fix complete. ${backups.length} record(s) fixed. Backup written to ${backupPath}`);
}

async function revert(backupFile: string): Promise<void> {
  const backups: FixBackup[] = JSON.parse(fs.readFileSync(backupFile, "utf-8"));

  for (const backup of backups.reverse()) {
    await prisma.$transaction(async (tx) => {
      await tx.salesperson.create({
        data: {
          id: backup.bogusSalesperson.id,
          nameInFile: backup.bogusSalesperson.nameInFile,
          displayName: backup.bogusSalesperson.displayName,
          isActive: backup.bogusSalesperson.isActive,
          userId: backup.bogusSalesperson.userId,
          createdAt: backup.bogusSalesperson.createdAt,
          updatedAt: backup.bogusSalesperson.updatedAt,
        },
      });

      for (const line of backup.originalSalesLines) {
        await tx.salesLine.update({ where: { id: line.id }, data: { salespersonId: line.salespersonId } });
        await tx.salesLineCredit.deleteMany({ where: { salesLineId: line.id } });
      }

      for (const credit of backup.originalCredits) {
        await tx.salesLineCredit.create({
          data: {
            id: credit.id,
            salesLineId: credit.salesLineId,
            salespersonId: credit.salespersonId,
            sharePercent: credit.sharePercent,
            isPrimary: credit.isPrimary,
            createdAt: credit.createdAt,
          },
        });
      }

      if (backup.ruleCreatedId) {
        await tx.salesmanNameRule.delete({ where: { id: backup.ruleCreatedId } }).catch(() => {
          // Rule may have been reused/modified by a later import since this backup was written — leave it.
        });
      }

      console.log(`Restored salesperson ${JSON.stringify(backup.bogusSalesperson.nameInFile)}`);
    });
  }

  console.log("Revert complete.");
}

async function main(): Promise<void> {
  const revertArg = process.argv.find((arg) => arg.startsWith("--revert="));
  if (revertArg) {
    await revert(revertArg.slice("--revert=".length));
  } else {
    await run();
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
