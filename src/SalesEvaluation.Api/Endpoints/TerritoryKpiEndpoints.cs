namespace SalesEvaluation.Api.Endpoints;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Application.Kpi;
using SalesEvaluation.Domain.Enums;

public static class TerritoryKpiEndpoints
{
    public static IEndpointRouteBuilder MapTerritoryKpiEndpoints(this IEndpointRouteBuilder app)
    {
        // Route order matters: /team and /{territoryId}/drill-down/{metric} before /{territoryId}.
        app.MapGet("/territory-kpi/team", HandleGetTeamTerritoryKpi);
        app.MapGet("/territory-kpi/{territoryId}/drill-down/{metric}", HandleTerritoryDrillDown);
        app.MapGet("/territory-kpi/{territoryId}", HandleGetTerritoryKpi);

        return app;
    }

    private static async Task<(CurrentUserRef?, IResult?)> ResolveUserAsync(ICurrentUserService currentUserService)
    {
        var user = currentUserService.User;
        return user == null
            ? (null, Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden))
            : (new CurrentUserRef { Id = user.Id, Role = user.Role }, null);
    }

    private static async Task<IResult> HandleGetTeamTerritoryKpi(
        HttpContext httpContext,
        ITerritoryKpiService territoryKpiService,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (!PeriodQueryParser.TryParsePeriod(httpContext.Request.Query, out var period, out var error))
        {
            return error!;
        }

        var (user, userError) = await ResolveUserAsync(currentUserService);
        if (userError != null)
        {
            return userError;
        }

        var visible = await scopeResolver.ResolveViewerTerritoryIdsAsync(user!, ct);
        var fullRows = await territoryKpiService.BuildFullTerritoryRowsAsync(period, ct);
        var territories = fullRows.Select(row => territoryKpiService.SerializeRow(row, visible)).ToList();

        var response = new Contracts.Kpi.TerritoryKpiTeamResponse { Period = KpiScoringService.ToPeriodDto(period), Territories = territories };
        if (currentUserService.User!.Role == UserRole.MANAGER)
        {
            response.Buckets = await territoryKpiService.GetBucketsAsync(period, ct);
        }

        return Results.Ok(response);
    }

    private static async Task<IResult> HandleGetTerritoryKpi(
        string territoryId,
        HttpContext httpContext,
        ITerritoryKpiService territoryKpiService,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (!PeriodQueryParser.TryParsePeriod(httpContext.Request.Query, out var period, out var error))
        {
            return error!;
        }

        var (user, userError) = await ResolveUserAsync(currentUserService);
        if (userError != null)
        {
            return userError;
        }

        var visible = await scopeResolver.ResolveViewerTerritoryIdsAsync(user!, ct);
        var result = await territoryKpiService.GetTerritoryKpiAsync(territoryId, period, visible, ct);
        if (result == null)
        {
            return Results.Json(new { error = "Territory not found" }, statusCode: StatusCodes.Status404NotFound);
        }

        return Results.Ok(result);
    }

    // Territory KPI Rules ข้อ 7 drill-down — product types sold and hospitals sold to with
    // amounts, through SalesLineCredit only. TERRITORY_FULL viewers only (Data Visibility Rules ข้อ 6).
    private static async Task<IResult> HandleTerritoryDrillDown(
        string territoryId,
        string metric,
        HttpContext httpContext,
        ITerritoryKpiService territoryKpiService,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        IAppDbContext dbContext,
        CancellationToken ct)
    {
        if (!PeriodQueryParser.TryParsePeriod(httpContext.Request.Query, out var period, out var error))
        {
            return error!;
        }

        // TS checks territory existence (404) before the viewer's permission (403).
        var territoryExists = await dbContext.Territories
            .AsNoTracking()
            .AnyAsync(t => t.Id == territoryId, ct);
        if (!territoryExists)
        {
            return Results.Json(new { error = "Territory not found" }, statusCode: StatusCodes.Status404NotFound);
        }

        var (user, userError) = await ResolveUserAsync(currentUserService);
        if (userError != null)
        {
            return userError;
        }

        var permitted = await scopeResolver.ResolveViewerTerritoryIdsAsync(user!, ct);
        if (permitted != null && !permitted.Contains(territoryId))
        {
            return Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden);
        }

        var result = await territoryKpiService.GetTerritoryDrillDownAsync(territoryId, metric, period, ct);
        return Results.Ok(result);
    }
}
