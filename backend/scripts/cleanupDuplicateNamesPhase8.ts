// One-off cleanup for Module J (design.md Import Rules / requirement.md 1.2-1.3): merges the
// hospital pairs that are pure spelling duplicates of each other (auto-merge rule — latinCore
// match) and the one confirmed salesperson duplicate (Mr.Panyawat / Mr Panyawat), moving
// SalesLine/SalesLineCredit references onto the surviving canonical record.
//
// This intentionally does NOT touch "Miss Napatsorn  Dadphu" (double space) — requirement.md
// 1.3 is explicit that whether it duplicates another spelling is still unconfirmed.
//
// Run once from backend/: `npx ts-node scripts/cleanupDuplicateNamesPhase8.ts`. Idempotent (a
// pair already merged, i.e. one side no longer exists, is skipped). Reversible: every merge
// writes a JSON backup file (`scripts/cleanup-phase8-backup-<timestamp>.json`) with everything
// needed to reconstruct the duplicate record and repoint references back; run
// `npx ts-node scripts/cleanupDuplicateNamesPhase8.ts --revert=<backup file>` to undo it.

import * as fs from "fs";
import * as path from "path";
import { Prisma, PrismaClient } from "@prisma/client";
import { latinCore, personCore } from "../src/services/nameNormalizer.util";

const prisma = new PrismaClient();

const PROTECTED_SALESPERSON_NAMES = new Set(["Miss Napatsorn  Dadphu"]);

const NAMED_SALESPERSON_PAIR: [string, string] = ["Mr.Panyawat Siribanchachi", "Mr Panyawat Siribanchachi"];

interface HospitalMergeBackup {
  type: "hospital";
  canonicalId: string;
  duplicate: Prisma.HospitalGetPayload<Record<string, never>>;
  movedSalesLineIds: string[];
}

interface SalespersonMergeBackup {
  type: "salesperson";
  canonicalId: string;
  duplicate: Prisma.SalespersonGetPayload<Record<string, never>>;
  movedSalesLineIds: string[];
  movedSalesLineCreditIds: string[];
}

type MergeBackup = HospitalMergeBackup | SalespersonMergeBackup;

function findAutoMergeableHospitalPairs(hospitals: { id: string; nameInFile: string }[]): [string, string][] {
  const byLatin = new Map<string, string[]>();
  for (const h of hospitals) {
    const key = latinCore(h.nameInFile);
    if (!key) continue;
    const bucket = byLatin.get(key) ?? [];
    bucket.push(h.id);
    byLatin.set(key, bucket);
  }
  const pairs: [string, string][] = [];
  for (const ids of byLatin.values()) {
    for (let i = 1; i < ids.length; i++) pairs.push([ids[0], ids[i]]);
  }
  return pairs;
}

async function mergeHospitalPair(canonicalId: string, duplicateId: string, backups: MergeBackup[]): Promise<void> {
  const duplicate = await prisma.hospital.findUnique({ where: { id: duplicateId } });
  if (!duplicate) return;

  const movedSalesLines = await prisma.salesLine.findMany({ where: { hospitalId: duplicateId }, select: { id: true } });

  await prisma.$transaction(async (tx) => {
    await tx.salesLine.updateMany({ where: { hospitalId: duplicateId }, data: { hospitalId: canonicalId } });
    await tx.hospitalAlias.updateMany({ where: { hospitalId: duplicateId }, data: { hospitalId: canonicalId } });
    await tx.hospitalAlias.upsert({
      where: { normalizedKey: latinCore(duplicate.nameInFile) },
      update: { hospitalId: canonicalId },
      create: { normalizedKey: latinCore(duplicate.nameInFile), sampleRaw: duplicate.nameInFile, hospitalId: canonicalId, source: "AUTO" },
    });
    await tx.hospital.delete({ where: { id: duplicateId } });
  });

  backups.push({
    type: "hospital",
    canonicalId,
    duplicate,
    movedSalesLineIds: movedSalesLines.map((l) => l.id),
  });
  console.log(`Merged hospital ${JSON.stringify(duplicate.nameInFile)} -> ${canonicalId} (${movedSalesLines.length} SalesLine rows moved)`);
}

