namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class TargetRevision : IDomainEntity
{
    public int Id { get; set; }
    public int TargetId { get; set; }
    public Target Target { get; set; } = null!;
    public TargetChangeType ChangeType { get; set; }
    public string? Before { get; set; }
    public string? After { get; set; }
    public int ChangedById { get; set; }
    public User ChangedBy { get; set; } = null!;
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    public string? Note { get; set; }
}
