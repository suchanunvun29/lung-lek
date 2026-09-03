namespace SalesEvaluation.Api.Endpoints;

using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.ReviewQueues;
using SalesEvaluation.Domain.Enums;

public static class ReviewQueueEndpoints
{
    public static IEndpointRouteBuilder MapReviewQueueEndpoints(this IEndpointRouteBuilder app)
    {
        // ------------------ Hospital Name Reviews ------------------
        app.MapGet("/hospital-name-reviews", HandleListHospitalNameReviews);
        app.MapGet("/api/hospital-name-reviews", HandleListHospitalNameReviews);

        app.MapPatch("/hospital-name-reviews/{id}", HandleDecideHospitalNameReview);
        app.MapPatch("/api/hospital-name-reviews/{id}", HandleDecideHospitalNameReview);
        app.MapPost("/hospital-name-reviews/{id}/decide", HandleDecideHospitalNameReview);
        app.MapPost("/api/hospital-name-reviews/{id}/decide", HandleDecideHospitalNameReview);

        // ------------------ Salesman Name Reviews ------------------
        app.MapGet("/salesman-name-reviews", HandleListSalesmanNameReviews);
        app.MapGet("/api/salesman-name-reviews", HandleListSalesmanNameReviews);

        app.MapPatch("/salesman-name-reviews/{id}", HandleDecideSalesmanNameReview);
        app.MapPatch("/api/salesman-name-reviews/{id}", HandleDecideSalesmanNameReview);
        app.MapPost("/salesman-name-reviews/{id}/decide", HandleDecideSalesmanNameReview);
        app.MapPost("/api/salesman-name-reviews/{id}/decide", HandleDecideSalesmanNameReview);

        // ------------------ Salesman Name Rules ------------------
        app.MapGet("/salesman-name-rules", HandleListSalesmanNameRules);
        app.MapGet("/api/salesman-name-rules", HandleListSalesmanNameRules);

        app.MapPost("/salesman-name-rules", HandleCreateSalesmanNameRule);
        app.MapPost("/api/salesman-name-rules", HandleCreateSalesmanNameRule);

        app.MapPatch("/salesman-name-rules/{id}", HandleUpdateSalesmanNameRule);
        app.MapPatch("/api/salesman-name-rules/{id}", HandleUpdateSalesmanNameRule);

        return app;
    }

    private static async Task<IResult> HandleListHospitalNameReviews(
        IReviewQueueService reviewQueueService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var currentUser = currentUserService.User;
        if (currentUser == null || currentUser.Role != UserRole.MANAGER)
        {
            return Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden);
        }

