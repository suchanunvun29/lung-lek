namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class HospitalPotentialMetric : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string HospitalRegistryId { get; set; } = string.Empty;
    public HospitalRegistry HospitalRegistry { get; set; } = null!;
    public PotentialMetricKey Metric { get; set; }
    public decimal Value { get; set; }
    public int? PeriodYear { get; set; }
    public int? PeriodMonth { get; set; }
    public string? SourceFile { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
