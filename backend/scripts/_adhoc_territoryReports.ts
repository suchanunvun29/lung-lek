// One-off ad-hoc report generator — NOT part of Module K/L (schema for real Territory/Target-
// by-zone doesn't exist yet, still pending system-analyst design per requirement.md 10.6).
// Produces the 3-sheet Excel the user asked for directly from current SalesLineCredit data +
// the user-provided province->territory assignment (chat, 2026-08-16) + the uploaded
// ขนาดเตียงรพ.xlsx government hospital registry. Provisional: Bangkok 1/2 split is arbitrary
// (alphabetical halves, user confirmed "แบ่งครึ่งเท่า ๆ กัน (เลือกเอง)"); hospital name matching
// between sales data and the registry uses only exact thaiCore match (no fuzzy) — unmatched
// registry hospitals are left unlinked, not guessed.

import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { thaiCore } from "../src/services/nameNormalizer.util";

const prisma = new PrismaClient();

// ---------- Territory definitions (from user, chat 2026-08-16) ----------

const TERRITORIES = [
  { key: "กท1+ตะวันตก", owners: ["Mrs.Tasanee Angsawothai"], targetPerMonth: 1_166_666.67 },
  { key: "กท2+กลาง", owners: ["Miss Tanyapat Pholyiam"], targetPerMonth: 1_083_333.33 },
  { key: "ภาคเหนือ", owners: ["Mr.Panyawat Siribanchachi"], targetPerMonth: 666_666 },
  { key: "ภาคใต้", owners: ["Miss Yatika Setthaorawan"], targetPerMonth: 666_666 },
  { key: "ภาคตะวันออก", owners: ["Miss Chidchanok Seethong", "Mr.Chokechai Tangsangkharom"], targetPerMonth: 666_666 },
  { key: "อีสานตอนบน", owners: ["Miss Chutchataporn Sanamthong"], targetPerMonth: 666_666 },
  { key: "อีสานตอนล่าง", owners: ["Miss Kulnattida Sangkaew"], targetPerMonth: 666_666 },
] as const;

const SATHIT_NAME = "Mr.Sathit Ratanakuakul";
const SATHIT_TARGET_PER_MONTH = 166_666.67;
const SATHIT_PRODUCT_TYPE_HINT = "Cook Critical Care"; // matched loosely against ProductType.name below

