import { PrismaClient } from "@prisma/client";
import { normalizeProvince } from "../src/services/provinceMapping.service";

const prisma = new PrismaClient();
const REGIONS = ["เหนือ", "อีสาน", "กลาง", "ใต้", "กทม."] as const;
const PROVINCES: Record<(typeof REGIONS)[number], string[]> = {
  เหนือ: ["เชียงใหม่", "เชียงราย", "ลำปาง", "ลำพูน", "แม่ฮ่องสอน", "น่าน", "พะเยา", "แพร่", "อุตรดิตถ์", "อุทัยธานี", "กำแพงเพชร", "นครสวรรค์", "พิจิตร", "เพชรบูรณ์", "พิษณุโลก", "สุโขทัย", "ตาก"],
  อีสาน: ["กาฬสินธุ์", "ขอนแก่น", "ชัยภูมิ", "นครพนม", "นครราชสีมา", "บึงกาฬ", "บุรีรัมย์", "มหาสารคาม", "มุกดาหาร", "ยโสธร", "ร้อยเอ็ด", "เลย", "ศรีสะเกษ", "สกลนคร", "สุรินทร์", "หนองคาย", "หนองบัวลำภู", "อำนาจเจริญ", "อุดรธานี", "อุบลราชธานี"],
  กลาง: ["กาญจนบุรี", "ชัยนาท", "นครนายก", "นครปฐม", "นนทบุรี", "ปทุมธานี", "ประจวบคีรีขันธ์", "ปราจีนบุรี", "พระนครศรีอยุธยา", "เพชรบุรี", "ราชบุรี", "ลพบุรี", "สมุทรปราการ", "สมุทรสงคราม", "สมุทรสาคร", "สระบุรี", "สิงห์บุรี", "สุพรรณบุรี", "อ่างทอง", "จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ตราด", "ระยอง", "สระแก้ว"],
  ใต้: ["กระบี่", "ชุมพร", "ตรัง", "นครศรีธรรมราช", "นราธิวาส", "ปัตตานี", "พังงา", "พัทลุง", "ภูเก็ต", "ยะลา", "ระนอง", "สงขลา", "สตูล", "สุราษฎร์ธานี"],
  "กทม.": ["กรุงเทพมหานคร"],
};
const INPUT_ALIASES: Record<string, { canonicalName: string; isDistrictLevel?: boolean }> = {
  BURIRAM: { canonicalName: "บุรีรัมย์" }, SAMUTSAKORN: { canonicalName: "สมุทรสาคร" }, SMUTSAKORN: { canonicalName: "สมุทรสาคร" }, BANGKOK: { canonicalName: "กรุงเทพมหานคร" }, PHITSANULOK: { canonicalName: "พิษณุโลก" }, PHATUMTHANI: { canonicalName: "ปทุมธานี" }, UDONTHANI: { canonicalName: "อุดรธานี" }, CHANTABURI: { canonicalName: "จันทบุรี" }, CHANTHABURI: { canonicalName: "จันทบุรี" }, KHONEKEAN: { canonicalName: "ขอนแก่น" }, NAKHONSITHAMMARAT: { canonicalName: "นครศรีธรรมราช" }, NAKORNPATHOM: { canonicalName: "นครปฐม" }, NAKORNPRATHOM: { canonicalName: "นครปฐม" }, NAKHONPATHOM: { canonicalName: "นครปฐม" }, CHONBURI: { canonicalName: "ชลบุรี" }, ROIET: { canonicalName: "ร้อยเอ็ด" }, NONTHABURI: { canonicalName: "นนทบุรี" }, UTTARADIT: { canonicalName: "อุตรดิตถ์" }, CHIANGMAI: { canonicalName: "เชียงใหม่" }, CHAINGMAI: { canonicalName: "เชียงใหม่" }, SAKONNAKHON: { canonicalName: "สกลนคร" }, CHAIYAPUM: { canonicalName: "ชัยภูมิ" }, LOPBURI: { canonicalName: "ลพบุรี" }, SURIN: { canonicalName: "สุรินทร์" }, RAYONG: { canonicalName: "ระยอง" }, CHIANGRAI: { canonicalName: "เชียงราย" }, NAKHONRATCHASIMA: { canonicalName: "นครราชสีมา" }, NAKORNRACHASIMA: { canonicalName: "นครราชสีมา" }, NAKHONSAWAN: { canonicalName: "นครสวรรค์" }, SONGKHLA: { canonicalName: "สงขลา" }, SONGKLA: { canonicalName: "สงขลา" }, CHUMPHON: { canonicalName: "ชุมพร" }, PHANOMSARAKHAM: { canonicalName: "ฉะเชิงเทรา", isDistrictLevel: true }, LAMPANG: { canonicalName: "ลำปาง" }, UBONRATCHATHANI: { canonicalName: "อุบลราชธานี" }, MAHASAEAKHAM: { canonicalName: "มหาสารคาม" }, RATCHABURI: { canonicalName: "ราชบุรี" }, YASOTHON: { canonicalName: "ยโสธร" }, SAKAEO: { canonicalName: "สระแก้ว" }, SRABURI: { canonicalName: "สระบุรี" }, SARABURI: { canonicalName: "สระบุรี" }, SURATTHANI: { canonicalName: "สุราษฎร์ธานี" }, AYUTTHAYA: { canonicalName: "พระนครศรีอยุธยา" }, SRISAKET: { canonicalName: "ศรีสะเกษ" }, SISAKET: { canonicalName: "ศรีสะเกษ" }, KANCHANABURI: { canonicalName: "กาญจนบุรี" }, KANJANABURI: { canonicalName: "กาญจนบุรี" }, KAYCNABURI: { canonicalName: "กาญจนบุรี" }, CHAINAT: { canonicalName: "ชัยนาท" }, SAMUTPRAKARN: { canonicalName: "สมุทรปราการ" }, KALASIN: { canonicalName: "กาฬสินธุ์" }, TRANG: { canonicalName: "ตรัง" }, KRABI: { canonicalName: "กระบี่" }, KAMPHANGPHET: { canonicalName: "กำแพงเพชร" }, MAEHONGSON: { canonicalName: "แม่ฮ่องสอน" }, PHUNGNGA: { canonicalName: "พังงา" }, NAN: { canonicalName: "น่าน" }, NAKHONNAYOK: { canonicalName: "นครนายก" }, PHUKET: { canonicalName: "ภูเก็ต" }, UTHAITHANI: { canonicalName: "อุทัยธานี" }, PHAYAO: { canonicalName: "พะเยา" }, SUPANBURI: { canonicalName: "สุพรรณบุรี" }, UBONRATCHANI: { canonicalName: "อุบลราชธานี" }, NARATHIWAT: { canonicalName: "นราธิวาส" }, HATYAI: { canonicalName: "สงขลา", isDistrictLevel: true },
};

