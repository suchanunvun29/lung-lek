namespace SalesEvaluation.Api.Endpoints;

using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Hospitals;
using SalesEvaluation.Domain.Enums;

public static class HospitalEndpoints
{
    public static IEndpointRouteBuilder MapHospitalEndpoints(this IEndpointRouteBuilder app)
    {
        // GET /hospitals and GET /api/hospitals
        app.MapGet("/hospitals", async (IHospitalService hospitalService, CancellationToken ct) =>
        {
            var response = await hospitalService.ListHospitalsAsync(ct);
            return Results.Ok(response);
        });

        app.MapGet("/api/hospitals", async (IHospitalService hospitalService, CancellationToken ct) =>
        {
            var response = await hospitalService.ListHospitalsAsync(ct);
            return Results.Ok(response);
        });

        // GET /hospitals/unassigned-territory
        app.MapGet("/hospitals/unassigned-territory", async (IHospitalService hospitalService, CancellationToken ct) =>
        {
            var response = await hospitalService.ListUnassignedTerritoryHospitalsAsync(ct);
            return Results.Ok(response);
        });

        // POST /hospitals/territory/bulk-by-province
        app.MapPost("/hospitals/territory/bulk-by-province", HandleBulkMoveHospitalsByProvince);

        // PATCH /hospitals/{id}/territory
        app.MapPatch("/hospitals/{id}/territory", HandlePatchHospitalTerritory);

        // POST /hospitals/{id}/aliases and POST /api/hospitals/{id}/aliases
        app.MapPost("/hospitals/{id}/aliases", HandleCreateHospitalAlias);
        app.MapPost("/api/hospitals/{id}/aliases", HandleCreateHospitalAlias);

        // PATCH /hospitals/{id} and PATCH /api/hospitals/{id}
        app.MapPatch("/hospitals/{id}", HandleUpdateHospital);
        app.MapPatch("/api/hospitals/{id}", HandleUpdateHospital);

        return app;
    }

    private static async Task<IResult> HandleUpdateHospital(
        int id,
        HttpContext httpContext,
        IHospitalService hospitalService,
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

            var request = new UpdateHospitalRequest();

            if (root.TryGetProperty("isPreExistingCustomer", out var preProp))
            {
                request.HasIsPreExistingCustomer = true;
                if (preProp.ValueKind == JsonValueKind.True || preProp.ValueKind == JsonValueKind.False)
                {
                    request.IsPreExistingCustomer = preProp.GetBoolean();
                }
                else
                {
                    return Results.Json(new { error = "Validation failed", details = "isPreExistingCustomer must be a boolean" }, statusCode: StatusCodes.Status400BadRequest);
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

            if (root.TryGetProperty("province", out var provProp))
            {
                request.HasProvince = true;
                if (provProp.ValueKind == JsonValueKind.Null)
                {
                    request.Province = null;
                }
                else if (provProp.ValueKind == JsonValueKind.String)
                {
                    request.Province = provProp.GetString();
                }
                else
                {
                    return Results.Json(new { error = "Validation failed", details = "province must be a string or null" }, statusCode: StatusCodes.Status400BadRequest);
                }
            }

            var result = await hospitalService.UpdateHospitalAsync(id, request, ct);
            return Results.Ok(result);
        }
    }

    private static async Task<IResult> HandleCreateHospitalAlias(
        int id,
        HttpContext httpContext,
        IHospitalService hospitalService,
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

            var request = new CreateHospitalAliasRequest();

            if (root.TryGetProperty("sampleRaw", out var rawProp) && rawProp.ValueKind == JsonValueKind.String)
            {
                request.SampleRaw = rawProp.GetString() ?? string.Empty;
            }
            else if (root.TryGetProperty("rawName", out var nameProp) && nameProp.ValueKind == JsonValueKind.String)
            {
                request.SampleRaw = nameProp.GetString() ?? string.Empty;
            }
            else if (root.TryGetProperty("alias", out var aliasProp) && aliasProp.ValueKind == JsonValueKind.String)
            {
                request.SampleRaw = aliasProp.GetString() ?? string.Empty;
            }
            else
            {
                return Results.Json(new { error = "Validation failed", details = "sampleRaw / rawName / alias is required" }, statusCode: StatusCodes.Status400BadRequest);
            }

            if (root.TryGetProperty("normalizedKey", out var normProp) && normProp.ValueKind == JsonValueKind.String)
            {
                request.NormalizedKey = normProp.GetString();
            }

            var result = await hospitalService.AddHospitalAliasAsync(id, request, currentUser.Id, ct);
            return Results.Json(result, statusCode: StatusCodes.Status201Created);
        }
    }

    private static async Task<IResult> HandlePatchHospitalTerritory(
        int id,
        HttpContext httpContext,
        IHospitalService hospitalService,
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

            var request = new PatchHospitalTerritoryRequest();

            if (root.TryGetProperty("territoryId", out var terrProp))
            {
                if (terrProp.ValueKind == JsonValueKind.Null)
                {
                    request.TerritoryId = null;
                }
                else if (terrProp.ValueKind == JsonValueKind.Number)
                {
                    request.TerritoryId = terrProp.GetInt32();
                }
                else if (terrProp.ValueKind == JsonValueKind.String && int.TryParse(terrProp.GetString(), out var tId))
                {
                    request.TerritoryId = tId;
                }
                else
                {
                    return Results.Json(new { error = "Validation failed", details = "territoryId must be a number or null" }, statusCode: StatusCodes.Status400BadRequest);
                }
            }

            if (root.TryGetProperty("note", out var noteProp))
            {
                if (noteProp.ValueKind == JsonValueKind.Null)
                {
                    request.Note = null;
                }
                else if (noteProp.ValueKind == JsonValueKind.String)
                {
                    request.Note = noteProp.GetString();
                }
            }

            var result = await hospitalService.PatchHospitalTerritoryAsync(id, request, currentUser.Id, ct);
            return Results.Ok(result);
        }
    }

    private static async Task<IResult> HandleBulkMoveHospitalsByProvince(
        HttpContext httpContext,
        IHospitalService hospitalService,
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

            var request = new BulkMoveHospitalsByProvinceRequest();

            if (root.TryGetProperty("province", out var provProp) && provProp.ValueKind == JsonValueKind.String)
            {
                request.Province = provProp.GetString() ?? string.Empty;
            }
            else
            {
                return Results.Json(new { error = "Validation failed", details = "province is required" }, statusCode: StatusCodes.Status400BadRequest);
            }

            if (root.TryGetProperty("territoryId", out var terrProp))
            {
                if (terrProp.ValueKind == JsonValueKind.Null)
                {
                    request.TerritoryId = null;
                }
                else if (terrProp.ValueKind == JsonValueKind.Number)
                {
                    request.TerritoryId = terrProp.GetInt32();
                }
                else if (terrProp.ValueKind == JsonValueKind.String && int.TryParse(terrProp.GetString(), out var tId))
                {
                    request.TerritoryId = tId;
                }
                else
                {
                    return Results.Json(new { error = "Validation failed", details = "territoryId must be a number or null" }, statusCode: StatusCodes.Status400BadRequest);
                }
            }

            if (root.TryGetProperty("note", out var noteProp))
            {
                if (noteProp.ValueKind == JsonValueKind.Null)
                {
                    request.Note = null;
                }
                else if (noteProp.ValueKind == JsonValueKind.String)
                {
                    request.Note = noteProp.GetString();
                }
            }

            var result = await hospitalService.BulkMoveHospitalsByProvinceAsync(request, currentUser.Id, ct);
            return Results.Ok(result);
        }
    }
}
