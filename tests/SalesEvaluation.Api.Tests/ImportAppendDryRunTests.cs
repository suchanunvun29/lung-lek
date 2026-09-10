namespace SalesEvaluation.Api.Tests;

// T-UX-027 — APPEND dry-run. These service-level tests run against SQLite because the
// rollback guarantee ("dry-run ต้องไม่ persist อะไรเลย ทั้งข้อมูลและ batch row") is the
// whole point: the InMemory provider ignores transactions, so only SQLite proves that
// everything staged inside RunAppendDryRunAsync actually rolls back.
//
// The HTTP contract shape is pinned separately in ImportAppendEndpointTests.

using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;
using SalesEvaluation.Infrastructure.Excel;
using SalesEvaluation.Infrastructure.Persistence;
using Xunit;

public class ImportAppendDryRunTests
{
    private const int Year = 2027;
    private const int Month = 3;

    private static readonly string[] Headers =
    [
        "Hospital Name", "Salesman", "Inv Date", "Year", "Month", "Inv No.", "Po NO.",
        "Product type", "Product Name", "Lot", "Exp", "Province", "Qty", "Price",
        "Amount", "Vat", "Total",
    ];

    private sealed class AlwaysAcquirableLockService : IPostgresAdvisoryLockService
    {
        public Task<bool> TryAcquireTransactionLockAsync(long lockKey = IPostgresAdvisoryLockService.DefaultImportAdvisoryLockKey, CancellationToken cancellationToken = default)
            => Task.FromResult(true);
    }

