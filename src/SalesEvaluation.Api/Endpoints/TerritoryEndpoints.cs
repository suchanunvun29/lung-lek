namespace SalesEvaluation.Api.Endpoints;

using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Territories;
using SalesEvaluation.Domain.Enums;

public static class TerritoryEndpoints
{
    public static IEndpointRouteBuilder MapTerritoryEndpoints(this IEndpointRouteBuilder app)
    {
        // GET /territories — any authenticated user
        app.MapGet("/territories", async (ITerritoryService territoryService, CancellationToken ct) =>
            Results.Ok(await territoryService.ListTerritoriesAsync(ct)));

        // POST /territories — MANAGER
        app.MapPost("/territories", async (CreateTerritoryRequest request, ITerritoryService territoryService, ICurrentUserService currentUserService, CancellationToken ct) =>
        {
            if (currentUserService.User?.Role != UserRole.MANAGER)
            {
                return Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden);
            }

            var result = await territoryService.CreateTerritoryAsync(request, ct);
            return Results.Json(result, statusCode: StatusCodes.Status201Created);
        });

        // PATCH /territories/{id} — MANAGER
        app.MapPatch("/territories/{id}", HandleUpdateTerritory);

        // GET /territory-assignments — any authenticated user
        app.MapGet("/territory-assignments", async (string? territoryId, string? salespersonId, string? status, ITerritoryService territoryService, CancellationToken ct) =>
            Results.Ok(await territoryService.ListAssignmentsAsync(territoryId, salespersonId, status, ct)));

        // PUT /territory-assignments — MANAGER; one payload shape covers assign and withdraw
        app.MapPut("/territory-assignments", HandlePutAssignment);

        return app;
    }

    private static async Task<IResult> HandleUpdateTerritory(
        string id,
        HttpContext httpContext,
        ITerritoryService territoryService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (currentUserService.User?.Role != UserRole.MANAGER)
        {
            return Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden);
        }

        var parsedBody = await ParseBodyAsync(httpContext);
        if (!parsedBody.Ok)
        {
            return parsedBody.Error!;
        }

        using (parsedBody.Doc)
        {
            var root = parsedBody.Doc!.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return Invalid("Payload must be a JSON object");
            }

            var request = new UpdateTerritoryRequest();

            if (root.TryGetProperty("name", out var nameProp))
            {
                if (nameProp.ValueKind != JsonValueKind.String)
                {
                    return Invalid("name must be a string");
                }
                request.Name = nameProp.GetString();
                request.HasName = true;
            }

            if (root.TryGetProperty("code", out var codeProp))
            {
                request.HasCode = true;
                request.Code = codeProp.ValueKind == JsonValueKind.Null ? null : codeProp.GetString();
            }

            if (root.TryGetProperty("regionId", out var regionProp))
            {
                request.HasRegionId = true;
                request.RegionId = regionProp.ValueKind == JsonValueKind.Null ? null : regionProp.GetString();
            }

            if (root.TryGetProperty("sortOrder", out var sortProp))
            {
                if (sortProp.ValueKind != JsonValueKind.Number || sortProp.TryGetInt32(out var sortOrder) == false)
                {
                    return Invalid("sortOrder must be an integer");
                }
                request.SortOrder = sortOrder;
                request.HasSortOrder = true;
            }

            if (root.TryGetProperty("isActive", out var activeProp))
            {
                if (activeProp.ValueKind != JsonValueKind.True && activeProp.ValueKind != JsonValueKind.False)
                {
                    return Invalid("isActive must be a boolean");
                }
                request.IsActive = activeProp.GetBoolean();
                request.HasIsActive = true;
            }

            if (root.TryGetProperty("note", out var noteProp))
            {
                request.HasNote = true;
                request.Note = noteProp.ValueKind == JsonValueKind.Null ? null : noteProp.GetString();
            }

            var result = await territoryService.UpdateTerritoryAsync(id, request, ct);
            return Results.Ok(result);
        }
    }

    private static async Task<IResult> HandlePutAssignment(
        HttpContext httpContext,
        ITerritoryService territoryService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (currentUserService.User?.Role != UserRole.MANAGER)
        {
            return Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden);
        }

        var parsedBody = await ParseBodyAsync(httpContext);
        if (!parsedBody.Ok)
        {
            return parsedBody.Error!;
        }

        using (parsedBody.Doc)
        {
            var root = parsedBody.Doc!.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return Invalid("Payload must be a JSON object");
            }

            var request = new PutAssignmentRequest();

            if (!root.TryGetProperty("territoryId", out var terrProp) || terrProp.ValueKind != JsonValueKind.String || string.IsNullOrEmpty(terrProp.GetString()))
            {
                return Invalid("territoryId is required");
            }
            request.TerritoryId = terrProp.GetString()!;

            if (!root.TryGetProperty("salespersonId", out var spProp) || spProp.ValueKind != JsonValueKind.String || string.IsNullOrEmpty(spProp.GetString()))
            {
                return Invalid("salespersonId is required");
            }
            request.SalespersonId = spProp.GetString()!;

            if (root.TryGetProperty("effectiveFrom", out var fromProp) && fromProp.ValueKind != JsonValueKind.Null)
            {
                if (!TryParseDateOnly(fromProp, out var effectiveFrom))
                {
                    return Invalid("effectiveFrom must be a valid date");
                }
                request.EffectiveFrom = effectiveFrom;
                request.HasEffectiveFrom = true;
            }

            if (root.TryGetProperty("effectiveTo", out var toProp) && toProp.ValueKind != JsonValueKind.Null)
            {
                if (!TryParseDateOnly(toProp, out var effectiveTo))
                {
                    return Invalid("effectiveTo must be a valid date");
                }
                request.EffectiveTo = effectiveTo;
                request.HasEffectiveTo = true;
            }

            if (root.TryGetProperty("isSupervisor", out var supProp))
            {
                if (supProp.ValueKind != JsonValueKind.True && supProp.ValueKind != JsonValueKind.False)
                {
                    return Invalid("isSupervisor must be a boolean");
                }
                request.IsSupervisor = supProp.GetBoolean();
            }

            if (root.TryGetProperty("note", out var noteProp))
            {
                request.HasNote = true;
                request.Note = noteProp.ValueKind == JsonValueKind.Null ? null : noteProp.GetString();
            }

            var (assignment, created) = await territoryService.PutAssignmentAsync(request, currentUserService.User!.Id, ct);
            return created
                ? Results.Json(new { assignment }, statusCode: StatusCodes.Status201Created)
                : Results.Json(new { assignment });
        }
    }

    internal static async Task<BodyParseResult> ParseBodyAsync(HttpContext httpContext)
    {
        try
        {
            return new BodyParseResult(await JsonDocument.ParseAsync(httpContext.Request.Body), null);
        }
        catch
        {
            return new BodyParseResult(null, Results.Json(new { error = "Validation failed", details = "Invalid JSON payload" }, statusCode: StatusCodes.Status400BadRequest));
        }
    }

    internal sealed record BodyParseResult(JsonDocument? Doc, IResult? Error)
    {
        public bool Ok => Doc != null;
    }

    internal static IResult Invalid(string details) =>
        Results.Json(new { error = "Validation failed", details }, statusCode: StatusCodes.Status400BadRequest);

    internal static bool TryParseDateOnly(JsonElement element, out DateOnly value)
    {
        value = default;
        if (element.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        var raw = element.GetString();
        if (string.IsNullOrEmpty(raw))
        {
            return false;
        }

        if (!DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var parsed))
        {
            return false;
        }

        value = DateOnly.FromDateTime(parsed);
        return true;
    }
}
