namespace SalesEvaluation.Infrastructure.Excel;

using System.Text.Json;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;
using SalesEvaluation.Domain.MasterData;
using SalesEvaluation.Infrastructure.Persistence;

/// <summary>
/// Ports backend/src/services/import.service.ts — ClosedXML-based .xlsx ingestion.
/// All business rules (header detection, row parsing, advisory lock, credit split, archive)
/// are faithful ports. Key differences: EF Core transactions instead of Prisma, ClosedXML
/// instead of ExcelJS, database identity generation for IDs.
/// </summary>
public class ImportService : IImportService
{
    private const int MaxHeaderSearchRows = 10;
    private const double TotalMismatchTolerance = 0.05;
    private const double VatInclusiveDivisor = 1.07;
    private const long ImportAdvisoryLockKey = 872341987L;

    private static readonly (string Key, string Label)[] ColumnDefinitions =
    [
        ("hospitalName", "Hospital Name"),
        ("salesman", "Salesman"),
        ("invDate", "Inv Date"),
        ("year", "Year"),
        ("month", "Month"),
        ("invNo", "Inv No."),
        ("poNo", "Po NO."),
        ("productType", "Product type"),
        ("productName", "Product Name"),
        ("lot", "Lot"),
        ("exp", "Exp"),
        ("province", "Province"),
        ("qty", "Qty"),
        ("price", "Price"),
        ("amount", "Amount"),
        ("vat", "Vat"),
        ("total", "Total"),
    ];

    private readonly AppDbContext _db;
    private readonly IPostgresAdvisoryLockService _lockService;
    private readonly ILogger<ImportService> _logger;

    public ImportService(
        AppDbContext db,
        IPostgresAdvisoryLockService lockService,
        ILogger<ImportService> logger)
    {
        _db = db;
        _lockService = lockService;
        _logger = logger;
    }

    // -----------------------------------------------------------------------
    //  Public surface
    // -----------------------------------------------------------------------

