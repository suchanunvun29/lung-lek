namespace SalesEvaluation.Api.Endpoints;

using System.Globalization;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.TerritoryViews;
using SalesEvaluation.Domain.Enums;

public static class TerritoryViewEndpoints
{
    private const string SpreadsheetContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private static readonly string[] ValidPeriodTypes = { "MONTH", "QUARTER", "YEAR" };
    private static readonly string[] ValidPotentialMetrics = { "BEDS", "CMI", "SUM_ADJ_RW", "OCCUPANCY_RATE", "PATIENTS", "VISITS" };

    public static IEndpointRouteBuilder MapTerritoryViewEndpoints(this IEndpointRouteBuilder app)
    {
        // Route order matters: the specific paths must be matched before /{salespersonId}.
        app.MapGet("/my-territory-view/{salespersonId}/export", HandleExportMyTerritoryView);
        app.MapGet("/my-territory-view/{salespersonId}/never-sold/export", HandleExportNeverSoldHospitals);
        app.MapGet("/my-territory-view/{salespersonId}/never-sold", HandleGetNeverSoldHospitals);
        app.MapGet("/my-territory-view/{salespersonId}", HandleGetMyTerritoryView);

        return app;
    }

    private static async Task<IResult> HandleGetMyTerritoryView(
        int salespersonId,
        HttpContext httpContext,
        ITerritoryViewService viewService,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (!TryParseTerritoryViewQuery(httpContext, out var query, out var error))
        {
            return error!;
        }

        var forbidden = await ForbidIfCannotViewAsync(salespersonId, scopeResolver, currentUserService, ct);
        if (forbidden != null)
        {
            return forbidden;
        }

        var result = await viewService.GetTerritoryViewAsync(salespersonId, query, ct);
        if (result == null)
        {
            return Results.Json(new { error = "Salesperson not found" }, statusCode: StatusCodes.Status404NotFound);
        }

        result.Period = EchoQuery(httpContext);
        return Results.Ok(result);
    }

    private static async Task<IResult> HandleGetNeverSoldHospitals(
        int salespersonId,
        HttpContext httpContext,
        ITerritoryViewService viewService,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (!TryParseNeverSoldQuery(httpContext, out var query, out var error))
        {
            return error!;
        }

        var forbidden = await ForbidIfCannotViewAsync(salespersonId, scopeResolver, currentUserService, ct);
        if (forbidden != null)
        {
            return forbidden;
        }

        var result = await viewService.GetNeverSoldHospitalsAsync(salespersonId, query, ct);
        if (result == null)
        {
            return Results.Json(new { error = "Salesperson not found" }, statusCode: StatusCodes.Status404NotFound);
        }

        result.Period = EchoQuery(httpContext);
        return Results.Ok(result);
    }

    private static async Task<IResult> HandleExportMyTerritoryView(
        int salespersonId,
        HttpContext httpContext,
        ITerritoryViewService viewService,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (!TryParseTerritoryViewQuery(httpContext, out var query, out var error))
        {
            return error!;
        }

        var forbidden = await ForbidIfCannotViewAsync(salespersonId, scopeResolver, currentUserService, ct);
        if (forbidden != null)
        {
            return forbidden;
        }

        var result = await viewService.GetTerritoryViewAsync(salespersonId, query, ct);
        if (result == null)
        {
            return Results.Json(new { error = "Salesperson not found" }, statusCode: StatusCodes.Status404NotFound);
        }

        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("Territory view");
        sheet.Column(1).Width = 28;
        sheet.Column(2).Width = 40;
        sheet.Column(3).Width = 18;
        sheet.Cell(1, 1).Value = "รายการ";
        sheet.Cell(1, 2).Value = "โรงพยาบาล";
        sheet.Cell(1, 3).Value = "ยอดขาย";

        var row = 2;
        foreach (var entry in result.SoldHospitals)
        {
            sheet.Cell(row, 1).Value = "ขายได้แล้ว";
            sheet.Cell(row, 2).Value = entry.Hospital.DisplayName;
            sheet.Cell(row, 3).Value = entry.Revenue;
            row++;
        }

        foreach (var entry in result.SoldBeforeButNotInPeriod)
        {
            sheet.Cell(row, 1).Value = "เคยขายได้ แต่ไม่มีในงวดนี้";
            sheet.Cell(row, 2).Value = entry.Hospital.DisplayName;
            row++;
        }

        return await WriteWorkbookAsync(workbook, "my-territory-view.xlsx");
    }