        var response = await reviewQueueService.ListPendingHospitalNameReviewsAsync(ct);
        return Results.Ok(response);
    }

    private static async Task<IResult> HandleDecideHospitalNameReview(
        int id,
        HttpContext httpContext,
        IReviewQueueService reviewQueueService,
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

            var request = new DecideHospitalNameReviewRequest();

            if (root.TryGetProperty("decision", out var decProp) && decProp.ValueKind == JsonValueKind.String)
            {
                request.Decision = decProp.GetString() ?? string.Empty;
            }
            else
            {
                return Results.Json(new { error = "Validation failed", details = "decision is required" }, statusCode: StatusCodes.Status400BadRequest);
            }

            if (root.TryGetProperty("mergedIntoId", out var mergeProp))
            {
                if (mergeProp.ValueKind == JsonValueKind.Number)
                {
                    request.MergedIntoId = mergeProp.GetInt32();
                }
                else if (mergeProp.ValueKind == JsonValueKind.String && int.TryParse(mergeProp.GetString(), out var mId))
                {
                    request.MergedIntoId = mId;
                }
            }

            if (root.TryGetProperty("note", out var noteProp) && noteProp.ValueKind == JsonValueKind.String)
            {
                request.Note = noteProp.GetString();
            }

            var result = await reviewQueueService.DecideHospitalNameReviewAsync(id, request, currentUser.Id, ct);
            return Results.Ok(result);
        }
    }

    private static async Task<IResult> HandleListSalesmanNameReviews(
        IReviewQueueService reviewQueueService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var currentUser = currentUserService.User;
        if (currentUser == null || currentUser.Role != UserRole.MANAGER)
        {
            return Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden);
        }

        var response = await reviewQueueService.ListPendingSalesmanNameReviewsAsync(ct);
        return Results.Ok(response);
    }

    private static async Task<IResult> HandleDecideSalesmanNameReview(
        int id,
        HttpContext httpContext,
        IReviewQueueService reviewQueueService,
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

            var request = new DecideSalesmanNameReviewRequest();

            if (root.TryGetProperty("decision", out var decProp) && decProp.ValueKind == JsonValueKind.String)
            {
                request.Decision = decProp.GetString() ?? string.Empty;
            }
            else
            {
                return Results.Json(new { error = "Validation failed", details = "decision is required" }, statusCode: StatusCodes.Status400BadRequest);
            }

            if (root.TryGetProperty("mergedIntoId", out var mergeProp))
            {
                if (mergeProp.ValueKind == JsonValueKind.Number)
                {
                    request.MergedIntoId = mergeProp.GetInt32();
                }
                else if (mergeProp.ValueKind == JsonValueKind.String && int.TryParse(mergeProp.GetString(), out var mId))
                {
                    request.MergedIntoId = mId;
                }
            }

            if (root.TryGetProperty("note", out var noteProp) && noteProp.ValueKind == JsonValueKind.String)
            {
                request.Note = noteProp.GetString();
            }

            var result = await reviewQueueService.DecideSalesmanNameReviewAsync(id, request, currentUser.Id, ct);
            return Results.Ok(result);
        }
    }

    private static async Task<IResult> HandleListSalesmanNameRules(
        IReviewQueueService reviewQueueService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var currentUser = currentUserService.User;
        if (currentUser == null || currentUser.Role != UserRole.MANAGER)
        {
            return Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden);
        }

        var response = await reviewQueueService.ListSalesmanNameRulesAsync(ct);
        return Results.Ok(response);
    }

    private static async Task<IResult> HandleCreateSalesmanNameRule(
        HttpContext httpContext,
        IReviewQueueService reviewQueueService,
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

            var request = new CreateSalesmanNameRuleRequest();

            if (root.TryGetProperty("sampleRaw", out var rawProp) && rawProp.ValueKind == JsonValueKind.String)
            {
                request.SampleRaw = rawProp.GetString() ?? string.Empty;
            }
            else
            {
                return Results.Json(new { error = "Validation failed", details = "sampleRaw is required" }, statusCode: StatusCodes.Status400BadRequest);
            }

            if (root.TryGetProperty("members", out var memProp) && memProp.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in memProp.EnumerateArray())
                {
                    if (item.TryGetProperty("salespersonId", out var spProp) && item.TryGetProperty("sharePercent", out var shareProp))
                    {
                        int spId = 0;
                        if (spProp.ValueKind == JsonValueKind.Number)
                        {
                            spId = spProp.GetInt32();
                        }
                        else if (spProp.ValueKind == JsonValueKind.String && int.TryParse(spProp.GetString(), out var parsedId))
                        {
                            spId = parsedId;
                        }

                        decimal share = 0m;
                        if (shareProp.ValueKind == JsonValueKind.Number)
                        {
                            share = shareProp.GetDecimal();
                        }
                        else if (shareProp.ValueKind == JsonValueKind.String && decimal.TryParse(shareProp.GetString(), out var s))
                        {
                            share = s;
                        }
                        request.Members.Add(new SalesmanNameRuleMemberInputDto
                        {
                            SalespersonId = spId,
                            SharePercent = share
                        });
                    }
                }
            }
            else
            {
                return Results.Json(new { error = "Validation failed", details = "members array is required" }, statusCode: StatusCodes.Status400BadRequest);
            }

            var result = await reviewQueueService.CreateSalesmanNameRuleAsync(request, currentUser.Id, ct);
            return Results.Json(result, statusCode: StatusCodes.Status201Created);
        }
    }

    private static async Task<IResult> HandleUpdateSalesmanNameRule(
        int id,
        HttpContext httpContext,
        IReviewQueueService reviewQueueService,
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

            var request = new UpdateSalesmanNameRuleRequest();

            if (root.TryGetProperty("members", out var memProp) && memProp.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in memProp.EnumerateArray())
                {
                    if (item.TryGetProperty("salespersonId", out var spProp) && item.TryGetProperty("sharePercent", out var shareProp))
                    {
                        int spId = 0;
                        if (spProp.ValueKind == JsonValueKind.Number)
                        {
                            spId = spProp.GetInt32();
                        }
                        else if (spProp.ValueKind == JsonValueKind.String && int.TryParse(spProp.GetString(), out var parsedId))
                        {
                            spId = parsedId;
                        }

                        decimal share = 0m;
                        if (shareProp.ValueKind == JsonValueKind.Number)
                        {
                            share = shareProp.GetDecimal();
                        }
                        else if (shareProp.ValueKind == JsonValueKind.String && decimal.TryParse(shareProp.GetString(), out var s))
                        {
                            share = s;
                        }
                        request.Members.Add(new SalesmanNameRuleMemberInputDto
                        {
                            SalespersonId = spId,
                            SharePercent = share
                        });
                    }
                }
            }
            else
            {
                return Results.Json(new { error = "Validation failed", details = "members array is required" }, statusCode: StatusCodes.Status400BadRequest);
            }

            var result = await reviewQueueService.UpdateSalesmanNameRuleAsync(id, request, currentUser.Id, ct);
            return Results.Ok(result);
        }
    }
}