    public async Task<ImportResult> ImportSalesFileAsync(
        byte[] fileBuffer,
        string fileName,
        int fileSizeBytes,
        int uploadedById,
        ImportMode mode,
        List<Period>? targetPeriods,
        bool confirm,
        CancellationToken cancellationToken = default)
    {
        if (mode == ImportMode.APPEND)
        {
            var batch = await ImportSalesFileLegacyAsync(fileBuffer, fileName, fileSizeBytes, uploadedById, cancellationToken);
            return new ImportResult(DryRun: false, ImportBatch: batch, Preview: null);
        }

        var uniqueTarget = UniquePeriods(targetPeriods ?? []);
        ParsedWorkbook parsed;
        try
        {
            parsed = ParseSalesWorkbook(fileBuffer);
        }
        catch (Exception ex)
        {
            var failed = await PersistFailedBatchAsync(fileName, fileSizeBytes, uploadedById, mode, uniqueTarget, ex.Message, cancellationToken);
            return new ImportResult(DryRun: false, ImportBatch: failed, Preview: null);
        }

        DryRunPreview? dryRunResult = null;
        ImportBatchDto? importBatch = null;

        using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var result = await RunReplaceImportAsync(parsed, fileName, fileSizeBytes, uploadedById, uniqueTarget, confirm, cancellationToken);
            if (result.DryRun)
            {
                dryRunResult = result.Preview;
                await tx.RollbackAsync(cancellationToken);
                return new ImportResult(DryRun: true, ImportBatch: null, Preview: dryRunResult);
            }

            await tx.CommitAsync(cancellationToken);
            importBatch = result.ImportBatch;
        }
        catch (ImportInProgressException)
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
        catch (PeriodOutOfScopeException)
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync(cancellationToken);
            if (!confirm)
                throw;
            var failed = await PersistFailedBatchAsync(fileName, fileSizeBytes, uploadedById, mode, uniqueTarget, ex.Message, cancellationToken);
            return new ImportResult(DryRun: false, ImportBatch: failed, Preview: null);
        }

        return new ImportResult(DryRun: false, ImportBatch: importBatch, Preview: null);
    }

    public async Task<ImportResult> DeleteSalesPeriodsAsync(
        int uploadedById,
        List<Period> targetPeriods,
        bool confirm,
        CancellationToken cancellationToken = default)
    {
        var uniqueTarget = UniquePeriods(targetPeriods);

        using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var result = await RunPeriodDeleteAsync(uploadedById, uniqueTarget, confirm, cancellationToken);
            if (result.DryRun)
            {
                await tx.RollbackAsync(cancellationToken);
                return new ImportResult(DryRun: true, ImportBatch: null, Preview: result.Preview);
            }

            await tx.CommitAsync(cancellationToken);
            return new ImportResult(DryRun: false, ImportBatch: result.ImportBatch, Preview: null);
        }
        catch (ImportInProgressException)
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync(cancellationToken);
            if (!confirm)
                throw;
            var failed = await PersistFailedBatchAsync("(ลบข้อมูลตามงวด)", 0, uploadedById, ImportMode.PERIOD_DELETE, uniqueTarget, ex.Message, cancellationToken);
            return new ImportResult(DryRun: false, ImportBatch: failed, Preview: null);
        }
    }

    public async Task<List<ImportBatchDto>> ListImportBatchesAsync(CancellationToken cancellationToken = default)
    {
        var batches = await _db.ImportBatches
            .AsNoTracking()
            .Include(b => b.UploadedBy)
            .OrderByDescending(b => b.StartedAt)
            .ToListAsync(cancellationToken);

        return batches.Select(b => MapBatch(b, false)).ToList();
    }

    public async Task<ImportBatchDto?> GetImportBatchAsync(int id, CancellationToken cancellationToken = default)
    {
        var batch = await _db.ImportBatches
            .AsNoTracking()
            .Include(b => b.UploadedBy)
            .Include(b => b.Issues)
            .FirstOrDefaultAsync(b => b.Id == id, cancellationToken);

        return batch == null ? null : MapBatch(batch, includeIssues: true);
    }

    public async Task<SalesLinesPageDto> ListSalesLinesAsync(
        int? salespersonId,
        int? hospitalId,
        int? productTypeId,
        int? year,
        int? month,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _db.SalesLines.AsNoTracking()
            .Include(s => s.Hospital)
            .Include(s => s.Salesperson)
            .Include(s => s.Product)
            .Include(s => s.ProductType)
            .AsQueryable();

        if (salespersonId.HasValue) query = query.Where(s => s.SalespersonId == salespersonId.Value);
        if (hospitalId.HasValue) query = query.Where(s => s.HospitalId == hospitalId.Value);
        if (productTypeId.HasValue) query = query.Where(s => s.ProductTypeId == productTypeId.Value);
        if (year.HasValue) query = query.Where(s => s.Year == year.Value);
        if (month.HasValue) query = query.Where(s => s.Month == month.Value);

        var total = await query.CountAsync(cancellationToken);
        var lines = await query
            .OrderByDescending(s => s.InvoiceDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new SalesLinesPageDto
        {
            Data = lines.Select(MapSalesLine).ToList(),
            Total = total,
            Page = page,
            PageSize = pageSize,
        };
    }

    // -----------------------------------------------------------------------
    //  Workbook parsing (ClosedXML)
    // -----------------------------------------------------------------------

    private ParsedWorkbook ParseSalesWorkbook(byte[] fileBuffer)
    {
        using var stream = new MemoryStream(fileBuffer);
        using var workbook = new XLWorkbook(stream);

        var sheetNames = workbook.Worksheets.Select(ws => ws.Name).ToList();
        var firstSheet = workbook.Worksheets.FirstOrDefault()
            ?? throw new Exception("ไฟล์ไม่มี sheet ใด ๆ");

        var issues = workbook.Worksheets.Skip(1).Select(ws => new IssueInput(
            Level: "WARNING",
            Code: "SHEET_IGNORED",
            Message: $"ข้าม sheet \"{ws.Name}\" — นำเข้าเฉพาะ sheet แรกของไฟล์เท่านั้น",
            SheetName: ws.Name
        )).ToList();

        var header = FindHeaderRow(firstSheet);
        if (header == null)
            throw new Exception("HEADER_NOT_FOUND");

        var (headerRowNumber, columnMap) = header.Value;

        var parsedRows = new List<ParsedRow>();
        var totalRows = 0;
        var errorRows = 0;
        var occurrenceCounts = new Dictionary<string, int>();

        var lastRow = firstSheet.LastRowUsed()?.RowNumber() ?? 0;
        for (var rowNumber = headerRowNumber + 1; rowNumber <= lastRow; rowNumber++)
        {
            var row = firstSheet.Row(rowNumber);
            if (IsRowEmpty(row, columnMap)) continue;
            totalRows++;
            var (data, rowIssues) = ParseDataRow(row, rowNumber, columnMap, occurrenceCounts);
            issues.AddRange(rowIssues.Select(i => i with { SheetName = firstSheet.Name, RowNumber = rowNumber }));
            if (data == null)
            {
                errorRows++;
                continue;
            }
            parsedRows.Add(data);
        }

        return new ParsedWorkbook(firstSheet.Name, issues, parsedRows, sheetNames, totalRows, errorRows);
    }

    private static (int HeaderRowNumber, Dictionary<string, int> ColumnMap)? FindHeaderRow(IXLWorksheet sheet)
    {
        var maxRow = Math.Min(MaxHeaderSearchRows, sheet.LastRowUsed()?.RowNumber() ?? 0);
        for (var r = 1; r <= maxRow; r++)
        {
            var row = sheet.Row(r);
            var colByLabel = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

            foreach (var cell in row.CellsUsed())
            {
                var text = CellToDisplayString(cell).Trim().ToLowerInvariant();
                if (!string.IsNullOrEmpty(text))
                    colByLabel[text] = cell.Address.ColumnNumber;
            }

            var columnMap = new Dictionary<string, int>();
            var allFound = true;
            foreach (var (key, label) in ColumnDefinitions)
            {
                if (!colByLabel.TryGetValue(label.ToLowerInvariant(), out var col))
                {
                    allFound = false;
                    break;
                }
                columnMap[key] = col;
            }

            if (allFound)
                return (r, columnMap);
        }
        return null;
    }

    private static bool IsRowEmpty(IXLRow row, Dictionary<string, int> columnMap)
    {
        return columnMap.Values.All(col => string.IsNullOrWhiteSpace(CellToDisplayString(row.Cell(col)).Trim()));
    }

    private static (ParsedRow? Data, List<IssueInput> Issues) ParseDataRow(
        IXLRow row,
        int rowNumber,
        Dictionary<string, int> columnMap,
        Dictionary<string, int> occurrenceCounts)
    {
        var issues = new List<IssueInput>();

        string Get(string key) => CellToDisplayString(row.Cell(columnMap[key])).Trim();
        double? GetNum(string key) => CellToNumber(row.Cell(columnMap[key]));
        DateTime? GetDate(string key) => CellToDate(row.Cell(columnMap[key]));

        var hospitalName = Get("hospitalName");
        var salesmanRaw = Get("salesman");
        var invoiceNo = Get("invNo");
        var productName = Get("productName");
        var productTypeName = Get("productType");
        var totalRaw = Get("total");
        var totalIsEmpty = string.IsNullOrWhiteSpace(totalRaw);

        var missingFields = new List<string>();
        if (string.IsNullOrWhiteSpace(hospitalName)) missingFields.Add("Hospital Name");
        if (string.IsNullOrWhiteSpace(salesmanRaw)) missingFields.Add("Salesman");
        if (string.IsNullOrWhiteSpace(invoiceNo)) missingFields.Add("Inv No.");
        if (string.IsNullOrWhiteSpace(productName)) missingFields.Add("Product Name");
        if (string.IsNullOrWhiteSpace(productTypeName)) missingFields.Add("Product type");
        if (totalIsEmpty) missingFields.Add("Total");

        if (missingFields.Count > 0)
        {
            issues.Add(new IssueInput("ERROR", "MISSING_REQUIRED",
                $"ข้อมูลจำเป็นว่าง: {string.Join(", ", missingFields)}",
                ColumnName: string.Join(", ", missingFields)));
            return (null, issues);
        }

        var qty = GetNum("qty");
        var unitPrice = GetNum("price");
        var total = GetNum("total");
        if (qty == null || unitPrice == null || total == null)
        {
            issues.Add(new IssueInput("ERROR", "INVALID_NUMBER", "Qty/Price/Total แปลงเป็นตัวเลขไม่ได้"));
            return (null, issues);
        }

        var invoiceDate = GetDate("invDate");
        if (invoiceDate == null)
        {
            issues.Add(new IssueInput("ERROR", "INVALID_DATE", "Inv Date แปลงเป็นวันที่ไม่ได้"));
            return (null, issues);
        }

        var poNo = Get("poNo") is { Length: > 0 } po ? po : null;
        var lot = Get("lot") is { Length: > 0 } l ? l : null;
        var province = Get("province") is { Length: > 0 } p ? p : null;
        var expiryDate = GetDate("exp");

        var yearRaw = GetNum("year");
        var monthRaw = GetNum("month");
        var year = yearRaw.HasValue ? (int)yearRaw.Value : invoiceDate.Value.Year;
        var month = monthRaw.HasValue ? (int)monthRaw.Value : invoiceDate.Value.Month;

        double amount;
        var amountRaw = GetNum("amount");
        if (amountRaw == null)
        {
            amount = Round2(total.Value / VatInclusiveDivisor);
            issues.Add(new IssueInput("WARNING", "AMOUNT_RECOMPUTED",
                $"Amount ว่าง คำนวณจาก Total/{VatInclusiveDivisor} = {amount}"));
        }
        else
        {
            amount = amountRaw.Value;
        }

        var vatRaw = GetNum("vat");
        var vat = vatRaw ?? Round2(total.Value - amount);

        if (Math.Abs(total.Value - (amount + vat)) > TotalMismatchTolerance ||
            Math.Abs(total.Value - qty.Value * unitPrice.Value) > TotalMismatchTolerance)
        {
            issues.Add(new IssueInput("WARNING", "TOTAL_MISMATCH",
                $"Total ({total.Value}) ไม่ตรงกับ Amount+Vat ({Round2(amount + vat)}) หรือ Qty×Price ({Round2(qty.Value * unitPrice.Value)})"));
        }

        if (year != invoiceDate.Value.Year || month != invoiceDate.Value.Month)
        {
            issues.Add(new IssueInput("WARNING", "DATE_PERIOD_MISMATCH",
                $"Year/Month ({year}/{month}) ไม่ตรงกับ Inv Date ({invoiceDate.Value:yyyy-MM-dd})"));
        }

        if (total.Value < 0)
            issues.Add(new IssueInput("WARNING", "NEGATIVE_AMOUNT", $"Total ติดลบ: {total.Value}"));

        var dedupeBaseKey = $"{invoiceNo}|{productName}|{lot ?? ""}";
        occurrenceCounts.TryGetValue(dedupeBaseKey, out var occIndex);
        occIndex++;
        occurrenceCounts[dedupeBaseKey] = occIndex;
        var rowKey = $"{dedupeBaseKey}|{occIndex}";

        return (new ParsedRow(
            rowNumber, hospitalName, salesmanRaw, invoiceDate.Value,
            year, month, invoiceNo, poNo, productTypeName, productName,
            lot, expiryDate, province,
            qty.Value, unitPrice.Value, amount, vat, total.Value, rowKey
        ), issues);
    }

    // -----------------------------------------------------------------------
    //  Cell value extraction helpers (port of ExcelJS cell helpers)
    // -----------------------------------------------------------------------

    private static string CellToDisplayString(IXLCell cell)
    {
        if (cell.IsEmpty()) return string.Empty;
        if (cell.HasFormula)
        {
            try { return cell.CachedValue.ToString() ?? string.Empty; }
            catch { return string.Empty; }
        }
        return cell.GetString();
    }

    private static double? CellToNumber(IXLCell cell)
    {
        if (cell.IsEmpty()) return null;
        if (cell.DataType == XLDataType.Number)
        {
            var v = cell.GetDouble();
            return double.IsFinite(v) ? v : null;
        }
        var raw = CellToDisplayString(cell).Replace(",", "").Trim();
        if (string.IsNullOrEmpty(raw)) return null;
        if (double.TryParse(raw, System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out var parsed) && double.IsFinite(parsed))
            return parsed;
        return null;
    }

    private static DateTime? CellToDate(IXLCell cell)
    {
        if (cell.IsEmpty()) return null;
        if (cell.DataType == XLDataType.DateTime)
        {
            var d = cell.GetDateTime();
            return d == DateTime.MinValue ? null : d;
        }
        if (cell.DataType == XLDataType.Number)
        {
            var serial = cell.GetDouble();
            if (double.IsFinite(serial))
            {
                try
                {
                    var d = DateTime.FromOADate(serial);
                    return d;
                }
                catch { return null; }
            }
        }
        var s = CellToDisplayString(cell);
        if (DateTime.TryParse(s, out var parsed)) return parsed;
        return null;
    }

    private static double Round2(double v) => Math.Round(v * 100d, MidpointRounding.AwayFromZero) / 100d;

    // -----------------------------------------------------------------------
    //  APPEND mode (legacy) import
    // -----------------------------------------------------------------------

    private async Task<ImportBatchDto> ImportSalesFileLegacyAsync(
        byte[] fileBuffer, string fileName, int fileSizeBytes, int uploadedById,
        CancellationToken cancellationToken)
    {
        var inProgress = await _db.ImportBatches
            .Where(b => b.Status == ImportStatus.PROCESSING)
            .Select(b => b.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (inProgress != 0)
            throw new ImportInProgressException();

        var batch = new ImportBatch
        {
            FileName = fileName,
            FileSizeBytes = fileSizeBytes,
            UploadedById = uploadedById,
            Status = ImportStatus.PROCESSING,
        };
        _db.ImportBatches.Add(batch);
        await _db.SaveChangesAsync(cancellationToken);

        var issues = new List<IssueInput>();
        var sheetNames = new List<string>();
        int totalRows = 0, errorRows = 0, insertedRows = 0, updatedRows = 0;
        var periodsTouched = new HashSet<string>();

        try
        {
            ParsedWorkbook parsed;
            try
            {
                parsed = ParseSalesWorkbook(fileBuffer);
            }
            catch (Exception ex) when (ex.Message == "HEADER_NOT_FOUND")
            {
                issues.Add(new IssueInput("ERROR", "HEADER_NOT_FOUND",
                    $"ไม่พบแถว header ที่มีคอลัมน์ครบใน {MaxHeaderSearchRows} แถวแรก"));
                await SaveIssuesAsync(batch.Id, issues, cancellationToken);
                await UpdateBatchFailedAsync(batch.Id, "Header row not found", sheetNames, totalRows, insertedRows, updatedRows, errorRows, periodsTouched, cancellationToken);
                return await LoadBatchAsync(batch.Id, includeIssues: true, cancellationToken);
            }

            sheetNames = parsed.SheetNames;
            issues.AddRange(parsed.Issues);
            totalRows = parsed.TotalRows;
            errorRows = parsed.ErrorRows;

            using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);

            var locked = await _lockService.TryAcquireTransactionLockAsync(ImportAdvisoryLockKey, cancellationToken);
            if (!locked)
            {
                await tx.RollbackAsync(cancellationToken);
                throw new ImportInProgressException();
            }

            var (hospitalsIdx, salespersonIdx, productTypeCache, productIdx, productTypeNames) =
                await BuildIndexesAsync(cancellationToken);

            var rowKeys = parsed.ParsedRows.Select(r => r.RowKey).ToList();
            var existingByRowKey = rowKeys.Count > 0
                ? (await _db.SalesLines.Where(s => rowKeys.Contains(s.RowKey)).Select(s => new { s.Id, s.RowKey }).ToListAsync(cancellationToken))
                    .ToDictionary(s => s.RowKey, s => s.Id)
                : new Dictionary<string, int>();

            int inserted = 0, updated = 0;
            var creditErrorRows = 0;

            foreach (var row in parsed.ParsedRows)
            {
                var credits = await ResolveSalesmanCreditsAsync(salespersonIdx, row.SalesmanRaw, issues, parsed.FirstSheetName, row.RowNumber, cancellationToken);
                if (credits == null) { creditErrorRows++; continue; }

                var hospitalId = await ResolveHospitalViaAliasAsync(hospitalsIdx, row.HospitalName, row.Province, issues, parsed.FirstSheetName, row.RowNumber, cancellationToken);
                var productTypeId = await ResolveProductTypeAsync(productTypeCache, row.ProductTypeName, cancellationToken);
                var product = await ResolveProductViaAliasAsync(productIdx, row.ProductName, productTypeId, cancellationToken);

                if (product.ProductTypeId != productTypeId)
                {
                    issues.Add(new IssueInput("WARNING", "PRODUCT_TYPE_ALIAS_MISMATCH",
                        $"สินค้า \"{row.ProductName}\" ถูกจับคู่กับทะเบียนที่ Product type = {productTypeNames.GetValueOrDefault(product.ProductTypeId, product.ProductTypeId.ToString())} แต่ไฟล์ระบุ \"{row.ProductTypeName}\" — ระบบใช้ type ตามทะเบียน",
                        SheetName: parsed.FirstSheetName, RowNumber: row.RowNumber));
                }

                var primaryCredit = credits.FirstOrDefault(c => c.IsPrimary) ?? credits[0];

                if (existingByRowKey.TryGetValue(row.RowKey, out var existingId))
                {
                    var existing = await _db.SalesLines.FindAsync([existingId], cancellationToken);
                    if (existing != null)
                    {
                        UpdateSalesLineFields(existing, row, hospitalId, primaryCredit.SalespersonId, product, batch.Id, parsed.FirstSheetName);
                        _db.SalesLines.Update(existing);
                        var oldCredits = await _db.SalesLineCredits.Where(c => c.SalesLineId == existingId).ToListAsync(cancellationToken);
                        _db.SalesLineCredits.RemoveRange(oldCredits);

                        _db.SalesLineCredits.AddRange(credits.Select(c => new SalesLineCredit
                        {
                            SalesLineId = existingId,
                            SalespersonId = c.SalespersonId,
                            SharePercent = c.SharePercent,
                            IsPrimary = c.IsPrimary,
                        }));
                    }
                    updated++;
                }
                else
                {
                    var sl = new SalesLine();
                    UpdateSalesLineFields(sl, row, hospitalId, primaryCredit.SalespersonId, product, batch.Id, parsed.FirstSheetName);
                    sl.RowKey = row.RowKey;
                    foreach (var c in credits)
                    {
                        sl.Credits.Add(new SalesLineCredit
                        {
                            SalespersonId = c.SalespersonId,
                            SharePercent = c.SharePercent,
                            IsPrimary = c.IsPrimary,
                        });
                    }
                    _db.SalesLines.Add(sl);
                    inserted++;
                }

                periodsTouched.Add(PeriodKey(row.Year, row.Month));
            }

            errorRows += creditErrorRows;
            await _db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);

            insertedRows = inserted;
            updatedRows = updated;

            await SaveIssuesAsync(batch.Id, issues, cancellationToken);
            await MarkInsightsStaleAsync(periodsTouched, cancellationToken);

            var status = DetermineStatus(totalRows, errorRows, inserted, updated);
            batch.Status = status;
            batch.FinishedAt = DateTime.UtcNow;
            batch.SheetsFound = JsonSerializer.Serialize(sheetNames);
            batch.SheetsImported = JsonSerializer.Serialize(new[] { parsed.FirstSheetName });
            batch.TotalRows = totalRows;
            batch.InsertedRows = inserted;
            batch.UpdatedRows = updated;
            batch.ErrorRows = errorRows;
            batch.PeriodsTouched = JsonSerializer.Serialize(periodsTouched.Select(k => {
                var parts = k.Split('-');
                return new { year = int.Parse(parts[0]), month = int.Parse(parts[1]) };
            }).ToList());
            await _db.SaveChangesAsync(cancellationToken);

            return await LoadBatchAsync(batch.Id, includeIssues: true, cancellationToken);
        }
        catch (ImportInProgressException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Import failed for batch {BatchId}", batch.Id);
            await SaveIssuesAsync(batch.Id, issues, cancellationToken).ConfigureAwait(false);
            await UpdateBatchFailedAsync(batch.Id, ex.Message, sheetNames, totalRows, insertedRows, updatedRows, errorRows, periodsTouched, cancellationToken).ConfigureAwait(false);
            return await LoadBatchAsync(batch.Id, includeIssues: true, cancellationToken);
        }
    }

    // -----------------------------------------------------------------------
    //  REPLACE_PERIOD mode
    // -----------------------------------------------------------------------

    private async Task<ImportResult> RunReplaceImportAsync(
        ParsedWorkbook parsed,
        string fileName,
        int fileSizeBytes,
        int uploadedById,
        List<Period> targetPeriods,
        bool confirm,
        CancellationToken cancellationToken)
    {
        if (PeriodOutOfScope(parsed.ParsedRows, targetPeriods))
            throw new PeriodOutOfScopeException();

        var locked = await _lockService.TryAcquireTransactionLockAsync(ImportAdvisoryLockKey, cancellationToken);
        if (!locked)
            throw new ImportInProgressException();

        await EnsureNoImportInProgressAsync(cancellationToken);

        var existingLinesForPreview = await _db.SalesLines
            .Where(s => PeriodWhere(targetPeriods).Contains(PeriodKey(s.Year, s.Month)))
            .Select(s => s.Total)
            .ToListAsync(cancellationToken);

        var batch = new ImportBatch
        {
            FileName = fileName,
            FileSizeBytes = fileSizeBytes,
            UploadedById = uploadedById,
            Status = ImportStatus.PROCESSING,
            Mode = ImportMode.REPLACE_PERIOD,
            TargetPeriods = JsonSerializer.Serialize(targetPeriods),
            ConfirmedById = confirm ? uploadedById : (int?)null,
        };
        _db.ImportBatches.Add(batch);
        await _db.SaveChangesAsync(cancellationToken);

        var (hospitalsIdx, salespersonIdx, productTypeCache, productIdx, productTypeNames) =
            await BuildIndexesAsync(cancellationToken);

        var rowKeys = parsed.ParsedRows.Select(r => r.RowKey).ToList();
        var existingByRowKey = rowKeys.Count > 0
            ? (await _db.SalesLines.Where(s => rowKeys.Contains(s.RowKey)).Select(s => new { s.Id, s.RowKey }).ToListAsync(cancellationToken))
                .ToDictionary(s => s.RowKey, s => s.Id)
            : new Dictionary<string, int>();

        var successfulRowKeys = new List<string>();
        var periodsTouched = new HashSet<string>();
        int inserted = 0, updated = 0;
        var errorRows = parsed.ErrorRows;
        var issues = new List<IssueInput>(parsed.Issues);

        foreach (var row in parsed.ParsedRows)
        {
            var credits = await ResolveSalesmanCreditsAsync(salespersonIdx, row.SalesmanRaw, issues, parsed.FirstSheetName, row.RowNumber, cancellationToken);
            if (credits == null) { errorRows++; continue; }

            var hospitalId = await ResolveHospitalViaAliasAsync(hospitalsIdx, row.HospitalName, row.Province, issues, parsed.FirstSheetName, row.RowNumber, cancellationToken);
            var productTypeId = await ResolveProductTypeAsync(productTypeCache, row.ProductTypeName, cancellationToken);
            var product = await ResolveProductViaAliasAsync(productIdx, row.ProductName, productTypeId, cancellationToken);

            if (product.ProductTypeId != productTypeId)
                issues.Add(new IssueInput("WARNING", "PRODUCT_TYPE_ALIAS_MISMATCH",
                    $"สินค้า \"{row.ProductName}\" ถูกจับคู่กับทะเบียนที่ Product type = {productTypeNames.GetValueOrDefault(product.ProductTypeId, product.ProductTypeId.ToString())} แต่ไฟล์ระบุ \"{row.ProductTypeName}\" — ระบบใช้ type ตามทะเบียน",
                    SheetName: parsed.FirstSheetName, RowNumber: row.RowNumber));

            var primaryCredit = credits.FirstOrDefault(c => c.IsPrimary) ?? credits[0];

            if (existingByRowKey.TryGetValue(row.RowKey, out var existingId))
            {
                var existing = await _db.SalesLines.FindAsync([existingId], cancellationToken);
                if (existing != null)
                {
                    UpdateSalesLineFields(existing, row, hospitalId, primaryCredit.SalespersonId, product, batch.Id, parsed.FirstSheetName);
                    _db.SalesLines.Update(existing);
                    var oldCredits = await _db.SalesLineCredits.Where(c => c.SalesLineId == existingId).ToListAsync(cancellationToken);
                    _db.SalesLineCredits.RemoveRange(oldCredits);

                    _db.SalesLineCredits.AddRange(credits.Select(c => new SalesLineCredit
                    {
                        SalesLineId = existingId,
                        SalespersonId = c.SalespersonId,
                        SharePercent = c.SharePercent,
                        IsPrimary = c.IsPrimary,
                    }));
                }
                updated++;
            }
            else
            {
                var sl = new SalesLine();
                UpdateSalesLineFields(sl, row, hospitalId, primaryCredit.SalespersonId, product, batch.Id, parsed.FirstSheetName);
                sl.RowKey = row.RowKey;
                foreach (var c in credits)
                {
                    sl.Credits.Add(new SalesLineCredit
                    {
                        SalespersonId = c.SalespersonId,
                        SharePercent = c.SharePercent,
                        IsPrimary = c.IsPrimary,
                    });
                }
                _db.SalesLines.Add(sl);
                inserted++;
            }

            successfulRowKeys.Add(row.RowKey);
            periodsTouched.Add(PeriodKey(row.Year, row.Month));
        }

        await _db.SaveChangesAsync(cancellationToken);

        var targetPeriodKeys = targetPeriods.Select(p => PeriodKey(p.Year, p.Month)).ToHashSet();
        var removalLines = await _db.SalesLines
            .Include(s => s.Hospital)
            .Where(s => targetPeriodKeys.Contains(PeriodKey(s.Year, s.Month)) && !successfulRowKeys.Contains(s.RowKey))
            .OrderBy(s => s.InvoiceNo)
            .ToListAsync(cancellationToken);

        var preview = BuildPreview(targetPeriods, existingLinesForPreview, removalLines, inserted, updated, successfulRowKeys.Count > 0);

        if (!confirm)
        {
            return new ImportResult(DryRun: true, ImportBatch: null, Preview: preview);
        }

        await ArchiveAndDeleteSalesLinesAsync(removalLines, batch.Id, ArchiveReason.SUPERSEDED_BY_REIMPORT, cancellationToken);
        await SaveIssuesAsync(batch.Id, issues, cancellationToken);

        var status = DetermineStatus(parsed.TotalRows, errorRows, inserted, updated);
        batch.Status = status;
        batch.FinishedAt = DateTime.UtcNow;
        batch.SheetsFound = JsonSerializer.Serialize(parsed.SheetNames);
        batch.SheetsImported = JsonSerializer.Serialize(new[] { parsed.FirstSheetName });
        batch.TotalRows = parsed.TotalRows;
        batch.InsertedRows = inserted;
        batch.UpdatedRows = updated;
        batch.ErrorRows = errorRows;
        batch.PeriodsTouched = JsonSerializer.Serialize(targetPeriods);
        batch.RemovedRows = removalLines.Count;
        await _db.SaveChangesAsync(cancellationToken);

        await MarkInsightsStaleAsync(periodsTouched, cancellationToken);

        var dto = await LoadBatchAsync(batch.Id, includeIssues: true, cancellationToken);
        return new ImportResult(DryRun: false, ImportBatch: dto, Preview: null);
    }

    // -----------------------------------------------------------------------
    //  Period Delete
    // -----------------------------------------------------------------------

    private async Task<ImportResult> RunPeriodDeleteAsync(
        int uploadedById,
        List<Period> targetPeriods,
        bool confirm,
        CancellationToken cancellationToken)
    {
        var locked = await _lockService.TryAcquireTransactionLockAsync(ImportAdvisoryLockKey, cancellationToken);
        if (!locked)
            throw new ImportInProgressException();

        await EnsureNoImportInProgressAsync(cancellationToken);

        var targetPeriodKeys = targetPeriods.Select(p => PeriodKey(p.Year, p.Month)).ToHashSet();
        var existingLines = await _db.SalesLines
            .Include(s => s.Hospital)
            .Include(s => s.Credits)
            .Where(s => targetPeriodKeys.Contains(PeriodKey(s.Year, s.Month)))
            .OrderBy(s => s.InvoiceNo)
            .ToListAsync(cancellationToken);

        var preview = BuildPreview(targetPeriods, existingLines.Select(s => s.Total).ToList(), existingLines, 0, 0, false);

        if (!confirm)
            return new ImportResult(DryRun: true, ImportBatch: null, Preview: preview);

        var batch = new ImportBatch
        {
            FileName = "(ลบข้อมูลตามงวด)",
            FileSizeBytes = 0,
            UploadedById = uploadedById,
            Status = ImportStatus.PROCESSING,
            Mode = ImportMode.PERIOD_DELETE,
            TargetPeriods = JsonSerializer.Serialize(targetPeriods),
            ConfirmedById = uploadedById,
        };
        _db.ImportBatches.Add(batch);
        await _db.SaveChangesAsync(cancellationToken);

        await ArchiveAndDeleteSalesLinesAsync(existingLines, batch.Id, ArchiveReason.MANUAL_PERIOD_DELETE, cancellationToken);

        var periodsTouched = targetPeriods.Select(p => PeriodKey(p.Year, p.Month)).ToHashSet();
        await MarkInsightsStaleAsync(periodsTouched, cancellationToken);

        batch.Status = ImportStatus.SUCCESS;
        batch.FinishedAt = DateTime.UtcNow;
        batch.TotalRows = 0;
        batch.RemovedRows = existingLines.Count;
        batch.PeriodsTouched = JsonSerializer.Serialize(targetPeriods);
        await _db.SaveChangesAsync(cancellationToken);

        var dto = await LoadBatchAsync(batch.Id, includeIssues: true, cancellationToken);
        return new ImportResult(DryRun: false, ImportBatch: dto, Preview: null);
    }

    // -----------------------------------------------------------------------
    //  Credit / Hospital / Product resolution (ports of creditResolution.service.ts)
    // -----------------------------------------------------------------------

    // In-memory indexes built once per import transaction
    private record SalespersonIndex(Dictionary<string, int> ByPersonCore);
    private record HospitalIndex(
        Dictionary<string, int> ByLatinAlias,
        Dictionary<string, int> ByLatinFallback,
        Dictionary<string, (int HospitalId, string NameInFile)> ByThaiCore,
        Dictionary<int, string?> ProvinceById);
    private record ProductIndex(
        Dictionary<string, int> ByLatinAlias, // normalizedKey -> Product.Id
        Dictionary<string, int> ByLatinFallback); // latinCore(name) -> Product.Id

    private async Task<(HospitalIndex, SalespersonIndex, Dictionary<string, int>, ProductIndex, Dictionary<int, string>)>
        BuildIndexesAsync(CancellationToken cancellationToken)
    {
        var salespeople = await _db.Salespeople
            .AsNoTracking()
            .Select(s => new { s.Id, s.NameInFile })
            .ToListAsync(cancellationToken);
        var spByPersonCore = salespeople.ToDictionary(s => NameNormalizer.PersonCore(s.NameInFile), s => s.Id);
        var salespersonIdx = new SalespersonIndex(spByPersonCore);

        var hospitals = await _db.Hospitals
            .AsNoTracking()
            .Select(h => new { h.Id, h.NameInFile, h.Province })
            .ToListAsync(cancellationToken);
        var aliases = await _db.HospitalAliases
            .AsNoTracking()
            .Select(a => new { a.NormalizedKey, a.HospitalId })
            .ToListAsync(cancellationToken);

        var byLatinAlias = aliases.ToDictionary(a => a.NormalizedKey, a => a.HospitalId);
        var byLatinFallback = new Dictionary<string, int>();
        var byThaiCore = new Dictionary<string, (int, string)>();
        var provinceById = new Dictionary<int, string?>();
        foreach (var h in hospitals)
        {
            byLatinFallback[NameNormalizer.LatinCore(h.NameInFile)] = h.Id;
            provinceById[h.Id] = h.Province;
            var thai = NameNormalizer.ThaiCore(h.NameInFile);
            if (!string.IsNullOrEmpty(thai) && !byThaiCore.ContainsKey(thai))
                byThaiCore[thai] = (h.Id, h.NameInFile);
        }
        var hospitalIdx = new HospitalIndex(byLatinAlias, byLatinFallback, byThaiCore, provinceById);

        var products = await _db.Products
            .AsNoTracking()
            .Select(p => new { p.Id, p.Name, p.ProductTypeId })
            .ToListAsync(cancellationToken);
        var productAliases = await _db.ProductAliases
            .AsNoTracking()
            .Select(a => new { a.NormalizedKey, a.ProductId })
            .ToListAsync(cancellationToken);
        var byProductAlias = productAliases.ToDictionary(a => a.NormalizedKey, a => a.ProductId);
        var byProductFallback = products.ToDictionary(p => NameNormalizer.LatinCore(p.Name), p => p.Id);
        var productIdx = new ProductIndex(byProductAlias, byProductFallback);

        var productTypes = await _db.ProductTypes
            .AsNoTracking()
            .Select(pt => new { pt.Id, pt.Name })
            .ToListAsync(cancellationToken);
        var productTypeNames = productTypes.ToDictionary(pt => pt.Id, pt => pt.Name);
        var productTypeCache = new Dictionary<string, int>(); // lowercase name -> id

        return (hospitalIdx, salespersonIdx, productTypeCache, productIdx, productTypeNames);
    }

    private record ResolvedCredit(int SalespersonId, decimal SharePercent, bool IsPrimary);

    private async Task<List<ResolvedCredit>?> ResolveSalesmanCreditsAsync(
        SalespersonIndex index,
        string rawSalesmanCell,
        List<IssueInput> issues,
        string sheetName,
        int rowNumber,
        CancellationToken cancellationToken)
    {
        var subNames = NameNormalizer.SplitSharedSalesmanNames(rawSalesmanCell);

        if (subNames.Length <= 1)
        {
            var id = await ResolveOrCreateSalespersonAsync(index, rawSalesmanCell, issues, sheetName, rowNumber, cancellationToken);
            return [new ResolvedCredit(id, 100.000m, true)];
        }

        var normalizedRaw = NameNormalizer.NormalizeSharedSalesmanRaw(subNames);
        var existingRule = await _db.SalesmanNameRules
            .Include(r => r.Members)
            .FirstOrDefaultAsync(r => r.NormalizedRaw == normalizedRaw, cancellationToken);

        if (existingRule != null)
        {
            var primaryId = LookupByPersonCore(index, subNames[0]);
            return existingRule.Members.Select(m => new ResolvedCredit(
                m.SalespersonId, m.SharePercent, primaryId.HasValue && m.SalespersonId == primaryId.Value)).ToList();
        }

        var resolvedIds = subNames.Select(n => LookupByPersonCore(index, n)).ToList();
        var unresolved = subNames.Where((n, i) => !resolvedIds[i].HasValue).ToList();
        if (unresolved.Count > 0)
        {
            issues.Add(new IssueInput("ERROR", "UNKNOWN_SALESMAN_IN_SHARED_DEAL",
                $"ไม่พบพนักงานขายที่มีอยู่แล้วสำหรับชื่อ: {string.Join(", ", unresolved)} ในค่าดิบ \"{rawSalesmanCell}\" — ข้ามแถวนี้",
                SheetName: sheetName, RowNumber: rowNumber));
            return null;
        }

        var ids = resolvedIds.Select(x => x!.Value).ToList();
        var shares = SplitEqualShares(ids.Count);

        var rule = new SalesmanNameRule
        {
            NormalizedRaw = normalizedRaw,
            SampleRaw = rawSalesmanCell,
        };
        foreach (var (id, i) in ids.Select((id, i) => (id, i)))
        {
            rule.Members.Add(new SalesmanNameRuleMember
            {
                SalespersonId = id,
                SharePercent = shares[i],
            });
        }
        _db.SalesmanNameRules.Add(rule);
        await _db.SaveChangesAsync(cancellationToken);

        issues.Add(new IssueInput("WARNING", "SHARED_CREDIT_RULE_CREATED",
            $"พบดีลแบ่งเครดิตรูปแบบใหม่ \"{rawSalesmanCell}\" — สร้างกฎแบ่งเท่ากันทุกคน ({ids.Count} คน) รหัสกฎ {rule.Id} รอผู้จัดการยืนยัน/แก้สัดส่วน",
            SheetName: sheetName, RowNumber: rowNumber));

        return ids.Select((id, i) => new ResolvedCredit(id, shares[i], i == 0)).ToList();
    }

    private async Task<int> ResolveOrCreateSalespersonAsync(
        SalespersonIndex index, string rawName, List<IssueInput> issues,
        string sheetName, int rowNumber, CancellationToken cancellationToken)
    {
        var key = NameNormalizer.PersonCore(rawName);
        if (index.ByPersonCore.TryGetValue(key, out var existingId))
            return existingId;

        var review = await _db.SalesmanNameReviews.FirstOrDefaultAsync(r => r.PersonKey == key, cancellationToken);
        if (review?.Status == NameReviewStatus.MERGED && review.MergedIntoId.HasValue)
        {
            index.ByPersonCore[key] = review.MergedIntoId.Value;
            return review.MergedIntoId.Value;
        }

        var created = new Salesperson { NameInFile = rawName, DisplayName = rawName };
        _db.Salespeople.Add(created);
        await _db.SaveChangesAsync(cancellationToken);
        index.ByPersonCore[key] = created.Id;

        if (review == null)
        {
            _db.SalesmanNameReviews.Add(new SalesmanNameReview
            {
                PersonKey = key,
                SampleRaw = rawName,
                CreatedSalespersonId = created.Id,
            });
            await _db.SaveChangesAsync(cancellationToken);
        }

        issues.Add(new IssueInput("WARNING", "UNKNOWN_SALESMAN",
            $"สร้างพนักงานขายใหม่: {rawName} — รอผู้จัดการยืนยันในคิว \"ยืนยันชื่อซ้ำ\"",
            SheetName: sheetName, RowNumber: rowNumber));
        return created.Id;
    }

    private static int? LookupByPersonCore(SalespersonIndex index, string rawName)
    {
        var key = NameNormalizer.PersonCore(rawName);
        return index.ByPersonCore.TryGetValue(key, out var id) ? id : null;
    }

    private async Task<int> ResolveHospitalViaAliasAsync(
        HospitalIndex index, string rawName, string? province,
        List<IssueInput> issues, string sheetName, int rowNumber,
        CancellationToken cancellationToken)
    {
        var latin = NameNormalizer.LatinCore(rawName);
        var thai = NameNormalizer.ThaiCore(rawName);

        if (index.ByLatinAlias.TryGetValue(latin, out var aliasedId))
        {
            await SyncHospitalProvinceAsync(index, aliasedId, province, cancellationToken);
            return aliasedId;
        }

        if (index.ByLatinFallback.TryGetValue(latin, out var fallbackId))
        {
            _db.HospitalAliases.Add(new HospitalAlias { NormalizedKey = latin, SampleRaw = rawName, HospitalId = fallbackId, Source = NameDecisionSource.AUTO });
            await _db.SaveChangesAsync(cancellationToken);
            index.ByLatinAlias[latin] = fallbackId;
            await SyncHospitalProvinceAsync(index, fallbackId, province, cancellationToken);
            return fallbackId;
        }

        if (!string.IsNullOrEmpty(thai) && index.ByThaiCore.TryGetValue(thai, out var thaiCollision))
        {
            await EnsureHospitalReviewQueuedAsync(rawName, latin, thaiCollision, cancellationToken);
        }

        var created = new Hospital { NameInFile = rawName, DisplayName = rawName, Province = province };
        _db.Hospitals.Add(created);
        await _db.SaveChangesAsync(cancellationToken);

        _db.HospitalAliases.Add(new HospitalAlias { NormalizedKey = latin, SampleRaw = rawName, HospitalId = created.Id, Source = NameDecisionSource.AUTO });
        await _db.SaveChangesAsync(cancellationToken);

        index.ByLatinAlias[latin] = created.Id;
        index.ByLatinFallback[latin] = created.Id;
        index.ProvinceById[created.Id] = province;
        if (!string.IsNullOrEmpty(thai) && !index.ByThaiCore.ContainsKey(thai))
            index.ByThaiCore[thai] = (created.Id, rawName);

        issues.Add(new IssueInput("WARNING", "NEW_HOSPITAL", $"สร้างโรงพยาบาลใหม่: {rawName}",
            SheetName: sheetName, RowNumber: rowNumber));
        return created.Id;
    }

    private async Task SyncHospitalProvinceAsync(HospitalIndex index, int hospitalId, string? province, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(province)) return;
        if (index.ProvinceById.TryGetValue(hospitalId, out var current) && current == province) return;
        var h = await _db.Hospitals.FindAsync([hospitalId], cancellationToken);
        if (h != null)
        {
            h.Province = province;
            index.ProvinceById[hospitalId] = province;
        }
    }

    private async Task EnsureHospitalReviewQueuedAsync(
        string rawName, string rawLatin,
        (int HospitalId, string NameInFile) existing,
        CancellationToken cancellationToken)
    {
        var existingLatin = NameNormalizer.LatinCore(existing.NameInFile);
        if (existingLatin == rawLatin) return;

        var (keyA, keyB) = string.CompareOrdinal(rawLatin, existingLatin) <= 0
            ? (rawLatin, existingLatin)
            : (existingLatin, rawLatin);
        var (sampleA, sampleB) = rawLatin == keyA
            ? (rawName, existing.NameInFile)
            : (existing.NameInFile, rawName);

        var alreadyQueued = await _db.HospitalNameReviews
            .AnyAsync(r => r.NormalizedKeyA == keyA && r.NormalizedKeyB == keyB, cancellationToken);
        if (alreadyQueued) return;

        _db.HospitalNameReviews.Add(new HospitalNameReview
        {
            NormalizedKeyA = keyA,
            NormalizedKeyB = keyB,
            SampleRawA = sampleA,
            SampleRawB = sampleB,
        });
        await _db.SaveChangesAsync(cancellationToken);
    }

    private record ProductRef(int Id, int ProductTypeId);

    private async Task<ProductRef> ResolveProductViaAliasAsync(
        ProductIndex index, string rawName, int productTypeId, CancellationToken cancellationToken)
    {
        var latin = NameNormalizer.LatinCore(rawName);
        if (index.ByLatinAlias.TryGetValue(latin, out var aliasedId))
        {
            var p = await _db.Products.AsNoTracking().Select(x => new { x.Id, x.ProductTypeId }).FirstOrDefaultAsync(x => x.Id == aliasedId, cancellationToken);
            if (p != null) return new ProductRef(p.Id, p.ProductTypeId);
        }

        if (index.ByLatinFallback.TryGetValue(latin, out var fallbackId))
        {
            _db.ProductAliases.Add(new ProductAlias { NormalizedKey = latin, SampleRaw = rawName, ProductId = fallbackId });
            await _db.SaveChangesAsync(cancellationToken);
            index.ByLatinAlias[latin] = fallbackId;
            var p = await _db.Products.AsNoTracking().Select(x => new { x.Id, x.ProductTypeId }).FirstOrDefaultAsync(x => x.Id == fallbackId, cancellationToken);
            if (p != null) return new ProductRef(p.Id, p.ProductTypeId);
        }

        var created = new Product { Name = rawName, ProductTypeId = productTypeId };
        _db.Products.Add(created);
        await _db.SaveChangesAsync(cancellationToken);

        _db.ProductAliases.Add(new ProductAlias { NormalizedKey = latin, SampleRaw = rawName, ProductId = created.Id });
        await _db.SaveChangesAsync(cancellationToken);

        index.ByLatinAlias[latin] = created.Id;
        index.ByLatinFallback[latin] = created.Id;
        return new ProductRef(created.Id, productTypeId);
    }

    private async Task<int> ResolveProductTypeAsync(
        Dictionary<string, int> cache, string name, CancellationToken cancellationToken)
    {
        var key = name.ToLowerInvariant();
        if (cache.TryGetValue(key, out var cached)) return cached;

        var existing = await _db.ProductTypes
            .FirstOrDefaultAsync(pt => pt.Name.ToLower() == key, cancellationToken);
        if (existing == null)
        {
            existing = new ProductType { Name = name };
            _db.ProductTypes.Add(existing);
            await _db.SaveChangesAsync(cancellationToken);
        }
        cache[key] = existing.Id;
        return existing.Id;
    }

    // -----------------------------------------------------------------------
    //  Archive helpers
    // -----------------------------------------------------------------------

    private async Task ArchiveAndDeleteSalesLinesAsync(
        List<SalesLine> salesLines, int batchId, ArchiveReason reason, CancellationToken cancellationToken)
    {
        if (salesLines.Count == 0) return;

        _db.SalesLineArchives.AddRange(salesLines.Select(sl => new SalesLineArchive
        {
            SalesLineId = sl.Id,
            RowKey = sl.RowKey,
            Year = sl.Year,
            Month = sl.Month,
            Total = sl.Total,
            Reason = reason,
            RemovedByBatchId = batchId,
            Payload = JsonSerializer.Serialize(new { salesLine = sl }),
        }));
        _db.SalesLines.RemoveRange(salesLines);
        await _db.SaveChangesAsync(cancellationToken);
    }

    // -----------------------------------------------------------------------
    //  Insight staleness
    // -----------------------------------------------------------------------

    private async Task MarkInsightsStaleAsync(HashSet<string> periodsTouched, CancellationToken cancellationToken)
    {
        if (periodsTouched.Count == 0) return;

        var monthPeriods = periodsTouched.Select(k =>
        {
            var parts = k.Split('-');
            return (Year: int.Parse(parts[0]), Month: int.Parse(parts[1]));
        }).ToList();

        var quarterKeys = monthPeriods
            .Select(p => $"{p.Year}-{(int)Math.Ceiling(p.Month / 3.0)}")
            .ToHashSet();
        var years = monthPeriods.Select(p => p.Year).ToHashSet();

        foreach (var (yr, mo) in monthPeriods)
        {
            await _db.CoachingInsights
                .Where(ci => ci.PeriodType == PeriodType.MONTH && ci.Year == yr && ci.PeriodNumber == mo)
                .ExecuteUpdateAsync(s => s.SetProperty(ci => ci.IsStale, true), cancellationToken);
        }
        foreach (var qk in quarterKeys)
        {
            var parts2 = qk.Split('-');
            var qYear = int.Parse(parts2[0]);
            var qQuarter = int.Parse(parts2[1]);
            await _db.CoachingInsights
                .Where(ci => ci.PeriodType == PeriodType.QUARTER && ci.Year == qYear && ci.PeriodNumber == qQuarter)
                .ExecuteUpdateAsync(s => s.SetProperty(ci => ci.IsStale, true), cancellationToken);
        }
        foreach (var y in years)
        {
            await _db.CoachingInsights
                .Where(ci => ci.PeriodType == PeriodType.YEAR && ci.Year == y)
                .ExecuteUpdateAsync(s => s.SetProperty(ci => ci.IsStale, true), cancellationToken);
        }
    }

    // -----------------------------------------------------------------------
    //  Pure helpers
    // -----------------------------------------------------------------------

    private static string PeriodKey(int year, int month) => $"{year}-{month}";

    private static HashSet<string> PeriodWhere(List<Period> periods)
        => periods.Select(p => PeriodKey(p.Year, p.Month)).ToHashSet();

    private static bool PeriodOutOfScope(List<ParsedRow> rows, List<Period> targetPeriods)
    {
        var selected = targetPeriods.Select(p => PeriodKey(p.Year, p.Month)).ToHashSet();
        return rows.Any(r => !selected.Contains(PeriodKey(r.Year, r.Month)));
    }

    private static List<Period> UniquePeriods(List<Period> periods)
        => periods.DistinctBy(p => PeriodKey(p.Year, p.Month)).ToList();

    private static ImportStatus DetermineStatus(int totalRows, int errorRows, int insertedRows, int updatedRows)
    {
        if (totalRows == 0) return ImportStatus.SUCCESS;
        if (errorRows == 0) return ImportStatus.SUCCESS;
        if (insertedRows + updatedRows == 0) return ImportStatus.FAILED;
        return ImportStatus.PARTIAL;
    }

    private static decimal[] SplitEqualShares(int count)
    {
        const int total = 100_000;
        var baseVal = total / count;
        var shares = Enumerable.Repeat(baseVal, count).ToArray();
        var remainder = total - baseVal * count;
        shares[^1] += remainder;
        return shares.Select(s => Math.Round(s / 1000m, 3)).ToArray();
    }

    private static DryRunPreview BuildPreview(
        List<Period> periods,
        List<decimal> existingTotals,
        List<SalesLine> removalLines,
        int insertedRows,
        int updatedRows,
        bool hasReplacement)
    {
        var existingTotal = existingTotals.Aggregate(0m, (acc, t) => acc + t);
        return new DryRunPreview(
            TargetPeriods: periods,
            ExistingRows: existingTotals.Count,
            ExistingTotal: existingTotal.ToString("F2"),
            InsertedRows: insertedRows,
            UpdatedRows: updatedRows,
            RemovedRows: removalLines.Count,
            RemovalSamples: removalLines.Take(20).Select(s => new RemovalSample(
                s.InvoiceNo, s.Hospital?.DisplayName ?? "", s.Total.ToString("F2"))).ToList(),
            WillDeletePeriodWithoutReplacement: !hasReplacement);
    }

    private static void UpdateSalesLineFields(SalesLine sl, ParsedRow row, int hospitalId,
        int salespersonId, ProductRef product, int batchId, string sheetName)
    {
        sl.InvoiceNo = row.InvoiceNo;
        sl.PoNo = row.PoNo;
        sl.InvoiceDate = DateOnly.FromDateTime(row.InvoiceDate);
        sl.Year = row.Year;
        sl.Month = row.Month;
        sl.HospitalId = hospitalId;
        sl.SalespersonId = salespersonId;
        sl.ProductId = product.Id;
        sl.ProductTypeId = product.ProductTypeId;
        sl.Lot = row.Lot;
        sl.ExpiryDate = row.ExpiryDate.HasValue ? DateOnly.FromDateTime(row.ExpiryDate.Value) : null;
        sl.Province = row.Province;
        sl.Qty = (decimal)row.Qty;
        sl.UnitPrice = (decimal)row.UnitPrice;
        sl.Amount = (decimal)row.Amount;
        sl.Vat = (decimal)row.Vat;
        sl.Total = (decimal)row.Total;
        sl.SourceSheetName = sheetName;
        sl.SourceRowNumber = row.RowNumber;
        sl.ImportBatchId = batchId;
        sl.UpdatedAt = DateTime.UtcNow;
    }

    private async Task EnsureNoImportInProgressAsync(CancellationToken cancellationToken)
    {
        var existing = await _db.ImportBatches
            .Where(b => b.Status == ImportStatus.PROCESSING)
            .Select(b => b.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (existing != 0)
            throw new ImportInProgressException();
    }

    private async Task SaveIssuesAsync(int batchId, List<IssueInput> issues, CancellationToken cancellationToken)
    {
        if (issues.Count == 0) return;
        _db.ImportIssues.AddRange(issues.Select(i => new ImportIssue
        {
            ImportBatchId = batchId,
            SheetName = i.SheetName,
            RowNumber = i.RowNumber,
            ColumnName = i.ColumnName,
            Level = Enum.Parse<ImportIssueLevel>(i.Level),
            Code = i.Code,
            Message = i.Message,
        }));
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task UpdateBatchFailedAsync(
        int batchId, string errorMessage, List<string> sheetNames,
        int totalRows, int insertedRows, int updatedRows, int errorRows,
        HashSet<string> periodsTouched, CancellationToken cancellationToken)
    {
        var batch = await _db.ImportBatches.FindAsync([batchId], cancellationToken);
        if (batch == null) return;
        batch.Status = ImportStatus.FAILED;
        batch.FinishedAt = DateTime.UtcNow;
        batch.ErrorMessage = errorMessage;
        batch.SheetsFound = JsonSerializer.Serialize(sheetNames);
        batch.TotalRows = totalRows;
        batch.InsertedRows = insertedRows;
        batch.UpdatedRows = updatedRows;
        batch.ErrorRows = errorRows;
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<ImportBatchDto> PersistFailedBatchAsync(
        string fileName, int fileSizeBytes, int uploadedById, ImportMode mode,
        List<Period> targetPeriods, string errorMessage, CancellationToken cancellationToken)
    {
        var batch = new ImportBatch
        {
            FileName = fileName,
            FileSizeBytes = fileSizeBytes,
            UploadedById = uploadedById,
            Status = ImportStatus.FAILED,
            FinishedAt = DateTime.UtcNow,
            Mode = mode,
            TargetPeriods = targetPeriods.Count > 0 ? JsonSerializer.Serialize(targetPeriods) : null,
            ErrorMessage = errorMessage,
        };
        _db.ImportBatches.Add(batch);
        await _db.SaveChangesAsync(cancellationToken);
        return await LoadBatchAsync(batch.Id, includeIssues: false, cancellationToken);
    }

    private async Task<ImportBatchDto> LoadBatchAsync(int id, bool includeIssues, CancellationToken cancellationToken)
    {
        var q = _db.ImportBatches.AsNoTracking().Include(b => b.UploadedBy).AsQueryable();
        if (includeIssues) q = q.Include(b => b.Issues);
        var b = await q.FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
        return MapBatch(b!, includeIssues);
    }

    private static ImportBatchDto MapBatch(ImportBatch b, bool includeIssues = false) => new()
    {
        Id = b.Id,
        FileName = b.FileName,
        FileSizeBytes = b.FileSizeBytes,
        UploadedById = b.UploadedById,
        UploadedBy = b.UploadedBy == null ? null : new UserRef
        {
            Id = b.UploadedBy.Id,
            DisplayName = b.UploadedBy.DisplayName,
            Email = b.UploadedBy.Email,
        },
        StartedAt = b.StartedAt,
        FinishedAt = b.FinishedAt,
        Status = b.Status.ToString(),
        SheetsFound = b.SheetsFound != null ? (object)JsonSerializer.Deserialize<object>(b.SheetsFound)! : null,
        SheetsImported = b.SheetsImported != null ? (object)JsonSerializer.Deserialize<object>(b.SheetsImported)! : null,
        TotalRows = b.TotalRows,
        InsertedRows = b.InsertedRows,
        UpdatedRows = b.UpdatedRows,
        SkippedRows = b.SkippedRows,
        ErrorRows = b.ErrorRows,
        PeriodsTouched = b.PeriodsTouched != null ? (object)JsonSerializer.Deserialize<object>(b.PeriodsTouched)! : null,
        ErrorMessage = b.ErrorMessage,
        Mode = b.Mode.ToString(),
        TargetPeriods = b.TargetPeriods != null ? (object)JsonSerializer.Deserialize<object>(b.TargetPeriods)! : null,
        RemovedRows = b.RemovedRows,
        ConfirmedById = b.ConfirmedById,
        Issues = includeIssues ? b.Issues.Select(i => new ImportIssueDto
        {
            Id = i.Id,
            ImportBatchId = i.ImportBatchId,
            SheetName = i.SheetName,
            RowNumber = i.RowNumber,
            ColumnName = i.ColumnName,
            Level = i.Level.ToString(),
            Code = i.Code,
            Message = i.Message,
            RawRow = i.RawRow,
        }).ToList() : null,
    };

    private static SalesLineDto MapSalesLine(SalesLine s) => new()
    {
        Id = s.Id,
        InvoiceNo = s.InvoiceNo,
        PoNo = s.PoNo,
        InvoiceDate = s.InvoiceDate,
        Year = s.Year,
        Month = s.Month,
        HospitalId = s.HospitalId,
        Hospital = s.Hospital == null ? null : new { id = s.Hospital.Id, displayName = s.Hospital.DisplayName },
        SalespersonId = s.SalespersonId,
        Salesperson = s.Salesperson == null ? null : new { id = s.Salesperson.Id, displayName = s.Salesperson.DisplayName },
        ProductId = s.ProductId,
        Product = s.Product == null ? null : new { id = s.Product.Id, name = s.Product.Name },
        ProductTypeId = s.ProductTypeId,
        ProductType = s.ProductType == null ? null : new { id = s.ProductType.Id, name = s.ProductType.Name },
        Lot = s.Lot,
        ExpiryDate = s.ExpiryDate,
        Province = s.Province,
        Qty = s.Qty,
        UnitPrice = s.UnitPrice,
        Amount = s.Amount,
        Vat = s.Vat,
        Total = s.Total,
        RowKey = s.RowKey,
        SourceSheetName = s.SourceSheetName,
        SourceRowNumber = s.SourceRowNumber,
        ImportBatchId = s.ImportBatchId,
        CreatedAt = s.CreatedAt,
        UpdatedAt = s.UpdatedAt,
    };

    // -----------------------------------------------------------------------
    //  Internal record types
    // -----------------------------------------------------------------------

    private record ParsedWorkbook(
        string FirstSheetName,
        List<IssueInput> Issues,
        List<ParsedRow> ParsedRows,
        List<string> SheetNames,
        int TotalRows,
        int ErrorRows);

    private record ParsedRow(
        int RowNumber, string HospitalName, string SalesmanRaw, DateTime InvoiceDate,
        int Year, int Month, string InvoiceNo, string? PoNo, string ProductTypeName,
        string ProductName, string? Lot, DateTime? ExpiryDate, string? Province,
        double Qty, double UnitPrice, double Amount, double Vat, double Total, string RowKey);

    private record IssueInput(
        string Level, string Code, string Message,
        string? SheetName = null, int? RowNumber = null, string? ColumnName = null);
}

/// <summary>Thrown when pg_try_advisory_xact_lock cannot be acquired (concurrent import).</summary>
public class ImportInProgressException : Exception
{
    public ImportInProgressException() : base("มีการนำเข้าไฟล์อื่นกำลังดำเนินการอยู่ กรุณารอให้เสร็จก่อนแล้วลองใหม่อีกครั้ง") { }
}

/// <summary>Thrown when REPLACE_PERIOD file contains rows outside target periods.</summary>
public class PeriodOutOfScopeException : Exception
{
    public PeriodOutOfScopeException() : base("PERIOD_OUT_OF_SCOPE") { }
}
