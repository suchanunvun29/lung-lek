import ExcelJS, { Row, Worksheet } from "exceljs";
import { ArchiveReason, ImportIssueLevel, ImportMode, ImportStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  assertSharesSumTo100,
  buildHospitalIndex,
  buildSalespersonIndex,
  resolveHospitalViaAlias,
  resolveSalesmanCredits,
} from "./creditResolution.service";
import { buildProductIndex, resolveProductViaAlias } from "./productResolution.service";

const MAX_HEADER_SEARCH_ROWS = 10;
const TOTAL_MISMATCH_TOLERANCE = 0.05;
const VAT_INCLUSIVE_DIVISOR = 1.07;
// Excel's date system counts from 1899-12-30; this is the standard serial->epoch offset in days.
const EXCEL_EPOCH_OFFSET_DAYS = 25569;
const MS_PER_DAY = 86400000;
// A monthly file import runs a few hundred sequential upserts against a remote DB — default
// Prisma interactive-transaction timeouts (5s) are far too short for that.
const IMPORT_TRANSACTION_TIMEOUT_MS = 10 * 60 * 1000;
const IMPORT_TRANSACTION_MAX_WAIT_MS = 30_000;
// Master-data lookup (Hospital/Salesperson/ProductType/Product) is find-then-create with
// case-insensitive matching, which the plain DB unique constraints (case-sensitive) can't
// enforce atomically. Two concurrent imports racing to create the same name would otherwise
// deadlock/timeout or throw a unique constraint violation. A transaction-scoped Postgres
// advisory lock serializes imports without touching the schema; it auto-releases on commit
// or rollback, so no manual unlock is needed. The key is an arbitrary fixed constant shared
// by every import transaction.
const IMPORT_ADVISORY_LOCK_KEY = 872341987;

type ColumnKey =
  | "hospitalName"
  | "salesman"
  | "invDate"
  | "year"
  | "month"
  | "invNo"
  | "poNo"
  | "productType"
  | "productName"
  | "lot"
  | "exp"
  | "province"
  | "qty"
  | "price"
  | "amount"
  | "vat"
  | "total";

const COLUMN_DEFINITIONS: { key: ColumnKey; label: string }[] = [
  { key: "hospitalName", label: "Hospital Name" },
  { key: "salesman", label: "Salesman" },
  { key: "invDate", label: "Inv Date" },
  { key: "year", label: "Year" },
  { key: "month", label: "Month" },
  { key: "invNo", label: "Inv No." },
  { key: "poNo", label: "Po NO." },
  { key: "productType", label: "Product type" },
  { key: "productName", label: "Product Name" },
  { key: "lot", label: "Lot" },
  { key: "exp", label: "Exp" },
  { key: "province", label: "Province" },
  { key: "qty", label: "Qty" },
  { key: "price", label: "Price" },
  { key: "amount", label: "Amount" },
  { key: "vat", label: "Vat" },
  { key: "total", label: "Total" },
];

type ColumnMap = Record<ColumnKey, number>;

interface ParsedRow {
  rowNumber: number;
  hospitalName: string;
  salesmanRaw: string;
  invoiceDate: Date;
  year: number;
  month: number;
  invoiceNo: string;
  poNo: string | null;
  productTypeName: string;
  productName: string;
  lot: string | null;
  expiryDate: Date | null;
  province: string | null;
  qty: number;
  unitPrice: number;
  amount: number;
  vat: number;
  total: number;
  rowKey: string;
}

interface IssueInput {
  level: ImportIssueLevel;
  code: string;
  message: string;
  sheetName?: string;
  rowNumber?: number;
  columnName?: string;
}

interface ImportSalesFileParams {
  fileBuffer: Buffer;
  fileName: string;
  fileSizeBytes: number;
  uploadedById: string;
  mode?: "APPEND" | "REPLACE_PERIOD";
  targetPeriods?: Period[];
  confirm?: boolean;
}

interface Period {
  year: number;
  month: number;
}

interface DeleteSalesPeriodsParams {
  uploadedById: string;
  targetPeriods: Period[];
  confirm?: boolean;
}

export class ImportInProgressError extends Error {}

class DryRunComplete extends Error {
  constructor(readonly preview: DryRunPreview) {
    super("Dry run complete");
  }
}

