import ExcelJS from "exceljs";
import { Request, Response } from "express";
import { getNeverSoldHospitals as getNeverSoldService, getTerritoryView } from "../services/territoryView.service";
import { NeverSoldQuery, TerritoryViewQuery } from "../validators/territoryView.validators";
import { canViewSalesperson } from "../services/viewerScope.service";

export async function getMyTerritoryView(req: Request, res: Response) {
  if (!(await canViewSalesperson(req.user!, req.params.salespersonId))) return res.status(403).json({ error: "Forbidden" });
  const result = await getTerritoryView(req.params.salespersonId, req.query as unknown as TerritoryViewQuery);
  if (!result) return res.status(404).json({ error: "Salesperson not found" });
  res.json({ period: req.query, ...result });
}

export async function exportMyTerritoryView(req: Request, res: Response) {
  if (!(await canViewSalesperson(req.user!, req.params.salespersonId))) return res.status(403).json({ error: "Forbidden" });
  const result = await getTerritoryView(req.params.salespersonId, req.query as unknown as TerritoryViewQuery);
  if (!result) return res.status(404).json({ error: "Salesperson not found" });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Territory view");
  sheet.columns = [
    { header: "รายการ", key: "type", width: 28 },
    { header: "โรงพยาบาล", key: "hospital", width: 40 },
    { header: "ยอดขาย", key: "revenue", width: 18 },
  ];
  result.soldHospitals.forEach((row) => sheet.addRow({ type: "ขายได้แล้ว", hospital: row.hospital.displayName, revenue: row.revenue }));
  result.soldBeforeButNotInPeriod.forEach((row) => sheet.addRow({ type: "เคยขายได้ แต่ไม่มีในงวดนี้", hospital: row.hospital.displayName }));
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=my-territory-view.xlsx");
  await workbook.xlsx.write(res);
  res.end();
}

export async function getNeverSoldHospitals(req: Request, res: Response) {
  if (!(await canViewSalesperson(req.user!, req.params.salespersonId))) return res.status(403).json({ error: "Forbidden" });
  const result = await getNeverSoldService(req.params.salespersonId, req.query as unknown as NeverSoldQuery);
  if (!result) return res.status(404).json({ error: "Salesperson not found" });
  res.json({ period: req.query, ...result });
}

export async function exportNeverSoldHospitals(req: Request, res: Response) {
  if (!(await canViewSalesperson(req.user!, req.params.salespersonId))) return res.status(403).json({ error: "Forbidden" });
  const result = await getNeverSoldService(req.params.salespersonId, req.query as unknown as NeverSoldQuery);
  if (!result) return res.status(404).json({ error: "Salesperson not found" });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Never-sold hospitals");
  sheet.columns = [
    { header: "อันดับ", key: "rank", width: 8 },
    { header: "โรงพยาบาล", key: "hospital", width: 40 },
    { header: "จังหวัด", key: "province", width: 20 },
    { header: "ระดับ (Tier)", key: "tier", width: 14 },
    { header: `ศักยภาพ (${result.potentialMetric})`, key: "metricValue", width: 20 },
    { header: "เขต", key: "territory", width: 20 },
  ];
  result.neverSoldHospitals.forEach((row, index) => {
    sheet.addRow({
      rank: index + 1,
      hospital: row.displayName,
      province: row.province,
      tier: row.tier ?? "—",
      metricValue: row.metricValue,
      territory: row.territory?.displayName ?? "—",
    });

  });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=never-sold-hospitals.xlsx");
  await workbook.xlsx.write(res);
  res.end();
}