    private static (AppDbContext Db, ImportService Service, SqliteConnection Connection) CreateService()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connection)
            .Options;
        var db = new AppDbContext(options);
        db.Database.EnsureCreated();
        SeedMasterData(db);
        var service = new ImportService(db, new AlwaysAcquirableLockService(), NullLogger<ImportService>.Instance);
        return (db, service, connection);
    }

    private static void SeedMasterData(AppDbContext db)
    {
        // ImportBatch.UploadedById has an FK to Users — imports are called with uploadedById=1.
        db.Users.Add(new User
        {
            Id = 1,
            Email = "manager@test.local",
            PasswordHash = "hash",
            DisplayName = "Manager",
            Role = UserRole.MANAGER,
            IsActive = true,
            MustChangePassword = false,
        });

        var productType = new ProductType { Id = 1, Name = "B-Type (Consumables)" };
        var product = new Product
        {
            Id = 1,
            Name = "Product Beta",
            ProductTypeId = 1,
            ProductType = productType,
            Source = ProductSource.SALES_HISTORY,
            IsActive = true,
        };
        var salesperson = new Salesperson { Id = 1, NameInFile = "SOMCHAI", DisplayName = "สมชาย", IsActive = true };
        var hospital = new Hospital { Id = 1, NameInFile = "Test Hospital", DisplayName = "Test Hospital", Province = "เชียงใหม่" };
        var alias = new HospitalAlias
        {
            NormalizedKey = "CHIANGMAI",
            SampleRaw = "Test Hospital",
            HospitalId = 1,
            Hospital = hospital,
            Source = NameDecisionSource.AUTO,
        };
        db.AddRange(productType, product, salesperson, hospital, alias);
        db.SaveChanges();
    }

    private static byte[] BuildWorkbook(params object?[][] rows)
    {
        using var workbook = new ClosedXML.Excel.XLWorkbook();
        var ws = workbook.Worksheets.Add("Sheet1");
        for (var c = 0; c < Headers.Length; c++)
            ws.Cell(1, c + 1).Value = Headers[c];

        WriteRows(ws, rows);

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        return ms.ToArray();
    }

    /// <summary>Arbitrary content with no recognizable header row — for the HEADER_NOT_FOUND case.</summary>
    private static byte[] BuildWorkbookWithoutHeaders(params object?[][] rows)
    {
        using var workbook = new ClosedXML.Excel.XLWorkbook();
        var ws = workbook.Worksheets.Add("Sheet1");
        WriteRows(ws, rows, startRow: 1);
        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        return ms.ToArray();
    }

    private static void WriteRows(ClosedXML.Excel.IXLWorksheet ws, object?[][] rows, int startRow = 2)
    {
        for (var r = 0; r < rows.Length; r++)
        {
            var values = rows[r];
            for (var c = 0; c < values.Length; c++)
            {
                if (values[c] is null) continue;
                ws.Cell(r + startRow, c + 1).Value = ClosedXML.Excel.XLCellValue.FromObject(values[c]);
            }
        }
    }

    // Total must equal Amount+Vat AND Qty×Price to stay warning-free — the parser flags
    // TOTAL_MISMATCH otherwise (amount 1000 + vat 70 = 1070 = 10 × 107).
    private static object?[] CleanRow(string invoiceNo) =>
    [
        "CHIANGMAI", "SOMCHAI", new DateTime(Year, Month, 15), (double)Year, (double)Month,
        invoiceNo, $"PO-{invoiceNo}", "B-Type (Consumables)", "Product Beta", null, null,
        "เชียงใหม่", 10.0, 107.0, 1000.0, 70.0, 1070.0,
    ];

    // ── AC: dry-run ไม่ persist — ตรวจทั้ง SalesLines และ batch row ──

    [Fact]
    public async Task AppendDryRun_PersistsNothing_DataAndBatch()
    {
        var (db, service, connection) = CreateService();
        using (connection)
        using (db)
        {
            var file = BuildWorkbook(CleanRow("INV-T-1"), CleanRow("INV-T-2"));

            var result = await service.ImportSalesFileAsync(
                file, "test.xlsx", file.Length, 1, ImportMode.APPEND,
                targetPeriods: null, confirm: false);

            Assert.True(result.DryRun);
            Assert.Null(result.ImportBatch);
            Assert.NotNull(result.AppendPreview);
            Assert.Null(result.AppendPreview!.FatalError);
            Assert.Equal(2, result.AppendPreview.TotalRows);
            Assert.Equal(2, result.AppendPreview.InsertedRows);
            Assert.Empty(result.AppendPreview.IssueCounts);
            Assert.Equal(Year, result.AppendPreview.PeriodsFound.Single().Year);
            Assert.Equal(Month, result.AppendPreview.PeriodsFound.Single().Month);

            // Rolled-back entities stay in the change tracker — a fresh request would get a
            // fresh DbContext, so clear here to see the database the way production would.
            db.ChangeTracker.Clear();

            Assert.Equal(0, await db.ImportBatches.CountAsync());
            Assert.Equal(0, await db.SalesLines.CountAsync());
            Assert.Equal(0, await db.SalesLineCredits.CountAsync());
            Assert.Equal(1, await db.Hospitals.CountAsync()); // seeded only — no NEW_HOSPITAL left behind
            Assert.Equal(1, await db.Salespeople.CountAsync());
        }
    }

    // ── AC: cancel หลัง preview → ไม่มีค้าง (dry-run ซ้ำได้ ผลเหมือนเดิม) ──

    [Fact]
    public async Task AppendDryRun_Twice_IsCleanAndRepeatable()
    {
        var (db, service, connection) = CreateService();
        using (connection)
        using (db)
        {
            var file = BuildWorkbook(CleanRow("INV-T-1"));

            for (var attempt = 0; attempt < 2; attempt++)
            {
                var result = await service.ImportSalesFileAsync(
                    file, "test.xlsx", file.Length, 1, ImportMode.APPEND, null, confirm: false);
                db.ChangeTracker.Clear();
                Assert.True(result.DryRun);
                Assert.Equal(1, result.AppendPreview!.InsertedRows);
            }

            Assert.Equal(0, await db.ImportBatches.CountAsync());
            Assert.Equal(0, await db.SalesLines.CountAsync());
            Assert.Equal(1, await db.HospitalAliases.CountAsync()); // seeded only
        }
    }

    // ── AC: confirm → commit จริง ──

    [Fact]
    public async Task AppendConfirm_PersistsDataAndBatch()
    {
        var (db, service, connection) = CreateService();
        using (connection)
        using (db)
        {
            var file = BuildWorkbook(CleanRow("INV-T-1"), CleanRow("INV-T-2"));

            var result = await service.ImportSalesFileAsync(
                file, "test.xlsx", file.Length, 1, ImportMode.APPEND, null, confirm: true);

            Assert.False(result.DryRun);
            Assert.NotNull(result.ImportBatch);
            Assert.Equal(ImportStatus.SUCCESS.ToString(), result.ImportBatch!.Status);
            Assert.Equal(2, result.ImportBatch.InsertedRows);
            Assert.Equal(2, await db.SalesLines.CountAsync());
            Assert.Equal(1, await db.ImportBatches.CountAsync());
        }
    }

    // ── AC: ไฟล์มั่ว (AMOUNT_RECOMPUTED / TOTAL_MISMATCH / แถว ERROR) → เห็นใน preview ก่อนเข้า DB ──

    [Fact]
    public async Task AppendDryRun_MessyFile_ShowsIssuesBeforeAnyCommit()
    {
        var (db, service, connection) = CreateService();
        using (connection)
        using (db)
        {
            object?[] amountMissing =
            [
                "CHIANGMAI", "SOMCHAI", new DateTime(Year, Month, 16), (double)Year, (double)Month,
                "INV-T-2", "PO-2", "B-Type (Consumables)", "Product Beta", null, null,
                "เชียงใหม่", 2.0, 53.5, null, 7.0, 107.0,
            ];
            object?[] totalMismatch =
            [
                "CHIANGMAI", "SOMCHAI", new DateTime(Year, Month, 17), (double)Year, (double)Month,
                "INV-T-3", "PO-3", "B-Type (Consumables)", "Product Beta", null, null,
                "เชียงใหม่", 1.0, 100.0, 100.0, 7.0, 500.0,
            ];
            object?[] missingHospital =
            [
                null, "SOMCHAI", new DateTime(Year, Month, 18), (double)Year, (double)Month,
                "INV-T-4", "PO-4", "B-Type (Consumables)", "Product Beta", null, null,
                "เชียงใหม่", 1.0, 107.0, 100.0, 7.0, 107.0,
            ];

            var file = BuildWorkbook(CleanRow("INV-T-1"), amountMissing, totalMismatch, missingHospital);

            var result = await service.ImportSalesFileAsync(
                file, "messy.xlsx", file.Length, 1, ImportMode.APPEND, null, confirm: false);
            db.ChangeTracker.Clear();

            Assert.True(result.DryRun);
            var preview = result.AppendPreview!;
            Assert.Null(preview.FatalError);
            Assert.Equal(4, preview.TotalRows);
            Assert.Equal(3, preview.InsertedRows);
            Assert.Equal(1, preview.ErrorRows);

            Assert.Contains(preview.IssueCounts, c => c.Level == "WARNING" && c.Count == 2);
            Assert.Contains(preview.IssueCounts, c => c.Level == "ERROR" && c.Count == 1);

            // ไม่มีอะไรลง DB — แถว ERROR ก็ไม่เข้า แถวที่จะเข้าก็ยังไม่เข้า
            db.ChangeTracker.Clear();
            Assert.Equal(0, await db.SalesLines.CountAsync());
            Assert.Equal(0, await db.ImportBatches.CountAsync());
        }
    }

    // ── AC: concurrent import → 409 IMPORT_IN_PROGRESS ยังกัน ──

    [Fact]
    public async Task AppendDryRun_WhileAnotherImportProcessing_ThrowsImportInProgress()
    {
        var (db, service, connection) = CreateService();
        using (connection)
        using (db)
        {
            db.ImportBatches.Add(new ImportBatch
            {
                FileName = "someone-else.xlsx",
                FileSizeBytes = 1,
                UploadedById = 1,
                Status = ImportStatus.PROCESSING,
                Mode = ImportMode.APPEND,
            });
            db.SaveChanges();

            var file = BuildWorkbook(CleanRow("INV-T-1"));
            await Assert.ThrowsAsync<ImportInProgressException>(() =>
                service.ImportSalesFileAsync(file, "test.xlsx", file.Length, 1, ImportMode.APPEND, null, confirm: false));

            // หลังงานอื่นจบ (ไม่มี PROCESSING แล้ว) — dry-run ทำงานได้
            var running = await db.ImportBatches.SingleAsync();
            running.Status = ImportStatus.FAILED;
            db.SaveChanges();

            var result = await service.ImportSalesFileAsync(
                file, "test.xlsx", file.Length, 1, ImportMode.APPEND, null, confirm: false);
            Assert.True(result.DryRun);
        }
    }

    // ── ไฟล์พังทั้งไฟล์ (ไม่มี header) → fatal preview, ไม่แตะ DB ──

    [Fact]
    public async Task AppendDryRun_UnreadableFile_ReturnsFatalPreviewWithoutTouchingDb()
    {
        var (db, service, connection) = CreateService();
        using (connection)
        using (db)
        {
            var file = BuildWorkbookWithoutHeaders(["ชื่อ รพ.", "พนักงาน", "วันที่"]); // no standard headers → HEADER_NOT_FOUND

            var result = await service.ImportSalesFileAsync(
                file, "broken.xlsx", file.Length, 1, ImportMode.APPEND, null, confirm: false);
            db.ChangeTracker.Clear();

            Assert.True(result.DryRun);
            Assert.NotNull(result.AppendPreview!.FatalError);
            Assert.Contains("header", result.AppendPreview.FatalError, StringComparison.OrdinalIgnoreCase);
            Assert.Equal(0, result.AppendPreview.TotalRows);
            Assert.Equal(0, await db.ImportBatches.CountAsync());
        }
    }

    // ── Regression: REPLACE + PERIOD_DELETE dry-run → confirm ยังครบ ──

    [Fact]
    public async Task ReplaceAndPeriodDelete_FlowsStillWork()
    {
        var (db, service, connection) = CreateService();
        using (connection)
        using (db)
        {
            var periods = new List<Period> { new(Year, Month) };
            var file = BuildWorkbook(CleanRow("INV-T-1"), CleanRow("INV-T-2"));

            // REPLACE — dry-run ตอบ preview แบบเดิม (ไม่ใช่ appendPreview)
            var replaceDryRun = await service.ImportSalesFileAsync(
                file, "replace.xlsx", file.Length, 1, ImportMode.REPLACE_PERIOD, periods, confirm: false);
            db.ChangeTracker.Clear();
            Assert.True(replaceDryRun.DryRun);
            Assert.NotNull(replaceDryRun.Preview);
            Assert.Null(replaceDryRun.AppendPreview);
            Assert.Equal(0, replaceDryRun.Preview!.RemovedRows);
            Assert.Equal(0, await db.SalesLines.CountAsync());

            // REPLACE — confirm
            var replaceConfirm = await service.ImportSalesFileAsync(
                file, "replace.xlsx", file.Length, 1, ImportMode.REPLACE_PERIOD, periods, confirm: true);
            db.ChangeTracker.Clear();
            Assert.False(replaceConfirm.DryRun);
            Assert.Equal(ImportStatus.SUCCESS.ToString(), replaceConfirm.ImportBatch!.Status);
            Assert.Equal(2, await db.SalesLines.CountAsync());

            // REPLACE รอบสองด้วยไฟล์ 1 แถว (Inv ใหม่) — preview ต้องชี้ว่าจะลบ 2 แถวเดิม
            var singleFile = BuildWorkbook(CleanRow("INV-T-9"));
            var replaceDryRun2 = await service.ImportSalesFileAsync(
                singleFile, "replace2.xlsx", singleFile.Length, 1, ImportMode.REPLACE_PERIOD, periods, confirm: false);
            db.ChangeTracker.Clear();
            Assert.True(replaceDryRun2.DryRun);
            Assert.Equal(2, replaceDryRun2.Preview!.RemovedRows);

            var replaceConfirm2 = await service.ImportSalesFileAsync(
                singleFile, "replace2.xlsx", singleFile.Length, 1, ImportMode.REPLACE_PERIOD, periods, confirm: true);
            db.ChangeTracker.Clear();
            Assert.Equal(1, await db.SalesLines.CountAsync());
            Assert.Equal(2, await db.SalesLineArchives.CountAsync());

            // PERIOD_DELETE — dry-run แล้ว confirm
            var deleteDryRun = await service.DeleteSalesPeriodsAsync(1, periods, confirm: false);
            db.ChangeTracker.Clear();
            Assert.True(deleteDryRun.DryRun);
            Assert.NotNull(deleteDryRun.Preview);
            Assert.Equal(1, await db.SalesLines.CountAsync());

            var deleteConfirm = await service.DeleteSalesPeriodsAsync(1, periods, confirm: true);
            db.ChangeTracker.Clear();
            Assert.False(deleteConfirm.DryRun);
            Assert.Equal(0, await db.SalesLines.CountAsync());
            Assert.Equal(3, await db.SalesLineArchives.CountAsync());
        }
    }
}
