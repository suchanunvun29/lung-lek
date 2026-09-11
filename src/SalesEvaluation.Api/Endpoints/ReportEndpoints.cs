namespace SalesEvaluation.Api.Endpoints;

using System.Globalization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Application.Common;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Domain.Enums;

public static class ReportEndpoints
{
    private const string ExcelMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder app)
    {
        // GET /reports/individual/{salespersonId} — JSON report data (WACC-P0-001)
        app.MapGet("/reports/individual/{salespersonId}", HandleGetIndividualReport);

        // GET /reports/individual/:salespersonId/export — Excel download
        app.MapGet("/reports/individual/{salespersonId}/export", HandleExportIndividualReport);

        // GET /reports/individual/export-all — Multi-sheet Excel download (BE-106 / DES-033)
        app.MapGet("/reports/individual/export-all", HandleExportAllIndividualReports);

        // GET /reports/team-overview — JSON team overview (WACC-P0-002)
        app.MapGet("/reports/team-overview", HandleGetTeamOverviewReport);

        // GET /reports/team-overview/export — Excel download
        app.MapGet("/reports/team-overview/export", HandleExportTeamOverviewReport);

        // GET /reports/territory-overview/export — Excel download (WACC-P0-004)
        app.MapGet("/reports/territory-overview/export", HandleExportTerritoryOverviewReport);

        return app;
    }

    private static async Task<IResult> HandleGetIndividualReport(
        int salespersonId,
        string? periodType,
        string? year,
        string? periodNumber,
        IExcelReportService reportService,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var periodResult = ParsePeriod(periodType, year, periodNumber);
        if (periodResult.Error != null) return periodResult.Error;

        var user = new CurrentUserRef { Id = currentUserService.User!.Id, Role = currentUserService.User.Role };
        var canView = await scopeResolver.CanViewSalespersonAsync(user, salespersonId, ct);
        if (!canView)
            return Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden);

        try
        {
            var data = await reportService.AssembleIndividualReportAsync(salespersonId, periodResult.Period, ct);
            return Results.Ok(data);
        }
        catch (KeyNotFoundException)
        {
            return Results.Json(new { error = "Salesperson not found" }, statusCode: StatusCodes.Status404NotFound);
        }
    }

    private static async Task<IResult> HandleExportIndividualReport(
        int salespersonId,
        string? periodType,
        string? year,
        string? periodNumber,
        IExcelReportService reportService,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var periodResult = ParsePeriod(periodType, year, periodNumber);
        if (periodResult.Error != null) return periodResult.Error;

        var user = new CurrentUserRef { Id = currentUserService.User!.Id, Role = currentUserService.User.Role };
        var canView = await scopeResolver.CanViewSalespersonAsync(user, salespersonId, ct);
        if (!canView)
            return Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden);

        try
        {
            var workbookBytes = await reportService.BuildIndividualReportAsync(salespersonId, periodResult.Period, ct);
            var period = periodResult.Period;
            var fileName = Uri.EscapeDataString(
                $"coaching-report-{salespersonId}-{period.PeriodType}-{period.Year}-{period.PeriodNumber}.xlsx");
            return Results.File(workbookBytes, ExcelMimeType, fileName);
        }
        catch (KeyNotFoundException)
        {
            return Results.Json(new { error = "Salesperson not found" }, statusCode: StatusCodes.Status404NotFound);
        }
    }

    private static async Task<IResult> HandleGetTeamOverviewReport(
        string? periodType,
        string? year,
        string? periodNumber,
        IExcelReportService reportService,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var periodResult = ParsePeriod(periodType, year, periodNumber);
        if (periodResult.Error != null) return periodResult.Error;

        var user = new CurrentUserRef { Id = currentUserService.User!.Id, Role = currentUserService.User.Role };
        var scope = await scopeResolver.ResolveViewerTerritoryScopeAsync(user, ct);
        var visibleIds = await scopeResolver.VisibleSalespersonIdsAsync(scope, ct);

        var data = await reportService.AssembleTeamOverviewReportAsync(periodResult.Period, visibleIds, ct);
        return Results.Ok(data);
    }

    private static async Task<IResult> HandleExportTeamOverviewReport(
        string? periodType,
        string? year,
        string? periodNumber,
        IExcelReportService reportService,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var periodResult = ParsePeriod(periodType, year, periodNumber);
        if (periodResult.Error != null) return periodResult.Error;

        var user = new CurrentUserRef { Id = currentUserService.User!.Id, Role = currentUserService.User.Role };
        var scope = await scopeResolver.ResolveViewerTerritoryScopeAsync(user, ct);
        var visibleIds = await scopeResolver.VisibleSalespersonIdsAsync(scope, ct);

        var workbookBytes = await reportService.BuildTeamOverviewReportAsync(periodResult.Period, visibleIds, ct);
        var period = periodResult.Period;
        var fileName = Uri.EscapeDataString(
            $"team-overview-{period.PeriodType}-{period.Year}-{period.PeriodNumber}.xlsx");
        return Results.File(workbookBytes, ExcelMimeType, fileName);
    }

    private static async Task<IResult> HandleExportAllIndividualReports(
        string? periodType,
        string? year,
        string? periodNumber,
        IExcelReportService reportService,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var periodResult = ParsePeriod(periodType, year, periodNumber);
        if (periodResult.Error != null) return periodResult.Error;

        var user = new CurrentUserRef { Id = currentUserService.User!.Id, Role = currentUserService.User.Role };
        var scope = await scopeResolver.ResolveViewerTerritoryScopeAsync(user, ct);
        var visibleIds = await scopeResolver.VisibleSalespersonIdsAsync(scope, ct);

        var workbookBytes = await reportService.BuildAllIndividualReportsAsync(periodResult.Period, visibleIds, ct);
        var period = periodResult.Period;
        var fileName = Uri.EscapeDataString(
            $"all-individual-reports-{period.PeriodType}-{period.Year}-{period.PeriodNumber}.xlsx");
        return Results.File(workbookBytes, ExcelMimeType, fileName);
    }

    private static async Task<IResult> HandleExportTerritoryOverviewReport(
        string? periodType,
        string? year,
        string? periodNumber,
        IExcelReportService reportService,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var periodResult = ParsePeriod(periodType, year, periodNumber);
        if (periodResult.Error != null) return periodResult.Error;

        var user = new CurrentUserRef { Id = currentUserService.User!.Id, Role = currentUserService.User.Role };
        var visibleTerritoryIds = await scopeResolver.ResolveViewerTerritoryIdsAsync(user, ct);

        var workbookBytes = await reportService.BuildTerritoryOverviewReportAsync(periodResult.Period, visibleTerritoryIds, ct);
        var period = periodResult.Period;
        var fileName = Uri.EscapeDataString(
            $"territory-overview-{period.PeriodType}-{period.Year}-{period.PeriodNumber}.xlsx");
        return Results.File(workbookBytes, ExcelMimeType, fileName);
    }

    // T-UX-029 — single period parser shared across endpoint families (range rules + Thai
    // message identical to KPI/territory-view/coaching).
    private static (AppPeriodKey Period, IResult? Error) ParsePeriod(
        string? periodType, string? year, string? periodNumber)
    {
        return PeriodQueryParser.TryParsePeriod(periodType, year, periodNumber, out var period, out var error)
            ? (period, null)
            : (default, error);
    }
}

