namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class TierWeight : IDomainEntity
{
    public int Id { get; set; }
    public string Tier { get; set; } = string.Empty;
    public decimal Weight { get; set; } = 1.000m;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
