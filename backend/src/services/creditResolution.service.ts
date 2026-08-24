// Module J resolution logic used by import.service.ts: shared-credit salesman parsing and
// alias-based hospital-name resolution. Split out from import.service.ts because it owns its
// own in-memory indexes (built once per import transaction) and business rules that are easier
// to reason about — and test — on their own.

import { Prisma } from "@prisma/client";
import { latinCore, personCore, splitSharedSalesmanNames, thaiCore, normalizeSharedSalesmanRaw } from "./nameNormalizer.util";

type TxClient = Prisma.TransactionClient;

const SHARE_PERCENT_DECIMALS = 3;
const SHARE_PERCENT_TOTAL = 100;
const SHARE_PERCENT_EPSILON = 0.001;

export interface IssueInput {
  level: "WARNING" | "ERROR";
  code: string;
  message: string;
  sheetName?: string;
  rowNumber?: number;
  columnName?: string;
}

export interface ResolvedCredit {
  salespersonId: string;
  sharePercent: string; // Decimal(6,3) as a fixed-point string, matches how Prisma expects it
  isPrimary: boolean;
}

// ---------- Salesperson / shared-credit resolution ----------

export interface SalespersonIndex {
  byPersonCore: Map<string, string>; // personCore(nameInFile) -> Salesperson.id
}

export async function buildSalespersonIndex(tx: TxClient): Promise<SalespersonIndex> {
  const salespeople = await tx.salesperson.findMany({ select: { id: true, nameInFile: true } });
  const byPersonCore = new Map<string, string>();
  for (const sp of salespeople) {
    byPersonCore.set(personCore(sp.nameInFile), sp.id);
  }
  return { byPersonCore };
}

/** Resolves (and auto-creates if genuinely unseen) a single salesperson name via personCore matching.
 * Every auto-create also opens a `SalesmanNameReview` row so a manager can confirm "genuinely new"
 * or merge the spelling into an existing person — per OQ30's user policy (2026-08-22): import never
 * blocks, but unseen spellings must not silently stand as new people. */
async function resolveOrCreateSalesperson(
  tx: TxClient,
  index: SalespersonIndex,
  rawName: string,
  issues: IssueInput[],
  sheetName: string,
  rowNumber: number
): Promise<string> {
  const key = personCore(rawName);
  const existingId = index.byPersonCore.get(key);
  if (existingId) return existingId;

  const review = await tx.salesmanNameReview.findUnique({ where: { personKey: key } });
  if (review?.status === "MERGED" && review.mergedIntoId) {
    // A previous decision merged this exact spelling into an existing person — resolve there
    // directly and never re-ask.
    index.byPersonCore.set(key, review.mergedIntoId);
    return review.mergedIntoId;
  }

  const created = await tx.salesperson.create({ data: { nameInFile: rawName, displayName: rawName } });
  index.byPersonCore.set(key, created.id);
  if (!review) {
    await tx.salesmanNameReview.create({
      data: { personKey: key, sampleRaw: rawName, createdSalespersonId: created.id },
    });
  }
  issues.push({
    level: "WARNING",
    code: "UNKNOWN_SALESMAN",
    sheetName,
    rowNumber,
    message: `สร้างพนักงานขายใหม่: ${rawName} — รอผู้จัดการยืนยันในคิว "ยืนยันชื่อซ้ำ"`,
  });
  return created.id;
}

/** Looks up an existing salesperson by personCore only — never creates one. Used inside shared deals. */
function lookupSalespersonByPersonCore(index: SalespersonIndex, rawName: string): string | null {
  return index.byPersonCore.get(personCore(rawName)) ?? null;
}

export function splitEqualShares(count: number): string[] {
  const base = Math.floor((SHARE_PERCENT_TOTAL / count) * 10 ** SHARE_PERCENT_DECIMALS);
  const shares = Array.from({ length: count }, () => base);
  const distributed = base * count;
  const remainder = Math.round(SHARE_PERCENT_TOTAL * 10 ** SHARE_PERCENT_DECIMALS) - distributed;
  shares[shares.length - 1] += remainder;
  return shares.map((v) => (v / 10 ** SHARE_PERCENT_DECIMALS).toFixed(SHARE_PERCENT_DECIMALS));
}

