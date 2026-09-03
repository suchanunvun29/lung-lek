namespace SalesEvaluation.Api.Endpoints;

using System.Globalization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Application.Kpi;

public static class KpiEndpoints
{
    public static IEndpointRouteBuilder MapKpiEndpoints(this IEndpointRouteBuilder app)
    {
        // Route order matters: /team and /{salespersonId}/drill-down/{metric} before /{salespersonId}.
        app.MapGet("/kpi/team", HandleGetTeamKpi);
        app.MapGet("/kpi", HandleGetTeamKpi);
        app.MapGet("/kpi/{salespersonId}/drill-down/{metric}", HandleGetDrillDown);
        app.MapGet("/kpi/{salespersonId}", HandleGetSalespersonKpi);

        return app;
    }

    private static IResult Forbidden() =>
        Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden);

    // Everyone who is authenticated sees the same business data — auth only gates who can write
    // (same "auth gates actions, not visibility" rule as /targets, /sales-lines, /hospitals).
    private static async Task<IResult> HandleGetTeamKpi(
        HttpContext httpContext,
        IKpiScoringService kpiScoringService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (!PeriodQueryParser.TryParsePeriod(httpContext.Request.Query, out var period, out var error))
        {
            return error!;
        }

        var user = currentUserService.User!;
        return Results.Ok(await kpiScoringService.GetTeamKpiAsync(new CurrentUserRef { Id = user.Id, Role = user.Role }, period, ct));
    }

    private static async Task<IResult> HandleGetSalespersonKpi(
        string salespersonId,
        HttpContext httpContext,
        IKpiScoringService kpiScoringService,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (!PeriodQueryParser.TryParsePeriod(httpContext.Request.Query, out var period, out var error))
        {
            return error!;
        }

        var user = currentUserService.User!;
        if (!await scopeResolver.CanViewSalespersonAsync(new CurrentUserRef { Id = user.Id, Role = user.Role }, salespersonId, ct))
        {
            return Forbidden();
        }

        var result = await kpiScoringService.GetSalespersonKpiAsync(salespersonId, period, ct);
        if (result == null)
        {
            return Results.Json(new { error = "Salesperson not found" }, statusCode: StatusCodes.Status404NotFound);
        }

        return Results.Ok(result);
    }

    private static async Task<IResult> HandleGetDrillDown(
        string salespersonId,
        string metric,
        HttpContext httpContext,
        IKpiScoringService kpiScoringService,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (!PeriodQueryParser.TryParsePeriod(httpContext.Request.Query, out var period, out var error))
        {
            return error!;
        }

        if (!KpiScoringService.IsValidDrillDownMetric(metric))
        {
            return TerritoryEndpoints.Invalid(
                "metric must be one of REVENUE_VS_TARGET, NEW_CUSTOMERS, PRODUCT_GROUP, RETENTION, CONSISTENCY, ACTIVE_CUSTOMERS, CHURNED_CUSTOMERS, PRODUCT_PENETRATION, REVENUE_BY_HOSPITAL, MONTHLY_TREND");
        }

        string? hospitalId = null;
        if (httpContext.Request.Query.TryGetValue("hospitalId", out var hospitalValue) && !string.IsNullOrEmpty(hospitalValue))
        {
            hospitalId = hospitalValue.ToString();
        }

        var user = currentUserService.User!;
        if (!await scopeResolver.CanViewSalespersonAsync(new CurrentUserRef { Id = user.Id, Role = user.Role }, salespersonId, ct))
        {
            return Forbidden();
        }

        var result = await kpiScoringService.GetDrillDownAsync(salespersonId, metric, period, hospitalId, ct);
        if (result == null)
        {
            return Results.Json(new { error = "Salesperson not found" }, statusCode: StatusCodes.Status404NotFound);
        }

        return Results.Ok(result);
    }
}
