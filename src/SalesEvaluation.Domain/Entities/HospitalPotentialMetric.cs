namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class HospitalPotentialMetric : IDomainEntity
{
    public int Id { get; set; }
    public int HospitalRegistryId { get; set; }
    public HospitalRegistry HospitalRegistry { get; set; } = null!;
    public PotentialMetricKey Metric { get; set; }
    public decimal Value { get; set; }
    public int? PeriodYear { get; set; }
    public int? PeriodMonth { get; set; }
    public string? SourceFile { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
