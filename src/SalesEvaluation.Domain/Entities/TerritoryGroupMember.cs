namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class TerritoryGroupMember : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string GroupId { get; set; } = string.Empty;
    public TerritoryGroup Group { get; set; } = null!;
    public string TerritoryId { get; set; } = string.Empty;
    public Territory Territory { get; set; } = null!;
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
