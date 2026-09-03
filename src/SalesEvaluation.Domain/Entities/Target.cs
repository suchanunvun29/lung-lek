namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class Target : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public TargetScope Scope { get; set; } = TargetScope.SALESPERSON;
    public string? TerritoryId { get; set; }
    public Territory? Territory { get; set; }
    public string? TerritoryGroupId { get; set; }
    public TerritoryGroup? TerritoryGroup { get; set; }
    public string? SalespersonId { get; set; }
    public Salesperson? Salesperson { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public decimal RevenueTarget { get; set; } = 0;
    public int NewCustomerTarget { get; set; } = 0;
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<TargetProductGroup> ProductGroupTargets { get; set; } = new List<TargetProductGroup>();
    public ICollection<TargetRevision> Revisions { get; set; } = new List<TargetRevision>();
}