    private static async Task<IResult> HandleExportNeverSoldHospitals(
        int salespersonId,
        HttpContext httpContext,
        ITerritoryViewService viewService,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (!TryParseNeverSoldQuery(httpContext, out var query, out var error))
        {
            return error!;
        }

        var forbidden = await ForbidIfCannotViewAsync(salespersonId, scopeResolver, currentUserService, ct);
        if (forbidden != null)
        {
            return forbidden;
        }

        var result = await viewService.GetNeverSoldHospitalsAsync(salespersonId, query, ct);
        if (result == null)
        {
            return Results.Json(new { error = "Salesperson not found" }, statusCode: StatusCodes.Status404NotFound);
        }

        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("Never-sold hospitals");
        sheet.Column(1).Width = 8;
        sheet.Column(2).Width = 40;
        sheet.Column(3).Width = 20;
        sheet.Column(4).Width = 14;
        sheet.Column(5).Width = 20;
        sheet.Column(6).Width = 20;
        sheet.Cell(1, 1).Value = "อันดับ";
        sheet.Cell(1, 2).Value = "โรงพยาบาล";
        sheet.Cell(1, 3).Value = "จังหวัด";
        sheet.Cell(1, 4).Value = "ระดับ (Tier)";
        sheet.Cell(1, 5).Value = $"ศักยภาพ ({result.PotentialMetric})";
        sheet.Cell(1, 6).Value = "เขต";

        var row = 2;
        foreach (var entry in result.NeverSoldHospitals)
        {
            sheet.Cell(row, 1).Value = row - 1;
            sheet.Cell(row, 2).Value = entry.DisplayName;
            sheet.Cell(row, 3).Value = entry.Province;
            sheet.Cell(row, 4).Value = entry.Tier ?? "—";
            sheet.Cell(row, 5).Value = entry.MetricValue;
            sheet.Cell(row, 6).Value = entry.Territory?.DisplayName ?? "—";
            row++;
        }

        return await WriteWorkbookAsync(workbook, "never-sold-hospitals.xlsx");
    }

    private static async Task<IResult> WriteWorkbookAsync(XLWorkbook workbook, string fileName)
    {
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return Results.File(stream.ToArray(), SpreadsheetContentType, fileDownloadName: fileName);
    }

    private static async Task<IResult?> ForbidIfCannotViewAsync(
        int salespersonId,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var user = currentUserService.User;
        if (user == null)
        {
            return Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden);
        }

        var canView = await scopeResolver.CanViewSalespersonAsync(
            new Application.Common.Interfaces.CurrentUserRef { Id = user.Id, Role = user.Role },
            salespersonId,
            ct);

