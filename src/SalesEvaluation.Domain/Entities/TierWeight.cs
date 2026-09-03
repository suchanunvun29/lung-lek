namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class TierWeight : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string Tier { get; set; } = string.Empty;
    public decimal Weight { get; set; } = 1.000m;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
