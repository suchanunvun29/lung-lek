import ExcelJS from "exceljs";
import { Request, Response } from "express";
import { getTerritoryProductRanking } from "../services/territoryProductRanking.service";
import { TerritoryProductQuery } from "../validators/territoryProductRanking.validators";
import { resolveViewerScope } from "../services/viewerScope.service";

// Data Visibility Rules ข้อ 6: this page is all money figures, so only viewers with
// TERRITORY_FULL on the territory get it — MANAGER anywhere, supervisor or member of this one.
async function allowed(req: Request) {
  const scope = await resolveViewerScope(req.user!);
  return scope.canSeeEveryone || scope.memberTerritoryIds.includes(req.params.territoryId) || scope.supervisedTerritoryIds.includes(req.params.territoryId);
}

export async function getRanking(req: Request, res: Response) {
  if (!(await allowed(req))) return res.status(403).json({ error: "Forbidden" });
  const result = await getTerritoryProductRanking(req.params.territoryId, req.query as unknown as TerritoryProductQuery);
  if (!result) return res.status(404).json({ error: "Territory not found" });
  // personalBucket is MANAGER-only (ข้อ 6) — stripped before sending to anyone else.
  const { personalBucket, ...safe } = result;
  res.json({ period: req.query, ...safe, ...(req.user!.role === "MANAGER" ? { personalBucket } : {}) });
}

export async function exportRanking(req: Request, res: Response) {
  if (!(await allowed(req))) return res.status(403).json({ error: "Forbidden" });
  const result = await getTerritoryProductRanking(req.params.territoryId, req.query as unknown as TerritoryProductQuery);
  if (!result) return res.status(404).json({ error: "Territory not found" });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Product ranking");
  sheet.addRow([result.zeroSaleWarning]);
  sheet.addRow(["รหัส", "สินค้า", "กลุ่ม", "เขต", "ผู้ดูแลเขต", "ยอดขาย", "จำนวน", "สถานะ"]);
  for (const item of result.items) {
    sheet.addRow([
      item.code,
      item.name,
      item.productType.name,
      result.territory.name,
      result.territory.ownerNames.join(", "),
      item.revenue,
      item.quantity,
      item.zeroSaleStatus ?? "",
    ]);
  }
  // personalBucket exists in the payload only for MANAGER (same gate as the screen).
  for (const item of result.personalBucket) {
    sheet.addRow(["(personalBucket)", item.name, item.productType.name, result.territory.name, result.territory.ownerNames.join(", "), item.revenue, item.quantity, ""]);
  }
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="territory-product-ranking-${req.params.territoryId}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}
