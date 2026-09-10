namespace SalesEvaluation.Api.Endpoints;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Application.Common;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Domain.Enums;

public static class CoachingInsightEndpoints
{
    public static IEndpointRouteBuilder MapCoachingInsightEndpoints(this IEndpointRouteBuilder app)
    {
        // GET /coaching-insights/:salespersonId?periodType=MONTH&year=2025&periodNumber=1
        app.MapGet("/coaching-insights/{salespersonId}", HandleGetInsight);

        // POST /coaching-insights/:salespersonId/generate (body: {periodType, year, periodNumber})
        app.MapPost("/coaching-insights/{salespersonId}/generate", HandleGenerateInsight);

        return app;
    }

    private static async Task<IResult> HandleGetInsight(
        int salespersonId,
        string? periodType,
        string? year,
        string? periodNumber,
        ICoachingInsightService coachingInsightService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var periodResult = ParsePeriodFromQuery(periodType, year, periodNumber);
        if (periodResult.Error != null) return periodResult.Error;

        var viewer = new CurrentUserRef
        {
            Id = currentUserService.User!.Id,
            Role = currentUserService.User.Role,
        };

        try
        {
            var response = await coachingInsightService.GetInsightAsync(salespersonId, periodResult.Period, viewer, ct);
            return Results.Ok(response);
        }
        catch (UnauthorizedAccessException)
        {
            return Results.Json(new { error = "Forbidden" }, statusCode: StatusCodes.Status403Forbidden);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "Salesperson not found")
        {
            return Results.Json(new { error = "Salesperson not found" }, statusCode: StatusCodes.Status404NotFound);
        }
    }

    private static async Task<IResult> HandleGenerateInsight(
        int salespersonId,
        HttpContext httpContext,
        ICoachingInsightService coachingInsightService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (currentUserService.User?.Role != UserRole.MANAGER)
            return Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden);

        var parsedBody = await TerritoryEndpoints.ParseBodyAsync(httpContext);
        if (!parsedBody.Ok)
            return parsedBody.Error!;

        using (parsedBody.Doc)
        {
            var root = parsedBody.Doc!.RootElement;
            if (root.ValueKind != System.Text.Json.JsonValueKind.Object)
                return TerritoryEndpoints.Invalid("Payload must be a JSON object");

            if (!root.TryGetProperty("periodType", out var ptProp) || ptProp.ValueKind != System.Text.Json.JsonValueKind.String)
                return TerritoryEndpoints.Invalid("periodType is required");
            if (!root.TryGetProperty("year", out var yearProp) || yearProp.ValueKind != System.Text.Json.JsonValueKind.Number)
                return TerritoryEndpoints.Invalid("year is required");
            if (!root.TryGetProperty("periodNumber", out var pnProp) || pnProp.ValueKind != System.Text.Json.JsonValueKind.Number)
                return TerritoryEndpoints.Invalid("periodNumber is required");

            if (!Enum.TryParse<PeriodType>(ptProp.GetString(), out var pt))
                return TerritoryEndpoints.Invalid("periodType must be MONTH, QUARTER, or YEAR");

            // T-UX-029 — same range rules as the query parser (YEAR normalizes periodNumber to 0).
            var periodResult = PeriodQueryParser.ValidateBodyPeriod(pt, yearProp.GetInt32(), pnProp.GetInt32());
            if (periodResult.Error != null) return periodResult.Error;
            var period = periodResult.Period;

            try
            {
                var insight = await coachingInsightService.GenerateInsightAsync(
                    salespersonId, period, currentUserService.User!.Id, ct);
                return Results.Json(new { insight }, statusCode: StatusCodes.Status201Created);
            }
            catch (KeyNotFoundException ex) when (ex.Message == "Salesperson not found")
            {
                return Results.Json(new { error = "Salesperson not found" }, statusCode: StatusCodes.Status404NotFound);
            }
        }
    }

    private static (AppPeriodKey Period, IResult? Error) ParsePeriodFromQuery(
        string? periodType, string? year, string? periodNumber)
    {
        // T-UX-029 — single period parser shared across endpoint families.
        return PeriodQueryParser.TryParsePeriod(periodType, year, periodNumber, out var period, out var error)
            ? (period, null)
            : (default, error);
    }
}
