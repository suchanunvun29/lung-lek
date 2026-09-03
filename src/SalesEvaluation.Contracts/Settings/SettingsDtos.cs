namespace SalesEvaluation.Contracts.Settings;

using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Domain.Enums;

// ---------- Module E: Settings & scoring weights ----------
// Prisma Decimal columns (minRegionCoverage, targetSuggestionAlpha, targetOutlierThreshold,
// targetGrowthRate) serialize as JSON strings, same as every Express + Prisma response.
// ScoringWeight.weight is an Int column — a JSON number.

public class ScoringWeightDto
{
    public int Id { get; set; }
    public KpiMetric Metric { get; set; }
    public int Weight { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ScoringWeightSnapshotEntryDto
{
    public KpiMetric Metric { get; set; }
    public int Weight { get; set; }
}

public class ScoringWeightRevisionDto
{
    public int Id { get; set; }
    public List<ScoringWeightSnapshotEntryDto> Before { get; set; } = new();
    public List<ScoringWeightSnapshotEntryDto> After { get; set; } = new();
    public int ChangedById { get; set; }
    public UserSummaryDto ChangedBy { get; set; } = null!;
    public DateTime ChangedAt { get; set; }
    public string? Note { get; set; }
}

public class ScoringWeightsResponse
{
    public List<ScoringWeightDto> Weights { get; set; } = new();
    public List<ScoringWeightRevisionDto> Revisions { get; set; } = new();
}

public class UpdatedScoringWeightsResponse
{
    public List<ScoringWeightDto> Weights { get; set; } = new();
}

public class ScoringWeightInputDto
{
    public KpiMetric Metric { get; set; }
    public int Weight { get; set; }
}

public class ScoringWeightsUpdateBody
{
    public List<ScoringWeightInputDto> Weights { get; set; } = new();
    public string? Note { get; set; }
}

public class EvaluationSettingDto
{
    public int Id { get; set; }
    public int ChurnMonths { get; set; }
    public int MinMonthsForChurn { get; set; }
    public int MinMonthsForConsistency { get; set; }
    public bool AiEnabled { get; set; }
    public bool AiAnonymize { get; set; }
    public PotentialMetricKey PotentialMetric { get; set; }

    /// <summary>Prisma Decimal → JSON string (same convention as Target.revenueTarget).</summary>
    public string MinRegionCoverage { get; set; } = string.Empty;
    public string TargetSuggestionAlpha { get; set; } = string.Empty;
    public int TargetLookbackMonths { get; set; }
    public string TargetOutlierThreshold { get; set; } = string.Empty;
    public string TargetGrowthRate { get; set; } = string.Empty;
    public int? UpdatedById { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class EvaluationSettingResponse
{
    public EvaluationSettingDto Setting { get; set; } = null!;
}

/// <summary>PATCH /settings/evaluation body — every field optional (tri-state handled by the endpoint parser).</summary>
public class EvaluationSettingUpdateInput
{
    public int? ChurnMonths { get; set; }
    public int? MinMonthsForChurn { get; set; }
    public int? MinMonthsForConsistency { get; set; }
    public bool? AiEnabled { get; set; }
    public bool? AiAnonymize { get; set; }
    public PotentialMetricKey? PotentialMetric { get; set; }
    public decimal? MinRegionCoverage { get; set; }
    public decimal? TargetSuggestionAlpha { get; set; }
    public int? TargetLookbackMonths { get; set; }
    public decimal? TargetOutlierThreshold { get; set; }
    public decimal? TargetGrowthRate { get; set; }

    public bool HasAnyField =>
        ChurnMonths.HasValue || MinMonthsForChurn.HasValue || MinMonthsForConsistency.HasValue ||
        AiEnabled.HasValue || AiAnonymize.HasValue || PotentialMetric.HasValue ||
        MinRegionCoverage.HasValue || TargetSuggestionAlpha.HasValue || TargetLookbackMonths.HasValue ||
        TargetOutlierThreshold.HasValue || TargetGrowthRate.HasValue;
}

public class TierWeightInputDto
{
    public string Tier { get; set; } = string.Empty;
    public decimal Weight { get; set; }
}

public class TierWeightsUpdateBody
{
    public List<TierWeightInputDto> Weights { get; set; } = new();
}
