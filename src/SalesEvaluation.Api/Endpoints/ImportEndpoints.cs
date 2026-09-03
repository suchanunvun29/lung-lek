namespace SalesEvaluation.Api.Endpoints;

using System.Globalization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Domain.Enums;
using SalesEvaluation.Infrastructure.Excel;

public static class ImportEndpoints
{
    public static IEndpointRouteBuilder MapImportEndpoints(this IEndpointRouteBuilder app)
    {
        // POST /import — MANAGER only, multipart form (field: file)
        app.MapPost("/import", HandleUploadImport);

        // POST /import/period-delete — MANAGER only
        app.MapPost("/import/period-delete", HandlePeriodDelete);

        // GET /import-batches
        app.MapGet("/import-batches", async (IImportService importService, CancellationToken ct) =>
            Results.Ok(new { importBatches = await importService.ListImportBatchesAsync(ct) }));

        // GET /import-batches/{id}
        app.MapGet("/import-batches/{id}", async (string id, IImportService importService, CancellationToken ct) =>
        {
            var batch = await importService.GetImportBatchAsync(id, ct);
            return batch == null
                ? Results.Json(new { error = "Import batch not found" }, statusCode: StatusCodes.Status404NotFound)
                : Results.Ok(new { importBatch = batch });
        });

        // GET /sales-lines
        app.MapGet("/sales-lines", HandleListSalesLines);

        return app;
    }

    private static async Task<IResult> HandleUploadImport(
        HttpContext httpContext,
        IImportService importService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (currentUserService.User?.Role != UserRole.MANAGER)
            return Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden);

        var form = await httpContext.Request.ReadFormAsync(ct);
        var file = form.Files.GetFile("file");
        if (file == null)
            return Results.Json(new { error = "File is required (field name: file)" }, statusCode: StatusCodes.Status400BadRequest);

        if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            return Results.Json(new { error = "Only .xlsx files are supported" }, statusCode: StatusCodes.Status400BadRequest);

        const long maxUploadSizeBytes = 20 * 1024 * 1024;
        if (file.Length > maxUploadSizeBytes)
            return Results.Json(new { error = "Upload error: File too large" }, statusCode: StatusCodes.Status400BadRequest);

        // Read mode from body fields
        var modeStr = form["mode"].FirstOrDefault() ?? "APPEND";
        if (!Enum.TryParse<ImportMode>(modeStr, out var mode))
            return TerritoryEndpoints.Invalid($"mode must be one of {string.Join(", ", Enum.GetNames<ImportMode>())}");

        var confirmStr = httpContext.Request.Query["confirm"].FirstOrDefault();
        var confirm = string.Equals(confirmStr, "true", StringComparison.OrdinalIgnoreCase);

        // Parse targetPeriods from body
        List<Period>? targetPeriods = null;
        var targetPeriodsJson = form["targetPeriods"].FirstOrDefault();
        if (!string.IsNullOrEmpty(targetPeriodsJson))
        {
            try
            {
                targetPeriods = System.Text.Json.JsonSerializer.Deserialize<List<PeriodDto>>(targetPeriodsJson)
                    ?.Select(p => new Period(p.Year, p.Month)).ToList();
            }
            catch
            {
                return TerritoryEndpoints.Invalid("targetPeriods must be a valid JSON array of {year, month} objects");
            }
        }

        byte[] fileBuffer;
        using (var ms = new MemoryStream())
        {
            await file.CopyToAsync(ms, ct);
            fileBuffer = ms.ToArray();
        }