        return canView
            ? null
            : Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden);
    }

    private static Dictionary<string, string> EchoQuery(HttpContext httpContext)
    {
        var echo = new Dictionary<string, string>();
        foreach (var pair in httpContext.Request.Query)
        {
            echo[pair.Key] = pair.Value.ToString();
        }
        return echo;
    }

    // ---- Query validation (mirrors territoryView.validators.ts) ----

    private static bool TryParseTerritoryViewQuery(HttpContext httpContext, out TerritoryViewQuery query, out IResult? error)
    {
        query = new TerritoryViewQuery();
        error = null;

        var q = httpContext.Request.Query;

        if (!TryParsePeriod(q, out var period, out error))
        {
            return false;
        }

        int? productTypeId = null;
        if (q.TryGetValue("productTypeId", out var ptValue) && !string.IsNullOrEmpty(ptValue))
        {
            if (int.TryParse(ptValue.ToString(), out var ptId))
            {
                productTypeId = ptId;
            }
        }

        var creditOnly = q.TryGetValue("creditOnly", out var coValue) && coValue == "true";

        query = new TerritoryViewQuery
        {
            Period = period,
            ProductTypeId = productTypeId,
            CreditOnly = creditOnly
        };
        return true;
    }

    private static bool TryParseNeverSoldQuery(HttpContext httpContext, out NeverSoldQuery query, out IResult? error)
    {
        query = new NeverSoldQuery();
        error = null;

        var q = httpContext.Request.Query;

        if (!TryParsePeriod(q, out var period, out error))
        {
            return false;
        }

        var topN = 20;
        if (q.TryGetValue("topN", out var topNValue) && !string.IsNullOrEmpty(topNValue))
        {
            if (!int.TryParse(topNValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out topN) || topN <= 0)
            {
                error = TerritoryEndpoints.Invalid("topN must be a positive integer");
                return false;
            }
        }

        int? provinceMappingId = null;
        if (q.TryGetValue("provinceMappingId", out var pmValue) && !string.IsNullOrEmpty(pmValue))
        {
            if (int.TryParse(pmValue.ToString(), out var pmId))
            {
                provinceMappingId = pmId;
            }
        }

        var potentialMetric = PotentialMetricKey.BEDS;
        if (q.TryGetValue("potentialMetric", out var metricValue) && !string.IsNullOrEmpty(metricValue))
        {
            var raw = metricValue.ToString();
            if (!ValidPotentialMetrics.Contains(raw) || !Enum.TryParse<PotentialMetricKey>(raw, ignoreCase: false, out potentialMetric))
            {
                error = TerritoryEndpoints.Invalid($"potentialMetric must be one of {string.Join(", ", ValidPotentialMetrics)}");
                return false;
            }
        }

        int? productTypeId = null;
        if (q.TryGetValue("productTypeId", out var ptValue) && !string.IsNullOrEmpty(ptValue))
        {
            if (int.TryParse(ptValue.ToString(), out var ptId))
            {
                productTypeId = ptId;
            }
        }

        query = new NeverSoldQuery
        {
            Period = period,
            TopN = topN,
            ProvinceMappingId = provinceMappingId,
            PotentialMetric = potentialMetric,
            ProductTypeId = productTypeId
        };
        return true;
    }

    private static bool TryParsePeriod(IQueryCollection q, out TerritoryViewPeriod period, out IResult? error)
    {
        period = new TerritoryViewPeriod();
        error = null;

        if (!q.TryGetValue("periodType", out var periodTypeValue) || !ValidPeriodTypes.Contains(periodTypeValue.ToString()))
        {
            error = TerritoryEndpoints.Invalid("periodType must be one of MONTH, QUARTER, YEAR");
            return false;
        }

        var periodType = Enum.Parse<PeriodType>(periodTypeValue.ToString(), ignoreCase: false);

        if (!q.TryGetValue("year", out var yearValue) ||
            !int.TryParse(yearValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out var year))
        {
            error = TerritoryEndpoints.Invalid("year must be an integer");
            return false;
        }

        var periodNumber = 0;
        var hasPeriodNumber = q.TryGetValue("periodNumber", out var pnValue) && !string.IsNullOrEmpty(pnValue);
        if (hasPeriodNumber && !int.TryParse(pnValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out periodNumber))
        {
            error = TerritoryEndpoints.Invalid("periodNumber must be an integer");
            return false;
        }

        // periodNumber ไม่ถูกต้อง — MONTH requires 1-12, QUARTER requires 1-4.
        if (periodType == PeriodType.MONTH && (!hasPeriodNumber || periodNumber < 1 || periodNumber > 12))
        {
            error = TerritoryEndpoints.Invalid("periodNumber ไม่ถูกต้อง");
            return false;
        }

        if (periodType == PeriodType.QUARTER && (!hasPeriodNumber || periodNumber < 1 || periodNumber > 4))
        {
            error = TerritoryEndpoints.Invalid("periodNumber ไม่ถูกต้อง");
            return false;
        }

        // normalizePeriodNumber: YEAR periods carry periodNumber 0.
        if (periodType == PeriodType.YEAR)
        {
            periodNumber = 0;
        }

        period = new TerritoryViewPeriod
        {
            PeriodType = periodType,
            Year = year,
            PeriodNumber = periodNumber
        };
        return true;
    }
}
