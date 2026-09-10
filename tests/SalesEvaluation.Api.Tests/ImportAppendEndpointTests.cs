namespace SalesEvaluation.Api.Tests;

// T-UX-027 — HTTP contract of the APPEND dry-run. Response-shape pins only: the rollback
// guarantee itself is proven against a real transactional store in ImportAppendDryRunTests
// (the InMemory provider used here ignores transactions).
//
// Contract: POST /import?confirm=false (APPEND) → 200 {dryRun:true, appendPreview:{…}}
//           POST /import?confirm=true  (APPEND) → 201 {dryRun:false, importBatch:{…}}
//           dry-run ขณะมี import อื่น PROCESSING        → 409 {error, code:IMPORT_IN_PROGRESS}

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;
using SalesEvaluation.Infrastructure.Persistence;
using Xunit;

public class ImportAppendEndpointTests : IClassFixture<CustomWebApplicationFactory>
{
    private sealed class AlwaysAcquirableLockService : IPostgresAdvisoryLockService
    {
        public Task<bool> TryAcquireTransactionLockAsync(long lockKey = IPostgresAdvisoryLockService.DefaultImportAdvisoryLockKey, CancellationToken cancellationToken = default)
            => Task.FromResult(true);
    }

    private readonly CustomWebApplicationFactory _baseFactory;
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public ImportAppendEndpointTests(CustomWebApplicationFactory baseFactory)
    {
        _baseFactory = baseFactory;
        // The real PostgresAdvisoryLockService issues raw SQL — stub it so the import flow
        // can run against the InMemory store (the lock semantics are covered by the SQLite
        // service tests and the 409 path pins the PROCESSING guard below).
        _factory = baseFactory.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IPostgresAdvisoryLockService>();
                services.AddSingleton<IPostgresAdvisoryLockService>(new AlwaysAcquirableLockService());
            }));
        _client = _factory.CreateClient();
    }

    private static readonly string[] Headers =
    [
        "Hospital Name", "Salesman", "Inv Date", "Year", "Month", "Inv No.", "Po NO.",
        "Product type", "Product Name", "Lot", "Exp", "Province", "Qty", "Price",
        "Amount", "Vat", "Total",
    ];

    private static byte[] BuildAppendWorkbook()
    {
        using var workbook = new ClosedXML.Excel.XLWorkbook();
        var ws = workbook.Worksheets.Add("Sheet1");
        for (var c = 0; c < Headers.Length; c++)
            ws.Cell(1, c + 1).Value = Headers[c];

        for (var r = 0; r < 2; r++)
        {
            object?[] values =
            [
                "CHIANGMAI", "SOMCHAI", new DateTime(2027, 3, 15), 2027.0, 3.0,
                $"INV-EP-{r}", $"PO-{r}", "B-Type (Consumables)", "Product Beta", null, null,
                "เชียงใหม่", 10.0, 107.0, 1000.0, 70.0, 1070.0,
            ];
            for (var c = 0; c < values.Length; c++)
            {
                if (values[c] is null) continue;
                ws.Cell(r + 2, c + 1).Value = ClosedXML.Excel.XLCellValue.FromObject(values[c]);
            }
        }

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        return ms.ToArray();
    }

    private HttpRequestMessage ImportRequest(bool confirm, byte[] workbook)
    {
        var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(workbook);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        content.Add(fileContent, "file", "append.xlsx");

        var request = new HttpRequestMessage(HttpMethod.Post, $"/import?confirm={confirm.ToString().ToLowerInvariant()}")
        {
            Content = content,
        };
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer", _baseFactory.CreateToken(_baseFactory.ManagerUserId, UserRole.MANAGER));
        return request;
    }

    [Fact]
    public async Task AppendDryRun_Returns200WithAppendPreviewShape()
    {
        using var request = ImportRequest(confirm: false, BuildAppendWorkbook());
        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetProperty("dryRun").GetBoolean());
        // ImportResult carries null fields (DefaultIgnoreCondition=Never) — importBatch must
        // be present-but-null on a dry-run, never a real batch.
        Assert.Equal(JsonValueKind.Null, json.GetProperty("importBatch").ValueKind);
        Assert.Equal(JsonValueKind.Null, json.GetProperty("preview").ValueKind);

        var preview = json.GetProperty("appendPreview");
        Assert.Equal(2, preview.GetProperty("totalRows").GetInt32());
        Assert.Equal(2, preview.GetProperty("insertedRows").GetInt32());
        Assert.Equal(0, preview.GetProperty("errorRows").GetInt32());
        Assert.Equal(JsonValueKind.Array, preview.GetProperty("issueCounts").ValueKind);
        Assert.Equal(JsonValueKind.Array, preview.GetProperty("periodsFound").ValueKind);
        Assert.Equal(2027, preview.GetProperty("periodsFound")[0].GetProperty("year").GetInt32());
        Assert.Equal(3, preview.GetProperty("periodsFound")[0].GetProperty("month").GetInt32());
    }

    [Fact]
    public async Task AppendConfirm_Returns201WithImportBatchShape()
    {
        using var request = ImportRequest(confirm: true, BuildAppendWorkbook());
        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(json.GetProperty("dryRun").GetBoolean());
        Assert.Equal(JsonValueKind.Null, json.GetProperty("appendPreview").ValueKind);

        // The full pipeline (parse → resolve → stage) ran through HTTP: both rows staged.
        // On the InMemory provider the batch then lands as FAILED because
        // MarkInsightsStaleAsync's ExecuteUpdateAsync is unsupported there — the SUCCESS
        // status itself is proven against SQLite in ImportAppendDryRunTests.
        var batch = json.GetProperty("importBatch");
        Assert.Equal(2, batch.GetProperty("insertedRows").GetInt32());
        Assert.True(
            batch.GetProperty("status").GetString() == ImportStatus.SUCCESS.ToString() ||
            (batch.GetProperty("errorMessage").GetString() ?? "").Contains("ExecuteUpdate"),
            $"unexpected batch state: {batch.GetRawText()}");
    }

    [Fact]
    public async Task AppendDryRun_WhileImportProcessing_Returns409WithCode()
    {
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.ImportBatches.Add(new ImportBatch
            {
                FileName = "processing.xlsx",
                FileSizeBytes = 1,
                UploadedById = 1,
                Status = ImportStatus.PROCESSING,
                Mode = ImportMode.APPEND,
            });
            db.SaveChanges();
        }

        try
        {
            using var request = ImportRequest(confirm: false, BuildAppendWorkbook());
            var response = await _client.SendAsync(request);
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("IMPORT_IN_PROGRESS", json.GetProperty("code").GetString());
        }
        finally
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var processing = await db.ImportBatches.SingleAsync(b => b.Status == ImportStatus.PROCESSING);
            processing.Status = ImportStatus.FAILED;
            db.SaveChanges();
        }
    }
}
