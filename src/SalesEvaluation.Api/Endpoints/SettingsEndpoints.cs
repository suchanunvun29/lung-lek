namespace SalesEvaluation.Api.Endpoints;

using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Settings;
using SalesEvaluation.Domain.Enums;

public static class SettingsEndpoints
{
    public static IEndpointRouteBuilder MapSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/settings/scoring-weights", HandleGetScoringWeights);
        app.MapPut("/settings/scoring-weights", HandleUpdateScoringWeights);
        app.MapGet("/settings/evaluation", HandleGetEvaluationSetting);
        app.MapPatch("/settings/evaluation", HandleUpdateEvaluationSetting);
        app.MapPut("/settings/evaluation", HandleUpdateEvaluationSetting);
        // Module L — tier weights are MANAGER-only on both ends (plan.md Phase 10)
        app.MapGet("/settings/tier-weights", HandleGetTierWeights);
        app.MapPatch("/settings/tier-weights", HandleUpdateTierWeights);
        app.MapPut("/settings/tier-weights", HandleUpdateTierWeights);

        return app;
    }

    private static IResult? RequireManager(ICurrentUserService currentUserService) =>
        currentUserService.User?.Role != UserRole.MANAGER
            ? Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden)
            : null;

    private static async Task<IResult> HandleGetScoringWeights(
        ISettingsService settingsService,
        CancellationToken ct) =>
        Results.Ok(await settingsService.GetScoringWeightsAsync(ct));

    private static async Task<IResult> HandleUpdateScoringWeights(
        HttpContext httpContext,
        ISettingsService settingsService,
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
            if (root.ValueKind != JsonValueKind.Object ||
                !root.TryGetProperty("weights", out var weightsProp) || weightsProp.ValueKind != JsonValueKind.Array)
            {
                return TerritoryEndpoints.Invalid("weights must be an array");
            }

            var weights = new List<ScoringWeightInputDto>();
            foreach (var item in weightsProp.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object ||
                    !item.TryGetProperty("metric", out var metricProp) || metricProp.ValueKind != JsonValueKind.String ||
                    !Enum.TryParse<KpiMetric>(metricProp.GetString(), ignoreCase: false, out var metric))
                {
                    return TerritoryEndpoints.Invalid("weights entries need a valid KPI metric");
                }

                if (!item.TryGetProperty("weight", out var weightProp) ||
                    weightProp.ValueKind != JsonValueKind.Number ||
                    !weightProp.TryGetInt32(out var weight) || weight < 0)
                {
                    return TerritoryEndpoints.Invalid("weight must be a nonnegative integer");
                }

                weights.Add(new ScoringWeightInputDto { Metric = metric, Weight = weight });
            }

            // zod refinements: exactly the 5 metrics, no duplicates, and the sum must be 100.
            if (weights.Count != 5 || weights.Select(w => w.Metric).Distinct().Count() != 5)
            {
                return TerritoryEndpoints.Invalid("ต้องระบุน้ำหนักของทั้ง 5 เกณฑ์ ครบและไม่ซ้ำ");
            }

            if (weights.Sum(w => w.Weight) != 100)
            {
                return TerritoryEndpoints.Invalid("น้ำหนักรวมทั้ง 5 เกณฑ์ต้องเท่ากับ 100");
            }

            string? note = null;
            if (root.TryGetProperty("note", out var noteProp))
            {
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

            var updated = await settingsService.UpdateScoringWeightsAsync(weights, currentUserService.User!.Id, note, ct);
            return Results.Json(new { weights = updated.Weights });
        }
    }

    private static async Task<IResult> HandleGetEvaluationSetting(
        ISettingsService settingsService,
        CancellationToken ct)
    {
        var setting = await settingsService.GetEvaluationSettingAsync(ct);
        if (setting == null)
        {
            return Results.Json(new { error = "EvaluationSetting singleton row is missing" }, statusCode: StatusCodes.Status500InternalServerError);
        }

        return Results.Json(new { setting });
    }

    private static async Task<IResult> HandleUpdateEvaluationSetting(
        HttpContext httpContext,
        ISettingsService settingsService,
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

            var input = new EvaluationSettingUpdateInput();

            if (root.TryGetProperty("churnMonths", out var churnProp))
            {
                if (!churnProp.TryGetInt32(out var churn) || churn <= 0)
                {
                    return TerritoryEndpoints.Invalid("churnMonths must be a positive integer");
                }

                input.ChurnMonths = churn;
            }

            if (root.TryGetProperty("minMonthsForChurn", out var churnWindowProp))
            {
                if (!churnWindowProp.TryGetInt32(out var window) || window <= 0)
                {
                    return TerritoryEndpoints.Invalid("minMonthsForChurn must be a positive integer");
                }

                input.MinMonthsForChurn = window;
            }

            if (root.TryGetProperty("minMonthsForConsistency", out var consistencyProp))
            {
                if (!consistencyProp.TryGetInt32(out var window) || window <= 0)
                {
                    return TerritoryEndpoints.Invalid("minMonthsForConsistency must be a positive integer");
                }

                input.MinMonthsForConsistency = window;
            }

            if (root.TryGetProperty("aiEnabled", out var aiEnabledProp))
            {
                if (aiEnabledProp.ValueKind != JsonValueKind.True && aiEnabledProp.ValueKind != JsonValueKind.False)
                {
                    return TerritoryEndpoints.Invalid("aiEnabled must be a boolean");
                }

                input.AiEnabled = aiEnabledProp.GetBoolean();
            }

            if (root.TryGetProperty("aiAnonymize", out var aiAnonymizeProp))
            {
                if (aiAnonymizeProp.ValueKind != JsonValueKind.True && aiAnonymizeProp.ValueKind != JsonValueKind.False)
                {
                    return TerritoryEndpoints.Invalid("aiAnonymize must be a boolean");
                }

                input.AiAnonymize = aiAnonymizeProp.GetBoolean();
            }

            if (root.TryGetProperty("potentialMetric", out var potentialProp))
            {
                if (potentialProp.ValueKind != JsonValueKind.String ||
                    !Enum.TryParse<PotentialMetricKey>(potentialProp.GetString(), ignoreCase: false, out var potentialMetric))
                {
                    return TerritoryEndpoints.Invalid("potentialMetric must be one of BEDS, CMI, SUM_ADJ_RW, OCCUPANCY_RATE, PATIENTS, VISITS");
                }

                input.PotentialMetric = potentialMetric;
            }

            if (root.TryGetProperty("minRegionCoverage", out var coverageProp))
            {
                if (coverageProp.ValueKind != JsonValueKind.Number || !coverageProp.TryGetDecimal(out var coverage) ||
                    coverage < 0 || coverage > 1)
                {
                    return TerritoryEndpoints.Invalid("minRegionCoverage must be a number between 0 and 1");
                }

                input.MinRegionCoverage = coverage;
            }

            if (root.TryGetProperty("targetSuggestionAlpha", out var alphaProp))
            {
                if (alphaProp.ValueKind != JsonValueKind.Number || !alphaProp.TryGetDecimal(out var alpha) ||
                    alpha < 0 || alpha > 1)
                {
                    return TerritoryEndpoints.Invalid("targetSuggestionAlpha must be a number between 0 and 1");
                }

                input.TargetSuggestionAlpha = alpha;
            }

            if (root.TryGetProperty("targetLookbackMonths", out var lookbackProp))
            {
                if (!lookbackProp.TryGetInt32(out var lookback) || lookback < 1)
                {
                    return TerritoryEndpoints.Invalid("targetLookbackMonths must be a positive integer");
                }

                input.TargetLookbackMonths = lookback;
            }

            if (root.TryGetProperty("targetOutlierThreshold", out var thresholdProp))
            {
                if (thresholdProp.ValueKind != JsonValueKind.Number || !thresholdProp.TryGetDecimal(out var threshold) ||
                    threshold <= 0 || threshold > 1)
                {
                    return TerritoryEndpoints.Invalid("targetOutlierThreshold must be a number greater than 0 and at most 1");
                }

                input.TargetOutlierThreshold = threshold;
            }

            if (root.TryGetProperty("targetGrowthRate", out var growthProp))
            {
                if (growthProp.ValueKind != JsonValueKind.Number || !growthProp.TryGetDecimal(out var growth) ||
                    growth < 0 || growth > 999.999m)
                {
                    return TerritoryEndpoints.Invalid("targetGrowthRate must be a number between 0 and 999.999");
                }

                input.TargetGrowthRate = growth;
            }

            if (!input.HasAnyField)
            {
                return TerritoryEndpoints.Invalid("ไม่มีค่าที่ต้องการแก้ไข");
            }

            var setting = await settingsService.UpdateEvaluationSettingAsync(input, currentUserService.User!.Id, ct);
            return Results.Json(new { setting });
        }
    }

    private static async Task<IResult> HandleGetTierWeights(
        ITierWeightService tierWeightService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (RequireManager(currentUserService) is { } roleError)
        {
            return roleError;
        }

        return Results.Ok(await tierWeightService.GetEffectiveTierWeightsAsync(ct));
    }

    private static async Task<IResult> HandleUpdateTierWeights(
        HttpContext httpContext,
        ITierWeightService tierWeightService,
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
            if (root.ValueKind != JsonValueKind.Object ||
                !root.TryGetProperty("weights", out var weightsProp) || weightsProp.ValueKind != JsonValueKind.Array)
            {
                return TerritoryEndpoints.Invalid("weights must be an array");
            }

            var weights = new List<(string Tier, decimal Weight)>();
            var seenTiers = new HashSet<string>();
            foreach (var item in weightsProp.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object ||
                    !item.TryGetProperty("tier", out var tierProp) || tierProp.ValueKind != JsonValueKind.String)
                {
                    return TerritoryEndpoints.Invalid("weights entries need a tier");
                }

                var tier = tierProp.GetString()!.Trim();
                if (tier.Length < 1 || tier.Length > 50)
                {
                    return TerritoryEndpoints.Invalid("tier must be between 1 and 50 characters");
                }

                if (!item.TryGetProperty("weight", out var weightProp) ||
                    weightProp.ValueKind != JsonValueKind.Number || !weightProp.TryGetDecimal(out var weight) ||
                    weight < 0 || weight > 999.999m)
                {
                    return TerritoryEndpoints.Invalid("weight must be a number between 0 and 999.999");
                }

                if (!seenTiers.Add(tier))
                {
                    return TerritoryEndpoints.Invalid("ระดับโรงพยาบาลซ้ำกัน");
                }

                weights.Add((tier, weight));
            }

            if (weights.Count == 0)
            {
                return TerritoryEndpoints.Invalid("weights must be a nonempty array");
            }

            var updated = await tierWeightService.UpsertTierWeightsAsync(
                weights.Select(w => (w.Tier, w.Weight)).ToList(),
                ct);
            return Results.Json(new { weights = updated.Weights });
        }
    }
}
