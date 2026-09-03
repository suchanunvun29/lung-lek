namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class EvaluationSetting : IDomainEntity
{
    public int Id { get; set; }
    public int ChurnMonths { get; set; } = 6;
    public int MinMonthsForChurn { get; set; } = 6;
    public int MinMonthsForConsistency { get; set; } = 6;
    public bool AiEnabled { get; set; } = true;
    public bool AiAnonymize { get; set; } = true;
    public PotentialMetricKey PotentialMetric { get; set; } = PotentialMetricKey.BEDS;
    public decimal MinRegionCoverage { get; set; } = 0.50m;
    public decimal TargetSuggestionAlpha { get; set; } = 1.000m;
    public int TargetLookbackMonths { get; set; } = 3;
    public decimal TargetOutlierThreshold { get; set; } = 0.40m;
    public decimal TargetGrowthRate { get; set; } = 1.000m;
    public int? UpdatedById { get; set; }
    public User? UpdatedBy { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