interface DryRunPreview {
  targetPeriods: Period[];
  existingRows: number;
  existingTotal: string;
  insertedRows: number;
  updatedRows: number;
  removedRows: number;
  removalSamples: { invoiceNo: string; hospitalName: string; total: string }[];
  willDeletePeriodWithoutReplacement: boolean;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function cellToDisplayString(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray((value as { richText: { text: string }[] }).richText)) {
      return (value as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
    }
    if ("text" in value) return String((value as { text: unknown }).text);
    if ("result" in value) return String((value as { result: unknown }).result ?? "");
  }
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function cellToTrimmedString(value: ExcelJS.CellValue): string {
  return cellToDisplayString(value).trim();
}

function cellToNumber(value: ExcelJS.CellValue): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object" && "result" in value) {
    const result = (value as { result: unknown }).result;
    if (typeof result === "number" && Number.isFinite(result)) return result;
    if (typeof result === "string") {
      const parsed = Number(result.replace(/,/g, "").trim());
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    if (cleaned === "") return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function cellToDate(value: ExcelJS.CellValue): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = Math.round((value - EXCEL_EPOCH_OFFSET_DAYS) * MS_PER_DAY);
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "object" && "result" in value) {
    return cellToDate((value as { result: ExcelJS.CellValue }).result);
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function findHeaderRow(worksheet: Worksheet): { rowNumber: number; columnMap: ColumnMap } | null {
  const maxRow = Math.min(MAX_HEADER_SEARCH_ROWS, worksheet.rowCount);
  for (let r = 1; r <= maxRow; r++) {
    const row = worksheet.getRow(r);
    const columnByNormalizedLabel = new Map<string, number>();
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = cellToDisplayString(cell.value);
      if (text) columnByNormalizedLabel.set(normalizeHeader(text), colNumber);
    });

    const columnMap = {} as ColumnMap;
    let allFound = true;
    for (const def of COLUMN_DEFINITIONS) {
      const col = columnByNormalizedLabel.get(normalizeHeader(def.label));
      if (col === undefined) {
        allFound = false;
        break;
      }
      columnMap[def.key] = col;
    }
    if (allFound) return { rowNumber: r, columnMap };
  }
  return null;
}

function isRowEmpty(row: Row, columnMap: ColumnMap): boolean {
  return Object.values(columnMap).every((col) => {
    const value = row.getCell(col).value;
    return value == null || cellToTrimmedString(value) === "";
  });
}

