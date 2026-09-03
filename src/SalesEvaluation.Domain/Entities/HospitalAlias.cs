namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class HospitalAlias : IDomainEntity
{
    public int Id { get; set; }
    public string NormalizedKey { get; set; } = string.Empty;
    public string SampleRaw { get; set; } = string.Empty;
    public int HospitalId { get; set; }
    public Hospital Hospital { get; set; } = null!;
    public NameDecisionSource Source { get; set; }
    public int? DecidedById { get; set; }
    public User? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