/**
 * Resolves the raw Salesman cell value into one or more salesperson credits.
 * Returns `null` when the row must be skipped (UNKNOWN_SALESMAN_IN_SHARED_DEAL already pushed).
 */
export async function resolveSalesmanCredits(
  tx: TxClient,
  index: SalespersonIndex,
  rawSalesmanCell: string,
  issues: IssueInput[],
  sheetName: string,
  rowNumber: number
): Promise<ResolvedCredit[] | null> {
  const subNames = splitSharedSalesmanNames(rawSalesmanCell);

  if (subNames.length <= 1) {
    const salespersonId = await resolveOrCreateSalesperson(tx, index, rawSalesmanCell, issues, sheetName, rowNumber);
    return [{ salespersonId, sharePercent: SHARE_PERCENT_TOTAL.toFixed(SHARE_PERCENT_DECIMALS), isPrimary: true }];
  }

  const normalizedRaw = normalizeSharedSalesmanRaw(subNames);
  const existingRule = await tx.salesmanNameRule.findUnique({
    where: { normalizedRaw },
    include: { members: true },
  });

  if (existingRule) {
    const primarySalespersonId = lookupSalespersonByPersonCore(index, subNames[0]);
    return existingRule.members.map((member) => ({
      salespersonId: member.salespersonId,
      sharePercent: member.sharePercent.toFixed(SHARE_PERCENT_DECIMALS),
      isPrimary: member.salespersonId === primarySalespersonId,
    }));
  }

  const resolvedIds: (string | null)[] = subNames.map((name) => lookupSalespersonByPersonCore(index, name));
  const unresolved = subNames.filter((_, i) => resolvedIds[i] === null);
  if (unresolved.length > 0) {
    issues.push({
      level: "ERROR",
      code: "UNKNOWN_SALESMAN_IN_SHARED_DEAL",
      sheetName,
      rowNumber,
      message: `ไม่พบพนักงานขายที่มีอยู่แล้วสำหรับชื่อ: ${unresolved.join(", ")} ในค่าดิบ "${rawSalesmanCell}" — ข้ามแถวนี้`,
    });
    return null;
  }

  const salespersonIds = resolvedIds as string[];
  const shares = splitEqualShares(salespersonIds.length);

  const rule = await tx.salesmanNameRule.create({
    data: {
      normalizedRaw,
      sampleRaw: rawSalesmanCell,
      members: {
        create: salespersonIds.map((salespersonId, i) => ({ salespersonId, sharePercent: shares[i] })),
      },
    },
  });

  issues.push({
    level: "WARNING",
    code: "SHARED_CREDIT_RULE_CREATED",
    sheetName,
    rowNumber,
    message: `พบดีลแบ่งเครดิตรูปแบบใหม่ "${rawSalesmanCell}" — สร้างกฎแบ่งเท่ากันทุกคน (${salespersonIds.length} คน) รหัสกฎ ${rule.id} รอผู้จัดการยืนยัน/แก้สัดส่วน`,
  });

  return salespersonIds.map((salespersonId, i) => ({
    salespersonId,
    sharePercent: shares[i],
    isPrimary: i === 0,
  }));
}

export function assertSharesSumTo100(credits: ResolvedCredit[]): void {
  const sum = credits.reduce((acc, c) => acc + Number(c.sharePercent), 0);
  if (Math.abs(sum - SHARE_PERCENT_TOTAL) > SHARE_PERCENT_EPSILON) {
    throw new Error(`Σ sharePercent ของ SalesLineCredit ไม่เท่ากับ 100.000 (ได้ ${sum})`);
  }
}

// ---------- Hospital alias resolution ----------

export interface HospitalIndex {
  byLatinAlias: Map<string, string>; // latinCore -> Hospital.id, backed by an actual HospitalAlias row
  byLatinFallback: Map<string, string>; // latinCore(nameInFile) -> Hospital.id, for pre-existing hospitals with no alias row yet
  byThaiCore: Map<string, { hospitalId: string; nameInFile: string }>; // thaiCore -> canonical hospital, for the review-queue trigger
  provinceById: Map<string, string | null>;
}