// Thai canonical province -> territory key (standard regional grouping; ภาคกลาง excludes the
// Bangkok-vicinity provinces already folded into กท1/กท2 splits per how requirement.md's table
// reads — Pathum Thani/Nonthaburi/Samut Prakan/Samut Sakhon/Samut Songkhram grouped into กลาง).
const THAI_PROVINCE_TO_TERRITORY: Record<string, (typeof TERRITORIES)[number]["key"]> = {
  เชียงใหม่: "ภาคเหนือ", เชียงราย: "ภาคเหนือ", ลำปาง: "ภาคเหนือ", ลำพูน: "ภาคเหนือ",
  แม่ฮ่องสอน: "ภาคเหนือ", น่าน: "ภาคเหนือ", พะเยา: "ภาคเหนือ", แพร่: "ภาคเหนือ",
  อุตรดิตถ์: "ภาคเหนือ", ตาก: "ภาคเหนือ", สุโขทัย: "ภาคเหนือ", กำแพงเพชร: "ภาคเหนือ",
  พิจิตร: "ภาคเหนือ", พิษณุโลก: "ภาคเหนือ", เพชรบูรณ์: "ภาคเหนือ", นครสวรรค์: "ภาคเหนือ", อุทัยธานี: "ภาคเหนือ",

  เลย: "อีสานตอนบน", หนองคาย: "อีสานตอนบน", หนองบัวลำภู: "อีสานตอนบน", อุดรธานี: "อีสานตอนบน",
  บึงกาฬ: "อีสานตอนบน", สกลนคร: "อีสานตอนบน", นครพนม: "อีสานตอนบน", มุกดาหาร: "อีสานตอนบน",
  ขอนแก่น: "อีสานตอนบน", กาฬสินธุ์: "อีสานตอนบน",

  นครราชสีมา: "อีสานตอนล่าง", บุรีรัมย์: "อีสานตอนล่าง", สุรินทร์: "อีสานตอนล่าง", ศรีสะเกษ: "อีสานตอนล่าง",
  อุบลราชธานี: "อีสานตอนล่าง", ยโสธร: "อีสานตอนล่าง", อำนาจเจริญ: "อีสานตอนล่าง", ชัยภูมิ: "อีสานตอนล่าง",
  ร้อยเอ็ด: "อีสานตอนล่าง", มหาสารคาม: "อีสานตอนล่าง",

  พระนครศรีอยุธยา: "กท2+กลาง", อ่างทอง: "กท2+กลาง", ลพบุรี: "กท2+กลาง", สระบุรี: "กท2+กลาง",
  สิงห์บุรี: "กท2+กลาง", ชัยนาท: "กท2+กลาง", สุพรรณบุรี: "กท2+กลาง", นครปฐม: "กท2+กลาง",
  ปทุมธานี: "กท2+กลาง", นนทบุรี: "กท2+กลาง", สมุทรปราการ: "กท2+กลาง", สมุทรสาคร: "กท2+กลาง", สมุทรสงคราม: "กท2+กลาง",

  กาญจนบุรี: "กท1+ตะวันตก", ราชบุรี: "กท1+ตะวันตก", เพชรบุรี: "กท1+ตะวันตก", ประจวบคีรีขันธ์: "กท1+ตะวันตก",

  ชลบุรี: "ภาคตะวันออก", ระยอง: "ภาคตะวันออก", จันทบุรี: "ภาคตะวันออก", ตราด: "ภาคตะวันออก",
  สระแก้ว: "ภาคตะวันออก", ฉะเชิงเทรา: "ภาคตะวันออก", ปราจีนบุรี: "ภาคตะวันออก", นครนายก: "ภาคตะวันออก",

  นครศรีธรรมราช: "ภาคใต้", ภูเก็ต: "ภาคใต้", กระบี่: "ภาคใต้", พังงา: "ภาคใต้", ตรัง: "ภาคใต้",
  สงขลา: "ภาคใต้", สตูล: "ภาคใต้", ปัตตานี: "ภาคใต้", ยะลา: "ภาคใต้", นราธิวาส: "ภาคใต้",
  สุราษฎร์ธานี: "ภาคใต้", ชุมพร: "ภาคใต้", ระนอง: "ภาคใต้", พัทลุง: "ภาคใต้",
};