async function mergeSalespersonPair(nameA: string, nameB: string, backups: MergeBackup[]): Promise<void> {
  if (PROTECTED_SALESPERSON_NAMES.has(nameA) || PROTECTED_SALESPERSON_NAMES.has(nameB)) {
    console.warn(`Refusing to touch protected salesperson name(s): ${nameA}, ${nameB}`);
    return;
  }

  const [spA, spB] = await Promise.all([
    prisma.salesperson.findUnique({ where: { nameInFile: nameA } }),
    prisma.salesperson.findUnique({ where: { nameInFile: nameB } }),
  ]);
  if (!spA || !spB) {
    console.warn(`Skipping salesperson pair — not both present: ${nameA} / ${nameB}`);
    return;
  }
  if (personCore(spA.nameInFile) !== personCore(spB.nameInFile)) {
    console.warn(`Refusing to merge — personCore differs: ${nameA} / ${nameB}`);
    return;
  }

  // Prefer the record with more sales history as canonical so displayName/userId survive.
  const [salesLineCountA, salesLineCountB] = await Promise.all([
    prisma.salesLine.count({ where: { salespersonId: spA.id } }),
    prisma.salesLine.count({ where: { salespersonId: spB.id } }),
  ]);
  const [canonical, duplicate] = salesLineCountA >= salesLineCountB ? [spA, spB] : [spB, spA];

  const [movedSalesLines, movedCredits] = await Promise.all([
    prisma.salesLine.findMany({ where: { salespersonId: duplicate.id }, select: { id: true } }),
    prisma.salesLineCredit.findMany({ where: { salespersonId: duplicate.id }, select: { id: true } }),
  ]);

  await prisma.$transaction(async (tx) => {
    await tx.salesLine.updateMany({ where: { salespersonId: duplicate.id }, data: { salespersonId: canonical.id } });

    for (const credit of await tx.salesLineCredit.findMany({ where: { salespersonId: duplicate.id } })) {
      const canonicalHasCredit = await tx.salesLineCredit.findUnique({
        where: { salesLineId_salespersonId: { salesLineId: credit.salesLineId, salespersonId: canonical.id } },
      });
      if (canonicalHasCredit) {
        // Same salesLine already has a credit row for the canonical salesperson (shouldn't
        // happen for single-salesperson deals, but defensively skip rather than violate the
        // unique constraint) — leave the duplicate's row alone for manual inspection.
        continue;
      }
      await tx.salesLineCredit.update({ where: { id: credit.id }, data: { salespersonId: canonical.id } });
    }

    await tx.salesmanNameRuleMember.updateMany({
      where: { salespersonId: duplicate.id },
      data: { salespersonId: canonical.id },
    });
    await tx.salesperson.delete({ where: { id: duplicate.id } });
  });

  backups.push({
    type: "salesperson",
    canonicalId: canonical.id,
    duplicate,
    movedSalesLineIds: movedSalesLines.map((l) => l.id),
    movedSalesLineCreditIds: movedCredits.map((c) => c.id),
  });
  console.log(
    `Merged salesperson ${JSON.stringify(duplicate.nameInFile)} -> ${JSON.stringify(canonical.nameInFile)} (${movedSalesLines.length} SalesLine, ${movedCredits.length} SalesLineCredit rows moved)`
  );
}

async function runCleanup(): Promise<void> {
  const backups: MergeBackup[] = [];

  const hospitals = await prisma.hospital.findMany({ select: { id: true, nameInFile: true } });
  const hospitalPairs = findAutoMergeableHospitalPairs(hospitals);
  if (hospitalPairs.length === 0) {
    console.log("No latinCore-duplicate Hospital pairs found in the current dataset — nothing to merge.");
  }
  for (const [canonicalId, duplicateId] of hospitalPairs) {
    await mergeHospitalPair(canonicalId, duplicateId, backups);
  }

  await mergeSalespersonPair(NAMED_SALESPERSON_PAIR[0], NAMED_SALESPERSON_PAIR[1], backups);

  if (backups.length === 0) {
    console.log("Cleanup complete. Nothing needed merging.");
    return;
  }

  const backupPath = path.join(__dirname, `cleanup-phase8-backup-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backups, null, 2));
  console.log(`Cleanup complete. ${backups.length} record(s) merged. Backup written to ${backupPath}`);
}

async function revert(backupFile: string): Promise<void> {
  const backups: MergeBackup[] = JSON.parse(fs.readFileSync(backupFile, "utf-8"));

  for (const backup of backups.reverse()) {
    if (backup.type === "hospital") {
      const restored = await prisma.hospital.create({
        data: {
          id: backup.duplicate.id,
          nameInFile: backup.duplicate.nameInFile,
          displayName: backup.duplicate.displayName,
          province: backup.duplicate.province,
          isPreExistingCustomer: backup.duplicate.isPreExistingCustomer,
          createdAt: backup.duplicate.createdAt,
          updatedAt: backup.duplicate.updatedAt,
        },
      });
      await prisma.salesLine.updateMany({
        where: { id: { in: backup.movedSalesLineIds } },
        data: { hospitalId: restored.id },
      });
      await prisma.hospitalAlias.updateMany({
        where: { normalizedKey: latinCore(backup.duplicate.nameInFile) },
        data: { hospitalId: restored.id },
      });
      console.log(`Restored hospital ${JSON.stringify(backup.duplicate.nameInFile)}`);
    } else {
      const restored = await prisma.salesperson.create({
        data: {
          id: backup.duplicate.id,
          nameInFile: backup.duplicate.nameInFile,
          displayName: backup.duplicate.displayName,
          isActive: backup.duplicate.isActive,
          userId: backup.duplicate.userId,
          createdAt: backup.duplicate.createdAt,
          updatedAt: backup.duplicate.updatedAt,
        },
      });
      await prisma.salesLine.updateMany({
        where: { id: { in: backup.movedSalesLineIds } },
        data: { salespersonId: restored.id },
      });
      await prisma.salesLineCredit.updateMany({
        where: { id: { in: backup.movedSalesLineCreditIds } },
        data: { salespersonId: restored.id },
      });
      console.log(`Restored salesperson ${JSON.stringify(backup.duplicate.nameInFile)}`);
    }
  }

  console.log("Revert complete.");
}

async function main(): Promise<void> {
  const revertArg = process.argv.find((arg) => arg.startsWith("--revert="));
  if (revertArg) {
    await revert(revertArg.slice("--revert=".length));
  } else {
    await runCleanup();
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
