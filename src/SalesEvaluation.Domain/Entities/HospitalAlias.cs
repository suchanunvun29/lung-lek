namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class HospitalAlias : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string NormalizedKey { get; set; } = string.Empty;
    public string SampleRaw { get; set; } = string.Empty;
    public string HospitalId { get; set; } = string.Empty;
    public Hospital Hospital { get; set; } = null!;
    public NameDecisionSource Source { get; set; }
    public string? DecidedById { get; set; }
    public User? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
