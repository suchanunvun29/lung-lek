namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class ScoringWeightRevision : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string Before { get; set; } = string.Empty;
    public string After { get; set; } = string.Empty;
    public string ChangedById { get; set; } = string.Empty;
    public User ChangedBy { get; set; } = null!;
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    public string? Note { get; set; }
}