        try
        {
            var result = await importService.ImportSalesFileAsync(
                fileBuffer, file.FileName, (int)file.Length,
                currentUserService.User!.Id, mode, targetPeriods, confirm, ct);

            return Results.Json(result, statusCode: result.DryRun ? StatusCodes.Status200OK : StatusCodes.Status201Created);
        }
        catch (ImportInProgressException)
        {
            return Results.Json(new { error = "Import already in progress", code = "IMPORT_IN_PROGRESS" },
                statusCode: StatusCodes.Status409Conflict);
        }
        catch (PeriodOutOfScopeException)
        {
            return Results.Json(new
            {
                error = "ไฟล์มีแถวของงวดอื่นนอกเหนือจากงวดที่เลือก — ยกเลิกทั้งไฟล์",
                code = "PERIOD_OUT_OF_SCOPE"
            }, statusCode: StatusCodes.Status400BadRequest);
        }
    }

    private static async Task<IResult> HandlePeriodDelete(
        HttpContext httpContext,
        IImportService importService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (currentUserService.User?.Role != UserRole.MANAGER)
            return Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden);

        var confirmStr = httpContext.Request.Query["confirm"].FirstOrDefault();
        var confirm = string.Equals(confirmStr, "true", StringComparison.OrdinalIgnoreCase);

        var parsedBody = await TerritoryEndpoints.ParseBodyAsync(httpContext);
        if (!parsedBody.Ok)
            return parsedBody.Error!;

        using (parsedBody.Doc)
        {
            var root = parsedBody.Doc!.RootElement;
            if (root.ValueKind != System.Text.Json.JsonValueKind.Object)
                return TerritoryEndpoints.Invalid("Payload must be a JSON object");

            if (!root.TryGetProperty("targetPeriods", out var periodsProp) ||
                periodsProp.ValueKind != System.Text.Json.JsonValueKind.Array)
            {
                return TerritoryEndpoints.Invalid("targetPeriods is required and must be an array");
            }

            var targetPeriods = new List<Period>();
            foreach (var item in periodsProp.EnumerateArray())
            {
                if (!item.TryGetProperty("year", out var yearProp) || yearProp.ValueKind != System.Text.Json.JsonValueKind.Number ||
                    !item.TryGetProperty("month", out var monthProp) || monthProp.ValueKind != System.Text.Json.JsonValueKind.Number)
                    return TerritoryEndpoints.Invalid("Each targetPeriods item must have year and month as integers");
                targetPeriods.Add(new Period(yearProp.GetInt32(), monthProp.GetInt32()));
            }

            if (targetPeriods.Count == 0)
                return TerritoryEndpoints.Invalid("targetPeriods must not be empty");

            try
            {
                var result = await importService.DeleteSalesPeriodsAsync(
                    currentUserService.User!.Id, targetPeriods, confirm, ct);
                return Results.Json(result, statusCode: result.DryRun ? StatusCodes.Status200OK : StatusCodes.Status201Created);
            }
            catch (ImportInProgressException)
            {
                return Results.Json(new { error = "Import already in progress", code = "IMPORT_IN_PROGRESS" },
                    statusCode: StatusCodes.Status409Conflict);
            }
        }
    }

    private static async Task<IResult> HandleListSalesLines(
        string? salespersonId,
        string? hospitalId,
        string? productTypeId,
        string? year,
        string? month,
        string? page,
        string? pageSize,
        IImportService importService,
        CancellationToken ct)
    {
        int pageVal = 1, pageSizeVal = 50;
        if (!string.IsNullOrEmpty(page))
        {
            if (!int.TryParse(page, NumberStyles.Integer, CultureInfo.InvariantCulture, out pageVal) || pageVal < 1)
                return TerritoryEndpoints.Invalid("page must be an integer >= 1");
        }
        if (!string.IsNullOrEmpty(pageSize))
        {
            if (!int.TryParse(pageSize, NumberStyles.Integer, CultureInfo.InvariantCulture, out pageSizeVal) || pageSizeVal < 1 || pageSizeVal > 200)
                return TerritoryEndpoints.Invalid("pageSize must be between 1 and 200");
        }

        int? yearVal = null, monthVal = null;
        if (!string.IsNullOrEmpty(year))
        {
            if (!int.TryParse(year, NumberStyles.Integer, CultureInfo.InvariantCulture, out var y))
                return TerritoryEndpoints.Invalid("year must be an integer");
            yearVal = y;
        }
        if (!string.IsNullOrEmpty(month))
        {
            if (!int.TryParse(month, NumberStyles.Integer, CultureInfo.InvariantCulture, out var m))
                return TerritoryEndpoints.Invalid("month must be an integer");
            monthVal = m;
        }

        var result = await importService.ListSalesLinesAsync(
            salespersonId, hospitalId, productTypeId, yearVal, monthVal, pageVal, pageSizeVal, ct);
        return Results.Ok(result);
    }

    private record PeriodDto(int Year, int Month);
}