// DB's raw (messy, English-transliterated) Hospital.province -> canonical Thai province.
// Built from the 69 distinct raw values actually present in this DB (checked 2026-08-16).
const RAW_PROVINCE_TO_THAI: Record<string, string> = {
  "CHIANG MAI": "เชียงใหม่", "CHAING MAI": "เชียงใหม่",
  "CHON BURI": "ชลบุรี",
  "PHATUM THANI": "ปทุมธานี",
  PHITSANULOK: "พิษณุโลก",
  Uttaradit: "อุตรดิตถ์",
  Chiangrai: "เชียงราย",
  "CHAI YA PUM": "ชัยภูมิ",
  "NAKHON SI THAMMARAT": "นครศรีธรรมราช",
  SAMUTSAKORN: "สมุทรสาคร", SMUTSAKORN: "สมุทรสาคร", "SMUT SAKORN": "สมุทรสาคร", "SAMUT SAKORN": "สมุทรสาคร",
  AYUTTHAYA: "พระนครศรีอยุธยา",
  "Udon Thani": "อุดรธานี", "UDON THANI": "อุดรธานี",
  PHUKET: "ภูเก็ต",
  YASOTHON: "ยโสธร",
  "KHONE KEAN": "ขอนแก่น",
  NAKORNPATHOM: "นครปฐม", "NAKORN PATHOM": "นครปฐม", NAKORNPRATHOM: "นครปฐม",
  "NONTHA BURI": "นนทบุรี", "NON THA BURI": "นนทบุรี",
  "LOP BURI": "ลพบุรี",
  Rayong: "ระยอง", RAYONG: "ระยอง",
  "CHAN THA BURI": "จันทบุรี", "CHANTA BURI": "จันทบุรี",
  "Nakhon Ratchasima": "นครราชสีมา", "NAKORN RACHASIMA": "นครราชสีมา",
  Chumphon: "ชุมพร",
  "Phung Nga": "พังงา",
  "UBON RATCHATHANI": "อุบลราชธานี", UBONRATCHANI: "อุบลราชธานี", Ubonratchathani: "อุบลราชธานี",
  "Si Sa Ket": "ศรีสะเกษ", "SRI SA KET": "ศรีสะเกษ",
  SURIN: "สุรินทร์", Surin: "สุรินทร์",
  "Uthai Thani": "อุทัยธานี",
  PHAYAO: "พะเยา",
  SUPANBURI: "สุพรรณบุรี",
  Narathiwat: "นราธิวาส",
  BURIRAM: "บุรีรัมย์",
  "Roi Et": "ร้อยเอ็ด",
  "SAKON NAKHON": "สกลนคร",
  "NAKHON SAWAN": "นครสวรรค์",
  "Song khla": "สงขลา", "SONG KLA": "สงขลา",
  "Phanom Sarakham": "ฉะเชิงเทรา",
  LAMPANG: "ลำปาง",
  "Maha Saeakham": "มหาสารคาม",
  Ratchaburi: "ราชบุรี",
  SAKAEO: "สระแก้ว",
  Suratthani: "สุราษฎร์ธานี",
  SAMUTPRAKARN: "สมุทรปราการ",
  KALASIN: "กาฬสินธุ์",
  Krabi: "กระบี่",
  "KAMPHANG PHET": "กำแพงเพชร",
  "MAE HONG SON": "แม่ฮ่องสอน",
  SARABURI: "สระบุรี", SRABURI: "สระบุรี",
  "HAT YAI": "สงขลา",
  "CHAI NAT": "ชัยนาท",
  "Nakhon Nayok": "นครนายก",
  NAN: "น่าน",
  Trang: "ตรัง",
  KAYCNABURI: "กาญจนบุรี",
  "(ไม่มีข้อมูลจังหวัด)": "",
};

function territoryForRawProvince(raw: string | null): string {
  if (!raw) return "(ไม่ทราบเขต — ไม่มีข้อมูลจังหวัด)";
  const upper = raw.trim().toUpperCase();
  if (upper === "BANGKOK") return "__BANGKOK__"; // resolved later, split alphabetically
  const thai = RAW_PROVINCE_TO_THAI[raw.trim()] ?? RAW_PROVINCE_TO_THAI[upper];
  if (!thai) return `(ไม่ทราบเขต — จังหวัดดิบ "${raw}" ยังไม่ได้ map)`;
  return THAI_PROVINCE_TO_TERRITORY[thai] ?? `(ไม่ทราบเขต — จังหวัด "${thai}" ยังไม่ได้จัดเขต)`;
}