async function main() {
  const regionByName = new Map<string, string>();
  for (const [sortOrder, name] of REGIONS.entries()) {
    const region = await prisma.region.upsert({ where: { name }, update: { sortOrder: sortOrder + 1 }, create: { name, sortOrder: sortOrder + 1 } });
    regionByName.set(name, region.id);
  }
  const provinceByNormalizedName = new Map<string, string>();
  for (const [regionName, provinces] of Object.entries(PROVINCES) as [keyof typeof PROVINCES, string[]][]) {
    for (const canonicalName of provinces) {
      const province = await prisma.provinceMapping.upsert({ where: { canonicalName }, update: { regionId: regionByName.get(regionName)! }, create: { canonicalName, regionId: regionByName.get(regionName)! } });
      provinceByNormalizedName.set(normalizeProvince(canonicalName), province.id);
    }
  }
  const rawProvinces = await prisma.salesLine.findMany({ distinct: ["province"], select: { province: true }, where: { province: { not: null } } });
  let aliasesSeeded = 0;
  const unknownAliases: string[] = [];
  for (const { province: sampleRaw } of rawProvinces) {
    if (!sampleRaw) continue;
    const normalizedAlias = normalizeProvince(sampleRaw);
    const inputAlias = INPUT_ALIASES[normalizedAlias];
    const provinceMappingId = inputAlias
      ? provinceByNormalizedName.get(normalizeProvince(inputAlias.canonicalName))
      : provinceByNormalizedName.get(normalizedAlias);
    if (!provinceMappingId) { unknownAliases.push(sampleRaw); continue; }
    await prisma.provinceAlias.upsert({ where: { normalizedAlias }, update: { sampleRaw, provinceMappingId, isDistrictLevel: inputAlias?.isDistrictLevel ?? false }, create: { normalizedAlias, sampleRaw, provinceMappingId, isDistrictLevel: inputAlias?.isDistrictLevel ?? false } });
    aliasesSeeded++;
  }
  for (const hospital of await prisma.hospital.findMany({ select: { id: true, province: true } })) {
    const provinceMappingId = hospital.province ? provinceByNormalizedName.get(normalizeProvince(hospital.province)) : undefined;
    if (provinceMappingId) await prisma.hospital.update({ where: { id: hospital.id }, data: { provinceMappingId } });
  }
  if (unknownAliases.length) throw new Error(`Unmapped province aliases: ${unknownAliases.join(", ")}`);
  console.log(JSON.stringify({ regions: REGIONS.length, provinces: 77, aliasesSeeded }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