function parseDataRow(
  row: Row,
  rowNumber: number,
  columnMap: ColumnMap,
  occurrenceCounts: Map<string, number>
): { data: ParsedRow | null; issues: IssueInput[] } {
  const issues: IssueInput[] = [];
  const get = (key: ColumnKey) => row.getCell(columnMap[key]).value;

  const hospitalName = cellToTrimmedString(get("hospitalName"));
  const salesmanRaw = cellToTrimmedString(get("salesman"));
  const invoiceNo = cellToTrimmedString(get("invNo"));
  const productName = cellToTrimmedString(get("productName"));
  const productTypeName = cellToTrimmedString(get("productType"));
  const totalRaw = get("total");
  const totalIsEmpty = totalRaw == null || cellToTrimmedString(totalRaw) === "";

  const missingFields: string[] = [];
  if (!hospitalName) missingFields.push("Hospital Name");
  if (!salesmanRaw) missingFields.push("Salesman");
  if (!invoiceNo) missingFields.push("Inv No.");
  if (!productName) missingFields.push("Product Name");
  if (!productTypeName) missingFields.push("Product type");
  if (totalIsEmpty) missingFields.push("Total");

  if (missingFields.length > 0) {
    issues.push({
      level: "ERROR",
      code: "MISSING_REQUIRED",
      columnName: missingFields.join(", "),
      message: `ข้อมูลจำเป็นว่าง: ${missingFields.join(", ")}`,
    });
    return { data: null, issues };
  }

  const qty = cellToNumber(get("qty"));
  const unitPrice = cellToNumber(get("price"));
  const total = cellToNumber(totalRaw);
  if (qty === null || unitPrice === null || total === null) {
    issues.push({ level: "ERROR", code: "INVALID_NUMBER", message: "Qty/Price/Total แปลงเป็นตัวเลขไม่ได้" });
    return { data: null, issues };
  }

  const invoiceDate = cellToDate(get("invDate"));
  if (!invoiceDate) {
    issues.push({ level: "ERROR", code: "INVALID_DATE", message: "Inv Date แปลงเป็นวันที่ไม่ได้" });
    return { data: null, issues };
  }

  const poNo = cellToTrimmedString(get("poNo")) || null;
  const lot = cellToTrimmedString(get("lot")) || null;
  const province = cellToTrimmedString(get("province")) || null;
  const expiryDate = cellToDate(get("exp"));

  const yearRaw = cellToNumber(get("year"));
  const monthRaw = cellToNumber(get("month"));
  const year = yearRaw ?? invoiceDate.getUTCFullYear();
  const month = monthRaw ?? invoiceDate.getUTCMonth() + 1;

  let amount = cellToNumber(get("amount"));
  if (amount === null) {
    amount = round2(total / VAT_INCLUSIVE_DIVISOR);
    issues.push({
      level: "WARNING",
      code: "AMOUNT_RECOMPUTED",
      message: `Amount ว่าง คำนวณจาก Total/${VAT_INCLUSIVE_DIVISOR} = ${amount}`,
    });
  }

  let vat = cellToNumber(get("vat"));
  if (vat === null) {
    vat = round2(total - amount);
  }

  if (
    Math.abs(total - (amount + vat)) > TOTAL_MISMATCH_TOLERANCE ||
    Math.abs(total - qty * unitPrice) > TOTAL_MISMATCH_TOLERANCE
  ) {
    issues.push({
      level: "WARNING",
      code: "TOTAL_MISMATCH",
      message: `Total (${total}) ไม่ตรงกับ Amount+Vat (${round2(amount + vat)}) หรือ Qty×Price (${round2(qty * unitPrice)})`,
    });
  }

  if (year !== invoiceDate.getUTCFullYear() || month !== invoiceDate.getUTCMonth() + 1) {
    issues.push({
      level: "WARNING",
      code: "DATE_PERIOD_MISMATCH",
      message: `Year/Month (${year}/${month}) ไม่ตรงกับ Inv Date (${invoiceDate.toISOString().slice(0, 10)})`,
    });
  }

  if (total < 0) {
    issues.push({ level: "WARNING", code: "NEGATIVE_AMOUNT", message: `Total ติดลบ: ${total}` });
  }

  // Matches invoiceNo+productName+lot as the naive dedupe key, then appends an occurrence
  // index so multiple genuine line items sharing that combination aren't collapsed into one.
  const dedupeBaseKey = `${invoiceNo}|${productName}|${lot ?? ""}`;
  const occurrenceIndex = (occurrenceCounts.get(dedupeBaseKey) ?? 0) + 1;
  occurrenceCounts.set(dedupeBaseKey, occurrenceIndex);
  const rowKey = `${dedupeBaseKey}|${occurrenceIndex}`;

  return {
    data: {
      rowNumber,
      hospitalName,
      salesmanRaw,
      invoiceDate,
      year,
      month,
      invoiceNo,
      poNo,
      productTypeName,
      productName,
      lot,
      expiryDate,
      province,
      qty,
      unitPrice,
      amount,
      vat,
      total,
      rowKey,
    },
    issues,
  };
}

type TxClient = Prisma.TransactionClient;

async function resolveProductType(tx: TxClient, cache: Map<string, string>, name: string): Promise<string> {
  const cacheKey = name.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let productType = await tx.productType.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (!productType) {
    productType = await tx.productType.create({ data: { name } });
  }
  cache.set(cacheKey, productType.id);
  return productType.id;
}

function periodKey(year: number, month: number): string {
  return `${year}-${month}`;
}

async function markInsightsStaleForTouchedPeriods(
  periodsTouched: Set<string>,
  client: Pick<Prisma.TransactionClient, "coachingInsight"> = prisma
): Promise<void> {
  if (periodsTouched.size === 0) return;

  const monthPeriods = [...periodsTouched].map((key) => {
    const [year, month] = key.split("-").map(Number);
    return { year, month };
  });
  const quarterKeys = new Set<string>();
  const years = new Set<number>();
  for (const { year, month } of monthPeriods) {
    quarterKeys.add(`${year}-${Math.ceil(month / 3)}`);
    years.add(year);
  }

  const updates = [
    ...monthPeriods.map(({ year, month }) =>
      client.coachingInsight.updateMany({ where: { periodType: "MONTH", year, periodNumber: month }, data: { isStale: true } })
    ),
    ...[...quarterKeys].map((key) => {
      const [year, quarter] = key.split("-").map(Number);
      return client.coachingInsight.updateMany({
        where: { periodType: "QUARTER", year, periodNumber: quarter },
        data: { isStale: true },
      });
    }),
    ...[...years].map((year) =>
      client.coachingInsight.updateMany({ where: { periodType: "YEAR", year, periodNumber: 0 }, data: { isStale: true } })
    ),
  ];

  await Promise.all(updates);
}

function determineStatus(totalRows: number, errorRows: number, insertedRows: number, updatedRows: number): ImportStatus {
  if (totalRows === 0) return "SUCCESS";
  if (errorRows === 0) return "SUCCESS";
  if (insertedRows + updatedRows === 0) return "FAILED";
  return "PARTIAL";
}

