namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class SalesmanNameRule : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string NormalizedRaw { get; set; } = string.Empty;
    public string SampleRaw { get; set; } = string.Empty;
    public string? DecidedById { get; set; }
    public User? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SalesmanNameRuleMember> Members { get; set; } = new List<SalesmanNameRuleMember>();
}
