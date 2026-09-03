namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class TerritoryGroupMember : IDomainEntity
{
    public int Id { get; set; }
    public int GroupId { get; set; }
    public TerritoryGroup Group { get; set; } = null!;
    public int TerritoryId { get; set; }
    public Territory Territory { get; set; } = null!;
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
