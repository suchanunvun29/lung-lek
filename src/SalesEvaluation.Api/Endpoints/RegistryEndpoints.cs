namespace SalesEvaluation.Api.Endpoints;

using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.HospitalRegistry;
using SalesEvaluation.Domain.Enums;

public static class RegistryEndpoints
{
    private static readonly string[] ValidLinkStatuses = { "UNREVIEWED", "LINKED", "CONFIRMED_ABSENT" };

    public static IEndpointRouteBuilder MapRegistryEndpoints(this IEndpointRouteBuilder app)
    {
        // GET /provinces — any authenticated user
        app.MapGet("/provinces", async (IHospitalRegistryService registryService, CancellationToken ct) =>
            Results.Ok(await registryService.ListProvincesAsync(ct)));

        // PATCH /provinces/{id} — MANAGER
        app.MapPatch("/provinces/{id}", HandleUpdateProvince);

        // GET /hospital-registries — MANAGER (whole registry router requires the role in the TS backend)
        app.MapGet("/hospital-registries", HandleListHospitalRegistries);

        // PATCH /hospital-registry/{id}/potential-adjustment — MANAGER
        app.MapPatch("/hospital-registry/{id}/potential-adjustment", HandleUpdatePotentialAdjustment);

        // GET /hospital-registry-links — MANAGER
        app.MapGet("/hospital-registry-links", async (string? status, IHospitalRegistryService registryService, ICurrentUserService currentUserService, CancellationToken ct) =>
        {
            var roleError = RequireManager(currentUserService);
            if (roleError != null)
            {
                return roleError;
            }

            if (status != null && !ValidLinkStatuses.Contains(status))
            {
                return TerritoryEndpoints.Invalid($"status must be one of {string.Join(", ", ValidLinkStatuses)}");
            }

            return Results.Ok(await registryService.ListRegistryLinksAsync(status, ct));
        });

        // PATCH /hospital-registry-links/{hospitalId} — MANAGER
        app.MapPatch("/hospital-registry-links/{hospitalId}", HandleUpdateRegistryLink);

        return app;
    }

    private static IResult? RequireManager(ICurrentUserService currentUserService)
    {
        return currentUserService.User?.Role != UserRole.MANAGER
            ? Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden)
            : null;
    }

    private static async Task<IResult> HandleUpdateProvince(
        string id,
        HttpContext httpContext,
        IHospitalRegistryService registryService,
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

            var request = new UpdateProvinceRequest();

            if (root.TryGetProperty("canonicalName", out var nameProp))
            {
                if (nameProp.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(nameProp.GetString()))
                {
                    return TerritoryEndpoints.Invalid("canonicalName must be a non-empty string");
                }
                request.CanonicalName = nameProp.GetString()!.Trim();
                request.HasCanonicalName = true;
            }

            if (root.TryGetProperty("regionId", out var regionProp))
            {
                if (regionProp.ValueKind != JsonValueKind.String || string.IsNullOrEmpty(regionProp.GetString()))
                {
                    return TerritoryEndpoints.Invalid("regionId must be a non-empty string");
                }
                request.RegionId = regionProp.GetString();
                request.HasRegionId = true;
            }

            if (!request.HasAnyField)
            {
                return TerritoryEndpoints.Invalid("Provide canonicalName or regionId");
            }

            var result = await registryService.UpdateProvinceAsync(id, request, ct);
            return Results.Ok(result);
        }
    }

    private static async Task<IResult> HandleListHospitalRegistries(
        string? q,
        string? provinceMappingId,
        string? territoryId,
        string? page,
        string? pageSize,
        IHospitalRegistryService registryService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (RequireManager(currentUserService) is { } roleError)
        {
            return roleError;
        }

        int pageValue = 1;
        int pageSizeValue = 50;

        if (!string.IsNullOrEmpty(page))
        {
            if (!int.TryParse(page, NumberStyles.Integer, CultureInfo.InvariantCulture, out pageValue) || pageValue < 1)
            {
                return TerritoryEndpoints.Invalid("page must be an integer >= 1");
            }
        }

        if (!string.IsNullOrEmpty(pageSize))
        {
            if (!int.TryParse(pageSize, NumberStyles.Integer, CultureInfo.InvariantCulture, out pageSizeValue) || pageSizeValue < 1 || pageSizeValue > 200)
            {
                return TerritoryEndpoints.Invalid("pageSize must be an integer between 1 and 200");
            }
        }

        return Results.Ok(await registryService.ListHospitalRegistriesAsync(q, provinceMappingId, territoryId, pageValue, pageSizeValue, ct));
    }

    private static async Task<IResult> HandleUpdatePotentialAdjustment(
        string id,
        HttpContext httpContext,
        IHospitalRegistryService registryService,
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

            if (!root.TryGetProperty("potentialAdjustment", out var adjProp) || adjProp.ValueKind != JsonValueKind.Number || !adjProp.TryGetDecimal(out var potentialAdjustment))
            {
                return TerritoryEndpoints.Invalid("potentialAdjustment must be a number");
            }

            // requirement 10.5 — per-hospital exemption/reduction; 0 removes it from potential entirely.
            if (potentialAdjustment < 0 || potentialAdjustment > 999.999m)
            {
                return TerritoryEndpoints.Invalid("potentialAdjustment must be between 0 and 999.999");
            }

            var result = await registryService.UpdatePotentialAdjustmentAsync(id, potentialAdjustment, ct);
            return Results.Ok(result);
        }
    }

    private static async Task<IResult> HandleUpdateRegistryLink(
        string hospitalId,
        HttpContext httpContext,
        IHospitalRegistryService registryService,
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

            var request = new UpdateRegistryLinkRequest();

            if (!root.TryGetProperty("status", out var statusProp) || statusProp.ValueKind != JsonValueKind.String)
            {
                return TerritoryEndpoints.Invalid("status is required");
            }

            var status = statusProp.GetString();
            if (status != "LINKED" && status != "CONFIRMED_ABSENT")
            {
                return TerritoryEndpoints.Invalid("status must be LINKED or CONFIRMED_ABSENT");
            }
            request.Status = status;

            if (root.TryGetProperty("hospitalRegistryId", out var registryProp))
            {
                request.HasHospitalRegistryId = true;
                request.HospitalRegistryId = registryProp.ValueKind == JsonValueKind.Null ? null : registryProp.GetString();
            }

            if (root.TryGetProperty("note", out var noteProp))
            {
                if (noteProp.ValueKind == JsonValueKind.String)
                {
                    var note = noteProp.GetString();
                    if (note != null && note.Length > 1000)
                    {
                        return TerritoryEndpoints.Invalid("note must be at most 1000 characters");
                    }
                    request.Note = note;
                }
                else if (noteProp.ValueKind == JsonValueKind.Null)
                {
                    request.Note = null;
                }
                else
                {
                    return TerritoryEndpoints.Invalid("note must be a string or null");
                }
                request.HasNote = true;
            }

            var result = await registryService.UpdateRegistryLinkAsync(hospitalId, request, currentUserService.User!.Id, ct);
            return Results.Ok(result);
        }
    }
}
