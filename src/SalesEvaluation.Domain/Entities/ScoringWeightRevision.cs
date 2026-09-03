namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class ScoringWeightRevision : IDomainEntity
{
    public int Id { get; set; }
    public string Before { get; set; } = string.Empty;
    public string After { get; set; } = string.Empty;
    public int ChangedById { get; set; }
    public User ChangedBy { get; set; } = null!;
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    public string? Note { get; set; }
}