async function importSalesFileLegacy({ fileBuffer, fileName, fileSizeBytes, uploadedById }: ImportSalesFileParams) {
  const inProgress = await prisma.importBatch.findFirst({ where: { status: "PROCESSING" }, select: { id: true } });
  if (inProgress) throw new ImportInProgressError();

  const batch = await prisma.importBatch.create({
    data: { fileName, fileSizeBytes, uploadedById, status: "PROCESSING" },
  });

  const issues: IssueInput[] = [];

  let sheetNames: string[] = [];
  let totalRows = 0;
  let errorRows = 0;
  let insertedRows = 0;
  let updatedRows = 0;
  let periodsTouched = new Set<string>();

  try {
    const workbook = new ExcelJS.Workbook();
    // exceljs's bundled Buffer type and @types/node's Buffer generic parameter don't line up
    // structurally even though both are Node's Buffer at runtime.
    await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);

    sheetNames = workbook.worksheets.map((ws) => ws.name);
    const firstSheet = workbook.worksheets[0];
    if (!firstSheet) {
      throw new Error("ไฟล์ไม่มี sheet ใด ๆ");
    }

    for (const sheet of workbook.worksheets.slice(1)) {
      issues.push({
        level: "WARNING",
        code: "SHEET_IGNORED",
        sheetName: sheet.name,
        message: `ข้าม sheet "${sheet.name}" — นำเข้าเฉพาะ sheet แรกของไฟล์เท่านั้น`,
      });
    }

    const header = findHeaderRow(firstSheet);
    if (!header) {
      issues.push({
        level: "ERROR",
        code: "HEADER_NOT_FOUND",
        sheetName: firstSheet.name,
        message: `ไม่พบแถว header ที่มีคอลัมน์ครบใน ${MAX_HEADER_SEARCH_ROWS} แถวแรกของ sheet "${firstSheet.name}"`,
      });
      await prisma.importIssue.createMany({ data: issues.map((issue) => ({ ...issue, importBatchId: batch.id })) });
      await prisma.importBatch.update({
        where: { id: batch.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          sheetsFound: sheetNames,
          errorMessage: "Header row not found",
        },
      });
      return prisma.importBatch.findUniqueOrThrow({ where: { id: batch.id }, include: { issues: true } });
    }

    const { rowNumber: headerRowNumber, columnMap } = header;
    const occurrenceCounts = new Map<string, number>();
    const parsedRows: ParsedRow[] = [];

    for (let r = headerRowNumber + 1; r <= firstSheet.rowCount; r++) {
      const row = firstSheet.getRow(r);
      if (isRowEmpty(row, columnMap)) continue;

      totalRows++;
      const { data, issues: rowIssues } = parseDataRow(row, r, columnMap, occurrenceCounts);
      for (const issue of rowIssues) {
        issues.push({ ...issue, sheetName: firstSheet.name, rowNumber: r });
      }
      if (!data) {
        errorRows++;
        continue;
      }
      parsedRows.push(data);
    }

    let creditErrorRows = 0;

    ({ insertedRows, updatedRows, periodsTouched } = await prisma.$transaction(
      async (tx) => {
        const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(${IMPORT_ADVISORY_LOCK_KEY}) AS locked
        `;
        if (!locked) {
          throw new Error("มีการนำเข้าไฟล์อื่นกำลังดำเนินการอยู่ กรุณารอให้เสร็จก่อนแล้วลองใหม่อีกครั้ง");
        }

        const hospitalIndex = await buildHospitalIndex(tx);
        const salespersonIndex = await buildSalespersonIndex(tx);
        const productTypeCache = new Map<string, string>();
        const productIndex = await buildProductIndex(tx);
        const periodsTouchedSet = new Set<string>();

        const rowKeys = parsedRows.map((row) => row.rowKey);
        const existingRows = rowKeys.length
          ? await tx.salesLine.findMany({ where: { rowKey: { in: rowKeys } }, select: { id: true, rowKey: true } })
          : [];
        const existingSalesLineByRowKey = new Map(existingRows.map((row) => [row.rowKey, row.id]));

        let inserted = 0;
        let updated = 0;

        for (const row of parsedRows) {
          const credits = await resolveSalesmanCredits(
            tx,
            salespersonIndex,
            row.salesmanRaw,
            issues,
            firstSheet.name,
            row.rowNumber
          );
          if (!credits) {
            creditErrorRows++;
            continue;
          }
          assertSharesSumTo100(credits);

          const hospitalId = await resolveHospitalViaAlias(
            tx,
            hospitalIndex,
            row.hospitalName,
            row.province,
            issues,
            firstSheet.name,
            row.rowNumber
          );
          const productTypeId = await resolveProductType(tx, productTypeCache, row.productTypeName);
          const product = await resolveProductViaAlias(tx, productIndex, row.productName, productTypeId);

          const primaryCredit = credits.find((c) => c.isPrimary) ?? credits[0];

          const salesLineData = {
            invoiceNo: row.invoiceNo,
            poNo: row.poNo,
            invoiceDate: row.invoiceDate,
            year: row.year,
            month: row.month,
            hospitalId,
            salespersonId: primaryCredit.salespersonId,
            productId: product.id,
            productTypeId: product.productTypeId,
            lot: row.lot,
            expiryDate: row.expiryDate,
            province: row.province,
            qty: row.qty,
            unitPrice: row.unitPrice,
            amount: row.amount,
            vat: row.vat,
            total: row.total,
            sourceSheetName: firstSheet.name,
            sourceRowNumber: row.rowNumber,
            importBatchId: batch.id,
          };

          let salesLineId: string;
          const existingId = existingSalesLineByRowKey.get(row.rowKey);
          if (existingId) {
            await tx.salesLine.update({ where: { id: existingId }, data: salesLineData });
            await tx.salesLineCredit.deleteMany({ where: { salesLineId: existingId } });
            salesLineId = existingId;
            updated++;
          } else {
            const created = await tx.salesLine.create({ data: { ...salesLineData, rowKey: row.rowKey } });
            salesLineId = created.id;
            inserted++;
          }

          await tx.salesLineCredit.createMany({
            data: credits.map((credit) => ({
              salesLineId,
              salespersonId: credit.salespersonId,
              sharePercent: credit.sharePercent,
              isPrimary: credit.isPrimary,
            })),
          });

          periodsTouchedSet.add(periodKey(row.year, row.month));
        }

        return { insertedRows: inserted, updatedRows: updated, periodsTouched: periodsTouchedSet };
      },
      { timeout: IMPORT_TRANSACTION_TIMEOUT_MS, maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS }
    ));

    errorRows += creditErrorRows;

    const status = determineStatus(totalRows, errorRows, insertedRows, updatedRows);
    const periodsTouchedArray = [...periodsTouched].map((key) => {
      const [year, month] = key.split("-").map(Number);
      return { year, month };
    });

    await prisma.importIssue.createMany({ data: issues.map((issue) => ({ ...issue, importBatchId: batch.id })) });
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status,
        finishedAt: new Date(),
        sheetsFound: sheetNames,
        sheetsImported: [firstSheet.name],
        totalRows,
        insertedRows,
        updatedRows,
        skippedRows: 0,
        errorRows,
        periodsTouched: periodsTouchedArray,
      },
    });

    await markInsightsStaleForTouchedPeriods(periodsTouched);

    return prisma.importBatch.findUniqueOrThrow({ where: { id: batch.id }, include: { issues: true } });
  } catch (error) {
    await prisma.importIssue
      .createMany({ data: issues.map((issue) => ({ ...issue, importBatchId: batch.id })) })
      .catch(() => undefined);
    const periodsTouchedArray = [...periodsTouched].map((key) => {
      const [year, month] = key.split("-").map(Number);
      return { year, month };
    });

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
        sheetsFound: sheetNames,
        totalRows,
        insertedRows,
        updatedRows,
        skippedRows: 0,
        errorRows,
        periodsTouched: periodsTouchedArray,
      },
    });
    return prisma.importBatch.findUniqueOrThrow({ where: { id: batch.id }, include: { issues: true } });
  }
}

function uniquePeriods(periods: Period[]): Period[] {
  return [...new Map(periods.map((period) => [periodKey(period.year, period.month), period])).values()];
}

function periodWhere(periods: Period[]) {
  return { OR: periods.map((period) => ({ year: period.year, month: period.month })) };
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function parseSalesWorkbook(fileBuffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);

  const sheetNames = workbook.worksheets.map((worksheet) => worksheet.name);
  const firstSheet = workbook.worksheets[0];
  if (!firstSheet) throw new Error("ไฟล์ไม่มี sheet ใด ๆ");

  const issues: IssueInput[] = workbook.worksheets.slice(1).map((sheet) => ({
    level: "WARNING",
    code: "SHEET_IGNORED",
    sheetName: sheet.name,
    message: `ข้าม sheet "${sheet.name}" — นำเข้าเฉพาะ sheet แรกของไฟล์เท่านั้น`,
  }));
  const header = findHeaderRow(firstSheet);
  if (!header) throw new Error("HEADER_NOT_FOUND");

  const parsedRows: ParsedRow[] = [];
  let totalRows = 0;
  let errorRows = 0;
  const occurrenceCounts = new Map<string, number>();
  for (let rowNumber = header.rowNumber + 1; rowNumber <= firstSheet.rowCount; rowNumber++) {
    const row = firstSheet.getRow(rowNumber);
    if (isRowEmpty(row, header.columnMap)) continue;
    totalRows++;
    const result = parseDataRow(row, rowNumber, header.columnMap, occurrenceCounts);
    issues.push(...result.issues.map((issue) => ({ ...issue, sheetName: firstSheet.name, rowNumber })));
    if (!result.data) {
      errorRows++;
      continue;
    }
    parsedRows.push(result.data);
  }
  return { firstSheetName: firstSheet.name, issues, parsedRows, sheetNames, totalRows, errorRows };
}

function periodOutOfScope(parsedRows: ParsedRow[], targetPeriods: Period[]): boolean {
  const selected = new Set(targetPeriods.map((period) => periodKey(period.year, period.month)));
  return parsedRows.some((row) => !selected.has(periodKey(row.year, row.month)));
}

async function ensureNoImportInProgress(tx: TxClient) {
  const existing = await tx.importBatch.findFirst({ where: { status: "PROCESSING" }, select: { id: true } });
  if (existing) throw new ImportInProgressError();
}

async function lockImports(tx: TxClient) {
  const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_xact_lock(${IMPORT_ADVISORY_LOCK_KEY}) AS locked
  `;
  if (!locked) throw new ImportInProgressError();
  await ensureNoImportInProgress(tx);
}

type ArchivedSalesLine = Prisma.SalesLineGetPayload<{ include: { credits: true } }>;

async function archiveAndDeleteSalesLines(
  tx: TxClient,
  salesLines: ArchivedSalesLine[],
  batchId: string,
  reason: ArchiveReason
) {
  if (salesLines.length === 0) return [];
  await tx.salesLineArchive.createMany({
    data: salesLines.map((salesLine) => ({
      salesLineId: salesLine.id,
      rowKey: salesLine.rowKey,
      year: salesLine.year,
      month: salesLine.month,
      total: salesLine.total,
      reason,
      removedByBatchId: batchId,
      payload: asJson({ salesLine: { ...salesLine, credits: undefined }, credits: salesLine.credits }),
    })),
  });
  await tx.salesLine.deleteMany({ where: { id: { in: salesLines.map((salesLine) => salesLine.id) } } });
  return salesLines;
}

async function collectRemovalPreview(tx: TxClient, periods: Period[], rowKeys: string[]) {
  return tx.salesLine.findMany({
    where: { AND: [periodWhere(periods), { NOT: { rowKey: { in: rowKeys } } }] },
    include: { hospital: { select: { displayName: true } }, credits: true },
    orderBy: { invoiceNo: "asc" },
  });
}

function previewFromSalesLines(
  periods: Period[],
  existingLines: { total: Prisma.Decimal }[],
  removalLines: { invoiceNo: string; total: Prisma.Decimal; hospital: { displayName: string } }[],
  insertedRows: number,
  updatedRows: number,
  hasReplacementRows: boolean
): DryRunPreview {
  const existingTotal = existingLines.reduce((sum, line) => sum.plus(line.total), new Prisma.Decimal(0));
  return {
    targetPeriods: periods,
    existingRows: existingLines.length,
    existingTotal: existingTotal.toFixed(2),
    insertedRows,
    updatedRows,
    removedRows: removalLines.length,
    removalSamples: removalLines.slice(0, 20).map((line) => ({
      invoiceNo: line.invoiceNo,
      hospitalName: line.hospital.displayName,
      total: line.total.toFixed(2),
    })),
    willDeletePeriodWithoutReplacement: !hasReplacementRows,
  };
}

async function runReplaceImport(
  tx: TxClient,
  input: {
    fileName: string;
    fileSizeBytes: number;
    uploadedById: string;
    targetPeriods: Period[];
    confirm: boolean;
    parsed: Awaited<ReturnType<typeof parseSalesWorkbook>>;
  }
) {
  const { fileName, fileSizeBytes, uploadedById, targetPeriods, confirm, parsed } = input;
  if (periodOutOfScope(parsed.parsedRows, targetPeriods)) throw new Error("PERIOD_OUT_OF_SCOPE");

  await lockImports(tx);
  const existingLines = await tx.salesLine.findMany({
    where: periodWhere(targetPeriods),
    select: { total: true },
  });
  const batch = await tx.importBatch.create({
    data: {
      fileName,
      fileSizeBytes,
      uploadedById,
      status: "PROCESSING",
      mode: "REPLACE_PERIOD",
      targetPeriods: asJson(targetPeriods),
      confirmedById: confirm ? uploadedById : null,
    },
  });

  const hospitalIndex = await buildHospitalIndex(tx);
  const salespersonIndex = await buildSalespersonIndex(tx);
  const productTypeCache = new Map<string, string>();
  const productIndex = await buildProductIndex(tx);
  const successfulRowKeys: string[] = [];
  const periodsTouched = new Set<string>();
  let insertedRows = 0;
  let updatedRows = 0;
  let errorRows = parsed.errorRows;
  const rowKeys = parsed.parsedRows.map((row) => row.rowKey);
  const existingRows = rowKeys.length
    ? await tx.salesLine.findMany({ where: { rowKey: { in: rowKeys } }, select: { id: true, rowKey: true } })
    : [];
  const existingByRowKey = new Map(existingRows.map((row) => [row.rowKey, row.id]));

  for (const row of parsed.parsedRows) {
    const credits = await resolveSalesmanCredits(tx, salespersonIndex, row.salesmanRaw, parsed.issues, parsed.firstSheetName, row.rowNumber);
    if (!credits) {
      errorRows++;
      continue;
    }
    assertSharesSumTo100(credits);
    const hospitalId = await resolveHospitalViaAlias(
      tx,
      hospitalIndex,
      row.hospitalName,
      row.province,
      parsed.issues,
      parsed.firstSheetName,
      row.rowNumber
    );
    const productTypeId = await resolveProductType(tx, productTypeCache, row.productTypeName);
    const product = await resolveProductViaAlias(tx, productIndex, row.productName, productTypeId);
    const primaryCredit = credits.find((credit) => credit.isPrimary) ?? credits[0];
    const salesLineData = {
      invoiceNo: row.invoiceNo,
      poNo: row.poNo,
      invoiceDate: row.invoiceDate,
      year: row.year,
      month: row.month,
      hospitalId,
      salespersonId: primaryCredit.salespersonId,
      productId: product.id,
      productTypeId: product.productTypeId,
      lot: row.lot,
      expiryDate: row.expiryDate,
      province: row.province,
      qty: row.qty,
      unitPrice: row.unitPrice,
      amount: row.amount,
      vat: row.vat,
      total: row.total,
      sourceSheetName: parsed.firstSheetName,
      sourceRowNumber: row.rowNumber,
      importBatchId: batch.id,
    };
    const existingId = existingByRowKey.get(row.rowKey);
    let salesLineId: string;
    if (existingId) {
      await tx.salesLine.update({ where: { id: existingId }, data: salesLineData });
      await tx.salesLineCredit.deleteMany({ where: { salesLineId: existingId } });
      salesLineId = existingId;
      updatedRows++;
    } else {
      const created = await tx.salesLine.create({ data: { ...salesLineData, rowKey: row.rowKey } });
      salesLineId = created.id;
      insertedRows++;
    }
    await tx.salesLineCredit.createMany({
      data: credits.map((credit) => ({
        salesLineId,
        salespersonId: credit.salespersonId,
        sharePercent: credit.sharePercent,
        isPrimary: credit.isPrimary,
      })),
    });
    successfulRowKeys.push(row.rowKey);
    periodsTouched.add(periodKey(row.year, row.month));
  }

  const removalLines = await collectRemovalPreview(tx, targetPeriods, successfulRowKeys);
  const preview = previewFromSalesLines(targetPeriods, existingLines, removalLines, insertedRows, updatedRows, successfulRowKeys.length > 0);
  if (!confirm) throw new DryRunComplete(preview);

  await archiveAndDeleteSalesLines(tx, removalLines, batch.id, "SUPERSEDED_BY_REIMPORT");
  await tx.importIssue.createMany({ data: parsed.issues.map((issue) => ({ ...issue, importBatchId: batch.id })) });
  const status = determineStatus(parsed.totalRows, errorRows, insertedRows, updatedRows);
  await tx.importBatch.update({
    where: { id: batch.id },
    data: {
      status,
      finishedAt: new Date(),
      sheetsFound: parsed.sheetNames,
      sheetsImported: [parsed.firstSheetName],
      totalRows: parsed.totalRows,
      insertedRows,
      updatedRows,
      skippedRows: 0,
      errorRows,
      periodsTouched: asJson(targetPeriods),
      removedRows: removalLines.length,
    },
  });
  await markInsightsStaleForTouchedPeriods(new Set(targetPeriods.map((period) => periodKey(period.year, period.month))), tx);
  return tx.importBatch.findUniqueOrThrow({ where: { id: batch.id }, include: { issues: true } });
}

async function persistFailedBatch(input: {
  fileName: string;
  fileSizeBytes: number;
  uploadedById: string;
  mode: ImportMode;
  targetPeriods?: Period[];
  errorMessage: string;
}) {
  return prisma.importBatch.create({
    data: {
      fileName: input.fileName,
      fileSizeBytes: input.fileSizeBytes,
      uploadedById: input.uploadedById,
      status: "FAILED",
      finishedAt: new Date(),
      mode: input.mode,
      targetPeriods: input.targetPeriods ? asJson(input.targetPeriods) : undefined,
      errorMessage: input.errorMessage,
    },
    include: { issues: true },
  });
}

export async function importSalesFile(input: ImportSalesFileParams) {
  const mode: ImportMode = input.mode ?? "APPEND";
  if (mode === "APPEND") {
    const batch = await importSalesFileLegacy(input);
    return { dryRun: false, importBatch: batch };
  }
  const targetPeriods = uniquePeriods(input.targetPeriods ?? []);
  const isDryRun = !input.confirm;
  try {
    const parsed = await parseSalesWorkbook(input.fileBuffer);
    const batch = await prisma.$transaction(
      (tx) => runReplaceImport(tx, { ...input, targetPeriods, confirm: Boolean(input.confirm), parsed }),
      { timeout: IMPORT_TRANSACTION_TIMEOUT_MS, maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS }
    );
    return { dryRun: false, importBatch: batch };
  } catch (error) {
    if (error instanceof DryRunComplete) return { dryRun: true, preview: error.preview };
    if (error instanceof ImportInProgressError) throw error;
    if (isDryRun) throw error;
    const failed = await persistFailedBatch({
      fileName: input.fileName,
      fileSizeBytes: input.fileSizeBytes,
      uploadedById: input.uploadedById,
      mode,
      targetPeriods,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return { dryRun: false, importBatch: failed };
  }
}

async function runPeriodDelete(tx: TxClient, input: Required<DeleteSalesPeriodsParams>) {
  await lockImports(tx);
  const existingLines = await tx.salesLine.findMany({
    where: periodWhere(input.targetPeriods),
    include: { hospital: { select: { displayName: true } }, credits: true },
    orderBy: { invoiceNo: "asc" },
  });
  const preview = previewFromSalesLines(input.targetPeriods, existingLines, existingLines, 0, 0, false);
  if (!input.confirm) throw new DryRunComplete(preview);

  const batch = await tx.importBatch.create({
    data: {
      fileName: "(ลบข้อมูลตามงวด)",
      fileSizeBytes: 0,
      uploadedById: input.uploadedById,
      status: "PROCESSING",
      mode: "PERIOD_DELETE",
      targetPeriods: asJson(input.targetPeriods),
      confirmedById: input.uploadedById,
    },
  });
  await archiveAndDeleteSalesLines(tx, existingLines, batch.id, "MANUAL_PERIOD_DELETE");
  await markInsightsStaleForTouchedPeriods(
    new Set(input.targetPeriods.map((period) => periodKey(period.year, period.month))),
    tx
  );
  await tx.importBatch.update({
    where: { id: batch.id },
    data: {
      status: "SUCCESS",
      finishedAt: new Date(),
      totalRows: 0,
      removedRows: existingLines.length,
      periodsTouched: asJson(input.targetPeriods),
    },
  });
  return tx.importBatch.findUniqueOrThrow({ where: { id: batch.id }, include: { issues: true } });
}

export async function deleteSalesPeriods(input: DeleteSalesPeriodsParams) {
  const targetPeriods = uniquePeriods(input.targetPeriods);
  try {
    const batch = await prisma.$transaction(
      (tx) => runPeriodDelete(tx, { uploadedById: input.uploadedById, targetPeriods, confirm: Boolean(input.confirm) }),
      { timeout: IMPORT_TRANSACTION_TIMEOUT_MS, maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS }
    );
    return { dryRun: false, importBatch: batch };
  } catch (error) {
    if (error instanceof DryRunComplete) return { dryRun: true, preview: error.preview };
    if (error instanceof ImportInProgressError) throw error;
    if (!input.confirm) throw error;
    const failed = await persistFailedBatch({
      fileName: "(ลบข้อมูลตามงวด)",
      fileSizeBytes: 0,
      uploadedById: input.uploadedById,
      mode: "PERIOD_DELETE",
      targetPeriods,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return { dryRun: false, importBatch: failed };
  }
}
