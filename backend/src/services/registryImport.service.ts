import ExcelJS from "exceljs";
import { PotentialMetricKey } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { resolveProvinceMapping } from "./provinceMapping.service";
import { linkHospitalsToRegistry } from "./registryLink.service";

const MAX_HEADER_SEARCH_ROWS = 10;
const REQUIRED_HEADERS = ["จังหวัด", "รหัส ร.พ.", "โรงพยาบาล", "ประเภท", "เขต"] as const;
const METRIC_COLUMNS: { header: string; metric: PotentialMetricKey }[] = [
  { header: "เตียง", metric: "BEDS" },
  { header: "CMI", metric: "CMI" },
  { header: "SumAdjRW", metric: "SUM_ADJ_RW" },
  { header: "อัตราครองเตียง", metric: "OCCUPANCY_RATE" },
  { header: "จำนวนคำนวณ", metric: "PATIENTS" },
];

function cellText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return value.text.trim();
  return String(value).trim();
}

function cellNumber(value: ExcelJS.CellValue) {
  const result = Number(cellText(value).replace(/,/g, ""));
  return Number.isFinite(result) ? result : null;
}

export async function importRegistry(fileBuffer: Uint8Array, fileName: string, fileSizeBytes: number, uploadedById: string) {
  const batch = await prisma.importBatch.create({ data: { fileName, fileSizeBytes, uploadedById, status: "PROCESSING" } });
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("HEADER_NOT_FOUND");

    let headers: Map<string, number> | undefined;
    let headerRowNumber = 0;
    for (let rowNumber = 1; rowNumber <= Math.min(MAX_HEADER_SEARCH_ROWS, sheet.rowCount); rowNumber++) {
      const rowHeaders = new Map<string, number>();
      sheet.getRow(rowNumber).eachCell((cell, columnNumber) => rowHeaders.set(cellText(cell.value), columnNumber));
      if (REQUIRED_HEADERS.every((header) => rowHeaders.has(header))) {
        headers = rowHeaders;
        headerRowNumber = rowNumber;
        break;
      }
    }
    if (!headers) throw new Error("HEADER_NOT_FOUND");

    let insertedRows = 0;
    let updatedRows = 0;
    let skippedRows = 0;
    const issues: { importBatchId: string; sheetName: string; rowNumber?: number; level: "WARNING" | "ERROR"; code: string; message: string }[] = [];
    for (const ignored of workbook.worksheets.slice(1)) {
      issues.push({ importBatchId: batch.id, sheetName: ignored.name, level: "WARNING", code: "SHEET_IGNORED", message: `ข้าม sheet ${ignored.name}` });
    }

    for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const nameInFile = cellText(row.getCell(headers.get("โรงพยาบาล")!).value);
      if (!nameInFile) {
        skippedRows++;
        continue;
      }
      const provinceRaw = cellText(row.getCell(headers.get("จังหวัด")!).value);
      const sourceCode = cellText(row.getCell(headers.get("รหัส ร.พ.")!).value) || null;
      const province = await resolveProvinceMapping(provinceRaw);
      const existing = sourceCode
        ? await prisma.hospitalRegistry.findUnique({ where: { sourceCode } })
        : await prisma.hospitalRegistry.findUnique({ where: { nameInFile_provinceRaw: { nameInFile, provinceRaw } } });
      const registryData = {
        displayName: nameInFile,
        provinceMappingId: province?.id ?? null,
        regionId: province?.regionId ?? null,
        healthZone: cellText(row.getCell(headers.get("เขต")!).value) || null,
        tier: cellText(row.getCell(headers.get("ประเภท")!).value) || null,
        sourceFile: fileName,
      };
      const registry = existing
        ? await prisma.hospitalRegistry.update({ where: { id: existing.id }, data: registryData })
        : await prisma.hospitalRegistry.create({ data: { sourceCode, nameInFile, provinceRaw, ...registryData } });
      existing ? updatedRows++ : insertedRows++;

      for (const { header, metric } of METRIC_COLUMNS) {
        const columnNumber = headers.get(header);
        if (!columnNumber) continue;
        const value = cellNumber(row.getCell(columnNumber).value);
        if (value === null) continue;
        const metricRow = await prisma.hospitalPotentialMetric.findFirst({ where: { hospitalRegistryId: registry.id, metric, periodYear: null, periodMonth: null } });
        if (metricRow) await prisma.hospitalPotentialMetric.update({ where: { id: metricRow.id }, data: { value, sourceFile: fileName } });
        else await prisma.hospitalPotentialMetric.create({ data: { hospitalRegistryId: registry.id, metric, value, sourceFile: fileName } });
      }
    }

    if (issues.length) await prisma.importIssue.createMany({ data: issues });
    const links = await linkHospitalsToRegistry();
    const importBatch = await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: "SUCCESS", finishedAt: new Date(), sheetsFound: workbook.worksheets.map((worksheet) => worksheet.name), sheetsImported: [sheet.name], totalRows: sheet.rowCount - headerRowNumber, insertedRows, updatedRows, skippedRows, errorRows: 0 },
      include: { issues: true },
    });
    return { importBatch, links };
  } catch (error) {
    await prisma.importBatch.update({ where: { id: batch.id }, data: { status: "FAILED", finishedAt: new Date(), errorMessage: error instanceof Error ? error.message : "Registry import failed" } });
    throw error;
  }
}
