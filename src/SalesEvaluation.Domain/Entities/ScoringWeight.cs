namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class ScoringWeight : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public KpiMetric Metric { get; set; }
    public int Weight { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
