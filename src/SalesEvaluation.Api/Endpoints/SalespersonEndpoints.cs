namespace SalesEvaluation.Api.Endpoints;

using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Salespeople;
using SalesEvaluation.Domain.Enums;

public static class SalespersonEndpoints
{
    public static IEndpointRouteBuilder MapSalespersonEndpoints(this IEndpointRouteBuilder app)
    {
        // GET /salespeople and GET /api/salespeople
        app.MapGet("/salespeople", HandleListSalespeople);
        app.MapGet("/api/salespeople", HandleListSalespeople);

        // PATCH /salespeople/{id} and PATCH /api/salespeople/{id}
        app.MapPatch("/salespeople/{id}", HandleUpdateSalesperson);
        app.MapPatch("/api/salespeople/{id}", HandleUpdateSalesperson);

        return app;
    }

    private static async Task<IResult> HandleListSalespeople(
        ISalespersonService salespersonService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var currentUser = currentUserService.User;
        if (currentUser == null)
        {
            return Results.Json(new { error = "Unauthorized" }, statusCode: StatusCodes.Status401Unauthorized);
        }

        var response = await salespersonService.ListSalespeopleAsync(currentUser, ct);
        return Results.Ok(response);
    }

    private static async Task<IResult> HandleUpdateSalesperson(
        string id,
        HttpContext httpContext,
        ISalespersonService salespersonService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var currentUser = currentUserService.User;
        if (currentUser == null || currentUser.Role != UserRole.MANAGER)
        {
            return Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden);
        }

        JsonDocument doc;
        try
        {
            doc = await JsonDocument.ParseAsync(httpContext.Request.Body, cancellationToken: ct);
        }
        catch
        {
            return Results.Json(new { error = "Validation failed", details = "Invalid JSON payload" }, statusCode: StatusCodes.Status400BadRequest);
        }

        using (doc)
        {
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return Results.Json(new { error = "Validation failed", details = "Payload must be a JSON object" }, statusCode: StatusCodes.Status400BadRequest);
            }

            var request = new UpdateSalespersonRequest();

            if (root.TryGetProperty("userId", out var userProp))
            {
                request.HasUserId = true;
                if (userProp.ValueKind == JsonValueKind.Null)
                {
                    request.UserId = null;
                }
                else if (userProp.ValueKind == JsonValueKind.String)
                {
                    request.UserId = userProp.GetString();
                }
                else
                {
                    return Results.Json(new { error = "Validation failed", details = "userId must be a string or null" }, statusCode: StatusCodes.Status400BadRequest);
                }
            }

            if (root.TryGetProperty("displayName", out var dispProp))
            {
                request.HasDisplayName = true;
                if (dispProp.ValueKind == JsonValueKind.Null)
                {
                    request.DisplayName = null;
                }
                else if (dispProp.ValueKind == JsonValueKind.String)
                {
                    request.DisplayName = dispProp.GetString();
                }
                else
                {
                    return Results.Json(new { error = "Validation failed", details = "displayName must be a string or null" }, statusCode: StatusCodes.Status400BadRequest);
                }
            }

            if (root.TryGetProperty("isActive", out var activeProp))
            {
                request.HasIsActive = true;
                if (activeProp.ValueKind == JsonValueKind.True || activeProp.ValueKind == JsonValueKind.False)
                {
                    request.IsActive = activeProp.GetBoolean();
                }
                else
                {
                    return Results.Json(new { error = "Validation failed", details = "isActive must be a boolean" }, statusCode: StatusCodes.Status400BadRequest);
                }
            }

            if (root.TryGetProperty("excludedFromTerritoryTotals", out var exclProp))
            {
                request.HasExcludedFromTerritoryTotals = true;
                if (exclProp.ValueKind == JsonValueKind.True || exclProp.ValueKind == JsonValueKind.False)
                {
                    request.ExcludedFromTerritoryTotals = exclProp.GetBoolean();
                }
                else
                {
                    return Results.Json(new { error = "Validation failed", details = "excludedFromTerritoryTotals must be a boolean" }, statusCode: StatusCodes.Status400BadRequest);
                }
            }

            if (root.TryGetProperty("employmentEndedAt", out var endedProp))
            {
                request.HasEmploymentEndedAt = true;
                if (endedProp.ValueKind == JsonValueKind.Null)
                {
                    request.EmploymentEndedAt = null;
                }
                else if (endedProp.ValueKind == JsonValueKind.String)
                {
                    request.EmploymentEndedAt = endedProp.GetString();
                }
                else
                {
                    return Results.Json(new { error = "Validation failed", details = "employmentEndedAt must be a string or null" }, statusCode: StatusCodes.Status400BadRequest);
                }
            }

            var result = await salespersonService.UpdateSalespersonAsync(id, request, ct);
            return Results.Ok(result);
        }
    }
}
