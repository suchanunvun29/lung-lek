namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class TargetRevision : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string TargetId { get; set; } = string.Empty;
    public Target Target { get; set; } = null!;
    public TargetChangeType ChangeType { get; set; }
    public string? Before { get; set; }
    public string? After { get; set; }
    public string ChangedById { get; set; } = string.Empty;
    public User ChangedBy { get; set; } = null!;
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    public string? Note { get; set; }
}
