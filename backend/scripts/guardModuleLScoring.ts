import * as fs from "fs";
import * as path from "path";
import {
  applyOutlierCut,
  computeRegionSuggestions,
  monthlyHistoryValue,
  UnitInvoice,
} from "../src/services/targetSuggestion.service";

// Phase 10 guard task: prove that no path in Module L touches ScoringWeight or Phase 4's composite
// score formula, and prove the Territory & Potential Rules contract properties on the pure math.
// Run: npm run guard:module-l   (exit 1 = violation)

const MODULE_L_FILES = [
  "src/services/targetSuggestion.service.ts",
  "src/services/tierWeight.service.ts",
  "src/controllers/targetSuggestion.controller.ts",
  "src/routes/targetSuggestion.routes.ts",
  "src/validators/targetSuggestion.validators.ts",
];

// ScoringWeight / ScoringWeightRevision / KpiMetric belong to Phase 4 only — any mention inside
// Module L source is already drift, even before anything executes.
const FORBIDDEN_IDENTIFIERS = ["scoringWeight", "scoringWeightRevision", "KpiMetric"];

let failures = 0;
function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`✓ ${label}`);
  } else {
    failures += 1;
    console.error(`✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function staticGuards() {
  const root = __dirname;
  for (const relative of MODULE_L_FILES) {
    const file = path.join(root, "..", relative);
    if (!fs.existsSync(file)) {
      check(`static: ${relative} exists`, false);
      continue;
    }
    const source = fs.readFileSync(file, "utf8");
    const hits = FORBIDDEN_IDENTIFIERS.filter((identifier) => source.includes(identifier));
    check(`static: ${relative} never references ScoringWeight/KpiMetric`, hits.length === 0, hits.join(", "));
  }
}

const EPSILON = 1e-9;
const close = (a: number, b: number) => Math.abs(a - b) < EPSILON;

function unit(territoryId: string, potential: number, coverage: number | null, historyBase: number) {
  return { territoryId, potential, territoryCoverage: coverage, historyBase };
}

function behaviorGuards() {
  const baseParams = {
    minRegionCoverage: 0.5,
    alpha: 0.5,
    monthsUsed: 3,
    growthRate: 1.0,
    rebalanceTargetByTerritory: null as Map<string, number> | null,
  };

  // ข้อ 5.3 cap + blend shape
  const blended = computeRegionSuggestions({
    ...baseParams,
    regionCoverage: 0.8,
    units: [
      unit("T1", 600, 1.0, 300),
      unit("T2", 400, 0.07, 300),
      unit("T3", 0, null, 300),
    ],
  });
  check("ข้อ 5.3: w ≤ 1 − alpha และ w ≤ personCoverage(cap) ทุกแถว", blended.rows.every((row) => row.w <= 1 - baseParams.alpha + EPSILON && row.w <= (row.territoryCoverage ?? 0) + EPSILON && row.w >= -EPSILON));
  const t1 = blended.rows.find((row) => row.territoryId === "T1")!;
  const t2 = blended.rows.find((row) => row.territoryId === "T2")!;
  check("ข้อ 5.3: suggested = (1−w)·historyBased + w·potentialBased", close(t1.suggested, 0.5 * t1.historyBased + 0.5 * t1.potentialBased));
  check("ข้อ 5.3: เพดาน coverage จำกัดฝั่งศักยภาพของคน coverage 7%", close(t2.w, 0.07));

  // ข้อ 3 gate — a region below minRegionCoverage gets w = 0 everywhere
  const gated = computeRegionSuggestions({ ...baseParams, regionCoverage: 0.2, units: [unit("T1", 100, 0.9, 300), unit("T2", 100, 1.0, 100)] });
  check("ข้อ 3: ภาคไม่ผ่าน minRegionCoverage → w = 0 ทุกเขต", gated.rows.every((row) => row.w === 0));

  // ข้อ 5.2 identity — Σ potentialBased = R (same money split by potential share)
  check("ข้อ 5.2: Σ potentialBased = R", close(blended.potentialBasedSum, blended.r), `${blended.potentialBasedSum} vs ${blended.r}`);

  // ข้อ 5.3 no renormalization — differing caps make Σ suggested ≠ R on purpose
  check("ข้อ 5.3: ห้าม renormalize — Σ suggested ≠ R เมื่อ w ต่างกันรายเขต", !close(blended.suggestedSum, blended.r));

  // ข้อ 5.5 assertion — alpha = 1.000 must reproduce historyBased exactly, including unmapped
  const alphaOne = computeRegionSuggestions({
    ...baseParams,
    alpha: 1,
    regionCoverage: 0.8,
    units: [unit("T1", 999999, 0.42, 300), unit("T2", 1, 0.99, 700)],
  });
  check(
    "ข้อ 5.5: alpha = 1.000 → suggested เท่ากับ historyBased พอดีทุกเขต",
    alphaOne.rows.every((row) => close(row.suggested, row.historyBased)) && close(alphaOne.suggestedSum, monthlyHistoryValue(1000, baseParams.monthsUsed, baseParams.growthRate))
  );

  // ข้อ 5.1 outlier — deal unit is one invoiceNo, divisor is the whole-window total of the unit,
  // cut list is explicit, reinstatement puts the deal back
  const invoices: UnitInvoice[] = [
    { invoiceNo: "INV-BIG", total: 60, byRegion: new Map([["R1", 50]]), unmapped: 10 },
    { invoiceNo: "INV-2", total: 25, byRegion: new Map([["R1", 25]]), unmapped: 0 },
    { invoiceNo: "INV-3", total: 15, byRegion: new Map(), unmapped: 15 },
  ];
  const cut = applyOutlierCut(invoices, 0.4, new Set());
  check("ข้อ 5.1: ดีลเกิน threshold ถูกตัดและรายงานพร้อมเลขใบกำกับ", cut.cutDeals.length === 1 && cut.cutDeals[0].invoiceNo === "INV-BIG");
  check("ข้อ 5.1: ตัวหารคือยอดรวมทุกภาค+unmapped ของหน่วย (60/100 > 0.40)", close(cut.cutDeals[0].ratio, 0.6));
  check("ข้อ 5.1: ฐานหลังตัด = ก่อนตัด − ดีลที่ถูกตัด (ทุก bucket)", close(cut.beforeByRegion.get("R1")!, 75) && close(cut.afterByRegion.get("R1")!, 25) && close(cut.beforeUnmapped, 25) && close(cut.afterUnmapped, 15));
  const restored = applyOutlierCut(invoices, 0.4, new Set(["INV-BIG"]));
  check("ข้อ 5.1: reinstate เอาดีลกลับเข้าฐานสำหรับ preview นี้", restored.cutDeals.length === 0 && close(restored.afterByRegion.get("R1")!, 75) && close(restored.afterUnmapped, 25));

  // ข้อ 5.4 — unmapped passes the history side 100%
  check("ข้อ 5.4: unmappedBase = ฐาน unmapped ÷ เดือน × growth แบบไม่ผสม", close(monthlyHistoryValue(90, 3, 1.2), 36) && close(monthlyHistoryValue(90, 0, 1.2), 0));

  // REBALANCE — R comes from the target snapshot instead of history
  const rebalance = computeRegionSuggestions({
    ...baseParams,
    regionCoverage: 0.8,
    rebalanceTargetByTerritory: new Map([["T1", 500], ["T2", 250]]),
    units: [unit("T1", 600, 1.0, 300), unit("T2", 400, 0.07, 300)],
  });
  check("ข้อ 5.2: โหมด REBALANCE ใช้ Σ Target snapshot เป็น R", close(rebalance.r, 750));
  check("ข้อ 5.2: REBALANCE ยังผสมด้วย w เดิม (ห้ามสลับสูตร)", close(rebalance.rows[0].suggested, 0.5 * rebalance.rows[0].historyBased + 0.5 * rebalance.rows[0].potentialBased));
}

staticGuards();
behaviorGuards();

if (failures > 0) {
  console.error(`\nguard:module-l FAILED — ${failures} check(s)`);
  process.exit(1);
}
console.log("\nguard:module-l passed — Module L never touches ScoringWeight/Phase 4 composite score, contract properties hold");
