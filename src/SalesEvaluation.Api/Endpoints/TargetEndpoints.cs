namespace SalesEvaluation.Api.Endpoints;

using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Targets;
using SalesEvaluation.Domain.Enums;

public static class TargetEndpoints
{
    public static IEndpointRouteBuilder MapTargetEndpoints(this IEndpointRouteBuilder app)
    {
        // Route order matters: literal segments must be matched before parameterized ones.
        app.MapGet("/targets/derived/{salespersonId}/{year}/{month}", HandleGetDerivedTarget);
        app.MapPost("/targets/copy", HandleCopyTargets);
        app.MapGet("/targets/{targetId}/revisions", HandleGetTargetRevisions);
        app.MapPut("/targets/{targetId}/product-groups", HandleUpdateProductGroupTargets);
        app.MapPut("/targets/territory/{territoryId}/{year}/{month}", HandleUpsertTerritoryTarget);
        app.MapPut("/targets/group/{territoryGroupId}/{year}/{month}", HandleUpsertTerritoryGroupTarget);
        app.MapPut("/targets/{salespersonId}/{year}/{month}", HandleUpsertTarget);
        app.MapGet("/targets", HandleListTargets);

        return app;
    }

    private static IResult? RequireManager(ICurrentUserService currentUserService) =>
        currentUserService.User?.Role != UserRole.MANAGER
            ? Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden)
            : null;

    // Auth only gates who can write — every authenticated role sees target data, per design.md's
    // "auth gates actions, not visibility" rule.
    private static async Task<IResult> HandleListTargets(
        HttpContext httpContext,
        ITargetService targetService,
        CancellationToken ct)
    {
        var query = httpContext.Request.Query;

        if (!query.TryGetValue("year", out var yearValue) ||
            !int.TryParse(yearValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out var year))
        {
            return TerritoryEndpoints.Invalid("year must be an integer");
        }

        var scope = TargetScope.SALESPERSON;
        if (query.TryGetValue("scope", out var scopeValue) && !string.IsNullOrEmpty(scopeValue))
        {
            if (!Enum.TryParse<TargetScope>(scopeValue.ToString(), ignoreCase: false, out scope))
            {
                return TerritoryEndpoints.Invalid("scope must be one of SALESPERSON, TERRITORY, TERRITORY_GROUP");
            }
        }

        return Results.Ok(await targetService.ListTargetsAsync(year, scope, ct));
    }

    private static async Task<IResult> HandleUpsertTarget(
        int salespersonId,
        string year,
        string month,
        HttpContext httpContext,
        ITargetService targetService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (RequireManager(currentUserService) is { } roleError)
        {
            return roleError;
        }

        if (!int.TryParse(year, NumberStyles.Integer, CultureInfo.InvariantCulture, out var yearValue))
        {
            return TerritoryEndpoints.Invalid("year must be an integer");
        }

        if (!int.TryParse(month, NumberStyles.Integer, CultureInfo.InvariantCulture, out var monthValue) ||
            monthValue < 1 || monthValue > 12)
        {
            return TerritoryEndpoints.Invalid("month must be an integer between 1 and 12");
        }

        var parsedBody = await TerritoryEndpoints.ParseBodyAsync(httpContext);
        if (!parsedBody.Ok)
        {
            return parsedBody.Error!;
        }

        using (parsedBody.Doc)
        {
            var root = parsedBody.Doc!.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return TerritoryEndpoints.Invalid("Payload must be a JSON object");
            }

            if (!root.TryGetProperty("revenueTarget", out var revenueProp) ||
                revenueProp.ValueKind != JsonValueKind.Number ||
                !revenueProp.TryGetDecimal(out var revenueTarget) || revenueTarget < 0)
            {
                return TerritoryEndpoints.Invalid("revenueTarget must be a nonnegative number");
            }

            if (!root.TryGetProperty("newCustomerTarget", out var newCustomerProp) ||
                newCustomerProp.ValueKind != JsonValueKind.Number ||
                !newCustomerProp.TryGetInt32(out var newCustomerTarget) || newCustomerTarget < 0)
            {
                return TerritoryEndpoints.Invalid("newCustomerTarget must be a nonnegative integer");
            }

            string? note = null;
            var hasNote = false;
            if (root.TryGetProperty("note", out var noteProp))
            {
                hasNote = true;
                if (noteProp.ValueKind == JsonValueKind.String)
                {
                    note = noteProp.GetString();
                    if (note != null && string.IsNullOrWhiteSpace(note))
                    {
                        return TerritoryEndpoints.Invalid("note must not be empty");
                    }
                }
                else if (noteProp.ValueKind != JsonValueKind.Null)
                {
                    return TerritoryEndpoints.Invalid("note must be a string or null");
                }
            }

            var result = await targetService.UpsertMonthlyTargetAsync(
                salespersonId,
                yearValue,
                monthValue,
                new UpsertTargetInput(revenueTarget, newCustomerTarget, note, hasNote),
                currentUserService.User!.Id,
                ct);

            if (result == null)
            {
                return Results.Json(new { error = "Salesperson not found" }, statusCode: StatusCodes.Status404NotFound);
            }

            return Results.Json(new { target = result.Target });
        }
    }

    private static async Task<IResult> HandleUpsertTerritoryTarget(
        int territoryId,
        string year,
        string month,
        HttpContext httpContext,
        ITargetService targetService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (RequireManager(currentUserService) is { } roleError)
        {
            return roleError;
        }

        if (!int.TryParse(year, NumberStyles.Integer, CultureInfo.InvariantCulture, out var yearValue))
        {
            return TerritoryEndpoints.Invalid("year must be an integer");
        }

        if (!int.TryParse(month, NumberStyles.Integer, CultureInfo.InvariantCulture, out var monthValue) ||
            monthValue < 1 || monthValue > 12)
        {
            return TerritoryEndpoints.Invalid("month must be an integer between 1 and 12");
        }

        var parsedBody = await TerritoryEndpoints.ParseBodyAsync(httpContext);
        if (!parsedBody.Ok)
        {
            return parsedBody.Error!;
        }

        using (parsedBody.Doc)
        {
            var root = parsedBody.Doc!.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return TerritoryEndpoints.Invalid("Payload must be a JSON object");
            }

            if (!root.TryGetProperty("revenueTarget", out var revenueProp) ||
                revenueProp.ValueKind != JsonValueKind.Number ||
                !revenueProp.TryGetDecimal(out var revenueTarget) || revenueTarget < 0)
            {
                return TerritoryEndpoints.Invalid("revenueTarget must be a nonnegative number");
            }

            if (!root.TryGetProperty("newCustomerTarget", out var newCustomerProp) ||
                newCustomerProp.ValueKind != JsonValueKind.Number ||
                !newCustomerProp.TryGetInt32(out var newCustomerTarget) || newCustomerTarget < 0)
            {
                return TerritoryEndpoints.Invalid("newCustomerTarget must be a nonnegative integer");
            }

            string? note = null;
            var hasNote = false;
            if (root.TryGetProperty("note", out var noteProp))
            {
                hasNote = true;
                if (noteProp.ValueKind == JsonValueKind.String)
                {
                    note = noteProp.GetString();
                    if (note != null && string.IsNullOrWhiteSpace(note))
                    {
                        return TerritoryEndpoints.Invalid("note must not be empty");
                    }
                }
                else if (noteProp.ValueKind != JsonValueKind.Null)
                {
                    return TerritoryEndpoints.Invalid("note must be a string or null");
                }
            }

            var result = await targetService.UpsertTerritoryTargetAsync(
                territoryId,
                yearValue,
                monthValue,
                new UpsertTargetInput(revenueTarget, newCustomerTarget, note, hasNote),
                currentUserService.User!.Id,
                ct);

            if (result == null)
            {
                return Results.Json(new { error = "Territory not found" }, statusCode: StatusCodes.Status404NotFound);
            }

            return Results.Json(new { target = result.Target });
        }
    }

    private static async Task<IResult> HandleUpsertTerritoryGroupTarget(
        int territoryGroupId,
        string year,
        string month,
        HttpContext httpContext,
        ITargetService targetService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (RequireManager(currentUserService) is { } roleError)
        {
            return roleError;
        }

        if (!int.TryParse(year, NumberStyles.Integer, CultureInfo.InvariantCulture, out var yearValue))
        {
            return TerritoryEndpoints.Invalid("year must be an integer");
        }

        if (!int.TryParse(month, NumberStyles.Integer, CultureInfo.InvariantCulture, out var monthValue) ||
            monthValue < 1 || monthValue > 12)
        {
            return TerritoryEndpoints.Invalid("month must be an integer between 1 and 12");
        }

        var parsedBody = await TerritoryEndpoints.ParseBodyAsync(httpContext);
        if (!parsedBody.Ok)
        {
            return parsedBody.Error!;
        }

        using (parsedBody.Doc)
        {
            var root = parsedBody.Doc!.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return TerritoryEndpoints.Invalid("Payload must be a JSON object");
            }

            if (!root.TryGetProperty("revenueTarget", out var revenueProp) ||
                revenueProp.ValueKind != JsonValueKind.Number ||
                !revenueProp.TryGetDecimal(out var revenueTarget) || revenueTarget < 0)
            {
                return TerritoryEndpoints.Invalid("revenueTarget must be a nonnegative number");
            }

            if (!root.TryGetProperty("newCustomerTarget", out var newCustomerProp) ||
                newCustomerProp.ValueKind != JsonValueKind.Number ||
                !newCustomerProp.TryGetInt32(out var newCustomerTarget) || newCustomerTarget < 0)
            {
                return TerritoryEndpoints.Invalid("newCustomerTarget must be a nonnegative integer");
            }

            string? note = null;
            var hasNote = false;
            if (root.TryGetProperty("note", out var noteProp))
            {
                hasNote = true;
                if (noteProp.ValueKind == JsonValueKind.String)
                {
                    note = noteProp.GetString();
                    if (note != null && string.IsNullOrWhiteSpace(note))
                    {
                        return TerritoryEndpoints.Invalid("note must not be empty");
                    }
                }
                else if (noteProp.ValueKind != JsonValueKind.Null)
                {
                    return TerritoryEndpoints.Invalid("note must be a string or null");
                }
            }

            var result = await targetService.UpsertTerritoryGroupTargetAsync(
                territoryGroupId,
                yearValue,
                monthValue,
                new UpsertTargetInput(revenueTarget, newCustomerTarget, note, hasNote),
                currentUserService.User!.Id,
                ct);

            if (result == null)
            {
                return Results.Json(new { error = "Territory group not found" }, statusCode: StatusCodes.Status404NotFound);
            }

            return Results.Json(new { target = result.Target });
        }
    }

    private static async Task<IResult> HandleUpdateProductGroupTargets(
        int targetId,
        HttpContext httpContext,
        ITargetService targetService,
        ICurrentUserService currentUserService,
        IAppDbContext dbContext,
        CancellationToken ct)
    {
        if (RequireManager(currentUserService) is { } roleError)
        {
            return roleError;
        }

        var parsedBody = await TerritoryEndpoints.ParseBodyAsync(httpContext);
        if (!parsedBody.Ok)
        {
            return parsedBody.Error!;
        }

        using (parsedBody.Doc)
        {
            var root = parsedBody.Doc!.RootElement;
            if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("productGroups", out var groupsProp) || groupsProp.ValueKind != JsonValueKind.Array)
            {
                return TerritoryEndpoints.Invalid("productGroups must be an array");
            }

            var productGroups = new List<ProductGroupInputDto>();
            var seenTypeIds = new HashSet<int>();
            foreach (var item in groupsProp.EnumerateArray())
            {
                int productTypeId;
                if (item.ValueKind != JsonValueKind.Object ||
                    !item.TryGetProperty("productTypeId", out var typeIdProp))
                {
                    return TerritoryEndpoints.Invalid("productGroups entries need a productTypeId");
                }

                if (typeIdProp.ValueKind == JsonValueKind.Number)
                {
                    productTypeId = typeIdProp.GetInt32();
                }
                else if (typeIdProp.ValueKind == JsonValueKind.String && int.TryParse(typeIdProp.GetString(), out var ptId))
                {
                    productTypeId = ptId;
                }
                else
                {
                    return TerritoryEndpoints.Invalid("productGroups entries need a valid productTypeId integer");
                }

                if (!item.TryGetProperty("revenueTarget", out var revenueProp) ||
                    revenueProp.ValueKind != JsonValueKind.Number ||
                    !revenueProp.TryGetDecimal(out var revenueTarget) || revenueTarget < 0)
                {
                    return TerritoryEndpoints.Invalid("revenueTarget must be a nonnegative number");
                }

                if (!seenTypeIds.Add(productTypeId))
                {
                    return Results.Json(new { error = "productGroups มีกลุ่มสินค้าซ้ำกัน" }, statusCode: StatusCodes.Status400BadRequest);
                }

                productGroups.Add(new ProductGroupInputDto { ProductTypeId = productTypeId, RevenueTarget = revenueTarget });
            }

            if (seenTypeIds.Count > 0)
            {
                var foundCount = await dbContext.ProductTypes
                    .AsNoTracking()
                    .CountAsync(pt => seenTypeIds.Contains(pt.Id), ct);
                if (foundCount != seenTypeIds.Count)
                {
                    return Results.Json(new { error = "พบ productTypeId ที่ไม่มีอยู่ในระบบ" }, statusCode: StatusCodes.Status400BadRequest);
                }
            }

            var result = await targetService.SetProductGroupTargetsAsync(targetId, productGroups, currentUserService.User!.Id, ct);
            if (result == null)
            {
                return Results.Json(new { error = "Target not found" }, statusCode: StatusCodes.Status404NotFound);
            }

            return Results.Json(new { target = result.Target });
        }
    }

    private static async Task<IResult> HandleCopyTargets(
        HttpContext httpContext,
        ITargetService targetService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (RequireManager(currentUserService) is { } roleError)
        {
            return roleError;
        }

        var parsedBody = await TerritoryEndpoints.ParseBodyAsync(httpContext);
        if (!parsedBody.Ok)
        {
            return parsedBody.Error!;
        }

        using (parsedBody.Doc)
        {
            var root = parsedBody.Doc!.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return TerritoryEndpoints.Invalid("Payload must be a JSON object");
            }

            if (!root.TryGetProperty("fromYear", out var fromYearProp) || !fromYearProp.TryGetInt32(out var fromYear))
            {
                return TerritoryEndpoints.Invalid("fromYear must be an integer");
            }

            if (!root.TryGetProperty("fromMonth", out var fromMonthProp) ||
                !fromMonthProp.TryGetInt32(out var fromMonth) || fromMonth < 1 || fromMonth > 12)
            {
                return TerritoryEndpoints.Invalid("fromMonth must be an integer between 1 and 12");
            }

            if (!root.TryGetProperty("toYear", out var toYearProp) || !toYearProp.TryGetInt32(out var toYear))
            {
                return TerritoryEndpoints.Invalid("toYear must be an integer");
            }

            if (!root.TryGetProperty("toMonth", out var toMonthProp) ||
                !toMonthProp.TryGetInt32(out var toMonth) || toMonth < 1 || toMonth > 12)
            {
                return TerritoryEndpoints.Invalid("toMonth must be an integer between 1 and 12");
            }

            var overwrite = root.TryGetProperty("overwrite", out var overwriteProp) && overwriteProp.ValueKind == JsonValueKind.True;

            if (fromYear == toYear && fromMonth == toMonth)
            {
                return TerritoryEndpoints.Invalid("ปลายทางต้องเป็นคนละงวดกับต้นทาง");
            }

            var result = await targetService.CopyTargetsAsync(
                new CopyTargetsInput(fromYear, fromMonth, toYear, toMonth, overwrite),
                currentUserService.User!.Id,
                ct);

            return Results.Json(new { sourceCount = result.SourceCount, created = result.Created, updated = result.Updated, skipped = result.Skipped });
        }
    }

    private static async Task<IResult> HandleGetTargetRevisions(
        int targetId,
        ITargetService targetService,
        CancellationToken ct)
    {
        var result = await targetService.GetTargetRevisionsAsync(targetId, ct);
        if (result == null)
        {
            return Results.Json(new { error = "Target not found" }, statusCode: StatusCodes.Status404NotFound);
        }

        return Results.Json(new { revisions = result.Revisions });
    }

    private static async Task<IResult> HandleGetDerivedTarget(
        int salespersonId,
        string year,
        string month,
        HttpContext httpContext,
        ITargetService targetService,
        ITerritoryScopeResolver scopeResolver,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var user = currentUserService.User;
        if (user == null || !await scopeResolver.CanViewSalespersonAsync(new CurrentUserRef { Id = user.Id, Role = user.Role }, salespersonId, ct))
        {
            return Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden);
        }

        if (!int.TryParse(year, NumberStyles.Integer, CultureInfo.InvariantCulture, out var yearValue) ||
            !int.TryParse(month, NumberStyles.Integer, CultureInfo.InvariantCulture, out var monthValue) ||
            monthValue < 1 || monthValue > 12)
        {
            return TerritoryEndpoints.Invalid("year and month must be valid integers (month 1-12)");
        }

        var result = await targetService.GetDerivedTargetAsync(salespersonId, yearValue, monthValue, ct);
        if (result == null)
        {
            return Results.Json(new { error = "Salesperson not found" }, statusCode: StatusCodes.Status404NotFound);
        }

        return Results.Json(new { derivedTarget = result.DerivedTarget });
    }
}
