namespace SalesEvaluation.Api.Endpoints;

using ClosedXML.Excel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Application.Common.Interfaces;

// Data Visibility Rules ข้อ 6: this page is all money figures, so only viewers with
// TERRITORY_FULL on the territory get it — MANAGER anywhere, supervisor or member of this one.
public static class TerritoryProductRankingEndpoints
{
    private const string SpreadsheetContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    public static IEndpointRouteBuilder MapTerritoryProductRankingEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/territory-product-ranking/{territoryId}/export", HandleExportRanking);
        app.MapGet("/territory-product-ranking/{territoryId}", HandleGetRanking);

        return app;
    }

    private async static Task<(bool Allowed, IResult? Error)> AllowedAsync(
        string territoryId,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var user = currentUserService.User!;
        var scope = await scopeResolver.ResolveViewerTerritoryScopeAsync(new CurrentUserRef { Id = user.Id, Role = user.Role }, ct);
        var allowed = scope.CanSeeAllTerritories ||
                      scope.MemberTerritoryIds.Contains(territoryId) ||
                      scope.SupervisedTerritoryIds.Contains(territoryId);
        return allowed
            ? (true, null)
            : (false, Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden));
    }

    private static async Task<IResult> HandleGetRanking(
        string territoryId,
        HttpContext httpContext,
        ITerritoryKpiService territoryKpiService,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var (allowed, allowedError) = await AllowedAsync(territoryId, scopeResolver, currentUserService, ct);
        if (!allowed)
        {
            return allowedError!;
        }

        if (!PeriodQueryParser.TryParsePeriod(httpContext.Request.Query, out var period, out var error))
        {
            return error!;
        }

        var result = await territoryKpiService.GetTerritoryProductRankingAsync(territoryId, period, ct);
        if (result == null)
        {
            return Results.Json(new { error = "Territory not found" }, statusCode: StatusCodes.Status404NotFound);
        }

        // personalBucket is MANAGER-only (ข้อ 6) — stripped before sending to anyone else.
        if (currentUserService.User!.Role != Domain.Enums.UserRole.MANAGER)
        {
            result.PersonalBucket = null;
        }

        return Results.Json(result);
    }

    private static async Task<IResult> HandleExportRanking(
        string territoryId,
        HttpContext httpContext,
        ITerritoryKpiService territoryKpiService,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var (allowed, allowedError) = await AllowedAsync(territoryId, scopeResolver, currentUserService, ct);
        if (!allowed)
        {
            return allowedError!;
        }

        if (!PeriodQueryParser.TryParsePeriod(httpContext.Request.Query, out var period, out var error))
        {
            return error!;
        }

        var result = await territoryKpiService.GetTerritoryProductRankingAsync(territoryId, period, ct);
        if (result == null)
        {
            return Results.Json(new { error = "Territory not found" }, statusCode: StatusCodes.Status404NotFound);
        }

        var isManager = currentUserService.User!.Role == Domain.Enums.UserRole.MANAGER;
        var owners = string.Join(", ", result.Territory.OwnerNames);

        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("Product ranking");
        sheet.Cell(1, 1).Value = result.ZeroSaleWarning;

        var headers = new[] { "รหัส", "สินค้า", "กลุ่ม", "เขต", "ผู้ดูแลเขต", "ยอดขาย", "จำนวน", "สถานะ" };
        for (var i = 0; i < headers.Length; i++)
        {
            sheet.Cell(2, i + 1).Value = headers[i];
        }

        var row = 3;
        foreach (var item in result.Items)
        {
            sheet.Cell(row, 1).Value = item.Code;
            sheet.Cell(row, 2).Value = item.Name;
            sheet.Cell(row, 3).Value = item.ProductType.Name;
            sheet.Cell(row, 4).Value = result.Territory.Name;
            sheet.Cell(row, 5).Value = owners;
            sheet.Cell(row, 6).Value = item.Revenue;
            sheet.Cell(row, 7).Value = item.Quantity;
            if (item.ZeroSaleStatus != null)
            {
                sheet.Cell(row, 8).Value = item.ZeroSaleStatus;
            }

            row++;
        }

        // personalBucket exists in the payload only for MANAGER (same gate as the screen).
        if (isManager)
        {
            foreach (var item in result.PersonalBucket ?? new List<Contracts.Kpi.TerritoryPersonalBucketItemDto>())
            {
                sheet.Cell(row, 1).Value = "(personalBucket)";
                sheet.Cell(row, 2).Value = item.Name;
                sheet.Cell(row, 3).Value = item.ProductType.Name;
                sheet.Cell(row, 4).Value = result.Territory.Name;
                sheet.Cell(row, 5).Value = owners;
                sheet.Cell(row, 6).Value = item.Revenue;
                sheet.Cell(row, 7).Value = item.Quantity;
                row++;
            }
        }

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return Results.File(
            stream.ToArray(),
            SpreadsheetContentType,
            fileDownloadName: $"territory-product-ranking-{territoryId}.xlsx");
    }
}
