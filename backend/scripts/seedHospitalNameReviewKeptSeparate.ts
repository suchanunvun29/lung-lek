// One-off seed for Module J: the 10 hospital pairs the user has already confirmed are genuinely
// different institutions (design.md Import Rules, item 4 — "รายการห้ามรวมถาวรที่ยืนยันแล้ว").
// Pre-populating HospitalNameReview as KEPT_SEPARATE means a future import never has to ask a
// manager about these again. Run once, idempotent (upserts by the sorted normalizedKey pair),
// from backend/: `npx ts-node scripts/seedHospitalNameReviewKeptSeparate.ts`.
//
// normalizedKeyA/B store each hospital's latinCore() — the axis that actually differs between
// the two names in every pair below (their thaiCore is what collides, which is exactly why a
// live import would otherwise ask about them) and the same key import resolution compares
// against, sorted so the pair is always stored in a stable order regardless of which name a
// future import happens to encounter first.

import { PrismaClient } from "@prisma/client";
import { latinCore } from "../src/services/nameNormalizer.util";

const prisma = new PrismaClient();

// Explicit named pairs #1-9 from design.md's confirmed "ห้ามรวมถาวร" list, matched to the exact
// `nameInFile` values present in the already-imported 846 rows.
const NAMED_PAIRS: [string, string][] = [
  [
    "โรงพยาบาลศิริราช (FACULTY OF MEDICINE SIRIRAJ HOSPITAL MAHIDOL UNIVERSITY)",
    "โรงพยาบาลศิริราช ปิยมหาราชการุณย์(Siriraj Piyamaharajkarun Hospital)",
  ],
  [
    "บริษัท บางปะกอก ฮอสพิทอล กรุ๊ป จำกัด (BANGPAKOK 1 INTERNATIONAL HOSPITAL)",
    "บริษัท บางปะกอก ฮอสพิทอล กรุ๊ป จำกัด (BANGPAKOK 8  HOSPITAL)",
  ],
  [
    "บริษัท เปาโลเมดิค จำกัด (สาขาพหลโยธิน) (PAOLO HOSPITAL PAHONYOTHIN)",
    "บริษัท เปาโลเมดิค จำกัด (สาขารังสิต) (PAOLO HOSPITAL RANGSIT )",
  ],
  [
    "บริษัท ศิครินทร์ จำกัด(มหาชน)   (SIKARIN HOSPITAL)",
    "บริษัท โรงพยาบาลศิครินทร์ หาดใหญ่ จำกัด (Sikarin Hatyai Hospital)",
  ],
  [
    "บริษัท โรงพยาบาลวิภาราม จำกัด (VIBHARAM HOSPITAL )",
    "บริษัท โรงพยาบาลวิภาราม-ปากเกร็ด จำกัด (VIBHARAM HOSPITAL PAKKRED)",
  ],
  [
    "บริษัท พิษณุเวช จำกัด (PITSANUVEJ HOSPITAL)",
    "บริษัท โรงพยาบาลพิษณุเวช อุตรดิตถ์ จำกัด (Phisanuvej Uttaradit Hospital)",
  ],
  [
    "โรงพยาบาล กรุงเทพคริสเตียน（The Bangkok Christian Hospital）",
    "โรงพยาบาลกรุงเทพคริสเตียน นครปฐม(BANGKOK CHRISTIAN HOSPITAL NAKORNPATHOM)",
  ],
  [
    "บริษัท สินแพทย์ นครปฐม จำกัด (SYNPHAET Nakornprathom Hospital)",
    "บริษัท สินแพทย์ ลำลูกกา จำกัด (Synphaet Hospital Lamlukka)",
  ],
  [
    "บริษัท ธนบุรี เฮลท์แคร์ กรุ๊ป จำกัด (มหาชน) (Thonburi 1 Hospital)",
    "บริษัท โรงพยาบาลธนบุรี บำรุงเมือง จำกัด (Thonburi Bamrungmuang Hospital)",
  ],
];

