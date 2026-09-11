namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class SalesmanAlias : IDomainEntity
{
    public int Id { get; set; }
    public string NormalizedKey { get; set; } = string.Empty;
    public string SampleRaw { get; set; } = string.Empty;
    public int SalespersonId { get; set; }
    public Salesperson Salesperson { get; set; } = null!;
    public NameDecisionSource Source { get; set; } = NameDecisionSource.AUTO;
    public int? DecidedById { get; set; }
    public User? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