async function main() {
  const hospitals = await prisma.hospital.findMany({ select: { id: true, nameInFile: true, displayName: true, province: true } });

  // Resolve Bangkok split: alphabetical halves of Bangkok hospitals by displayName.
  const bangkokHospitals = hospitals.filter((h) => (h.province ?? "").trim().toUpperCase() === "BANGKOK").sort((a, b) => a.displayName.localeCompare(b.displayName, "th"));
  const bangkok1Ids = new Set(bangkokHospitals.slice(0, Math.ceil(bangkokHospitals.length / 2)).map((h) => h.id));

  const hospitalTerritory = new Map<string, string>();
  for (const h of hospitals) {
    let territory = territoryForRawProvince(h.province);
    if (territory === "__BANGKOK__") territory = bangkok1Ids.has(h.id) ? "กท1+ตะวันตก" : "กท2+กลาง";
    hospitalTerritory.set(h.id, territory);
  }

  const credits = await prisma.salesLineCredit.findMany({
    include: {
      salesLine: { include: { hospital: true, product: { include: { productType: true } } } },
      salesperson: { select: { nameInFile: true, displayName: true } },
    },
  });

  // ---------- Sheet 1: KPI รายเขต ----------
  interface Sheet1Row { เขต: string; ผู้ดูแลเขต: string; ProductType: string; โรงพยาบาล: string; ยอดขายรวมบาท: number; จำนวนรายการ: number }
  const sheet1Map = new Map<string, Sheet1Row>();
  const territoryRevenue = new Map<string, number>();

  for (const c of credits) {
    const territory = hospitalTerritory.get(c.salesLine.hospitalId) ?? "(ไม่ทราบเขต)";
    const share = Number(c.sharePercent) / 100;
    const amount = Number(c.salesLine.total) * share;
    territoryRevenue.set(territory, (territoryRevenue.get(territory) ?? 0) + amount);

    const productType = c.salesLine.product.productType.name;
    const hospitalName = c.salesLine.hospital.displayName;
    const key = `${territory}|||${productType}|||${hospitalName}`;
    const row = sheet1Map.get(key) ?? { เขต: territory, ผู้ดูแลเขต: "", ProductType: productType, โรงพยาบาล: hospitalName, ยอดขายรวมบาท: 0, จำนวนรายการ: 0 };
    row.ยอดขายรวมบาท += amount;
    row.จำนวนรายการ += 1;
    sheet1Map.set(key, row);
  }
  const territoryOwnerLabel = (key: string): string => {
    const t = TERRITORIES.find((t) => t.key === key);
    if (t) return t.owners.join(" + ");
    if (key === "(ไม่ทราบเขต)" || key.startsWith("(ไม่ทราบเขต")) return "(ไม่ทราบ)";
    return "(ไม่ทราบ)";
  };
  for (const row of sheet1Map.values()) row.ผู้ดูแลเขต = territoryOwnerLabel(row.เขต);
  const sheet1Rows = Array.from(sheet1Map.values()).sort((a, b) => a.เขต.localeCompare(b.เขต, "th") || b.ยอดขายรวมบาท - a.ยอดขายรวมบาท);

  // ---------- Sheet 1b: สรุปยอดเขต vs เป้า ----------
  interface SummaryRow { เขต: string; ผู้ดูแลเขต: string; ยอดขายสะสมบาท: number; เป้าต่อเดือนบาท: number; หมายเหตุ: string }
  const summaryRows: SummaryRow[] = TERRITORIES.map((t) => ({
    เขต: t.key,
    ผู้ดูแลเขต: t.owners.join(" + "),
    ยอดขายสะสมบาท: territoryRevenue.get(t.key) ?? 0,
    เป้าต่อเดือนบาท: t.targetPerMonth,
    หมายเหตุ: t.owners.length > 1 ? "ดูแลร่วมกัน — วัด KPI ระดับเขต ยังไม่แยกเครดิตรายคน (ตาม requirement.md ข้อ 22)" : "",
  }));
  const unknownRevenue = Array.from(territoryRevenue.entries()).filter(([k]) => !TERRITORIES.some((t) => t.key === k));
  for (const [k, v] of unknownRevenue) summaryRows.push({ เขต: k, ผู้ดูแลเขต: "(ไม่ทราบ)", ยอดขายสะสมบาท: v, เป้าต่อเดือนบาท: 0, หมายเหตุ: "จังหวัดยังไม่ได้ map เข้าเขต — ตรวจ Sheet mapping" });

  // ---------- Sheet 2: รพ.รัฐในเขต — เคยขาย/ยังไม่เคยขาย ----------
  const registryWb = new ExcelJS.Workbook();
  await registryWb.xlsx.readFile("C:\\Users\\sucha\\Downloads\\ขนาดเตียงรพ.xlsx");
  const registryWs = registryWb.worksheets[0];
  interface RegistryHospital { province: string; code: string; name: string; type: string; beds: number }
  const registryHospitals: RegistryHospital[] = [];
  for (let i = 2; i <= registryWs.rowCount; i++) {
    const row = registryWs.getRow(i).values as any[];
    if (!row[3]) continue;
    registryHospitals.push({ province: String(row[2] ?? ""), code: String(row[3] ?? ""), name: String(row[4] ?? ""), type: String(row[5] ?? ""), beds: Number(row[6] ?? 0) });
  }

  // Build a set of thaiCore(soldHospitalName) per territory from actual sales data, for exact-match "sold" detection.
  const soldCoreByTerritory = new Map<string, Set<string>>();
  for (const h of hospitals) {
    const territory = hospitalTerritory.get(h.id)!;
    const set = soldCoreByTerritory.get(territory) ?? new Set<string>();
    set.add(thaiCore(h.nameInFile));
    soldCoreByTerritory.set(territory, set);
  }

  interface Sheet2Row { เขต: string; ผู้ดูแลเขต: string; โรงพยาบาล: string; จังหวัด: string; ประเภท: string; เตียง: number; สถานะ: string }
  const sheet2Rows: Sheet2Row[] = [];
  for (const rh of registryHospitals) {
    const territory = THAI_PROVINCE_TO_TERRITORY[rh.province] ?? `(ไม่ทราบเขต — จังหวัด "${rh.province}" ยังไม่ได้จัดเขต)`;
    const owner = territoryOwnerLabel(territory);
    const soldSet = soldCoreByTerritory.get(territory) ?? new Set<string>();
    const matched = soldSet.has(thaiCore(rh.name));
    sheet2Rows.push({ เขต: territory, ผู้ดูแลเขต: owner, โรงพยาบาล: rh.name, จังหวัด: rh.province, ประเภท: rh.type, เตียง: rh.beds, สถานะ: matched ? "เคยขายแล้ว" : "ยังไม่เคยขาย" });
  }
  // Also list actually-sold hospitals in กท1/กท2 (registry has no Bangkok coverage) for completeness.
  for (const h of hospitals) {
    const territory = hospitalTerritory.get(h.id)!;
    if (territory === "กท1+ตะวันตก" || territory === "กท2+กลาง") {
      const isBangkok = (h.province ?? "").trim().toUpperCase() === "BANGKOK";
      if (isBangkok) {
        sheet2Rows.push({ เขต: territory, ผู้ดูแลเขต: territoryOwnerLabel(territory), โรงพยาบาล: h.displayName, จังหวัด: "กรุงเทพมหานคร", ประเภท: "(ไม่มีในทะเบียน สธ.)", เตียง: 0, สถานะ: "เคยขายแล้ว" });
      }
    }
  }
  sheet2Rows.sort((a, b) => a.เขต.localeCompare(b.เขต, "th") || a.สถานะ.localeCompare(b.สถานะ, "th") || a.โรงพยาบาล.localeCompare(b.โรงพยาบาล, "th"));

  // ---------- Sheet 3: สินค้าขายดีรายเขต ----------
  interface Sheet3Row { เขต: string; ผู้ดูแลเขต: string; ProductType: string; สินค้า: string; จำนวนที่ขายQty: number; ยอดขายบาท: number }
  const productSalesByTerritory = new Map<string, Map<string, Sheet3Row>>();
  const allProductNames = new Set<string>();

  for (const c of credits) {
    const territory = hospitalTerritory.get(c.salesLine.hospitalId) ?? "(ไม่ทราบเขต)";
    const share = Number(c.sharePercent) / 100;
    const amount = Number(c.salesLine.total) * share;
    const qty = Number(c.salesLine.qty) * share;
    const productName = c.salesLine.product.name;
    const productType = c.salesLine.product.productType.name;
    allProductNames.add(`${productType}|||${productName}`);

    const map = productSalesByTerritory.get(territory) ?? new Map<string, Sheet3Row>();
    const key = `${productType}|||${productName}`;
    const row = map.get(key) ?? { เขต: territory, ผู้ดูแลเขต: territoryOwnerLabel(territory), ProductType: productType, สินค้า: productName, จำนวนที่ขายQty: 0, ยอดขายบาท: 0 };
    row.จำนวนที่ขายQty += qty;
    row.ยอดขายบาท += amount;
    map.set(key, row);
    productSalesByTerritory.set(territory, map);
  }

  const sheet3Rows: (Sheet3Row & { อันดับในเขต: number | string })[] = [];
  for (const t of TERRITORIES) {
    const map = productSalesByTerritory.get(t.key) ?? new Map();
    const sold = Array.from(map.values()).sort((a, b) => b.จำนวนที่ขายQty - a.จำนวนที่ขายQty);
    sold.forEach((row, i) => sheet3Rows.push({ ...row, อันดับในเขต: i + 1 }));
    const soldKeys = new Set(sold.map((r) => `${r.ProductType}|||${r.สินค้า}`));
    for (const key of allProductNames) {
      if (soldKeys.has(key)) continue;
      const [productType, productName] = key.split("|||");
      sheet3Rows.push({ เขต: t.key, ผู้ดูแลเขต: t.owners.join(" + "), ProductType: productType, สินค้า: productName, จำนวนที่ขายQty: 0, ยอดขายบาท: 0, อันดับในเขต: "ไม่เคยขายในเขตนี้" });
    }
  }

  // ---------- Write workbook ----------
  const out = new ExcelJS.Workbook();

  const s0 = out.addWorksheet("สรุปยอดเขต vs เป้า");
  s0.columns = [
    { header: "เขต", key: "เขต", width: 18 }, { header: "ผู้ดูแลเขต", key: "ผู้ดูแลเขต", width: 40 },
    { header: "ยอดขายสะสมบาท", key: "ยอดขายสะสมบาท", width: 18 }, { header: "เป้าต่อเดือนบาท", key: "เป้าต่อเดือนบาท", width: 18 },
    { header: "หมายเหตุ", key: "หมายเหตุ", width: 50 },
  ];
  s0.addRows(summaryRows.map((r) => ({ เขต: r.เขต, ผู้ดูแลเขต: r.ผู้ดูแลเขต, ยอดขายสะสมบาท: Math.round(r.ยอดขายสะสมบาท * 100) / 100, เป้าต่อเดือนบาท: r.เป้าต่อเดือนบาท, หมายเหตุ: r.หมายเหตุ })));

  const s1 = out.addWorksheet("1. KPI รายเขต");
  s1.columns = [
    { header: "เขต", key: "เขต", width: 18 }, { header: "ผู้ดูแลเขต", key: "ผู้ดูแลเขต", width: 40 },
    { header: "Product Type", key: "ProductType", width: 20 }, { header: "โรงพยาบาลที่ขาย", key: "โรงพยาบาล", width: 45 },
    { header: "ยอดขายรวม (บาท)", key: "ยอดขายรวมบาท", width: 18 }, { header: "จำนวนรายการ", key: "จำนวนรายการ", width: 14 },
  ];
  s1.addRows(sheet1Rows.map((r) => ({ ...r, ยอดขายรวมบาท: Math.round(r.ยอดขายรวมบาท * 100) / 100 })));

  const s2 = out.addWorksheet("2. รพ.รัฐ เคยขาย-ไม่เคยขาย");
  s2.columns = [
    { header: "เขต", key: "เขต", width: 18 }, { header: "ผู้ดูแลเขต", key: "ผู้ดูแลเขต", width: 40 },
    { header: "โรงพยาบาล", key: "โรงพยาบาล", width: 40 }, { header: "จังหวัด", key: "จังหวัด", width: 16 },
    { header: "ประเภท (สธ.)", key: "ประเภท", width: 12 }, { header: "เตียง", key: "เตียง", width: 10 },
    { header: "สถานะ", key: "สถานะ", width: 16 },
  ];
  s2.addRows(sheet2Rows);

  const s3 = out.addWorksheet("3. สินค้าขายดีรายเขต");
  s3.columns = [
    { header: "เขต", key: "เขต", width: 18 }, { header: "ผู้ดูแลเขต", key: "ผู้ดูแลเขต", width: 40 },
    { header: "อันดับในเขต", key: "อันดับในเขต", width: 16 }, { header: "Product Type", key: "ProductType", width: 20 },
    { header: "สินค้า", key: "สินค้า", width: 35 }, { header: "จำนวนที่ขาย (Qty)", key: "จำนวนที่ขายQty", width: 16 },
    { header: "ยอดขาย (บาท)", key: "ยอดขายบาท", width: 16 },
  ];
  s3.addRows(sheet3Rows.map((r) => ({ ...r, จำนวนที่ขายQty: Math.round(r.จำนวนที่ขายQty * 1000) / 1000, ยอดขายบาท: Math.round(r.ยอดขายบาท * 100) / 100 })));

  const notes = out.addWorksheet("หมายเหตุ-ข้อจำกัด");
  notes.columns = [{ header: "ข้อจำกัดของรายงานนี้", key: "n", width: 120 }];
  notes.addRows([
    { n: "รายงานนี้เป็นรายงานเฉพาะกิจ (ad-hoc) ดึงจากข้อมูลจริง ณ วันที่สร้าง — ยังไม่ใช่ฟีเจอร์ถาวรในระบบ (Module K/L เรื่องเขตยังไม่ได้ออกแบบ schema จริง รอ system-analyst)" },
    { n: "การแบ่งจังหวัด -> เขต ใช้เกณฑ์ภูมิศาสตร์มาตรฐานที่ผู้เขียนรายงานกำหนดเอง (ไม่ใช่ข้อมูลที่ผู้ใช้ยืนยันทีละจังหวัด) โปรดตรวจสอบชีท 'สรุปยอดเขต vs เป้า' และแจ้งกลับหากมีจังหวัดที่จัดเขตผิด" },
    { n: "เขตกท1/กท2: แบ่งโรงพยาบาลกรุงเทพ 42 แห่งเป็น 2 กลุ่มเท่า ๆ กันตามลำดับตัวอักษรชื่อโรงพยาบาล (ผู้ใช้ยืนยันให้เลือกเอง 2026-08-16) ไม่ใช่การแบ่งเขตปกครองจริง" },
    { n: "ชีท 2: ทะเบียน รพ.รัฐจาก ขนาดเตียงรพ.xlsx ไม่มีข้อมูลกรุงเทพมหานครเลย (เป็นทะเบียนสังกัด สธ. เท่านั้น) จึงไม่มีรายการ 'ยังไม่เคยขาย' สำหรับเขต กท1/กท2 — แสดงเฉพาะที่เคยขายแล้วจากข้อมูลขาย" },
    { n: "การจับคู่ชื่อโรงพยาบาลระหว่างข้อมูลขายกับทะเบียน สธ. ใช้การเทียบ thaiCore (ตัดคำนำหน้า/อักขระที่ไม่ใช่ไทย) แบบตรงเป๊ะเท่านั้น ไม่ใช้ fuzzy matching — โรงพยาบาลที่สะกดต่างกันมากอาจจับคู่ไม่ได้และถูกนับเป็น 'ยังไม่เคยขาย' ทั้งที่จริงเคยขายแล้ว" },
    { n: "ชีท 3: 'ไม่เคยขายในเขตนี้' หมายถึงสินค้าที่เคยขายที่อื่นในบริษัทแต่ไม่เคยขายในเขตนั้น ไม่ใช่สินค้าทั้งหมดที่บริษัทมี เพราะระบบยังไม่มีทะเบียนสินค้ากลาง (ดู requirement.md Open Questions ข้อ 11)" },
    { n: "ยอดขายคำนวณผ่าน SalesLineCredit (หลัง Module J แก้ดีลแบ่งเครดิตแล้ว) ตรงกับตัวเลขที่ backend ใช้จริง" },
    { n: "Mr.Sathit Ratanakuakul (ขาย Cook Critical Care ครอบทุกเขต) ไม่ถูกรวมเป็นเจ้าของเขตใดในรายงานนี้ ตามที่ผู้ใช้ยืนยันว่าเขาวัดจากเป้าส่วนตัว (2 ล้าน/ปี) ไม่ผูกเขต — ยอดขายของเขายังปรากฏในชีท 1/3 ภายใต้เขตที่ รพ. นั้นตั้งอยู่ตามภูมิศาสตร์ปกติ ไม่ได้แยกออกมาต่างหาก เพราะข้อ 23 ในเอกสารยังไม่ยืนยัน 100%" },
  ]);

  const outPath = "C:\\Users\\sucha\\AppData\\Local\\Temp\\claude\\C--src-lung-lek\\e79444a6-0e53-42c9-97c5-ece938df7927\\scratchpad\\territory_reports_2026-08-16.xlsx";
  await out.xlsx.writeFile(outPath);
  console.log("Written to", outPath);
  console.log("Sheet1 rows:", sheet1Rows.length, "Sheet2 rows:", sheet2Rows.length, "Sheet3 rows:", sheet3Rows.length);
  const unknownTerritoryHospitals = hospitals.filter((h) => (hospitalTerritory.get(h.id) ?? "").startsWith("(ไม่ทราบเขต"));
  console.log("Hospitals with unresolved territory:", unknownTerritoryHospitals.length, unknownTerritoryHospitals.map((h) => h.province));
}

main().finally(() => prisma.$disconnect());
