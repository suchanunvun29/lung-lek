namespace SalesEvaluation.Api.Endpoints;

using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Application.Targets;
using SalesEvaluation.Contracts.Targets;
using SalesEvaluation.Domain.Enums;

// Phase 10 — target-assist is a MANAGER surface (plan.md): it exposes every salesperson's
// territory figures and is the input to target-setting.
public static class TargetSuggestionEndpoints
{
    private static readonly string[] ValidModes = { "SUGGEST", "REBALANCE" };

    public static IEndpointRouteBuilder MapTargetSuggestionEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/target-suggestions/reinstate-deal", HandleReinstateDeal);
        app.MapGet("/target-suggestions/{year}/{month}", HandleGetTargetSuggestions);

        return app;
    }

    private static IResult? RequireManager(ICurrentUserService currentUserService) =>
        currentUserService.User?.Role != UserRole.MANAGER
            ? Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden)
            : null;

    private static bool TryParseMode(string? raw, out string mode, out IResult? error)
    {
        mode = "SUGGEST";
        error = null;
        if (string.IsNullOrEmpty(raw))
        {
            return true;
        }

        if (!ValidModes.Contains(raw))
        {
            error = TerritoryEndpoints.Invalid("mode must be one of SUGGEST, REBALANCE");
            return false;
        }

        mode = raw;
        return true;
    }

    private static bool TryParseGrowthRate(string? raw, out double? growthRate, out IResult? error)
    {
        growthRate = null;
        error = null;
        if (string.IsNullOrEmpty(raw))
        {
            return true;
        }

        if (!double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var value) ||
            value < 0 || value > 999.999)
        {
            error = TerritoryEndpoints.Invalid("targetGrowthRate must be a number between 0 and 999.999");
            return false;
        }

        growthRate = value;
        return true;
    }

    private static async Task<IResult> HandleGetTargetSuggestions(
        string year,
        string month,
        HttpContext httpContext,
        ITargetAssistService targetAssistService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (RequireManager(currentUserService) is { } roleError)
        {
            return roleError;
        }

        if (!int.TryParse(year, NumberStyles.Integer, CultureInfo.InvariantCulture, out var yearValue) ||
            !int.TryParse(month, NumberStyles.Integer, CultureInfo.InvariantCulture, out var monthValue) ||
            monthValue < 1 || monthValue > 12)
        {
            return TerritoryEndpoints.Invalid("year and month must be valid integers (month 1-12)");
        }

        var query = httpContext.Request.Query;
        if (!TryParseMode(query["mode"].ToString(), out var mode, out var modeError))
        {
            return modeError!;
        }

        if (!TryParseGrowthRate(query["targetGrowthRate"].ToString(), out var growthRate, out var growthError))
        {
            return growthError!;
        }

        try
        {
            var payload = await targetAssistService.BuildPreviewAsync(yearValue, monthValue, mode, growthRate, null, ct);
            return Results.Json(payload);
        }
        catch (RebalancePreconditionException ex)
        {
            return Results.Json(new { error = ex.Message, missingByRegionName = ex.MissingByRegionName }, statusCode: StatusCodes.Status400BadRequest);
        }
    }

    // Territory & Potential Rules ข้อ 5.1 — reinstating a cut deal affects this preview only;
    // nothing is written anywhere. The manager accepts numbers into Target through the existing
    // target endpoints.
    private static async Task<IResult> HandleReinstateDeal(
        HttpContext httpContext,
        ITargetAssistService targetAssistService,
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

            if (!root.TryGetProperty("year", out var yearProp) || !yearProp.TryGetInt32(out var year))
            {
                return TerritoryEndpoints.Invalid("year must be an integer");
            }

            if (!root.TryGetProperty("month", out var monthProp) ||
                !monthProp.TryGetInt32(out var month) || month < 1 || month > 12)
            {
                return TerritoryEndpoints.Invalid("month must be an integer between 1 and 12");
            }

            var mode = "SUGGEST";
            if (root.TryGetProperty("mode", out var modeProp))
            {
                if (modeProp.ValueKind != JsonValueKind.String || !ValidModes.Contains(modeProp.GetString()))
                {
                    return TerritoryEndpoints.Invalid("mode must be one of SUGGEST, REBALANCE");
                }

                mode = modeProp.GetString()!;
            }

            if (!root.TryGetProperty("reinstateInvoiceNos", out var invoicesProp) ||
                invoicesProp.ValueKind != JsonValueKind.Array)
            {
                return TerritoryEndpoints.Invalid("reinstateInvoiceNos must be a nonempty array");
            }

            var reinstateInvoiceNos = new List<string>();
            foreach (var item in invoicesProp.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(item.GetString()))
                {
                    return TerritoryEndpoints.Invalid("reinstateInvoiceNos entries must be nonempty strings");
                }

                reinstateInvoiceNos.Add(item.GetString()!.Trim());
            }

            if (reinstateInvoiceNos.Count == 0)
            {
                return TerritoryEndpoints.Invalid("reinstateInvoiceNos must be a nonempty array");
            }

            double? growthRate = null;
            if (root.TryGetProperty("targetGrowthRate", out var growthProp))
            {
                if (growthProp.ValueKind != JsonValueKind.Number || !growthProp.TryGetDouble(out var growthValue) ||
                    growthValue < 0 || growthValue > 999.999)
                {
                    return TerritoryEndpoints.Invalid("targetGrowthRate must be a number between 0 and 999.999");
                }

                growthRate = growthValue;
            }

            try
            {
                var payload = await targetAssistService.BuildPreviewAsync(
                    year,
                    month,
                    mode,
                    growthRate,
                    reinstateInvoiceNos.ToHashSet(),
                    ct);

                return Results.Json(new ReinstateDealResponseWithInvoices(payload, reinstateInvoiceNos));
            }
            catch (RebalancePreconditionException ex)
            {
                return Results.Json(new { error = ex.Message, missingByRegionName = ex.MissingByRegionName }, statusCode: StatusCodes.Status400BadRequest);
            }
        }
    }

    /// <summary>{ ...payload, reinstatedInvoiceNos } — the preview payload plus the echo field.</summary>
    private sealed record ReinstateDealResponseWithInvoices(TargetSuggestionPreviewDto Payload, List<string> ReinstateInvoiceNos)
    {
#pragma warning disable IDE1006 // JSON contract names
        public int Year => Payload.Year;
        public int Month => Payload.Month;
        public string Mode => Payload.Mode;
        public SuggestionSettingsDto Settings => Payload.Settings;
        public SuggestionWindowDto Window => Payload.Window;
        public List<RegionSuggestionGroupDto> Regions => Payload.Regions;
        public List<UnmappedBaseEntryDto> Unmapped => Payload.Unmapped;
        public List<TerritorySuggestedTotalDto> Totals => Payload.Totals;
        public List<CutDealEntryDto> CutDeals => Payload.CutDeals;
#pragma warning restore IDE1006
    }
}
