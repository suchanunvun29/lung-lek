namespace SalesEvaluation.Api.Endpoints;

using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Territories;
using SalesEvaluation.Domain.Enums;

public static class TerritoryGroupEndpoints
{
    public static IEndpointRouteBuilder MapTerritoryGroupEndpoints(this IEndpointRouteBuilder app)
    {
        // GET /territory-groups — any authenticated user
        app.MapGet("/territory-groups", async (ITerritoryService territoryService, CancellationToken ct) =>
            Results.Ok(await territoryService.ListGroupsAsync(ct)));

        // POST /territory-groups — MANAGER
        app.MapPost("/territory-groups", async (CreateTerritoryGroupRequest request, ITerritoryService territoryService, ICurrentUserService currentUserService, CancellationToken ct) =>
        {
            if (currentUserService.User?.Role != UserRole.MANAGER)
            {
                return Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden);
            }

            var result = await territoryService.CreateGroupAsync(request, ct);
            return Results.Json(result, statusCode: StatusCodes.Status201Created);
        });

        // PATCH /territory-groups/{id} — MANAGER
        app.MapPatch("/territory-groups/{id}", HandleUpdateGroup);

        // POST /territory-groups/{id}/members — MANAGER
        app.MapPost("/territory-groups/{id}/members", HandleAddGroupMember);

        // PATCH /territory-groups/{id}/members/{memberId} — MANAGER
        app.MapPatch("/territory-groups/{id}/members/{memberId}", HandleUpdateGroupMember);

        return app;
    }

    private static async Task<IResult> HandleUpdateGroup(
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

            var request = new UpdateTerritoryGroupRequest();

            if (root.TryGetProperty("name", out var nameProp))
            {
                if (nameProp.ValueKind != JsonValueKind.String)
                {
                    return TerritoryEndpoints.Invalid("name must be a string");
                }
                request.Name = nameProp.GetString();
                request.HasName = true;
            }

            if (root.TryGetProperty("isActive", out var activeProp))
            {
                if (activeProp.ValueKind != JsonValueKind.True && activeProp.ValueKind != JsonValueKind.False)
                {
                    return TerritoryEndpoints.Invalid("isActive must be a boolean");
                }
                request.IsActive = activeProp.GetBoolean();
                request.HasIsActive = true;
            }

            if (root.TryGetProperty("note", out var noteProp))
            {
                request.HasNote = true;
                request.Note = noteProp.ValueKind == JsonValueKind.Null ? null : noteProp.GetString();
            }

            var result = await territoryService.UpdateGroupAsync(id, request, ct);
            return Results.Ok(result);
        }
    }

    private static async Task<IResult> HandleAddGroupMember(
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

            if (!root.TryGetProperty("territoryId", out var terrProp) || terrProp.ValueKind != JsonValueKind.String || string.IsNullOrEmpty(terrProp.GetString()))
            {
                return TerritoryEndpoints.Invalid("territoryId is required");
            }

            var territoryId = terrProp.GetString()!;

            if (!root.TryGetProperty("effectiveFrom", out var fromProp) || !TerritoryEndpoints.TryParseDateOnly(fromProp, out var effectiveFrom))
            {
                return TerritoryEndpoints.Invalid("effectiveFrom must be a valid date");
            }

            // Membership periods are month-aligned (Territory KPI Rules ข้อ 6).
            if (effectiveFrom.Day != 1)
            {
                return TerritoryEndpoints.Invalid("effectiveFrom ต้องเป็นวันแรกของเดือน");
            }

            DateOnly? effectiveTo = null;
            if (root.TryGetProperty("effectiveTo", out var toProp) && toProp.ValueKind != JsonValueKind.Null)
            {
                if (!TerritoryEndpoints.TryParseDateOnly(toProp, out var parsedTo))
                {
                    return TerritoryEndpoints.Invalid("effectiveTo must be a valid date");
                }
                if (!IsLastDayOfMonth(parsedTo))
                {
                    return TerritoryEndpoints.Invalid("effectiveTo ต้องเป็นวันสุดท้ายของเดือน");
                }
                if (parsedTo < effectiveFrom)
                {
                    return TerritoryEndpoints.Invalid("effectiveTo ต้องไม่ก่อน effectiveFrom");
                }
                effectiveTo = parsedTo;
            }

            var member = await territoryService.AddGroupMemberAsync(id, new AddGroupMemberRequest
            {
                TerritoryId = territoryId,
                EffectiveFrom = effectiveFrom,
                EffectiveTo = effectiveTo,
                HasEffectiveTo = effectiveTo.HasValue
            }, ct);

            if (member == null)
            {
                return Results.Json(new { error = "Territory group not found" }, statusCode: StatusCodes.Status404NotFound);
            }

            return Results.Json(new { member }, statusCode: StatusCodes.Status201Created);
        }
    }

    private static async Task<IResult> HandleUpdateGroupMember(
        string id,
        string memberId,
        HttpContext httpContext,
        ITerritoryService territoryService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (currentUserService.User?.Role != UserRole.MANAGER)
        {
            return Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden);
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

            var request = new UpdateGroupMemberRequest();

            if (root.TryGetProperty("effectiveFrom", out var fromProp) && fromProp.ValueKind != JsonValueKind.Null)
            {
                if (!TerritoryEndpoints.TryParseDateOnly(fromProp, out var effectiveFrom))
                {
                    return TerritoryEndpoints.Invalid("effectiveFrom must be a valid date");
                }
                if (effectiveFrom.Day != 1)
                {
                    return TerritoryEndpoints.Invalid("effectiveFrom ต้องเป็นวันแรกของเดือน");
                }
                request.EffectiveFrom = effectiveFrom;
                request.HasEffectiveFrom = true;
            }

            if (root.TryGetProperty("effectiveTo", out var toProp) && toProp.ValueKind != JsonValueKind.Null)
            {
                if (!TerritoryEndpoints.TryParseDateOnly(toProp, out var effectiveTo))
                {
                    return TerritoryEndpoints.Invalid("effectiveTo must be a valid date");
                }
                if (!IsLastDayOfMonth(effectiveTo))
                {
                    return TerritoryEndpoints.Invalid("effectiveTo ต้องเป็นวันสุดท้ายของเดือน");
                }
                request.EffectiveTo = effectiveTo;
                request.HasEffectiveTo = true;
            }

            if (!request.HasAnyField)
            {
                return TerritoryEndpoints.Invalid("ต้องระบุช่วงเวลาที่ต้องการแก้ไข");
            }

            if (request.HasEffectiveFrom && request.HasEffectiveTo && request.EffectiveTo!.Value < request.EffectiveFrom!.Value)
            {
                return TerritoryEndpoints.Invalid("effectiveTo ต้องไม่ก่อน effectiveFrom");
            }

            var member = await territoryService.UpdateGroupMemberAsync(id, memberId, request, ct);
            return Results.Json(new { member });
        }
    }

    private static bool IsLastDayOfMonth(DateOnly value) =>
        value.Day == DateTime.DaysInMonth(value.Year, value.Month);
}
