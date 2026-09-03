namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class TerritoryGroup : IDomainEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<TerritoryGroupMember> Members { get; set; } = new List<TerritoryGroupMember>();
    public ICollection<Target> Targets { get; set; } = new List<Target>();
}