export async function buildHospitalIndex(tx: TxClient): Promise<HospitalIndex> {
  const [hospitals, aliases] = await Promise.all([
    tx.hospital.findMany({ select: { id: true, nameInFile: true, province: true } }),
    tx.hospitalAlias.findMany({ select: { normalizedKey: true, hospitalId: true } }),
  ]);

  const byLatinAlias = new Map(aliases.map((a) => [a.normalizedKey, a.hospitalId]));
  const byLatinFallback = new Map<string, string>();
  const byThaiCore = new Map<string, { hospitalId: string; nameInFile: string }>();
  const provinceById = new Map<string, string | null>();
  for (const h of hospitals) {
    byLatinFallback.set(latinCore(h.nameInFile), h.id);
    provinceById.set(h.id, h.province);
    const thaiKey = thaiCore(h.nameInFile);
    if (thaiKey && !byThaiCore.has(thaiKey)) byThaiCore.set(thaiKey, { hospitalId: h.id, nameInFile: h.nameInFile });
  }

  return { byLatinAlias, byLatinFallback, byThaiCore, provinceById };
}

async function ensureReviewQueued(
  tx: TxClient,
  rawName: string,
  rawLatin: string,
  existing: { hospitalId: string; nameInFile: string }
): Promise<void> {
  const existingLatin = latinCore(existing.nameInFile);
  if (existingLatin === rawLatin) return; // latinCore actually matches too -> handled by the auto-merge path instead

  const [normalizedKeyA, normalizedKeyB] = [rawLatin, existingLatin].sort();
  const [sampleRawA, sampleRawB] = rawLatin <= existingLatin ? [rawName, existing.nameInFile] : [existing.nameInFile, rawName];

  const alreadyQueued = await tx.hospitalNameReview.findUnique({
    where: { normalizedKeyA_normalizedKeyB: { normalizedKeyA, normalizedKeyB } },
  });
  if (alreadyQueued) return; // PENDING already queued, or a manager already decided (MERGED/KEPT_SEPARATE) — never ask again

  await tx.hospitalNameReview.create({
    data: { normalizedKeyA, normalizedKeyB, sampleRawA, sampleRawB, status: "PENDING" },
  });
}

export async function resolveHospitalViaAlias(
  tx: TxClient,
  index: HospitalIndex,
  rawName: string,
  province: string | null,
  issues: IssueInput[],
  sheetName: string,
  rowNumber: number
): Promise<string> {
  const latin = latinCore(rawName);
  const thai = thaiCore(rawName);

  const aliasedId = index.byLatinAlias.get(latin);
  if (aliasedId) {
    await syncHospitalProvince(tx, index, aliasedId, province);
    return aliasedId;
  }

  const fallbackId = index.byLatinFallback.get(latin);
  if (fallbackId) {
    await tx.hospitalAlias.create({
      data: { normalizedKey: latin, sampleRaw: rawName, hospitalId: fallbackId, source: "AUTO" },
    });
    index.byLatinAlias.set(latin, fallbackId);
    await syncHospitalProvince(tx, index, fallbackId, province);
    return fallbackId;
  }

  const thaiCollision = thai ? index.byThaiCore.get(thai) : undefined;
  if (thaiCollision) {
    await ensureReviewQueued(tx, rawName, latin, thaiCollision);
  }

  const created = await tx.hospital.create({
    data: { nameInFile: rawName, displayName: rawName, province, isPreExistingCustomer: false },
  });
  await tx.hospitalAlias.create({
    data: { normalizedKey: latin, sampleRaw: rawName, hospitalId: created.id, source: "AUTO" },
  });

  index.byLatinAlias.set(latin, created.id);
  index.byLatinFallback.set(latin, created.id);
  index.provinceById.set(created.id, province);
  if (thai && !index.byThaiCore.has(thai)) index.byThaiCore.set(thai, { hospitalId: created.id, nameInFile: rawName });

  issues.push({
    level: "WARNING",
    code: "NEW_HOSPITAL",
    sheetName,
    rowNumber,
    message: `สร้างโรงพยาบาลใหม่: ${rawName}`,
  });
  return created.id;
}

async function syncHospitalProvince(tx: TxClient, index: HospitalIndex, hospitalId: string, province: string | null): Promise<void> {
  if (!province) return;
  if (index.provinceById.get(hospitalId) === province) return;
  await tx.hospital.update({ where: { id: hospitalId }, data: { province } });
  index.provinceById.set(hospitalId, province);
}