// #10: "สาขาของ Bangkok Hospital ทุกจังหวัด" = every branch is a separate hospital from every
// other branch. Generated as all pairwise combinations rather than one manually-picked pair.
const BANGKOK_HOSPITAL_BRANCHES: string[] = [
  "บริษัท กรุงเทพดุสิตเวชการ จำกัด (มหาชน)(BANGKOK HOSPITAL)",
  "บริษัท โรงพยาบาลกรุงเทพราชสีมา จำกัด (Bangkok Hospital Ratchasima)",
  "บริษัท โรงพยาบาลกรุงเทพจันทบุรี จำกัด  (BANGKOK HOSPITAL CHANTHABURI)",
  "บริษัท โรงพยาบาลกรุงเทพ พัทยา จำกัด (BANGKOK HOSPITAL PATTAYA)",
  "บริษัท โรงพยาบาลกรุงเทพระยอง จำกัด (BANGKOK HOSPITAL RAYONG)",
  "บริษัท โรงพยาบาลกรุงเทพสนามจันทร์ จำกัด(BANGKOK HOSPITAL SANAMCHAN)",
  "บริษัท โรงพยาบาลกรุงเทพภูเก็ต จำกัด (BANGKOK HOSPITAL PHUKET)",
  "บริษัท โรงพยาบาลกรุงเทพอุดร จำกัด (UDON BANGKOK HOSPITAL )",
];

function pairwiseCombinations(names: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      pairs.push([names[i], names[j]]);
    }
  }
  return pairs;
}

async function seedPair(nameA: string, nameB: string): Promise<"created" | "skipped-missing" | "skipped-existing"> {
  const [hospitalA, hospitalB] = await Promise.all([
    prisma.hospital.findUnique({ where: { nameInFile: nameA } }),
    prisma.hospital.findUnique({ where: { nameInFile: nameB } }),
  ]);
  if (!hospitalA || !hospitalB) {
    console.warn(`Skipping pair — hospital not found: ${!hospitalA ? nameA : nameB}`);
    return "skipped-missing";
  }

  const keys = [latinCore(hospitalA.nameInFile), latinCore(hospitalB.nameInFile)].sort();
  const [normalizedKeyA, normalizedKeyB] = keys;
  const [sampleRawA, sampleRawB] =
    latinCore(hospitalA.nameInFile) <= latinCore(hospitalB.nameInFile)
      ? [hospitalA.nameInFile, hospitalB.nameInFile]
      : [hospitalB.nameInFile, hospitalA.nameInFile];

  const existing = await prisma.hospitalNameReview.findUnique({
    where: { normalizedKeyA_normalizedKeyB: { normalizedKeyA, normalizedKeyB } },
  });
  if (existing) return "skipped-existing";

  await prisma.hospitalNameReview.create({
    data: {
      normalizedKeyA,
      normalizedKeyB,
      sampleRawA,
      sampleRawB,
      status: "KEPT_SEPARATE",
      note: "seed: ยืนยันแล้วว่าเป็นคนละแห่ง (design.md Import Rules, ยืนยัน 2026-08-16) — ห้าม import ถามซ้ำ",
    },
  });
  return "created";
}

async function main(): Promise<void> {
  const allPairs = [...NAMED_PAIRS, ...pairwiseCombinations(BANGKOK_HOSPITAL_BRANCHES)];

  let created = 0;
  let skippedMissing = 0;
  let skippedExisting = 0;

  for (const [nameA, nameB] of allPairs) {
    const result = await seedPair(nameA, nameB);
    if (result === "created") created++;
    else if (result === "skipped-missing") skippedMissing++;
    else skippedExisting++;
  }

  console.log(
    `Seed complete. Created ${created}, skipped ${skippedExisting} already-seeded, skipped ${skippedMissing} with a missing hospital record.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
